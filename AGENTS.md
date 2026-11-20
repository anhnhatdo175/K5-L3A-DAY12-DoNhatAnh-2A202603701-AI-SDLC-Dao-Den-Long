# AGENTS.md — Đảo Đèn Lồng (Phase 1–2, Contract v1.1)

## Cấu trúc
- `src/sim.js` — **toàn bộ luật chơi**, thuần/tất định, không DOM/Node API. `src/worlds.js` — dữ liệu + hình học 3 bản đồ.
- `src/headless.js` — CLI theo Test Contract. `src/server.js` + `web/` — client Three.js (chỉ hiển thị, gọi `Game.step`).
- `game.contract.json` — **nguồn chân lý** của mọi con số (Ticket-02 Phần 1). Không hardcode trùng lặp.
- `SPEC.md` (Phase 1) + `SPEC-PHASE2.md` (Phase 2, thắng khi mâu thuẫn). Mỗi yêu cầu có ID `R-…`/`R2-…` và test tương ứng.

## Quy tắc cứng
1. Không `Math.random()`/`Date` trong `sim.js`; chỉ `this.rng` (mulberry32 theo `--seed`). Thứ tự gọi rng là một phần của tính tất định.
2. Thứ tự xử lý trong `Game.step` đúng 12 bước của Ticket-02. Đổi thứ tự = đổi hành vi: phải sửa SPEC + test.
3. Sáng tạo/hiển thị chỉ ở `web/`; không được đổi đầu ra headless.
4. Không đổi format output headless nếu Contract không đổi. Trường **thêm** (không có trong contract) phải ghi ở SPEC.
5. Quy ước góc: `(x,z) = (r·cos a, r·sin a)`; tick sự kiện = bước k+1; khoảng cách luật chơi đo trên XZ (riêng Tỏa Sáng đo 3D).
6. Mọi chỗ Ticket mơ hồ → ghi vào bảng giả định của SPEC (B1, B2…), không im lặng chọn.

## Quy trình
- Sau mỗi thay đổi logic: `npm test` (38 test, ~15 s). Sửa test cũ khi Ticket mới đổi số, **kèm lý do trong commit**, không tắt âm thầm.
- Thêm tính năng ⇒ thêm 1 scenario trong `scenarios/` + 1 test + AC trong SPEC (xem skill `headless-verify`).
- Bằng chứng (`docs/evidence/`) phải sinh từ lần chạy thật; không sửa tay.
- Không commit `node_modules/`, key, `.env`, `.scratch/`.

## Lỗi AI đã gặp (đừng lặp lại)
- Viết assert luôn đúng (tautology) khi soạn test vội → mọi assert phải có thể đỏ.
- Quên `random_shades:false` trong scenario khiến Bóng giết Mây trước khi đo điều cần đo.
- Giả định bóng "luôn đuổi" trong khi Ticket-02 có ngưỡng phát hiện 12 m / bỏ đuổi 18 m.
- Đo "21 600 tick" nhưng ván kết thúc sớm vì Mây chết — dùng `scenarios/long.json`.
