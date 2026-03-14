import re

import ollama


class OllamaLLM:
    def __init__(self, model_name, mode='new', temperature=0):
        """
        初始化聊天实例
        :param model_name: 模型名称（如 'deepseek-r1:32b'）
        :param default_mode: 默认对话模式，'continue'（续聊）或 'new'（新对话）
        """
        self.model_name = model_name
        self.default_mode = mode
        self.conversation_history = []
        self.temperature = temperature

    def chat(self, user_input, mode=None):
        """
        执行聊天操作
        :param user_input: 用户输入内容
        :param mode: 本次对话模式（None则使用默认模式）
        :return: 模型回复内容
        """
        # 确定本次对话模式
        current_mode = mode if mode is not None else self.default_mode

        # 准备消息列表
        if current_mode == 'new':
            messages = [{'role': 'user', 'content': user_input}]
        else:
            # 续聊模式保留历史
            self.conversation_history.append({'role': 'user', 'content': user_input})
            messages = self.conversation_history.copy()

        # 获取模型响应
        response = ollama.chat(
            model=self.model_name,
            messages=messages,
            options={"temperature": self.temperature}
        )
        response_content = response.message.content

        # 深度思考模型规范化输出
        if "deepseek-r1" in self.model_name:
            # 使用正则表达式移除<thinking>标签及其内容
            response_content = re.sub(
                r'<think>.*?</think>',
                '',
                response_content,
                flags=re.DOTALL
            )
            # 移除首尾空白
            response_content = response_content.strip()

        # 续聊模式保存完整对话历史
        if current_mode == 'continue':
            self.conversation_history.append({'role': 'assistant', 'content': response_content})

        return response_content

    def reset_history(self):
        """清空对话历史"""
        self.conversation_history = []


# 使用示例
if __name__ == "__main__":
    # 初始化实例
    llm = OllamaLLM('deepseek-r1:32b', mode='continue')

    # 续聊模式示例

    print(llm.chat("10+10 是多少？"))  # 输出答案20
    # print(llm.chat("再加5是多少？"))  # 能识别上下文，输出25
    #
    # # 临时切换为新对话模式
    # print(llm.chat("10+10 是多少？", mode='new'))  # 新对话，输出20（不会看到之前的"再加5"）
    #
    # # 继续使用默认的续聊模式
    # print(llm.chat("现在是多少？"))  # 继续之前的历史，输出25
    #
    # # 重置对话历史
    # llm.reset_history()
    # print(llm.chat("现在是多少？"))  # 新对话，输出20（因为历史已重置）
