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
            current_time = datetime.now().strftime("%Y%m%d_%H%M%S")
            file_path = os.path.join(output_dir, f"page_{current_time}_{i}.md")
            with open(file_path, "w", encoding="utf-8") as file:
                file.write(result.markdown)

            llm = VolcengineArkLLM(model_name='deepseek-v3-241226')
            print(llm.chat(result.markdown+"\n以json列表格式提取出以上文档中所有产品的信息，一个产品一个json元素。"))
            print(f"Saved {result.url} to {file_path}")


if __name__ == "__main__":
    # Example usage
    asyncio.run(crawl_and_save("example_name", "http://www.chinajungong.com/Product/201903/20919.html"))