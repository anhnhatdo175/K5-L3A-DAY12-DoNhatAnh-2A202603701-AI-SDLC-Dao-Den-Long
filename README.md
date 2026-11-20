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

# Bài làm — Đảo Đèn Lồng (Phase 1 + 2 · Contract v1.1)

## Cài đặt & chạy (≤ 3 lệnh, macOS/Linux/Windows, cần Node ≥ 20)

```
npm install        # build_cmd — cài three.js
npm start          # run_cmd — mở http://localhost:8080 (WebGL, trình duyệt)
npm test           # 38 test headless + scenario
```

Headless (Test Contract v1.1):

```
node src/headless.js --seed 1 --night 2 --ticks 600 --out out.jsonl   [--scenario scenarios/charm.json] [--inputs scenarios/charm.inputs.json] [--snapshot-every 10]
```

## Điều khiển

| Phím | Việc |
|---|---|
| W A S D | đi (theo hướng camera) |
| Kéo chuột / ← → | xoay camera |
| Space | nhảy |
| Shift | lướt 14 m/s × 0.2 s (hồi 1.5 s) |
| E | nạp đom đóm vào đèn chưa sáng gần nhất (≤ 2 m) |
| F | Tỏa Sáng: tốn 3 đom đóm, choáng + đẩy lùi Bóng Mực, hồi 3 s |
| Esc / P | tạm dừng (menu: Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu) |
| Enter | bắt đầu / qua màn / chơi lại |

## Luật & điểm (số chuẩn Ticket-02)

- 3 Đêm: **Đảo Bến** (5 đèn, 300 s) → **Đảo Cau** (2 đảo + cầu tre + bục nhảy, 6 đèn, 330 s) → **Đảo Chuông** (3 tầng, dốc, bục, gió mạnh, 7 đèn, 360 s). Mỗi đèn cần 10 đom đóm, nạp nhiều lần được. Sáng hết đèn → thắng. Hết 3 Ngọn Lửa (hồi đầy mỗi Đêm) hoặc hết giờ → thua.
- **Bóng Mực** (4 m/s; Đêm 3: 4.5) thấy Mây trong 12 m, bỏ đuổi ngoài 18 m; chạm → −1 lửa, rơi một nửa đom đóm đang mang, bất tử 1.5 s. Không vào được vùng 6 m quanh đèn đã sáng.
- **Gió Lạc** (Đêm 2–3): lụa xám xanh 7 m/s, cướp 3 đom đóm khi Mây mang ≥ 5. Tỏa Sáng trúng nó đang bay đi mang đồ → nó làm rơi lại.
- **Bùa Gió**: 10 s chạy 7.2 m/s và lướt không hồi chiêu.
- Rơi khỏi đảo: −1 lửa, mất hết đom đóm, hồi sinh sau 1 s.
- **Điểm:** +10 mỗi đom đóm *nạp*, +100 mỗi đèn, +5 mỗi Bóng trúng Tỏa Sáng; khi thắng thêm ⌊giây còn lại⌋ × 2 + 50 × lửa còn lại. Tổng game = tổng điểm các Đêm đã thắng.

## Tài liệu kỹ thuật

- [SPEC.md](SPEC.md) (Phase 1) và [SPEC-PHASE2.md](SPEC-PHASE2.md) (Phase 2): yêu cầu, acceptance criteria, **bảng giả định B1–B18**, truy vết tới test, và danh sách khoảng trống.
- [AGENTS.md](AGENTS.md) + `.claude/skills/headless-verify/` — harness AI.

## Sáng tạo của tôi

Chỉ ở client web (không đổi headless): đảo/bầu trời đổi màu từ tím đen sang vàng cam theo số đèn đã thắp, vòng sáng an toàn quanh đèn, nhấp nháy bất tử, vòng sóng Tỏa Sáng, lá bay báo gió, nhạc nền tổng hợp WebAudio, đom đóm rơi nhấp nháy khi sắp hết hạn, "Ông Đăng" dẫn truyện trước mỗi Đêm.

## Bằng chứng (`docs/evidence/`)

| Yêu cầu | Cách kiểm chứng | Kết quả |
|---|---|---|
| Hồi quy Phase 1 với số chuẩn (nhặt, nạp, thắng, tỏa sáng, chạm, an toàn, rơi, thua) | `tests/headless.test.js` | **đạt** (đã đổi số kỳ vọng theo Ticket-02; lý do trong SPEC-PHASE2 §1–2) |
| Mỗi tính năng mới có ≥ 1 scenario: lướt, bùa, Gió Lạc ×3, bục ×2, tầng/dốc, gió, pause, qua cầu | `scenarios/` + `docs/evidence/phase2/*.jsonl` | **đạt** |
| Tất định cả 3 Đêm, 21 600 tick | `determinism.txt` (so `cmp` 2 lần) | **đạt** |
| Một Đêm đầy đủ ≤ 30 s | cùng file: 0.24–0.36 s | **đạt** |
| Giao diện 3 Đêm, HUD, mũi tên | `p2-night{1,2,3}.png`, `p2-menu.png` (Chrome headless) | **đạt (ảnh)** |
| **Chưa kiểm chứng** | chơi tay trọn 3 Đêm, nghe âm thanh, đo FPS ≥ 30 trên máy thật, video demo | **chưa đạt** — xem SPEC-PHASE2 §7 |

## Nhật ký AI

Claude Code (Sonnet 5.5) viết lõi, headless, client, test; tôi đọc Ticket-02, chốt giả định và duyệt bằng chứng. Lỗi AI bắt được ở Phase 2: (1) tick hồi sinh vẫn cho Mây đi 0.1 m (trái "vận tốc 0, đúng điểm xuất phát"); (2) test dùng bóng ở 20 m rồi tưởng nó đuổi — ngưỡng phát hiện là 12 m; (3) vài assert viết vội luôn đúng, đã thay bằng assert thật; (4) đo "21 600 tick" nhưng Mây chết sau ~2 200 tick, đã đo lại bằng scenario `long.json`. Ước tính token: một phiên dài, ~200k.
