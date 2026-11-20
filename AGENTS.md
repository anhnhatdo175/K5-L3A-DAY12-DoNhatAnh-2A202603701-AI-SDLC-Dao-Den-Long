# AGENTS.md — Đảo Đèn Lồng

- Logic game **chỉ** ở `src/sim.js` (thuần, tất định, không DOM/Node API). Client `web/` và `src/headless.js` chỉ gọi nó.
- Mọi con số gameplay nằm trong `game.contract.json` (`tuning`). Không hardcode trùng lặp trong code; đổi số thì sửa file này + README.
- Test Contract v1.0 là bắt buộc: không đổi định dạng output headless. Thực thể thêm/sáng tạo chỉ ở client.
- Không dùng `Math.random()` trong `sim.js`; dùng `this.rng` (mulberry32 theo `--seed`).
- Sau mỗi thay đổi logic: `npm test`. Bằng chứng phải từ lần chạy thật, không sửa tay.
- Không commit `node_modules/`, key, `.env`.
