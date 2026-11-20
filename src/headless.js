#!/usr/bin/env node
// Chế độ headless theo Test Contract v1.0.
// node src/headless.js --seed 1 --night 1 [--scenario f.json] [--inputs f.json] --ticks N --out f.jsonl [--snapshot-every 10]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Game, EMPTY_INPUT } from './sim.js';

class BadInput extends Error {}
const bad = (m) => { throw new BadInput(m); };

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { console.error(`tham số lạ: ${a}`); process.exit(1); }
    const k = a.slice(2);
    if (i + 1 >= argv.length) { console.error(`thiếu giá trị cho --${k}`); process.exit(1); }
    o[k] = argv[++i];
  }
  return o;
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isVec = (v, n) => Array.isArray(v) && v.length === n && v.every(isNum);

function readJson(file, what) {
  let txt;
  try { txt = fs.readFileSync(file, 'utf8'); } catch (e) { bad(`${what}: không đọc được ${file}`); }
  try { return JSON.parse(txt); } catch (e) { bad(`${what}: JSON sai định dạng (${e.message})`); }
}

function validateInputs(j) {
  if (j === null || typeof j !== 'object' || Array.isArray(j) || !Array.isArray(j.frames)) bad('inputs: cần {"frames":[...]}');
  let last = -1;
  for (const f of j.frames) {
    if (f === null || typeof f !== 'object' || Array.isArray(f)) bad('inputs: frame phải là object');
    if (!Number.isInteger(f.tick) || f.tick < 0) bad('inputs: tick phải là số nguyên >= 0');
    if (f.tick <= last) bad('inputs: tick phải tăng nghiêm ngặt');
    last = f.tick;
    if ('move' in f && !(isVec(f.move, 2) && f.move.every((x) => x >= -1 && x <= 1))) bad('inputs: move phải là [x,z] trong [-1,1]');
    if ('cam_yaw_deg' in f && !isNum(f.cam_yaw_deg)) bad('inputs: cam_yaw_deg phải là số');
    for (const b of ['jump', 'interact', 'pulse', 'dash']) if (b in f && typeof f[b] !== 'boolean') bad(`inputs: ${b} phải là boolean`);
  }
  return j.frames;
}

function validateScenario(s) {
  if (s === null || typeof s !== 'object' || Array.isArray(s)) bad('scenario: phải là object');
  if ('player' in s) {
    const p = s.player;
    if (p === null || typeof p !== 'object' || Array.isArray(p)) bad('scenario.player phải là object');
    if ('pos' in p && !isVec(p.pos, 3)) bad('scenario.player.pos phải là [x,y,z]');
    if ('carried' in p && !(Number.isInteger(p.carried) && p.carried >= 0)) bad('scenario.player.carried phải là số nguyên >= 0');
    if ('flames' in p && !(Number.isInteger(p.flames) && p.flames >= 0)) bad('scenario.player.flames phải là số nguyên >= 0');
  }
  for (const k of ['random_motes', 'random_shades']) if (k in s && typeof s[k] !== 'boolean') bad(`scenario.${k} phải là boolean`);
  if ('time_left_s' in s && !(isNum(s.time_left_s) && s.time_left_s >= 0)) bad('scenario.time_left_s phải là số >= 0');
  if ('motes' in s) {
    if (!Array.isArray(s.motes) || !s.motes.every((m) => isVec(m, 3))) bad('scenario.motes phải là mảng [x,y,z]');
  }
  if ('shades' in s) {
    if (!Array.isArray(s.shades)) bad('scenario.shades phải là mảng');
    for (const q of s.shades) {
      if (q === null || typeof q !== 'object' || !isVec(q.pos, 3)) bad('scenario.shades[].pos phải là [x,y,z]');
      if ('id' in q && typeof q.id !== 'string') bad('scenario.shades[].id phải là chuỗi');
    }
  }
  if ('lanterns' in s) {
    if (!Array.isArray(s.lanterns)) bad('scenario.lanterns phải là mảng');
    for (const l of s.lanterns) {
      if (l === null || typeof l !== 'object' || typeof l.id !== 'string') bad('scenario.lanterns[].id phải là chuỗi');
      if ('pos' in l && !isVec(l.pos, 3)) bad('scenario.lanterns[].pos phải là [x,y,z]');
      if ('deposited' in l && !(Number.isInteger(l.deposited) && l.deposited >= 0)) bad('scenario.lanterns[].deposited phải là số nguyên >= 0');
      if ('lit' in l && typeof l.lit !== 'boolean') bad('scenario.lanterns[].lit phải là boolean');
    }
  }
  return s;
}

function main() {
  const a = parseArgs(process.argv.slice(2));
  for (const k of ['seed', 'ticks', 'out']) if (a[k] === undefined) { console.error(`thiếu --${k}`); process.exit(1); }
  const seed = Number(a.seed), ticks = Number(a.ticks);
  const every = a['snapshot-every'] === undefined ? 10 : Number(a['snapshot-every']);
  if (!Number.isInteger(seed) || !Number.isInteger(ticks) || ticks < 0 || !Number.isInteger(every) || every < 1) {
    console.error('--seed/--ticks/--snapshot-every phải là số nguyên hợp lệ'); process.exit(1);
  }
  if (a.night !== undefined && a.night !== '1') { console.error('chỉ hỗ trợ --night 1'); process.exit(1); }

  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const contract = JSON.parse(fs.readFileSync(path.join(root, 'game.contract.json'), 'utf8'));

  let scenario = {}, frames = [];
  try {
    if (a.scenario !== undefined) scenario = validateScenario(readJson(a.scenario, 'scenario'));
    if (a.inputs !== undefined) frames = validateInputs(readJson(a.inputs, 'inputs'));
  } catch (e) {
    if (e instanceof BadInput) { console.error(e.message); process.exit(2); }
    throw e;
  }

  const g = new Game({ tuning: contract.tuning, seed, scenario });
  const lines = [];
  const emit = (o) => lines.push(JSON.stringify(o));
  const input = EMPTY_INPUT();
  let fi = 0;
  emit(g.snapshot());
  for (let k = 0; k < ticks && g.state === 'playing'; k++) {
    while (fi < frames.length && frames[fi].tick === k) {
      const f = frames[fi++];
      if ('move' in f) input.move = f.move;
      if ('cam_yaw_deg' in f) input.cam_yaw_deg = f.cam_yaw_deg;
      for (const b of ['jump', 'interact', 'pulse']) if (b in f) input[b] = f[b];
    }
    for (const ev of g.step(input)) emit(ev);
    if (g.steps % every === 0) emit(g.snapshot());
  }
  emit(g.endLine());
  fs.writeFileSync(a.out, lines.join('\n') + '\n');
}

try { main(); } catch (e) { console.error(e.stack || String(e)); process.exit(1); }
