import json
import pandas as pd
import asyncio
import importlib
import shutil
import os
from datetime import datetime
from tools.formater.revise_csv import fix_illegal_fields  # 如果你用了这个工具
from excel_csv import convert_excel_to_jsons

# 模块路径
news_module = "extract_news"
china_module = "extract_china"

news_config = "input/agencies_news.json"
china_config = "input/agencies_china.json"

output_file = "output_in/institutions_info.csv"

# def reset_if_all_finished(output_file):
#     try:
#         if not os.path.exists(output_file):
#             return
#         df = pd.read_csv(output_file).fillna("")
#         if "是否已完成" not in df.columns:
#             df["是否已完成"] = "No"
#             df.to_csv(output_file, index=False)
#             return
#         # 如果“战略政策”列为空 => 也设置为已完成
#         df.loc[df["战略政策"].astype(str).str.strip() == "[]", "是否已完成"] = "Yes"
#         # 检查是否全部完成
#         if df["是否已完成"].str.lower().eq("yes").all():
#             df["是否已完成"] = "No"
#             df.to_csv(output_file, index=False)
#             print("所有机构已完成更新，状态已重置为 No")
#     except Exception as e:
#         print(f"重置状态出错：{e}")
def reset_if_all_finished(output_file, config_path="input/agencies_news.json"):
    try:
        if not os.path.exists(output_file):
            return

        # 加载配置，获取所有应有的机构名称
        with open(config_path, "r", encoding="utf-8") as f:
            config_data = json.load(f)
        config_names = set()
        for item in config_data:
            name = item.get("name", item.get("institution_name", "机构名称"))
            config_names.add(name)

        # 读取 output_file
        df = pd.read_csv(output_file).fillna("")
        if "机构名称" not in df.columns:
            print("⚠️ 文件中缺少 '机构名称' 列")
            return

        # 初始化“是否已完成”列
        if "是否已完成" not in df.columns:
            df["是否已完成"] = "No"

        # 添加缺失机构（没有任何记录的）
        existing_names = set(df["机构名称"].tolist())
        missing_names = config_names - existing_names
        for name in missing_names:
            df = pd.concat([df, pd.DataFrame([{
                "机构名称": name,
                "战略政策": "[]",
                "是否已完成": "Yes"
            }])], ignore_index=True)

        # ✅ 将战略政策为"[]"的行设置为完成
        df.loc[df["战略政策"].astype(str).str.strip() == "[]", "是否已完成"] = "Yes"

        # ✅ 判断是否全部完成
        if df["是否已完成"].str.lower().eq("yes").all():
            df["是否已完成"] = "No"
            df.to_csv(output_file, index=False)
            print("✅ 所有机构已完成更新，状态已重置为 No")
        else:
            # 保存当前状态（以保留可能新增的机构）
            df.to_csv(output_file, index=False)
    except Exception as e:
        print(f"重置状态出错：{e}")

def reset(output_file):
    try:
        if not os.path.exists(output_file):
            return
            # 读取 output_file
        df = pd.read_csv(output_file).fillna("")
        # 初始化“是否已完成”列
        if "是否已完成" not in df.columns:
            df["是否已完成"] = "No"

        df["是否已完成"] = "No"
        df.to_csv(output_file, index=False)
        print("✅ 所有机构已完成更新，状态已重置为 No")

    except Exception as e:
        print(f"重置状态出错：{e}")

def load_config(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else [data]
    except Exception as e:
        print(f"加载配置失败：{e}")
        return []

def run_update_task():
    # reset_if_all_finished(output_file)
    reset("output_in/institutions_info.csv")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = f"{output_file}.{timestamp}"
    try:
        shutil.copy2(output_file, backup_file)
        print(f"文件已备份到: {backup_file}")
    except FileNotFoundError:
        print(f"警告: 原始文件 {output_file} 不存在，跳过备份")
    except Exception as e:
        print(f"备份文件时出错: {e}")

    institution_urls = {}

    print("加载资讯模块...")
    news = importlib.import_module(news_module)
    news_config_data = load_config(news_config)
    total_news = len(news_config_data)

    df_current = pd.read_csv(output_file).fillna("")
    finished_names = set(df_current[df_current["是否已完成"].str.lower() == "yes"]["机构名称"])

    for idx, item in enumerate(news_config_data, 1):
        url_list = item.get("url", [])
        if isinstance(url_list, str):
            url_list = [url_list]
        name = item.get("name", item.get("institution_name", "机构名称"))
        model = item.get("model", "deepseek-v3-250324")

        if name in finished_names:
            print(f"✅ 跳过已完成机构: {name}")
            continue

        if name not in institution_urls:
            institution_urls[name] = []

        for url in url_list:
            new_urls = asyncio.run(news.crawl_and_save(url, institution_name=name, model=model, output_file=output_file))
            institution_urls[name].extend(new_urls)

        print(f"✔️ {idx}/{total_news} - {name} 数据更新完成")

    print("✅ 所有任务执行完毕")

if __name__ == "__main__":
    convert_excel_to_jsons()
    run_update_task()
