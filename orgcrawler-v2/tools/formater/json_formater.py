import json
import ast

def extract_json(text):
    stack = []
    in_string = False
    escape = False
    start_index = -1
    results = []
    brackets = {')': '(', '}': '{', ']': '['}
    opens = {'{', '[', '('}
    closes = {'}', ']', ')'}

    for i, char in enumerate(text):
        if not in_string:
            if char in opens:
                if not stack:
                    start_index = i  # 标记可能的结构起点
                stack.append(char)
            elif char in closes:
                if stack and brackets.get(char, None) == stack[-1]:
                    stack.pop()
                    if not stack:  # 结构闭合
                        candidate = text[start_index:i + 1]
                        try:
                            # 先尝试标准JSON解析
                            parsed = json.loads(candidate)
                            results.append(parsed)
                        except json.JSONDecodeError:
                            try:
                                # 如果失败，尝试用ast.literal_eval解析Python风格的字典
                                parsed = ast.literal_eval(candidate)
                                results.append(parsed)
                            except (ValueError, SyntaxError):
                                # 两种方式都失败则跳过
                                print("JSON/Python dict format invalid!")
                                pass
                else:
                    # 括号不匹配，重置栈
                    stack = []
                    start_index = -1
            elif char == '"' or char == "'":
                in_string = True
                string_quote = char  # 记录字符串的引号类型
        else:
            # 处理字符串内的转义和结束符
            if escape:
                escape = False
            elif char == '\\':
                escape = True
            elif char == string_quote:
                in_string = False

    if not results:
        raise ValueError("No valid JSON or Python dict found in text")
    return results[0]


if __name__ == '__main__':
#     text = """
#     分析结果：
# ```json
# [
#     {
#         "subject": {"name": "牛振东",  "type": "人物"},
#         "relation": "主持",
#         "object": {"name": "中国语言加工脑机制的计算模型",  "type": "项目"}
#     },
#     {
#         "subject": {"name": "樊孝忠",  "type": "人物"},
#         "relation": "主持",
#         "object": {"name": "面向言语的多策略融合机器翻译方法",  "type": "项目"}
#     },
#     {
#         "subject": {"name": "廖乐健",  "type": "人物"},
#         "relation": "主持",
#         "object": {"name": "社交网络的传播基础理论研究",  "type": "项目"}
#     }
# ]
# ```
#
#     """
    text="""
    

```json
{'是否相关': '否'}
```
    """
    print(extract_json(text))
