// Hook Stop của Claude Code: không cho kết thúc lượt khi test đang đỏ (Ticket-04 / harness).
// Exit 2 + stderr => agent nhận lại thông báo và phải sửa. Có chốt chống vòng lặp (stop_hook_active).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

let input = {};
try { input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { /* không có stdin */ }
if (input.stop_hook_active) process.exit(0);
const r = spawnSync('node', ['--test', 'tests/headless.test.js', 'tests/phase4.test.js'], { encoding: 'utf8' });
if (r.status === 0) process.exit(0);
const fails = (r.stdout || '').split('\n').filter((l) => l.startsWith('✖') || /^\s*not ok/.test(l)).slice(0, 10).join('\n');
process.stderr.write(`npm test ĐỎ — sửa trước khi kết thúc.\n${fails || (r.stderr || r.stdout || '').slice(-1500)}\n`);
process.exit(2);
