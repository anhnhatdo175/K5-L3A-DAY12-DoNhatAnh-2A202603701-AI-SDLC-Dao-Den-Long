// Server tĩnh tối thiểu: phục vụ web/, src/sim.js, game.contract.json và three.js.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const routes = {
  '/': 'web/index.html',
  '/main.js': 'web/main.js',
  '/sim.js': 'src/sim.js',
  '/game.contract.json': 'game.contract.json',
  '/three.module.js': 'node_modules/three/build/three.module.js',
};
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json' };
const port = Number(process.env.PORT) || 8080;

http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  const file = routes[url];
  if (!file) { res.writeHead(404); res.end('not found'); return; }
  fs.readFile(path.join(root, file), (err, data) => {
    if (err) { res.writeHead(500); res.end(String(err)); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}).listen(port, () => console.log(`Đảo Đèn Lồng chạy tại http://localhost:${port}`));
