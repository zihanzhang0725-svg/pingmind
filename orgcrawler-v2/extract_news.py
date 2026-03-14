import ast
import asyncio
import json
import os
from datetime import datetime
from tqdm import tqdm
import pandas as pd
import asyncio

from crawl4ai import AsyncWebCrawler, CrawlerRunConfig
from crawl4ai.deep_crawling.filters import FilterChain, URLPatternFilter
from crawl4ai.deep_crawling import BestFirstCrawlingStrategy
from crawl4ai.deep_crawling.scorers import KeywordRelevanceScorer
from tools.formater import json_formater, list_formater
from tools.llms.volcengine_llm import VolcengineArkLLM
from crawl4ai.deep_crawling import BFSDeepCrawlStrategy
from pathlib import Path

csv_lock = asyncio.Lock()


# 替换原 crawl_and_save 函数的版本
from extract_china import crawl_and_save as crawl_china_save  # 大模型涉华判断逻辑

async def crawl_and_save(url, institution_name, model, output_file="./output_in/institutions_info.csv"):
    try:
        async with csv_lock:
            # 读取当前数据
            df_current = pd.read_csv(output_file).fillna("")
            existing_entry = df_current[df_current['机构名称'] == institution_name]
            current_info = []
            update_time = ""

            if not existing_entry.empty:
                current_info_str = existing_entry.iloc[0]["战略政策"]
                try:
                    current_info = ast.literal_eval(current_info_str) if pd.notna(current_info_str) else []
                except Exception:
                    current_info = []

            # 查找最新的备份文件
            backup_info = []
            backup_files = sorted(Path(output_file).parent.glob("institutions_info.csv.*"), reverse=True)
            for file in backup_files:
                if file.name.endswith(".csv"):
                    continue
                df_backup = pd.read_csv(file).fillna("")
                backup_entry = df_backup[df_backup['机构名称'] == institution_name]
                if not backup_entry.empty:
                    old_info_str = backup_entry.iloc[0]["战略政策"]
                    try:
                        backup_info = ast.literal_eval(old_info_str) if pd.notna(old_info_str) else []
                    except Exception:
                        backup_info = []
                    break

        config = CrawlerRunConfig(
            deep_crawl_strategy=BFSDeepCrawlStrategy(max_depth=5, max_pages=1)
        )

        unique_list = []
        async with AsyncWebCrawler() as crawler:
            results = await crawler.arun(url, config=config)
            print(f"Crawled {len(results)} pages in total")

            for result in results:
                llm = VolcengineArkLLM(model_name=model)
                prompt = (
                    result.markdown +
                    "\n提取出以上文档中所有新闻或出版物的url\n"
                    "注意：\n"
                    "1.以python列表格式回答\n"
                    "2.如果能辨别新闻或出版物的发表时间，则只保留那些不早于2024年的"
                )
                answer = llm.chat(prompt)
                print(answer)
                updated_info = list_formater.extract_list(answer)
                for u in updated_info:
                    if u not in backup_info and u not in unique_list:
                        unique_list.append(u)

        if unique_list:
            print(f"{institution_name} 有新增 URL，共 {len(unique_list)} 条，进行涉我判断...")
            try:
                await crawl_china_save(
                    urls=unique_list,
                    institution_name=institution_name,
                    model=model,
                    output_file=output_file
                )
                print(f"{institution_name} 涉我判断完成")
            except Exception as e:
                print(f"{institution_name} 涉我判断失败: {e}")

            update_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            current_info.extend(unique_list)
        else:
            print(f"{institution_name} 没有新增 URL")

        # 更新保存到 institutions_info.csv
        new_row = {
            "序号": existing_entry.iloc[0]["序号"] if not existing_entry.empty else "",
            "国家/地区": existing_entry.iloc[0]["国家/地区"] if not existing_entry.empty else "",
            "机构名称": institution_name,
            "外文名称": existing_entry.iloc[0]["外文名称"] if not existing_entry.empty else "",
            "简介": existing_entry.iloc[0]["简介"] if not existing_entry.empty else "",
            "发展历史": existing_entry.iloc[0]["发展历史"] if not existing_entry.empty else "",
            "组织架构": existing_entry.iloc[0]["组织架构"] if not existing_entry.empty else "",
            "战略政策": str(current_info),
            "最后更新时间": update_time,
            "涉我动向": existing_entry.iloc[0]["涉我动向"] if not existing_entry.empty else "",
            "是否已完成": "Yes"
        }

        async with csv_lock:
            df = pd.read_csv(output_file).fillna("")
            mask = df['机构名称'] == institution_name
            if mask.any():
                for col in new_row:
                    if col in df.columns:
                        df.loc[mask, col] = new_row[col]
            else:
                df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
            os.makedirs(os.path.dirname(output_file), exist_ok=True)
            df.to_csv(output_file, index=False, encoding='utf-8')
            print(f"数据已保存到 {output_file}")

        return unique_list

    except Exception as e:
        print(f"处理 {institution_name} 时未新爬取到内容: {str(e)}")
        new_row = {
            "序号": existing_entry.iloc[0]["序号"] if not existing_entry.empty else "",
            "国家/地区": existing_entry.iloc[0]["国家/地区"] if not existing_entry.empty else "",
            "机构名称": institution_name,
            "外文名称": existing_entry.iloc[0]["外文名称"] if not existing_entry.empty else "",
            "简介": existing_entry.iloc[0]["简介"] if not existing_entry.empty else "",
            "发展历史": existing_entry.iloc[0]["发展历史"] if not existing_entry.empty else "",
            "组织架构": existing_entry.iloc[0]["组织架构"] if not existing_entry.empty else "",
            "战略政策": str(current_info),
            "最后更新时间": update_time,
            "涉我动向": existing_entry.iloc[0]["涉我动向"] if not existing_entry.empty else "",
            "是否已完成": "Yes"
        }
        return []
    
    finally:
        # 无论是否发生异常，都更新"是否完成"列为"Yes"
        try:
            async with csv_lock:
                df = pd.read_csv(output_file).fillna("")
                mask = df['机构名称'] == institution_name
                if mask.any():
                    for col in new_row:
                        if col in df.columns:
                            df.loc[mask, col] = new_row[col]
                else:
                    df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
                os.makedirs(os.path.dirname(output_file), exist_ok=True)
                df.to_csv(output_file, index=False, encoding='utf-8')
                print(f"数据已保存到 {output_file}")
        except Exception as e:
            print(f"更新完成状态时出错: {str(e)}")



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
    with open('./input/agencies_news.json', 'r', encoding='utf-8') as f:
        agencies = json.load(f)

    # 限制并发数为5
    semaphore = asyncio.Semaphore(12)

    async def limited_crawl(agency):
        async with semaphore:
            # 遍历 agency 的每个 URL
            for url in agency['url']:
                await crawl_and_save(
                    url=url,
                    institution_name=agency['name'],
                    model='doubao-pro-32k-241215',
                    output_file="./output_in/institutions_info.csv"
                )

    await asyncio.gather(*[limited_crawl(agency) for agency in agencies])


if __name__ == "__main__":
    # 示例用法
    # asyncio.run(crawl_and_save(url="https://www.justice.gov/nsd",institution_name="美国司法部国家安全司"))
    asyncio.run(main())
