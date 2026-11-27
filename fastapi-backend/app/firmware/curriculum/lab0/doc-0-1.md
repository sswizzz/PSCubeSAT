# Lab 0: Doc 0.1 - Lịch sử CubeSat, Tiêu chuẩn Kỹ thuật & Môi trường Quỹ đạo LEO

### 1. Lịch sử Phát triển và Triết lý Tiêu chuẩn Hóa CubeSat
Vệ tinh siêu nhỏ tiêu chuẩn **CubeSat** được khởi xướng vào năm 1999 thông qua sự hợp tác lịch sử giữa Giáo sư **Jordi Puig-Suari** (Đại học Bách khoa Bang California - CalPoly, San Luis Obispo) và Giáo sư **Bob Twiggs** (Đại học Stanford). Mục tiêu nguyên bản của dự án là thiết lập một tiêu chuẩn kích thước và giao diện cơ khí đồng nhất, giúp sinh viên đại học có thể tự tay thiết kế, chế tạo, thử nghiệm và vận hành một vệ tinh nhân tạo thực thụ trong khoảng thời gian phù hợp với chu kỳ đào tạo (1 - 2 năm) với ngân sách chỉ bằng một phần nghìn so với các vệ tinh truyền thống.

Trước khi CubeSat ra đời, ngành công nghiệp vũ trụ bị chi phối bởi các vệ tinh lớn có khối lượng từ vài trăm kilogam đến hàng tấn, chi phí phát triển lên tới hàng trăm triệu USD và thời gian chuẩn bị kéo dài hàng thập kỷ. Bất kỳ một sai sót nhỏ nào cũng dẫn đến thiệt hại khổng lồ, khiến các kỹ sư có xu hướng cực kỳ bảo thủ, chỉ sử dụng các linh kiện điện tử chuyên dụng chống bức xạ (**Radiation-Hardened**) thế hệ cũ và đắt đỏ.

CubeSat đã tạo nên một cuộc cách mạng mang tính đột phá (**New Space Revolution**) dựa trên ba trụ cột triết lý cốt lõi:
1. **Tiêu chuẩn Hóa Cơ khí & Giao diện Phóng (Standardized Form Factor & Deployment):** Quy định kích thước khối lập phương cố định giúp các nhà cung cấp tên lửa đẩy dễ dàng tích hợp vệ tinh vào các khoang chứa tiêu chuẩn mà không cần thiết kế lại cơ cấu gá phóng cho từng sứ mệnh.
2. **Khai thác Linh kiện Thương mại Sẵn có (COTS - Commercial Off-The-Shelf):** Tận dụng bước nhảy vọt của ngành công nghiệp bán dẫn tiêu dùng (vi xử lý kiến trúc **ARM** / **ESP32**, cảm biến vi cơ điện tử **MEMS** - *Micro-Electro-Mechanical Systems*, pin Lithium-Ion điện thoại). Mặc dù linh kiện COTS không được bọc chắn bức xạ chuyên dụng, các kỹ sư vũ trụ hiện đại áp dụng các giải pháp kiến trúc hệ thống, thuật toán tự sửa lỗi và cơ chế dự phòng đa tầng để đạt độ tin cậy bay mong muốn với giá thành cực thấp.
3. **Đóng gói Kín Giảm Thiểu Rủi ro cho Tên lửa Mẹ (Containerized Launch Integration):** Vệ tinh được nhốt hoàn toàn bên trong ống phóng dạng hộp kín có nắp đậy (như **P-POD** - *Poly-Picosatellite Orbital Deployer*). Mọi nguy cơ bung vỡ chi tiết, đoản mạch hay phát sóng ngoài ý muốn đều bị cô lập hoàn toàn, bảo vệ an toàn tuyệt đối cho tên lửa đẩy và tải trọng thương mại chính.

![Lịch sử phát triển chuẩn CubeSat & New Space](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab0_timeline.png)

---

### 2. Phân loại Vệ tinh Nhỏ (SmallSat) theo Khối lượng
Trong thang phân loại quốc tế của Liên đoàn Hàng không Vũ trụ Quốc tế (**IAF** - *International Astronautical Federation*) và Cơ quan Hàng không và Vũ trụ Hoa Kỳ (**NASA** - *National Aeronautics and Space Administration*), các vệ tinh nhỏ (**SmallSat** - *Small Satellite*) được định danh chính xác dựa trên khối lượng ướt khi phóng (**Wet Mass** — bao gồm cả nhiên liệu nếu có):

| Nhóm Vệ tinh | Khối lượng Phóng ($M$) | Ví dụ Điển hình & Cấu hình CubeSat |
| :--- | :--- | :--- |
| **Minisatellite (Vệ tinh nhỏ)** | $100\text{ kg} \le M < 500\text{ kg}$ | Vệ tinh viễn thám cao cấp, chòm vệ tinh Starlink v1 |
| **Microsatellite (Vệ tinh siêu nhỏ)** | $10\text{ kg} \le M < 100\text{ kg}$ | Vệ tinh VNREDSat-1 (115 kg), CubeSat 12U - 27U |
| **Nanosatellite (Vệ tinh nano)** | $1\text{ kg} \le M < 10\text{ kg}$ | **Chuẩn CubeSat tiêu chuẩn: 1U (1.33 kg), 2U, 3U, 6U** |
| **Picosatellite (Vệ tinh pico)** | $0.1\text{ kg} \le M < 1\text{ kg}$ | Vệ tinh dạng bản mạch PocketQube (5 × 5 × 5 cm), Chipsat |
| **Femtosatellite (Vệ tinh femto)** | $M < 0.1\text{ kg}$ ($< 100\text{ g}$) | Vệ tinh vi mạch đơn màng mỏng (Sprite, KickSat) |

---

### 3. Thông số Hình học Tiêu chuẩn 1U (1 Unit) theo Quy chuẩn CalPoly
Một vệ tinh CubeSat đơn vị cơ sở (**1U** - *1 Unit*) phải tuân thủ nghiêm ngặt các quy định kích thước trong tài liệu đặc tả **CubeSat Design Specification (CDS)** do Đại học CalPoly ban hành để đảm bảo vệ tinh có thể trượt vừa vặn trơn tru bên trong ống phóng mà không bao giờ bị kẹt:

![Thông số cơ học tiêu chuẩn CubeSat 1U](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab0_1u_dimensions.png)

| Thông số Kỹ thuật | Tiêu chuẩn Quy định | Ý nghĩa Kỹ thuật & Dung sai Kiểm định |
| :--- | :--- | :--- |
| **Kích thước Thân cơ sở ($X \times Y$)** | 100.0 × 100.0 mm | Dung sai cực kỳ nghiêm ngặt ±0.1 mm; kiểm tra bằng dưỡng đo cơ khí (**Go/No-Go Gauge**). |
| **Chiều dài Dọc trục Ray ($Z$)** | 113.5 mm | Tính từ mặt phẳng đáy ray đến đỉnh ray. Các thanh ray nhô ra 6.5 mm ở mỗi đầu để ngăn các mặt bên chạm đáy. |
| **Bề rộng Thanh ray (Rails)** | Tối thiểu 8.5 mm | Tiếp xúc trực tiếp với rãnh dẫn hướng của ống phóng **POD** (*Picosatellite Orbital Deployer*) để chịu tải trọng rung động. |
| **Bán kính Bo viền Ray** | Tối thiểu 1.0 mm | Bán kính lượn góc nhẵn bóng nhằm loại bỏ hoàn toàn các gờ sắc nhọn gây cào xước ống phóng. |
| **Độ nhám Bề mặt Ray ($R_a$)** | $R_a \le 0.8\text{ }\mu\text{m}$ | Bề mặt ray trượt phải được mài bóng kỹ thuật cao để giảm thiểu lực ma sát trượt khi bung. |
| **Xử lý Bề mặt Ray (Hard Anodize)** | Anodize Cứng Type III | Tạo lớp gốm oxit nhôm ($\text{Al}_2\text{O}_3$) dày ($25 - 50\text{ }\mu\text{m}$) cách điện, chống mài mòn và chống hàn nguội trong chân không. |
| **Vùng Cấm Nhô (Keep-out Zone)** | Tối đa 6.5 mm | Không có bất kỳ linh kiện, đầu ốc vít hay thấu kính nào được nhô ra khỏi bề mặt ngoài vượt quá 6.5 mm. |
| **Vị trí Trọng tâm (CoM - Center of Mass)** | Cách tâm hình học ≤ 20 mm | Phân bố khối lượng lệch tâm vượt chuẩn sẽ tạo mô-men xoắn gây rung lắc ống phóng và kẹt khi đẩy. |

---

### 4. Cơ chế Phóng P-POD & J-SSOD
CubeSat không được gắn trực tiếp lên tên lửa đẩy mà bắt buộc phải nằm trong một hệ thống phóng dạng hộp kín chuyên dụng (**POD** - *Picosatellite Orbital Deployer*):
1. **P-POD (Poly-Picosatellite Orbital Deployer):** Phát triển bởi CalPoly, là ống phóng kinh điển bằng hợp kim nhôm **Al 7075-T6**. Một ống P-POD tiêu chuẩn có thể chứa một vệ tinh 3U hoặc ba vệ tinh 1U xếp chồng nối tiếp nhau.
2. **J-SSOD (JEM Small Satellite Orbital Deployer):** Hệ thống phóng vệ tinh lắp đặt trên Module Thí nghiệm Nhật Bản **JEM** (*Japanese Experiment Module*, còn gọi là Module Kibo) thuộc Trạm Vũ trụ Quốc tế (**ISS** - *International Space Station*). Các phi hành gia đưa bộ phóng ra ngoài không gian qua cửa điều áp (**Air Lock**) và cánh tay robot Kibo sẽ định hướng ống phóng về phía sau quỹ đạo ISS để đẩy CubeSat ra ngoài.

![Trình tự phóng và triển khai CubeSat lên quỹ đạo](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab0_deployment_sequence.png)

- **Lò xo đẩy chính (Ejection Spring):** Đặt tại đáy ống phóng, cung cấp lực đẩy tuyến tính ổn định để phóng vệ tinh với vận tốc tương đối từ $1.0\text{ m/s}$ đến $1.5\text{ m/s}$, tránh nguy cơ vệ tinh bay lơ lửng ngay cửa ống gây va chạm với tên lửa.
- **Lò xo tách tầng (Deployment Plungers):** Lắp ở đỉnh các thanh ray trượt. Khi hai vệ tinh CubeSat xếp chồng trong cùng một ống phóng rời khỏi cửa, các lò xo plunger nhỏ sẽ lập tức đẩy hai vệ tinh dạt xa nhau để ngăn ngừa va chạm thứ cấp.
- **Công tắc Hành trình Phóng (Deployment Switch / Inhibit Switch):** Lắp ở chân thanh ray trượt. Khi vệ tinh nằm trong ống phóng, nắp hoặc ray đè chặt công tắc ở trạng thái ngắt mạch điện (**Open Circuit**). Khi vệ tinh vừa trượt ra ngoài không gian, công tắc bung ra, đóng mạch điện kết nối pin sạc với hệ thống phân phối nguồn điện **EPS** (*Electrical Power System*).
- **Quy tắc Im lặng Vô tuyến 30 Phút (30-Minute Radio Silence Rule):** Theo yêu cầu an toàn phóng quốc tế của CalPoly, NASA và Cơ quan Thám hiểm Hàng không Vũ trụ Nhật Bản (**JAXA** - *Japan Aerospace Exploration Agency*), CubeSat **bắt buộc phải giữ im lặng vô tuyến (RF Silence) hoàn toàn trong ít nhất 30 phút đầu tiên** sau khi rời ống phóng. Trong khoảng thời gian này, vi điều khiển không được phát sóng radio (**RF** - *Radio Frequency*), không được kích hoạt đốt nhiệt bung anten hay mở các tấm pin để tránh gây nhiễu cho các thiết bị điều khiển của tên lửa đẩy và các vệ tinh khác phóng cùng cụm.

---

### 5. Môi trường Vật lý Khắc nghiệt tại Quỹ đạo Trái Đất Tầm thấp (LEO)
Quỹ đạo **LEO** (*Low Earth Orbit* - Quỹ đạo Trái Đất Tầm thấp) nằm ở độ cao từ 160 km đến 2000 km so với mực nước biển (phổ biến nhất cho CubeSat là 400 - 600 km, tương đương quỹ đạo trạm ISS $\approx 410\text{ km}$). Môi trường không gian tại đây đặt ra những thử thách kỹ thuật cực đoan:

#### A. Môi trường Chân không Cực cao (Ultra-High Vacuum)
Áp suất khí quyển tại độ cao 500 km suy giảm xuống chỉ còn khoảng $10^{-6}\text{ Pa}$ đến $10^{-8}\text{ Pa}$ ($10^{-8} - 10^{-10}\text{ Torr}$), so với áp suất khí quyển tiêu chuẩn tại mặt đất là $101.325\text{ kPa}$ ($760\text{ Torr}$):
- **Triệt tiêu Hoàn toàn Truyền nhiệt Đối lưu:** Định luật làm mát đối lưu Fourier/Newton $\dot{Q} = h A (T_s - T_\infty)$ hoàn toàn biến mất do không có phân tử khí chuyển động tự do. Toàn bộ nhiệt lượng sinh ra từ bộ xử lý trung tâm (**CPU** - *Central Processing Unit*), mạch sạc pin và máy phát sóng chỉ có thể truyền qua hai cơ chế:
  1. Dẫn nhiệt (**Conduction**) qua lớp đồng của bo mạch in (**PCB** - *Printed Circuit Board*) và khung kim loại nhôm.
  2. Bức xạ nhiệt (**Radiation**) từ bề mặt ngoài của thân vệ tinh vào không gian sâu.
- **Hiện tượng Thoát khí Vật liệu (Outgassing):** Dưới áp suất chân không cực thấp, các hợp chất hữu cơ dễ bay hơi, dung môi tồn dư, chất hóa dẻo trong polyme, băng keo và chất cách điện sẽ thoát ra khỏi bề mặt vật liệu. Các hạt khí này bay lơ lửng và nhanh chóng ngưng tụ lạnh lên bề mặt quang học của ống kính camera làm mờ đục ảnh chụp, hoặc phủ lên tế bào quang điện làm sụt giảm công suất sạc. Tiêu chuẩn **ASTM E595** (tiêu chuẩn thử nghiệm vật liệu không gian của tổ chức tiêu chuẩn quốc tế *ASTM International*) do NASA áp dụng quy định vật liệu dùng trong không gian phải đạt:

$$\text{TML} \le 1.0\%, \quad \text{CVCM} \le 0.1\%$$

  *(Trong đó: **TML** – Total Mass Loss là tổng khối lượng hao hụt; **CVCM** – Collected Volatile Condensable Material là vật liệu bay hơi ngưng tụ thu được).*

- **Hiện tượng Hàn nguội Chân không (Cold Welding):** Trong không khí mặt đất, bề mặt kim loại luôn được bao phủ bởi một màng oxit mỏng tự nhiên và lớp phân tử ẩm. Trong môi trường chân không sâu, lớp oxit này bị triệt tiêu hoặc mài mòn. Khi hai bề mặt kim loại trần cùng loại (nhất là nhôm hoặc thép không gỉ) tiếp xúc trực tiếp dưới lực siết mạnh, các mạng tinh thể kim loại sẽ liên kết tự do, dính chặt vào nhau như được hàn nóng chảy. Đây là lý do các thanh ray CubeSat bắt buộc phải mạ **Anodize cứng Type III** (tạo lớp gốm $\text{Al}_2\text{O}_3$ siêu cứng ngăn cách tiếp xúc kim loại trực tiếp).

#### B. Môi trường Bức xạ Vũ trụ & Hạt Mang điện Năng lượng Cao
Không gian LEO không được tầng khí quyển dày bảo vệ hoàn toàn, vệ tinh liên tục bị bắn phá bởi các chùm hạt proton từ gió Mặt Trời, tia vũ trụ ngân hà (**GCR** - *Galactic Cosmic Rays*) và các điện tử năng lượng cao bị bẫy trong hai vành đai bức xạ Van Allen. Tác động của **bức xạ ion hóa (Ionizing Radiation)** lên linh kiện bán dẫn được chia thành hai nhóm chính:

![Tác động bức xạ không gian và giải pháp giảm thiểu](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab0_radiation_effects.png)

1. **Tác động Tích lũy — TID (Total Ionizing Dose - Tổng liều Ion hóa Tích lũy):**
   - **Bản chất:** Lượng bức xạ ion hóa tích tụ dần trong lớp oxit cách điện của vi mạch bán dẫn theo suốt thời gian hoạt động trên quỹ đạo.
   - **Hệ quả (Threshold Drift):** Điện tích bị bẫy trong lớp oxit làm trôi điện áp ngưỡng đóng/mở của transistor MOSFET, tăng dòng rò và khiến linh kiện suy giảm hiệu năng hoặc hỏng dần theo thời gian.
   - **Giải pháp giảm nhẹ:** Bọc chắn cơ học bằng vỏ hợp kim nhôm (**Al Shielding** - *Aluminum Shielding*) để hấp thụ và suy giảm cường độ bức xạ chiếu vào bo mạch bên trong.

2. **Hiệu ứng Tức thời — SEE (Single Event Effects - Hiệu ứng Sự kiện Đơn lẻ):**
   - Xảy ra tức thời khi một hạt mang điện năng lượng cao đơn lẻ (proton hoặc ion nặng) xuyên qua vùng nhạy cảm của chip bán dẫn, gây ra ba dạng lỗi phổ biến sau trên CubeSat:
   - **SEU (Single Event Upset - Lật trạng thái bit đơn lẻ):**
     - *Hiện tượng:* Hạt mang điện làm thay đổi lượng điện tích tại một nút nhớ, gây đảo trạng thái bit (`0` ↔ `1`, gọi là **Bit Flip**) trong bộ nhớ truy cập ngẫu nhiên (**RAM** - *Random Access Memory*) hoặc thanh ghi của vi xử lý. Đây là **lỗi mềm** (không làm hỏng vĩnh viễn phần cứng, nhưng làm sai lệch dữ liệu hoặc biến điều khiển).
     - *Giải pháp giảm nhẹ:* Sử dụng mã phát hiện và sửa sai **ECC / EDAC** (*Error-Correcting Code / Error Detection and Correction*, như mã Hamming) và thuật toán lưu trữ dự phòng ba lần (**TMR** - *Triple Modular Redundancy*) trong bộ nhớ để tự động phát hiện và khôi phục bit bị lật.
   - **SEL (Single Event Latchup - Chốt mạch / Ngắn mạch đơn sự kiện):**
     - *Hiện tượng:* Hạt năng lượng cao kích hoạt mở các cấu trúc transistor ký sinh (thyristor ký sinh) bên trong mạch CMOS, tạo thành đường dẫn dòng ngắn mạch nội bộ (**Latchup Short**) giữa nguồn và đất. Dòng điện tăng vọt đột ngột có thể làm nóng chảy và phá hủy chip vĩnh viễn nếu không ngắt kịp thời.
     - *Giải pháp giảm nhẹ:* Bố trí mạch giám sát và giới hạn dòng điện tức thời (**Current Limiter**) trên phân hệ nguồn **EPS** (*Electrical Power System*) để phát hiện quá dòng SEL và thực hiện ngắt rồi cấp lại nguồn cưỡng bức (**Power Cycling**) trong vài mili-giây trước khi chip bị phá hủy do nhiệt.
   - **SEFI (Single Event Functional Interrupt - Gián đoạn Chức năng Đơn sự kiện):**
     - *Hiện tượng:* Hạt năng lượng cao đánh trúng các thanh ghi trạng thái, mạch định thời hoặc bộ điều khiển giao tiếp của vi mạch, khiến máy tính trên bo (**OBC** - *On-Board Computer*) hoặc bus truyền thông bị treo, mất phản hồi hoặc chạy sai trình tự (**CPU / Bus Hang**).
     - *Giải pháp giảm nhẹ:* Sử dụng bộ định thời giám sát phần cứng độc lập (**Hardware Watchdog Timer / Watchdog Reset**) để tự động phát hiện trạng thái treo và khởi động lại OBC an toàn.

#### C. Khí Oxy Nguyên tử (Atomic Oxygen - AO)
Ở độ cao 200 - 600 km, bức xạ cực tím (**UV** - *Ultraviolet*) năng lượng cao từ Mặt Trời bẻ gãy các liên kết phân tử oxy hai nguyên tử ($\text{O}_2$) trong tầng nhiệt khí quyển thành các gốc **oxy nguyên tử tự do ($\text{O}$)** — gọi tắt là **AO** (*Atomic Oxygen*). Khi vệ tinh bay với vận tốc quỹ đạo siêu thanh $\approx 7.7\text{ km/s}$, các nguyên tử oxy này va chạm trực diện với bề mặt đón gió của vệ tinh với động năng khoảng $5\text{ eV}$. Khí oxy nguyên tử có tính oxy hóa cực mạnh, ăn mòn nhanh chóng các bề mặt mạ bạc, ăn mòn polyme Kapton và phá hủy các lớp phủ quang học.

#### D. Cân bằng Nhiệt Quỹ đạo (Thermal Equilibrium in Space)
Nhiệt độ của CubeSat trong không gian là kết quả của sự cân bằng động học giữa tổng công suất nhiệt hấp thụ ($\dot{Q}_{\text{in}}$), nhiệt nội sinh ($Q_{\text{internal}}$) và tổng công suất nhiệt bức xạ ra vũ trụ ($\dot{Q}_{\text{out}}$):

$$\dot{Q}_{\text{in}} + Q_{\text{internal}} = \dot{Q}_{\text{out}}$$

Trong đó:
1. **Nhiệt Hấp thụ ($\dot{Q}_{\text{in}}$):**
   - **Bức xạ Mặt Trời Trực tiếp ($Q_{\text{solar}}$):** Hằng số Mặt Trời tại quỹ đạo Trái Đất $G_{sc} \approx 1361\text{ W/m}^2$. Công suất hấp thụ:

$$Q_{\text{solar}} = \alpha \cdot A_{\text{proj}} \cdot G_{sc}$$

     (với $\alpha$ là hệ số hấp thụ quang học của bề mặt vỏ, $A_{\text{proj}}$ là diện tích hình chiếu vuông góc với tia nắng).
   - **Bức xạ Phản xạ từ Trái Đất (Earth Albedo - $Q_{\text{albedo}}$):** Trái Đất phản xạ lại không gian trung bình khoảng 30% (hệ số phản xạ suất $a \approx 0.30$) thông lượng ánh sáng Mặt Trời:

$$Q_{\text{albedo}} = \alpha \cdot A_{\text{earth}} \cdot G_{sc} \cdot a \cdot F_{\text{sat-earth}}$$

   - **Bức xạ Hồng ngoại Phát ra từ Trái Đất (Earth Infrared - $Q_{\text{IR}}$):** Bản thân Trái Đất phát xạ nhiệt hồng ngoại (**IR** - *Infrared*) như một vật đen ở nhiệt độ $\approx 255\text{ K}$, với thông lượng trung bình $q_{\text{IR}} \approx 237\text{ W/m}^2$ (và $F_{\text{sat-earth}}$ là hệ số góc nhìn giữa vệ tinh và Trái Đất):

$$Q_{\text{IR}} = \varepsilon \cdot A_{\text{earth}} \cdot q_{\text{IR}} \cdot F_{\text{sat-earth}}$$

2. **Nhiệt Nội sinh ($Q_{\text{internal}}$):** Công suất tiêu tán nhiệt từ các linh kiện điện tử đang hoạt động (CPU của máy tính trung tâm **OBC**, mạch sạc pin **EPS**, mạch khuếch đại công suất **PA** - *Power Amplifier* của module truyền thông tầm xa **LoRa** - *Long Range*).
3. **Nhiệt Bức xạ ra Không gian Sâu ($\dot{Q}_{\text{out}}$):** Theo định luật bức xạ vật đen **Stefan-Boltzmann**:

$$\dot{Q}_{\text{out}} = \varepsilon \cdot \sigma \cdot A_{\text{total}} \cdot (T_{\text{sat}}^4 - T_{\text{space}}^4)$$

   (với $\varepsilon$ là hệ số phát xạ hồng ngoại của vật liệu vỏ, hằng số Stefan-Boltzmann $\sigma = 5.67 \times 10^{-8}\text{ W/(m}^2\text{K}^4)$, $A_{\text{total}}$ là tổng diện tích bức xạ $6$ mặt của CubeSat, và nhiệt độ nền vũ trụ $T_{\text{space}} \approx 2.7\text{ K} \approx -270.45^\circ\text{C}$).

![Cân bằng nhiệt vệ tinh CubeSat trên quỹ đạo LEO](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab0_thermal_balance.png)

- **Biên độ Biến thiên Nhiệt:**
  - **Pha Ban ngày (Sunlight):** Vệ tinh hấp thụ nhiệt mặt trời tối đa, nhiệt độ bề mặt ngoài có thể tăng vọt lên $+80^\circ\text{C}$ đến $+100^\circ\text{C}$.
  - **Pha Vùng tối (Eclipse):** Khi vệ tinh đi vào vùng khuất bóng của Trái Đất ($\approx 35\text{ phút}$ mỗi vòng bay), $Q_{\text{solar}} = 0$ và $Q_{\text{albedo}} = 0$, vệ tinh liên tục mất nhiệt vào vũ trụ, nhiệt độ vỏ tụt dốc xuống $-40^\circ\text{C}$ đến $-50^\circ\text{C}$.
  - Trung bình mỗi ngày vệ tinh trải qua $15 - 16$ chu kỳ sốc nhiệt nóng - lạnh cực đoan, đòi hỏi thiết kế nhiệt thụ động (**Passive Thermal Control**) bằng cách tính toán tỷ số $\alpha/\varepsilon$ của các lớp phủ bề mặt (như băng keo Kapton, mạ niken hoặc sơn anodize đen).

#### E. Động học Quỹ đạo & Thời gian Suy thoái (Orbital Decay)

##### 1. Các Công thức Động học Quỹ đạo Tổng quát (Quỹ đạo tròn)
- **Vận tốc Quỹ đạo Cân bằng (Orbital Velocity):**
  Vệ tinh duy trì chuyển động trên quỹ đạo tròn ở độ cao $h$ khi lực hấp dẫn cân bằng hoàn toàn với lực hướng tâm:

$$\frac{G M_E m}{(R_E + h)^2} = \frac{m v^2}{R_E + h} \implies v = \sqrt{\frac{G M_E}{R_E + h}} = \sqrt{\frac{\mu}{r}}$$

- **Chu kỳ Quỹ đạo (Orbital Period):**
  Thời gian để vệ tinh hoàn thành đúng 1 vòng quay quanh Trái Đất:

$$T = \frac{2\pi r}{v} = 2\pi \sqrt{\frac{r^3}{\mu}} = 2\pi \sqrt{\frac{(R_E + h)^3}{\mu}}$$

- **Số vòng Quỹ đạo trong 1 Ngày Đêm Trái Đất (24 giờ = 86400 giây):**

$$N = \frac{86400}{T_{\text{(s)}}} = \frac{24 \times 60}{T_{\text{(min)}}}$$

  *(Trong đó: $r = R_E + h$ là bán kính quỹ đạo tính từ tâm Trái Đất; $h$ là độ cao quỹ đạo so với mực nước biển; $R_E \approx 6378.14\text{ km}$ là bán kính trung bình Trái Đất; $\mu = G M_E \approx 398600.44\text{ km}^3/\text{s}^2$ là hằng số hấp dẫn địa tâm, với $G$ là hằng số vạn vật hấp dẫn và $M_E$ là khối lượng Trái Đất).*

##### 2. Ví dụ Minh họa Tính toán ở Độ cao $h = 500\text{ km}$
Xét một vệ tinh CubeSat hoạt động trên quỹ đạo tròn LEO ở độ cao phổ biến $h = 500\text{ km}$:
- **Bán kính quỹ đạo:**

$$r = R_E + h = 6378.14 + 500 = 6878.14\text{ km}$$

- **Vận tốc quỹ đạo:**

$$v = \sqrt{\frac{398600.44}{6878.14}} \approx 7.613\text{ km/s} \approx 27400\text{ km/h}$$

- **Chu kỳ quỹ đạo:**

$$T = 2\pi \sqrt{\frac{(6878.14)^3}{398600.44}} \approx 5677\text{ s} \approx 94.6\text{ min}$$

- **Số vòng bay mỗi ngày (24 giờ):**

$$N = \frac{24 \times 60}{94.6} \approx 15.22\text{ orbits/day}$$

##### 3. Lực Cản Khí quyển, Độ cao Quỹ đạo & Quy tắc 25 Năm (IADC 25-Year Rule)
- **Công thức Lực Cản Khí quyển (Atmospheric Drag):**
  Mặc dù rất loãng ở tầng LEO, phần khí quyển tàn dư vẫn tạo ra lực cản khí động học tác dụng ngược chiều bay của vệ tinh:

$$F_{\text{drag}} = \frac{1}{2} \rho v^2 C_d A$$

  *(Trong đó: $\rho$ là mật độ không khí tại độ cao quỹ đạo; $v$ là vận tốc bay của vệ tinh; $C_d \approx 2.2$ là hệ số cản khí động học của khối lập phương; $A$ là diện tích mặt cắt ngang đón gió).*

- **Ảnh hưởng của Độ cao Quỹ đạo đến Thời gian Suy thoái (Orbital Decay):**
  Lực cản $F_{\text{drag}}$ liên tục tiêu hao cơ năng của vệ tinh, làm độ cao quỹ đạo giảm dần cho đến khi vệ tinh rơi vào tầng khí quyển dày và bốc cháy hoàn toàn. Tốc độ suy thoái phụ thuộc rất mạnh vào độ cao ban đầu (do mật độ khí $\rho$ giảm theo hàm mũ khi lên cao):
  - Độ cao $< 200\text{ km}$: Vệ tinh rơi và bốc cháy chỉ trong vài ngày.
  - Độ cao $300 - 400\text{ km}$: Tuổi thọ quỹ đạo kéo dài vài tháng đến $1 - 2$ năm (quỹ đạo lý tưởng cho CubeSat giáo dục).
  - Độ cao $500 - 600\text{ km}$: Tuổi thọ quỹ đạo từ $5$ đến $25$ năm.
  - Độ cao $> 800\text{ km}$: Tồn tại hàng trăm năm, trở thành rác vũ trụ nguy hiểm nếu không có động cơ khử quỹ đạo.

- **Quy chuẩn IADC / Liên Hợp Quốc:** Ủy ban Điều phối Rác Vũ trụ Quốc tế (**IADC** - *Inter-Agency Space Debris Coordination Committee*) quy định mọi vệ tinh LEO sau khi kết thúc sứ mệnh phải tự động khử quỹ đạo và bốc cháy trong vòng không quá **25 năm**. Vệ tinh cũng phải thực hiện quy trình **Thụ động hóa (Passivation)**: xả kiệt dung lượng pin sạc và giải phóng toàn bộ năng lượng dư thừa để tránh nguy cơ phát nổ tạo thành các mảnh vụn không gian.

---
