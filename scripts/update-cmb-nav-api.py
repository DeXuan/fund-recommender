#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
招行理财净值更新（API 直连版）

替代原 Playwright 翻页抓取：直接调用招行官方 JSON 接口
  POST https://cfweb.paas.cmbchina.com/api/ProductValue/getSAValueByPageOrDate
返回结构化的 totalRecord / totalPage / data[]，无需渲染页面，速度快数十倍，
且不会像浏览器翻页那样在缺失"下一页"元素时静默卡死。

用法：
  python3 scripts/update-cmb-nav-api.py              # 更新 target_products.json 内全部产品
  python3 scripts/update-cmb-nav-api.py --full       # 同时抓取完整历史（默认只补最近 60 天）
  python3 scripts/update-cmb-nav-api.py --dry-run    # 只打印不写库
  python3 scripts/update-cmb-nav-api.py --code 11342P [--code ...]
"""

import argparse
import io
import json
import os
import sys
import time
from datetime import date, datetime, timedelta

import requests

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

API_URL = 'https://cfweb.paas.cmbchina.com/api/ProductValue/getSAValueByPageOrDate'
DETAIL_URL = 'https://cfweb.paas.cmbchina.com/api/ProductInfo/getSAProductDetailInfo'
HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
        '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ),
    'Referer': 'https://cfweb.paas.cmbchina.com/personal/prodvalue',
    'Accept': 'application/json, text/plain, */*',
    'Content-Type': 'application/json',
}
PAGE_SIZE = 50
DEFAULT_DAYS = 60


def load_env():
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
    if not os.path.exists(env_path):
        return
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, _, value = line.partition('=')
            key, value = key.strip(), value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


def get_db_connection():
    import psycopg2

    return psycopg2.connect(
        host=os.environ.get('PG_HOST', 'localhost'),
        port=int(os.environ.get('PG_PORT', '5432')),
        database=os.environ.get('PG_DATABASE', 'fund_recommender'),
        user=os.environ.get('PG_USER', 'postgres'),
        password=os.environ.get('PG_PASSWORD', ''),
    )


def load_codes(explicit_codes):
    if explicit_codes:
        return explicit_codes
    json_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'target_products.json')
    with open(json_path, encoding='utf-8') as f:
        return json.load(f)['products']


def to_decimal(value):
    """招行返回字符串净值；空值/异常值一律返回 None，避免把 '' 写成 0。"""
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        result = float(text)
    except ValueError:
        return None
    if result <= 0:
        return None
    return round(result, 6)


def parse_nav_date(text):
    """接口返回 yyyymmdd 形式的日期字符串。"""
    text = (text or '').strip()
    if len(text) != 8 or not text.isdigit():
        return None
    try:
        return datetime.strptime(text, '%Y%m%d').date()
    except ValueError:
        return None


def fetch_page(code, page_index, page_size, start_date='', end_date=''):
    payload = {
        'saaCod': 'D07',
        'funCod': code,
        'pageIndex': page_index,
        'pageSize': page_size,
        'startDate': start_date,
        'endDate': end_date,
    }
    resp = requests.post(API_URL, headers=HEADERS, json=payload, timeout=20)
    resp.raise_for_status()
    data = resp.json()
    if data.get('returnCode') != 'SUC0000':
        raise RuntimeError(data.get('errorMsg') or '接口返回异常')
    return data.get('body') or {}


def fetch_product(code, since=None):
    """抓取单个产品的净值；since 为 None 时抓全量历史。返回 (产品名, 记录列表)。"""
    records = []
    product_name = ''
    page_index = 1
    total_page = 1
    start_date = since.strftime('%Y%m%d') if since else ''
    end_date = date.today().strftime('%Y%m%d')

    while page_index <= total_page:
        body = fetch_page(code, page_index, PAGE_SIZE, start_date, end_date)
        total_page = int(body.get('totalPage') or 0)
        rows = body.get('data') or []
        for row in rows:
            nav_date = parse_nav_date(row.get('znavDat'))
            unit_nav = to_decimal(row.get('znavVal'))
            cum_nav = to_decimal(row.get('znavCtl'))
            if not nav_date or unit_nav is None:
                continue
            product_name = product_name or (row.get('zripSnm') or '').strip()
            records.append(
                {
                    'product_code': code,
                    'product_name': product_name or code,
                    'unit_nav': unit_nav,
                    'cumulative_nav': cum_nav if cum_nav is not None else unit_nav,
                    'nav_date': nav_date,
                }
            )
        if total_page <= 1 or not rows:
            break
        page_index += 1
        time.sleep(0.25)

    return product_name, records


def fetch_detail(code):
    """补充产品档案：正式名称、风险等级、状态。"""
    payload = {'saaCod': 'D07', 'funCod': code}
    try:
        resp = requests.post(DETAIL_URL, headers=HEADERS, json=payload, timeout=20)
        body = resp.json().get('body') or {}
        return {
            'name': (body.get('prdName') or '').strip(),
            'risk': (body.get('risk') or '').strip(),
            'status': (body.get('status') or '').strip(),
        }
    except Exception:
        return {}


def save_records(conn, records):
    if not records:
        return 0
    sql = """
        INSERT INTO cmb_zhaoyin_nav (product_code, product_name, unit_nav, cumulative_nav, nav_date)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (product_code, nav_date) DO UPDATE SET
            product_name = EXCLUDED.product_name,
            unit_nav = EXCLUDED.unit_nav,
            cumulative_nav = EXCLUDED.cumulative_nav
    """
    rows = [(r['product_code'], r['product_name'], r['unit_nav'], r['cumulative_nav'], r['nav_date']) for r in records]
    with conn.cursor() as cur:
        cur.executemany(sql, rows)
    conn.commit()
    return len(rows)


def save_to_cmb_products(conn, code, name, latest, detail):
    """同步 cmb_products 的最新净值，供「招行理财」列表页直接读取。"""
    sql = """
        INSERT INTO cmb_products (product_code, product_name, risk_level, product_status, nav, nav_date, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, NOW())
        ON CONFLICT (product_code) DO UPDATE SET
            product_name = COALESCE(NULLIF(EXCLUDED.product_name, ''), cmb_products.product_name),
            risk_level = COALESCE(NULLIF(EXCLUDED.risk_level, ''), cmb_products.risk_level),
            product_status = COALESCE(NULLIF(EXCLUDED.product_status, ''), cmb_products.product_status),
            nav = EXCLUDED.nav,
            nav_date = EXCLUDED.nav_date,
            updated_at = NOW()
    """
    with conn.cursor() as cur:
        cur.execute(
            sql,
            (
                code,
                name,
                detail.get('risk') or None,
                detail.get('status') or None,
                latest['unit_nav'],
                latest['nav_date'],
            ),
        )
    conn.commit()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--full', action='store_true', help='抓取完整历史（默认只补最近 N 天）')
    parser.add_argument('--days', type=int, default=DEFAULT_DAYS, help=f'默认回溯天数（默认 {DEFAULT_DAYS}）')
    parser.add_argument('--dry-run', action='store_true', help='只打印，不写库')
    parser.add_argument('--code', action='append', default=[], help='指定产品代码，可重复')
    args = parser.parse_args()

    load_env()
    codes = load_codes(args.code)
    since = None if args.full else date.today() - timedelta(days=args.days)

    print('=' * 64)
    print('招行理财净值更新（API 直连）')
    print(f"产品数: {len(codes)}   区间: {'全量' if args.full else f'最近 {args.days} 天'}")
    print(f"时间: {datetime.now():%Y-%m-%d %H:%M:%S}")
    print('=' * 64)

    conn = None if args.dry_run else get_db_connection()
    ok = fail = total_rows = 0
    failed_codes = []

    for idx, code in enumerate(codes, 1):
        try:
            name, records = fetch_product(code, since)
            if not records:
                print(f'[{idx}/{len(codes)}] {code} 无有效净值记录，跳过')
                fail += 1
                failed_codes.append(code)
                continue

            records.sort(key=lambda r: r['nav_date'])
            latest = records[-1]
            detail = fetch_detail(code)
            display_name = records[0]['product_name'] or detail.get('name') or code

            if not args.dry_run:
                total_rows += save_records(conn, records)
                save_to_cmb_products(conn, code, detail.get('name') or display_name, latest, detail)

            ok += 1
            print(
                f"[{idx}/{len(codes)}] {code} {display_name[:22]:<22} "
                f"最新 {latest['nav_date']} = {latest['unit_nav']:.4f}  (+{len(records)} 条)"
            )
        except Exception as exc:
            fail += 1
            failed_codes.append(code)
            print(f'[{idx}/{len(codes)}] {code} 失败: {exc}')
        time.sleep(0.3)

    if conn:
        conn.close()

    print('-' * 64)
    print(f'成功 {ok} / 失败 {fail}   写入净值 {total_rows} 条')
    if failed_codes:
        print('失败产品: ' + ', '.join(failed_codes))
    return 0 if fail == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
