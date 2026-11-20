// Lõi mô phỏng Đảo Đèn Lồng (Contract v1.1): thuần logic, tất định, không phụ thuộc DOM/Node.
// Dùng chung cho headless (Node) và client web (trình duyệt). Thứ tự xử lý một tick xem SPEC.md §4.
import { WORLDS, TPS, navTarget } from './worlds.js';

export { TPS, WORLDS };

// ---- hằng số không nằm trong tuning (Ticket-02) ----
export const JUMP_V = 7;
export const GRAVITY = 20;
export const FALL_Y = -10;
export const FALL_WAIT = 60;
export const CHARM_SPEED = 7.2;
export const CHARM_TICKS = 600;
export const CHARM_RESPAWN = 2700;
export const MOTE_INIT = 20;
export const MOTE_CAP = 30;
export const MOTE_EVERY = 240;
export const DROP_TTL = 480;
export const PULSE_Y = 0.8;
export const PUSH_TICKS = 15;
export const RECOIL_TICKS = 60;
export const RECOIL_M = 2;
export const DETECT = 12;
export const LOSE = 18;
export const WANDER_SPEED = 2;
export const EJECT_TICKS = 30;
export const STEP_TOL = 0.5;
export const REACH_Y = 1.5;
export const SHADE_FIRST = 300;
export const DRIFTER_SPEED = 7;
export const DRIFTER_IDLE = 2;
export const DRIFTER_MAX = 2;
export const DRIFTER_EVERY = 1200;
export const DRIFTER_TOUCH = 1.2;
export const DRIFTER_DETECT = 15;
export const DRIFTER_MIN_CARRY = 5;
export const DRIFTER_STEAL = 3;
export const DRIFTER_FLEE = 240;
export const DRIFTER_VANISH = 120;
export const WIND_PERIOD = 1800;
export const WIND_DURATION = 300;
export const WIND_WARN = 120;
export const WIND_SPEED = 2;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const r3 = (n) => Math.round(n * 1000) / 1000 + 0; // +0 tránh -0
export const r1 = (n) => Math.round(n * 10) / 10 + 0;
const r3v = (a) => a.map(r3);
const idNum = (id) => parseInt(String(id).replace(/\D+/g, ''), 10) || 0;
const byId = (a, b) => idNum(a.id) - idNum(b.id) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export const EMPTY_INPUT = () => ({ move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false });

export class Game {
  /**
   * @param {object} o
   * @param {object} o.tuning   tuning từ game.contract.json
   * @param {number} o.seed
   * @param {number} [o.night]  1..3
   * @param {object} [o.scenario] đã được validate
   */
  constructor({ tuning, seed = 1, night = 1, scenario = {} }) {
    this.t = tuning;
    this.sc = tuning.score;
    this.night = night;
    this.w = WORLDS[night];
    this.rng = mulberry32(seed);
    this.tick = 0; // tick tường (kể cả khi tạm dừng)
    this.steps = 0; // sim_tick
    this.state = 'playing';
    this.paused = false;
    this.started = false;
    this.score = 0;
    this.events = [];
    this.prev = { jump: false, interact: false, pulse: false, dash: false, pause: false };
    this.nextMote = 1;
    this.randomMotes = scenario.random_motes !== false;
    this.randomShades = scenario.random_shades !== false;
    this.randomDrifters = scenario.random_drifters !== false;
    this.windOn = scenario.wind_enabled ?? this.w.wind;
    this.invulnTicks = Math.round(tuning.invuln_s * TPS);
    this.cdPulse = Math.round(tuning.pulse_cooldown_s * TPS);
    this.cdDash = Math.round(tuning.dash_cooldown_s * TPS);
    this.dashTicks = Math.round(tuning.dash_duration_s * TPS);
    this.stunTicks = Math.round(tuning.pulse_stun_s * TPS);
    this.shadeSpeed = night === 3 ? this.w.shadeSpeed : tuning.shade_speed;
    this.wind = { dir: 0, warn: false, active: false };

    const dur = scenario.time_left_s ?? tuning[this.w.durationKey];
    this.ticksLeft0 = Math.round(dur * TPS);

    const sp = scenario.player || {};
    const pos = sp.pos || this.w.start;
    const successfulLights = sp.successful_lights ?? 0;
    const capacity = sp.capacity ?? Math.min(tuning.capacity_max ?? 20, 10 + 2 * successfulLights);
    this.player = {
      x: pos[0], y: pos[1], z: pos[2], vx: 0, vy: 0, vz: 0, facing: this.w.facing,
      flames: sp.flames ?? tuning.flames, carried: sp.carried ?? 0,
      invuln: sp.invuln_ticks ?? 0, dashCd: sp.dash_cd_ticks ?? 0, dashT: 0, dashDir: [0, 1],
      pulseCd: sp.pulse_cd_ticks ?? 0, charm: sp.charm_ticks ?? 0,
      launched: false, launchV: [0, 0], fallWait: 0, grounded: false,
      successful_lights: successfulLights, capacity,
    };
    const h0 = this._support(pos[0], pos[1], pos[1] + 1e-6);
    this.player.grounded = h0 !== null && pos[1] - h0 < 1e-6;

    // đèn
    this.lanterns = this.w.lanterns.map((p, i) => ({
      id: `L${i + 1}`, x: p[0], y: p[1], z: p[2],
      lit: false, deposited: 0, fuelUnits: 0, fuel: 0,
      ever_lit: false, relit_count: 0,
    }));
    for (const u of scenario.lanterns || []) {
      let l = this.lanterns.find((q) => q.id === u.id);
      if (!l) {
        l = { id: u.id, x: 0, y: 0, z: 0, lit: false, deposited: 0, fuelUnits: 0, fuel: 0, ever_lit: false, relit_count: 0 };
        this.lanterns.push(l);
      }
      if (u.pos) { l.x = u.pos[0]; l.y = u.pos[1]; l.z = u.pos[2]; }
      if (u.deposited !== undefined) l.deposited = u.deposited;
      if (u.ever_lit !== undefined) l.ever_lit = u.ever_lit;
      if (u.relit_count !== undefined) l.relit_count = u.relit_count;
      if (u.lit === true) {
        l.lit = true;
        if (u.deposited === undefined) l.deposited = tuning.lantern_cost;
        if (u.ever_lit === undefined) l.ever_lit = true;
        const f = u.fuel !== undefined ? u.fuel : 100;
        l.fuelUnits = Math.round(f * 60);
        l.fuel = l.fuelUnits / 60;
      } else if (u.lit === false) {
        l.lit = false;
        l.fuelUnits = 0;
        l.fuel = 0;
      } else if (u.fuel !== undefined) {
        l.fuelUnits = Math.round(u.fuel * 60);
        l.fuel = l.fuelUnits / 60;
      }
    }

    // đom đóm
    this.motes = [];
    if (scenario.motes) {
      for (const m of scenario.motes) this.motes.push({ id: `M${this.nextMote++}`, x: m[0], y: m[1], z: m[2], kind: 'random', ttl: null });
    } else if (this.randomMotes) {
      const pts = this.w.motePoints.slice();
      for (let i = 0; i < MOTE_INIT && pts.length; i++) {
        const k = Math.floor(this.rng() * pts.length);
        const [x, y, z] = pts.splice(k, 1)[0];
        this.motes.push({ id: `M${this.nextMote++}`, x, y, z, kind: 'random', ttl: null });
      }
    }

    // bùa
    const charmSrc = scenario.charms ?? this.w.charms.map((p, i) => ({ id: `C${i + 1}`, pos: p }));
    this.charms = charmSrc.map((c, i) => ({
      id: c.id ?? `C${i + 1}`, x: c.pos ? c.pos[0] : 0, y: c.pos ? c.pos[1] : 0, z: c.pos ? c.pos[2] : 0,
      available: c.available ?? true, respawn: c.respawn_ticks ?? 0,
    }));

    // Bóng Mực
    this.shades = [];
    this.nextShade = 1;
    for (const s of scenario.shades || []) {
      const id = s.id ?? this._freeId(this.shades, 'S', 'nextShade');
      const x = s.pos[0], z = s.pos[2];
      const o = {
        id, x, y: s.pos[1], z, state: 'wander',
        t: 0, eject: 0, push: 0, pdx: 1, pdz: 0, rx: 1, rz: 0,
        tx: x, tz: z, wt: 0,
        target_lantern_id: s.target_lantern_id ?? null,
        drainTicks: s.state_ticks ?? s.state_ticks_left ?? 0,
      };
      const d = Math.hypot(this.player.x - x, this.player.z - z);
      const st = s.state ?? (d <= DETECT ? 'chase' : 'wander');
      o.state = st;
      if (st === 'stunned') { o.t = s.state_ticks_left ?? this.stunTicks; o.push = 0; }
      else if (st === 'recoil') { o.t = s.state_ticks_left ?? RECOIL_TICKS; this._awayDir(o, o); }
      else if (st === 'spawning') o.t = s.state_ticks_left ?? 1;
      else if (st === 'drain') o.drainTicks = s.state_ticks ?? s.state_ticks_left ?? 0;
      this.shades.push(o);
    }

    // Gió Lạc
    this.drifters = [];
    this.nextDrifter = 1;
    for (const d of scenario.drifters || []) {
      this.drifters.push({
        id: d.id ?? this._freeId(this.drifters, 'D', 'nextDrifter'), x: d.pos[0], y: d.pos[1], z: d.pos[2],
        state: d.state ?? 'idle', stolen: d.stolen ?? 0, t: d.state_ticks_left ?? (d.state === 'flee' ? DRIFTER_FLEE : 0),
        used: (d.stolen ?? 0) > 0 || d.state === 'flee', tx: d.pos[0], tz: d.pos[2], wt: 0,
      });
    }
  }

  _freeId(list, pre, ctr) {
    for (;;) {
      const id = `${pre}${this[ctr]++}`;
      if (!list.some((s) => s.id === id)) return id;
    }
  }

  // ---------- hình học ----------
  _top(x, z) {
    let m = null;
    for (const s of this.w.surfaces) { const h = s.h(x, z); if (h !== null && (m === null || h > m)) m = h; }
    return m;
  }
  _support(x, z, yMax) {
    let m = null;
    for (const s of this.w.surfaces) { const h = s.h(x, z); if (h !== null && h <= yMax + 1e-9 && (m === null || h > m)) m = h; }
    return m;
  }
  _blocked(x, z, y, tol) {
    for (const o of this.w.obstacles) if (Math.hypot(x - o.x, z - o.z) < o.r && y < o.top) return true;
    const h = this._top(x, z);
    return h !== null && h > y + tol + 1e-9;
  }
  _awayDir(o, from) {
    const p = this.player;
    const dx = o.x - (from === o ? p.x : from.x), dz = o.z - (from === o ? p.z : from.z);
    const d = Math.hypot(dx, dz);
    o.rx = d > 1e-9 ? dx / d : 1; o.rz = d > 1e-9 ? dz / d : 0;
  }

  _emit(name, data) { this.events.push({ type: 'event', tick: this.tick, name, data }); }
  timeLeft() { return (this.ticksLeft0 - this.steps) / TPS; }
  _lit() { return this.lanterns.filter((l) => l.lit); }
  hasSafeZone(l) { return l.lit && l.fuelUnits >= 1800; }
  _getSafeLanterns() { return this.lanterns.filter((l) => this.hasSafeZone(l)); }

  // ---------- Mây ----------
  _hurt(by) {
    const p = this.player;
    p.flames -= 1;
    const dropped = Math.floor(p.carried / 2);
    p.carried -= dropped;
    p.invuln = this.invulnTicks;
    this._emit('player_hit', { by, flames: p.flames, dropped });
    for (let i = 0; i < dropped; i++) {
      let x = p.x, z = p.z, y = p.y;
      for (let k = 0; k < 8; k++) {
        const a = this.rng() * 2 * Math.PI, r = 1.5 + this.rng();
        const cx = p.x + r * Math.cos(a), cz = p.z + r * Math.sin(a);
        const h = this._support(cx, cz, p.y + STEP_TOL);
        if (h !== null && !this._blocked(cx, cz, h, STEP_TOL)) { x = cx; z = cz; y = h; break; }
      }
      this.motes.push({ id: `M${this.nextMote++}`, x, y, z, kind: 'dropped', ttl: DROP_TTL });
    }
  }

  _fall() {
    const p = this.player;
    const lost = p.carried;
    p.flames -= 1; p.carried = 0; p.fallWait = FALL_WAIT;
    p.dashT = 0; p.launched = false; p.vx = p.vz = p.vy = 0;
    this._emit('player_hit', { by: 'fall', flames: p.flames, dropped: 0, lost });
  }

  _respawn() {
    const p = this.player, s = this.w.start;
    p.x = s[0]; p.y = s[1]; p.z = s[2]; p.vx = p.vy = p.vz = 0;
    p.grounded = true; p.invuln = this.invulnTicks; p.launched = false; p.dashT = 0;
  }

  _movePlayer(vx, vz) {
    const p = this.player, tol = p.grounded ? STEP_TOL : 0.01;
    const nx = p.x + vx / TPS, nz = p.z + vz / TPS;
    if (!this._blocked(nx, nz, p.y, tol)) { p.x = nx; p.z = nz; }
    else if (!this._blocked(nx, p.z, p.y, tol)) p.x = nx;
    else if (!this._blocked(p.x, nz, p.y, tol)) p.z = nz;
  }

  _stepPlayer(input, edges) {
    const p = this.player, t = this.t;
    let [mx, mz] = input.move;
    const len = Math.min(1, Math.hypot(mx, mz));
    if (len > 0) { const n = Math.hypot(mx, mz); mx /= n; mz /= n; }
    const th = (input.cam_yaw_deg * Math.PI) / 180;
    const wx = (mx * Math.cos(th) + mz * Math.sin(th)) * len;
    const wz = (-mx * Math.sin(th) + mz * Math.cos(th)) * len;

    if (edges.jump && p.grounded && p.dashT === 0) { p.vy = JUMP_V; p.grounded = false; }
    if (edges.dash && p.dashT === 0 && p.dashCd === 0) {
      const dir = len > 0 ? [wx / len, wz / len] : [Math.sin(p.facing), Math.cos(p.facing)];
      p.dashT = this.dashTicks; p.dashDir = dir; p.dashCd = p.charm > 0 ? 0 : this.cdDash; p.vy = 0;
      this._emit('dash', {});
    }

    let vx, vz;
    if (p.dashT > 0) { vx = p.dashDir[0] * t.dash_speed; vz = p.dashDir[1] * t.dash_speed; p.facing = Math.atan2(p.dashDir[0], p.dashDir[1]); }
    else if (p.launched) { vx = p.launchV[0]; vz = p.launchV[1]; }
    else {
      const sp = p.charm > 0 ? CHARM_SPEED : t.player_speed;
      vx = wx * sp; vz = wz * sp;
      if (len > 0) p.facing = Math.atan2(wx, wz);
    }
    p.vx = vx; p.vz = vz;
    let ax = vx, az = vz;
    if (this.wind.active && this.windOn) {
      ax += Math.cos((this.wind.dir * Math.PI) / 180) * WIND_SPEED;
      az += Math.sin((this.wind.dir * Math.PI) / 180) * WIND_SPEED;
    }
    const dashing = p.dashT > 0;
    this._movePlayer(ax, az);
    if (dashing) p.dashT--;

    // dọc
    if (p.grounded) {
      const h = this._support(p.x, p.z, p.y + STEP_TOL);
      if (h !== null && p.y - h <= STEP_TOL + 1e-9) { p.y = h; p.vy = 0; } else p.grounded = false;
    }
    if (!p.grounded) {
      if (dashing) p.vy = 0; // lướt trên không giữ nguyên độ cao
      else {
        const y0 = p.y;
        p.vy -= GRAVITY / TPS;
        p.y += p.vy / TPS;
        if (p.vy <= 0) {
          const h = this._support(p.x, p.z, y0 + 0.01);
          if (h !== null && p.y <= h) { p.y = h; p.vy = 0; p.grounded = true; p.launched = false; }
        }
      }
    }

    // bục nhảy
    if (!p.launched) {
      for (const pd of this.w.pads) {
        if (Math.hypot(p.x - pd.x, p.z - pd.z) <= pd.r && Math.abs(p.y - pd.y) <= 0.5) {
          p.launched = true; p.vy = pd.vy; p.launchV = [pd.dir[0] * pd.vh, pd.dir[1] * pd.vh]; p.grounded = false;
          break;
        }
      }
    }
    if (p.y < FALL_Y) this._fall();
  }

  // ---------- Bóng Mực ----------
  _shadeOk(x, z) {
    if (this._top(x, z) === null) return false;
    for (const o of this.w.obstacles) if (Math.hypot(x - o.x, z - o.z) < o.r) return false;
    return true;
  }
  _zoneClamp(x, z) {
    const R = this.t.safe_radius;
    for (const l of this._getSafeLanterns()) {
      const dx = x - l.x, dz = z - l.z, d = Math.hypot(dx, dz);
      if (d < R) { if (d < 1e-9) x = l.x + R; else { x = l.x + (dx / d) * R; z = l.z + (dz / d) * R; } }
    }
    return [x, z];
  }
  _moveShade(s, dx, dz, free = false) {
    const tryPos = (nx, nz) => {
      if (!free) [nx, nz] = this._zoneClamp(nx, nz);
      return this._shadeOk(nx, nz) ? [nx, nz] : null;
    };
    const r = tryPos(s.x + dx, s.z + dz) || tryPos(s.x + dx, s.z) || tryPos(s.x, s.z + dz);
    if (r) { s.x = r[0]; s.z = r[1]; const h = this._top(s.x, s.z); if (h !== null) s.y = h + 1; }
  }
  _wanderPick(s) {
    for (let i = 0; i < 6; i++) {
      const a = this.rng() * 2 * Math.PI, r = 4 + this.rng() * 8;
      const tx = s.x + r * Math.cos(a), tz = s.z + r * Math.sin(a);
      if (this._shadeOk(tx, tz)) { s.tx = tx; s.tz = tz; s.wt = 120 + Math.floor(this.rng() * 120); return; }
    }
    s.tx = s.x; s.tz = s.z; s.wt = 60;
  }
  _towards(s, tx, tz, speed) {
    const dx = tx - s.x, dz = tz - s.z, d = Math.hypot(dx, dz);
    if (d < 1e-9) return;
    const k = Math.min(speed / TPS, d) / d;
    this._moveShade(s, dx * k, dz * k);
  }
  _stepShade(s) {
    const p = this.player, t = this.t;
    if (s.state === 'spawning') return;
    if (s.eject > 0) {
      let near = null, nd = Infinity;
      for (const l of this._getSafeLanterns()) { const d = Math.hypot(s.x - l.x, s.z - l.z); if (d < t.safe_radius && d < nd) { near = l; nd = d; } }
      if (!near) { s.eject = 0; return; }
      const ux = nd > 1e-9 ? (s.x - near.x) / nd : 1, uz = nd > 1e-9 ? (s.z - near.z) / nd : 0;
      const m = Math.min(t.safe_radius / EJECT_TICKS, t.safe_radius - nd);
      this._moveShade(s, ux * m, uz * m, true);
      s.eject--;
      if (Math.hypot(s.x - near.x, s.z - near.z) >= t.safe_radius - 1e-9) s.eject = 0;
      return;
    }
    if (s.state === 'stunned') {
      if (s.push > 0) { this._moveShade(s, (s.pdx * t.pulse_push_m) / PUSH_TICKS, (s.pdz * t.pulse_push_m) / PUSH_TICKS); s.push--; }
      return;
    }
    if (s.state === 'recoil') { this._moveShade(s, (s.rx * RECOIL_M) / RECOIL_TICKS, (s.rz * RECOIL_M) / RECOIL_TICKS); return; }

    const tracking = p.fallWait === 0;
    const dPlayer = Math.hypot(p.x - s.x, p.z - s.z);

    if (s.state === 'drain') {
      if (tracking && dPlayer <= 6) {
        s.state = 'chase';
        s.drainTicks = 0;
        return;
      }
      let targetL = null;
      if (s.target_lantern_id) {
        targetL = this.lanterns.find((l) => l.id === s.target_lantern_id);
      }
      if (!targetL) {
        let bestDist = Infinity;
        for (const l of this.lanterns) {
          const d = Math.hypot(s.x - l.x, s.z - l.z);
          if (d < bestDist) { bestDist = d; targetL = l; }
        }
      }
      if (!targetL || !targetL.lit || targetL.fuelUnits >= 1800 || Math.hypot(s.x - targetL.x, s.z - targetL.z) > 2.0 + 1e-9) {
        s.state = 'wander';
        s.drainTicks = 0;
        return;
      }
      return;
    }

    if (s.state === 'wander' && tracking && dPlayer <= DETECT) s.state = 'chase';
    else if (s.state === 'chase' && (!tracking || dPlayer > LOSE)) s.state = 'wander';

    if (s.state === 'chase') {
      const tg = navTarget(this.night, s, p);
      this._towards(s, tg.x, tg.z, this.shadeSpeed);
    } else {
      let targetL = null;
      if (s.target_lantern_id) {
        const candidate = this.lanterns.find((l) => l.id === s.target_lantern_id);
        if (candidate && (candidate.lit ? candidate.fuelUnits < 1800 : true)) {
          targetL = candidate;
        }
      }
      if (!targetL) {
        const weak = this.lanterns.filter((l) => l.lit && l.fuelUnits < 1800);
        if (weak.length > 0) {
          let bd = Infinity;
          for (const l of weak) {
            const dist = Math.hypot(l.x - s.x, l.z - s.z);
            if (dist < bd - 1e-12 || (Math.abs(dist - bd) <= 1e-12 && byId(l, targetL) < 0)) {
              targetL = l; bd = dist;
            }
          }
        } else {
          const unlit = this.lanterns.filter((l) => !l.lit);
          if (unlit.length > 0) {
            let bd = Infinity;
            for (const l of unlit) {
              const dist = Math.hypot(l.x - s.x, l.z - s.z);
              if (dist < bd - 1e-12 || (Math.abs(dist - bd) <= 1e-12 && byId(l, targetL) < 0)) {
                targetL = l; bd = dist;
              }
            }
          }
        }
      }

      if (targetL) {
        const distL = Math.hypot(targetL.x - s.x, targetL.z - s.z);
        if (targetL.lit && targetL.fuelUnits < 1800 && distL <= 2.0 + 1e-9) {
          s.state = 'drain';
          s.drainTicks = 0;
          s.target_lantern_id = targetL.id;
        } else {
          const navTg = navTarget(this.night, s, targetL);
          this._towards(s, navTg.x, navTg.z, WANDER_SPEED);
        }
      } else {
        if (--s.wt <= 0 || Math.hypot(s.tx - s.x, s.tz - s.z) < 0.5) this._wanderPick(s);
        this._towards(s, s.tx, s.tz, WANDER_SPEED);
      }
    }
  }

  // ---------- Gió Lạc ----------
  _stepDrifter(d) {
    const p = this.player;
    const dist = Math.hypot(p.x - d.x, p.z - d.z);
    if (d.state === 'idle' || d.state === 'chase') {
      d.state = p.carried >= DRIFTER_MIN_CARRY && dist <= DRIFTER_DETECT && p.fallWait === 0 ? 'chase' : 'idle';
    }
    let dx = 0, dz = 0, sp = 0;
    if (d.state === 'chase') { dx = p.x - d.x; dz = p.z - d.z; sp = DRIFTER_SPEED; }
    else if (d.state === 'flee') { dx = d.x - p.x; dz = d.z - p.z; if (Math.hypot(dx, dz) < 1e-9) dx = 1; sp = DRIFTER_SPEED; }
    else {
      if (--d.wt <= 0 || Math.hypot(d.tx - d.x, d.tz - d.z) < 0.5) {
        const a = this.rng() * 2 * Math.PI, r = 4 + this.rng() * 8;
        d.tx = d.x + r * Math.cos(a); d.tz = d.z + r * Math.sin(a); d.wt = 120 + Math.floor(this.rng() * 120);
      }
      dx = d.tx - d.x; dz = d.tz - d.z; sp = DRIFTER_IDLE;
    }
    const n = Math.hypot(dx, dz);
    if (n > 1e-9) { const k = Math.min(sp / TPS, n) / n; d.x += dx * k; d.z += dz * k; }
    const h = this._top(d.x, d.z);
    d.y = (h ?? p.y) + 1.5;
  }

  _dropAt(x, z, n) {
    const h = this._top(x, z) ?? 0;
    for (let i = 0; i < n; i++) {
      const a = i * 2.399963, r = i === 0 ? 0 : 0.4 + 0.1 * i;
      this.motes.push({ id: `M${this.nextMote++}`, x: x + r * Math.cos(a), y: h, z: z + r * Math.sin(a), kind: 'dropped', ttl: DROP_TTL });
    }
  }

  _end(result, reason) {
    this.state = result;
    if (result === 'won') {
      let winBonus = 0;
      for (const l of this.lanterns) {
        if (l.lit) winBonus += 50 + Math.floor(l.fuel);
      }
      winBonus += this.player.flames * 50;
      this.score += winBonus;
    }
    this._emit('game_over', { result, reason });
  }

  /** Chạy một bước. input: {move,cam_yaw_deg,jump,interact,pulse,dash,pause}. Trả về event của bước. */
  step(input) {
    this.events = [];
    if (this.state !== 'playing') return this.events;
    const t = this.t, p = this.player;
    this.tick++;
    if (!this.started) { this.started = true; this._emit('night_start', { night: this.night }); }

    // 1. input / pause
    const edges = {};
    for (const k of ['jump', 'interact', 'pulse', 'dash', 'pause']) { edges[k] = !!input[k] && !this.prev[k]; this.prev[k] = !!input[k]; }
    if (edges.pause) {
      if (!this.paused) { this.paused = true; this._emit('paused', {}); return this.events; }
      this.paused = false; this._emit('resumed', {});
    }
    if (this.paused) return this.events;
    this.steps++;

    // 2. bộ đếm
    if (p.invuln > 0) p.invuln--;
    if (p.dashCd > 0) p.dashCd--;
    if (p.pulseCd > 0) p.pulseCd--;
    if (p.charm > 0) p.charm--;
    let respawnNow = false;
    if (p.fallWait > 0 && --p.fallWait === 0) respawnNow = true;
    for (const c of this.charms) if (!c.available && c.respawn > 0 && --c.respawn === 0) c.available = true;
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i];
      if (m.ttl !== null && --m.ttl <= 0) this.motes.splice(i, 1);
    }
    for (const s of this.shades) {
      if (s.state === 'stunned' || s.state === 'recoil' || s.state === 'spawning') {
        if (s.t > 0 && --s.t === 0) { s.state = 'wander'; s.push = 0; s.wt = 0; }
      }
    }
    for (let i = this.drifters.length - 1; i >= 0; i--) {
      const d = this.drifters[i];
      if (d.t > 0 && --d.t === 0 && d.state === 'flee') this.drifters.splice(i, 1);
    }
    if (this.windOn) {
      const ph = this.steps % WIND_PERIOD;
      this.wind.active = this.steps >= WIND_PERIOD && ph < WIND_DURATION;
      this.wind.warn = !this.wind.active && ph >= WIND_PERIOD - WIND_WARN;
      if (ph === WIND_PERIOD - WIND_WARN) this.wind.dir = Math.floor(this.rng() * 360);
    }

    // Trừ dầu: hao hụt tự nhiên (1/60 mỗi tick) + bị hút (5/60 mỗi tick mỗi con)
    for (const l of this.lanterns) {
      if (!l.lit) continue;
      let drainUnits = 1; // tự hao 1.0/s = 1 unit (1/60) mỗi tick
      const drainingShades = this.shades.filter((s) => s.state === 'drain' && Math.hypot(s.x - l.x, s.z - l.z) <= 2.0 + 1e-9).sort(byId);
      for (const s of drainingShades) {
        drainUnits += 5; // 5.0/s = 5 units (5/60) mỗi tick
        s.drainTicks = (s.drainTicks || 0) + 1;
        if (s.drainTicks % 60 === 0) {
          const currentRemainingFuel = Math.max(0, l.fuelUnits - drainUnits) / 60;
          this._emit('fuel_drain', {
            lantern_id: l.id,
            shade_id: s.id,
            fuel: r1(currentRemainingFuel),
          });
        }
      }
      l.fuelUnits = Math.max(0, l.fuelUnits - drainUnits);
      l.fuel = l.fuelUnits / 60;
    }

    // Ngay sau bước 2: đèn có fuel <= 0 thì tắt
    for (const l of this.lanterns) {
      if (l.lit && l.fuelUnits <= 0) {
        l.lit = false;
        l.fuelUnits = 0;
        l.fuel = 0;
        l.deposited = 0;
        l.ever_lit = true;
        this._emit('lantern_out', { lantern_id: l.id });
        for (const s of this.shades) {
          if (s.state === 'drain' && Math.hypot(s.x - l.x, s.z - l.z) <= 2.0 + 1e-9) {
            s.state = 'wander';
            s.drainTicks = 0;
          }
        }
      }
    }

    // 3. di chuyển + rơi
    if (respawnNow) this._respawn(); // tick hồi sinh: đứng đúng điểm xuất phát, vận tốc 0
    else if (p.fallWait === 0) this._stepPlayer(input, edges);

    const acting = p.fallWait === 0;
    // 4. nhặt đom đóm / bùa
    if (acting) {
      for (let i = 0; i < this.motes.length && p.carried < p.capacity; ) {
        const m = this.motes[i];
        if (Math.hypot(m.x - p.x, m.z - p.z) <= t.pickup_radius && Math.abs(p.y - m.y) <= REACH_Y) {
          this.motes.splice(i, 1); p.carried++;
          this._emit('mote_picked', { carried: p.carried });
        } else i++;
      }
      for (const c of this.charms) {
        if (c.available && Math.hypot(c.x - p.x, c.z - p.z) <= t.pickup_radius && Math.abs(p.y - c.y) <= REACH_Y) {
          c.available = false; c.respawn = CHARM_RESPAWN; p.charm = CHARM_TICKS;
          this._emit('charm_picked', { charm_id: c.id, charm_ticks: CHARM_TICKS });
        }
      }
    }

    // 5. nạp đèn / châm dầu
    if (acting && edges.interact) {
      let best = null, bd = Infinity;
      for (const l of this.lanterns) {
        if (l.lit && l.fuelUnits >= 6000) continue;
        const d = Math.hypot(l.x - p.x, l.z - p.z);
        if (d <= t.interact_radius && (d < bd - 1e-12 || (Math.abs(d - bd) <= 1e-12 && byId(l, best) < 0))) { best = l; bd = d; }
      }
      if (best) {
        if (!best.lit) {
          const cost = best.ever_lit ? t.relight_cost : t.lantern_cost;
          const amount = Math.min(p.carried, Math.max(0, cost - best.deposited));
          if (amount > 0) {
            p.carried -= amount; best.deposited += amount; this.score += amount * 5;
            this._emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
          }
          if (best.deposited >= cost) {
            const isRelight = !!best.ever_lit;
            best.lit = true;
            best.fuelUnits = 6000;
            best.fuel = 100;
            best.ever_lit = true;
            if (isRelight) best.relit_count = (best.relit_count || 0) + 1;
            p.successful_lights = (p.successful_lights || 0) + 1;
            p.capacity = Math.min(t.capacity_max, 10 + 2 * p.successful_lights);
            this.score += isRelight ? 40 : 100;
            this._emit('lantern_lit', { lantern_id: best.id, relight: isRelight });
            for (const s of this.shades) {
              if (s.state === 'spawning') continue;
              if (Math.hypot(s.x - best.x, s.z - best.z) < t.safe_radius) {
                s.eject = EJECT_TICKS;
                if (s.state === 'drain') { s.state = 'wander'; s.drainTicks = 0; }
              }
            }
          }
        } else {
          const neededMotes = Math.ceil((6000 - best.fuelUnits) / 600);
          const used = Math.min(p.carried, neededMotes);
          if (used > 0) {
            p.carried -= used;
            const oldFuelUnits = best.fuelUnits;
            best.fuelUnits = Math.min(6000, best.fuelUnits + used * 600);
            best.fuel = best.fuelUnits / 60;
            this.score += used * 5;
            this._emit('refuel', { lantern_id: best.id, amount: used, fuel: r1(best.fuel) });
            if (oldFuelUnits < 1800 && best.fuelUnits >= 1800) {
              for (const s of this.shades) {
                if (s.state === 'spawning') continue;
                if (Math.hypot(s.x - best.x, s.z - best.z) < t.safe_radius) {
                  s.eject = EJECT_TICKS;
                  if (s.state === 'drain') { s.state = 'wander'; s.drainTicks = 0; }
                }
              }
            }
          }
        }
      }
    }

    // 6. vùng an toàn: Bóng đang ở trong vùng của đèn sáng bị đẩy ra
    for (const s of this.shades) {
      if (s.state === 'spawning' || s.eject > 0) continue;
      if (this._getSafeLanterns().some((l) => Math.hypot(s.x - l.x, s.z - l.z) < t.safe_radius)) {
        s.eject = EJECT_TICKS;
        if (s.state === 'drain') { s.state = 'wander'; s.drainTicks = 0; }
      }
    }

    // 7. Tỏa Sáng
    if (acting && edges.pulse && p.pulseCd === 0 && p.carried >= t.pulse_cost) {
      p.carried -= t.pulse_cost; p.pulseCd = this.cdPulse;
      const cx = p.x, cy = p.y + PULSE_Y, cz = p.z;
      const ids = [], drops = [];
      for (const s of this.shades) {
        if (s.state === 'spawning') continue;
        if (Math.hypot(s.x - cx, s.y - cy, s.z - cz) <= t.pulse_radius) {
          ids.push(s.id);
          const wasDrain = s.state === 'drain';
          s.state = 'stunned'; s.t = this.stunTicks; s.push = PUSH_TICKS;
          s.drainTicks = 0;
          const dx = s.x - cx, dz = s.z - cz, d = Math.hypot(dx, dz);
          s.pdx = d > 1e-9 ? dx / d : 1; s.pdz = d > 1e-9 ? dz / d : 0;
          this.score += wasDrain ? 15 : 5;
        }
      }
      this._emit('pulse', { stunned_ids: ids });
      for (const d of this.drifters) {
        if (Math.hypot(d.x - cx, d.y - cy, d.z - cz) > t.pulse_radius) continue;
        if (d.state === 'chase') { d.state = 'flee'; d.t = DRIFTER_FLEE; d.used = true; }
        else if (d.state === 'flee' && d.stolen > 0) {
          const amount = d.stolen; d.stolen = 0; d.t = DRIFTER_VANISH;
          this._dropAt(d.x, d.z, amount);
          drops.push({ drifter_id: d.id, amount });
        }
      }
      for (const dr of drops) this._emit('drifter_drop', dr);
    }

    // 8. di chuyển Bóng Mực & Gió Lạc
    for (const s of this.shades) this._stepShade(s);
    for (const d of this.drifters) this._stepDrifter(d);

    // 9. chạm: Gió Lạc cướp trước, rồi Bóng Mực gây hit
    if (acting) {
      for (const d of [...this.drifters].sort(byId)) {
        if (d.state !== 'chase' || d.used) continue;
        if (Math.hypot(d.x - p.x, d.z - p.z) <= DRIFTER_TOUCH) {
          const amount = Math.min(DRIFTER_STEAL, p.carried);
          if (amount <= 0) continue;
          p.carried -= amount; d.stolen = amount; d.used = true; d.state = 'flee'; d.t = DRIFTER_FLEE;
          this._emit('drifter_steal', { drifter_id: d.id, amount, carried: p.carried });
        }
      }
      for (const s of [...this.shades].sort(byId)) {
        if (s.state !== 'chase' && s.state !== 'wander') continue;
        if (s.eject > 0) continue;
        if (Math.hypot(s.x - p.x, s.z - p.z) <= t.shade_hit_radius && Math.abs(p.y - s.y) <= REACH_Y) {
          if (p.invuln > 0) continue;
          this._hurt('shade');
          s.state = 'recoil'; s.t = RECOIL_TICKS; this._awayDir(s, s);
          break;
        }
      }
    }

    // 10. sinh theo lịch (thực thể mới chỉ tương tác từ tick sau)
    if (this.randomShades && this.steps >= SHADE_FIRST && (this.steps === SHADE_FIRST || (this.steps - SHADE_FIRST) % this.w.shadeEveryTicks === 0)) {
      const n = this.steps === SHADE_FIRST ? 2 : 1;
      for (let i = 0; i < n && this.shades.length < this.w.shadeMax; i++) {
        const safe = this._getSafeLanterns();
        const ok = this.w.shadePoints.filter(([x, , z]) =>
          Math.hypot(x - p.x, z - p.z) >= 15 &&
          !safe.some((l) => Math.hypot(x - l.x, z - l.z) < t.safe_radius) &&
          !this.shades.some((s) => Math.hypot(s.x - x, s.z - z) < 1));
        if (!ok.length) continue;
        const [x, , z] = ok[Math.floor(this.rng() * ok.length)];
        const id = this._freeId(this.shades, 'S', 'nextShade');
        this.shades.push({
          id, x, y: (this._top(x, z) ?? 0) + 1, z, state: 'spawning',
          t: 1, eject: 0, push: 0, pdx: 1, pdz: 0, rx: 1, rz: 0,
          tx: x, tz: z, wt: 0, target_lantern_id: null, drainTicks: 0,
        });
        this._emit('shade_spawned', { id });
      }
    }
    if (this.randomDrifters && this.w.drifters && this.steps % DRIFTER_EVERY === 0 && this.drifters.length < DRIFTER_MAX) {
      const pts = this.w.shadePoints;
      const [x, , z] = pts[Math.floor(this.rng() * pts.length)];
      this.drifters.push({ id: this._freeId(this.drifters, 'D', 'nextDrifter'), x, y: (this._top(x, z) ?? 0) + 1.5, z, state: 'idle', stolen: 0, t: 0, used: false, tx: x, tz: z, wt: 0 });
    }
    if (this.randomMotes && this.steps % MOTE_EVERY === 0 && this.motes.length < MOTE_CAP) {
      const empty = this.w.motePoints.filter(([x, , z]) => !this.motes.some((m) => Math.abs(m.x - x) < 0.01 && Math.abs(m.z - z) < 0.01));
      if (empty.length) {
        const [x, y, z] = empty[Math.floor(this.rng() * empty.length)];
        this.motes.push({ id: `M${this.nextMote++}`, x, y, z, kind: 'random', ttl: null });
      }
    }

    // 11. thắng / thua
    if (p.flames <= 0) {
      this._end('lost', 'no_flames');
    } else if (this.ticksLeft0 - this.steps <= 0) {
      const litCount = this.lanterns.filter((l) => l.lit).length;
      const winThreshold = Math.ceil(this.t.win_ratio * this.lanterns.length);
      if (litCount >= winThreshold) {
        this._end('won', 'dawn_survived');
      } else {
        this._end('lost', 'dawn');
      }
    }
    return this.events;
  }

  snapshot() {
    const p = this.player;
    return {
      type: 'snapshot', tick: this.tick, sim_tick: this.steps,
      state: this.paused && this.state === 'playing' ? 'paused' : this.state,
      night: this.night, time_left_s: r3(this.timeLeft()), score: this.score,
      wind: { active: !!(this.windOn && this.wind.active), dir_deg: this.wind.dir, warning: !!(this.windOn && this.wind.warn) },
      player: {
        pos: r3v([p.x, p.y, p.z]), vel: r3v([p.vx, p.vy, p.vz]), flames: p.flames, carried: p.carried,
        capacity: p.capacity, grounded: p.grounded,
        invuln: p.invuln > 0, dash_cd_s: r3(p.dashCd / TPS), pulse_cd_s: r3(p.pulseCd / TPS), charm_s: r3(p.charm / TPS),
      },
      lanterns: this.lanterns.map((l) => ({
        id: l.id, pos: r3v([l.x, l.y, l.z]), lit: l.lit, deposited: l.deposited,
        fuel: l.lit ? r1(l.fuelUnits / 60) : 0, ever_lit: !!l.ever_lit, relit_count: l.relit_count || 0,
      })),
      shades: this.shades.map((q) => ({ id: q.id, pos: r3v([q.x, q.y, q.z]), state: q.state })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({ id: m.id, pos: r3v([m.x, m.y, m.z]), kind: m.kind, ttl_s: m.ttl === null ? null : r3(m.ttl / TPS) })),
      drifters: this.drifters.map((d) => ({ id: d.id, pos: r3v([d.x, d.y, d.z]), state: d.state, stolen: d.stolen })),
      charms: this.charms.map((c) => ({ id: c.id, pos: r3v([c.x, c.y, c.z]), available: c.available, respawn_s: r3(c.respawn / TPS) })),
    };
  }

  endLine() { return { type: 'end', ticks: this.tick, state: this.state, score: this.score }; }
}
