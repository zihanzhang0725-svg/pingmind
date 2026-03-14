import streamlit as st
from datetime import datetime
import json
import pandas as pd
import asyncio
import importlib
from pathlib import Path
from datetime import datetime
import base64
import sys
import shutil
from tools.formater.revise_csv import fix_illegal_fields
import os
import sys
from io import StringIO
#输出日志

def reset_if_all_finished(output_file):
    try:
        if not os.path.exists(output_file):
            return
        df = pd.read_csv(output_file).fillna("")
        if "是否已完成" not in df.columns:
            df["是否已完成"] = "No"
            df.to_csv(output_file, index=False)
            return
        # 如果“战略政策”列为空 => 也设置为已完成
        df.loc[df["战略政策"].astype(str).str.strip() == "", "是否已完成"] = "Yes"
        # 检查是否全部完成
        if df["是否已完成"].str.lower().eq("yes").all():
            df["是否已完成"] = "No"
            df.to_csv(output_file, index=False)
            print("所有机构已完成更新，状态已重置为 No")
    except Exception as e:
        print(f"重置状态出错：{e}")

class DualWriter:
    def __init__(self, st_text_area):
        self.output = StringIO()
        self.st_text_area = st_text_area
        self.placeholder = st.empty()
        self.original_stdout = sys.__stdout__  # 保存原始终端输出

    def write(self, message):
        self.output.write(message)
        self.original_stdout.write(message)  # 输出到终端
        self.original_stdout.flush()

        content = self.output.getvalue()
        # 显示日志 + 滚动到底部的JS脚本
        self.placeholder.markdown(
            f"""
            <div style="height:300px; overflow-y:scroll;" id="log-box">
                <pre>{content}</pre>
            </div>
            <script>
                var logBox = document.getElementById('log-box');
                logBox.scrollTop = logBox.scrollHeight;
            </script>
            """,
            unsafe_allow_html=True,
        )

    def flush(self):
        pass



if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
# 页面设置
st.set_page_config(page_title="数据更新系统", layout="centered")
st.title("机构数据更新系统")

# 当前时间
current_time = datetime.now().strftime("%Y-%m-%d")
st.markdown(f"🕒 日期：**{current_time}**")

# 模块 & 配置路径
news_module = "extract_news"
china_module = "extract_china"

news_config = "input/agencies_news.json"
china_config = "input/agencies_china.json"

# 输出路径
output_file = "output_in/institutions_info.csv"

# ===== 工具函数 =====

def load_config(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else [data]
    except Exception as e:
        st.error(f"加载配置失败：{e}")
        return []

def generate_download_link(file_path):
    try:
        with open(file_path, "rb") as f:
            data = f.read()
        b64 = base64.b64encode(data).decode()
        href = f'<a href="data:file/csv;base64,{b64}" download="institutions_info.csv">下载结果文件</a>'
        return href
    except Exception as e:
        return None

def show_output_csv(path):
    st.subheader("最终结果预览")
    try:
        if Path(path).exists():
            df = pd.read_csv(path)

            # 判断“涉我动向”列是否全空
            if "涉我动向" in df.columns:
                if df["涉我动向"].isnull().all() or (df["涉我动向"].astype(str).str.strip() == "").all():
                    st.info("今日无更新动态")
                else:
                    df["涉我动向"] = df["涉我动向"].fillna("").astype(str)
                    df["最后更新时间"] = df["最后更新时间"].fillna("")

                    columns = ["机构名称", "最后更新时间"]
                    if not df["涉我动向"].astype(str).str.strip().eq("[]").all():
                        columns.insert(1, "涉我动向")

                    df_view = df[columns]
                    st.dataframe(df_view, use_container_width=True)
            else:
                st.warning("未找到 '涉我动向' 列，展示全部数据")
                st.dataframe(df, use_container_width=True)

            # 下载链接
            download_link = generate_download_link(path)
            if download_link:
                st.markdown(download_link, unsafe_allow_html=True)
        else:
            st.info("尚未生成输出文件。")
    except Exception as e:
        st.error(f"读取输出失败：{e}")

# 展示 agencies_news.json 配置文件内容（每行一个机构）
st.subheader("更新爬虫配置文件")

news_config_data = load_config(news_config)

rows = []
for item in news_config_data:
    name = item.get("name", item.get("institution_name", "未知机构"))
    urls = item.get("url", [])
    if isinstance(urls, str):
        urls = [urls]
    url_combined = "\n".join(urls)  
    rows.append({"机构名称": name, "URL": url_combined})

if rows:
    df_config = pd.DataFrame(rows)
    st.dataframe(df_config, use_container_width=True)
else:
    st.info("未找到配置或配置为空。")


# ===== 按钮逻辑 =====
if st.button("执行数据更新"):
    reset_if_all_finished(output_file)
    # 获取当前时间并格式化为字符串（例如：20230707_153045）
    #日志
    log_area = st.empty()
    sys.stdout = DualWriter(log_area)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # 构建备份文件路径
    backup_file = f"{output_file}.{timestamp}"

    try:
        # 复制文件
        shutil.copy2(output_file, backup_file)
        print(f"文件已备份到: {backup_file}")
    except FileNotFoundError:
        print(f"警告: 原始文件 {output_file} 不存在，跳过备份")
        
    except Exception as e:
        print(f"备份文件时出错: {e}")
    progress = st.progress(0, text="准备执行任务...")
    institution_urls = {}

    # Step 1: 执行资讯模块
    progress.progress(10, text="加载 今日动向更新 模块...")
    news = importlib.import_module(news_module)
    news_config_data = load_config(news_config)

    total_news = len(news_config_data)

    #新增跳过是否循环
    df_current = pd.read_csv(output_file).fillna("")
    finished_names = set(df_current[df_current["是否已完成"].str.lower() == "yes"]["机构名称"])
#
    for idx, item in enumerate(news_config_data, 1):
        url_list = item.get("url", [])
        if isinstance(url_list, str):
            url_list = [url_list]
        name = item.get("name", item.get("institution_name", "机构名称"))
        model = item.get("model", "deepseek-v3-250324")
        if name in finished_names:
            print(f"✅ 跳过已完成机构: {name}")
            continue

        # 初始化该机构的URL列表
        if name not in institution_urls:
            institution_urls[name] = []

        for url in url_list:
            new_urls = asyncio.run(news.crawl_and_save(url,institution_name=name,model=model, output_file=output_file))
            institution_urls[name].extend(new_urls)

            progress_pct = int(10 + 40 * idx / total_news)
            progress.progress(progress_pct, text=f"提取资讯中...（{idx}/{total_news}）")
    
        # Step 2: 执行大模型模块
        # progress.progress(60, text="加载 涉我动向判断 模块...")
        # china = importlib.import_module(china_module)
        # # china_config_data = load_config(china_config)

        # total_china = len(institution_urls)
        # for idx, (institution_name, urls) in enumerate(institution_urls.items(), 1):
        #     if not urls:  # 如果没有新URL则跳过
        #         continue
        #     # institution_name = item.get("name", item.get("institution_name", "机构名称"))
        #     model = "deepseek-v3-250324"

        #     # 不传 URL，crawl_and_save 会从 institutions_info.csv 中读取战略政策
        #     asyncio.run(china.crawl_and_save(
        #         urls=urls, institution_name=institution_name, model=model, output_file=output_file
        #     ))

            # progress_pct = int(60 + 40 * idx / total_china)
            # progress.progress(progress_pct, text=f"调用大模型中...（{idx}/{total_china}）")

    progress.progress(100, text="✅ 所有任务执行完毕")
    st.success("所有数据更新任务已完成！")
    sys.stdout = sys.__stdout__

    # 展示 update_news.csv
    st.subheader("今日涉我摘要汇总")
    update_date = datetime.now().strftime("%Y-%m-%d")
    update_path = f"output/update_news_{update_date}.csv"
    if Path(update_path).exists():
        try:
            df_update = pd.read_csv(update_path)
            st.dataframe(df_update, use_container_width=True)
        except Exception as e:
            st.error(f"无法读取 update_news.csv：{e}")
    else:
        st.info("本轮无新增摘要更新")

