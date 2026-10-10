# Dưới ánh đèn

Phòng đọc PDF tương tác bằng Three.js, với sách mềm 3D, mép giấy nhiều lớp, trang cong ở gáy và đèn dầu bằng hình học. Bản 0.7.0, ngày 10/10/2026.

## Chạy cục bộ

Cần Python 3; Node.js 22 trở lên chỉ dùng để kiểm thử. Không cần npm install hoặc build.

```sh
python3 server.py
```

Mở **http://127.0.0.1:8768/**. Trên macOS có thể chạy `Mở phòng đọc.command`. Giữ terminal mở; Ctrl+C để dừng. Các module, worker, font và ảnh đều có sẵn trong repository. Dùng HTTP thay vì mở index.html trực tiếp.

## Đọc và trình diễn

- **Khởi Nguồn — Nguyễn Cảnh Lâm** (360 trang) có sẵn khi mở ứng dụng. **Tải sách** tải PDF nguyên bản; không cần API key hoặc tài khoản.
- **Mở PDF của bạn** hoặc thả một PDF vào cửa sổ. Tệp được xử lý trong trình duyệt, không tải lên máy chủ và không lưu nội dung tệp.
- Kéo cạnh/góc giấy hoặc dùng ← / → để giở. Nhập số trang để đi thẳng đến trang đó. Vạch dưới thanh đọc thể hiện tiến độ.
- **Giở trang / Cầm sách / Xoay 3D** chuyển cách kéo. Phím **G / C / R** chọn nhanh. **0** hoặc ↶ đưa về góc đọc và giữ trang hiện tại.
- Shift + kéo để xoay; Alt, chuột phải hoặc chuột giữa + kéo để di chuyển. Cuộn hoặc nút kính lúp để zoom. Thả sách đang nhấc để đặt xuống bàn.
- Biểu tượng mặt trời đổi ban ngày/đèn dầu. Biểu tượng lửa chỉnh độ sáng 50–150%, mặc định 125%. Escape hoặc bấm ngoài để đóng bảng nổi.
- Đánh dấu để quay lại trang; trạng thái đọc, dấu trang và tuỳ chọn được lưu cục bộ, nhận diện từng PDF bằng SHA-256. Nếu lưu trữ trình duyệt bị chặn, vẫn có thể đọc.
- **Hướng dẫn** luôn truy cập được, kể cả trên màn hình hẹp. Giảm chuyển động giữ lửa yên và rút ngắn giở trang. Âm giấy mặc định tắt.

## Đồ hoạ và cấu trúc

WebGPURenderer của Three.js r186 ưu tiên WebGPU và tự dùng WebGL 2 khi cần. `?renderer=webgl` ép backend dự phòng; `?qa` hiện thông tin kiểm tra. Tên backend được xác nhận từ renderer, không chỉ từ tên lớp.

Hai backend dùng chung shader TSL. Trang giấy và khối giấy có cùng phép biến dạng trong render và bóng đổ. Ba nguồn điểm quanh ngọn lửa dùng chung các node bóng giữa material; khung đèn đổ bóng lên bàn. Chỉ cập nhật bóng đang dùng, giữ node được nối khi chuyển ánh sáng. Lửa có lõi HDR, độ lệch đầu và dao động nhiều nhịp; độ sáng điều chỉnh đồng thời lửa, quầng và nguồn sáng.

Góc đọc mặc định dùng phối cảnh 32°, giảm nghiêng; mép xa hẹp hơn mép gần. Xoay dùng quaternion trong không gian camera, có damping và tính khoảng nâng theo tám góc để tránh xuyên mặt bàn. Khung nhìn tự nới khi sách dựng đứng. Đây là chuyển động có ràng buộc, chưa có mô phỏng vật rắn hoặc va chạm với đèn.

| Đường dẫn                                          | Vai trò                                                      |
| -------------------------------------------------- | ------------------------------------------------------------ |
| `src/main.mjs`                                     | Điều phối PDF, thao tác, trạng thái và giao diện             |
| `src/book.mjs`                                     | Cảnh sách, gesture, camera, vòng vẽ và giải phóng tài nguyên |
| `src/gpu-materials.mjs`                            | Shader TSL của giấy, khối giấy, bàn, kính và lửa             |
| `src/renderer.mjs`                                 | Khởi tạo backend WebGPU/WebGL 2                              |
| `src/camera.mjs`, `src/object-pose.mjs`            | Phối cảnh, fitting và tư thế sách                            |
| `src/lantern.mjs`, `src/stack.mjs`, `src/desk.mjs` | Hình học và material                                         |
| `src/pages.mjs`, `src/cache.mjs`                   | PDF.js, render theo yêu cầu, cache có giới hạn               |
| `src/featured-book.mjs`                            | Tải sách Khởi Nguồn đã tích hợp                              |
| `vendor/`                                          | Thư viện, worker và dữ liệu PDF.js cục bộ                    |
| `qa/`                                              | Bằng chứng cuối, manifest và bản ghi dọn dẹp                 |

Cache trang tải vùng gần trang đang đọc, giữ các texture đang dùng và loại phần dư theo ngân sách. Đổi tài liệu huỷ render cũ; kết quả đến muộn được giải phóng. Vòng vẽ ngừng cập nhật cảnh khi tab ẩn; cảnh yên chỉ vẽ khi cần hoặc theo nhịp lửa. Không có cam kết 60 FPS/4K; hiệu năng phụ thuộc GPU và PDF.

## Kiểm tra

```sh
npm run check
npm test
```

Kiểm tra cú pháp và đường dẫn module/tài nguyên trước các bài kiểm về cache, phân trang, release, góc camera, trackball, hạ sách và trạng thái đọc. GitHub Actions chạy cùng lệnh, không cài dependency. `tests/fixture-320.pdf` là tài liệu thử tự tạo, có mã sinh `tests/make_fixture.py` (cần ReportLab và pypdf để sinh lại).

Ảnh và kết quả thao tác thực được lưu ở `qa/verification-controls.md` và `qa/verification-polish.md`. Các ảnh cũ dư đã dọn; `qa/cleanup.json` ghi danh sách. Ảnh QA dùng PDF thử, không chứa tiểu thuyết của người dùng.

## Nguồn và giấy phép

- Three.js r186: MIT trong `vendor/THREE-LICENSE.txt`; URL/version/hash bundle tại `vendor/graphics-provenance.json`. [WebGPURenderer](https://threejs.org/docs/pages/WebGPURenderer.html), [NodeMaterial](https://threejs.org/docs/pages/NodeMaterial.html).
- PDF.js: Apache 2.0 trong `vendor/PDFJS-LICENSE.txt`.
- Font Paper Mono từ [Paper Design](https://paper.design/mono), giữ nguyên tệp và SIL OFL 1.1 trong `assets/fonts/paper-mono/`. Không có ảnh trang mẫu, wordmark hay texture lấy từ website trong phiên bản hiện tại; grain là texture tự tạo bằng code.
- Khởi Nguồn: bản quyền tiếng Việt © Nguyễn Cảnh Lâm, 2024. PDF nguyên bản 360 trang được đưa vào theo yêu cầu trực tiếp của tác giả; `assets/books/RIGHTS.md` và `book.json` ghi phạm vi phân phối và SHA-256. Giấy phép thư viện/font không áp dụng cho sách.
- Hình học đèn được dựng bằng code từ tham chiếu người dùng; không đưa ảnh đèn có watermark vào sản phẩm.

Repository vẫn **private** và giữ nguyên lịch sử theo quyết định của chủ dự án. Commit cũ còn chứa ảnh tham chiếu chưa có giấy phép phân phối, nên chưa chốt repository để public. Bản hiện tại có thể chạy và giới thiệu sách đầy đủ. PDF cá nhân, `.env`, cache, dependency cài thêm và log bị loại khỏi Git. Bộ runtime không có shader GLSL hay demo bìa cũ không còn chạy.

## Kiểm tra trước khi chia sẻ

Gitleaks đã quét lịch sử Git, thư mục sản phẩm và nội dung/metadata PDF được giải mã; chưa phát hiện API key hoặc secret theo các mẫu nhận diện của công cụ. Ứng dụng không gọi dịch vụ AI, không dùng token, backend thương mại hoặc analytics. Báo cáo tại `qa/public-readiness.json`. Đây là kết quả quét và rà mã, không phải chứng nhận không thể có bí mật dưới mọi dạng.

Để public repository có toàn bộ lịch sử, vẫn cần xử lý quyền phân phối những ảnh mẫu trong commit cũ hoặc được chủ dự án cho phép làm sạch lịch sử. Chưa đổi visibility, chưa force-push.
