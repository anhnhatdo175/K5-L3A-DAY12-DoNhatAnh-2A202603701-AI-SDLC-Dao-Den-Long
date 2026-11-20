import * as THREE from '/three.module.js';
import { Game, TPS, WORLDS } from '/sim.js';

const contract = await (await fetch('/game.contract.json')).json();
const T = contract.tuning;
const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);

// ---------- bảng màu chuẩn (Ticket-02) ----------
const PAL = {
  sky: 0x0E1430, fog: 0x1B2350, grass: 0x2F5D50, sand: 0xC9B48A, wood: 0x6B4A2F, sea: 0x12384A,
  lampOn: 0xFFB347, lampCore: 0xFFE9B0, lampOff: 0x5B5F6E, moteCore: 0xFFF6C2, moteHalo: 0xFFE58A,
  shade: 0x120A1A, shadeEdge: 0x7A3CFF, shadeStun: 0x3A3450, robe: 0xE8E2D0, scarf: 0xC8102E,
  gold: 0xF2C14E, drifter: 0x8FA3B8,
};

// ---------- cài đặt (lưu giữa các lần mở) ----------
// Phím mặc định (Ticket-04 §4: đổi phím được, có lưu). Esc luôn là tạm dừng phụ; Enter, Esc, ←/→ là phím hệ thống, không gán được.
const DEFAULT_KEYS = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', dash: 'ShiftLeft', interact: 'KeyE', pulse: 'KeyF', pause: 'KeyP' };
const ACTION_LABEL = { up: 'Đi lên', down: 'Đi xuống', left: 'Đi trái', right: 'Đi phải', jump: 'Nhảy', dash: 'Lướt', interact: 'Tương tác (nạp đèn)', pulse: 'Tỏa Sáng', pause: 'Tạm dừng' };
const RESERVED = ['Escape', 'Enter', 'ArrowLeft', 'ArrowRight'];
const reducedPref = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
const settings = { volume: 0.6, sens: 0.4, colorblind: false, captions: true, reducedMotion: reducedPref, bigText: false, keys: { ...DEFAULT_KEYS } };
try {
  const saved = JSON.parse(localStorage.getItem('ddl.settings') || '{}');
  const { keys: sk, ...rest } = saved;
  Object.assign(settings, rest);
  if (sk && typeof sk === 'object') for (const a of Object.keys(DEFAULT_KEYS)) if (typeof sk[a] === 'string') settings.keys[a] = sk[a];
} catch { /* bỏ qua */ }
const saveSettings = () => { try { localStorage.setItem('ddl.settings', JSON.stringify(settings)); } catch { /* bỏ qua */ } };
const applyBodyClasses = () => {
  document.body.classList.toggle('cb-mode', settings.colorblind);
  document.body.classList.toggle('rm', settings.reducedMotion);
  document.body.classList.toggle('big', settings.bigText);
};
applyBodyClasses();
const keyLabel = (c) => ({ Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', ControlRight: 'Ctrl', AltLeft: 'Alt', AltRight: 'Alt', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Escape: 'Esc', Enter: 'Enter', Tab: 'Tab', Backspace: '⌫' }[c]
  || c.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num '));
const sameKey = (a, b) => a === b || (a.startsWith('Shift') && b.startsWith('Shift')) || (a.startsWith('Control') && b.startsWith('Control')) || (a.startsWith('Alt') && b.startsWith('Alt'));
const actionOf = (code) => Object.keys(settings.keys).find((a) => sameKey(settings.keys[a], code));

// ---------- âm thanh (WebAudio tổng hợp, không cần file) ----------
const Snd = (() => {
  let ctx = null, master = null, musicOn = false, timer = null, step = 0;
  const init = () => {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = settings.volume; master.connect(ctx.destination);
    } catch { ctx = null; }
  };
  const tone = (f, dur, type = 'sine', vol = 0.2, when = 0, slide = 0) => {
    if (!ctx) return;
    const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  };
  const noise = (dur, vol = 0.2, f0 = 800) => {
    if (!ctx) return;
    const n = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    fl.type = 'lowpass'; fl.frequency.value = f0; g.gain.value = vol;
    s.buffer = b; s.connect(fl); fl.connect(g); g.connect(master); s.start();
  };
  const NOTES = [220, 261.6, 329.6, 392, 329.6, 261.6, 196, 246.9];
  const sfx = {
    pickup: () => { tone(880, 0.12, 'sine', 0.15); tone(1320, 0.12, 'sine', 0.1, 0.06); },
    light: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.5, 'triangle', 0.16, i * 0.08)); },
    deposit: () => tone(440, 0.15, 'triangle', 0.15, 0, 200),
    pulse: () => { tone(300, 0.5, 'sine', 0.25, 0, 900); noise(0.3, 0.08, 4000); },
    hit: () => { noise(0.25, 0.3, 500); tone(130, 0.3, 'sawtooth', 0.15, 0, -60); },
    jump: () => tone(300, 0.15, 'sine', 0.12, 0, 300),
    dash: () => noise(0.2, 0.18, 2500),
    win: () => { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.6, 'triangle', 0.18, i * 0.14)); },
    lose: () => { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.6, 'sawtooth', 0.1, i * 0.2)); },
    spawn: () => tone(90, 0.5, 'sawtooth', 0.12, 0, -30),
    tick: () => tone(1000, 0.08, 'square', 0.1),
    charm: () => { tone(660, 0.2, 'sine', 0.16); tone(990, 0.3, 'sine', 0.14, 0.1); },
    steal: () => noise(0.3, 0.15, 1800),
  };
  return {
    init, setVolume(v) { if (master) master.gain.value = v; },
    music(on) {
      if (on === musicOn) return; musicOn = on; clearInterval(timer);
      if (on) timer = setInterval(() => { if (!ctx) return; tone(NOTES[step % NOTES.length] / 2, 1.8, 'sine', 0.05); if (step % 2 === 0) tone(NOTES[(step * 3) % NOTES.length], 1.2, 'triangle', 0.03, 0.3); step++; }, 1100);
    },
    play(n) { sfx[n]?.(); },
  };
})();

// ---------- renderer / cảnh ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(PAL.sky);
scene.fog = new THREE.FogExp2(PAL.fog, 0.011);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 400);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
const ambient = new THREE.AmbientLight(0xffffff, 0.15);
const moon = new THREE.DirectionalLight(0x9aa8ff, 0.9);
moon.position.set(-30, 50, 20);
scene.add(ambient, moon);

const haloTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,246,194,1)'); gr.addColorStop(0.35, 'rgba(255,229,138,.55)'); gr.addColorStop(1, 'rgba(255,229,138,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const lam = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });

const level = new THREE.Group(); scene.add(level);
const dyn = new THREE.Group(); scene.add(dyn);
let lanternObjs = [], moteObjs = {}, shadeObjs = {}, drifterObjs = {}, charmObjs = [];

function buildLevel(n) {
  for (const g of [level, dyn]) while (g.children.length) g.remove(g.children[0]);
  moteObjs = {}; shadeObjs = {}; drifterObjs = {}; lanternObjs = []; charmObjs = [];
  const w = WORLDS[n];
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), lam(PAL.sea));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -8; level.add(sea);
  for (let i = 0; i < 36; i++) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(7 + (i % 5) * 2, 10, 8), lam(0x1d4a62, { transparent: true, opacity: 0.75 }));
    const a = (i / 36) * Math.PI * 2, r = 55 + (i % 7) * 9;
    c.position.set(Math.sin(a) * r + (n === 2 ? 35 : 0), -6.5 - (i % 3), Math.cos(a) * r); c.scale.y = 0.4; level.add(c);
  }
  for (const s of w.surfaces) {
    if (s.kind === 'disc') {
      const depth = Math.max(4, s.y + 3);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(s.r, s.r - 1.5, depth, 56), [lam(PAL.sand), lam(PAL.grass), lam(PAL.sand)]);
      m.position.set(s.cx, s.y - depth / 2, s.cz); level.add(m);
    } else if (s.kind === 'annulus') {
      const sh = new THREE.Shape(); sh.absarc(0, 0, s.r1, 0, Math.PI, false); sh.absarc(0, 0, s.r0, Math.PI, 0, true);
      const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: s.y + 0.5, bevelEnabled: false, curveSegments: 40 }), [lam(PAL.grass), lam(PAL.sand)]);
      m.rotation.x = Math.PI / 2; m.position.y = s.y; level.add(m);
    } else if (s.kind === 'rect') {
      const sh = new THREE.Shape(); sh.moveTo(s.x0, s.z0); sh.lineTo(s.x1, s.z0); sh.lineTo(s.x1, s.z1); sh.lineTo(s.x0, s.z1); sh.closePath();
      const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.4, bevelEnabled: false }), [lam(PAL.wood), lam(PAL.wood)]);
      m.rotation.x = Math.PI / 2; m.position.y = s.y; level.add(m);
      for (let x = s.x0 + 1; x < s.x1; x += 2) { // ván cầu
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, s.z1 - s.z0), lam(0x4a3220)); p.position.set(x, s.y + 0.02, 0); level.add(p);
      }
    } else if (s.kind === 'ramp') {
      const a = (s.deg * Math.PI) / 180, ux = Math.cos(a), uz = Math.sin(a), nx = -uz, nz = ux;
      const P = (sv, tv) => [sv * ux + tv * nx, 0.5 * (30 - sv), sv * uz + tv * nz];
      const v = [...P(24, -1.5), ...P(24, 1.5), ...P(30, 1.5), ...P(30, -1.5)];
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals();
      level.add(new THREE.Mesh(g, lam(PAL.sand, { side: THREE.DoubleSide })));
    }
  }
  for (const o of w.obstacles) { // tháp chuông
    const tw = new THREE.Mesh(new THREE.CylinderGeometry(o.r, o.r + 0.3, o.top - 6, 20), lam(PAL.sand)); tw.position.set(o.x, 6 + (o.top - 6) / 2, o.z); level.add(tw);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(o.r + 0.6, 2, 20), lam(PAL.wood)); roof.position.set(o.x, o.top + 1, o.z); level.add(roof);
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10), new THREE.MeshBasicMaterial({ color: PAL.gold })); bell.position.set(o.x, o.top - 1, o.z); level.add(bell);
  }
  for (const p of w.pads) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r, 0.12, 24), new THREE.MeshBasicMaterial({ color: PAL.gold })); r.position.set(p.x, p.y + 0.06, p.z); level.add(r);
    const ar = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.9, 4), new THREE.MeshBasicMaterial({ color: PAL.scarf }));
    ar.position.set(p.x, p.y + 0.3, p.z); ar.rotation.x = Math.PI / 2; ar.rotation.order = 'YXZ'; ar.rotation.y = Math.atan2(p.dir[0], p.dir[1]); level.add(ar);
  }
  // đèn lồng
  w.lanterns.forEach((p) => {
    const g = new THREE.Group(); g.position.set(p[0], p[1], p[2]);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 3.2, 8), lam(PAL.wood)); post.position.y = 1.6;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 12), new THREE.MeshStandardMaterial({ color: PAL.lampOff, emissive: PAL.lampOn, emissiveIntensity: 0 }));
    lamp.position.y = 3.6; lamp.scale.y = 1.2;
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshBasicMaterial({ color: PAL.lampCore, transparent: true, opacity: 0 })); core.position.y = 3.6;
    const light = new THREE.PointLight(PAL.lampOn, 0, 34, 1.4); light.position.y = 3.8;
    const zone = new THREE.Mesh(new THREE.RingGeometry(T.safe_radius - 0.2, T.safe_radius, 56), new THREE.MeshBasicMaterial({ color: PAL.lampOn, transparent: true, opacity: 0, side: THREE.DoubleSide }));
    zone.rotation.x = -Math.PI / 2; zone.position.y = 0.06;

    // Vết rách giấy cho đèn tắt
    const tear = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.05), lam(0x222228));
    tear.position.set(0, 3.6, 0.78);
    tear.rotation.z = 0.35;

    // Thanh dầu trên đèn
    const barBg = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.18), new THREE.MeshBasicMaterial({ color: 0x111122, side: THREE.DoubleSide }));
    barBg.position.set(0, 4.8, 0);
    const barFill = new THREE.Mesh(new THREE.PlaneGeometry(1.56, 0.14), new THREE.MeshBasicMaterial({ color: PAL.lampOn, side: THREE.DoubleSide }));
    barFill.position.set(0, 4.8, 0.01);
    const fuelGroup = new THREE.Group();
    fuelGroup.add(barBg, barFill);
    fuelGroup.visible = false;

    g.add(post, lamp, core, light, zone, tear, fuelGroup); level.add(g);
    lanternObjs.push({ lamp, core, light, zone, tear, fuelGroup, barFill });
  });
  // bùa
  for (let i = 0; i < w.charms.length; i++) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.15, 0.05), new THREE.MeshBasicMaterial({ color: PAL.gold })));
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.95, 0.07), new THREE.MeshBasicMaterial({ color: PAL.scarf })));
    const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: PAL.gold, transparent: true, depthWrite: false })); h.scale.set(2.4, 2.4, 1); g.add(h);
    dyn.add(g); charmObjs.push(g);
  }
}

// ---------- Mây ----------
const hero = new THREE.Group();
{
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.2, 14), lam(PAL.robe)); robe.position.y = 0.6;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), lam(0xf2c7a5)); head.position.y = 1.4;
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.09, 8, 16), lam(PAL.scarf)); scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.15;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.55, 20), lam(PAL.sand)); hat.position.y = 1.85; // nón lá
  const lampMesh = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshBasicMaterial({ color: PAL.lampOn })); lampMesh.position.set(0.55, 1.45, 0.25);
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.4, 4), lam(PAL.wood)); string.position.set(0.55, 1.68, 0.25);
  const hl = new THREE.PointLight(PAL.lampOn, 22, 16, 1.5); hl.position.set(0.55, 1.5, 0.25);
  hero.add(robe, head, scarf, hat, lampMesh, string, hl);
}
scene.add(hero);
const pulseRing = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 56), new THREE.MeshBasicMaterial({ color: PAL.lampOn, transparent: true, opacity: 0, side: THREE.DoubleSide }));
pulseRing.rotation.x = -Math.PI / 2; scene.add(pulseRing);

// lá bay (gió)
const LEAVES = 90;
const leafGeo = new THREE.BufferGeometry();
const leafPos = new Float32Array(LEAVES * 3);
leafGeo.setAttribute('position', new THREE.BufferAttribute(leafPos, 3));
const leaves = new THREE.Points(leafGeo, new THREE.PointsMaterial({ color: 0x9bbf7a, size: 0.35, transparent: true, opacity: 0.9 }));
leaves.visible = false; leaves.frustumCulled = false; scene.add(leaves);
for (let i = 0; i < LEAVES; i++) { leafPos[i * 3] = (Math.random() - 0.5) * 40; leafPos[i * 3 + 1] = Math.random() * 10; leafPos[i * 3 + 2] = (Math.random() - 0.5) * 40; }

// ---------- trạng thái ứng dụng ----------
let mode = 'menu', night = 1, total = 0, nightsWon = 0, runSeed = 1, retries = 0, modal = false, lowPrev = {}, prevWarn = false, tenShown = false, shakeT = 0, game = null, last = 0, acc = 0, camYaw = 0, lastLit = 0, toastT = 0, pulseT = 0, lastCountdown = 99;
const keys = new Set();
let pJump = false, pInteract = false, pPulse = false, pDash = false, pPause = false;
const NIGHT_INFO = {
  1: ['Đêm 1 — Đảo Bến', 'Cháu Mây, sương đen đã nuốt hết ánh sáng của Đảo Bến. Gom đom đóm, thắp lại năm Đèn Lồng Lớn trước khi trời sáng nhé. Nhớ: Bóng Mực sợ đèn!'],
  2: ['Đêm 2 — Đảo Cau', 'Hai hòn đảo nối nhau bằng cầu tre, hoặc cháu cứ nhảy lên bục mà bay sang. Coi chừng Gió Lạc: nó thích giật đom đóm của cháu. Lá Bùa Gió giữa cầu sẽ giúp cháu chạy nhanh hơn.'],
  3: ['Đêm 3 — Đảo Chuông', 'Đảo Chuông có ba tầng: leo dốc hoặc dùng bục nhảy để lên cao. Đêm nay có gió mạnh, thấy lá bay là bám chắc nhé. Bảy ngọn đèn cuối cùng… cháu làm được!'],
};

const screenEl = $('screen');
function show(html) { modal = false; screenEl.innerHTML = html; screenEl.style.display = 'flex'; $('hud').style.display = 'none'; }
function hideScreen() { modal = false; screenEl.style.display = 'none'; screenEl.innerHTML = ''; $('hud').style.display = 'block'; }
const btn = (id, text, alt = false) => `<button id="${id}" class="${alt ? 'alt' : ''}">${text}</button>`;
const on = (id, fn) => { const e = $(id); if (e) e.onclick = () => { Snd.init(); fn(); }; };

function newRun() { total = 0; nightsWon = 0; retries = 0; runSeed = (Math.random() * 2 ** 31) | 0; }
function showMenu() {
  mode = 'menu'; Snd.music(false);
  show(`<h1>Đảo Đèn Lồng</h1><p>Mây, người giữ đèn nhỏ tuổi, gom đom đóm để thắp lại các Đèn Lồng Lớn giữa biển mây.</p>${btn('bStart', 'Bắt đầu (Enter)')}${btn('bLb', 'Bảng xếp hạng', true)}${btn('bSet', 'Cài đặt', true)}`);
  on('bStart', () => { newRun(); showIntro(1); });
  on('bLb', () => showLeaderboard(showMenu));
  on('bSet', () => showSettings(showMenu));
}

// ---------- bảng xếp hạng (máy chủ lưu file data/leaderboard.json) ----------
const NAME_RE = /^[\p{L}\p{N}_]{3,12}$/u;
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
async function showLeaderboard(back, highlight = null) {
  show('<h2>Bảng xếp hạng</h2><p>Đang tải…</p>'); modal = true;
  let html;
  try {
    const r = await fetch('/api/leaderboard', { cache: 'no-store' });
    const { entries } = await r.json();
    html = entries.length
      ? `<table class="lb"><tr><th>#</th><th>Tên</th><th>Điểm</th><th>Đêm thắng</th><th>Lúc</th></tr>${entries.map((e, i) => `<tr class="${e.achieved_at === highlight ? 'me' : ''}"><td>${i + 1}</td><td>${esc(e.name)}</td><td>${e.score}</td><td>${e.nights_won}/3</td><td>${esc(e.achieved_at.slice(0, 16).replace('T', ' '))}</td></tr>`).join('')}</table>`
      : '<p>Chưa có ai ghi tên. Hãy là người đầu tiên!</p>';
  } catch { html = '<p>Không đọc được bảng xếp hạng (cần chạy game bằng <b>npm start</b>).</p>'; }
  show(`<h2>Bảng xếp hạng</h2>${html}${btn('bBack', 'Quay lại', true)}`); modal = true;
  on('bBack', back);
}
function nameForm() {
  const last = (() => { try { return localStorage.getItem('ddl.name') || ''; } catch { return ''; } })();
  return `<p>Điểm của bạn: <b style="color:#F2C14E">${total}</b> · ${nightsWon}/3 Đêm thắng</p>
    <label>Tên (3–12 ký tự: chữ, số, _) <input id="nameIn" type="text" maxlength="12" autocomplete="off" value="${esc(last)}"></label>
    <p id="nameMsg" role="alert" style="min-height:1.4em;color:var(--danger)"></p>${btn('bSave', 'Lưu điểm')}`;
}
function wireNameForm() {
  const input = $('nameIn'); if (!input) return;
  const save = async () => {
    const name = input.value.normalize('NFC');
    if (!NAME_RE.test(name)) { $('nameMsg').textContent = 'Tên phải dài 3–12 ký tự, chỉ gồm chữ, số hoặc dấu _'; return; }
    try {
      const r = await fetch('/api/leaderboard', { method: 'POST', body: JSON.stringify({ name, score: total, nights_won: nightsWon, seed: runSeed }) });
      const j = await r.json();
      if (!r.ok) { $('nameMsg').textContent = j.error || 'Lưu thất bại'; return; }
      try { localStorage.setItem('ddl.name', name); } catch { /* bỏ qua */ }
      showLeaderboard(showMenu, j.entry.achieved_at);
    } catch { $('nameMsg').textContent = 'Không lưu được (cần chạy game bằng npm start).'; }
  };
  $('bSave').onclick = save;
  input.onkeydown = (e) => { if (e.key === 'Enter') save(); };
}

// ---------- cài đặt ----------
let rebinding = null; // hành động đang chờ phím mới
let settingsBack = null;
function showSettings(back, msg = '', msgOk = false) {
  settingsBack = back;
  const rows = Object.keys(DEFAULT_KEYS).map((a) => `<div class="krow"><span>${ACTION_LABEL[a]}</span><button class="alt kbtn" data-act="${a}">${rebinding === a ? 'Nhấn phím…' : keyLabel(settings.keys[a])}</button></div>`).join('');
  const note = rebinding ? `Nhấn phím mới cho «${ACTION_LABEL[rebinding]}» (Esc để hủy)` : msg;
  show(`<h2>Cài đặt</h2><div class="cols"><div>
    <label>Âm lượng <input id="sVol" type="range" min="0" max="1" step="0.05" value="${settings.volume}"></label>
    <label>Độ nhạy chuột <input id="sSens" type="range" min="0.1" max="1" step="0.05" value="${settings.sens}"></label>
    <label><input id="sCb" type="checkbox" ${settings.colorblind ? 'checked' : ''}> Bảng màu dễ phân biệt</label>
    <label><input id="sCap" type="checkbox" ${settings.captions ? 'checked' : ''}> Phụ đề / chỉ báo hình ảnh</label>
    <label><input id="sRm" type="checkbox" ${settings.reducedMotion ? 'checked' : ''}> Giảm chuyển động (tắt rung camera, chớp màn hình)</label>
    <label><input id="sBig" type="checkbox" ${settings.bigText ? 'checked' : ''}> Chữ lớn (×1.25)</label></div>
    <div><h3>Phím điều khiển</h3>${rows}<p id="kMsg" role="alert" style="min-height:1.4em;color:${rebinding || msgOk ? 'var(--text)' : 'var(--danger)'}">${esc(note)}</p>${btn('bReset', 'Khôi phục mặc định', true)}</div></div>${btn('bBack', 'Quay lại', true)}`);
  modal = true;
  $('sVol').oninput = (e) => { settings.volume = +e.target.value; Snd.setVolume(settings.volume); saveSettings(); };
  $('sSens').oninput = (e) => { settings.sens = +e.target.value; saveSettings(); };
  const flag = (id, k) => { $(id).onchange = (e) => { settings[k] = e.target.checked; applyBodyClasses(); saveSettings(); renderKeysHint(); }; };
  flag('sCb', 'colorblind'); flag('sCap', 'captions'); flag('sRm', 'reducedMotion'); flag('sBig', 'bigText');
  for (const b of screenEl.querySelectorAll('.kbtn')) b.onclick = () => { rebinding = b.dataset.act; showSettings(back); };
  $('bReset').onclick = () => { settings.keys = { ...DEFAULT_KEYS }; rebinding = null; saveSettings(); renderKeysHint(); showSettings(back, 'Đã khôi phục phím mặc định.', true); };
  on('bBack', () => { rebinding = null; back(); });
}
function captureKey(e) {
  e.preventDefault(); e.stopPropagation();
  const act = rebinding, back = settingsBack;
  rebinding = null;
  if (e.code === 'Escape') return showSettings(back);
  if (RESERVED.includes(e.code)) return showSettings(back, `Phím ${keyLabel(e.code)} dành cho hệ thống, hãy chọn phím khác.`);
  const other = actionOf(e.code);
  if (other && other !== act) return showSettings(back, `⚠ Trùng phím: ${keyLabel(e.code)} đang dùng cho «${ACTION_LABEL[other]}». Hãy chọn phím khác hoặc đổi phím kia trước.`);
  settings.keys[act] = e.code; saveSettings(); renderKeysHint();
  showSettings(back, `Đã gán ${keyLabel(e.code)} cho «${ACTION_LABEL[act]}».`, true);
}
function showIntro(n) {
  mode = 'intro'; night = n;
  show(`<h2>${NIGHT_INFO[n][0]}</h2><p class="elder">“${NIGHT_INFO[n][1]}”</p><p>— Ông Đăng</p>${btn('bGo', 'Vào Đêm (Enter)')}`);
  on('bGo', () => startNight(n));
}
function startNight(n) {
  Snd.init(); Snd.music(true);
  night = n; buildLevel(n);
  game = new Game({ tuning: T, seed: runSeed + n + 10 * retries, night: n });
  mode = 'play'; acc = 0; last = performance.now(); lastLit = 0; lastCountdown = 99; camYaw = 0;
  lowPrev = {}; prevWarn = false; tenShown = false; shadeAlerts.clear(); shakeT = 0;
  const [sx, sy, sz] = WORLDS[n].start; camera.position.set(sx, sy + 6, sz - 9);
  $('night').textContent = n; $('nl').textContent = game.lanterns.length;
  $('motes').innerHTML = '<i></i>'.repeat(game.player.capacity);
  renderKeysHint();
  hideScreen();
}
function showPause() {
  show(`<h2>Tạm dừng</h2>${btn('bRes', 'Tiếp tục (Esc)')}${btn('bRe', 'Chơi lại Đêm này', true)}${btn('bSet', 'Cài đặt', true)}${btn('bMenu', 'Về menu', true)}`);
  on('bRes', () => { pPause = true; });
  on('bRe', () => { retries++; startNight(night); });
  on('bSet', () => showSettings(showPause));
  on('bMenu', showMenu);
}
function endNight() {
  const won = game.state === 'won';
  mode = 'result'; Snd.music(false); Snd.play(won ? 'win' : 'lose');
  if (won) { total += game.score; nightsWon++; }
  const reason = { dawn_survived: 'Bình minh đã tới! Bạn đã bảo vệ đảo thành công!', dawn: 'Trời sáng mà không đủ đèn sáng.', no_flames: 'Mây hết Ngọn Lửa.' }[game.endReason] || '';
  if (won && night === 3) {
    show(`<h1>🌅 Bình Minh</h1><p>Ba hòn đảo đã sáng đèn. Biển mây rực vàng!</p><p>Tổng điểm: <b style="color:#F2C14E;font-size:32px">${total}</b></p>${nameForm()}${btn('bAgain', 'Chơi lại từ đầu', true)}${btn('bMenu', 'Về menu', true)}`);
    wireNameForm();
    on('bAgain', () => { newRun(); showIntro(1); });
  } else if (won) {
    show(`<h2>Đêm ${night} hoàn thành 🏮</h2><p>${reason}</p><p>Điểm Đêm này: <b>${game.score}</b> · Tổng: <b>${total}</b></p>${btn('bNext', 'Đêm kế tiếp (Enter)')}${btn('bMenu', 'Về menu', true)}`);
    on('bNext', () => showIntro(night + 1));
  } else {
    show(`<h2>Sương đen nuốt chửng…</h2><p>${reason}</p>${nameForm()}${btn('bRe', 'Chơi lại Đêm này', true)}${btn('bMenu', 'Về menu', true)}`);
    wireNameForm();
    on('bRe', () => { retries++; showIntro(night); });
  }
  on('bMenu', showMenu);
}

// ---------- input ----------
addEventListener('keydown', (e) => {
  if (rebinding) { captureKey(e); return; }
  if (e.target instanceof HTMLInputElement && e.target.type === 'text') return; // đang gõ tên
  Snd.init();
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'Enter') {
    if (mode === 'menu') { newRun(); showIntro(1); } else if (mode === 'intro') startNight(night);
    else if (mode === 'result') ($('bNext') || $('bRe') || $('bAgain'))?.click();
    return;
  }
  if (mode !== 'play' || modal) return;
  const act = actionOf(e.code);
  if (act === 'jump') { pJump = true; e.preventDefault(); }
  if (act === 'interact') pInteract = true;
  if (act === 'pulse') pPulse = true;
  if (act === 'dash') pDash = true;
  if (act === 'pause' || e.code === 'Escape') pPause = true;
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
let drag = false;
renderer.domElement.addEventListener('pointerdown', () => { drag = true; });
addEventListener('pointerup', () => { drag = false; });
addEventListener('pointermove', (e) => { if (drag && mode === 'play') camYaw -= e.movementX * settings.sens; });
addEventListener('blur', () => { if (mode === 'play' && game && !game.paused) pPause = true; });

function readInput() {
  const k = (c) => keys.has(c);
  const dn = (a) => [...keys].some((c) => sameKey(settings.keys[a], c));
  if (k('ArrowLeft')) camYaw += 90 / TPS;
  if (k('ArrowRight')) camYaw -= 90 / TPS;
  // camera nhìn theo +Z khi yaw=0 nên phím phải = trục x âm của contract
  const mx = (dn('left') ? 1 : 0) - (dn('right') ? 1 : 0), mz = (dn('up') ? 1 : 0) - (dn('down') ? 1 : 0);
  const inp = { move: [mx, mz], cam_yaw_deg: camYaw, jump: pJump, interact: pInteract, pulse: pPulse, dash: pDash, pause: pPause };
  pJump = pInteract = pPulse = pDash = pPause = false;
  return inp;
}

// ---------- dựng hình theo trạng thái ----------
const halo = (color, s) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); sp.scale.set(s, s, 1); return sp; };
const shadeGeo = new THREE.SphereGeometry(0.9, 14, 10), eyeGeo = new THREE.SphereGeometry(0.12, 6, 6), moteGeo = new THREE.SphereGeometry(0.14, 8, 6);
const moteMat = new THREE.MeshBasicMaterial({ color: PAL.moteCore });

const _tmpC = new THREE.Color(), _dawnC = new THREE.Color(0x3a3060), _fogC = new THREE.Color(PAL.fog), _camGoal = new THREE.Vector3(); // tái dùng, tránh rác mỗi khung
function syncMeshes(time) {
  const p = game.player;
  hero.position.set(p.x, p.y, p.z); hero.rotation.y = p.facing;
  hero.visible = !(p.invuln > 0 && !settings.reducedMotion && Math.floor(time * 12) % 2 === 0) && p.fallWait === 0;

  const live = new Set();
  for (const m of game.motes) {
    live.add(m.id);
    let o = moteObjs[m.id];
    if (!o) { o = new THREE.Group(); o.add(new THREE.Mesh(moteGeo, moteMat)); o.add(halo(PAL.moteHalo, 1.5)); dyn.add(o); moteObjs[m.id] = o; }
    o.position.set(m.x, m.y + 0.9 + Math.sin(time * 2 + m.x) * 0.2, m.z);
    o.visible = m.ttl === null || m.ttl > 120 || Math.floor(time * 10) % 2 === 0; // nhấp nháy khi sắp hết hạn
  }
  for (const id of Object.keys(moteObjs)) if (!live.has(id)) { dyn.remove(moteObjs[id]); delete moteObjs[id]; }

  const liveS = new Set();
  for (const s of game.shades) {
    liveS.add(s.id);
    let o = shadeObjs[s.id];
    if (!o) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(shadeGeo, lam(PAL.shade, { transparent: true, opacity: 0.95 })); body.scale.y = 1.15;
      const edge = new THREE.Mesh(shadeGeo, new THREE.MeshBasicMaterial({ color: settings.colorblind ? 0x00B3FF : PAL.shadeEdge, side: THREE.BackSide })); edge.scale.set(1.1, 1.28, 1.1);
      const eyeMat = new THREE.MeshBasicMaterial({ color: settings.colorblind ? 0x00B3FF : PAL.shadeEdge });
      const e1 = new THREE.Mesh(eyeGeo, eyeMat), e2 = new THREE.Mesh(eyeGeo, eyeMat); e1.position.set(-0.3, 0.25, 0.75); e2.position.set(0.3, 0.25, 0.75);
      g.add(edge, body, e1, e2); dyn.add(g); o = shadeObjs[s.id] = { g, body, edge, e1, e2 };
    }
    const edgeCol = settings.colorblind ? 0x00B3FF : PAL.shadeEdge;
    o.edge.material.color.setHex(edgeCol);
    o.e1.material.color.setHex(edgeCol);
    o.e2.material.color.setHex(edgeCol);
    o.g.position.set(s.x, s.y + Math.sin(time * 3 + s.x) * 0.1, s.z);
    o.g.rotation.y = Math.atan2(p.x - s.x, p.z - s.z);
    o.body.material.color.setHex(s.state === 'stunned' ? PAL.shadeStun : PAL.shade);
    o.g.scale.setScalar(s.state === 'spawning' ? 0.5 : s.state === 'stunned' ? 0.75 + 0.05 * Math.sin(time * 30) : 1);
  }
  for (const id of Object.keys(shadeObjs)) if (!liveS.has(id)) { dyn.remove(shadeObjs[id].g); delete shadeObjs[id]; }

  const liveD = new Set();
  for (const d of game.drifters) {
    liveD.add(d.id);
    let o = drifterObjs[d.id];
    if (!o) {
      const g = new THREE.Group();
      for (let i = 0; i < 5; i++) { const seg = new THREE.Mesh(new THREE.BoxGeometry(0.9 - i * 0.12, 0.05, 0.7), new THREE.MeshBasicMaterial({ color: PAL.drifter, transparent: true, opacity: 0.85 })); seg.position.z = -i * 0.65; g.add(seg); }
      dyn.add(g); o = drifterObjs[d.id] = g;
    }
    o.position.set(d.x, d.y, d.z);
    o.rotation.y = d.state === 'flee' ? Math.atan2(d.x - p.x, d.z - p.z) : d.state === 'chase' ? Math.atan2(p.x - d.x, p.z - d.z) : time * 0.3;
    o.children.forEach((c, i) => { c.position.y = Math.sin(time * 6 - i) * 0.25; });
  }
  for (const id of Object.keys(drifterObjs)) if (!liveD.has(id)) { dyn.remove(drifterObjs[id]); delete drifterObjs[id]; }

  game.charms.forEach((c, i) => {
    const o = charmObjs[i]; if (!o) return;
    o.visible = c.available; o.position.set(c.x, c.y + 1.3 + Math.sin(time * 2 + i) * 0.15, c.z); o.rotation.y = time * 1.5;
  });

  let lit = 0;
  game.lanterns.forEach((l, i) => {
    const o = lanternObjs[i]; if (!o) return;
    if (l.lit) lit++;
    const low = l.lit && l.fuel < 30;
    if (low && !lowPrev[l.id] && mode === 'play') caption(`Đèn ${l.id} sắp cạn dầu (dưới 30)! Mang đom đóm tới châm.`);
    lowPrev[l.id] = low;
    const cost = l.ever_lit ? T.relight_cost : T.lantern_cost;
    const tgt = l.lit ? 1 : (l.deposited / cost) * 0.5;
    o.lamp.material.emissiveIntensity += (tgt * 2.2 - o.lamp.material.emissiveIntensity) * 0.1;
    o.lamp.material.color.setHex(l.lit ? PAL.lampOn : PAL.lampOff);
    o.light.intensity += (tgt * 160 - o.light.intensity) * 0.1;
    o.core.material.opacity += ((l.lit ? 0.95 : 0) - o.core.material.opacity) * 0.1;
    o.zone.material.opacity = (l.lit && l.fuel >= 30) ? 0.35 : 0;

    // Phân biệt đèn tắt và sáng không cần màu:
    // Đèn tắt bị xẹp 20%, có vết rách
    if (!l.lit) {
      o.lamp.scale.set(0.8, 0.96, 0.8);
      o.tear.visible = true;
      o.fuelGroup.visible = false;
      o.lamp.visible = true;
    } else {
      o.lamp.scale.set(1, 1.2, 1);
      o.tear.visible = false;
      o.fuelGroup.visible = true;
      o.fuelGroup.rotation.y = (camYaw * Math.PI) / 180;
      const fuelFrac = Math.max(0, Math.min(1, l.fuel / 100));
      o.barFill.scale.x = fuelFrac;
      o.barFill.position.x = -0.78 * (1 - fuelFrac);
      // Khi fuel < 30: đèn và thanh dầu nhấp nháy chậm (1 Hz)
      if (l.fuel < 30 && !settings.reducedMotion) {
        const blink = Math.sin(time * 2 * Math.PI) > 0;
        o.lamp.visible = blink;
        o.fuelGroup.visible = blink;
      } else {
        o.lamp.visible = true;
        o.fuelGroup.visible = true;
      }
    }
  });
  const k = lit / game.lanterns.length;
  ambient.intensity += ((0.15 + 0.55 * k) - ambient.intensity) * 0.1; // công thức chuẩn: 0.15 + 0.55 × tiến độ
  scene.background.lerp(_tmpC.set(PAL.sky).lerp(_dawnC, k * 0.6), 0.02);
  scene.fog.color.copy(scene.background).lerp(_fogC, 0.4);
  if (lit > lastLit) { toast(`Thắp được ${lit}/${game.lanterns.length} đèn!`); lastLit = lit; }

  // gió: lá bay + cảnh báo
  const w = game.wind, windy = game.windOn && (w.active || w.warn);
  if (w.warn && !prevWarn && mode === 'play') caption('Gió sắp thổi! Bám chắc, tránh mép đảo.', 5000);
  prevWarn = !!w.warn;
  leaves.visible = windy; $('wind').style.display = game.windOn && w.warn ? 'block' : 'none';
  if (windy) {
    const a = (w.dir * Math.PI) / 180, vx = Math.cos(a) * (w.active ? 9 : 4), vz = Math.sin(a) * (w.active ? 9 : 4);
    for (let i = 0; i < LEAVES; i++) {
      leafPos[i * 3] += vx * 0.016; leafPos[i * 3 + 2] += vz * 0.016; leafPos[i * 3 + 1] += Math.sin(time * 3 + i) * 0.02;
      for (const j of [0, 2]) { const c = j === 0 ? p.x : p.z; if (leafPos[i * 3 + j] - c > 20) leafPos[i * 3 + j] -= 40; if (leafPos[i * 3 + j] - c < -20) leafPos[i * 3 + j] += 40; }
    }
    leafGeo.attributes.position.needsUpdate = true;
    leaves.position.set(0, p.y + 1, 0);
  }

  // camera ngôi thứ ba
  const th = (camYaw * Math.PI) / 180;
  camera.position.lerp(_camGoal.set(p.x - Math.sin(th) * 9, p.y + 6, p.z - Math.cos(th) * 9), 0.15);
  camera.lookAt(p.x, p.y + 1.2, p.z);
  if (shakeT > 0 && !settings.reducedMotion) { const k = shakeT / 0.35; camera.position.x += (Math.random() - 0.5) * 0.5 * k; camera.position.y += (Math.random() - 0.5) * 0.5 * k; }
}

// ---------- trợ năng: phụ đề / chỉ báo hình ảnh, giảm chuyển động ----------
const shadeAlerts = new Map(); // id Bóng Mực mới xuất hiện -> thời điểm hết chỉ báo (ms)
function caption(text, ms = 4000) {
  if (!settings.captions) return;
  if ([...$('caps').children].some((c) => c.textContent === text)) return; // không lặp
  const el = document.createElement('div'); el.className = 'cap'; el.textContent = text; $('caps').prepend(el);
  while ($('caps').children.length > 4) $('caps').lastChild.remove();
  setTimeout(() => el.remove(), ms);
}
function renderKeysHint() {
  const K = (a) => keyLabel(settings.keys[a]);
  $('keys').innerHTML = `${K('up')}${K('left')}${K('down')}${K('right')} đi · Kéo chuột/←→ xoay · ${K('jump')} nhảy · ${K('dash')} lướt<br>${K('interact')} nạp đèn · ${K('pulse')} tỏa sáng · Esc/${K('pause')} tạm dừng`;
  $('cdDash').lastElementChild.innerHTML = `Lướt<br>${K('dash')}`; $('cdPulse').lastElementChild.innerHTML = `Tỏa Sáng<br>${K('pulse')}`;
}
function flash(kind) { // chớp màn hình ngắn; tắt khi bật "Giảm chuyển động"
  if (settings.reducedMotion) return;
  const f = $('flash'); f.style.transition = 'none'; f.style.background = kind === 'hit' ? 'var(--danger)' : 'var(--lamp)'; f.style.opacity = kind === 'hit' ? 0.45 : 0.25;
  void f.offsetWidth; f.style.transition = 'opacity .35s'; f.style.opacity = 0;
}
const sarrows = new Map();
function updateShadeArrows(now) {
  for (const [id, until] of shadeAlerts) {
    const sh = game.shades.find((q) => q.id === id);
    if (!sh || now > until || !settings.captions) { shadeAlerts.delete(id); }
  }
  for (const [id, el] of sarrows) if (!shadeAlerts.has(id)) { el.remove(); sarrows.delete(id); }
  for (const id of shadeAlerts.keys()) {
    const sh = game.shades.find((q) => q.id === id);
    let el = sarrows.get(id);
    if (!el) { el = document.createElement('div'); el.className = 'sarrow'; $('hud').appendChild(el); sarrows.set(id, el); }
    const v = _tmpV.set(sh.x, sh.y + 1, sh.z).project(camera);
    let x = v.x, y = v.y; if (v.z > 1) { x = -x; y = -y; }
    const off = v.z > 1 || Math.abs(x) > 0.92 || Math.abs(y) > 0.86;
    if (off) { const m = Math.max(Math.abs(x), Math.abs(y), 1e-6); x /= m; y /= m; x *= 0.92; y *= 0.84; }
    el.style.left = `${((x + 1) / 2) * innerWidth - 16}px`; el.style.top = `${((1 - y) / 2) * innerHeight - 16 - (off ? 0 : 40)}px`;
    el.style.transform = off ? `rotate(${(Math.atan2(x, y) * 180) / Math.PI}deg)` : 'rotate(180deg)'; // đầu mũi tên hướng về phía Bóng Mực
  }
}
const _tmpV = new THREE.Vector3();

function toast(t) { $('toast').textContent = t; $('toast').style.opacity = 1; toastT = 2.2; }
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function hud() {
  const p = game.player;
  updateShadeArrows(performance.now());
  $('flames').textContent = '🔥'.repeat(Math.max(0, p.flames)) + '🖤'.repeat(Math.max(0, T.flames - p.flames));
  const tl = Math.max(0, Math.ceil(game.timeLeft()));
  const warn = settings.colorblind && tl <= 30 ? '⚠ ' : '';
  $('clock').textContent = warn + mmss(tl); $('clock').classList.toggle('low', tl <= 30);
  $('lit').textContent = game.lanterns.filter((l) => l.lit).length; $('score').textContent = game.score;
  if ($('motes').children.length !== p.capacity) $('motes').innerHTML = '<i></i>'.repeat(p.capacity);
  [...$('motes').children].forEach((c, i) => c.classList.toggle('on', i < p.carried));
  const setCd = (id, left, tot) => { const e = $(id); e.firstElementChild.style.height = `${tot ? (left / tot) * 100 : 0}%`; e.classList.toggle('ready', left === 0); };
  setCd('cdDash', p.dashCd, Math.round(T.dash_cooldown_s * TPS)); setCd('cdPulse', p.pulseCd, Math.round(T.pulse_cooldown_s * TPS));
  // nhắc nạp đèn + mũi tên chỉ tới đèn cần nạp gần nhất
  let near = null, nd = Infinity;
  for (const l of game.lanterns) {
    if (l.lit && l.fuel >= 100) continue;
    const d = Math.hypot(l.x - p.x, l.z - p.z);
    if (d < nd) { near = l; nd = d; }
  }
  const hint = $('hint');
  if (near && nd <= T.interact_radius) {
    hint.style.display = 'block';
    if (!near.lit) {
      const cost = near.ever_lit ? T.relight_cost : T.lantern_cost;
      hint.textContent = near.ever_lit ? `E — Thắp lại đèn (${near.deposited}/${cost})` : `E — Nạp ánh sáng (${near.deposited}/${cost})`;
    } else {
      hint.textContent = `E — Châm dầu (${Math.round(near.fuel)}/100)`;
    }
  } else hint.style.display = 'none';
  const ar = $('arrow');
  if (near) {
    const v = new THREE.Vector3(near.x, near.y + 3.6, near.z).project(camera);
    let x = v.x, y = v.y; if (v.z > 1) { x = -x; y = -y; }
    if (v.z > 1 || Math.abs(x) > 0.92 || Math.abs(y) > 0.88) {
      const m = Math.max(Math.abs(x), Math.abs(y), 1e-6); x /= m; y /= m;
      ar.style.display = 'block'; ar.style.left = `${((x * 0.9 + 1) / 2) * innerWidth - 14}px`; ar.style.top = `${((1 - y * 0.82) / 2) * innerHeight - 17}px`;
      ar.style.transform = `rotate(${(Math.atan2(x, y) * 180) / Math.PI}deg)`;
    } else ar.style.display = 'none';
  } else ar.style.display = 'none';
}

function handleEvent(ev) {
  switch (ev.name) {
    case 'mote_picked': Snd.play('pickup'); break;
    case 'deposit': Snd.play('deposit'); toast(`Nạp ${ev.data.amount} ánh sáng (${ev.data.deposited})`); break;
    case 'refuel': Snd.play('deposit'); toast(`Châm ${ev.data.amount} đom đóm (dầu: ${ev.data.fuel}/100)`); break;
    case 'lantern_lit': Snd.play('light'); flash('lit'); toast(ev.data.relight ? `Thắp lại đèn ${ev.data.lantern_id}!` : `Thắp sáng đèn ${ev.data.lantern_id}!`); break;
    case 'lantern_out': Snd.play('lose'); toast(`Đèn ${ev.data.lantern_id} đã cạn dầu!`); break;
    case 'fuel_drain': Snd.play('steal'); toast(`Bóng Mực đang hút dầu đèn ${ev.data.lantern_id}!`); break;
    case 'pulse': pulseT = 0.5; Snd.play('pulse'); break;
    case 'player_hit': Snd.play('hit'); flash('hit'); if (!settings.reducedMotion) shakeT = 0.35; toast(ev.data.by === 'fall' ? 'Rơi khỏi đảo! Mất hết đom đóm.' : 'Bóng Mực chạm Mây!'); break;
    case 'dash': Snd.play('dash'); break;
    case 'charm_picked': Snd.play('charm'); toast('Bùa Gió! Chạy nhanh, lướt không hồi chiêu'); break;
    case 'drifter_steal': Snd.play('steal'); toast(`Gió Lạc cướp ${ev.data.amount} đom đóm!`); break;
    case 'drifter_drop': toast('Gió Lạc làm rơi đom đóm!'); break;
    case 'shade_spawned': Snd.play('spawn'); shadeAlerts.set(ev.data.id, performance.now() + 5000); caption('Bóng Mực xuất hiện! Nhìn mũi tên ở mép màn hình.'); break;
    case 'game_over': game.endReason = ev.data.reason; break;
    case 'paused': showPause(); break;
    case 'resumed': hideScreen(); break;
    default: break;
  }
}

// ---------- vòng lặp ----------
let fpsAcc = 0, fpsN = 0; window.__fps = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (mode !== 'play' || !game) {
    const t = now / 1000;
    camera.position.set(Math.sin(t * 0.1) * 40, 14, Math.cos(t * 0.1) * 40); camera.lookAt(0, 2, 0);
    renderer.render(scene, camera); return;
  }
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
  fpsAcc += dt; fpsN++; if (fpsAcc >= 1) { window.__fps = fpsN / fpsAcc; fpsAcc = fpsN = 0; }
  acc += dt;
  while (acc >= 1 / TPS && game.state === 'playing') {
    acc -= 1 / TPS;
    const inp = readInput();
    const before = game.player.vy;
    for (const e of game.step(inp)) handleEvent(e);
    if (inp.jump && before === 0 && game.player.vy > 0) Snd.play('jump');
    if (!game.paused && game.state === 'playing') {
      const left = Math.ceil(game.timeLeft());
      if (game.timeLeft() <= 10 && left !== lastCountdown) { lastCountdown = left; Snd.play('tick'); } // đếm ngược 10 s cuối
      if (game.timeLeft() <= 10 && !tenShown) { tenShown = true; caption('10 giây cuối! Bình minh sắp tới.', 6000); }
    }
    if (game.paused) acc = 0;
  }
  if (game.state !== 'playing') { endNight(); return; }
  if (pulseT > 0) {
    pulseT -= dt; const f = 1 - Math.max(0, pulseT) / 0.5;
    pulseRing.position.set(game.player.x, game.player.y + 0.1, game.player.z); pulseRing.scale.setScalar(1 + f * (T.pulse_radius - 1)); pulseRing.material.opacity = 0.8 * (1 - f);
  } else pulseRing.material.opacity = 0;
  if (toastT > 0 && (toastT -= dt) <= 0) $('toast').style.opacity = 0;
  if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
  syncMeshes(now / 1000);
  hud();
  renderer.render(scene, camera);
}

// hooks cho kiểm thử trình duyệt
window.__game = () => game;
window.__mode = () => mode;
window.__start = (n) => startNight(n);

// ---------- chế độ benchmark (Ticket-04 §1): /?bench=1&seed=42&duration=30 — do src/bench.js mở ----------
async function runBench() {
  const { benchScenario, benchCamera, BENCH } = await import('/bench-scene.js');
  const seed = Number(Q.get('seed') ?? 42), duration = Number(Q.get('duration') ?? 30);
  const post = (path, body) => fetch(path, { method: 'POST', body: JSON.stringify(body), keepalive: true }).catch(() => {});
  renderer.setPixelRatio(1); renderer.setSize(innerWidth, innerHeight); // đúng 1280×720 điểm ảnh, không nhân tỉ lệ màn hình
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  $('hud').style.display = 'none'; screenEl.style.display = 'none';
  buildLevel(BENCH.night);
  game = new Game({ tuning: T, seed, night: BENCH.night, scenario: benchScenario(seed), bench: true });
  mode = 'bench';
  const noInput = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
  let t0 = null, lastNow = null, prev = null, acc = 0;
  const dts = [];
  const gl = renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  const tEnd = BENCH.warmup_s + duration;
  const bframe = (now) => {
    if (t0 === null) t0 = now;
    const t = (now - t0) / 1000;
    const dt = lastNow === null ? 0 : Math.min(0.1, (now - lastNow) / 1000); lastNow = now; acc += dt;
    while (acc >= 1 / TPS) { acc -= 1 / TPS; game.step(noInput); }
    syncMeshes(t);
    const [cx, cy, cz] = benchCamera(t);
    camera.position.set(cx, cy, cz); camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    if (prev === null) post('/__bench/first-frame', {});
    if (t > tEnd) {
      post('/__bench/result', { dts, gpu, ua: navigator.userAgent, three: THREE.REVISION, size: [innerWidth, innerHeight], dpr: devicePixelRatio, shades: game.shades.length, motes: game.motes.length });
      return;
    }
    if (t >= BENCH.warmup_s && prev !== null) dts.push(now - prev);
    prev = now;
    requestAnimationFrame(bframe);
  };
  requestAnimationFrame(bframe);
}

if (Q.has('bench')) runBench();
else {
  buildLevel(1);
  showMenu();
  if (Q.has('autostart')) { total = 0; startNight(Number(Q.get('night')) || 1); }
  requestAnimationFrame(frame);
}
