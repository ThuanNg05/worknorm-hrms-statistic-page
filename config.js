/**
 * =============================================================================
 * Worknorm HRMS — Public Attendance Statistics Configuration
 * =============================================================================
 *
 * File cấu hình công khai cho trang Thống kê Chấm công độc lập.
 *
 * CÁCH CẤU HÌNH API BASE URL:
 * 1. Đặt URL của máy chủ API backend tại `apiBaseUrl` bên dưới.
 *    Mặc định cho môi trường phát triển cục bộ: 'http://localhost:18080'
 * 2. Cấu hình apiBaseUrl được lấy trực tiếp từ file này hoặc ô cấu hình trên giao diện.
 *
 * LƯU Ý AN TOÀN:
 * - Đây là file tĩnh public, KHÔNG đặt mật khẩu, API key bí mật, connection string hoặc token tại đây.
 * - Endpoint thống kê chấm công là công khai và không yêu cầu đăng nhập.
 */

window.PUBLIC_ATTENDANCE_CONFIG = {
  /**
   * Địa chỉ gốc của backend API (không kèm dấu gạch chéo cuối '/')
   * Ví dụ: 'https://api.worknorm.vn' hoặc 'http://localhost:5000'
   */
  apiBaseUrl: 'https://hrms-trkhth.io.vn',

  /**
   * Tiêu đề hiển thị trên thanh điều hướng và tiêu đề trang
   */
  appName: 'Worknorm',
  pageTitle: 'Thống kê chấm công công khai',

  /**
   * Thời gian chờ request tối đa (milliseconds)
   */
  requestTimeoutMs: 15000,
};
