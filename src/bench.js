#!/usr/bin/env node
// Benchmark (Ticket-04 §1): node src/bench.js --seed 42 --duration 30 --out bench.json [--screenshot anh.png]
// Mở trình duyệt Chromium (Edge/Chrome) có cửa sổ 1280×720, tắt vsync, chạy cảnh chuẩn trong web/main.js (?bench=1),
// nhận số đo từng khung, tính bench.json và thoát với mã 0. Đặt DDL_BROWSER=<đường dẫn> để chọn trình duyệt khác.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from './server.js';
import { benchStats, looksVsynced } from './benchstats.js';

const T_START = Date.now() - process.uptime() * 1000; // lúc tiến trình bắt đầu
const a = {};
for (let i = 2; i < process.argv.length; i += 2) {
  if (!process.argv[i].startsWith('--') || process.argv[i + 1] === undefined) { console.error(`tham số sai: ${process.argv[i]}`); process.exit(1); }
  a[process.argv[i].slice(2)] = process.argv[i + 1];
}
for (const k of ['seed', 'duration', 'out']) if (a[k] === undefined) { console.error(`thiếu --${k}`); process.exit(1); }
const seed = Number(a.seed), duration = Number(a.duration);
if (!Number.isInteger(seed) || !(duration > 0)) { console.error('--seed phải là số nguyên, --duration > 0'); process.exit(1); }
const WARMUP = 3;

function findBrowser() {
  const env = process.env.DDL_BROWSER;
  const pf = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
  const win = pf.flatMap((p) => [`${p}/Microsoft/Edge/Application/msedge.exe`, `${p}/Google/Chrome/Application/chrome.exe`, `${p}/Chromium/Application/chrome.exe`]);
  const mac = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Chromium.app/Contents/MacOS/Chromium'];
  const lin = ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'];
  const list = [env, ...(process.platform === 'win32' ? win : process.platform === 'darwin' ? mac : lin)].filter(Boolean);
  return list.find((p) => fs.existsSync(p));
}
const browser = findBrowser();
if (!browser) { console.error('Không tìm thấy Chrome/Edge/Chromium. Cài một trình duyệt Chromium hoặc đặt DDL_BROWSER=<đường dẫn>.'); process.exit(2); }

// ---- RSS của các tiến trình trình duyệt (CDP liệt kê PID; bộ nhớ dùng chung có thể bị tính lặp) ----
function rssMb(pids) {
  if (!pids.length) return null;
  try {
    if (process.platform === 'win32') {
      const r = spawnSync('tasklist', ['/FO', 'CSV', '/NH'], { encoding: 'utf8' });
      let kb = 0;
      for (const line of r.stdout.split(/\r?\n/)) {
        const f = line.match(/"([^"]*)"/g)?.map((x) => x.slice(1, -1));
        if (f && f.length >= 5 && pids.includes(Number(f[1]))) kb += Number(f[4].replace(/\D/g, ''));
      }
      return kb ? kb / 1024 : null;
    }
    const r = spawnSync('ps', ['-o', 'rss=', '-p', pids.join(',')], { encoding: 'utf8' });
    const kb = r.stdout.split('\n').reduce((s, x) => s + (Number(x.trim()) || 0), 0);
    return kb ? kb / 1024 : null;
  } catch { return null; }
}

// ---- CDP tối thiểu qua WebSocket có sẵn của Node ≥ 22 ----
class Cdp {
  constructor(url) { this.id = 0; this.pending = new Map(); this.ws = new WebSocket(url); }
  open() {
    return new Promise((res, rej) => {
      this.ws.onopen = res;
      this.ws.onerror = () => rej(new Error('không nối được CDP'));
      this.ws.onmessage = (m) => {
        const d = JSON.parse(m.data), p = this.pending.get(d.id);
        if (p) { this.pending.delete(d.id); if (d.error) p.rej(new Error(d.error.message)); else p.res(d.result); }
      };
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    return new Promise((res, rej) => { this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params, sessionId })); });
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let result = null, firstFrameAt = null;
const server = createServer({
  extra(req, res, url) {
    if (!url.startsWith('/__bench/')) return false;
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      if (url === '/__bench/first-frame' && firstFrameAt === null) firstFrameAt = Date.now();
      if (url === '/__bench/result') { try { result = JSON.parse(body); } catch { result = { error: 'json' }; } }
      res.writeHead(204); res.end();
    });
    return true;
  },
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-bench-'));
const child = spawn(browser, [
  `--user-data-dir=${userData}`, '--remote-debugging-port=0', '--window-size=1280,720', '--window-position=0,0',
  '--no-first-run', '--no-default-browser-check', '--disable-sync', '--disable-extensions', '--disable-component-update',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--disable-features=CalculateNativeWinOcclusion', '--autoplay-policy=no-user-gesture-required',
  '--disable-gpu-vsync', '--disable-frame-rate-limit', // tắt vsync
  'about:blank',
], { stdio: 'ignore' });
child.on('error', (e) => { console.error(`không chạy được trình duyệt: ${e.message}`); process.exit(2); });

let cdp = null, shuttingDown = false;
async function cleanup() {
  if (shuttingDown) return;
  shuttingDown = true;
  try { await Promise.race([cdp?.send('Browser.close'), sleep(1500)]); } catch { /* bỏ qua */ }
  try { child.kill(); } catch { /* bỏ qua */ }
  if (process.platform === 'win32' && child.pid) spawnSync('taskkill', ['/T', '/F', '/PID', String(child.pid)], { stdio: 'ignore' });
  await sleep(500);
  try { fs.rmSync(userData, { recursive: true, force: true }); } catch { /* bỏ qua */ }
  server.close();
}
async function fail(msg) { console.error(msg); await cleanup(); process.exit(1); }

try {
  const portFile = path.join(userData, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !fs.existsSync(portFile); i++) await sleep(100);
  if (!fs.existsSync(portFile)) await fail('trình duyệt không mở cổng điều khiển');
  const [dport, dpath] = fs.readFileSync(portFile, 'utf8').trim().split('\n');
  cdp = new Cdp(`ws://127.0.0.1:${dport}${dpath}`);
  await cdp.open();
  const ver = await cdp.send('Browser.getVersion');
  let page;
  for (let i = 0; i < 50 && !page; i++) {
    page = (await cdp.send('Target.getTargets')).targetInfos.find((t) => t.type === 'page');
    if (!page) await sleep(100);
  }
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: page.targetId, flatten: true });
  try {
    const { windowId } = await cdp.send('Browser.getWindowForTarget', { targetId: page.targetId });
    await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal', left: 0, top: 0, width: 1280, height: 720 } });
  } catch { /* vẫn còn override viewport bên dưới */ }
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false }, sessionId); // viewport đúng 1280×720
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/?bench=1&seed=${seed}&duration=${duration}` }, sessionId);

  const samples = [];
  const sample = async () => {
    const m = rssMb((await cdp.send('SystemInfo.getProcessInfo')).processInfo.map((p) => p.id));
    if (m) samples.push(m);
  };
  const deadline = Date.now() + (WARMUP + duration + 90) * 1000;
  let nextSample = 0, shot = false;
  while (!result) {
    if (Date.now() > deadline) await fail('quá thời hạn: trang bench không trả kết quả (WebGL có chạy được không?)');
    if (firstFrameAt !== null) {
      const since = (Date.now() - firstFrameAt) / 1000;
      if (since > nextSample && !process.env.DDL_NO_SAMPLE) { nextSample += 10; await sample(); }
      if (a.screenshot && !shot && since > WARMUP + 1) {
        shot = true;
        const s = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
        fs.writeFileSync(a.screenshot, Buffer.from(s.data, 'base64'));
      }
    }
    await sleep(200);
  }
  await sample(); // lần cuối khi cảnh còn nguyên
  if (result.error || !Array.isArray(result.dts)) await fail('trang bench trả dữ liệu hỏng');
  if (a.dts) fs.writeFileSync(a.dts, JSON.stringify(result.dts)); // gỡ lỗi: dt từng khung
  const st = benchStats(result.dts);
  const out = {
    contract_version: '1.3',
    avg_fps: Math.round(st.avg_fps * 10) / 10,
    p1_low_fps: Math.round(st.p1_low_fps * 10) / 10,
    frame_ms_p95: Math.round(st.frame_ms_p95 * 100) / 100,
    frames: st.frames,
    load_ms: Math.round(firstFrameAt - T_START),
    peak_mem_mb: samples.length ? Math.round(Math.max(...samples)) : null,
    vsync_off: !looksVsynced(result.dts),
    renderer: `three.js r${result.three} / WebGL — GPU: ${result.gpu} — ${ver.product}, viewport ${result.size.join('x')} dpr ${result.dpr}`,
    os: `${os.type()} ${os.release()} (${os.version()}) ${os.arch()} — ${os.cpus()[0]?.model?.trim()} x${os.cpus().length}, RAM ${Math.round(os.totalmem() / 2 ** 30)} GB`,
  };
  fs.writeFileSync(a.out, JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify(out, null, 2));
  console.log(`(canh: ${result.shades} Bong Muc, ${result.motes} dom dom; ${samples.length} mau RSS)`);
  await cleanup();
  process.exit(0);
} catch (e) { await fail(e.stack || String(e)); }
