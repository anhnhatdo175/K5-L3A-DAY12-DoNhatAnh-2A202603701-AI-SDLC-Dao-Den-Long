import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-'));
const contract = JSON.parse(fs.readFileSync('game.contract.json', 'utf8'));
const T = contract.tuning;

function run(args, outName = 'o.jsonl') {
  const out = path.join(tmp, outName);
  fs.rmSync(out, { force: true });
  const r = spawnSync('node', ['src/headless.js', '--night', '1', ...args, '--out', out], { encoding: 'utf8' });
  const lines = fs.existsSync(out) ? fs.readFileSync(out, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
  return { r, lines, out, ev: lines.filter((l) => l.type === 'event'), snaps: lines.filter((l) => l.type === 'snapshot'), end: lines.at(-1) };
}
const S = (n) => path.join('scenarios', n);

test('cấu trúc: snapshot 0, end cuối, đúng số bước', () => {
  const { r, snaps, end } = run(['--seed', '1', '--ticks', '100', '--snapshot-every', '10']);
  assert.equal(r.status, 0);
  assert.equal(snaps.length, 11);
  assert.equal(snaps[0].tick, 0);
  assert.equal(snaps[0].time_left_s, T.night1_duration_s);
  assert.deepEqual(end, { type: 'end', ticks: 100, state: 'playing', score: 0 });
  assert.equal(snaps.at(-1).time_left_s, Math.round((T.night1_duration_s - 100 / 60) * 1000) / 1000);
  assert.deepEqual(snaps[0].player.pos, [0, 0, 0]);
  assert.equal(snaps[0].lanterns.length, 5);
  assert.deepEqual(snaps[0].lanterns[0].pos, [0, 0, 25]);
});

test('tất định: cùng seed/scenario/inputs → output giống hệt; khác seed → khác', () => {
  const a = run(['--seed', '7', '--ticks', '2000'], 'a.jsonl');
  const b = run(['--seed', '7', '--ticks', '2000'], 'b.jsonl');
  assert.equal(fs.readFileSync(a.out, 'utf8'), fs.readFileSync(b.out, 'utf8'));
  const c = run(['--seed', '8', '--ticks', '2000'], 'c.jsonl');
  assert.notEqual(fs.readFileSync(a.out, 'utf8'), fs.readFileSync(c.out, 'utf8'));
  assert.ok(a.ev.some((e) => e.name === 'shade_spawned'));
});

test('nhặt đom đóm: đi 5 m về +Z nhặt đúng 1 con, +điểm', () => {
  const { ev, end } = run(['--seed', '1', '--ticks', '120', '--scenario', S('pickup.json'), '--inputs', S('pickup.inputs.json')]);
  const picks = ev.filter((e) => e.name === 'mote_picked');
  assert.equal(picks.length, 1);
  assert.deepEqual(picks[0].data, { carried: 1 });
  assert.equal(end.score, T.score.per_mote);
});

test('nạp đèn + thắng: deposit, lantern_lit, game_over won, điểm thưởng', () => {
  const { ev, end } = run(['--seed', '1', '--ticks', '600', '--scenario', S('deposit_win.json'), '--inputs', S('deposit_win.inputs.json')]);
  assert.deepEqual(ev.map((e) => e.name), ['deposit', 'lantern_lit', 'game_over']);
  assert.deepEqual(ev[0].data, { lantern_id: 'L1', amount: 8, deposited: 8 });
  assert.equal(ev[0].tick, 6);
  assert.deepEqual(ev[2].data, { result: 'won', reason: 'all_lit' });
  assert.equal(end.state, 'won');
  assert.equal(end.ticks, 6);
  const secs = Math.floor(100 - 6 / 60);
  assert.equal(end.score, T.score.per_lantern + secs * T.score.per_second_left + 3 * T.score.per_flame_left);
});

test('tỏa sáng: choáng shade trong bán kính, trừ ánh sáng, đẩy lùi', () => {
  const { ev, snaps, end } = run(['--seed', '1', '--ticks', '10', '--snapshot-every', '1', '--scenario', S('pulse.json'), '--inputs', S('pulse.inputs.json')]);
  const p = ev.find((e) => e.name === 'pulse');
  assert.deepEqual(p.data, { stunned_ids: ['S1'] });
  assert.equal(p.tick, 1);
  assert.equal(snaps[1].player.carried, 4 - T.pulse_cost);
  const s1 = snaps[1].shades.find((s) => s.id === 'S1');
  assert.equal(s1.state, 'stunned');
  assert.equal(s1.pos[0], 4 + T.pulse_push_m);
  assert.equal(end.score, T.score.per_stun);
});

test('bị chạm: mất 1 máu, rơi 50% đom đóm, bất tử invuln_s', () => {
  const { ev, snaps } = run(['--seed', '1', '--ticks', '200', '--snapshot-every', '1', '--scenario', S('hit.json')]);
  const hits = ev.filter((e) => e.name === 'player_hit');
  assert.equal(hits[0].tick, 1);
  assert.deepEqual(hits[0].data, { by: 'shade', flames: 2, dropped: 2 });
  assert.equal(snaps[1].player.carried, 3);
  assert.equal(snaps[30].player.carried, 3, 'đom đóm rơi không được nhặt lại ngay');
  assert.equal(snaps[30].motes_active, 2);
  assert.equal(hits[1].tick, 1 + Math.round(T.invuln_s * 60));
});

test('safe_radius: shade không vào vùng quanh đèn', () => {
  const { snaps } = run(['--seed', '1', '--ticks', '600', '--snapshot-every', '1', '--scenario', S('safe.json')]);
  for (const s of snaps) {
    const sh = s.shades[0];
    assert.ok(Math.hypot(sh.pos[0], sh.pos[2] - 25) >= T.safe_radius - 0.01, `tick ${s.tick}`);
  }
});

test('rơi khỏi đảo → player_hit by fall, hồi sinh tại (0,0,0)', () => {
  const { ev, snaps } = run(['--seed', '1', '--ticks', '900', '--snapshot-every', '1', '--scenario', S('fall.json'), '--inputs', S('fall.inputs.json')]);
  const fall = ev.find((e) => e.name === 'player_hit');
  assert.equal(fall.data.by, 'fall');
  assert.equal(fall.data.flames, 2);
  assert.deepEqual(snaps[fall.tick].player.pos, [0, 0, 0]);
});

test('thua do hết máu (no_flames) và do bình minh (dawn)', () => {
  const a = run(['--seed', '1', '--ticks', '2000', '--scenario', S('hit.json')]);
  assert.deepEqual(a.ev.at(-1).data, { result: 'lost', reason: 'no_flames' });
  assert.equal(a.end.state, 'lost');
  const b = run(['--seed', '1', '--ticks', '2000', '--scenario', S('dawn.json')]);
  assert.deepEqual(b.ev.at(-1).data, { result: 'lost', reason: 'dawn' });
  assert.equal(b.end.ticks, 120);
  assert.equal(b.end.score, 0);
});

test('dựng scenario không phát event, không cộng điểm (đèn lit sẵn)', () => {
  const { ev, snaps } = run(['--seed', '1', '--ticks', '0', '--scenario', S('deposit_win.json')]);
  assert.equal(ev.length, 0);
  assert.equal(snaps[0].score, 0);
  assert.equal(snaps[0].lanterns.filter((l) => l.lit).length, 4);
});

test('file sai định dạng → exit 2', () => {
  const badJson = path.join(tmp, 'bad.json'); fs.writeFileSync(badJson, '{oops');
  const dupTick = path.join(tmp, 'dup.json'); fs.writeFileSync(dupTick, JSON.stringify({ frames: [{ tick: 1 }, { tick: 1 }] }));
  const badMove = path.join(tmp, 'mv.json'); fs.writeFileSync(badMove, JSON.stringify({ frames: [{ tick: 0, move: [2, 0] }] }));
  for (const [flag, f] of [['--inputs', badJson], ['--scenario', badJson], ['--inputs', dupTick], ['--inputs', badMove]]) {
    assert.equal(run(['--seed', '1', '--ticks', '10', flag, f]).r.status, 2, `${flag} ${f}`);
  }
});
