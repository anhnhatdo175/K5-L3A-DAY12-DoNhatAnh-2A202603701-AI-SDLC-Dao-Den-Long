# Changelog — Đảo Đèn Lồng

Mọi thay đổi đáng chú ý của dự án được ghi lại tại đây. Quy ước tuân theo [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
