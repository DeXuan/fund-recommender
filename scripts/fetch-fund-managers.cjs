/**
 * 从东方财富API批量获取基金的真实基金经理信息
 * 用法: node scripts/fetch-fund-managers.cjs
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 从 fund-data.cjs 读取所有基金代码
const { allFunds } = require('../server/fund-data.cjs');

const CONCURRENCY = 5; // 并发数
const DELAY = 200; // 请求间隔(ms)

async function fetchFundManager(code) {
  try {
    const resp = await axios.get(`http://fund.eastmoney.com/pingzhongdata/${code}.js`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://fund.eastmoney.com/',
      },
    });
    const text = resp.data || '';

    // 提取 Data_currentFundManager（需要处理嵌套JSON）
    const startIdx = text.indexOf('Data_currentFundManager');
    if (startIdx >= 0) {
      // 找到等号后的 [ 位置
      const eqIdx = text.indexOf('[', startIdx);
      if (eqIdx < 0) return { code, name: allFunds.find(f => f.code === code)?.name || '', manager: null };

      // 找到匹配的 ] 位置（处理嵌套括号）
      let depth = 0;
      let endIdx = -1;
      for (let i = eqIdx; i < text.length; i++) {
        if (text[i] === '[') depth++;
        if (text[i] === ']') depth--;
        if (depth === 0) { endIdx = i; break; }
      }
      if (endIdx < 0) return { code, name: allFunds.find(f => f.code === code)?.name || '', manager: null };

      const jsonStr = text.substring(eqIdx, endIdx + 1);
      try {
        const managers = JSON.parse(jsonStr);
        if (managers.length > 0) {
          return {
            code,
            name: allFunds.find(f => f.code === code)?.name || '',
            manager: managers[0].name, // 取第一个（现任）基金经理
            allManagers: managers.map(m => m.name).join(', '),
            workTime: managers[0].workTime || '',
            fundSize: managers[0].fundSize || '',
          };
        }
      } catch (e) {
        // JSON解析失败
      }
    }
    return { code, name: allFunds.find(f => f.code === code)?.name || '', manager: null };
  } catch (e) {
    return { code, name: allFunds.find(f => f.code === code)?.name || '', manager: null, error: e.message };
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log(`开始获取 ${allFunds.length} 只基金的基金经理信息...`);

  const results = [];
  const errors = [];

  // 分批并发获取
  for (let i = 0; i < allFunds.length; i += CONCURRENCY) {
    const batch = allFunds.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(f => fetchFundManager(f.code)));
    results.push(...batchResults);

    const successCount = results.filter(r => r.manager).length;
    const errorCount = results.filter(r => r.error).length;
    process.stdout.write(`\r进度: ${results.length}/${allFunds.length} | 成功: ${successCount} | 失败: ${errorCount}`);

    if (i + CONCURRENCY < allFunds.length) {
      await sleep(DELAY);
    }
  }

  console.log('\n');

  // 生成 fundManagerMap
  const managerMap = {};
  for (const r of results) {
    if (r.manager) {
      managerMap[r.code] = r.manager;
    }
  }

  // 输出统计
  const successCount = results.filter(r => r.manager).length;
  const failCount = results.filter(r => !r.manager).length;
  console.log(`获取完成: 成功 ${successCount} 只, 失败 ${failCount} 只`);

  if (failCount > 0) {
    console.log('\n失败的基金:');
    results.filter(r => !r.manager).forEach(r => {
      console.log(`  ${r.code}: ${r.name} ${r.error ? '(' + r.error + ')' : '(无数据)'}`);
    });
  }

  // 输出基金经理分布
  const managerCounts = {};
  for (const [code, manager] of Object.entries(managerMap)) {
    managerCounts[manager] = (managerCounts[manager] || 0) + 1;
  }
  const sortedManagers = Object.entries(managerCounts).sort((a, b) => b[1] - a[1]);
  console.log('\n基金经理分布 (管理基金数量 >= 3):');
  sortedManagers.filter(([, count]) => count >= 3).forEach(([name, count]) => {
    console.log(`  ${name}: ${count} 只`);
  });

  // 保存到文件
  const outputPath = path.join(__dirname, '..', 'server', 'fund-managers-data.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    fetchTime: new Date().toISOString(),
    totalFunds: allFunds.length,
    successCount,
    failCount,
    managerMap,
    details: results,
  }, null, 2), 'utf-8');

  console.log(`\n数据已保存到: ${outputPath}`);

  // 生成 fundManagerMap 代码片段
  const mapEntries = Object.entries(managerMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([code, manager]) => `  '${code}': '${manager}',`)
    .join('\n');

  const mapCode = `const fundManagerMap = {\n${mapEntries}\n};`;

  const mapOutputPath = path.join(__dirname, '..', 'server', 'fund-manager-map.js');
  fs.writeFileSync(mapOutputPath, mapCode, 'utf-8');
  console.log(`fundManagerMap 代码已保存到: ${mapOutputPath}`);
}

main().catch(console.error);
