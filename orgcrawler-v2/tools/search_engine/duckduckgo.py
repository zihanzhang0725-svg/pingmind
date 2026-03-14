from duckduckgo_search import DDGS
from pprint import pprint

with DDGS() as ddgs:
    pprint([r for r in ddgs.text("大模型", region='cn-zh', max_results=10)])