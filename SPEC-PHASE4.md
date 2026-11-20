# SPEC — Phase 4 · Ticket-04 "Bình minh: phát hành v1.0.0" (Contract v1.3)

> Bổ sung cho [SPEC.md](SPEC.md), [SPEC-PHASE2.md](SPEC-PHASE2.md), [SPEC-PHASE3.md](SPEC-PHASE3.md). Phase 4 **không đổi luật chơi, số liệu hay đầu ra headless**; khi mâu thuẫn, tài liệu này và Ticket-04 thắng về phần phi chức năng.
> ID: `R4-…`. Test nằm ở `tests/phase4.test.js`; bằng chứng chạy thật ở `docs/evidence/phase4/`.

## 1. Contract v1.3

| ID | AC | Bằng chứng |
|---|---|---|
| R4-CONTRACT | `game.contract.json`: `contract_version "1.3"`, có `bench_cmd` (`node src/bench.js`) và `soak_cmd` (`node src/soak.js`); tuning không đổi. | test `R4-CONTRACT`, `contract v1.3 khớp số chuẩn` |
| R4-HEADLESS | Đầu ra headless 6 cấu hình (3 Đêm × 2 seed, 4000 tick) giống **từng byte** Phase 3. | 6 test `R4-HEADLESS …` (băm SHA-256 tính từ mã tag `phase-3`) + 38 test cũ |

## 2. Benchmark (`node src/bench.js --seed 42 --duration 30 --out bench.json`)

| ID | AC | Bằng chứng |
|---|---|---|
| R4-BENCH-OUT | `bench.json` đúng 10 trường của Ticket-04, `contract_version "1.3"`, thoát mã 0 sau khi đo đúng `--duration` giây (sau 3 s khởi động). | `bench.json`, `docs/evidence/phase4/bench.json` |
| R4-BENCH-STATS | `avg_fps = 1000·N/Σdt`; `p1_low_fps = 1000/mean(k dt lớn nhất)`, `k = max(1, ceil(0.01N))`; `frame_ms_p95` = phân vị 95 kiểu nearest-rank. | test `R4-BENCH-STATS` (số tính tay) |
| R4-BENCH-SCENE | Đêm 1; đúng 200 Bóng Mực `wander` rải trong đảo (seed), đúng 100 đom đóm, L1–L3 sáng fuel 100; Mây đứng yên (0,0,0). | test `R4-BENCH-SCENE`, ảnh `bench-scene.png` |
| R4-BENCH-SIM | Trong cảnh bench không sinh thêm thực thể, không sát thương, không nhặt, không hao dầu, không hết Đêm; Bóng vẫn di chuyển theo luật wander. Chế độ thường không đổi. | test `R4-BENCH-SIM` (36 000 tick), `R4-BENCH-OFF` |
| R4-BENCH-CAM | Camera tâm (0,0,0), R 30 m, Y 15 m, bắt đầu (30,15,0), 15 s/vòng, ngược chiều kim đồng hồ khi nhìn từ trên, luôn nhìn (0,0,0). | test `R4-BENCH-CAM` |
| R4-BENCH-WIN | Cửa sổ 1280×720 (viewport ép bằng CDP, DPR 1), không toàn màn hình, vsync tắt bằng cờ `--disable-gpu-vsync --disable-frame-rate-limit`. | `bench.json` (`renderer`: viewport 1280x720 dpr 1) |

## 3. Soak (`node src/soak.js --seed 7 --nights 10 --out soak.json`)

| ID | AC | Bằng chứng |
|---|---|---|
| R4-SOAK | 10 Đêm trong một tiến trình (1→2→3 xoay vòng), Đêm i seed 7+i; input ngẫu nhiên theo seed (đổi hướng mỗi 30 tick; mỗi tick nhảy 5 %, lướt 3 %, tỏa sáng 2 %, tương tác 10 %). Đạt: `crashes = 0` và `mem_end_mb ≤ 1.2 × mem_start_mb`. | test `R4-SOAK`, `soak.json` (46.9 → 50.9 MB, tỉ lệ 1.09) |

## 4. Bảng xếp hạng

| ID | AC | Bằng chứng |
|---|---|---|
| R4-LB-NAME | Tên 3–12 ký tự `[A-Za-z0-9_]`; chữ có dấu được chấp nhận (điểm cộng); sai → báo lỗi, không lưu. | test `R4-LB-NAME`; ảnh `lose-save-name.png` |
| R4-LB-SORT | Mục: `name, score, nights_won (0–3), achieved_at (ISO 8601 + múi giờ), seed`. Top 10, điểm giảm dần, bằng điểm thì đạt trước đứng trên. | test `R4-LB-SORT`, `R4-LB-DISK` |
| R4-LB-DISK | Lưu đĩa (`data/leaderboard.json`, ghi nguyên tử), còn sau khi tắt/mở lại. | test `R4-LB-DISK`, `R4-LB-API` |
| R4-LB-UI | Nhập tên sau Bình Minh hoặc sau khi thua ở bất kỳ Đêm nào; màn hình Bảng xếp hạng từ menu chính. | ảnh `leaderboard.png`, `lose-save-name.png` (chạy thật bằng Edge) |
| R4-LB-EXPORT | `<run_cmd> --export-leaderboard out.json` → `{"entries":[…]}` đúng thứ tự; chạy được cả `npm start --export-leaderboard out.json` (npm nuốt cờ — đã xử lý), `npm start -- --export-leaderboard out.json` và `node src/server.js --export-leaderboard out.json`. | test `R4-LB-EXPORT` (3 cách gọi) |

## 5. Trợ năng

| ID | AC | Bằng chứng |
|---|---|---|
| R4-A11Y-KEYS | Đổi phím: đi 4 hướng, nhảy, lướt, tương tác, tỏa sáng, tạm dừng; báo trùng phím; "Khôi phục mặc định"; lưu `localStorage ddl.settings.keys`. | ảnh `settings-keybind.png`; chạy thật: gán Space→J thành công, gán W cho "Nhảy" báo trùng (log trong §8) |
| R4-A11Y-CAP | Phụ đề + chỉ báo hình ảnh: Bóng Mực xuất hiện (kèm mũi tên mép màn hình 5 s), gió sắp thổi, 10 s cuối, đèn fuel < 30. Bật/tắt trong Cài đặt. | ảnh `play-captions-arrows.png` (2 phụ đề + 2 mũi tên khi 2 Bóng xuất hiện ở tick 300) |
| R4-A11Y-RM | "Giảm chuyển động" tắt rung camera, chớp màn hình (đỏ khi trúng, vàng khi thắp đèn), nhấp nháy đồng hồ/đèn/bất tử. Mặc định theo `prefers-reduced-motion`. | `web/main.js` (`flash`, `shakeT`), test tĩnh `R4-A11Y` |
| R4-A11Y-FONT | Mọi chữ UI ≥ 18 px ở 1280×720; tùy chọn chữ lớn ×1.25 (`body.big`). | test `R4-A11Y` (quét CSS) |

## 6. Đóng gói & tài liệu

| ID | AC | Bằng chứng |
|---|---|---|
| R4-PKG-3CMD | Clone sạch → `npm install` → `npm start` → mở `http://localhost:8080` (≤ 3 lệnh kể cả `git clone`). | README; kiểm bằng cách giải nén zip và chạy `node src/server.js` (§8) |
| R4-PKG-DOCS | `README.md` (mô tả, ảnh, yêu cầu, cài đặt, điều khiển, test, headless, bench, soak), `CHANGELOG.md` (4 phase), `CREDITS.md`, `LICENSE`. | các file ở gốc repo |
| R4-PKG-REL | Release `v1.0.0`: zip chạy ngay (`npm run package`) + `Dockerfile`. | `dist/dao-den-long-v1.0.0.zip` (tạo cục bộ; tải lên Release do tác giả) |

## 7. Bảng giả định (Ticket-04 mơ hồ → chọn gì)

| # | Điểm mơ hồ | Giả định đã chọn |
|---|---|---|
| B4-1 | "Ngược chiều kim đồng hồ khi nhìn từ trên xuống" so với quy ước góc dự án `(x,z)=(r cos a, r sin a)` | Hiểu theo hình học thật: nhìn từ +Y xuống thì +Z hướng xuống màn hình, nên đi ngược chiều kim đồng hồ là `(x,z) = (30 cos φ, −30 sin φ)`; φ=0 tại (30,15,0). |
| B4-2 | Mốc thời gian 0° của camera | Khung hình đầu tiên của cảnh (tính cả 3 s khởi động); sau 15 s về lại (30,15,0). |
| B4-3 | "Rải đều trên đảo (seed 42)" | Lấy mẫu đều theo diện tích trong đĩa bán kính 38 m bằng `mulberry32(seed)`; đom đóm cùng cách (Y=0). |
| B4-4 | 200 Bóng "ở trạng thái wander … vẫn di chuyển theo luật wander" | Bench tắt phát hiện Mây nên Bóng không bao giờ sang `chase`. Luật wander có sẵn hướng tới đèn chưa sáng gần nhất (L4, L5) nên theo thời gian các Bóng dồn về hai đèn đó; không sửa luật. |
| B4-5 | "Đo cùng cảnh chuẩn": hiệu ứng/nhân vật sáng tạo | Âm thanh tắt, HUD ẩn, không lá gió; vẫn có Mây, đèn, đom đóm, Bóng Mực, ánh sáng, sương, đổi màu trời theo số đèn (rẻ, thuộc cảnh thật). |
| B4-6 | dt_i, khoảng đo, phân vị | dt = hiệu timestamp `requestAnimationFrame` liên tiếp; đo các khung có t ∈ [3 s, 3 s + duration]; p95 theo nearest-rank (`ceil(0.95N)`-th nhỏ nhất). |
| B4-7 | "Cửa sổ 1280×720" | `Browser.setWindowBounds` 1280×720 + `Emulation.setDeviceMetricsOverride` 1280×720, DPR 1, `setPixelRatio(1)` để mọi máy render đúng 1280×720 điểm ảnh. |
| B4-8 | `vsync_off` trung thực | `true` chỉ khi đã truyền cờ tắt vsync **và** chuỗi dt không giống khóa tần số quét (sd < 0.6 ms quanh 30/60/75/90/120/144/165/240 Hz). |
| B4-9 | `load_ms` | Từ lúc tiến trình `node src/bench.js` bắt đầu (gồm khởi động server + trình duyệt) tới khi trang báo khung hình đầu của cảnh bench. |
| B4-10 | `peak_mem_mb` | Tổng working set/RSS của các tiến trình trình duyệt (PID do CDP `SystemInfo.getProcessInfo` liệt kê), lấy mẫu mỗi 10 s và một lần cuối; bộ nhớ dùng chung có thể bị tính lặp nên là cận trên. |
| B4-11 | `mem_start_mb` "sau khi tải xong Đêm đầu" | Đo sau khi dựng Đêm 1 **và** khởi động JIT bằng 3 Đêm nháp (seed riêng, không tính kết quả), có ép GC trước mỗi lần đo. Không làm vậy thì mem_end/mem_start ≈ 1.36 chỉ vì mã chưa biên dịch lúc đo đầu (cao nguyên ≈ 48–53 MB, không rò rỉ: chạy 100 Đêm vẫn ~53 MB). |
| B4-12 | Kết quả soak toàn `lost` | Input ngẫu nhiên (đi loạn, bấm bừa) không thể thắp đủ đèn; không thay đổi để "đẹp" số. |
| B4-13 | Bảng xếp hạng: ai ghi `achieved_at`/`seed`, khi nào hỏi tên | Máy chủ ghi `achieved_at` (giờ cục bộ + offset) để khỏi giả; `seed` = seed của lượt chơi (Đêm n dùng `seed + n`); hỏi tên khi thua (kèm tùy chọn chơi lại không lưu) và sau Bình Minh. Thua giữa chừng lưu tổng điểm các Đêm đã thắng. |
| B4-14 | Nơi lưu bảng | `data/leaderboard.json` cạnh mã nguồn (đổi bằng biến môi trường `DDL_LEADERBOARD`); bản chạy bằng trình duyệt cần server (`npm start`). |
| B4-15 | Đổi phím | Esc, Enter, ←/→ là phím hệ thống (không gán được; Esc luôn tạm dừng). Gán trùng bị **từ chối kèm thông báo** (không tự hoán đổi). |

## 8. Nhật ký kiểm chứng thật (chạy trên máy tác giả, 2026-11-20)

- `npm test`: 68/68 đạt (`docs/evidence/phase4/test-output.txt`).
- Bench 30 s: xem `bench.json`. Hai lần chạy liên tiếp cho avg_fps 100–125, p1_low 36–58 — **dao động theo lần chạy** (laptop Intel UHD, Windows 11); số trong repo là lần cuối.
- Lần đo đầu (trước khi tái dùng đối tượng mỗi khung) có p1_low_fps ≈ 29.7 < 30 do các khung rác (GC) 120–350 ms; sau khi bỏ `new Color/Vector3` mỗi khung và giảm tần suất lấy mẫu RAM (5 s → 10 s) p1_low ≥ 36.
- Giao diện (CDP + Edge): đổi phím Space→J ghi vào `localStorage`, gán W cho "Nhảy" báo "⚠ Trùng phím: W đang dùng cho «Đi lên»"; thua → nhập "ab" báo lỗi, "Nguyễn_An" lưu được và hiện trong bảng.
- Giải nén `dist/dao-den-long-v1.0.0.zip` ra thư mục sạch, `node src/server.js`: `/`, `/three.module.js`, `/api/leaderboard` đều 200.

## 9. Chưa kiểm chứng / khoảng trống

- Số đo trên **máy chấm của giảng viên** chưa có.
- Chưa chơi tay trọn 3 Đêm bằng người thật trong phiên này; âm thanh chưa nghe lại.
- Docker image chưa build thử (máy tác giả không có Docker).
- Video demo `.mp4` do tác giả quay (không tạo được tự động).
- Bản `bench` cần Chrome/Edge/Chromium; không có trình duyệt thì thoát mã 2 với thông báo.
