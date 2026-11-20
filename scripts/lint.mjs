// Kiểm cú pháp mọi file .js/.mjs của dự án (node --check chỉ nhận một file mỗi lần).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const files = ['src', 'web', 'tests', 'scripts'].flatMap((d) => fs.readdirSync(d).filter((f) => /.m?js$/.test(f)).map((f) => path.join(d, f)));
let bad = 0;
for (const f of files) { const r = spawnSync('node', ['--check', f], { encoding: 'utf8' }); if (r.status !== 0) { bad++; console.error(r.stderr); } }
console.log(`lint: ${files.length} file, ${bad} lỗi`);
process.exit(bad ? 1 : 0);
