# Lab 0: Doc 0.2 - Kiến trúc Hệ thống Vệ tinh 1U & 6 Phân hệ Cốt lõi

### 1. Kiến trúc Hệ thống Phân rã theo Khối Chức năng
Một vệ tinh CubeSat là một hệ sinh thái cơ điện tử thu nhỏ, trong đó các thành phần được tổ chức thành các phân hệ chức năng phối hợp chặt chẽ với nhau. Xét theo mục tiêu nhiệm vụ, kiến trúc vệ tinh được chia thành hai nhóm lớn:
1. **Hệ thống Nền tảng (Bus System):** Tập hợp các phân hệ kỹ thuật cơ bản đóng vai trò hạ tầng dịch vụ hỗ trợ — bảo đảm độ bền cơ khí, cung cấp năng lượng, điều khiển nhiệt, xử lý lệnh/dữ liệu, ổn định hướng và duy trì liên lạc với Trái Đất.
2. **Tải trọng Sứ mệnh (Payload):** Bộ phận trực tiếp thực hiện mục tiêu khoa học, quan sát hoặc thử nghiệm công nghệ của chuyến bay — đây chính là lý do tồn tại của toàn bộ hệ thống vệ tinh trên quỹ đạo (ví dụ: camera chụp ảnh bề mặt Trái Đất, máy thu tín hiệu hàng hải AIS/ADS-B, cảm biến đo bức xạ hoặc mô-đun quan sát khí tượng).


![Kiến trúc hệ thống CubeSat tổng thể](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/system.png)

> **Lưu ý về phân chia phân hệ:** Theo tài liệu kỹ thuật hệ thống CubeSat tiêu chuẩn, vệ tinh thường được phân tách thành 7 nhóm chức năng (Kết cấu cơ khí, Nguồn điện EPS, Xử lý dữ liệu & điều khiển C&DH, Thông tin liên lạc COM, Xác định & điều khiển hướng ADCS, Điều khiển nhiệt TCS và Tải hữu ích Payload). Trên bộ kit giáo dục **PTITCube 1U**, hệ thống được tổ chức gọn thành **6 Phân hệ Cốt lõi**: các cảm biến giám sát trạng thái và tải trọng nhiệm vụ được gộp chung thành phân hệ **Cảm biến & Tải trọng Sứ mệnh**, còn chức năng **Điều khiển Nhiệt (TCS)** được tích hợp trực tiếp ở dạng thụ động thông qua khung nhôm dẫn nhiệt và giám sát nhiệt độ trên các cảm biến/mạch sạc.

---

### 2. Chi tiết Chức năng & Thông số 6 Phân hệ Cốt lõi

#### 1. Phân hệ Xử lý Dữ liệu & Điều khiển (OBC / C&DH - On-Board Computer / Command & Data Handling)
Trong kiến trúc vệ tinh, **C&DH** là phân hệ đóng vai trò trung tâm điều phối toàn bộ hoạt động trên khoang, còn **OBC** (*On-Board Computer*) là máy tính phần cứng hạt nhân thực thi các tác vụ đó.

- **Chức năng Cốt lõi (3 nhóm nhiệm vụ chính):**
  1. **Xử lý Lệnh Điều khiển (Telecommand Processing):** Tiếp nhận các gói tin lệnh từ phân hệ truyền thông **COM** gửi lên qua tuyến đường lên (*Uplink*), thực hiện giải mã, kiểm tra cấu trúc, tính hợp lệ và xác thực an toàn trước khi thực thi ngay hoặc lập lịch thực hiện, sau đó phân phối lệnh tới các phân hệ liên quan.
  2. **Thu thập, Xử lý & Quản lý Dữ liệu (Data Handling):** Thu thập định kỳ hai luồng dữ liệu chính là **Dữ liệu giám sát trạng thái/sinh tồn (HK - *Housekeeping Telemetry*)** (điện áp, dòng điện, nhiệt độ, trạng thái thiết bị) và **Dữ liệu nhiệm vụ (Mission Data)** từ tải hữu ích; tiến hành định dạng, gắn nhãn thời gian (*timestamp*), lưu đệm vào bộ nhớ và đóng gói trước khi chuyển cho COM phát xuống mặt đất (*Downlink*).
  3. **Tự chủ Hệ thống & Phục hồi Lỗi (Autonomy & FDIR - *Fault Detection, Isolation, and Recovery*):** Tự động giám sát sức khỏe vệ tinh khi không có liên lạc trực tiếp với trạm mặt đất. Khi phát hiện treo phần mềm, điện áp thấp hoặc sự cố ngoại vi, OBC kích hoạt bộ định thời giám sát phần cứng (**Watchdog Timer**), chuyển sang chế độ an toàn (*Safe Mode*) hoặc khởi động/ngắt mở nguồn thiết bị bị lỗi.

- **Phần cứng & Thông số trên PTITCube 1U:**
  - **Bộ xử lý trung tâm:** Vi điều khiển 32-bit lõi kép **ESP32-WROOM-32** (kiến trúc Xtensa LX6), xung nhịp tối đa 240 MHz, cho phép tách luồng xử lý tác vụ thu phát và tác vụ điều khiển trên hệ điều hành thời gian thực.
  - **Bộ nhớ & Lưu trữ:** 520 KB SRAM nội bộ (dữ liệu làm việc), 4 MB SPI Flash (lưu chương trình bay), kết hợp khe cắm thẻ nhớ **microSD** định dạng FAT32 qua giao tiếp **SPI** tốc độ cao để lưu nhật ký bay (*Flight Log*) và ảnh chụp.
  - **Nguồn thời gian & Bus giao tiếp nội bộ:** Duy trì mốc thời gian bằng bộ đếm thời gian thực (**RTC** - *Real-Time Clock*) kết hợp đồng bộ thời gian chuẩn UTC từ module định vị **GNSS**; kết nối với các phân hệ khác qua các chuẩn bus nối tiếp phổ biến trên CubeSat gồm **I2C** (cảm biến, đo pin), **SPI** (thẻ nhớ microSD) và **UART** (module LoRa, GNSS, camera). *(Trên các CubeSat quy mô lớn hoặc yêu cầu chống nhiễu cao hơn, bus nội bộ còn có thể dùng chuẩn vi sai RS-422/485 hoặc mạng CAN).*

---

#### 2. Phân hệ Năng lượng Điện (EPS - Electrical Power System)
**EPS** đảm nhiệm việc thu nhận (phát điện), lưu trữ, điều hòa điện áp, phân phối và bảo vệ nguồn điện cho toàn bộ vệ tinh. Khả năng cấp nguồn quyết định trực tiếp thời lượng vận hành tải hữu ích, công suất phát sóng và sự sống còn của vệ tinh.

- **Nguyên lý Vận hành Theo Chu kỳ Quỹ đạo:**
  - **Khi được chiếu sáng (Sunlight):** Các tấm pin mặt trời chuyển đổi bức xạ Mặt Trời thành dòng điện một chiều (**DC**) để vừa cấp cho tải đang hoạt động, vừa nạp năng lượng dự trữ vào khối pin.
  - **Khi đi vào vùng bóng tối (Eclipse) hoặc tải đỉnh:** Khi nguồn quang điện không đủ (lúc bị Trái Đất che khuất hoặc khi máy phát RF và tải nặng cùng hoạt động), khối pin lưu trữ sẽ cung cấp phần điện năng còn thiếu.

- **Phương thức Khai thác Năng lượng & Quản lý Nguồn:**
  - Trên CubeSat có hai phương thức khai thác mảng pin mặt trời phổ biến là **Truyền năng lượng trực tiếp (DET - *Direct Energy Transfer*)** (cấu trúc đơn giản, nối mảng pin tới đường nguồn qua mạch điều chỉnh song song) và **Bám điểm công suất cực đại (MPPT - *Maximum Power Point Tracking*)** (dùng bộ biến đổi DC–DC điều chỉnh điểm làm việc của mảng pin để đạt công suất tối đa khi góc chiếu và nhiệt độ thay đổi).
  - Trong thiết kế ngân sách năng lượng (*Power Budget*), cần kiểm tra đồng thời **công suất trung bình** (bảo đảm cân bằng năng lượng trong một vòng quỹ đạo và nạp lại kịp trước pha tối tiếp theo) và **công suất đỉnh** (bảo đảm pin và mạch biến đổi chịu được thời điểm nhiều tải cùng bật). Khối phân phối nguồn phải có chức năng bảo vệ quá dòng/ngắn mạch để cô lập nhánh lỗi, tránh sập nguồn toàn hệ thống.

- **Phần cứng & Thông số trên PTITCube 1U:**
  - **Nguồn Thu Quang điện:** 4 mặt thân ngoài gắn các cell pin mặt trời đơn tinh thể (*Monocrystalline Solar Cells*) có hiệu suất chuyển đổi khoảng 19 - 22%.
  - **Nguồn Lưu trữ:** 1 pack pin sạc **Lithium-Polymer (Li-Po)** đơn cell, dung lượng 1200 - 2000 mAh, điện áp danh định 3.7 V (ngưỡng sạc đầy 4.2 V, ngưỡng ngắt xả bảo vệ 3.0 V). *Lưu ý:* Khi thiết kế thực tế cần kiểm soát chặt độ sâu xả cho phép (**DoD** - *Depth of Discharge*), dòng sạc/xả tối đa và giới hạn nhiệt độ cell pin theo tài liệu nhà sản xuất.
  - **Mạch Quản lý Sạc:** IC sạc **TP4056** thực hiện chu trình sạc hai giai đoạn chuẩn **CC/CV** (*Constant Current / Constant Voltage* — dòng không đổi rồi áp không đổi) với dòng sạc danh định 1000 mA, tích hợp cảm biến nhiệt điện trở **NTC** để ngắt sạc khi pin quá nhiệt.
  - **Mạch Chuyển đổi DC-DC:** Mạch hạ áp **Buck** hiệu suất cao (> 90%) tạo đường nguồn ổn định 3.3 V (cho MCU, cảm biến I2C) và mạch nâng áp **Boost** tạo đường nguồn 5.0 V (cho module LoRa, GPS) từ điện áp biến thiên của pin (3.0 - 4.2 V).
  - **Mạch Giám sát Nhiên liệu (Fuel Gauge):** Chip **MAX17048** đo điện áp cell và ước lượng phần trăm dung lượng còn lại (**SOC** - *State of Charge*) bằng thuật toán *ModelGauge* qua giao tiếp **I2C** mà không cần điện trở *shunt* gây tổn hao công suất.

---

#### 3. Phân hệ Cảm biến & Tải trọng Sứ mệnh (Sensors & Payload)
Trong hệ thống CubeSat, cần phân biệt rõ hai nhóm thành phần: **các cảm biến nền tảng** (cung cấp dữ liệu vật lý cho OBC và ADCS để giám sát sức khỏe, định vị, xác định hướng) và **tải trọng sứ mệnh (Payload)** (thiết bị trực tiếp thực hiện nhiệm vụ khoa học hoặc quan sát của vệ tinh). Trên kit PTITCube, cả hai nhóm được tích hợp đồng bộ trên cùng phân hệ:

- **Nhóm Cảm biến Môi trường & Giám sát Nội bộ:**
  - **Cảm biến Khí quyển BMP280:** Cảm biến áp suất và nhiệt độ vi cơ điện tử (**MEMS**) của Bosch giao tiếp qua **I2C**, dải đo áp suất 300 - 1100 hPa, dải nhiệt độ -40°C đến +85°C. Trong thực hành trên mặt đất hoặc tầng khí quyển thấp, OBC sử dụng công thức khí áp chuẩn quốc tế (ICAO) để ước lượng độ cao khí áp $h$ (m):

$$h = 44330 \cdot \left[1 - \left(\frac{P}{P_0}\right)^{0.1903}\right]$$

  *(Trong đó: $P$ là áp suất đo được tại vị trí vệ tinh; $P_0 = 1013.25\text{ hPa}$ là áp suất chuẩn tại mực nước biển).*

- **Nhóm Cảm biến Xác định Tư thế & Định vị (phục vụ ADCS và C&DH):**
  - **Cảm biến Quán tính 6-DoF MPU6500:** Kết hợp gia tốc kế 3 trục (*Accelerometer*) và con quay hồi chuyển 3 trục (*Gyroscope*) đo vận tốc góc quay quanh 3 trục $X, Y, Z$. Đặt gần trọng tâm vệ tinh để giảm sai số gia tốc ký sinh. *Đặc tính kỹ thuật:* Con quay hồi chuyển cập nhật biến thiên tư thế rất nhanh nhưng có sai số trôi (*bias drift*) tích lũy theo thời gian, nên cần kết hợp với cảm biến tham chiếu tuyệt đối để hiệu chỉnh.
  - **Cảm biến Từ trường QMC5883L:** Từ kế 3 trục đo vectơ cảm ứng từ cục bộ $(B_x, B_y, B_z)$ để tính góc phương vị la bàn (*Heading*) và làm vectơ tham chiếu xác định tư thế:

$$\text{Heading} = \text{atan2}(B_y, B_x) \cdot \frac{180}{\pi}$$

  *Lưu ý lắp đặt:* Từ kế không tự phân biệt được từ trường Trái Đất với từ trường nhiễu do dòng điện trên vệ tinh sinh ra, nên cần đặt xa dây nguồn công suất lớn và động cơ.
  - **Module Định vị Toàn cầu GNSS L76X:** Thu đồng thời tín hiệu từ hệ thống **GPS** (Mỹ) và **GLONASS** (Nga), xuất các bản tin chuẩn **NMEA 0183** (như `GPRMC` chứa tọa độ phẳng/thời gian UTC, `GPGGA` chứa độ cao *geoid*) qua **UART** ở tốc độ 9600 bps. Ngoài vị trí quỹ đạo, tín hiệu từ GNSS còn giúp đồng bộ thời gian chuẩn cho toàn hệ thống OBC.

- **Tải trọng Sứ mệnh Viễn thám (Payload):**
  - **Camera OV2640:** Cảm biến ảnh CMOS độ phân giải 2 Megapixel (1600 × 1200 pixel), tích hợp bộ nén phần cứng **JPEG** giúp giảm dung lượng mỗi bức ảnh xuống còn khoảng 20 - 50 KB. Việc nén nhỏ dung lượng ngay tại tải trọng là yêu cầu bắt buộc để phù hợp với giới hạn bộ nhớ và tốc độ truyền dữ liệu băng thông hẹp của CubeSat 1U.

---

#### 4. Phân hệ Thông tin Liên lạc (COM - Communication Subsystem)
**COM** là cầu nối vô tuyến hai chiều duy nhất giữa CubeSat trên quỹ đạo và trạm mặt đất (**GS** - *Ground Station*). Nếu phân hệ COM mất kết nối không thể phục hồi, trạm mặt đất sẽ mất hoàn toàn khả năng điều khiển và thu nhận dữ liệu sứ mệnh.

- **Chức năng Theo Hai Chiều Liên kết:**
  - **Tuyến Đường lên (Uplink):** Thu tín hiệu RF mang lệnh điều khiển từ trạm mặt đất qua khối thu (**RX** - *Receiver*: gồm bộ khuếch đại tạp âm thấp **LNA**, bộ lọc thông dải loại nhiễu ngoài băng, bộ hạ tần và giải điều chế) rồi chuyển dữ liệu lệnh cho C&DH.
  - **Tuyến Đường xuống (Downlink):** Nhận dữ liệu viễn trắc trạng thái (HK), tín hiệu định vị (*Beacon*) và dữ liệu nhiệm vụ từ C&DH, đưa qua khối phát (**TX** - *Transmitter*: bộ điều chế, nâng tần và bộ khuếch đại công suất cao tần **PA** - *Power Amplifier*) để bức xạ qua anten về trạm mặt đất.
  - *Lưu ý về công suất:* Công suất phát vô tuyến ($P_{\text{RF}}$) đưa vào tính toán ngân sách đường truyền (*Link Budget*) **khác với** công suất điện một chiều ($P_{\text{DC}}$) tiêu thụ từ pin, vì hiệu suất chuyển đổi DC–RF của bộ khuếch đại công suất PA thường chỉ đạt khoảng 30 - 50% và phần năng lượng dư tỏa ra dưới dạng nhiệt.

- **Thách thức Truyền thông trên Quỹ đạo Thấp (LEO):**
  - **Cửa sổ liên lạc ngắn:** Vệ tinh ở độ cao 400 - 600 km bay với vận tốc xấp xỉ 7.6 km/s, nên mỗi lần bay qua vùng nhìn của một trạm mặt đất thường chỉ kéo dài khoảng 5 - 12 phút (khoảng 4 - 6 lượt mỗi ngày).
  - **Suy hao & Dịch tần Doppler:** Tín hiệu chịu suy hao không gian tự do (**FSPL** - *Free-Space Path Loss*) rất lớn trên cự ly hàng trăm đến hơn 2000 km, cộng thêm hiện tượng dịch tần **Doppler** (có thể đạt tới ±10 kHz ở băng UHF) do chuyển động tương đối tốc độ cao giữa vệ tinh và trạm.

- **Phần cứng & Thông số trên PTITCube 1U:**
  - **Module Thu phát Vô tuyến:** **LoRa (Long Range) Ebyte E32** hoạt động ở băng tần **UHF 433 MHz** (công suất phát RF tối đa 20 dBm ≈ 100 mW, hoặc 30 dBm ≈ 1 W ở phiên bản công suất cao).
  - **Kỹ thuật Điều chế:** Công nghệ trải phổ **CSS** (*Chirp Spread Spectrum*) giúp đạt độ nhạy thu cực cao (xuống tới -138 dBm), cho phép giải mã tín hiệu yếu ngay cả khi chìm dưới mức nhiễu nền, phù hợp với tuyến truyền tốc độ thấp yêu cầu độ tin cậy cao trên CubeSat 1U.
  - **Hệ thống Anten:** Sử dụng anten đơn cực (*Monopole*) dài 1/4 bước sóng ($\lambda/4$). Ở tần số $f = 433\text{ MHz}$:

$$\lambda = \frac{c}{f} = \frac{3 \times 10^8\text{ m/s}}{433 \times 10^6\text{ Hz}} \approx 0.6928\text{ m} = 69.28\text{ cm} \implies L_{\text{anten}} = \frac{\lambda}{4} \approx 17.32\text{ cm}$$

  Anten được làm từ lá thép lò xo đàn hồi (*Spring steel tape measure*) thuộc nhóm **anten triển khai**: cuộn gọn trong thân khi nằm trong ống phóng và tự bung thẳng khi ra quỹ đạo, lấy khung nhôm vệ tinh làm mặt phẳng đất phản xạ (*Ground Plane*).

---

#### 5. Phân hệ Kết cấu Cơ khí (Structure Subsystem) & Kiểm soát Nhiệt Thụ động
Phân hệ kết cấu cơ khí tạo bộ khung chịu lực, định hình bao hình tiêu chuẩn, liên kết và bảo vệ toàn bộ bo mạch, cảm biến và tải trọng trong suốt quá trình lắp ráp, vận chuyển, phóng tên lửa và vận hành trên quỹ đạo.

- **Chức năng Cơ khí & Tải trọng Khi Phóng:**
  - Trong giai đoạn tên lửa rời bệ phóng, kết cấu phải chịu đồng thời nhiều dạng tải trọng khắc nghiệt: gia tốc gần tĩnh (lên tới ~ 10 - 15 g), rung động hình sin tần số thấp (dưới 100 Hz), rung động ngẫu nhiên & âm học dải rộng (20 - 2000 Hz) và tải sốc khi tách tầng.
  - Do đó, độ cứng ($k$) và khối lượng ($m$) của khung phải được thiết kế sao cho **tần số dao động riêng** $f_n = \frac{1}{2\pi}\sqrt{k/m}$ đủ cao (thường hướng tới ≥ 100 Hz với vệ tinh nhỏ) nhằm tách khỏi vùng tần số kích thích chính của tên lửa đẩy và tránh cộng hưởng phá hủy kết cấu.
  - Kết cấu gồm các thanh khung, 4 thanh ray dẫn hướng (tiếp xúc ít nhất 75% chiều dài với rãnh trượt của bộ triển khai **P-POD**), tấm mặt ngoài và giá đỡ bo mạch bên trong.

- **Tích hợp Kiểm soát Nhiệt Thụ động (TCS - *Thermal Control Subsystem*):**
  - Trong chân không không có truyền nhiệt đối lưu, khung nhôm đóng vai trò cầu dẫn nhiệt chủ đạo đưa nhiệt lượng sinh ra từ CPU, mạch sạc pin và bộ khuếch đại phát sóng ra các tấm vỏ ngoài để bức xạ vào không gian, đồng thời bảo vệ khối pin Li-Po nhạy cảm nhiệt độ.

- **Thông số Chế tạo & Chuẩn Lắp ghép trên PTITCube 1U:**
  - **Vật liệu & Xử lý Bề mặt:** Phay CNC từ hợp kim nhôm hàng không **Al 6061-T6** (hoặc **Al 7075-T6**), vừa nhẹ, bền cơ học, vừa dẫn nhiệt tốt ($k \approx 167\text{ W/(m}\cdot\text{K)}$). *Lưu ý:* Bề mặt thanh ray tiếp xúc với bộ phóng bắt buộc phải **anốt hóa cứng (Hard Anodize)** để cách điện, chống mài mòn và ngăn hiện tượng hàn nguội trong chân không; trong khi các mặt tiếp xúc nối đất (*Chassis Ground*) dùng lớp phủ chuyển hóa dẫn điện như *Alodine*.
  - **Chuẩn Ngăn xếp Bo mạch (PC/104):** Các bo mạch phân hệ có kích thước tiêu chuẩn 90 × 96 mm, xếp chồng song song qua 4 cọc đồng lục giác (*Standoffs*) cao 16 mm và cố định bằng bu-lông Inox **A2-70**.
  - **Keo Khóa Ren (Threadlocker):** Toàn bộ mối ghép bu-lông sử dụng keo khóa ren kỵ khí độ thoát khí thấp (như *Loctite 222 / 242*) để chống tự tháo dưới rung động phóng và tuân thủ chuẩn thoát khí trong chân không.

---

#### 6. Phân hệ Xác định & Điều khiển Hướng (ADCS - Attitude Determination and Control Subsystem)
**ADCS** chịu trách nhiệm xác định tư thế (định hướng của thân vệ tinh so với hệ quy chiếu quán tính hoặc hệ quỹ đạo) và vận tốc góc, sau đó điều khiển vệ tinh xoay về hướng mong muốn và giữ ổn định. *(Lưu ý: ADCS điều khiển chuyển động quay quanh trọng tâm của thân vệ tinh, khác với việc điều chỉnh vị trí hay quỹ đạo bay).*

- **Thách thức Môi trường & 4 Mô-men Nhiễu Quỹ đạo LEO (Environmental Disturbance Torques):**
  - *Mô-men Gradient Trọng trường ($T_{gg}$):* Do chênh lệch lực hấp dẫn lên các phần thân vệ tinh; kéo trục quán tính nhỏ nhất về hướng xuyên tâm Trái Đất (*Nadir*).
  - *Mô-men Khí động ($T_a$):* Va chạm với khí quyển tầng cao (400 - 600 km) ở vận tốc ~ 7.6 km/s; sinh mô-men lật khi tâm cản lệch trọng tâm (**CoM** - *Center of Mass*).
  - *Mô-men Áp suất Bức xạ Mặt Trời ($T_{sp}$):* Va chạm của hạt photon Mặt Trời lên bề mặt vỏ và tấm pin; sinh mô-men khi tâm diện tích phản xạ không trùng CoM.
  - *Mô-men Từ dư Thân Vệ tinh ($T_m$):* Tương tác giữa từ trường nội bộ (dòng điện trên bo mạch, dây dẫn, pin) với từ trường Trái Đất.

- **Chu trình Vòng kín & Các Chế độ Điều khiển Theo Nhiệm vụ:**
  Tiến trình ADCS vận hành theo vòng lặp khép kín: *Cảm biến đo đạc $\rightarrow$ Ước lượng tư thế $\rightarrow$ So sánh hướng đặt $\rightarrow$ Thuật toán điều khiển $\rightarrow$ Cơ cấu chấp hành $\rightarrow$ Đo phản hồi*. Tùy giai đoạn, ADCS thực hiện 3 chế độ nhiệm vụ chính:
  1. *Chế độ Dập quay (Detumbling Mode):* Kích hoạt ngay sau khi tách ống phóng POD để triệt tiêu vận tốc góc quay hỗn loạn ban đầu bằng thuật toán $B$-dot (đo $\dot{B}$ và kích hoạt từ trường ngược chiều).
  2. *Chế độ Bám Mặt Trời (Sun-Pointing Mode):* Hướng các bề mặt gắn pin quang điện đối diện Mặt Trời để tối ưu hóa công suất sạc cho phân hệ **EPS**.
  3. *Chế độ Bám Mục tiêu / Bám Trạm Mặt Đất (Target / Ground Station Pointing Mode):* Điều khiển trục camera (**Payload**) hướng thẳng xuống Trái Đất (*Nadir*) hoặc hướng búp sóng anten (**COM**) bám theo trạm mặt đất trong cửa sổ bay qua (5 - 12 phút).

- **Cơ cấu Chấp hành Thực tế vs Bão hòa Động lượng (Actuators & Desaturation):**
  - **Trên CubeSat quỹ đạo thực tế:** Kết hợp **bánh đà phản ứng (*Reaction Wheel*)** tạo mô-men phản lực 3 trục chính xác bằng cách biến thiên tốc độ quay của đĩa quán tính ($\tau = -\dot{h}$). Dưới tác động tích lũy của mô-men nhiễu môi trường, bánh đà sẽ quay nhanh dần đến ngưỡng cực đại (**Bão hòa Động lượng - Momentum Saturation**). Khi đó, vệ tinh kích hoạt **bộ tạo mô-men từ (*Magnetorquer*)** tương tác với từ trường Trái Đất ($\tau_m = m \times B$) sinh ngoại lực để **xả động lượng (Desaturation / Momentum Dumping)**, đưa tốc độ bánh đà về mức an toàn mà không tốn nhiên liệu đẩy.
  - **Trên Bộ Kit Giáo dục PTITCube 1U:**
    - *Xác định tư thế:* Tích hợp cảm biến quán tính 6 trục **MPU6500** và từ kế 3 trục **QMC5883L** qua thuật toán lọc bù / Mahony / Madgwick để ước lượng góc **Roll, Pitch, Yaw** thời gian thực.
    - *Cơ cấu chấp hành mô phỏng:* Dùng **động cơ rung lệch tâm (ERM - *Eccentric Rotating Mass*)** điều khiển bằng xung **PWM** kết hợp còi chip âm báo, giúp sinh viên quan sát trực quan nguyên lý tạo mô-men phản lực cơ học và vòng phản hồi điều khiển tư thế trên bàn thí nghiệm.

---

#### Bảng Tổng hợp Nhanh 6 Phân hệ Cốt lõi trên Kit PTITCube 1U

| Phân hệ | Vai trò Chính | Thành phần / Thông số Cốt lõi trên PTITCube | Giao tiếp / Đường Nguồn |
| :--- | :--- | :--- | :--- |
| **1. OBC / C&DH** | Bộ não điều phối, xử lý lệnh, đóng gói dữ liệu HK & nhiệm vụ, FDIR | **ESP32-WROOM-32** (2 nhân 240 MHz, 520 KB SRAM, 4 MB Flash), microSD FAT32 | Bus chủ: I2C, SPI, UART; Nguồn 3.3 V |
| **2. EPS** | Thu nhận, lưu trữ, biến đổi, phân phối & giám sát năng lượng | Pin mặt trời 4 mặt (19 - 22%), Li-Po 3.7 V (1200 - 2000 mAh), **TP4056** (CC/CV), Buck 3.3 V / Boost 5 V, **MAX17048** | I2C (`0x36` cho MAX17048); cấp rail 3.3 V & 5.0 V |
| **3. Sensors & Payload** | Đo thông số môi trường, vị trí/tư thế & chụp ảnh viễn thám | **BMP280** (áp suất/nhiệt độ), **MPU6500** (IMU 6 trục), **QMC5883L** (từ kế), **GNSS L76X** (GPS/GLONASS), **OV2640** (Camera 2 MP JPEG) | I2C (BMP280, MPU6500, QMC5883L), UART (L76X, OV2640 qua 74HC4066) |
| **4. COM** | Cầu nối vô tuyến 2 chiều Uplink/Downlink với trạm mặt đất | **LoRa Ebyte E32** (UHF 433 MHz, CSS, độ nhạy -138 dBm, 20/30 dBm), anten đơn cực λ/4 ≈ 17.32 cm tự bung | UART; Nguồn 5.0 V |
| **5. Structure (& TCS)** | Chịu tải phóng, bảo vệ cơ khí, chuẩn hóa kết nối & dẫn nhiệt thụ động | Khung CNC **Al 6061-T6** / 7075-T6, ray Hard Anodize, chuẩn ngăn xếp **PC/104** (90 × 96 mm, standoff 16 mm), keo khóa ren | Liên kết cơ khí, tản nhiệt dẫn |
| **6. ADCS** | Ước lượng tư thế & mô phỏng điều khiển ổn định hướng | Thuật toán lọc bù / Mahony / Madgwick (từ **MPU6500** + **QMC5883L**); chấp hành thực nghiệm: động cơ **ERM** (PWM) & còi báo | Dữ liệu I2C; Điều khiển PWM từ OBC |

> **Tổng kết Kiến trúc Hệ thống:** Sáu phân hệ kỹ thuật trên kết hợp chặt chẽ tạo thành một hệ sinh thái CubeSat 1U hoàn chỉnh, tuân thủ đúng chuẩn công nghiệp vũ trụ CalPoly CDS và triết lý COTS hiện đại. Toàn bộ các luồng dữ liệu điều khiển, viễn trắc sinh tồn và công suất nguồn được liên kết xuyên suốt qua ngăn xếp PC/104, tạo nền tảng vững chắc để người học tiếp tục triển khai các bài thực hành cấu hình và lập trình chuyên sâu từ Lab 1 đến Lab 8.

---

### 3. 💻 Hướng Dẫn Thực Hành: Khám Phá Mô Hình 3D & Thông Số Phân Hệ

#### 3.1. Mục tiêu Bài Thực hành Lab 0
- Làm quen với giao diện học tập tương tác trực quan 3D trên nền tảng **CubeSat-LMS**.
- Nắm vững vị trí không gian, cách thức bố trí ngăn xếp PC/104 và mối liên kết cơ điện tử giữa các linh kiện thuộc 6 phân hệ CubeSat 1U.
- Tra cứu bảng đặc tả thông số kỹ thuật (Datasheet / Spec) chi tiết của từng chip IC, cảm biến và module phần cứng.
- Rèn luyện kỹ năng quan sát hình học không gian, phân biệt rõ ràng giữa ranh giới cơ khí của thân vệ tinh và thanh ray trượt tiêu chuẩn.

#### 3.2. Hướng dẫn Tương tác Không gian 3D trên Web LMS
Trình mô phỏng 3D của CubeSat-LMS được xây dựng trên nền tảng WebGL mượt mà, cho phép người học thao tác không gian đa chiều trực tiếp trên trình duyệt mà không cần cài đặt phần mềm ngoài:

![Thao tác điều khiển mô phỏng 3D WebGL](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab0_ui_controls.png)

#### 3.3. Quy trình Thực hiện Bài Thực hành Từng bước
1. **Bước 1 - Khởi động Trình duyệt & Mở Trình Mô phỏng 3D:**
   - Truy cập vào hệ thống CubeSat-LMS, đăng nhập tài khoản học viên và mở **Lab 0: Tổng quan Kỹ thuật Không gian**. Chờ mô hình 3D của vệ tinh tải hoàn tất vào bộ nhớ đồ họa WebGL.
2. **Bước 2 - Khám phá Khung sườn Cơ khí & Thanh ray Trượt:**
   - Sử dụng thao tác xoay (Orbit) quan sát 4 thanh ray nhôm anodize cứng ở 4 góc dọc theo trục Z. Quan sát công tắc hành trình phóng (Deployment Switch) ở mặt đáy thanh ray và xác định vùng cấm nhô linh kiện (6.5 mm).
3. **Bước 3 - Khám phá Tầng Bo mạch Đáy (Tầng 1: Nguồn & Máy tính Trung tâm):**
   - Phóng to vào tầng bo mạch dưới cùng. Nhấp chuột vào vi xử lý **ESP32-WROOM-32** (2 nhân 240 MHz, 520 KB SRAM, 4 MB Flash), mạch sạc **TP4056**, pack pin sạc **Li-Po 3.7V** và chip đo dung lượng pin **MAX17048**.
4. **Bước 4 - Khám phá Tầng Bo mạch Giữa (Tầng 2: Cảm biến & Viễn thông LoRa):**
   - Nhấp chọn cảm biến quán tính 6 trục **MPU6500**, từ kế **QMC5883L**, cảm biến khí quyển áp suất/nhiệt độ **BMP280**, module truyền thông vô tuyến **LoRa 433 MHz** và module định vị **GNSS L76X**.
5. **Bước 5 - Khám phá Tầng Đỉnh & Tải trọng Viễn thám (Tầng 3: Camera & Anten):**
   - Quan sát cụm camera viễn thám **OV2640 2 Megapixel** hướng qua lỗ khoét tròn trên tấm nắp đỉnh nhôm, cơ cấu cuộn lá thép anten thước cuộn 433 MHz và dây cước giữ nhiệt bung anten (Burn-wire).
6. **Bước 6 - Báo cáo Kết quả & Đối chiếu Bảng Thông số:**
   - Điền đầy đủ các thông số điện áp hoạt động, dòng điện tiêu thụ và giao thức truyền thông của từng linh kiện vào Báo cáo Thực hành Lab 0 theo mẫu quy định.
