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
from tools.formater import json_formater
from tools.llms.volcengine_llm import VolcengineArkLLM

csv_lock = asyncio.Lock()
async def crawl_and_save(url, institution_name, output_file="./output_in/institutions_info.csv"):
    try:

        # 检查CSV文件是否存在，不存在则创建
        async with csv_lock:
            if not os.path.exists(output_file):
                initialize_csv(output_file)

            # 读取现有数据
            df = pd.read_csv(output_file).fillna("")

        # 检查该机构是否已存在
        existing_entry = df[df['机构名称'] == institution_name]

        # 初始化当前信息
        if not existing_entry.empty:
            current_info = {
                "机构名称": institution_name,
                "简介": existing_entry.iloc[0]['简介'],
                "发展历史": existing_entry.iloc[0]['发展历史'],
                "组织架构": existing_entry.iloc[0]['组织架构'],
            }
        else:
            current_info = {
                "机构名称": institution_name,
                "简介": "",
                "发展历史": "",
                "组织架构": "",
            }

        # 设置爬取过滤器
        url_filter = URLPatternFilter(patterns=["*Product*"])

        # 创建评分器
        scorer = KeywordRelevanceScorer(
            keywords=["about", "Organization"],
            weight=0.7
        )

        # 配置爬取策略
        strategy = BestFirstCrawlingStrategy(
            max_depth=3,
            include_external=False,
            url_scorer=scorer,
            max_pages=25,
        )
        config = CrawlerRunConfig(deep_crawl_strategy=strategy)

        async with AsyncWebCrawler() as crawler:
            results = await crawler.arun(url, config=config)
            print(f"Crawled {len(results)} pages in total")

            # 处理每个结果
            for i, result in enumerate(results):
                llm = VolcengineArkLLM(model_name='deepseek-v3-250324')
                prompt = (
                        "我现在有一个json，用来存储机构的基本信息：" + str(current_info) +
                        "\n以下是该机构官网上爬取下来的网页，请根据这个网页的内容继续完善我之前给出的json：" + result.markdown +
                        "\n请注意：\n1.如果网页内容是英文，需要翻译成中文填充进json。"
                        "\n2.我只需要简介、发展历史、组织架构三方面的信息。"
                        "\n3.如果我给出的网页没有更多可用的信息，则原样返回我给出的json。"
                        "\n4.以json格式回答。"
                )

                answer = llm.chat(prompt)
                print(answer)

                # 提取JSON并更新当前信息
                updated_info = json_formater.extract_json(answer)
                if updated_info:
                    current_info.update(updated_info)

            # 准备要保存的数据
            new_row = {
                "机构名称": institution_name,
                "简介": current_info.get("简介", ""),
                "发展历史": current_info.get("发展历史", ""),
                "组织架构": current_info.get("组织架构", ""),
                "战略政策": current_info.get("战略政策", ""),
                "最后更新时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "涉我动向": current_info.get("涉我动向", ""),
            }

            async with csv_lock:
                # 重新读取确保获取最新数据
                df = pd.read_csv(output_file)

                # 更新逻辑 - 安全版本
                mask = df['机构名称'] == institution_name
                if mask.any():  # 如果存在
                    for col in new_row:
                        if col in df.columns:
                            df.loc[mask, col] = new_row[col]
                else:  # 如果不存在
                    df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)

                # 确保目录存在
                os.makedirs(os.path.dirname(output_file), exist_ok=True)
                df.to_csv(output_file, index=False, encoding='utf-8')
                print(f"数据已保存到 {output_file}")
    except Exception as e:
        print(f"处理 {institution_name} 时出错: {str(e)}")


def initialize_csv(output_file="./output/institutions_info.csv"):
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
    with open('input/agencies_meta.json', 'r', encoding='utf-8') as f:
        agencies = json.load(f)

    # 限制并发数为5
    semaphore = asyncio.Semaphore(12)

    async def limited_crawl(agency):
        async with semaphore:
            await crawl_and_save(
                url=agency['url'],
                institution_name=agency['name']
            )

    await asyncio.gather(*[limited_crawl(agency) for agency in agencies])


if __name__ == "__main__":
    # 示例用法
    # asyncio.run(crawl_and_save(url="https://www.justice.gov/nsd",institution_name="美国司法部国家安全司"))
    asyncio.run(main())
