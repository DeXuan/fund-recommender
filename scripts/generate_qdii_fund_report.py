#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""纳斯达克100 & 标普500 指数基金对比报告 - 支付宝渠道"""

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import os

wb = openpyxl.Workbook()

# ========== 通用样式 ==========
title_font = Font(name='微软雅黑', size=16, bold=True, color='FFFFFF')
title_fill = PatternFill(start_color='1F4E79', end_color='1F4E79', fill_type='solid')
header_font = Font(name='微软雅黑', size=11, bold=True, color='FFFFFF')
header_fill = PatternFill(start_color='2E75B6', end_color='2E75B6', fill_type='solid')
data_font = Font(name='微软雅黑', size=10)
bold_font = Font(name='微软雅黑', size=10, bold=True)
green_font = Font(name='微软雅黑', size=10, color='006100')
red_font = Font(name='微软雅黑', size=10, color='C00000')
green_fill = PatternFill(start_color='C6EFCE', end_color='C6EFCE', fill_type='solid')
red_fill = PatternFill(start_color='FFC7CE', end_color='FFC7CE', fill_type='solid')
yellow_fill = PatternFill(start_color='FFEB9C', end_color='FFEB9C', fill_type='solid')
orange_fill = PatternFill(start_color='FCD5B4', end_color='FCD5B4', fill_type='solid')
light_blue_fill = PatternFill(start_color='D6E4F0', end_color='D6E4F0', fill_type='solid')
thin_border = Border(
    left=Side(style='thin'), right=Side(style='thin'),
    top=Side(style='thin'), bottom=Side(style='thin')
)
center_align = Alignment(horizontal='center', vertical='center', wrap_text=True)
left_align = Alignment(horizontal='left', vertical='center', wrap_text=True)

def style_title(ws, row, col_end, text):
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=col_end)
    cell = ws.cell(row=row, column=1, value=text)
    cell.font = title_font
    cell.fill = title_fill
    cell.alignment = Alignment(horizontal='center', vertical='center')

def style_header(ws, row, headers):
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=row, column=col, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = center_align
        cell.border = thin_border

def style_cell(ws, row, col, value, font=None, fill=None, align=None):
    cell = ws.cell(row=row, column=col, value=value)
    cell.font = font or data_font
    cell.alignment = align or center_align
    cell.border = thin_border
    if fill:
        cell.fill = fill
    return cell

def highlight_return(ws, row, col, value_str):
    try:
        val = float(value_str.replace('%', '').replace('+', ''))
        if val > 0:
            style_cell(ws, row, col, value_str, font=green_font, fill=green_fill)
        elif val < 0:
            style_cell(ws, row, col, value_str, font=red_font, fill=red_fill)
        else:
            style_cell(ws, row, col, value_str)
    except:
        style_cell(ws, row, col, value_str)

# ========================================================================
# Sheet 1: 纳斯达克100 基金对比
# ========================================================================
ws1 = wb.active
ws1.title = '纳斯达克100对比'

style_title(ws1, 1, 14, '支付宝 - 纳斯达克100指数基金综合对比 (数据截止: 2026-05-28)')

headers1 = ['基金公司', 'A类代码', 'C类代码', 'A类名称', '最新净值(A)',
            '管理费/年', '托管费/年', '销售服务费(C)', '申购费(支付宝1折)',
            '近1年', '近6月', '近3月', '近1月', '每日申购限额']
style_header(ws1, 3, headers1)

nasdaq_funds = [
    ('易方达', '161130', '012870', '易方达纳斯达克100ETF联接', '4.5685',
     '0.50%', '0.10%', '0.30%', '0.12%',
     '+31.49%', '+13.84%', '+18.45%', '+10.77%', '暂停申购'),
    ('广发', '270042', '006479', '广发纳斯达克100ETF联接', '8.4773',
     '0.80%', '0.20%', '0.20%', '0.13%',
     '+32.86%', '+14.29%', '+19.13%', '+11.18%', '限10元/日'),
    ('国泰', '160213', '-', '国泰纳斯达克100指数', '4.6090',
     '0.80%', '0.20%', '-', '0.15%',
     '+33.72%', '+14.54%', '+19.22%', '+11.17%', '暂停申购'),
    ('华安', '040046', '014978', '华安纳斯达克100ETF联接', '8.5102',
     '0.60%', '0.20%', '0.20%', '0.12%',
     '+33.42%', '+14.43%', '+19.28%', '+11.29%', '限10元/日'),
    ('大成', '000834', '008971', '大成纳斯达克100ETF联接', '6.5391',
     '0.80%', '0.20%', '0.30%', '0.12%',
     '+32.77%', '+13.81%', '+18.34%', '+10.58%', '限50元/日'),
    ('建信', '539001', '012752', '建信纳斯达克100指数', '3.5442',
     '0.80%', '0.20%', '0.30%', '0.12%',
     '-', '-', '-', '-', '限100元/日'),
    ('嘉实', '016532', '016533', '嘉实纳斯达克100ETF联接', '2.2284',
     '0.50%', '0.10%', '0.25%', '0.10%',
     '-', '-', '-', '-', '暂停申购'),
    ('博时', '016055', '016057', '博时纳斯达克100ETF联接', '2.1771',
     '0.50%', '0.15%', '0.30%', '0.10%',
     '+32.62%', '+14.31%', '+18.64%', '+10.83%', '暂停申购'),
    ('天弘', '018043', '018044', '天弘纳斯达克100指数', '2.0958',
     '0.50%', '0.10%', '0.20%', '0.10%',
     '+32.11%', '+13.66%', '+18.26%', '+10.67%', '暂停申购'),
    ('南方', '016452', '016453', '南方纳斯达克100指数', '2.3617',
     '0.50%', '0.15%', '0.10%', '0.12%',
     '+31.74%', '+13.72%', '+18.42%', '+10.79%', '限200元/日'),
    ('招商', '019547', '019548', '招商纳斯达克100ETF联接', '1.6160',
     '0.50%', '0.15%', '0.40%', '0.12%',
     '-', '-', '-', '-', '限100元/日'),
]

for i, f in enumerate(nasdaq_funds, 4):
    for j, v in enumerate(f, 1):
        if j in (10, 11, 12, 13):  # 收益率列
            if v == '-':
                style_cell(ws1, i, j, v, fill=yellow_fill)
            else:
                highlight_return(ws1, i, j, v)
        elif j == 14:  # 限额列
            if '暂停' in v:
                style_cell(ws1, i, j, v, font=red_font, fill=red_fill)
            elif '10元' in v:
                style_cell(ws1, i, j, v, font=red_font, fill=orange_fill)
            elif '50元' in v or '100元' in v:
                style_cell(ws1, i, j, v, font=bold_font, fill=yellow_fill)
            elif '200元' in v:
                style_cell(ws1, i, j, v, font=bold_font, fill=light_blue_fill)
            else:
                style_cell(ws1, i, j, v)
        elif j == 6:  # 管理费 - 低费率绿色
            if '0.50%' in v:
                style_cell(ws1, i, j, v, font=green_font, fill=green_fill)
            elif '0.80%' in v:
                style_cell(ws1, i, j, v, font=red_font, fill=orange_fill)
            else:
                style_cell(ws1, i, j, v)
        else:
            style_cell(ws1, i, j, v)

col_widths1 = [10, 10, 10, 30, 12, 10, 10, 12, 16, 10, 10, 10, 10, 14]
for i, w in enumerate(col_widths1, 1):
    ws1.column_dimensions[get_column_letter(i)].width = w

# 备注
nr = len(nasdaq_funds) + 5
ws1.merge_cells(start_row=nr, start_column=1, end_row=nr, end_column=14)
ws1.cell(row=nr, column=1, value='备注：当前QDII额度极度紧张，大部分纳斯达克100基金暂停申购或严格限购(10-200元/日)。部分基金因成立时间较短，暂无完整1年收益数据。').font = Font(name='微软雅黑', size=10, color='C00000')
ws1.cell(row=nr, column=1).alignment = left_align

# ========================================================================
# Sheet 2: 标普500 基金对比
# ========================================================================
ws2 = wb.create_sheet('标普500对比')

style_title(ws2, 1, 14, '支付宝 - 标普500指数基金综合对比 (数据截止: 2026-05-28)')

headers2 = ['基金公司', 'A类代码', 'C类代码', 'A类名称', '最新净值(A)',
            '管理费/年', '托管费/年', '销售服务费(C)', '申购费(支付宝1折)',
            '近1年', '近6月', '近3月', '近1月', '每日申购限额']
style_header(ws2, 3, headers2)

sp500_funds = [
    ('博时', '050025', '006075', '博时标普500ETF联接', '5.5486',
     '0.60%', '0.20%', '0.35%', '0.12%',
     '+21.25%', '+6.51%', '+8.21%', '+5.18%', '限100元/日'),
    ('摩根', '017641', '019305', '摩根标普500指数', '1.6902',
     '0.50%', '0.15%', '0.30%', '0.12%',
     '+21.03%', '+6.89%', '+8.69%', '+5.30%', '限100元/日'),
    ('易方达', '161125', '012860', '易方达标普500指数', '3.1286',
     '0.80%', '0.20%', '0.35%', '0.12%',
     '+20.96%', '+6.48%', '+8.17%', '+5.17%', '限10元/日'),
    ('华夏', '018064', '018065', '华夏标普500ETF联接', '1.6914',
     '0.60%', '0.15%', '0.30%', '0.12%',
     '+20.46%', '+6.23%', '+8.82%', '+4.95%', '限100元/日'),
    ('天弘', '007721', '007722', '天弘标普500(QDII-FOF)', '2.2399',
     '0.60%', '0.20%', '0.25%', '0.10%',
     '+20.20%', '+6.06%', '+7.78%', '+5.04%', '限100元/日'),
    ('国泰', '017028', '017030', '国泰标普500ETF联接', '1.7076',
     '0.60%', '0.15%', '0.30%', '0.10%',
     '+18.73%', '+7.55%', '+8.58%', '+5.25%', '限10000元/日'),
    ('大成', '096001', '008401', '大成标普500等权重指数', '2.7236',
     '1.00%', '0.20%', '0.30%', '0.15%',
     '+11.81%', '+4.66%', '+0.32%', '+2.91%', '限50元/日'),
]

for i, f in enumerate(sp500_funds, 4):
    for j, v in enumerate(f, 1):
        if j in (10, 11, 12, 13):
            highlight_return(ws2, i, j, v)
        elif j == 14:
            if '10000' in v:
                style_cell(ws2, i, j, v, font=green_font, fill=green_fill)
            elif '10元' in v:
                style_cell(ws2, i, j, v, font=red_font, fill=orange_fill)
            elif '50元' in v:
                style_cell(ws2, i, j, v, font=bold_font, fill=yellow_fill)
            else:
                style_cell(ws2, i, j, v, font=bold_font, fill=light_blue_fill)
        elif j == 6:
            if '0.50%' in v:
                style_cell(ws2, i, j, v, font=green_font, fill=green_fill)
            elif '1.00%' in v:
                style_cell(ws2, i, j, v, font=red_font, fill=orange_fill)
            else:
                style_cell(ws2, i, j, v)
        else:
            style_cell(ws2, i, j, v)

for i, w in enumerate(col_widths1, 1):
    ws2.column_dimensions[get_column_letter(i)].width = w

nr2 = len(sp500_funds) + 5
ws2.merge_cells(start_row=nr2, start_column=1, end_row=nr2, end_column=14)
ws2.cell(row=nr2, column=1, value='备注：大成标普500跟踪的是等权重指数(非市值加权)，收益率与其他基金差异较大。国泰限额最宽松(10000元/日)。').font = Font(name='微软雅黑', size=10, color='C00000')
ws2.cell(row=nr2, column=1).alignment = left_align

# ========================================================================
# Sheet 3: QDII主动管理基金对比
# ========================================================================
ws_qdii = wb.create_sheet('QDII基金对比')

style_title(ws_qdii, 1, 14, '支付宝 - QDII基金综合对比 (数据截止: 2026-05-28)')

headers_qdii = ['基金公司', '代码', '基金名称', '基金类型', '最新净值',
                '管理费/年', '托管费/年', '申购费(支付宝1折)',
                '近1年', '近6月', '近3月', '近1月', '每日申购限额', '投资方向']
style_header(ws_qdii, 3, headers_qdii)

qdii_funds = [
    ('富国', '100055', '富国全球科技互联网股票(QDII)A', '主动管理', '5.7497',
     '1.20%', '0.20%', '0.15%',
     '+109.00%', '+57.95%', '+51.77%', '+24.33%', '限500万/日', '全球科技互联网'),
    ('富国', '013350', '富国全球科技互联网股票(QDII)C', '主动管理', '-',
     '1.20%', '0.20%', '0.00%',
     '-', '-', '-', '-', '限500万/日', '全球科技互联网'),
    ('广发', '270023', '广发全球精选股票(QDII)A', '主动管理', '-',
     '1.50%', '0.20%', '0.15%',
     '-', '-', '-', '-', '暂停申购', '全球精选'),
    ('华夏', '000041', '华夏全球股票(QDII)', '主动管理', '-',
     '1.50%', '0.25%', '0.15%',
     '-', '-', '-', '-', '暂停申购', '全球市场'),
    ('南方', '160125', '南方香港优选股票(QDII-LOF)', '主动管理', '-',
     '1.20%', '0.20%', '0.15%',
     '-', '-', '-', '-', '限大额', '港股'),
    ('易方达', '110011', '易方达亚洲精选股票(QDII)', '主动管理', '-',
     '1.50%', '0.20%', '0.15%',
     '-', '-', '-', '-', '暂停申购', '亚洲市场'),
]

for i, f in enumerate(qdii_funds, 4):
    for j, v in enumerate(f, 1):
        if j in (9, 10, 11, 12):
            if v == '-':
                style_cell(ws_qdii, i, j, v, fill=yellow_fill)
            else:
                highlight_return(ws_qdii, i, j, v)
        elif j == 13:
            if '暂停' in v:
                style_cell(ws_qdii, i, j, v, font=red_font, fill=red_fill)
            elif '500万' in v:
                style_cell(ws_qdii, i, j, v, font=green_font, fill=green_fill)
            else:
                style_cell(ws_qdii, i, j, v, font=bold_font, fill=yellow_fill)
        elif j == 6:
            if '1.20%' in v:
                style_cell(ws_qdii, i, j, v, font=red_font, fill=orange_fill)
            elif '1.50%' in v:
                style_cell(ws_qdii, i, j, v, font=red_font, fill=red_fill)
            else:
                style_cell(ws_qdii, i, j, v)
        elif j == 4:
            style_cell(ws_qdii, i, j, v, font=bold_font, fill=light_blue_fill)
        elif j == 14:
            style_cell(ws_qdii, i, j, v, align=left_align)
        else:
            style_cell(ws_qdii, i, j, v)

col_widths_qdii = [10, 10, 32, 12, 12, 10, 10, 16, 12, 12, 12, 12, 14, 16]
for i, w in enumerate(col_widths_qdii, 1):
    ws_qdii.column_dimensions[get_column_letter(i)].width = w

# 100055 重点分析
nr_qdii = len(qdii_funds) + 5
ws_qdii.cell(row=nr_qdii, column=1, value='重点基金分析：100055 富国全球科技互联网').font = Font(name='微软雅黑', size=12, bold=True, color='1F4E79')

analysis = [
    '核心优势：近1年+109%，收益远超同类QDII基金，全球科技互联网赛道配置',
    '重仓股：台积电、英伟达、谷歌、网易、AMD、ASML、三星等全球科技龙头',
    '费率：管理费1.20%高于指数基金(0.50%)，但为主动管理型，基金经理主动选股',
    '限额：500万/日，普通人完全不受限，是当前QDII中额度最宽松的之一',
    '风险提示：主动管理型基金依赖基金经理能力，费率高，近1年翻倍后需注意回调风险',
    '与被动指数基金对比：费率高0.70%/年，但收益大幅跑赢纳斯达克100指数(+33%)',
]
for i, a in enumerate(analysis, nr_qdii + 1):
    ws_qdii.merge_cells(start_row=i, start_column=1, end_row=i, end_column=14)
    ws_qdii.cell(row=i, column=1, value=f'  {a}').font = data_font
    ws_qdii.cell(row=i, column=1).alignment = left_align

# ========================================================================
# Sheet 4: 赎回费率明细
# ========================================================================
ws3 = wb.create_sheet('赎回费率明细')

style_title(ws3, 1, 7, 'QDII指数基金赎回费率明细 (所有基金通用)')

headers3 = ['持有期限', '赎回费率', '说明', '', '', '', '']
style_header(ws3, 3, headers3)

redeem_data = [
    ('< 7天', '1.50%', '惩罚性费率，强烈建议不要短期赎回'),
    ('7天 - 1年', '0.00%', '免赎回费，支付宝持有7天后赎回无额外费用'),
    ('1年 - 2年', '0.00%', '免赎回费'),
    ('> 2年', '0.00%', '免赎回费'),
]

for i, r in enumerate(redeem_data, 4):
    for j, v in enumerate(r, 1):
        if j == 2 and '1.50%' in v:
            style_cell(ws3, i, j, v, font=red_font, fill=red_fill)
        elif j == 2 and '0.00%' in v:
            style_cell(ws3, i, j, v, font=green_font, fill=green_fill)
        elif j == 3:
            style_cell(ws3, i, j, v, align=left_align)
        else:
            style_cell(ws3, i, j, v)

for i in range(1, 8):
    ws3.column_dimensions[get_column_letter(i)].width = 20

# 补充说明
ws3.merge_cells(start_row=9, start_column=1, end_row=9, end_column=7)
ws3.cell(row=9, column=1, value='A类 vs C类选择建议：').font = Font(name='微软雅黑', size=12, bold=True)

notes = [
    '持有 < 1年：选C类（免申购费，销售服务费按天计提，综合成本更低）',
    '持有 > 2年：选A类（申购费1折后仅0.10-0.15%，长期持有更划算）',
    '持有 1-2年：需具体计算，一般差异不大',
    '注意：C类份额不收申购费，但每年收取0.10%-0.40%的销售服务费',
]
for i, n in enumerate(notes, 10):
    ws3.merge_cells(start_row=i, start_column=1, end_row=i, end_column=7)
    ws3.cell(row=i, column=1, value=f'  {n}').font = data_font
    ws3.cell(row=i, column=1).alignment = left_align

# ========================================================================
# Sheet 5: 综合推荐
# ========================================================================
ws4 = wb.create_sheet('综合推荐方案')

style_title(ws4, 1, 8, '支付宝 QDII指数基金综合推荐方案')

# 纳斯达克100推荐
row = 3
ws4.cell(row=row, column=1, value='一、纳斯达克100 推荐排名').font = Font(name='微软雅黑', size=13, bold=True, color='1F4E79')

headers4 = ['排名', '基金名称', '代码(A类)', '近1年', '近6月', '管理费', '每日限额', '推荐理由']
style_header(ws4, row + 1, headers4)

nq_recommends = [
    ('1', '华安纳斯达克100ETF联接A', '040046', '+33.42%', '+14.43%', '0.60%', '限10元/日', '收益率最高之一+费率适中+规模47亿'),
    ('2', '广发纳斯达克100ETF联接A', '270042', '+32.86%', '+14.29%', '0.80%', '限10元/日', '规模最大97亿+流动性最好'),
    ('3', '天弘纳斯达克100指数A', '018043', '+32.11%', '+13.66%', '0.50%', '暂停申购', '费率最低0.50%+规模22亿'),
    ('4', '易方达纳斯达克100ETF联接A', '161130', '+31.49%', '+13.84%', '0.50%', '暂停申购', '费率低0.50%+老牌基金公司'),
    ('5', '南方纳斯达克100指数A', '016452', '+31.74%', '+13.72%', '0.50%', '限200元/日', '费率低+限额相对宽松'),
]

for i, r in enumerate(nq_recommends, row + 2):
    for j, v in enumerate(r, 1):
        if j == 1:
            style_cell(ws4, i, j, v, font=bold_font, fill=light_blue_fill)
        elif j in (4, 5):
            highlight_return(ws4, i, j, v)
        elif j == 6:
            if '0.50%' in v:
                style_cell(ws4, i, j, v, font=green_font, fill=green_fill)
            elif '0.80%' in v:
                style_cell(ws4, i, j, v, font=red_font, fill=orange_fill)
            else:
                style_cell(ws4, i, j, v)
        elif j == 7:
            if '暂停' in v:
                style_cell(ws4, i, j, v, font=red_font, fill=red_fill)
            elif '200' in v:
                style_cell(ws4, i, j, v, font=bold_font, fill=green_fill)
            else:
                style_cell(ws4, i, j, v, font=red_font, fill=orange_fill)
        elif j == 8:
            style_cell(ws4, i, j, v, align=left_align)
        else:
            style_cell(ws4, i, j, v)

# 标普500推荐
row2 = row + len(nq_recommends) + 4
ws4.cell(row=row2, column=1, value='二、标普500 推荐排名').font = Font(name='微软雅黑', size=13, bold=True, color='1F4E79')
style_header(ws4, row2 + 1, headers4)

sp_recommends = [
    ('1', '国泰标普500ETF联接A', '017028', '+18.73%', '+7.55%', '0.60%', '限10000元/日', '限额最宽松!可大额买入+费率合理'),
    ('2', '摩根标普500指数A', '017641', '+21.03%', '+6.89%', '0.50%', '限100元/日', '费率最低0.50%+收益率最高之一'),
    ('3', '博时标普500ETF联接A', '050025', '+21.25%', '+6.51%', '0.60%', '限100元/日', '收益率最高+规模最大59亿'),
    ('4', '华夏标普500ETF联接A', '018064', '+20.46%', '+6.23%', '0.60%', '限100元/日', '收益率稳健+华夏品牌'),
    ('5', '天弘标普500(QDII-FOF)A', '007721', '+20.20%', '+6.06%', '0.60%', '限100元/日', 'FOF形式+支付宝友好'),
]

for i, r in enumerate(sp_recommends, row2 + 2):
    for j, v in enumerate(r, 1):
        if j == 1:
            style_cell(ws4, i, j, v, font=bold_font, fill=light_blue_fill)
        elif j in (4, 5):
            highlight_return(ws4, i, j, v)
        elif j == 6:
            if '0.50%' in v:
                style_cell(ws4, i, j, v, font=green_font, fill=green_fill)
            else:
                style_cell(ws4, i, j, v)
        elif j == 7:
            if '10000' in v:
                style_cell(ws4, i, j, v, font=green_font, fill=green_fill)
            else:
                style_cell(ws4, i, j, v, font=bold_font, fill=yellow_fill)
        elif j == 8:
            style_cell(ws4, i, j, v, align=left_align)
        else:
            style_cell(ws4, i, j, v)

# QDII主动管理推荐
row_q = row2 + len(sp_recommends) + 4
ws4.cell(row=row_q, column=1, value='三、QDII主动管理基金推荐').font = Font(name='微软雅黑', size=13, bold=True, color='1F4E79')
style_header(ws4, row_q + 1, headers4)

qdii_recommends = [
    ('1', '富国全球科技互联网(QDII)A', '100055', '+109.00%', '+57.95%', '1.20%', '限500万/日', '近1年翻倍!全球科技龙头配置+额度充足'),
    ('2', '富国全球科技互联网(QDII)C', '013350', '-', '-', '1.20%', '限500万/日', 'C类免申购费，短期持有更划算'),
]

for i, r in enumerate(qdii_recommends, row_q + 2):
    for j, v in enumerate(r, 1):
        if j == 1:
            style_cell(ws4, i, j, v, font=bold_font, fill=light_blue_fill)
        elif j in (4, 5):
            if v == '-':
                style_cell(ws4, i, j, v, fill=yellow_fill)
            else:
                highlight_return(ws4, i, j, v)
        elif j == 6:
            style_cell(ws4, i, j, v, font=red_font, fill=orange_fill)
        elif j == 7:
            if '500万' in v:
                style_cell(ws4, i, j, v, font=green_font, fill=green_fill)
            else:
                style_cell(ws4, i, j, v)
        elif j == 8:
            style_cell(ws4, i, j, v, align=left_align)
        else:
            style_cell(ws4, i, j, v)

# 关键提示
row3 = row_q + len(qdii_recommends) + 4
ws4.cell(row=row3, column=1, value='四、下周购买实操建议').font = Font(name='微软雅黑', size=13, bold=True, color='1F4E79')

tips = [
    '纳斯达克100：当前所有基金QDII额度紧张，大部分暂停申购。南方A(016452)每日限200元是能买到的最大额度。',
    '标普500：国泰A(017028)每日限额10000元，是当前QDII基金中额度最宽松的，强烈推荐优先买入。',
    '短期持有(<1年)选C类，长期持有(>2年)选A类。C类免申购费但每年有销售服务费。',
    '美股近1年表现强劲：纳斯达克100平均+32%，标普500平均+20%。但需注意汇率风险和市场波动。',
    '建议策略：先买入国泰标普500(额度充足)，纳斯达克100每天定投200元积少成多。',
]
for i, t in enumerate(tips, row3 + 1):
    ws4.merge_cells(start_row=i, start_column=1, end_row=i, end_column=8)
    ws4.cell(row=i, column=1, value=f'  {t}').font = data_font
    ws4.cell(row=i, column=1).alignment = left_align

# 风险提示
row_risk = row3 + len(tips) + 2
ws4.merge_cells(start_row=row_risk, start_column=1, end_row=row_risk, end_column=8)
risk_cell = ws4.cell(row=row_risk, column=1, value='风险提示：基金有风险，投资需谨慎。QDII基金还面临汇率风险。以上推荐基于数据分析，不构成投资建议。数据来源：天天基金网，截止2026-05-28。')
risk_cell.font = Font(name='微软雅黑', size=11, bold=True, color='C00000')
risk_cell.fill = PatternFill(start_color='FFF2CC', end_color='FFF2CC', fill_type='solid')
risk_cell.alignment = left_align

for i in range(1, 9):
    ws4.column_dimensions[get_column_letter(i)].width = 18
ws4.column_dimensions['B'].width = 28
ws4.column_dimensions['H'].width = 38

# ========== 保存 ==========
desktop = os.path.join(os.path.expanduser('~'), 'Desktop')
filepath = os.path.join(desktop, '纳斯达克100_标普500_基金对比_20260601.xlsx')
wb.save(filepath)
print(f'报告已保存到: {filepath}')
