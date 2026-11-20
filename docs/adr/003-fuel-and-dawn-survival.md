# ADR 003: Mô hình trạng thái Nhiên liệu đèn và Luật thắng Bình minh (Phase 3)

- **Trạng thái**: Đã chấp nhận (Accepted)
- **Ngày**: 2026-11-20
- **Ngữ cảnh**: Ticket-03 (Change Request "Đèn cạn dầu", Contract v1.2)

---

## 1. Bối cảnh & Vấn đề

Trong Phase 1 và 2, người chơi giỏi có thể thắp toàn bộ đèn chỉ trong 2 phút đầu của Đêm. Khi đèn cuối cùng sáng, game kết thúc ngay lập tức với lý do `all_lit`. Điều này dẫn đến hai hạn chế lớn trong trải nghiệm người chơi:
1. Đêm kết thúc quá sớm, thiếu sự hồi hộp, căng thẳng ở nửa sau của Đêm.
2. Đèn sau khi thắp trở thành "bất khả xâm phạm" (an toàn tuyệt đối, không nhận đom đóm), khiến người chơi không cần quay lại các khu vực đã hoàn thành.

Nhà thiết kế quyết định chuyển mục tiêu cốt lõi từ **"thắp hết đèn"** sang **"giữ đảo sáng tới bình minh"**.

---

## 2. Quyết định Thiết kế

### 2.1. Mô hình trạng thái Đèn & Nhiên liệu (Lantern State Machine)

1. **Đơn vị lưu trữ nội bộ**:
   - Để tránh sai số số thực trong quá trình trừ dần mỗi tick (1.0 đơn vị/giây = $1/60$ mỗi tick), hệ thống lưu trữ `fuelUnits` dưới dạng số nguyên với tỉ lệ 60 units = 1.0 fuel (tối đa 6000 units = 100.0 fuel).
   - Làm tròn 1 chữ số thập phân (`r1`) chỉ diễn ra khi xuất snapshot và dữ liệu sự kiện (`refuel`, `fuel_drain`).

2. **Vòng đời nhiên liệu đèn**:
   - Khi thắp mới hoặc thắp lại: `fuel = 100.0` (`fuelUnits = 6000`).
   - Đang sáng (`lit = true`):
     - Tự hao hụt tự nhiên: 1.0 đơn vị/giây ($1/60$ mỗi tick).
     - Bị Bóng Mực hút (`drain`): 5.0 đơn vị/giây ($5/60$ mỗi tick cho mỗi Bóng đang hút).
     - Nếu `fuelUnits <= 0`: đèn tắt (`lit = false`), `deposited = 0`, ghi nhớ `ever_lit = true`, phát sự kiện `lantern_out { lantern_id }`.
   - Châm dầu khi đang sáng:
     - Nhận đom đóm: `used = min(carried, ceil((100 - fuel) / 10))`.
     - Nhiên liệu nạp: `fuel = min(100, fuel + 10 * used)`.
     - Đèn đầy dầu (`used = 0`) không được chọn khi bấm tương tác, không phát sự kiện, không cộng điểm.
   - Thắp lại:
     - Đèn có `ever_lit = true` chỉ tốn 5 đom đóm (thay vì 10).
     - Phát sự kiện `lantern_lit { lantern_id, relight: true }`.

3. **Mất an toàn và khôi phục vùng an toàn**:
   - Đèn có `fuel < 30` (tương ứng `< 1800 units`) mất hoàn toàn vùng an toàn 6 m.
   - Khi đèn được châm dầu hoặc thắp lại đạt $\ge 30$, vùng an toàn được kích hoạt trở lại. Mọi Bóng Mực đang nằm trong bán kính 6 m bị kích hoạt trạng thái đẩy ra mép (`eject`) trong tối đa 30 tick và không gây sát thương trong lúc này.

---

### 2.2. Máy trạng thái Bóng Mực: Trạng thái DRAIN

1. **Mục tiêu ưu tiên khi đi dạo (`wander`)**:
   - Khi ở trạng thái `wander`, Bóng Mực tìm kiếm đèn sáng có `fuel < 30` gần nhất (nếu bằng khoảng cách thì chọn `id` nhỏ hơn).
   - Nếu không có đèn yếu, bóng tìm về đèn tắt gần nhất như trước.

2. **Chuyển sang `drain`**:
   - Khi Bóng Mực cách đèn yếu mục tiêu $\le 2.0$ m (XZ), nó chuyển sang trạng thái `drain`.
   - Ở `drain`, bóng đứng yên và trừ 5.0 fuel/giây vào đèn. Cứ mỗi 60 tick (1 giây) liên tục hút, game phát sự kiện `fuel_drain { lantern_id, shade_id, fuel }`.

3. **Chuyển tiếp từ `drain` sang trạng thái khác**:
   - Sang `chase`: Khi Mây đi vào trong phạm vi 6 m quanh bóng.
   - Sang `stunned`: Khi trúng kỹ năng Tỏa Sáng. Đặc biệt: Tỏa Sáng trúng bóng đang `drain` được thưởng tổng cộng **+15 điểm** (thay vì +5 điểm thông thường).
   - Sang `wander`: Khi đèn mục tiêu bị tắt hoàn toàn (`fuel <= 0`), khi đèn được châm dầu lên `fuel >= 30`, hoặc khi bóng bị rời xa đèn $> 2.0$ m.

---

### 2.3. Luật thắng mới: Sống sót tới Bình minh (Dawn Survival)

1. **Bãi bỏ hoàn toàn kết thúc sớm**:
   - Dù người chơi thắp sáng toàn bộ đèn của đảo, đêm vẫn tiếp tục chạy cho đến khi đồng hồ đếm ngược hết giờ (`time_left <= 0`).
   - Loại bỏ mã kết thúc `all_lit`.

2. **Điều kiện thắng & thua tại tick cuối**:
   - Game thực hiện xét thắng/thua ở bước 11 của tick:
     - Nếu $p.\text{flames} \le 0$: thua ngay lập tức với lý do `no_flames` (kể cả ở tick cuối).
     - Khi `steps >= total_ticks` (bình minh):
       - Nếu số đèn đang sáng $\ge \lceil 0.6 \times \text{tổng đèn} \rceil$ (Đêm 1: 3/5, Đêm 2: 4/6, Đêm 3: 5/7) $\rightarrow$ Thắng với `game_over { result: "won", reason: "dawn_survived" }`.
       - Ngược lại $\rightarrow$ Thua với `game_over { result: "lost", reason: "dawn" }`.

3. **Thưởng điểm Bình minh**:
   - Bỏ thưởng thời gian còn lại (vì đêm luôn chạy đến hết giờ khi thắng).
   - Khi thắng:
     - Mỗi đèn đang sáng: $+ 50 + \lfloor \text{fuel} \rfloor$.
     - Mỗi Ngọn Lửa còn lại: $+ 50$.

---

### 2.4. Sức chứa tăng dần (Capacity Progression)

- Để tạo cảm giác tiến trình trong từng Đêm, sức chứa đom đóm được mở rộng:
  $$\text{capacity} = \min(20, 10 + 2 \times \text{successful\_lights})$$
- `successful_lights` đếm số lần thắp đèn thành công (cả thắp lần đầu và thắp lại) trong Đêm hiện tại, reset về 0 khi bắt đầu Đêm mới.

---

## 3. Hệ quả & Rủi ro

- **Cập nhật Test Suite**: 5 test cũ giả định `all_lit` kết thúc sớm và thời lượng Đêm cũ (180 s) đã được cập nhật sang Contract v1.2, ghi rõ nguyên nhân trong test.
- **Tính tất định (Determinism)**: Việc bổ sung cơ chế trừ nhiên liệu và sự kiện `fuel_drain` không sử dụng RNG ngoài `this.rng` (mulberry32), đảm bảo 100% tái lập được giữa các lần chạy headless.
