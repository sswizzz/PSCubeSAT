# Lab 1: Doc 1.3 - Nguyên lý Vi mạch Dịch bit Chốt Dữ liệu 74HC595 & Lập trình LED 7 Đoạn

### 1. Nguyên lý Hoạt động của IC 74HC595

Trong thiết kế phần cứng vệ tinh, số lượng chân I/O trên vi điều khiển luôn là tài nguyên quý giá cần được tối ưu hóa triệt để. Vi mạch **74HC595** là chip dịch bit nối tiếp sang song song 8-bit tốc độ cao (**Serial-In Parallel-Out Shift Register**) kết hợp với một tầng thanh ghi chốt lưu trữ (**Storage / Latch Register**):

![Cấu trúc vi mạch ghi dịch 74HC595 và LED 7 đoạn](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab1_74hc595_structure.png)

- **Thanh ghi Dịch (Shift Register):** Hoạt động theo cơ chế hàng đợi bit. Mỗi khi xuất hiện một cạnh lên ($0 \to 1$) trên chân xung nhịp **SH_CP (Shift Clock)**, bit dữ liệu hiện tại trên chân **DS (Serial Data)** sẽ được ghi vào tầng đầu tiên, đồng thời toàn bộ 7 bit trước đó sẽ bị đẩy dịch sang phải một nấc.
- **Thanh ghi Chốt Lưu trữ (Storage / Latch Register):** Hoạt động độc lập với thanh ghi dịch. Trong suốt quá trình dịch 8 bit vào thanh ghi dịch, trạng thái của 8 chân ngõ ra Q₀ - Q₇ vẫn được giữ nguyên không đổi. Chỉ khi ta kích hoạt một xung cạnh lên ($0 \to 1$) trên chân **ST_CP (Latch Clock)**, toàn bộ 8 bit từ thanh ghi dịch mới được sao chép tức thì sang thanh ghi chốt và xuất ra ngoài. Cơ chế đệm hai tầng này loại bỏ hoàn toàn hiện tượng nhấp nháy đèn LED trong quá trình dịch dữ liệu.

### 2. Kỹ thuật Điều khiển Màn hình LED 7 Đoạn

Màn hình LED 7 đoạn gồm 7 thanh LED độc lập (được ký hiệu là $a, b, c, d, e, f, g$) và 1 chấm thập phân ($dp$). Trên kit PTITCube, màn hình LED 7 đoạn được sử dụng theo cấu hình **Anode Chung (Common Anode)** hoặc **Cathode Chung (Common Cathode)**:

- Đối với LED 7 đoạn **Cathode Chung**: Để làm sáng một đoạn LED, ta xuất mức logic **HIGH (1)** lên đoạn đó. Để tắt, xuất mức logic **LOW (0)**.
- Bảng mã Hex hiển thị các chữ số thập phân từ $0$ đến $9$ (với thứ tự bit Q₇...Q₀ tương ứng $dp, g, f, e, d, c, b, a$):

| Ký tự Số |     Đoạn LED Bật     | Giá trị Nhị phân ($dp-g-f-e-d-c-b-a$) | Mã Hexadecimal |
| :---------: | :---------------------: | :-----------------------------------------: | :-------------: |
| **0** |  $a, b, c, d, e, f$  |                `00111111`                |    `0x3F`    |
| **1** |        $b, c$        |                `00000110`                |    `0x06`    |
| **2** |    $a, b, d, e, g$    |                `01011011`                |    `0x5B`    |
| **3** |    $a, b, c, d, g$    |                `01001111`                |    `0x4F`    |
| **4** |     $b, c, f, g$     |                `01100110`                |    `0x66`    |
| **5** |    $a, c, d, f, g$    |                `01101101`                |    `0x6D`    |
| **6** |  $a, c, d, e, f, g$  |                `01111101`                |    `0x7D`    |
| **7** |       $a, b, c$       |                `00000111`                |    `0x07`    |
| **8** | $a, b, c, d, e, f, g$ |                `01111111`                |    `0x7F`    |
| **9** |  $a, b, c, d, f, g$  |                `01101111`                |    `0x6F`    |

---
