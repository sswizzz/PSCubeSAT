# Lab 3: Doc 3.2 - Kiến trúc Hệ thống Lệnh Shell CLI & Tổng quan Hệ Điều Hành trong Vệ Tinh

### 1. Kiến trúc Giao diện Dòng lệnh Shell CLI (Command Line Interface)
Để phục vụ việc kiểm thử, vận hành và trút dữ liệu từ trạm mặt đất, phân hệ C&DH cài đặt một bộ phân tích cú pháp dòng lệnh tương tự hệ điều hành Linux thông qua cổng nối tiếp UART (`PTIT_Storage::handleCommand`):
- **`pwd`:** In đường dẫn thư mục làm việc hiện tại (ví dụ: `/`, `/photos`, `/hieu`).
- **`cd <path>`:** Đổi thư mục làm việc hiện tại (hỗ trợ thư mục cha `..`, thư mục gốc `/`, thư mục home `~`, đường dẫn tương đối và tuyệt đối).
- **`ls [path]`:** Duyệt cây thư mục trên thẻ MicroSD, phân loại `DIR:` và `FILE:` kèm dung lượng byte.
- **`cat <path>`:** Mở tệp tin nhật ký văn bản và in toàn bộ nội dung ra màn hình.
- **`touch <path>`:** Tạo một tệp tin mới rỗng nếu tệp chưa tồn tại.
- **`echo <text> [> | >> <file>]`:** In chuỗi văn bản hoặc chuyển hướng ghi đè (`>`) / ghi nối tiếp (`>>`) vào tệp tin.
- **`mkdir <path>`:** Tạo thư mục mới trên thẻ nhớ.
- **`rmdir <path>`:** Xóa thư mục rỗng (bảo vệ không xóa thư mục gốc `/`).
- **`rm <path>`:** Xóa bỏ tệp tin dữ liệu cũ trên thẻ nhớ (từ chối xóa nếu đường dẫn là thư mục).
- **`df` (Disk Free):** Tính toán và in ra tổng dung lượng thẻ nhớ, dung lượng đã sử dụng và dung lượng còn trống (MB).
- **`help`:** Hiển thị danh sách các lệnh được hệ thống hỗ trợ.

**Nguyên lý Thiết kế Chuẩn Unix Shell:**
- **Silent Success (Thành công Im lặng):** Các lệnh điều hướng và thay đổi trạng thái (`cd`, `mkdir`, `rmdir`, `rm`, `touch`, `echo >`) khi thực thi thành công sẽ hoàn toàn im lặng, không trả về các tiền tố `OK:` rườm rà. Chỉ lệnh có dữ liệu xuất ra (`pwd`, `ls`, `cat`, `df`, `help`) hoặc khi xảy ra lỗi (`ERR: ...`) mới in thông tin ra màn hình.
- **An toàn Hạt nhân VFS ESP-IDF:** Trước khi truy xuất tệp/thư mục, hệ thống sử dụng hàm `SD.exists()` để kiểm tra sự tồn tại (sử dụng hàm gọi hệ thống `stat()`), tuyệt đối không gọi `SD.open()` khi tệp chưa chắc chắn tồn tại nhằm triệt tiêu hoàn toàn các thông báo lỗi kernel VFS `[E][vfs_api.cpp:105] open(): ... does not exist`.

![Kiến trúc Shell CLI và bộ điều phối FreeRTOS](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab3_cli_rtos_overview.png)

### 2. Tổng quan Hệ Điều Hành: Tuần Tự (Super-Loop) vs Đa Nhiệm Thời Gian Thực (RTOS)
Trong các dự án nhúng đơn giản, kỹ sư thường sử dụng kiến trúc vòng lặp tuần tự (Bare-metal Super-Loop). Tuy nhiên, trên một vệ tinh không gian hiện đại, khối lượng công việc đòi hỏi phải chuyển sang sử dụng Hệ điều hành Thời gian thực (**Real-Time Operating System - RTOS**):

| Tiêu chí So sánh | Vòng lặp Tuần tự (Super-Loop) | Hệ điều hành Thời gian thực (FreeRTOS) |
| :--- | :--- | :--- |
| **Cơ chế Thực thi** | Thực hiện tuần tự từng hàm trong `loop()`, hết việc này đến việc khác | Đa nhiệm giả lập (Multitasking) phân chia thời gian CPU cho nhiều tác vụ độc lập |
| **Đáp ứng Sự kiện Khẩn cấp** | Chậm chạp, phụ thuộc vào thời gian hoàn thành của các hàm trước đó | Tức thời, tác vụ ưu tiên cao có quyền ngắt ngang (Preempt) tác vụ ưu tiên thấp |
| **Quản lý Bộ nhớ** | Toàn bộ chương trình dùng chung một ngăn xếp Stack duy nhất | Mỗi tác vụ (Task) được cấp phát một vùng ngăn xếp bộ nhớ riêng biệt |
| **Độ phức tạp Thiết kế** | Dễ viết nhưng khó bảo trì và mở rộng quy mô khi hệ thống lớn | Phức tạp hơn, đòi hỏi cơ chế đồng bộ hóa an toàn (Mutex, Queue, Semaphore) |

### 3. Cấu trúc Tác vụ (Task) & Bộ Điều phối Chiếm trước (Preemptive Scheduler)
- **Tác vụ (Task):** Mỗi chức năng độc lập của vệ tinh được đóng gói thành một luồng thực thi vô tận (ví dụ: `TaskTelemetry`, `TaskSensors`, `TaskCommand`, `TaskStorage`).
- **Mức Ưu tiên (Priority):** Mỗi tác vụ được gán một con số ưu tiên (từ 0 đến $N-1$). Con số càng lớn, độ ưu tiên càng cao.
- **Bộ điều phối Chiếm trước (Preemptive Scheduler):** Cứ sau mỗi chu kỳ nhịp tích tắc hệ thống (System Tick, thường là $1\text{ ms}$), bộ điều phối kiểm tra danh sách các tác vụ sẵn sàng. Tác vụ nào có mức ưu tiên cao nhất sẽ giành quyền sở hữu CPU ngay lập tức.

---

### ❓ Câu Hỏi Củng Cố Kiến Thức (Doc 3.2)
1. **Bộ phân tích cú pháp dòng lệnh Shell CLI trên vệ tinh đóng vai trò then chốt nào trong quản trị hệ thống?**
   - A. Thay thế hoàn toàn hệ điều hành thời gian thực
   - B. Tăng tốc độ ghi dữ liệu nhị phân lên thẻ MicroSD
   - C. Tự động điều chỉnh góc quay hướng tấm pin mặt trời
   - D. Cung cấp giao diện tương tác thực thi lệnh chẩn đoán và quản lý tệp tin

2. **Kiến trúc phần mềm bay Command-Centric Architecture (C2A) vận hành theo nguyên lý nào?**
   - A. Mọi cảm biến đều tự ghi thẳng vào thẻ nhớ không qua CPU
   - B. Toàn bộ tiến trình và hành vi của vệ tinh đều quy về xử lý lệnh
   - C. Chỉ duy nhất một tác vụ chạy liên tục từ lúc phóng
   - D. Cấm sửa đổi cấu hình logic sau khi phóng lên quỹ đạo

---
