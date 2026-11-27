# Lab 4: Doc 4.5 - Tải Trọng Camera Viễn Thám OV2640, Nén JPEG Phần Cứng & Giao Thức Lệnh UART

![Quy trình chụp ảnh JPEG từ OV2640 lưu MicroSD và truyền LoRa](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab4_ov2640_capture_pipeline.png)

### 1. Tải trọng Camera OV2640
- **Đặc tính Tải trọng:** Cảm biến ảnh màu CMOS Omnivision **OV2640** độ phân giải 2 Megapixel (1600 × 1200 pixel), tích hợp bộ mã hóa nén phần cứng JPEG giúp giảm dung lượng tệp ảnh từ hàng Megabytes xuống còn $30 - 60\text{ KB}$, rất phù hợp với băng thông hạn chế của kênh truyền sóng không gian.
- **Yêu cầu Xung nhịp Ngoài XCLK:** Để mạch xử lý tín hiệu hình ảnh (ISP) bên trong OV2640 hoạt động, nó đòi hỏi vi điều khiển OBC phải phát ra một đường xung nhịp tần số cao ổn định từ 10 MHz đến 20 MHz tại chân `XCLK`.

### 2. Giao thức Bắt tay Điều khiển Chụp ảnh qua UART (Chuẩn Lệnh Chuỗi Text)
Khác với giao thức ký tự đơn sơ khởi (`'p'`), giao thức chuẩn của hệ thống CubeSat sử dụng chuỗi ký tự rõ ràng để tăng tính an toàn và khả năng tự kiểm lỗi:
1. **Gửi lệnh chụp:** OBC gửi lệnh chuỗi text `"capture\n"` đến ESP32-CAM qua cổng nối tiếp UART2 (tốc độ baud 115200, chân RX 16, TX 17).
2. **Phản hồi kích thước:** ESP32-CAM chụp ảnh, nén phần cứng JPEG và phản hồi chuỗi `SIZE:<bytes>\n` thông báo kích thước tệp ảnh (ví dụ: `SIZE:38420`).
3. **Bắt tay đồng bộ:** OBC kiểm tra tính sẵn sàng của thẻ nhớ MicroSD (khởi tạo qua thư viện `PTIT_Storage`), mở tệp tin `/photos/uart_img_X.jpg` để ghi, sau đó gửi lại chuỗi `"OK\n"` báo hiệu sẵn sàng nhận luồng dữ liệu.
4. **Truyền nhận dữ liệu nhị phân:** ESP32-CAM truyền luồng byte nhị phân của ảnh JPEG (bắt đầu bằng byte `0xFFD8` và kết thúc bằng `0xFFD9`). OBC đọc theo khối buffer 256 byte và ghi trực tiếp vào thẻ nhớ.
5. **Hoàn tất phiên chụp:** Sau khi nhận đủ số byte đã cam kết, OBC gửi chuỗi `"DONE\n"` để ESP32-CAM giải phóng bộ nhớ đệm, sau đó đóng tệp thẻ nhớ và tự động trả quyền ưu tiên bus UART2 cho module định vị GPS thông qua IC chuyển mạch 74HC4066.

---
