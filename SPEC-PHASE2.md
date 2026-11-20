# SPEC — Phase 2 · Ticket-02 "Ba hòn đảo" (Contract v1.1)

> Bổ sung cho [SPEC.md](SPEC.md) (Phase 1). Khi hai tài liệu mâu thuẫn, **tài liệu này và Ticket-02 thắng**: số liệu chuẩn thay mọi số tự chọn ở Phase 1.
> ID: `R2-…`. Mỗi mục có **AC** (acceptance criteria, dạng "làm A thì thấy B") và **Bằng chứng** (test trong `tests/headless.test.js`, scenario trong `scenarios/`, ảnh/ghi chú trong `docs/evidence/`).
> Quy ước góc (Ticket-02 §2): đo từ +X, ngược chiều kim đồng hồ trên XZ ⇒ `(x, z) = (r·cos a, r·sin a)`. Đã kiểm với toạ độ đèn Đêm 1 cho sẵn (L2 = 18° → (23.8, 7.7)).

## 1. Thay đổi kiến trúc

| ID | Thay đổi |
|---|---|
| R2-ARCH-1 | `src/worlds.js` (mới): dữ liệu + hình học 3 bản đồ (bề mặt, vật cản, bục, đèn, điểm sinh). `src/sim.js` đọc từ đó. Client dựng hình từ **chính dữ liệu này**, nên hình vẽ và va chạm không thể lệch nhau. |
| R2-ARCH-2 | `game.contract.json` → `contract_version "1.1"`, `tuning` khớp Phần 1, thêm `dash_speed`, `dash_duration_s`, `dash_cooldown_s`, `night2_duration_s`, `night3_duration_s` (test `contract v1.1 khớp số chuẩn`). |
| R2-ARCH-3 | Hai bộ đếm: `tick` (tường, tăng cả khi tạm dừng) và `sim_tick` (bước logic). Sự kiện ghi `tick`; `time_left_s = thời lượng − sim_tick/60`. |
| R2-ARCH-4 | Thứ tự xử lý 1 tick đúng 12 bước của Ticket-02 (đọc input/pause → bộ đếm → di chuyển+rơi → nhặt → đèn → vùng an toàn → Tỏa Sáng → Bóng/Gió → chạm → sinh → thắng/thua → snapshot). Mã tại `Game.step`, các bước đánh số trong comment. |

## 2. Số liệu chuẩn (Phần 1) — AC rút gọn

| ID | AC | Bằng chứng |
|---|---|---|
| R2-NUM-1 Chạy/nhảy | Chạy 6 m/s; nhảy v=7, g=20, chỉ khi chạm đất, đỉnh ≈ 1.17 m (tích phân rời rạc) | test "Nhảy" |
| R2-NUM-2 Lướt | Bấm Shift ⇒ event `dash {}`, 14 m/s đúng 12 tick (2.8 m), `dash_cd_s=1.5` tại thời điểm bắt đầu, bấm lại trước tick +90 bị bỏ qua, tại +90 được; đứng yên thì lướt theo hướng đang quay mặt (+Z lúc đầu); trên không giữ nguyên độ cao; không bất tử | test "Lướt" ×2; `phase2/dash*.jsonl` |
| R2-NUM-3 Đom đóm | Nhặt khi XZ ≤ 1.0 và chênh cao ≤ 1.5; 20 con ở 20 điểm khác nhau; mỗi 240 tick +1 ở điểm trống tới trần 30; hết điểm trống thì bỏ lượt (Đêm 1 chỉ có 24 điểm ⇒ dừng ở 24) | test "Đom đóm", "nhặt đom đóm" |
| R2-NUM-4 Đèn | Cần 10; nạp nhiều lần, đèn nhớ; tầm 2.0 m; chỉ đèn chưa sáng; gần nhất, hoà thì id nhỏ | test "nạp đèn", "tie-break" |
| R2-NUM-5 Vùng an toàn | Đèn sáng: Bóng ngoài bị chặn ở 6 m; Bóng đang ở trong lúc đèn vừa sáng bị đẩy ra ≤ 30 tick và không gây sát thương | test "vùng an toàn", "bóng trong vùng" |
| R2-NUM-6 Tỏa Sáng | 3 đom đóm, hồi 3 s (180 tick); mục tiêu chốt ngay tick kích hoạt theo khoảng cách 3D từ chân+0.8 m ≤ 5; choáng 120 tick; đẩy 4 m trong 15 tick; thiếu đom đóm/đang hồi thì không kích hoạt | test "tỏa sáng" ×2 |
| R2-NUM-7 Bóng Mực | 4.0 m/s (Đêm 3: 4.5); phát hiện 12 / bỏ đuổi 18 m; trạng thái `spawning/wander/chase/recoil/stunned`; chạm XZ ≤ 1 & chênh cao ≤ 1.5; recoil 2 m/60 tick; chạm lúc bất tử không làm gì | test "Bóng Mực", "bị chạm" |
| R2-NUM-8 Lịch sinh | 2 con ở tick 300 rồi 1 con mỗi 480/420/360 tick; tối đa 6/8/10; id S1, S2…; điểm hợp lệ cách Mây ≥ 15 m và không trong vùng đèn sáng | test "Lịch sinh" |
| R2-NUM-9 Bị đánh | −1 lửa; rơi `floor(mang/2)` ra vành 1.5–2.5 m, sống 480 tick, nhặt lại được; bất tử 90 tick | test "bị chạm" |
| R2-NUM-10 Rơi | Y < −10 ⇒ đúng 1 lần: −1 lửa, mất hết đom đóm (`lost`), chờ 60 tick (không nhặt/không bị chạm), hồi sinh ở điểm xuất phát, vận tốc 0, bất tử 90 tick; hết lửa thì thua ngay | test "rơi khỏi đảo" |
| R2-NUM-11 Thắng/thua | Hết lửa → luôn thua; còn sống + đủ đèn → thắng (kể cả đúng tick hết giờ); còn lại hết giờ → dawn | test "thắng đúng tick hết giờ", "thua" |
| R2-NUM-12 Điểm | +10/đom đóm **nạp**, +100/đèn, +5/Bóng trúng Tỏa Sáng; thắng: +⌊giây còn lại⌋×2 + 50×lửa. Tổng game = tổng các Đêm thắng (client) | test "nạp đèn + thắng" |

## 3. Bản đồ (Phần 2) — AC

| ID | AC | Bằng chứng |
|---|---|---|
| R2-MAP-1 Đêm 1 | Đèn L1…L5 đúng toạ độ cho sẵn; 24 điểm đom đóm (8@12 m + 16@33 m); Bóng sinh trên 12 điểm @37 m | test "cấu trúc", "Lịch sinh" |
| R2-MAP-2 Đêm 2 | Hai đảo r=28 (0,0) & (70,0), cầu x∈[26,44], |z|≤2; 6 đèn; bục (20,0,18)→đảo B và (50,0,−18)→đảo A: Y 14, ngang 24 m/s về tâm đảo kia, phím không ghi đè, bay ≈ 1.4 s, đáp trong đảo đích; Bóng đi qua cầu (không đi trên hư không) | test "Bục nhảy Đêm 2", "Bóng Mực qua cầu" |
| R2-MAP-3 Đêm 3 | Tầng 0/1(Y=3, vành 12–24, z>0)/2(Y=6, r=8); vách đứng không leo được; bước khỏi mép thì rơi xuống tầng dưới; 2 dốc 3 m ở 30°/150° (s 30→24, Y 0→3); bục (0,3,13) Y 12 & 8 m/s về −Z ⇒ đáp tầng 2; tháp r=2 cao 8 m không leo; 7 đèn; 30 điểm đom đóm | test "vách…", "Bục nhảy Đêm 3" |
| R2-MAP-4 Gió mạnh (Đêm 3) | Mỗi 30 s một cơn gió 5 s theo hướng ngẫu nhiên, đẩy Mây 2 m/s; báo trước 2 s (`wind.warning`, lá bay + dòng chữ); `wind.active`/`dir_deg` trong snapshot | test "Gió mạnh"; `phase2/wind.jsonl` |

## 4. Tính năng mới (Phần 3) — acceptance criteria

### R2-F1 Gió Lạc (Đêm 2, 3)
- **AC1** Tối đa 2 con, sinh tại tick 1200, 2400, … (không có ở Đêm 1); id D1, D2…; vận tốc 7 m/s (idle 2 m/s).
- **AC2** `idle → chase` khi Mây mang ≥ 5 và cách ≤ 15 m (xét mỗi tick); mất điều kiện ⇒ về `idle`.
- **AC3** Chạm (XZ ≤ 1.2) ⇒ cướp `min(3, mang)`, event `drifter_steal {drifter_id, amount, carried}`, sang `flee` 240 tick rồi biến mất (mang theo đồ cướp); mỗi con chỉ cướp 1 lần; **không** làm mất Ngọn Lửa; bất tử của Mây không ngăn bị cướp; vùng an toàn không chặn Gió Lạc.
- **AC4** Tỏa Sáng trúng con `chase` ⇒ `flee`, không cướp. Trúng con `flee` đang mang đồ ⇒ thả lại toàn bộ tại chỗ (thành đom đóm rơi, 480 tick), event `drifter_drop {drifter_id, amount}`, con đó biến mất sau 120 tick.
- Bằng chứng: tests "Gió Lạc" ×4; scenario `drifter_steal`, `drifter_pulse_chase`, `drifter_pulse_drop`, `drifter_spawn`.

### R2-F2 Bùa Gió
- **AC1** Nhặt theo luật đom đóm (XZ ≤ 1.0, chênh cao ≤ 1.5): event `charm_picked {charm_id, charm_ticks:600}`; vị trí Đêm 2 (35,0,0), Đêm 3 (30,0,25) & (−30,0,25); id C1, C2.
- **AC2** 600 tick: chạy 7.2 m/s; Lướt không hồi chiêu (vẫn phải bấm lại; bấm khi đang lướt bị bỏ qua; vẫn 14 m/s × 12 tick). Nhặt lại làm mới.
- **AC3** Biến mất khi nhặt, xuất hiện lại sau 2700 tick (`available`, `respawn_s` trong snapshot).
- Bằng chứng: test "Bùa Gió" ×2; scenario `charm`, `charm_expire`, input `charm_dash`.

### R2-F3 Chuỗi 3 Đêm (client)
- **AC** Menu → giới thiệu Đêm (tên đảo + lời Ông Đăng) → chơi → kết quả → Đêm kế; thắng Đêm 3 ⇒ màn **Bình Minh** + tổng điểm; thua ⇒ chơi lại Đêm đó. Ngọn Lửa hồi đầy mỗi Đêm. *Bằng chứng:* `docs/evidence/p2-menu.png`, chạy tay (xem §7).

### R2-F4 Tạm dừng
- **AC** Esc/P (hoặc mất focus) ⇒ logic dừng hoàn toàn: `tick` vẫn tăng nhưng `sim_tick`, thời gian, hồi chiêu, sinh, TTL, gió đứng yên; snapshot `state:"paused"`; event `paused {}`/`resumed {}`; menu Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu.
- Bằng chứng: test "Tạm dừng"; `phase2/pause.jsonl`.

### R2-F5 Cài đặt
- **AC** Âm lượng + độ nhạy chuột; lưu `localStorage` (`ddl.settings`), còn nguyên sau khi tải lại trang.

### R2-F6 Âm thanh
- **AC** Nhạc nền đêm (WebAudio tổng hợp, không dùng file ngoài ⇒ không cần `CREDITS.md`) + hiệu ứng: nhặt, thắp đèn, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng Mực xuất hiện, đếm ngược 10 s cuối (+ nạp đèn, bùa, bị cướp). Chỉ ở client.

### R2-F7 HUD đầy đủ
- **AC** Ngọn Lửa (trên trái); đồng hồ mm:ss giữa trên, **đỏ + nhấp nháy khi ≤ 30 s**; "Đèn k/n" + điểm (trên phải); thanh 10 ô đom đóm (dưới giữa); biểu tượng hồi chiêu Lướt & Tỏa Sáng (dưới phải); nhắc "E — Nạp ánh sáng (x/10)" khi đứng trong 2 m quanh đèn chưa sáng; mũi tên chỉ tới đèn chưa sáng gần nhất khi nó ngoài màn hình. *Bằng chứng:* `docs/evidence/p2-night{1,2,3}.png` (HUD + mũi tên, ảnh Đêm 2).

### R2-F8 Bảng màu chuẩn
- **AC** Hằng số `PAL` trong `web/main.js` dùng đúng mã hex của Ticket cho: trời/sương, cỏ/cát/gỗ/biển mây, đèn (sáng/lõi/tắt), đom đóm (lõi/quầng), Bóng Mực (thân/viền/choáng), áo/khăn Mây & Bùa, viền vàng/điểm, Gió Lạc; chữ/UI nguy hiểm ở CSS `:root`. Ánh sáng môi trường = `0.15 + 0.55 × (đèn sáng / tổng)`. *Giới hạn:* màu hiển thị chịu ảnh hưởng của ánh sáng (Lambert), nên màu **pixel** không bằng đúng hex; hex cấu hình thì đúng.

## 5. Test Contract v1.1 — AC

| ID | AC | Bằng chứng |
|---|---|---|
| R2-C-1 | `--night` ∈ {1,2,3}, khác thì exit ≠ 0; mỗi Đêm đúng thời lượng/số đèn | test "--night", "night_start" |
| R2-C-2 | Snapshot thêm `night`, `wind{active,dir_deg}` (+ `warning`), `player{vel,grounded,invuln,dash_cd_s,pulse_cd_s,charm_s}`, mảng `motes{id,pos,kind,ttl_s}`, `drifters{id,pos,state,stolen}`, `charms{id,available,respawn_s}` (+ `pos`) | test "cấu trúc" |
| R2-C-3 | Scenario thêm `player.{invuln_ticks,dash_cd_ticks,pulse_cd_ticks,charm_ticks}`, `shades[].{state,state_ticks_left}`, `drifters`, `charms` (thay thế), `random_drifters`, `wind_enabled`; sai kiểu ⇒ exit 2 | test "file sai định dạng", mọi scenario Phase 2 |
| R2-C-4 | Input thêm `dash`, `pause` (cạnh lên) | test "Lướt", "Tạm dừng" |
| R2-C-5 | Sự kiện mới: `dash`, `charm_picked`, `drifter_steal`, `drifter_drop`, `night_start`, `paused`, `resumed`; `player_hit` do rơi có `lost` | các test tương ứng |
| R2-C-6 | Một Đêm đầy đủ (21 600 tick) ≤ 30 s | `docs/evidence/determinism.txt`: 0.24–0.36 s; test "Hiệu năng" |
| R2-C-7 | Tất định cho cả 3 Đêm (cùng seed ⇒ cùng byte), kể cả id tự sinh | test "tất định"; `determinism.txt` |

## 6. Giả định (Ticket-02 chưa nói rõ) — **đọc khi test lệch**

| # | Mơ hồ | Quyết định |
|---|---|---|
| B1 | "tăng tốc/dừng ≤ 0.1 s" | Tức thời (0 s) — nằm trong giới hạn, thuận cho kiểm tra quãng đường |
| B2 | Đêm 3 xuất phát | (0,0,−12): (0,0,0) nằm trong chân tầng 2. Hồi sinh cũng ở điểm này. Đêm 1, 2: (0,0,0) |
| B3 | `player.invuln` trong snapshot | Boolean (tên không có `_s`); `dash_cd_s`, `pulse_cd_s`, `charm_s` tính bằng giây |
| B4 | `night_start` | Phát ở **bước đầu tiên** (`tick=1`), không phát khi `--ticks 0` |
| B5 | Pause | Cạnh lên khi đang chơi ⇒ tạm dừng và dừng bước; cạnh lên khi đang dừng ⇒ tiếp tục và **bước đó chạy bình thường**. Các nút khác bị bỏ qua khi dừng (nhưng trạng thái cạnh vẫn được cập nhật) |
| B6 | Gió: lịch | Cơn đầu tại 30 s (`sim_tick` 1800), 5 s, rồi mỗi 30 s; báo trước từ 28 s; hướng chọn lúc báo trước, số nguyên độ; gió đẩy cả khi trên không, bị vách chặn như di chuyển thường |
| B7 | Bóng `spawning` | Đúng 1 tick (thấy ở snapshot của tick sinh), từ tick sau mới tương tác |
| B8 | Bóng `wander` | 2 m/s tới điểm ngẫu nhiên cách 4–12 m, đổi mục tiêu mỗi 120–240 tick; hết choáng/recoil → `wander` rồi AI chọn `chase` nếu ≤ 12 m |
| B9 | Trạng thái mặc định của Bóng trong scenario | `chase` nếu ≤ 12 m, ngược lại `wander` (đúng ngưỡng phát hiện) |
| B10 | Bóng leo vách/dốc | Có (là "mực lỏng", y = mặt đất + 1); bị chặn bởi tháp, mép đảo, vùng an toàn; qua cầu bằng waypoint ở Đêm 2 |
| B11 | Chênh cao khi chạm | `|Mây.y − Bóng.pos.y|` (toạ độ trong snapshot) |
| B12 | Bục nhảy | Kích hoạt khi XZ ≤ 1 và `|Mây.y − bục.y| ≤ 0.5` lúc không đang bị bắn; hết khi chạm đất; lướt giữa chừng thì sau lướt trở lại vận tốc phóng |
| B13 | Lướt | Hướng = hướng phím (đã xoay theo yaw) hoặc hướng mặt; không có trọng lực trong 12 tick; không lướt khi đang lướt |
| B14 | Gió Lạc cướp | Chỉ con `chase`, mang ≥ 1; điểm sinh = điểm sinh Bóng Mực của Đêm, bay cao 1.5 m trên mặt đất; hết `flee` ⇒ **xoá khỏi mảng** (không giữ trạng thái `removed`) |
| B15 | `per_stun` | Mỗi Bóng nằm trong bán kính, kể cả đang choáng (đúng chữ Ticket) |
| B16 | Vị trí đom đóm rơi | Vành 1.5–2.5 m, thử tối đa 8 lần tìm chỗ có mặt đất đi được, không thì rơi dưới chân |
| B17 | Rơi khỏi đảo | Toạ độ Mây đứng yên (Y < −10) trong 60 tick chờ; Bóng không đuổi trong lúc đó |
| B18 | Đom đóm Đêm 2/3 | Điểm sinh theo đúng danh sách cho sẵn; 20 điểm ban đầu chọn ngẫu nhiên không lặp |

## 7. Khoảng trống đã biết (nói thẳng)

- **Chưa chơi tay trọn 3 Đêm** trên trình duyệt thật; chỉ có ảnh chụp headless-Chrome (SwiftShader) cho từng Đêm và menu. Luồng Menu → Đêm → Bình Minh, màn tạm dừng, cài đặt **chưa được người thật bấm thử** (logic pause thì có test headless).
- **Âm thanh chưa nghe thử** (môi trường chụp không có thiết bị phát/cử chỉ người dùng). Mã dùng WebAudio tổng hợp.
- **FPS ≥ 30 chưa đo** trên máy thật. Số đo duy nhất có được là CPU của lõi mô phỏng (xem trên), không phải FPS đồ hoạ. Đã giảm tải: pixel ratio ≤ 1.5, đom đóm dùng sprite thay vì PointLight (tổng ≤ 9 PointLight).
- Cú pháp góc và Đêm 3 xuất phát là suy luận từ dữ liệu (B2, §đầu); nếu bài kiểm tra ẩn khác, các test dựa vào toạ độ đèn/điểm sinh vẫn đúng nhưng test "xuất phát Đêm 3" có thể lệch.
- Không có test riêng cho: Bóng bị đẩy trúng vật cản (tháp) và Pulse làm mới choáng. (Đã có test: rơi khi đang bất tử; Gió Lạc cướp khi Mây bất tử.)
