# Lab 4: Doc 4.7 - Kiến Trúc Thu Thập & Xử Lý Dữ Liệu Đa Cảm Biến Toàn Diện

---

## 💻 Hướng Dẫn Thực Hành: Danh Mục Các Bài Thực Hành Lab 4
- `Lab4-01a_Environment_I2C`: Khởi tạo bus I2C, đọc trực tiếp 24 byte hằng số hiệu chuẩn và các thanh ghi áp suất thô của BMP280.
- `Lab4-01b_Environment_Library`: Đọc và tính toán áp suất khí quyển, nhiệt độ môi trường và độ cao ước lượng thông qua thư viện PTITCube.
- `Lab4-02a_IMU_I2C`: Đọc dữ liệu gia tốc (ACCEL), vận tốc góc (GYRO) từ MPU6500 và từ trường (MAG), góc la bàn (Heading) từ GY-271 qua I2C; xuất log Serial gọn gàng 3 trục mỗi dòng, không chứa tiền tố ngoặc vuông `[...]`.
- `Lab4-02b_IMU_Library`: Cài đặt thuật toán bộ lọc bù (Complementary Filter) kết hợp dữ liệu 9 trục tính toán góc nghiêng vệ tinh Roll, Pitch và Heading La bàn số ổn định.
- `Lab4-03a_GPS_UART`: Đọc trực tiếp luồng ký tự ASCII bản tin NMEA thô từ module GNSS L76X qua cổng UART2 thuần.
- `Lab4-03b_GPS_Library`: Thu nhận, phân loại câu tin NMEA thô và kiểm tra mã Checksum XOR (*hh) bằng bộ đệm dòng.
- `Lab4-03c_GPS_PTITCube`: Sử dụng thư viện PTITCube chuyển đổi luồng dữ liệu NMEA thô thành các trường số thực có ý nghĩa mà người dùng có thể hiểu được (Kinh độ, Vĩ độ, Cao độ m, Vận tốc km/h, Hướng đi, Số vệ tinh, HDOP, Thời gian UTC).
- `Lab4-04a_Camera_UART`: Giao tiếp UART thuần bắt tay bằng chuỗi văn bản (`"capture"` -> `SIZE` -> `OK` -> stream -> `DONE`) với module ESP32-CAM và ghi trực tiếp luồng byte ảnh JPEG vào thẻ nhớ MicroSD qua thư viện `PTIT_Storage`.
- `Lab4-04b_Camera_Library`: Sử dụng thư viện `PTITCube` (`PTIT_Camera`) để chụp ảnh và tự động quản lý lưu trữ vào thẻ nhớ MicroSD qua lệnh chuỗi văn bản (`"capture"`, `"photo"`).
- `Lab4-05_Read_All_Sensors`: Tổng hợp đọc đồng thời tất cả các cảm biến môi trường (BMP280), quán tính (MPU6500, QMC5883) và định vị (GPS L76X) trong một chu trình khép kín.
- `Lab4-06_Camera_Multiplexer`: Lập trình điều khiển IC chuyển mạch 74HC4066 luân phiên giữa Camera và GNSS theo nguyên tắc Break-Before-Make, giải quyết triệt để xung đột cổng UART.

### ❓ Câu Hỏi Đánh Giá Kỹ Năng Thực Hành (Lab 4)
1. **Cặp byte đánh dấu bắt đầu (SOI) và kết thúc (EOI) của một tệp ảnh nén JPEG nhận được từ Camera OV2640 là:**
   - A. `0xFFD8` và `0xFFD9`
   - B. `0x0000` và `0xFFFF`
   - C. `0x1234` và `0x5678`
   - D. `0xAA55` và `0x55AA`

2. **Trong bài thực hành Camera UART (Lab4-04a), điều kiện tiên quyết về phần cứng để lưu trữ ảnh chụp là gì?**
   - A. Phải có kết nối Internet WiFi tốc độ cao
   - B. Phải tắt toàn bộ các cảm biến I2C còn lại
   - C. Phải cấp nguồn 12V riêng cho module Camera
   - D. Bắt buộc phải có thẻ nhớ MicroSD cắm trên bo mạch
