# AGENTS.md — Đảo Đèn Lồng (Phase 1–4, Contract v1.3)

## Cấu trúc
- `src/sim.js` — **toàn bộ luật chơi**, thuần/tất định, không DOM/Node API. `src/worlds.js` — dữ liệu + hình học 3 bản đồ.
- `src/headless.js` — CLI theo Test Contract. `src/server.js` + `web/` — client Three.js (chỉ hiển thị, gọi `Game.step`).
- `src/bench.js` (bench_cmd, mở Chrome/Edge qua CDP) · `src/soak.js` (soak_cmd) · `src/leaderboard.js` (bảng xếp hạng, dùng bởi `src/server.js`) · `src/bench-scene.js` (cảnh chuẩn) · `scripts/package.mjs` (zip phát hành).
- `game.contract.json` — **nguồn chân lý** của mọi con số (Ticket-02 Phần 1). Không hardcode trùng lặp.
- `SPEC.md` (P1) → `SPEC-PHASE2.md` → `SPEC-PHASE3.md` → `SPEC-PHASE4.md` (phi chức năng; mới hơn thắng khi mâu thuẫn). Mỗi yêu cầu có ID `R-…`/`R2-…` và test tương ứng.

## Quy tắc cứng
1. Không `Math.random()`/`Date` trong `sim.js`; chỉ `this.rng` (mulberry32 theo `--seed`). Thứ tự gọi rng là một phần của tính tất định.
2. Thứ tự xử lý trong `Game.step` đúng 12 bước của Ticket-02. Đổi thứ tự = đổi hành vi: phải sửa SPEC + test.
3. Sáng tạo/hiển thị chỉ ở `web/`; không được đổi đầu ra headless.
4. Không đổi format output headless nếu Contract không đổi. Trường **thêm** (không có trong contract) phải ghi ở SPEC.
5. Quy ước góc: `(x,z) = (r·cos a, r·sin a)`; tick sự kiện = bước k+1; khoảng cách luật chơi đo trên XZ (riêng Tỏa Sáng đo 3D).
6. Mọi chỗ Ticket mơ hồ → ghi vào bảng giả định của SPEC (B1, B2…), không im lặng chọn.

## Quy trình
- Sau mỗi thay đổi logic: `npm test` (68 test, ~10 s; hook Stop trong `.claude/settings.json` cũng chạy nó). Sửa test cũ khi Ticket mới đổi số, **kèm lý do trong commit**, không tắt âm thầm.
- Thêm tính năng ⇒ thêm 1 scenario trong `scenarios/` + 1 test + AC trong SPEC (xem skill `headless-verify`).
- Bằng chứng (`docs/evidence/`) phải sinh từ lần chạy thật; không sửa tay.
- Không commit `node_modules/`, key, `.env`, `.scratch/`.

- `Game({bench:true})` chỉ dành cho cảnh benchmark; mặc định tắt. Không đổi đầu ra headless: 6 test `R4-HEADLESS` giữ băm SHA-256 từ Phase 3 — nếu đỏ là bạn đã đổi hành vi.
- Số đo `bench.json`/`soak.json` phải do `npm run bench`/`npm run soak` sinh ra; không sửa tay, không làm đẹp số.

## Lỗi AI đã gặp (đừng lặp lại)
- Viết assert luôn đúng (tautology) khi soạn test vội → mọi assert phải có thể đỏ.
- Quên `random_shades:false` trong scenario khiến Bóng giết Mây trước khi đo điều cần đo.
- Giả định bóng "luôn đuổi" trong khi Ticket-02 có ngưỡng phát hiện 12 m / bỏ đuổi 18 m.
- Đo "21 600 tick" nhưng ván kết thúc sớm vì Mây chết — dùng `scenarios/long.json`.
- `npm start --cờ x.json` (không có `--`) bị npm nuốt cờ thành biến môi trường → luôn thử cả `npm start -- --cờ`, `npm start --cờ`, `node src/server.js --cờ`.
- Đo bộ nhớ ngay sau khi tải sẽ thấp giả tạo (mã chưa JIT) → khởi động JIT + ép GC trước khi đo (B4-11).
- Cấp phát `new Color/Vector3` mỗi khung gây GC giật hình → tái dùng đối tượng trong vòng lặp render.
- Trên Windows, script ngoài repo không dùng được đường dẫn `/tmp` của bash cho Node.
