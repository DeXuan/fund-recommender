#!/usr/bin/env python3
"""
使用Playwright爬取招商银行理财产品信息 - 改进版
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

        # 等待页面加载完成
        page.wait_for_load_state('networkidle', timeout=20000)

        # 额外等待动态内容
        page.wait_for_timeout(3000)

        # 获取完整页面文本
        full_text = page.inner_text('body')

        # 提取产品信息
        info = {
            "产品代码": product_code,
            "产品名称": "",
            "收益率": "",
            "期限": "",
            "起购金额": "",
            "风险等级": "",
            "产品状态": "",
            "获取时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "原始文本片段": ""
        }

        # 保存部分原始文本用于调试
        info["原始文本片段"] = full_text[:500].replace('\n', ' ')

        # 提取产品名称 - 更精确的匹配
        # 查找包含"招银理财"或"招商银行"的完整产品名称
        name_patterns = [
            r'(招银理财[^\n]{10,80})',
            r'(招商银行[^\n]{10,60}理财[^\n]{0,30})',
            r'(金葵花[^\n]{10,60})',
            r'(朝招金[^\n]{10,60})',
            r'(日日金[^\n]{10,60})',
            r'(鼎鼎成金[^\n]{10,60})',
            r'(季季享[^\n]{10,60})',
            r'(年年享[^\n]{10,60})',
            r'(天添利[^\n]{10,60})',
            r'(天添金[^\n]{10,60})',
            r'(睿逸[^\n]{10,60})',
            r'(招睿[^\n]{10,60})',
            r'(招盈[^\n]{10,60})',
            r'(招恒[^\n]{10,60})',
            r'(招卓[^\n]{10,60})',
        ]

        for pattern in name_patterns:
            match = re.search(pattern, full_text)
            if match:
                name = match.group(1).strip()
                # 清理可能的干扰字符
                name = name.split('\n')[0].strip()
                if len(name) > 10:
                    info["产品名称"] = name
                    break

        # 提取收益率
        rate_patterns = [
            r'业绩比较基准[：:\s]*(\d+\.?\d*)\s*[%％]',
            r'预期收益率[：:\s]*(\d+\.?\d*)\s*[%％]',
            r'年化收益率[：:\s]*(\d+\.?\d*)\s*[%％]',
            r'成立以来年化[：:\s]*(\d+\.?\d*)\s*[%％]',
            r'近7日年化[：:\s]*(\d+\.?\d*)\s*[%％]',
            r'七日年化[：:\s]*(\d+\.?\d*)\s*[%％]',
        ]

        for pattern in rate_patterns:
            match = re.search(pattern, full_text, re.IGNORECASE)
            if match:
                try:
                    rate = float(match.group(1))
                    if 0.5 < rate < 15:
                        info["收益率"] = f"{rate}%"
                        break
                except:
                    pass

        # 提取起购金额
        amount_patterns = [
            r'起购金额[：:\s]*(\d+)\s*[元万]',
            r'认购起点[：:\s]*(\d+)\s*[元万]',
            r'起点[：:\s]*(\d+)\s*[元万]',
            r'(\d+)\s*万元起',
            r'(\d+)\s*元起购',
            r'(\d+)\s*元起',
        ]

        for pattern in amount_patterns:
            match = re.search(pattern, full_text, re.IGNORECASE)
            if match:
                info["起购金额"] = match.group(0).strip()[:20]
                break

        # 提取期限
        term_patterns = [
            r'产品期限[：:\s]*(\d+)\s*天',
            r'投资期限[：:\s]*(\d+)\s*天',
            r'期限[：:\s]*(\d+)\s*[天日]',
            r'(\d+)\s*天\s*定期',
            r'(\d+)\s*个月\s*定期',
            r'T\+(\d+)',
            r'每日开放',
            r'随时赎回',
            r'活期',
            r'(\d+)\s*天',
        ]

        for pattern in term_patterns:
            match = re.search(pattern, full_text, re.IGNORECASE)
            if match:
                info["期限"] = match.group(0).strip()[:20]
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
            match = re.search(pattern, full_text, re.IGNORECASE)
            if match:
                info["风险等级"] = match.group(1).strip()
                break

        # 提取产品状态
        status_patterns = [
            r'(在售|存续|已到期|已售罄|募集中|封闭期|开放期|正常|运作中)',
        ]

        for pattern in status_patterns:
            match = re.search(pattern, full_text, re.IGNORECASE)
            if match:
                info["产品状态"] = match.group(1).strip()
                break

        return info

    except Exception as e:
        print(f"    错误: {e}")
        return {
            "产品代码": product_code,
            "产品名称": "",
            "收益率": "",
            "期限": "",
            "起购金额": "",
            "风险等级": "",
            "产品状态": "",
            "获取时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "错误": str(e)
        }

def main():
    """主函数"""
    print("=" * 60)
    print("招商银行理财产品信息查询 (Playwright)")
    print("=" * 60)
    print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("-" * 60)

    results = []

    with sync_playwright() as p:
        # 启动浏览器
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport={'width': 1920, 'height': 1080}
        )
        page = context.new_page()

        for i, code in enumerate(PRODUCT_CODES, 1):
            print(f"\n[{i}/{len(PRODUCT_CODES)}] 查询产品: {code}")

            result = fetch_product_info(page, code)
            results.append(result)

            if result["产品名称"]:
                print(f"  [OK] {result['产品名称']}")
                if result["收益率"]:
                    print(f"       收益率: {result['收益率']}")
                if result["风险等级"]:
                    print(f"       风险: {result['风险等级']}")
                if result["起购金额"]:
                    print(f"       起购: {result['起购金额']}")
            else:
                print(f"  [FAIL] 未获取到产品名称")
                if "错误" in result:
                    print(f"         错误: {result['错误']}")

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

    # 统计
    success = sum(1 for r in results if r["产品名称"] and "错误" not in r)
    print(f"成功: {success} | 失败: {len(results) - success}")

    # 打印汇总表格
    print("\n" + "=" * 70)
    print("产品信息汇总")
    print("=" * 70)
    print(f"{'代码':<12} {'产品名称':<35} {'收益率':<8} {'风险':<8} {'起购':<10}")
    print("-" * 70)
    for r in results:
        name = r['产品名称'][:33] if r['产品名称'] else '-'
        rate = r['收益率'] or '-'
        risk = r['风险等级'] or '-'
        amount = r['起购金额'] or '-'
        print(f"{r['产品代码']:<12} {name:<35} {rate:<8} {risk:<8} {amount:<10}")

if __name__ == "__main__":
    main()
