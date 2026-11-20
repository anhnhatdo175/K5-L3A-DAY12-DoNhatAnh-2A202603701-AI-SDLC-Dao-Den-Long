// Đóng gói bản phát hành: node scripts/package.mjs  →  dist/dao-den-long-v<version>.zip
// Bản zip tự chứa (kèm three.js trong vendor/), chỉ cần Node ≥ 22: giải nén rồi `node src/server.js`.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const name = `dao-den-long-v${pkg.version}`;
const dist = path.join(root, 'dist'), stage = path.join(dist, name);
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(stage, 'vendor'), { recursive: true });

const copy = (rel, to = rel) => { fs.mkdirSync(path.dirname(path.join(stage, to)), { recursive: true }); fs.cpSync(path.join(root, rel), path.join(stage, to), { recursive: true }); };
for (const f of ['src', 'web', 'game.contract.json', 'package.json', 'LICENSE', 'README.md', 'CREDITS.md', 'CHANGELOG.md']) copy(f);
copy('node_modules/three/build/three.module.js', 'vendor/three.module.js');
fs.writeFileSync(path.join(stage, 'CHAY-NGAY.txt'), [
  `Đảo Đèn Lồng v${pkg.version} — bản chạy ngay (không cần npm install)`,
  '',
  'Yêu cầu: Node.js >= 22 và một trình duyệt hỗ trợ WebGL (Chrome/Edge/Firefox mới).',
  '  1. Giải nén thư mục này.',
  '  2. Mở terminal trong thư mục và chạy:  node src/server.js',
  '  3. Mở http://localhost:8080',
  '',
  'Bảng xếp hạng lưu ở data/leaderboard.json. Xuất:  node src/server.js --export-leaderboard out.json',
  'Headless:  node src/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl',
  'Soak:      node src/soak.js --seed 7 --nights 10 --out soak.json',
  'Bench:     node src/bench.js --seed 42 --duration 30 --out bench.json   (cần Chrome/Edge)',
  '',
].join('\n'));

// Ghi zip bằng Node thuần (deflate) để chạy giống nhau trên mọi hệ điều hành, không phụ thuộc tar/zip có sẵn.
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const parts = [], central = [];
let offset = 0;
for (const file of walk(stage).sort()) {
  const rel = path.relative(dist, file).split(path.sep).join('/'), nameBuf = Buffer.from(rel, 'utf8');
  const data = fs.readFileSync(file), comp = zlib.deflateRawSync(data, { level: 9 }), crc = crc32(data);
  const local = Buffer.alloc(30); // chữ ký, version 20, cờ 0x0800 (tên UTF-8), phương pháp 8 (deflate), giờ/ngày cố định
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
  local.writeUInt16LE(0, 10); local.writeUInt16LE(0x5a21, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuf.length, 26);
  const cen = Buffer.alloc(46);
  cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(8, 10);
  cen.writeUInt16LE(0, 12); cen.writeUInt16LE(0x5a21, 14); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(comp.length, 20); cen.writeUInt32LE(data.length, 24); cen.writeUInt16LE(nameBuf.length, 28); cen.writeUInt32LE(offset, 42);
  parts.push(local, nameBuf, comp); central.push(cen, nameBuf);
  offset += local.length + nameBuf.length + comp.length;
}
const cenBuf = Buffer.concat(central), end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(central.length / 2, 8); end.writeUInt16LE(central.length / 2, 10); end.writeUInt32LE(cenBuf.length, 12); end.writeUInt32LE(offset, 16);
const zip = path.join(dist, `${name}.zip`);
fs.writeFileSync(zip, Buffer.concat([...parts, cenBuf, end]));
console.log(`đã tạo ${path.relative(root, zip)} (${Math.round(fs.statSync(zip).size / 1024)} KB, ${central.length / 2} file)`);
