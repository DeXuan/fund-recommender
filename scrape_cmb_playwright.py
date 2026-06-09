#!/usr/bin/env python3
"""
使用Playwright爬取招商银行理财产品信息
"""

import json
import time
import re
from datetime import datetime
from playwright.sync_api import sync_playwright

# 产品代码列表
PRODUCT_CODES = [
    "PY040217", "133038A", "YC040310", "JY040231", "JY040230",
    "NY040209", "120057A", "YC040309", "120056A", "GD040315", "GD040325"
]

def fetch_product_info(page, product_code):
    """使用Playwright获取产品信息"""
    url = f"https://www.cmbchina.com/cfweb/personal/productdetail.aspx?code={product_code}"

    try:
        # 访问页面
        page.goto(url, timeout=30000)

        # 等待页面加载
        page.wait_for_timeout(5000)

        # 等待可能的动态内容
        try:
            page.wait_for_selector('.product-name, .product-title, h1, .detail-title', timeout=10000)
        except:
            pass

        # 获取页面文本内容
        content = page.content()

        # 提取产品信息
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

        # 尝试从页面元素提取信息
        try:
            # 尝试多种选择器
            selectors = [
                '.product-name',
                '.product-title',
                'h1',
                '.detail-title',
                '[class*="name"]',
                '[class*="title"]',
            ]

            for selector in selectors:
                elements = page.query_selector_all(selector)
                for elem in elements:
                    text = elem.inner_text().strip()
                    if len(text) > 5 and len(text) < 100:
                        info["产品名称"] = text
                        break
                if info["产品名称"]:
                    break
        except:
            pass

        # 如果没找到产品名称，尝试从页面文本提取
        if not info["产品名称"]:
            text_content = page.inner_text('body')

            # 搜索产品名称模式
            name_patterns = [
                r'招银理财[^\n\r]{5,60}',
                r'招商银行[^\n\r]{5,40}理财',
                r'(金葵花|朝招金|日日金|鼎鼎成金|季季享|年年享|天添利|天添金|睿逸|招睿)[^\n\r]{3,40}',
            ]

            for pattern in name_patterns:
                match = re.search(pattern, text_content)
                if match:
                    name = match.group(0).strip()
                    if len(name) > 8:
                        info["产品名称"] = name[:80]
                        break

        # 提取收益率
        try:
            text_content = page.inner_text('body')
            rate_patterns = [
                r'业绩比较基准[：:\s]*(\d+\.?\d*)\s*[%％]',
                r'预期收益率[：:\s]*(\d+\.?\d*)\s*[%％]',
                r'年化收益率[：:\s]*(\d+\.?\d*)\s*[%％]',
                r'成立以来年化[：:\s]*(\d+\.?\d*)\s*[%％]',
            ]

            for pattern in rate_patterns:
                match = re.search(pattern, text_content, re.IGNORECASE)
                if match:
                    rate = float(match.group(1))
                    if 0.5 < rate < 15:
                        info["收益率"] = f"{rate}%"
                        break
        except:
            pass

        # 提取风险等级
        try:
            risk_patterns = [
                r'(R[1-5])级?',
                r'(稳健型|平衡型|进取型|保守型|激进型)',
            ]

            for pattern in risk_patterns:
                match = re.search(pattern, text_content, re.IGNORECASE)
                if match:
                    info["风险等级"] = match.group(1).strip()
                    break
        except:
            pass

        # 提取期限
        try:
            term_patterns = [
                r'产品期限[：:\s]*(\d+)\s*天',
                r'(\d+)\s*天\s*定期',
                r'T\+(\d+)',
                r'每日开放',
                r'活期',
            ]

            for pattern in term_patterns:
                match = re.search(pattern, text_content, re.IGNORECASE)
                if match:
                    info["期限"] = match.group(0).strip()[:20]
                    break
        except:
            pass

        return info

    except Exception as e:
        print(f"    错误: {e}")
        return None

def main():
    """主函数"""
    print("=" * 60)
    print("招商银行理财产品信息查询 (Playwright)")
    print("=" * 60)
    print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("-" * 60)

    results = []
    failed_codes = []

    with sync_playwright() as p:
        # 启动浏览器
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        page = context.new_page()

        for i, code in enumerate(PRODUCT_CODES, 1):
            print(f"\n[{i}/{len(PRODUCT_CODES)}] 查询产品: {code}")

            result = fetch_product_info(page, code)

            if result and result["产品名称"]:
                print(f"  [OK] {result['产品名称']}")
                if result["收益率"]:
                    print(f"       收益率: {result['收益率']}")
                if result["风险等级"]:
                    print(f"       风险: {result['风险等级']}")
                results.append(result)
            else:
                print(f"  [FAIL] 未获取到产品信息")
                failed_codes.append(code)
                if result:
                    results.append(result)

            # 延迟
            time.sleep(2)

        # 关闭浏览器
        browser.close()

    # 保存结果
    output_file = "cmb_products_info.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 60)
    print("查询完成!")
    print("=" * 60)
    print(f"成功: {len(results) - len(failed_codes)} | 失败: {len(failed_codes)}")

    if results:
        print("\n产品信息汇总:")
        print("-" * 60)
        for r in results:
            status = "[OK]" if r["产品名称"] and "[搜索结果]" not in r["产品名称"] else "[FAIL]"
            print(f"{status} {r['产品代码']}: {r['产品名称'] or '未找到'}")

if __name__ == "__main__":
    main()
