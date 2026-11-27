# Lab 1: Doc 1.4 - Giao tiếp Nối tiếp Bất đồng bộ UART & Kỹ thuật Xử lý Luồng Dữ liệu Serial

### 1. Nguyên lý Giao tiếp UART Bất đồng bộ

Giao tiếp **UART (Universal Asynchronous Receiver-Transmitter)** là chuẩn truyền thông nối tiếp điểm - điểm (Point-to-Point) không đồng bộ kinh điển nhất trong kỹ thuật nhúng và hàng không vũ trụ:

- **Tính chất Bất đồng bộ (Asynchronous):** Không có đường dây phát xung nhịp Clock chung giữa hai thiết bị. Hai bên truyền và nhận phải được cài đặt cùng một tốc độ truyền định trước (**Baud rate**) và tự căn chỉnh thời gian dựa trên các cạnh chuyển tiếp của tín hiệu.
- **Cấu trúc Đường truyền:** Chỉ sử dụng đúng 2 dây tín hiệu:
  - `TX (Transmit)`: Đường xuất dữ liệu từ thiết bị phát.
  - `RX (Receive)`: Đường nhận dữ liệu vào thiết bị thu (Nối chéo: TX_A → RX_B và RX_A → TX_B).

![Sơ đồ kết nối UART Full-Duplex](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab1_uart_connection.png)

![Giản đồ xung khung truyền UART 8-N-1](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab1_uart_timing_sequence.png)

### 2. Cấu hình Cổng Serial & Khung Truyền SERIAL_8N1

Khung truyền nối tiếp chuẩn mực nhất của ngành công nghiệp là **SERIAL_8N1**:

- **8 Bit Dữ liệu (Data bits):** Đủ để truyền chính xác 1 byte dữ liệu hoặc 1 ký tự mã ASCII chuẩn ($0 - 255$).
- **No Parity (Không kiểm tra chẵn lẻ):** Không thêm bit kiểm tra, giúp tối ưu hóa băng thông truyền dẫn.
- **1 Bit Stop (1 Dừng):** Duy trì mức cao tối thiểu trong thời gian 1 bit trước khi cho phép bắt đầu khung truyền tiếp theo.
- **Thời gian truyền 1 Byte:**
  Tổng số bit cần truyền cho 1 byte là: 1 Start + 8 Data + 1 Stop = 10 bit.
  Ở tốc độ baud chuẩn 115200 bps, thời gian truyền 1 bit là:

$$T_{\text{bit}} = \frac{1}{115200} \approx 8.68\,\mu\text{s} \implies T_{\text{byte}} = 10 \times 8.68\,\mu\text{s} \approx 86.8\,\mu\text{s}$$

  Tốc độ truyền dữ liệu hữu ích cực đại đạt: ≈ 11520 Byte/s ≈ 11.25 KB/s.

### 3. Ba Cổng UART Phần cứng trên ESP32

Vi điều khiển ESP32 tích hợp sẵn 3 khối phần cứng UART độc lập (`UART0`, `UART1`, `UART2`). Nhờ ma trận chuyển mạch **GPIO Matrix**, ngoài các chân mặc định trên bo mạch NodeMCU-32S, các tín hiệu TX/RX của bộ UART có thể được định tuyến linh hoạt tới các chân GPIO an toàn nhằm tránh xung đột phần cứng:

![Đánh dấu vị trí 3 cổng UART phần cứng trên ESP32 NodeMCU-32S](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/Lab1.1_esp32.png)

1. **UART0 (`Serial` — GPIO1 TX / GPIO3 RX):** Cổng UART nối tiếp mặc định được nối trực tiếp với chip cầu USB-UART (CP2102/CH340) trên bo mạch, dùng cho việc nạp mã nguồn từ Web IDE và in nhật ký gỡ lỗi ra cửa sổ Serial Monitor (tốc độ chuẩn 115200 bps).
2. **UART1 (`Serial1` — Ánh xạ qua GPIO Matrix):** Cổng UART thứ hai trên chip. Về mặt phần cứng gốc, chân mặc định của UART1 (`GPIO9` / `GPIO10`) bị trùng với bus giao tiếp chip nhớ SPI Flash nội bên trong module (ký hiệu `!` màu đỏ trên sơ đồ chân). Do đó, khi khởi tạo `HardwareSerial(1)`, lập trình viên **bắt buộc phải ánh xạ (remap)** sang các chân GPIO tự do an toàn thông qua lệnh `Serial1.begin(baud, SERIAL_8N1, RX_PIN, TX_PIN)` (ví dụ kết nối tới module vô tuyến **LoRa E32**).
3. **UART2 (`Serial2` — GPIO17 TX2 / GPIO16 RX2):** Cổng nối tiếp phần cứng độc lập thứ ba, trên PTITCube được dành riêng để giao tiếp với module vệ tinh định vị **GNSS L76X** (9600 bps) và cụm tải trọng **Camera OV2640** (115200 bps) luân phiên thông qua IC chuyển mạch **74HC4066**.

| Cổng UART | Đối tượng C++ | Chân Mặc định (NodeMCU-32S) | Trạng thái & Lưu ý Phần cứng | Ứng dụng trên Kit PTITCube |
| :--- | :--- | :--- | :--- | :--- |
| **UART0** | `Serial` | **TX:** `GPIO1` (`U0TXD`)<br>**RX:** `GPIO3` (`U0RXD`) | Nối cứng với chip cầu USB-UART Type-C. | Nạp firmware Web Serial API, xuất log & nhận lệnh CLI. |
| **UART1** | `Serial1` / `HardwareSerial(1)` | *Mặc định `GPIO9/10` trùng Flash (!)* → **Remap qua GPIO Matrix** | Không dùng `GPIO9/10`; truyền tham số chân `(RX, TX)` an toàn vào `begin()`. | Giao tiếp hai chiều với module thu phát vô tuyến **LoRa E32** (433 MHz). |
| **UART2** | `Serial2` / `HardwareSerial(2)` | **TX2:** `GPIO17`<br>**RX2:** `GPIO16` | Hoạt động độc lập, không ảnh hưởng quá trình nạp code qua USB. | Đọc bản tin NMEA từ **GNSS L76X** & ảnh JPEG từ **Camera OV2640** (qua `74HC4066`). |

---
