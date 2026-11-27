# Lab 3: Doc 3.1 - Giao thức Giao tiếp SPI Tốc độ cao & Kiến trúc Hệ thống Tập tin FAT32 trên Thẻ MicroSD

### 1. Vai trò của Phân hệ C&DH và Hệ thống Hộp Đen (Black Box Storage)
Phân hệ Xử lý Dữ liệu và Lệnh (**Command and Data Handling - C&DH**) là xương sống luân chuyển thông tin của vệ tinh CubeSat. Trong một vòng quỹ đạo kéo dài 95 phút, vệ tinh chỉ có khoảng thời gian kết nối với trạm mặt đất từ 8 đến 12 phút (Ground Pass). Trong suốt hơn 80 phút còn lại, vệ tinh hoàn toàn cô độc ngoài vùng phủ sóng. Phân hệ C&DH phải đảm đương:
- **Lưu trữ dữ liệu viễn trắc liên tục:** Ghi lại toàn bộ hành trình điện áp, dòng điện, nhiệt độ, tư thế quán tính và tọa độ vào thẻ nhớ MicroSD.
- **Lưu trữ tệp dữ liệu sứ mệnh:** Lưu giữ các tệp ảnh chụp Trái Đất và số liệu quan trắc khoa học để sẵn sàng trút dữ liệu (Data Dump) khi bay qua trạm mặt đất.
- **Nhật ký sự kiện (Flight Event Log):** Ghi lại chi tiết thời điểm xuất hiện các cảnh báo bất thường, lỗi vi xử lý, và các lần phục hồi hệ thống.

![Sơ đồ kết nối bus SPI Full-Duplex](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab3_spi_connection.png)

### 2. Giao thức Truyền thông Đồng bộ SPI (Serial Peripheral Interface)
Chuẩn giao tiếp **SPI** là một bus truyền thông nối tiếp đồng bộ 4 dây, hoạt động theo mô hình Master-Slave ở chế độ song công toàn phần (Full-duplex):
- **4 Đường tín hiệu Vật lý:**
  - **SCLK / SCK (Serial Clock):** Do Master tạo ra để đồng bộ hóa việc dịch từng bit dữ liệu. Tần số xung nhịp có thể lên tới 20 MHz - 40 MHz, mang lại tốc độ truyền dữ liệu vượt trội so với I2C.
  - **MOSI (Master Out Slave In):** Đường dữ liệu từ vi điều khiển Master gửi sang thiết bị Slave.
  - **MISO (Master In Slave Out):** Đường dữ liệu từ thiết bị Slave trả về Master.
  - **CS / SS (Chip Select / Slave Select):** Đường tín hiệu chọn chip tích cực ở mức logic `LOW`. Mỗi thiết bị Slave trên cùng đường bus cần một chân CS riêng biệt.
- **4 Chế độ Hoạt động SPI (SPI Modes 0, 1, 2, 3):**
  Xác định bởi hai thông số cấu hình: Cực tính xung nhịp (**CPOL - Clock Polarity**) và Pha xung nhịp (**CPHA - Clock Phase**):
  - **Mode 0 (CPOL=0, CPHA=0):** Xung nhịp ở mức `LOW` khi rảnh rỗi. Dữ liệu được lấy mẫu (Sample) ở cạnh lên đầu tiên và dịch chuyển (Shift) ở cạnh xuống tiếp theo. Thẻ nhớ MicroSD tiêu chuẩn vận hành ở chế độ này.
  - **Mode 1 (CPOL=0, CPHA=1):** Xung nhịp rảnh ở mức `LOW`. Dữ liệu được dịch chuyển ở cạnh lên và lấy mẫu ở cạnh xuống.
  - **Mode 2 (CPOL=1, CPHA=0):** Xung nhịp rảnh ở mức `HIGH`. Dữ liệu được lấy mẫu ở cạnh xuống và dịch chuyển ở cạnh lên.
  - **Mode 3 (CPOL=1, CPHA=1):** Xung nhịp rảnh ở mức `HIGH`. Dữ liệu được dịch chuyển ở cạnh xuống và lấy mẫu ở cạnh lên.

### 3. Cấu trúc Vật lý Thẻ Nhớ & Hệ thống Tập tin FAT32
- **Tổ chức Vật lý Thẻ Nhớ:** Bộ nhớ Flash NAND của thẻ nhớ MicroSD không thể ghi từng byte đơn lẻ mà được phân chia thành các cung từ vật lý (**Sectors**) có kích thước cố định là $512\text{ bytes}$. Thư viện phần mềm gom nhiều Sector thành một khối cấp phát dữ liệu (**Cluster**).
- **Cơ chế Đệm Dữ liệu RAM (RAM Buffer Cache):** Khi chương trình thực hiện lệnh `file.print()` hoặc `file.write()`, các byte dữ liệu thực chất chỉ mới được ghi tạm vào mảng đệm nội bộ $512\text{ bytes}$ trên bộ nhớ RAM của ESP32. Chỉ khi mảng đệm này đầy đủ 512 bytes, phần cứng mới phát lệnh SPI đẩy toàn bộ Sector xuống thẻ nhớ.
- **Tầm quan trọng Cốt tử của hàm `file.flush()` và `file.close()`:**
  - Nếu vệ tinh bất ngờ bị sụt áp (Brownout) hoặc bị reset bởi Watchdog Timer trong khi mảng đệm RAM chưa đầy 512 bytes, toàn bộ số liệu đo đạc gần nhất sẽ biến mất hoàn toàn!
  - Thậm chí nghiêm trọng hơn: Bảng phân bổ tệp (**File Allocation Table - FAT**) chưa kịp cập nhật kích thước tệp mới sẽ khiến tệp tin bị hỏng (File Corruption) và không thể đọc lại.
  - **Quy tắc Bắt buộc:** Sau mỗi chu kỳ ghi dữ liệu định kỳ, phần mềm bay bắt buộc phải gọi hàm `file.flush()` để ép buộc vi điều khiển xả sạch bộ đệm RAM xuống ô nhớ vật lý của thẻ nhớ ngay lập tức.

---

### ❓ Câu Hỏi Củng Cố Kiến Thức (Doc 3.1)
1. **Bus giao tiếp SPI 4 dây chuẩn kết nối thẻ nhớ MicroSD trên kit OBC bao gồm các chân tín hiệu nào?**
   - A. SDA, SCL, INT, RST
   - B. TX, RX, CTS, RTS
   - C. CS, SCK, MISO, MOSI
   - D. D0, D1, D2, CLK

2. **Khi ghi dữ liệu viễn trắc vào thẻ MicroSD, tại sao sau khi gọi `dataFile.println()` bắt buộc phải gọi `dataFile.flush()`?**
   - A. Để đẩy dữ liệu từ đệm RAM xuống thẻ nhớ vật lý ngay lập tức
   - B. Để xóa sạch toàn bộ nội dung vừa ghi
   - C. Để đóng tệp tin và giải phóng con trỏ bộ nhớ
   - D. Để chuyển đổi định dạng tệp tin từ nhị phân sang văn bản

---
