// Cảnh benchmark chuẩn (Ticket-04 §1). Thuần/tất định; dùng chung cho client (web) và test.
import { mulberry32 } from './sim.js';

export const BENCH = {
  night: 1, shades: 200, motes: 100, island_r: 38,
  orbit: { radius: 30, height: 15, period_s: 15 }, warmup_s: 3,
};

/** Scenario cho Game({bench:true}): Mây đứng yên (0,0,0), 200 Bóng wander, 100 đom đóm, L1–L3 sáng fuel 100. */
export function benchScenario(seed = 42) {
  const rng = mulberry32(seed);
  const disc = () => { const a = rng() * 2 * Math.PI, r = BENCH.island_r * Math.sqrt(rng()); return [r * Math.cos(a), 0, r * Math.sin(a)]; };
  const shades = Array.from({ length: BENCH.shades }, (_, i) => ({ id: `S${i + 1}`, pos: disc(), state: 'wander' }));
  const motes = Array.from({ length: BENCH.motes }, disc);
  return {
    random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false,
    player: { pos: [0, 0, 0] },
    lanterns: ['L1', 'L2', 'L3'].map((id) => ({ id, lit: true, fuel: 100 })),
    shades, motes,
  };
}

/** Vị trí camera tại t giây kể từ khung đầu của cảnh: bay vòng ngược chiều kim đồng hồ khi nhìn từ trên xuống, bắt đầu tại (30,15,0). */
export function benchCamera(tSec) {
  const { radius, height, period_s } = BENCH.orbit;
  const phi = (2 * Math.PI * tSec) / period_s;
  // Nhìn từ +Y xuống (tay phải) trục +Z hướng xuống màn hình, nên ngược chiều kim đồng hồ ⇒ z = −sin.
  return [radius * Math.cos(phi), height, -radius * Math.sin(phi)];
}
