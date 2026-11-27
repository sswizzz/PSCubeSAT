# Lab 2: Doc 2.2 - Quản lý Rủi ro Sụt áp (Brownout), Cơ chế Ngắt An toàn Phóng & Điều Khiển Mạch Hạ Áp Cấp Nguồn Cảm Biến

![Bảo vệ sụt áp Brownout và điều khiển cấp nguồn tải](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab2_brownout_power_gating.png)

### 1. Cơ chế Ngắt An toàn Phóng (Safety Inhibits)
Để được các cơ quan hàng không vũ trụ (NASA, JAXA, ESA) cấp phép đưa lên tên lửa đẩy, vệ tinh bắt buộc phải có tối thiểu 2 cơ chế ngắt nguồn độc lập nhằm bảo đảm an toàn tuyệt đối cho tên lửa mẹ:
1. **Chốt Rút Trước Giờ Bay (Remove-Before-Flight - RBF Pin):**
   - Một chốt cơ khí cách điện được cắm xuyên qua vỏ vệ tinh, ngắt đường nguồn chính của pin.
   - Khi chuẩn bị đưa vệ tinh vào ống phóng tại bãi phóng, kỹ sư thao tác rút chốt này ra. Dải cờ đỏ rực rỡ "REMOVE BEFORE FLIGHT" gắn liền với chốt giúp kiểm tra trực quan, loại bỏ nguy cơ quên kích hoạt.
2. **Công tắc Hành trình Chân Ray (Deployment / Separation Switch):**
   - Bố trí ở đầu mút của thanh ray dẫn hướng.
   - Khi vệ tinh được trượt vào trong lòng ống phóng P-POD, cần gạt công tắc bị nén chặt xuống bởi thành ống phóng, giữ tiếp điểm ở trạng thái ngắt mạch điện.
   - Khi cửa P-POD mở và lò xo đẩy vệ tinh bay ra ngoài không gian, cần gạt bật bung ra, đóng tiếp điểm cấp điện toàn bộ hệ thống EPS.

### 2. Hiện tượng Sụt áp Nguồn (Brownout) & Cơ chế Bảo vệ Của ESP32
Khi tải tiêu thụ đột ngột đòi hỏi dòng điện lớn (như khi module LoRa bắt đầu phát sóng công suất cao hoặc module Camera nạp tụ), nội trở của pin và điện cảm đường mạch sẽ gây ra hiện tượng sụt áp tức thời (Voltage Sag):
- Nếu điện áp cấp cho vi điều khiển sụt xuống dưới ngưỡng an toàn tối thiểu (thường là 2.7V), CPU sẽ thực thi sai tập lệnh, bộ nhớ Flash có thể bị ghi đè dữ liệu rác làm hỏng hệ điều hành.
- **Mạch Phát hiện Sụt áp Phần cứng (Brownout Detector - BOD):** Tích hợp bên trong ESP32, liên tục so sánh điện áp nguồn $V_{\text{dd}}$ với các mức ngưỡng tham chiếu. Khi phát hiện điện áp tụt dưới ngưỡng định sẵn, BOD kích hoạt tín hiệu Reset khẩn cấp bằng phần cứng để bảo vệ vi xử lý khỏi trạng thái bất định.
- **Biện pháp Khắc phục Phần cứng:** Bố trí các tụ điện hóa Tantalum dung lượng lớn ($100\mu\text{F} - 470\mu\text{F}$) có nội trở ESR cực thấp ngay sát chân nguồn của module phát sóng và camera để xả năng lượng bù đắp cho các đỉnh dòng tức thời.

### 3. Nguyên Lý Điều Khiển Mạch Hạ Áp (Buck Converter) & Kỹ Thuật Power Gating Tiết Kiệm Năng Lượng
Trong một vệ tinh CubeSat, việc duy trì cấp nguồn liên tục cho toàn bộ các mạch tải ngoại vi là nguyên nhân hàng đầu gây hao tổn dung lượng pin do dòng tĩnh (Quiescent Current) và dòng rò vi mạch.
- **Đầu ra Mạch Hạ Áp Cấp Nguồn Cho Tải Ngoại Vi:** Trên bo mạch EPS, đầu ra của mạch hạ áp DC-DC Buck Converter chịu trách nhiệm cung cấp đường nguồn 3.3V sạch riêng biệt cho toàn bộ cụm tải tiêu thụ ngoại vi.
- **Kỹ thuật Cắt Nguồn Phân Hệ (Power Gating):** Trên bo mạch phân hệ nguồn EPS, đường tín hiệu điều khiển dòng điện đi vào mạch hạ áp hoạt động theo logic phần cứng:
  - **Mức 1 (`HIGH`):** Ngắt dòng điện đi vào mạch hạ áp $\rightarrow$ Cắt toàn bộ nguồn cấp cho tải ngoại vi, đưa dòng tiêu thụ của khối tải về 0 mA trong thời gian nghỉ.
  - **Mức 0 (`LOW`):** Cho phép dòng điện đi vào mạch hạ áp $\rightarrow$ Kích hoạt mạch hạ áp cấp nguồn 3.3V ổn định cho tải tiêu thụ.
  - **Đóng gói Thư viện Cấp cao:** Thao tác cấu hình chân GPIO và xuất xung mức logic được đóng gói hoàn toàn bên trong thư viện `PTIT_EPS` thông qua phương thức `eps.setBuckState(true)` (BẬT nguồn tải) và `eps.setBuckState(false)` (TẮT nguồn tải), che giấu sự phụ thuộc vào chân phần cứng cụ thể.
  - **Cơ chế Kích hoạt Power Saving Mode dựa trên Ngưỡng Pin:**
    Hệ thống giám sát liên tục điện áp pin $V_\text{cell}$ và phần trăm dung lượng $\text{SOC}$. Chế độ tiết kiệm điện (Power Saving Mode) được tự động kích hoạt khi:

$$V_\text{cell} < 3.70\text{ V} \quad \text{or} \quad \text{SOC} < 25.0\%$$

    - *Khi pin yếu:* OBC lập tức gọi `eps.setBuckState(false)` để ngắt mạch hạ áp, sa thải toàn bộ phụ tải tiêu thụ và kéo dài chu kỳ ngủ ($5000\text{ ms}$) nhằm bảo toàn năng lượng cho máy tính sinh tồn và nạp lại pin.
    - *Khi pin khỏe ($V_\text{cell} \ge 3.70\text{ V}$ và $\text{SOC} \ge 25.0\%$):* OBC duy trì `eps.setBuckState(true)` ở chế độ bình thường (Normal Mode) với chu kỳ làm việc tích cực ($1500\text{ ms}$).
- **Hiệu quả Tiết kiệm Năng lượng (Duty Cycling):**
  - Giả sử tổng dòng tiêu thụ của khối tải ngoại vi khi hoạt động là 25 mA.
  - Nếu bật liên tục trong 1 chu kỳ quỹ đạo 95 phút, năng lượng tiêu thụ là:

$$E_{\text{continuous}} = 3.3\text{ V} \times 25\text{ mA} \times 1.583\text{ h} \approx 130.6\text{ mWh}$$

  - Nếu chỉ bật 1.5 giây mỗi 6.5 giây (chu kỳ hoạt động với Duty Cycle $\approx 23\%$):

$$E_{\text{gating}} \approx 130.6\text{ mWh} \times 0.23 \approx 30.0\text{ mWh}$$

  - Kỹ thuật điều khiển dòng mạch hạ áp giúp giảm thiểu tới **77%** lượng điện năng tiêu hao của tải ngoại vi, kéo dài tuổi thọ của pin trong pha bóng tối Trái Đất (Eclipse).

---

### ❓ Câu Hỏi Củng Cố Kiến Thức (Doc 2.2)
1. **Chức năng an toàn bắt buộc của công tắc RBF (Remove Before Flight) hoặc Release Switch trên phân hệ EPS là gì?**
   - A. Tự động xả cạn năng lượng pin trước khi đưa lên quỹ đạo
   - B. Kích hoạt chế độ truyền dữ liệu công suất cực đại
   - C. Chuyển đổi qua lại giữa pin chính và pin dự phòng
   - D. Ngắt hoàn toàn nguồn điện khi vệ tinh nằm trong ống phóng

2. **Trên bo mạch EPS, vai trò cốt lõi của mạch hạ áp DC-DC Buck Converter là gì?**
   - A. Chuyển điện áp một chiều DC thành xoay chiều AC
   - B. Ổn định điện áp 3.3V cấp cho vi xử lý với hiệu suất cao
   - C. Tăng điện áp pin từ 3.7V lên 12V để nạp nhanh
   - D. Đo đạc dòng điện rò rỉ của khung sườn cơ học

---

## 💻 Hướng Dẫn Thực Hành: Lập Trình Giám Sát Phân Hệ Nguồn EPS

### 1. Kỹ thuật Đọc Thanh Ghi I2C Thuần trên Chip MAX17048
Chương trình C++ giao tiếp trực tiếp với các thanh ghi nội của MAX17048 thông qua thư viện `Wire.h`:

```cpp
#include <Wire.h>

#define MAX17048_ADDR 0x36
#define REG_VCELL      0x02
#define REG_SOC        0x04

float readBatteryVoltage() {
    Wire.beginTransmission(MAX17048_ADDR);
    Wire.write(REG_VCELL); // Trỏ tới thanh ghi VCELL
    if (Wire.endTransmission(false) != 0) return -1.0f; // Báo lỗi truyền tin

    Wire.requestFrom(MAX17048_ADDR, 2); // Yêu cầu 2 byte dữ liệu
    if (Wire.available() == 2) {
        uint8_t msb = Wire.read();
        uint8_t lsb = Wire.read();
        uint16_t raw = (msb << 8) | lsb;
        // Mỗi LSB tương ứng với 78.125 uV (1.25mV / 16)
        return (float)raw * 0.000078125f;
    }
    return -1.0f;
}

float readBatterySOC() {
    Wire.beginTransmission(MAX17048_ADDR);
    Wire.write(REG_SOC); // Trỏ tới thanh ghi SOC
    if (Wire.endTransmission(false) != 0) return -1.0f;

    Wire.requestFrom(MAX17048_ADDR, 2);
    if (Wire.available() == 2) {
        uint8_t msb = Wire.read();
        uint8_t lsb = Wire.read();
        // Byte cao là phần nguyên %, byte thấp là phần thập phân chia 256
        return (float)msb + ((float)lsb / 256.0f);
    }
    return -1.0f;
}
```

### 2. Danh mục Bài Thực hành Lab 2
- `Lab2-01a_Battery_I2C`: Thực hành lập trình đọc trực tiếp thanh ghi điện áp `VCELL` và dung lượng `SOC` từ IC MAX17048 qua giao tiếp I2C thuần.
- `Lab2-01b_Battery_Library`: Khởi tạo và quản lý phân hệ nguồn EPS thông qua lớp đối tượng đóng gói cấp cao của thư viện PTITCube, in báo cáo định kỳ ra Serial Monitor.
- `Lab2-02_Power_Saving`: Tự động kích hoạt chế độ tiết kiệm năng lượng (Power Saving Mode) dựa trên ngưỡng điện áp cell pin ($< 3.70\text{V}$) hoặc phần trăm dung lượng ($< 25\%$), điều khiển bật/tắt mạch hạ áp Buck Converter thông qua phương thức thư viện `PTIT_EPS` (`eps.setBuckState()`) để sa thải phụ tải an toàn.

### ❓ Câu Hỏi Đánh Giá Kỹ Năng Thực Hành (Lab 2)
1. **Công thức chuyển đổi giá trị thô 16-bit đọc từ thanh ghi VCELL (0x02) của MAX17048 sang điện áp thực tế (Volt) là:**
   - A. $V = \text{raw} \times 78.125\ \mu\text{V} / 1000000$
   - B. $V = \text{raw} \times 1.25\text{ mV}$
   - C. $V = \text{raw} / 1024.0$
   - D. $V = \text{raw} \times 3.3 / 4096.0$

2. **Khi điện áp pin sụt giảm dưới ngưỡng an toàn (ví dụ 3.4V), phần mềm bay trên OBC cần thực hiện hành động khẩn cấp nào?**
   - A. Tăng công suất phát sóng vô tuyến để gửi cầu cứu
   - B. Ghi đè toàn bộ dữ liệu thẻ nhớ để giải phóng bộ nhớ
   - C. Ngắt tải ngoại vi và chuyển hệ thống sang chế độ Sleep tiết kiệm điện
   - D. Khởi động lại liên tục để phục hồi dung lượng pin
