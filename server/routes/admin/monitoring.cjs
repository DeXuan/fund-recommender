const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const os = require('os');
const { getPool } = require('../../db.cjs');
const logger = require('../../utils/logger.cjs');
const { safeExec, safeExecAsync, formatBytes, formatDuration } = require('./helpers.cjs');
const metrics = require('../../utils/metrics.cjs');

const requestCount = metrics.state.requestCount;
const slowQueryCount = metrics.state.slowQueryCount;
const startTime = metrics.state.startTime;
const apiStatsBuffer = metrics.state.apiStatsBuffer;
const recordApiStat = metrics.recordApiStat;
const resetQpsCounter = metrics.resetQpsCounter;

let serverResourcesCache = { data: null, timestamp: 0 };
const SERVER_RESOURCES_CACHE_TTL = 8000;
router.get('/api-stats', async (req, res) => {
  try {
    const pool = getPool();
    const { hours = 24 } = req.query;

    // From database (historical)
    const dbStats = await pool.query(`
      SELECT endpoint, method,
             SUM(request_count) AS total_requests,
             SUM(error_count) AS total_errors,
             ROUND(AVG(avg_response_ms)::numeric, 2) AS avg_ms,
             ROUND(MAX(max_response_ms)::numeric, 2) AS max_ms,
             ROUND(AVG(p95_response_ms)::numeric, 2) AS p95_ms
      FROM api_stats
      WHERE hour_start > NOW() - ($1 || ' hours')::interval
      GROUP BY endpoint, method
      ORDER BY total_requests DESC
      LIMIT 50
    `, [String(parseInt(hours) || 24)]);

    // From memory buffer (current)
    const liveStats = [];
    for (const [key, stat] of apiStatsBuffer.entries()) {
      const [method, endpoint] = key.split(':');
      const sorted = [...stat.times].sort((a, b) => a - b);
      liveStats.push({
        endpoint, method,
        total_requests: stat.count,
        total_errors: stat.errors,
        avg_ms: stat.count > 0 ? (stat.totalTime / stat.count).toFixed(2) : 0,
        max_ms: stat.maxTime.toFixed(2),
        p95_ms: (sorted[Math.floor(sorted.length * 0.95)] || 0).toFixed(2),
        live: true,
      });
    }

    // Hourly trend
    const trendResult = await pool.query(`
      SELECT hour_start,
             SUM(request_count) AS requests,
             SUM(error_count) AS errors,
             ROUND(AVG(avg_response_ms)::numeric, 2) AS avg_ms
      FROM api_stats
      WHERE hour_start > NOW() - ($1 || ' hours')::interval
      GROUP BY hour_start
      ORDER BY hour_start
    `, [String(parseInt(hours) || 24)]);

    // Error rate
    const errorRate = await pool.query(`
      SELECT
        COALESCE(SUM(request_count), 0) AS total,
        COALESCE(SUM(error_count), 0) AS errors,
        CASE WHEN SUM(request_count) > 0 THEN ROUND(SUM(error_count) * 100.0 / SUM(request_count), 2) ELSE 0 END AS error_rate
      FROM api_stats WHERE hour_start > NOW() - INTERVAL '24 hours'
    `);

    res.json({
      endpoints: [...liveStats, ...dbStats.rows.filter(d => !liveStats.find(l => l.endpoint === d.endpoint && l.method === d.method))],
      trend: trendResult.rows,
      errorRate: errorRate.rows[0],
    });
  } catch (error) {
    logger.error(`获取API统计失败: ${error.message}`);
    res.status(500).json({ error: '获取API统计失败' });
  }
});

// ========== Health Check ==========

// GET /api/admin/health-check — comprehensive health check
router.get('/health-check', async (req, res) => {
  const checks = [];
  const startTime = Date.now();

  // 1. Database check
  try {
    const dbStart = Date.now();
    const pool = getPool();
    await pool.query('SELECT 1');
    const dbLatency = Date.now() - dbStart;
    checks.push({ name: 'PostgreSQL', status: 'healthy', latency: dbLatency, detail: `连接正常，延迟 ${dbLatency}ms` });
  } catch (e) {
    checks.push({ name: 'PostgreSQL', status: 'unhealthy', detail: e.message });
  }

  // 2. Memory check
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  const heapPercent = Math.round(heapUsedMB / heapTotalMB * 100);
  checks.push({
    name: '堆内存',
    status: heapPercent > 90 ? 'warning' : 'healthy',
    detail: `${heapUsedMB}MB / ${heapTotalMB}MB (${heapPercent}%)`,
    value: heapPercent,
  });

  // 3. System memory
  const sysMemPercent = Math.round((os.totalmem() - os.freemem()) / os.totalmem() * 100);
  checks.push({
    name: '系统内存',
    status: sysMemPercent > 90 ? 'critical' : sysMemPercent > 80 ? 'warning' : 'healthy',
    detail: `${sysMemPercent}% 已使用`,
    value: sysMemPercent,
  });

  // 4. Disk check
  try {
    const isWin = os.platform() === 'win32';
    if (isWin) {
      const diskRaw = await safeExecAsync('powershell -Command "Get-PSDrive -PSProvider FileSystem | Where-Object {$_.Used -ne $null} | ForEach-Object { $_.Name + \\",\\" + $_.Used + \\",\\" + $_.Free }"');
      diskRaw.split('\n').filter(l => l.trim()).forEach(line => {
        const p = line.trim().split(',');
        if (p.length >= 3) {
          const used = parseInt(p[1]) || 0;
          const free = parseInt(p[2]) || 0;
          const total = used + free;
          const percent = total > 0 ? Math.round(used / total * 100) : 0;
          checks.push({
            name: `磁盘 ${p[0].trim()}:`,
            status: percent > 95 ? 'critical' : percent > 85 ? 'warning' : 'healthy',
            detail: `${percent}% 已使用 (${formatBytes(used)} / ${formatBytes(total)})`,
            value: percent,
          });
        }
      });
    } else {
      const df = await safeExecAsync("df -h / | tail -1");
      const parts = df.split(/\s+/);
      if (parts.length >= 5) {
        const percent = parseInt(parts[4]) || 0;
        checks.push({ name: '磁盘 /', status: percent > 95 ? 'critical' : percent > 85 ? 'warning' : 'healthy', detail: `${percent} 已使用`, value: percent });
      }
    }
  } catch { checks.push({ name: '磁盘', status: 'unknown', detail: '无法获取' }); }

  // 5. Uptime
  const uptimeSec = Math.floor(process.uptime());
  checks.push({ name: '服务运行', status: 'healthy', detail: formatDuration(uptimeSec), value: uptimeSec });

  // 6. Connection pool
  try {
    const pool = getPool();
    const connResult = await pool.query("SELECT count(*) AS total FROM pg_stat_activity WHERE datname = current_database()");
    const maxConn = await pool.query("SHOW max_connections");
    const total = parseInt(connResult.rows[0].total);
    const max = parseInt(maxConn.rows[0].max_connections);
    const connPercent = Math.round(total / max * 100);
    checks.push({
      name: '数据库连接',
      status: connPercent > 80 ? 'warning' : 'healthy',
      detail: `${total} / ${max} (${connPercent}%)`,
      value: connPercent,
    });
  } catch {}

  const overallStatus = checks.some(c => c.status === 'unhealthy' || c.status === 'critical') ? 'critical'
    : checks.some(c => c.status === 'warning') ? 'warning' : 'healthy';

  res.json({ status: overallStatus, checks, totalLatency: Date.now() - startTime, timestamp: Date.now() });
});
router.get('/metrics', async (req, res) => {
  try {
    const pool = getPool();
    const now = Date.now();
    const uptimeSeconds = Math.floor((now - startTime) / 1000);

    // QPS calculation
    const qps = uptimeSeconds > 0 ? (requestCount / Math.min(uptimeSeconds, 60)).toFixed(2) : '0.00';

    // Active connections from pg_stat_activity
    const connResult = await pool.query(
      `SELECT count(*) AS total,
              count(*) FILTER (WHERE state = 'active') AS active,
              count(*) FILTER (WHERE state = 'idle') AS idle
       FROM pg_stat_activity WHERE datname = current_database()`
    );
    const connections = connResult.rows[0];

    // Database size
    const sizeResult = await pool.query(`SELECT pg_database_size(current_database()) AS size`);
    const dbSize = parseInt(sizeResult.rows[0].size);

    // Uptime
    const uptimeResult = await pool.query(`SELECT extract(epoch from now() - pg_postmaster_start_time())::int AS uptime`);
    const dbUptime = parseInt(uptimeResult.rows[0].uptime);

    // Max connections
    const maxConnResult = await pool.query(`SHOW max_connections`);
    const maxConnections = parseInt(maxConnResult.rows[0].max_connections);

    // Cache hit ratio
    const cacheResult = await pool.query(`
      SELECT
        CASE WHEN (blks_hit + blks_read) = 0 THEN 0
             ELSE round(blks_hit * 100.0 / (blks_hit + blks_read), 2)
        END AS cache_hit_ratio
      FROM pg_stat_database WHERE datname = current_database()
    `);
    const cacheHitRatio = parseFloat(cacheResult.rows[0]?.cache_hit_ratio || 0);

    // Deadlocks
    const deadlockResult = await pool.query(
      `SELECT deadlocks FROM pg_stat_database WHERE datname = current_database()`
    );
    const deadlocks = parseInt(deadlockResult.rows[0]?.deadlocks || 0);

    // Slow queries (transactions that took > 1s in last hour)
    const slowResult = await pool.query(`
      SELECT count(*) AS count FROM pg_stat_activity
      WHERE state = 'active' AND now() - query_start > interval '1 second'
    `);
    const activeSlowQueries = parseInt(slowResult.rows[0].count);

    // System memory
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    // Process memory
    const processMem = process.memoryUsage();

    res.json({
      qps: parseFloat(qps),
      requestCount,
      uptime: uptimeSeconds,
      connections: {
        active: parseInt(connections.active),
        idle: parseInt(connections.idle),
        total: parseInt(connections.total),
        max: maxConnections,
      },
      database: {
        size: dbSize,
        sizeFormatted: formatBytes(dbSize),
        uptime: dbUptime,
        uptimeFormatted: formatDuration(dbUptime),
        cacheHitRatio,
        deadlocks,
        activeSlowQueries,
      },
      system: {
        totalMemory: totalMem,
        freeMemory: freeMem,
        usedMemory: usedMem,
        memoryUsagePercent: ((usedMem / totalMem) * 100).toFixed(1),
        cpuCount: os.cpus().length,
        loadAvg: os.loadavg(),
        platform: os.platform(),
        hostname: os.hostname(),
      },
      process: {
        heapUsed: processMem.heapUsed,
        heapTotal: processMem.heapTotal,
        rss: processMem.rss,
        heapUsedFormatted: formatBytes(processMem.heapUsed),
        rssFormatted: formatBytes(processMem.rss),
      },
      timestamp: now,
    });
  } catch (error) {
    logger.error(`获取系统指标失败: ${error.message}`);
    res.status(500).json({ error: '获取系统指标失败' });
  }
});

// GET /api/admin/server-resources — real server resource info (async + cached)
router.get('/server-resources', async (req, res) => {
  try {
    // Return cached data if still fresh
    if (serverResourcesCache.data && (Date.now() - serverResourcesCache.timestamp) < SERVER_RESOURCES_CACHE_TTL) {
      return res.json(serverResourcesCache.data);
    }

    const isLinux = os.platform() === 'linux';
    const isWin = os.platform() === 'win32';

    const cpuCores = os.cpus().length;
    const cpuModel = os.cpus()[0]?.model || 'Unknown';
    const loadAvg = isLinux ? os.loadavg() : [0, 0, 0];

    if (isWin) {
      // Run all Windows PowerShell commands in PARALLEL to avoid sequential blocking
      const [cpuRaw, memRaw, diskRaw, netRaw, diskIoRaw, procRaw, captionRaw, versionRaw, tcpRaw] = await Promise.all([
        safeExecAsync('powershell -Command "(Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average"'),
        safeExecAsync('powershell -Command "$os = Get-CimInstance Win32_OperatingSystem; $os.TotalVisibleMemorySize + \\",\\" + $os.FreePhysicalMemory"'),
        safeExecAsync('powershell -Command "Get-PSDrive -PSProvider FileSystem | Where-Object {$_.Used -ne $null} | ForEach-Object { $_.Name + \\",\\" + $_.Used + \\",\\" + $_.Free }"'),
        safeExecAsync('powershell -Command "Get-CimInstance Win32_PerfFormattedData_Tcpip_NetworkInterface | ForEach-Object { $_.Name + \\",\\" + $_.BytesReceivedPersec + \\",\\" + $_.BytesSentPersec }"'),
        safeExecAsync('powershell -Command "Get-CimInstance Win32_PerfFormattedData_PerfDisk_LogicalDisk | Where-Object {$_.Name -ne \'_Total\'} | ForEach-Object { $_.Name + \\",\\" + $_.DiskReadBytesPersec + \\",\\" + $_.DiskWriteBytesPersec }"'),
        safeExecAsync('powershell -Command "Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 10 Id,ProcessName,WorkingSet64 | ForEach-Object { $_.Id + \\",\\" + $_.ProcessName + \\",\\" + $_.WorkingSet64 }"'),
        safeExecAsync('powershell -Command "(Get-CimInstance Win32_OperatingSystem).Caption"'),
        safeExecAsync('powershell -Command "(Get-CimInstance Win32_OperatingSystem).Version"'),
        safeExecAsync('netstat -an'),
      ]);

      // CPU
      let cpuUsage = 0;
      const cpuVal = parseInt(cpuRaw);
      if (!isNaN(cpuVal)) cpuUsage = cpuVal;

      // Memory
      let memTotal = os.totalmem(), memFree = os.freemem();
      let memBuffers = 0, memCached = 0, memAvailable = 0, swapTotal = 0, swapUsed = 0;
      const memParts = memRaw.split(',');
      if (memParts.length >= 2) {
        memTotal = parseInt(memParts[0]) * 1024;
        memFree = parseInt(memParts[1]) * 1024;
        memAvailable = memFree;
      }
      const memUsed = memTotal - (memAvailable || memFree);

      // Virtual memory
      try {
        const pf = await safeExecAsync('powershell -Command "$p = Get-CimInstance Win32_PageFileUsage; if($p){$p.AllocatedBaseSize*MB + \\",\\" + $p.CurrentUsage*MB}else{\'0,0\'}"');
        const pp = pf.split(',');
        if (pp.length >= 2) {
          swapTotal = parseInt(pp[0]) || 0;
          swapUsed = parseInt(pp[1]) || 0;
        }
      } catch { /* ignore */ }

      // Disks
      const disks = [];
      diskRaw.split('\n').filter(l => l.trim()).forEach(line => {
        const p = line.trim().split(',');
        if (p.length >= 3 && p[0]) {
          const drive = p[0].trim() + ':';
          const used = parseInt(p[1]) || 0;
          const free = parseInt(p[2]) || 0;
          const total = used + free;
          disks.push({
            filesystem: drive,
            size: formatBytes(total), used: formatBytes(used), avail: formatBytes(free),
            usePercent: total > 0 ? Math.round(used / total * 100) + '%' : '0%',
            mount: drive,
          });
        }
      });

      // Network
      let totalRx = 0, totalTx = 0;
      const ifaces = [];
      netRaw.split('\n').filter(l => l.trim()).forEach(line => {
        const p = line.trim().split(',');
        if (p.length >= 3 && p[0]) {
          const rx = parseInt(p[1]) || 0, tx = parseInt(p[2]) || 0;
          totalRx += rx; totalTx += tx;
          ifaces.push({ name: p[0], rxBytes: rx, txBytes: tx, rxFormatted: formatBytes(rx), txFormatted: formatBytes(tx) });
        }
      });
      const network = { rxBytes: totalRx, txBytes: totalTx, rxFormatted: formatBytes(totalRx), txFormatted: formatBytes(totalTx), interfaces: ifaces };

      // Disk I/O
      let tr = 0, tw = 0;
      diskIoRaw.split('\n').filter(l => l.trim()).forEach(line => {
        const p = line.trim().split(',');
        if (p.length >= 3 && p[0]) {
          tr += parseInt(p[1]) || 0; tw += parseInt(p[2]) || 0;
        }
      });
      const diskIO = { readBytes: tr, writeBytes: tw, readFormatted: formatBytes(tr), writeFormatted: formatBytes(tw) };

      // Top processes
      const topProcesses = [];
      procRaw.split('\n').filter(l => l.trim()).forEach(line => {
        const p = line.trim().split(',');
        if (p.length >= 3 && p[0]) {
          topProcesses.push({ user: 'SYSTEM', pid: p[0], cpu: 0, mem: 0, rss: formatBytes(parseInt(p[2]) || 0), command: p[1] });
        }
      });

      // System info
      const systemInfo = { hostname: os.hostname(), platform: os.platform(), arch: os.arch(), kernel: versionRaw || '', uptime: Math.floor(os.uptime()), osName: captionRaw || 'Windows' };

      // TCP connections
      const tcpConnections = { established: 0, timeWait: 0, closeWait: 0, listen: 0, total: 0 };
      tcpRaw.split('\n').forEach(line => {
        if (line.includes('ESTABLISHED')) tcpConnections.established++;
        else if (line.includes('TIME_WAIT')) tcpConnections.timeWait++;
        else if (line.includes('CLOSE_WAIT')) tcpConnections.closeWait++;
        else if (line.includes('LISTENING')) tcpConnections.listen++;
      });
      tcpConnections.total = tcpConnections.established + tcpConnections.timeWait + tcpConnections.closeWait + tcpConnections.listen;

      const result = {
        cpu: { usage: cpuUsage, cores: cpuCores, model: cpuModel, loadAvg },
        memory: {
          total: memTotal, used: memUsed, free: memFree, buffers: memBuffers, cached: memCached, available: memAvailable,
          totalFormatted: formatBytes(memTotal), usedFormatted: formatBytes(memUsed), freeFormatted: formatBytes(memFree),
          buffersFormatted: formatBytes(memBuffers), cachedFormatted: formatBytes(memCached),
          usagePercent: memTotal > 0 ? Math.round(memUsed / memTotal * 100) : 0,
          swapTotal, swapUsed, swapTotalFormatted: formatBytes(swapTotal), swapUsedFormatted: formatBytes(swapUsed),
        },
        disks, network, diskIO, topProcesses,
        system: systemInfo, osName: systemInfo.osName,
        tcp: tcpConnections, openFiles: -1,
        timestamp: Date.now(),
      };

      serverResourcesCache = { data: result, timestamp: Date.now() };
      return res.json(result);
    }

    // === Linux path: parallel file reads + async commands ===
    let cpuUsage = 0;
    const loadAvgForCpu = os.loadavg();

    // CPU measurement (needs 500ms delay, do it first)
    if (isLinux) {
      try {
        const s1 = fs.readFileSync('/proc/stat', 'utf-8').split('\n')[0].trim().split(/\s+/).slice(1).map(Number);
        await new Promise(r => setTimeout(r, 500));
        const s2 = fs.readFileSync('/proc/stat', 'utf-8').split('\n')[0].trim().split(/\s+/).slice(1).map(Number);
        const dTotal = s2.reduce((a, b) => a + b, 0) - s1.reduce((a, b) => a + b, 0);
        const dIdle = s2[3] - s1[3];
        cpuUsage = dTotal > 0 ? Math.round((1 - dIdle / dTotal) * 100) : 0;
      } catch { cpuUsage = Math.round(loadAvgForCpu[0] / cpuCores * 100); }
    }

    // Read all /proc files in parallel
    const [memInfo, netDev, diskStats, uptime, psOutput, uname, osRelease, ssOutput, tcpCount, fdCount] = await Promise.all([
      fs.promises.readFile('/proc/meminfo', 'utf-8').catch(() => ''),
      fs.promises.readFile('/proc/net/dev', 'utf-8').catch(() => ''),
      fs.promises.readFile('/proc/diskstats', 'utf-8').catch(() => ''),
      fs.promises.readFile('/proc/uptime', 'utf-8').catch(() => ''),
      safeExecAsync("ps aux --sort=-%cpu | head -11"),
      safeExecAsync('uname -r'),
      safeExecAsync('cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d \\"'),
      safeExecAsync("ss -s 2>/dev/null"),
      safeExecAsync("cat /proc/net/tcp 2>/dev/null | wc -l"),
      safeExecAsync('ls /proc/self/fd 2>/dev/null | wc -l'),
    ]);

    // Memory
    let memTotal = os.totalmem(), memFree = os.freemem();
    let memBuffers = 0, memCached = 0, memAvailable = 0, swapTotal = 0, swapUsed = 0;
    if (memInfo) {
      const p = (k) => { const m = memInfo.match(new RegExp(`${k}:\\s+(\\d+)`)); return m ? parseInt(m[1]) * 1024 : 0; };
      memTotal = p('MemTotal') || memTotal;
      memFree = p('MemFree') || memFree;
      memAvailable = p('MemAvailable') || memFree;
      memBuffers = p('Buffers');
      memCached = p('Cached');
      swapTotal = p('SwapTotal');
      swapUsed = swapTotal - p('SwapFree');
    }
    const memUsed = memTotal - (memAvailable || memFree);

    // Disks
    const disks = [];
    try {
      const df = await safeExecAsync("df -h --output=source,size,used,avail,pcent,target -x tmpfs -x devtmpfs -x overlay 2>/dev/null || df -h");
      df.split('\n').filter(l => l.trim() && !l.startsWith('Filesystem')).forEach(line => {
        const p = line.trim().split(/\s+/);
        if (p[0] && p[5]) disks.push({ filesystem: p[0], size: p[1], used: p[2], avail: p[3], usePercent: p[4], mount: p[5] });
      });
    } catch { /* ignore */ }

    // Network
    let network = { rxBytes: 0, txBytes: 0, rxFormatted: '0 B', txFormatted: '0 B', interfaces: [] };
    if (netDev) {
      let totalRx = 0, totalTx = 0;
      const ifaces = [];
      netDev.split('\n').slice(2).filter(l => l.trim()).forEach(line => {
        const p = line.trim().split(/[\s:]+/);
        if (p[0] === 'lo') return;
        const rx = parseInt(p[1]) || 0, tx = parseInt(p[9]) || 0;
        totalRx += rx; totalTx += tx;
        ifaces.push({ name: p[0], rxBytes: rx, txBytes: tx, rxFormatted: formatBytes(rx), txFormatted: formatBytes(tx) });
      });
      network = { rxBytes: totalRx, txBytes: totalTx, rxFormatted: formatBytes(totalRx), txFormatted: formatBytes(totalTx), interfaces: ifaces };
    }

    // Disk I/O
    let diskIO = { readBytes: 0, writeBytes: 0, readFormatted: '0 B', writeFormatted: '0 B' };
    if (diskStats) {
      let tr = 0, tw = 0;
      diskStats.split('\n').filter(l => l.trim()).forEach(line => {
        const p = line.trim().split(/\s+/);
        if (p[2] && /^(sd|vd|nvme|xvd)\w*$/.test(p[2])) {
          tr += (parseInt(p[5]) || 0) * 512; tw += (parseInt(p[9]) || 0) * 512;
        }
      });
      diskIO = { readBytes: tr, writeBytes: tw, readFormatted: formatBytes(tr), writeFormatted: formatBytes(tw) };
    }

    // Top processes
    const topProcesses = [];
    psOutput.split('\n').slice(1).filter(l => l.trim()).forEach(line => {
      const p = line.trim().split(/\s+/);
      topProcesses.push({ user: p[0], pid: p[1], cpu: parseFloat(p[2]) || 0, mem: parseFloat(p[3]) || 0, rss: p[5], command: p.slice(10).join(' ').slice(0, 80) });
    });

    // System info
    const systemInfo = { hostname: os.hostname(), platform: os.platform(), arch: os.arch(), kernel: uname || '', uptime: 0, osName: osRelease || 'Linux' };
    try { systemInfo.uptime = Math.floor(parseFloat(uptime.split(' ')[0])); } catch { systemInfo.uptime = Math.floor(os.uptime()); }

    // TCP connections
    const tcpConnections = { established: 0, timeWait: 0, closeWait: 0, listen: 0, total: 0 };
    const em = ssOutput.match(/estab\s+(\d+)/);
    const tm = ssOutput.match(/timewait\s+(\d+)/);
    if (em) tcpConnections.established = parseInt(em[1]);
    if (tm) tcpConnections.timeWait = parseInt(tm[1]);
    tcpConnections.total = Math.max(0, parseInt(tcpCount) - 1);

    // Open files
    let openFiles = parseInt(fdCount) || 0;

    const result = {
      cpu: { usage: cpuUsage, cores: cpuCores, model: cpuModel, loadAvg: loadAvgForCpu },
      memory: {
        total: memTotal, used: memUsed, free: memFree, buffers: memBuffers, cached: memCached, available: memAvailable,
        totalFormatted: formatBytes(memTotal), usedFormatted: formatBytes(memUsed), freeFormatted: formatBytes(memFree),
        buffersFormatted: formatBytes(memBuffers), cachedFormatted: formatBytes(memCached),
        usagePercent: memTotal > 0 ? Math.round(memUsed / memTotal * 100) : 0,
        swapTotal, swapUsed, swapTotalFormatted: formatBytes(swapTotal), swapUsedFormatted: formatBytes(swapUsed),
      },
      disks, network, diskIO, topProcesses,
      system: systemInfo, osName: systemInfo.osName,
      tcp: tcpConnections, openFiles,
      timestamp: Date.now(),
    };

    serverResourcesCache = { data: result, timestamp: Date.now() };
    res.json(result);
  } catch (error) {
    logger.error(`获取服务器资源失败: ${error.message}`);
    res.status(500).json({ error: '获取服务器资源失败' });
  }
});

// GET /api/admin/db-details — detailed PostgreSQL metrics
router.get('/db-details', async (req, res) => {
  try {
    const pool = getPool();

    // Table cache hit ratio
    const cacheResult = await pool.query(`
      SELECT
        relname AS table_name,
        CASE WHEN (heap_blks_hit + heap_blks_read) = 0 THEN 0
             ELSE round(heap_blks_hit * 100.0 / (heap_blks_hit + heap_blks_read), 2)
        END AS cache_hit_ratio,
        heap_blks_hit,
        heap_blks_read
      FROM pg_statio_user_tables
      ORDER BY heap_blks_hit + heap_blks_read DESC
      LIMIT 20
    `);

    // Temp files / disk temp tables
    const tempResult = await pool.query(`
      SELECT temp_files, temp_bytes
      FROM pg_stat_database WHERE datname = current_database()
    `);
    const tempData = tempResult.rows[0] || { temp_files: 0, temp_bytes: 0 };

    // Buffer pool (shared buffers config)
    const bufferResult = await pool.query(`SHOW shared_buffers`);
    const sharedBuffers = bufferResult.rows[0].shared_buffers;

    // Full table scans (seq_scan vs idx_scan)
    const scanResult = await pool.query(`
      SELECT
        relname AS table_name,
        seq_scan,
        idx_scan,
        CASE WHEN seq_scan + idx_scan = 0 THEN 0
             ELSE round(idx_scan * 100.0 / (seq_scan + idx_scan), 2)
        END AS idx_usage_ratio
      FROM pg_stat_user_tables
      ORDER BY seq_scan DESC
      LIMIT 20
    `);

    // Index size
    const indexSizeResult = await pool.query(`
      SELECT
        schemaname,
        relname AS table_name,
        indexrelname AS index_name,
        pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
        pg_relation_size(indexrelid) AS index_size_bytes
      FROM pg_stat_user_indexes
      ORDER BY pg_relation_size(indexrelid) DESC
      LIMIT 20
    `);

    // Data size per table
    const tableSizeResult = await pool.query(`
      SELECT
        relname AS table_name,
        pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
        pg_total_relation_size(relid) AS total_size_bytes,
        pg_size_pretty(pg_relation_size(relid)) AS data_size,
        pg_relation_size(relid) AS data_size_bytes,
        n_live_tup AS row_count
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(relid) DESC
    `);

    // Deadlock count
    const deadlockResult = await pool.query(
      `SELECT deadlocks FROM pg_stat_database WHERE datname = current_database()`
    );

    // Long running queries
    const longQueriesResult = await pool.query(`
      SELECT pid, now() - query_start AS duration, query, state
      FROM pg_stat_activity
      WHERE state = 'active' AND query NOT LIKE '%pg_stat_activity%'
      ORDER BY query_start ASC
      LIMIT 10
    `);

    // Server config
    const configResult = await pool.query(`
      SELECT name, setting, unit, short_desc
      FROM pg_settings
      WHERE name IN ('max_connections', 'shared_buffers', 'work_mem', 'maintenance_work_mem',
                      'effective_cache_size', 'wal_buffers', 'checkpoint_completion_target',
                      'random_page_cost', 'effective_io_concurrency')
      ORDER BY name
    `);

    res.json({
      tableCache: cacheResult.rows,
      temp: {
        files: parseInt(tempData.temp_files || 0),
        bytes: parseInt(tempData.temp_bytes || 0),
        bytesFormatted: formatBytes(parseInt(tempData.temp_bytes || 0)),
      },
      sharedBuffers,
      fullTableScans: scanResult.rows,
      indexSizes: indexSizeResult.rows,
      tableSizes: tableSizeResult.rows,
      deadlocks: parseInt(deadlockResult.rows[0]?.deadlocks || 0),
      longRunningQueries: longQueriesResult.rows.map(q => ({
        pid: q.pid,
        duration: q.duration,
        query: q.query?.substring(0, 200),
        state: q.state,
      })),
      config: configResult.rows,
    });
  } catch (error) {
    logger.error(`获取数据库详情失败: ${error.message}`);
    res.status(500).json({ error: '获取数据库详情失败' });
  }
});

// GET /api/admin/table-space — table space usage
router.get('/table-space', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT
        relname AS table_name,
        pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
        pg_total_relation_size(relid) AS total_bytes,
        pg_size_pretty(pg_relation_size(relid)) AS data_size,
        pg_relation_size(relid) AS data_bytes,
        pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) AS index_size,
        pg_total_relation_size(relid) - pg_relation_size(relid) AS index_bytes,
        n_live_tup AS row_count,
        n_dead_tup AS dead_rows,
        last_vacuum,
        last_autovacuum,
        last_analyze
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(relid) DESC
    `);

    const dbSizeResult = await pool.query(`SELECT pg_database_size(current_database()) AS size`);
    const dbSize = parseInt(dbSizeResult.rows[0].size);

    res.json({
      tables: result.rows,
      totalDatabaseSize: dbSize,
      totalDatabaseSizeFormatted: formatBytes(dbSize),
    });
  } catch (error) {
    logger.error(`获取表空间失败: ${error.message}`);
    res.status(500).json({ error: '获取表空间失败' });
  }
});

// GET /api/admin/logs — read logs with filtering
router.get('/logs', async (req, res) => {
  try {
    const { level, keyword, page = 1, pageSize = 100 } = req.query;
    const logDir = path.join(__dirname, '..', '..', '..', 'logs');

    // Determine which log file to read
    let logFile;
    switch (level) {
      case 'error': logFile = 'error.log'; break;
      case 'warn': case 'warning': logFile = 'warn.log'; break;
      default: logFile = 'combined.log'; break;
    }

    const logPath = path.join(logDir, logFile);
    if (!fs.existsSync(logPath)) {
      return res.json({ logs: [], total: 0, page: parseInt(page), pageSize: parseInt(pageSize) });
    }

    let content = fs.readFileSync(logPath, 'utf-8');
    let lines = content.split('\n').filter(line => line.trim());

    // Filter by keyword
    if (keyword) {
      const kw = keyword.toLowerCase();
      lines = lines.filter(line => line.toLowerCase().includes(kw));
    }

    // Parse log lines
    const parsed = lines.map(line => {
      const match = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[(\w+)\] (.+)$/);
      if (match) {
        return { timestamp: match[1], level: match[2].toLowerCase(), message: match[3] };
      }
      return { timestamp: '', level: level || 'info', message: line };
    });

    // Sort newest first
    parsed.reverse();

    // Pagination
    const total = parsed.length;
    const pg = Math.max(1, parseInt(page));
    const size = Math.min(500, Math.max(1, parseInt(pageSize)));
    const start = (pg - 1) * size;
    const paginated = parsed.slice(start, start + size);

    res.json({
      logs: paginated,
      total,
      page: pg,
      pageSize: size,
      totalPages: Math.ceil(total / size),
    });
  } catch (error) {
    logger.error(`读取日志失败: ${error.message}`);
    res.status(500).json({ error: '读取日志失败' });
  }
});
module.exports = router;
