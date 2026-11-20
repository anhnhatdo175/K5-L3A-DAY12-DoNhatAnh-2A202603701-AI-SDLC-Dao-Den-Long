// Bảng xếp hạng cục bộ (Ticket-04 §3): xác thực, sắp xếp, lưu đĩa. Không phụ thuộc DOM.
import fs from 'node:fs';
import path from 'node:path';

export const TOP_N = 10;
export const NAME_RE = /^[\p{L}\p{N}_]{3,12}$/u; // ASCII [A-Za-z0-9_] + chữ cái có dấu (điểm cộng)

const pad = (n) => String(n).padStart(2, '0');
/** ISO 8601 kèm múi giờ cục bộ, ví dụ 2026-11-20T21:05:09+07:00. */
export function isoWithOffset(d = new Date()) {
  const off = -d.getTimezoneOffset(), sign = off >= 0 ? '+' : '-', a = Math.abs(off);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

/** Trả về entry sạch hoặc ném Error có thông báo tiếng Việt. */
export function validateEntry(e, now = new Date()) {
  if (e === null || typeof e !== 'object') throw new Error('mục không hợp lệ');
  const name = typeof e.name === 'string' ? e.name.normalize('NFC') : '';
  if (!NAME_RE.test(name)) throw new Error('Tên phải 3–12 ký tự: chữ, số hoặc dấu _');
  if (!Number.isInteger(e.score) || e.score < 0) throw new Error('score phải là số nguyên ≥ 0');
  if (!Number.isInteger(e.nights_won) || e.nights_won < 0 || e.nights_won > 3) throw new Error('nights_won phải là 0–3');
  if (!Number.isInteger(e.seed)) throw new Error('seed phải là số nguyên');
  return { name, score: e.score, nights_won: e.nights_won, achieved_at: e.achieved_at ?? isoWithOffset(now), seed: e.seed };
}

/** Điểm giảm dần; bằng điểm: ai đạt trước (achieved_at sớm hơn, rồi thứ tự lưu) đứng trên. Giữ top 10. */
export function sortEntries(entries) {
  const all = entries.map((e, i) => ({ e, i, t: Date.parse(e.achieved_at) || 0 }));
  all.sort((a, b) => b.e.score - a.e.score || a.t - b.t || a.i - b.i);
  return all.slice(0, TOP_N).map((x) => x.e);
}
export const insertEntry = (entries, entry) => sortEntries([...entries, entry]);

export function defaultFile(root) { return process.env.DDL_LEADERBOARD || path.join(root, 'data', 'leaderboard.json'); }

export function loadEntries(file) {
  try {
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(j.entries) ? sortEntries(j.entries) : []; // luôn trả đúng thứ tự, kể cả khi file bị sửa tay
  } catch { return []; }
}

export function saveEntries(file, entries) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ entries }, null, 2) + '\n');
  fs.renameSync(tmp, file); // ghi nguyên tử: tắt đột ngột không làm hỏng file
}

export function addToFile(file, raw, now = new Date()) {
  const entry = validateEntry({ ...raw, achieved_at: undefined }, now); // thời điểm do máy chủ đặt
  const entries = insertEntry(loadEntries(file), entry);
  saveEntries(file, entries);
  return { entry, entries };
}
