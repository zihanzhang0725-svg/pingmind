import ast
import asyncio
import csv
import json
import os
from datetime import datetime
from tqdm import tqdm
import pandas as pd
import asyncio
import shutil


from crawl4ai import AsyncWebCrawler, CrawlerRunConfig
from crawl4ai.deep_crawling.filters import FilterChain, URLPatternFilter
from crawl4ai.deep_crawling import BestFirstCrawlingStrategy
from crawl4ai.deep_crawling.scorers import KeywordRelevanceScorer
from tools.formater import json_formater, list_formater
from tools.llms.volcengine_llm import VolcengineArkLLM
from crawl4ai.deep_crawling import BFSDeepCrawlStrategy
from tools.formater.revise_csv import fix_illegal_fields

csv_lock = asyncio.Lock()
fix_illegal_fields("./output_in/institutions_info.csv")

async def crawl_and_save(urls, institution_name, model, output_file="./output_in/institutions_info.csv", log_fn=print):
    try:
        async with csv_lock:
            if not os.path.exists(output_file):
                initialize_csv(output_file)

            df = pd.read_csv(output_file).fillna("")

        existing_entry = df[df['机构名称'] == institution_name]

        # 默认初始化
        current_info = []
        unique_list = []

        if not existing_entry.empty:
            row = existing_entry.iloc[0]

            # 安全地解析战略政策字段
            try:
                current_info_str = row["战略政策"]
                if pd.notna(current_info_str) and current_info_str.strip().startswith("["):
                    current_info = ast.literal_eval(current_info_str)
                    if not isinstance(current_info, list):
                        current_info = []
                else:
                    current_info = []
            except Exception as e:
                current_info_str=""
                log_fn(f"[错误] {institution_name} 战略政策字段读取失败：{e}")
                current_info = []

            # 安全地解析涉我动向字段
            try:
                unique_list_str = row["涉我动向"]
                if pd.notna(unique_list_str) and unique_list_str.strip().startswith("["):
                    unique_list = ast.literal_eval(unique_list_str)
                    if not isinstance(unique_list, list):
                        unique_list = []
                else:
                    unique_list = []
            except Exception as e:
                log_fn(f"[警告] {institution_name} 涉我动向字段读取失败：{e}")
                unique_list_str=""
                unique_list = []

            # 提取其他字段
            info_fields = {
                "简介": row.get("简介", ""),
                "发展历史": row.get("发展历史", ""),
                "组织结构": row.get("组织结构", ""),
                "战略政策": current_info_str if 'current_info_str' in locals() else "",
                "涉我动向": unique_list_str if 'unique_list_str' in locals() else "",
            }

        # 如果当前没有 URL，要跳过
        if not urls:
            log_fn(f"[跳过] {institution_name} 未提供任何战略政策链接。")
            return

        log_fn(f"[读取] {institution_name} 战略政策URL数量：{len(current_info)}")

        config = CrawlerRunConfig(
            deep_crawl_strategy=BFSDeepCrawlStrategy(max_depth=5, max_pages=1)
        )

        update_links = []
        update_summaries = []
        update_records = [] 

        for url in urls:
            if url in unique_list:
                continue

            try:
                async with AsyncWebCrawler() as crawler:
                    results = await crawler.arun(url, config=config)

                    for result in results:
                        llm = VolcengineArkLLM(model_name=model)
                        markdown = result.markdown or ""

                        # 检查是否涉华
                        check_prompt = (
                            markdown +
                            "\n你是一个从业中国网络治理和研究的业务人员，请根据给你的网页判断上述网页内容是否与中国网络治理或者中国网络关防相关。特别是涉及以下领域：\n 网络审查技术、科研资助、网信战略、网安政策立法、网络安全事件、网络内容审查、人工智能治理以及网络空间国际治理。\n以 JSON 格式回答，例如：{'是否相关': '是'}"
                        )
                        log_fn(f"[大模型] 请求判断是否业务相关：{url}")
                        check_answer = llm.chat(check_prompt)
                        parsed_check = json_formater.extract_json(check_answer)
                        log_fn(f"[大模型] 判断结果：{parsed_check}")

                        if parsed_check.get("是否相关") == "否":
                            continue

                        # ✅ 保存 HTML 页面
                        html_content = result.html or ""
                        if html_content:
                            safe_name = institution_name.replace("/", "_")[:30]
                            safe_time = datetime.now().strftime("%Y%m%d_%H%M%S")
                            html_dir = f"./output_in/html/{safe_name}"
                            os.makedirs(html_dir, exist_ok=True)
                            html_path = os.path.join(html_dir, f"{safe_time}.html")
                            with open(html_path, "w", encoding="utf-8") as f_html:
                                f_html.write(html_content)
                            log_fn(f"[保存HTML] 已保存 HTML 页面到：{html_path}")


                        # 总结涉我内容
                        summary_prompt = (
                            markdown +
                            "\n请用简洁中文总结这篇文章与中国网络治理或者中国网络关防相关的核心内容，不超过150字。"
                        )
                        summary_answer = llm.chat(summary_prompt).strip()
                        

                        update_links.append(url)
                        update_summaries.append(summary_answer)
                        update_records.append((url, summary_answer, html_path))

            except Exception as e:
                log_fn(f"[错误] {institution_name} 抓取或解析 URL 时出错：{e}")

        if update_links:
            update_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            unique_list.extend(update_links)
            unique_list = list(set(unique_list))  # 去重

            new_row = {
                "序号":existing_entry.iloc[0]["序号"],
                "国家/地区":existing_entry.iloc[0]["国家/地区"],
                "机构名称": institution_name,
                "外文名称":existing_entry.iloc[0]["外文名称"],
                "简介": existing_entry.iloc[0]["简介"],
                "发展历史": existing_entry.iloc[0]["发展历史"],
                "组织架构": existing_entry.iloc[0]["组织架构"],
                "战略政策": existing_entry.iloc[0]["战略政策"],
                "最后更新时间": update_time,
                "涉我动向": str(unique_list),
            }

            async with csv_lock:
                df = pd.read_csv(output_file)
                mask = df['机构名称'] == institution_name
                if mask.any():
                    for col in new_row:
                        if col in df.columns:
                            df.loc[mask, col] = new_row[col]
                else:
                    df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
                df.to_csv(output_file, index=False, encoding='utf-8')

            # 同步写入 update_news_xxx.csv
            update_date = datetime.now().strftime("%Y-%m-%d")
            update_path = f"./output/update_news_{update_date}.csv"
            #备份一个
            update_backup = f"./output_in/update/update_news_{update_date}.csv"
            os.makedirs(os.path.dirname(update_path), exist_ok=True)

            with open(update_path, "a", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                if not os.path.exists(update_path) or os.stat(update_path).st_size == 0:
                    writer.writerow(["机构名称", "最后更新时间", "涉我动向链接", "动向摘要", "HTML路径"])
                # 对每个链接单独写入一行
                # for url, summary in zip(update_links, update_summaries):
                #     writer.writerow([
                #         institution_name,
                #         update_time,
                #         url,  # 单个URL
                #         summary  # 对应的单个摘要
                #     ])
                for url, summary, html_path in update_records:
                    writer.writerow([
                        institution_name,
                        update_time,
                        url,
                        summary,
                        html_path
                    ])

            log_fn(f"[保存] {institution_name} 摘要结果已写入 {update_path}")

            # ✅ 追加：备份文件
            try:
                shutil.copy2(update_path, update_backup)
                log_fn(f"[备份] 文件已复制到 {update_backup}")
            except Exception as e:
                log_fn(f"[备份失败] 无法复制到 {update_backup}：{e}")
            
            # ✅ 最后将 HTML 文件夹整体从 output_in/html/ 备份到 output/html/
            try:
                html_src_dir = f"./output_in/html/{institution_name.replace('/', '_')[:30]}"
                html_dst_dir = f"./output/html/{institution_name.replace('/', '_')[:30]}"
                os.makedirs(html_dst_dir, exist_ok=True)

                for filename in os.listdir(html_src_dir):
                    src_file = os.path.join(html_src_dir, filename)
                    dst_file = os.path.join(html_dst_dir, filename)
                    shutil.copy2(src_file, dst_file)
                log_fn(f"[最终备份] HTML 目录已整体备份至 {html_dst_dir}")
            except Exception as e:
                log_fn(f"[最终备份失败] 无法备份 HTML 目录：{e}")
                
    except Exception as e:
        log_fn(f"[异常] 处理 {institution_name} 时出错：{e}")




def initialize_csv(output_file="./output_in/institutions_info.csv"):
    columns = [
        "序号",
        "国家/地区",
        "机构名称",
        "外文名称",
        "简介",
        "发展历史",
        "组织架构",
        "战略政策",
        "最后更新时间",
        "涉我动向"
    ]
    pd.DataFrame(columns=columns).to_csv(output_file, index=False, encoding='utf-8')


async def main():
    with open('input/agencies_china.json', 'r', encoding='utf-8') as f:
        agencies = json.load(f)

    # 限制并发数为5
    semaphore = asyncio.Semaphore(12)

    async def limited_crawl(agency):
        async with semaphore:

            await crawl_and_save(
                url="",
                institution_name=agency['name'],
                model='doubao-1-5-pro-32k-250115',
                output_file="./output_in/institutions_info.csv"
            )

    await asyncio.gather(*[limited_crawl(agency) for agency in agencies])


if __name__ == "__main__":
    # 示例用法
    # asyncio.run(crawl_and_save(url="https://www.justice.gov/nsd",institution_name="美国司法部国家安全司"))
    asyncio.run(main())
