#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""行业基金综合推荐报告生成器 - 2026年6月"""

import os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from datetime import datetime

# ============================================================
# 数据定义 - 各行业基金分析数据（2026年6月）
# ============================================================

fund_data = [
    {
        "行业": "人工智能/AI",
        "基金名称": "华夏人工智能ETF联接A",
        "代码": "013349",
        "A/C": "A",
        "跟踪指数": "中证人工智能(931071)",
        "管理费率": "0.50%",
        "托管费率": "0.10%",
        "申购费率": "0.12%(1折)",
        "近1年收益": "+38.5%",
        "近3月收益": "+15.2%",
        "近1月收益": "+6.8%",
        "走势判断": "强势上涨",
        "推荐评级": "★★★★★",
        "估值判断": "合理偏高",
        "政策面": "十五五核心主线，AI应用落地加速",
        "买入建议": "优先配置",
        "仓位建议": "25%",
        "核心逻辑": "Q2电子涨幅29%居首，AI算力+应用双轮驱动，年度核心主线"
    },
    {
        "行业": "半导体/芯片",
        "基金名称": "华夏国证半导体芯片ETF联接A",
        "代码": "008887",
        "A/C": "A",
        "跟踪指数": "国证半导体芯片(980017)",
        "管理费率": "0.50%",
        "托管费率": "0.10%",
        "申购费率": "0.12%(1折)",
        "近1年收益": "+32.1%",
        "近3月收益": "+12.5%",
        "近1月收益": "+5.3%",
        "走势判断": "震荡上行",
        "推荐评级": "★★★★★",
        "估值判断": "合理",
        "政策面": "国产替代加速，十五五重点扶持",
        "买入建议": "优先配置",
        "仓位建议": "20%",
        "核心逻辑": "半导体国产替代+AI芯片需求爆发，景气度持续上行"
    },
    {
        "行业": "光伏",
        "基金名称": "天弘中证光伏产业ETF联接A",
        "代码": "011102",
        "A/C": "A",
        "跟踪指数": "光伏产业(931151)",
        "管理费率": "0.50%",
        "托管费率": "0.10%",
        "申购费率": "0.10%(1折)",
        "近1年收益": "-8.2%",
        "近3月收益": "+5.6%",
        "近1月收益": "+3.1%",
        "走势判断": "底部反弹",
        "推荐评级": "★★★★",
        "估值判断": "低估",
        "政策面": "十五五综合整治内卷，行业出清加速",
        "买入建议": "逢低布局",
        "仓位建议": "15%",
        "核心逻辑": "业绩触底反弹，估值修复中，政策推动行业出清，左侧布局机会"
    },
    {
        "行业": "新能源",
        "基金名称": "天弘中证新能源ETF联接A",
        "代码": "012348",
        "A/C": "A",
        "跟踪指数": "中证新能源(399808)",
        "管理费率": "0.50%",
        "托管费率": "0.10%",
        "申购费率": "0.10%(1折)",
        "近1年收益": "-5.3%",
        "近3月收益": "+4.2%",
        "近1月收益": "+2.5%",
        "走势判断": "震荡筑底",
        "推荐评级": "★★★★",
        "估值判断": "低估",
        "政策面": "风电订单+48.7%，新能源整体政策利好",
        "买入建议": "逢低布局",
        "仓位建议": "10%",
        "核心逻辑": "风电+光伏双轮驱动，新能源整体估值处于低位，政策面持续利好"
    },
    {
        "行业": "银行",
        "基金名称": "天弘中证银行ETF联接A",
        "代码": "001594",
        "A/C": "A",
        "跟踪指数": "中证银行(399986)",
        "管理费率": "0.50%",
        "托管费率": "0.10%",
        "申购费率": "0.10%(1折)",
        "近1年收益": "+18.2%",
        "近3月收益": "+5.8%",
        "近1月收益": "+2.1%",
        "走势判断": "稳步上涨",
        "推荐评级": "★★★★",
        "估值判断": "合理偏低",
        "政策面": "高股息策略受追捧，银行息差企稳",
        "买入建议": "可配置",
        "仓位建议": "10%",
        "核心逻辑": "高股息+低估值，防守属性强，震荡市中表现稳健"
    },
    {
        "行业": "科技",
        "基金名称": "华夏科技ETF联接A",
        "代码": "007873",
        "A/C": "A",
        "跟踪指数": "中证科技龙头(931087)",
        "管理费率": "0.50%",
        "托管费率": "0.10%",
        "申购费率": "0.12%(1折)",
        "近1年收益": "+25.3%",
        "近3月收益": "+8.5%",
        "近1月收益": "+3.5%",
        "走势判断": "震荡上行",
        "推荐评级": "★★★★",
        "估值判断": "合理",
        "政策面": "科技自主可控，十五五重点方向",
        "买入建议": "可配置",
        "仓位建议": "5%",
        "核心逻辑": "科技龙头综合配置，覆盖面广，适合分散布局"
    },
    {
        "行业": "军工",
        "基金名称": "富国中证军工ETF联接A",
        "代码": "013139",
        "A/C": "A",
        "跟踪指数": "中证军工(399967)",
        "管理费率": "0.50%",
        "托管费率": "0.10%",
        "申购费率": "0.12%(1折)",
        "近1年收益": "+8.5%",
        "近3月收益": "+3.2%",
        "近1月收益": "+1.5%",
        "走势判断": "温和上涨",
        "推荐评级": "★★★",
        "估值判断": "合理",
        "政策面": "国防预算稳增，十五五装备更新",
        "买入建议": "可配置",
        "仓位建议": "5%",
        "核心逻辑": "业绩确定性较高，但弹性不足，适合稳健配置"
    },
    {
        "行业": "金融",
        "基金名称": "国泰上证180金融ETF联接A",
        "代码": "020021",
        "A/C": "A",
        "跟踪指数": "中证金融(399955)",
        "管理费率": "0.50%",
        "托管费率": "0.10%",
        "申购费率": "0.12%(1折)",
        "近1年收益": "+15.8%",
        "近3月收益": "+4.5%",
        "近1月收益": "+1.8%",
        "走势判断": "温和上涨",
        "推荐评级": "★★★",
        "估值判断": "合理偏低",
        "政策面": "金融改革持续推进",
        "买入建议": "可配置",
        "仓位建议": "5%",
        "核心逻辑": "银行+保险+券商综合体，估值合理，高股息属性"
    },
    {
        "行业": "医药",
        "基金名称": "易方达沪深300医药ETF联接A",
        "代码": "001344",
        "A/C": "A",
        "跟踪指数": "中证医药卫生(000933)",
        "管理费率": "0.50%",
        "托管费率": "0.10%",
        "申购费率": "0.12%(1折)",
        "近1年收益": "-3.8%",
        "近3月收益": "+1.5%",
        "近1月收益": "+0.8%",
        "走势判断": "弱势震荡",
        "推荐评级": "★★★",
        "估值判断": "低估",
        "政策面": "医疗器械政策密集，但集采压力仍在",
        "买入建议": "观望为主",
        "仓位建议": "5%",
        "核心逻辑": "估值处于历史低位，但行业反转信号不明确，可小仓位试探"
    },
    {
        "行业": "证券",
        "基金名称": "华宝券商ETF联接A",
        "代码": "006098",
        "A/C": "A",
        "跟踪指数": "中证全指证券公司(399975)",
        "管理费率": "0.50%",
        "托管费率": "0.10%",
        "申购费率": "0.12%(1折)",
        "近1年收益": "+12.3%",
        "近3月收益": "+3.5%",
        "近1月收益": "+1.2%",
        "走势判断": "震荡",
        "推荐评级": "★★★",
        "估值判断": "合理",
        "政策面": "资本市场改革持续推进",
        "买入建议": "观望为主",
        "仓位建议": "0%",
        "核心逻辑": "弹性大但波动大，适合右侧追涨而非左侧布局"
    },
    {
        "行业": "白酒",
        "基金名称": "鹏华中证酒ETF联接A",
        "代码": "012043",
        "A/C": "A",
        "跟踪指数": "中证白酒(399997)",
        "管理费率": "0.50%",
        "托管费率": "0.10%",
        "申购费率": "0.12%(1折)",
        "近1年收益": "-12.5%",
        "近3月收益": "-2.1%",
        "近1月收益": "-1.5%",
        "走势判断": "持续下跌",
        "推荐评级": "★★",
        "估值判断": "偏低",
        "政策面": "消费复苏不及预期",
        "买入建议": "等待企稳",
        "仓位建议": "0%",
        "核心逻辑": "行业景气度下行，消费复苏传导不畅，等待拐点信号"
    },
    {
        "行业": "消费",
        "基金名称": "汇添富消费ETF联接A",
        "代码": "000248",
        "A/C": "A",
        "跟踪指数": "中证主要消费(000932)",
        "管理费率": "0.50%",
        "托管费率": "0.10%",
        "申购费率": "0.12%(1折)",
        "近1年收益": "-8.5%",
        "近3月收益": "-1.8%",
        "近1月收益": "-0.5%",
        "走势判断": "弱势",
        "推荐评级": "★★",
        "估值判断": "偏低",
        "政策面": "消费刺激政策效果待观察",
        "买入建议": "等待企稳",
        "仓位建议": "0%",
        "核心逻辑": "消费复苏路径尚需验证，传导到基本面需要时间"
    },
    {
        "行业": "地产",
        "基金名称": "南方房地产ETF联接A",
        "代码": "004642",
        "A/C": "A",
        "跟踪指数": "中证800地产(399393)",
        "管理费率": "0.50%",
        "托管费率": "0.10%",
        "申购费率": "0.12%(1折)",
        "近1年收益": "-18.5%",
        "近3月收益": "-5.2%",
        "近1月收益": "-2.8%",
        "走势判断": "持续下行",
        "推荐评级": "★",
        "估值判断": "极低估",
        "政策面": "政策托底但效果有限",
        "买入建议": "不推荐",
        "仓位建议": "0%",
        "核心逻辑": "行业下行周期未结束，政策传导需要时间，风险较大"
    },
]

# ============================================================
# Excel 生成
# ============================================================

wb = Workbook()

# 样式定义
title_font = Font(name="微软雅黑", size=14, bold=True, color="FFFFFF")
title_fill = PatternFill(start_color="1F4E79", end_color="1F4E79", fill_type="solid")
header_font = Font(name="微软雅黑", size=10, bold=True, color="FFFFFF")
header_fill = PatternFill(start_color="2E75B6", end_color="2E75B6", fill_type="solid")
normal_font = Font(name="微软雅黑", size=10)
green_font = Font(name="微软雅黑", size=10, color="006100")
red_font = Font(name="微软雅黑", size=10, color="9C0006")
green_fill = PatternFill(start_color="C6EFCE", end_color="C6EFCE", fill_type="solid")
red_fill = PatternFill(start_color="FFC7CE", end_color="FFC7CE", fill_type="solid")
yellow_fill = PatternFill(start_color="FFEB9C", end_color="FFEB9C", fill_type="solid")
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

def style_data_cell(ws, row, col, value):
    cell = ws.cell(row=row, column=col, value=value)
    cell.font = normal_font
    cell.alignment = center_align
    cell.border = thin_border
    return cell

# ============================================================
# Sheet 1: 综合推荐总表
# ============================================================
ws1 = wb.active
ws1.title = "综合推荐总表"

ws1.merge_cells("A1:N1")
title_cell = ws1["A1"]
title_cell.value = "各行业基金综合推荐 - 2026年6月（支付宝购买指南）"
title_cell.font = title_font
title_cell.fill = title_fill
title_cell.alignment = center_align
ws1.row_dimensions[1].height = 35

headers1 = ["排名", "行业", "基金名称", "代码", "跟踪指数", "推荐评级",
            "近1年收益", "近3月收益", "近1月收益", "走势判断",
            "估值判断", "买入建议", "仓位建议", "核心逻辑"]
for col, h in enumerate(headers1, 1):
    ws1.cell(row=2, column=col, value=h)
style_header(ws1, 2, len(headers1))

rating_order = {"★★★★★": 0, "★★★★": 1, "★★★": 2, "★★": 3, "★": 4}
sorted_funds = sorted(fund_data, key=lambda x: rating_order.get(x["推荐评级"], 5))

for i, fund in enumerate(sorted_funds):
    row = i + 3
    style_data_cell(ws1, row, 1, i + 1)
    style_data_cell(ws1, row, 2, fund["行业"])
    style_data_cell(ws1, row, 3, fund["基金名称"])
    style_data_cell(ws1, row, 4, fund["代码"])
    style_data_cell(ws1, row, 5, fund["跟踪指数"])

    star_cell = style_data_cell(ws1, row, 6, fund["推荐评级"])
    star_cell.font = star_font

    for col_idx, key in [(7, "近1年收益"), (8, "近3月收益"), (9, "近1月收益")]:
        cell = style_data_cell(ws1, row, col_idx, fund[key])
        if fund[key].startswith("+"):
            cell.font = green_font
            cell.fill = green_fill
        elif fund[key].startswith("-"):
            cell.font = red_font
            cell.fill = red_fill

    style_data_cell(ws1, row, 10, fund["走势判断"])
    val_cell = style_data_cell(ws1, row, 11, fund["估值判断"])
    if "低估" in fund["估值判断"]:
        val_cell.fill = green_fill
    elif "高估" in fund["估值判断"]:
        val_cell.fill = red_fill

    buy_cell = style_data_cell(ws1, row, 12, fund["买入建议"])
    if "优先" in fund["买入建议"]:
        buy_cell.fill = green_fill
        buy_cell.font = Font(name="微软雅黑", size=10, bold=True, color="006100")
    elif "不推荐" in fund["买入建议"] or "等待" in fund["买入建议"]:
        buy_cell.fill = red_fill

    style_data_cell(ws1, row, 13, fund["仓位建议"])
    style_data_cell(ws1, row, 14, fund["核心逻辑"]).alignment = left_align

col_widths1 = [6, 12, 28, 10, 24, 10, 12, 12, 12, 12, 12, 12, 10, 45]
for i, w in enumerate(col_widths1, 1):
    ws1.column_dimensions[get_column_letter(i)].width = w

# ============================================================
# Sheet 2: 费率对比表
# ============================================================
ws2 = wb.create_sheet("费率对比表")

ws2.merge_cells("A1:G1")
t2 = ws2["A1"]
t2.value = "各行业ETF联接基金费率对比"
t2.font = title_font
t2.fill = title_fill
t2.alignment = center_align
ws2.row_dimensions[1].height = 30

headers2 = ["行业", "基金名称", "代码", "管理费率", "托管费率", "申购费率(支付宝1折)", "综合费率/年"]
for col, h in enumerate(headers2, 1):
    ws2.cell(row=2, column=col, value=h)
style_header(ws2, 2, len(headers2))

for i, fund in enumerate(fund_data):
    row = i + 3
    style_data_cell(ws2, row, 1, fund["行业"])
    style_data_cell(ws2, row, 2, fund["基金名称"])
    style_data_cell(ws2, row, 3, fund["代码"])
    style_data_cell(ws2, row, 4, fund["管理费率"])
    style_data_cell(ws2, row, 5, fund["托管费率"])
    style_data_cell(ws2, row, 6, fund["申购费率"])
    cell = style_data_cell(ws2, row, 7, "0.60%/年")
    cell.fill = yellow_fill

col_widths2 = [12, 28, 10, 12, 12, 22, 14]
for i, w in enumerate(col_widths2, 1):
    ws2.column_dimensions[get_column_letter(i)].width = w

# ============================================================
# Sheet 3: 分批建仓方案
# ============================================================
ws3 = wb.create_sheet("分批建仓方案")

ws3.merge_cells("A1:F1")
t3 = ws3["A1"]
t3.value = "2026年6月分批建仓方案（总仓位100%）"
t3.font = title_font
t3.fill = title_fill
t3.alignment = center_align
ws3.row_dimensions[1].height = 30

headers3 = ["批次", "建议时间", "仓位占比", "买入标的", "操作方式", "理由"]
for col, h in enumerate(headers3, 1):
    ws3.cell(row=2, column=col, value=h)
style_header(ws3, 2, len(headers3))

batches = [
    ["第1批", "6月2日-6日（本周）", "40%",
     "人工智能ETF联接A(013349)\n半导体芯片ETF联接A(008887)",
     "支付宝一次性买入",
     "AI+半导体为年度核心主线，Q2涨幅领先，政策面持续利好，本周建仓锁定成本"],
    ["第2批", "6月9日-13日", "30%",
     "光伏ETF联接A(011102)\n新能源ETF联接A(012348)\n银行ETF联接A(001594)",
     "支付宝定投或一次性买入",
     "光伏/新能源底部反转，估值低估区间；银行高股息防守；世界杯期间可能有扰动，逢低加仓"],
    ["第3批", "6月16日-20日", "20%",
     "军工ETF联接A(013139)\n科技ETF联接A(007873)\n金融ETF联接A(020021)",
     "支付宝定投",
     "稳健配置型标的，军工+科技+金融分散风险，半年报预告前布局"],
    ["第4批", "6月23日-30日", "10%",
     "医药ETF联接A(001344)",
     "支付宝小额定投",
     "医药估值历史低位，但反转信号不明确，保留小仓位观察，等待半年报业绩指引"],
]

for i, batch in enumerate(batches):
    row = i + 3
    for col, val in enumerate(batch, 1):
        cell = style_data_cell(ws3, row, col, val)
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ws3.row_dimensions[row].height = 60

col_widths3 = [10, 22, 12, 35, 22, 50]
for i, w in enumerate(col_widths3, 1):
    ws3.column_dimensions[get_column_letter(i)].width = w

# ============================================================
# Sheet 4: 行业估值与买入时机
# ============================================================
ws4 = wb.create_sheet("行业估值与买入时机")

ws4.merge_cells("A1:F1")
t4 = ws4["A1"]
t4.value = "行业估值水平与买入时机分析"
t4.font = title_font
t4.fill = title_fill
t4.alignment = center_align
ws4.row_dimensions[1].height = 30

headers4 = ["行业", "估值判断", "政策面", "走势判断", "买入建议", "投资逻辑"]
for col, h in enumerate(headers4, 1):
    ws4.cell(row=2, column=col, value=h)
style_header(ws4, 2, len(headers4))

for i, fund in enumerate(fund_data):
    row = i + 3
    style_data_cell(ws4, row, 1, fund["行业"])
    val_cell = style_data_cell(ws4, row, 2, fund["估值判断"])
    if "低估" in fund["估值判断"]:
        val_cell.fill = green_fill
    elif "高估" in fund["估值判断"]:
        val_cell.fill = red_fill
    style_data_cell(ws4, row, 3, fund["政策面"]).alignment = left_align
    style_data_cell(ws4, row, 4, fund["走势判断"])
    buy_cell = style_data_cell(ws4, row, 5, fund["买入建议"])
    if "优先" in fund["买入建议"]:
        buy_cell.fill = green_fill
    elif "不推荐" in fund["买入建议"] or "等待" in fund["买入建议"]:
        buy_cell.fill = red_fill
    style_data_cell(ws4, row, 6, fund["核心逻辑"]).alignment = left_align

col_widths4 = [12, 12, 35, 12, 12, 50]
for i, w in enumerate(col_widths4, 1):
    ws4.column_dimensions[get_column_letter(i)].width = w

# ============================================================
# Sheet 5: 市场环境分析
# ============================================================
ws5 = wb.create_sheet("市场环境分析")

ws5.merge_cells("A1:B1")
t5 = ws5["A1"]
t5.value = "2026年6月市场环境分析"
t5.font = title_font
t5.fill = title_fill
t5.alignment = center_align
ws5.row_dimensions[1].height = 30

market_data = [
    ["一、市场整体判断", ""],
    ["沪指运行区间", "4080-4230点，箱体震荡"],
    ["市场风格", "结构性分化，非普涨行情"],
    ["资金流向", "AI算力、半导体、新能源等景气赛道"],
    ["", ""],
    ["二、政策利好行业", ""],
    ["AI算力与半导体", "年度核心主线，Q2电子涨幅29.13%居全行业首位"],
    ["风电", "政策+出海+需求三重共振，订单同比+48.7%"],
    ["光伏", "业绩触底反弹，十五五综合整治内卷，行业出清加速"],
    ["医疗器械", "监管工作会议定调主动防控转型，政策红利密集释放"],
    ["化工", "周期拐点下的供给重塑"],
    ["", ""],
    ["三、6月关键事件", ""],
    ["6月11日", "世界杯开幕，历史上对A股有一定扰动"],
    ["6月末", "半年报业绩预告开启，业绩兑现成分水岭"],
    ["十五五规划", "政策落地窗口期，关注重点方向"],
    ["", ""],
    ["四、季节性规律", ""],
    ["6月历史表现", "震荡为主，结构性机会大于系统性机会"],
    ["行情重心", "从题材炒作回归产业景气与业绩兑现"],
]

for i, (k, v) in enumerate(market_data):
    row = i + 2
    k_cell = ws5.cell(row=row, column=1, value=k)
    v_cell = ws5.cell(row=row, column=2, value=v)
    k_cell.font = Font(name="微软雅黑", size=10, bold=bool(not v and k))
    v_cell.font = normal_font
    k_cell.alignment = left_align
    v_cell.alignment = left_align
    if k.startswith(("一", "二", "三", "四")):
        k_cell.font = Font(name="微软雅黑", size=11, bold=True, color="1F4E79")
        k_cell.fill = PatternFill(start_color="D6E4F0", end_color="D6E4F0", fill_type="solid")
        v_cell.fill = PatternFill(start_color="D6E4F0", end_color="D6E4F0", fill_type="solid")

ws5.column_dimensions["A"].width = 22
ws5.column_dimensions["B"].width = 65

# ============================================================
# Sheet 6: 风险提示
# ============================================================
ws6 = wb.create_sheet("风险提示")

t6 = ws6["A1"]
t6.value = "重要风险提示"
t6.font = Font(name="微软雅黑", size=14, bold=True, color="CC0000")
t6.alignment = left_align

risks = [
    "1. 本报告基于公开市场数据分析，不构成投资建议，仅供参考。",
    "2. 基金有风险，投资需谨慎。过往业绩不代表未来表现。",
    "3. 以上推荐基于2026年5月底市场环境，市场变化可能导致分析失效。",
    "4. 行业基金波动较大，建议根据个人风险承受能力合理配置。",
    "5. 分批建仓可降低择时风险，但不保证盈利。",
    "6. 支付宝申购费率以实际页面显示为准，部分基金可能有限购。",
    "7. 建议投资前查看基金最新持仓、规模变化和基金经理变动情况。",
    "8. AI/半导体等热门板块短期涨幅较大，注意回调风险。",
    "9. 光伏/新能源虽处低估区间，但行业出清可能持续较长时间。",
    "10. 地产/白酒/消费行业下行周期未结束，谨慎参与。",
]

for i, risk in enumerate(risks):
    cell = ws6.cell(row=i + 2, column=1, value=risk)
    cell.font = Font(name="微软雅黑", size=10)
    cell.alignment = left_align

ws6.column_dimensions["A"].width = 80

# ============================================================
# 保存
# ============================================================
date_str = datetime.now().strftime("%Y%m%d")
desktop = os.path.expanduser("~/Desktop")
filename = f"各行业基金综合推荐_{date_str}.xlsx"
filepath = os.path.join(desktop, filename)

wb.save(filepath)
print(f"报告已保存: {filepath}")
