# Lab 5: Doc 5.2 - Giao Thức Đóng Gói Bản Tin, Kiểm Tra CRC-16 & Tổng Quan Chuẩn CCSDS

### 1. Cấu trúc Khung Bản Tin Viễn Trắc (Telemetry Frame Structure)
Để đảm bảo dữ liệu truyền qua không gian không bị xáo trộn, luồng byte được đóng gói thành các cấu trúc khung truyền tin tiêu chuẩn:

| Trường Dữ liệu | Độ dài | Chức năng & Ý nghĩa Kỹ thuật |
| :--- | :--- | :--- |
| **Preamble** | 4 Bytes | Chuỗi byte xen kẽ `0xAA 0xAA 0xAA 0xAA` giúp bộ thu khóa mạch đồng bộ xung bit |
| **Sync Word** | 2 Bytes | Mã đồng bộ khung cố định `0xD3 0x91` đánh dấu điểm bắt đầu gói tin hợp lệ |
| **Packet Length** | 1 Byte | Độ dài tổng số byte của phần thân gói tin Payload ($N$) |
| **Satellite ID** | 1 Byte | Mã định danh duy nhất của vệ tinh trên quỹ đạo (ví dụ `0x42`) |
| **Packet Sequence**| 2 Bytes | Số thứ tự gói tin tự tăng ($0 - 65535$), giúp trạm mặt đất phát hiện gói tin bị rơi rụng |
| **Telemetry Data** | $N - 5$ Bytes | Khối dữ liệu cảm biến: $V_\text{bat}$, SOC, Nhiệt độ, Áp suất, Gia tốc, Tọa độ GPS |
| **Checksum CRC-16**| 2 Bytes | Mã kiểm tra lỗi chu kỳ 16-bit bảo vệ tính toàn vẹn dữ liệu |

![Cấu trúc khung bản tin viễn trắc và mã kiểm tra CRC-16](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab5_telemetry_frame_crc.png)

### 2. Thuật toán Kiểm tra Lỗi Chu kỳ CRC-16-CCITT
Trong không gian, nhiễu nền vũ trụ có thể làm biến dạng ngẫu nhiên một vài bit dữ liệu. Phương pháp tính tổng cộng (Checksum đơn giản) rất dễ bị lọt lưới khi hai lỗi bit triệt tiêu nhau.
- **Thuật toán CRC-16-CCITT:** Sử dụng đa thức sinh chuẩn quốc tế:

$$G(x) = x^{16} + x^{12} + x^5 + 1 \quad (\text{Hex: } \mathbf{0x1021})$$

  Giá trị khởi tạo thanh ghi: `0xFFFF`.
- Khi trạm mặt đất nhận được gói tin, nó thực hiện tính toán lại mã CRC trên toàn bộ chuỗi byte nhận được. Nếu mã CRC tính toán trùng khớp hoàn toàn với 2 byte CRC đính kèm ở cuối gói tin, gói tin được xác nhận là vẹn toàn 100%. Nếu sai khác dù chỉ một bit, gói tin bị loại bỏ ngay lập tức.

### 3. Giao thức Kiểm soát Luồng & Phân mảnh Gói tin
- **Cơ chế Dừng và Chờ (Stop-and-Wait ARQ - Automatic Repeat reQuest):**
  - Trạm mặt đất gửi một lệnh viễn lệnh → Vệ tinh tiếp nhận, kiểm tra CRC → Nếu hợp lệ, vệ tinh phát bản tin phản hồi `ACK` (Acknowledge) → Trạm mặt đất nhận `ACK` mới tiếp tục gửi lệnh tiếp theo. Nếu hết thời gian chờ (Time-out) mà chưa nhận được `ACK`, trạm phát lại gói tin tối đa 3 lần.
- **Kỹ thuật Phân mảnh Tệp ảnh (Packet Fragmentation):**
  - Một bức ảnh JPEG có dung lượng $30\text{ KB}$ không thể phát trong một gói tin duy nhất vì xác suất xảy ra lỗi trên gói tin lớn là rất cao.
  - Tệp ảnh được cắt nhỏ thành hàng trăm mảnh nhỏ (**Chunks**), mỗi mảnh có kích thước $64\text{ bytes}$.
  - Mỗi mảnh được gắn thêm tiêu đề: `[Image_ID, Chunk_Index, Total_Chunks]`. Trạm mặt đất đón nhận từng mảnh và ráp lại thành bức ảnh hoàn chỉnh. Nếu thiếu mảnh nào, trạm chỉ cần yêu cầu phát lại đúng mảnh đó.

### 4. Tổng quan Chuẩn Hàng không Vũ trụ CCSDS & Giao thức Nghiệp dư AX.25
- **AX.25:** Giao thức truyền dữ liệu gói kinh điển của giới vô tuyến nghiệp dư (Amateur Radio), sử dụng trường địa chỉ gọi hiệu (Callsign) định danh trạm phát và trạm thu. Được áp dụng rộng rãi trên các CubeSat thế hệ đầu.
- **CCSDS (Consultative Committee for Space Data Systems):** Tiêu chuẩn truyền thông dữ liệu không gian tối cao được liên minh NASA, ESA, JAXA ban hành. Quy định chặt chẽ các tầng giao thức từ lớp vật lý (RF & Modulation), lớp liên kết truyền dữ liệu (AOS Space Data Link Protocol) cho tới mã hóa sửa lỗi tiến tiên tiến (LDPC, Turbo Codes).

---

### ❓ Câu Hỏi Củng Cố Kiến Thức (Doc 5.2)
1. **Mã kiểm tra lỗi dư thừa chu kỳ CRC-16-CCITT được đính kèm vào cuối gói tin viễn trắc nhằm mục đích kỹ thuật gì?**
   - A. Mã hóa bảo mật chống nghe lén thông tin
   - B. Định vị tọa độ của vệ tinh trong không gian
   - C. Tự động nén kích thước gói dữ liệu xuống một nửa
   - D. Phát hiện các bit dữ liệu bị sai lệch do nhiễu đường truyền không dây

2. **Cấu trúc một khung tin viễn thông không gian tiêu chuẩn (CCSDS Frame) bao gồm 3 phần chính nào?**
   - A. Bootloader, Firmware, Memory Dump
   - B. Header (Tiêu đề), Payload (Dữ liệu tải), Trailer (Mã kiểm tra)
   - C. IP Address, Port Number, Gateway
   - D. Preamble, Sync Word, Frequency

---
