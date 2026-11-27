# Lab 4: Doc 4.3 - Nguyên lý Phần Cứng Module Định Vị GNSS L76X & Giao Tiếp UART Đọc Dữ Liệu Thô

![Luồng thu nhận tín hiệu vệ tinh định vị GNSS L76X qua UART2](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab4_gnss_l76x_architecture.png)

### 1. Kiến trúc Phần cứng Module Định vị Toàn cầu GNSS L76X
Module Quectel **L76X** là khí tài định vị không gian tích hợp đồng thời hai hệ thống vệ tinh: **GPS** (Hoa Kỳ - tần số L1 1575.42 MHz) và **GLONASS** (Nga - tần số L1 1602 MHz):
- **Ăng-ten Gốm Tích hợp (Ceramic Patch Antenna):** Thu sóng vô tuyến phân cực tròn thuận (RHCP) từ các chòm vệ tinh trên quỹ đạo.
- **Tầng Tiền Khuếch đại Nhiễu Thấp (LNA):** Khuếch đại tín hiệu vệ tinh cực kỳ yếu ớt (mức thu chỉ từ -130 dBm đến -165 dBm) trước khi đưa vào bộ giải mã RF.
- **Các Chế độ Khởi động Định vị:**
  - *Cold Start (~35 giây):* Khi module vừa cấp nguồn và chưa có dữ liệu lịch thiên văn (Almanac/Ephemeris), nó phải quét toàn bộ các kênh tần số để tìm vệ tinh.
  - *Hot Start (~1 giây):* Khi module đã có sẵn dữ liệu quỹ đạo và đồng hồ UTC chính xác trong bộ nhớ tạm RTC, thời gian chốt vị trí diễn ra gần như tức thời.
- **Giao tiếp Nối tiếp UART Phần cứng:**
  - Kết nối với cổng nối tiếp phần cứng `UART2` (`Serial2`) của OBC.
  - Tốc độ baud tiêu chuẩn: 9600 bps, cấu hình khung truyền `8-N-1`.
  - **Đặc tính phát dữ liệu tự động:** Ngay khi được cấp nguồn 3.3V, module tự động phát ra luồng ký tự ASCII chứa các dòng bản tin NMEA định kỳ mỗi giây (1 Hz) qua chân TX mà không cần OBC phải gửi bất kỳ lệnh kích hoạt nào.

![Hai mặt module Waveshare L76X, đầu nối 5 chân và anten gốm](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/Lab4.3_L76X.png)



| Chân | Tín hiệu | Chức năng và cách nối trong Lab |
|---:|---|---|
| 1 | VCC | Cấp nguồn cho module. Dùng đường 3,3 V theo cấu hình Lab. |
| 2 | GND | Nối mass chung với ESP32. |
| 3 | TX | Ngõ ra UART gửi bản tin NMEA. Nối với RX2 (GPIO16). |
| 4 | RX | Ngõ vào UART nhận lệnh cấu hình. Nối với TX2 (GPIO17) nếu cần gửi lệnh. |
| 5 | PPS | Ngõ ra xung 1 PPS dùng làm mốc thời gian. Có thể để hở khi chỉ đọc NMEA. |



### 2. Kỹ thuật Lập trình: Đọc Luồng Ký Tự NMEA Thô qua UART
Trong bài thực hành đọc dữ liệu thô, mục tiêu là kiểm tra thông mạch phần cứng và quan sát trực tiếp luồng ký tự thô đổ về từ không gian:
```cpp
void setup() {
    Serial.begin(115200);
    // Khởi tạo UART2 nối với GPS L76X ở tốc độ 9600 baud
    Serial2.begin(9600);
    Serial.println("[RAW] Dang doc luong byte thô NMEA truc tiep tu GPS...");
}

void loop() {
    // Đọc từng byte thô từ GPS và in thẳng ra màn hình máy tính
    while (Serial2.available() > 0) {
        char c = Serial2.read();
        Serial.print(c);
    }
}
```

---

### ❓ Câu Hỏi Củng Cố Kiến Thức (Doc 4.3)
1. **Module định vị vệ tinh GNSS L76X kết nối với vi điều khiển OBC thông qua cổng giao tiếp và tốc độ baud mặc định nào?**
   - A. Bus SPI ở tần số 10 MHz
   - B. Bus I2C ở tốc độ 400 kHz
   - C. Cổng UART2 ở tốc độ 9600 baud
   - D. Giao tiếp 1-Wire ở tốc độ 115200 baud

2. **Bản tin NMEA nào sau đây của module GPS chứa thông tin kinh độ, vĩ độ và số lượng vệ tinh đang khóa?**
   - A. `$GPVTG`
   - B. `$GPGGA`
   - C. `$GPGSV`
   - D. `$GPGLL`

---
