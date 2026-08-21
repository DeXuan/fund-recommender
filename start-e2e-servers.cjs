/* eslint-disable no-undef, no-unused-vars, no-empty */
const { spawn } = require('child_process');

const backend = spawn('node', ['server/index.cjs'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env },
});

backend.stdout.on('data', (data) => {
  const line = data.toString().trim();
  if (line.includes('3303') || line.includes('数据库') || line.includes('ERROR')) {
    console.log('[backend]', line);
  }
});

backend.stderr.on('data', (data) => {
  console.error('[backend-err]', data.toString().trim());
});

process.on('exit', () => {
  try { backend.kill('SIGTERM'); } catch (_e) {}
});

const vite = spawn('npx', ['vite', '--port', '8866'], {
  stdio: 'inherit',
  shell: true,
});

vite.on('close', (code) => {
  try { backend.kill('SIGTERM'); } catch (_e) {}
  process.exit(code || 0);
});
