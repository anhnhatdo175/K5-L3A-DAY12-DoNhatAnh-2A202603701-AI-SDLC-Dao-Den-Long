# Changelog — Đảo Đèn Lồng

Mọi thay đổi đáng chú ý của dự án được ghi lại tại đây. Quy ước tuân theo [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Phase 4 / v1.0.0] — 2026-11-20 (Ticket-04 "Bình minh: phát hành v1.0.0", Contract v1.3)

### Added
- **Benchmark** `node src/bench.js --seed 42 --duration 30 --out bench.json`: mở Chrome/Edge 1280×720 không toàn màn hình, tắt vsync, cảnh chuẩn (Đêm 1, 200 Bóng Mực wander, 100 đom đóm, L1–L3 sáng fuel 100, camera bay vòng R=30 m / Y=15 m / 15 s), 3 s khởi động rồi đo; xuất `bench.json` đúng định nghĩa Ticket-04 (`src/benchstats.js`).
- **Soak test** `node src/soak.js --seed 7 --nights 10 --out soak.json`: 10 Đêm liên tiếp trong một tiến trình, input ngẫu nhiên theo seed, đo RSS đầu/cuối.
- **Bảng xếp hạng cục bộ**: nhập tên (3–12 ký tự, cho phép chữ có dấu) sau Bình Minh hoặc sau khi thua; top 10; lưu `data/leaderboard.json`; màn hình Bảng xếp hạng từ menu; `npm start -- --export-leaderboard out.json`.
- **Trợ năng**: đổi phím mọi hành động (phát hiện trùng, khôi phục mặc định, lưu); phụ đề + mũi tên mép màn hình (Bóng Mực xuất hiện, gió sắp thổi, 10 s cuối, đèn fuel < 30); "Giảm chuyển động" (tắt rung camera, chớp màn hình, nhấp nháy); cỡ chữ ≥ 18 px, tùy chọn chữ lớn ×1.25.
- **Đóng gói**: `npm run package` → zip chạy ngay không cần `npm install`; `Dockerfile`; `LICENSE` (MIT), `CREDITS.md`, tài liệu `SPEC-PHASE4.md`, retro `docs/RETRO.md`, CI `.github/workflows/ci.yml`.
- 30 test mới (`tests/phase4.test.js`), gồm 6 băm "vàng" chứng minh đầu ra headless giống hệt Phase 3.

### Changed
- `game.contract.json`: `contract_version` **1.3**, thêm `bench_cmd`, `soak_cmd`. Mọi số chuẩn v1.0–v1.2 giữ nguyên. Test cũ `contract v1.2 …` đổi thành v1.3 (chỉ vì nâng version).
- `Game` nhận tùy chọn `bench` (chỉ dùng bởi cảnh benchmark; mặc định tắt nên đầu ra headless không đổi): tắt hao dầu, nhặt, sát thương, phát hiện Mây và điều kiện kết thúc Đêm.
- `src/server.js` tách thành `createServer()` + API `/api/leaderboard`; `engines.node` ≥ 22 (WebSocket có sẵn dùng cho bench).
- Client: giảm rác mỗi khung (tái dùng `Color`/`Vector3`) — p1_low_fps cải thiện rõ.
- Seed Đêm trong client: `seed_run + đêm` (để lưu `seed` vào bảng xếp hạng).

### Known limitations
- Chưa đo trên máy chấm của giảng viên; số trong `bench.json` là của máy tác giả (Intel UHD, Windows 11). Video demo do tác giả quay/đính kèm Release.

## [Phase 3] — 2026-11-20 (Ticket-03 "Đèn cạn dầu", Contract v1.2)

### Breaking Changes (Thay đổi phá vỡ tương thích)

1. **Test Contract nâng cấp lên v1.2**
   - Trường `contract_version` trong `game.contract.json` đổi từ `"1.1"` sang `"1.2"`.
   - `tuning` bổ sung: `fuel_max: 100`, `fuel_decay_per_s: 1.0`, `fuel_per_mote: 10`, `relight_cost: 5`, `win_ratio: 0.6`, `drain_per_s: 5`, `low_fuel_threshold: 30`, `capacity_max: 20`.
   - Thời lượng đêm tăng: `night1_duration_s = 240`, `night2_duration_s = 270`, `night3_duration_s = 300` (thay vì 180 / 210 / 240).

2. **[THAY THẾ] Bỏ luật thắng sớm "all_lit" — chuyển sang "giữ đảo sáng tới bình minh"**
   - Thắp sáng toàn bộ đèn không còn kết thúc đêm ngay lập tức.
   - Trạng thái thắng chỉ xét tại tick bình minh (`time_left <= 0`): nếu Mây còn sống và số đèn đang sáng tại tick cuối $\ge \lceil 0.6 \times \text{tổng đèn} \rceil$ (Đêm 1: 3/5, Đêm 2: 4/6, Đêm 3: 5/7) $\rightarrow$ thắng với `game_over.reason = "dawn_survived"`.
   - Nếu hết giờ mà số đèn sáng dưới ngưỡng $\rightarrow$ thua với `game_over.reason = "dawn"`.
   - Bỏ hoàn toàn `game_over.reason = "all_lit"`.

3. **[THAY THẾ] Đèn đã sáng có thể nhận thêm đom đóm (Châm dầu) và có thể cạn dầu tắt**
   - Nhiên liệu đèn: tối đa 100, khi vừa thắp (mới hoặc thắp lại) nhận 100.
   - Hao hụt tự nhiên khi đang sáng: 1.0 đơn vị/giây (1/60 mỗi tick).
   - Khi `fuel <= 0`: đèn chuyển sang tắt (`lit = false`), `deposited = 0`, nhớ `ever_lit = true`, phát sự kiện `lantern_out { lantern_id }`.
   - Châm dầu khi tương tác ở đèn đang sáng: `used = min(carried, ceil((100 - fuel) / 10))`, `fuel = min(100, fuel + 10 * used)`, tiêu hao `used` đom đóm, phát sự kiện `refuel { lantern_id, amount, fuel }`.
   - Đèn đầy dầu (`used = 0`) không được tương tác, không phát sự kiện, không cộng điểm.
   - Thắp lại đèn đã từng sáng (`ever_lit = true`) chỉ tốn 5 đom đóm (thay vì 10). Phát sự kiện `lantern_lit { lantern_id, relight: true }`.

4. **[THAY THẾ] Bóng Mực có thể vào vùng đèn yếu & hút dầu**
   - Đèn có `fuel < 30` mất vùng an toàn. Đúng 30 vẫn giữ vùng an toàn.
   - Trạng thái mới của Bóng Mực: `drain`.
   - Bóng Mực ở trạng thái `wander` ưu tiên tìm đèn sáng gần nhất có `fuel < 30`. Khi cách đèn $\le 2$ m (XZ), chuyển sang `drain`, đứng yên hút 5 fuel/giây. Phát sự kiện `fuel_drain { lantern_id, shade_id, fuel }` mỗi 60 tick.
   - Thoát `drain`: sang `chase` nếu Mây vào trong 6 m; sang `stunned` nếu trúng Tỏa Sáng; sang `wander` nếu đèn tắt, fuel nạp lên $\ge 30$, hoặc cách đèn $> 2$ m.
   - Châm dầu đèn lên $\ge 30$ khi có Bóng Mực trong vùng 6 m: đẩy toàn bộ ra mép vùng trong tối đa 30 tick, không gây sát thương trong lúc đó.

5. **[THAY THẾ] Toàn bộ công thức điểm cũ**
   - Mỗi đom đóm nạp vào đèn (thắp mới, thắp lại hoặc châm dầu): +5 điểm (trước đây là +10).
   - Thắp lần đầu: +100 điểm.
   - Thắp lại: +40 điểm.
   - Bóng Mực trúng Tỏa Sáng: +5 điểm; nếu bóng ngay trước đó đang ở trạng thái `drain`: +15 điểm (tổng cộng).
   - BỎ thưởng thời gian còn lại.
   - Thưởng bình minh khi thắng: mỗi đèn đang sáng $+ 50 + \lfloor \text{fuel} \rfloor$; mỗi Ngọn Lửa còn lại $+ 50$.

6. **Sức chứa đom đóm tăng dần (mới)**
   - Sức chứa không cố định 10: `capacity = min(20, 10 + 2 * successful_lights)`.
   - `successful_lights` đếm số lần thắp thành công trong Đêm (kể cả thắp lại; đèn kịch bản dựng sẵn không tính). Đặt lại 0 đầu mỗi Đêm.
   - Snapshot `player` có thêm trường `capacity`.

7. **Snapshot & Scenario Schema Extensions**
   - Snapshot:
     - `player`: thêm `capacity`.
     - `lanterns[]`: thêm `fuel` (làm tròn 1 chữ số thập phân), `ever_lit` (boolean), `relit_count` (int).
     - `shades[]`: hỗ trợ `state: "drain"`.
   - Scenario:
     - `player`: thêm `successful_lights`, `capacity`.
     - `lanterns[]`: thêm `fuel`, `ever_lit`, `relit_count`. Nếu `lit: true` mà thiếu `fuel` thì mặc định `fuel: 100`.
     - `shades[]`: thêm `target_lantern_id`, `state_ticks`.

8. **Chế độ mù màu (mới)**
   - Thêm cài đặt "Bảng màu dễ phân biệt" lưu trong `localStorage` (`ddl.settings.colorblind`).
   - Mắt và viền Bóng Mực: `#00B3FF` (thay vì `#7A3CFF`).
   - Cảnh báo UI: `#FFFFFF` kèm biểu tượng ⚠ (thay vì `#FF5A5F`).
   - Nhận diện không cần màu: đèn tắt xẹp 20% và có vết rách giấy; đèn có `fuel < 30` nhấp nháy 1 Hz; thanh dầu nổi trên đèn sáng.

## [Phase 2] — 2026-11-20 (Ticket-02, Contract v1.1)

- 3 Đêm (Đảo Bến, Đảo Cau, Đảo Chuông) với bản đồ chuẩn, số liệu chuẩn Ticket-02.
- Lướt (dash), Bùa Gió, Gió Lạc (cướp đom đóm), bục nhảy, tầng/dốc, gió, tạm dừng, rơi khỏi đảo.
- Client đầy đủ: HUD, mũi tên chỉ đèn, menu/cài đặt/tạm dừng, âm thanh WebAudio.
- Test hồi quy được sửa số kỳ vọng theo Ticket-02 (lý do trong `SPEC-PHASE2.md` §1–2); tất định kiểm bằng `cmp` 2 lần (`docs/evidence/determinism.txt`).

## [Phase 1] — 2026-11-20 (PRD-0, Contract v1.0)

- Mô phỏng tất định 60 tick/s (`src/sim.js`, mulberry32 theo seed), chế độ headless theo Test Contract v1.0 (`src/headless.js`).
- Nhặt đom đóm, nạp đèn, Bóng Mực (wander/chase/recoil/stunned), Tỏa Sáng, Ngọn Lửa, vùng an toàn.
- Client 3D Three.js tối thiểu, test headless + scenario, `SPEC.md`, `AGENTS.md`, skill `headless-verify`.
