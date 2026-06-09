#!/usr/bin/env python3
"""
爬取招商银行理财产品信息 - 尝试直接访问API和产品页面
"""

import requests
import json
import time
import re
from datetime import datetime
from urllib.parse import quote, urlencode

# 产品代码列表
PRODUCT_CODES = [
    "PY040217", "133038A", "YC040310", "JY040231", "JY040230",
    "NY040209", "120057A", "YC040309", "120056A", "GD040315", "GD040325"
]

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'X-Requested-With': 'XMLHttpRequest',
}

def fetch_cmb_api(product_code):
    """尝试招商银行理财产品API"""
    # 尝试多个可能的API端点
    api_urls = [
        f"https://www.cmbchina.com/cfweb/svr/product/query?code={product_code}",
        f"https://www.cmbchina.com/cfweb/svr/product/getProductInfo?productCode={product_code}",
        f"https://www.cmbchina.com/cfweb/personal/api/product/{product_code}",
        f"https://www.cmbchina.com/CmbWebProd/WapPrdDetail.aspx?PrdCode={product_code}",
    ]

    for url in api_urls:
        try:
            response = requests.get(url, headers=headers, timeout=10, verify=False)
            if response.status_code == 200:
                try:
                    data = response.json()
                    if data and isinstance(data, dict):
                        return data
                except:
                    # 不是JSON，可能是HTML
                    if len(response.text) > 500:
                        return {"html": response.text}
        except Exception as e:
            continue

    return None

def fetch_cmb_product_page(product_code):
    """尝试获取招商银行产品详情页面"""
    urls = [
        f"https://www.cmbchina.com/cfweb/personal/productdetail.aspx?code={product_code}",
        f"https://www.cmbchina.com/CmbWebProd/WapPrdDetail.aspx?PrdCode={product_code}",
        f"https://www.cmbchina.com/cfweb/personal/productdetail.html?code={product_code}",
    ]

    for url in urls:
        try:
            response = requests.get(url, headers={
                **headers,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            }, timeout=15, verify=False)

            if response.status_code == 200 and len(response.text) > 1000:
                return response.text
        except:
            continue

    return None

def parse_html_content(html_content, product_code):
    """解析HTML内容提取产品信息"""
    info = {
        "产品代码": product_code,
        "产品名称": "",
        "收益率": "",
        "期限": "",
        "起购金额": "",
        "风险等级": "",
        "产品状态": "",
        "产品类型": "",
        "获取时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

    if not html_content:
        return info

    # 清理HTML实体
    html_content = html_content.replace('&nbsp;', ' ').replace('&amp;', '&')
    html_content = re.sub(r'<[^>]+>', ' ', html_content)
    html_content = re.sub(r'\s+', ' ', html_content)

    # 提取产品名称 - 更宽泛的匹配
    name_patterns = [
        r'招银理财[^，,。\s]{5,50}',
        r'招商银行[^，,。\s]{5,50}理财产品',
        r'金葵花[^，,。\s]{5,50}',
        r'朝招金[^，,。\s]{5,50}',
        r'日日金[^，,。\s]{5,50}',
        r'鼎鼎成金[^，,。\s]{5,50}',
        r'季季享[^，,。\s]{5,50}',
        r'年年享[^，,。\s]{5,50}',
        r'天添利[^，,。\s]{5,50}',
        r'天添金[^，,。\s]{5,50}',
        r'睿逸[^，,。\s]{5,50}',
        r'招睿[^，,。\s]{5,50}',
    ]

    for pattern in name_patterns:
        match = re.search(pattern, html_content)
        if match:
            name = match.group(0).strip()
            if len(name) > 10:
                info["产品名称"] = name[:80]
                break

    # 提取收益率 - 只匹配合理的收益率范围(0-20%)
    rate_patterns = [
        r'业绩比较基准[：:\s]*(\d+\.?\d*)\s*[%％]',
        r'预期收益率[：:\s]*(\d+\.?\d*)\s*[%％]',
        r'年化收益率[：:\s]*(\d+\.?\d*)\s*[%％]',
        r'成立以来年化收益率[：:\s]*(\d+\.?\d*)\s*[%％]',
        r'近7日年化[：:\s]*(\d+\.?\d*)\s*[%％]',
    ]

    for pattern in rate_patterns:
        match = re.search(pattern, html_content, re.IGNORECASE)
        if match:
            rate = float(match.group(1))
            if 0 < rate < 20:  # 合理的收益率范围
                info["收益率"] = f"{rate}%"
                break

    # 提取期限
    term_patterns = [
        r'产品期限[：:\s]*(\d+)\s*天',
        r'投资期限[：:\s]*(\d+)\s*天',
        r'期限[：:\s]*(\d+)\s*天',
        r'(\d+)\s*天定期',
        r'(\d+)\s*个月定期',
        r'T\+(\d+)',
    ]

    for pattern in term_patterns:
        match = re.search(pattern, html_content, re.IGNORECASE)
        if match:
            info["期限"] = match.group(0).strip()[:20]
            break

    # 提取起购金额
    amount_patterns = [
        r'起购金额[：:\s]*(\d+)\s*元',
        r'认购起点[：:\s]*(\d+)\s*元',
        r'起点金额[：:\s]*(\d+)\s*元',
        r'(\d+)\s*万元起',
        r'(\d+)\s*元起购',
    ]

    for pattern in amount_patterns:
        match = re.search(pattern, html_content, re.IGNORECASE)
        if match:
            info["起购金额"] = match.group(0).strip()[:20]
            break

    # 提取风险等级
    risk_patterns = [
        r'风险等级[：:\s]*(R[1-5])',
        r'风险级别[：:\s]*(R[1-5])',
        r'(R[1-5])级',
        r'(稳健型|平衡型|进取型|保守型|激进型)',
        r'风险评级[：:\s]*(低风险|中低风险|中风险|中高风险|高风险)',
    ]

    for pattern in risk_patterns:
        match = re.search(pattern, html_content, re.IGNORECASE)
        if match:
            info["风险等级"] = match.group(1).strip()
            break

    # 提取产品状态
    status_patterns = [
        r'(在售|存续|已到期|已售罄|募集中|封闭期|开放期)',
        r'产品状态[：:\s]*(\S+)',
    ]

    for pattern in status_patterns:
        match = re.search(pattern, html_content, re.IGNORECASE)
        if match:
            info["产品状态"] = match.group(1).strip()[:10]
            break

    return info

def search_with_retry(product_code):
    """带重试的搜索"""
    # 尝试直接获取产品页面
    print(f"  尝试访问招商银行产品页面...")
    html_content = fetch_cmb_product_page(product_code)
    if html_content:
        info = parse_html_content(html_content, product_code)
        if info["产品名称"]:
            print(f"  [OK] 从产品页面获取信息")
            return info

    # 尝试API
    print(f"  尝试招商银行API...")
    api_data = fetch_cmb_api(product_code)
    if api_data:
        if "html" in api_data:
            info = parse_html_content(api_data["html"], product_code)
        else:
            # 直接解析JSON
            info = {
                "产品代码": product_code,
                "产品名称": api_data.get("productName", api_data.get("PrdName", "")),
                "收益率": str(api_data.get("yieldRate", api_data.get("ExpRate", ""))),
                "期限": str(api_data.get("term", api_data.get("Term", ""))),
                "起购金额": str(api_data.get("minAmount", api_data.get("MinAmount", ""))),
                "风险等级": api_data.get("riskLevel", api_data.get("RiskLevel", "")),
                "产品状态": api_data.get("status", api_data.get("Status", "")),
                "获取时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }

        if info.get("产品名称"):
            print(f"  [OK] 从API获取信息")
            return info

    return None

def main():
    """主函数"""
    print("=" * 60)
    print("招商银行理财产品信息爬取工具 v3")
    print("=" * 60)
    print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"待查询产品数量: {len(PRODUCT_CODES)}")
    print("-" * 60)

    results = []
    failed_codes = []

    for i, code in enumerate(PRODUCT_CODES, 1):
        print(f"\n[{i}/{len(PRODUCT_CODES)}] 查询产品: {code}")

        result = search_with_retry(code)

        if result:
            results.append(result)
            print(f"  产品名称: {result['产品名称']}")
            print(f"  收益率: {result['收益率']}")
            print(f"  期限: {result['期限']}")
            print(f"  风险等级: {result['风险等级']}")
        else:
            print(f"  [FAIL] 未找到产品信息")
            failed_codes.append(code)

        # 延迟
        if i < len(PRODUCT_CODES):
            time.sleep(2)

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
        print("\n" + "=" * 80)
        print("产品信息汇总")
        print("=" * 80)
        print(f"{'代码':<12} {'产品名称':<35} {'收益率':<8} {'期限':<10} {'风险':<6} {'状态':<6}")
        print("-" * 80)
        for r in results:
            name = r['产品名称'][:33] if r['产品名称'] else '-'
            print(f"{r['产品代码']:<12} {name:<35} {r['收益率'] or '-':<8} {r['期限'] or '-':<10} {r['风险等级'] or '-':<6} {r['产品状态'] or '-':<6}")

if __name__ == "__main__":
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    main()
