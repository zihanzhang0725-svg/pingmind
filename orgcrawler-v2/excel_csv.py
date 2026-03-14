import pandas as pd
import ast
import json

def convert_excel_to_jsons(
    excel_path='url全机构-0710.xlsx',
    news_json_path='input/agencies_news.json',
    china_json_path='input/agencies_china.json',
    config_json_path='output/config_info.json'
):

    df = pd.read_excel(excel_path)

    # # 保存为 CSV且将空列表置空
    # df_copy = df.copy()
    # df_copy['战略政策'] = df_copy['战略政策'].apply(lambda x: '' if str(x).strip() == '[]' else x)
    # df_copy.to_csv(csv_output_path, index=False, encoding='utf-8-sig')
    # print(f"已保存为 CSV（已清空空列表URL）：{csv_output_path}")


    output_json = []
    china_json = []
    config_json = []

    for _, row in df.iterrows():
        name = row['机构名称']
        url_str = str(row['URL']).strip()
        type = row['类别']

        # 跳过空 URL
        if url_str == '[]':
            continue

        try:
            url_list = ast.literal_eval(url_str)
            if not url_list:
                continue
        except Exception as e:
            print(f"跳过 {name}，URL 解析错误：{e}")
            continue

        # 添加到两个 JSON 列表
        output_json.append({
            "name": name,
            "url": url_list
        })
        china_json.append({
            "name": name
        })

    for _, row in df.iterrows():
        name = row['机构名称']
        url_str = str(row['URL']).strip()
        type = row['类别']

        try:
            url_list = ast.literal_eval(url_str)
            # if not url_list:
            #     continue
        except Exception as e:
            print(f"跳过 {name}，URL 解析错误：{e}")
            continue

        config_json.append({
            "name":name,
            "url":url_list,
            "type":type
        })

    with open(news_json_path, 'w', encoding='utf-8') as f:
        json.dump(output_json, f, ensure_ascii=False, indent=4)
    print(f"已生成 JSON：{news_json_path}")


    with open(china_json_path, 'w', encoding='utf-8') as f:
        json.dump(china_json, f, ensure_ascii=False, indent=4)
    print(f"已生成 name-only JSON：{china_json_path}")

    with open(config_json_path, 'w', encoding='utf-8') as f:
        json.dump(config_json, f, ensure_ascii=False, indent=4)
    print(f"已生成 config JSON：{china_json_path}")