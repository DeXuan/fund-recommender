#!/usr/bin/env python3
"""
生成招商银行理财产品汇总报告
"""

import json

# 读取详细数据
with open("cmb_products_detail.json", "r", encoding="utf-8") as f:
    products = json.load(f)

print("=" * 80)
print("招商银行理财产品信息汇总")
print("=" * 80)
print(f"查询时间: 2026-06-08")
print(f"产品数量: {len(products)}")
print()

# 产品信息表格
print(f"{'代码':<12} {'产品名称':<50} {'风险':<6} {'状态':<6}")
print("-" * 80)

for p in products:
    # 提取简短产品名称
    full_name = p["产品名称"]
    # 取第一个空格前的部分作为简称
    short_name = full_name.split(" ")[0] if full_name else "-"
    if len(short_name) > 48:
        short_name = short_name[:48] + "..."

    risk = p["风险等级"] or "-"
    status = p["产品状态"] or "-"

    print(f"{p['产品代码']:<12} {short_name:<50} {risk:<6} {status:<6}")

print()
print("=" * 80)
print("详细产品信息")
print("=" * 80)

for p in products:
    print(f"\n产品代码: {p['产品代码']}")
    print(f"产品全称: {p['产品名称']}")

    # 提取业绩比较基准
    benchmark = p.get("业绩比较基准", "")
    if benchmark:
        # 从原始文本中提取基准信息
        import re
        # 匹配数字+百分比的模式
        rate_match = re.search(r'(\d+\.?\d*%[^业绩比较基准]*)', benchmark)
        if rate_match:
            print(f"业绩基准: {rate_match.group(1).strip()}")
        elif "活期存款利率" in benchmark:
            print(f"业绩基准: 活期存款利率+固定加点")
        elif "定期存款利率" in benchmark:
            print(f"业绩基准: 定期存款利率+固定加点")
        elif "暂无" in benchmark:
            print(f"业绩基准: 暂无")

    print(f"风险等级: {p['风险等级']}")
    print(f"产品状态: {p['产品状态']}")

    if p.get("产品类别"):
        print(f"产品类别: {p['产品类别']}")
    if p.get("发售起始日期"):
        print(f"发售日期: {p['发售起始日期']}")
    if p.get("产品到期日"):
        print(f"到期日期: {p['产品到期日']}")
    if p.get("产品管理方"):
        print(f"管理方: {p['产品管理方']}")
    if p.get("登记编码"):
        print(f"登记编码: {p['登记编码']}")

print("\n" + "=" * 80)
print("数据来源: 招商银行官方网站 (www.cmbchina.com)")
print("=" * 80)
