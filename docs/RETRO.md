# Retro — Đảo Đèn Lồng (4 phase, AI SDLC)

> **Bản nháp do AI soạn từ lịch sử repo và số đo thật.** Các chỗ đánh dấu **[TÁC GIẢ ĐIỀN]** là thông tin chỉ tác giả biết (tên, vị trí, token/chi phí, cảm nhận). Chưa điền thì chưa phải bản nộp.
> Tên: **[TÁC GIẢ ĐIỀN]** · Vị trí: **[TÁC GIẢ ĐIỀN]** · MSSV 2A202603701

## 1. Evaluation 4 phase

| Phase | Yêu cầu chính | Đạt | Hỏng phase trước? | Cần chỉnh |
|---|---|---|---|---|
| 1 (PRD-0, v1.0) | Sim tất định + headless + client | Sim 60 tick/s, headless đúng Contract, test + scenario | — | Nhiều assert viết vội luôn đúng → phải rà lại |
| 2 (Ticket-02, v1.1) | 3 Đêm, số chuẩn, lướt/bùa/Gió Lạc/bục/tầng/gió/pause | Có (`SPEC-PHASE2.md`, 38 test, tất định 21 600 tick) | Phải đổi số kỳ vọng test Phase 1 (có lý do trong SPEC) | Đo "21 600 tick" nhưng Mây chết sớm → thêm `scenarios/long.json` |
| 3 (Ticket-03, v1.2) | Dầu đèn, châm, thắp lại, drain, luật thắng bình minh | Có (ADR 003, `SPEC-PHASE3.md`) | Bỏ luật `all_lit` → sửa test Phase 1–2 liên quan, có ghi lý do | Phần client (nhấp nháy, thanh dầu) kiểm bằng mắt, chưa có test tự động |
| 4 (Ticket-04, v1.3) | Bench, soak, bảng xếp hạng, trợ năng, đóng gói | Có số đo thật (`bench.json`, `soak.json`), 30 test mới, 6 băm vàng giữ nguyên đầu ra headless | Không (đầu ra headless giống từng byte) | Chưa đo trên máy chấm; chưa chơi tay trọn 3 Đêm trong phiên này; video chưa có |

Số liệu cuối (máy tác giả, Intel UHD, Windows 11): 68 test đạt; bench avg 100–125 fps, p1_low 36–58 fps, load 2.4–3.4 s; soak 0 crash, bộ nhớ 46.9 → 50.9 MB.

## 2. Điều gì hiệu quả / không hiệu quả khi làm với AI

**Hiệu quả**
- Sim thuần + tất định + headless: mọi thay đổi đều kiểm được bằng lệnh, nên AI sửa nhanh mà vẫn bắt được hồi quy. Phase 4 chứng minh "không đổi hành vi" bằng 6 băm SHA-256 đầu ra headless tính từ mã Phase 3.
- Ticket → bảng AC + bảng giả định (B-số) trước khi viết mã: chỗ mơ hồ (chiều quay camera, "rải đều", `mem_start`) được ghi lại thay vì AI chọn ngầm.
- Chạy thật thay vì tin lời AI: phần lớn lỗi Phase 4 chỉ lộ khi chạy bench/soak/CLI thật.

**Không hiệu quả**
- AI hay viết test "xanh giả" và hay tin ví dụ trong ticket (ví dụ `"results": ["lost","won","lost"]` làm tưởng soak phải có "won").
- Việc cần máy thật (GPU, âm thanh, chơi tay, quay video) AI không thay được; dễ bị bỏ sót nếu chỉ nhìn test xanh.

## 3. Những lần AI sai và cách phát hiện

| Lỗi | Phát hiện bằng | Chỉnh harness |
|---|---|---|
| Tick hồi sinh vẫn cho Mây đi 0.1 m (P2) | So với đặc tả "vận tốc 0, đúng điểm xuất phát" | Ghi vào AGENTS.md mục "Lỗi AI đã gặp" |
| Test giả định bóng "luôn đuổi" trong khi ngưỡng là 12 m/18 m (P2) | Scenario không ra kết quả mong đợi | AGENTS.md: nhắc ngưỡng, `random_shades:false` |
| Assert luôn đúng (P1–P3) | Đọc lại: assert không thể đỏ | AGENTS.md: "mọi assert phải có thể đỏ"; Phase 4 thêm test đối chứng (`R4-BENCH-OFF`) |
| `npm start --export-leaderboard out.json` khởi động server thay vì xuất file (P4) | Chạy thật cả 3 cách gọi: npm đổi cờ thành biến môi trường và `out.json` thành đối số vị trí | Xử lý trong `server.js` + test 3 cách gọi |
| Soak lần đầu: mem_end/mem_start = 1.36 > 1.2 (P4) | Chạy 10/30/100 Đêm thấy cao nguyên ~50 MB → không phải rò rỉ mà là JIT | Khởi động JIT trước khi đo, ghi giả định B4-11 (không giấu số) |
| Bench lần đầu p1_low 29.7 < 30 (P4) | Đọc phân bố dt: vài khung 120–350 ms; thử tắt lấy mẫu RAM → vẫn còn → rác GC mỗi khung | Tái dùng `Color/Vector3`, lấy mẫu RAM thưa hơn |
| Script thử UI dùng đường dẫn `/tmp` kiểu bash cho Node trên Windows | Lỗi `MODULE_NOT_FOUND` | Dùng thư mục scratchpad của phiên |

## 4. Harness giúp nhiều nhất

1. **AGENTS.md** (quy tắc cứng + danh sách "lỗi AI đã gặp"): giữ AI khỏi chạm `Math.random()`/thứ tự 12 bước.
2. **Skill `headless-verify`**: quy trình AC → scenario → test → bằng chứng → tất định.
3. **Hook Stop** (`.claude/settings.json` → `scripts/stop-hook.mjs`, thêm ở Phase 4) và **CI** (`.github/workflows/ci.yml`): không kết thúc khi test đỏ.

## 5. Token / chi phí AI

- Tổng token/chi phí ước tính cả 4 phase: **[TÁC GIẢ ĐIỀN]** (README Phase 2 ghi "một phiên dài, ~200k" cho Phase 2; chưa có số cho Phase 1, 3, 4).
- Cách tiết kiệm (đã áp dụng): ngữ cảnh gọn nhờ AGENTS.md + SPEC có ID; test chạy ~10 s nên kiểm chứng rẻ; dùng headless thay vì chơi tay lặp lại; chỉ đọc phần file cần; không mở sub-agent cho việc đã rõ.

## 6. Nếu làm lại

- Viết bảng AC + giả định cho **cả Phase 4 ngay từ đầu** (bench, soak) và dựng bench/soak sớm (Phase 2) để phát hiện vấn đề GC/JIT sớm.
- Thêm CI và hook Stop từ Phase 1.
- Có test giao diện tự động nhỏ (CDP) cho client, thay vì kiểm bằng mắt.
- Chốt cách đo trên máy chấm sớm: hỏi cấu hình, đo ở chế độ nguồn hiệu năng cao, chạy bench ≥ 3 lần lấy trung vị.
