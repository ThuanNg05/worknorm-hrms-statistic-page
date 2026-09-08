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
    searchQuery: '',
    sortColumn: 'employeeName',
    sortDirection: 'asc', // 'asc' | 'desc'
    items: [],
    isLoading: false,
    abortController: null,
  };

  // DOM Element References
  const dom = {
    configBanner: document.getElementById('configBanner'),
    inlineConfigForm: document.getElementById('inlineConfigForm'),
    inlineApiBaseUrlInput: document.getElementById('inlineApiBaseUrlInput'),

    filterForm: document.getElementById('filterForm'),
    filterMonth: document.getElementById('filterMonth'),
    filterYear: document.getElementById('filterYear'),
    filterSearch: document.getElementById('filterSearch'),
    btnResetSearch: document.getElementById('btnResetSearch'),

    currentMonthDisplay: document.getElementById('currentMonthDisplay'),
    recordCountText: document.getElementById('recordCountText'),

    tableWrapper: document.getElementById('tableWrapper'),
    tableBody: document.getElementById('tableBody'),
    sortableHeaders: document.querySelectorAll('.sortable-th'),

    stateLoading: document.getElementById('stateLoading'),
    stateError: document.getElementById('stateError'),
    errorMessageTitle: document.getElementById('errorMessageTitle'),
    errorMessageDesc: document.getElementById('errorMessageDesc'),
    btnRetry: document.getElementById('btnRetry'),
    btnOpenConfigFromError: document.getElementById('btnOpenConfigFromError'),

    stateEmpty: document.getElementById('stateEmpty'),
    emptyMessageDesc: document.getElementById('emptyMessageDesc'),

    btnOpenSettings: document.getElementById('btnOpenSettings'),
    settingsModal: document.getElementById('settingsModal'),
    btnCloseModal: document.getElementById('btnCloseModal'),
    btnCancelModal: document.getElementById('btnCancelModal'),
    modalConfigForm: document.getElementById('modalConfigForm'),
    modalApiBaseUrlInput: document.getElementById('modalApiBaseUrlInput'),
    btnResetConfig: document.getElementById('btnResetConfig'),
  };

  /**
   * Lấy apiBaseUrl từ runtime config hoặc config.js.
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
   * Cập nhật URL máy chủ API cho phiên hiện tại
   */
  function setApiBaseUrl(url) {
    runtimeApiBaseUrl = (url || '').trim().replace(/\/+$/, '');
    // Đảm bảo không lưu vào localStorage
    try {
      localStorage.removeItem(STORAGE_KEY_API_BASE);
    } catch (_) {}
  }

  /**
   * Kiểm tra API base URL đã được cấu hình hay chưa
   */
  function isApiConfigured() {
    return Boolean(getApiBaseUrl());
  }

  /**
   * Quản lý trạng thái giao diện LOẠI TRỪ NHAU:
   * - LOADING: chỉ hiện loading.
   * - DATA: chỉ hiện bảng.
   * - EMPTY: chỉ hiện empty state.
   * - ERROR: chỉ hiện error state.
   * - CONFIG_REQUIRED: chỉ hiện banner cấu hình khi chưa có URL.
   */
  function setViewState(viewState, payload = {}) {
    // Luôn ẩn toàn bộ các trạng thái trước để bảo đảm loại trừ nhau tuyệt đối
    dom.stateLoading.classList.add('hidden');
    dom.tableWrapper.classList.add('hidden');
    dom.stateEmpty.classList.add('hidden');
    dom.stateError.classList.add('hidden');

    switch (viewState) {
      case 'LOADING':
        dom.stateLoading.classList.remove('hidden');
        dom.recordCountText.textContent = 'Đang tải dữ liệu...';
        break;

      case 'DATA':
        dom.tableWrapper.classList.remove('hidden');
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
        dom.errorMessageDesc.textContent = payload.desc || 'Vui lòng kiểm tra lại địa chỉ máy chủ API hoặc kết nối mạng.';
        dom.recordCountText.textContent = 'Lỗi truy vấn';
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
   * Khởi tạo giá trị ban đầu cho các ô lọc tháng/năm
   */
  function initFilterInputs() {
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
   * Không dùng dữ liệu demo tự động; chỉ dùng dữ liệu API thật.
   */
  async function fetchStatistics() {
    const baseUrl = getApiBaseUrl();

    if (!baseUrl) {
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

      // Trong catch: luôn tắt loading và hiển thị duy nhất error state
      const title = 'Không thể tải dữ liệu thống kê';
      let desc = err.message;
      if (err.name === 'AbortError') {
        desc = 'Hết thời gian chờ phản hồi (Timeout) hoặc yêu cầu đã bị hủy.';
      } else if (err.message && err.message.includes('Failed to fetch')) {
        desc = `Không thể kết nối đến máy chủ API (${baseUrl}). Vui lòng kiểm tra backend đang chạy trên port 18080 và CORS đã được cho phép.`;
      }

      setViewState('ERROR', { title, desc });
    } finally {
      // Trong finally: luôn đảm bảo tắt loading
      state.isLoading = false;
      dom.stateLoading.classList.add('hidden');
      state.abortController = null;
    }
  }

  /**
   * Lọc theo từ khóa tìm kiếm và sắp xếp cột theo hợp đồng dữ liệu:
   * employeeName, workedDaysThisMonth, workedDaysThisYear,
   * validAbsencesThisMonth, invalidAbsencesThisMonth,
   * validAbsencesThisYear, invalidAbsencesThisYear
   */
  function getProcessedItems() {
    let list = state.items.slice();

    // Tìm kiếm theo tên nhân viên
    const q = state.searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((item) => {
        const name = (item.employeeName || '').toLowerCase();
        return name.includes(q);
      });
    }

    // Sắp xếp
    const col = state.sortColumn;
    const dir = state.sortDirection === 'asc' ? 1 : -1;

    list.sort((a, b) => {
      if (col === 'employeeName') {
        const nameA = a.employeeName || '';
        const nameB = b.employeeName || '';
        return dir * nameA.localeCompare(nameB, 'vi', { sensitivity: 'base' });
      }

      const numA = typeof a[col] === 'number' ? a[col] : 0;
      const numB = typeof b[col] === 'number' ? b[col] : 0;
      return dir * (numA - numB);
    });

    return list;
  }

  /**
   * Render danh sách các dòng trong bảng thống kê
   */
  function renderTable() {
    const list = getProcessedItems();

    // Cập nhật nhãn số lượng nhân viên
    const total = state.items.length;
    const visible = list.length;
    if (state.searchQuery.trim()) {
      dom.recordCountText.textContent = `Hiển thị ${visible} / ${total} nhân viên`;
    } else {
      dom.recordCountText.textContent = `Tổng số ${total} nhân viên`;
    }

    // Cập nhật biểu tượng và thuộc tính sắp xếp tiêu đề
    dom.sortableHeaders.forEach((th) => {
      const col = th.getAttribute('data-sort');
      const icon = th.querySelector('.sort-icon');
      if (col === state.sortColumn) {
        th.setAttribute('aria-sort', state.sortDirection === 'asc' ? 'ascending' : 'descending');
        if (icon) icon.textContent = state.sortDirection === 'asc' ? '▲' : '▼';
      } else {
        th.setAttribute('aria-sort', 'none');
        if (icon) icon.textContent = '⇅';
      }
    });

    // Nếu lọc tìm kiếm không ra kết quả
    if (list.length === 0) {
      if (state.items.length > 0) {
        setViewState('EMPTY', {
          desc: `Không tìm thấy nhân viên nào khớp với từ khóa "${state.searchQuery}".`,
        });
      } else {
        setViewState('EMPTY');
      }
      return;
    }

    // Hiển thị bảng
    setViewState('DATA');

    // Tạo HTML các dòng
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
    dom.configBanner.classList.remove('hidden');
    dom.inlineApiBaseUrlInput.value = getApiBaseUrl();
  }

  function hideConfigBanner() {
    dom.configBanner.classList.add('hidden');
  }

  /**
   * Thiết lập các sự kiện giao diện
   */
  function setupEvents() {
    // Bộ lọc tháng và năm
    dom.filterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const m = parseInt(dom.filterMonth.value, 10);
      const y = parseInt(dom.filterYear.value, 10);

      if (isNaN(m) || m < 1 || m > 12) {
        alert('Vui lòng chọn tháng hợp lệ từ 1 đến 12.');
        return;
      }
      if (isNaN(y) || y < 2000 || y > 2100) {
        alert('Vui lòng nhập năm hợp lệ từ 2000 đến 2100.');
        return;
      }

      state.month = m;
      state.year = y;
      updateMonthDisplay();
      fetchStatistics();
    });

    // Thay đổi tháng tự động tải lại
    dom.filterMonth.addEventListener('change', () => {
      state.month = parseInt(dom.filterMonth.value, 10);
      updateMonthDisplay();
      fetchStatistics();
    });

    // Tìm kiếm tức thì theo tên nhân viên
    dom.filterSearch.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      if (state.items.length > 0) {
        renderTable();
      }
    });

    // Đặt lại ô tìm kiếm
    dom.btnResetSearch.addEventListener('click', () => {
      dom.filterSearch.value = '';
      state.searchQuery = '';
      if (state.items.length > 0) {
        renderTable();
      }
    });

    // Nút Thử lại trong Error State
    dom.btnRetry.addEventListener('click', () => {
      fetchStatistics();
    });

    // Mở cài đặt URL từ Error State
    dom.btnOpenConfigFromError.addEventListener('click', () => {
      openSettingsModal();
    });

    // Nhấn tiêu đề cột để sắp xếp
    dom.sortableHeaders.forEach((th) => {
      th.addEventListener('click', () => {
        const col = th.getAttribute('data-sort');
        if (!col) return;

        if (state.sortColumn === col) {
          state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortColumn = col;
          // Mặc định cột chuỗi sắp xếp tăng dần, cột số sắp xếp giảm dần
          state.sortDirection = col === 'employeeName' ? 'asc' : 'desc';
        }

        renderTable();
      });
    });

    // Form cấu hình inline trên banner
    dom.inlineConfigForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = dom.inlineApiBaseUrlInput.value.trim();
      setApiBaseUrl(val);
      fetchStatistics();
    });

    // Modal cấu hình
    dom.btnOpenSettings.addEventListener('click', () => {
      openSettingsModal();
    });

    dom.btnCloseModal.addEventListener('click', () => {
      closeSettingsModal();
    });

    dom.btnCancelModal.addEventListener('click', () => {
      closeSettingsModal();
    });

    dom.settingsModal.addEventListener('click', (e) => {
      if (e.target === dom.settingsModal) {
        closeSettingsModal();
      }
    });

    dom.modalConfigForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = dom.modalApiBaseUrlInput.value.trim();
      setApiBaseUrl(val);
      closeSettingsModal();
      fetchStatistics();
    });

    // Khôi phục mặc định (xóa override runtime)
    dom.btnResetConfig.addEventListener('click', () => {
      setApiBaseUrl('');
      dom.modalApiBaseUrlInput.value = getApiBaseUrl();
      closeSettingsModal();
      fetchStatistics();
    });

    // Đóng modal bằng phím Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !dom.settingsModal.classList.contains('hidden')) {
        closeSettingsModal();
      }
    });
  }

  function openSettingsModal() {
    dom.modalApiBaseUrlInput.value = getApiBaseUrl();
    dom.settingsModal.classList.remove('hidden');
    dom.modalApiBaseUrlInput.focus();
  }

  function closeSettingsModal() {
    dom.settingsModal.classList.add('hidden');
  }

  /**
   * Khởi chạy ứng dụng
   */
  function init() {
    initFilterInputs();
    setupEvents();

    if (!isApiConfigured()) {
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
