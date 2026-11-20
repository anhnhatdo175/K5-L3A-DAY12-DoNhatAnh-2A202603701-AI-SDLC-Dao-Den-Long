import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-'));
const contract = JSON.parse(fs.readFileSync('game.contract.json', 'utf8'));
const T = contract.tuning;
const S = (n) => path.join('scenarios', `${n}.json`);

function run({ night = 1, seed = 1, ticks, every = 10, scenario, inputs, out = 'o.jsonl' }) {
  const o = path.join(tmp, out);
  fs.rmSync(o, { force: true });
  const args = ['src/headless.js', '--seed', String(seed), '--night', String(night), '--ticks', String(ticks), '--snapshot-every', String(every), '--out', o];
  if (scenario) args.push('--scenario', S(scenario));
  if (inputs) args.push('--inputs', S(inputs));
  const r = spawnSync('node', args, { encoding: 'utf8' });
  const lines = fs.existsSync(o) ? fs.readFileSync(o, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
  const snaps = lines.filter((l) => l.type === 'snapshot');
  return {
    r, lines, out: o, snaps, ev: lines.filter((l) => l.type === 'event'), end: lines.at(-1),
    at: (tick) => snaps.find((s) => s.tick === tick),
    ofs: (name) => lines.filter((l) => l.type === 'event' && l.name === name),
  };
}
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} !≈ ${b} (±${eps})`);
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

// =========================== Contract / hồi quy Phase 1-2 ===========================

test('contract v1.3 khớp số chuẩn (Phase 4 chỉ nâng version + bench_cmd/soak_cmd, số chuẩn giữ nguyên)', () => {
  assert.equal(contract.contract_version, '1.3');
  const want = {
    player_speed: 6, carry_capacity: 10, capacity_max: 20, lantern_cost: 10, relight_cost: 5,
    pickup_radius: 1, interact_radius: 2, pulse_cost: 3, pulse_radius: 5,
    pulse_cooldown_s: 3, safe_radius: 6, shade_speed: 4, shade_hit_radius: 1, flames: 3,
    invuln_s: 1.5, pulse_stun_s: 2, pulse_push_m: 4,
    night1_duration_s: 240, night2_duration_s: 270, night3_duration_s: 300,
    dash_speed: 14, dash_duration_s: 0.2, dash_cooldown_s: 1.5, hit_drop_ratio: 0.5,
    fuel_max: 100, fuel_decay_per_s: 1.0, fuel_per_mote: 10, drain_per_s: 5, low_fuel_threshold: 30, win_ratio: 0.6,
  };
  for (const [k, v] of Object.entries(want)) assert.equal(T[k], v, k);
  assert.deepEqual(T.score, { per_mote: 5, per_lantern: 100, relight: 40, per_stun: 5, per_stun_drain: 15, per_lit_lantern: 50, per_flame_left: 50 });
});

test('cấu trúc: snapshot 0, end cuối, đúng số bước, trường v1.2', () => {
  const { r, snaps, end } = run({ ticks: 100 });
  assert.equal(r.status, 0);
  assert.equal(snaps.length, 11);
  const s0 = snaps[0];
  assert.equal(s0.tick, 0); assert.equal(s0.night, 1);
  assert.equal(s0.time_left_s, 240);
  assert.deepEqual(s0.player.pos, [0, 0, 0]);
  for (const k of ['vel', 'grounded', 'invuln', 'dash_cd_s', 'pulse_cd_s', 'charm_s', 'capacity']) assert.ok(k in s0.player, k);
  assert.equal(s0.player.capacity, 10);
  assert.deepEqual(Object.keys(s0.wind).slice(0, 2), ['active', 'dir_deg']);
  for (const k of ['motes', 'drifters', 'charms']) assert.ok(Array.isArray(s0[k]), k);
  assert.deepEqual(s0.lanterns.map((l) => l.pos), [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]]);
  for (const l of s0.lanterns) {
    assert.equal(l.fuel, 0);
    assert.equal(l.ever_lit, false);
    assert.equal(l.relit_count, 0);
  }
  assert.deepEqual(end, { type: 'end', ticks: 100, state: 'playing', score: 0 });
  assert.equal(snaps.at(-1).time_left_s, Math.round((240 - 100 / 60) * 1000) / 1000);
});

test('tất định: cùng seed/scenario/inputs → output giống hệt; khác seed → khác', () => {
  for (const night of [1, 2, 3]) {
    const a = run({ night, seed: 7, ticks: 3000, out: 'a.jsonl' });
    const b = run({ night, seed: 7, ticks: 3000, out: 'b.jsonl' });
    assert.equal(fs.readFileSync(a.out, 'utf8'), fs.readFileSync(b.out, 'utf8'), `night ${night}`);
    const c = run({ night, seed: 8, ticks: 3000, out: 'c.jsonl' });
    assert.notEqual(fs.readFileSync(a.out, 'utf8'), fs.readFileSync(c.out, 'utf8'));
  }
});

test('Phase 1 — nhặt đom đóm: nhặt trong 1.0 m, chưa có điểm (điểm tính lúc nạp)', () => {
  const { ofs, end, at } = run({ ticks: 120, scenario: 'pickup', inputs: 'pickup.inputs' });
  const picks = ofs('mote_picked');
  assert.equal(picks.length, 1);
  assert.deepEqual(picks[0].data, { carried: 1 });
  assert.equal(picks[0].tick, 40); // 6 m/s: còn cách 1.0 m sau 4 m = 40 bước
  assert.equal(end.score, 0);
  assert.equal(at(120).player.carried, 1);
});

// Ticket-03 [THAY THẾ]: Thắp đủ đèn không còn thắng sớm (không kết thúc Đêm). Đêm tiếp tục đến bình minh.
// Ở tick 6, nạp đủ 10 đom đóm vào L1 phát sự kiện deposit và lantern_lit { relight: false }, không phát game_over.
test('Phase 1 — nạp đèn (không thắng sớm theo luật Phase 3), điểm chuẩn hóa', () => {
  const { ev, end } = run({ ticks: 600, scenario: 'deposit_win', inputs: 'deposit_win.inputs' });
  assert.deepEqual(ev.map((e) => e.name), ['night_start', 'deposit', 'lantern_lit']);
  assert.deepEqual(ev[1].data, { lantern_id: 'L1', amount: 10, deposited: 10 });
  assert.deepEqual(ev[2].data, { lantern_id: 'L1', relight: false });
  assert.equal(ev[1].tick, 6);
  assert.equal(end.state, 'playing');
  assert.equal(end.ticks, 600);
  assert.equal(end.score, 10 * 5 + 100);
});

// Ticket-03 [THAY THẾ]: all_lit không còn dùng, kết thúc hết giờ đạt ngưỡng đèn là dawn_survived.
test('Phase 1 — thắng đúng tick hết giờ (thắng ưu tiên hơn dawn, reason dawn_survived)', () => {
  const { ofs, end } = run({ ticks: 100, scenario: 'lastsecond', inputs: 'lastsecond.inputs' });
  assert.deepEqual(ofs('game_over')[0].data, { result: 'won', reason: 'dawn_survived' });
  // Điểm: nạp 10*5 = 50, thắp +100.
  // Thưởng bình minh: L1 vừa thắp: 50 + floor(100) = 150.
  // L2..L5 đã sáng từ đầu (sau 6 tick: fuel 99.9 -> floor 99): 4 * (50 + 99) = 596.
  // 3 ngọn lửa: 3 * 50 = 150. Tổng: 50 + 100 + 150 + 596 + 150 = 1046.
  assert.equal(end.score, 50 + 100 + 150 + 596 + 150);
});

test('Phase 1 — tỏa sáng: chốt mục tiêu 3D, choáng 120 tick, đẩy 4 m/15 tick, hồi 3 s', () => {
  const r = run({ ticks: 260, every: 1, scenario: 'pulse', inputs: 'pulse.inputs' });
  const p = r.ofs('pulse');
  assert.deepEqual(p[0].data, { stunned_ids: ['S1'] });
  assert.equal(p[0].tick, 1);
  assert.equal(r.at(1).player.carried, 1);
  assert.equal(r.at(1).player.pulse_cd_s, 3);
  const s1 = (t) => r.at(t).shades.find((s) => s.id === 'S1');
  assert.equal(s1(1).state, 'stunned');
  near(s1(1).pos[0], 4 + 4 / 15, 0.002, 'tick 1');
  near(s1(15).pos[0], 8, 0.002, 'đẩy tổng 4 m');
  assert.equal(s1(16).pos[0], s1(15).pos[0]); // dừng đẩy sau 15 tick
  assert.equal(s1(120).state, 'stunned');
  assert.notEqual(s1(121).state, 'stunned'); // choáng đúng 120 tick
  // lần bấm tại k=30 thiếu đom đóm(1<3) → không event; chỉ 1 sự kiện pulse
  assert.equal(p.length, 1);
  assert.equal(r.end.score, 5);
});

test('Phase 1 — tỏa sáng bị chặn bởi hồi chiêu và bởi thiếu đom đóm', () => {
  const r = run({ ticks: 300, scenario: 'pulse', inputs: 'pulse.inputs' });
  assert.equal(r.ofs('pulse').length, 1);
  assert.equal(r.at(300).player.carried, 1);
});

test('Phase 1 — bị chạm: −1 lửa, rơi floor(mang/2), bất tử 90 tick, recoil 2 m/60 tick', () => {
  const r = run({ ticks: 300, every: 1, scenario: 'hit' });
  const hits = r.ofs('player_hit');
  assert.equal(hits[0].tick, 1);
  assert.deepEqual(hits[0].data, { by: 'shade', flames: 2, dropped: 2 });
  const s = (t) => r.at(t);
  assert.equal(s(1).player.carried, 3);
  assert.equal(s(30).player.carried, 3, 'đom đóm rơi không nhặt lại được ngay');
  assert.equal(s(30).motes_active, 2);
  assert.ok(s(30).motes.every((m) => m.kind === 'dropped' && m.ttl_s > 0));
  for (const m of s(1).motes) { const d = dist2(m.pos, s(1).player.pos); assert.ok(d >= 1.5 - 1e-3 && d <= 2.5 + 1e-3, `vành 1.5–2.5: ${d}`); }
  assert.equal(s(1).player.invuln, true);
  assert.equal(s(90).player.invuln, true);
  assert.equal(s(1).shades[0].state, 'recoil');
  assert.equal(s(60).shades[0].state, 'recoil');
  assert.equal(s(61).shades[0].state, 'chase', 'hết recoil sau 60 tick');
  near(dist2(s(60).shades[0].pos, s(60).player.pos), 1 - 4 / 60 + 2, 0.1, 'lùi 2 m');
  assert.equal(s(90).flames ?? s(90).player.flames, 2, 'bóng chạm lúc bất tử không làm gì');
  assert.equal(hits[1].tick, 91, 'bất tử 90 tick rồi bị chạm lại');
});

test('Phase 1 — vùng an toàn quanh đèn sáng: Bóng Mực bị chặn ở mép 6 m', () => {
  const { snaps } = run({ ticks: 600, every: 1, scenario: 'safe' });
  for (const s of snaps) assert.ok(dist2(s.shades[0].pos, [0, 0, 25]) >= 6 - 0.002, `tick ${s.tick}`);
  assert.ok(dist2(snaps.at(-1).shades[0].pos, [0, 0, 25]) < 6.05, 'bóng áp sát mép');
});

test('Phase 1 — bóng trong vùng đèn vừa sáng bị đẩy ra ≤30 tick, không gây sát thương', () => {
  const { snaps, ofs } = run({ ticks: 200, every: 1, scenario: 'eject' });
  assert.ok(dist2(snaps[30].shades[0].pos, [0, 0, 25]) >= 6 - 0.002);
  assert.equal(ofs('player_hit').length, 0);
  assert.ok(snaps.every((s) => s.player.flames === 3));
});

test('Phase 1 — rơi khỏi đảo: đúng 1 lần, mất hết đom đóm, chờ 60 tick rồi hồi sinh bất tử', () => {
  const r = run({ ticks: 900, every: 1, scenario: 'fall', inputs: 'fall.inputs' });
  const falls = r.ofs('player_hit').filter((e) => e.data.by === 'fall');
  assert.ok(falls.length >= 1);
  const f = falls[0];
  assert.deepEqual(f.data, { by: 'fall', flames: 2, dropped: 0, lost: 4 });
  assert.ok(r.at(f.tick).player.pos[1] < -10);
  assert.equal(r.at(f.tick).player.carried, 0);
  assert.equal(r.at(f.tick + 59).player.pos[1] < -10, true); // vẫn đứng chờ
  const back = r.at(f.tick + 60);
  assert.deepEqual(back.player.pos, [0, 0, 0]);
  assert.deepEqual(back.player.vel, [0, 0, 0]);
  assert.equal(back.player.invuln, true);
});

test('Phase 1 — thua: dawn và no_flames', () => {
  const a = run({ ticks: 2000, scenario: 'hit' });
  assert.deepEqual(a.ofs('game_over')[0].data, { result: 'lost', reason: 'no_flames' });
  assert.equal(a.end.state, 'lost');
  assert.equal(a.end.ticks, 181); // 3 lần chạm cách nhau 90 tick
  assert.equal(a.end.score, 0, 'thua không có điểm thưởng');
  const b = run({ ticks: 2000, scenario: 'dawn' });
  assert.deepEqual(b.ofs('game_over')[0].data, { result: 'lost', reason: 'dawn' });
  assert.equal(b.end.ticks, 120);
  assert.equal(b.end.score, 0);
});

test('Phase 1 — tie-break đèn: bằng khoảng cách thì id nhỏ hơn', () => {
  const { ofs } = run({ ticks: 5, scenario: 'tie', inputs: 'tie.inputs' });
  assert.equal(ofs('deposit')[0].data.lantern_id, 'L1');
});

test('Phase 1 — dựng scenario không phát sự kiện (trừ night_start ở bước đầu), không cộng điểm', () => {
  const { ev, snaps } = run({ ticks: 0, scenario: 'deposit_win' });
  assert.equal(ev.length, 0);
  assert.equal(snaps[0].score, 0);
  assert.equal(snaps[0].lanterns.filter((l) => l.lit).length, 4);
});

test('Phase 1 — file sai định dạng → exit 2', () => {
  const badJson = path.join(tmp, 'bad.json'); fs.writeFileSync(badJson, '{oops');
  const dup = path.join(tmp, 'dup.json'); fs.writeFileSync(dup, JSON.stringify({ frames: [{ tick: 1 }, { tick: 1 }] }));
  const badMove = path.join(tmp, 'mv.json'); fs.writeFileSync(badMove, JSON.stringify({ frames: [{ tick: 0, move: [2, 0] }] }));
  const badState = path.join(tmp, 'st.json'); fs.writeFileSync(badState, JSON.stringify({ shades: [{ pos: [0, 0, 0], state: 'dancing' }] }));
  const badPause = path.join(tmp, 'ps.json'); fs.writeFileSync(badPause, JSON.stringify({ frames: [{ tick: 0, pause: 1 }] }));
  for (const [flag, f] of [['--inputs', badJson], ['--scenario', badJson], ['--inputs', dup], ['--inputs', badMove], ['--scenario', badState], ['--inputs', badPause]]) {
    const r = spawnSync('node', ['src/headless.js', '--seed', '1', '--night', '1', '--ticks', '10', flag, f, '--out', path.join(tmp, 'x.jsonl')], { encoding: 'utf8' });
    assert.equal(r.status, 2, `${flag} ${f}`);
  }
});

test('--night chỉ nhận 1, 2, 3', () => {
  const r = spawnSync('node', ['src/headless.js', '--seed', '1', '--night', '4', '--ticks', '1', '--out', path.join(tmp, 'x.jsonl')], { encoding: 'utf8' });
  assert.notEqual(r.status, 0);
  for (const n of [1, 2, 3]) assert.equal(run({ night: n, ticks: 1 }).r.status, 0);
});

// =========================== Ticket-02: số liệu chuẩn ===========================

test('Lướt: 14 m/s × 12 tick, hồi 90 tick tính từ lúc bắt đầu, bấm khi đang hồi bị bỏ qua', () => {
  const r = run({ ticks: 200, every: 1, scenario: 'dawn', inputs: 'dash.inputs' });
  const d = r.ofs('dash');
  assert.deepEqual(d.map((e) => e.tick), [1, 92]);
  assert.deepEqual(d[0].data, {});
  assert.equal(r.at(1).player.dash_cd_s, 1.5);
  near(r.at(1).player.vel[2], 14, 1e-9);
  near(r.at(12).player.pos[2], 12 * 14 / 60, 0.003, 'đi 2.8 m trong 12 tick');
  near(r.at(13).player.vel[2], 6, 1e-9, 'hết lướt về tốc độ chạy');
  assert.equal(r.at(90).player.dash_cd_s, 0.017, 'còn 1 tick hồi chiêu');
  assert.equal(r.at(91).player.dash_cd_s, 0);
});

test('Lướt khi đứng yên theo hướng đang quay mặt (+Z lúc đầu); trên không giữ nguyên độ cao', () => {
  const r = run({ ticks: 40, every: 1, scenario: 'dawn', inputs: 'dash_air.inputs' });
  const y = (t) => r.at(t).player.pos[1];
  assert.ok(y(10) > 0.5, 'đang nhảy');
  for (let t = 11; t <= 22; t++) near(y(t), y(11), 1e-9, `tick ${t}`);
  assert.ok(y(30) < y(22), 'sau lướt lại rơi');
});

test('Nhảy: 7 m/s, trọng lực −20; chỉ nhảy khi chạm đất', () => {
  const f = path.join(tmp, 'jump.json');
  fs.writeFileSync(f, JSON.stringify({ frames: [{ tick: 0, jump: true }, { tick: 1, jump: false }, { tick: 5, jump: true }, { tick: 6, jump: false }] }));
  const o = path.join(tmp, 'j.jsonl');
  spawnSync('node', ['src/headless.js', '--seed', '1', '--night', '1', '--ticks', '120', '--snapshot-every', '1', '--scenario', S('dawn'), '--inputs', f, '--out', o]);
  const snaps = fs.readFileSync(o, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((l) => l.type === 'snapshot');
  const ymax = Math.max(...snaps.map((s) => s.player.pos[1]));
  near(ymax, 49 / 40, 0.07, 'đỉnh nhảy v²/2g (tích phân rời rạc 60 Hz)');
  assert.equal(snaps[1].player.grounded, false);
  assert.equal(snaps[119].player.grounded, true);
  assert.equal(snaps[119].player.pos[1], 0);
});

test('Bùa Gió: nhặt, 7.2 m/s, hồi 2700 tick, lướt không hồi chiêu, hết hạn sau 600 tick', () => {
  const r = run({ night: 2, ticks: 200, every: 1, scenario: 'charm', inputs: 'charm.inputs' });
  const c = r.ofs('charm_picked');
  assert.equal(c.length, 1);
  assert.deepEqual(c[0].data, { charm_id: 'C1', charm_ticks: 600 });
  assert.equal(c[0].tick, 1);
  assert.equal(r.at(1).player.charm_s, 10);
  assert.deepEqual([r.at(1).charms[0].available, r.at(1).charms[0].respawn_s], [false, 45]);
  near(r.at(10).player.vel[2], 7.2, 1e-9);
  const d = run({ night: 2, ticks: 60, every: 1, scenario: 'charm', inputs: 'charm_dash.inputs' }).ofs('dash');
  assert.deepEqual(d.map((e) => e.tick), [3, 21], 'dash lại không cần hồi chiêu');
  const e = run({ ticks: 20, every: 1, scenario: 'charm_expire', inputs: 'charm.inputs' });
  near(e.at(3).player.vel[2], 7.2, 1e-9);
  near(e.at(6).player.vel[2], 6, 1e-9, 'hết bùa');
});

test('Bùa Gió: hồi sinh sau 2700 tick và nhặt lại làm mới hiệu lực', () => {
  const r = run({ night: 2, ticks: 2800, every: 1, scenario: 'charm' });
  assert.equal(r.at(2700).charms[0].available, false);
  assert.equal(r.at(2700).charms[0].respawn_s, 0.017);
  // bùa đặt cạnh Mây nên được nhặt lại ngay khi xuất hiện: đúng 2700 tick sau lần đầu
  assert.deepEqual(r.ofs('charm_picked').map((e) => e.tick), [1, 2701]);
  assert.equal(r.at(2701).player.charm_s, 10, 'nhặt lại làm mới hiệu lực');
});

test('Gió Lạc: idle → chase (mang ≥5, ≤15 m) → cướp 3 → flee 240 tick → biến mất', () => {
  const r = run({ night: 2, ticks: 400, every: 1, scenario: 'drifter_steal' });
  const st = r.ofs('drifter_steal');
  assert.equal(st.length, 1);
  assert.deepEqual(st[0].data, { drifter_id: 'D1', amount: 3, carried: 3 });
  const t0 = st[0].tick;
  assert.equal(r.at(t0 - 1).drifters[0].state, 'chase');
  assert.deepEqual([r.at(t0).drifters[0].state, r.at(t0).drifters[0].stolen], ['flee', 3]);
  assert.equal(r.ofs('player_hit').length, 0, 'không làm mất Ngọn Lửa');
  assert.equal(st.length, 1, 'mỗi con chỉ cướp 1 lần');
  assert.equal(r.at(t0 + 239).drifters.length, 1);
  assert.equal(r.at(t0 + 240).drifters.length, 0, 'biến mất sau 240 tick cùng đồ cướp');
});

test('Gió Lạc cướp được cả khi Mây đang bất tử; rơi khỏi đảo bỏ qua bất tử', () => {
  const d = run({ night: 2, ticks: 100, every: 1, scenario: 'drifter_steal_invuln' });
  assert.equal(d.ofs('drifter_steal').length, 1);
  assert.equal(d.at(1).player.invuln, true);
  const f = run({ ticks: 900, every: 1, scenario: 'fall_invuln', inputs: 'fall.inputs' });
  const fall = f.ofs('player_hit').find((e) => e.data.by === 'fall');
  assert.ok(fall, 'rơi vẫn bị phạt dù đang bất tử');
  assert.equal(fall.data.flames, 2);
});

test('Gió Lạc: tỏa sáng trúng con đang chase → flee, không cướp', () => {
  const r = run({ night: 2, ticks: 60, every: 1, scenario: 'drifter_pulse_chase', inputs: 'pulse_only.inputs' });
  assert.equal(r.ofs('drifter_steal').length, 0);
  assert.deepEqual(r.at(1).drifters.map((d) => [d.state, d.stolen]), [['flee', 0]]);
  assert.equal(r.at(1).player.carried, 5);
});

test('Gió Lạc: tỏa sáng trúng con flee mang đồ → thả lại, biến mất sau 120 tick', () => {
  const r = run({ night: 2, ticks: 500, every: 1, scenario: 'drifter_pulse_drop', inputs: 'pulse_only.inputs' });
  assert.deepEqual(r.ofs('drifter_drop')[0].data, { drifter_id: 'D1', amount: 3 });
  assert.equal(r.at(1).motes.filter((m) => m.kind === 'dropped').length, 3);
  assert.equal(r.at(1).drifters[0].stolen, 0);
  assert.equal(r.at(120).drifters.length, 1);
  assert.equal(r.at(121).drifters.length, 0);
  assert.equal(r.at(1).motes[0].ttl_s, 8);
  assert.equal(r.at(480).motes.length, 3);
  assert.equal(r.at(481).motes.length, 0, 'đom đóm rơi hết hạn sau 480 tick');
});

test('Gió Lạc sinh tại tick 1200, 2400 (tối đa 2), Đêm 1 thì không có', () => {
  const r = run({ night: 2, ticks: 3700, every: 100, scenario: 'drifter_spawn' });
  assert.equal(r.at(1100).drifters.length, 0);
  assert.deepEqual(r.at(1200).drifters.map((d) => d.id), ['D1']);
  assert.equal(r.at(2400).drifters.length, 2);
  assert.equal(r.at(3600).drifters.length <= 2, true);
  assert.equal(run({ night: 1, ticks: 1300, every: 100, scenario: 'drifter_spawn' }).at(1200).drifters.length, 0);
});

test('Bục nhảy Đêm 2: bắn lên đảo bên kia, phím di chuyển không ghi đè, đáp trong đảo đích', () => {
  const f = path.join(tmp, 'cnt.json');
  fs.writeFileSync(f, JSON.stringify({ frames: [{ tick: 0, move: [-1, 0] }] }));
  const r = run({ night: 2, ticks: 130, every: 1, scenario: 'pad2', inputs: 'pad2.inputs' });
  near(r.at(1).player.vel[1], 14, 1e-9);
  near(Math.hypot(r.at(2).player.vel[0], r.at(2).player.vel[2]), 24, 1e-3, 'vận tốc ngang 24 m/s');
  assert.equal(r.at(40).player.grounded, false);
  const land = r.snaps.find((s) => s.tick > 2 && s.player.grounded);
  assert.ok(land && land.tick >= 80 && land.tick <= 92, `bay ~1.4 s, đáp tick ${land?.tick}`);
  assert.ok(Math.hypot(land.player.pos[0] - 70, land.player.pos[2]) <= 28, 'đáp trong đảo B');
  near(land.player.pos[0], 51.6, 1.5); near(land.player.pos[2], 6.6, 1.5);
  assert.equal(r.ofs('player_hit').length, 0);
  void f;
});

test('Bục nhảy Đêm 3: đáp lên tầng 2 (Y=6)', () => {
  const r = run({ night: 3, ticks: 120, every: 1, scenario: 'pad3' });
  const last = r.at(120).player;
  assert.equal(last.grounded, true);
  assert.equal(last.pos[1], 6);
  assert.ok(Math.hypot(last.pos[0], last.pos[2]) <= 8);
  near(last.pos[2], 6.2, 0.6);
});

test('Đêm 3: vách tầng 2 chặn Mây ở tầng 0; dốc lên tầng 1; bước khỏi tầng 1 thì rơi xuống tầng 0', () => {
  const w = run({ night: 3, ticks: 300, every: 10, scenario: 'wall3', inputs: 'wall3.inputs' });
  const z = w.at(300).player.pos;
  assert.equal(z[1], 0);
  assert.ok(Math.hypot(z[0], z[2]) >= 8 - 0.01, `không leo được vách: ${z}`);
  assert.ok(w.snaps.every((s) => s.player.pos[1] === 0));
  const rp = run({ night: 3, ticks: 150, every: 1, scenario: 'ramp3', inputs: 'ramp3.inputs' });
  assert.equal(rp.at(150).player.pos[1], 3);
  assert.ok(rp.snaps.some((s) => s.player.pos[1] > 1 && s.player.pos[1] < 2.9 && s.player.grounded), 'đi trên dốc');
  const te = run({ night: 3, ticks: 200, every: 1, scenario: 'tier1_edge', inputs: 'tier1_edge.inputs' });
  assert.equal(te.at(200).player.pos[1], 0);
  assert.equal(te.ofs('player_hit').length, 0);
  assert.ok(te.snaps.some((s) => s.player.pos[1] > 0 && s.player.pos[1] < 3 && !s.player.grounded), 'rơi xuống tầng dưới');
});

test('Gió mạnh Đêm 3: báo trước 2 s, 5 s đẩy 2 m/s; wind_enabled=false thì tắt', () => {
  const r = run({ night: 3, ticks: 2200, every: 10, scenario: 'wind' });
  assert.equal(r.at(1670).wind.warning, false);
  assert.equal(r.at(1690).wind.warning, true);
  assert.equal(r.at(1790).wind.active, false);
  assert.equal(r.at(1800).wind.active, true);
  assert.equal(r.at(2090).wind.active, true);
  assert.equal(r.at(2100).wind.active, false);
  const a = r.at(1690).wind.dir_deg;
  const p0 = r.at(1790).player.pos, p1 = r.at(2100).player.pos;
  near(Math.hypot(p1[0] - p0[0], p1[2] - p0[2]), 10, 0.1, 'đẩy 2 m/s × 5 s');
  near(Math.atan2(p1[2] - p0[2], p1[0] - p0[0]) * 180 / Math.PI, a > 180 ? a - 360 : a, 0.6, 'đúng hướng');
  const off = run({ night: 3, ticks: 2200, every: 10, scenario: 'wind_off' });
  assert.equal(off.at(2100).wind.active, false);
  assert.deepEqual(off.at(2100).player.pos, [0, 0, -30]);
});

test('Tạm dừng: tick tăng, sim_tick/thời gian đứng yên, event paused/resumed, state "paused"', () => {
  const r = run({ ticks: 40, every: 1, scenario: 'dawn', inputs: 'pause.inputs' });
  assert.deepEqual(r.ofs('paused').map((e) => e.tick), [6, 31]);
  assert.deepEqual(r.ofs('resumed').map((e) => e.tick), [21]);
  assert.equal(r.at(5).state, 'playing');
  for (let t = 6; t <= 20; t++) {
    assert.equal(r.at(t).state, 'paused', `tick ${t}`);
    assert.equal(r.at(t).sim_tick, 5);
    assert.equal(r.at(t).time_left_s, r.at(5).time_left_s);
    assert.deepEqual(r.at(t).player.pos, r.at(5).player.pos);
  }
  assert.equal(r.at(21).state, 'playing');
  assert.equal(r.at(21).sim_tick, 6);
  assert.equal(r.at(21).tick - r.at(21).sim_tick, 15);
  assert.equal(r.at(31).state, 'paused');
  assert.equal(r.at(40).sim_tick, r.at(31).sim_tick);
  assert.equal(r.end.ticks, 40);
});

test('night_start ở bước đầu; --night chọn đúng bản đồ và thời lượng', () => {
  for (const [n, dur] of [[1, 240], [2, 270], [3, 300]]) {
    const r = run({ night: n, ticks: 2 });
    assert.deepEqual(r.ev[0], { type: 'event', tick: 1, name: 'night_start', data: { night: n } });
    assert.equal(r.snaps[0].time_left_s, dur);
    assert.equal(r.snaps[0].lanterns.length, [5, 6, 7][n - 1]);
  }
});

test('Lịch sinh: Bóng Mực 2 con ở tick 300 rồi mỗi 480/420/360 tick; id S1, S2…; trạng thái spawning', () => {
  const one = run({ night: 1, ticks: 1300, every: 10, scenario: 'spawn_all' });
  const t1 = one.ofs('shade_spawned');
  assert.deepEqual(t1.map((e) => e.tick), [300, 300, 780, 1260]);
  assert.deepEqual(t1.map((e) => e.data.id), ['S1', 'S2', 'S3', 'S4']);
  assert.deepEqual(one.at(300).shades.map((s) => s.state), ['spawning', 'spawning']);
  assert.notEqual(one.at(310).shades[0].state, 'spawning');
  for (const s of one.at(300).shades) assert.ok(Math.hypot(s.pos[0], s.pos[2]) > 36.9 && Math.hypot(s.pos[0], s.pos[2]) < 37.1);
  const two = run({ night: 2, ticks: 1100, every: 10, scenario: 'spawn' });
  assert.deepEqual(two.ofs('shade_spawned').map((e) => e.tick), [300, 300, 720, 1140].filter((t) => t <= 1100));
  const three = run({ night: 3, ticks: 1100, every: 10, scenario: 'spawn' });
  assert.deepEqual(three.ofs('shade_spawned').map((e) => e.tick), [300, 300, 660, 1020]);
});

test('Đom đóm: 20 điểm khác nhau lúc đầu, +1 mỗi 240 tick; hết điểm trống thì bỏ lượt (Đêm 1: 24 điểm, Đêm 3: 30 điểm = trần)', () => {
  const r = run({ night: 1, ticks: 1500, every: 1, scenario: 'noshade' });
  assert.equal(r.at(0).motes.length, 20);
  assert.equal(new Set(r.at(0).motes.map((m) => m.pos.join())).size, 20);
  assert.equal(r.at(239).motes_active, 20);
  assert.equal(r.at(240).motes_active, 21);
  assert.equal(r.at(960).motes_active, 24);
  assert.equal(r.at(1200).motes_active, 24, 'hết điểm trống: bỏ lượt');
  const n3 = run({ night: 3, ticks: 2700, every: 1, scenario: 'noshade' });
  assert.equal(n3.at(2399).motes_active, 29);
  assert.equal(n3.at(2400).motes_active, 30);
  assert.equal(n3.at(2640).motes_active, 30, 'trần 30');
  assert.equal(new Set(n3.at(2640).motes.map((m) => m.pos.join())).size, 30, 'không sinh trùng điểm');
  assert.deepEqual([...new Set(n3.at(0).motes.map((m) => m.pos[1]))].every((y) => [0, 3, 6].includes(y)), true, 'độ cao theo tầng');
});

test('Bóng Mực: phát hiện 12 m / bỏ đuổi 18 m; chạm cần chênh cao ≤ 1.5; trạng thái choáng hết hạn', () => {
  const r = run({ ticks: 200, every: 1, scenario: 'shade_states' });
  assert.equal(r.at(0).shades.find((s) => s.id === 'S1').state, 'wander');
  assert.equal(r.at(0).shades.find((s) => s.id === 'S2').state, 'chase');
  assert.equal(r.at(0).shades.find((s) => s.id === 'S3').state, 'stunned');
  assert.notEqual(r.at(11).shades.find((s) => s.id === 'S3').state, 'stunned');
});

test('Đêm 2: Bóng Mực qua cầu để đuổi Mây ở đảo bên kia', () => {
  const r = run({ night: 2, ticks: 400, every: 5, scenario: 'nav2' });
  assert.ok(r.snaps.some((sn) => sn.shades[0].pos[0] > 30), 'bóng đã đi qua cầu sang đảo B');
  for (const sn of r.snaps) {
    const [x, , z] = sn.shades[0].pos;
    const onA = Math.hypot(x, z) <= 28.01, onB = Math.hypot(x - 70, z) <= 28.01, bridge = x >= 25.99 && x <= 44.01 && Math.abs(z) <= 2.01;
    assert.ok(onA || onB || bridge, `bóng ở ngoài đảo tại tick ${sn.tick}: ${x},${z}`);
  }
});

test('Hiệu năng: một Đêm đầy đủ (21 600 tick) chạy ≤ 30 s (thực tế rất nhanh)', () => {
  for (const night of [1, 2, 3]) {
    const t0 = Date.now();
    const r = run({ night, ticks: 21600, every: 60 });
    assert.equal(r.r.status, 0);
    assert.ok(Date.now() - t0 < 30000);
  }
});

// =========================== Phase 3 — "Đèn cạn dầu" ===========================

test('Phase 3 — hao hụt dầu: 1.0/s (1/60 mỗi tick), hết dầu thì tắt và emit lantern_out', () => {
  const r = run({ ticks: 130, every: 1, scenario: 'p3_fuel_decay' });
  const l1 = (t) => r.at(t).lanterns.find((l) => l.id === 'L1');
  assert.equal(l1(0).fuel, 2.0);
  assert.equal(l1(0).lit, true);
  assert.equal(l1(60).fuel, 1.0);
  assert.equal(l1(119).fuel, 0.0);
  assert.equal(l1(119).lit, true);
  assert.equal(l1(120).fuel, 0);
  assert.equal(l1(120).lit, false);
  assert.equal(l1(120).ever_lit, true);
  const outs = r.ofs('lantern_out');
  assert.equal(outs.length, 1);
  assert.equal(outs[0].tick, 120);
  assert.deepEqual(outs[0].data, { lantern_id: 'L1' });
});

test('Phase 3 — châm dầu: tính used theo ceil((100-fuel)/10), cộng điểm +5/con, emit refuel, đầy thì bỏ qua', () => {
  const r = run({ ticks: 10, every: 1, scenario: 'p3_refuel', inputs: 'p3_refuel.inputs' });
  const refuels = r.ofs('refuel');
  assert.equal(refuels.length, 1);
  assert.equal(refuels[0].tick, 1);
  // (100 - 75) / 10 = 2.5 -> ceil = 3 motes. fuel = min(100, 75 + 30) = 100.
  assert.deepEqual(refuels[0].data, { lantern_id: 'L1', amount: 3, fuel: 100 });
  assert.equal(r.at(1).player.carried, 2);
  assert.equal(r.at(1).lanterns.find((l) => l.id === 'L1').fuel, 100);
  assert.equal(r.at(1).score, 15);

  // Khi carried = 0 (used = 0): không chọn đèn, không phát sự kiện, không cộng điểm
  const rEmpty = run({ ticks: 5, every: 1, scenario: 'p3_refuel_empty', inputs: 'p3_refuel.inputs' });
  assert.equal(rEmpty.ofs('refuel').length, 0);
  assert.equal(rEmpty.at(1).player.carried, 0);
  assert.equal(rEmpty.at(1).score, 0);
});

test('Phase 3 — thắp lại: ever_lit chỉ tốn 5 đom đóm, relight=true, +40 điểm, tăng capacity', () => {
  const r = run({ ticks: 10, every: 1, scenario: 'p3_relight', inputs: 'p3_relight.inputs' });
  const litEv = r.ofs('lantern_lit');
  assert.equal(litEv.length, 1);
  assert.deepEqual(litEv[0].data, { lantern_id: 'L1', relight: true });
  const l1 = r.at(1).lanterns.find((l) => l.id === 'L1');
  assert.equal(l1.lit, true);
  assert.equal(l1.fuel, 100);
  assert.equal(l1.relit_count, 1);
  assert.equal(r.at(1).player.carried, 0);
  // Điểm: 5 motes * 5 = 25 + 40 (relight) = 65
  assert.equal(r.at(1).score, 65);
  // Sức chứa tăng: 10 + 2 * 1 = 12
  assert.equal(r.at(1).player.capacity, 12);
});

test('Phase 3 — sức chứa tăng dần: capacity = min(20, 10 + 2 * successful_lights)', () => {
  const r = run({ ticks: 1, scenario: 'p3_refuel' });
  assert.equal(r.at(0).player.capacity, 10);
});

test('Phase 3 — Bóng Mực hút dầu: fuel < 30 mất an toàn, chuyển drain ở <= 2m, hút 5/s, emit fuel_drain mỗi 60 tick', () => {
  const r = run({ ticks: 125, every: 1, scenario: 'p3_drain' });
  const drains = r.ofs('fuel_drain');
  assert.equal(drains.length, 2);
  assert.equal(drains[0].tick, 60);
  // Tick 1..60: 60 ticks * (1/60 hao + 5/60 hút) = 6 fuel. 25 - 6 = 19.
  assert.deepEqual(drains[0].data, { lantern_id: 'L1', shade_id: 'S1', fuel: 19 });
  assert.equal(drains[1].tick, 120);
  assert.deepEqual(drains[1].data, { lantern_id: 'L1', shade_id: 'S1', fuel: 13 });
  assert.equal(r.at(60).shades[0].state, 'drain');
});

test('Phase 3 — Tỏa Sáng trúng bóng đang drain: choáng và cộng tổng +15 điểm', () => {
  const r = run({ ticks: 10, every: 1, scenario: 'p3_drain_pulse', inputs: 'p3_drain_pulse.inputs' });
  const pulses = r.ofs('pulse');
  assert.equal(pulses.length, 1);
  assert.deepEqual(pulses[0].data, { stunned_ids: ['S1'] });
  assert.equal(r.at(1).shades[0].state, 'stunned');
  assert.equal(r.at(1).score, 15);
});

test('Phase 3 — châm dầu lên >= 30: bóng trong 6m bị đẩy ra mép ≤30 tick, không gây sát thương, về wander', () => {
  const r = run({ ticks: 40, every: 1, scenario: 'p3_refuel_eject', inputs: 'p3_refuel_eject.inputs' });
  const refuels = r.ofs('refuel');
  assert.equal(refuels.length, 1);
  assert.ok(dist2(r.at(31).shades[0].pos, [0, 0, 25]) >= 6 - 0.05);
  assert.equal(r.ofs('player_hit').length, 0);
  assert.notEqual(r.at(1).shades[0].state, 'drain');
});

test('Phase 3 — luật thắng bình minh: đạt ngưỡng đèn thì thắng dawn_survived', () => {
  const r = run({ night: 1, ticks: 10, scenario: 'p3_dawn_win' });
  assert.deepEqual(r.ofs('game_over')[0].data, { result: 'won', reason: 'dawn_survived' });
  assert.equal(r.end.state, 'won');
});

test('Phase 3 — luật thua bình minh: dưới ngưỡng đèn thì thua dawn', () => {
  const r = run({ night: 1, ticks: 10, scenario: 'p3_dawn_fail' });
  assert.deepEqual(r.ofs('game_over')[0].data, { result: 'lost', reason: 'dawn' });
  assert.equal(r.end.state, 'lost');
});
