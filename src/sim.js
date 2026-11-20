// Lõi mô phỏng Đảo Đèn Lồng: thuần logic, tất định, không phụ thuộc DOM/Node.
// Dùng chung cho headless (Node) và client web (trình duyệt).

export const TPS = 60;
export const ISLAND_RADIUS = 40;
export const LANTERN_RING = 25;
export const MOTE_MAX = 24;
export const MOTE_RESPAWN_TICKS = 240;
export const SHADE_FIRST_TICK = 300;
export const SHADE_EVERY_TICKS = 720;
export const SHADE_MAX = 5;
export const JUMP_V = 7;
export const GRAVITY = 20;

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
const r3v = (a) => a.map(r3);

export const EMPTY_INPUT = () => ({ move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false });

export class Game {
  /**
   * @param {object} o
   * @param {object} o.tuning   tuning từ game.contract.json
   * @param {number} o.seed
   * @param {object} [o.scenario] đã được validate
   */
  constructor({ tuning, seed = 1, scenario = {} }) {
    this.t = tuning;
    this.score_t = tuning.score;
    this.rng = mulberry32(seed);
    this.steps = 0;
    this.state = 'playing';
    this.score = 0;
    this.events = [];
    this.prev = { jump: false, interact: false, pulse: false };
    this.nextMote = 1;
    this.randomMotes = scenario.random_motes !== false;
    this.randomShades = scenario.random_shades !== false;
    this.invulnTicks = Math.round(tuning.invuln_s * TPS);
    this.cdTicks = Math.round(tuning.pulse_cooldown_s * TPS);
    this.stunTicks = Math.round(tuning.pulse_stun_s * TPS);

    const dur = scenario.time_left_s ?? tuning.night1_duration_s;
    this.ticksLeft0 = Math.round(dur * TPS);

    const p = scenario.player || {};
    const pos = p.pos || [0, 0, 0];
    this.player = {
      x: pos[0], y: pos[1], z: pos[2], vy: 0,
      flames: p.flames ?? tuning.flames,
      carried: p.carried ?? 0,
      invuln: 0, cd: 0,
    };

    // đèn: vòng tròn bán kính 25, L1 ở (0,0,25)
    this.lanterns = [];
    for (let i = 0; i < tuning.lantern_count_night1; i++) {
      const a = (i * 2 * Math.PI) / tuning.lantern_count_night1;
      this.lanterns.push({
        id: `L${i + 1}`, x: LANTERN_RING * Math.sin(a), y: 0, z: LANTERN_RING * Math.cos(a),
        lit: false, deposited: 0,
      });
    }
    for (const u of scenario.lanterns || []) {
      let l = this.lanterns.find((q) => q.id === u.id);
      if (!l) {
        l = { id: u.id, x: 0, y: 0, z: 0, lit: false, deposited: 0 };
        this.lanterns.push(l);
      }
      if (u.pos) { l.x = u.pos[0]; l.y = u.pos[1]; l.z = u.pos[2]; }
      if (u.deposited !== undefined) l.deposited = u.deposited;
      if (u.lit === true) { l.lit = true; if (u.deposited === undefined) l.deposited = tuning.lantern_cost; }
      else if (u.lit === false) l.lit = false;
    }

    // đom đóm
    this.motes = [];
    if (scenario.motes) {
      for (const m of scenario.motes) this.motes.push({ id: `M${this.nextMote++}`, x: m[0], y: 0, z: m[2] });
    } else if (this.randomMotes) {
      for (let i = 0; i < MOTE_MAX; i++) this._spawnRandomMote();
    }

    // Bóng Mực
    this.shades = [];
    this.nextShade = 1;
    if (scenario.shades) {
      for (const s of scenario.shades) {
        const id = s.id ?? this._freeShadeId();
        this.shades.push({ id, x: s.pos[0], y: s.pos[1] ?? 1, z: s.pos[2], state: 'chase', stun: 0 });
      }
    }
  }

  _freeShadeId() {
    for (;;) {
      const id = `S${this.nextShade++}`;
      if (!this.shades.some((s) => s.id === id)) return id;
    }
  }

  _spawnRandomMote() {
    const r = Math.sqrt(this.rng()) * (ISLAND_RADIUS - 4);
    const a = this.rng() * 2 * Math.PI;
    this.motes.push({ id: `M${this.nextMote++}`, x: r * Math.sin(a), y: 0, z: r * Math.cos(a) });
  }

  _emit(name, data) { this.events.push({ type: 'event', tick: this.steps, name, data }); }

  _dropMotes(n, cx, cz) {
    const lim = ISLAND_RADIUS - 1;
    const d = Math.hypot(cx, cz);
    if (d > lim) { cx *= lim / d; cz *= lim / d; }
    for (let i = 0; i < n; i++) {
      const a = i * 2.399963; // góc vàng: rải đều, tất định
      const r = this.t.pickup_radius + 1 + 0.25 * i; // ngoài tầm nhặt để không bị nhặt lại ngay
      let x = cx + r * Math.sin(a), z = cz + r * Math.cos(a);
      const dd = Math.hypot(x, z);
      if (dd > lim) { x *= lim / dd; z *= lim / dd; }
      this.motes.push({ id: `M${this.nextMote++}`, x, y: 0, z });
    }
  }

  _hurt(by) {
    const p = this.player;
    p.flames -= 1;
    const dropped = Math.floor(p.carried * this.t.hit_drop_ratio);
    p.carried -= dropped;
    const hx = p.x, hz = p.z;
    p.invuln = this.invulnTicks;
    this._emit('player_hit', { by, flames: p.flames, dropped });
    this._dropMotes(dropped, hx, hz);
  }

  _end(result, reason) {
    this.state = result;
    if (result === 'won') {
      const secs = Math.floor(Math.max(0, this.timeLeft()));
      this.score += secs * this.score_t.per_second_left + this.player.flames * this.score_t.per_flame_left;
    }
    this._emit('game_over', { result, reason });
  }

  timeLeft() { return (this.ticksLeft0 - this.steps) / TPS; }

  _enforceSafe(s) {
    const R = this.t.safe_radius;
    for (const l of this.lanterns) {
      const dx = s.x - l.x, dz = s.z - l.z;
      const d = Math.hypot(dx, dz);
      if (d < R) {
        if (d < 1e-9) { s.x = l.x + R; } else { s.x = l.x + (dx / d) * R; s.z = l.z + (dz / d) * R; }
      }
    }
  }

  /** Chạy một bước (1/60 s) với input hiện tại. Trả về danh sách event của bước. */
  step(input) {
    this.events = [];
    if (this.state !== 'playing') return this.events;
    const t = this.t, p = this.player;
    this.steps++;
    if (p.invuln > 0) p.invuln--;
    if (p.cd > 0) p.cd--;

    // --- di chuyển ---
    let [mx, mz] = input.move;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const th = (input.cam_yaw_deg * Math.PI) / 180;
    const wx = mx * Math.cos(th) + mz * Math.sin(th);
    const wz = -mx * Math.sin(th) + mz * Math.cos(th);
    p.x += (wx * t.player_speed) / TPS;
    p.z += (wz * t.player_speed) / TPS;
    p.facing = len > 0 ? Math.atan2(wx, wz) : (p.facing ?? 0);

    if (input.jump && !this.prev.jump && p.y <= 0) p.vy = JUMP_V;
    if (p.y > 0 || p.vy > 0) {
      p.vy -= GRAVITY / TPS;
      p.y += p.vy / TPS;
      if (p.y <= 0) { p.y = 0; p.vy = 0; }
    }

    // --- rơi khỏi đảo ---
    const dc = Math.hypot(p.x, p.z);
    if (dc > ISLAND_RADIUS) {
      if (t.fall_enabled) {
        const fx = (p.x * ISLAND_RADIUS) / dc, fz = (p.z * ISLAND_RADIUS) / dc;
        p.x = fx; p.z = fz;
        this._hurt('fall'); // đom đóm rơi ở mép đảo
        p.x = 0; p.y = 0; p.z = 0; p.vy = 0; // hồi sinh giữa đảo
      } else {
        p.x = (p.x * ISLAND_RADIUS) / dc; p.z = (p.z * ISLAND_RADIUS) / dc;
      }
    }

    // --- nhặt đom đóm ---
    if (p.carried < t.carry_capacity) {
      for (let i = 0; i < this.motes.length && p.carried < t.carry_capacity; ) {
        const m = this.motes[i];
        if (Math.hypot(m.x - p.x, m.z - p.z) <= t.pickup_radius) {
          this.motes.splice(i, 1);
          p.carried++;
          this.score += this.score_t.per_mote;
          this._emit('mote_picked', { carried: p.carried });
        } else i++;
      }
    }

    // --- nạp ánh sáng vào đèn ---
    if (input.interact && !this.prev.interact) {
      let best = null, bd = Infinity;
      for (const l of this.lanterns) {
        if (l.lit) continue;
        const d = Math.hypot(l.x - p.x, l.z - p.z);
        if (d <= t.interact_radius && d < bd) { best = l; bd = d; }
      }
      if (best) {
        const amount = Math.min(p.carried, Math.max(0, t.lantern_cost - best.deposited));
        if (amount > 0) {
          p.carried -= amount;
          best.deposited += amount;
          this._emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
        }
        if (best.deposited >= t.lantern_cost) {
          best.lit = true;
          this.score += this.score_t.per_lantern;
          this._emit('lantern_lit', { lantern_id: best.id });
        }
      }
    }

    // --- tỏa sáng ---
    if (input.pulse && !this.prev.pulse && p.cd === 0 && p.carried >= t.pulse_cost) {
      p.carried -= t.pulse_cost;
      p.cd = this.cdTicks;
      const ids = [];
      for (const s of this.shades) {
        const dx = s.x - p.x, dz = s.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d <= t.pulse_radius) {
          ids.push(s.id);
          s.state = 'stunned';
          s.stun = this.stunTicks;
          const ux = d > 1e-9 ? dx / d : 1, uz = d > 1e-9 ? dz / d : 0;
          s.x += ux * t.pulse_push_m; s.z += uz * t.pulse_push_m;
          this._enforceSafe(s);
          this.score += this.score_t.per_stun;
        }
      }
      this._emit('pulse', { stunned_ids: ids });
    }
    this.prev.jump = !!input.jump; this.prev.interact = !!input.interact; this.prev.pulse = !!input.pulse;

    // --- Bóng Mực ---
    for (const s of this.shades) {
      if (s.state === 'stunned') {
        if (--s.stun <= 0) { s.state = 'chase'; s.stun = 0; }
        continue;
      }
      const dx = p.x - s.x, dz = p.z - s.z;
      const d = Math.hypot(dx, dz);
      const step = t.shade_speed / TPS;
      if (d > 1e-9) {
        const k = Math.min(step, d) / d;
        s.x += dx * k; s.z += dz * k;
      }
      this._enforceSafe(s);
    }
    if (p.invuln === 0) {
      for (const s of this.shades) {
        if (s.state === 'stunned') continue;
        if (Math.hypot(s.x - p.x, s.z - p.z) <= t.shade_hit_radius) { this._hurt('shade'); break; }
      }
    }

    // --- sinh ngẫu nhiên ---
    if (this.randomShades && this.steps >= SHADE_FIRST_TICK && (this.steps - SHADE_FIRST_TICK) % SHADE_EVERY_TICKS === 0
        && this.shades.length < SHADE_MAX) {
      const a = this.rng() * 2 * Math.PI;
      const id = this._freeShadeId();
      this.shades.push({ id, x: (ISLAND_RADIUS - 2) * Math.sin(a), y: 1, z: (ISLAND_RADIUS - 2) * Math.cos(a), state: 'chase', stun: 0 });
      this._emit('shade_spawned', { id });
    }
    if (this.randomMotes && this.steps % MOTE_RESPAWN_TICKS === 0 && this.motes.length < MOTE_MAX) this._spawnRandomMote();

    // --- kết thúc ---
    if (p.flames <= 0) this._end('lost', 'no_flames');
    else if (this.lanterns.every((l) => l.lit)) this._end('won', 'all_lit');
    else if (this.ticksLeft0 - this.steps <= 0) this._end('lost', 'dawn');
    return this.events;
  }

  snapshot(withMotes = true) {
    const p = this.player;
    const s = {
      type: 'snapshot', tick: this.steps, sim_tick: this.steps, state: this.state,
      time_left_s: r3(this.timeLeft()), score: this.score,
      player: { pos: r3v([p.x, p.y, p.z]), flames: p.flames, carried: p.carried },
      lanterns: this.lanterns.map((l) => ({ id: l.id, pos: r3v([l.x, l.y, l.z]), lit: l.lit, deposited: l.deposited })),
      shades: this.shades.map((q) => ({ id: q.id, pos: r3v([q.x, q.y, q.z]), state: q.state })),
      motes_active: this.motes.length,
    };
    if (withMotes) s.motes = this.motes.map((m) => ({ id: m.id, pos: r3v([m.x, 0, m.z]) }));
    return s;
  }

  endLine() { return { type: 'end', ticks: this.steps, state: this.state, score: this.score }; }
}
