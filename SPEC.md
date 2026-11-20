# SPEC — Đảo Đèn Lồng · Phase 1 (Đêm 1 – Đảo Bến)

> **⚠ Đã được thay thế một phần bởi [SPEC-PHASE2.md](SPEC-PHASE2.md)** (Ticket-02): số liệu chuẩn mới (bán kính nhặt/đèn/vùng an toàn, điểm…), bản đồ, Contract v1.1. Tài liệu này giữ nguyên làm lịch sử Phase 1; bằng chứng Phase 1 xem ở tag `phase-1`.

> Nguồn yêu cầu: PRD-0 + Test Contract v1.0 (lab board). Tài liệu này biến chúng thành **đặc tả kiểm chứng được**: mỗi điều khoản có ID (`R-…`), mỗi ID có tiêu chí nghiệm thu và bằng chứng (test / ảnh / số đo) ở mục 11.
> Từ khóa: **PHẢI** = bắt buộc theo PRD/Contract; **QUYẾT ĐỊNH** = chỗ PRD mơ hồ, tôi tự chọn và ghi lại (mục 10); **CLIENT-ONLY** = chỉ hiển thị, không ảnh hưởng headless.
> Nguồn chân lý của con số: `game.contract.json` → `tuning`. Spec trích dẫn giá trị hiện tại, nếu lệch thì file JSON thắng.

---

## 1. Mục tiêu & phi mục tiêu

**Mục tiêu.** Một game 3D góc nhìn thứ ba chơi được từ đầu đến thắng/thua trong một đêm; đồng thời có chế độ headless tất định để chấm tự động.

**Thứ tự ưu tiên khi xung đột:** (1) đúng Test Contract → (2) đúng PRD-0 → (3) chơi được → (4) đẹp/sáng tạo. Đồ họa vượt yêu cầu không có giá trị.

**Phi mục tiêu (Phase 1).** Nhiều đêm/màn, lưu game, âm thanh, multiplayer, dash, loại Bóng Mực khác, asset ngoài (không có `CREDITS.md` vì mọi hình khối đều là primitive của three.js).

## 2. Kiến trúc & ràng buộc thiết kế

| ID | Yêu cầu |
|---|---|
| R-ARCH-1 | Toàn bộ luật chơi nằm trong `src/sim.js`: thuần, không DOM, không Node API, không `Math.random()`/`Date`. |
| R-ARCH-2 | Client (`web/main.js`) và headless (`src/headless.js`) **chỉ** gọi `Game.step(input)`; không có luật nào bị sao chép. Vì vậy test headless cũng chứng minh logic của game thật. |
| R-ARCH-3 | Ngẫu nhiên chỉ qua `this.rng` = mulberry32(`--seed`). Client dùng seed ngẫu nhiên mỗi ván. |
| R-ARCH-4 | Mọi con số gameplay đọc từ `game.contract.json`; không hardcode trùng lặp. Hằng số *không* thuộc tuning (xem 3.3) nằm ở đầu `sim.js`. |
| R-ARCH-5 | Chạy trên macOS/Linux/Windows với Node ≥ 20; phụ thuộc duy nhất: `three@0.170.0` (chỉ cho client). Headless không cần `npm install`. |

## 3. Mô hình thế giới

### 3.1 Hệ tọa độ (PHẢI)
Mét; Y hướng lên; mặt đảo Y=0; Mây xuất phát (0,0,0). Mọi khoảng cách luật chơi đo **trên mặt phẳng XZ**, giữa: chân Mây, tâm Bóng Mực, chân cột đèn, đom đóm (điểm trên mặt đất). "Trong bán kính r" ⇔ khoảng cách **≤ r**. Không cộng kích thước thân.

### 3.2 Đảo
Đĩa bán kính **40 m** tâm (0,0,0). Đèn L1…L5 trên vòng bán kính **25 m**, `Lk` ở góc `(k−1)·72°`: `pos = (25·sin a, 0, 25·cos a)`; L1 = (0,0,25).

### 3.3 Hằng số ngoài tuning (QUYẾT ĐỊNH)
`ISLAND_RADIUS=40`, `LANTERN_RING=25`, `MOTE_MAX=24`, `MOTE_RESPAWN_TICKS=240`, `SHADE_FIRST_TICK=300`, `SHADE_EVERY_TICKS=720`, `SHADE_MAX=5`, `JUMP_V=7 m/s`, `GRAVITY=20 m/s²`.

### 3.4 Tuning hiện tại

| Khóa | Giá trị | Ý nghĩa |
|---|---|---|
| player_speed | 6 | m/s |
| carry_capacity | 10 | đom đóm mang tối đa |
| lantern_cost | 8 | đom đóm để thắp 1 đèn |
| lantern_count_night1 | 5 | |
| pickup_radius | 1.5 | tự nhặt |
| interact_radius | 3 | nạp đèn |
| pulse_cost / pulse_radius | 2 / 6 | |
| night1_duration_s | 300 | |
| flames | 3 | máu |
| invuln_s | 1.5 | bất tử sau khi bị đánh |
| hit_drop_ratio | 0.5 | |
| pulse_stun_s / pulse_push_m / pulse_cooldown_s | 3 / 3 / 1 | |
| safe_radius | 5 | quanh mọi đèn |
| shade_speed / shade_hit_radius | 3.5 / 1 | |
| fall_enabled | true | |
| score | mote 10 · lantern 100 · stun 20 · second_left 1 · flame_left 50 | |

Cân bằng có chủ đích: Mây (6) nhanh hơn Bóng Mực (3.5) nên né được; cần 5×8=40 đom đóm, trong khi có 24 con lúc đầu + hồi 1 con/4 s ⇒ phải xoay vòng và cân nhắc dùng tỏa sáng.

## 4. Mô hình thời gian & vòng lặp (PHẢI)

- 60 tick/s cố định, 1 tick = 1/60 s. Snapshot 0 = sau dựng scenario, **trước** input.
- Bước k (k=0…N−1) đọc input tick k, sinh trạng thái k+1; mọi event trong bước ghi `tick = k+1`.
- `--ticks N` chạy đúng N bước, trừ khi game kết thúc sớm (khi đó dừng ngay sau bước kết thúc).
- `time_left_s = duration − steps/60`, làm tròn 3 chữ số. `duration` = `night1_duration_s`, hoặc `scenario.time_left_s` nếu có.

### 4.1 Thứ tự xử lý trong một bước (cố định, quan trọng cho tính tất định)
1. `steps++`; giảm `invuln`, `pulse cooldown` (nếu > 0)
2. Di chuyển + nhảy/trọng lực
3. Kiểm tra rơi khỏi đảo
4. Nhặt đom đóm
5. Nạp đèn (cạnh lên của `interact`)
6. Tỏa sáng (cạnh lên của `pulse`)
7. Bóng Mực: giảm choáng hoặc di chuyển + ép ra khỏi vùng an toàn
8. Va chạm Bóng Mực → Mây
9. Sinh ngẫu nhiên: Bóng Mực rồi đom đóm
10. Kết thúc: hết lửa → thua `no_flames`; else mọi đèn sáng → thắng `all_lit`; else hết giờ → thua `dawn`

Hệ quả có chủ đích: thắng ưu tiên hơn hết giờ cùng tick; thua do hết lửa ưu tiên hơn thắng cùng tick.

## 5. Điều khiển & input (PHẢI)

| ID | Yêu cầu |
|---|---|
| R-IN-1 | Input giữ trạng thái; frame chỉ đổi trường có mặt, trường vắng giữ giá trị cũ. Mặc định: `move [0,0]`, `cam_yaw_deg 0`, nút = false. |
| R-IN-2 | `move=[x,z]`, mỗi thành phần ∈ [−1,1]; dài hơn 1 thì chuẩn hóa về 1. Hướng thế giới với θ = yaw: `x' = x cosθ + z sinθ`, `z' = −x sinθ + z cosθ`. θ=0: x→+X, z→+Z. |
| R-IN-3 | `jump`, `interact`, `pulse` kích hoạt ở **cạnh false→true**; giữ nguyên true không lặp lại. |
| R-IN-4 | `tick` của frame tăng nghiêm ngặt; sai → exit 2. Không có file inputs ⇒ Mây đứng yên. |

CLIENT-ONLY: bàn phím W/A/D/S, ←/→ hoặc kéo chuột để xoay, Space, E, F, Enter. Vì camera nhìn theo +Z, phím phải ánh xạ vào x = −1 (khác trục contract); đã tính trong `readInput`.

## 6. Luật chơi

### 6.1 Mây (người chơi)
| ID | Yêu cầu |
|---|---|
| R-PL-1 | Tốc độ ngang = `player_speed`·|move| (|move|≤1). |
| R-PL-2 | Nhảy chỉ khi đang chạm đất (y ≤ 0): vy = 7, trọng lực 20. Nhảy **không** né được Bóng Mực (khoảng cách XZ). |
| R-PL-3 | Bắt đầu với `flames` lửa (scenario ghi đè được), carried = 0. |
| R-PL-4 | Bị đánh: `flames −= 1`; rơi `d = floor(carried·hit_drop_ratio)`; bất tử `round(invuln_s·60)` tick; event `player_hit {by, flames, dropped}`. Đom đóm rơi vãi **ngoài** tầm nhặt (≥ `pickup_radius+1` m) để không bị nhặt lại ngay. |
| R-PL-5 | Rơi khỏi đảo (khoảng cách tới tâm > 40): nếu `fall_enabled` → như bị đánh với `by:"fall"` (đom đóm rơi ở mép), hồi sinh (0,0,0), bất tử. Nếu tắt → bị chặn ở mép. Rơi không bị chặn bởi bất tử. |

### 6.2 Đom đóm
| ID | Yêu cầu |
|---|---|
| R-MO-1 | Khởi đầu 24 con rải đều theo diện tích trong bán kính 36 m (seeded). Ids `M1…`. |
| R-MO-2 | Mây trong `pickup_radius` và carried < `carry_capacity` ⇒ nhặt; carried++, +`per_mote`, event `mote_picked {carried}`. Đầy túi thì không nhặt. |
| R-MO-3 | Mỗi 240 tick, nếu < 24 con đang có thì sinh 1 con ngẫu nhiên. Tắt khi `random_motes:false`. |

### 6.3 Đèn
| ID | Yêu cầu |
|---|---|
| R-LA-1 | `interact` (cạnh lên): chọn đèn **chưa sáng gần nhất** trong `interact_radius`; ngoài tầm ⇒ không gì xảy ra. |
| R-LA-2 | Nạp `amount = min(carried, lantern_cost − deposited)`; nếu > 0 ⇒ event `deposit {lantern_id, amount, deposited}`. |
| R-LA-3 | `deposited ≥ lantern_cost` ⇒ sáng, +`per_lantern`, event `lantern_lit {lantern_id}`. Đèn đã sáng không nhận thêm. |
| R-LA-4 | Mỗi đèn là vùng cấm Bóng Mực bán kính `safe_radius` (xem 6.4) — kể cả đèn chưa sáng (QUYẾT ĐỊNH). |

### 6.4 Bóng Mực
| ID | Yêu cầu |
|---|---|
| R-SH-1 | Trạng thái: `chase`, `stunned` (bắt buộc theo contract). Ids `S1…`, không trùng. |
| R-SH-2 | `chase`: đi thẳng về Mây với `shade_speed`, không vượt qua Mây trong 1 tick. Sau mỗi bước bị **chiếu ra mép** vùng an toàn của mọi đèn (trượt dọc mép). |
| R-SH-3 | Chạm: khoảng cách ≤ `shade_hit_radius`, Shade không `stunned`, Mây hết bất tử ⇒ R-PL-4 (tối đa 1 lần/tick). |
| R-SH-4 | Sinh ngẫu nhiên ở tick 300 rồi mỗi 720 tick, tối đa 5 con, tại mép đảo (r=38), góc seeded; event `shade_spawned {id}`. Tắt khi `random_shades:false`. |
| R-SH-5 | Hết choáng ⇒ quay lại `chase`. |

### 6.5 Tỏa sáng
| ID | Yêu cầu |
|---|---|
| R-PU-1 | Điều kiện: cạnh lên `pulse`, `carried ≥ pulse_cost`, cooldown = 0. Không đủ điều kiện ⇒ **không** có event, không tốn gì. |
| R-PU-2 | Hiệu lực: trừ `pulse_cost` đom đóm, đặt cooldown `round(pulse_cooldown_s·60)` tick. |
| R-PU-3 | Mọi Shade trong `pulse_radius`: → `stunned` đúng `round(pulse_stun_s·60)` tick, bị đẩy `pulse_push_m` ra xa Mây (rồi ép ra vùng an toàn), +`per_stun` mỗi con. |
| R-PU-4 | Luôn ghi `pulse {stunned_ids:[…]}` (có thể rỗng) khi tỏa sáng thành công. |

### 6.6 Kết thúc & điểm
| ID | Yêu cầu |
|---|---|
| R-EN-1 | Thắng: tất cả đèn sáng ⇒ `game_over {won, all_lit}`. |
| R-EN-2 | Thua: `flames = 0` ⇒ `{lost, no_flames}`; `time_left ≤ 0` ⇒ `{lost, dawn}`. |
| R-EN-3 | Điểm cộng dần (mote, lantern, stun). Chỉ khi **thắng** cộng thêm `floor(time_left_s)·per_second_left + flames·per_flame_left` (trước dòng `end`). Thua không có thưởng thời gian/lửa. |
| R-EN-4 | Sau khi kết thúc, `step` không còn đổi trạng thái. Client cho chơi lại (Enter / nút). |

## 7. Giao diện & phong cách (CLIENT-ONLY, từ PRD-0)

| ID | Yêu cầu | Cách đạt |
|---|---|---|
| R-UI-1 | HUD: máu, đom đóm đang mang/tối đa, điểm, số đèn sáng/5, thời gian còn lại. | `web/index.html` + `hud()` |
| R-UI-2 | Màn kết thúc thắng/thua + điểm + chơi lại. | `showEnd()` |
| R-UI-3 | Đêm, ấm áp, cổ tích; vàng cam = tốt, tím đen = nguy hiểm. | Nền tím đen; đèn/đom đóm vàng cam; Bóng Mực tím đen mắt tím |
| R-UI-4 | Đảo sáng dần khi thắp đèn. | Màu nền/sương/cỏ + ambient nội suy theo `lit/5` |
| R-UI-5 | Mây đội nón lá treo đèn lồng nhỏ (có PointLight). | `hero` group |
| R-UI-6 | Không bạo lực/máu me: máu = "ngọn lửa" 🔥; bị đánh chỉ nhấp nháy. | |
| R-UI-7 | Chỉ báo vùng an toàn (vòng quanh đèn) và vòng sóng khi tỏa sáng. | `ring`, `pulseRing` |

## 8. Headless (PHẢI)

### 8.1 CLI
`node src/headless.js --seed <int> --night 1 [--scenario f] [--inputs f] --ticks <int> --out f.jsonl [--snapshot-every <int≥1, mặc định 10>]`

| Tình huống | Exit |
|---|---|
| Thành công (kể cả game kết thúc sớm) | 0 |
| inputs/scenario không đọc được, JSON hỏng, sai kiểu/miền giá trị, `tick` không tăng nghiêm ngặt, `move` ngoài [−1,1], lantern không có id… | **2**, stderr nêu lý do, **không** tạo file out |
| Thiếu/sai tham số CLI, `--night` ≠ 1 | 1 |
| Lỗi bất ngờ | 1 + stack |

### 8.2 Scenario
`player{pos,carried,flames}`, `random_motes`, `random_shades`, `motes` (thay thế), `shades` (thay thế, có thể kèm `id`), `lanterns` (cập nhật theo id; `pos`, `deposited`, `lit:true`), `time_left_s`. Trường vắng ⇒ mặc định game.
- Dựng scenario **không** phát event, **không** cộng điểm (kể cả `lit:true`). Đèn `lit:true` không nói `deposited` ⇒ `deposited = lantern_cost`.
- Shade trong scenario ở trạng thái `chase` ngay lập tức; id tự sinh tránh trùng id đã có.

### 8.3 Output JSONL
- Snapshot ở tick 0 và mọi tick chia hết `--snapshot-every`: `type,tick,sim_tick,state,time_left_s,score,player{pos,flames,carried},lanterns[{id,pos,lit,deposited}],shades[{id,pos,state}],motes_active` + `motes[{id,pos}]` (khuyến nghị).
- Event: `mote_picked, deposit, lantern_lit, pulse, player_hit, shade_spawned, game_over` đúng schema `data` của contract; sự kiện không xảy ra thì không ghi.
- Dòng cuối luôn là `{"type":"end","ticks","state","score"}`.
- Tọa độ làm tròn 3 chữ số (không `-0`). **Tất định**: cùng seed + scenario + inputs ⇒ byte-giống-hệt, kể cả id tự sinh.
- Tại tick kết thúc không nằm trên mốc snapshot, không có snapshot bổ sung; trạng thái cuối nằm ở dòng `end` (QUYẾT ĐỊNH, bám nguyên văn "mỗi N tick").

## 9. Phi chức năng

| ID | Yêu cầu | Mục tiêu / đo |
|---|---|---|
| R-NF-1 | Headless nhanh | 18 000 tick (1 đêm) < 1 s; đo thực tế ≈ 0.1 s |
| R-NF-2 | Client mượt | 60 fps cố định bước logic; vòng lặp có `acc` + chặn dt ≤ 0.1 s để không "xoắn ốc chết" |
| R-NF-3 | Bảo mật | Server tĩnh chỉ phục vụ danh sách file cố định (không path traversal); không key/secret trong repo |
| R-NF-4 | Khởi động | ≤ 3 lệnh: `npm install`, `npm start` (+ `npm test`) |

## 10. Giả định & quyết định (chỗ PRD-0 mơ hồ)

| # | Mơ hồ | Quyết định | Lý do / rủi ro |
|---|---|---|---|
| A1 | `safe_radius` áp cho đèn nào? | Mọi đèn | Chỗ nạp đèn luôn an toàn; rủi ro: test mong Shade vào được vùng đèn chưa sáng |
| A2 | Làm tròn đom đóm rơi | `floor` | Carried 1 ⇒ không rơi gì (nhẹ tay) |
| A3 | Giây còn lại trong điểm | `floor(time_left_s)` | Điểm nguyên |
| A4 | Pulse khi không có Shade | Vẫn tốn + ghi event rỗng | Có phản hồi cho người chơi/test |
| A5 | Stun lại Shade đang choáng | Làm mới thời gian, tính điểm lại | Đơn giản; có thể bị farm điểm nhẹ — chấp nhận ở Phase 1 |
| A6 | Nhặt lại đom đóm đã rơi | Được, tính điểm lại | Đơn giản; farm bị giới hạn bởi bị mất lửa |
| A7 | Vị trí hồi sinh sau khi rơi | (0,0,0) | Contract nói xuất phát tại đó |
| A8 | Thắng và hết lửa/hết giờ cùng tick | no_flames > all_lit > dawn | Xem 4.1 |
| A9 | `dash` | Không có | Contract: "nếu có" |
| A10 | Pulse đẩy Shade ra ngoài đảo | Không giới hạn (Shade không rơi) | Không ảnh hưởng luật |
| A11 | Lantern id lạ trong scenario | Tạo mới nếu có `pos`, thiếu `pos` ⇒ vị trí (0,0,0) | Cho phép test nhiều đèn; chưa ép exit 2 |

## 11. Truy vết yêu cầu → bằng chứng

Test: `tests/headless.test.js` (`npm test`, kết quả ở `docs/evidence/test-output.txt`). Scenario: `scenarios/`.

| Yêu cầu | Bằng chứng | Trạng thái |
|---|---|---|
| R-ARCH-*, 4, 8.3 (định dạng, tick, time_left) | Test 1 | Đạt |
| R-ARCH-3, tất định | Test 2 + `cmp` 2 lần seed 42 (18 000 tick) → `docs/evidence/determinism.txt` | Đạt |
| R-MO-2, điểm mote | Test 3 (`pickup.json`) | Đạt |
| R-LA-1…3, R-EN-1, R-EN-3 (thắng + thưởng) | Test 4 (`deposit_win.json`) | Đạt |
| R-PU-1…4 | Test 5 (`pulse.json`) | Đạt (nhánh *không đủ đom đóm/đang cooldown* **chưa** có test riêng) |
| R-PL-4, R-SH-3, bất tử, không nhặt lại ngay | Test 6 (`hit.json`) | Đạt |
| R-LA-4, R-SH-2 | Test 7 (`safe.json`, 600 tick, kiểm mỗi tick) | Đạt |
| R-PL-5 | Test 8 (`fall.json`) | Đạt (nhánh `fall_enabled:false` **chưa** test) |
| R-EN-2 (no_flames, dawn) | Test 9 | Đạt |
| Scenario không event/điểm | Test 10 | Đạt |
| R-IN-4, 8.1 exit 2 | Test 11 | Đạt (4 trường hợp lỗi) |
| R-UI-1/3/5 | `docs/evidence/screenshot-night1.png` | Đạt (ảnh khởi đầu; chụp *trước* khi tăng độ sáng) |
| R-UI-2/4/7, chơi tay một ván thắng/thua | — | **Chưa kiểm chứng** |
| R-NF-1 | `time node src/headless.js … --ticks 18000` ≈ 0.1 s | Đạt |
| R-NF-2 (fps thật) | — | **Chưa đo** |

### Khoảng trống đã biết (làm tiếp nếu còn thời gian)
1. Test cho pulse bị từ chối (thiếu đom đóm/cooldown), `fall_enabled:false`, đầy túi không nhặt, cạnh lên của `interact` giữ nguyên true.
2. Chơi tay và quay video một ván thắng + một ván thua; chụp lại ảnh sau khi chỉnh sáng.
3. Đo fps client trên máy thật.
4. Soát lại A1–A3 nếu giảng viên/trợ giảng làm rõ.

## 12. Tiêu chí hoàn thành Phase 1 (Definition of Done)
- [x] `game.contract.json` + headless đúng Test Contract v1.0, 11/11 test xanh, tất định
- [x] Game có giao diện: di chuyển, nhảy, camera, đom đóm, nạp đèn, Bóng Mực, tỏa sáng, thắng/thua, điểm, HUD, chơi lại
- [x] README (≤3 lệnh, điều khiển, điểm), giả định, "Sáng tạo của tôi", AGENTS.md
- [ ] `team` trong contract điền MSSV–họ tên
- [ ] Chơi tay + video demo < 5 phút
- [ ] Commit, push repo public, tag `phase-1`
