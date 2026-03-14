import ast

def extract_list(text):
    # 初始化变量
    list_start = -1
    bracket_count = 0
    extracted_list = None

    # 遍历每个字符
    for i, char in enumerate(text):
        if char == '[':
            if bracket_count == 0:
                list_start = i  # 记录第一个'['的位置
            bracket_count += 1
        elif char == ']':
            bracket_count -= 1
            if bracket_count == 0 and list_start != -1:
                # 提取完整的列表字符串
                list_str = text[list_start:i+1]
                try:
                    # 转换为真正的Python列表
                    extracted_list = ast.literal_eval(list_str)
                except (SyntaxError, ValueError):
                    # 如果转换失败，返回None
                    extracted_list = []
                    print("list formate fail!")
                break

    return extracted_list