#!/usr/bin/env python3
"""
爬取招商银行理财产品信息 - 最终版本
使用多个搜索引擎获取信息
"""

import requests
import json
import time
import re
from datetime import datetime
from urllib.parse import quote
import html

# 产品代码列表
PRODUCT_CODES = [
    "PY040217", "133038A", "YC040310", "JY040231", "JY040230",
    "NY040209", "120057A", "YC040309", "120056A", "GD040315", "GD040325"
]

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
}

def clean_html(text):
    """清理HTML标签和实体"""
    if not text:
        return ""
    # 解码HTML实体
    text = html.unescape(text)
    # 移除HTML标签
    text = re.sub(r'<[^>]+>', ' ', text)
    # 清理多余空白
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def search_360(product_code):
    """通过360搜索产品信息"""
    try:
        query = quote(f"招商银行 理财产品 {product_code} 产品详情")
        url = f"https://www.so.com/s?q={query}"

        response = requests.get(url, headers=headers, timeout=15, verify=False)
        if response.status_code == 200:
            results = []

            # 提取搜索结果
            snippets = re.findall(r'<li class="res-list">(.*?)</li>', response.text, re.DOTALL)

            for snippet in snippets[:5]:
                # 提取标题
                title_match = re.search(r'<h3[^>]*>(.*?)</h3>', snippet, re.DOTALL)
                title = clean_html(title_match.group(1)) if title_match else ""

                # 提取摘要
                desc_match = re.search(r'<p[^>]*>(.*?)</p>', snippet, re.DOTALL)
                desc = clean_html(desc_match.group(1)) if desc_match else ""

                # 提取链接
                link_match = re.search(r'href="(https?://[^"]+)"', snippet)
                link = link_match.group(1) if link_match else ""

                if title or desc:
                    results.append({
                        "title": title,
                        "description": desc,
                        "link": link
                    })

            return results
    except Exception as e:
        pass
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
                title = clean_html(title_match.group(1)) if title_match else ""

                desc_match = re.search(r'<p[^>]*>(.*?)</p>', snippet, re.DOTALL)
                desc = clean_html(desc_match.group(1)) if desc_match else ""

                if title or desc:
                    results.append({
                        "title": title,
                        "description": desc
                    })

            return results
    except Exception as e:
        pass
    return []

def search_bing_cn(product_code):
    """通过Bing中国搜索产品信息"""
    try:
        query = quote(f"招商银行 理财产品 {product_code}")
        url = f"https://cn.bing.com/search?q={query}&ensearch=0"

        response = requests.get(url, headers=headers, timeout=15, verify=False)
        if response.status_code == 200:
            results = []

            snippets = re.findall(r'<li class="b_algo">(.*?)</li>', response.text, re.DOTALL)

            for snippet in snippets[:5]:
                title_match = re.search(r'<h2><a[^>]*>(.*?)</a></h2>', snippet, re.DOTALL)
                title = clean_html(title_match.group(1)) if title_match else ""

                desc_match = re.search(r'<p[^>]*>(.*?)</p>', snippet, re.DOTALL)
                desc = clean_html(desc_match.group(1)) if desc_match else ""

                if title or desc:
                    results.append({
                        "title": title,
                        "description": desc
                    })

            return results
    except Exception as e:
        pass
    return []

def extract_product_info_from_search(search_results, product_code):
    """从搜索结果中提取产品信息"""
    info = {
        "产品代码": product_code,
        "产品名称": "",
        "收益率": "",
        "期限": "",
        "起购金额": "",
        "风险等级": "",
        "产品状态": "",
        "产品类型": "",
        "搜索结果来源": "",
        "搜索结果摘要": "",
        "获取时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

    if not search_results:
        return info

    # 合并所有搜索结果文本
    all_titles = []
    all_descriptions = []
    for result in search_results:
        if result.get("title"):
            all_titles.append(result["title"])
        if result.get("description"):
            all_descriptions.append(result["description"])

    combined_text = " ".join(all_titles + all_descriptions)

    # 提取产品名称 - 优先从标题中提取
    name_patterns = [
        # 招银理财系列产品
        r'招银理财[^\s，,。.]{5,60}',
        # 招商银行理财产品
        r'招商银行[^\s，,。.]{5,40}理财[^\s，,。.]{0,20}',
        # 具体产品系列
        r'(金葵花|朝招金|日日金|鼎鼎成金|季季享|年年享|天添利|天添金|睿逸|招睿|招盈|招恒|招卓)[^\s，,。.]{3,40}',
        # 产品代码相关
        f'{product_code}[^\s，,。.]{0,30}',
    ]

    for pattern in name_patterns:
        match = re.search(pattern, combined_text)
        if match:
            name = match.group(0).strip()
            # 清理可能的干扰字符
            name = re.sub(r'^\d{4}年\d{1,2}月\d{1,2}日\s*[-—–]\s*', '', name)
            if len(name) > 8:
                info["产品名称"] = name[:80]
                info["搜索结果来源"] = "搜索引擎"
                break

    # 提取收益率 - 只匹配合理的收益率(0-15%)
    rate_patterns = [
        r'业绩比较基准[：:\s]*(\d+\.?\d*)\s*[%％]',
        r'预期收益率[：:\s]*(\d+\.?\d*)\s*[%％]',
        r'年化收益率[：:\s]*(\d+\.?\d*)\s*[%％]',
        r'成立以来年化[：:\s]*(\d+\.?\d*)\s*[%％]',
        r'近7日年化[：:\s]*(\d+\.?\d*)\s*[%％]',
        r'收益率[：:\s]*(\d+\.?\d*)\s*[%％]',
        r'(\d+\.?\d*)\s*[%％]\s*年化',
    ]

    for pattern in rate_patterns:
        match = re.search(pattern, combined_text, re.IGNORECASE)
        if match:
            try:
                rate = float(match.group(1))
                if 0.5 < rate < 15:  # 合理的收益率范围
                    info["收益率"] = f"{rate}%"
                    break
            except:
                pass

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
    ]

    for pattern in term_patterns:
        match = re.search(pattern, combined_text, re.IGNORECASE)
        if match:
            info["期限"] = match.group(0).strip()[:20]
            break

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
        match = re.search(pattern, combined_text, re.IGNORECASE)
        if match:
            info["起购金额"] = match.group(0).strip()[:20]
            break

    # 提取风险等级
    risk_patterns = [
        r'风险等级[：:\s]*(R[1-5])',
        r'(R[1-5])级',
        r'(稳健型|平衡型|进取型|保守型|激进型)',
        r'(低风险|中低风险|中风险|中高风险|高风险)',
    ]

    for pattern in risk_patterns:
        match = re.search(pattern, combined_text, re.IGNORECASE)
        if match:
            info["风险等级"] = match.group(1).strip()
            break

    # 提取产品状态
    status_patterns = [
        r'(在售|存续|已到期|已售罄|募集中|封闭期|开放期|正常|运作中)',
    ]

    for pattern in status_patterns:
        match = re.search(pattern, combined_text, re.IGNORECASE)
        if match:
            info["产品状态"] = match.group(1).strip()
            break

    # 保存摘要
    if all_descriptions:
        info["搜索结果摘要"] = all_descriptions[0][:200]

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

        # 搜索引擎列表
        search_engines = [
            ("360搜索", search_360),
            ("搜狗搜索", search_sogou),
            ("Bing", search_bing_cn),
        ]

        all_results = []
        for engine_name, search_func in search_engines:
            print(f"  {engine_name}...", end="", flush=True)
            search_results = search_func(code)
            if search_results:
                print(f" 找到{len(search_results)}条")
                all_results.extend(search_results)
            else:
                print(f" 无结果")
            time.sleep(1)

        if all_results:
            product_info = extract_product_info_from_search(all_results, code)
            if product_info["产品名称"]:
                print(f"  [成功] 产品名称: {product_info['产品名称']}")
                if product_info["收益率"]:
                    print(f"         收益率: {product_info['收益率']}")
                if product_info["风险等级"]:
                    print(f"         风险等级: {product_info['风险等级']}")
                results.append(product_info)
            else:
                print(f"  [部分] 找到搜索结果但未能提取完整产品名称")
                # 仍然保存，标记为部分信息
                product_info["产品名称"] = f"[待确认] {code}"
                product_info["搜索结果摘要"] = all_results[0].get("description", "")[:200]
                results.append(product_info)
        else:
            print(f"  [失败] 所有搜索引擎均未找到结果")
            failed_codes.append(code)

    # 保存结果
    output_file = "cmb_products_info.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 70)
    print("查询完成!")
    print("=" * 70)
    print(f"成功查询: {len(results)} 个产品")
    print(f"查询失败: {len(failed_codes)} 个产品")

    if failed_codes:
        print(f"\n失败的产品代码:")
        for code in failed_codes:
            print(f"  - {code}")

    print(f"\n结果已保存到: {output_file}")

    # 打印汇总表格
    if results:
        print("\n" + "=" * 90)
        print("产品信息汇总")
        print("=" * 90)
        print(f"{'代码':<12} {'产品名称':<40} {'收益率':<8} {'风险等级':<8} {'状态':<6}")
        print("-" * 90)
        for r in results:
            name = r['产品名称'][:38] if r['产品名称'] else '-'
            rate = r['收益率'] or '-'
            risk = r['风险等级'] or '-'
            status = r['产品状态'] or '-'
            print(f"{r['产品代码']:<12} {name:<40} {rate:<8} {risk:<8} {status:<6}")

    return results

if __name__ == "__main__":
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    main()
