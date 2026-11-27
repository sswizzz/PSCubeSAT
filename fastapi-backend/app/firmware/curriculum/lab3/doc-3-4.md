# Lab 3: Doc 3.4 - Bộ Định Thời Giám Sát Phần Cứng Watchdog Timer (WDT) & Kiến Trúc Tự Phục Hồi FDIR

### 1. Nguyên lý Hoạt động của Bộ định thời Watchdog Timer Watchdog (WDT)
Trong môi trường bức xạ quỹ đạo LEO, các hạt ion mang điện tích năng lượng cao có thể gây hiện tượng lật bit dữ liệu ngẫu nhiên (Single Event Upset - SEU), làm con trỏ chương trình (Program Counter) nhảy vào vùng nhớ rác khiến vi điều khiển bị treo cứng hoàn toàn:
- **Watchdog Timer (WDT)** là một mạch đếm lùi phần cứng độc lập với CPU, hoạt động nhờ nguồn xung nhịp xung nội riêng biệt.
- Khi khởi tạo, WDT được nạp một khoảng thời gian giới hạn (ví dụ: $5000\text{ ms}$). Mạch đếm liên tục giảm giá trị về $0$.
- Trong điều kiện hoạt động bình thường, phần mềm bay định kỳ thực hiện thao tác **Làm tươi Watchdog Timer (Feed Watchdog / Reset WDT)** để nạp lại giá trị ban đầu cho bộ đếm.
- Nếu phần mềm bị treo hoặc rơi vào vòng lặp vô tận, thao tác làm tươi Watchdog Timer không được thực hiện. Bộ đếm chạm mức $0$, ngay lập tức kéo chân Reset phần cứng của vi điều khiển xuống mức thấp, ép buộc toàn bộ hệ thống khởi động lại sạch sẽ.

![Máy trạng thái bộ định thời Watchdog Timer](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab3_watchdog_fsm.png)

### 2. Hai Phân cấp Watchdog Timer trong ESP32
1. **Hardware Interrupt Watchdog (IWDT):** Giám sát ở cấp độ vi xử lý phần cứng cấp thấp. Nếu một ngắt (Interrupt Handler) chạy quá lâu hoặc CPU bị khóa hoàn toàn, IWDT kích hoạt.
2. **Task Watchdog Timer (TWDT):** Giám sát ở cấp độ hệ điều hành FreeRTOS. Từng tác vụ riêng lẻ phải đăng ký với TWDT (`esp_task_wdt_add(NULL)`). Nếu bất kỳ tác vụ quan trọng nào bị kẹt và không gọi hàm `esp_task_wdt_reset()` trong khoảng thời gian cấu hình, TWDT sẽ in báo cáo lỗi ngăn xếp và reset hệ thống.

---

### ❓ Câu Hỏi Củng Cố Kiến Thức (Doc 3.4)
1. **Bộ định thời giám sát Task Watchdog Timer (TWDT) trên ESP32 sẽ tự động thực hiện hành động gì nếu một tác vụ bị treo?**
   - A. Tự động ngắt kết nối WiFi và Bluetooth
   - B. Kích hoạt Reset phần cứng toàn bộ vi điều khiển
   - C. Xóa sạch dữ liệu trên thẻ nhớ ngoài
   - D. Chuyển vi điều khiển về chế độ nạp Bootloader

2. **Quy trình FDIR (Fault Detection, Isolation, and Recovery) trong thiết kế phần mềm vệ tinh là:**
   - A. Quy trình kiểm tra lỗi cơ học trước khi phóng
   - B. Thuật toán định vị quỹ đạo vệ tinh dựa trên GNSS
   - C. Giao thức nén ảnh viễn thám không gian
   - D. Cơ chế tự động phát hiện, cô lập lỗi và tái khởi động phục hồi hệ thống

---

## 💻 Hướng Dẫn Thực Hành: Xây Dựng Hệ Thống Lưu Trữ Dữ Liệu & Thao Tác Thẻ Nhớ

### 1. Kỹ thuật Đọc/Ghi Thẻ Nhớ An Toàn với `flush()`
Đoạn mã C++ minh họa chu trình ghi dữ liệu cảm biến kèm đóng dấu thời gian và xả bộ đệm RAM an toàn:

```cpp
#include <SPI.h>
#include <SD.h>

#define SD_CS_PIN 13

void logTelemetryData(float vbat, float temp, float pressure) {
    File dataFile = SD.open("/telemetry.csv", FILE_APPEND);
    if (dataFile) {
        dataFile.printf("%lu,%.2f,%.2f,%.2f\n", millis(), vbat, temp, pressure);
        // Ép buộc ghi dữ liệu từ bộ đệm RAM 512-byte xuống bộ nhớ Flash vật lý
        dataFile.flush();
        dataFile.close();
    } else {
        Serial.println("Loi: Khong the mo tep telemetry.csv de ghi!");
    }
}
```

### 2. Danh mục Bài Thực hành Lab 3
- `Lab3-01a_MicroSD_SPI`: Thực hành khởi tạo bus SPI phần cứng ở tốc độ cao, nhận diện thẻ nhớ MicroSD và đọc thông tin dung lượng.
- `Lab3-01b_MicroSD_Library`: Ghi log dữ liệu tự động định dạng CSV thông qua đối tượng thư viện `PTIT_Storage` (`storage.init()`).
- `Lab3-02_Linux_FS_Commands`: Lập trình bộ phân tích cú pháp dòng lệnh CLI nhận 11 lệnh Linux chuẩn (`pwd`, `cd`, `ls`, `cat`, `touch`, `echo`, `mkdir`, `rmdir`, `rm`, `df`, `help`) tuân thủ nguyên tắc Silent Success, không in tiền tố `OK:` rườm rà.
- `Lab3-03_Multitasking_Scheduler`: Thiết lập 3 tác vụ FreeRTOS chạy song song (Nháy LED nhịp tim chỉ thị, Sinh dữ liệu viễn trắc giả lập có Mutex bảo vệ, Tự chẩn đoán bộ nhớ Heap và xung nhịp CPU) được đồng bộ an toàn qua `PTIT_Scheduler`.
- `Lab3-04_Watchdog_Timer`: Kích hoạt Task Watchdog Timer (TWDT), nạp lại định kỳ, mô phỏng lỗi treo vi xử lý qua Nút nhấn phần cứng hoặc chuỗi lệnh Serial (`fault`/`freeze`), ghi nhận nguyên nhân khởi động lại bằng `esp_reset_reason()`.
- `Lab3-05_Event_Driven_Queue`: Xây dựng kiến trúc hướng sự kiện (Event-Driven) với hàng đợi FreeRTOS Queue không khóa, tiếp nhận sự kiện ngắt nút nhấn phần cứng, cảnh báo viễn trắc nhiệt độ vượt ngưỡng và lệnh điều khiển chuỗi Serial mà không cần vòng lặp thăm dò (Polling).

### ❓ Câu Hỏi Đánh Giá Kỹ Năng Thực Hành (Lab 3)
1. **Kể từ Lab 3, mọi thao tác xuất log debug ra màn hình Console được chuẩn hóa qua đối tượng nào?**
   - A. Đối tượng `Serial` mặc định của Arduino core
   - B. Đối tượng `Wire` qua bus giao tiếp I2C
   - C. Đối tượng `cdh` (`PTIT_CDH cdh;`) kế thừa từ lớp Stream/Print
   - D. Đối tượng `File` ghi trực tiếp vào thẻ nhớ

2. **Chế độ mở tệp nào sau đây trong C++ được sử dụng để ghi nối tiếp dữ liệu viễn trắc mà không làm mất nội dung cũ?**
   - A. `FILE_APPEND`
   - B. `FILE_WRITE`
   - C. `FILE_READ`
   - D. `FILE_TRUNC`
