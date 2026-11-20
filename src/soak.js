#!/usr/bin/env node
// Soak test (Ticket-04 §2): node src/soak.js --seed 7 --nights 10 --out soak.json
// Chạy headless N Đêm liên tiếp trong MỘT tiến trình (Đêm 1→2→3 xoay vòng), Đêm i dùng seed S+i.
import fs from 'node:fs';
import path from 'node:path';
import v8 from 'node:v8';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { Game, EMPTY_INPUT, mulberry32, TPS } from './sim.js';

const a = {};
for (let i = 2; i < process.argv.length; i += 2) {
  if (!process.argv[i].startsWith('--') || process.argv[i + 1] === undefined) { console.error(`tham số sai: ${process.argv[i]}`); process.exit(1); }
  a[process.argv[i].slice(2)] = process.argv[i + 1];
}
for (const k of ['seed', 'nights', 'out']) if (a[k] === undefined) { console.error(`thiếu --${k}`); process.exit(1); }
const seed = Number(a.seed), nights = Number(a.nights);
if (!Number.isInteger(seed) || !Number.isInteger(nights) || nights < 1) { console.error('--seed/--nights phải là số nguyên hợp lệ (nights ≥ 1)'); process.exit(1); }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contract = JSON.parse(fs.readFileSync(path.join(root, 'game.contract.json'), 'utf8'));

v8.setFlagsFromString('--expose-gc');
const gc = vm.runInNewContext('gc'); // để RSS đo được không dính rác chưa thu gom
const rssMb = () => { gc(); gc(); return process.memoryUsage().rss / 1048576; };
const round1 = (x) => Math.round(x * 10) / 10;

// Input ngẫu nhiên theo seed (RNG riêng, không đụng game.rng): mỗi 30 tick chọn lại hướng;
// mỗi tick: nhảy 5 %, lướt 3 %, tỏa sáng 2 %, tương tác 10 %.
function runNight(i, onLoaded, warmNight = 0) {
  const night = warmNight || ((i - 1) % 3) + 1;
  const g = new Game({ tuning: contract.tuning, seed: seed + i, night });
  onLoaded?.();
  const rng = mulberry32((seed + i) ^ 0x9e3779b9);
  const input = EMPTY_INPUT();
  while (g.state === 'playing') {
    if (g.tick % 30 === 0) {
      const ang = rng() * 2 * Math.PI;
      input.move = [Math.cos(ang), Math.sin(ang)];
      input.cam_yaw_deg = 0;
    }
    input.jump = rng() < 0.05; input.dash = rng() < 0.03; input.pulse = rng() < 0.02; input.interact = rng() < 0.10;
    g.step(input);
  }
  return g;
}

// Tải = nạp module + dựng Đêm 1 + khởi động JIT bằng ba Đêm nháp (Đêm 1–3, seed riêng, không tính kết quả),
// để mem_start phản ánh trạng thái ổn định chứ không phải bộ nhớ trước khi mã được biên dịch.
for (const n of [1, 2, 3]) runNight(-1000 - n, undefined, n);
const t0 = performance.now();
let crashes = 0, memStart = null, memEnd = null;
const results = [];
for (let i = 1; i <= nights; i++) {
  try {
    const g = runNight(i, i === 1 ? () => { memStart = rssMb(); } : undefined); // memStart: ngay sau khi tải xong Đêm đầu
    results.push(g.state);
  } catch (e) {
    crashes++; results.push('crashed');
    console.error(`Đêm ${i} lỗi: ${e.stack || e}`);
  }
}
memEnd = rssMb(); // sau khi reset xong Đêm cuối (đối tượng Game đã được bỏ)
const out = { nights, crashes, results, mem_start_mb: round1(memStart), mem_end_mb: round1(memEnd), duration_s: round1((performance.now() - t0) / 1000) };
fs.writeFileSync(a.out, JSON.stringify(out) + '\n');
console.log(JSON.stringify(out));
process.exit(0);
