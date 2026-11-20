---
name: headless-verify
description: Thêm hoặc kiểm chứng một tính năng game Đảo Đèn Lồng bằng scenario headless + test + bằng chứng. Dùng khi sửa src/sim.js hoặc thêm yêu cầu từ ticket mới.
---

# Quy trình kiểm chứng một tính năng (≈ 5 phút)

1. **Viết AC trước** trong `SPEC-PHASE2.md` (hoặc SPEC mới): "làm A thì thấy B", kèm ID `R2-…`.
2. **Scenario**: tạo `scenarios/<tên>.json` (+ `<tên>.inputs.json`). Luôn đặt `random_motes/random_shades/random_drifters:false`
   trừ khi chính tính năng đó là thứ ngẫu nhiên. Dùng `time_left_s` đủ dài, `player.flames` đủ lớn nếu cần.
3. **Chạy thử**: `node src/headless.js --seed 1 --night N --ticks T --snapshot-every 1 --scenario scenarios/x.json --inputs scenarios/x.inputs.json --out .scratch/x.jsonl`
   rồi đọc event/snapshot quanh tick cần kiểm (nhớ: event ở bước k ghi `tick=k+1`).
4. **Test** trong `tests/headless.test.js` dùng helper `run({night,ticks,every,scenario,inputs})`, `r.at(tick)`, `r.ofs(eventName)`.
   Assert phải **có thể đỏ**; kiểm số học cụ thể (tick, toạ độ, điểm), không chỉ "có event".
5. **Bằng chứng**: chạy lại vào `docs/evidence/phase2/<tên>.jsonl`; cập nhật bảng truy vết trong SPEC.
6. **Tất định**: `node src/headless.js ... --out a.jsonl` hai lần rồi `cmp`. Không bao giờ dùng `Math.random()` trong `sim.js`.
7. Nếu ticket mơ hồ: thêm dòng vào bảng giả định (B-số) và nêu rõ trong lời commit.
