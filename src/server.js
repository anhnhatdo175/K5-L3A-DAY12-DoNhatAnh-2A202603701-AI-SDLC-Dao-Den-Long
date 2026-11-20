// Server tĩnh + API bảng xếp hạng. `node src/server.js [--export-leaderboard out.json]`
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { addToFile, defaultFile, loadEntries } from './leaderboard.js';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const routes = {
  '/': 'web/index.html',
  '/main.js': 'web/main.js',
  '/sim.js': 'src/sim.js',
  '/worlds.js': 'src/worlds.js',
  '/bench-scene.js': 'src/bench-scene.js',
  '/game.contract.json': 'game.contract.json',
  '/three.module.js': ['node_modules/three/build/three.module.js', 'vendor/three.module.js'], // vendor/: bản đóng gói không cần npm install
};
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json' };

/** extra(req,res,url) trả true nếu đã xử lý (dùng cho bench). */
export function createServer({ file = defaultFile(root), extra } = {}) {
  return http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (extra?.(req, res, url)) return;
    if (url === '/api/leaderboard') {
      const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
      if (req.method === 'GET') return send(200, { entries: loadEntries(file) });
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (c) => { body += c; if (body.length > 4096) req.destroy(); });
        req.on('end', () => {
          try { send(200, addToFile(file, JSON.parse(body))); } catch (e) { send(400, { error: e.message }); }
        });
        return;
      }
      return send(405, { error: 'method not allowed' });
    }
    const cand = [routes[url]].flat().filter(Boolean).find((f) => fs.existsSync(path.join(root, f)));
    if (!cand) { res.writeHead(404); res.end('not found'); return; }
    fs.readFile(path.join(root, cand), (err, data) => {
      if (err) { res.writeHead(500); res.end(String(err)); return; }
      res.writeHead(200, { 'Content-Type': types[path.extname(cand)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(data);
    });
  });
}

function main() {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--export-leaderboard');
  // `npm start --export-leaderboard out.json` (không có `--`) được npm nuốt vào biến môi trường
  const envFlag = process.env.npm_config_export_leaderboard;
  let out = i >= 0 ? argv[i + 1] : undefined;
  if (i < 0 && envFlag !== undefined) out = envFlag === 'true' ? argv.find((x) => !x.startsWith('--')) : envFlag; // npm nuốt cờ
  if (i >= 0 || envFlag !== undefined) {
    if (!out) { console.error('thiếu đường dẫn sau --export-leaderboard'); process.exit(1); }
    fs.writeFileSync(out, JSON.stringify({ entries: loadEntries(defaultFile(root)) }, null, 2) + '\n');
    return;
  }
  const port = Number(process.env.PORT) || 8080;
  createServer().listen(port, () => console.log(`Đảo Đèn Lồng chạy tại http://localhost:${port}`));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
