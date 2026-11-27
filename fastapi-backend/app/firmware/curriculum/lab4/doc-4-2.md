# Lab 4: Doc 4.2 - Cảm Biến Quán Tính 6 Trục IMU MPU6500 & Thuật Toán Bộ Lọc Bù

### 1. Cảm biến Quán tính IMU 6 Trục MPU6500
- **Nhà sản xuất & Địa chỉ I2C:** InvenSense / TDK. Địa chỉ I2C là `0x68` (chân `ADO = GND`) hoặc `0x69` (chân `ADO = VCC`).
- **Cấu trúc Phần cứng:** Tích hợp một vi cơ điện tử gia tốc kế 3 trục (MEMS 3-axis Accelerometer) và con quay hồi chuyển 3 trục (MEMS 3-axis Gyroscope) trên cùng một đế silicon theo hệ trục tọa độ $X, Y, Z$ in trực tiếp trên bo mạch.
- **Thanh ghi Dữ liệu Thô:** 14 thanh ghi liên tiếp từ `0x3B` đến `0x48` chứa các giá trị số nguyên có dấu 16-bit (`int16_t`):
  - `0x3B - 0x40`: Gia tốc 3 trục $A_x, A_y, A_z$ (độ nhạy cấu hình ±2g, ±4g, ±8g, ±16g).
  - `0x41 - 0x42`: Nhiệt độ nội bộ của chip silicon.
  - `0x43 - 0x48`: Vận tốc góc 3 trục $G_x, G_y, G_z$ (độ nhạy cấu hình ±250, ±500, ±1000, ±2000°/s).

![Sơ đồ chân và trục tọa độ mô-đun IMU MPU6500](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/Lab4.2_MPU6500.png)

#### Bảng Chức năng Các Chân trên Bo mạch Cảm biến MPU6500

| Tên Chân trên Mạch | Loại Tín hiệu | Chức năng Kỹ thuật & Kết nối với PTITCube |
| :--- | :--- | :--- |
| **`VCC`** | Nguồn Cấp | Cấp nguồn hoạt động 3.3V (hoặc 3.3V–5V nếu bo có IC ổn áp LDO trên mạch như hình). |
| **`GND`** | Mass Chung | Nối về điểm đất tham chiếu 0V chung của hệ thống OBC. |
| **`SCL`** | I2C Clock / SPI SCK | Đường xung nhịp đồng bộ I2C (nối `GPIO22` trên ESP32) hoặc xung nhịp SCK khi dùng chế độ SPI. |
| **`SDA`** | I2C Data / SPI SDI | Đường truyền dữ liệu I2C hai chiều (nối `GPIO21` trên ESP32) hoặc ngõ vào MOSI ở chế độ SPI. |
| **`EDA`** | Auxiliary I2C Data | Đường dữ liệu của bus I2C phụ (Master nội), dùng kết nối trực tiếp cảm biến phụ (như từ kế) vào MPU6500. |
| **`ECL`** | Auxiliary I2C Clock | Đường xung nhịp của bus I2C phụ (Master nội) trên MPU6500. |
| **`ADO` (`AD0`)** | Chọn Địa chỉ / SPI SDO | Bit LSB địa chỉ I2C: nối `GND` (hoặc thả nổi có trở kéo xuống) chọn **`0x68`**; nối `VCC` chọn **`0x69`**. Đóng vai trò MISO nếu chạy SPI. |
| **`INT`** | Ngắt Ngoài (*Interrupt*) | Ngõ ra tín hiệu ngắt báo cho ESP32 ngay khi có dữ liệu mẫu mới (*Data Ready*) hoặc phát hiện rung động/chạm ngưỡng. |
| **`NCS`** | Chọn Giao tiếp SPI/I2C | Chân Chip Select của chế độ SPI (tích cực `LOW`). Kéo lên mức `HIGH` (3.3V) hoặc thả nổi (có pull-up nội trên bo) để sử dụng chuẩn **I2C**. |
| **`FSYNC`** | Đồng bộ Khung hình | Chân đầu vào đồng bộ khung hình (*Frame Synchronization* với camera bên ngoài); nối `GND` khi không sử dụng. |

### 2. Cảm biến Từ trường & La bàn số GY-271 (QMC5883L / HMC5883L)
- **Nhà sản xuất & Địa chỉ I2C:** QST / Honeywell. Địa chỉ I2C chuẩn là `0x0D` (QMC5883L / QMC5883P) hoặc `0x1E` (HMC5883L).
- **Cấu trúc Phần cứng:** Tích hợp 3 cảm biến từ điện trở dị hướng (Anisotropic Magnetoresistive - AMR) độ nhạy cao đo cường độ từ trường Trái Đất theo 3 trục trực giao $M_x, M_y, M_z$ (đơn vị Gauss hoặc $\mu\text{T}$) tương ứng với ký hiệu mũi tên trục $X, Y, Z$ trên bo mạch.

![Sơ đồ chân và mặt linh kiện mô-đun từ kế GY-271](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/Lab4.2_GY271.png)

#### Bảng Chức năng Các Chân trên Bo mạch La bàn số GY-271

| Tên Chân trên Mạch | Loại Tín hiệu | Chức năng Kỹ thuật & Kết nối với PTITCube |
| :--- | :--- | :--- |
| **`VCC`** | Nguồn Cấp | Cấp nguồn 3.3V từ đường bus nguồn sạch (bo tích hợp LDO chuyển 3.3V khi dùng nguồn 5V). |
| **`GND`** | Mass Chung | Nối về điểm đất tham chiếu 0V chung của hệ thống. |
| **`SCL`** | I2C Clock | Đường xung nhịp đồng bộ I2C, đấu chung bus với MPU6500 vào chân `GPIO22` của ESP32. |
| **`SDA`** | I2C Data | Đường dữ liệu hai chiều I2C, đấu chung bus với MPU6500 vào chân `GPIO21` của ESP32. |
| **`DRDY`** | Data Ready | Chân ngắt báo sẵn sàng dữ liệu (*Data Ready*); xuất xung báo cho OBC khi thanh ghi đo từ trường vừa được cập nhật giá trị mới. |

- **Thuật toán Tính Góc Hướng La bàn (Heading):**
  Góc hướng la bàn so với cực Bắc từ được tính bằng hàm lượng giác:

$$\text{Heading} = \text{atan2}(M_y, M_x) \cdot \frac{180}{\pi}$$

  Nếu $\text{Heading} < 0^\circ$, hiệu chỉnh: $\text{Heading} = \text{Heading} + 360^\circ$.
- **Hợp nhất Dữ liệu Quán tính 9 Bậc Tự do (9-DOF):** 
  Kết hợp gia tốc kế 3 trục (đo véc-tơ trọng trường), con quay hồi chuyển 3 trục (đo vận tốc góc) từ MPU6500 và từ kế 3 trục (đo véc-tơ từ trường Trái Đất) từ GY-271 cho phép phân hệ ADCS của vệ tinh xác định đầy đủ và ổn định cả 3 góc Euler trong không gian 3 chiều: Roll $\phi$, Pitch $\theta$ và Yaw / Heading $\psi$.
- **Chuẩn hóa Định dạng Log Serial:** Dữ liệu cảm biến được in theo từng cụm 3 trục trên một dòng (`ACCEL: ...`, `GYRO: ...`, `MAG: ...`), loại bỏ hoàn toàn các tiền tố ngoặc vuông `[...]` rườm rà.

### 3. Thuật toán Lọc Bù (Complementary Filter) Ước lượng Tư thế
Để tính toán góc nghiêng (Roll $\phi$, Pitch $\theta$) của vệ tinh, mỗi cảm biến đơn lẻ đều có nhược điểm chí mạng:
- **Gia tốc kế:** Đo véc-tơ gia tốc trọng trường $g$. Cho góc nghiêng chính xác tuyệt vời khi ở trạng thái tĩnh dài hạn, nhưng lại cực kỳ nhạy cảm với các rung động cơ học ngắn hạn và lực quán tính lúc chuyển động (Nhiễu tần số cao).
- **Con quay hồi chuyển:** Đo vận tốc góc quay tức thời $\omega$. Tích phân góc quay $\theta = \int \omega \, dt$ đáp ứng cực nhanh và không bị ảnh hưởng bởi rung lắc cơ học, nhưng lại bị hiện tượng trôi dạt điểm không (Gyro Drift / DC Bias) khiến góc tính toán bị sai lệch tích lũy tăng dần theo thời gian (Nhiễu tần số thấp).
- **Bộ Lọc Bù (Complementary Filter):** Kết hợp một bộ lọc thông cao (High-pass Filter) cho con quay và một bộ lọc thông thấp (Low-pass Filter) cho gia tốc kế theo công thức hợp nhất:

$$\theta_t = \alpha \cdot (\theta_{t-1} + \omega \cdot \Delta t) + (1 - \alpha) \cdot \theta_\text{accel}$$

  Trong đó: $\Delta t$ là chu kỳ lấy mẫu, $\alpha$ là trọng số lọc (thường chọn $\alpha = 0.96 - 0.98$). Thuật toán chạy siêu nhanh trên vi điều khiển, triệt tiêu hoàn toàn độ trôi của con quay và lọc sạch nhiễu rung lắc của gia tốc kế.

![Bộ lọc bù hợp nhất dữ liệu IMU](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab4_complementary_filter.png)

---

### ❓ Câu Hỏi Củng Cố Kiến Thức (Doc 4.2)
1. **Cảm biến quán tính IMU được tích hợp trên bộ kit PTITCube thuộc dòng cảm biến nào và có địa chỉ I2C mặc định là gì?**
   - A. ADXL345 địa chỉ 0x53
   - B. LSM9DS1 địa chỉ 0x1E
   - C. BNO055 địa chỉ 0x28
   - D. MPU6500 địa chỉ 0x68

2. **Bộ lọc bù (Complementary Filter) giải quyết bài toán tính góc nghiêng tư thế (Roll/Pitch) theo nguyên lý nào?**
   - A. Tắt hoàn toàn tín hiệu đo của gia tốc kế
   - B. Kết hợp lọc thông cao cho con quay hồi chuyển và thông thấp cho gia tốc kế
   - C. Lấy trung bình cộng số học của hai giá trị thô
   - D. Chỉ dùng tích phân con quay hồi chuyển theo thời gian

3. **Cảm biến từ trường QMC5883L (địa chỉ 0x0D) cung cấp dữ liệu nào phục vụ phân hệ xác định tư thế vệ tinh?**
   - A. Cường độ từ trường 3 trục dùng để tính góc hướng La bàn (Heading)
   - B. Vận tốc quay quanh trục Z
   - C. Độ ẩm môi trường xung quanh vỏ vệ tinh
   - D. Gia tốc trọng trường dọc theo trục thẳng đứng

---
