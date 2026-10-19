# FOOTBALL EDGE — TRIẾT LÝ ĐỐI CHIẾU ĐỊNH GIÁ VÀ ĐỊNH HƯỚNG TÀI FT
Ngày 19/10/2026. Yêu cầu của chủ dự án Trần Phương Điền. Đây là định hướng sản phẩm, chưa thay đổi runtime hay production.

## Triết lý đã thống nhất
DATA FIRST → MODEL PREDICTS → MARKET DEFINES → EDGE RANKS → VALIDATION PROVES.
Đánh giá độc lập dữ liệu bóng đá, truy ngược kỳ vọng thị trường, giải thích điểm đồng thuận và khác biệt, rồi đánh giá giá vào và bất định.
Đồng thuận không tự động là lợi thế; bất đồng không tự động là sai hoặc cơ hội.
Không ép model khớp nhà cái, không áp ngưỡng chênh lệch tùy tiện, không đòi sự chắc thắng.
Điểm tín hiệu 0–100 không được xem là xác suất nếu chưa hiệu chỉnh và kiểm chứng.
Code tính xác suất và thanh toán tái lập được; AI phản biện bằng chứng và giải thích. Các nguồn cùng dữ liệu không được coi là lá phiếu độc lập.
Giá trị được kiểm chứng bằng dự báo lưu trước kết quả, giá thực tế, kết quả thanh toán và đánh giá ngoài mẫu; tách paper và cược thực.

## Yêu cầu bổ sung mới
Giữ nguyên hai phần chi tiết Tài HT (hiệp một) và Tài FT hiện tại.
Rà soát đúng ý nghĩa mục tiêu, dữ liệu, điểm số, ngưỡng và chống trùng của từng phần trước khi đề xuất sửa.
Bổ sung lớp nhận định tổng thể Tài FT dựa trên triết lý trên; không thay hoặc cộng trung bình điểm HT/FT.
Tổng thể FT phải phân biệt dự báo có thêm bàn, tổng bàn chung cuộc và giá trị của một kèo Tài cụ thể. Chúng không tương đương.
Nếu HT trong giao diện hiện hành mang nghĩa khác hiệp một, phải xác minh bằng mã nguồn và ghi rõ trước khi ánh xạ.

## Đầu vào và đầu ra lớp tổng thể FT
- Dữ liệu độc lập: sức mạnh nền, phong độ với mẫu thật, trạng thái trận, tỷ số, phút, thống kê, sự kiện và độ mới; thiếu ghi thiếu.
- Phân phối bàn còn lại; tổng bàn FT = bàn đã có + bàn còn lại theo mô hình điều kiện LIVE. Không cộng bàn hiện tại hai lần.
- Market: đúng line, odds hai cửa, nhà cái, thời điểm, giai đoạn và quy tắc thanh toán. Thiếu giá thì kết luận bóng đá vẫn có thể có, nhưng định giá kèo chưa hoàn tất.
- So sánh trên cùng trạng thái/thời điểm/quy tắc; market reverse là ước lượng phụ thuộc mô hình, không tiết lộ thuật toán nhà cái.
- Đầu ra: nhận định diễn biến FT, mức đồng thuận, nguyên nhân khác biệt, giá công bằng/EV khi đủ điều kiện, bất định và dữ liệu thiếu.
- Tài 2.5 và Tài 3.5 phải có đánh giá giá riêng; không có một nhãn Tài tốt cho mọi line.
- HT và FT chi tiết là các góc nhìn giải thích; nếu dùng chung nguồn, không cộng trọng số như bằng chứng độc lập.
- Tách nhãn nhận định trận với nhãn giá vào. Ứng viên/chờ giá vẫn được giữ, không tự động loại trận.

## Ranh giới thực hiện
Bản đóng băng gốc 41f55ce1a192ca7b457a84b70c9ea9ec1b274967 được giữ nguyên.
Tài liệu này được lưu ở nhánh thiết kế riêng. Chưa triển khai mô hình, chưa thay TOP/EDGE/HT/FT, UI, Push, scan, D1 hay production.
Phải rà soát mã nguồn hiện hành trước khi xác nhận cơ chế cũ đúng/sai.
Lỗi upstream statistics vẫn chưa giải quyết; không dùng dữ liệu thiếu để tạo xác suất chắc chắn.
