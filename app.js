/**
 * =============================================================================
 * Worknorm HRMS — Public Attendance Statistics Application Logic
 * Pure Vanilla JavaScript (Zero external dependencies)
 * =============================================================================
 */

(function () {
  'use strict';

  // 1. Xóa localStorage override PUBLIC_ATTENDANCE_API_BASE_URL vì có thể giữ URL cũ sai port.
  const STORAGE_KEY_API_BASE = 'PUBLIC_ATTENDANCE_API_BASE_URL';
  try {
    localStorage.removeItem(STORAGE_KEY_API_BASE);
  } catch (_) {
    // Ignore storage restrictions if any
  }

  // Runtime API Base URL override within current session if user updates via UI
  let runtimeApiBaseUrl = '';

  // Application State
  const now = new Date();
  const state = {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    items: [],
    isLoading: false,
    abortController: null,
    isMockMode: false,
    serverUnreachable: false,
    lastErrorPayload: {
      title: 'Không thể tải dữ liệu thống kê',
      desc: 'Vui lòng kiểm tra lại kết nối mạng hoặc bật chế độ xem dữ liệu mẫu.',
    },
  };

  // Danh sách nhân viên mẫu (dùng khi không kết nối được máy chủ và người dùng bật Dữ liệu mẫu)
  const BASE_MOCK_EMPLOYEES = [
    { employeeName: 'Nguyễn Văn An', workedDaysThisMonth: 22, workedDaysThisYear: 196, validAbsencesThisMonth: 0, invalidAbsencesThisMonth: 0, validAbsencesThisYear: 2, invalidAbsencesThisYear: 0 },
    { employeeName: 'Trần Thị Bích Ngọc', workedDaysThisMonth: 21, workedDaysThisYear: 192, validAbsencesThisMonth: 1, invalidAbsencesThisMonth: 0, validAbsencesThisYear: 4, invalidAbsencesThisYear: 0 },
    { employeeName: 'Lê Hoàng Nam', workedDaysThisMonth: 20, workedDaysThisYear: 185, validAbsencesThisMonth: 1, invalidAbsencesThisMonth: 1, validAbsencesThisYear: 5, invalidAbsencesThisYear: 2 },
    { employeeName: 'Phạm Minh Tuấn', workedDaysThisMonth: 22, workedDaysThisYear: 198, validAbsencesThisMonth: 0, invalidAbsencesThisMonth: 0, validAbsencesThisYear: 1, invalidAbsencesThisYear: 0 },
    { employeeName: 'Hoàng Thu Trang', workedDaysThisMonth: 19, workedDaysThisYear: 180, validAbsencesThisMonth: 3, invalidAbsencesThisMonth: 0, validAbsencesThisYear: 8, invalidAbsencesThisYear: 0 },
    { employeeName: 'Vũ Đức Thắng', workedDaysThisMonth: 21, workedDaysThisYear: 190, validAbsencesThisMonth: 0, invalidAbsencesThisMonth: 1, validAbsencesThisYear: 3, invalidAbsencesThisYear: 1 },
    { employeeName: 'Đặng Phương Thảo', workedDaysThisMonth: 22, workedDaysThisYear: 195, validAbsencesThisMonth: 0, invalidAbsencesThisMonth: 0, validAbsencesThisYear: 3, invalidAbsencesThisYear: 0 },
    { employeeName: 'Bùi Quốc Khánh', workedDaysThisMonth: 18, workedDaysThisYear: 174, validAbsencesThisMonth: 2, invalidAbsencesThisMonth: 2, validAbsencesThisYear: 6, invalidAbsencesThisYear: 3 },
    { employeeName: 'Đỗ Thị Mai Hương', workedDaysThisMonth: 21, workedDaysThisYear: 191, validAbsencesThisMonth: 1, invalidAbsencesThisMonth: 0, validAbsencesThisYear: 4, invalidAbsencesThisYear: 0 },
    { employeeName: 'Ngô Quang Huy', workedDaysThisMonth: 22, workedDaysThisYear: 197, validAbsencesThisMonth: 0, invalidAbsencesThisMonth: 0, validAbsencesThisYear: 2, invalidAbsencesThisYear: 0 },
    { employeeName: 'Dương Thanh Tùng', workedDaysThisMonth: 20, workedDaysThisYear: 188, validAbsencesThisMonth: 2, invalidAbsencesThisMonth: 0, validAbsencesThisYear: 5, invalidAbsencesThisYear: 1 },
    { employeeName: 'Lý Ngọc Ánh', workedDaysThisMonth: 21, workedDaysThisYear: 193, validAbsencesThisMonth: 1, invalidAbsencesThisMonth: 0, validAbsencesThisYear: 3, invalidAbsencesThisYear: 0 },
  ];

  /**
   * Tạo dữ liệu mẫu biến thiên nhẹ theo tháng để kiểm thử bộ lọc Tháng/Năm
   */
  function getMockItems(year, month) {
    const m = Math.max(1, Math.min(12, month || 1));
    return BASE_MOCK_EMPLOYEES.map((emp, idx) => {
      const monthOffset = ((m + idx) % 3) - 1; // -1, 0, 1
      const workedMonth = Math.max(15, Math.min(23, emp.workedDaysThisMonth + monthOffset));
      const workedYear = Math.max(workedMonth, Math.round((emp.workedDaysThisYear / 9) * m));
      return {
        employeeName: emp.employeeName,
        workedDaysThisMonth: workedMonth,
        workedDaysThisYear: workedYear,
        validAbsencesThisMonth: emp.validAbsencesThisMonth,
        invalidAbsencesThisMonth: emp.invalidAbsencesThisMonth,
        validAbsencesThisYear: Math.max(emp.validAbsencesThisMonth, emp.validAbsencesThisYear),
        invalidAbsencesThisYear: Math.max(emp.invalidAbsencesThisMonth, emp.invalidAbsencesThisYear),
      };
    });
  }

  // DOM Element References
  const dom = {
    configBanner: document.getElementById('configBanner'),

    filterForm: document.getElementById('filterForm'),
    filterMonth: document.getElementById('filterMonth'),
    filterYear: document.getElementById('filterYear'),

    currentMonthDisplay: document.getElementById('currentMonthDisplay'),
    recordCountText: document.getElementById('recordCountText'),
    mockStatusBadge: document.getElementById('mockStatusBadge'),

    btnToggleMockData: document.getElementById('btnToggleMockData'),
    mockModeBanner: document.getElementById('mockModeBanner'),
    btnRetryFromMock: document.getElementById('btnRetryFromMock'),
    btnDisableMockBanner: document.getElementById('btnDisableMockBanner'),

    tableWrapper: document.getElementById('tableWrapper'),
    tableBody: document.getElementById('tableBody'),

    mobileCardsWrapper: document.getElementById('mobileCardsWrapper'),
    mobileCardList: document.getElementById('mobileCardList'),

    stateLoading: document.getElementById('stateLoading'),
    stateError: document.getElementById('stateError'),
    errorMessageTitle: document.getElementById('errorMessageTitle'),
    errorMessageDesc: document.getElementById('errorMessageDesc'),
    btnRetry: document.getElementById('btnRetry'),
    btnEnableMockFromError: document.getElementById('btnEnableMockFromError'),

    stateEmpty: document.getElementById('stateEmpty'),
    emptyMessageDesc: document.getElementById('emptyMessageDesc'),
  };

  /**
   * Lấy apiBaseUrl từ config.js.
   * KHÔNG đọc từ localStorage để tránh giữ URL cũ sai port.
   */
  function getApiBaseUrl() {
    if (runtimeApiBaseUrl && typeof runtimeApiBaseUrl === 'string' && runtimeApiBaseUrl.trim()) {
      return runtimeApiBaseUrl.trim().replace(/\/+$/, '');
    }

    const fromConfig = window.PUBLIC_ATTENDANCE_CONFIG?.apiBaseUrl;
    if (fromConfig && typeof fromConfig === 'string' && fromConfig.trim()) {
      return fromConfig.trim().replace(/\/+$/, '');
    }

    return '';
  }

  /**
   * Kiểm tra API base URL đã được cấu hình hay chưa
   */
  function isApiConfigured() {
    return Boolean(getApiBaseUrl());
  }

  /**
   * Đồng bộ giao diện nút công tắc Dữ liệu mẫu (chỉ hiện khi không kết nối được server hoặc đang bật mock)
   */
  function syncMockToggleUI() {
    if (dom.btnToggleMockData) {
      if (state.serverUnreachable || state.isMockMode) {
        dom.btnToggleMockData.classList.remove('hidden');
      } else {
        dom.btnToggleMockData.classList.add('hidden');
      }
      dom.btnToggleMockData.setAttribute('aria-checked', state.isMockMode ? 'true' : 'false');
      dom.btnToggleMockData.classList.toggle('is-active', state.isMockMode);
    }

    if (dom.mockModeBanner) {
      dom.mockModeBanner.classList.toggle('hidden', !state.isMockMode);
    }

    if (dom.mockStatusBadge) {
      dom.mockStatusBadge.classList.toggle('hidden', !state.isMockMode);
    }
  }

  /**
   * Bật hoặc tắt chế độ xem dữ liệu mẫu khi không kết nối được máy chủ
   */
  function setMockMode(enabled) {
    state.isMockMode = Boolean(enabled);
    syncMockToggleUI();

    if (state.isMockMode) {
      state.items = getMockItems(state.year, state.month);
      renderTable();
    } else {
      state.items = [];
      if (state.serverUnreachable) {
        setViewState('ERROR', state.lastErrorPayload);
      } else {
        fetchStatistics();
      }
    }
  }

  /**
   * Quản lý trạng thái giao diện LOẠI TRỪ NHAU:
   * - LOADING: chỉ hiện loading.
   * - DATA: chỉ hiện bảng (desktop) hoặc danh sách thẻ (mobile).
   * - EMPTY: chỉ hiện empty state.
   * - ERROR: chỉ hiện error state.
   * - CONFIG_REQUIRED: chỉ hiện banner cấu hình khi chưa có URL.
   */
  function setViewState(viewState, payload = {}) {
    // Luôn ẩn toàn bộ các trạng thái trước để bảo đảm loại trừ nhau tuyệt đối
    dom.stateLoading.classList.add('hidden');
    dom.tableWrapper.classList.add('hidden');
    if (dom.mobileCardsWrapper) {
      dom.mobileCardsWrapper.classList.add('hidden');
    }
    dom.stateEmpty.classList.add('hidden');
    dom.stateError.classList.add('hidden');

    switch (viewState) {
      case 'LOADING':
        dom.stateLoading.classList.remove('hidden');
        dom.recordCountText.textContent = 'Đang tải dữ liệu...';
        break;

      case 'DATA':
        dom.tableWrapper.classList.remove('hidden');
        if (dom.mobileCardsWrapper) {
          dom.mobileCardsWrapper.classList.remove('hidden');
        }
        break;

      case 'EMPTY':
        dom.stateEmpty.classList.remove('hidden');
        if (payload.desc) {
          dom.emptyMessageDesc.textContent = payload.desc;
        } else {
          dom.emptyMessageDesc.textContent = `Không tìm thấy bản ghi chấm công nào phù hợp với tháng ${state.month}/${state.year}.`;
        }
        break;

      case 'ERROR':
        dom.stateError.classList.remove('hidden');
        dom.errorMessageTitle.textContent = payload.title || 'Không thể tải dữ liệu thống kê';
        dom.errorMessageDesc.textContent = payload.desc || 'Vui lòng kiểm tra lại kết nối mạng hoặc bật chế độ xem dữ liệu mẫu.';
        dom.recordCountText.textContent = 'Không kết nối được máy chủ';
        break;

      case 'CONFIG_REQUIRED':
        showConfigBanner();
        dom.recordCountText.textContent = 'Chưa cấu hình API URL';
        break;

      default:
        break;
    }
  }

  /**
   * Khởi tạo giá trị ban đầu cho các ô chọn tháng/năm
   * Năm: lựa chọn đầu tiên là năm hiện tại, giới hạn tối đa 5 năm tiếp theo
   */
  function initFilterInputs() {
    const currentYear = now.getFullYear();
    const yearOptions = [];
    for (let offset = 0; offset <= 5; offset++) {
      const y = currentYear + offset;
      yearOptions.push(`<option value="${y}">Năm ${y}</option>`);
    }
    dom.filterYear.innerHTML = yearOptions.join('');

    dom.filterMonth.value = String(state.month);
    dom.filterYear.value = String(state.year);
    updateMonthDisplay();
  }

  /**
   * Cập nhật nhãn hiển thị tháng/năm trên thanh tiêu đề
   */
  function updateMonthDisplay() {
    dom.currentMonthDisplay.textContent = `${state.month}/${state.year}`;
  }

  /**
   * Fetch dữ liệu thống kê chấm công từ endpoint public duy nhất:
   * GET {apiBaseUrl}/api/public/attendance-statistics?year={year}&month={month}
   * Không gọi endpoint HRMS khác, không token, không login.
   */
  async function fetchStatistics() {
    const baseUrl = getApiBaseUrl();

    if (!baseUrl) {
      state.serverUnreachable = true;
      syncMockToggleUI();
      setViewState('CONFIG_REQUIRED');
      return;
    }

    hideConfigBanner();

    // Hủy request đang chạy trước đó nếu có
    if (state.abortController) {
      state.abortController.abort();
    }
    state.abortController = new AbortController();

    // Bật trạng thái LOADING (chỉ hiện loading, ẩn toàn bộ bảng, error, empty)
    state.isLoading = true;
    if (dom.mockModeBanner) {
      dom.mockModeBanner.classList.add('hidden');
    }
    setViewState('LOADING');

    const endpoint = `${baseUrl}/api/public/attendance-statistics?year=${encodeURIComponent(state.year)}&month=${encodeURIComponent(state.month)}`;
    const timeoutMs = window.PUBLIC_ATTENDANCE_CONFIG?.requestTimeoutMs || 15000;
    const timeoutId = setTimeout(() => {
      if (state.abortController) {
        state.abortController.abort();
      }
    }, timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: state.abortController.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errMessage = `Máy chủ trả về mã lỗi HTTP ${response.status}.`;
        try {
          const errData = await response.json();
          if (errData && errData.message) {
            errMessage = errData.message;
          }
        } catch (_) {
          // Sử dụng thông báo lỗi mặc định
        }

        if (response.status === 404) {
          errMessage = 'Không tìm thấy endpoint /api/public/attendance-statistics trên máy chủ API.';
        } else if (response.status === 429) {
          errMessage = 'Đã vượt quá giới hạn lượt truy vấn (Rate Limit). Vui lòng đợi trong giây lát và thử lại.';
        }

        throw new Error(errMessage);
      }

      const data = await response.json();
      const items = Array.isArray(data.items) ? data.items : [];

      // Kết nối máy chủ thành công -> tắt trạng thái lỗi và tắt chế độ dữ liệu mẫu
      state.serverUnreachable = false;
      state.isMockMode = false;
      syncMockToggleUI();

      state.items = items;

      if (items.length === 0) {
        // Thành công nhưng không có dữ liệu: chỉ hiện empty state
        setViewState('EMPTY');
        dom.recordCountText.textContent = `Tổng số 0 nhân viên`;
      } else {
        // Thành công có dữ liệu: chỉ hiện bảng
        setViewState('DATA');
        renderTable();
      }
    } catch (err) {
      clearTimeout(timeoutId);

      // Trong catch: đánh dấu không kết nối được server để hiện nút tắt/mở Dữ liệu mẫu
      const title = 'Không thể kết nối đến máy chủ thống kê';
      let desc = err.message;
      if (err.name === 'AbortError') {
        desc = 'Hết thời gian chờ phản hồi (Timeout). Bạn có thể bật "Dữ liệu mẫu" để xem trước giao diện.';
      } else if (err.message && err.message.includes('Failed to fetch')) {
        desc = `Không thể kết nối đến máy chủ API (${baseUrl}). Bạn có thể bật công tắc "Dữ liệu mẫu" để xem dữ liệu minh họa.`;
      }

      state.serverUnreachable = true;
      state.lastErrorPayload = { title, desc };
      syncMockToggleUI();

      if (state.isMockMode) {
        state.items = getMockItems(state.year, state.month);
        renderTable();
      } else {
        setViewState('ERROR', { title, desc });
      }
    } finally {
      // Trong finally: luôn đảm bảo tắt loading
      state.isLoading = false;
      dom.stateLoading.classList.add('hidden');
      state.abortController = null;
    }
  }

  /**
   * Render danh sách các dòng trong bảng thống kê (Desktop) và danh sách thẻ (Mobile)
   * Các trường hợp đồng dữ liệu:
   * employeeName, workedDaysThisMonth, workedDaysThisYear,
   * validAbsencesThisMonth, invalidAbsencesThisMonth,
   * validAbsencesThisYear, invalidAbsencesThisYear
   */
  function renderTable() {
    const list = state.items;

    if (list.length === 0) {
      setViewState('EMPTY');
      return;
    }

    // Hiển thị dữ liệu (CSS sẽ tự động hiển thị bảng trên Desktop và thẻ trên Mobile)
    setViewState('DATA');

    // Tạo HTML các dòng cho bảng Desktop
    const rowsHtml = list.map((item) => {
      const name = escapeHtml(item.employeeName || '—');
      const workedMonth = formatNumber(item.workedDaysThisMonth);
      const workedYear = formatNumber(item.workedDaysThisYear);
      const valAbsMonth = formatNumber(item.validAbsencesThisMonth);
      const invalAbsMonth = formatNumber(item.invalidAbsencesThisMonth);
      const valAbsYear = formatNumber(item.validAbsencesThisYear);
      const invalAbsYear = formatNumber(item.invalidAbsencesThisYear);

      return `
        <tr>
          <td class="td-name" title="${name}">
            <strong>${name}</strong>
          </td>
          <td class="td-num ${item.workedDaysThisMonth === 0 ? 'td-num-zero' : ''}">${workedMonth}</td>
          <td class="td-num ${item.workedDaysThisYear === 0 ? 'td-num-zero' : ''}">${workedYear}</td>
          <td class="td-num ${item.validAbsencesThisMonth === 0 ? 'td-num-zero' : ''}">${valAbsMonth}</td>
          <td class="td-num ${item.invalidAbsencesThisMonth === 0 ? 'td-num-zero' : ''}">${invalAbsMonth}</td>
          <td class="td-num ${item.validAbsencesThisYear === 0 ? 'td-num-zero' : ''}">${valAbsYear}</td>
          <td class="td-num ${item.invalidAbsencesThisYear === 0 ? 'td-num-zero' : ''}">${invalAbsYear}</td>
        </tr>
      `;
    }).join('');

    dom.tableBody.innerHTML = rowsHtml;

    // Tạo HTML danh sách thẻ cho Mobile (mặc định thu gọn, không đánh số thứ tự)
    if (dom.mobileCardList) {
      const cardsHtml = list.map((item) => {
        const name = escapeHtml(item.employeeName || '—');
        const workedMonth = formatNumber(item.workedDaysThisMonth);
        const workedYear = formatNumber(item.workedDaysThisYear);
        const valAbsMonth = formatNumber(item.validAbsencesThisMonth);
        const invalAbsMonth = formatNumber(item.invalidAbsencesThisMonth);
        const valAbsYear = formatNumber(item.validAbsencesThisYear);
        const invalAbsYear = formatNumber(item.invalidAbsencesThisYear);

        return `
          <article class="employee-card" role="listitem">
            <button type="button" class="employee-card-header" aria-expanded="false">
              <span class="employee-card-name">${name}</span>
              <span class="employee-card-toggle-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </span>
            </button>
            <div class="employee-card-body">
              <!-- Nhóm 1: Số ngày làm -->
              <div class="metric-group metric-group-work">
                <div class="metric-group-title">SỐ NGÀY LÀM</div>
                <div class="metric-group-cells">
                  <div class="metric-cell">
                    <span class="metric-label">Tháng này</span>
                    <span class="metric-value ${item.workedDaysThisMonth === 0 ? 'td-num-zero' : ''}">${workedMonth}</span>
                  </div>
                  <div class="metric-cell">
                    <span class="metric-label">Cả năm</span>
                    <span class="metric-value ${item.workedDaysThisYear === 0 ? 'td-num-zero' : ''}">${workedYear}</span>
                  </div>
                </div>
              </div>

              <!-- Nhóm 2: Nghỉ tháng này -->
              <div class="metric-group metric-group-abs-month">
                <div class="metric-group-title">NGHỈ THÁNG NÀY</div>
                <div class="metric-group-cells">
                  <div class="metric-cell">
                    <span class="metric-label">Hợp lệ</span>
                    <span class="metric-value ${item.validAbsencesThisMonth === 0 ? 'td-num-zero' : ''}">${valAbsMonth}</span>
                  </div>
                  <div class="metric-cell">
                    <span class="metric-label">Không hợp lệ</span>
                    <span class="metric-value ${item.invalidAbsencesThisMonth === 0 ? 'td-num-zero' : 'metric-value-warn'}">${invalAbsMonth}</span>
                  </div>
                </div>
              </div>

              <!-- Nhóm 3: Nghỉ cả năm -->
              <div class="metric-group metric-group-abs-year">
                <div class="metric-group-title">NGHỈ CẢ NĂM</div>
                <div class="metric-group-cells">
                  <div class="metric-cell">
                    <span class="metric-label">Hợp lệ</span>
                    <span class="metric-value ${item.validAbsencesThisYear === 0 ? 'td-num-zero' : ''}">${valAbsYear}</span>
                  </div>
                  <div class="metric-cell">
                    <span class="metric-label">Không hợp lệ</span>
                    <span class="metric-value ${item.invalidAbsencesThisYear === 0 ? 'td-num-zero' : 'metric-value-warn'}">${invalAbsYear}</span>
                  </div>
                </div>
              </div>
            </div>
          </article>
        `;
      }).join('');

      dom.mobileCardList.innerHTML = cardsHtml;
    }
  }

  /**
   * Định dạng số an toàn
   */
  function formatNumber(val) {
    if (typeof val !== 'number' || isNaN(val)) return '0';
    return String(val);
  }

  /**
   * Escape HTML chống XSS
   */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showConfigBanner() {
    if (dom.configBanner) {
      dom.configBanner.classList.remove('hidden');
    }
  }

  function hideConfigBanner() {
    if (dom.configBanner) {
      dom.configBanner.classList.add('hidden');
    }
  }

  /**
   * Áp dụng ngay bộ lọc Tháng & Năm khi người dùng thay đổi lựa chọn
   */
  function applyMonthYearFilter() {
    const m = parseInt(dom.filterMonth.value, 10);
    const y = parseInt(dom.filterYear.value, 10);

    if (!isNaN(m) && m >= 1 && m <= 12) {
      state.month = m;
    }
    if (!isNaN(y)) {
      state.year = y;
    }

    updateMonthDisplay();

    if (state.isMockMode) {
      state.items = getMockItems(state.year, state.month);
      renderTable();
    } else {
      fetchStatistics();
    }
  }

  /**
   * Thiết lập các sự kiện giao diện
   */
  function setupEvents() {
    // Ngăn reload trang nếu form được submit
    dom.filterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      applyMonthYearFilter();
    });

    // Áp dụng ngay khi đổi Tháng hoặc Năm
    dom.filterMonth.addEventListener('change', applyMonthYearFilter);
    dom.filterYear.addEventListener('change', applyMonthYearFilter);

    // Nút Thử lại trong Error State
    dom.btnRetry.addEventListener('click', () => {
      fetchStatistics();
    });

    // Nút Bật dữ liệu mẫu từ Error State
    if (dom.btnEnableMockFromError) {
      dom.btnEnableMockFromError.addEventListener('click', () => {
        setMockMode(true);
      });
    }

    // Nút công tắc Bật/Tắt dữ liệu mẫu trên Header
    if (dom.btnToggleMockData) {
      dom.btnToggleMockData.addEventListener('click', () => {
        setMockMode(!state.isMockMode);
      });
    }

    // Nút Kết nối lại máy chủ từ thanh thông báo Dữ liệu mẫu
    if (dom.btnRetryFromMock) {
      dom.btnRetryFromMock.addEventListener('click', () => {
        state.isMockMode = false;
        syncMockToggleUI();
        fetchStatistics();
      });
    }

    // Nút Tắt dữ liệu mẫu trên thanh thông báo
    if (dom.btnDisableMockBanner) {
      dom.btnDisableMockBanner.addEventListener('click', () => {
        setMockMode(false);
      });
    }

    // Mở rộng / Thu gọn thẻ nhân viên trên Mobile
    if (dom.mobileCardList) {
      dom.mobileCardList.addEventListener('click', (e) => {
        const headerBtn = e.target.closest('.employee-card-header');
        if (!headerBtn) return;

        const card = headerBtn.closest('.employee-card');
        if (!card) return;

        const isExpanded = card.classList.toggle('is-expanded');
        headerBtn.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
      });
    }
  }

  /**
   * Khởi chạy ứng dụng
   */
  function init() {
    initFilterInputs();
    setupEvents();

    if (!isApiConfigured()) {
      state.serverUnreachable = true;
      syncMockToggleUI();
      setViewState('CONFIG_REQUIRED');
    } else {
      fetchStatistics();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
