# Day 12 — AI SDLC: Đảo Đèn Lồng

> **Cá nhân** (1 người / 1 MSSV) · Áp dụng SDLC cùng AI để xây một **game 3D** qua **4 phase**, từ yêu cầu ban đầu tới bản phát hành.
> **Lab board + trợ giảng:** **[Đảo Đèn Lồng Lab](https://claude.ai/artifact/Q1RYyv1dxjUczzCbd2ZnoW)**

---

## Tài liệu của lab

| File | Nội dung |
|---|---|
| [GUIDE.md](GUIDE.md) | Hướng dẫn làm lab: vòng làm việc mỗi phase, harness, kiểm chứng, token |
| [CHECKPOINTS.md](CHECKPOINTS.md) | Các mốc tự kiểm tra từ chuẩn bị đến nộp bài |
| [SUBMISSION.md](SUBMISSION.md) | Đặt tên repo, hạn nộp, tag, Release, video, checklist |
| [RULES.md](RULES.md) | Quy định: AI, trung thực về bằng chứng, bản quyền, bảo mật |
| [RUBRIC.md](RUBRIC.md) | Thang điểm chi tiết |

## Lab board

Yêu cầu dự án được phát hành tại **[Đảo Đèn Lồng Lab](https://claude.ai/artifact/Q1RYyv1dxjUczzCbd2ZnoW)**. Mỗi phase là một tab (tab chưa phát hành bị khóa), mỗi tab có trợ giảng AI riêng chỉ trả lời trong phạm vi phase đó. Trợ giảng cần đăng nhập claude.ai và dùng lượt Claude của bạn.

## Dự án

**Đảo Đèn Lồng**: game 3D góc nhìn thứ ba. Mây, người giữ đèn nhỏ tuổi, gom đom đóm để thắp lại các Đèn Lồng Lớn và né Bóng Mực trong sương đen.

- Không ràng buộc công nghệ; chạy được trên macOS hoặc Linux.
- Tuân theo **Test Contract** (chế độ headless) để được chấm tự động và so sánh với nhau.

| Phase | Bạn nhận | Nộp |
|---|---|---|
| 1 | **PRD-0** (mô tả tổng quát) + Test Contract | tag `phase-1` |
| 2 | **Ticket-02**, phát hành khi Phase 1 kết thúc | tag `phase-2` |
| 3 | **Ticket-03**, phát hành khi Phase 2 kết thúc | tag `phase-3` |
| 4 | **Ticket-04**, phát hành khi Phase 3 kết thúc | tag `phase-4` + Release `v1.0.0` |

Yêu cầu sẽ được bổ sung và có thể thay đổi giữa các phase, giống dự án thật.

### Lịch 4 giờ

Bài lab kéo dài **4 giờ**. Phase 1 và 2 khoảng **1 giờ**, Phase 3 khoảng **30 phút**, Phase 4 khoảng **1 giờ 30 phút**. Mỗi phase phát hành đúng mốc giờ. Phase mới xuất hiện trên lab board khi tới mốc.

| Mốc | Sự kiện | Hạn tag |
|---|---|---|
| 0h | Phát hành **Phase 1** (PRD-0), gồm cả phần chuẩn bị | `phase-1` trước mốc 1h |
| 1h | Phát hành **Phase 2** | `phase-2` trước mốc 2h |
| 2h | Phát hành **Phase 3** | `phase-3` trước mốc 2h30 |
| 2h30 | Phát hành **Phase 4** | `phase-4`, Release `v1.0.0` và video trước mốc 4h |
| 4h | Hết giờ lab, chốt bài | |

Hết giờ mỗi phase thì tag và chuyển sang phase tiếp theo, dù phase chưa hoàn hảo. Chỗ chưa xong ghi trung thực trong bằng chứng.

---

## Gợi ý SDLC (cách làm là của bạn)

Mỗi phase là một vòng nhỏ. Công cụ, thứ tự, định dạng tài liệu đều tự do; đây chỉ là gợi ý:

1. **Requirements:** biến yêu cầu thành tiêu chí nghiệm thu kiểm chứng được. Chỗ mơ hồ thì tự giả định và ghi lại.
2. **Plan:** nghĩ cách kiểm chứng **trước** khi để agent viết code.
3. **Build:** để agent viết, bạn điều phối và review.
4. **Verify:** chạy thật, kiểm tra hành vi thật. *Không có bằng chứng thì chưa xong*: "agent bảo chạy rồi" không phải bằng chứng.
5. **Evaluate:** cái gì đạt, AI sai ở đâu, harness (AGENTS.md, skill, hook) cần chỉnh gì.
6. **Release:** gắn tag.

## Ba điều cần nhớ

> Bạn được **tự do sáng tạo thêm** quanh phần lõi (nhân vật, cơ chế nhỏ, câu chuyện, hiệu ứng, âm thanh…). Sáng tạo gọn và không phá yêu cầu được tính điểm trong hạng mục F của [RUBRIC](RUBRIC.md); ghi mục "Sáng tạo của tôi" trong README của bạn.

- **Game tốt là game đúng yêu cầu của khách hàng**, không phải game phức tạp hay đẹp nhất. Làm đúng và chứng minh được là đúng trước, trau chuốt sau.
- **Cân nhắc kỹ quota token của bạn.** Đốt nhiều token không làm bài tốt hơn. Ngữ cảnh gọn, kế hoạch rõ, kiểm chứng sớm thường vừa rẻ vừa đúng hơn chạy agent liên tục.
- **Kiểm chứng là phần quan trọng nhất.** Bằng chứng (test, output headless, ảnh, số đo) đáng giá hơn lời mô tả.

---

## Bàn giao cuối cùng

Một **repo GitHub cá nhân, public**, gồm:

1. **Toàn bộ mã nguồn** của game qua 4 phase, tag `phase-1` … `phase-4`, Release `v1.0.0`.
2. **Video demo `.mp4` dưới 5 phút** (đính kèm Release `v1.0.0` hoặc `docs/demo/demo.mp4`, link ở đầu README): chơi thử và cho thấy bằng chứng game chạy đúng.
3. **Bằng chứng kiểm chứng** của từng phase (định dạng tự chọn).
4. **Harness AI đã dùng** (AGENTS.md / CLAUDE.md, skills, hooks, plugins…), giữ nguyên trong repo và lịch sử git.
5. **Ghi chép ngắn:** spec/giả định mỗi phase, nhật ký dùng AI (gồm token/chi phí ước tính), retro.

Không commit API key, token hay `.env`. Gửi link repo theo hướng dẫn của Coach.

## Đánh giá (100 điểm)

| Hạng mục | Điểm |
|---|---|
| Test tự động ẩn (headless, gồm kiểm tra lại phase trước) | 30 |
| Kiểm chứng & bằng chứng của bạn | 20 |
| Quy trình SDLC & harness AI | 15 |
| Evaluation & retro (gồm cách bạn dùng token) | 10 |
| Hiệu năng & ổn định | 10 |
| Chất lượng sản phẩm (đúng yêu cầu, chơi được) | 10 |
| Video demo | 5 |

## Quy định

- Dùng AI thoải mái; không sao chép repo của người khác.
- Bằng chứng phải thật: test luôn đạt hay output sửa tay là vi phạm.
- Nhân vật, bối cảnh là bản gốc của lab; asset bên ngoài chỉ dùng loại CC0/CC-BY/MIT hoặc tự tạo, ghi nguồn trong `CREDITS.md`.

---

# Bài làm — Đảo Đèn Lồng (Phase 1 / PRD-0)

## Cài đặt & chạy (≤ 3 lệnh, macOS/Linux/Windows, cần Node ≥ 20)

```
npm install        # build_cmd — cài three.js
npm start          # run_cmd — mở http://localhost:8080 (WebGL, trình duyệt)
npm test           # 11 test headless + scenario
```

Headless (theo Test Contract v1.0):

```
node src/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl \
  [--scenario scenarios/pulse.json] [--inputs scenarios/pulse.inputs.json] [--snapshot-every 10]
```

## Điều khiển

| Phím | Việc |
|---|---|
| W A S D | đi (theo hướng camera) |
| Kéo chuột / ← → | xoay camera |
| Space | nhảy |
| E | nạp đom đóm vào đèn gần nhất (≤ `interact_radius`) |
| F | tỏa sáng: choáng + đẩy lùi Bóng Mực (tốn 2 đom đóm, hồi 1 s) |
| Enter | bắt đầu / chơi lại |

## Luật & điểm

- Chạm đom đóm (≤ 1.5 m) tự nhặt, mang tối đa 10. Mỗi đèn cần **8** đom đóm; nạp đủ là đèn sáng. Sáng cả **5** đèn → **thắng** (`all_lit`).
- Bóng Mực đuổi (3.5 m/s, chậm hơn Mây 6 m/s), chạm → mất 1 ngọn lửa (có 3), rơi 50% đom đóm đang mang, bất tử 1.5 s. Hết lửa → **thua** (`no_flames`). Hết 300 s → **thua** (`dawn`).
- Bóng Mực không vào được bán kính 5 m quanh **mọi** đèn (nơi trú an toàn). Tỏa sáng choáng 3 s, đẩy 3 m.
- Rơi khỏi đảo (bán kính 40 m): mất 1 lửa như bị chạm, hồi sinh tại (0,0,0).
- **Điểm**: +10 mỗi đom đóm, +100 mỗi đèn, +20 mỗi Bóng Mực bị choáng; khi **thắng** thêm +1 × số giây còn lại (làm tròn xuống) và +50 × số lửa còn lại.

## Giả định (PRD-0 mơ hồ → tự chọn, đều nằm trong `game.contract.json`)

1. `safe_radius` áp dụng cho mọi đèn (cả chưa sáng) để chỗ nạp đèn luôn có thể thở.
2. Đom đóm rơi = `floor(carried × hit_drop_ratio)`, vãi quanh chỗ bị chạm; nhặt lại được (và tính lại điểm).
3. Khoảng cách chạm/nhặt tính theo mặt phẳng XZ (nhảy không né được Bóng Mực), đúng contract.
4. `pulse` chỉ có hiệu lực khi đủ `pulse_cost` và hết cooldown; khi đó luôn ghi event `pulse` (kể cả `stunned_ids` rỗng).
5. Bóng Mực xuất hiện đầu tiên ở giây 5, sau đó mỗi 12 s, tối đa 5 con, ở mép đảo. Đom đóm hồi lại 1 con/4 s (tối đa 24 đang hiện diện).
6. Đèn bố trí vòng tròn bán kính 25 m, L1 ở (0,0,25), cách đều 72°.
7. Không có `dash`; không có khái niệm nào để `null` — mọi trường tuning đều dùng.
8. Snapshot có thêm mảng `motes` (khuyến nghị v1.0). Snapshot chỉ ở các tick chia hết `--snapshot-every`; dòng `end` luôn ở cuối.

## Sáng tạo của tôi

Hiệu ứng nhỏ chỉ ở client web (không có trong headless, không đổi output contract): đảo và bầu trời **đổi màu từ tím đen sang vàng cam** theo số đèn đã thắp, vòng sáng an toàn quanh đèn, nhấp nháy bất tử khi bị chạm, vòng sóng khi tỏa sáng. Bằng chứng lõi vẫn đúng: `npm test` (11/11) chạy trên `src/sim.js` dùng chung với client, xem `docs/evidence/`.

## Bằng chứng (`docs/evidence/`)

| Yêu cầu | Cách kiểm chứng | Kết quả |
|---|---|---|
| Format snapshot/event/end, đếm tick, `time_left_s` | `tests/headless.test.js` #1 | đạt |
| Tất định cùng seed (đêm đầy đủ 18000 tick) | `cmp` hai lần chạy seed 42 → `determinism.txt`; test #2 | đạt |
| Nhặt, nạp đèn, thắng, tỏa sáng, bị chạm, safe_radius, rơi, thua (2 lý do) | test #3–#9, scenario trong `scenarios/` | đạt |
| Scenario không phát event/điểm | test #10 | đạt |
| File sai → exit 2 | test #11 | đạt |
| Game chạy có giao diện | `screenshot-night1.png` (Chrome headless, SwiftShader) | đạt (chỉ chụp khởi đầu; chưa quay video chơi hết ván) |
| Hiệu năng headless | 18000 tick ≈ 0.1 s | đạt |

**Chưa đạt/chưa kiểm chứng:** chưa chơi thủ công một ván thắng trên trình duyệt thật; chưa có video demo; chưa đặt tag `phase-1`.

## Nhật ký AI

Claude Code (Sonnet 5.5) viết lõi `src/sim.js`, headless, client và test trong một phiên; tôi đọc PRD-0 từ lab board, chốt tuning/giả định, rồi dùng test + `cmp` + ảnh chụp làm bằng chứng. Lỗi AI đã bắt: (1) test dùng scenario `dawn.json` 2 s nên ván kết thúc trước khi rơi khỏi đảo; (2) tính sai tick bị chạm đầu tiên (shade ở 1.2 m phải 4 tick mới ≤ 1 m). Ước tính token: một phiên ngắn, ~60k.
