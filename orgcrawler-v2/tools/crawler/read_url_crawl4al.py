import asyncio

from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode


async def crawl(url):
    # 默认情况下，缓存模式设置为CacheMode.ENABLED。因此，要获得最新内容，需要将其设置为CacheMode.BYPASS
    run_conf = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS
    )
    async with AsyncWebCrawler() as crawler:
        result = await crawler.arun(
            url=url,
            config=run_conf
        )
        return result.markdown


def sync_crawl(url):
    """
    同步调用爬虫的封装方法
    """
    try:
        return asyncio.run(crawl(url))
    except RuntimeError as e:
        raise


if __name__ == "__main__":
    markdown = sync_crawl("https://www.justice.gov/nsd/nsd-news?page=16")
    print(markdown)
