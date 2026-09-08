#!/usr/bin/env node
/**
 * =============================================================================
 * Worknorm HRMS — Public Attendance Statistics Validation & Build Check Script
 * =============================================================================
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DIR = __dirname;
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    failed++;
  }
}

console.log('--- Kiểm tra tính toàn vẹn trang Public Attendance Statistics ---');

// 1. Check required files
console.log('\n1. Kiểm tra sự tồn tại của các tệp bắt buộc:');
const requiredFiles = ['index.html', 'styles.css', 'config.js', 'app.js', 'package.json', 'README.md'];
requiredFiles.forEach((file) => {
  const filePath = path.join(DIR, file);
  assert(fs.existsSync(filePath), `Tệp ${file} tồn tại`);
});

// 2. Syntax verification
console.log('\n2. Kiểm tra cú pháp mã JavaScript:');
['config.js', 'app.js'].forEach((file) => {
  const code = fs.readFileSync(path.join(DIR, file), 'utf8');
  try {
    new vm.Script(code);
    assert(true, `Cú pháp ${file} hợp lệ (không có lỗi cú pháp)`);
  } catch (err) {
    assert(false, `Cú pháp ${file} lỗi: ${err.message}`);
  }
});

// 3. Check security / no secrets hardcoded
console.log('\n3. Kiểm tra an toàn bảo mật (không chứa secret, token, credential):');
const allText = requiredFiles
  .map((f) => fs.readFileSync(path.join(DIR, f), 'utf8'))
  .join('\n');

assert(!/postgres:\/\/|User ID=|Password=/i.test(allText), 'Không chứa connection string hoặc database password');
assert(!/Bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+/i.test(allText), 'Không chứa hardcoded JWT token');
assert(!/window\.confirm\s*\(/i.test(allText), 'Không sử dụng window.confirm (tuân thủ yêu cầu UI)');

// 4. Check API contract fields
console.log('\n4. Kiểm tra tuân thủ hợp đồng dữ liệu API:');
const contractFields = [
  'employeeName',
  'workedDaysThisMonth',
  'workedDaysThisYear',
  'validAbsencesThisMonth',
  'invalidAbsencesThisMonth',
  'validAbsencesThisYear',
  'invalidAbsencesThisYear',
];

const appJsContent = fs.readFileSync(path.join(DIR, 'app.js'), 'utf8');
contractFields.forEach((field) => {
  assert(appJsContent.includes(field), `app.js xử lý đúng trường API '${field}'`);
});

const indexHtmlContent = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
assert(indexHtmlContent.includes('PUBLIC_ATTENDANCE_API_BASE_URL'), 'index.html hiển thị hướng dẫn cấu hình PUBLIC_ATTENDANCE_API_BASE_URL');
assert(indexHtmlContent.includes('/api/public/attendance-statistics'), 'index.html tham chiếu đúng endpoint API công khai');
assert(indexHtmlContent.includes('SỐ NGÀY LÀM') && indexHtmlContent.includes('NGHỈ THÁNG NÀY') && indexHtmlContent.includes('NGHỈ CẢ NĂM'), 'index.html có đầy đủ 3 nhóm tiêu đề tầng 1 theo mẫu');

console.log(`\n======================================================`);
console.log(`Kết quả kiểm tra: ${passed} đạt, ${failed} lỗi.`);

if (failed > 0) {
  console.error('❌ Kiểm tra thất bại! Vui lòng sửa các lỗi nêu trên.');
  process.exit(1);
} else {
  console.log('✅ Tất cả kiểm tra hợp lệ! Trang sẵn sàng triển khai lên GitHub Pages.');
  process.exit(0);
}
