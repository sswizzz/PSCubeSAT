# Lab 8: Doc 8.3 - Ba Đề Tài Đồ Án Capstone Mini-Project Chuyên Sâu Thực Chiến

### Đề tài 1: Hệ thống Vệ tinh Viễn thám Giám sát & Cảnh báo Cháy rừng (Wildfire Early Warning)
- **Mục tiêu:** Ứng dụng CubeSat 1U tích hợp Camera OV2640 và cảm biến môi trường để quan sát bề mặt Trái Đất, phát hiện sớm các đám cháy rừng, gắn nhãn tọa độ GPS và truyền cảnh báo khẩn cấp về trạm mặt đất.
- **Kỹ thuật Cốt lõi:**
  - Kích hoạt chụp ảnh tự động theo hàng rào địa lý ảo (**Geofencing Trigger**).
  - Phân tích không gian màu (HSV/YCbCr) hoặc mô hình học máy siêu nhẹ TFLite Micro nhận diện vùng khói lửa.
  - Nén ảnh JPEG, phân mảnh gói tin (**Packet Fragmentation**) và truyền qua kênh vô tuyến LoRa.

### Đề tài 2: Trạm Vệ tinh LEO Thu thập & Chuyển tiếp Dữ liệu Nông nghiệp Thông minh (Smart Agtech Relay)
- **Mục tiêu:** Xây dựng hệ thống vệ tinh chuyển tiếp dữ liệu phi thời gian thực (**Store-and-Forward LEO Gateway**) thu thập thông số vi khí hậu và độ ẩm đất từ các cụm cảm biến IoT nông nghiệp cắm ngoài đồng ruộng hẻo lánh và trút dữ liệu về trung tâm điều hành.
- **Kỹ thuật Cốt lõi:**
  - Cơ chế mời gọi thu thập dữ liệu (Polling Beacon) giúp các nút cảm biến mặt đất ngủ sâu tiết kiệm pin 99% thời gian.
  - Thuật toán đa truy cập ngẫu nhiên ALOHA giải quyết xung đột kênh vô tuyến.
  - Cơ sở dữ liệu nhật ký trên thẻ nhớ MicroSD với cờ trạng thái chuyển tiếp (`isForwarded`) và lệnh trút dữ liệu lớn (`CMD_DUMP_AGTECH_DATA`).

### Đề tài 3: Mạng lưới Vệ tinh Tìm kiếm Cứu nạn Không gian Khẩn cấp (Search and Rescue - SAR)
- **Mục tiêu:** Mô phỏng mạng lưới cứu hộ không gian Cospas-Sarsat: Vệ tinh lắng nghe tín hiệu cầu cứu khẩn cấp từ các phao cứu nạn ngoài biển khơi, giải mã tức thời tọa độ định vị nạn nhân và phát cảnh báo ưu tiên cao nhất về trạm cứu hộ mặt đất.
- **Kỹ thuật Cốt lõi:**
  - Xử lý ưu tiên ngắt trước đối với gói tin có cờ `EMERGENCY_SOS_FLAG`.
  - Cấu hình độ nhạy thu cực đại (LoRa SF12, BW 125kHz) bắt tín hiệu phao cứu sinh yếu ớt từ cự ly hàng trăm kilomet.
  - Hiển thị thông báo báo động đỏ (SOS Red Alert Banner), còi báo động âm thanh và quy hoạch tuyến đường cứu nạn khẩn cấp trên Web Dashboard.

### ❓ Câu Hỏi Đánh Giá Kỹ Năng Thực Hành (Lab 8)
1. **Trong kịch bản thiết kế sứ mệnh tùy biến Capstone, khi dung lượng pin sụt giảm dưới ngưỡng báo động (ví dụ < 15%), phần mềm cần tự động kích hoạt hành động an toàn (Failsafe) nào?**
   - A. Chuyển sang Safe Mode: tắt camera, tắt tải phụ, chỉ phát beacon cấp cứu chu kỳ dài
   - B. Bật toàn bộ đèn LED và camera chụp ảnh liên tục
   - C. Tự động xóa sạch toàn bộ mã nguồn chương trình trong Flash
   - D. Tăng tần số xung nhịp CPU lên mức tối đa

2. **Quy trình nghiệm thu và bảo vệ đồ án Capstone trên hệ thống CubeSat-LMS bao gồm những nội dung chính nào?**
   - A. Chỉ nộp bản vẽ 3D mà không cần chạy code thực tế
   - B. Thi công lắp ráp tên lửa đẩy mô hình tại phòng lab
   - C. Trình diễn hoạt động firmware tích hợp, truyền nhận viễn trắc lên Dashboard và báo cáo kỹ thuật
   - D. Chờ vệ tinh thật trên quỹ đạo gửi tín hiệu về máy bay
