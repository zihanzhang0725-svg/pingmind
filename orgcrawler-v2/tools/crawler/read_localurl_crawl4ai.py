import asyncio
from crawl4ai import AsyncWebCrawler, CacheMode
from crawl4ai.async_configs import CrawlerRunConfig

async def crawl_local_file():
    local_file_path = r"C:\Users\JiangXue\Desktop\新建文本文档.html"  # Replace with your file path
    file_url = f"file://{local_file_path}"
    config = CrawlerRunConfig(cache_mode=CacheMode.BYPASS)

    async with AsyncWebCrawler() as crawler:
        result = await crawler.arun(url=file_url, config=config)
        if result.success:
            print("Markdown Content from Local File:")
            print(result.markdown)
        else:
            print(f"Failed to crawl local file: {result.error_message}")

asyncio.run(crawl_local_file())

