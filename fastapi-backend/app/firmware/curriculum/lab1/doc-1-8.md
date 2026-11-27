# Lab 1: Doc 1.6 - Quy chuẩn Lập trình C++ Định thời Non-blocking với millis() & Thuật toán Chống Tràn số

![Kiến trúc định thời Non-blocking millis() và chống tràn số](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab1_millis_nonblocking.png)

### 1. Tại sao Tuyệt đối CẤM sử dụng `delay()` trong Phần mềm Bay Vệ tinh?

Hàm `delay(ms)` là một hàm **chặn luồng thực thi (Blocking Function)**:

- Khi vi điều khiển gọi lệnh `delay(1000)`, CPU sẽ bị "giam lỏng" trong một vòng lặp rỗng đếm xung suốt $1000\text{ ms}$.
- Trong khoảng thời gian $1$ giây đó, CPU hoàn toàn không thể làm gì khác: không thể đọc dữ liệu cảm biến, không thể kiểm tra gói tin gửi đến từ cổng Serial, không thể phục vụ yêu cầu từ trạm mặt đất và không thể phát hiện các điều kiện sự cố khẩn cấp.
- Nguy hiểm hơn, nếu thời gian `delay()` quá dài vượt quá chu kỳ làm việc của Bộ định thời Watchdog Timer Watchdog Timer, WDT sẽ phát hiện CPU bị đóng băng và tự động khởi động lại toàn bộ vệ tinh!

### 2. Kỹ thuật Định thời An toàn bằng `millis()` (Non-blocking Timing)

Thay vì sử dụng `delay()`, phần mềm bay chuyên nghiệp luôn áp dụng kỹ thuật định thời bất đồng bộ dựa trên bộ đếm thời gian hệ thống `millis()`:

- Hàm `millis()` trả về số mili-giây trôi qua kể từ thời điểm ESP32 được cấp điện khởi động, sử dụng biến kiểu số nguyên không dấu 32-bit (`unsigned long`).
- **Nguyên lý Hoạt động:** Ta ghi nhận mốc thời gian của lần thực hiện gần nhất (`previousMillis`). Trong mỗi vòng lặp `loop()`, ta lấy thời gian hiện tại (`currentMillis`) trừ đi `previousMillis`. Chỉ khi khoảng chênh lệch này lớn hơn hoặc bằng chu kỳ mong muốn (`INTERVAL`), ta mới thực hiện công việc và cập nhật lại mốc `previousMillis`:

```cpp
unsigned long previousMillis = 0;
const unsigned long INTERVAL = 1000; // Chu kỳ 1000 ms (1 giây)

void loop() {
    unsigned long currentMillis = millis();
  
    // Kiểm tra khoảng thời gian trôi qua theo cơ chế non-blocking
    if (currentMillis - previousMillis >= INTERVAL) {
        previousMillis = currentMillis;
      
        // Thực thi tác vụ bay: Đọc cảm biến & Gửi Telemetry
        readSensorsAndSendTelemetry();
    }
  
    // CPU rảnh tay thực thi ngay lập tức các tác vụ quan trọng khác
    handleSerialCommands();
    server.handleClient();
}
```

### 3. Phân tích Toán học về Hiện tượng Tràn số (Rollover Protection)

Biến `unsigned long` trong chuẩn C++ có độ rộng 32-bit, biểu diễn các giá trị từ $0$ đến $2^{32} - 1 = 4.294.967.295$:

- Sau khoảng thời gian:

$$T_{\text{overflow}} = \frac{4294967295\text{ ms}}{1000 \times 60 \times 60 \times 24} \approx 49.71\text{ days}$$

  giá trị của hàm `millis()` sẽ bị tràn số và tự động quay vòng trở về giá trị $0$.
- **Tính toán Đúng đắn Tuyệt đối (Luôn Dùng Phép Trừ):**
  Nhờ quy tắc toán học số bù 2 (Two's Complement Arithmetic) của hệ thống số nguyên không dấu trong phần cứng vi xử lý, biểu thức:

$$\text{currentMillis} - \text{previousMillis} \ge \text{INTERVAL}$$

  luôn luôn cho ra kết quả khoảng thời gian dương chính xác ngay cả trong khoảnh khắc chuyển tiếp qua mốc tràn số!
  *Ví dụ:* Giả sử `previousMillis = 4,294,967,200` (trước khi tràn 95 ms) và sau đó `currentMillis = 50` (đã tràn về 50 ms).
  Phép trừ số học không dấu 32-bit:

$$50 - 4294967200 = 146\text{ ms}$$

  Hệ thống tính toán ra chính xác tuyệt đối 146 ms trôi qua mà không gặp bất kỳ lỗi logic nào!

---

## 💻 Hướng Dẫn Kỹ Thuật: Danh Mục 11 Bài Thực Hành Lab 1

> [!IMPORTANT]
> **Cơ Chế Phần Cứng Thực Hành Lab 1: Bo Mạch Thí Nghiệm Rời (Standalone Educational Breakout PCB)**
>
> - Nhằm đảm bảo an toàn thiết bị và bảo vệ các bo mạch chuẩn vệ tinh trong giai đoạn học viên mới làm quen với lập trình nhúng, **các bài thực hành Lab 1 (từ Bài 1.1 đến Bài 1.11) được tiến hành hoàn toàn trên Bo Mạch Thí Nghiệm Rời (Breakout Demo PCB)** kết nối với ESP32 qua dây cắm jumper, **KHÔNG kết nối vào các PCB chính của chồng bo CubeSat (như bo EPS, bo Sensor, bo Truyền thông COM)**.
> - **Sơ đồ đấu nối phần cứng thực hành Lab 1 (trên PCB rời):**
>   - **LED đơn (Chỉ thị):** Chân Anode nối qua điện trở hạn dòng về `GPIO 2`, Cathode nối GND.
>   - **Nút nhấn (Tact Switch):** Một chân nối về `GPIO 4`, một chân nối GND (sử dụng trở kéo nội `INPUT_PULLUP`). *Lưu ý: Tín hiệu nút nhấn này nằm độc lập trên PCB rời, hoàn toàn không kết nối tới đường điều khiển hạ áp của bo nguồn EPS.*
>   - **Khối IC 74HC595 & LED 7 đoạn:** Chân dữ liệu $DS$ nối `GPIO 13`, chân chốt $ST\_CP$ nối `GPIO 14`, chân xung nhịp $SH\_CP$ nối `GPIO 15`, nguồn cấp $VCC$ nối 3.3V và $GND$.
> - Toàn bộ cấu trúc chồng bo CubeSat chuẩn công nghiệp (PC/104 Bus) sẽ được học viên tiếp cận và tích hợp từng bước trong các Lab chuyên sâu tiếp theo (từ Lab 2 đến Lab 8).

Học viên lần lượt thực hành 11 bài tập lập trình nhúng từ cơ bản đến nâng cao trên Web IDE để làm chủ toàn diện phân hệ OBC:

### Bài 1.1: Blink LED Cơ bản (Hello World của Kỹ thuật Nhúng)

- **Mục tiêu:** Cấu hình chân GPIO làm `OUTPUT` và điều khiển bật/tắt LED theo chu kỳ.

```cpp
const int LED_PIN = 2;

void setup() {
    pinMode(LED_PIN, OUTPUT);
}

void loop() {
    digitalWrite(LED_PIN, HIGH);
    delay(500);
    digitalWrite(LED_PIN, LOW);
    delay(500);
}
```

### Bài 1.2: Blink LED Không chặn luồng bằng hàm `millis()`

- **Mục tiêu:** Thay thế hoàn toàn hàm `delay()` bằng thuật toán định thời non-blocking.

```cpp
const int LED_PIN = 2;
unsigned long prevTime = 0;
const unsigned long INTERVAL = 500;
bool ledState = false;

void setup() {
    pinMode(LED_PIN, OUTPUT);
}

void loop() {
    unsigned long curTime = millis();
    if (curTime - prevTime >= INTERVAL) {
        prevTime = curTime;
        ledState = !ledState;
        digitalWrite(LED_PIN, ledState ? HIGH : LOW);
    }
}
```

### Bài 1.3: Đọc Công tắc Hành trình Phóng (Digital Input & Điện trở Kéo lên Nội bộ)

- **Mục tiêu:** Cấu hình chân GPIO làm `INPUT_PULLUP` để đọc trạng thái đóng/ngắt của công tắc hành trình phóng mà không cần gắn thêm điện trở ngoài.

```cpp
const int SW_PIN = 4;
const int LED_PIN = 2;

void setup() {
    pinMode(SW_PIN, INPUT_PULLUP);
    pinMode(LED_PIN, OUTPUT);
}

void loop() {
    // Khi công tắc mở (vệ tinh ra khỏi ống phóng): chân đọc mức HIGH
    int state = digitalRead(SW_PIN);
    digitalWrite(LED_PIN, (state == HIGH) ? HIGH : LOW);
}
```

### Bài 1.4: Điều khiển Độ sáng LED bằng Điều chế Độ rộng Xung PWM (LEDC)

- **Mục tiêu:** Cấu hình khối phần cứng LEDC PWM của ESP32 để điều chỉnh mức điện áp hiệu dụng ngõ ra.

```cpp
const int LED_PIN = 2;
const int PWM_CH = 0;
const int PWM_FREQ = 5000; // Tần số 5 kHz
const int PWM_RES = 8;     // Độ phân giải 8-bit (0 - 255)

void setup() {
    ledcSetup(PWM_CH, PWM_FREQ, PWM_RES);
    ledcAttachPin(LED_PIN, PWM_CH);
}

void loop() {
    // Tăng dần độ sáng (Fade In)
    for (int duty = 0; duty <= 255; duty++) {
        ledcWrite(PWM_CH, duty);
        delay(5);
    }
    // Giảm dần độ sáng (Fade Out)
    for (int duty = 255; duty >= 0; duty--) {
        ledcWrite(PWM_CH, duty);
        delay(5);
    }
}
```

### Bài 1.5: Giao tiếp Cổng Serial Monitor & Định dạng Viễn trắc

- **Mục tiêu:** Xuất dữ liệu bản tin viễn trắc ra cổng nối tiếp ở tốc độ 115200 bps.

```cpp
unsigned long packetId = 0;

void setup() {
    Serial.begin(115200);
    while (!Serial) { ; } // Chờ kết nối cổng
    Serial.println("=== OBC BOOT COMPLETED ===");
}

void loop() {
    packetId++;
    Serial.print("[BEACON] ID: ");
    Serial.print(packetId);
    Serial.print(" | Uptime: ");
    Serial.print(millis() / 1000);
    Serial.println("s | Status: OK");
    delay(1000);
}
```

### Bài 1.6: Nhận và Phân tích Lệnh Điều khiển qua Serial (Telecommand Parsing)

- **Mục tiêu:** Lắng nghe luồng ký tự từ bàn phím và thực thi lệnh tương ứng.

```cpp
const int LED_PIN = 2;

void setup() {
    pinMode(LED_PIN, OUTPUT);
    Serial.begin(115200);
    Serial.println("Send '1' to ON, '0' to OFF");
}

void loop() {
    if (Serial.available() > 0) {
        char cmd = Serial.read();
        if (cmd == '1') {
            digitalWrite(LED_PIN, HIGH);
            Serial.println("ACK: LED TURNED ON");
        } else if (cmd == '0') {
            digitalWrite(LED_PIN, LOW);
            Serial.println("ACK: LED TURNED OFF");
        }
    }
}
```

### Bài 1.7: Điều khiển Vi mạch Dịch Chốt 74HC595 Hiển thị LED Đơn

- **Mục tiêu:** Lập trình dịch 8 bit nối tiếp qua hàm `shiftOut()`.

```cpp
const int PIN_DATA  = 13; // DS
const int PIN_LATCH = 14; // ST_CP
const int PIN_CLOCK = 15; // SH_CP

void setup() {
    pinMode(PIN_DATA, OUTPUT);
    pinMode(PIN_LATCH, OUTPUT);
    pinMode(PIN_CLOCK, OUTPUT);
}

void loop() {
    for (byte b = 1; b != 0; b <<= 1) {
        digitalWrite(PIN_LATCH, LOW);
        shiftOut(PIN_DATA, PIN_CLOCK, MSBFIRST, b);
        digitalWrite(PIN_LATCH, HIGH);
        delay(200);
    }
}
```

### Bài 1.8: Bộ Đếm Số Thập phân $0 - 9$ trên Màn hình LED 7 Đoạn

- **Mục tiêu:** Sử dụng mảng mã Hex điều khiển hiển thị các chữ số đếm trên LED 7 đoạn.

```cpp
const int PIN_DATA  = 13;
const int PIN_LATCH = 14;
const int PIN_CLOCK = 15;

const byte digitCodes[] = {
    0x3F, 0x06, 0x5B, 0x4F, 0x66, // 0, 1, 2, 3, 4
    0x6D, 0x7D, 0x07, 0x7F, 0x6F  // 5, 6, 7, 8, 9
};

void setup() {
    pinMode(PIN_DATA, OUTPUT);
    pinMode(PIN_LATCH, OUTPUT);
    pinMode(PIN_CLOCK, OUTPUT);
}

void loop() {
    for (int i = 0; i < 10; i++) {
        digitalWrite(PIN_LATCH, LOW);
        shiftOut(PIN_DATA, PIN_CLOCK, MSBFIRST, digitCodes[i]);
        digitalWrite(PIN_LATCH, HIGH);
        delay(1000);
    }
}
```

### Bài 1.9: Khởi tạo Wi-Fi Điểm Truy Cập Mềm (SoftAP Mode)

- **Mục tiêu:** Phát sóng mạng Wi-Fi mang tên vệ tinh với mật khẩu bảo mật WPA2.

```cpp
#include <WiFi.h>

const char* ssid = "PTITCube-OBC";
const char* pass = "12345678";

void setup() {
    Serial.begin(115200);
    WiFi.softAP(ssid, pass);
    Serial.print("Access Point Created. IP: ");
    Serial.println(WiFi.softAPIP());
}

void loop() {
    // Duy trì hoạt động mạng
}
```

### Bài 1.10: Xây dựng Máy chủ Web HTTP Nhúng Giám sát Viễn trắc

- **Mục tiêu:** Phục vụ trang HTML hiển thị trạng thái sinh tồn của vệ tinh qua trình duyệt.

```cpp
#include <WiFi.h>
#include <WebServer.h>

WebServer server(80);

void handleRoot() {
    String html = "<h1>PTITCube OBC Live Telemetry</h1>";
    html += "<p>Uptime: " + String(millis() / 1000) + " seconds</p>";
    html += "<p>Status: NOMINAL (Core 1 Active)</p>";
    server.send(200, "text/html", html);
}

void setup() {
    Serial.begin(115200);
    WiFi.softAP("PTITCube-OBC", "12345678");
    server.on("/", handleRoot);
    server.begin();
    Serial.println("HTTP Server Started");
}

void loop() {
    server.handleClient();
}
```

### Bài 1.11: Tích hợp Đa nhiệm: Điều khiển LED qua Giao diện Web API & Hiển thị Đồng thời

- **Mục tiêu:** Tổng hợp toàn bộ kỹ năng lập trình nhúng của Lab 1: kết hợp máy chủ Web API, điều khiển GPIO, dịch dữ liệu 74HC595 và định thời non-blocking trong cùng một chương trình bay duy nhất.

```cpp
#include <WiFi.h>
#include <WebServer.h>

WebServer server(80);
const int LED_PIN = 2;
unsigned long prevBlink = 0;
bool ledState = false;

void handleApiToggle() {
    ledState = !ledState;
    digitalWrite(LED_PIN, ledState ? HIGH : LOW);
    server.send(200, "application/json", "{\"status\":\"success\",\"led\":" + String(ledState) + "}");
}

void setup() {
    pinMode(LED_PIN, OUTPUT);
    Serial.begin(115200);
    WiFi.softAP("PTITCube-OBC", "12345678");
  
    server.on("/api/toggle", HTTP_POST, handleApiToggle);
    server.begin();
}

void loop() {
    server.handleClient();
  
    // Tác vụ nhịp tim hệ thống non-blocking
    if (millis() - prevBlink >= 1000) {
        prevBlink = millis();
        Serial.printf("[HEARTBEAT] Free Heap: %d bytes\n", ESP.getFreeHeap());
    }
}
```
