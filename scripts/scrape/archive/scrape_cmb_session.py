#!/usr/bin/env python3
"""
爬取招商银行理财产品信息 - 使用Session处理cookies
"""

import requests
import json
import time
import re
from datetime import datetime
from urllib.parse import quote
import html as html_module

# 产品代码列表
PRODUCT_CODES = [
    "PY040217", "133038A", "YC040310", "JY040231", "JY040230",
    "NY040209", "120057A", "YC040309", "120056A", "GD040315", "GD040325"
]

def clean_html(text):
    """清理HTML标签和实体"""
    if not text:
        return ""
    text = html_module.unescape(text)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def search_with_session_baidu(product_code):
    """使用Session搜索百度"""
    session = requests.Session()
    session.headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
    }

    try:
        # 先访问百度首页获取cookies
        session.get("https://www.baidu.com/", timeout=10, verify=False)
        time.sleep(1)

        # 搜索产品
        query = quote(f"招商银行 理财产品 {product_code}")
        url = f"https://www.baidu.com/s?wd={query}"
        response = session.get(url, timeout=15, verify=False)

        if response.status_code == 200:
            results = []

            # 提取搜索结果 - 百度的HTML结构
            # 尝试多种可能的结构
            patterns = [
                r'<div class="result c-container[^"]*"[^>]*>(.*?)</div>\s*<div class="result',
                r'<div class="c-container"[^>]*>(.*?)</div>',
                r'<h3[^>]*>(.*?)</h3>',
            ]

            # 提取标题
            titles = re.findall(r'<h3[^>]*>\s*<a[^>]*>(.*?)</a>\s*</h3>', response.text, re.DOTALL)

            # 提取摘要
            abstracts = re.findall(r'<span class="content-right_8Zs40">(.*?)</span>', response.text, re.DOTALL)
            if not abstracts:
                abstracts = re.findall(r'<div class="c-abstract[^"]*">(.*?)</div>', response.text, re.DOTALL)

            for i, title in enumerate(titles[:5]):
                title_clean = clean_html(title)
                desc_clean = clean_html(abstracts[i]) if i < len(abstracts) else ""

                if title_clean:
                    results.append({
                        "title": title_clean,
                        "description": desc_clean
                    })

            return results
    except Exception as e:
        print(f"    百度搜索异常: {e}")

    return []

def search_with_session_360(product_code):
    """使用Session搜索360"""
    session = requests.Session()
    session.headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    }

    try:
        # 先访问360首页
        session.get("https://www.so.com/", timeout=10, verify=False)
        time.sleep(1)

        # 搜索
        query = quote(f"招商银行 理财产品 {product_code}")
        url = f"https://www.so.com/s?q={query}"
        response = session.get(url, timeout=15, verify=False)

        if response.status_code == 200:
            results = []

            # 提取标题和摘要
            snippets = re.findall(r'<li class="res-list">(.*?)</li>', response.text, re.DOTALL)

            for snippet in snippets[:5]:
                title_match = re.search(r'<h3[^>]*>(.*?)</h3>', snippet, re.DOTALL)
                title = clean_html(title_match.group(1)) if title_match else ""

                desc_match = re.search(r'<p class="res-desc">(.*?)</p>', snippet, re.DOTALL)
                if not desc_match:
                    desc_match = re.search(r'<p[^>]*>(.*?)</p>', snippet, re.DOTALL)
                desc = clean_html(desc_match.group(1)) if desc_match else ""

                if title:
                    results.append({
                        "title": title,
                        "description": desc
                    })

            return results
    except Exception as e:
        print(f"    360搜索异常: {e}")

    return []

def search_bing(product_code):
    """搜索Bing"""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    }

    try:
        query = quote(f"招商银行 理财产品 {product_code}")
        url = f"https://cn.bing.com/search?q={query}&ensearch=0"
        response = requests.get(url, headers=headers, timeout=15, verify=False)

        if response.status_code == 200:
            results = []

            # Bing的HTML结构
            snippets = re.findall(r'<li class="b_algo">(.*?)</li>', response.text, re.DOTALL)

            for snippet in snippets[:5]:
                title_match = re.search(r'<h2><a[^>]*>(.*?)</a></h2>', snippet, re.DOTALL)
                title = clean_html(title_match.group(1)) if title_match else ""

                desc_match = re.search(r'<p[^>]*>(.*?)</p>', snippet, re.DOTALL)
                desc = clean_html(desc_match.group(1)) if desc_match else ""

                if title:
                    results.append({
                        "title": title,
                        "description": desc
                    })

            return results
    except Exception as e:
        pass

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

    if not search_results:
        return info

    # 合并所有文本
    all_text = ""
    for result in search_results:
        all_text += f" {result.get('title', '')} {result.get('description', '')}"

    # 提取产品名称
    name_patterns = [
        r'招银理财[^\s，,。.]{5,60}',
        r'招商银行[^\s，,。.]{5,40}理财',
        r'(金葵花|朝招金|日日金|鼎鼎成金|季季享|年年享|天添利|天添金|睿逸|招睿|招盈|招恒|招卓)[^\s，,。.]{3,40}',
    ]

    for pattern in name_patterns:
        match = re.search(pattern, all_text)
        if match:
            name = match.group(0).strip()
            name = re.sub(r'^\d{4}年\d{1,2}月\d{1,2}日\s*[-—–]\s*', '', name)
            if len(name) > 8:
                info["产品名称"] = name[:80]
                break

    # 提取收益率
    rate_patterns = [
        r'业绩比较基准[：:\s]*(\d+\.?\d*)\s*[%％]',
        r'预期收益率[：:\s]*(\d+\.?\d*)\s*[%％]',
        r'年化收益率[：:\s]*(\d+\.?\d*)\s*[%％]',
        r'成立以来年化[：:\s]*(\d+\.?\d*)\s*[%％]',
        r'(\d+\.?\d*)\s*[%％]\s*年化',
    ]

    for pattern in rate_patterns:
        match = re.search(pattern, all_text, re.IGNORECASE)
        if match:
            try:
                rate = float(match.group(1))
                if 0.5 < rate < 15:
                    info["收益率"] = f"{rate}%"
                    break
            except:
                pass

    # 提取期限
    term_patterns = [
        r'产品期限[：:\s]*(\d+)\s*天',
        r'(\d+)\s*天\s*定期',
        r'(\d+)\s*个月',
        r'T\+(\d+)',
        r'每日开放',
        r'活期',
    ]

    for pattern in term_patterns:
        match = re.search(pattern, all_text, re.IGNORECASE)
        if match:
            info["期限"] = match.group(0).strip()[:20]
            break

    # 提取风险等级
    risk_patterns = [
        r'(R[1-5])级?',
        r'(稳健型|平衡型|进取型|保守型|激进型)',
        r'(低风险|中低风险|中风险|中高风险|高风险)',
    ]

    for pattern in risk_patterns:
        match = re.search(pattern, all_text, re.IGNORECASE)
        if match:
            info["风险等级"] = match.group(1).strip()
            break

    # 保存摘要
    if search_results:
        info["搜索结果摘要"] = search_results[0].get("description", "")[:200]

    return info

def main():
    """主函数"""
    print("=" * 70)
    print("招商银行理财产品信息查询工具")
    print("=" * 70)
    print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"待查询产品数量: {len(PRODUCT_CODES)}")
    print("-" * 70)

    results = []
    failed_codes = []

    for i, code in enumerate(PRODUCT_CODES, 1):
        print(f"\n[{i}/{len(PRODUCT_CODES)}] 查询产品: {code}")

        # 搜索引擎
        search_engines = [
            ("百度", search_with_session_baidu),
            ("360", search_with_session_360),
            ("Bing", search_bing),
        ]

        all_results = []
        for engine_name, search_func in search_engines:
            print(f"  {engine_name}...", end="", flush=True)
            search_results = search_func(code)
            if search_results:
                print(f" {len(search_results)}条结果")
                all_results.extend(search_results)
            else:
                print(f" 无结果")
            time.sleep(2)

        if all_results:
            product_info = extract_product_info(all_results, code)
            if product_info["产品名称"]:
                print(f"  [OK] {product_info['产品名称']}")
                results.append(product_info)
            else:
                # 保存搜索结果摘要
                product_info["产品名称"] = f"[搜索结果] {code}"
                product_info["搜索结果摘要"] = all_results[0].get("description", "")[:200]
                results.append(product_info)
                print(f"  [PARTIAL] 找到结果但未提取到产品名称")
        else:
            failed_codes.append(code)
            print(f"  [FAIL] 未找到结果")

    # 保存结果
    output_file = "cmb_products_info.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 70)
    print("查询完成!")
    print("=" * 70)
    print(f"成功: {len(results)} | 失败: {len(failed_codes)}")

    if failed_codes:
        print(f"\n失败代码: {', '.join(failed_codes)}")

    # 打印汇总
    if results:
        print("\n" + "=" * 70)
        print("产品信息汇总")
        print("=" * 70)
        for r in results:
            print(f"\n代码: {r['产品代码']}")
            print(f"  名称: {r['产品名称']}")
            if r['收益率']:
                print(f"  收益率: {r['收益率']}")
            if r['风险等级']:
                print(f"  风险: {r['风险等级']}")
            if r['期限']:
                print(f"  期限: {r['期限']}")
            if r['搜索结果摘要']:
                print(f"  摘要: {r['搜索结果摘要'][:100]}...")

if __name__ == "__main__":
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    main()
