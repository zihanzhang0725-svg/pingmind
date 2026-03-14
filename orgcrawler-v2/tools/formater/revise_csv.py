import pandas as pd
import json
import os
import re

def try_fix_json_string(s):
    """
    尝试修复并解析非法 JSON 字符串为 Python 对象
    """
    if pd.isna(s) or not isinstance(s, str) or s.strip() == "":
        return []

    candidates = [s]

    # 替换常见中文符号为英文
    s_fixed = (
        s.replace("‘", "'").replace("’", "'")
         .replace("“", '"').replace("”", '"')
         .replace("：", ":")
    )
    candidates.append(s_fixed)

    # 替换单引号为双引号
    candidates.append(s_fixed.replace("'", '"'))

    # 尝试补全键名引号
    def fix_keys(json_like_str):
        # 把 {key: 替换为 {"key":
        return re.sub(r'([{,]\s*)([a-zA-Z0-9_]+)\s*:', r'\1"\2":', json_like_str)

    candidates.append(fix_keys(candidates[-1]))

    for candidate in candidates:
        try:
            obj = json.loads(candidate)
            return obj
        except Exception:
            continue

    return None  # 所有方法均失败

def fix_illegal_fields(csv_path: str, fields_to_check=None):
    if not os.path.exists(csv_path):
        print(f"❌ 文件不存在: {csv_path}")
        return

    if fields_to_check is None:
        fields_to_check = ["涉我动向", "战略政策"]

    df = pd.read_csv(csv_path).fillna("")
    original_df = df.copy()

    for idx, row in df.iterrows():
        for field in fields_to_check:
            raw_value = str(row.get(field, "")).strip()
            parsed_value = try_fix_json_string(raw_value)

            if parsed_value is None:
                print(f"[⚠️ 修复失败] 第 {idx + 1} 行 `{field}` 字段非法，将置为空：\n  原值：{raw_value}")
                df.at[idx, field] = "[]"
            else:
                if raw_value != json.dumps(parsed_value, ensure_ascii=False):
                    print(f"[✅ 已修复] 第 {idx + 1} 行 `{field}` 字段格式已修正")
                df.at[idx, field] = json.dumps(parsed_value, ensure_ascii=False)

    # 备份原始文件
    backup_path = csv_path.replace(".csv", "_backup.csv")
    original_df.to_csv(backup_path, index=False, encoding="utf-8")
    print(f"\n✅ 已备份原始文件到: {backup_path}")

    # 保存修复后的文件
    df.to_csv(csv_path, index=False, encoding="utf-8")
    print(f"✅ 已修复并覆盖原文件: {csv_path}")

# 示例调用
if __name__ == "__main__":
    fix_illegal_fields("./output/institutions_info.csv")
