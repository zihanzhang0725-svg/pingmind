import requests
from bs4 import BeautifulSoup
from urllib.parse import quote


def bing_search(query):
    try:
        # 构造请求 URL 并添加 User-Agent 防反爬
        url = f"https://www.bing.com/search?form=QBRE&q={quote(query)}&cc=US"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }

        # 发送 HTTP 请求
        response = requests.get(url, headers=headers)
        response.raise_for_status()  # 自动处理 HTTP 错误

        # 解析 HTML
        soup = BeautifulSoup(response.text, "html.parser")
        results = []

        # 提取前 5 个搜索结果
        for item in soup.select("#b_results > .b_algo")[:5]:
            # 提取链接和标题
            link_tag = item.find("a")
            href = link_tag.get("href", "") if link_tag else ""
            title = link_tag.text.strip() if link_tag else ""

            # 提取摘要
            abstract_tag = item.select_one(".b_caption > p")
            abstract = abstract_tag.text.strip() if abstract_tag else ""

            results.append({
                "href": href,
                "title": title,
                "abstract": abstract
            })

        return results

    except requests.exceptions.RequestException as e:
        print(f"Request error: {e}")
        return []
    except Exception as e:
        print(f"Error occurred: {e}")
        return []


# 示例调用
if __name__ == "__main__":
    search_results = bing_search("python programming")
    for idx, result in enumerate(search_results, 1):
        print(f"Result {idx}:")
        print(f"Title: {result['title']}")
        print(f"Link: {result['href']}")
        print(f"Abstract: {result['abstract']}\n")