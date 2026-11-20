// Phase 4 (Ticket-04, Contract v1.3): bench, soak, bảng xếp hạng, trợ năng, hồi quy headless không đổi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { benchStats, looksVsynced } from '../src/benchstats.js';
import { benchScenario, benchCamera, BENCH } from '../src/bench-scene.js';
import { validateEntry, insertEntry, addToFile, loadEntries, isoWithOffset, TOP_N } from '../src/leaderboard.js';
import { Game, EMPTY_INPUT } from '../src/sim.js';
import { createServer } from '../src/server.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl4-'));
const contract = JSON.parse(fs.readFileSync('game.contract.json', 'utf8'));
const near = (a, b, eps, msg = '') => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} !≈ ${b} (±${eps})`);

// ---------------- Contract v1.3 ----------------
test('R4-CONTRACT: v1.3 có bench_cmd và soak_cmd; số chuẩn v1.2 giữ nguyên', () => {
  assert.equal(contract.contract_version, '1.3');
  assert.equal(contract.bench_cmd, 'node src/bench.js');
  assert.equal(contract.soak_cmd, 'node src/soak.js');
  assert.equal(contract.tuning.fuel_decay_per_s, 1.0);
  assert.equal(contract.tuning.night1_duration_s, 240);
});

// ---------------- Bench: công thức ----------------
test('R4-BENCH-STATS: avg_fps, p1_low, p95 đúng công thức Ticket-04', () => {
  // 100 khung: 99 × 10 ms và 1 × 110 ms → Σ = 1100 ms
  const dts = [...Array(99).fill(10), 110];
  const s = benchStats(dts);
  near(s.avg_fps, (1000 * 100) / 1100, 1e-9, 'avg');
  assert.equal(s.frames, 100);
  near(s.p1_low_fps, 1000 / 110, 1e-9, 'k = ceil(0.01×100) = 1 → 1000 / 110');
  assert.equal(s.frame_ms_p95, 10, 'phân vị 95 (nearest-rank) = giá trị thứ 95 = 10');
  // 250 khung → k = ceil(2.5) = 3: lấy 3 dt lớn nhất
  const d2 = [...Array(247).fill(8), 20, 30, 40];
  near(benchStats(d2).p1_low_fps, 1000 / ((20 + 30 + 40) / 3), 1e-9, 'k=3');
  // k tối thiểu 1 khi N nhỏ
  near(benchStats([5, 7]).p1_low_fps, 1000 / 7, 1e-9, 'N=2 → k=1');
});

test('R4-BENCH-VSYNC: heuristic không báo "vsync tắt" khi khung đều đúng 60 Hz', () => {
  assert.equal(looksVsynced(Array(200).fill(1000 / 60)), true);
  assert.equal(looksVsynced(Array.from({ length: 200 }, (_, i) => 6 + (i % 7))), false);
});

// ---------------- Bench: cảnh chuẩn ----------------
test('R4-BENCH-SCENE: đúng 200 Bóng wander, 100 đom đóm, L1–L3 sáng fuel 100, Mây ở (0,0,0), tất định theo seed', () => {
  const sc = benchScenario(42);
  assert.equal(sc.shades.length, 200);
  assert.equal(sc.motes.length, 100);
  assert.ok(sc.shades.every((s) => s.state === 'wander' && Math.hypot(s.pos[0], s.pos[2]) <= BENCH.island_r + 1e-9));
  assert.deepEqual(benchScenario(42), sc);
  assert.notDeepEqual(benchScenario(43).shades[0], sc.shades[0]);
  const g = new Game({ tuning: contract.tuning, seed: 42, night: 1, scenario: sc, bench: true });
  assert.deepEqual([g.player.x, g.player.y, g.player.z], [0, 0, 0]);
  assert.deepEqual(g.lanterns.map((l) => [l.id, l.lit, l.fuel]), [['L1', true, 100], ['L2', true, 100], ['L3', true, 100], ['L4', false, 0], ['L5', false, 0]]);
  assert.equal(g.shades.length, 200);
  assert.equal(g.motes.length, 100);
});

test('R4-BENCH-SIM: sau 10 phút mô phỏng: không sinh thêm, không sát thương, không nhặt, không hao dầu, không kết thúc; Bóng vẫn di chuyển', () => {
  const g = new Game({ tuning: contract.tuning, seed: 42, night: 1, scenario: benchScenario(42), bench: true });
  const before = g.shades.map((s) => [s.x, s.z]);
  const inp = EMPTY_INPUT();
  for (let i = 0; i < 36000; i++) g.step(inp);
  assert.equal(g.state, 'playing', 'không kết thúc Đêm dù quá thời lượng');
  assert.equal(g.player.flames, 3);
  assert.equal(g.shades.length, 200);
  assert.equal(g.motes.length, 100);
  assert.equal(g.drifters.length, 0);
  assert.ok(g.lanterns.slice(0, 3).every((l) => l.lit && l.fuel === 100), 'không hao dầu');
  assert.ok(g.shades.every((s) => s.state === 'wander'), 'vẫn wander (không đuổi Mây)');
  const moved = g.shades.filter((s, i) => Math.hypot(s.x - before[i][0], s.z - before[i][1]) > 1).length;
  assert.ok(moved > 100, `đa số Bóng phải di chuyển, chỉ ${moved}`);
});

test('R4-BENCH-OFF: chế độ thường không đổi — Bóng ở 5 m vẫn đuổi và gây sát thương', () => {
  const sc = { random_motes: false, random_shades: false, random_drifters: false, shades: [{ pos: [5, 0, 0] }] };
  const g = new Game({ tuning: contract.tuning, seed: 1, night: 1, scenario: sc });
  for (let i = 0; i < 300 && g.player.flames === 3; i++) g.step(EMPTY_INPUT());
  assert.ok(g.player.flames < 3, 'không bench: Bóng chạm Mây');
});

test('R4-BENCH-CAM: camera bay vòng tâm (0,0,0), R=30, Y=15, từ (30,15,0), 15 s/vòng, ngược chiều kim đồng hồ khi nhìn từ trên', () => {
  const eq = (a, b) => a.forEach((v, i) => near(v, b[i], 1e-9));
  eq(benchCamera(0), [30, 15, 0]);
  eq(benchCamera(15), [30, 15, 0]);
  eq(benchCamera(3.75), [0, 15, -30]); // 1/4 vòng: nhìn từ +Y xuống (+Z xuống màn hình) đi từ phải lên trên = ngược chiều kim đồng hồ
  eq(benchCamera(7.5), [-30, 15, 0]);
  for (const t of [0.3, 2.2, 9.9]) { const [x, y, z] = benchCamera(t); near(Math.hypot(x, z), 30, 1e-9); assert.equal(y, 15); }
});

// ---------------- Soak ----------------
test('R4-SOAK: 3 Đêm xoay vòng, đủ trường, crashes=0, mem trong ngưỡng, tất định kết quả', () => {
  const run = (out) => {
    const r = spawnSync('node', ['src/soak.js', '--seed', '7', '--nights', '4', '--out', out], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return JSON.parse(fs.readFileSync(out, 'utf8'));
  };
  const a = run(path.join(tmp, 'soak1.json')), b = run(path.join(tmp, 'soak2.json'));
  assert.deepEqual(Object.keys(a), ['nights', 'crashes', 'results', 'mem_start_mb', 'mem_end_mb', 'duration_s']);
  assert.equal(a.nights, 4);
  assert.equal(a.crashes, 0);
  assert.equal(a.results.length, 4);
  assert.ok(a.results.every((x) => x === 'won' || x === 'lost'));
  assert.ok(a.mem_end_mb <= 1.2 * a.mem_start_mb, `${a.mem_end_mb} > 1.2 × ${a.mem_start_mb}`);
  assert.deepEqual(a.results, b.results);
});

test('R4-SOAK-ARGS: thiếu --out → mã thoát ≠ 0', () => {
  assert.notEqual(spawnSync('node', ['src/soak.js', '--seed', '7', '--nights', '2']).status, 0);
});

// ---------------- Bảng xếp hạng ----------------
const E = (name, score, at, extra = {}) => ({ name, score, nights_won: 1, achieved_at: at, seed: 1, ...extra });

test('R4-LB-NAME: tên 3–12 ký tự [A-Za-z0-9_], có dấu được chấp nhận, sai thì từ chối', () => {
  const ok = (name) => validateEntry({ name, score: 0, nights_won: 0, seed: 1 }).name;
  assert.equal(ok('abc'), 'abc');
  assert.equal(ok('A_b_9_xyz012'), 'A_b_9_xyz012');
  assert.equal(ok('Nguyễn_Anh'), 'Nguyễn_Anh');
  for (const bad of ['ab', 'abcdefghijklm', 'có khoảng', 'a-b-c', 'a.b.c', '', 'x'.repeat(13), '<b>abc</b>']) {
    assert.throws(() => ok(bad), /Tên/, bad);
  }
  assert.throws(() => validateEntry({ name: 'abc', score: -1, nights_won: 0, seed: 1 }));
  assert.throws(() => validateEntry({ name: 'abc', score: 1.5, nights_won: 0, seed: 1 }));
  assert.throws(() => validateEntry({ name: 'abc', score: 1, nights_won: 4, seed: 1 }));
});

test('R4-LB-SORT: điểm giảm dần; bằng điểm thì ai đạt trước đứng trên; giữ top 10', () => {
  let list = [];
  list = insertEntry(list, E('Late', 100, '2026-01-01T10:00:00+07:00'));
  list = insertEntry(list, E('Early', 100, '2026-01-01T09:00:00+07:00'));
  list = insertEntry(list, E('Best', 500, '2026-01-01T12:00:00+07:00'));
  assert.deepEqual(list.map((e) => e.name), ['Best', 'Early', 'Late']);
  for (let i = 0; i < 12; i++) list = insertEntry(list, E(`P${String(i).padStart(2, '0')}`, i * 10, `2026-02-01T00:00:${String(i).padStart(2, '0')}+07:00`));
  assert.equal(list.length, TOP_N);
  assert.equal(list[0].name, 'Best');
  assert.ok(list.every((e, i) => i === 0 || list[i - 1].score >= e.score));
  assert.ok(!list.some((e) => e.score === 0), 'mục điểm thấp nhất bị loại');
  // cùng điểm, người mới không vượt người cũ khi bảng đầy
  const full = insertEntry(list, E('Newcomer', list.at(-1).score, '2030-01-01T00:00:00+07:00'));
  assert.ok(!full.some((e) => e.name === 'Newcomer'), 'bằng điểm hạng chót: người đến sau không chen vào');
});

test('R4-LB-DISK: lưu đĩa, còn sau khi "mở lại" (đọc lại file), achieved_at ISO 8601 có múi giờ', () => {
  const f = path.join(tmp, 'lb', 'leaderboard.json');
  addToFile(f, { name: 'Mây_Nhỏ', score: 640, nights_won: 3, seed: 7 });
  addToFile(f, { name: 'Bong_Muc', score: 120, nights_won: 1, seed: 8 });
  const back = loadEntries(f); // tiến trình khác sẽ đọc đúng file này
  assert.deepEqual(back.map((e) => e.name), ['Mây_Nhỏ', 'Bong_Muc']);
  assert.deepEqual(Object.keys(back[0]), ['name', 'score', 'nights_won', 'achieved_at', 'seed']);
  assert.match(back[0].achieved_at, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(Z|[+-]\d\d:\d\d)$/);
  assert.match(isoWithOffset(new Date(2026, 10, 20, 21, 5, 9)), /^2026-11-20T21:05:09[+-]\d\d:\d\d$/);
  assert.throws(() => addToFile(f, { name: 'x', score: 1, nights_won: 0, seed: 1 }));
  assert.equal(loadEntries(f).length, 2, 'mục sai không được ghi');
});

test('R4-LB-EXPORT: <run_cmd> --export-leaderboard out.json cho {"entries":[…]} đúng thứ tự (3 cách gọi)', () => {
  const lb = path.join(tmp, 'exp-lb.json');
  fs.writeFileSync(lb, JSON.stringify({ entries: [E('Hai', 50, '2026-01-01T00:00:00+07:00'), E('Mot', 90, '2026-01-02T00:00:00+07:00')] }));
  const env = { ...process.env, DDL_LEADERBOARD: lb };
  const want = [{ name: 'Mot' }, { name: 'Hai' }]; // file cố tình lộn thứ tự: export phải sắp lại theo điểm
  const cmds = [['node', ['src/server.js', '--export-leaderboard']], ['npm', ['start', '--silent', '--', '--export-leaderboard']], ['npm', ['start', '--silent', '--export-leaderboard']]];
  cmds.forEach(([bin, args], i) => {
    const out = path.join(tmp, `exp${i}.json`);
    const r = spawnSync(bin, [...args, out], { env, encoding: 'utf8', shell: process.platform === 'win32' });
    assert.equal(r.status, 0, `${bin} ${args.join(' ')}: ${r.stderr}`);
    const j = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.deepEqual(j.entries.map((e) => e.name), want.map((w) => w.name));
    assert.deepEqual(Object.keys(j), ['entries']);
  });
});

test('R4-LB-API: POST /api/leaderboard lưu + sắp xếp, tên sai → 400, GET trả bảng', async () => {
  const f = path.join(tmp, 'api-lb.json');
  const srv = createServer({ file: f });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  try {
    const post = (b) => fetch(`${base}/api/leaderboard`, { method: 'POST', body: JSON.stringify(b) });
    assert.equal((await post({ name: 'Alpha', score: 10, nights_won: 0, seed: 1 })).status, 200);
    assert.equal((await post({ name: 'Beta', score: 300, nights_won: 2, seed: 2 })).status, 200);
    const bad = await post({ name: 'x!', score: 10, nights_won: 0, seed: 1 });
    assert.equal(bad.status, 400);
    const { entries } = await (await fetch(`${base}/api/leaderboard`)).json();
    assert.deepEqual(entries.map((e) => e.name), ['Beta', 'Alpha']);
    assert.equal((await fetch(`${base}/`)).status, 200);
  } finally { srv.close(); }
});

// ---------------- Trợ năng (client: kiểm tra tĩnh các cam kết có trong mã) ----------------
test('R4-A11Y: client có đổi phím + trùng phím + mặc định + lưu, phụ đề, giảm chuyển động, chữ lớn, cỡ chữ ≥ 18 px', () => {
  const js = fs.readFileSync('web/main.js', 'utf8'), html = fs.readFileSync('web/index.html', 'utf8');
  for (const a of ['up', 'down', 'left', 'right', 'jump', 'interact', 'pulse', 'dash', 'pause']) assert.match(js, new RegExp(`DEFAULT_KEYS = \\{[^}]*\\b${a}:`), a);
  assert.match(js, /Trùng phím/);
  assert.match(js, /Khôi phục mặc định/);
  assert.match(js, /localStorage\.setItem\('ddl\.settings'/);
  for (const t of ['Bóng Mực xuất hiện', 'Gió sắp thổi', '10 giây cuối', 'sắp cạn dầu']) assert.ok(js.includes(t), t);
  assert.match(js, /reducedMotion/);
  assert.match(js, /body\.big\s*\{\s*--ui:\s*1\.25/.test(html) ? /./ : /body\.big/);
  assert.match(html, /body\.big \{ --ui: 1\.25; \}/);
  const sizes = [...html.matchAll(/font-size:\s*(?:calc\()?(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
  assert.ok(sizes.length > 10);
  assert.ok(sizes.every((s) => s >= 18), `có cỡ chữ < 18 px: ${sizes.filter((s) => s < 18)}`);
});

// ---------------- Hồi quy: headless không đổi ----------------
// Băm SHA-256 (16 hex đầu) của đầu ra headless 4000 tick, tính từ mã tag phase-3 (trước khi thêm chế độ bench).
// Nếu Phase 4 lỡ đổi hành vi mô phỏng, các băm này đổi và test đỏ.
const GOLDEN = { '1/1': '009a3e9ef02293a4', '1/5': '54aa1fd651da63e2', '2/1': 'f04ad8c31720f15e', '2/5': '473cfcc760a01cd1', '3/1': '31749b6231ddd4a8', '3/5': '8c47b78a226d0839' };
for (const [k, want] of Object.entries(GOLDEN)) {
  test(`R4-HEADLESS: Đêm ${k.split('/')[0]} seed ${k.split('/')[1]} — đầu ra giống hệt Phase 3`, async () => {
    const { createHash } = await import('node:crypto');
    const [night, seed] = k.split('/');
    const out = path.join(tmp, `g${night}${seed}.jsonl`);
    const r = spawnSync('node', ['src/headless.js', '--seed', seed, '--night', night, '--ticks', '4000', '--out', out]);
    assert.equal(r.status, 0);
    assert.equal(createHash('sha256').update(fs.readFileSync(out)).digest('hex').slice(0, 16), want);
  });
}
