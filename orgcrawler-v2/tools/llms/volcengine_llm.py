import os
from volcenginesdkarkruntime import Ark
from dotenv import load_dotenv


class VolcengineArkLLM:
    def __init__(self, model_name, api_key=None, mode='new'):
        """
        初始化 Volcengine Ark 聊天实例
        :param model_name: 模型名称（如 'deepseek-v3-241226'）
        :param api_key: API Key，如果为 None 则从环境变量 ARK_API_KEY 中读取
        :param base_url: Ark API 的基础 URL
        """
        load_dotenv()
        self.model_name = model_name
        self.api_key = api_key if api_key is not None else os.getenv("ARK_API_KEY")
        self.client = Ark(api_key=self.api_key)
        self.conversation_history = []
        self.mode = mode

    def chat(self, user_input, system_message="你是人工智能助手.", mode=""):
        """
        执行聊天操作
        :param user_input: 用户输入内容
        :param system_message: 系统消息，默认为 "你是人工智能助手."
        :param mode: 本次对话模式，'continue'（续聊）或 'new'（新对话）
        :return: 模型回复内容
        """
        if mode == "":
            mode = self.mode

        # 准备消息列表
        if mode == 'new':
            messages = [{"role": "system", "content": system_message},
                        {"role": "user", "content": user_input}]
        else:
            # 续聊模式保留历史
            self.conversation_history.append({"role": "user", "content": user_input})
            messages = [{"role": "system", "content": system_message}] + self.conversation_history.copy()

        # 获取模型响应
        completion = self.client.chat.completions.create(
            model=self.model_name,
            messages=messages
        )
        response_content = completion.choices[0].message.content

        # 续聊模式保存完整对话历史
        if mode == 'continue':
            self.conversation_history.append({"role": "assistant", "content": response_content})

        return response_content

    def reset_history(self):
        """清空对话历史"""
        self.conversation_history = []


# 使用示例
if __name__ == "__main__":
    # 初始化实例
    llm = VolcengineArkLLM(model_name='doubao-1-5-lite-32k-250115')

    # 新对话模式示例
    print(llm.chat("常见的十字花科植物有哪些？"))  # 输出常见的十字花科植物
