# Lab 4: Doc 4.6 - IC Chuyển Mạch Multiplexer 74HC4066 & Kỹ Thuật Đa Hóa Cổng UART

![Sơ đồ đa hóa cổng UART2 qua IC 74HC4066](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab4_uart_mux_74hc4066.png)

### 1. Khóa Chuyển Mạch Tương Tự 74HC4066
- **Xung đột Phần cứng khi Dùng chung Cổng UART:**
  - Cả module Camera OV2640 và module GNSS L76X đều có nhu cầu giao tiếp nối tiếp tốc độ cao với vi điều khiển OBC, nhưng số lượng chân UART phần cứng trên vi điều khiển bị giới hạn do phải ưu tiên chân cho kết nối máy tính và module thu phát sóng LoRa.
- **Giải pháp Kỹ thuật bằng IC Chuyển mạch 74HC4066:**
  - Kit tích hợp vi mạch khóa chuyển mạch tương tự 4 kênh độc lập **74HC4066** (Quad Bilateral Switch) đóng vai trò là một bộ dồn kênh (Multiplexer):
    - *Chế độ Định vị (GNSS Mode):* OBC điều khiển chân chọn đóng khóa kênh GPS vào đường UART của OBC. Bộ thu GNSS thu thập chuỗi bản tin NMEA và chốt tọa độ vị trí.
    - *Chế độ Chụp ảnh (Camera Mode):* Sau khi đã chốt xong tọa độ, OBC ngắt kết nối UART của GPS và đóng khóa kênh Camera vào đường UART để nhận luồng byte ảnh JPEG.

---
