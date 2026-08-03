#!/usr/bin/env python3
"""
尝试通过招商银行移动端API获取理财产品信息
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

# 移动端headers
mobile_headers = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'X-Requested-With': 'XMLHttpRequest',
}

# 可能的API端点
API_ENDPOINTS = [
    # 移动端API
    "https://mobile.cmbchina.com/IEntrustFinance/FinanceProduct/GetProductDetail",
    "https://mobile.cmbchina.com/api/finance/product/{code}",
    # 网页版API
    "https://www.cmbchina.com/cfweb/svr/product/query",
    "https://www.cmbchina.com/cfweb/svr/product/getProductInfo",
    # 理财产品API
    "https://www.cmbchina.com/cfweb/personal/product.ashx?code={code}",
    # 其他可能的端点
    "https://财富生活.cmbchina.com/api/product/{code}",
]

def try_api_endpoint(url, product_code):
    """尝试API端点"""
    try:
        # 替换URL中的产品代码
        if '{code}' in url:
            url = url.replace('{code}', product_code)

        # 尝试GET请求
        response = requests.get(url, headers=mobile_headers, timeout=10, verify=False)

        if response.status_code == 200:
            try:
                data = response.json()
                if data and isinstance(data, dict):
                    return {"method": "GET", "data": data}
            except:
                pass

        # 尝试POST请求
        post_data = {
            "productCode": product_code,
            "code": product_code,
            "PrdCode": product_code,
        }
        response = requests.post(url, json=post_data, headers=mobile_headers, timeout=10, verify=False)

        if response.status_code == 200:
            try:
                data = response.json()
                if data and isinstance(data, dict):
                    return {"method": "POST", "data": data}
            except:
                pass

    except Exception as e:
        pass

    return None

def try_direct_page_access(product_code):
    """尝试直接访问产品页面"""
    urls = [
        f"https://www.cmbchina.com/cfweb/personal/productdetail.aspx?code={product_code}",
        f"https://www.cmbchina.com/CmbWebProd/WapPrdDetail.aspx?PrdCode={product_code}",
        f"https://m.cmbchina.com/finance/product/{product_code}",
        f"https://mobile.cmbchina.com/finance/product/{product_code}",
    ]

    for url in urls:
        try:
            response = requests.get(url, headers={
                **mobile_headers,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            }, timeout=15, verify=False, allow_redirects=True)

            if response.status_code == 200 and len(response.text) > 2000:
                return response.text
        except:
            pass

    return None

def parse_product_from_html(html_content, product_code):
    """从HTML中解析产品信息"""
    import re
    import html as html_module

    info = {
        "产品代码": product_code,
        "产品名称": "",
        "收益率": "",
        "期限": "",
        "起购金额": "",
        "风险等级": "",
        "产品状态": "",
    }

    if not html_content:
        return info

    # 清理HTML
    text = html_module.unescape(html_content)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'\s+', ' ', text)

    # 提取产品名称
    name_patterns = [
        r'招银理财[^\s，,。.]{5,60}',
        r'招商银行[^\s，,。.]{5,40}理财',
        r'(金葵花|朝招金|日日金|鼎鼎成金|季季享|年年享|天添利|天添金|睿逸|招睿)[^\s，,。.]{3,40}',
    ]

    for pattern in name_patterns:
        match = re.search(pattern, text)
        if match:
            name = match.group(0).strip()
            if len(name) > 8:
                info["产品名称"] = name[:80]
                break

    # 提取收益率
    rate_match = re.search(r'(\d+\.?\d*)\s*[%％]', text)
    if rate_match:
        rate = float(rate_match.group(1))
        if 0.5 < rate < 15:
            info["收益率"] = f"{rate}%"

    # 提取风险等级
    risk_match = re.search(r'(R[1-5]|稳健型|平衡型|进取型)', text)
    if risk_match:
        info["风险等级"] = risk_match.group(1)

    return info

def main():
    """主函数"""
    print("=" * 60)
    print("招商银行理财产品信息查询 (API方式)")
    print("=" * 60)
    print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("-" * 60)

    results = []
    failed_codes = []

    for i, code in enumerate(PRODUCT_CODES, 1):
        print(f"\n[{i}/{len(PRODUCT_CODES)}] 查询产品: {code}")

        # 方法1: 尝试各种API端点
        print(f"  尝试API端点...")
        for endpoint in API_ENDPOINTS:
            result = try_api_endpoint(endpoint, code)
            if result:
                print(f"    [OK] 找到API: {endpoint}")
                print(f"    数据: {json.dumps(result['data'], ensure_ascii=False)[:200]}")
                # 解析数据
                data = result['data']
                product_info = {
                    "产品代码": code,
                    "产品名称": data.get('productName', data.get('PrdName', data.get('name', ''))),
                    "收益率": str(data.get('yieldRate', data.get('ExpRate', data.get('rate', '')))),
                    "期限": str(data.get('term', data.get('Term', data.get('period', '')))),
                    "起购金额": str(data.get('minAmount', data.get('MinAmount', data.get('startAmount', '')))),
                    "风险等级": data.get('riskLevel', data.get('RiskLevel', data.get('risk', ''))),
                    "产品状态": data.get('status', data.get('Status', '')),
                    "获取时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                }
                if product_info["产品名称"]:
                    results.append(product_info)
                    break

        if not results or results[-1]["产品代码"] != code:
            # 方法2: 尝试直接访问页面
            print(f"  尝试直接访问页面...")
            html_content = try_direct_page_access(code)
            if html_content:
                product_info = parse_product_from_html(html_content, code)
                if product_info["产品名称"]:
                    print(f"    [OK] 从页面获取: {product_info['产品名称']}")
                    product_info["获取时间"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    results.append(product_info)
                else:
                    print(f"    [PARTIAL] 页面有内容但未提取到产品名")
                    failed_codes.append(code)
            else:
                print(f"    [FAIL] 无法访问")
                failed_codes.append(code)

        time.sleep(1)

    # 保存结果
    output_file = "cmb_products_info.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 60)
    print("查询完成!")
    print("=" * 60)
    print(f"成功: {len(results)} | 失败: {len(failed_codes)}")

    if results:
        print("\n产品信息:")
        for r in results:
            print(f"  {r['产品代码']}: {r['产品名称']}")

if __name__ == "__main__":
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    main()
