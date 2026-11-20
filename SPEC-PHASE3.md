# SPEC — Phase 3 · Ticket-03 "Đèn cạn dầu" (Contract v1.2)

> Bổ sung cho [SPEC.md](SPEC.md) (Phase 1) và [SPEC-PHASE2.md](SPEC-PHASE2.md) (Phase 2). Khi các tài liệu mâu thuẫn, **tài liệu này và Ticket-03 thắng**: các điều luật [THAY THẾ] thay thế toàn bộ luật tương ứng trước đó.
> ID: `R3-…`. Mỗi mục có **AC** (acceptance criteria, dạng "làm A thì thấy B") và **Bằng chứng** (test trong `tests/headless.test.js`, scenario trong `scenarios/`, nhật ký trong `docs/evidence/`).

---

## 1. Thay đổi Test Contract & Kiến trúc

| ID | Thay đổi | Bằng chứng |
|---|---|---|
| R3-ARCH-1 | `game.contract.json` cập nhật `contract_version: "1.2"`; tuning bổ sung: `fuel_max: 100`, `fuel_decay_per_s: 1.0`, `fuel_per_mote: 10`, `relight_cost: 5`, `win_ratio: 0.6`, `drain_per_s: 5`, `low_fuel_threshold: 30`, `capacity_max: 20`; thời lượng Đêm 1/2/3 thành 240/270/300 s. | test `contract v1.2 khớp số chuẩn` |
| R3-ARCH-2 | Snapshot: `player` thêm `capacity`; `lanterns[]` thêm `fuel` (số thực 1 chữ số thập phân; tắt = 0), `ever_lit` (boolean), `relit_count` (int); `shades[]` có thể mang trạng thái `drain`. | test `cấu trúc: snapshot 0, end cuối...` |
| R3-ARCH-3 | Thứ tự 12 bước trong `Game.step` bổ sung: Bước 2 trừ nhiên liệu (hao tự nhiên 1/60 + bị hút 5/60 mỗi con drain); ngay sau bước 2, đèn có fuel $\le 0$ chuyển sang tắt và phát `lantern_out`. Bước 11 xét thắng/thua sau mọi cập nhật. | `src/sim.js`, các kịch bản Phase 3 |

---

## 2. Nhiên liệu Đèn & Châm dầu ([THAY THẾ])

| ID | Tiêu chí chấp nhận (AC) | Bằng chứng |
|---|---|---|
| R3-FUEL-1 Hao hụt tự nhiên | Đèn đang sáng tự giảm 1.0 fuel/s (1/60 mỗi tick). Đèn tắt có fuel = 0. | test `Phase 3 — hao hụt dầu` |
| R3-FUEL-2 Hết dầu (Tắt đèn) | Khi `fuel <= 0`: đèn chuyển sang tắt (`lit = false`), `deposited = 0`, ghi nhớ `ever_lit = true`, phát sự kiện `lantern_out { lantern_id }`. | test `Phase 3 — hao hụt dầu`; `scenarios/p3_fuel_decay.json` |
| R3-FUEL-3 Châm dầu | Bấm Tương tác (E) ở đèn đang sáng: `used = min(carried, ceil((100 - fuel) / 10))`, `fuel = min(100, fuel + 10 * used)`, tiêu hao `used` đom đóm, cộng $+5 \times used$ điểm, phát sự kiện `refuel { lantern_id, amount, fuel }`. Đèn đầy dầu (`used = 0`) không được chọn, không phát sự kiện, không cộng điểm. | test `Phase 3 — châm dầu`; `scenarios/p3_refuel.json` |
| R3-FUEL-4 Thắp lại | Đèn đã từng sáng (`ever_lit = true`) chỉ tốn 5 đom đóm để thắp lại (thay vì 10). Khi thắp lại, nhận 100 fuel, tăng `relit_count`, phát sự kiện `lantern_lit { lantern_id, relight: true }`, cộng +40 điểm thắp lại $+ 5 \times 5 = 25$ điểm nạp $= 65$ điểm. | test `Phase 3 — thắp lại`; `scenarios/p3_relight.json` |

---

## 3. Bóng Mực Hút Dầu ([THAY THẾ])

| ID | Tiêu chí chấp nhận (AC) | Bằng chứng |
|---|---|---|
| R3-DRAIN-1 Mất vùng an toàn | Đèn có `fuel < 30` mất vùng an toàn 6 m. Đúng 30 vẫn giữ vùng an toàn. | test `Phase 3 — Bóng Mực hút dầu` |
| R3-DRAIN-2 Mục tiêu hút dầu | Bóng Mực ở trạng thái `wander` ưu tiên tìm đèn sáng gần nhất có `fuel < 30` (hoà khoảng cách thì chọn id nhỏ hơn). Đến gần $\le 2.0$ m (XZ) chuyển sang trạng thái `drain`. | test `Phase 3 — Bóng Mực hút dầu` |
| R3-DRAIN-3 Trạng thái DRAIN | Đứng yên tại chỗ, hút 5.0 fuel/giây. Mỗi 60 tick (1 s) liên tục hút, phát sự kiện `fuel_drain { lantern_id, shade_id, fuel }`. Nhiều con thì hiệu ứng hút cộng dồn. | test `Phase 3 — Bóng Mực hút dầu`; `scenarios/p3_drain.json` |
| R3-DRAIN-4 Thoát khỏi DRAIN | Đang `drain`: chuyển sang `chase` nếu Mây vào trong 6 m; chuyển sang `wander` nếu đèn tắt, nếu đèn được châm dầu lên $\ge 30$, hoặc cách đèn $> 2$ m; chuyển sang `stunned` nếu trúng Tỏa Sáng. | test `Phase 3 — Bóng Mực hút dầu`, `Phase 3 — Tỏa Sáng trúng bóng đang drain` |
| R3-DRAIN-5 Thưởng điểm Tỏa Sáng | Kích hoạt Tỏa Sáng trúng Bóng Mực đang ở trạng thái `drain` được thưởng tổng cộng **+15 điểm** (thay vì +5 điểm). | test `Phase 3 — Tỏa Sáng trúng bóng đang drain`; `scenarios/p3_drain_pulse.json` |
| R3-DRAIN-6 Đẩy ra khi châm dầu | Khi đèn được châm dầu từ $< 30$ lên $\ge 30$, mọi Bóng Mực trong vùng 6 m quanh đèn bị đẩy ra mép vùng trong tối đa 30 tick, không gây sát thương trong lúc bị đẩy, và chuyển về `wander`. | test `Phase 3 — châm dầu lên >= 30`; `scenarios/p3_refuel_eject.json` |

---

## 4. Luật Thắng Mới & Sức Chứa ([THAY THẾ])

| ID | Tiêu chí chấp nhận (AC) | Bằng chứng |
|---|---|---|
| R3-WIN-1 Bỏ thắng sớm | Thắp sáng toàn bộ đèn không kết thúc đêm. Đêm tiếp tục diễn ra cho tới hết thời gian quy định. | test `Phase 1 — nạp đèn (không thắng sớm theo luật Phase 3)` |
| R3-WIN-2 Thắng Bình minh | Hết giờ (`time_left <= 0`), nếu Mây còn sống và số đèn đang sáng $\ge \lceil 0.6 \times \text{tổng đèn} \rceil$ $\rightarrow$ thắng với `game_over.reason = "dawn_survived"`. | test `Phase 3 — luật thắng bình minh`; `scenarios/p3_dawn_win.json` |
| R3-WIN-3 Thua cuộc | Hết Ngọn Lửa (`flames <= 0`) $\rightarrow$ thua ngay lập tức với `game_over.reason = "no_flames"`. Hết giờ mà số đèn sáng $< \lceil 0.6 \times \text{tổng đèn} \rceil$ $\rightarrow$ thua với `game_over.reason = "dawn"`. | test `Phase 3 — luật thua bình minh`; `scenarios/p3_dawn_fail.json` |
| R3-CAP-1 Sức chứa tăng dần | `capacity = min(20, 10 + 2 * successful_lights)`. `successful_lights` tăng 1 mỗi lần thắp sáng thành công (cả thắp mới và thắp lại); reset về 0 đầu mỗi Đêm. Nhặt đom đóm bị giới hạn bởi `capacity`. | test `Phase 3 — sức chứa tăng dần` |
| R3-SCORE-1 Điểm số mới | Nạp đom đóm: $+5$/con; thắp lần đầu: $+100$; thắp lại: $+40$; Tỏa Sáng trúng bóng: $+5$ (bóng drain: $+15$). Khi thắng: mỗi đèn sáng $+50 + \lfloor \text{fuel} \rfloor$; mỗi Lửa còn lại $+50$. Bỏ thưởng thời gian. | test `Phase 3 — châm dầu`, `Phase 3 — thắp lại`, `Phase 3 — luật thắng bình minh` |

---

## 5. Chế độ Mù màu & Đồ hoạ (Web Client)

| ID | Tiêu chí chấp nhận (AC) | Bằng chứng |
|---|---|---|
| R3-ACC-1 Cài đặt mù màu | Checkbox "Bảng màu dễ phân biệt" trong màn hình Cài đặt, lưu vào `localStorage.ddl.settings.colorblind`. | `web/index.html`, `web/main.js` |
| R3-ACC-2 Màu sắc tương phản | Khi bật mù màu: Viền/mắt Bóng Mực đổi sang `#00B3FF`; Cảnh báo UI (đồng hồ $\le 30$ s) đổi sang màu trắng `#FFFFFF` kèm ký hiệu ⚠. | `web/main.js`, `web/index.html` |
| R3-ACC-3 Nhận diện hình học | Đèn tắt bị xẹp 20% chiều cao và có vết rách giấy trên thân. Đèn sáng có kích thước bình thường và thanh dầu hiển thị phía trên. | `web/main.js` |
| R3-ACC-4 Cảnh báo nhấp nháy | Đèn có `fuel < 30`: cả đèn lồng và thanh dầu nhấp nháy chậm với tần số 1 Hz. | `web/main.js` |
