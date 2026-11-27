# Lab 1: Doc 1.2 - Môi trường Lập trình Đám mây Web IDE & Giao thức Nạp Firmware Web Serial API

### 1. Kiến trúc Đám mây Hiện đại của PTITCube Web IDE

Môi trường thực hành của PTITCube được thiết kế theo mô hình điện toán đám mây hiện đại (Cloud-native Embedded Development Platform), giúp học viên có thể lập trình, biên dịch và nạp vi điều khiển trực tiếp trên trình duyệt web mà không cần cài đặt chuỗi công cụ cồng kềnh (như Python, Toolchain GCC, ESP-IDF hay driver phức tạp):

![Quy trình biên dịch đám mây và nạp Web Serial](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab1_cloud_compile_flow.png)

- **Khung Biên tập Mã nguồn (Monaco Editor):** Sử dụng nhân trình soạn thảo mã nguồn chuẩn công nghiệp (cùng nền tảng với VS Code), hỗ trợ đầy đủ các tính năng lập trình chuyên nghiệp: tô màu cú pháp C++, gợi ý mã thông minh (IntelliSense), tự động thụt đầu dòng và phát hiện lỗi cú pháp theo thời gian thực.
- **Trình Biên dịch Đám mây (Cloud Compiler Backend):** Hệ thống máy chủ phân tán tự động tiếp nhận mã nguồn, kích hoạt môi trường container hóa chứa bộ công cụ biên dịch chéo `xtensa-esp32-elf-gcc`, liên kết thư viện bay PTITCube và xuất ra tệp nhị phân nén duy nhất `firmware.bin` trong vòng dưới 5 giây.

### 2. Cơ chế Nạp Firmware Trực tiếp qua Web Serial API

Web Serial API là tiêu chuẩn web hiện đại do W3C ban hành, cho phép các trang web bảo mật (chạy giao thức HTTPS) giao tiếp nối tiếp hai chiều trực tiếp với các thiết bị phần cứng ngoại vi cắm qua cổng USB của máy tính:

1. **Khởi tạo Bắt tay Cổng (Port Handshake):** Người dùng nhấp nút "Kết nối OBC", hàm `navigator.serial.requestPort()` mở hộp thoại hệ thống cho phép học viên lựa chọn cổng COM kết nối với chip cầu USB-UART (như CP2102 hoặc CH340) trên kit vệ tinh.
2. **Cấu hình Đường truyền Nối tiếp:** Trình duyệt mở cổng giao tiếp với các thông số vật lý chuẩn mực:
   - Tốc độ truyền (Baud rate): 115200 bps.
   - Khung dữ liệu: 8 bit dữ liệu, không có bit kiểm tra chẵn lẻ, 1 bit dừng (Chuẩn **SERIAL_8N1**).
3. **Mạch Tự động Reset & Vào Bootloader (Auto-Reset Circuit):**
   Trình duyệt điều khiển hai đường tín hiệu điều khiển luồng **DTR (Data Terminal Ready)** và **RTS (Request To Send)**. Trên bo mạch OBC có mạch transistor đôi NPN mắc chéo:
   - Khi DTR ở mức HIGH và RTS ở mức LOW: Kéo chân `EN` của ESP32 về 0V (kích hoạt Reset).
   - Khi DTR ở mức LOW và RTS ở mức HIGH: Kéo chân `GPIO0` về 0V (kích hoạt chế độ Download).
   - Khi nhả chân `EN` lên mức 3.3V trong khi `GPIO0` vẫn giữ ở mức 0V: ESP32 chính thức rơi vào ROM Bootloader, sẵn sàng ghi Flash.
4. **Giao thức Ghi Bộ nhớ Flash (Flashing Protocol):** Dữ liệu từ tệp `firmware.bin` được chia nhỏ thành các khung tin mã hóa theo chuẩn SLIP (Serial Line Internet Protocol) và ghi tuần tự vào các khối sector của bộ nhớ Flash SPI. Sau khi ghi xong, một lệnh ngắt kết nối sẽ kích hoạt chân `EN` để khởi động lại ESP32 vào chương trình bay mới.

---
