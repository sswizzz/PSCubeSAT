# Lab 7: Doc 7.3 - Sổ Tay Vận Hành Bay (FOM) & Mô Phỏng Quỹ Đạo LEO 95 Phút

![Chu kỳ quỹ đạo LEO 95 phút và cửa sổ liên lạc Trạm Mặt đất](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab7_leo_orbit_pass.png)

### 1. Sổ Tay Vận Hành Bay (Flight Operations Manual - FOM)
Sổ tay FOM là tài liệu quy chuẩn tác chiến dành cho kíp trực điều hành Trạm mặt đất:
- **Quy trình Kiểm tra Trước Phiên Liên lạc (Pre-Pass Checklist):** Kiểm tra hướng ăng-ten, hiệu chuẩn tần số SDR, tải tệp phần tử quỹ đạo TLE mới nhất từ Space-Track.org để tính toán thời điểm đón sóng (AOS - Acquisition of Signal) và mất sóng (LOS - Loss of Signal).
- **Giao thức Thông qua Trạm Mặt đất (Ground Pass Protocol):**
  1. *Giai đoạn Bắt sóng (AOS):* Vệ tinh mọc trên chân trời, trạm bắt tín hiệu Beacon đầu tiên, gửi lệnh xác thực `CMD_PING`.
  2. *Giai đoạn Trút Dữ liệu (Telemetry Dump):* Gửi lệnh `CMD_DUMP_LOG`, vệ tinh truyền tải nhanh các khối dữ liệu cảm biến tích lũy trong vòng quỹ đạo trước đó.
  3. *Giai đoạn Thực thi Nhiệm vụ:* Gửi các lệnh cấu hình hoặc yêu cầu chụp ảnh.
  4. *Giai đoạn Mất sóng (LOS):* Vệ tinh lặn xuống chân trời, trạm đóng phiên và lưu trữ nhật ký phiên liên lạc.

### 2. Mô phỏng Chu kỳ Quỹ đạo LEO 95 Phút
Bộ kit PTITCube hỗ trợ chế độ mô phỏng quỹ đạo thực tế để rèn luyện kỹ năng vận hành:
- **Pha Ban ngày Đón nắng (Sunlight - 60 phút):** Tấm pin mặt trời nhận ánh sáng, dòng nạp TP4056 đạt +500 mA, pin sạc tăng dần từ 3.7V → 4.15V, vệ tinh thoải mái thực hiện các tác vụ chụp ảnh và truyền thông công suất cao.
- **Pha Vùng tối Trái Đất (Eclipse - 35 phút):** Vệ tinh chìm vào bóng tối Trái Đất, dòng sạc mặt trời về 0 mA. Toàn bộ năng lượng vận hành được rút từ khối pin Li-Po, điện áp pin xả dần. Học viên phải lập trình quản lý năng lượng thông minh để vệ tinh không bị cạn pin trước khi chu kỳ ban ngày tiếp theo bắt đầu.

---

### ❓ Câu Hỏi Củng Cố Kiến Thức (Doc 7.3)
1. **Khái niệm 'AOS' (Acquisition of Signal) và 'LOS' (Loss of Signal) trong sổ tay vận hành bay (FOM) có ý nghĩa gì?**
   - A. Mốc thời gian bắt đầu và kết thúc cửa sổ liên lạc vô tuyến khi vệ tinh bay qua trạm
   - B. Thời điểm bật và tắt nguồn khối pin mặt trời
   - C. Tín hiệu báo động lỗi bộ nhớ RAM và ROM
   - D. Lệnh chuyển đổi chế độ ngủ và chế độ thức

2. **Một chu kỳ bay quỹ đạo thấp LEO ở độ cao ~400 km mất khoảng bao lâu và vệ tinh trải qua bao nhiêu vòng bay mỗi ngày?**
   - A. Khoảng 24 giờ mỗi chu kỳ, 1 vòng mỗi ngày
   - B. Khoảng 12 giờ mỗi chu kỳ, 2 vòng mỗi ngày
   - C. Khoảng 90 - 95 phút mỗi chu kỳ, xấp xỉ 15 - 16 vòng mỗi ngày
   - D. Khoảng 45 phút mỗi chu kỳ, 32 vòng mỗi ngày

---

## 💻 Hướng Dẫn Thực Hành: Lập Trình Vòng Lặp Tuần Tự vs Đa Nhiệm FreeRTOS

### 1. Kiến trúc Đa Nhiệm FreeRTOS Mô Phỏng Vận Hành Bay
Đoạn mã C++ minh họa cài đặt máy trạng thái FSM kết hợp hàng đợi sự kiện:

```cpp
enum SatelliteState {
    STATE_BOOT,
    STATE_DETUMBLE,
    STATE_NORMAL_OPS,
    STATE_PAYLOAD_EXEC,
    STATE_POWER_SAVE,
    STATE_SAFE_MODE
};

SatelliteState currentState = STATE_BOOT;

void handleFSM() {
    float vbat = readBatteryVoltage();
    float soc = readBatterySOC();

    switch (currentState) {
        case STATE_BOOT:
            Serial.println("[FSM] STATE_BOOT: Khoi tao va giu im lang vo tuyen...");
            currentState = STATE_DETUMBLE;
            break;

        case STATE_DETUMBLE:
            Serial.println("[FSM] STATE_DETUMBLE: On dinh goc quay...");
            currentState = STATE_NORMAL_OPS;
            break;

        case STATE_NORMAL_OPS:
            if (vbat < 3.55f || soc < 25.0f) {
                Serial.println("[FSM] Pin yeu -> Chuyen sang STATE_POWER_SAVE!");
                currentState = STATE_POWER_SAVE;
            }
            break;

        case STATE_POWER_SAVE:
            if (vbat > 3.90f && soc > 60.0f) {
                Serial.println("[FSM] Pin da hoi phuc -> Tro ve STATE_NORMAL_OPS!");
                currentState = STATE_NORMAL_OPS;
            } else if (vbat < 3.40f) {
                Serial.println("[FSM] Pin nguy cap -> Vao STATE_SAFE_MODE phong thu!");
                currentState = STATE_SAFE_MODE;
            }
            break;

        case STATE_SAFE_MODE:
            // Tat toan bo phu tai, chi duy tri bo thu vo tuyen
            break;
    }
}
```

### 2. Danh mục Bài Thực hành Lab 7
- `Lab7-01_Full_Satellite_Program`: Phiên bản phần mềm bay tích hợp chạy theo vòng lặp tuần tự Non-blocking (Super-Loop) kết hợp `millis()`.
- `Lab7-02_RTOS_Satellite_System`: Phiên bản phần mềm bay đa nhiệm thời gian thực FreeRTOS phân chia hai lõi vi xử lý, tích hợp mô phỏng chu kỳ quỹ đạo 95 phút (Sunlight/Eclipse).

### ❓ Câu Hỏi Đánh Giá Kỹ Năng Thực Hành (Lab 7)
1. **Trong chương trình vệ tinh đa nhiệm FreeRTOS (`Lab7-02_RTOS_Satellite_System`), ưu thế vượt trội so với vòng lặp tuần tự là:**
   - A. Giúp vệ tinh tiết kiệm được 100% dung lượng pin
   - B. Đảm bảo các tác vụ khẩn cấp (như nghe lệnh LoRa) được đáp ứng kịp thời không bị nghẽn
   - C. Không cần khai báo cấu hình phần cứng chân GPIO
   - D. Tự động sửa chữa phần cứng linh kiện bị hư hỏng

2. **Chuẩn hóa mã nguồn tích hợp trong Lab 7 yêu cầu đối tượng nào quản lý luồng in thông tin viễn trắc ra terminal?**
   - A. `Serial.println()` trực tiếp
   - B. `Wire.write()` qua bus truyền cảm biến
   - C. `printf()` qua cổng song song máy in
   - D. Đối tượng `cdh.println()` thuộc lớp PTIT_CDH của thư viện PTITCube
