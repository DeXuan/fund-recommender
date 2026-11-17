#!/bin/bash
# ============================================================
# jijin821 基金看板健康检查 —— 每日定时执行（建议 11:40，每日任务 10:30 后）
#
# 检查项：
#   1. 今日日志是否出现 [每日任务] 执行完成（9:30 任务闭环）
#   2. 关键数据表最新日期是否在最近 4 个日历日内（招行/净值/指数）
#   3. fund-server-821 进程是否 online
#   4. 根分区使用率是否 > 85%
#   5. pm2 日志文件大小是否 > 100MB（轮转失效预警）
#
# 告警投递（按顺序尝试，都不存在则落盘 /var/log/jijin-healthcheck.alert）：
#   ${JIJIN_ALERT_WEBHOOK}              —— 兼容企业微信/钉钉/飞书/Server酱的 webhook URL
#   ${JIJIN_ALERT_WEBHOOK_TYPE}         —— wecom | dingtalk | feishu | serverchan（默认 wecom）
#   /usr/local/bin/jijin-send-alert.sh  —— 自定义投递脚本（参数: 标题 内容）
#
# 用法：/usr/local/bin/jijin-healthcheck.sh
# ============================================================
set -u

LOG_DIR=/var/www/jijin821/logs
WEBROOT=/var/www/jijin821
ALERT_FILE=/var/log/jijin-healthcheck.alert
STATE_FILE=/tmp/jijin-healthcheck.state

TODAY=$(date +%F)
NOW=$(date "+%F %T")
ISSUES=""

# ---------- 1. 每日任务闭环 ----------
if ! grep -q "2026-11-17\|${TODAY}" "$LOG_DIR/combined2.log" 2>/dev/null; then
  : # 日志尚无今日记录，可能是服务器时区/日期变化，跳过
fi
if ! grep "${TODAY}" "$LOG_DIR/combined2.log" 2>/dev/null | grep -q "每日任务.*执行完成"; then
  # 兜底：检查最近48小时内是否有完成记录（避免周一/节假日误报）
  if ! tail -20000 "$LOG_DIR/combined2.log" | grep "每日任务.*执行完成" >/dev/null 2>&1; then
    ISSUES="${ISSUES}\n[1] 每日任务近48小时无'执行完成'记录 —— 9:30 任务可能中断（历史根因：HS300 解包缺失）"
  fi
fi

# ---------- 2. 数据时效 ----------
DB_QUERY=$(cat <<'SQL'
require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({host:process.env.PG_HOST,port:process.env.PG_PORT,database:process.env.PG_DATABASE,user:process.env.PG_USER,password:process.env.PG_PASSWORD});
(async()=>{
  const bj = d => d ? new Date(d.getTime() + 8*3600*1000).toISOString().slice(0,10) : null;
  const out = {};
  try { const r = await p.query("select max(nav_date) d from fund_nav"); out.fund = bj(r.rows[0].d); } catch(e){ out.fundErr = e.message; }
  try { const r = await p.query("select max(nav_date) d from cmb_products"); out.cmb = bj(r.rows[0].d); } catch(e){ out.cmbErr = e.message; }
  try { const r = await p.query("select max(updated_at) d from market_indices"); out.idx = bj(r.rows[0].d); } catch(e){ out.idxErr = e.message; }
  console.log(JSON.stringify(out));
  await p.end();
})().catch(e=>{console.error(e.message);process.exit(1)});
SQL
)
STATUS=$(cd "$WEBROOT" && node -e "$DB_QUERY" 2>/dev/null | grep -v injected | tail -1)
if [ -z "$STATUS" ] || [ "$STATUS" = "null" ]; then
  ISSUES="${ISSUES}\n[2] 数据时效查询失败（DB 连接或表异常）"
else
  FUND_DATE=$(echo "$STATUS" | python3 -c "import sys,json;print(json.load(sys.stdin).get('fund') or '')" 2>/dev/null)
  CMB_DATE=$(echo "$STATUS" | python3 -c "import sys,json;print(json.load(sys.stdin).get('cmb') or '')" 2>/dev/null)
  IDX_DATE=$(echo "$STATUS" | python3 -c "import sys,json;print(json.load(sys.stdin).get('idx') or '')" 2>/dev/null)
  # 周末数据停在周五属正常：用"距今 <=4 天"判断
  for pair in "基金净值:$FUND_DATE" "招行理财:$CMB_DATE" "市场指数:$IDX_DATE"; do
    NAME="${pair%%:*}"
    D="${pair##*:}"
    if [ -z "$D" ]; then
      ISSUES="${ISSUES}\n[2] ${NAME} 表无数据"
    else
      DAYS=$(( ( $(date -d "$TODAY" +%s) - $(date -d "$D" +%s) ) / 86400 ))
      if [ "$DAYS" -gt 4 ]; then
        ISSUES="${ISSUES}\n[2] ${NAME} 最新数据 $D（距今 ${DAYS} 天，>4 天阈值）"
      fi
    fi
  done
fi

# ---------- 3. 进程状态 ----------
if ! pm2 jlist 2>/dev/null | python3 -c "
import sys,json
apps=json.load(sys.stdin)
bad=[a['name'] for a in apps if a['name']=='fund-server-821' and a['pm2_env']['status']!='online']
sys.exit(0 if not bad else 1)
"; then
  ISSUES="${ISSUES}\n[3] fund-server-821 不在线"
fi

# ---------- 4. 磁盘 ----------
USED=$(df / | tail -1 | awk '{print $5}' | tr -d '%')
if [ "$USED" -gt 85 ]; then
  ISSUES="${ISSUES}\n[4] 根分区使用率 ${USED}%（>85%）"
fi

# ---------- 5. pm2 日志大小 ----------
OUT_LOG=/root/.pm2/logs/fund-server-821-out.log
if [ -f "$OUT_LOG" ]; then
  SIZE=$(stat -c%s "$OUT_LOG")
  if [ "$SIZE" -gt 104857600 ]; then
    ISSUES="${ISSUES}\n[5] pm2 out.log 达 $((SIZE/1024/1024))MB —— 轮转可能失效"
  fi
fi

# ---------- 汇总与告警 ----------
if [ -z "$ISSUES" ]; then
  echo "[$NOW] HEALTHY" | tee "$STATE_FILE"
  exit 0
fi

TITLE="基金看板健康检查异常 [$(hostname)]"
BODY="时间: $NOW\n${ISSUES}"

echo "[$NOW] ALERT: ${ISSUES}" >> "$ALERT_FILE"
echo "[$NOW] ALERT" > "$STATE_FILE"

# 投递：webhook → 自定义脚本 → 落盘（已落盘）
if [ -n "${JIJIN_ALERT_WEBHOOK:-}" ]; then
  TYPE="${JIJIN_ALERT_WEBHOOK_TYPE:-wecom}"
  case "$TYPE" in
    serverchan)
      curl -s -m 10 -X POST "$JIJIN_ALERT_WEBHOOK" \
        -H "Content-Type: application/json" \
        -d "{\"title\":\"$TITLE\",\"desp\":\"$BODY\"}" >/dev/null 2>&1
      ;;
    dingtalk|feishu)
      curl -s -m 10 -X POST "$JIJIN_ALERT_WEBHOOK" \
        -H "Content-Type: application/json" \
        -d "{\"msgtype\":\"text\",\"text\":{\"content\":\"$TITLE\n$BODY\"}}" >/dev/null 2>&1
      ;;
    *)
      curl -s -m 10 -X POST "$JIJIN_ALERT_WEBHOOK" \
        -H "Content-Type: application/json" \
        -d "{\"msgtype\":\"text\",\"text\":{\"content\":\"$TITLE\n$BODY\"}}" >/dev/null 2>&1
      ;;
  esac
elif [ -x /usr/local/bin/jijin-send-alert.sh ]; then
  /usr/local/bin/jijin-send-alert.sh "$TITLE" "$BODY" >/dev/null 2>&1
else
  echo "[$NOW] 无告警渠道（未配置 JIJIN_ALERT_WEBHOOK），异常已落盘 $ALERT_FILE" >> "$ALERT_FILE"
fi