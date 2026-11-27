# Lab 1: Doc 1.1 - Kiến trúc Phần cứng Vi điều khiển ESP32-WROOM-32 & Các Chuẩn Giao tiếp Ngoại vi

### 1. Vai trò Cốt tử của Phân hệ Máy tính trên Bo mạch (OBC - On-Board Computer)

Trong cấu trúc phân tầng của một vệ tinh nhân tạo CubeSat 1U, phân hệ Máy tính trên Bo mạch (**OBC - On-Board Computer**) đóng vai trò như "bộ não hạt nhân" chỉ huy, điều phối và liên kết toàn bộ các phân hệ chức năng khác thành một thực thể thống nhất. Nếu không có OBC hoạt động tin cậy, vệ tinh sẽ chỉ là một khối kim loại vô tri lơ lửng ngoài không gian.

Các nhiệm vụ sống còn mà OBC đảm nhiệm bao gồm:

1. **Khởi động & Quản lý Trình tự Nạp Hệ thống (Bootstrapping & Sequence Management):** Khi công tắc hành trình phóng nhả ra ngoài không gian, OBC khởi động từ bộ nhớ bất biến ROM/Flash, nạp cấu hình hệ thống, kiểm tra tính toàn vẹn của các ngoại vi và khởi chạy bộ đếm thời gian im lặng vô tuyến 30 phút.
2. **Thu thập & Đóng gói Dữ liệu Viễn trắc (Telemetry Acquisition & Framing):** Định kỳ quét và đọc các thông số từ phân hệ nguồn EPS (điện áp, dòng sạc/xả, dung lượng pin, nhiệt độ cell), phân hệ cảm biến (áp suất khí quyển, gia tốc, vận tốc góc quay, từ trường Trái Đất, tọa độ GPS) và trạng thái kết cấu để đóng gói thành bản tin nhị phân chuẩn (Beacon).
3. **Tiếp nhận & Thực thi Mệnh lệnh Điều khiển (Telecommand Processing):** Lắng nghe dữ liệu gói tin từ trạm mặt đất chuyển tiếp qua phân hệ truyền thông COM, giải mã cú pháp mệnh lệnh (Opcode, Payload), xác thực khóa bản quyền bảo mật (Security Token) và thực thi các hành động như: kích hoạt camera chụp ảnh, thay đổi chu kỳ phát beacon, bật/tắt nguồn cảm biến hoặc nạp lại tham số quỹ đạo.
4. **Quản lý Hệ thống Tệp tin & Lưu trữ Dữ liệu Bay (Data Storage & File Management):** Quản lý quá trình ghi tệp dữ liệu cảm biến, hình ảnh viễn thám và nhật ký hành trình bay (Flight Log) lên thẻ nhớ microSD qua giao diện SPI tốc độ cao định dạng FAT32.
5. **Giám sát Trạng thái & Tự động Phục hồi Lỗi (FDIR - Fault Detection, Isolation, and Recovery):** Theo dõi nhịp tim hệ thống (Heartbeat), duy trì xung làm tươi bộ định thời Watchdog Timer phần cứng (Hardware Watchdog Timer) và kích hoạt quy trình khởi động lại mềm (Soft Reset) hoặc ngắt mở lại nguồn (Power Cycling) khi phát hiện sự cố treo bus do bức xạ không gian.

![Kiến trúc phần cứng OBC ESP32](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab1_obc_architecture.png)

---

### 2. Thông số Kỹ thuật Chi tiết Vi xử lý ESP32-WROOM-32

Bộ kit vệ tinh giáo dục **PTITCube** lựa chọn vi điều khiển hệ thống trên chip (SoC) **ESP32-WROOM-32** của Espressif Systems nhờ sự kết hợp lý tưởng giữa năng lực tính toán 32-bit mạnh mẽ, dung lượng bộ nhớ dồi dào, khả năng hỗ trợ hệ điều hành thời gian thực FreeRTOS và giá thành tối ưu cho giáo dục:

| Khối Chức năng | Thông số Kỹ thuật Chi tiết | Ý nghĩa trong Ứng dụng Không gian & Lab |
| :--- | :--- | :--- |
| **Kiến trúc Lõi (CPU Architecture)** | Dual-core Tensilica Xtensa 32-bit LX6 | Hai lõi vật lý hoạt động độc lập; cho phép tách biệt luồng xử lý viễn thông/mạng trên Core 0 và luồng thuật toán bay trên Core 1. |
| **Tần số Xung nhịp (Clock Frequency)** | Có thể cấu hình: 80 MHz, 160 MHz đến tối đa 240 MHz | Xung nhịp cao hỗ trợ tính toán ma trận xoay tư thế 3D và xử lý dòng dữ liệu ảnh JPEG mượt mà. |
| **Bộ nhớ SRAM Nội bộ** | $520\text{ KB}$ SRAM ($512\text{ KB}$ khả dụng) | Phân chia thành $192\text{ KB}$ IRAM (chứa mã thực thi tốc độ cao) và $328\text{ KB}$ DRAM (chứa biến dữ liệu, bộ đệm DMA và ngăn xếp tác vụ). |
| **Bộ nhớ Flash Ngoài** | 4 MB (hoặc 16 MB) Flash Quad-SPI | Lưu trữ tệp thực thi nhị phân, bảng phân vùng và hệ thống tệp tin nhúng (SPIFFS/LittleFS). |
| **Bộ đồng xử lý Công suất Thấp (ULP)** | Co-processor FSM siêu tiết kiệm điện | Có thể đọc cảm biến và theo dõi mức pin khi cả hai lõi CPU chính đều ở chế độ ngủ sâu (Deep Sleep). |
| **Chuyển đổi Tương tự - Số (ADC)** | 2 × 12-bit SAR ADC (tối đa 18 kênh) | Đo đạc điện áp pin và tín hiệu cảm biến analog với độ phân giải $4096$ mức. |
| **Giao tiếp Nối tiếp (Serial Buses)** | $3 \times\text{UART}$, $2 \times\text{I2C}$, $3 \times\text{SPI}$, $2 \times\text{I2S}$, $1 \times\text{CAN}$ | Hỗ trợ đầy đủ mọi giao thức giao tiếp công nghiệp vũ trụ. |
| **Mạng Không dây Tích hợp** | Wi-Fi 802.11 b/g/n (2.4 GHz) & Bluetooth v4.2 BR/EDR/BLE | Hỗ trợ mô phỏng truyền nhận dữ liệu tầm gần trong phòng thí nghiệm và kết nối Web LMS. |
| **Điện áp Hoạt động Danh định** | 3.0V - 3.6V (Chuẩn tối ưu: 3.3V) | Khớp chuẩn với đường nguồn 3.3V do mạch Buck chuyển đổi từ pin Lithium EPS. |

---

### 3. Sơ đồ Chân Bo mạch ESP32 NodeMCU-32S (38 Chân) & Bảng Chức năng Chi tiết

Trên thực tế, module **ESP32-WROOM-32** thường được tích hợp lên bo mạch phát triển **NodeMCU-32S (chuẩn 38 chân)** để thuận tiện cắm thử nghiệm và tích hợp lên bo chủ OBC của bộ kit PTITCube. Nhờ kiến trúc ma trận chuyển mạch **GPIO Matrix**, hầu hết các chân ngoại vi (PWM, I2C, SPI, UART) có thể được gán linh hoạt, nhưng người thiết kế phải tuân thủ đúng nhóm chức năng vật lý và giới hạn điện áp 3.3V của từng chân.

![Sơ đồ chân đầy đủ của bo mạch ESP32 NodeMCU-32S](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/Lab1.1_esp32.png)

#### Bảng Chức năng Các Chân trên Bo mạch ESP32 NodeMCU-32S

| Nhóm Chân | Ký hiệu trên Mạch | Chức năng Phần cứng Chính & Ngoại vi Tích hợp | Chiều I/O & Ghi chú Sử dụng trên PTITCube |
| :--- | :--- | :--- | :--- |
| **Nguồn & Điều khiển** | **3V3**, **5V0**, **GND** | `3V3`: Đường nguồn ổn áp 3.3V; `5V0`: Nguồn vào/ra 5V từ cổng USB Type-C; `GND`: Mass chung hệ thống. | Nguồn cấp logic cho ESP32 tối đa 3.3V (không cấp 5V vào chân GPIO). |
| **Reset / Kích hoạt** | **EN** | Chân Enable (tích cực mức `HIGH` nhờ trở kéo lên `PU`). Kéo xuống `LOW` (nút nhấn `EN`) để Reset chip. | Kết hợp với chân `GPIO0` (`IO0`) qua mạch DTR/RTS để nạp firmware tự động. |
| **Chỉ có Chiều Nhập (Input Only)** | **GPIO36** (`S_VP`), **GPIO39** (`S_VN`), **GPIO34** (`VDET_1`), **GPIO35** (`VDET_2`) | Kênh `ADC1_0`, `ADC1_3`, `ADC1_6`, `ADC1_7` (12-bit) và vùng nguồn `RTC`. | **Chỉ Input**, **không xuất tín hiệu `OUTPUT`**, **không có trở kéo nội (Pull-up/Pull-down)**; thích hợp đọc cảm biến Analog / điện áp / chân `AUX` báo bận. |
| **Cảm ứng, RTC & DAC / ADC** | **GPIO32** (`TOUCH9 / ADC1_4`), **GPIO33** (`TOUCH8 / ADC1_5`), **GPIO25** (`DAC_1`), **GPIO26** (`DAC_2`), **GPIO27** (`TOUCH7 / ADC2_7`) | Hỗ trợ I/O 2 chiều, PWM, ngắt ngoài, chuyển đổi Số-Tương tự DAC 8-bit (`GPIO25`, `GPIO26`) và bộ tạo dao động 32 kHz (`GPIO32/33`). | An toàn tuyệt đối khi khởi động (`Boot Safe`); phù hợp làm chân điều khiển ngoại vi, giao tiếp UART1 remap hoặc chân kích hoạt PWM. *(Lưu ý: `ADC2` không dùng đồng thời khi bật Wi-Fi).* |
| **Bus I2C Mặc định (Wire)** | **GPIO21** (`WIRE_SDA`), **GPIO22** (`WIRE_SCL`) | Đường dữ liệu `SDA` và xung nhịp `SCL` mặc định của thư viện `Wire.h`. | Giao tiếp chuẩn I2C với **MAX17048** (`0x36`), **BMP280** (`0x76/0x77`), **MPU6500** (`0x68`) và **GY-271** (`0x0D`). |
| **Cổng UART0 (Nạp & Debug)** | **GPIO1** (`U0TXD / SERIAL_TX`), **GPIO3** (`U0RXD / SERIAL_RX`) | Kênh truyền/nhận nối tiếp mặc định nối thẳng tới chip cầu USB-UART (CP2102/CH340). | Dùng nạp firmware qua Web IDE & giao tiếp Serial Monitor (115200 bps). Không gắn tải ngoài gây xung đột mức logic. |
| **Cổng UART2 (Phần cứng)** | **GPIO17** (`TX2`), **GPIO16** (`RX2`) | Kênh truyền/nhận nối tiếp phần cứng độc lập `Serial2`. | Giao tiếp tốc độ cao với module định vị **GNSS L76X** và **Camera OV2640** thông qua IC đa hóa **74HC4066**. |
| **Bus VSPI (SPI Mặc định)** | **GPIO23** (`VSPI_MOSI`), **GPIO19** (`VSPI_MISO`), **GPIO18** (`VSPI_SCK`), **GPIO5** (`VSPI_SS`) | Giao tiếp SPI tốc độ cao phần cứng (tối đa 40 MHz); `GPIO5` kiêm chân strapping `SDIO`. | Chuẩn kết nối với khe thẻ nhớ **microSD** lưu nhật ký bay (Flight Log) & tệp ảnh JPEG. |
| **Bus HSPI & JTAG** | **GPIO13** (`HSPI_MOSI / MTCK`), **GPIO12** (`HSPI_MISO / MTDI`), **GPIO14** (`HSPI_SCK / MTMS`), **GPIO15** (`HSPI_SS / MTDO`) | Kênh SPI thứ hai (`HSPI`) đồng thời phục vụ giao diện gỡ lỗi JTAG và ADC2 / Touch. | Trong **Lab 1** (trên bo rời): `GPIO13, 14, 15` dùng điều khiển IC dịch chốt `74HC595`. **Lưu ý:** `GPIO12` và `GPIO15` là chân Strapping nhạy cảm khi khởi động. |
| **Chân Điều khiển & Strapping** | **GPIO0** (`BOOT`), **GPIO2** (`LED`), **GPIO4** (`ADC2_0 / TOUCH0`) | I/O đa năng hỗ trợ PWM, ADC2, Touch. `GPIO2` thường gắn sẵn LED xanh trên bo; `GPIO0` nối nút `IO0/BOOT`. | Trong **Lab 1**: `GPIO2` điều khiển LED đơn, `GPIO4` đọc nút nhấn `INPUT_PULLUP`. Khi tích hợp kit: dùng điều khiển chân chọn `M0/M1`, nút nhấn hoặc tín hiệu chuyển mạch. |
| **Chân Flash Nội (! CẤM DÙNG)** | **GPIO6** (`SCK`), **GPIO7** (`D0`), **GPIO8** (`D1`), **GPIO9** (`D2`), **GPIO10** (`D3`), **GPIO11** (`CMD`) | Đường kết nối nội bộ giữa lõi ESP32 và chip nhớ **SPI Flash 4 MB** bên trong vỏ bọc kim loại. | **TUYỆT ĐỐI KHÔNG SỬ DỤNG** làm GPIO thường (cũng không dùng trực tiếp chân UART1 mặc định `GPIO9/10` mà phải remap qua GPIO Matrix). |

---

### 4. Sơ đồ Chân Đặc biệt (Strapping Pins) & Lưu ý An toàn Phần cứng

Trên vi điều khiển ESP32, có một số chân GPIO đặc biệt được gọi là **Strapping Pins**. Mức logic điện áp tại các chân này được chip lấy mẫu (sample) ngay tại khoảnh khắc xung Reset nhả ra ($0 \to 1$). Mức logic này quyết định chế độ hoạt động của chip:

![Luồng khởi động và chân Strapping Pin ESP32](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab1_strapping_flow.png)

| Tên Chân GPIO | Chức năng Strapping | Mức Logic Boot Bình thường | Mức Logic Nạp Firmware | Cảnh báo An toàn Thiết kế |
| :--- | :--- | :--- | :--- | :--- |
| **GPIO 0** | Quyết định Chế độ Khởi động (Boot Mode) | **HIGH (Kéo lên 3.3V)** | **LOW (Nối Mass 0V)** | Chân này có trở kéo lên nội. Nếu vô tình gắn cảm biến kéo chân này xuống đất khi khởi động, ESP32 sẽ rơi vào chế độ nạp và không bao giờ chạy code bay! |
| **GPIO 2** | Quyết định Chế độ Khởi động & Nạp Flash | **LOW hoặc Không kết nối** | **LOW (Nối Mass 0V)** | Thường được nối với LED báo trên bo mạch. Không được kéo chân này lên mức cao bất thường khi boot. |
| **GPIO 12 (MTDI)** | Quyết định Điện áp Bộ điều áp Nội cho Flash (VDD_SDIO) | **LOW (Điện áp 3.3V)** | **LOW (Điện áp 3.3V)** | **CỰC KỲ NGUY HIỂM:** Nếu GPIO 12 bị kéo lên mức cao (3.3V) khi khởi động, chip sẽ cấu hình đường nguồn cấp Flash nội tụt xuống 1.8V, khiến bộ nhớ Flash không đọc được và làm ESP32 bị brick tạm thời! |
| **GPIO 15 (MTDO)** | Bật/Tắt Xuất Thông điệp Debug ra Cổng UART0 | **HIGH (Kéo lên 3.3V)** | **HIGH (Kéo lên 3.3V)** | Điều khiển việc chip có in các dòng thông báo ROM Bootloader ra cổng Serial ở tốc độ 115200 hay không. |

> [!WARNING]
> **Quy tắc Vàng khi Thiết kế OBC:**
>
> - Tuyệt đối không sử dụng các chân GPIO 6, 7, 8, 9, 10, 11 cho các mục đích thông thường vì các chân này được kết nối trực tiếp bên trong vỏ module với chip nhớ SPI Flash. Bất kỳ tác động điện áp nào lên các chân này đều làm sập vi xử lý ngay lập tức.
> - Các chân GPIO 34, 35, 36 (VP), 39 (VN) là các chân **Chỉ Có Chiều Nhập (Input Only)**, không có điện trở kéo nội bộ (No internal Pull-up/Pull-down) và không thể cấu hình làm ngõ ra `OUTPUT`.

---
