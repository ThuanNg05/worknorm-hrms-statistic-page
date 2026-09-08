# Trang Thống Kê Chấm Công Công Khai (Public Attendance Statistics)

Trang web tĩnh độc lập (static site) hiển thị bảng thống kê chấm công và ngày nghỉ của nhân viên hệ thống Worknorm HRMS, sẵn sàng triển khai lên **GitHub Pages**.

---

## 1. Giới thiệu & Tính năng

- **Độc lập hoàn toàn**: Không yêu cầu đăng nhập, không phụ thuộc phiên làm việc hay thư viện nặng.
- **Bảng thống kê 2 tầng theo mẫu chuẩn**:
  - **Tên**: Hiển thị đầy đủ họ và tên nhân viên (không viết tắt, không che, không dùng UUID).
  - **SỐ NGÀY LÀM**: Tháng này, Cả năm (nhóm màu xanh pastel).
  - **NGHỈ THÁNG NÀY**: Hợp lệ, Không hợp lệ (nhóm màu vàng pastel).
  - **NGHỈ CẢ NĂM**: Hợp lệ, Không hợp lệ (nhóm màu cam/đào pastel).
- **Sắp xếp linh hoạt (Client-side Sort)**: Nhấn vào bất kỳ tiêu đề cột nào để sắp xếp tăng dần hoặc giảm dần (hỗ trợ sắp xếp tên theo chuẩn tiếng Việt có dấu).
- **Bộ lọc tháng & năm**: Mặc định hiển thị theo tháng và năm hiện tại, tự động tải lại dữ liệu khi đổi bộ lọc.
- **Tìm kiếm tức thì**: Lọc danh sách nhân viên theo họ tên ngay trên giao diện.
- **Responsive trên thiết bị di động**: Hỗ trợ cuộn ngang với cột **Tên nhân viên** cố định (sticky column) giúp dễ dàng theo dõi số liệu trên điện thoại/máy tính bảng.
- **Thiết kế theo DESIGN.md**: Giao diện sáng tối giản (light minimalist), nền `#f9f9f9`/`#ffffff`, điểm nhấn `#7299ED`, tương phản màu đạt chuẩn accessibility (WCAG).

---

## 2. Cấu hình địa chỉ API máy chủ (`PUBLIC_ATTENDANCE_API_BASE_URL`)

API contract:
```http
GET {PUBLIC_ATTENDANCE_API_BASE_URL}/api/public/attendance-statistics?year={year}&month={month}
```

Phản hồi mẫu:
```json
{
  "year": 2026,
  "month": 8,
  "items": [
    {
      "employeeName": "Nguyễn Văn An",
      "workedDaysThisMonth": 25,
      "workedDaysThisYear": 168,
      "validAbsencesThisMonth": 10,
      "invalidAbsencesThisMonth": 2,
      "validAbsencesThisYear": 25,
      "invalidAbsencesThisYear": 5
    }
  ]
}
```

### Cách 1: Cấu hình qua tệp `config.js` (Khuyên dùng khi deploy GitHub Pages)
Mở file `web/public-attendance-statistics/config.js` và điền URL máy chủ:
```javascript
window.PUBLIC_ATTENDANCE_CONFIG = {
  apiBaseUrl: 'https://api.worknorm.vn', // hoặc URL production của bạn
  appName: 'Worknorm',
  pageTitle: 'Thống kê chấm công công khai',
  requestTimeoutMs: 15000,
};
```

### Cách 2: Cấu hình nhanh qua giao diện (Lưu trong trình duyệt `localStorage`)
Khi mở trang web:
1. Nhấn nút **"Cấu hình API"** ở góc phải thanh tiêu đề (hoặc nhập tại khung hướng dẫn khi chưa có URL).
2. Nhập URL máy chủ backend (ví dụ `http://localhost:5000` hoặc `https://api.worknorm.vn`).
3. Nhấn **"Lưu thay đổi"**. Trình duyệt sẽ lưu URL vào `localStorage` và tự động tải dữ liệu.

### Cách 3: Chế độ thử nghiệm (Demo Mode)
Nếu máy chủ API chưa sẵn sàng, bấm nút **"Dùng dữ liệu mẫu (Demo)"** trên khung thông báo để xem trước giao diện và kiểm tra tính năng sắp xếp/lọc với dữ liệu mẫu.

---

## 3. Kiểm tra mã nguồn (Build & Validation)

Từ thư mục `web/public-attendance-statistics`:
```bash
# Chạy kiểm tra tính toàn vẹn và cú pháp
node check.js

# Hoặc dùng npm script
npm run build
```

---

## 4. Hướng dẫn triển khai lên GitHub Pages

### Cách 1: Deploy từ nhánh GitHub Pages chuyên biệt (`gh-pages`)
1. Đẩy các file trong thư mục `web/public-attendance-statistics` vào một nhánh riêng biệt, ví dụ `gh-pages` hoặc thư mục `/docs` của kho lưu trữ.
2. Vào trang quản trị GitHub repository: **Settings** &rarr; **Pages**.
3. Tại mục **Build and deployment** &rarr; **Source**: chọn **Deploy from a branch**.
4. Chọn nhánh `gh-pages` và thư mục `/ (root)` &rarr; nhấn **Save**.
5. Đợi 1–2 phút, trang web sẽ có sẵn tại địa chỉ: `https://<username>.github.io/<repo>/`.

### Cách 2: Deploy tự động bằng GitHub Actions
Tạo tệp `.github/workflows/deploy-public-attendance.yml` (nếu cấu hình CI/CD):
```yaml
name: Deploy Public Attendance Statistics to GitHub Pages

on:
  push:
    branches: [main]
    paths:
      - 'web/public-attendance-statistics/**'

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: 'pages'
  cancel-in-progress: true

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Pages
        uses: actions/configure-pages@v4
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: 'web/public-attendance-statistics'
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```
