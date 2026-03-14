from selenium import webdriver
from tools.infra.ssh import SshClass
from tools.llms.ollama_llm import OllamaLLM


def getHtml(url):
    # 创建一个Chrome浏览器实例
    driver = webdriver.Chrome()
    driver.get(url)
    # 获取网页内容
    page_content = driver.page_source
    return page_content


def main(url):
    SSH = SshClass(ip="10.108.24.149", username="nlpir", port=37211)
    try:
        SSH.conn_by_pwd("nlpir1013")  # 替换为实际密码
        print("连接成功，启动端口转发...")
        SSH.start_port_forward(11434, 'localhost', 11434)

        llm = OllamaLLM('qwen2.5:32b', mode='new')
        page_content = getHtml(url)
        page_content = llm.chat("请使用将该网页的正文提取出来：" + page_content)
        print(page_content)




    finally:
        SSH.close()
        print("\n程序已安全退出")


if __name__ == "__main__":
    url = "https://cs.bit.edu.cn/szdw/jsml/bssds/0d60585168644bdd9fd96219a137823d.htm"
    main(url)
