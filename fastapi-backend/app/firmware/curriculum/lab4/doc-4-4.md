# Lab 4: Doc 4.4 - Phân Tích Chuyên Sâu Chuẩn Giao Thức NMEA 0183 & Kỹ Thuật Chuyển Đổi Dữ Liệu Có Ý Nghĩa

### 1. Tại Sao Bắt Buộc Phải Chuyển Đổi Dữ Liệu NMEA Thô?
Luồng dữ liệu thô thu được từ cổng UART là các dòng chuỗi văn bản ASCII thuần túy. Vi điều khiển OBC không thể sử dụng trực tiếp chuỗi ký tự này để tính toán quỹ đạo, kiểm tra hàng rào địa lý (Geofencing) hay đóng gói vào bản tin Telemetry nếu không chuyển đổi thành các kiểu dữ liệu số thực (`float`, `double`) và số nguyên (`int`).

![Quy trình kiểm tra Checksum XOR và giải mã bản tin NMEA 0183](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab4_nmea_parsing_flow.png)

### 2. Cấu Trúc Chi Tiết Từng Trường của Bản Tin NMEA Chuẩn
Mỗi câu tin NMEA bắt đầu bằng ký tự `$`, theo sau là mã định danh nguồn phát (`GP` cho GPS, `GL` cho GLONASS, `GN` cho đa hệ thống), tên câu lệnh 3 ký tự, các trường dữ liệu ngăn cách bằng dấu phẩy `,` và kết thúc bằng mã Checksum sau dấu `*`:

#### A. Câu tin `$GPRMC` (Recommended Minimum Specific GNSS Data)
Đây là câu tin cốt lõi cung cấp dữ liệu chuyển động và tọa độ vị trí tối thiểu:
```
$GPRMC,083559.00,A,2102.1234,N,10547.5678,E,0.05,84.4,121126,,,A*76
```
- **Trường 1 (`083559.00`):** Thời gian chuẩn quốc tế UTC theo định dạng `hhmmss.ss` (08 giờ 35 phút 59.00 giây).
- **Trường 2 (`A`):** Trạng thái định vị (`Status`):
  - `A` = Active: Tín hiệu vệ tinh hợp lệ, tọa độ tin cậy.
  - `V` = Void: Chưa khóa được vệ tinh, tọa độ không hợp lệ.
- **Trường 3 & 4 (`2102.1234,N`):** Vĩ độ định dạng Độ - Phút thập phân `ddmm.mmmm` và bán cầu (`N` = Bắc, `S` = Nam).
- **Trường 5 & 6 (`10547.5678,E`):** Kinh độ định dạng Độ - Phút thập phân `dddmm.mmmm` và bán cầu (`E` = Đông, `W` = Tây).
- **Trường 7 (`0.05`):** Vận tốc di chuyển mặt đất tính bằng Hải lý trên giờ (Knots).
- **Trường 8 (`84.4`):** Góc hướng di chuyển (Course over ground) tính bằng độ (0° - 360°).
- **Trường 9 (`121126`):** Ngày tháng năm UTC định dạng `ddmmyy` (Ngày 12 tháng 11 năm 2026).

#### B. Công Thức Chuyển Đổi Tọa Độ NMEA sang Độ Thập Phân (Decimal Degrees)
Định dạng NMEA biểu diễn theo Độ và Phút (`ddmm.mmmm`). Để đưa lên bản đồ số (Google Maps, Leaflet, Dashboard), bắt buộc phải đổi sang Độ Thập Phân:

$$\text{Decimal Degrees} = \text{Degrees} + \frac{\text{Minutes}}{60.0}$$

*Ví dụ cụ thể:*
- Vĩ độ thô: `2102.1234, N` ⇒ Số độ nguyên là 21°, số phút là 02.1234'.

$$\text{Latitude} = 21 + \frac{2.1234}{60.0} = \mathbf{21.03539^\circ\text{ N}}$$

- Kinh độ thô: `10547.5678, E` ⇒ Số độ nguyên là 105°, số phút là 47.5678'.

$$\text{Longitude} = 105 + \frac{47.5678}{60.0} = \mathbf{105.79279^\circ\text{ E}}$$

*(Quy ước: Nếu là bán cầu Nam `S` hoặc bán cầu Tây `W`, giá trị tọa độ mang dấu âm)*.

#### C. Câu tin `$GPGGA` (Global Positioning System Fix Data)
Cung cấp thông tin độ cao và chất lượng hình học của tín hiệu vệ tinh:
```
$GPGGA,083559.00,2102.1234,N,10547.5678,E,1,08,1.05,45.2,M,-28.9,M,,*5A
```
- **Trường 6 (`1`):** Chỉ số phẩm chất Fix (`Fix Quality`):
  - `0`: Chưa chốt được vị trí (Invalid).
  - `1`: Định vị GPS tiêu chuẩn (SPS Fix).
  - `2`: Định vị vi sai độ chính xác cao (DGPS Fix).
- **Trường 7 (`08`):** Số lượng vệ tinh đang bám khóa thành công (khuyến nghị $\ge 4$ vệ tinh để tính toán tọa độ không gian 3 chiều).
- **Trường 8 (`1.05`):** Hệ số suy giảm độ chính xác hình học mặt phẳng (**HDOP - Horizontal Dilution of Precision**):
  - $\text{HDOP} < 1.0$: Chất lượng vị trí lý tưởng.
  - $1.0 \le \text{HDOP} \le 2.0$: Rất tốt (đủ tiêu chuẩn điều hướng).
  - $2.0 < \text{HDOP} \le 5.0$: Mức chấp nhận được.
  - $\text{HDOP} > 5.0$: Vệ tinh phân bố góc hẹp, sai số vị trí lớn, phần mềm bay nên tạm thời loại bỏ mẫu đo này.
- **Trường 9 (`45.2,M`):** Cao độ so với mực nước biển trung bình (MSL Altitude) tính bằng mét.

### 3. Thuật Toán Kiểm Tra Toàn Vẹn Checksum XOR
Để bảo đảm đường truyền UART không bị suy hao biến dạng bit làm sai lệch tọa độ:
- Hai ký tự Hex sau dấu `*` ở cuối câu tin chính là mã Checksum 8-bit.
- **Giải thuật:** Duyệt qua tất cả các byte nằm giữa ký tự `$` và ký tự `*`, thực hiện phép toán logic `XOR (^)` liên tục:

$$\text{Checksum} = \bigoplus_{i=1}^{N} \text{byte}[i]$$

- Nếu mã tính toán khớp với 2 ký tự Hex cuối dòng, câu tin được xác nhận hợp lệ.

### 4. Kỹ thuật Lập trình: Bộ Giải Mã Stream Parser (TinyGPS++ / PTIT_GPS)
Thay vì dùng biến chuỗi `String` gây phân mảnh bộ nhớ Heap của ESP32, bộ giải mã chuyên dụng sử dụng máy trạng thái hữu hạn xử lý từng ký tự đến trong thời gian thực:
```cpp
#include <PTITCube.h>

PTIT_GPS myGPS;

void setup() {
    Serial.begin(115200);
    myGPS.init(); // Khởi tạo UART2 và cấu hình parser
}

void loop() {
    // Đẩy từng byte từ UART vào máy trạng thái giải mã NMEA
    myGPS.update();

    static unsigned long lastPrint = 0;
    if (millis() - lastPrint > 2000) {
        lastPrint = millis();
        if (myGPS.getSatellites() > 0 && myGPS.getLat() != 0.0) {
            Serial.printf("Toa do: %.6f, %.6f | Cao do: %.1f m | Ve tinh: %d | HDOP: %.2f\n",
                          myGPS.getLat(), myGPS.getLng(), 
                          myGPS.getAltitude(), myGPS.getSatellites(), myGPS.getHDOP());
        } else {
            Serial.println("GPS: Dang tim tin hieu ve tinh ngoai troi...");
        }
    }
}
```

---

### ❓ Câu Hỏi Củng Cố Kiến Thức (Doc 4.4)
1. **Công thức toán học chuyển đổi tọa độ từ định dạng NMEA độ-phút (`ddmm.mmmm`) sang số thập phân chuẩn WGS-84 (`dd.dddddd`) là:**
   - A. $\text{Decimal} = \text{Degrees} \times 60 + \text{Minutes}$
   - B. $\text{Decimal} = \frac{\text{Degrees} + \text{Minutes}}{100.0}$
   - C. $\text{Decimal} = \text{Degrees} \times \text{Minutes}$
   - D. $\text{Decimal} = \text{Degrees} + \frac{\text{Minutes}}{60.0}$

2. **Mã kiểm tra toàn vẹn Checksum trong bản tin NMEA 0183 được tính toán bằng phép toán logic nào trên các ký tự giữa `$` và `*`?**
   - A. Phép cộng dồn modulo 256
   - B. Phép toán XOR từng byte ký tự ASCII
   - C. Mã đa thức CRC-32 tiêu chuẩn mạng
   - D. Phép nhân băm chuỗi ký tự MD5

---
