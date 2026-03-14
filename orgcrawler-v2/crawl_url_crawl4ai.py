import asyncio
import os
from datetime import datetime

from crawl4ai import AsyncWebCrawler, CrawlerRunConfig
from crawl4ai.deep_crawling.filters import FilterChain, URLPatternFilter
from crawl4ai.deep_crawling import BFSDeepCrawlStrategy

from tools.llms.volcengine_llm import VolcengineArkLLM


async def crawl_and_save(name, url):

    # Only follow URLs containing "blog" or "docs"
    url_filter = URLPatternFilter(patterns=["*Product*"])

    config = CrawlerRunConfig(
        deep_crawl_strategy=BFSDeepCrawlStrategy(
            max_depth=5,
            max_pages=1,
            filter_chain=FilterChain([url_filter])
        )
    )

    # Create output directory if it doesn't exist
    output_dir = f"../output/{name}"
    os.makedirs(output_dir, exist_ok=True)

    async with AsyncWebCrawler() as crawler:
        results = await crawler.arun(url, config=config)

        print(f"Crawled {len(results)} pages in total")

        # Save each result to a file
        for i, result in enumerate(results):

            llm = VolcengineArkLLM(model_name='doubao-1-5-pro-32k-250115')
            prompt = (
                    result.markdown +
                    "\n提取出以上文档中所有新闻或出版物的url\n"
                    "注意：\n"
                    "1.以python列表格式回答\n"
                    "2.如果能辨别出某条新闻或出版物的时间，则只有其时间不早于2022年才提取出来"
            )

            answer = llm.chat(prompt)
            print(answer)



if __name__ == "__main__":
    # Example usage
    asyncio.run(crawl_and_save("example_name", "https://www.justice.gov/nsd/nsd-statements-testimony-reports"))