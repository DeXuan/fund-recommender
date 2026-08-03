#!/usr/bin/env python3
"""
爬取招商银行理财产品信息 - 使用Bing搜索和中国理财网
"""

import requests
import json
import time
import re
from datetime import datetime
from urllib.parse import quote

# 产品代码列表
PRODUCT_CODES = [
    "PY040217", "133038A", "YC040310", "JY040231", "JY040230",
    "NY040209", "120057A", "YC040309", "120056A", "GD040315", "GD040325"
]

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
}

def search_bing_cn(product_code):
    """通过Bing中国搜索产品信息"""
    try:
        query = quote(f"招商银行 理财产品 {product_code}")
        url = f"https://cn.bing.com/search?q={query}&ensearch=0"

        response = requests.get(url, headers=headers, timeout=15, verify=False)
        if response.status_code == 200:
            # 提取搜索结果
            results = []

            # 提取标题和摘要
            snippets = re.findall(r'<li class="b_algo">(.*?)</li>', response.text, re.DOTALL)

            for snippet in snippets[:5]:
                # 提取标题
                title_match = re.search(r'<h2><a[^>]*>(.*?)</a></h2>', snippet, re.DOTALL)
                title = title_match.group(1) if title_match else ""
                title = re.sub(r'<[^>]+>', '', title).strip()

                # 提取摘要
                desc_match = re.search(r'<p[^>]*>(.*?)</p>', snippet, re.DOTALL)
                desc = desc_match.group(1) if desc_match else ""
                desc = re.sub(r'<[^>]+>', '', desc).strip()

                if title or desc:
                    results.append({
                        "title": title,
                        "description": desc
                    })

            return results
    except Exception as e:
        print(f"  Bing搜索失败: {e}")
    return []

def search_360(product_code):
    """通过360搜索产品信息"""
    try:
        query = quote(f"招商银行 理财产品 {product_code}")
        url = f"https://www.so.com/s?q={query}"

        response = requests.get(url, headers=headers, timeout=15, verify=False)
        if response.status_code == 200:
            results = []

            # 提取搜索结果
            snippets = re.findall(r'<li class="res-list">(.*?)</li>', response.text, re.DOTALL)

            for snippet in snippets[:5]:
                title_match = re.search(r'<h3[^>]*>(.*?)</h3>', snippet, re.DOTALL)
                title = title_match.group(1) if title_match else ""
                title = re.sub(r'<[^>]+>', '', title).strip()

                desc_match = re.search(r'<p[^>]*>(.*?)</p>', snippet, re.DOTALL)
                desc = desc_match.group(1) if desc_match else ""
                desc = re.sub(r'<[^>]+>', '', desc).strip()

                if title or desc:
                    results.append({
                        "title": title,
                        "description": desc
                    })

            return results
    except Exception as e:
        print(f"  360搜索失败: {e}")
    return []

def search_sogou(product_code):
    """通过搜狗搜索产品信息"""
    try:
        query = quote(f"招商银行 理财产品 {product_code}")
        url = f"https://sogou.com/web?query={query}"

        response = requests.get(url, headers=headers, timeout=15, verify=False)
        if response.status_code == 200:
            results = []

            # 提取搜索结果
            snippets = re.findall(r'<div class="vrwrap">(.*?)</div>', response.text, re.DOTALL)

            for snippet in snippets[:5]:
                title_match = re.search(r'<h3[^>]*>(.*?)</h3>', snippet, re.DOTALL)
                title = title_match.group(1) if title_match else ""
                title = re.sub(r'<[^>]+>', '', title).strip()

                desc_match = re.search(r'<p[^>]*>(.*?)</p>', snippet, re.DOTALL)
                desc = desc_match.group(1) if desc_match else ""
                desc = re.sub(r'<[^>]+>', '', desc).strip()

                if title or desc:
                    results.append({
                        "title": title,
                        "description": desc
                    })

            return results
    except Exception as e:
        print(f"  搜狗搜索失败: {e}")
    return []

def extract_product_info(search_results, product_code):
    """从搜索结果中提取产品信息"""
    info = {
        "产品代码": product_code,
        "产品名称": "",
        "收益率": "",
        "期限": "",
        "起购金额": "",
        "风险等级": "",
        "产品状态": "",
        "搜索结果摘要": "",
        "获取时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

    all_text = ""
    for result in search_results:
        all_text += f" {result.get('title', '')} {result.get('description', '')}"

    # 提取产品名称
    name_patterns = [
        r'招银理财[^，,。.]*',
        r'招商银行[^，,。.]*理财产品[^，,。.]*',
        r'金葵花[^，,。.]*',
        r'朝招金[^，,。.]*',
        r'日日金[^，,。.]*',
        r'鼎鼎成金[^，,。.]*',
        r'季季享[^，,。.]*',
        r'年年享[^，,。.]*',
    ]

    for pattern in name_patterns:
        match = re.search(pattern, all_text)
        if match:
            name = match.group(0).strip()
            if len(name) > 5:
                info["产品名称"] = name[:60]
                break

    # 提取收益率
    rate_match = re.search(r'(\d+\.?\d*)\s*[%％]', all_text)
    if rate_match:
        info["收益率"] = f"{rate_match.group(1)}%"

    # 提取期限
    term_match = re.search(r'(\d+)\s*[天日个月年]', all_text)
    if term_match:
        info["期限"] = term_match.group(0)

    # 提取风险等级
    risk_match = re.search(r'(R[1-5]|稳健型|平衡型|进取型|保守型|激进型)', all_text)
    if risk_match:
        info["风险等级"] = risk_match.group(1)

    # 保存搜索结果摘要
    if search_results:
        info["搜索结果摘要"] = search_results[0].get("description", "")[:200]

    return info

def main():
    """主函数"""
    print("=" * 60)
    print("招商银行理财产品信息爬取工具 v2")
    print("=" * 60)
    print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"待查询产品数量: {len(PRODUCT_CODES)}")
    print("-" * 60)

    results = []
    failed_codes = []

    for i, code in enumerate(PRODUCT_CODES, 1):
        print(f"\n[{i}/{len(PRODUCT_CODES)}] 查询产品: {code}")

        # 搜索引擎列表
        search_engines = [
            ("Bing", search_bing_cn),
            ("360", search_360),
            ("搜狗", search_sogou),
        ]

        all_results = []
        for engine_name, search_func in search_engines:
            print(f"  尝试 {engine_name} 搜索...")
            search_results = search_func(code)
            if search_results:
                print(f"    找到 {len(search_results)} 条结果")
                all_results.extend(search_results)
            else:
                print(f"    未找到结果")

            time.sleep(1)  # 延迟1秒

        if all_results:
            product_info = extract_product_info(all_results, code)
            if product_info["产品名称"]:
                print(f"  [OK] 成功提取产品信息")
                print(f"    产品名称: {product_info['产品名称']}")
                print(f"    收益率: {product_info['收益率']}")
            else:
                print(f"  [WARN] 找到搜索结果但未能提取产品名称")
                product_info["产品名称"] = f"[搜索中] {code}"
            results.append(product_info)
        else:
            print(f"  [FAIL] 所有搜索引擎均未找到结果")
            failed_codes.append(code)

    # 保存结果
    output_file = "cmb_products_info.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 60)
    print("查询完成!")
    print("=" * 60)
    print(f"成功查询: {len(results)} 个产品")
    print(f"查询失败: {len(failed_codes)} 个产品")

    if failed_codes:
        print(f"\n失败的产品代码:")
        for code in failed_codes:
            print(f"  - {code}")

    print(f"\n结果已保存到: {output_file}")

    # 打印汇总
    if results:
        print("\n" + "=" * 60)
        print("产品信息汇总")
        print("=" * 60)
        for r in results:
            print(f"\n产品代码: {r['产品代码']}")
            print(f"  产品名称: {r['产品名称']}")
            print(f"  收益率: {r['收益率']}")
            print(f"  期限: {r['期限']}")
            print(f"  风险等级: {r['风险等级']}")
            if r['搜索结果摘要']:
                print(f"  摘要: {r['搜索结果摘要'][:100]}...")

if __name__ == "__main__":
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    main()
