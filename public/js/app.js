/**
 * Website, Domain & Software Management Panel - Client Application
 * Database: MongoDB Atlas
 */

// State
const state = {
  currentMainTab: 'websites', // 'websites' or 'software'
  user: null,
  records: [],
  softwareRecords: [],
  dashboard: {},
  currentFilterPill: 'all',
  currentSoftwareCategory: 'all',
  sortBy: 'created_at',
  sortOrder: 'desc',
  viewMode: localStorage.getItem('mgmt_view_mode') || 'table',
  theme: localStorage.getItem('mgmt_theme') || 'dark',
  activeRecord: null,
  deleteTargetId: null,
  deleteTargetType: 'website' // 'website' or 'software'
};

// ==========================================
// Utility Functions
// ==========================================

function formatINR(val) {
  const num = parseFloat(val);
  if (isNaN(num)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(num);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
      return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
    }
    return dateStr;
  } catch (e) {
    return dateStr;
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let iconSvg = '';
  if (type === 'success') {
    iconSvg = '<svg class="icon icon-sm" style="color: var(--success);" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
  } else if (type === 'error') {
    iconSvg = '<svg class="icon icon-sm" style="color: var(--danger);" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
  } else {
    iconSvg = '<svg class="icon icon-sm" style="color: var(--info);" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
  }

  toast.innerHTML = `${iconSvg}<span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function copyToClipboard(text, btnElement) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied to clipboard: ' + text, 'info');
    if (btnElement) {
      const orig = btnElement.innerHTML;
      btnElement.innerHTML = 'Copied!';
      setTimeout(() => btnElement.innerHTML = orig, 1500);
    }
  }).catch(() => {
    showToast(text, 'info');
  });
}

function getAuthHeaders() {
  const token = localStorage.getItem('mgmt_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// ==========================================
// Tab Switching: Websites vs Software
// ==========================================

function switchMainTab(tab) {
  state.currentMainTab = tab;
  const websitesBtn = document.getElementById('navTabWebsites');
  const softwareBtn = document.getElementById('navTabSoftware');
  const websitesContent = document.getElementById('websitesTabContent');
  const softwareContent = document.getElementById('softwareTabContent');
  const headerAddBtnText = document.getElementById('headerAddBtnText');

  if (tab === 'websites') {
    websitesBtn.classList.add('active');
    softwareBtn.classList.remove('active');
    websitesContent.style.display = 'block';
    softwareContent.style.display = 'none';
    headerAddBtnText.textContent = 'Add Website';
    loadWebsites();
  } else {
    softwareBtn.classList.add('active');
    websitesBtn.classList.remove('active');
    websitesContent.style.display = 'none';
    softwareContent.style.display = 'block';
    headerAddBtnText.textContent = 'Add Software / App';
    loadSoftware();
  }
}

function handleHeaderAddClick() {
  if (state.currentMainTab === 'websites') {
    openAddModal();
  } else {
    openAddSoftwareModal();
  }
}

// ==========================================
// Authentication & Session
// ==========================================

async function checkAuthSession() {
  const urlParams = new URLSearchParams(window.location.search);
  const queryToken = urlParams.get('token');
  if (queryToken) {
    localStorage.setItem('mgmt_token', queryToken);
    window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
  }

  const token = localStorage.getItem('mgmt_token');
  if (!token) {
    showLoginView();
    return;
  }

  try {
    const res = await fetch('/api/auth/me', { headers: getAuthHeaders() });
    if (res.ok) {
      const data = await res.json();
      state.user = data.user;
      showAppView();
    } else {
      localStorage.removeItem('mgmt_token');
      showLoginView();
    }
  } catch (err) {
    showLoginView();
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const usernameInput = document.getElementById('loginUsername');
  const passwordInput = document.getElementById('loginPassword');
  const alertBox = document.getElementById('loginAlert');
  const submitBtn = document.getElementById('loginSubmitBtn');

  alertBox.style.display = 'none';
  submitBtn.disabled = true;
  submitBtn.innerHTML = 'Connecting to MongoDB Atlas...';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: usernameInput.value.trim(),
        password: passwordInput.value
      })
    });

    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('mgmt_token', data.token);
      state.user = data.user;
      showToast('Welcome back, ' + data.user.username + '! Connected to MongoDB Atlas.', 'success');
      showAppView();
    } else {
      alertBox.textContent = data.error || 'Login failed. Please check credentials.';
      alertBox.style.display = 'block';
    }
  } catch (err) {
    alertBox.textContent = 'Connection error. Please ensure server is running.';
    alertBox.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span>Secure Sign In</span><svg class="icon icon-sm" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>';
  }
}

async function handleLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', headers: getAuthHeaders() });
  } catch (e) {}

  localStorage.removeItem('mgmt_token');
  state.user = null;
  showToast('Logged out securely.', 'info');
  showLoginView();
}

function showLoginView() {
  document.getElementById('loginView').style.display = 'flex';
  document.getElementById('appView').style.display = 'none';
  const u = document.getElementById('loginUsername');
  const p = document.getElementById('loginPassword');
  if (u) u.value = '';
  if (p) p.value = '';
}

function showAppView() {
  document.getElementById('loginView').style.display = 'none';
  document.getElementById('appView').style.display = 'block';

  if (state.user) {
    document.getElementById('headerUsername').textContent = state.user.username;
  }

  loadDashboardStats();
  if (window.location.hash === '#software') {
    switchMainTab('software');
  } else {
    loadWebsites();
    loadSoftware();
  }
}

function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    btn.innerHTML = '<svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
  } else {
    input.type = 'password';
    btn.innerHTML = '<svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
  }
}

// ==========================================
// Change Password Modal
// ==========================================

function openChangePasswordModal() {
  document.getElementById('changePasswordForm').reset();
  const alertBox = document.getElementById('passwordAlert');
  alertBox.style.display = 'none';
  openModal('changePasswordModal');
}

async function handleChangePassword(e) {
  e.preventDefault();
  const currentPassword = document.getElementById('currPasswordInput').value.trim();
  const newPassword = document.getElementById('newPasswordInput').value.trim();
  const confirmPassword = document.getElementById('confirmPasswordInput').value.trim();
  const alertBox = document.getElementById('passwordAlert');
  const submitBtn = document.getElementById('changePasswordBtn');

  alertBox.style.display = 'none';

  if (!newPassword || newPassword.length < 4) {
    alertBox.textContent = 'New password must be at least 4 characters long.';
    alertBox.style.display = 'block';
    return;
  }

  if (newPassword !== confirmPassword) {
    alertBox.textContent = 'New passwords do not match.';
    alertBox.style.display = 'block';
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Updating MongoDB...';

  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
    });

    const data = await res.json();
    if (res.ok) {
      if (data.token) {
        localStorage.setItem('mgmt_token', data.token);
      }
      if (data.user) {
        state.user = data.user;
      }
      showToast('Password changed successfully! New password is now active.', 'success');
      closeModal('changePasswordModal');
    } else {
      alertBox.textContent = data.error || 'Failed to change password.';
      alertBox.style.display = 'block';
    }
  } catch (err) {
    alertBox.textContent = 'Server error. Please try again.';
    alertBox.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Update Password';
  }
}

// ==========================================
// Dashboard Stats
// ==========================================

async function loadDashboardStats() {
  try {
    const res = await fetch('/api/websites/dashboard/stats', { headers: getAuthHeaders() });
    if (!res.ok) return;
    const stats = await res.json();
    state.dashboard = stats;

    document.getElementById('kpiTotalWebsites').textContent = stats.total_websites || 0;
    document.getElementById('kpiForSale').textContent = stats.total_for_sale || 0;
    document.getElementById('kpiSold').textContent = stats.total_sold || 0;
    document.getElementById('kpiPaymentReceived').textContent = formatINR(stats.total_payment_received || 0);
    document.getElementById('kpiPendingPayment').textContent = formatINR(stats.total_pending_payment || 0);
    document.getElementById('kpiClearedPayment').textContent = formatINR(stats.total_cleared_payment || 0);
    document.getElementById('kpiExpiringSoon').textContent = stats.total_expiring_30_days || 0;
    document.getElementById('kpiExpired').textContent = stats.total_expired || 0;
    document.getElementById('kpiActive').textContent = stats.total_active || 0;
    document.getElementById('kpiAdminGiven').textContent = stats.total_admin_access_given || 0;
    document.getElementById('kpiAdminNotGiven').textContent = stats.total_admin_access_not_given || 0;

    document.getElementById('pillCountAll').textContent = stats.total_websites || 0;
    document.getElementById('pillCountExpiring30').textContent = stats.total_expiring_30_days || 0;
    document.getElementById('pillCountExpired').textContent = stats.total_expired || 0;
    document.getElementById('pillCountActive').textContent = stats.total_active || 0;
    document.getElementById('pillCountForSale').textContent = stats.total_for_sale || 0;
    document.getElementById('pillCountSold').textContent = stats.total_sold || 0;
    document.getElementById('pillCountAdminYes').textContent = stats.total_admin_access_given || 0;
    document.getElementById('pillCountAdminNo').textContent = stats.total_admin_access_not_given || 0;

    document.getElementById('totalRecordsCount').textContent = stats.total_websites || 0;
    document.getElementById('navWebsitesCount').textContent = stats.total_websites || 0;
    if (stats.total_software_apps !== undefined) {
      document.getElementById('navSoftwareCount').textContent = stats.total_software_apps || 0;
    }
  } catch (err) {
    console.error('Failed to load dashboard:', err);
  }
}

// ==========================================
// Websites & Domains Fetching & Filtering
// ==========================================

let searchDebounceTimeout = null;
function handleSearchInput() {
  const query = document.getElementById('searchInput').value;
  const clearBtn = document.getElementById('searchClearBtn');
  clearBtn.style.display = query ? 'block' : 'none';

  clearTimeout(searchDebounceTimeout);
  searchDebounceTimeout = setTimeout(() => {
    loadWebsites();
  }, 250);
}

function clearSearch() {
  document.getElementById('searchInput').value = '';
  document.getElementById('searchClearBtn').style.display = 'none';
  loadWebsites();
}

function filterByQuickPill(filterKey) {
  state.currentFilterPill = filterKey;

  document.querySelectorAll('.filter-pills-row .filter-pill').forEach(pill => {
    if (pill.getAttribute('data-filter') === filterKey) {
      pill.classList.add('active');
    } else if (pill.getAttribute('data-filter')) {
      pill.classList.remove('active');
    }
  });

  loadWebsites();
}

function toggleAdvancedFilters() {
  const panel = document.getElementById('advancedFiltersPanel');
  panel.classList.toggle('open');
}

function applyFilters() {
  checkActiveFilterBadge();
  loadWebsites();
}

function resetAdvancedFilters() {
  document.getElementById('filterDateFrom').value = '';
  document.getElementById('filterDateTo').value = '';
  document.getElementById('filterMinPayment').value = '';
  document.getElementById('filterMaxPayment').value = '';
  checkActiveFilterBadge();
  loadWebsites();
}

function checkActiveFilterBadge() {
  const dateFrom = document.getElementById('filterDateFrom').value;
  const dateTo = document.getElementById('filterDateTo').value;
  const minP = document.getElementById('filterMinPayment').value;
  const maxP = document.getElementById('filterMaxPayment').value;

  const badge = document.getElementById('activeFilterBadge');
  if (dateFrom || dateTo || minP || maxP) {
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}

function handleSort(column) {
  if (state.sortBy === column) {
    state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
  } else {
    state.sortBy = column;
    state.sortOrder = 'asc';
  }

  document.querySelectorAll('.sort-indicator').forEach(ind => ind.textContent = '↕');
  const activeInd = document.getElementById(`sort_${column}`);
  if (activeInd) {
    activeInd.textContent = state.sortOrder === 'asc' ? '▲' : '▼';
    const th = activeInd.closest('th');
    if (th) {
      document.querySelectorAll('.data-table th').forEach(h => h.classList.remove('sorted'));
      th.classList.add('sorted');
    }
  }

  loadWebsites();
}

async function loadWebsites() {
  const search = document.getElementById('searchInput').value.trim();
  const dateType = document.getElementById('filterDateType').value;
  const dateFrom = document.getElementById('filterDateFrom').value;
  const dateTo = document.getElementById('filterDateTo').value;
  const minPayment = document.getElementById('filterMinPayment').value;
  const maxPayment = document.getElementById('filterMaxPayment').value;

  const params = new URLSearchParams();
  if (search) params.append('search', search);

  if (state.currentFilterPill === 'expiring_30') params.append('expiry_filter', 'expiring_30');
  else if (state.currentFilterPill === 'expired') params.append('expiry_filter', 'expired');
  else if (state.currentFilterPill === 'active') params.append('expiry_filter', 'active');
  else if (state.currentFilterPill === 'for_sale') params.append('sale_status', 'For Sale');
  else if (state.currentFilterPill === 'sold') params.append('sale_status', 'Sold');
  else if (state.currentFilterPill === 'admin_yes') params.append('admin_access', 'yes');
  else if (state.currentFilterPill === 'admin_no') params.append('admin_access', 'no');

  if (dateFrom) { params.append('date_type', dateType); params.append('date_from', dateFrom); }
  if (dateTo) { params.append('date_type', dateType); params.append('date_to', dateTo); }
  if (minPayment) params.append('min_payment', minPayment);
  if (maxPayment) params.append('max_payment', maxPayment);

  params.append('sort_by', state.sortBy);
  params.append('sort_order', state.sortOrder);

  try {
    const res = await fetch(`/api/websites?${params.toString()}`, { headers: getAuthHeaders() });
    if (!res.ok) {
      if (res.status === 401) checkAuthSession();
      return;
    }

    const data = await res.json();
    state.records = data.records;
    document.getElementById('displayedRecordsCount').textContent = data.records.length;
    document.getElementById('navWebsitesCount').textContent = data.records.length;

    renderRecords(data.records);
  } catch (err) {
    console.error('Error fetching websites:', err);
    showToast('Failed to retrieve website records from MongoDB.', 'error');
  }
}

// ==========================================
// Rendering Websites Views
// ==========================================

function handleRowClick(event, id) {
  if (event.target.closest('a') || event.target.closest('button') || event.target.closest('input')) {
    return;
  }
  viewWebsiteDetails(id);
}

function renderRecords(records) {
  const tableBody = document.getElementById('websiteTableBody');
  const cardsContainer = document.getElementById('cardsView');
  const emptyState = document.getElementById('emptyState');
  const tableView = document.getElementById('tableView');

  if (!records || records.length === 0) {
    tableBody.innerHTML = '';
    cardsContainer.innerHTML = '';
    tableView.style.display = 'none';
    cardsContainer.style.display = 'none';
    emptyState.style.display = 'block';

    const search = document.getElementById('searchInput').value;
    if (search || state.currentFilterPill !== 'all') {
      document.getElementById('emptyStateTitle').textContent = 'No matching records found';
      document.getElementById('emptyStateDesc').textContent = 'Try adjusting your search terms or resetting filters.';
    } else {
      document.getElementById('emptyStateTitle').textContent = 'No website records in MongoDB';
      document.getElementById('emptyStateDesc').textContent = 'Store websites, domains, payment amounts, and track expiry dates seamlessly.';
    }
    return;
  }

  emptyState.style.display = 'none';

  if (state.viewMode === 'table') {
    tableView.style.display = 'block';
    cardsContainer.style.display = 'none';
  } else {
    tableView.style.display = 'none';
    cardsContainer.style.display = 'grid';
  }

  tableBody.innerHTML = records.map(record => {
    let expiryBadge = '';
    if (record.days_remaining === null) {
      expiryBadge = '<span class="badge badge-slate">No Expiry</span>';
    } else if (record.days_remaining < 0) {
      const daysAgo = Math.abs(record.days_remaining);
      expiryBadge = `<span class="badge badge-danger"><span class="badge-dot"></span>Expired (${daysAgo}d)</span>`;
    } else if (record.days_remaining <= 30) {
      expiryBadge = `<span class="badge badge-warning"><span class="badge-dot"></span>Expiring (${record.days_remaining}d)</span>`;
    } else {
      expiryBadge = `<span class="badge badge-active"><span class="badge-dot"></span>Active (${record.days_remaining}d)</span>`;
    }

    let saleBadge = '';
    if (record.sale_status === 'For Sale') {
      saleBadge = `<span class="badge badge-info"><span class="badge-dot"></span>For Sale${record.selling_price ? ' (' + formatINR(record.selling_price) + ')' : ''}</span>`;
    } else if (record.sale_status === 'Sold') {
      saleBadge = `<span class="badge badge-purple"><span class="badge-dot"></span>Sold</span>`;
    } else {
      saleBadge = `<span class="badge badge-slate">Not for Sale</span>`;
    }

    const adminBadge = record.admin_access_given
      ? `<span class="badge badge-active" title="${record.admin_name ? 'Admin: ' + escapeHtml(record.admin_name) : 'Access Given'}"><span class="badge-dot"></span>Yes</span>`
      : `<span class="badge badge-slate">No</span>`;

    const pendingClass = record.pending_amount > 0 ? 'cell-currency pending' : 'cell-currency paid';
    const pendingDisplay = record.pending_amount > 0 ? formatINR(record.pending_amount) : '₹0 (Paid)';

    return `
      <tr onclick="handleRowClick(event, '${record.id}')" class="clickable-row">
        <td>
          <div class="cell-website-name">${escapeHtml(record.website_name)}</div>
          <div class="cell-client-subtext">Client: ${escapeHtml(record.client_name)}</div>
        </td>
        <td>
          <a href="${escapeHtml(record.website_url)}" target="_blank" rel="noopener noreferrer" class="cell-url-link" title="Open ${escapeHtml(record.website_url)} in new tab">
            <span>${escapeHtml(record.website_url.replace(/^https?:\/\//i, ''))}</span>
            <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          </a>
        </td>
        <td>${formatDate(record.website_built_date)}</td>
        <td>
          <div>${formatDate(record.domain_purchase_date)}</div>
          <div class="cell-client-subtext cell-registrar-text" title="${record.domain_registrar ? escapeHtml(record.domain_registrar) : ''}">${record.domain_duration_years || 1} yr • ${record.domain_registrar ? escapeHtml(record.domain_registrar) : 'Vercel'}</div>
        </td>
        <td>${formatDate(record.domain_expiry_date)}</td>
        <td>${expiryBadge}</td>
        <td><span class="cell-currency received">${formatINR(record.payment_received)}</span></td>
        <td><span class="${pendingClass}">${pendingDisplay}</span></td>
        <td>${saleBadge}</td>
        <td>${adminBadge}</td>
        <td style="text-align: right;">
          <div class="action-buttons-cell" style="justify-content: flex-end;">
            <button class="btn-table-action" onclick="viewWebsiteDetails('${record.id}')" title="View Complete Details">
              <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            </button>
            <button class="btn-table-action" onclick="openEditModal('${record.id}')" title="Edit Record">
              <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
            </button>
            <button class="btn-table-action delete" onclick="openDeleteConfirm('${record.id}', '${escapeHtml(record.website_name.replace(/'/g, "\\'"))}', 'website')" title="Delete Record">
              <svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  cardsContainer.innerHTML = records.map(record => {
    let expiryBadge = '';
    if (record.days_remaining === null) {
      expiryBadge = '<span class="badge badge-slate">No Expiry Date</span>';
    } else if (record.days_remaining < 0) {
      expiryBadge = `<span class="badge badge-danger">Expired (${Math.abs(record.days_remaining)}d ago)</span>`;
    } else if (record.days_remaining <= 30) {
      expiryBadge = `<span class="badge badge-warning">Expiring (${record.days_remaining}d left)</span>`;
    } else {
      expiryBadge = `<span class="badge badge-active">Active (${record.days_remaining}d left)</span>`;
    }

    return `
      <div class="site-card">
        <div class="site-card-header">
          <div>
            <h4 class="site-card-title">${escapeHtml(record.website_name)}</h4>
            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.15rem;">
              Client: ${escapeHtml(record.client_name)}
            </div>
          </div>
          <div>${expiryBadge}</div>
        </div>

        <div>
          <a href="${escapeHtml(record.website_url)}" target="_blank" rel="noopener noreferrer" class="cell-url-link">
            <span>${escapeHtml(record.website_url.replace(/^https?:\/\//i, ''))}</span>
            <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          </a>
        </div>

        <div class="site-card-grid-meta">
          <div class="meta-item">
            <span class="meta-label">Built Date</span>
            <span class="meta-value">${formatDate(record.website_built_date)}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Expiry Date</span>
            <span class="meta-value">${formatDate(record.domain_expiry_date)}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Payment Received</span>
            <span class="meta-value" style="color: var(--success);">${formatINR(record.payment_received)}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Pending Amount</span>
            <span class="meta-value" style="color: ${record.pending_amount > 0 ? 'var(--warning)' : 'var(--text-muted)'};">
              ${record.pending_amount > 0 ? formatINR(record.pending_amount) : '₹0 (Paid)'}
            </span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Sale Status</span>
            <span class="meta-value">${escapeHtml(record.sale_status)}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Admin Access</span>
            <span class="meta-value">${record.admin_access_given ? 'Yes' : 'No'}</span>
          </div>
        </div>

        <div class="site-card-footer">
          <button class="btn btn-secondary" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;" onclick="viewWebsiteDetails('${record.id}')">
            View Details
          </button>
          <div class="action-buttons-cell">
            <button class="btn-table-action" onclick="openEditModal('${record.id}')" title="Edit">
              <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
            </button>
            <button class="btn-table-action delete" onclick="openDeleteConfirm('${record.id}', '${escapeHtml(record.website_name.replace(/'/g, "\\'"))}', 'website')" title="Delete">
              <svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function setViewMode(mode) {
  state.viewMode = mode;
  localStorage.setItem('mgmt_view_mode', mode);

  const tableBtn = document.getElementById('viewModeTableBtn');
  const cardsBtn = document.getElementById('viewModeCardsBtn');

  if (mode === 'table') {
    tableBtn.classList.add('active');
    cardsBtn.classList.remove('active');
  } else {
    tableBtn.classList.remove('active');
    cardsBtn.classList.add('active');
  }

  renderRecords(state.records);
}

// ==========================================
// Add / Edit Website Modal Logic
// ==========================================

function openAddModal() {
  document.getElementById('websiteForm').reset();
  document.getElementById('formWebsiteId').value = '';
  document.getElementById('modalTitleText').textContent = 'Add New Website Record';
  document.getElementById('formDurationYears').value = 1;
  document.getElementById('formTotalPrice').value = 0;
  document.getElementById('formPaymentReceived').value = 0;
  document.getElementById('formPendingAmount').value = '₹0';
  document.getElementById('formSaleStatus').value = 'Not for Sale';
  document.getElementById('formAdminAccessGiven').value = '0';

  onSaleStatusChange();
  onAdminAccessChange();
  updateLiveExpiryPreview();

  openModal('websiteModal');
}

async function openEditModal(id) {
  try {
    const res = await fetch(`/api/websites/${id}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load website');
    const record = await res.json();

    document.getElementById('formWebsiteId').value = record.id;
    document.getElementById('modalTitleText').textContent = `Edit Website: ${record.website_name}`;

    document.getElementById('formWebsiteName').value = record.website_name || '';
    document.getElementById('formWebsiteUrl').value = record.website_url || '';
    document.getElementById('formClientName').value = record.client_name || '';
    document.getElementById('formContactInfo').value = record.contact_info || '';

    document.getElementById('formBuiltDate').value = record.website_built_date || '';
    document.getElementById('formPurchaseDate').value = record.domain_purchase_date || '';
    document.getElementById('formRegistrar').value = record.domain_registrar || '';
    document.getElementById('formDurationYears').value = record.domain_duration_years || 1;
    document.getElementById('formExpiryDate').value = record.domain_expiry_date || '';

    document.getElementById('formTotalPrice').value = record.total_price || 0;
    document.getElementById('formPaymentReceived').value = record.payment_received || 0;
    document.getElementById('formPaymentDate').value = record.payment_date || '';
    document.getElementById('formPaymentNotes').value = record.payment_notes || '';

    document.getElementById('formSaleStatus').value = record.sale_status || 'Not for Sale';
    document.getElementById('formSellingPrice').value = record.selling_price !== null ? record.selling_price : '';
    document.getElementById('formSoldDate').value = record.sold_date || '';

    document.getElementById('formAdminAccessGiven').value = record.admin_access_given ? '1' : '0';
    document.getElementById('formAdminName').value = record.admin_name || '';
    document.getElementById('formAdminGivenDate').value = record.admin_given_date || '';

    document.getElementById('formNotes').value = record.notes || '';

    onPriceOrPaymentChange();
    onSaleStatusChange();
    onAdminAccessChange();
    updateLiveExpiryPreview();

    openModal('websiteModal');
  } catch (err) {
    showToast('Failed to load website data for editing.', 'error');
  }
}

function onPurchaseDateOrDurationChange() {
  const purchaseDate = document.getElementById('formPurchaseDate').value;
  const durationYears = parseInt(document.getElementById('formDurationYears').value, 10) || 1;

  if (purchaseDate) {
    const parts = purchaseDate.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10) + durationYears;
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      const newDate = new Date(Date.UTC(y, m - 1, d));
      document.getElementById('formExpiryDate').value = newDate.toISOString().split('T')[0];
    }
  }

  updateLiveExpiryPreview();
}

function updateLiveExpiryPreview() {
  const expiryDate = document.getElementById('formExpiryDate').value;
  const badge = document.getElementById('formLiveExpiryBadge');

  if (!expiryDate) {
    badge.className = 'badge badge-slate';
    badge.textContent = 'No expiry set';
    return;
  }

  const today = new Date();
  const todayMidnight = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const parts = expiryDate.split('-');
  if (parts.length !== 3) {
    badge.className = 'badge badge-slate';
    badge.textContent = 'Invalid date';
    return;
  }

  const expDate = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
  const diffDays = Math.round((expDate - todayMidnight) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    badge.className = 'badge badge-danger';
    badge.textContent = `Expired (${Math.abs(diffDays)} days ago)`;
  } else if (diffDays <= 30) {
    badge.className = 'badge badge-warning';
    badge.textContent = `Expiring Soon (${diffDays} days remaining)`;
  } else {
    badge.className = 'badge badge-active';
    badge.textContent = `Active (${diffDays} days remaining)`;
  }
}

function onPriceOrPaymentChange() {
  const total = parseFloat(document.getElementById('formTotalPrice').value) || 0;
  const received = parseFloat(document.getElementById('formPaymentReceived').value) || 0;
  const pending = Math.max(0, total - received);
  document.getElementById('formPendingAmount').value = formatINR(pending);
}

function onSaleStatusChange() {
  const status = document.getElementById('formSaleStatus').value;
  const priceGroup = document.getElementById('formSellingPriceGroup');
  const soldDateGroup = document.getElementById('formSoldDateGroup');

  if (status === 'For Sale') {
    priceGroup.style.display = 'flex';
    soldDateGroup.style.display = 'none';
  } else if (status === 'Sold') {
    priceGroup.style.display = 'flex';
    soldDateGroup.style.display = 'flex';
  } else {
    priceGroup.style.display = 'none';
    soldDateGroup.style.display = 'none';
  }
}

function onAdminAccessChange() {
  const given = document.getElementById('formAdminAccessGiven').value === '1';
  document.getElementById('formAdminNameGroup').style.display = given ? 'flex' : 'none';
  document.getElementById('formAdminGivenDateGroup').style.display = given ? 'flex' : 'none';
}

async function handleWebsiteSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('formWebsiteId').value;
  const submitBtn = document.getElementById('formSubmitBtn');

  const payload = {
    website_name: document.getElementById('formWebsiteName').value.trim(),
    website_url: document.getElementById('formWebsiteUrl').value.trim(),
    client_name: document.getElementById('formClientName').value.trim(),
    contact_info: document.getElementById('formContactInfo').value.trim() || null,
    website_built_date: document.getElementById('formBuiltDate').value || null,
    domain_purchase_date: document.getElementById('formPurchaseDate').value || null,
    domain_registrar: document.getElementById('formRegistrar').value.trim() || null,
    domain_duration_years: parseInt(document.getElementById('formDurationYears').value, 10) || 1,
    domain_expiry_date: document.getElementById('formExpiryDate').value || null,
    total_price: parseFloat(document.getElementById('formTotalPrice').value) || 0,
    payment_received: parseFloat(document.getElementById('formPaymentReceived').value) || 0,
    payment_date: document.getElementById('formPaymentDate').value || null,
    payment_notes: document.getElementById('formPaymentNotes').value.trim() || null,
    sale_status: document.getElementById('formSaleStatus').value,
    selling_price: document.getElementById('formSellingPrice').value ? parseFloat(document.getElementById('formSellingPrice').value) : null,
    sold_date: document.getElementById('formSoldDate').value || null,
    admin_access_given: document.getElementById('formAdminAccessGiven').value === '1' ? 1 : 0,
    admin_name: document.getElementById('formAdminName').value.trim() || null,
    admin_given_date: document.getElementById('formAdminGivenDate').value || null,
    notes: document.getElementById('formNotes').value.trim() || null
  };

  if (!payload.website_name || !payload.website_url || !payload.client_name) {
    showToast('Please fill in Website Name, URL, and Client Name.', 'error');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving to MongoDB...';

  try {
    const url = id ? `/api/websites/${id}` : '/api/websites';
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok) {
      showToast(id ? 'Website record updated in MongoDB Atlas!' : 'Website saved to MongoDB Atlas!', 'success');
      closeModal('websiteModal');
      loadDashboardStats();
      loadWebsites();
    } else {
      showToast(data.error || 'Failed to save record.', 'error');
    }
  } catch (err) {
    showToast('Server error while saving.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save to MongoDB Atlas';
  }
}

// ==========================================
// View Website Record Details Modal
// ==========================================

async function viewWebsiteDetails(id) {
  try {
    let record = state.records ? state.records.find(r => r.id === id || r._id === id) : null;
    if (!record) {
      const res = await fetch(`/api/websites/${id}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Not found');
      record = await res.json();
    }
    state.activeRecord = record;

    document.getElementById('viewDetailTitle').textContent = record.website_name;

    document.getElementById('viewDetailEditBtn').onclick = () => {
      closeModal('viewWebsiteModal');
      openEditModal(record.id || record._id);
    };
    document.getElementById('viewDetailDeleteBtn').onclick = () => {
      closeModal('viewWebsiteModal');
      openDeleteConfirm(record.id || record._id, record.website_name, 'website');
    };

    let expiryBadge = '';
    if (record.days_remaining === null) {
      expiryBadge = '<span class="badge badge-slate">No Expiry Date</span>';
    } else if (record.days_remaining < 0) {
      expiryBadge = `<span class="badge badge-danger"><span class="badge-dot"></span>Expired (${Math.abs(record.days_remaining)} days ago)</span>`;
    } else if (record.days_remaining <= 30) {
      expiryBadge = `<span class="badge badge-warning"><span class="badge-dot"></span>Expiring Soon (${record.days_remaining} days left)</span>`;
    } else {
      expiryBadge = `<span class="badge badge-active"><span class="badge-dot"></span>Active (${record.days_remaining} days left)</span>`;
    }

    let saleBadge = '';
    if (record.sale_status === 'For Sale') {
      saleBadge = `<span class="badge badge-info"><span class="badge-dot"></span>For Sale${record.selling_price ? ' (' + formatINR(record.selling_price) + ')' : ''}</span>`;
    } else if (record.sale_status === 'Sold') {
      saleBadge = `<span class="badge badge-purple"><span class="badge-dot"></span>Sold</span>`;
    } else {
      saleBadge = `<span class="badge badge-slate">Not for Sale</span>`;
    }

    const container = document.getElementById('viewDetailsContainer');
    container.innerHTML = `
      <div class="view-details-wrapper">
        <!-- Top Hero Banner -->
        <div class="detail-hero-banner">
          <div style="flex: 1; min-width: 260px;">
            <div class="detail-hero-title-row">
              <h3 class="detail-hero-name">${escapeHtml(record.website_name)}</h3>
              ${expiryBadge}
              ${saleBadge}
            </div>
            <div class="detail-hero-url-row">
              <a href="${escapeHtml(record.website_url)}" target="_blank" rel="noopener noreferrer" class="detail-live-link" title="Open live website in new tab">
                <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                <span>${escapeHtml(record.website_url)}</span>
              </a>
              <button type="button" class="btn-copy-url" onclick="copyToClipboard('${escapeHtml(record.website_url.replace(/'/g, "\\'"))}', this)">
                <svg class="icon icon-sm" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                <span>Copy URL</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Detail Sections -->
        <div class="detail-sections-container">
          
          <!-- Section 1: Domain & Registration Details -->
          <div class="detail-section-card">
            <div class="detail-section-header">
              <svg class="icon icon-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
              <span>Domain & Registration</span>
            </div>
            <div class="detail-kv-grid">
              <div class="detail-kv-item">
                <span class="detail-k">Registrar / Provider</span>
                <span class="detail-v highlight">${record.domain_registrar ? escapeHtml(record.domain_registrar) : 'Vercel (Free Domain)'}</span>
              </div>
              <div class="detail-kv-item">
                <span class="detail-k">Duration Period</span>
                <span class="detail-v">${record.domain_duration_years || 1} Year(s)</span>
              </div>
              <div class="detail-kv-item">
                <span class="detail-k">Domain Purchase Date</span>
                <span class="detail-v">${formatDate(record.domain_purchase_date)}</span>
              </div>
              <div class="detail-kv-item">
                <span class="detail-k">Domain Expiry Date</span>
                <span class="detail-v">${formatDate(record.domain_expiry_date)}</span>
              </div>
              <div class="detail-kv-item">
                <span class="detail-k">Days Remaining</span>
                <span class="detail-v">${record.days_remaining !== null ? record.days_remaining + ' Days' : 'No Expiry'}</span>
              </div>
              <div class="detail-kv-item">
                <span class="detail-k">Website Built Date</span>
                <span class="detail-v">${formatDate(record.website_built_date)}</span>
              </div>
            </div>
          </div>

          <!-- Section 2: Client & Admin Credentials -->
          <div class="detail-section-card">
            <div class="detail-section-header">
              <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              <span>Client & Admin Handover</span>
            </div>
            <div class="detail-kv-grid">
              <div class="detail-kv-item">
                <span class="detail-k">Client / Owner Name</span>
                <span class="detail-v highlight">${escapeHtml(record.client_name)}</span>
              </div>
              <div class="detail-kv-item">
                <span class="detail-k">Contact / Phone / Email</span>
                <span class="detail-v">${record.contact_info ? escapeHtml(record.contact_info) : 'Not provided'}</span>
              </div>
              <div class="detail-kv-item">
                <span class="detail-k">Admin Access Given?</span>
                <span class="detail-v">${record.admin_access_given ? '<span class="badge badge-active"><span class="badge-dot"></span>Yes (Given)</span>' : '<span class="badge badge-slate">No (In-House)</span>'}</span>
              </div>
              <div class="detail-kv-item">
                <span class="detail-k">Admin Name / Login Details</span>
                <span class="detail-v">${record.admin_name ? escapeHtml(record.admin_name) : 'None'}</span>
              </div>
              <div class="detail-kv-item">
                <span class="detail-k">Admin Handover Date</span>
                <span class="detail-v">${formatDate(record.admin_given_date)}</span>
              </div>
              <div class="detail-kv-item">
                <span class="detail-k">Sale / Ownership Status</span>
                <span class="detail-v">${escapeHtml(record.sale_status)} ${record.selling_price ? '(' + formatINR(record.selling_price) + ')' : ''}</span>
              </div>
            </div>
          </div>

          <!-- Section 3: Payment & Accounting -->
          <div class="detail-section-card">
            <div class="detail-section-header">
              <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M6 3h12M6 8h12M6 13l7.5 8M6 13h4a4 4 0 0 0 4-4v0a4 4 0 0 0-4-4H6"></path></svg>
              <span>Payment & Invoicing</span>
            </div>
            <div class="detail-kv-grid">
              <div class="detail-kv-item">
                <span class="detail-k">Total Agreed Price</span>
                <span class="detail-v" style="color: var(--primary); font-size: 1.05rem;">${formatINR(record.total_price)}</span>
              </div>
              <div class="detail-kv-item">
                <span class="detail-k">Payment Received</span>
                <span class="detail-v" style="color: var(--success); font-size: 1.05rem;">${formatINR(record.payment_received)}</span>
              </div>
              <div class="detail-kv-item">
                <span class="detail-k">Pending Balance</span>
                <span class="detail-v" style="color: ${record.pending_amount > 0 ? 'var(--warning)' : 'var(--text-muted)'}; font-size: 1.05rem;">${record.pending_amount > 0 ? formatINR(record.pending_amount) : '₹0 (Paid)'}</span>
              </div>
              <div class="detail-kv-item">
                <span class="detail-k">Payment Date</span>
                <span class="detail-v">${formatDate(record.payment_date)}</span>
              </div>
              <div class="detail-kv-item" style="grid-column: 1 / -1;">
                <span class="detail-k">Payment Notes & Mode</span>
                <span class="detail-v">${record.payment_notes ? escapeHtml(record.payment_notes) : 'None'}</span>
              </div>
            </div>
          </div>

          <!-- Section 4: Source Folder & Notes -->
          <div class="detail-section-card" style="grid-column: 1 / -1;">
            <div class="detail-section-header">
              <svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
              <span>Project Notes, Features & Source Directory</span>
            </div>
            <div class="detail-notes-box">
              ${record.notes ? escapeHtml(record.notes) : 'No notes added.'}
            </div>
            <div class="detail-storage-tag">
              <span class="badge badge-active"><span class="badge-dot"></span>MongoDB Atlas Cloud (cluster0)</span>
            </div>
          </div>

        </div>
      </div>
    `;

    openModal('viewWebsiteModal');
  } catch (err) {
    console.error('Failed to view website details:', err);
    showToast('Failed to load website details.', 'error');
  }
}

// ==========================================
// APPS & SOFTWARE MANAGEMENT
// ==========================================

let swSearchTimeout = null;
function handleSoftwareSearch() {
  clearTimeout(swSearchTimeout);
  swSearchTimeout = setTimeout(() => {
    loadSoftware();
  }, 250);
}

function filterSoftwareCategory(cat) {
  state.currentSoftwareCategory = cat;

  document.querySelectorAll('[data-sw-filter]').forEach(pill => {
    if (pill.getAttribute('data-sw-filter') === cat) {
      pill.classList.add('active');
    } else {
      pill.classList.remove('active');
    }
  });

  loadSoftware();
}

async function loadSoftware() {
  const search = document.getElementById('softwareSearchInput').value.trim();
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (state.currentSoftwareCategory && state.currentSoftwareCategory !== 'all') {
    params.append('category', state.currentSoftwareCategory);
  }

  try {
    const res = await fetch(`/api/software?${params.toString()}`, { headers: getAuthHeaders() });
    if (!res.ok) {
      if (res.status === 401) checkAuthSession();
      return;
    }

    const data = await res.json();
    state.softwareRecords = data.records;
    document.getElementById('navSoftwareCount').textContent = data.records.length;

    renderSoftware(data.records);
  } catch (err) {
    console.error('Error fetching software:', err);
    showToast('Failed to load software & apps from MongoDB.', 'error');
  }
}

function renderSoftware(records) {
  const grid = document.getElementById('softwareGrid');
  const empty = document.getElementById('softwareEmptyState');

  if (!records || records.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';

  grid.innerHTML = records.map(sw => {
    const isHotel = sw.category.includes('Hotel');
    const isApk = sw.category.includes('APK') || (sw.apk_path && sw.apk_path.endsWith('.apk'));

    let avatarClass = 'desktop';
    let iconSvg = '<svg class="icon icon-md" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>';

    if (isHotel) {
      avatarClass = 'hotel';
      iconSvg = '<svg class="icon icon-md" viewBox="0 0 24 24"><path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M9 7h1M9 11h1M9 15h1M14 7h1M14 11h1M14 15h1M10 21v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4"></path></svg>';
    } else if (isApk) {
      avatarClass = 'apk';
      iconSvg = '<svg class="icon icon-md" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>';
    }

    const cardClass = isHotel ? 'software-card highlight-hotel' : (isApk ? 'software-card highlight-apk' : 'software-card');

    return `
      <div class="${cardClass}">
        <div>
          <div class="software-card-header">
            <div class="software-icon-title">
              <div class="software-icon-avatar ${avatarClass}">
                ${iconSvg}
              </div>
              <div>
                <h4 class="software-name">${escapeHtml(sw.name)}</h4>
                <div class="software-category-subtext">${escapeHtml(sw.category)} • ${escapeHtml(sw.platform)}</div>
              </div>
            </div>
            <span class="badge ${sw.status === 'Active' ? 'badge-active' : 'badge-slate'}">${escapeHtml(sw.status)}</span>
          </div>

          <div class="software-meta-row" style="margin: 0.85rem 0;">
            <span class="badge badge-info">${escapeHtml(sw.type)}</span>
            <span class="badge badge-slate">${escapeHtml(sw.version)}</span>
            <span class="badge badge-purple">${escapeHtml(sw.client_name)}</span>
            ${sw.payment_status === 'Paid' ? '<span class="badge badge-active">Paid ' + formatINR(sw.price) + '</span>' : ''}
            ${sw.payment_status === 'Pending' ? '<span class="badge badge-warning">Pending ' + formatINR(sw.pending_amount) + '</span>' : ''}
            ${sw.payment_status === 'In-House' ? '<span class="badge badge-slate">In-House</span>' : ''}
          </div>

          ${sw.file_path ? `
            <div class="software-path-box" style="margin-bottom: 0.5rem;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="software-path-label">Source Folder</span>
                <button class="btn-ghost" style="padding: 0.1rem 0.35rem; font-size: 0.7rem; border-radius: 4px;" onclick="copyToClipboard('${escapeHtml(sw.file_path.replace(/'/g, "\\'"))}', this)">Copy Path</button>
              </div>
              <span>${escapeHtml(sw.file_path)}</span>
            </div>
          ` : ''}

          ${sw.apk_path ? `
            <div class="software-path-box" style="background: rgba(16, 185, 129, 0.08); border-color: rgba(16, 185, 129, 0.2);">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="software-path-label" style="color: var(--success);">Android APK File</span>
                <button class="btn-ghost" style="padding: 0.1rem 0.35rem; font-size: 0.7rem; border-radius: 4px; color: var(--success);" onclick="copyToClipboard('${escapeHtml(sw.apk_path.replace(/'/g, "\\'"))}', this)">Copy APK</button>
              </div>
              <span style="color: var(--text-main);">${escapeHtml(sw.apk_path)}</span>
            </div>
          ` : ''}

          ${sw.notes ? `
            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.75rem; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">
              ${escapeHtml(sw.notes)}
            </div>
          ` : ''}
        </div>

        <div class="software-card-footer">
          <button class="btn btn-secondary" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;" onclick="viewSoftwareDetails('${sw.id}')">
            View Details
          </button>
          <div class="action-buttons-cell">
            <button class="btn-table-action" onclick="openEditSoftwareModal('${sw.id}')" title="Edit">
              <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
            </button>
            <button class="btn-table-action delete" onclick="openDeleteConfirm('${sw.id}', '${escapeHtml(sw.name.replace(/'/g, "\\'"))}', 'software')" title="Delete">
              <svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function openAddSoftwareModal() {
  document.getElementById('softwareForm').reset();
  document.getElementById('formSoftwareId').value = '';
  document.getElementById('softwareModalTitleText').textContent = 'Add New Software / App Record';
  document.getElementById('formSwCategory').value = 'Hotel Management ERP';
  document.getElementById('formSwPrice').value = 0;
  document.getElementById('formSwPaymentStatus').value = 'In-House';
  openModal('softwareModal');
}

async function openEditSoftwareModal(id) {
  try {
    const res = await fetch(`/api/software/${id}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Not found');
    const record = await res.json();

    document.getElementById('formSoftwareId').value = record.id;
    document.getElementById('softwareModalTitleText').textContent = `Edit Software: ${record.name}`;
    document.getElementById('formSwName').value = record.name || '';
    document.getElementById('formSwCategory').value = record.category || 'Hotel Management ERP';
    document.getElementById('formSwType').value = record.type || '';
    document.getElementById('formSwPlatform').value = record.platform || '';
    document.getElementById('formSwVersion').value = record.version || '';
    document.getElementById('formSwFilePath').value = record.file_path || '';
    document.getElementById('formSwApkPath').value = record.apk_path || '';
    document.getElementById('formSwClient').value = record.client_name || '';
    document.getElementById('formSwPrice').value = record.price || 0;
    document.getElementById('formSwPaymentStatus').value = record.payment_status || 'Paid';
    document.getElementById('formSwNotes').value = record.notes || '';

    openModal('softwareModal');
  } catch (err) {
    showToast('Failed to load software record.', 'error');
  }
}

async function handleSoftwareSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('formSoftwareId').value;
  const submitBtn = document.getElementById('formSwSubmitBtn');

  const payload = {
    name: document.getElementById('formSwName').value.trim(),
    category: document.getElementById('formSwCategory').value,
    type: document.getElementById('formSwType').value.trim() || 'Software',
    platform: document.getElementById('formSwPlatform').value.trim() || 'Android / Web',
    version: document.getElementById('formSwVersion').value.trim() || '1.0.0',
    file_path: document.getElementById('formSwFilePath').value.trim() || null,
    apk_path: document.getElementById('formSwApkPath').value.trim() || null,
    client_name: document.getElementById('formSwClient').value.trim() || 'Mahesh Saini',
    price: parseFloat(document.getElementById('formSwPrice').value) || 0,
    payment_status: document.getElementById('formSwPaymentStatus').value,
    notes: document.getElementById('formSwNotes').value.trim() || null
  };

  if (!payload.name) {
    showToast('Please enter software / app name.', 'error');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving to MongoDB...';

  try {
    const url = id ? `/api/software/${id}` : '/api/software';
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok) {
      showToast(id ? 'Software record updated in MongoDB!' : 'Software record saved in MongoDB!', 'success');
      closeModal('softwareModal');
      loadSoftware();
      loadDashboardStats();
    } else {
      showToast(data.error || 'Failed to save record.', 'error');
    }
  } catch (err) {
    showToast('Server error while saving.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save Software to MongoDB';
  }
}

async function viewSoftwareDetails(id) {
  try {
    let sw = state.softwareRecords ? state.softwareRecords.find(s => s.id === id || s._id === id) : null;
    if (!sw) {
      const res = await fetch(`/api/software/${id}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Not found');
      sw = await res.json();
    }

    document.getElementById('viewSoftwareTitle').textContent = sw.name;
    document.getElementById('viewSoftwareEditBtn').onclick = () => {
      closeModal('viewSoftwareModal');
      openEditSoftwareModal(sw.id);
    };
    document.getElementById('viewSoftwareDeleteBtn').onclick = () => {
      closeModal('viewSoftwareModal');
      openDeleteConfirm(sw.id, sw.name, 'software');
    };

    const container = document.getElementById('viewSoftwareDetailsContainer');
    container.innerHTML = `
      <div class="detail-card">
        <div class="detail-card-label">App / Software Name</div>
        <div class="detail-card-value">${escapeHtml(sw.name)}</div>
      </div>

      <div class="detail-card">
        <div class="detail-card-label">Category</div>
        <div class="detail-card-value"><span class="badge badge-info">${escapeHtml(sw.category)}</span></div>
      </div>

      <div class="detail-card">
        <div class="detail-card-label">Application Type</div>
        <div class="detail-card-value">${escapeHtml(sw.type)}</div>
      </div>

      <div class="detail-card">
        <div class="detail-card-label">Platform & Version</div>
        <div class="detail-card-value">${escapeHtml(sw.platform)} • ${escapeHtml(sw.version)}</div>
      </div>

      <div class="detail-card">
        <div class="detail-card-label">Client / Project Owner</div>
        <div class="detail-card-value">${escapeHtml(sw.client_name)}</div>
      </div>

      <div class="detail-card">
        <div class="detail-card-label">Price & Status</div>
        <div class="detail-card-value" style="color: var(--success);">${formatINR(sw.price)} (${escapeHtml(sw.payment_status)})</div>
      </div>

      <div class="detail-card" style="grid-column: 1 / -1;">
        <div class="detail-card-label">Project Directory (Laptop Path)</div>
        <div class="detail-card-value" style="font-family: monospace; font-size: 0.85rem; word-break: break-all;">
          ${sw.file_path ? `${escapeHtml(sw.file_path)} <button class="btn-ghost" style="padding: 0.1rem 0.4rem; font-size: 0.72rem; margin-left: 0.5rem;" onclick="copyToClipboard('${escapeHtml(sw.file_path.replace(/'/g, "\\'"))}', this)">Copy</button>` : '—'}
        </div>
      </div>

      <div class="detail-card" style="grid-column: 1 / -1;">
        <div class="detail-card-label">Android APK Location</div>
        <div class="detail-card-value" style="font-family: monospace; font-size: 0.85rem; color: var(--success); word-break: break-all;">
          ${sw.apk_path ? `${escapeHtml(sw.apk_path)} <button class="btn-ghost" style="padding: 0.1rem 0.4rem; font-size: 0.72rem; margin-left: 0.5rem; color: var(--success);" onclick="copyToClipboard('${escapeHtml(sw.apk_path.replace(/'/g, "\\'"))}', this)">Copy</button>` : '<span style="color: var(--text-muted)">No standalone APK attached</span>'}
        </div>
      </div>

      <div class="detail-card" style="grid-column: 1 / -1;">
        <div class="detail-card-label">Features & Documentation</div>
        <div class="detail-card-value" style="font-weight: normal; white-space: pre-wrap; font-size: 0.875rem;">${sw.notes ? escapeHtml(sw.notes) : '<span style="color: var(--text-muted)">No notes added.</span>'}</div>
      </div>

      <div class="detail-card">
        <div class="detail-card-label">Database Storage</div>
        <div class="detail-card-value" style="font-size: 0.8rem; color: var(--success);">MongoDB Atlas (cluster0.ajeqt1u.mongodb.net)</div>
      </div>
    `;

    openModal('viewSoftwareModal');
  } catch (err) {
    showToast('Failed to load software details.', 'error');
  }
}

// ==========================================
// Delete Confirmation (Websites & Software)
// ==========================================

function openDeleteConfirm(id, name, type = 'website') {
  state.deleteTargetId = id;
  state.deleteTargetType = type;
  document.getElementById('deleteTargetName').textContent = `"${name}" (${type === 'website' ? 'Website' : 'Software/App'})`;
  document.getElementById('confirmDeleteBtn').onclick = executeDelete;
  openModal('deleteConfirmModal');
}

async function executeDelete() {
  if (!state.deleteTargetId) return;
  const btn = document.getElementById('confirmDeleteBtn');
  btn.disabled = true;
  btn.textContent = 'Deleting from MongoDB...';

  try {
    const url = state.deleteTargetType === 'website'
      ? `/api/websites/${state.deleteTargetId}`
      : `/api/software/${state.deleteTargetId}`;

    const res = await fetch(url, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    const data = await res.json();
    if (res.ok) {
      showToast(data.message || 'Deleted successfully from MongoDB Atlas.', 'success');
      closeModal('deleteConfirmModal');
      loadDashboardStats();
      if (state.deleteTargetType === 'website') {
        loadWebsites();
      } else {
        loadSoftware();
      }
    } else {
      showToast(data.error || 'Failed to delete record.', 'error');
    }
  } catch (err) {
    showToast('Server error while deleting.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Yes, Delete Record';
    state.deleteTargetId = null;
  }
}

// ==========================================
// CSV Export
// ==========================================

function exportCsv() {
  const token = localStorage.getItem('mgmt_token');
  window.open(`/api/websites/export/csv?token=${encodeURIComponent(token || '')}`, '_blank');
}

// ==========================================
// Modals Helpers
// ==========================================

function openModal(modalId) {
  document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

window.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
  }
});

// ==========================================
// Dashboard KPI Toggle for Laptop Screens
// ==========================================

function toggleKpiSummary() {
  const kpiGrid = document.querySelector('.kpi-grid');
  const btnText = document.getElementById('kpiToggleText');
  const btnIcon = document.getElementById('kpiToggleIcon');
  if (!kpiGrid) return;

  const isHidden = kpiGrid.style.display === 'none';
  if (isHidden) {
    kpiGrid.style.display = 'grid';
    if (btnText) btnText.textContent = 'Collapse Stats';
    if (btnIcon) btnIcon.innerHTML = '<polyline points="18 15 12 9 6 15"></polyline>';
    localStorage.setItem('mgmt_kpi_collapsed', 'false');
  } else {
    kpiGrid.style.display = 'none';
    if (btnText) btnText.textContent = 'Expand Stats';
    if (btnIcon) btnIcon.innerHTML = '<polyline points="6 9 12 15 18 9"></polyline>';
    localStorage.setItem('mgmt_kpi_collapsed', 'true');
  }
}

// ==========================================
// Theme Management
// ==========================================

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const target = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', target);
  localStorage.setItem('mgmt_theme', target);
  updateThemeIcon(target);
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('themeIcon');
  if (theme === 'light') {
    icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
  } else {
    icon.innerHTML = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
  }
}

// ==========================================
// Initialize on page load
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const queryTheme = urlParams.get('theme');
  if (queryTheme === 'light' || queryTheme === 'dark') {
    localStorage.setItem('mgmt_theme', queryTheme);
  }

  const savedTheme = localStorage.getItem('mgmt_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  const savedViewMode = localStorage.getItem('mgmt_view_mode') || 'table';
  setViewMode(savedViewMode);

  if (localStorage.getItem('mgmt_kpi_collapsed') === 'true') {
    const kpiGrid = document.querySelector('.kpi-grid');
    const btnText = document.getElementById('kpiToggleText');
    const btnIcon = document.getElementById('kpiToggleIcon');
    if (kpiGrid) kpiGrid.style.display = 'none';
    if (btnText) btnText.textContent = 'Expand Stats';
    if (btnIcon) btnIcon.innerHTML = '<polyline points="6 9 12 15 18 9"></polyline>';
  }

  checkAuthSession();
});
