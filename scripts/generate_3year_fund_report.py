#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""三年周期股票基金分析 + 嘉环科技深度研究报告 - 2026年6月"""

import os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from datetime import datetime

wb = Workbook()

# ============================================================
# 样式定义
# ============================================================
title_font = Font(name="微软雅黑", size=14, bold=True, color="FFFFFF")
title_fill = PatternFill(start_color="1F4E79", end_color="1F4E79", fill_type="solid")
header_font = Font(name="微软雅黑", size=10, bold=True, color="FFFFFF")
header_fill = PatternFill(start_color="2E75B6", end_color="2E75B6", fill_type="solid")
section_font = Font(name="微软雅黑", size=11, bold=True, color="1F4E79")
section_fill = PatternFill(start_color="D6E4F0", end_color="D6E4F0", fill_type="solid")
normal_font = Font(name="微软雅黑", size=10)
green_font = Font(name="微软雅黑", size=10, color="006100")
red_font = Font(name="微软雅黑", size=10, color="9C0006")
green_fill = PatternFill(start_color="C6EFCE", end_color="C6EFCE", fill_type="solid")
red_fill = PatternFill(start_color="FFC7CE", end_color="FFC7CE", fill_type="solid")
yellow_fill = PatternFill(start_color="FFEB9C", end_color="FFEB9C", fill_type="solid")
orange_fill = PatternFill(start_color="FCE4D6", end_color="FCE4D6", fill_type="solid")
star_font = Font(name="微软雅黑", size=11, bold=True, color="FF8C00")
thin_border = Border(
    left=Side(style="thin"), right=Side(style="thin"),
    top=Side(style="thin"), bottom=Side(style="thin")
)
center_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
left_align = Alignment(horizontal="left", vertical="center", wrap_text=True)

def style_header(ws, row, cols):
    for col in range(1, cols + 1):
        cell = ws.cell(row=row, column=col)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = center_align
        cell.border = thin_border

def style_data(ws, row, col, value, font=None, fill=None, align=None):
    cell = ws.cell(row=row, column=col, value=value)
    cell.font = font or normal_font
    if fill:
        cell.fill = fill
    cell.alignment = align or center_align
    cell.border = thin_border
    return cell

def add_title(ws, text, merge_range, row_height=35):
    ws.merge_cells(merge_range)
    c = ws[merge_range.split(":")[0]]
    c.value = text
    c.font = title_font
    c.fill = title_fill
    c.alignment = center_align
    ws.row_dimensions[1].height = row_height

def add_section(ws, row, text, cols):
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=cols)
    c = ws.cell(row=row, column=1, value=text)
    c.font = section_font
    c.fill = section_fill
    c.alignment = left_align
    c.border = thin_border

# ============================================================
# Sheet 1: 近三年收益TOP基金
# ============================================================
ws1 = wb.active
ws1.title = "近三年收益TOP基金"
add_title(ws1, "A股股票基金近三年收益排名（东方财富API，截止2026-05-29）", "A1:G1")

# 2025年至今TOP10
add_section(ws1, 2, "一、2025年以来收益TOP10", 7)
headers = ["排名", "基金名称", "代码", "2025年收益", "近3年收益", "投资风格", "核心持仓方向"]
for col, h in enumerate(headers, 1):
    ws1.cell(row=3, column=col, value=h)
style_header(ws1, 3, 7)

top2025 = [
    [1, "财通集成电路产业股票A", "006502", "+92.43%", "+327.58%", "科技成长", "半导体/集成电路"],
    [2, "红土创新新科技股票A", "006265", "+83.33%", "—", "科技成长", "新能源/科技"],
    [3, "融通产业趋势股票", "008382", "+73.52%", "+206.68%", "产业趋势", "TMT/先进制造"],
    [4, "易方达战略新兴产业股票A", "010391", "+61.84%", "+238.92%", "战略新兴", "新能源/军工/科技"],
    [5, "景顺长城优质成长股票A", "000411", "+63.71%", "+303.18%", "均衡成长", "消费/医药/科技"],
    [6, "国联安科技动力", "001956", "+61.21%", "—", "科技动力", "电子/计算机"],
    [7, "易方达信息行业精选股票A", "010013", "+60.70%", "+218.29%", "信息产业", "TMT龙头"],
    [8, "汇丰晋信科技先锋股票", "540010", "+59.85%", "—", "科技先锋", "科技成长"],
    [9, "海富通电子传媒股票A", "006081", "+59.21%", "—", "电子传媒", "电子/传媒"],
    [10, "广发先进制造股票发起式A", "014191", "+52.56%", "+208%", "先进制造", "高端制造"],
]

for i, row_data in enumerate(top2025):
    r = i + 4
    for col, val in enumerate(row_data, 1):
        font = normal_font
        fill = None
        if col in [4, 5] and isinstance(val, str):
            if val.startswith("+"):
                font = green_font
                fill = green_fill
            elif val.startswith("-"):
                font = red_font
                fill = red_fill
        style_data(ws1, r, col, val, font=font, fill=fill)

# 2024年度TOP5
add_section(ws1, 15, "二、2024年度收益TOP5", 7)
for col, h in enumerate(headers, 1):
    ws1.cell(row=16, column=col, value=h)
style_header(ws1, 16, 7)

top2024 = [
    [1, "西部利得事件驱动股票A", "671030", "+31.49%", "—", "事件驱动", "事件驱动策略"],
    [2, "东吴新产业精选股票A", "580008", "+18.23%", "—", "新产业", "新兴产业"],
    [3, "长信量化多策略股票A", "519965", "+16.20%", "—", "量化策略", "多因子量化"],
    [4, "汇丰晋信中小盘股票", "540007", "+13.36%", "—", "中小盘", "中小盘成长"],
    [5, "汇丰晋信大盘股票A", "540006", "+11.78%", "—", "大盘价值", "大盘蓝筹"],
]

for i, row_data in enumerate(top2024):
    r = i + 17
    for col, val in enumerate(row_data, 1):
        font = normal_font
        fill = None
        if col == 4 and isinstance(val, str) and val.startswith("+"):
            font = green_font
            fill = green_fill
        style_data(ws1, r, col, val, font=font, fill=fill)

# 三年累计TOP5
add_section(ws1, 23, "三、近三年累计收益TOP5", 7)
for col, h in enumerate(headers, 1):
    ws1.cell(row=24, column=col, value=h)
style_header(ws1, 24, 7)

top3y = [
    [1, "财通集成电路产业股票A", "006502", "+92.43%", "+327.58%", "科技成长", "半导体/集成电路"],
    [2, "景顺长城优质成长股票A", "000411", "+63.71%", "+303.18%", "均衡成长", "消费/医药/科技"],
    [3, "易方达战略新兴产业股票A", "010391", "+61.84%", "+238.92%", "战略新兴", "新能源/军工/科技"],
    [4, "易方达信息行业精选股票A", "010013", "+60.70%", "+218.29%", "信息产业", "TMT龙头"],
    [5, "融通产业趋势股票", "008382", "+73.52%", "+206.68%", "产业趋势", "TMT/先进制造"],
]

for i, row_data in enumerate(top3y):
    r = i + 25
    for col, val in enumerate(row_data, 1):
        font = normal_font
        fill = None
        if col in [4, 5] and isinstance(val, str) and val.startswith("+"):
            font = green_font
            fill = green_fill
        style_data(ws1, r, col, val, font=font, fill=fill)

col_widths1 = [6, 30, 10, 14, 14, 12, 20]
for i, w in enumerate(col_widths1, 1):
    ws1.column_dimensions[get_column_letter(i)].width = w

# ============================================================
# Sheet 2: 季度行业轮动规律
# ============================================================
ws2 = wb.create_sheet("季度行业轮动规律")
add_title(ws2, "A股季度行业轮动规律与投资日历（2023-2025）", "A1:F1")

# 季度规律
add_section(ws2, 2, "一、每季度行业轮动规律", 6)
h2 = ["季度", "大概率表现好的板块", "背后逻辑", "推荐基金类型", "历史胜率", "操作策略"]
for col, h in enumerate(h2, 1):
    ws2.cell(row=3, column=col, value=h)
style_header(ws2, 3, 6)

quarter_data = [
    ["Q1（1-3月）", "科技/小盘/题材股", "春季躁动、两会政策预期、流动性宽松", "科技主题ETF、成长股基金", "~70%", "积极配置科技成长"],
    ["Q2（4-6月）", "消费/医药/防御板块", "业绩验证期、获利回吐、板块轮动", "消费/医药基金、均衡型基金", "~60%", "防守转均衡"],
    ["Q3（7-9月）", "周期/资源/军工", "中报行情、政策催化、秋季反弹", "军工/周期基金、资源主题", "~65%", "布局周期反转"],
    ["Q4（10-12月）", "金融/大盘蓝筹/价值股", "估值切换、机构调仓、跨年布局", "银行/金融ETF、价值型基金", "~70%", "低吸蓝筹跨年"],
]

for i, row_data in enumerate(quarter_data):
    r = i + 4
    for col, val in enumerate(row_data, 1):
        style_data(ws2, r, col, val, align=left_align if col > 1 else center_align)

# 月度日历
add_section(ws2, 9, "二、每月投资日历", 6)
h3 = ["月份", "历史规律", "关注重点", "推荐基金方向", "操作建议", "胜率参考"]
for col, h in enumerate(h3, 1):
    ws2.cell(row=10, column=col, value=h)
style_header(ws2, 10, 6)

month_data = [
    ["1月", "春季躁动启动，科技题材活跃", "AI/半导体/科技成长", "科技ETF联接", "积极买入科技", "上涨概率~65%"],
    ["2月", "延续春季行情，小盘股强势", "小盘成长、题材股", "量化/小盘基金", "持有为主", "上涨概率~70%"],
    ["3月", "两会政策窗口，板块分化", "政策受益主题", "政策主题基金", "获利了结部分", "震荡概率大"],
    ["4月", "一季报披露，业绩验证", "消费/医药防御", "消费/医药基金", "转向防御", "分化加剧"],
    ["5月", "'Sell in May'效应", "高股息防守", "银行/红利基金", "减仓科技转防守", "下跌概率~55%"],
    ["6月", "半年报预期，资金观望", "高股息/银行", "银行ETF联接", "观望为主", "震荡概率大"],
    ["7月", "中报行情开启，周期反弹", "军工/周期/资源", "军工/周期基金", "布局周期", "上涨概率~60%"],
    ["8月", "秋季反弹延续", "景气赛道", "科技/新能源基金", "加仓成长", "反弹概率高"],
    ["9月", "四季度预期，提前布局", "金融/蓝筹", "金融ETF联接", "开始布局跨年", "震荡筑底"],
    ["10月", "国庆后行情，估值切换", "大盘价值", "价值型基金", "低吸蓝筹", "上涨概率~65%"],
    ["11月", "机构调仓，跨年布局", "核心资产", "均衡型基金", "持有跨年", "上涨概率~60%"],
    ["12月", "年末收官，低吸机会", "来年主线", "定投布局", "定投买入", "布局来年"],
]

for i, row_data in enumerate(month_data):
    r = i + 11
    for col, val in enumerate(row_data, 1):
        fill = None
        if col == 1:
            fill = section_fill
        style_data(ws2, r, col, val, fill=fill, align=left_align if col > 1 else center_align)

col_widths2 = [10, 28, 22, 20, 18, 16]
for i, w in enumerate(col_widths2, 1):
    ws2.column_dimensions[get_column_letter(i)].width = w

# ============================================================
# Sheet 3: 定投基金推荐
# ============================================================
ws3 = wb.create_sheet("定投基金推荐")
add_title(ws3, "三年周期定投基金推荐与组合方案", "A1:F1")

add_section(ws3, 2, "一、适合每月定投的基金", 6)
h4 = ["类型", "推荐基金", "代码", "近3年收益", "定投理由", "风险等级"]
for col, h in enumerate(h4, 1):
    ws3.cell(row=3, column=col, value=h)
style_header(ws3, 3, 6)

dca_data = [
    ["科技成长", "财通集成电路产业股票A", "006502", "+327.58%", "半导体主线，3年收益最高", "高"],
    ["均衡成长", "景顺长城优质成长股票A", "000411", "+303.18%", "长期稳定，波动可控", "中高"],
    ["信息产业", "易方达信息行业精选股票A", "010013", "+218.29%", "TMT龙头，覆盖面广", "中高"],
    ["先进制造", "广发先进制造股票发起式A", "014191", "+208%", "制造业升级，政策支持", "中高"],
    ["量化策略", "长信量化多策略股票A", "519965", "—", "量化分散，波动较小", "中"],
]

for i, row_data in enumerate(dca_data):
    r = i + 4
    for col, val in enumerate(row_data, 1):
        font = normal_font
        fill = None
        if col == 4 and isinstance(val, str) and val.startswith("+"):
            font = green_font
            fill = green_fill
        if col == 6:
            if val == "高":
                fill = red_fill
            elif val == "中高":
                fill = orange_fill
            elif val == "中":
                fill = yellow_fill
        style_data(ws3, r, col, val, font=font, fill=fill, align=left_align if col in [2, 5] else center_align)

add_section(ws3, 10, "二、核心组合方案", 6)
h5 = ["组合类型", "配置方案", "预期年化", "最大回撤", "适合人群", "再平衡频率"]
for col, h in enumerate(h5, 1):
    ws3.cell(row=11, column=col, value=h)
style_header(ws3, 11, 6)

combo_data = [
    ["进取型", "40%科技(006502)+30%成长(000411)+30%信息(010013)", "25-35%", "-30%~-40%", "风险承受力强，追求高收益", "每季度"],
    ["均衡型", "30%科技(006502)+30%均衡(000411)+20%量化(519965)+20%制造(014191)", "15-25%", "-20%~-30%", "大多数人，平衡收益与风险", "每半年"],
    ["稳健型", "40%均衡(000411)+30%量化(519965)+30%金融ETF", "10-15%", "-15%~-20%", "风险偏好低，追求稳健", "每年"],
]

for i, row_data in enumerate(combo_data):
    r = i + 12
    for col, val in enumerate(row_data, 1):
        style_data(ws3, r, col, val, align=left_align if col == 2 else center_align)
    ws3.row_dimensions[r].height = 35

add_section(ws3, 16, "三、定投策略建议", 6)
strategy = [
    "1. 每月固定日期（如每月15日）自动扣款，避免择时困难",
    "2. Q1侧重科技成长、Q2侧重消费防御、Q3侧重周期军工、Q4侧重金融价值",
    "3. 年底进行组合再平衡，将偏离超过5%的资产恢复目标比例",
    "4. 市场大跌超过15%时加倍定投，大涨超过30%时减半定投",
    "5. 坚持3年以上，定投的核心是纪律和时间，不是择时",
]
for i, s in enumerate(strategy):
    r = 17 + i
    ws3.merge_cells(start_row=r, start_column=1, end_row=r, end_column=6)
    c = ws3.cell(row=r, column=1, value=s)
    c.font = normal_font
    c.alignment = left_align

col_widths3 = [10, 50, 10, 14, 30, 12]
for i, w in enumerate(col_widths3, 1):
    ws3.column_dimensions[get_column_letter(i)].width = w

# ============================================================
# Sheet 4: 嘉环科技深度分析
# ============================================================
ws4 = wb.create_sheet("嘉环科技深度分析")
add_title(ws4, "嘉环科技（603206）深度研究报告", "A1:E1")

# 公司概况
add_section(ws4, 2, "一、公司概况", 5)
overview = [
    ["公司全称", "南京嘉环科技股份有限公司"],
    ["股票代码", "603206.SH（上交所主板）"],
    ["上市时间", "2022年"],
    ["实际控制人", "宗琰"],
    ["所属行业", "信息通信技术服务（ICT）"],
    ["主营业务", "通信网络建设、运维服务、系统集成、云计算与数据中心、智慧城市"],
    ["主要客户", "中国移动、中国电信、中国联通等运营商"],
    ["概念板块", "华为概念、鸿蒙概念、数字经济、DeepSeek概念、智慧政务"],
]
for i, (k, v) in enumerate(overview):
    r = 3 + i
    style_data(ws4, r, 1, k, fill=section_fill, align=left_align)
    ws4.merge_cells(start_row=r, start_column=2, end_row=r, end_column=5)
    style_data(ws4, r, 2, v, align=left_align)

# 实时行情
add_section(ws4, 12, "二、实时行情与估值（2026-05-31）", 5)
h6 = ["指标", "数据", "行业均值", "对比判断", "说明"]
for col, h in enumerate(h6, 1):
    ws4.cell(row=13, column=col, value=h)
style_header(ws4, 13, 5)

valuation = [
    ["股价", "16.92元", "—", "—", "近期收盘价"],
    ["总市值", "51.6亿元", "—", "小盘股", "流动性一般"],
    ["PE(TTM)", "约88.9倍", "20-30倍", "严重偏高", "安全边际极低"],
    ["PB", "约2.28倍", "1.5-2.5倍", "合理偏高", "略高于行业"],
    ["换手率", "0.79%", "—", "偏低", "交投不活跃"],
]
for i, row_data in enumerate(valuation):
    r = 14 + i
    for col, val in enumerate(row_data, 1):
        fill = None
        if col == 4:
            if "偏高" in val or "严重" in val:
                fill = red_fill
            elif "偏低" in val:
                fill = yellow_fill
        style_data(ws4, r, col, val, fill=fill, align=left_align if col == 5 else center_align)

# 财务数据
add_section(ws4, 20, "三、财务数据分析", 5)
h7 = ["指标", "2024年H1（确认）", "2024年全年（估算）", "同比变化", "判断"]
for col, h in enumerate(h7, 1):
    ws4.cell(row=21, column=col, value=h)
style_header(ws4, 21, 5)

finance = [
    ["营业收入", "20.51亿元", "约40-42亿元", "+9.02%", "温和增长"],
    ["归母净利润", "0.61亿元", "约1.2-1.5亿元", "-22.84%", "增收不增利"],
    ["毛利率", "—", "约15%-20%", "—", "行业偏低"],
    ["净利率", "—", "约3%-4%", "—", "利润率很薄"],
]
for i, row_data in enumerate(finance):
    r = 22 + i
    for col, val in enumerate(row_data, 1):
        fill = None
        font = normal_font
        if col == 4 and isinstance(val, str):
            if val.startswith("-"):
                fill = red_fill
                font = red_font
            elif val.startswith("+"):
                fill = green_fill
                font = green_font
        if col == 5 and "不增利" in val:
            fill = red_fill
        style_data(ws4, r, col, val, font=font, fill=fill, align=left_align if col == 5 else center_align)

# 竞争格局
add_section(ws4, 27, "四、行业竞争格局", 5)
h8 = ["公司", "市值规模", "核心优势", "梯队", "与嘉环对比"]
for col, h in enumerate(h8, 1):
    ws4.cell(row=28, column=col, value=h)
style_header(ws4, 28, 5)

competitors = [
    ["中通服（00552.HK）", "500亿+", "中国电信体系内龙头", "第一梯队", "规模远超嘉环"],
    ["润建股份", "100亿+", "华南区域强势，多元化", "第二梯队", "市值约2倍"],
    ["嘉环科技", "51亿", "华为核心合作伙伴", "第二梯队", "—"],
    ["中贝通信", "50亿", "中部区域为主", "第二梯队", "规模相当"],
]
for i, row_data in enumerate(competitors):
    r = 29 + i
    for col, val in enumerate(row_data, 1):
        fill = None
        if row_data[0] == "嘉环科技":
            fill = yellow_fill
        style_data(ws4, r, col, val, fill=fill, align=left_align if col in [2, 3, 5] else center_align)

# 新业务布局
add_section(ws4, 34, "五、新业务布局进展", 5)
h9 = ["业务方向", "进展描述", "当前占比", "未来潜力", "关键观察点"]
for col, h in enumerate(h9, 1):
    ws4.cell(row=35, column=col, value=h)
style_header(ws4, 35, 5)

new_biz = [
    ["5G网络建设", "持续受益于基站建设，核心业务", "主力", "★★★", "运营商资本开支趋势"],
    ["算力/AI基础设施", "数据中心建设运维，参与算力基建", "占比极小", "★★★★", "订单落地和收入确认"],
    ["智慧城市", "政企数字化转型业务拓展", "培育期", "★★★", "政府IT预算情况"],
    ["鸿蒙生态", "华为鸿蒙概念关联", "概念阶段", "★★★★", "实质性合作深度"],
]
for i, row_data in enumerate(new_biz):
    r = 36 + i
    for col, val in enumerate(row_data, 1):
        fill = None
        if "极小" in val or "概念" in val:
            fill = orange_fill
        style_data(ws4, r, col, val, fill=fill, align=left_align if col == 2 else center_align)

# 风险因素
add_section(ws4, 41, "六、主要风险因素", 5)
risks = [
    ["1", "客户集中度高", "对华为依赖度高，大客户风险显著", "高", "关注客户集中度变化"],
    ["2", "增收不增利", "2024H1净利润-22.84%，竞争加剧", "高", "季度净利润趋势"],
    ["3", "估值偏高", "PE约89倍，安全边际不足", "高", "估值回归速度"],
    ["4", "运营商资本开支下行", "5G高峰过后可能缩减投资", "中", "运营商CAPEX计划"],
    ["5", "毛利率偏低", "技术服务行业天然利润率3-4%", "中", "毛利率能否提升"],
    ["6", "小盘股波动", "市值仅51亿，流动性一般", "中", "成交量变化"],
]
h10 = ["序号", "风险类型", "风险描述", "风险等级", "关注指标"]
for col, h in enumerate(h10, 1):
    ws4.cell(row=42, column=col, value=h)
style_header(ws4, 42, 5)

for i, row_data in enumerate(risks):
    r = 43 + i
    for col, val in enumerate(row_data, 1):
        fill = None
        if col == 4:
            if val == "高":
                fill = red_fill
            elif val == "中":
                fill = yellow_fill
        style_data(ws4, r, col, val, fill=fill, align=left_align if col in [3, 5] else center_align)

# 情景分析
add_section(ws4, 50, "七、未来2-3年情景推演", 5)
h11 = ["情景", "概率", "股价区间", "核心假设", "触发信号"]
for col, h in enumerate(h11, 1):
    ws4.cell(row=51, column=col, value=h)
style_header(ws4, 51, 5)

scenarios = [
    ["乐观", "20%", "25-30元", "算力/AI业务爆发，净利润翻3倍", "算力收入占比超10%，净利增速>50%"],
    ["中性", "50%", "12-18元", "业绩温和增长，估值回归行业均值", "净利增速10-20%，PE回落至30-40倍"],
    ["悲观", "30%", "8-12元", "运营商缩减开支，竞争加剧", "净利持续下滑，订单减少"],
]
for i, row_data in enumerate(scenarios):
    r = 52 + i
    for col, val in enumerate(row_data, 1):
        fill = None
        if row_data[0] == "乐观":
            fill = green_fill
        elif row_data[0] == "悲观":
            fill = red_fill
        elif row_data[0] == "中性":
            fill = yellow_fill
        style_data(ws4, r, col, val, fill=fill, align=left_align if col in [4, 5] else center_align)

col_widths4 = [16, 22, 35, 14, 30]
for i, w in enumerate(col_widths4, 1):
    ws4.column_dimensions[get_column_letter(i)].width = w

# ============================================================
# Sheet 5: 投资结论
# ============================================================
ws5 = wb.create_sheet("投资结论与建议")
add_title(ws5, "嘉环科技投资结论与操作建议", "A1:C1")

add_section(ws5, 2, "一、综合投资评级", 3)
rating_data = [
    ["投资评级", "谨慎（不建议追高）", "PE89倍过高，增收不增利"],
    ["适合人群", "不适合当前买入", "安全边际不足"],
    ["已持有者", "建议逢高减仓", "保留观察仓即可"],
    ["关注价位", "PE回落至30倍以下", "约对应股价6-8元"],
]
h12 = ["评估维度", "结论", "理由"]
for col, h in enumerate(h12, 1):
    ws5.cell(row=3, column=col, value=h)
style_header(ws5, 3, 3)

for i, row_data in enumerate(rating_data):
    r = 4 + i
    for col, val in enumerate(row_data, 1):
        fill = None
        if col == 2:
            if "谨慎" in val or "不适合" in val or "减仓" in val:
                fill = red_fill
            elif "关注" in val:
                fill = yellow_fill
        style_data(ws5, r, col, val, fill=fill, align=left_align)

add_section(ws5, 9, "二、操作建议", 3)
ops = [
    ["已持有", "在20元以上逢高减仓50%以上，保留小仓位观察", "止损线设在14元（跌破即清仓）"],
    ["未持有", "不建议当前价位买入，等待估值回归", "关注PE回落至30倍以下或新业务突破"],
    ["关注信号①", "季度净利润同比转正", "说明盈利能力改善"],
    ["关注信号②", "算力/AI业务收入占比超10%", "新业务开始贡献实质收入"],
    ["关注信号③", "PE回落至30倍以下", "估值具备安全边际"],
    ["关注信号④", "获得重大算力/AI订单", "业务转型实质性进展"],
]
h13 = ["场景", "操作建议", "补充说明"]
for col, h in enumerate(h13, 1):
    ws5.cell(row=10, column=col, value=h)
style_header(ws5, 10, 3)

for i, row_data in enumerate(ops):
    r = 11 + i
    for col, val in enumerate(row_data, 1):
        fill = None
        if "不建议" in val:
            fill = red_fill
        style_data(ws5, r, col, val, fill=fill, align=left_align)

add_section(ws5, 18, "三、三年基金定投核心建议", 3)
final = [
    ["核心策略", "定投科技成长基金，坚持3年以上", "纪律比择时重要"],
    ["首选基金", "财通集成电路(006502) + 景顺长城优质成长(000411)", "3年收益300%+，长期稳定"],
    ["组合配置", "进取型：科技40%+成长30%+信息30%", "根据风险偏好调整"],
    ["季节策略", "Q1科技、Q2消费、Q3周期、Q4金融", "跟随行业轮动节奏"],
    ["再平衡", "每季度检查，偏离>5%即调整", "保持目标比例"],
]
h14 = ["维度", "建议", "说明"]
for col, h in enumerate(h14, 1):
    ws5.cell(row=19, column=col, value=h)
style_header(ws5, 19, 3)

for i, row_data in enumerate(final):
    r = 20 + i
    for col, val in enumerate(row_data, 1):
        style_data(ws5, r, col, val, fill=green_fill if col == 1 else None, align=left_align)

# 风险提示
add_section(ws5, 26, "四、风险提示", 3)
risk_text = [
    "1. 以上分析基于公开市场数据，不构成投资建议，仅供参考。",
    "2. 嘉环科技部分财务数据为估算值，请以公司正式年报为准。",
    "3. 基金过往业绩不代表未来表现，投资有风险，入市需谨慎。",
    "4. 行业轮动规律为历史统计，不代表未来必然重复。",
    "5. 建议投资前查阅东方财富网、巨潮资讯网获取最新数据。",
]
for i, t in enumerate(risk_text):
    r = 27 + i
    ws5.merge_cells(start_row=r, start_column=1, end_row=r, end_column=3)
    c = ws5.cell(row=r, column=1, value=t)
    c.font = Font(name="微软雅黑", size=10, color="CC0000")
    c.alignment = left_align

col_widths5 = [18, 50, 40]
for i, w in enumerate(col_widths5, 1):
    ws5.column_dimensions[get_column_letter(i)].width = w

# ============================================================
# 保存
# ============================================================
date_str = datetime.now().strftime("%Y%m%d")
desktop = os.path.expanduser("~/Desktop")
filename = f"三年周期基金分析_嘉环科技深度研究_{date_str}.xlsx"
filepath = os.path.join(desktop, filename)

wb.save(filepath)
print(f"报告已保存: {filepath}")
