# Lab 5: Doc 5.1 - Cơ Sở Lý Thuyết Truyền Thông Vô Tuyến Không Gian & Cân Bằng Tuyến

### 1. Vai trò của Phân hệ Truyền thông (COM - Communication Subsystem)
Phân hệ Truyền thông được xem như "Giọng nói và Đôi tai" của CubeSat. Cho dù các phân hệ khác hoạt động hoàn hảo và thu thập được hàng nghìn bức ảnh giá trị, nếu phân hệ COM thất bại, vệ tinh sẽ vĩnh viễn trở thành một khối rác vũ trụ câm lặng. Phân hệ COM đảm nhận:
- **Tuyến truyền Đường xuống (Downlink):** Định kỳ phát sóng các gói tin tín hiệu định vị (Beacon) thông báo trạng thái sinh tồn của vệ tinh ($V_\text{bat}$, SOC, nhiệt độ) và truyền dữ liệu khoa học, hình ảnh về mặt đất.
- **Tuyến truyền Đường lên (Uplink):** Lắng nghe các mệnh lệnh viễn lệnh (Telecommands) từ Trạm mặt đất để điều khiển vệ tinh, nạp cấu hình mới hoặc kích hoạt chế độ an toàn.

### 2. Đặc tính Lan truyền Sóng Điện từ Băng tần UHF (433 MHz)
Băng tần sóng cực ngắn UHF (Ultra High Frequency, 300 MHz - 3 GHz) là băng tần kinh điển cho các vệ tinh CubeSat giáo dục và nghiên cứu:
- **Khả năng Xuyên qua Tầng Điện ly (Ionospheric Penetration):** Khác với sóng ngắn HF bị phản xạ ngược lại Trái Đất, sóng vô tuyến tần số 433 MHz có khả năng xuyên thủng tầng điện ly của khí quyển để đi vào không gian sâu với độ suy hao tối thiểu.
- **Kích thước Ăng-ten Hợp lý:** Bước sóng $\lambda$ ở tần số 433 MHz là:

$$\lambda = \frac{c}{f} = \frac{3 \times 10^8\text{ m/s}}{433 \times 10^6\text{ Hz}} \approx 0.693\text{ m} = 69.3\text{ cm}$$

  Một ăng-ten đơn cực một phần tư bước sóng (λ/4) chỉ có chiều dài xấp xỉ 17.3 cm, rất lý tưởng để cuộn gọn gàng bên trong khung 1U trước khi bung mở ngoài không gian.

### 3. Phương trình Suy hao Truyền sóng trong Không gian Tự do (Friis FSPL)
Khi sóng điện từ lan truyền từ ăng-ten phát hình cầu ra không gian vô tận, mật độ công suất sóng bị suy giảm theo bình phương khoảng cách. Công thức suy hao truyền sóng trong không gian tự do (**Free-Space Path Loss - FSPL**) của Harald T. Friis:

$$\text{FSPL} = \left(\frac{4\pi d}{\lambda} \right)^2 = \left(\frac{4\pi d f}{c} \right)^2$$

Chuyển đổi sang đơn vị logarit Decibel (dB):

$$\text{FSPL (dB)} = 20 \log_{10}(d\text{ [km]}) + 20 \log_{10}(f\text{ [MHz]}) + 32.44$$

- **Tính toán Thực tế cho CubeSat Quỹ đạo LEO:**
  - Tần số phát sóng: f = 433 MHz.
  - Khoảng cách đường truyền xiên khi vệ tinh vừa mọc ở góc tà thấp (10° trên đường chân trời): $d \approx 800\text{ km}$.

$$\text{FSPL (dB)} = 20 \log_{10}(800) + 20 \log_{10}(433) + 32.44 \approx 58.06 + 52.73 + 32.44 \approx \mathbf{143.23\text{ dB}}$$

- Nhận xét: Sóng vô tuyến bị suy yếu tới 143 dB (tương đương năng lượng bị suy giảm hơn 10¹⁴ lần) trên hành trình xuyên qua bầu khí quyển xuống mặt đất!

![Sơ đồ cân bằng tuyến truyền thông vô tuyến LEO](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab5_rf_link_budget.png)

### 4. Phương trình Cân Bằng Tuyến Truyền Thông (Link Budget)
Bảng cân đối tuyến truyền thông tổng hợp toàn bộ các nguồn tăng ích và suy hao trên toàn bộ chuỗi thu phát:

$$P_\text{rx (dBm)} = P_\text{tx} + G_\text{tx} - L_\text{tx} - \text{FSPL} - L_\text{atm} + G_\text{rx} - L_\text{rx}$$

Trong đó:
- $P_\text{tx}$: Công suất máy phát vệ tinh (+20 dBm = 100 mW).
- $G_\text{tx}$: Độ tăng ích ăng-ten phát trên vệ tinh (+2.15 dBi cho ăng-ten lưỡng cực Dipole).
- $L_\text{tx}, L_\text{rx}$: Tổn hao trên cáp nối và đầu nối Connector (≈ 1.0 dB).
- $\text{FSPL}$: Suy hao không gian tự do (≈ 143.2 dB).
- $L_\text{atm}$: Tổn hao hấp thụ do khí quyển và tầng điện ly (≈ 1.5 dB).
- $G_\text{rx}$: Độ tăng ích ăng-ten thu trạm mặt đất (ví dụ ăng-ten định hướng Yagi 9 phần tử đạt +12.0 dBi).
- **Công suất Thu Dự kiến ($P_\text{rx}$):**

$$P_\text{rx} = 20 + 2.15 - 1.0 - 143.2 - 1.5 + 12.0 - 1.0 \approx \mathbf{-112.55\text{ dBm}}$$

- **Độ Dự trữ Tuyến (Link Margin):**
  Nếu bộ thu LoRa mặt đất có độ nhạy thu đạt $S_\text{rx} = -140\text{ dBm}$, thì độ dự trữ tuyến truyền thông là:

$$\text{Margin} = P_\text{rx} - S_\text{rx} = (-112.55\text{ dBm}) - (-140\text{ dBm}) = \mathbf{+27.45\text{ dB}}$$

  Quy chuẩn không gian yêu cầu độ dự trữ tuyến truyền thông tối thiểu phải ≥ +6 dB. Với mức dự trữ +27.45 dB, tuyến truyền tin của PTITCube hoạt động cực kỳ tin cậy ngay cả khi trời mưa bão.

### 5. Hiệu ứng Dịch Tần Doppler trên Quỹ đạo LEO
Do vệ tinh bay với vận tốc quỹ đạo cực lớn (v ≈ 7.6 km/s), tần số sóng vô tuyến thu được tại trạm mặt đất bị dịch chuyển theo hiệu ứng Doppler:

$$f_\text{rx} = f_0 \left(1 + \frac{v_\text{los}}{c} \right)$$

Trong đó: $v_\text{los}$ là vận tốc dọc theo đường ngắm (Line-of-Sight Velocity).
- Khi vệ tinh vừa mọc ở phía chân trời và bay lại gần trạm: $v_\text{los} > 0$, tần số thu được dịch lên cao nhất ($+\Delta f$).
- Khi vệ tinh bay ngang qua đỉnh đầu (CPA - Closest Point of Approach): $v_\text{los} = 0$, tần số thu được đúng bằng tần số danh định $f_0$.
- Khi vệ tinh bay ra xa về phía chân trời lặn: $v_\text{los} < 0$, tần số thu được dịch xuống thấp nhất ($-\Delta f$).
- Ở băng tần 433 MHz, độ lệch tần Doppler cực đại có thể lên tới:

$$\Delta f_\text{max} \approx 433\text{ MHz} \times \frac{7.6\text{ km/s}}{300.000\text{ km/s}} \approx \pm \mathbf{10.97\text{ kHz}}$$

  Trạm mặt đất bắt buộc phải có thuật toán điều chỉnh tần số thu tự động (Doppler Tracking) bám theo độ dịch chuyển này để không bị mất tín hiệu.

---

### ❓ Câu Hỏi Củng Cố Kiến Thức (Doc 5.1)
1. **Theo phương trình suy hao truyền sóng trong không gian tự do của Friis (FSPL), khi khoảng cách truyền tăng gấp đôi thì độ suy hao tín hiệu sẽ:**
   - A. Giảm đi một nửa công suất
   - B. Không thay đổi nếu anten chuẩn
   - C. Tăng thêm khoảng 6 dB
   - D. Giảm đi chính xác 3 dB

2. **Hiện tượng dịch tần Doppler xảy ra đối với tín hiệu vô tuyến của CubeSat quỹ đạo LEO có đặc điểm gì khi vệ tinh bay qua trạm mặt đất?**
   - A. Tần số thu cao hơn khi vệ tinh tiến lại gần, và thấp hơn khi bay ra xa
   - B. Tần số thu được luôn bằng chính xác tần số phát
   - C. Tần số thu luôn giảm dần về 0 khi vệ tinh đạt góc ngẩng cực đại
   - D. Tần số phát của vệ tinh tự động thay đổi theo nhiệt độ vỏ

---
