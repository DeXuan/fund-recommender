#!/usr/bin/env python3
"""
将招商银行企业产品数据导入PostgreSQL
"""

import json
import os
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime
from dotenv import load_dotenv

# 加载.env文件
load_dotenv()

# 数据库连接配置
DB_CONFIG = {
    'host': os.getenv('PG_HOST'),
    'port': int(os.getenv('PG_PORT', 5432)),
    'database': os.getenv('PG_DATABASE'),
    'user': os.getenv('PG_USER'),
    'password': os.getenv('PG_PASSWORD')
}

def create_table(conn):
    """创建企业产品表"""
    sql = """
    CREATE TABLE IF NOT EXISTS cmb_corporate_products (
        id SERIAL PRIMARY KEY,
        product_code VARCHAR(20) NOT NULL,
        product_name VARCHAR(500),
        benchmark_rate VARCHAR(100),
        maturity_rate VARCHAR(100),
        value_date VARCHAR(50),
        expire_date VARCHAR(50),
        history_link VARCHAR(500),
        manager_name VARCHAR(100),
        manager_code VARCHAR(20),
        product_type VARCHAR(100),
        type_code VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(product_code, manager_code, type_code)
    );

    -- 创建索引
    CREATE INDEX IF NOT EXISTS idx_cmb_corporate_product_code ON cmb_corporate_products(product_code);
    CREATE INDEX IF NOT EXISTS idx_cmb_corporate_manager ON cmb_corporate_products(manager_code);
    CREATE INDEX IF NOT EXISTS idx_cmb_corporate_type ON cmb_corporate_products(type_code);

    -- 添加注释
    COMMENT ON TABLE cmb_corporate_products IS '招商银行企业财富管理产品净值数据';
    COMMENT ON COLUMN cmb_corporate_products.product_code IS '产品代码';
    COMMENT ON COLUMN cmb_corporate_products.product_name IS '产品名称';
    COMMENT ON COLUMN cmb_corporate_products.benchmark_rate IS '业绩比较基准(年率%)';
    COMMENT ON COLUMN cmb_corporate_products.maturity_rate IS '到期收益率(年率%)';
    COMMENT ON COLUMN cmb_corporate_products.value_date IS '产品起息日';
    COMMENT ON COLUMN cmb_corporate_products.expire_date IS '产品到期日';
    COMMENT ON COLUMN cmb_corporate_products.manager_name IS '产品管理人名称';
    COMMENT ON COLUMN cmb_corporate_products.manager_code IS '产品管理人代码';
    COMMENT ON COLUMN cmb_corporate_products.product_type IS '产品类别名称';
    COMMENT ON COLUMN cmb_corporate_products.type_code IS '产品类别代码';
    """
    with conn.cursor() as cur:
        cur.execute(sql)
    conn.commit()
    print("表创建成功")

def load_data():
    """从JSON文件加载数据"""
    with open("corporate_products_all.json", "r", encoding="utf-8") as f:
        products = json.load(f)
    print(f"加载了 {len(products)} 条数据")
    return products

def normalize_product(product):
    """规范化产品数据"""
    # 映射不同格式的字段名
    field_mapping = {
        '产品代码': 'product_code',
        '产品名称': 'product_name',
        '业绩比较基准(年率%)': 'benchmark_rate',
        '到期收益率(年率%)': 'maturity_rate',
        '产品起息日': 'value_date',
        '产品到期日': 'expire_date',
        '历史数据': 'history_link',
        '_管理人': 'manager_name',
        '_管理人代码': 'manager_code',
        '_产品类别': 'product_type',
        '_类别代码': 'type_code',
    }

    normalized = {}
    for cn_key, en_key in field_mapping.items():
        value = product.get(cn_key, '')
        if value is None:
            value = ''
        normalized[en_key] = str(value).strip()

    # 确保product_code不为空
    if not normalized['product_code']:
        return None

    return normalized

def import_data(conn, products):
    """导入数据到PostgreSQL"""
    sql = """
    INSERT INTO cmb_corporate_products (
        product_code, product_name, benchmark_rate, maturity_rate,
        value_date, expire_date, history_link,
        manager_name, manager_code, product_type, type_code
    ) VALUES %s
    ON CONFLICT (product_code, manager_code, type_code)
    DO UPDATE SET
        product_name = EXCLUDED.product_name,
        benchmark_rate = EXCLUDED.benchmark_rate,
        maturity_rate = EXCLUDED.maturity_rate,
        value_date = EXCLUDED.value_date,
        expire_date = EXCLUDED.expire_date,
        history_link = EXCLUDED.history_link,
        manager_name = EXCLUDED.manager_name,
        product_type = EXCLUDED.product_type,
        updated_at = NOW()
    """

    # 规范化数据
    normalized_products = []
    for p in products:
        n = normalize_product(p)
        if n:
            normalized_products.append(n)

    print(f"规范化后: {len(normalized_products)} 条数据")

    # 准备数据
    values = []
    for p in normalized_products:
        values.append((
            p['product_code'],
            p['product_name'],
            p['benchmark_rate'],
            p['maturity_rate'],
            p['value_date'],
            p['expire_date'],
            p['history_link'],
            p['manager_name'],
            p['manager_code'],
            p['product_type'],
            p['type_code'],
        ))

    # 批量插入
    with conn.cursor() as cur:
        execute_values(cur, sql, values, page_size=100)

    conn.commit()
    print(f"成功导入 {len(values)} 条数据")

def verify_import(conn):
    """验证导入结果"""
    with conn.cursor() as cur:
        # 总数
        cur.execute("SELECT COUNT(*) FROM cmb_corporate_products")
        total = cur.fetchone()[0]
        print(f"\n数据库中总记录数: {total}")

        # 按管理人统计
        cur.execute("""
            SELECT manager_name, COUNT(*) as cnt
            FROM cmb_corporate_products
            GROUP BY manager_name
            ORDER BY cnt DESC
        """)
        print("\n按管理人统计:")
        for row in cur.fetchall():
            print(f"  {row[0]}: {row[1]} 个产品")

        # 样本数据
        cur.execute("""
            SELECT product_code, product_name, benchmark_rate, maturity_rate, manager_name
            FROM cmb_corporate_products
            LIMIT 5
        """)
        print("\n前5条数据:")
        for row in cur.fetchall():
            print(f"  {row[0]} | {row[1]} | 基准:{row[2]} | 收益:{row[3]} | {row[4]}")

def main():
    """主函数"""
    print("=" * 60)
    print("招商银行企业产品数据导入PostgreSQL")
    print("=" * 60)
    print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # 加载数据
    products = load_data()
    if not products:
        print("没有数据可导入")
        return

    # 连接数据库
    try:
        print(f"\n连接数据库: {DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}")
        conn = psycopg2.connect(**DB_CONFIG)
        print("数据库连接成功")

        # 创建表
        create_table(conn)

        # 导入数据
        import_data(conn, products)

        # 验证
        verify_import(conn)

        conn.close()
        print(f"\n完成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    except Exception as e:
        print(f"错误: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
