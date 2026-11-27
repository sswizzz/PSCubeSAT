# Lab 6: Doc 6.2 - Vật Liệu Hợp Kim Không Gian & Xử Lý Bề Mặt Chuyên Dụng

### 1. Lựa chọn Hợp kim Nhôm Hàng không Al 6061-T6 và Al 7075-T6
Vật liệu sử dụng cho khung CubeSat phải đáp ứng đồng thời 4 tiêu chí khắt khe: Tỷ số độ bền trên khối lượng cao, tính dẫn nhiệt tốt, khả năng gia công cắt gọt CNC chính xác và không có từ tính:
- **Nhôm Hợp kim Al 6061-T6:**
  - Thành phần hợp kim chính: Nhôm, Magie (1.0%) và Silic (0.6%).
  - Trạng thái nhiệt luyện `-T6`: Được tôi dung dịch và hóa già nhân tạo (Artificially Aged) để tạo mạng kết tủa pha liên kim phân tán mịn.
  - Giới hạn chảy (Yield Strength): 276 MPa; Giới hạn bền kéo (Tensile Strength): 310 MPa.
  - Đặc tính: Dễ gia công phay CNC, hàn được, chống ăn mòn xuất sắc trong môi trường biển, là vật liệu kinh điển chiếm hơn 80% khối lượng khung CubeSat.
- **Nhôm Hợp kim Al 7075-T6:**
  - Thành phần hợp kim chính: Nhôm và Kẽm (5.6%).
  - Giới hạn chảy: 503 MPa; Giới hạn bền kéo: 572 MPa (tương đương với một số loại thép kết cấu nhưng nhẹ hơn thép gần 3 lần).
  - Ứng dụng: Dành riêng cho 4 thanh ray dẫn hướng góc hoặc các chi tiết chịu lực cắt và tải trọng va đập lớn nhất.

### 2. Quy trình Xử lý Bề mặt Chọn lọc: Anodize Cứng Type III vs Lớp Phủ Alodine
Khung nhôm CubeSat bắt buộc phải trải qua quy trình xử lý bề mặt chọn lọc hai giai đoạn (Selective Masking) theo tiêu chuẩn quân sự Hoa Kỳ:

![Quy trình xử lý bề mặt Anodize và Alodine](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab6_surface_treatment.png)

1. **Anodize Hóa Cứng Type III (Hard Anodizing - Tiêu chuẩn MIL-A-8625):**
   - Áp dụng trên: **4 thanh ray dẫn hướng ở 4 góc** tiếp xúc trực tiếp với lòng ống phóng P-POD.
   - Nguyên lý: Điện phân trong dung dịch axit sulfuric ở nhiệt độ thấp (0°C), tạo ra lớp màng gốm nhôm oxit Al₂O₃ dày 25 - 50 µm ăn sâu vào bề mặt kim loại.
   - Đặc tính: Độ cứng bề mặt cực cao (60 - 70 HRC, cứng như đá sapphire), chống cào xước cơ học khi trượt trong ống phóng và **cách điện tuyệt đối**, triệt tiêu hoàn toàn nguy cơ **Hàn nguội (Cold Welding)** giữa thanh ray vệ tinh và lòng ống phóng trong môi trường chân không nhiệt.
2. **Lớp Phủ Chuyển Đổi Hóa Học Alodine (Chromate Conversion Coating - Tiêu chuẩn MIL-DTL-5541 Class 3):**
   - Áp dụng trên: **Toàn bộ lòng trong của khung và các bề mặt lắp ghép bo mạch**.
   - Nguyên lý: Nhúng trong dung dịch muối cromat tạo màng thụ động hóa cực mỏng (< 1 µm).
   - Đặc tính cốt lõi: Khác với Anodize là chất cách điện, **lớp phủ Alodine Class 3 vẫn duy trì tính dẫn điện tiếp xúc tuyệt hảo**. Cho phép bu lông và các cọc tiếp địa nối thông điện các tấm khung về mass chung của hệ thống với điện trở tiếp xúc < 0.1 Ω.

### 3. Tiêu chuẩn Quốc tế Thoát Khí Chân Không ASTM E595
Trong môi trường chân không sâu (< 10⁻⁵ Torr) và nhiệt độ cao, các vật liệu polyme hữu cơ (keo dán, băng dính, lớp phủ dây điện) bị bốc hơi giải phóng các phân tử khí (hiện tượng Outgassing). Tiêu chuẩn **ASTM E595** của NASA/ESA quy định 2 chỉ số kiểm định nghiêm ngặt:
- **TML (Total Mass Loss - Tổng Khối Lượng Hao Hụt):** Phải ≤ 1.0% sau 24 giờ sấy nhiệt ở 125°C trong buồng chân không.
- **CVCM (Collected Volatile Condensable Material - Vật Chất Bay Hơi Ngưng Tụ):** Phải ≤ 0.10% khi ngưng tụ lên một tấm gương lạnh ở 25°C. Chỉ số này bảo vệ các thấu kính quang học của Camera và bề mặt pin mặt trời không bị màng dầu polyme bám đục làm hỏng sứ mệnh.

---

### ❓ Câu Hỏi Củng Cố Kiến Thức (Doc 6.2)
1. **Tại sao 4 thanh ray trượt (Rails) của CubeSat bắt buộc phải được xử lý bề mặt bằng công nghệ Anodized cứng (Hard Anodize Type III)?**
   - A. Để khung có màu sắc thẩm mỹ bắt mắt
   - B. Để giảm trọng lượng của vật liệu nhôm xuống
   - C. Để tăng tính dẫn điện giữa vệ tinh và tên lửa
   - D. Ngăn chặn hiện tượng hàn nguội (Cold Welding) và ma sát kẹt trong ống phóng

2. **Vật liệu hợp kim nhôm nào sau đây thường được ưu tiên lựa chọn để gia công khung cấu trúc vệ tinh nhỏ?**
   - A. Nhôm tạp chất tái chế thông thường
   - B. Hợp kim nhôm hàng không Al 6061-T6 hoặc Al 7075
   - C. Gang đúc xám công nghiệp
   - D. Thép carbon cường độ thấp

---
