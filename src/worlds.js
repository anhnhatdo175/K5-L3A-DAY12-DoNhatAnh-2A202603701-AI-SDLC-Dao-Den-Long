// Bản đồ chuẩn của 3 Đêm (Ticket-02, Phần 2). Dữ liệu thuần + hình học, dùng chung cho sim và client.
// Quy ước góc: đo từ +X, ngược chiều kim đồng hồ trên mặt phẳng XZ: (x, z) = (r·cos a, r·sin a).

export const TPS = 60;
const rad = (d) => (d * Math.PI) / 180;
const ring = (r, n, start, step, cx = 0, y = 0) =>
  Array.from({ length: n }, (_, i) => [cx + r * Math.cos(rad(start + i * step)), y, r * Math.sin(rad(start + i * step))]);

// ---- bề mặt đi được: h(x,z) trả về độ cao hoặc null ----
const disc = (cx, cz, r, y) => ({ kind: 'disc', cx, cz, r, y, h: (x, z) => (Math.hypot(x - cx, z - cz) <= r ? y : null) });
const annulusHalf = (r0, r1, y) => ({
  kind: 'annulus', r0, r1, y,
  h: (x, z) => { const d = Math.hypot(x, z); return z > 0 && d >= r0 && d <= r1 ? y : null; },
});
const rect = (x0, x1, z0, z1, y) => ({ kind: 'rect', x0, x1, z0, z1, y, h: (x, z) => (x >= x0 && x <= x1 && z >= z0 && z <= z1 ? y : null) });
// dốc thẳng rộng 3 m dọc bán kính ở góc deg: s ∈ [24,30], cao 0 → 3 khi s giảm 30 → 24
const ramp = (deg) => {
  const ux = Math.cos(rad(deg)), uz = Math.sin(rad(deg));
  return {
    kind: 'ramp', deg,
    h: (x, z) => {
      const s = x * ux + z * uz, t = -x * uz + z * ux;
      return Math.abs(t) <= 1.5 && s >= 24 && s <= 30 ? 0.5 * (30 - s) : null;
    },
  };
};

const pad = (x, y, z, vy, vh, dx, dz) => {
  const n = Math.hypot(dx, dz);
  return { x, y, z, r: 1, vy, vh, dir: [dx / n, dz / n] };
};

export const WORLDS = {
  1: {
    id: 1, name: 'Đảo Bến',
    start: [0, 0, 0], facing: 0,
    surfaces: [disc(0, 0, 40, 0)],
    obstacles: [], pads: [],
    lanterns: [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]],
    motePoints: [...ring(12, 8, 0, 45), ...ring(33, 16, 0, 22.5)],
    shadePoints: ring(37, 12, 15, 30),
    shadeMax: 6, shadeEveryTicks: 480, shadeSpeed: 4.0,
    charms: [], drifters: false, wind: false,
    durationKey: 'night1_duration_s',
  },
  2: {
    id: 2, name: 'Đảo Cau',
    start: [0, 0, 0], facing: 0,
    surfaces: [disc(0, 0, 28, 0), disc(70, 0, 28, 0), rect(26, 44, -2, 2, 0)],
    obstacles: [],
    pads: [pad(20, 0, 18, 14, 24, 70 - 20, 0 - 18), pad(50, 0, -18, 14, 24, 0 - 50, 0 + 18)],
    lanterns: [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]],
    motePoints: [...[0, 70].flatMap((cx) => [...ring(10, 4, 0, 90, cx), ...ring(22, 8, 0, 45, cx)])],
    shadePoints: [0, 70].flatMap((cx) => ring(26, 8, 22.5, 45, cx)),
    shadeMax: 8, shadeEveryTicks: 420, shadeSpeed: 4.0,
    charms: [[35, 0, 0]], drifters: true, wind: false,
    durationKey: 'night2_duration_s',
  },
  3: {
    id: 3, name: 'Đảo Chuông',
    start: [0, 0, -12], facing: 0, // (0,0,0) nằm trong chân tầng 2 nên xuất phát ở tầng 0 cạnh đó
    surfaces: [disc(0, 0, 45, 0), annulusHalf(12, 24, 3), disc(0, 0, 8, 6), ramp(30), ramp(150)],
    obstacles: [{ x: 0, z: 0, r: 2, top: 14 }], // tháp chuông: tầng 2 (Y=6) + cao 8 m
    pads: [pad(0, 3, 13, 12, 8, 0, -1)],
    lanterns: [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]],
    motePoints: [...ring(34, 18, 0, 20), ...ring(18, 8, 20, 20, 0, 3), ...ring(5, 4, 45, 90, 0, 6)],
    shadePoints: ring(43, 16, 0, 22.5),
    shadeMax: 10, shadeEveryTicks: 360, shadeSpeed: 4.5,
    charms: [[30, 0, 25], [-30, 0, 25]], drifters: true, wind: true,
    durationKey: 'night3_duration_s',
  },
};

// Đường đi cho Bóng Mực trên Đêm 2: đi qua cầu qua các waypoint.
export function navTarget(night, from, to) {
  if (night !== 2) return to;
  const fi = from.x < 35 ? 0 : 1, ti = to.x < 35 ? 0 : 1;
  if (fi === ti) return to;
  if (fi === 0) return from.x < 26.5 ? { x: 27, z: 0 } : { x: 45, z: 0 };
  return from.x > 43.5 ? { x: 43, z: 0 } : { x: 25, z: 0 };
}
