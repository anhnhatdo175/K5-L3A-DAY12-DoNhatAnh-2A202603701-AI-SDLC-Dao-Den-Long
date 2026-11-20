# Credits — Đảo Đèn Lồng

## Asset
Game **không dùng asset bên ngoài** (không ảnh, mô hình, font, âm thanh có sẵn):

| Loại | Nguồn |
|---|---|
| Mô hình 3D (Mây, đèn lồng, Bóng Mực, đom đóm, đảo, cầu, tháp…) | Tạo bằng mã từ hình học cơ bản của three.js trong `web/main.js` |
| Âm thanh & nhạc nền | Tổng hợp trực tiếp bằng WebAudio (oscillator/noise) trong `web/main.js`; không có file âm thanh |
| Font | Font hệ thống (`system-ui`, Segoe UI) — không nhúng |
| Ảnh trong `docs/evidence/` | Ảnh chụp màn hình từ chính game (Chrome/Edge qua CDP), không chỉnh sửa |
| Nhân vật, bối cảnh, cốt truyện (Mây, Ông Đăng, Bóng Mực, Gió Lạc…) | Bản gốc của đề lab Day 12 |

## Thư viện / công cụ
| Tên | Giấy phép | Dùng cho |
|---|---|---|
| [three.js](https://threejs.org) r170 | MIT | Dựng hình 3D (client) |
| Node.js ≥ 22 | MIT | Mô phỏng headless, server, bench, soak, test (`node:test`) |
| Chrome / Edge (Chromium) | — | Chạy client và đo benchmark (không đóng gói kèm) |

## Công cụ AI tạo nội dung
| Công cụ | Dùng để làm gì |
|---|---|
| Claude Code (Anthropic; Claude Sonnet 5.5) | Viết/sửa mã (`src/`, `web/`, `tests/`, `scripts/`), tài liệu (SPEC, README, CHANGELOG, retro nháp) theo yêu cầu và duyệt của tác giả. Không dùng AI để tạo ảnh, âm thanh hay mô hình 3D. |

Tác giả chịu trách nhiệm về nội dung cuối; số đo benchmark/soak trong repo sinh từ các lần chạy thật (xem `docs/evidence/phase4/`).
