#!/usr/bin/env python3
"""
爬取招商银行理财产品信息
"""

import requests
import json
import time
from datetime import datetime

# 产品代码列表
PRODUCT_CODES = [
    "PY040217", "133038A", "YC040310", "JY040231", "JY040230",
    "NY040209", "120057A", "YC040309", "120056A", "GD040315", "GD040325"
]

# 招商银行理财产品API (根据网页分析可能的接口)
CMB_API_URL = "https://www.cmbchina.com/cfweb/svr/product/query"
CMB_PRODUCT_URL = "https://www.cmbchina.com/cfweb/personal/productdetail.aspx"

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Referer': 'https://www.cmbchina.com/cfweb/personal/',
}

def fetch_product_page(product_code):
    """尝试从招商银行官网获取产品页面"""
    try:
        url = f"{CMB_PRODUCT_URL}?code={product_code}"
        response = requests.get(url, headers=headers, timeout=15, verify=False)
        if response.status_code == 200:
            return response.text
    except Exception as e:
        print(f"  获取产品页面失败: {e}")
    return None

def parse_product_info(html_content, product_code):
    """解析产品信息 (简单正则提取)"""
    import re

    info = {
        "产品代码": product_code,
        "产品名称": "",
        "收益率": "",
        "期限": "",
        "起购金额": "",
        "风险等级": "",
        "产品状态": "",
        "获取时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

    if not html_content:
        return info

    # 尝试提取产品名称
    name_patterns = [
        r'<h1[^>]*>(.*?)</h1>',
        r'class="product-name"[^>]*>(.*?)<',
        r'产品名称[：:]\s*([^<]+)',
        r'title["\s:>]+([^<"]+)'
    ]

    for pattern in name_patterns:
        match = re.search(pattern, html_content, re.IGNORECASE | re.DOTALL)
        if match:
            name = match.group(1).strip()
            if len(name) > 2 and len(name) < 100:
                info["产品名称"] = name
                break

    # 尝试提取收益率
    rate_patterns = [
        r'业绩比较基准[：:]\s*([^<%]+%)',
        r'预期收益率[：:]\s*([^<%]+%)',
        r'年化收益率[：:]\s*([^<%]+%)',
        r'收益率[：:]\s*([^<%]+%)',
        r'(\d+\.?\d*%)'
    ]

    for pattern in rate_patterns:
        match = re.search(pattern, html_content, re.IGNORECASE)
        if match:
            info["收益率"] = match.group(1).strip()
            break

    # 尝试提取期限
    term_patterns = [
        r'投资期限[：:]\s*([^<]+)',
        r'产品期限[：:]\s*([^<]+)',
        r'期限[：:]\s*([^<]+天[^<]*)',
        r'(\d+天|\d+个月|\d+年)'
    ]

    for pattern in term_patterns:
        match = re.search(pattern, html_content, re.IGNORECASE)
        if match:
            info["期限"] = match.group(1).strip()[:50]
            break

    # 尝试提取起购金额
    amount_patterns = [
        r'起购金额[：:]\s*([^<]+)',
        r'认购起点[：:]\s*([^<]+)',
        r'(\d+万?元起)',
        r'起点金额[：:]\s*([^<]+)'
    ]

    for pattern in amount_patterns:
        match = re.search(pattern, html_content, re.IGNORECASE)
        if match:
            info["起购金额"] = match.group(1).strip()[:30]
            break

    # 尝试提取风险等级
    risk_patterns = [
        r'风险等级[：:]\s*([^<]+)',
        r'风险级别[：:]\s*([^<]+)',
        r'(R[1-5]级?)',
        r'(稳健型|平衡型|进取型|保守型|激进型)'
    ]

    for pattern in risk_patterns:
        match = re.search(pattern, html_content, re.IGNORECASE)
        if match:
            info["风险等级"] = match.group(1).strip()
            break

    return info

def search_baidu(product_code):
    """通过百度搜索产品信息"""
    try:
        query = f"招商银行 理财产品 {product_code}"
        url = f"https://www.baidu.com/s?wd={query}"
        response = requests.get(url, headers=headers, timeout=15, verify=False)

        if response.status_code == 200:
            # 提取搜索结果中的关键信息
            import re

            # 查找包含产品信息的文本片段
            snippets = re.findall(r'<span class="content-right_8Zs40">(.*?)</span>', response.text, re.DOTALL)
            if not snippets:
                snippets = re.findall(r'<div class="c-abstract[^"]*">(.*?)</div>', response.text, re.DOTALL)

            return ' '.join(snippets[:3])
    except Exception as e:
        print(f"  百度搜索失败: {e}")
    return ""

def search_chinawealth(product_code):
    """通过中国理财网搜索产品备案信息"""
    try:
        url = f"https://www.chinawealth.com.cn/zzlc/jsp/lccp.jsp"
        params = {
            'code': product_code,
            'type': 'all'
        }
        response = requests.get(url, params=params, headers=headers, timeout=15, verify=False)

        if response.status_code == 200:
            return response.text
    except Exception as e:
        print(f"  中国理财网搜索失败: {e}")
    return ""

def main():
    """主函数"""
    print("=" * 60)
    print("招商银行理财产品信息爬取工具")
    print("=" * 60)
    print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"待查询产品数量: {len(PRODUCT_CODES)}")
    print("-" * 60)

    results = []
    failed_codes = []

    for i, code in enumerate(PRODUCT_CODES, 1):
        print(f"\n[{i}/{len(PRODUCT_CODES)}] 查询产品: {code}")

        # 方法1: 直接访问产品页面
        print(f"  尝试方法1: 访问招商银行产品页面...")
        html_content = fetch_product_page(code)
        product_info = parse_product_info(html_content, code)

        if product_info["产品名称"]:
            print(f"  [OK] 成功获取产品信息")
            print(f"    产品名称: {product_info['产品名称']}")
            print(f"    收益率: {product_info['收益率']}")
            print(f"    期限: {product_info['期限']}")
            print(f"    风险等级: {product_info['风险等级']}")
            results.append(product_info)
        else:
            print(f"  [FAIL] 产品页面未获取到有效信息")

            # 方法2: 百度搜索
            print(f"  尝试方法2: 百度搜索...")
            baidu_result = search_baidu(code)
            if baidu_result:
                print(f"  [OK] 搜索到相关信息")
                # 简单提取关键信息
                product_info["产品名称"] = f"[搜索结果] {code}"
                product_info["备注"] = baidu_result[:200]
                results.append(product_info)
            else:
                print(f"  [FAIL] 未找到相关信息")
                failed_codes.append(code)

        # 延迟1秒，避免请求过快
        if i < len(PRODUCT_CODES):
            time.sleep(1)

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

    # 打印汇总表格
    if results:
        print("\n" + "=" * 60)
        print("产品信息汇总")
        print("=" * 60)
        print(f"{'产品代码':<12} {'产品名称':<30} {'收益率':<10} {'期限':<10} {'风险等级':<8}")
        print("-" * 70)
        for r in results:
            print(f"{r['产品代码']:<12} {r['产品名称'][:28]:<30} {r['收益率']:<10} {r['期限']:<10} {r['风险等级']:<8}")

if __name__ == "__main__":
    # 禁用SSL警告
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    main()
