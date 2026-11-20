// Công thức thống kê của bench.json (Ticket-04 §1). dts: thời gian từng khung (ms).
export function benchStats(dts) {
  const n = dts.length;
  if (n === 0) return { frames: 0, avg_fps: 0, p1_low_fps: 0, frame_ms_p95: 0 };
  const sum = dts.reduce((a, b) => a + b, 0);
  const sorted = [...dts].sort((a, b) => a - b);
  const k = Math.max(1, Math.ceil(0.01 * n));
  const worst = sorted.slice(n - k);
  const meanWorst = worst.reduce((a, b) => a + b, 0) / k;
  const p95 = sorted[Math.max(0, Math.ceil(0.95 * n) - 1)]; // nearest-rank
  return { frames: n, avg_fps: (1000 * n) / sum, p1_low_fps: 1000 / meanWorst, frame_ms_p95: p95 };
}

/** Heuristic trung thực: có vẻ vẫn bị khóa vsync (khoảng cách khung gần như hằng và ≈ tần số quét phổ biến). */
export function looksVsynced(dts) {
  if (dts.length < 10) return false;
  const mean = dts.reduce((a, b) => a + b, 0) / dts.length;
  const sd = Math.sqrt(dts.reduce((a, b) => a + (b - mean) ** 2, 0) / dts.length);
  const fps = 1000 / mean;
  return sd < 0.6 && [30, 48, 50, 59.94, 60, 75, 90, 100, 120, 144, 165, 240].some((r) => Math.abs(fps - r) < 1.5);
}
