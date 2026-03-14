# 1 环境准备（执行1.1环境即可）
## 1.1 配置运行环境
创建虚拟环境

安装requirements.txt

pip install -r requirements.txt

playwrite install

## 1.2 准备谷歌搜索
首先，你需要在Google Cloud Credential Console创建一个GOOGLE_API_KEY，并在可编程搜索引擎(Programmable Search Engine)创建一个GOOGLE_CSE_ID。具体操作可以参考 https://console.cloud.google.com/apis/credentials 和 https://programmablesearchengine.google.com/controlpanel/create。
然后，将这些密钥设置为环境变量，在.env中：
SEARCH_API_KEY="your_api_key"
SEARCH_ENGINE_ID="your_cse_id"

## 1.3 准备火山引擎（大模型）

https://console.volcengine.com/ark/region:ark+cn-beijing/model?vendor=Bytedance&view=LIST_VIEW
根据文档创建api key，填入.env中的ARK_API_KEY

# 2 编辑配置文件(已编辑不需要动)【运行代码自动生成】

- agencies_news.json需要配置组织的官网中会持续更新新闻或资讯的页面url（可以有很多个，对应不同的页码）
- agencies_china.json不需要额外配置url

# 3 运行代码

python run_app.py

更新数据最终以update_news+日期的方式产生

# 4 大模型规则改动

更新规则修改 extract_china.py **109行**


