#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
招行理财净值更新（浏览器会话 + JSON 接口版）

为什么不用纯 requests：
  招行 cfweb 接口要求 appId + timespan + signature 三个请求头，其中 signature 是
  前端 umi.js 里的自定义算法（AES-ECB 变体），无法稳定复现，且会随前端发版变化。

为什么不用原来的翻页抓取：
  fetch_cmb_personal_nav.py 依赖点击页面上的「下一页」链接并反复解析 DOM，
  一旦某个产品的分页元素缺失就会在 next_link.click() 处静默卡死（实测 133045A
  卡住 10 分钟以上无输出，进程不退出）。

本脚本的做法：
  复用 playwright 打开一次净值页，在页面上下文内用页面自带的 axios 发请求
  （自动带上 signature），只取 JSON、不解析 HTML、不点分页按钮。
  单产品请求失败只影响该产品，不会阻塞整体流程。

用法：
  python3 scripts/update-cmb-nav-session.py                # 最近 60 天
  python3 scripts/update-cmb-nav-session.py --full         # 全量历史
  python3 scripts/update-cmb-nav-session.py --dry-run
  python3 scripts/update-cmb-nav-session.py --code 11342P
"""

import argparse
import io
import json
import os
import sys
import time
from datetime import date, datetime, timedelta

from playwright.sync_api import sync_playwright

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

NAV_PAGE = 'https://cfweb.paas.cmbchina.com/personal/prodvalue'
API_PATH = '/api/ProductValue/getSAValueByPageOrDate'
DETAIL_PATH = '/api/ProductInfo/getSAProductDetailInfo'
PAGE_SIZE = 50
DEFAULT_DAYS = 60
PRODUCT_TIMEOUT_MS = 25000


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
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        result = float(text)
    except ValueError:
        return None
    return round(result, 6) if result > 0 else None


def parse_nav_date(text):
    text = (text or '').strip()
    if len(text) != 8 or not text.isdigit():
        return None
    try:
        return datetime.strptime(text, '%Y%m%d').date()
    except ValueError:
        return None


# 在页面上下文内执行的请求函数：复用从页面真实请求中捕获的鉴权头
# （appId / timespan / signature / x-b3-*）。
# 实测 signature 只校验 appId 与 timespan 的配对关系，不绑定具体产品参数，
# 因此捕获一次即可在本轮内查询全部产品。
PAGE_FETCH_JS = """
async ({ path, payload, auth, timeoutMs }) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(path, {
      method: 'POST',
      headers: Object.assign(
        {
          'Content-Type': 'application/json;charset=UTF-8',
          'Accept': 'application/json',
        },
        auth || {}
      ),
      body: JSON.stringify(payload),
      credentials: 'include',
      signal: ctrl.signal,
    });
    const text = await resp.text();
    return { status: resp.status, text };
  } catch (e) {
    return { status: -1, text: String(e) };
  } finally {
    clearTimeout(timer);
  }
}
"""


def capture_auth_headers(page):
    """触发一次真实搜索，捕获页面自己发出的鉴权头供本轮复用。"""
    captured = {}

    def on_req(req):
        if API_PATH in req.url and 'signature' in req.headers:
            captured['headers'] = dict(req.headers)

    page.on('request', on_req)
    page.goto(NAV_PAGE, timeout=60000)
    page.wait_for_timeout(2500)
    try:
        page.wait_for_selector('input[type=text]', timeout=15000).fill('11342P')
        page.wait_for_timeout(300)
        page.wait_for_selector('input[type=button]', timeout=10000).click()
        page.wait_for_timeout(4000)
    except Exception as exc:
        print(f'[WARN] 触发页面请求失败: {exc}')
    page.remove_listener('request', on_req)

    h = captured.get('headers') or {}
    if not h.get('signature'):
        raise RuntimeError('未能捕获 signature，页面结构可能已变化')

    return {
        'appId': h.get('appid', ''),
        'timespan': h.get('timespan', ''),
        'signature': h.get('signature', ''),
        'x-b3-traceid': h.get('x-b3-traceid', ''),
        'x-b3-spanid': h.get('x-b3-spanid', ''),
        'x-b3-parentspanid': h.get('x-b3-parentspanid', ''),
        'x-b3-sampled': h.get('x-b3-sampled', '1'),
        'x-b3-businessid': h.get('x-b3-businessid', ''),
    }


def page_post(page, path, payload, auth):
    """在页面上下文里发 POST，返回解析后的 JSON。"""
    result = page.evaluate(
        PAGE_FETCH_JS,
        {'path': path, 'payload': payload, 'auth': auth, 'timeoutMs': PRODUCT_TIMEOUT_MS},
    )
    if result['status'] != 200:
        raise RuntimeError(f'HTTP {result["status"]}: {result["text"][:120]}')
    data = json.loads(result['text'])
    if data.get('returnCode') != 'SUC0000':
        raise RuntimeError(data.get('errorMsg') or '接口返回异常')
    return data.get('body') or {}


def fetch_product(page, code, since, auth):
    start_date = since.strftime('%Y%m%d') if since else ''
    end_date = date.today().strftime('%Y%m%d')
    records = []
    product_name = ''
    page_index = 1

    while page_index <= 200:  # 安全上限
        body = page_post(
            page,
            API_PATH,
            {
                'saaCod': 'D07',
                'funCod': code,
                'pageIndex': page_index,
                'pageSize': PAGE_SIZE,
                'startDate': start_date,
                'endDate': end_date,
            },
            auth,
        )
        total_page = int(body.get('totalPage') or 0)
        rows = body.get('data') or []
        if not rows:
            break

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

        if page_index >= total_page:
            break
        page_index += 1

    return product_name, records


def fetch_detail(page, code, auth):
    try:
        body = page_post(page, DETAIL_PATH, {'saaCod': 'D07', 'funCod': code}, auth)
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
            (code, name, detail.get('risk') or None, detail.get('status') or None, latest['unit_nav'], latest['nav_date']),
        )
    conn.commit()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--full', action='store_true', help='抓取完整历史')
    parser.add_argument('--days', type=int, default=DEFAULT_DAYS)
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--code', action='append', default=[])
    args = parser.parse_args()

    load_env()
    codes = load_codes(args.code)
    since = None if args.full else date.today() - timedelta(days=args.days)

    print('=' * 64)
    print('招行理财净值更新（浏览器会话 + JSON 接口）')
    print(f"产品数: {len(codes)}   区间: {'全量' if args.full else f'最近 {args.days} 天'}")
    print(f"时间: {datetime.now():%Y-%m-%d %H:%M:%S}")
    print('=' * 64)

    conn = None if args.dry_run else get_db_connection()
    ok = fail = total_rows = 0
    failed = []

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page()
        try:
            auth = capture_auth_headers(page)
            print(f'[AUTH] 已捕获签名头 appId={auth["appId"]} timespan={auth["timespan"]}')
        except Exception as exc:
            print(f'[FATAL] 无法获取鉴权头: {exc}')
            browser.close()
            return 1

        for idx, code in enumerate(codes, 1):
            try:
                name, records = fetch_product(page, code, since, auth)
                if not records:
                    print(f'[{idx}/{len(codes)}] {code} 无有效记录')
                    fail += 1
                    failed.append(code)
                    continue
                records.sort(key=lambda r: r['nav_date'])
                latest = records[-1]
                detail = fetch_detail(page, code, auth)
                display = records[0]['product_name'] or detail.get('name') or code

                if not args.dry_run:
                    total_rows += save_records(conn, records)
                    save_to_cmb_products(conn, code, detail.get('name') or display, latest, detail)
                ok += 1
                print(
                    f"[{idx}/{len(codes)}] {code} {display[:20]:<20} 最新 {latest['nav_date']} "
                    f"= {latest['unit_nav']:.4f} (+{len(records)})"
                )
            except Exception as exc:
                fail += 1
                failed.append(code)
                print(f'[{idx}/{len(codes)}] {code} 失败: {str(exc)[:100]}')
            time.sleep(0.2)

        browser.close()

    if conn:
        conn.close()

    print('-' * 64)
    print(f'成功 {ok} / 失败 {fail}   写入净值 {total_rows} 条')
    if failed:
        print('失败产品: ' + ', '.join(failed))
    return 0 if fail == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
