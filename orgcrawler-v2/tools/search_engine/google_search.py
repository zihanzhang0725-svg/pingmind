import os
import requests
from dotenv import load_dotenv

load_dotenv()


def google_search(keyword):
    url = "https://www.googleapis.com/customsearch/v1"
    params = {
        "key": os.getenv("SEARCH_API_KEY"),
        "cx": os.getenv("SEARCH_ENGINE_ID"),
        "q": keyword,
        "num": 5  # 获取5条结果
    }

    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        items = response.json().get("items", [])

        search_results = []
        for item in items:
            result = f"标题: {item.get('title')}\n简介: {item.get('snippet')}\n链接: {item.get('link')}"
            search_results.append(result)

        return "\n\n".join(search_results)

    except Exception as e:
        return f"搜索失败: {str(e)}"

# 使用示例
if __name__ == "__main__":
    # 初始化实例
    response = google_search("北京理工大学")

    # 续聊模式示例

    print(response)  # 输出答案20