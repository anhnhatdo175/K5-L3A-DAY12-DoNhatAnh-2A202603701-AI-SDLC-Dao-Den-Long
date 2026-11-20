import * as THREE from '/three.module.js';
import { Game, EMPTY_INPUT, ISLAND_RADIUS, TPS } from '/sim.js';

const contract = await (await fetch('/game.contract.json')).json();
const T = contract.tuning;
const $ = (id) => document.getElementById(id);

// ---------- renderer / cảnh ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x120a24);
scene.fog = new THREE.FogExp2(0x1a0f33, 0.018);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 300);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

const ambient = new THREE.AmbientLight(0x8a6fc0, 1.0);
const moon = new THREE.DirectionalLight(0x9a8cff, 0.35);
moon.position.set(-20, 40, 10);
scene.add(ambient, moon);

// đảo + biển mây
const island = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS - 3, 4, 48), new THREE.MeshLambertMaterial({ color: 0x3b3a5c }));
island.position.y = -2; scene.add(island);
const grass = new THREE.Mesh(new THREE.CircleGeometry(ISLAND_RADIUS - 0.4, 48), new THREE.MeshLambertMaterial({ color: 0x5d5a94 }));
grass.rotation.x = -Math.PI / 2; grass.position.y = 0.01; scene.add(grass);
const clouds = [];
for (let i = 0; i < 40; i++) {
  const c = new THREE.Mesh(new THREE.SphereGeometry(6 + (i % 5) * 2, 10, 8), new THREE.MeshLambertMaterial({ color: 0x2a1f4d, transparent: true, opacity: 0.8 }));
  const a = (i / 40) * Math.PI * 2, r = ISLAND_RADIUS + 10 + (i % 7) * 6;
  c.position.set(Math.sin(a) * r, -7 - (i % 3) * 2, Math.cos(a) * r); c.scale.y = 0.45;
  scene.add(c); clouds.push(c);
}
// cây/đá trang trí (tất định, chỉ hiển thị)
const deco = new THREE.Group(); scene.add(deco);
for (let i = 0; i < 26; i++) {
  const a = i * 2.399963, r = 8 + ((i * 37) % 28);
  const x = Math.sin(a) * r, z = Math.cos(a) * r;
  if (Math.abs(Math.hypot(x, z) - 25) < 5) continue;
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6 + (i % 3) * 0.3), new THREE.MeshLambertMaterial({ color: 0x57507f }));
  rock.position.set(x, 0.3, z); deco.add(rock);
}

// ---------- đối tượng ----------
function makeLantern() {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 3.2, 8), new THREE.MeshLambertMaterial({ color: 0x5a3b2a }));
  post.position.y = 1.6;
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 12), new THREE.MeshStandardMaterial({ color: 0x3a2a4a, emissive: 0xffa43a, emissiveIntensity: 0 }));
  lamp.position.y = 3.6; lamp.scale.y = 1.2;
  const light = new THREE.PointLight(0xffb34d, 0, 28, 1.6); light.position.y = 3.6;
  const ring = new THREE.Mesh(new THREE.RingGeometry(T.safe_radius - 0.15, T.safe_radius, 48), new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.0, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05;
  g.add(post, lamp, light, ring); g.userData = { lamp, light, ring };
  return g;
}
const hero = new THREE.Group();
{
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.6, 4, 10), new THREE.MeshLambertMaterial({ color: 0xf2b8a2 }));
  body.position.y = 0.7;
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.9, 12), new THREE.MeshLambertMaterial({ color: 0x4f8f8a }));
  robe.position.y = 0.45;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.5, 16), new THREE.MeshLambertMaterial({ color: 0xe8c77a }));
  hat.position.y = 1.5;
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffc860 }));
  lamp.position.set(0.5, 1.25, 0.2);
  const hl = new THREE.PointLight(0xffc060, 3.5, 14, 1.3); hl.position.set(0.5, 1.3, 0.2);
  hero.add(body, robe, hat, lamp, hl);
}
scene.add(hero);
const pulseRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, side: THREE.DoubleSide }));
pulseRing.rotation.x = -Math.PI / 2; scene.add(pulseRing);

const moteGeo = new THREE.SphereGeometry(0.16, 8, 6), moteMat = new THREE.MeshBasicMaterial({ color: 0xffe36a });
const shadeGeo = new THREE.SphereGeometry(0.9, 14, 10);
const eyeGeo = new THREE.SphereGeometry(0.12, 6, 6), eyeMat = new THREE.MeshBasicMaterial({ color: 0xd9a8ff });

let game, lanternObjs, moteObjs, shadeObjs, last, acc, ended, camYaw = 0, started = false, toastT = 0;
const keys = new Set();
let pendingJump = false, pendingInteract = false, pendingPulse = false;

function clearDynamic() {
  for (const o of [...(lanternObjs || []), ...Object.values(moteObjs || {}), ...Object.values(shadeObjs || {})]) scene.remove(o.g || o);
}
function newGame() {
  clearDynamic();
  game = new Game({ tuning: T, seed: (Math.random() * 2 ** 31) | 0 });
  lanternObjs = game.lanterns.map((l) => { const g = makeLantern(); g.position.set(l.x, 0, l.z); scene.add(g); return { g, id: l.id }; });
  moteObjs = {}; shadeObjs = {}; acc = 0; last = performance.now(); ended = false; lastLit = 0;
  $('cap').textContent = T.carry_capacity;
  $('msg').style.display = 'none';
}
let lastLit = 0;

function toast(t) { $('toast').textContent = t; $('toast').style.opacity = 1; toastT = 2.2; }

// ---------- input ----------
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  if (!started || ended) { if (e.code === 'Enter') start(); return; }
  if (e.code === 'Space') pendingJump = true;
  if (e.code === 'KeyE') pendingInteract = true;
  if (e.code === 'KeyF') pendingPulse = true;
  if (e.code === 'Enter') newGame();
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
let drag = false;
renderer.domElement.addEventListener('pointerdown', () => { drag = true; });
addEventListener('pointerup', () => { drag = false; });
addEventListener('pointermove', (e) => { if (drag) camYaw -= e.movementX * 0.4; });
$('btn').onclick = () => start();
function start() { started = true; newGame(); }

function readInput() {
  const k = (c) => keys.has(c);
  if (k('ArrowLeft')) camYaw += 90 / TPS;
  if (k('ArrowRight')) camYaw -= 90 / TPS;
  // Với camera nhìn theo +Z (yaw 0), phím phải = trục x âm của contract.
  const mx = (k('KeyA') ? 1 : 0) - (k('KeyD') ? 1 : 0);
  const mz = (k('KeyW') ? 1 : 0) - (k('KeyS') ? 1 : 0);
  const inp = { move: [mx, mz], cam_yaw_deg: camYaw, jump: pendingJump, interact: pendingInteract, pulse: pendingPulse };
  return inp;
}

// ---------- vòng lặp ----------
function syncMeshes(time) {
  const p = game.player;
  hero.position.set(p.x, p.y, p.z);
  hero.rotation.y = p.facing || 0;
  hero.visible = !(p.invuln > 0 && Math.floor(time * 12) % 2 === 0);
  const live = new Set();
  for (const m of game.motes) {
    live.add(m.id);
    let o = moteObjs[m.id];
    if (!o) { o = new THREE.Group(); o.add(new THREE.Mesh(moteGeo, moteMat)); o.add(new THREE.PointLight(0xffd36a, 0.5, 4)); scene.add(o); moteObjs[m.id] = o; }
    o.position.set(m.x, 0.9 + Math.sin(time * 2 + m.x) * 0.2, m.z);
  }
  for (const id of Object.keys(moteObjs)) if (!live.has(id)) { scene.remove(moteObjs[id]); delete moteObjs[id]; }
  const liveS = new Set();
  for (const s of game.shades) {
    liveS.add(s.id);
    let o = shadeObjs[s.id];
    if (!o) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(shadeGeo, new THREE.MeshLambertMaterial({ color: 0x1b0b2e, emissive: 0x3a0f5c, emissiveIntensity: 0.5, transparent: true, opacity: 0.92 }));
      body.scale.y = 1.15;
      const e1 = new THREE.Mesh(eyeGeo, eyeMat), e2 = new THREE.Mesh(eyeGeo, eyeMat);
      e1.position.set(-0.3, 0.25, 0.75); e2.position.set(0.3, 0.25, 0.75);
      g.add(body, e1, e2); scene.add(g); o = shadeObjs[s.id] = { g, body };
    }
    o.g.position.set(s.x, s.y + Math.sin(time * 3 + s.x) * 0.1, s.z);
    o.g.rotation.y = Math.atan2(p.x - s.x, p.z - s.z);
    const st = s.state === 'stunned';
    o.body.material.opacity = st ? 0.4 : 0.92;
    o.g.scale.setScalar(st ? 0.7 + 0.05 * Math.sin(time * 30) : 1);
  }
  for (const id of Object.keys(shadeObjs)) if (!liveS.has(id)) { scene.remove(shadeObjs[id].g); delete shadeObjs[id]; }

  let lit = 0;
  game.lanterns.forEach((l, i) => {
    const o = lanternObjs[i].g.userData;
    const frac = l.lit ? 1 : l.deposited / T.lantern_cost;
    if (l.lit) lit++;
    const tgt = l.lit ? 1 : frac * 0.45;
    o.lamp.material.emissiveIntensity += (tgt * 2 - o.lamp.material.emissiveIntensity) * 0.1;
    o.light.intensity += (tgt * 40 - o.light.intensity) * 0.1;
    o.ring.material.opacity = l.lit ? 0.35 : 0.08;
  });
  // đảo sáng dần
  const k = lit / game.lanterns.length;
  ambient.intensity += ((1.0 + k * 1.0) - ambient.intensity) * 0.05;
  scene.background.lerp(new THREE.Color().setHSL(0.72 - k * 0.55, 0.45, 0.07 + k * 0.17), 0.02);
  scene.fog.color.copy(scene.background);
  grass.material.color.lerp(new THREE.Color().setHSL(0.68 - k * 0.45, 0.3, 0.3 + k * 0.12), 0.02);
  if (lit > lastLit) { toast(`Thắp được ${lit}/${game.lanterns.length} đèn!`); lastLit = lit; }

  // camera ngôi thứ ba
  const th = (camYaw * Math.PI) / 180;
  const fx = Math.sin(th), fz = Math.cos(th);
  const tx = p.x - fx * 9, tz = p.z - fz * 9;
  camera.position.lerp(new THREE.Vector3(tx, p.y * 0.5 + 6, tz), 0.15);
  camera.lookAt(p.x, p.y + 1.2, p.z);

  for (const c of clouds) c.position.y += Math.sin(time + c.position.x) * 0.002;
}

function hud() {
  const p = game.player;
  $('flames').textContent = '🔥'.repeat(p.flames) + '🖤'.repeat(Math.max(0, T.flames - p.flames));
  $('carried').textContent = p.carried;
  $('bar').firstElementChild.style.width = `${(p.carried / T.carry_capacity) * 100}%`;
  $('score').textContent = game.score;
  $('lit').textContent = game.lanterns.filter((l) => l.lit).length;
  const tl = Math.max(0, Math.ceil(game.timeLeft()));
  $('time').textContent = `${Math.floor(tl / 60)}:${String(tl % 60).padStart(2, '0')}`;
}

let pulseT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (!game) { renderer.render(scene, camera); return; }
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (!ended) {
    acc += dt;
    while (acc >= 1 / TPS && !ended) {
      acc -= 1 / TPS;
      const inp = readInput();
      pendingJump = pendingInteract = pendingPulse = false;
      // nút kích hoạt theo cạnh: giữ 1 tick true rồi tự nhả ở tick sau
      for (const ev of game.step(inp)) {
        if (ev.name === 'pulse') { pulseT = 0.5; }
        if (ev.name === 'player_hit') toast(ev.data.by === 'fall' ? 'Rơi khỏi đảo!' : 'Bóng Mực chạm Mây!');
        if (ev.name === 'deposit') toast(`Nạp ${ev.data.amount} ánh sáng (${ev.data.deposited}/${T.lantern_cost})`);
      }
      if (game.state !== 'playing') { ended = true; showEnd(); }
    }
  }
  const time = now / 1000;
  if (pulseT > 0) {
    pulseT -= dt;
    const f = 1 - Math.max(0, pulseT) / 0.5;
    pulseRing.position.set(game.player.x, 0.1, game.player.z);
    pulseRing.scale.setScalar(1 + f * T.pulse_radius);
    pulseRing.material.opacity = 0.8 * (1 - f);
  } else pulseRing.material.opacity = 0;
  if (toastT > 0 && (toastT -= dt) <= 0) $('toast').style.opacity = 0;
  syncMeshes(time);
  hud();
  renderer.render(scene, camera);
}

function showEnd() {
  const won = game.state === 'won';
  $('mt').textContent = won ? 'Đảo đã sáng! 🏮' : 'Sương đen nuốt chửng...';
  $('ms').textContent = `${won ? 'Mây đã thắp lại tất cả Đèn Lồng.' : 'Mây đã kiệt sức.'} Điểm: ${game.score}`;
  $('btn').textContent = 'Chơi lại (Enter)';
  $('msg').style.display = 'flex';
}

// hook cho kiểm thử trình duyệt
window.__game = () => game;
requestAnimationFrame(frame);
if (location.search.includes('autostart')) start();
