# Lab 7: Doc 7.2 - Kiến Trúc Phân Lớp Phần Mềm Bay (FSW) & Máy Trạng Thái Hữu Hạn (Mission FSM)

### 1. Kiến trúc Phân tầng Phần mềm Bay (FSW Layered Architecture)
Để hệ thống phần mềm có tính module hóa cao, dễ kiểm thử và độc lập phần cứng, phần mềm bay được tổ chức theo 5 tầng phân cấp:
1. **Tầng Trừu tượng Phần cứng (HAL - Hardware Abstraction Layer):** Cung cấp các hàm API truy cập thanh ghi chân GPIO, ADC, PWM, UART, I2C, SPI.
2. **Tầng Trình điều khiển Thiết bị (Device Drivers):** Các lớp driver điều khiển trực tiếp từng IC cụ thể (Driver BMP280, Driver MPU6500, Driver MAX17048, Driver LoRa E32, Driver MicroSD).
3. **Tầng Hệ điều hành Thời gian thực (OS / Kernel Layer):** FreeRTOS quản lý bộ điều phối tác vụ (Scheduler), hàng đợi tin nhắn (Queue), bộ đếm thời gian (Software Timers) và khóa bảo vệ (Mutex).
4. **Tầng Dịch vụ Hệ thống (System Services):** Phân tích cú pháp viễn lệnh (Command Parser), Quản lý đóng khung bản tin (Telemetry Service), Ghi nhật ký thẻ nhớ (Storage Service), Giám sát hệ thống (Watchdog Manager).
5. **Tầng Ứng dụng & Điều khiển Sứ mệnh (Mission Application Layer):** Máy trạng thái hữu hạn (Mission FSM) ra quyết định chuyển đổi chế độ hoạt động của toàn bộ vệ tinh.

### 2. Máy Trạng Thái Hữu Hạn Điều Khiển Sứ Mệnh (Mission FSM)
Phần mềm bay được điều hành bởi một Máy Trạng Thái Hữu Hạn (**Finite State Machine - FSM**) chuẩn mực:

![Máy trạng thái nhiệm vụ bay CubeSat FSM](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab7_mission_fsm.png)

### 3. Chi tiết 6 Trạng thái Bay Cốt lõi
- **`STATE_BOOT`:**
  - Khởi động hệ thống, kiểm tra ngoại vi, khôi phục tham số từ NVS.
  - Đếm ngược thời gian **30 phút im lặng vô tuyến (30-Minute Radio Silence)** theo luật quốc tế của Liên minh Viễn thông Quốc tế (ITU) trước khi được phép bung ăng-ten và phát sóng RF đầu tiên.
- **`STATE_DETUMBLE`:**
  - Giảm tốc độ xoay hỗn loạn sinh ra khi rời ống phóng xuống dưới 5°/s bằng thuật toán điều khiển từ tính B-dot và thanh giảm chấn trễ từ.
- **`STATE_NORMAL_OPS`:**
  - Vận hành quỹ đạo tiêu chuẩn: Định kỳ thu thập dữ liệu cảm biến (10Hz), ghi nhật ký thẻ nhớ SD (1Hz), phát gói tin Beacon (mỗi 30-60s) và lắng nghe lệnh viễn lệnh từ trạm mặt đất.
- **`STATE_PAYLOAD_EXEC`:**
  - Kích hoạt tải trọng camera chụp ảnh viễn thám Trái Đất, nén JPEG và phân mảnh tệp dữ liệu. Chỉ cho phép kích hoạt khi dung lượng pin $\text{SOC} > 60\%$ và nhiệt độ nằm trong dải an toàn.
- **`STATE_POWER_SAVE`:**
  - Khi pin yếu ($V_\text{bat} < 3.55\text{V}$, $\text{SOC} < 25\%$), hệ thống tự động sa thải phụ tải (Load Shedding): Tắt camera, tắt GPS, giãn chu kỳ phát Beacon lên 120 giây, giảm xung nhịp CPU xuống 80 MHz.
- **`STATE_SAFE_MODE`:**
  - Chế độ phòng thủ sống còn khi xảy ra sự cố nghiêm trọng (pin chạm đáy $< 3.4\text{V}$ hoặc cảm biến báo lỗi liên tục), chỉ duy trì nguồn tối thiểu cho bộ thu lệnh vô tuyến để chờ lệnh giải cứu từ mặt đất.

---

### ❓ Câu Hỏi Củng Cố Kiến Thức (Doc 7.2)
1. **Quy định an toàn quốc tế yêu cầu trạng thái khởi động (`STATE_BOOT`) của phần mềm bay phải duy trì thời gian trễ im lặng bao lâu sau khi rời ống phóng?**
   - A. Trễ chính xác 1 giây rồi phát sóng ngay
   - B. Phát sóng liên tục ngay khi công tắc RBF nhả
   - C. Chờ 24 giờ liên tục không thực hiện lệnh nào
   - D. Trễ im lặng tối thiểu 30 đến 45 phút trước khi kích hoạt thu phát RF

2. **Máy trạng thái hữu hạn (Mission FSM) của phần mềm bay chuyển từ trạng thái `DETUMBLE` sang `MISSION` khi nào?**
   - A. Khi dung lượng pin sụt giảm dưới 20%
   - B. Khi vận tốc góc quay của vệ tinh trên các trục giảm xuống dưới ngưỡng an toàn
   - C. Khi có tín hiệu ngắt nguồn khẩn cấp từ trạm mặt đất
   - D. Khi thẻ nhớ MicroSD đã ghi đầy một nửa dung lượng

---
