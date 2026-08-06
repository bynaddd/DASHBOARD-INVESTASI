const API_URL = '/api/sheets';
const INTEREST_RATE = 0.03;
// Cut-off date for interest logic: 18 Mei 2026
const CUT_OFF_DATE = new Date('2026-05-18T00:00:00');
// Feature flag: show interest components on dashboard. Set to true to display interest-related values.
const SHOW_INTEREST = false; // Change to true to enable interest display
let allData = [], globalFilteredData = [], charts = {}, txPage = 1, txPerPage = 20, txSort = { col: null, asc: true }, allAnomalies = [], allReviews = [], allEmployees = [], anomaliSort = { col: 0, asc: false }, globalTotalSaldo = 0, globalTotalPositiveSisaSetoran = 0, globalTotalActive = 0, allEmployeesStatus = {}, globalReferenceDate = null;
let empTxSort = { col: 0, asc: false }, currentEmpData = { name: '', nik: '' };
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;

// ===== LOGIN LOGIC =====
function checkLogin() {
  const overlay = document.getElementById('loginOverlay');
  if (currentUser) {
    overlay.classList.add('hidden');
    applyAccessControl();
    fetchData(); // Load data only after login
  } else {
    overlay.classList.remove('hidden');
  }
}

function applyAccessControl() {
  const isAdmin = currentUser && currentUser.role === 'admin';
  const adminLinks = ['nav-admin'];

  // Update User Info Display
  const nameEl = document.getElementById('userNameDisplay');
  const roleEl = document.getElementById('userRoleBadge');
  if (nameEl) nameEl.textContent = currentUser ? currentUser.name : 'Memuat...';
  if (roleEl) {
    roleEl.textContent = isAdmin ? 'Admin' : 'Tamu';
    roleEl.className = 'badge-status ' + (isAdmin ? 'status-verified' : 'status-progress');
  }

  adminLinks.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (isAdmin) el.classList.remove('hidden');
      else el.classList.add('hidden');
    }
  });

  // Guest Restrictions: No Email Input
  const downloadDashboardBtn = document.getElementById('btnDownloadDashboard');
  const exportEmployeeBtn = document.getElementById('btnExportEmployee');
  const exportTransaksiBtn = document.getElementById('btnExportTransaksi');
  const exportDoubleBtn = document.getElementById('btnExportDoubleDeposits');
  const downloadAnalyticsBtn = document.getElementById('btnDownloadAnalytics');
  const downloadAnomaliBtn = document.getElementById('btnDownloadAnomali');
  const emailContainer = document.getElementById('reviewerEmailContainer');

  const downloadBtns = [
    downloadDashboardBtn,
    exportEmployeeBtn,
    exportTransaksiBtn,
    exportDoubleBtn,
    downloadAnalyticsBtn,
    downloadAnomaliBtn
  ];

  downloadBtns.forEach(btn => {
    if (btn) {
      btn.classList.remove('hidden');
    }
  });

  if (emailContainer) {
    if (isAdmin) emailContainer.classList.remove('hidden');
    else emailContainer.classList.add('hidden');
  }

  // Also hide admin sections in Analytics if guest
  const adminSections = document.querySelectorAll('.admin-only');
  adminSections.forEach(el => {
    if (isAdmin) el.classList.remove('hidden');
    else el.classList.add('hidden');
  });
}

function initLogin() {
  const overlay = document.getElementById('loginOverlay');
  const loginChoice = document.getElementById('loginChoice');
  const adminLoginForm = document.getElementById('adminLoginForm');
  const guestLoginForm = document.getElementById('guestLoginForm');

  document.getElementById('btnGuestLogin').addEventListener('click', () => {
    loginChoice.style.display = 'none';
    guestLoginForm.classList.add('show');
  });

  document.getElementById('btnBackToChoiceFromGuest').addEventListener('click', () => {
    guestLoginForm.classList.remove('show');
    loginChoice.style.display = 'block';
  });

  document.getElementById('btnLoginGuest').addEventListener('click', () => {
    const email = document.getElementById('guestEmail').value;
    const pass = document.getElementById('guestPassword').value;

    if (email === 'moneybox@asuka.com' && pass === 'lihatmoneyb0x') {
      currentUser = { role: 'guest', name: 'Tamu', email: 'moneybox@asuka.com' };
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      overlay.classList.add('hidden');
      applyAccessControl();
      fetchData();
      toast('Selamat datang, Tamu!', 'success');
    } else {
      toast('Email atau Password Tamu salah!', 'error');
    }
  });

  document.getElementById('btnShowAdminLogin').addEventListener('click', () => {
    loginChoice.style.display = 'none';
    adminLoginForm.classList.add('show');
  });

  document.getElementById('btnBackToChoice').addEventListener('click', () => {
    adminLoginForm.classList.remove('show');
    loginChoice.style.display = 'block';
  });

  document.getElementById('btnLoginAdmin').addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPassword').value;

    try {
      const resp = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'login', email, pass })
      });
      const res = await resp.json();

      if (res.success) {
        currentUser = res.user;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        overlay.classList.add('hidden');
        applyAccessControl();
        fetchData();
        toast('Selamat datang, ' + res.user.name + '!', 'success');
      } else {
        // Fallback check client-side in case backend env has lag
        if (email === 'adminmoneybox@asuka.com' && pass === 'moneyb0x135') {
          currentUser = { role: 'admin', name: 'Administrator', email: 'adminmoneybox@asuka.com' };
          localStorage.setItem('currentUser', JSON.stringify(currentUser));
          overlay.classList.add('hidden');
          applyAccessControl();
          fetchData();
          toast('Selamat datang, Administrator!', 'success');
        } else {
          toast(res.error || 'Email atau Password salah!', 'error');
        }
      }
    } catch (err) {
      // Fallback check on API network failure
      if (email === 'adminmoneybox@asuka.com' && pass === 'moneyb0x135') {
        currentUser = { role: 'admin', name: 'Administrator', email: 'adminmoneybox@asuka.com' };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        overlay.classList.add('hidden');
        applyAccessControl();
        fetchData();
        toast('Selamat datang, Administrator (Lokal)!', 'success');
      } else {
        toast('Gagal login: ' + err.message, 'error');
      }
    }
  });

  // Logout capability
  window.logout = () => {
    localStorage.removeItem('currentUser');
    location.reload();
  };
}

// ===== UTILITAS =====
const fmt = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const getEmpId = d => (d.nik && d.nik !== '-' && d.nik !== '') ? d.nik : d.name;

function parseDateStr(s) {
  if (!s) return null;
  const str = String(s).trim();

  // Deteksi format DD/MM/YYYY atau DD/MM/YY
  if (str.includes('/')) {
    const p = str.split('/');
    if (p.length === 3) {
      let d = parseInt(p[0]);
      let m = parseInt(p[1]) - 1;
      let y = parseInt(p[2]);
      if (y < 100) y += 2000;
      if (!isNaN(d) && !isNaN(m) && !isNaN(y)) return new Date(y, m, d);
    }
  }

  // Format: "Jul-17", "Jun-17", "Mei-17", dll
  const bulanMap = { 'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'mei': 4, 'may': 4, 'jun': 5, 'jul': 6, 'agu': 7, 'aug': 7, 'sep': 8, 'okt': 9, 'oct': 9, 'nov': 10, 'des': 11, 'dec': 11 };
  const parts = str.toLowerCase().replace(/\s+/g, '-').split('-');
  if (parts.length >= 2) {
    const mon = bulanMap[parts[0].substring(0, 3)];
    let yr = parseInt(parts[1]);
    if (!isNaN(yr)) {
      if (yr < 100) yr += 2000;
      if (!isNaN(mon)) return new Date(yr, mon, 1);
    }
  }
  // Coba parse langsung
  const d = new Date(str);
  return isNaN(d) ? null : d;
}

function fmtDate(d) { 
  if (!d) return '-';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
function toast(msg, type = 'info') { const t = document.createElement('div'); t.className = 'toast ' + type; t.innerHTML = '<i class="fas fa-' + (type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : 'info-circle') + '"></i>' + msg; document.getElementById('toastContainer').appendChild(t); setTimeout(() => t.remove(), 3500); }

let allAliasesMap = {}; // Global map for NIK to variations

/**
 * Menghitung rincian penarikan (Modal, Bunga, Salah, Meragukan)
 * @param {Array} filteredData - Data yang ingin dihitung rinciannya (biasanya data bulan ini atau terfilter)
 * @returns {Object} { modal, bunga, salah, suspicious }
 */
function calculateWithdrawalBreakdown(filteredData) {
  const breakdown = { modal: 0, bunga: 0, salah: 0, suspicious: 0 };
  if (!filteredData || filteredData.length === 0) return breakdown;

  const filteredRows = new Set(filteredData.filter(d => d.type === 'Penarikan').map(d => d.sheetRow));
  if (filteredRows.size === 0) return breakdown;

  const empState = {};
  const monthlyRate = 0.03 / 12;

  // Kita harus memproses seluruh data secara kronologis untuk mendapatkan saldo modal vs bunga yang akurat

  allData.forEach(t => {
    if (t.isDeleted) return;
    const id = getEmpId(t);
    if (!empState[id]) empState[id] = { principal: 0, interest: 0, lastInterestMonth: null };
    const s = empState[id];

    if (t.type === 'Tabungan') {
      const txMonth = t.date ? (t.date.getFullYear() + '-' + t.date.getMonth()) : null;
      if (txMonth && s.lastInterestMonth !== txMonth) {
        const currentBalance = s.principal + s.interest;
        if (currentBalance > 0) {
          s.interest += currentBalance * monthlyRate;
        }
        s.lastInterestMonth = txMonth;
      }
      s.principal += t.nominal;
    } else {
      // Penarikan
      const anom = allAnomalies.find(a => a.originalNo === t.sheetRow);
      const status = anom ? anom.status : null;
      const sysStatus = anom ? anom.systemStatus : null;
      const isFiltered = filteredRows.has(t.sheetRow);

      const nominal = t.nominal;
      let remaining = nominal;
      let takenBunga = 0;
      let takenModal = 0;
      let takenSalah = 0;
      let takenSuspicious = 0;

      // 1. Logika Waterfall: Ambil dari Modal lalu Bunga
      const totalAvailable = s.interest + s.principal;
      const amountCovered = Math.max(0, Math.min(remaining, totalAvailable));
      
      if (amountCovered > 0) {
        const fromModal = Math.min(amountCovered, Math.max(0, s.principal));
        takenModal = fromModal;
        s.principal -= fromModal;
        
        const fromBunga = amountCovered - fromModal;
        takenBunga = fromBunga;
        s.interest -= fromBunga;
        
        remaining -= amountCovered;
      }
      
      // 2. Sisa nominal (Defisit) dikategorikan
      if (remaining > 0) {
        if (status === 'TERBUKTI' || status === 'Verified') {
          // Kerugian Terbukti: Defisit dari transaksi yang sudah diverifikasi
          takenSalah += remaining;
        } else if (status === 'MENUNGGU REVIEW' || sysStatus === 'MENCURIGAKAN' || sysStatus === 'DICICIL') {
          // Potensi Kerugian: Defisit dari transaksi yang masih dalam investigasi
          takenSuspicious += remaining;
        } else {
          // Jika defisit kecil (< 10rb) atau status lain, tetap catat sebagai selisih
          // agar tidak menggelembungkan Modal melebihi nilai setoran yang sebenarnya
          takenSalah += remaining;
        }
        s.principal -= remaining;
      }

      if (isFiltered) {
        breakdown.modal += takenModal;
        breakdown.bunga += takenBunga;
        breakdown.salah += takenSalah;
        breakdown.suspicious += takenSuspicious;
      }
    }
  });

  return breakdown;
}

// ===== FETCH DATA DARI API SERVERLESS =====
async function fetchData() {
  try {
    const r = await fetch(API_URL + '?t=' + Date.now());
    const json = await r.json();
    if (!json.success) {
      const msg = json.message || json.error || 'API error';
      const detail = json.detail ? ` - ${JSON.stringify(json.detail)}` : '';
      throw new Error(msg + detail);
    }

    // Fetch Review Logs
    try {
      const rRev = await fetch(API_URL + '?type=review&t=' + Date.now());
      const jsonRev = await rRev.json();
      if (jsonRev.success) allReviews = jsonRev.data || [];
    } catch (e) {
      console.warn('Gagal memuat review logs:', e);
    }
    allData = json.data.map((row, i) => {
      const d = parseDateStr(row.bulanTahun);
      const ket = (row.keterangan || '').toLowerCase();
      
      let name = String(row.karyawan || '').trim();
      let nik = String(row.nik || '').trim();
      while (nik.startsWith("'") || nik.endsWith("'")) {
        nik = nik.substring(1, nik.length - 1).trim();
      }
      
      // Normalisasi Data Muhammad Saifuddin
      if (name.toLowerCase() === 'm. saifuddin' || name.toLowerCase() === 'm. saifudin') {
        nik = '3523121306880001';
      }

      return {
        sheetRow: row.sheetRow,
        no: row.no || i + 1,
        date: d,
        dateStr: fmtDate(d),
        name: name,
        jenis: row.jenisPotongan,
        nominal: row.nominal,
        nik: nik,
        keterangan: ket,
        type: (ket.includes('debet') || ket.includes('penarikan')) ? 'Penarikan' : 'Tabungan',
        isEdited: row.isEdited,
        isDeleted: row.isDeleted,
        notes: row.notes || ''
      };
    }).filter(x => x && x.name);

    // Detect Double Deposits
    const monthlyCounts = {};
    allData.filter(d => d.type === 'Tabungan' && d.date).forEach(d => {
      const id = getEmpId(d);
      const monthYear = d.date.getFullYear() + '-' + String(d.date.getMonth() + 1).padStart(2, '0');
      const key = `${id}_${monthYear}`;
      if (!monthlyCounts[key]) monthlyCounts[key] = { count: 0, txs: [] };
      monthlyCounts[key].count++;
      monthlyCounts[key].txs.push(d);
    });
    
    // Tag double deposits in allData
    Object.values(monthlyCounts).forEach(item => {
      if (item.count > 1) {
        item.txs.forEach(tx => {
          tx.isDoubleDeposit = true;
        });
      }
    });

    // Auto-fill missing NIKs based on existing records with the same name
    const nameToNikMap = {};
    allData.forEach(d => {
      if (d.nik && d.nik !== '-' && d.name) {
        nameToNikMap[d.name.toLowerCase()] = d.nik;
      }
    });

    allData.forEach(d => {
      if ((!d.nik || d.nik === '-') && d.name) {
        const foundNik = nameToNikMap[d.name.toLowerCase()];
        if (foundNik) {
          d.nik = foundNik; // Gabungkan transaksi tanpa NIK ke NIK yang dominan
        }
      }
    });

    // Normalisasi Nama dihapus agar semua variasi nama muncul di daftar
    allData.sort((a, b) => (a.date || 0) - (b.date || 0));
    globalFilteredData = [...allData];

    // Set global reference date to today's date
    globalReferenceDate = new Date();

    document.getElementById('loadingOverlay').classList.add('hidden');
    toast('Data berhasil dimuat! (' + allData.length + ' transaksi)', 'success');

    // Populate All Employees List for Search - Group by ID (NIK or Name)
    const empMap = {};
    allAliasesMap = {}; 
    allData.forEach(d => {
      const id = getEmpId(d);
      if (!empMap[id]) {
        empMap[id] = { name: d.name, nik: d.nik || '', variations: new Set([d.name]) };
      } else {
        empMap[id].variations.add(d.name);
        if (d.name.length > empMap[id].name.length) {
          empMap[id].name = d.name;
        }
      }
      allAliasesMap[id] = empMap[id].variations;
    });
    // Convert Set back to Array
    allEmployees = Object.values(empMap).map(e => ({ ...e, variations: Array.from(e.variations) }));
    allEmployees.sort((a, b) => a.name.localeCompare(b.name));

    initDashboardFilter();
    initDashboard();
  } catch (e) {
    console.error(e);
    let errorText = e.message;
    // If it's a JSON error from backend, it might be in the message already or we need to parse it
    document.getElementById('loadingOverlay').innerHTML = `
      <i class="fas fa-exclamation-triangle" style="font-size:3rem;color:#ef4444;margin-bottom:16px"></i>
      <p>Gagal memuat data. Periksa koneksi atau konfigurasi API.</p>
      <p style="font-size:.8rem;margin-top:8px;color:#94a3b8">${errorText}</p>
    `;
    toast('Gagal memuat data: ' + errorText, 'error');
  }
}

// ===== INIT =====
function initDashboard(isFirst = true) {
  try { calculateAnomalies(); } catch (e) { console.error('Error calculateAnomalies:', e); }
  try { renderIntelligence(); } catch (e) { console.error('Error renderIntelligence:', e); }
  try { renderSummary(); } catch (e) { console.error('Error renderSummary:', e); }
  try { renderHealthAnalytics(); } catch (e) { console.error('Error renderHealthAnalytics:', e); }
  try { renderTrendChart(); } catch (e) { console.error('Error renderTrendChart:', e); }
  try { renderCashFlowChart(); } catch (e) { console.error('Error renderCashFlowChart:', e); }
  if (typeof renderDashPieChart === 'function') {
    try { renderDashPieChart(); } catch (e) { console.error('Error renderDashPieChart:', e); }
  }

  try { renderTopInvestors(); } catch (e) { console.error('Error renderTopInvestors:', e); }
  try { renderFundCompositionChart(); } catch (e) { console.error('Error renderFundCompositionChart:', e); }
  try { renderRecentTable(); } catch (e) { console.error('Error renderRecentTable:', e); }
  try { renderAnomaliTable(); } catch (e) { console.error('Error renderAnomaliTable:', e); }

  
  if (isFirst) populateMonthFilter();
  renderTxTable(); initSearch(); initAnalytics();



  // Search for recent table
  const recentSearch = document.getElementById('recentTableSearch');
  if (recentSearch) {
    recentSearch.addEventListener('input', () => renderRecentTable(recentSearch.value));
  }


  
  // Initialize Autocompletes for all relevant modals
  setupAutocomplete('editTxName', 'editTxNameResults', 'editTxName', 'editTxNik');
  setupAutocomplete('editTxNik', 'editTxNikResults', 'editTxName', 'editTxNik');
  setupAutocomplete('correctName', 'correctNameResults', 'correctName', 'correctNik');
  setupAutocomplete('correctNik', 'correctNikResults', 'correctName', 'correctNik');

  const btnDownloadAnomali = document.getElementById('btnDownloadAnomali');
  if (btnDownloadAnomali) {
    btnDownloadAnomali.addEventListener('click', () => exportAnomaliData());
  }
  
  if (isFirst) {
    initAdmin();
    const as = document.getElementById('anomaliSearch');
    if (as) as.addEventListener('keypress', (e) => { if (e.key === 'Enter') renderAnomaliTable(); });
    const af = document.getElementById('topAnomaliStatusFilter');
    // Removed real-time change listener as requested

    document.querySelectorAll('th.sortable-anomali').forEach(th => {
      th.addEventListener('click', () => {
        const c = +th.dataset.col;
        if (anomaliSort.col === c) anomaliSort.asc = !anomaliSort.asc;
        else { anomaliSort.col = c; anomaliSort.asc = true; }
        renderAnomaliTable();
      });
    });

    // Listeners for Anomali Filters
    const anomSearch = document.getElementById('anomaliSearch');
    const anomMode = document.getElementById('anomaliFilterMode');
    const anomStart = document.getElementById('anomaliFilterStartMonth');
    const anomEnd = document.getElementById('anomaliFilterEndMonth');
    const anomStatus = document.getElementById('anomaliStatusFilter');

    [anomSearch, anomMode, anomStart, anomEnd, anomStatus].forEach(el => {
      if (el) el.addEventListener('change', () => renderAnomaliTable());
      if (el && el.id === 'anomaliSearch') el.addEventListener('input', () => renderAnomaliTable());
    });

    if (anomMode) {
      anomMode.addEventListener('change', () => {
        const group = document.getElementById('anomaliFilterCustomGroup');
        if (group) group.style.display = anomMode.value === 'custom' ? 'flex' : 'none';
      });
    }

    // Modal Review Events
    const btnCloseModal = document.getElementById('btnCloseModal');
    const btnCancelReview = document.getElementById('btnCancelReview');
    const btnSaveReview = document.getElementById('btnSaveReview');
    const reviewNotesSelect = document.getElementById('reviewNotesSelect');
    const reviewNotesArea = document.getElementById('reviewNotes');

    if (reviewNotesSelect && reviewNotesArea) {
      reviewNotesSelect.addEventListener('change', (e) => {
        if (e.target.value === 'Lainnya') {
          reviewNotesArea.classList.remove('hidden');
        } else {
          reviewNotesArea.classList.add('hidden');
        }
      });
    }

    if (btnCloseModal) btnCloseModal.addEventListener('click', closeReviewModal);
    if (btnCancelReview) btnCancelReview.addEventListener('click', closeReviewModal);
    if (btnSaveReview) btnSaveReview.addEventListener('click', saveReview);

    // Toggle Correction Fields based on Status Selection
      const statusOptions = document.getElementsByName('reviewStatus');
    statusOptions.forEach(opt => {
      opt.addEventListener('change', (e) => {
        const cf = document.getElementById('correctionFields');
        const pg = document.getElementById('reviewPasswordGroup');
        const notesSelect = document.getElementById('reviewNotesSelect');
        const notesArea = document.getElementById('reviewNotes');

        if (e.target.value === 'SALAH INPUT') {
          cf.classList.remove('hidden');
          pg.classList.remove('hidden');
        } else {
          cf.classList.add('hidden');
          pg.classList.add('hidden');
        }

        if (e.target.value === 'TERBUKTI') {
          if (notesSelect) notesSelect.classList.remove('hidden');
          if (notesArea) notesArea.placeholder = "Ketik alasan lainnya...";
          if (notesSelect && notesSelect.value === 'Lainnya') {
            if (notesArea) notesArea.classList.remove('hidden');
          } else {
            if (notesArea) notesArea.classList.add('hidden');
          }
        } else {
          if (notesSelect) notesSelect.classList.add('hidden');
          if (notesArea) {
            notesArea.placeholder = "Tambahkan catatan hasil investigasi atau alasan koreksi...";
            notesArea.classList.remove('hidden');
          }
        }
      });
    });

    // Autocomplete for Correct Name in Review Modal
    const cnInput = document.getElementById('correctName');
    const cnResults = document.getElementById('correctNameResults');
    if (cnInput && cnResults) {
      cnInput.addEventListener('input', () => {
        const q = cnInput.value.toLowerCase().trim();
        if (!q) { cnResults.classList.remove('show'); return; }
        const filtered = allEmployees.filter(e => e.name.toLowerCase().includes(q) || (e.nik && e.nik.toLowerCase().includes(q))).slice(0, 5);

        if (filtered.length > 0) {
          cnResults.innerHTML = filtered.map(e => `<div class="search-result-item" data-name="${e.name}" data-nik="${e.nik}">${e.name} ${e.nik && e.nik !== '-' ? `(${e.nik})` : ''}</div>`).join('');
          cnResults.classList.add('show');
          cnResults.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
              cnInput.value = item.dataset.name;
              document.getElementById('correctNik').value = item.dataset.nik === '-' ? '' : item.dataset.nik;
              cnResults.classList.remove('show');
            });
          });
        } else {
          cnResults.classList.remove('show');
        }
      });
      document.addEventListener('click', e => { if (!cnInput.contains(e.target) && !cnResults.contains(e.target)) cnResults.classList.remove('show'); });
    }
  }
  document.getElementById('dateDisplay').textContent = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// ===== SECTION 1: HEADER INTELLIGENCE =====
function renderIntelligence() {
  const greetingEl = document.getElementById('intelGreeting');
  const summaryEl = document.getElementById('aiInsightSummary');
  const healthStatusEl = document.getElementById('systemHealthStatus');
  const healthTextEl = document.getElementById('healthStatusText');
  const dateEl = document.getElementById('realtimeDate');

  if (greetingEl) {
    const hr = new Date().getHours();
    let greet = "Selamat Malam";
    if (hr < 11) greet = "Selamat Pagi";
    else if (hr < 15) greet = "Selamat Siang";
    else if (hr < 19) greet = "Selamat Sore";
    greetingEl.textContent = `${greet}, ${currentUser ? currentUser.name : 'Administrator'}`;
  }

  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  // Calculate some quick stats for summary
  const dataDates = allData.filter(d => d.date);
  if (dataDates.length === 0) return;
  
  // Find Last Deposit Date (Setoran Masuk) as Reference
  const depositData = allData.filter(d => d.date && d.type === 'Tabungan');
  let referenceDate = new Date();
  if (depositData.length > 0) {
    referenceDate = new Date(depositData.reduce((max, d) => (d.date > max ? d.date : max), depositData[0].date));
    const lastDepEl = document.getElementById('lastDepositDate');
    if (lastDepEl) {
      lastDepEl.textContent = referenceDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    }
  }

  const cm = referenceDate.getMonth(), cy = referenceDate.getFullYear();
  
  const thisMonthData = allData.filter(d => d.date && d.date.getMonth() === cm && d.date.getFullYear() === cy);
  const thisMonthIn = thisMonthData.filter(d => d.type === 'Tabungan').reduce((sum, d) => sum + d.nominal, 0);
  
  let lm = cm - 1, ly = cy;
  if (lm < 0) { lm = 11; ly--; }
  const lastMonthData = allData.filter(d => d.date && d.date.getMonth() === lm && d.date.getFullYear() === ly);
  const lastMonthIn = lastMonthData.filter(d => d.type === 'Tabungan').reduce((sum, d) => sum + d.nominal, 0);

  if (summaryEl) {
    let insight = "Money Box menunjukkan pertumbuhan saldo pokok investasi yang stabil bulan ini.";
    if (lastMonthIn > 0) {
      const growth = ((thisMonthIn - lastMonthIn) / lastMonthIn * 100);
      if (growth > 5) insight = `Money Box menunjukkan pertumbuhan stabil dengan peningkatan setoran saldo pokok aktif sebesar ${growth.toFixed(1)}% MoM.`;
      else if (growth < -5) insight = `Peringatan: Terjadi penurunan setoran saldo pokok sebesar ${Math.abs(growth).toFixed(1)}% dibanding bulan lalu.`;
    }
    summaryEl.textContent = insight;
  }

  // System Health
  if (healthStatusEl && healthTextEl) {
    const thisMonthOut = thisMonthData.filter(d => d.type === 'Penarikan').reduce((sum, d) => sum + d.nominal, 0);
    const ratio = thisMonthIn > 0 ? (thisMonthOut / thisMonthIn) : 0;
    
    if (ratio > 0.8) {
      healthStatusEl.className = "health-value warning";
      healthTextEl.textContent = "Warning";
    } else if (ratio > 0.5) {
      healthStatusEl.className = "health-value stable";
      healthTextEl.textContent = "Stable";
    } else {
      healthStatusEl.className = "health-value healthy";
      healthTextEl.textContent = "Healthy";
    }
  }
}

// ===== SECTION 2: KPI SUMMARY CARDS =====
function renderSummary() {
  const filteredWithDates = globalFilteredData.filter(d => d.date);
  if (filteredWithDates.length === 0) return;
  // If interest display is disabled, we'll adjust totals accordingly.

  // Use Last Deposit Date as reference for Summary
  const dataToUse = globalFilteredData.length > 0 || (document.querySelector('#dashboardTimeFilter button.active') && document.querySelector('#dashboardTimeFilter button.active').dataset.range !== 'all') ? globalFilteredData : allData;
  const depositData = dataToUse.filter(d => d.date && d.type === 'Tabungan');
  let referenceDate = new Date();
  if (depositData.length > 0) {
    referenceDate = new Date(depositData.reduce((max, d) => (d.date > max ? d.date : max), depositData[0].date));
  }

  const cm = referenceDate.getMonth(), cy = referenceDate.getFullYear();
  let lm = cm - 1, ly = cy;
  if (lm < 0) { lm = 11; ly--; }

  let totalIn = 0, totalOut = 0, monthIn = 0, monthOut = 0, lastMonthIn = 0, lastMonthOut = 0;
  let activeEmpsSet = new Set();
  
  const threeMonthsAgo = new Date(referenceDate);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  dataToUse.forEach(d => {
    if (d.isDeleted) return;
    if (d.type === 'Tabungan') {
      totalIn += d.nominal;
      if (d.date && d.date >= threeMonthsAgo) activeEmpsSet.add(getEmpId(d));
      if (d.date && d.date.getMonth() === cm && d.date.getFullYear() === cy) monthIn += d.nominal;
      if (d.date && d.date.getMonth() === lm && d.date.getFullYear() === ly) lastMonthIn += d.nominal;
    } else {
      totalOut += d.nominal;
      if (d.date && d.date.getMonth() === cm && d.date.getFullYear() === cy) monthOut += d.nominal;
      if (d.date && d.date.getMonth() === lm && d.date.getFullYear() === ly) lastMonthOut += d.nominal;
    }
  });

  const activeRange = document.querySelector('#dashboardTimeFilter button.active') ? document.querySelector('#dashboardTimeFilter button.active').dataset.range : 'latest';
  const isFiltered = activeRange !== 'latest';

  if (isFiltered) {
    monthIn = totalIn;
    monthOut = totalOut;
    lastMonthIn = 0;
    lastMonthOut = 0;
  }

  let totalPrincipal = totalIn - totalOut;
  let totalPositiveSetoran = typeof globalTotalPositiveSisaSetoran !== 'undefined' ? globalTotalPositiveSisaSetoran : 0;
  let total = totalPrincipal;

  if (isFiltered) {
     const range = document.querySelector('#dashboardTimeFilter button.active').dataset.range;
     const year = parseInt(document.getElementById('dashboardYearSelect').value);
     const month = parseInt(document.getElementById('dashboardMonthSelect').value);
     const endStr = document.getElementById('dashboardEndDate').value;
     
     let filterEndDate = new Date();
     if (range === 'yearly') {
       filterEndDate = new Date(year, 11, 31, 23, 59, 59);
     } else if (range === 'monthly') {
       filterEndDate = new Date(year, month + 1, 0, 23, 59, 59);
     } else if (range === 'custom') {
       if (endStr) {
         filterEndDate = new Date(endStr);
         filterEndDate.setHours(23, 59, 59);
       }
     }

     const cumulativeData = allData.filter(d => d.date && d.date <= filterEndDate);
     let cumIn = 0, cumOut = 0;
     const emps = {};
     const sorted = [...cumulativeData].sort((a,b)=>a.date-b.date);
     sorted.forEach(d => {
       if (d.isDeleted) return;
       const id = getEmpId(d);
       if (!emps[id]) emps[id] = { in: 0, out: 0 };
       if (d.type === 'Tabungan') {
         cumIn += d.nominal;
         emps[id].in += d.nominal;
       } else { 
         cumOut += d.nominal;
         emps[id].out += d.nominal;
       }
     });
     totalPrincipal = cumIn - cumOut;
     total = totalPrincipal;
     totalPositiveSetoran = Object.values(emps).reduce((sum, e) => {
       const net = e.in - e.out;
       return sum + (net > 0 ? net : 0);
     }, 0);
  }

  const netFlow = monthIn - monthOut;
  const lastNetFlow = lastMonthIn - lastMonthOut;

  // Update Labels to reflect Reference Month
  const refMonthName = monthNames[cm].toUpperCase() + ' ' + cy;
  const isAll = activeRange === 'all';
  const labelMap = {
    'kpiSetoranLabel': isAll ? `TOTAL SETORAN (SEMUA WAKTU)` : (isFiltered ? `TOTAL SETORAN (FILTERED)` : `SETORAN (${refMonthName})`),
    'kpiPenarikanLabel': isAll ? `TOTAL PENARIKAN (SEMUA WAKTU)` : (isFiltered ? `TOTAL PENARIKAN (FILTERED)` : `PENARIKAN (${refMonthName})`),
    'kpiNetGrowthLabel': isAll ? `CASHFLOW NET (SEMUA WAKTU)` : (isFiltered ? `CASHFLOW NET (FILTERED)` : `CASHFLOW NET (${refMonthName})`)
  };
  Object.entries(labelMap).forEach(([id, text]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  });

  // Render values and trends
  const setKPI = (id, val, current, last, isCurrency = true) => {
    const valEl = document.getElementById('kpi' + id);
    const trendEl = document.getElementById('kpi' + id + 'Trend'); 
    if (valEl) {
      if (id === 'TotalSaldo') {
        valEl.textContent = isCurrency ? fmt(total) : total;
      } else if (id === 'ModalPokok') {
        valEl.textContent = isCurrency ? fmt(totalPositiveSetoran) : totalPositiveSetoran;
      } else {
        valEl.textContent = isCurrency ? fmt(val) : val;
      }
    }
    if (trendEl) {
      if (last === 0) {
        trendEl.innerHTML = `<span class="trend-badge">--</span>`;
      } else {
        const pct = ((current - last) / Math.abs(last) * 100).toFixed(1);
        const up = parseFloat(pct) >= 0;
        // Business logic: higher deposits are good, higher withdrawals are cautionary
        const isPositive = (id === 'PenarikanBln' || id === 'ArusKas' && current < 0) ? !up : up;
        trendEl.innerHTML = `<span class="trend-badge ${isPositive ? 'up' : 'down'}"><i class="fas fa-arrow-${up ? 'up' : 'down'}"></i> ${up ? '+' : ''}${pct}%</span> vs bln lalu`;
      }
    }
  };

  setKPI('TotalSaldo', total, total, total - (monthIn - monthOut));
  setKPI('ModalPokok', totalPositiveSetoran, totalPositiveSetoran, totalPositiveSetoran - (monthIn - monthOut));
  setKPI('SetoranBln', monthIn, monthIn, lastMonthIn);
  setKPI('PenarikanBln', monthOut, monthOut, lastMonthOut);
  setKPI('NetGrowth', netFlow, netFlow, lastNetFlow);
  // To ensure consistency, KaryawanAktif should exactly match globalTotalActive
  const validActiveEmps = typeof globalTotalActive !== 'undefined' ? globalTotalActive : 0;
  setKPI('KaryawanAktif', validActiveEmps, validActiveEmps, 0, false);
  // Specific Net Growth description
  const kpiNetGrowthTrend = document.getElementById('kpiNetGrowthTrend');
  if (kpiNetGrowthTrend && netFlow !== 0) {
    const isDeficit = netFlow < 0;
    kpiNetGrowthTrend.innerHTML = `<span class="trend-badge ${isDeficit ? 'down' : 'up'}"><i class="fas fa-arrow-${isDeficit ? 'down' : 'up'}"></i> ${isDeficit ? 'Defisit' : 'Surplus'}</span>`;
  }


}



// ===== SECTION 3: FINANCIAL HEALTH ANALYTICS =====
function renderHealthAnalytics() {
  const dataToUse = globalFilteredData.length > 0 || (document.querySelector('#dashboardTimeFilter button.active') && document.querySelector('#dashboardTimeFilter button.active').dataset.range !== 'all') ? globalFilteredData : allData;
  const dataDates = dataToUse.filter(d => d.date);
  if (dataDates.length === 0) return;
  const latestDate = new Date();

  const emps = {};
  allEmployees.forEach(e => { emps[getEmpId(e)] = { lastSaving: null, balance: 0, count: 0 }; });
  
  let totalIn = 0, totalOut = 0;
  dataToUse.forEach(d => {
    if (d.isDeleted) return;
    const id = getEmpId(d);
    if (!emps[id]) return;
    if (d.type === 'Tabungan') {
      totalIn += d.nominal;
      emps[id].balance += d.nominal;
      emps[id].count++;
      if (!emps[id].lastSaving || d.date > emps[id].lastSaving) emps[id].lastSaving = d.date;
    } else {
      totalOut += d.nominal;
      emps[id].balance -= d.nominal;
    }
  });

  const activeSavers = Object.values(emps).filter(e => {
    if (!e.lastSaving) return false;
    const monthsSinceLast = (latestDate.getFullYear() - e.lastSaving.getFullYear()) * 12 + (latestDate.getMonth() - e.lastSaving.getMonth());
    return monthsSinceLast < 3;
  }).length;
  const dormantCount = Object.values(emps).filter(e => {
    if (!e.lastSaving) return true;
    const monthsSinceLast = (latestDate.getFullYear() - e.lastSaving.getFullYear()) * 12 + (latestDate.getMonth() - e.lastSaving.getMonth());
    return monthsSinceLast >= 3;
  }).length;
  const saverRate = (activeSavers / allEmployees.length * 100).toFixed(1);
  const withdrawalRatio = (totalIn > 0 ? (totalOut / totalIn * 100) : 0).toFixed(1);
  const avgSaving = allEmployees.length > 0 ? (globalTotalSaldo / allEmployees.length) : 0;

  // Recovery Rate from Anomalies
  const proven = allAnomalies.filter(a => a.status === 'TERBUKTI');
  const recovered = proven.filter(a => a.sysStatus === 'LUNAS').length;
  const recoveryRate = proven.length > 0 ? (recovered / proven.length * 100).toFixed(1) : 0;

  // AI Insights - Menggabungkan semua metrik kesehatan menjadi list
  const insights = [];
  insights.push(`<i class="fas fa-users"></i> Tingkat Karyawan Berinvestasi: <b>${saverRate}%</b> (${activeSavers} dari ${allEmployees.length} karyawan).`);
  insights.push(`<i class="fas fa-shield-alt"></i> Tingkat Pemulihan Transaksi Bermasalah: <b>${recoveryRate}%</b>.`);
  
  if (dormantCount > 5) insights.push(`<i class="fas fa-user-clock"></i> ${dormantCount} karyawan tidak menabung > 3 bulan.`);


  document.getElementById('aiInsightList').innerHTML = insights.map(i => `<li class="ai-insight-item">${i}</li>`).join('');
}


// ===== CHART HELPERS =====
// ECharts doesn't need global chartOpts like Chart.js did, configuration is passed per instance.

// ===== TREND CHART =====
function renderTrendChart() {
  const monthlyRate = 0.03 / 12;
  const sorted = [...globalFilteredData].filter(d => d.date).sort((a,b) => a.date - b.date);
  
  const snapshotEmps = {};
  const monthlyGroups = {};
  sorted.forEach(d => {
    const k = d.date.getFullYear() + '-' + String(d.date.getMonth()).padStart(2, '0');
    if(!monthlyGroups[k]) monthlyGroups[k] = [];
    monthlyGroups[k].push(d);
  });

  const keys = Object.keys(monthlyGroups).sort();
  const labels = [], dataAcc = [], dataPrincipal = [];

  keys.forEach(k => {
    const [y, m] = k.split('-');
    
    monthlyGroups[k].forEach(d => {
      if (d.isDeleted) return;
      const id = getEmpId(d);
      if (!snapshotEmps[id]) snapshotEmps[id] = { balance: 0, principal: 0, lastInterestMonth: null };
      
      if (d.type === 'Tabungan') {
        const txMonth = d.date.getFullYear() + '-' + d.date.getMonth();
        let interest = 0;
        if (snapshotEmps[id].lastInterestMonth !== txMonth) {
          if (snapshotEmps[id].principal > 0) interest = snapshotEmps[id].principal * monthlyRate;
          const currentBal = snapshotEmps[id].balance;
          if (currentBal > 0) interest = currentBal * monthlyRate;
          snapshotEmps[id].lastInterestMonth = txMonth;
        }
        snapshotEmps[id].principal += d.nominal;
        snapshotEmps[id].balance += interest + d.nominal;
      } else {
        snapshotEmps[id].principal -= d.nominal;
        const amountCovered = Math.max(0, Math.min(d.nominal, snapshotEmps[id].balance));
        if (amountCovered > 0) {
          const fromModal = Math.min(amountCovered, Math.max(0, snapshotEmps[id].principal));
          snapshotEmps[id].principal -= fromModal;
        } else {
          snapshotEmps[id].principal -= d.nominal;
        }
        snapshotEmps[id].balance -= d.nominal;
      }
    });

    let monthBal = 0, monthPrin = 0;
    Object.values(snapshotEmps).forEach(e => {
      monthBal += e.balance;
      monthPrin += e.principal;
    });
    
    labels.push(monthNames[+m] + ' ' + y);
    dataAcc.push(monthBal); 
    dataPrincipal.push(monthPrin);
  });

  const ctx = document.getElementById('trendChart');
  if (!ctx) return;
  if (charts.trend) charts.trend.dispose();
  charts.trend = echarts.init(ctx);
  charts.trend.setOption({
    tooltip: {
      trigger: 'axis', backgroundColor: 'rgba(15, 23, 42, 0.9)', textStyle: { color: '#fff' }, formatter: (p) => {
        let html = `<div style="font-family:Inter;font-weight:600;margin-bottom:4px">${p[0].name}</div>`;
        p.forEach(s => { html += `<div><span style="display:inline-block;margin-right:4px;border-radius:10px;width:10px;height:10px;background-color:${s.color};"></span>${s.seriesName}: ${fmt(s.value)}</div>`; });
        return html;
      }
    },
    legend: { top: 0, textStyle: { fontFamily: 'Inter', color: '#64748b' } },
    grid: { top: 40, right: 20, bottom: 50, left: 60 },
    xAxis: { type: 'category', data: labels, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#64748b', fontFamily: 'Inter' } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: 'rgba(226,232,240,0.6)' } }, axisLabel: { color: '#64748b', fontFamily: 'Inter', formatter: (v) => v >= 1e6 ? (v / 1e6) + 'jt' : v } },
    dataZoom: [
      { type: 'slider', show: true, bottom: 10, height: 20, borderColor: 'transparent', backgroundColor: '#f1f5f9', handleSize: '100%', fillerColor: 'rgba(91,141,239,0.2)' },
      { type: 'inside', zoomOnMouseWheel: true, moveOnMouseMove: true }
    ],
    series: [
      {
        name: 'Total Saldo',
        data: dataAcc, type: 'line', smooth: 0.4, symbol: 'circle', symbolSize: 6,
        itemStyle: { color: '#6366f1' }, lineStyle: { width: 3 },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(99, 102, 241, 0.2)' }, { offset: 1, color: 'rgba(99, 102, 241, 0.0)' }]) }
      },
      {
        name: 'Total Setoran',
        data: dataPrincipal, type: 'line', smooth: 0.4, symbol: 'none',
        itemStyle: { color: '#10b981' }, lineStyle: { width: 2, type: 'dashed' }
      }
    ]
  });
}

// ===== CASH FLOW CHART =====
function renderCashFlowChart() {
  const monthly = {};
  globalFilteredData.forEach(d => { if (!d.date || d.isDeleted) return; const k = d.date.getFullYear() + '-' + String(d.date.getMonth()).padStart(2, '0'); if (!monthly[k]) monthly[k] = { in: 0, out: 0 }; d.type === 'Tabungan' ? monthly[k].in += d.nominal : monthly[k].out += d.nominal; });
  const keys = Object.keys(monthly).sort().slice(-6); // last 6 months
  const labels = [], dataIn = [], dataOut = [], dataNet = [];
  keys.forEach(k => {
    const [y, m] = k.split('-'); labels.push(monthNames[+m] + ' ' + y);
    dataIn.push(monthly[k].in); dataOut.push(monthly[k].out);
    dataNet.push(monthly[k].in - monthly[k].out);
  });

  const ctx = document.getElementById('cashFlowChart');
  if (!ctx) return;
  if (charts.cashFlow) charts.cashFlow.dispose();
  charts.cashFlow = echarts.init(ctx);
  charts.cashFlow.setOption({
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: 'rgba(15, 23, 42, 0.9)', textStyle: { color: '#fff' }, formatter: (p) => {
        let html = `<div style="font-family:Inter;font-weight:600;margin-bottom:4px">${p[0].name}</div>`;
        p.forEach(s => { html += `<div><span style="display:inline-block;margin-right:4px;border-radius:10px;width:10px;height:10px;background-color:${s.color};"></span>${s.seriesName}: ${fmt(s.value)}</div>`; });
        return html;
      }
    },
    legend: { data: ['Setoran', 'Penarikan', 'Net Flow'], top: 0, itemGap: 20, textStyle: { fontFamily: 'Inter', color: '#64748b' } },
    grid: { top: 40, right: 20, bottom: 20, left: 60 },
    xAxis: { type: 'category', data: labels, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#64748b', fontFamily: 'Inter' } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: 'rgba(226,232,240,0.6)' } }, axisLabel: { color: '#64748b', fontFamily: 'Inter', formatter: (v) => v >= 1e6 ? (v / 1e6) + 'jt' : v } },
    dataZoom: [{ type: 'inside', zoomOnMouseWheel: true, moveOnMouseMove: true }],
    series: [
      { name: 'Setoran', type: 'bar', data: dataIn, itemStyle: { color: '#10b981', borderRadius: [4, 4, 0, 0] } },
      { name: 'Penarikan', type: 'bar', data: dataOut, itemStyle: { color: '#ef4444', borderRadius: [4, 4, 0, 0] } },
      { name: 'Net Flow', type: 'line', data: dataNet, smooth: true, itemStyle: { color: '#3b82f6' }, lineStyle: { width: 3 }, symbolSize: 8 }
    ]
  });
}


// ===== FUND COMPOSITION CHART =====
function renderFundCompositionChart() {
  const dataToUse = globalFilteredData.length > 0 || (document.querySelector('#dashboardTimeFilter button.active') && document.querySelector('#dashboardTimeFilter button.active').dataset.range !== 'all') ? globalFilteredData : allData;
  let totalIn = 0, totalOut = 0;
  dataToUse.forEach(d => {
    if (d.isDeleted) return;
    if (d.type === 'Tabungan') totalIn += d.nominal;
    else totalOut += d.nominal;
  });

  let transaksiMencurigakan = 0;
  allAnomalies.forEach(a => {
    if (a.status === 'Verified' || a.status === 'MENUNGGU REVIEW' || a.status === 'TERBUKTI') {
      transaksiMencurigakan += a.initialDebt || 0;
    }
  });

  const totalPrincipal = totalIn - totalOut;
  const keuntunganSisa = Math.max(0, globalTotalSaldo - totalPrincipal);
  const modalPokokSisa = Math.max(0, totalPrincipal);
  const penarikanValid = Math.max(0, totalOut - transaksiMencurigakan);

  const ctx = document.getElementById('fundCompositionChart');
  if (!ctx) return;
  if (charts.fundComposition) charts.fundComposition.dispose();
  charts.fundComposition = echarts.init(ctx);
  
  const chartData = [
    { value: modalPokokSisa, name: 'Modal Pokok (Sisa)', itemStyle: { color: '#4f46e5' } },
    { value: keuntunganSisa, name: 'Bunga (Sisa)', itemStyle: { color: '#f59e0b' } },
    { value: penarikanValid, name: 'Total Penarikan', itemStyle: { color: '#ef4444' } }
  ];

  if (transaksiMencurigakan > 0) {
    chartData.push({ value: transaksiMencurigakan, name: 'Transaksi Meragukan', itemStyle: { color: '#8b5cf6' } });
  }

  charts.fundComposition.setOption({
    tooltip: { trigger: 'item', formatter: function(params) {
      return `${params.name}<br/><b>Rp ${params.value.toLocaleString('id-ID')}</b> (${params.percent}%)`;
    }},
    legend: { bottom: '0%', left: 'center', itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11 } },
    series: [
      {
        name: 'Komposisi',
        type: 'pie',
        radius: ['45%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 5, borderColor: '#fff', borderWidth: 2 },
        label: { show: false, position: 'center' },
        emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
        labelLine: { show: false },
        data: chartData
      }
    ]
  });
}


// ===== TOP CONTRIBUTORS =====
function renderTopInvestors() {
  const dataToUse = globalFilteredData.length > 0 || (document.querySelector('#dashboardTimeFilter button.active') && document.querySelector('#dashboardTimeFilter button.active').dataset.range !== 'all') ? globalFilteredData : allData;
  const emps = {}; 
  dataToUse.forEach(d => {
    if (d.isDeleted) return;
    const id = getEmpId(d);
    if (!emps[id]) emps[id] = { balance: 0, name: d.name };
    emps[id].balance += d.type === 'Tabungan' ? d.nominal : -d.nominal;
  });
  
  const sorted = Object.entries(emps)
    .filter(a => a[1].balance > 0)
    .sort((a, b) => a[1].balance - b[1].balance);
  
  const top10 = sorted.slice(-10);

  const ctx = document.getElementById('topInvestorChart');
  if (!ctx) return;
  if (charts.topInv) charts.topInv.dispose();
  charts.topInv = echarts.init(ctx);
  charts.topInv.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { top: 20, right: 40, bottom: 20, left: 120 },
    xAxis: { type: 'value', axisLabel: { formatter: (v) => v >= 1e6 ? (v/1e6).toFixed(1) + 'jt' : v } },
    yAxis: { type: 'category', data: top10.map(s => s[1].name.length > 15 ? s[1].name.substring(0, 15) + '…' : s[1].name) },
    series: [{
      type: 'bar',
      data: top10.map(s => s[1].balance),
      itemStyle: { color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [{ offset: 0, color: '#4f46e5' }, { offset: 1, color: '#818cf8' }]), borderRadius: [0, 4, 4, 0] },
      label: { show: true, position: 'right', formatter: (p) => fmt(p.value) }
    }]
  });
}


// ===== RECENT TABLE =====
function renderRecentTable(query = '') {
  const q = query.toLowerCase().trim();
  let filtered = [...globalFilteredData].filter(d => d.date && !d.isDeleted);
  if (q) {
    filtered = filtered.filter(d => d.name.toLowerCase().includes(q) || (d.nik && d.nik.toLowerCase().includes(q)) || d.jenis.toLowerCase().includes(q));
  }
  
  const sortedGlobal = filtered.sort((a, b) => b.date - a.date);
  const recent = sortedGlobal.slice(0, 15);

  
  const empStats = {};
  allData.forEach(d => {
    if (d.isDeleted) return;
    const id = getEmpId(d);
    if (!empStats[id]) empStats[id] = { count: 0, last: null, balance: 0, totalOut: 0 };
    if (d.type === 'Tabungan') {
      empStats[id].count++;
      if (!empStats[id].last || d.date > empStats[id].last) empStats[id].last = d.date;
      empStats[id].balance += d.nominal;
    } else {
      empStats[id].totalOut += d.nominal;
      empStats[id].balance -= d.nominal;
    }
  });

  document.querySelector('#recentTable tbody').innerHTML = recent.map(d => {
    const id = getEmpId(d);
    const stats = empStats[id];


    const badgeCls = d.type === 'Tabungan' ? 'in' : 'out';
    const escName = d.name.replace(/'/g, "\\'");
    
    return `<tr>
      <td>${d.dateStr}</td>
      <td><div style="font-weight:700">${d.name}</div><div style="font-size:0.7rem; color:var(--text-muted)">${d.nik || '-'}</div></td>
      <td>${d.jenis}</td>
      <td style="font-weight:800; color: ${d.type === 'Tabungan' ? 'var(--success)' : 'var(--danger)'}">${fmt(d.nominal)}</td>
      <td><span class="badge ${badgeCls}">${d.type}</span></td>
      <td><button class="btn btn-outline" style="padding: 6px 12px; font-size: 0.75rem;" onclick="goToEmployee('${escName}', '${d.nik}')" title="Detail"><i class="fas fa-search"></i></button></td>
    </tr>`;
  }).join('');
}



// ===== ANOMALI LOGIC =====
function calculateAnomalies() {
  // 0. Bangun Peta Histori Nama Global (Identity Audit Trail)
  const globalNameAudit = {}; // NIK/ID -> originalName
  allReviews.forEach(r => {
    if (r.correctName && r.correctName !== '-') {
      const parts = r.txKey.split('_');
      if (parts.length >= 4) {
        // Nama berada di antara 'anomali' dan 'Timestamp' (2 bagian terakhir adalah Timestamp & Nominal)
        let originalNameFromKey = parts.slice(1, -2).join(' ');
        
        // Jika yang ditemukan di TxKey adalah NIK, coba cari nama aslinya di database karyawan
        const foundEmp = allEmployees.find(e => e.nik === originalNameFromKey);
        if (foundEmp) {
          originalNameFromKey = foundEmp.name;
        }

        if (originalNameFromKey !== r.correctName && r.correctName && r.correctName !== '-') {
          const key = r.correctNik || r.correctName;
          if (!globalNameAudit[key]) globalNameAudit[key] = originalNameFromKey;
        }
      }
    }
  });

  const sortedData = allData.filter(d => d.date && !d.isDeleted);
  const emps = {};
  allAnomalies = [];
  const reviewMap = {};
  if (allReviews && allReviews.length > 0) {
    allReviews.forEach(r => { reviewMap[r.txKey] = r; });
  }

  const monthlyRate = 0.03 / 12;

  const empsData = {};
  sortedData.forEach(d => {
    const id = getEmpId(d);
    if (!empsData[id]) empsData[id] = [];
    empsData[id].push(d);
  });

  Object.keys(empsData).forEach(id => {
    const txs = empsData[id];
    if (txs.length === 0) return;

    let balance = 0;
    let pendingInterest = 0;
    let lastDepositDate = null;
    let lastInterestMonth = null;
    let empActiveAnomalies = []; // Hanya melacak kasus yang belum LUNAS untuk alokasi FIFO
    let lifeIn = 0;
    let lifeOut = 0;

    txs.sort((a, b) => a.date - b.date);

    txs.forEach(t => {
      const txMonth = t.date ? (t.date.getFullYear() + '-' + t.date.getMonth()) : null;
      if (t.type === 'Tabungan') {
        if (txMonth && lastInterestMonth !== txMonth) {
          // Bunga hanya dihitung untuk periode transaksi sebelum cut-off date 18 Mei 2026
          if (balance > 0 && (!t.date || t.date < CUT_OFF_DATE)) {
            pendingInterest = balance * monthlyRate;
          } else {
            pendingInterest = 0;
          }
          lastInterestMonth = txMonth;
        }
      }

      const balanceBefore = balance;
      
      if (t.type === 'Tabungan') {
        balance += pendingInterest;
        balance += t.nominal;
        pendingInterest = 0;
        lastDepositDate = t.date;
        lifeIn += t.nominal;

        // ALOKASI FIFO: Gunakan setoran untuk menutup hutang kasus lama
        let payment = t.nominal;
        empActiveAnomalies.forEach(a => {
          if (payment > 0 && a.remainingDebt > 0) {
            const amountToCover = Math.min(payment, a.remainingDebt);
            a.remainingDebt -= amountToCover;
            payment -= amountToCover;
            
            if (a.remainingDebt <= 0) {
              a.systemStatus = 'LUNAS';
            } else {
              a.systemStatus = 'DICICIL';
            }
          }
        });
        // Hapus yang sudah LUNAS dari tracker aktif agar FIFO selanjutnya lebih cepat
        empActiveAnomalies = empActiveAnomalies.filter(a => a.systemStatus !== 'LUNAS');

      } else {
        // Penarikan
        balance -= t.nominal;
        pendingInterest = 0;
        lifeOut += t.nominal;
      }

      // 2. Deteksi Kasus Baru jika Saldo Negatif ATAU sudah pernah direview
      // Cek dua kemungkinan TxKey: menggunakan NIK (baru) atau menggunakan Nama (lama)
      const idNik = t.nik || id;
      const idName = t.name.replace(/\s+/g, '_');
      const txKeyNik = `anomali_${idNik}_${t.date?.getTime() || 0}_${t.nominal}`.replace(/\s+/g, '_');
      const txKeyName = `anomali_${idName}_${t.date?.getTime() || 0}_${t.nominal}`.replace(/\s+/g, '_');
      
      let review = reviewMap[txKeyNik] || reviewMap[txKeyName];
      
      let correctionReview = null;
      // Hanya cari koreksi jika tidak ada review langsung yang ditemukan.
      // Ini mengasumsikan bahwa jika tidak ada review, namanya mungkin telah berubah.
      if (!review) {
        correctionReview = allReviews.find(r => 
          (r.correctName === t.name || r.correctNik === t.nik) && 
          Math.abs(r.nominal - t.nominal) < 1
        );
        // Jika koreksi ditemukan, gunakan txKey lama untuk menemukan review TERBARU.
        if (correctionReview) {
          review = reviewMap[correctionReview.txKey];
        }
      }

      const activeReview = review || correctionReview;
      const txKey = activeReview ? activeReview.txKey : txKeyNik;
      
      let manualStatus = 'MENUNGGU REVIEW';
      if (activeReview) {
          if (activeReview.status === 'MENUNGGU REVIEW' || activeReview.status === 'In Progress') manualStatus = 'MENUNGGU REVIEW';
          else if (activeReview.status === 'SALAH INPUT' || activeReview.status === 'Salah Orang') manualStatus = 'SALAH INPUT';
          else if (activeReview.status === 'TERBUKTI' || activeReview.status === 'Verified') manualStatus = 'TERBUKTI';
          else manualStatus = activeReview.status;
      }

      // Simpan Nama Asli dari Identity Audit Trail
      let originalName = t.name;

      // Gunakan globalNameAudit sebagai fallback untuk menelusuri nama asli sebelum dikoreksi
      if (globalNameAudit[t.nik]) {
        originalName = globalNameAudit[t.nik];
      } else if (globalNameAudit[t.name]) {
        originalName = globalNameAudit[t.name];
      }

      // Jika ini adalah kasus yang dikoreksi (correctionReview ditemukan),
      // maka kita perlu mengekstrak nama asli dari txKey lama.
      if (correctionReview && correctionReview.txKey) {
        const parts = correctionReview.txKey.split('_');
        if (parts.length >= 4) {
          let nameFromKey = parts.slice(1, -2).join(' ');
          
          // Resolusi NIK ke Nama asli jika tersimpan dalam format NIK
          const foundEmp = allEmployees.find(e => e.nik === nameFromKey);
          if (foundEmp) {
            nameFromKey = foundEmp.name;
          }
          
          // Pastikan ini bukan NIK dan memang berbeda dengan nama saat ini
          if (nameFromKey !== t.name && nameFromKey !== t.nik) {
            originalName = nameFromKey;
          }
        }
      }

      const isDeficit = balance < -10000;

      if (t.type === 'Penarikan' && (isDeficit || activeReview)) {
        // Hitung berapa defisit yang diciptakan oleh transaksi ini
        const deficitCreated = isDeficit ? (balanceBefore > 0 ? Math.abs(balance) : t.nominal) : 0;

        const anomalyData = {
          txKey, empId: id, nik: t.nik || '', originalNo: t.sheetRow, date: t.date,
          dateStr: t.dateStr || fmtDate(t.date), name: t.name, nominal: t.nominal,
          balanceBefore, balanceAfter: balance,
          originalName: originalName,
          correctName: activeReview?.correctName || '',
          correctNik: activeReview?.correctNik || '',
          initialDebt: deficitCreated,
          remainingDebt: deficitCreated,
          reason: isDeficit ? 'Saldo defisit > 10rb' : 'Histori Review Admin', 
          status: manualStatus, 
          systemStatus: isDeficit ? 'MENCURIGAKAN' : 'LUNAS',
          notes: review ? review.notes : '-', reviewer: review ? (review.reviewer || '-') : '-',
          keterangan: t.keterangan || '-', jenis: t.jenis || 'Penarikan'
        };
        
        // Jika sudah LUNAS di histori, biarkan tetap lunas
        if (!isDeficit) anomalyData.systemStatus = 'LUNAS';

        allAnomalies.push(anomalyData);
        if (isDeficit) empActiveAnomalies.push(anomalyData);
      }
    });

    let isActive = false;
    if (lastDepositDate) {
      const refDate = typeof globalReferenceDate !== 'undefined' && globalReferenceDate ? globalReferenceDate : new Date();
      const diffMonths = (refDate.getFullYear() - lastDepositDate.getFullYear()) * 12 + (refDate.getMonth() - lastDepositDate.getMonth());
      isActive = diffMonths < 3;
    }
    const sisaSetoran = lifeIn - lifeOut;
    emps[id] = { balance, isActive, lastDepositDate, sisaSetoran };
  });

  globalTotalSaldo = Object.values(emps).reduce((sum, e) => sum + e.balance, 0);
  globalTotalPositiveSisaSetoran = Object.values(emps).reduce((sum, e) => sum + (e.sisaSetoran > 0 ? e.sisaSetoran : 0), 0);
  globalTotalActive = Object.values(emps).filter(e => e.isActive).length;
  allEmployeesStatus = emps;

  if (currentUser && currentUser.role === 'admin' && allAnomalies.length > 0) {
    syncAnomaliesToSheet(allAnomalies);
  }
}

async function syncAnomaliesToSheet(anomalies) {
  try {
    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'syncAnomalies',
        anomalies: anomalies.map(a => ({
          tanggal: a.dateStr,
          karyawan: a.name,
          nominal: a.nominal,
          saldoSebelum: a.balanceBefore,
          selisih: a.balanceAfter,
          alasan: a.reason,
          status: a.status,
          notes: a.notes,
          reviewer: a.reviewer
        }))
      })
    });
  } catch (e) {
    console.warn('Gagal sinkronisasi transaksi mencurigakan:', e);
  }
}

function renderAnomaliTable() {
  const sumContainer = document.getElementById('anomaliSummary');
  const q = (document.getElementById('anomaliSearch')?.value || '').toLowerCase().trim();
  const mode = document.getElementById('anomaliFilterMode')?.value || 'custom';
  const startMonth = document.getElementById('anomaliFilterStartMonth')?.value || '';
  const endMonth = document.getElementById('anomaliFilterEndMonth')?.value || '';
  const filterStatus = document.getElementById('anomaliStatusFilter')?.value || '';
  const filterRepeat = document.getElementById('anomaliRepeatFilter')?.value || 'all';
  const filterEmpStatus = document.getElementById('anomaliEmpStatusFilter')?.value || 'all';
  const yearVal = document.getElementById('anomaliFilterYear')?.value || new Date().getFullYear().toString();
  const year = yearVal === 'all' ? 'all' : parseInt(yearVal);

  // Populate Year Dropdown if empty
  const yrSel = document.getElementById('anomaliFilterYear');
  if (yrSel && yrSel.options.length === 0) {
    const years = [...new Set(allAnomalies.filter(d => d.date).map(d => d.date.getFullYear()))].sort((a, b) => b - a);
    if (years.length === 0) years.push(new Date().getFullYear());
    yrSel.innerHTML = `<option value="all">Semua Tahun</option>` + years.map(y => `<option value="${y}" ${y === new Date().getFullYear() ? 'selected' : ''}>${y}</option>`).join('');
  }

  // Hitung frekuensi anomali per orang untuk filter repeat
  const frequencyMap = {};
  allAnomalies.forEach(a => {
    const id = a.nik && a.nik !== '-' ? a.nik : a.name;
    frequencyMap[id] = (frequencyMap[id] || 0) + 1;
  });

  let filtered = allAnomalies.filter(a => {
    const checkedStatuses = Array.from(document.querySelectorAll('.sys-status-chk:checked')).map(cb => cb.value);

    let pass = true;
    
    // 1. Search filter
    const variations = (a.nik && a.nik !== '-' ? (allAliasesMap[a.nik] ? Array.from(allAliasesMap[a.nik]) : [a.name]) : [a.name]);
    if (q) pass = pass && (variations.some(v => v.toLowerCase().includes(q)) || (a.nik && a.nik.toLowerCase().includes(q)));
    
    // 2. Status filter (Manual Review Status)
    if (filterStatus) {
      if (filterStatus === 'SALAH INPUT') {
        // Tampilkan yang statusnya SALAH INPUT ATAU yang punya riwayat koreksi nama
        pass = pass && (a.status === 'SALAH INPUT' || (a.originalName && a.originalName !== a.name));
      } else {
        pass = pass && a.status === filterStatus;
      }
    }
    
    // 2.5 Visibility Logic
    const isKoreksi = (a.status === 'SALAH INPUT' || (a.originalName && a.originalName !== a.name));
    
    if (filterStatus === 'SALAH INPUT') {
      // Bypass filter checkbox sistem jika user secara eksplisit memfilter "Koreksi"
    } else if (checkedStatuses.length > 0) {
      pass = pass && checkedStatuses.includes(a.systemStatus);
    } else {
      const isVisibleByDefault = (a.systemStatus === 'MENCURIGAKAN' || a.systemStatus === 'DICICIL' || a.status === 'TERBUKTI' || isKoreksi);
      pass = pass && isVisibleByDefault;
    }

    // 3. Repeat filter
    if (filterRepeat === 'repeat') {
      const id = a.nik && a.nik !== '-' ? a.nik : a.name;
      pass = pass && frequencyMap[id] > 1;
    }

    // 3.5. Employee Status Filter
    if (filterEmpStatus !== 'all') {
      const id = a.nik && a.nik !== '-' ? a.nik : a.name;
      const status = allEmployeesStatus[id] || { isActive: false };
      if (filterEmpStatus === 'on') pass = pass && status.isActive;
      if (filterEmpStatus === 'off') pass = pass && !status.isActive;
    }
    
    // 4. Date filter (Custom Mode)
    if (mode === 'custom' && a.date) {
      if (startMonth) {
        const [sy, sm] = startMonth.split('-').map(Number);
        const startDate = new Date(sy, sm, 1);
        pass = pass && a.date >= startDate;
      }
      if (endMonth) {
        const [ey, em] = endMonth.split('-').map(Number);
        const endDate = new Date(ey, em + 1, 0, 23, 59, 59);
        pass = pass && a.date <= endDate;
      }
    }
    
    // 5. Date filter (Monthly Mode)
    if (mode === 'monthly' && a.date) {
      if (year !== 'all') {
        pass = pass && a.date.getFullYear() === year;
      }
    }
    
    return pass;
  });

  // KPI Summary remains based on filtered data
  if (sumContainer) {
    const totalAnomali = filtered.length;
    const groupStatusSum = (statusName) => {
      return filtered
        .filter(a => a.status === statusName)
        .reduce((sum, a) => sum + (a.remainingDebt || 0), 0);
    };

    const potensiKerugian = groupStatusSum('MENUNGGU REVIEW');
    const kerugianTerbukti = groupStatusSum('TERBUKTI');
    const countVerified = filtered.filter(a => a.status === 'TERBUKTI').length;
    const countKoreksi = filtered.filter(a => a.status === 'SALAH INPUT' || (a.originalName && a.originalName !== a.name)).length;
    
    const totalInitial = filtered.reduce((sum, a) => sum + (a.initialDebt || 0), 0);
    const totalRemaining = filtered.reduce((sum, a) => sum + (a.remainingDebt || 0), 0);
    const totalRecovered = totalInitial - totalRemaining;
    const recoveryRate = totalInitial > 0 ? (totalRecovered / totalInitial * 100) : 0;
    const uniqueEmps = new Set(filtered.map(a => a.nik || a.name)).size;

    if (mode === 'monthly') {
      sumContainer.innerHTML = `
        <div class="summary-card"><div class="card-icon green"><i class="fas fa-chart-line"></i></div><div class="card-label">TINGKAT PEMULIHAN</div><div class="card-value" style="color:#10b981;">${recoveryRate.toFixed(1)}%</div><div class="card-sub">Pemulihan Dana</div></div>
        <div class="summary-card"><div class="card-icon blue"><i class="fas fa-users"></i></div><div class="card-label">RASIO KASUS</div><div class="card-value" style="color:#3b82f6;">${uniqueEmps > 0 ? (totalAnomali/uniqueEmps).toFixed(1) : 0}x</div><div class="card-sub">${totalAnomali} Kasus / ${uniqueEmps} Orang</div></div>
        <div class="summary-card"><div class="card-icon orange"><i class="fas fa-hand-holding-usd"></i></div><div class="card-label">TOTAL PEMULIHAN</div><div class="card-value" style="color:#f59e0b;">${fmt(totalRecovered)}</div><div class="card-sub">Dari total ${fmt(totalInitial)}</div></div>
        <div class="summary-card"><div class="card-icon red"><i class="fas fa-exclamation-circle"></i></div><div class="card-label">SISA DEFISIT</div><div class="card-value" style="color:#ef4444;">${fmt(totalRemaining)}</div><div class="card-sub">Belum Terbayar</div></div>
        <div class="summary-card"><div class="card-icon purple" style="background: rgba(168, 85, 247, 0.1); color: #a855f7;"><i class="fas fa-check-double"></i></div><div class="card-label">AKURASI INPUT</div><div class="card-value">${(100 - (countKoreksi/totalAnomali*100 || 0)).toFixed(1)}%</div><div class="card-sub">Validitas Data</div></div>
      `;
    } else {
      sumContainer.innerHTML = `
        <div class="summary-card"><div class="card-icon red"><i class="fas fa-exclamation-triangle"></i></div><div class="card-label">TOTAL KASUS</div><div class="card-value">${totalAnomali}</div><div class="card-sub">Data sesuai filter</div></div>
        <div class="summary-card"><div class="card-icon indigo"><i class="fas fa-coins"></i></div><div class="card-label">Total Over-Withdraw</div><div class="card-value" style="color: #6366f1;">${fmt(totalInitial)}</div><div class="card-sub">Total defisit awal</div></div>
        <div class="summary-card"><div class="card-icon green"><i class="fas fa-hand-holding-usd"></i></div><div class="card-label">Total Hutang Terbayar</div><div class="card-value" style="color: #10b981;">${fmt(totalRecovered)}</div><div class="card-sub">Total pemulihan dana</div></div>
        <div class="summary-card"><div class="card-icon orange"><i class="fas fa-exclamation-circle"></i></div><div class="card-label">Potensi Selisih</div><div class="card-value" style="color: #f59e0b;">${fmt(potensiKerugian)}</div><div class="card-sub">Status: Menunggu Review</div></div>
        <div class="summary-card"><div class="card-icon red"><i class="fas fa-times-circle"></i></div><div class="card-label">Selisih Terbukti</div><div class="card-value" style="color: #ef4444;">${fmt(kerugianTerbukti)}</div><div class="card-sub">Total Defisit Terkonfirmasi</div></div>
        <div class="summary-card"><div class="card-icon blue"><i class="fas fa-check-double"></i></div><div class="card-label">Kasus Terbukti</div><div class="card-value">${countVerified}</div><div class="card-sub">Telah diverifikasi salah</div></div>
        <div class="summary-card"><div class="card-icon purple" style="background: rgba(168, 85, 247, 0.1); color: #a855f7;"><i class="fas fa-user-check"></i></div><div class="card-label">Koreksi Data</div><div class="card-value">${countKoreksi}</div><div class="card-sub">Salah Input / Nama</div></div>
      `;
    }
  }

  const tbody = document.querySelector('#anomaliTable tbody');
  if (!tbody) return;
  
  if (mode === 'monthly') {
    // Clear search and status filter temporarily for true analytics insight
    // unless the user intentionally wants to analyze a specific subset
    renderAnomaliAnalytics(filtered, tbody);
    return;
  }

  const getSortIcon = (col) => {
    if (anomaliSort.col !== col) return '<i class="fas fa-sort"></i>';
    return anomaliSort.asc ? '<i class="fas fa-sort-up"></i>' : '<i class="fas fa-sort-down"></i>';
  };

  // Restore Headers if not monthly
  document.querySelector('#anomaliTable thead').innerHTML = `
    <tr>
      <th>No</th>
      <th class="sortable-anomali" data-col="1" style="cursor:pointer">Tanggal ${getSortIcon(1)}</th>
      <th class="sortable-anomali" data-col="2" style="cursor:pointer">Karyawan ${getSortIcon(2)}</th>
      <th class="sortable-anomali" data-col="3" style="cursor:pointer">Nominal ${getSortIcon(3)}</th>
      <th class="sortable-anomali" data-col="4" style="cursor:pointer">Saldo Sebelum ${getSortIcon(4)}</th>
      <th class="sortable-anomali" data-col="5" style="cursor:pointer">Selisih ${getSortIcon(5)}</th>
      <th>Status Sistem</th>
      <th>Status Tinjauan</th>
      <th>Aksi</th>
      <th>Catatan Admin</th>
      <th>Peninjau</th>
    </tr>
  `;

  // Sorting for Custom Mode
  filtered.sort((a, b) => {
    let v1, v2;
    switch (anomaliSort.col) {
      case 1: v1 = a.date || 0; v2 = b.date || 0; break;
      case 2: v1 = a.name; v2 = b.name; break;
      case 3: v1 = a.nominal; v2 = b.nominal; break;
      case 4: v1 = a.balanceBefore; v2 = b.balanceBefore; break;
      case 5: v1 = a.balanceAfter; v2 = b.balanceAfter; break;
      default: return 0;
    }
    if (v1 < v2) return anomaliSort.asc ? -1 : 1;
    if (v1 > v2) return anomaliSort.asc ? 1 : -1;
    return 0;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding: 20px; color: #10b981;"><i class="fas fa-check-circle"></i> Tidak ada transaksi meragukan terdeteksi.</td></tr>`;
  } else {
    tbody.innerHTML = filtered.map((a, idx) => {
      const emp = allEmployees.find(e => (e.nik && e.nik === a.nik) || e.name === a.name);
      const aliases = emp ? emp.variations.filter(v => v !== a.name) : [];
      const variationsHtml = aliases.length > 0 ? `<div style="font-size:0.65rem; color:#64748b; font-style:italic;">Alias: ${aliases.join(', ')}</div>` : '';

      const statusClass = a.status === 'TERBUKTI' ? 'status-verified' : (a.status === 'SALAH INPUT' ? 'status-verified' : 'status-progress');
      const sysStatusColor = a.systemStatus === 'MENCURIGAKAN' ? '#ef4444' : (a.systemStatus === 'DICICIL' ? '#f59e0b' : '#10b981');
      
      const isAdmin = currentUser && currentUser.role === 'admin';
      const reviewBtn = isAdmin ? `<button class="btn btn-outline" style="padding:4px 8px; font-size:0.75rem;" onclick="openReviewModal('${a.txKey}')" title="Review"><i class="fas fa-clipboard-check"></i></button>` : '';

      let noteContent = a.notes;
      if (a.status === 'SALAH INPUT' && (a.correctName || a.correctNik)) {
        noteContent = `[Koreksi: ${a.correctName || '-'} / ${a.correctNik || '-'}] ${a.notes !== '-' ? a.notes : ''}`;
      }

      const escName = a.name.replace(/'/g, "\\'");
      const empNik = a.nik || '';

      return `<tr>
        <td style="font-size: 0.8rem; color: #64748b; font-weight: 500;">${idx + 1}</td>
        <td>${a.dateStr}</td>
        <td>
          ${a.originalName && a.originalName !== a.name 
            ? `<div style="font-size: 0.7rem; color: #94a3b8; text-decoration: line-through; margin-bottom: 2px;">${a.originalName}</div>
               <div style="font-weight: 700; color: #1e293b;"><i class="fas fa-arrow-right" style="font-size: 0.65rem; color: #3b82f6;"></i> ${a.name}</div>`
            : `<div style="font-weight: 700;">${a.name}</div>`
          }
          ${variationsHtml}
          <div style="font-size: 0.75rem; color: #64748b;">${a.nik}</div>
        </td>
        <td style="color:#ef4444; font-weight:600;">${fmt(a.nominal)}</td>
        <td style="color:#334155;">${fmt(a.balanceBefore)}</td>
        <td style="color:#ef4444; font-weight:700;">
          <div style="font-size:0.8rem; opacity:0.8;">Selisih:</div>
          <div>${fmt(a.initialDebt)}</div>
          ${a.remainingDebt < a.initialDebt && a.remainingDebt > 0 ? `<div style="font-size:0.7rem; color:#f59e0b; font-weight:600; margin-top:4px;">Sisa Cicilan: ${fmt(a.remainingDebt)}</div>` : ''}
        </td>
        <td><span style="font-size:0.75rem; padding: 2px 6px; border-radius: 4px; border: 1px solid ${sysStatusColor}; color: ${sysStatusColor}; font-weight: 600; text-transform: uppercase;">${a.systemStatus === 'MENCURIGAKAN' ? 'MERAGUKAN' : a.systemStatus}</span></td>
        <td><span class="badge-status ${statusClass}">${a.status}</span></td>
        <td style="display: flex; gap: 4px;">
          ${reviewBtn}
          <button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem;" onclick="goToEmployee('${escName}', '${empNik}')" title="Detail"><i class="fas fa-search"></i></button>
        </td>
        <td style="min-width: 200px; max-width: 300px; white-space: pre-wrap; word-wrap: break-word; font-size: 0.85rem;" title="${noteContent}">${noteContent}</td>
        <td style="font-size: 0.8rem; color: #64748b;">${a.reviewer}</td>
      </tr>`;
    }).join('');
  }
}

/**
 * ANALYTICS ENGINE: Provides deep insights into suspicious transactions
 */
function renderAnomaliAnalytics(data, container) {
  if (data.length === 0) {
    container.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 40px;">Tidak ada data untuk dianalisis.</td></tr>';
    return;
  }

  // 1. Calculations
  const totalInitial = data.reduce((sum, a) => sum + (a.initialDebt || 0), 0);
  const totalRemaining = data.reduce((sum, a) => sum + (a.remainingDebt || 0), 0);
  const totalRecovered = totalInitial - totalRemaining;
  const recoveryRate = totalInitial > 0 ? (totalRecovered / totalInitial * 100) : 0;
  
  const uniqueEmps = new Set(data.map(a => a.nik || a.name)).size;
  const totalCases = data.length;

  // 2. Trend Grouping (By Month)
  const trends = {};
  data.forEach(a => {
    const key = a.date.getFullYear() + '-' + String(a.date.getMonth()).padStart(2, '0');
    if (!trends[key]) trends[key] = { cases: 0, initial: 0, recovered: 0, emps: new Set() };
    trends[key].cases++;
    trends[key].initial += (a.initialDebt || 0);
    trends[key].recovered += ((a.initialDebt || 0) - (a.remainingDebt || 0));
    trends[key].emps.add(a.nik || a.name);
  });

  // 3. Matrix Analysis (System vs Review)
  const matrix = {
    'Selisih Selesai Dibayar': data.filter(a => a.systemStatus === 'LUNAS' && a.status === 'TERBUKTI').length,
    'Sedang Pemulihan': data.filter(a => a.systemStatus === 'DICICIL' && a.status === 'TERBUKTI').length,
    'False Positive (Koreksi)': data.filter(a => a.status === 'SALAH INPUT').length,
    'Belum Terjamah': data.filter(a => a.systemStatus === 'MENCURIGAKAN' && a.status === 'MENUNGGU REVIEW').length
  };

  // 4. Top Offenders
  const offenderMap = {};
  data.forEach(a => {
    const id = a.nik || a.name;
    if (!offenderMap[id]) offenderMap[id] = { name: a.name, count: 0, total: 0 };
    offenderMap[id].count++;
    offenderMap[id].total += (a.initialDebt || 0);
  });
  const topOffenders = Object.values(offenderMap).sort((a,b) => b.total - a.total).slice(0, 5);

  // BUILD UI
  let html = `
    <tr>
      <td colspan="6" style="padding: 0;">
        <div style="background: #f8fafc; padding: 24px; border-bottom: 2px solid #e2e8f0;">
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px;">
            <div style="background:#fff; padding:16px; border-radius:12px; border:1px solid #e2e8f0; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
              <div style="font-size:0.7rem; color:#64748b; font-weight:700; text-transform:uppercase; margin-bottom:4px;">Tingkat Pemulihan</div>
              <div style="font-size:1.5rem; font-weight:800; color:#10b981;">${recoveryRate.toFixed(1)}%</div>
              <div style="font-size:0.75rem; color:#94a3b8; margin-top:4px;">Pemulihan Dana</div>
            </div>
            <div style="background:#fff; padding:16px; border-radius:12px; border:1px solid #e2e8f0; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
              <div style="font-size:0.7rem; color:#64748b; font-weight:700; text-transform:uppercase; margin-bottom:4px;">Total Pemulihan</div>
              <div style="font-size:1.5rem; font-weight:800; color:#1e293b;">${fmt(totalRecovered)}</div>
              <div style="font-size:0.75rem; color:#94a3b8; margin-top:4px;">Dari total ${fmt(totalInitial)}</div>
            </div>
            <div style="background:#fff; padding:16px; border-radius:12px; border:1px solid #e2e8f0; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
              <div style="font-size:0.7rem; color:#64748b; font-weight:700; text-transform:uppercase; margin-bottom:4px;">Rasio Kasus/Orang</div>
              <div style="font-size:1.5rem; font-weight:800; color:#3b82f6;">${(totalCases/uniqueEmps).toFixed(1)}x</div>
              <div style="font-size:0.75rem; color:#94a3b8; margin-top:4px;">${totalCases} Kasus / ${uniqueEmps} Orang</div>
            </div>
            <div style="background:#fff; padding:16px; border-radius:12px; border:1px solid #e2e8f0; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
              <div style="font-size:0.7rem; color:#64748b; font-weight:700; text-transform:uppercase; margin-bottom:4px;">Tingkat Positif Palsu</div>
              <div style="font-size:1.5rem; font-weight:800; color:#f59e0b;">${(matrix['False Positive (Koreksi)'] / totalCases * 100).toFixed(1)}%</div>
              <div style="font-size:0.75rem; color:#94a3b8; margin-top:4px;">Akurasi Input Data</div>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 3fr 2fr; gap: 24px;">
            <!-- Trend Section -->
            <div>
              <h4 style="margin: 0 0 16px 0; font-size: 1rem; color: #1e293b; display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-chart-line" style="color: #3b82f6;"></i> Tren Performa Bulanan
              </h4>
              <table class="table" style="background:#fff; border-radius:12px; overflow:hidden; border:1px solid #e2e8f0;">
                <thead style="background:#f1f5f9;">
                  <tr>
                    <th>Bulan</th>
                    <th>Kasus</th>
                    <th>Orang</th>
                    <th>Total Defisit</th>
                    <th>Recovered</th>
                  </tr>
                </thead>
                <tbody>
                  ${Object.keys(trends).sort().reverse().map(k => {
                    const [y, m] = k.split('-');
                    const t = trends[k];
                    return `
                      <tr>
                        <td style="font-weight:600;">${monthNames[parseInt(m)]} ${y}</td>
                        <td>${t.cases}</td>
                        <td>${t.emps.size}</td>
                        <td style="color:#ef4444;">${fmt(t.initial)}</td>
                        <td style="color:#10b981; font-weight:600;">${fmt(t.recovered)}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>

            <!-- Analysis Section -->
            <div style="display: flex; flex-direction: column; gap: 24px;">
              <!-- Audit Matrix -->
              <div>
                <h4 style="margin: 0 0 16px 0; font-size: 1rem; color: #1e293b;">Wawasan Matriks Audit</h4>
                <div style="background: #fff; border-radius:12px; border:1px solid #e2e8f0; padding:16px;">
                  ${Object.entries(matrix).map(([label, val]) => `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid #f1f5f9;">
                      <span style="font-size:0.85rem; color:#64748b;">${label}</span>
                      <span style="background:${label.includes('Selisih') ? '#fee2e2' : '#f1f5f9'}; color:${label.includes('Selisih') ? '#ef4444' : '#1e293b'}; padding:2px 10px; border-radius:20px; font-weight:700; font-size:0.8rem;">${val} Kasus</span>
                    </div>
                  `).join('')}
                </div>
              </div>

              <!-- Top Offenders -->
              <div>
                <h4 style="margin: 0 0 16px 0; font-size: 1rem; color: #1e293b;">5 Karyawan Defisit Teratas</h4>
                <div style="background: #fff; border-radius:12px; border:1px solid #e2e8f0; overflow:hidden;">
                  ${topOffenders.map((o, i) => `
                    <div style="padding:12px 16px; border-bottom:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center;">
                      <div>
                        <div style="font-weight:700; font-size:0.85rem; color:#1e293b;">${i+1}. ${o.name}</div>
                        <div style="font-size:0.75rem; color:#64748b;">${o.count} Kasus Terjadi</div>
                      </div>
                      <div style="color:#ef4444; font-weight:800; font-size:0.9rem;">${fmt(o.total)}</div>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </td>
    </tr>
  `;

  container.innerHTML = html;
  
  // Header Update
  document.querySelector('#anomaliTable thead').innerHTML = `
    <tr>
      <th colspan="6" style="background:#1e293b; color:#fff; padding:12px; text-align:center; border-radius: 12px 12px 0 0;">
        <i class="fas fa-microscope"></i> MESIN ANALISIS: POLA & HISTORI TRANSAKSI MERAGUKAN
      </th>
    </tr>
  `;
}

// ===== REVIEW MODAL FUNCTIONS =====
let currentReviewTxKey = null;

window.openReviewModal = function (txKey) {
  currentReviewTxKey = txKey;
  const anomali = allAnomalies.find(a => a.txKey === txKey);
  if (!anomali) return;

  // Check for existing correction in allReviews
  const existingReview = allReviews.find(r => r.txKey === txKey);
  let auditHtml = '';
  if (existingReview && existingReview.status === 'SALAH INPUT') {
    auditHtml = `
      <div style="margin-top: 12px; padding: 10px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; font-size: 0.8rem;">
        <div style="font-weight:700; color:#0369a1; margin-bottom:4px;"><i class="fas fa-history"></i> Histori Koreksi:</div>
        <div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>Nama Awal:</span> <span style="font-weight:600;">${anomali.name}</span></div>
        <div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>Nama Baru:</span> <span style="font-weight:600; color:#10b981;">${existingReview.correctName}</span></div>
        <div style="display:flex; justify-content:space-between;"><span>Status:</span> <span class="badge-status status-verified" style="font-size:0.65rem;">Sudah Dikoreksi</span></div>
      </div>
    `;
  }

  const info = document.getElementById('reviewTxInfo');
  info.innerHTML = `
    <div class="info-row"><span class="info-label">Karyawan:</span> <span class="info-value">${anomali.name}</span></div>
    <div class="info-row"><span class="info-label">Tanggal:</span> <span class="info-value">${anomali.dateStr}</span></div>
    <div class="info-row"><span class="info-label">Nominal:</span> <span class="info-value" style="color:#ef4444">${fmt(anomali.nominal)}</span></div>
    <div class="info-row"><span class="info-label">Alasan:</span> <span class="info-value">${anomali.reason}</span></div>
    ${auditHtml}
    ${anomali.reviewTime ? `<div class="info-row" style="margin-top:8px; font-style:italic; font-size:0.75rem; color:#94a3b8;"><span class="info-label">Terakhir diupdate:</span> <span>${new Date(anomali.reviewTime).toLocaleString('id-ID')} oleh ${anomali.reviewer}</span></div>` : ''}
  `;

  // Set current values
  const radios = document.getElementsByName('reviewStatus');
  let currentStatus = anomali.status;
  radios.forEach(r => { if (r.value === currentStatus) r.checked = true; });

  const cf = document.getElementById('correctionFields');
  const pg = document.getElementById('reviewPasswordGroup');
  if (currentStatus === 'SALAH INPUT') {
    cf.classList.remove('hidden');
    if (pg) pg.classList.remove('hidden');
    document.getElementById('correctName').value = anomali.correctName || '';
    document.getElementById('correctNik').value = anomali.correctNik || '';
  } else {
    cf.classList.add('hidden');
    if (pg) pg.classList.add('hidden');
    document.getElementById('correctName').value = '';
    document.getElementById('correctNik').value = '';
  }

  const pwInput = document.getElementById('reviewPassword');
  if (pwInput) pwInput.value = '';

  const notesSelect = document.getElementById('reviewNotesSelect');
  const notesArea = document.getElementById('reviewNotes');
  
  if (notesSelect && notesArea) {
    const predefinedOptions = Array.from(notesSelect.options).map(opt => opt.value);
    if (anomali.notes && anomali.notes !== '-') {
      if (predefinedOptions.includes(anomali.notes)) {
        notesSelect.value = anomali.notes;
        notesArea.value = '';
      } else {
        notesSelect.value = 'Lainnya';
        notesArea.value = anomali.notes;
      }
    } else {
      notesSelect.value = '';
      notesArea.value = '';
    }

    if (currentStatus === 'TERBUKTI') {
      notesSelect.classList.remove('hidden');
      notesArea.placeholder = "Ketik alasan lainnya...";
      if (notesSelect.value === 'Lainnya') {
        notesArea.classList.remove('hidden');
      } else {
        notesArea.classList.add('hidden');
      }
    } else {
      notesSelect.classList.add('hidden');
      notesArea.placeholder = "Tambahkan catatan hasil investigasi atau alasan koreksi...";
      notesArea.classList.remove('hidden');
    }
  } else if (notesArea) {
    notesArea.value = anomali.notes === '-' ? '' : anomali.notes;
  }

  document.getElementById('modalReview').classList.remove('hidden');
};

window.closeReviewModal = function () {
  document.getElementById('modalReview').classList.add('hidden');
  currentReviewTxKey = null;
};

async function saveReview() {
  if (!currentReviewTxKey) return;
  const status = document.querySelector('input[name="reviewStatus"]:checked')?.value || 'MENUNGGU REVIEW';
  
  const notesSelect = document.getElementById('reviewNotesSelect');
  let notes = '';
  if (status === 'TERBUKTI' && notesSelect && notesSelect.value && notesSelect.value !== 'Lainnya') {
    notes = notesSelect.value;
  } else {
    notes = document.getElementById('reviewNotes').value.trim() || 'No notes added';
  }
  
  const reviewer = document.getElementById('reviewerEmail').value.trim() || 'anonymous@moneybox.com';
  const password = document.getElementById('reviewPassword').value;

  let correctName = document.getElementById('correctName').value.trim();
  let correctNik = document.getElementById('correctNik').value.trim();

  if (status !== 'SALAH INPUT' && status !== 'Salah Orang') {
    correctName = '';
    correctNik = '';
  }

  if (status === 'SALAH INPUT' && !correctName) {
    toast('Silakan isi nama koreksi', 'error');
    return;
  }

  if (correctName) {
    const matchedEmp = allEmployees.find(e => e.name.toLowerCase() === correctName.toLowerCase() || e.variations.some(v => v.toLowerCase() === correctName.toLowerCase()));
    if (matchedEmp) {
      if (!correctNik || correctNik === '-') correctNik = matchedEmp.nik !== '-' ? matchedEmp.nik : '';
    }
  }

  const btn = document.getElementById('btnSaveReview');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'review',
        reviewData: {
          txKey: currentReviewTxKey,
          status,
          notes,
          reviewer,
          correctName,
          correctNik
        },
        pass: password
      })
    });

    const result = await res.json();
    if (result.success) {
      // Update local state
      allReviews.push({
        txKey: currentReviewTxKey,
        status,
        notes,
        reviewer,
        timestamp: new Date().toISOString(),
        correctName,
        correctNik
      });

      // Perform automatic updates based on status
      const anomali = allAnomalies.find(a => a.txKey === currentReviewTxKey);

      if ((status === 'Salah Orang' || status === 'SALAH INPUT') && (correctName || correctNik)) {
        // Update main transaction row with the new owner
        fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'updateRow',
            pass: password,
            updateData: {
              rowNo: anomali.originalNo,
              date: anomali.dateStr,
              name: correctName || anomali.name,
              nik: correctNik || '',
              nominal: anomali.nominal,
              type: 'Penarikan',
              notes: `Koreksi Nama dari ${anomali.name}. Alasan: ${notes}`
            }
          })
        }).then(r => r.json()).then(res => {
          if (res.success) {
            toast(`Transaksi berhasil dipindahkan ke ${correctName || 'karyawan baru'}`, 'success');
            fetchData(); 
          } else {
            toast('Koreksi data gagal: ' + res.error, 'error');
          }
        }).catch(e => console.error('Gagal update row:', e));
      } else {
        fetchData(); 
      }

      toast('Status review berhasil disimpan!', 'success');
      closeReviewModal();
    } else {
      throw new Error(result.error || 'Gagal menyimpan review');
    }
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Simpan Status';
  }
}


window.goToEmployee = function (name, nik = '') {
  const navItem = document.getElementById('nav-karyawan');
  if (navItem) navItem.click();
  showEmployee(name, nik);
};

// ===== DASHBOARD FILTER & EXPORT =====
function initDashboardFilter() {
  const timeFilterBtns = document.querySelectorAll('#dashboardTimeFilter button');
  const yearGroup = document.getElementById('dashboardYearSelectGroup');
  const monthGroup = document.getElementById('dashboardMonthSelectGroup');
  const customGroup = document.getElementById('dashboardCustomRangeGroup');
  const yearSelect = document.getElementById('dashboardYearSelect');
  const monthSelect = document.getElementById('dashboardMonthSelect');
  const btnApply = document.getElementById('btnApplyDashboardFilter');
  const btnExport = document.getElementById('btnDownloadDashboard');

  if (!timeFilterBtns.length) return;

  // Populate Selects
  if (yearSelect && yearSelect.options.length === 0) {
    const years = [...new Set(allData.filter(d => d.date).map(d => d.date.getFullYear()))].sort((a,b) => b-a);
    if (years.length === 0) years.push(new Date().getFullYear());
    yearSelect.innerHTML = years.map(y => `<option value="${y}" ${y === new Date().getFullYear() ? 'selected' : ''}>${y}</option>`).join('');
  }

  if (monthSelect && monthSelect.options.length === 0) {
    monthSelect.innerHTML = monthNames.map((m, i) => `<option value="${i}">${m}</option>`).join('');
    monthSelect.value = new Date().getMonth();
  }

  timeFilterBtns.forEach(btn => {
    btn.onclick = () => {
      timeFilterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const range = btn.dataset.range;
      
      yearGroup.classList.add('hidden');
      monthGroup.classList.add('hidden');
      customGroup.classList.add('hidden');

      if (range === 'yearly') yearGroup.classList.remove('hidden');
      if (range === 'monthly') { yearGroup.classList.remove('hidden'); monthGroup.classList.remove('hidden'); }
      if (range === 'custom') customGroup.classList.remove('hidden');

      applyDashboardFilter();
    };
  });

  function applyDashboardFilter() {
    const range = document.querySelector('#dashboardTimeFilter button.active').dataset.range;
    const year = parseInt(document.getElementById('dashboardYearSelect').value);
    const month = parseInt(document.getElementById('dashboardMonthSelect').value);
    const startStr = document.getElementById('dashboardStartDate').value;
    const endStr = document.getElementById('dashboardEndDate').value;

    globalFilteredData = [...allData];

    if (range === 'yearly') {
      globalFilteredData = globalFilteredData.filter(d => d.date && d.date.getFullYear() === year);
    } else if (range === 'monthly') {
      globalFilteredData = globalFilteredData.filter(d => d.date && d.date.getFullYear() === year && d.date.getMonth() === month);
    } else if (range === 'custom') {
      const s = startStr ? new Date(startStr) : null;
      const e = endStr ? new Date(endStr) : null;
      if (e) e.setHours(23, 59, 59);
      if (s) {
        globalFilteredData = globalFilteredData.filter(d => d.date && d.date >= s);
      }
      if (e) {
        globalFilteredData = globalFilteredData.filter(d => d.date && d.date <= e);
      }
    }

    txPage = 1;
    initDashboard(false);
  }

  if (btnApply) btnApply.onclick = applyDashboardFilter;

  if (btnExport) {
    btnExport.onclick = () => {
      if (globalFilteredData.length === 0) {
        toast('Tidak ada data dashboard untuk di-export', 'error');
        return;
      }
      const exportData = globalFilteredData.map((d, i) => {
        const txKey = `anomali_${getEmpId(d)}_${d.date?.getTime() || 0}_${d.nominal}`.replace(/\s+/g, '_');
        const isSuspicious = allAnomalies.some(a => a.txKey === txKey && (a.status === 'MENUNGGU REVIEW' || a.systemStatus === 'MENCURIGAKAN' || a.systemStatus === 'DICICIL'));
        return {
          No: i + 1,
          Tanggal: d.dateStr || fmtDate(d.date),
          Karyawan: d.name,
          'Jenis Potongan': d.jenis,
          Nominal: d.nominal,
          Tipe: d.type,
          Keterangan: d.keterangan,
          'Transaksi Meragukan': isSuspicious ? 'Ya' : 'Tidak'
        };
      });
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "DashboardData");
      XLSX.writeFile(wb, `Export_Dashboard_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast('Data dashboard berhasil di-export', 'success');
    };
  }

  const btnExportTx = document.getElementById('btnExportTransaksi');
  if (btnExportTx) {
    btnExportTx.onclick = () => {
      const txData = getFilteredTx();
      if (txData.length === 0) {
        toast('Tidak ada data transaksi untuk di-export', 'error');
        return;
      }
      const exportData = txData.map((d, i) => {
        const txKey = `anomali_${getEmpId(d)}_${d.date?.getTime() || 0}_${d.nominal}`.replace(/\s+/g, '_');
        const isSuspicious = allAnomalies.some(a => a.txKey === txKey && (a.status === 'MENUNGGU REVIEW' || a.systemStatus === 'MENCURIGAKAN' || a.systemStatus === 'DICICIL'));
        return {
          No: i + 1,
          Tanggal: d.dateStr || fmtDate(d.date),
          Karyawan: d.name,
          'Jenis Potongan': d.jenis,
          Nominal: d.nominal,
          Tipe: d.type,
          Keterangan: d.keterangan,
          'Transaksi Meragukan': isSuspicious ? 'Ya' : 'Tidak'
        };
      });
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Transaksi");
      XLSX.writeFile(wb, `Export_Transaksi_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast('Data transaksi berhasil di-export', 'success');
    };
  }

  const btnExportEmp = document.getElementById('btnExportEmployee');
  if (btnExportEmp) {
    btnExportEmp.onclick = () => {
      if (!currentEmpData || !currentEmpData.name) return;
      exportEmployeeData();
    };
  }
}


// ===== TRANSAKSI PAGE =====
function populateMonthFilter(minMonth = null) {
  const months = new Set(); 
  allData.forEach(d => { 
    if (d.date) months.add(d.date.getFullYear() + '-' + String(d.date.getMonth()).padStart(2, '0')); 
  });
  const monthList = [...months].sort().reverse();
  
  const selStart = document.getElementById('txFilterStartMonth');
  const selEnd = document.getElementById('txFilterEndMonth');
  const selStartAnom = document.getElementById('anomaliFilterStartMonth');
  const selEndAnom = document.getElementById('anomaliFilterEndMonth');
  
  if (!selStart || !selEnd) return;

  const optionsHTML = (list, placeholder) => {
    return `<option value="">${placeholder}</option>` + list.map(m => { 
      const [y, mo] = m.split('-'); 
      return `<option value="${m}">${monthNames[+mo]} ${y}</option>`; 
    }).join('');
  };

  if (!minMonth) {
    const startOpts = optionsHTML(monthList, 'Semua Bulan');
    selStart.innerHTML = startOpts;
    if (selStartAnom) selStartAnom.innerHTML = startOpts;
  }

  const filteredMonthList = minMonth ? monthList.filter(m => m >= minMonth) : monthList;
  const endOpts = optionsHTML(filteredMonthList, 's/d (Opsional)');
  
  const currentEndVal = selEnd.value;
  selEnd.innerHTML = endOpts;
  if (selStartAnom) selEndAnom.innerHTML = endOpts;

  if (currentEndVal && filteredMonthList.includes(currentEndVal)) {
    selEnd.value = currentEndVal;
  }
}

function getFilteredTx() {
  let data = [...allData]; 
  const search = document.getElementById('txSearch')?.value.toLowerCase();
  const type = document.getElementById('txFilterType')?.value;
  const startMonth = document.getElementById('txFilterStartMonth')?.value;
  const endMonth = document.getElementById('txFilterEndMonth')?.value;

  if (search) {
    data = data.filter(d => {
      const id = getEmpId(d);
      const variations = allAliasesMap[id] ? Array.from(allAliasesMap[id]) : [d.name];
      return variations.some(v => v.toLowerCase().includes(search)) || 
             (d.jenis && d.jenis.toLowerCase().includes(search)) ||
             (d.nik && d.nik.toLowerCase().includes(search));
    });
  }
  if (type === 'Setoran Ganda') {
    data = data.filter(d => d.isDoubleDeposit);
  } else if (type) {
    data = data.filter(d => d.type === type);
  }
  
  const mode = document.getElementById('txFilterMode')?.value || 'custom';
  const yearVal = document.getElementById('txFilterYear')?.value || new Date().getFullYear().toString();
  const year = yearVal === 'all' ? 'all' : parseInt(yearVal);

  if (mode === 'monthly') {
    if (year !== 'all') {
      data = data.filter(d => d.date && d.date.getFullYear() === year);
    }
  } else {
    if (startMonth) { 
      const [y, m] = startMonth.split('-'); 
      const startDate = new Date(+y, +m, 1);
      data = data.filter(d => d.date && d.date >= startDate); 
    }
    if (endMonth) { 
      const [y, m] = endMonth.split('-'); 
      const endDate = new Date(+y, +m + 1, 0, 23, 59, 59, 999); 
      data = data.filter(d => d.date && d.date <= endDate); 
    }
  }

  if (txSort.col !== null) {
    data.sort((a, b) => {
      let va, vb; switch (txSort.col) { case 0: va = a.no; vb = b.no; break; case 1: va = a.date || 0; vb = b.date || 0; break; case 2: va = a.name; vb = b.name; break; case 4: va = a.nominal; vb = b.nominal; break; default: return 0; }
      if (va < vb) return txSort.asc ? -1 : 1; if (va > vb) return txSort.asc ? 1 : -1; return 0;
    });
  } else if (type === 'Setoran Ganda') {
    data.sort((a, b) => {
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return (a.date || 0) - (b.date || 0);
    });
  }
  return data;
}

function renderTxTable() {
  const mode = document.getElementById('txFilterMode')?.value || 'custom';
  const yearVal = document.getElementById('txFilterYear')?.value || new Date().getFullYear().toString();
  const year = yearVal === 'all' ? 'all' : parseInt(yearVal);

  // Populate Year Dropdown if empty
  const yrSel = document.getElementById('txFilterYear');
  if (yrSel && yrSel.options.length === 0) {
    const years = [...new Set(allData.filter(d => d.date).map(d => d.date.getFullYear()))].sort((a, b) => b - a);
    if (years.length === 0) years.push(new Date().getFullYear());
    yrSel.innerHTML = `<option value="all">Semua Tahun</option>` + years.map(y => `<option value="${y}" ${y === new Date().getFullYear() ? 'selected' : ''}>${y}</option>`).join('');
  }

  const data = getFilteredTx();

  // Monthly Recap Logic for Global Transactions
  if (mode === 'monthly') {
    const monthlyRecap = Array.from({ length: 12 }, (_, i) => ({
      monthIdx: i,
      monthName: monthNames[i],
      totalIn: 0,
      totalOut: 0
    }));

    data.forEach(d => {
      if (d.isDeleted) return;
      // Data is already filtered by year in getFilteredTx, so we just group by month
      if (d.date) {
        const mIdx = d.date.getMonth();
        if (d.type === 'Tabungan') monthlyRecap[mIdx].totalIn += d.nominal;
        else monthlyRecap[mIdx].totalOut += d.nominal;
      }
    });

    document.querySelector('#txRecapTable tbody').innerHTML = monthlyRecap.map(m => {
      const net = m.totalIn - m.totalOut;
      const netColor = net >= 0 ? '#10b981' : '#ef4444';
      // Use a valid year for the detail button, even if 'all' is selected
      const recapYear = (year === 'all') ? new Date().getFullYear() : year;
      return `
        <tr>
          <td style="font-weight:600;">${m.monthName} ${year === 'all' ? '(Semua Tahun)' : year}</td>
          <td style="color:#10b981;">${fmt(m.totalIn)}</td>
          <td style="color:#ef4444;">${fmt(m.totalOut)}</td>
          <td style="font-weight:700; color:${netColor};">${fmt(net)}</td>
          <td><button class="btn btn-outline" style="padding: 2px 8px; font-size:0.7rem;" onclick="txFilterMode.value='custom'; txFilterStartMonth.value='${recapYear}-${String(m.monthIdx).padStart(2,'0')}'; txFilterEndMonth.value='${recapYear}-${String(m.monthIdx).padStart(2,'0')}'; txFilterMode.dispatchEvent(new Event('change'));" title="Detail"><i class="fas fa-search"></i></button></td>
        </tr>
      `;
    }).join('');
    return; // Stop execution for monthly mode
  }

  // --- Logic for 'custom' (list) mode ---
  const total = data.length; const pages = Math.ceil(total / txPerPage) || 1;

  // Hitung ringkasan uang masuk/keluar dari data yang terfilter
  let totalIn = 0, totalOut = 0;
  data.forEach(d => {
    if (d.isDeleted) return;
    if (d.type === 'Tabungan') totalIn += d.nominal;
    else totalOut += d.nominal;
  });

  // Tampilkan ringkasan di atas tabel
  const summaryEl = document.getElementById('txTableSummary');
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div style="display: flex; gap: 20px; margin-bottom: 20px;">
        <div class="summary-mini-card" style="flex: 1; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 12px;">
          <div style="font-size: 0.75rem; color: #15803d; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">Total Uang Masuk</div>
          <div style="font-size: 1.25rem; font-weight: 700; color: #166534;">${fmt(totalIn)}</div>
        </div>
        <div class="summary-mini-card" style="flex: 1; background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 12px;">
          <div style="font-size: 0.75rem; color: #b91c1c; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">Total Uang Keluar</div>
          <div style="font-size: 1.25rem; font-weight: 700; color: #991b1b;">${fmt(totalOut)}</div>
        </div>
      </div>
    `;
  }

  if (txPage > pages) txPage = pages;

  const getSortIcon = (col) => {
    if (txSort.col !== col) return '<i class="fas fa-sort"></i>';
    return txSort.asc ? '<i class="fas fa-sort-up"></i>' : '<i class="fas fa-sort-down"></i>';
  };
  document.querySelector('#txTable thead').innerHTML = `<tr>
    <th class="sortable" data-col="0" style="cursor:pointer">No ${getSortIcon(0)}</th>
    <th class="sortable" data-col="1" style="cursor:pointer">Tanggal ${getSortIcon(1)}</th>
    <th class="sortable" data-col="2" style="cursor:pointer">Karyawan ${getSortIcon(2)}</th>
    <th>Jenis Potongan</th>
    <th class="sortable" data-col="4" style="cursor:pointer">Nominal ${getSortIcon(4)}</th>
    <th>Tipe</th>
    <th>Aksi</th>
  </tr>`;

  const start = (txPage - 1) * txPerPage; const slice = data.slice(start, start + txPerPage);
  document.querySelector('#txTable tbody').innerHTML = slice.map((d, i) => {
    const link = getLinkFromKeterangan(d.keterangan);
    const linkBtn = link ? `<a href="${link}" target="_blank" class="btn-view-tf"><i class="fas fa-external-link-alt"></i> Lihat TF</a>` : '';

    const isDeleted = d.isDeleted;
    const rowColor = isDeleted ? 'color: #94a3b8;' : '';
    // Cek apakah transaksi ini anomali
    const txKey = `anomali_${getEmpId(d)}_${d.date?.getTime() || 0}_${d.nominal}`.replace(/\s+/g, '_');
    const isSuspicious = allAnomalies.some(a => a.txKey === txKey && a.status === 'MENUNGGU REVIEW');
    const highlightBg = isDeleted ? 'background-color: #f1f5f9; opacity: 0.5;' : (isSuspicious ? 'background-color: rgba(239, 68, 68, 0.08);' : '');
    const escName = d.name.replace(/'/g, "\\'");
    const empNik = d.nik || '';

    const alertIcon = isSuspicious ? `<i class="fas fa-exclamation-triangle" style="color:#ef4444; margin-right:4px;" title="Transaksi Meragukan"></i>` : '';
    const ignoredIcon = isDeleted ? `<i class="fas fa-ban" style="color:#94a3b8; margin-right:4px;" title="Transaksi Diabaikan"></i>` : '';
    const isAdmin = currentUser && currentUser.role === 'admin';
    const canEdit = true; // Buka akses edit untuk semua transaksi (Setoran & Penarikan)
    const editBtn = (isAdmin && canEdit) ? `<button class="btn btn-outline" style="padding: 2px 8px; font-size: 0.7rem; color: #f59e0b; border-color: #f59e0b; margin-right: 4px;" onclick="openEditModal(${d.sheetRow}, '${escName}', ${d.nominal}, '${empNik}', '${d.type}', '${d.dateStr}', ${d.isDoubleDeposit ? 'true' : 'false'})"><i class="fas fa-pencil-alt"></i></button>` : '';

    const deletedBadge = isDeleted ? `<span class="badge-status" style="font-size: 0.6rem; padding: 1px 4px; margin-left: 6px; background: #fee2e2; color: #ef4444; border: 1px solid #fecaca; border-radius: 4px; vertical-align: middle; text-decoration: none;" title="Data Diabaikan: ${d.notes || '-'}">DIABAIKAN / TIDAK DIHITUNG</span>` : '';
    const editedBadge = (!isDeleted && d.isEdited) ? `<span class="badge-status" style="font-size: 0.6rem; padding: 1px 4px; margin-left: 6px; background: #fef3c7; color: #b45309; border: 1px solid #fde68a; border-radius: 4px; vertical-align: middle;" title="Catatan: ${d.notes || '-'}">DIEDIT</span>` : '';
    
    const anom = allAnomalies.find(a => a.originalNo === d.sheetRow);
    const correctedBadge = (anom && anom.originalName && anom.originalName !== anom.name) ? `<span class="badge-status status-verified" style="font-size: 0.6rem; padding: 1px 4px; margin-left: 6px; background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; border-radius: 4px; vertical-align: middle;" title="Koreksi Nama dari data sebelumnya: ${anom.originalName}\nAdmin: ${anom.reviewer || '-'}">NAMA DIKOREKSI</span>` : '';

    const empIdForAlias = getEmpId(d);
    const variationsSet = allAliasesMap[empIdForAlias];
    const aliases = variationsSet ? Array.from(variationsSet).filter(v => v !== d.name) : [];
    const variationsHtml = aliases.length > 0 ? `<div style="font-size:0.65rem; color:#64748b; font-style:italic; line-height: 1.2; margin-top: 2px;">Alias: ${aliases.join(', ')}</div>` : '';
    const nikHtml = d.nik && d.nik !== '-' ? `<div style="font-size:0.7rem; color:#94a3b8; margin-top: 2px;">NIK: ${d.nik}</div>` : '';
    
    const nominalDisplay = isDeleted ? `<del style="color: #94a3b8;">${fmt(d.nominal)}</del>` : fmt(d.nominal);

    return `<tr style="${highlightBg}">
    <td style="${rowColor}">${ignoredIcon}${alertIcon}${start + i + 1}</td><td style="${rowColor}">${d.dateStr || fmtDate(d.date)}</td><td style="${rowColor}"><div style="font-weight:600;">${d.name}${deletedBadge}${editedBadge}${correctedBadge}</div>${variationsHtml}${nikHtml}</td><td style="${rowColor}">${d.jenis}</td>
    <td style="font-weight:600; ${rowColor}">${nominalDisplay}</td>
    <td><span class="badge ${d.type === 'Tabungan' ? 'in' : 'out'}">${d.type}</span> ${linkBtn}</td>
    <td>
      ${editBtn}
      <button class="btn btn-outline" style="padding: 2px 8px; font-size: 0.7rem;" onclick="goToEmployee('${escName}', '${empNik}')" title="Detail"><i class="fas fa-search"></i></button>
    </td>
    </tr>`;
  }).join('');
  // Pagination
  let pg = '';
  if (pages > 1) {
    pg += `<button ${txPage === 1 ? 'disabled' : ''} onclick="txPage=1;renderTxTable()">«</button>`;
    pg += `<button ${txPage === 1 ? 'disabled' : ''} onclick="txPage--;renderTxTable()">‹</button>`;
    const s = Math.max(1, txPage - 2), e = Math.min(pages, txPage + 2);
    for (let i = s; i <= e; i++)pg += `<button class="${i === txPage ? 'active' : ''}" onclick="txPage=${i};renderTxTable()">${i}</button>`;
    pg += `<button ${txPage === pages ? 'disabled' : ''} onclick="txPage++;renderTxTable()">›</button>`;
    pg += `<button ${txPage === pages ? 'disabled' : ''} onclick="txPage=${pages};renderTxTable()">»</button>`;
  }
  document.getElementById('txPagination').innerHTML = pg;
}

// Table sort & filter events
['txSearch', 'txFilterType', 'txFilterStartMonth', 'txFilterEndMonth', 'txFilterMode', 'txFilterYear'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener(id === 'txSearch' ? 'input' : 'change', () => { 
      if (id === 'txFilterStartMonth') {
        const startVal = el.value;
        const endEl = document.getElementById('txFilterEndMonth');
        populateMonthFilter(startVal);
        if (startVal && (!endEl.value || endEl.value < startVal)) endEl.value = startVal;
      }
      
      if (id === 'txFilterMode') {
        const mode = el.value;
        const customGrp = document.getElementById('txFilterCustomGroup');
        const yearGrp = document.getElementById('txFilterYearGroup');
        const recapContainer = document.getElementById('txMonthlyRecapContainer');
        const listContainer = document.getElementById('txListContainer');
        if (mode === 'monthly') {
          customGrp.classList.add('hidden');
          yearGrp.classList.remove('hidden');
          recapContainer.classList.remove('hidden');
          if (listContainer) listContainer.classList.add('hidden');
        } else {
          customGrp.classList.remove('hidden');
          yearGrp.classList.add('hidden');
          recapContainer.classList.add('hidden');
          if (listContainer) listContainer.classList.remove('hidden');
        }
        
        // Sync button group visually if changed programmatically
        document.querySelectorAll('#txModeFilterBtns button').forEach(b => {
          b.classList.toggle('active', b.dataset.mode === mode);
        });
      }

      txPage = 1; 
      renderTxTable(); 
    });
  }
});

// Sync txModeFilterBtns to txFilterMode
const txModeBtns = document.querySelectorAll('#txModeFilterBtns button');
const txFilterMode = document.getElementById('txFilterMode');
txModeBtns.forEach(btn => {
  btn.onclick = () => {
    txModeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (txFilterMode) {
      txFilterMode.value = btn.dataset.mode;
      txFilterMode.dispatchEvent(new Event('change'));
    }
  };
});


const btnClearTxFilter = document.getElementById('btnClearTxFilter');
if (btnClearTxFilter) {
  btnClearTxFilter.onclick = () => {
    document.getElementById('txSearch').value = '';
    document.getElementById('txFilterType').value = '';
    document.getElementById('txFilterStartMonth').value = '';
    document.getElementById('txFilterEndMonth').value = '';
    
    // Reset to "custom" mode visually and functionally
    if (txFilterMode) {
      txFilterMode.value = 'custom';
      txFilterMode.dispatchEvent(new Event('change'));
    } else {
      txPage = 1;
      renderTxTable();
    }
  };
}

// ===== EDIT TRANSACTION MODAL =====
window.openEditModal = function(sheetRow, name, nominal, nik, type, dateStr, isDouble = false) {
  document.getElementById('editTxRowNo').value = sheetRow;
  document.getElementById('editTxName').value = name;
  document.getElementById('editTxNominal').value = Math.abs(nominal);
  document.getElementById('editTxNik').value = nik;
  document.getElementById('editTxType').value = type;
  document.getElementById('editTxDate').value = dateStr;
  document.getElementById('editTxPassword').value = ''; 
  document.getElementById('editTxNotes').value = ''; 
  
  // Kunci field nominal dan tipe untuk semua jenis transaksi (Setoran dan Penarikan)
  const dateField = document.getElementById('editTxDate');
  const nominalField = document.getElementById('editTxNominal');
  const typeField = document.getElementById('editTxType');
  
  nominalField.disabled = true;
  typeField.disabled = true;

  if (isDouble) {
    dateField.disabled = true;
  } else {
    dateField.disabled = false;
  }

  // Set default action
  const radios = document.getElementsByName('editTxAction');
  radios[0].checked = true;
  document.getElementById('editTxFormFields').style.opacity = '1';
  document.getElementById('editTxFormFields').style.pointerEvents = 'auto';
  
  document.getElementById('modalEditTx').classList.remove('hidden');
};

document.getElementsByName('editTxAction').forEach(radio => {
  radio.addEventListener('change', (e) => {
    const fields = document.getElementById('editTxFormFields');
    if (e.target.value === 'hapus') {
      fields.style.opacity = '0.5';
      fields.style.pointerEvents = 'none';
    } else {
      fields.style.opacity = '1';
      fields.style.pointerEvents = 'auto';
    }
  });
});

// Autocomplete Logic for Modals
function setupAutocomplete(inputId, resultsId, targetNameId, targetNikId) {
  const input = document.getElementById(inputId);
  const resultsDiv = document.getElementById(resultsId);
  const targetName = document.getElementById(targetNameId);
  const targetNik = document.getElementById(targetNikId);

  if (input && resultsDiv) {
    input.addEventListener('input', () => {
      const q = input.value.toLowerCase().trim();
      if (!q) {
        resultsDiv.classList.remove('show');
        return;
      }
      // Search through main name, nik, and all variations (aliases)
      const matches = allEmployees.filter(e => 
        e.variations.some(v => v.toLowerCase().includes(q)) || (e.nik && e.nik.toLowerCase().includes(q))
      ).slice(0, 10);

      if (matches.length > 0) {
        resultsDiv.innerHTML = matches.map(e => `<div class="search-result-item" data-name="${e.name}" data-nik="${e.nik || ''}">${e.name} ${e.nik ? `(${e.nik})` : ''}</div>`).join('');
        resultsDiv.classList.add('show');
        resultsDiv.querySelectorAll('.search-result-item').forEach(item => {
          item.onclick = () => {
            if (targetName) targetName.value = item.dataset.name;
            if (targetNik) targetNik.value = item.dataset.nik;
            resultsDiv.classList.remove('show');
          };
        });
      } else {
        resultsDiv.classList.remove('show');
      }
    });

    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !resultsDiv.contains(e.target)) {
        resultsDiv.classList.remove('show');
      }
    });
  }
}

// ===== EDIT TRANSACTION MODAL =====
function initEditModal() {
  const modal = document.getElementById('modalEditTx');
  const btnClose = document.getElementById('btnCloseEditModal');
  const btnCancel = document.getElementById('btnCancelEdit');
  const btnSave = document.getElementById('btnSaveEdit');

  if (!modal || !btnSave) return;

  const close = () => modal.classList.add('hidden');
  btnClose.onclick = close;
  btnCancel.onclick = close;


  setupAutocomplete('editTxName', 'editTxNameResults', 'editTxName', 'editTxNik');
  setupAutocomplete('editTxNik', 'editTxNikResults', 'editTxName', 'editTxNik');

  btnSave.onclick = async () => {
    const action = document.querySelector('input[name="editTxAction"]:checked').value;
    const rowNo = parseInt(document.getElementById('editTxRowNo').value);
    const rawDate = document.getElementById('editTxDate').value;
    const dateObj = parseDateStr(rawDate);
    // Kirim format YYYY-MM-DD ke API agar Google Sheets tidak bingung
    const date = dateObj ? `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}` : rawDate;
    
    let name = document.getElementById('editTxName').value.trim();
    const nominal = parseFloat(document.getElementById('editTxNominal').value);
    let nik = document.getElementById('editTxNik').value.trim();
    const type = document.getElementById('editTxType').value;
    const pass = document.getElementById('editTxPassword').value;
    let notes = document.getElementById('editTxNotes').value;

    if (action !== 'hapus') {
      const matchedEmp = allEmployees.find(e => e.name.toLowerCase() === name.toLowerCase() || e.variations.some(v => v.toLowerCase() === name.toLowerCase()));
      if (matchedEmp) {
        if (!nik || nik === '-') nik = matchedEmp.nik !== '-' ? matchedEmp.nik : '';
      }
    }

    if (action === 'hapus') {
      notes = notes ? `[DIHAPUS] ${notes}` : '[DIHAPUS] Data diabaikan';
    } else if (!date || !name || isNaN(nominal) || !pass) {
      toast('Harap isi semua data termasuk password konfirmasi!', 'error');
      return;
    }
    if (!pass) {
      toast('Harap masukkan password konfirmasi admin!', 'error');
      return;
    }

    btnSave.disabled = true;
    btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';

    try {
      const resp = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'updateRow',
          pass, 
          updateData: { 
            rowNo, 
            date, 
            name, 
            nominal, 
            nik, 
            type, 
            notes,
            isDeleted: action === 'hapus'
          }
        })
      });
      const res = await resp.json();
      if (res.success) {
        let msg = 'Data berhasil diperbarui!';
        if (res.debug) {
          msg += `<br><small style="opacity:0.8">File: ${res.debug.spreadsheetTitle}<br>Sheet: ${res.debug.targetSheet} (Baris ${res.debug.row})</small>`;
        }
        toast(msg, 'success');
        setTimeout(() => location.reload(), 2500);
      } else {
        throw new Error(res.error || 'Gagal update');
      }
    } catch (err) {
      toast('Kesalahan: ' + err.message, 'error');
      btnSave.disabled = false;
      btnSave.innerHTML = '<i class="fas fa-save"></i> Simpan Perubahan';
    }
  };
}

// ===== EMPLOYEE SEARCH & LIST =====
function initSearch() {
  const empList = [...allEmployees];

  const listContainer = document.getElementById('fullEmployeeList');

  // Render full list
  const renderList = (filteredEmps) => {
    listContainer.innerHTML = filteredEmps.map(e => {
      const initials = e.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
      const status = allEmployeesStatus[getEmpId(e)] || { isActive: false };
      const statusBadge = status.isActive ? '<span class="badge-status status-verified" style="font-size:0.6rem; padding:1px 4px;">AKTIF</span>' : '<span class="badge-status status-progress" style="font-size:0.6rem; padding:1px 4px;">OFF</span>';
      
      const aliases = e.variations.filter(v => v !== e.name);
      const aliasHtml = aliases.length > 0 ? `<div style="font-size:0.65rem; color:#64748b; font-style:italic; line-height:1.2; margin-bottom:2px;">Alias: ${aliases.join(', ')}</div>` : '';

      return `<div class="emp-list-item" data-name="${e.name}" data-nik="${e.nik || ''}">
        <div class="emp-list-avatar">${initials}</div>
        <div style="flex:1;">
          <div class="emp-list-name" style="margin-bottom:0;">${e.name} ${statusBadge}</div>
          ${aliasHtml}
          <div class="emp-list-nik" style="font-size: 0.7rem; color: #94a3b8;">${e.nik && e.nik !== '-' ? 'NIK: ' + e.nik : ''}</div>
        </div>
      </div>`;
    }).join('');

    listContainer.querySelectorAll('.emp-list-item').forEach(el => {
      el.addEventListener('click', () => {
        showEmployee(el.dataset.name, el.dataset.nik);
      });
    });
  };

  renderList(empList);

  const input = document.getElementById('employeeSearch');
  const statusFilter = document.getElementById('empStatusFilter');

  const applyEmpListFilter = () => {
    const q = input.value.toLowerCase().trim();
    const statusMode = statusFilter ? statusFilter.value : 'all';

    const filtered = empList.filter(e => {
      let pass = true;
      if (q) {
        pass = pass && (e.variations.some(v => v.toLowerCase().includes(q)) || (e.nik && e.nik.toLowerCase().includes(q)));
      }
      
      if (statusMode !== 'all') {
        const status = allEmployeesStatus[getEmpId(e)] || { isActive: false };
        if (statusMode === 'on') pass = pass && status.isActive;
        if (statusMode === 'off') pass = pass && !status.isActive;
      }

      return pass;
    });
    
    renderList(filtered);
  };

  input.addEventListener('input', applyEmpListFilter);
  if (statusFilter) statusFilter.addEventListener('change', applyEmpListFilter);

  document.getElementById('btnBackToEmpList').addEventListener('click', () => {
    document.getElementById('employeeDetail').classList.add('hidden');
    document.getElementById('employeeListContainer').classList.remove('hidden');
    const controls = document.getElementById('empListControls');
    if (controls) controls.classList.remove('hidden');
    
    input.value = '';
    if (statusFilter) statusFilter.value = 'all';
    renderList(empList);
  });

  const btnExportAll = document.getElementById('btnExportAllEmployeesBalance');
  if (btnExportAll) {
    btnExportAll.addEventListener('click', () => {
      if (allEmployees.length === 0) {
        toast('Tidak ada data karyawan', 'error');
        return;
      }
      
      const q = (document.getElementById('employeeSearch')?.value || '').toLowerCase().trim();
      const statusFilter = document.getElementById('empStatusFilter');
      const statusMode = statusFilter ? statusFilter.value : 'all';

      const filteredEmployees = allEmployees.filter(e => {
        let pass = true;
        if (q) {
          pass = pass && (e.variations.some(v => v.toLowerCase().includes(q)) || (e.nik && e.nik.toLowerCase().includes(q)));
        }
        
        if (statusMode !== 'all') {
          const status = allEmployeesStatus[getEmpId(e)] || { isActive: false };
          if (statusMode === 'on') pass = pass && status.isActive;
          if (statusMode === 'off') pass = pass && !status.isActive;
        }

        return pass;
      });

      if (filteredEmployees.length === 0) {
        toast('Tidak ada data karyawan yang sesuai dengan filter', 'error');
        return;
      }

      const exportData = filteredEmployees.map((e, i) => {
        const id = getEmpId(e);
        const status = allEmployeesStatus[id] || { balance: 0, isActive: false, lastDepositDate: null };
        
        const empVariations = allAliasesMap[id] || new Set([e.name]);
        const allTxs = allData.filter(d => {
          const dId = getEmpId(d);
          if (dId === id) return true;
          if (d.nik && d.nik !== '-' && d.nik !== '') return false; // Jangan gabungkan jika punya NIK lain
          return empVariations.has(d.name);
        });
        
        let currentBalance = 0, accPrincipal = 0;
        if (allTxs.length > 0) {
          const sortedTxs = [...allTxs].filter(d => d.date).sort((a, b) => a.date - b.date);
          const monthlyRate = 0.03 / 12;
          let lastInterestMonth = null;
          
          sortedTxs.forEach(tx => {
            if (tx.isDeleted) return;
            let pending = 0;
            const txMonth = tx.date ? (tx.date.getFullYear() + '-' + tx.date.getMonth()) : null;

            if (tx.type === 'Tabungan') {
              if (txMonth && lastInterestMonth !== txMonth) {
                if (currentBalance > 0) pending = currentBalance * monthlyRate;
                lastInterestMonth = txMonth;
              }
              currentBalance += pending;
              currentBalance += tx.nominal;
              accPrincipal += tx.nominal;
            } else {
              const amountCovered = Math.max(0, Math.min(tx.nominal, currentBalance));
              if (amountCovered > 0) {
                const fromModal = Math.min(amountCovered, Math.max(0, accPrincipal));
                accPrincipal -= fromModal;
              } else {
                accPrincipal -= tx.nominal;
              }
              currentBalance -= tx.nominal;
            }
          });
        }

        let totalPaidDebt = 0;
        const empSheetRows = new Set(allTxs.map(t => t.sheetRow));
        allAnomalies.forEach(a => {
          if (empSheetRows.has(a.originalNo)) {
            totalPaidDebt += (a.initialDebt - a.remainingDebt);
          }
        });
        totalPaidDebt = Math.round(totalPaidDebt);
        
        const sisaSetoran = Math.max(0, Math.round(accPrincipal - totalPaidDebt));
        const empBrk = calculateWithdrawalBreakdown(allTxs);

        return {
          No: i + 1,
          Nama: e.name,
          NIK: e.nik || '-',
          'Sisa Setoran': sisaSetoran,
          'Total Saldo Akhir': Math.round(currentBalance),
          'Total Bunga yang Sudah Ditarik': Math.round(empBrk.bunga),
          'Status Aktif': status.isActive ? 'Aktif' : 'Tidak Aktif',
          'Transaksi Terakhir': status.lastDepositDate ? fmtDate(status.lastDepositDate) : '-'
        };
      });
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Daftar Saldo");
      XLSX.writeFile(wb, `Data_Saldo_Karyawan_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast('Data saldo karyawan berhasil didownload', 'success');
    });
  }

  // NEW: Employee Filter Listeners
  const modeSel = document.getElementById('empFilterMode');
  const yearSel = document.getElementById('empFilterYear');
  
  if (modeSel) {
    modeSel.addEventListener('change', () => {
      const mode = modeSel.value;
      const group = document.getElementById('empFilterMonthlyGroup');
      const recapContainer = document.getElementById('empMonthlyRecapContainer');
      
      if (mode === 'monthly') {
        group.classList.remove('hidden');
        recapContainer.classList.remove('hidden');
      } else {
        group.classList.add('hidden');
        recapContainer.classList.add('hidden');
      }
      if (currentEmpData.name) showEmployee(currentEmpData.name, currentEmpData.nik);
    });
  }
  
  if (yearSel) {
    yearSel.addEventListener('change', () => {
      if (currentEmpData.name) showEmployee(currentEmpData.name, currentEmpData.nik);
    });
  }

  // Sync Global Filters to refresh Employee View
  const globalFilterBtn = document.getElementById('btnApplyFilter');
  if (globalFilterBtn) {
    globalFilterBtn.addEventListener('click', () => {
      if (!document.getElementById('employeeDetail').classList.contains('hidden') && currentEmpData.name) {
        showEmployee(currentEmpData.name, currentEmpData.nik);
      }
    });
  }
  
  const globalTypeSel = document.getElementById('globalTypeFilter');
  if (globalTypeSel) {
    globalTypeSel.addEventListener('change', () => {
      if (!document.getElementById('employeeDetail').classList.contains('hidden') && currentEmpData.name) {
        showEmployee(currentEmpData.name, currentEmpData.nik);
      }
    });
  }

  // NEW: Detail Type Filter
  const empDetailTypeSel = document.getElementById('empDetailTypeFilter');
  if (empDetailTypeSel) {
    empDetailTypeSel.addEventListener('change', () => {
      if (!document.getElementById('employeeDetail').classList.contains('hidden') && currentEmpData.name) {
        showEmployee(currentEmpData.name, currentEmpData.nik);
      }
    });
  }
}

function showEmployee(name, nik = '') {
  window.scrollTo(0, 0);
  const detail = document.getElementById('employeeDetail');
  const list = document.getElementById('employeeListContainer');
  if (!detail || !list) return;

  // 1. Identify the Employee and all their variations (Names/NIK)
  const id = (nik && nik !== '-') ? nik : name;
  const variations = allAliasesMap[id] || new Set([name]);
  
  // Get all transactions that match either the NIK or any of the known names for this identity
  let allTxs = allData.filter(d => {
    const dId = getEmpId(d);
    if (dId === id) return true;
    if (d.nik && d.nik !== '-' && d.nik !== '') return false; // Jangan gabungkan jika punya NIK lain
    return variations.has(d.name);
  });

  list.classList.add('hidden');
  const controls = document.getElementById('empListControls');
  if (controls) controls.classList.add('hidden');
  detail.classList.remove('hidden');

  const inputStart = document.getElementById('globalStartDate');
  const inputEnd = document.getElementById('globalEndDate');
  const filterMode = document.getElementById('empFilterMode')?.value || 'custom';
  const filterYear = parseInt(document.getElementById('empFilterYear')?.value || new Date().getFullYear());
  const filterType = document.getElementById('empDetailTypeFilter')?.value || document.getElementById('globalTypeFilter')?.value || '';

  let startDate = null, endDate = null;
  const isValidDate = (d) => d instanceof Date && !isNaN(d);

  if (filterMode === 'custom') {
    const sStr = inputStart?.value;
    const eStr = inputEnd?.value;
    if (sStr) {
      const s = new Date(sStr);
      if (isValidDate(s)) { s.setHours(0, 0, 0, 0); startDate = s; }
    }
    if (eStr) {
      const e = new Date(eStr);
      if (isValidDate(e)) { e.setHours(23, 59, 59, 999); endDate = e; }
    }
  } else {
    startDate = new Date(filterYear, 0, 1, 0, 0, 0, 0);
    endDate = new Date(filterYear, 11, 31, 23, 59, 59, 999);
  }

  // Year Dropdown
  const yearSel = document.getElementById('empFilterYear');
  if (yearSel && yearSel.options.length === 0) {
    const years = [...new Set(allData.filter(d => d.date).map(d => d.date.getFullYear()))].sort((a, b) => b - a);
    if (years.length === 0) years.push(new Date().getFullYear());
    yearSel.innerHTML = years.map(y => `<option value="${y}" ${y === new Date().getFullYear() ? 'selected' : ''}>${y}</option>`).join('');
  }

  let totalIn = 0, totalOut = 0, lifeIn = 0, lifeOut = 0, lastContributionDate = null;
  allTxs.forEach(d => {
    if (d.isDeleted) return;
    d.type === 'Tabungan' ? lifeIn += d.nominal : lifeOut += d.nominal;
    let pass = true;
    if (startDate && d.date) pass = pass && d.date >= startDate;
    if (endDate && d.date) pass = pass && d.date <= endDate;
    if (filterType && d.type !== filterType) pass = false;
    if (pass) d.type === 'Tabungan' ? totalIn += d.nominal : totalOut += d.nominal;
    if (d.type === 'Tabungan' && (!lastContributionDate || d.date > lastContributionDate)) lastContributionDate = d.date;
  });

  // Calculate Balance & Bunga (Waterfall)
  let currentBalance = 0, exactBunga = 0, accPrincipal = 0, labels = [], balanceData = [], principalData = [];
  if (allTxs.length > 0) {
    const sortedTxs = [...allTxs].filter(d => d.date).sort((a, b) => a.date - b.date);
    const monthlyRate = 0.03 / 12;
    let lastInterestMonth = null;
    
    sortedTxs.forEach(tx => {
      if (tx.isDeleted) return;
      let pending = 0;
      const txMonth = tx.date ? (tx.date.getFullYear() + '-' + tx.date.getMonth()) : null;

      if (tx.type === 'Tabungan') {
        if (txMonth && lastInterestMonth !== txMonth) {
          if (currentBalance > 0) pending = currentBalance * monthlyRate;
          lastInterestMonth = txMonth;
        }
        currentBalance += pending;
        exactBunga += pending;

        currentBalance += tx.nominal;
        accPrincipal += tx.nominal;
      } else {
        const amountCovered = Math.max(0, Math.min(tx.nominal, currentBalance));
        if (amountCovered > 0) {
          const fromModal = Math.min(amountCovered, Math.max(0, accPrincipal));
          accPrincipal -= fromModal;
        } else {
          accPrincipal -= tx.nominal;
        }
        currentBalance -= tx.nominal;
      }
      labels.push(monthNames[tx.date.getMonth()] + ' ' + tx.date.getFullYear());
      balanceData.push(currentBalance);
      principalData.push(accPrincipal);
    });
  }

  const saldo = currentBalance;
  const roi = lifeIn > 0 ? (exactBunga / lifeIn * 100) : 0;
  const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  const empNik = nik && nik !== '-' ? nik : (allTxs[0]?.nik || '-');
  
  // Header
  document.getElementById('empHeader').innerHTML = `
    <div style="display: flex; gap: 20px; align-items: center; padding: 20px 0;">
      <div class="emp-avatar" style="width: 80px; height: 80px; font-size: 2rem;">${initials}</div>
      <div>
        <h2 style="margin: 0; font-size: 1.8rem; color: var(--slate);">${name}</h2>
        <div style="display: flex; gap: 10px; margin-top: 8px; color: var(--text-muted); font-size: 0.9rem;">
          <span><i class="fas fa-id-card"></i> ${empNik}</span>
          <span>&bull;</span>
          <span><i class="fas fa-calendar-alt"></i> Sejak ${allTxs.length > 0 ? fmtDate(allTxs[0].date) : '-'}</span>
          <span>&bull;</span>
          <span><i class="fas fa-exchange-alt"></i> ${allTxs.length} Transaksi</span>
        </div>
      </div>
    </div>`;



  // SMART ALERTS
  const alerts = [];
  const refDate = new Date();
  const monthsSinceLast = lastContributionDate ? (refDate.getFullYear() - lastContributionDate.getFullYear()) * 12 + (refDate.getMonth() - lastContributionDate.getMonth()) : 999;
  if (lastContributionDate && monthsSinceLast >= 3) {
    let durationStr = `${monthsSinceLast} bulan`;
    if (monthsSinceLast >= 12) {
      const years = Math.floor(monthsSinceLast / 12);
      const remainingMonths = monthsSinceLast % 12;
      durationStr = `${years} tahun` + (remainingMonths > 0 ? ` ${remainingMonths} bulan` : '');
    }
    alerts.push(`<div class="ai-insight-item" style="background:rgba(239, 68, 68, 0.1); border:1px solid rgba(239, 68, 68, 0.2);"><i class="fas fa-exclamation-triangle"></i> Karyawan ini tidak melakukan setoran selama ${durationStr} berturut-turut.</div>`);
  }
  document.getElementById('empSmartAlerts').innerHTML = alerts.join('');


  let saldoAwal = 0;
  if (startDate) {
    let tempBal = 0;
    let tempLastMonth = null;
    const sortedAll = [...allTxs].filter(d => d.date && d.date < startDate).sort((a, b) => a.date - b.date);
    
    sortedAll.forEach(tx => {
      if (tx.isDeleted) return;
      const txMonth = tx.date.getFullYear() + '-' + tx.date.getMonth();
      if (tx.type === 'Tabungan') {
        let interest = 0;
        if (tempLastMonth !== txMonth) {
          if (tempBal > 0) interest = tempBal * 0.0025;
          tempLastMonth = txMonth;
        }
        tempBal += interest + tx.nominal;
      } else {
        tempBal -= tx.nominal;
      }
    });
    saldoAwal = Math.round(tempBal);
  }

  const filteredEmpTxs = allTxs.filter(d => {
    let pass = true;
    if (startDate && d.date) pass = pass && d.date >= startDate;
    if (endDate && d.date) pass = pass && d.date <= endDate;
    if (filterType && d.type !== filterType) pass = false;
    return pass;
  });
  const empBrk = calculateWithdrawalBreakdown(filteredEmpTxs);
  const empBrkHtml = `
    <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed rgba(239, 68, 68, 0.3); font-size: 0.7rem; text-align: left; line-height: 1.6; color: #475569;">
      <div style="display: flex; justify-content: space-between;"><span>Modal:</span> <span style="font-weight:600; color:#ef4444;">${fmt(empBrk.modal)}</span></div>
      <div style="display: flex; justify-content: space-between;"><span>Bunga:</span> <span style="font-weight:600; color:#ef4444;">${fmt(empBrk.bunga)}</span></div>
      <div style="display: flex; justify-content: space-between;"><span>Selisih (Defisit):</span> <span style="font-weight:600; color:#ef4444;">${fmt(empBrk.salah)}</span></div>
      <div style="display: flex; justify-content: space-between;"><span>Transaksi Meragukan:</span> <span style="font-weight:600; color:#ef4444;">${fmt(empBrk.suspicious)}</span></div>
    </div>
  `;

  let totalPaidDebt = 0;
  const empSheetRows = new Set(allTxs.map(t => t.sheetRow));
  allAnomalies.forEach(a => {
    if (empSheetRows.has(a.originalNo)) {
      totalPaidDebt += (a.initialDebt - a.remainingDebt);
    }
  });
  const rawSisaSetoran = Math.round(accPrincipal - totalPaidDebt);
  let sisaSetoranSub = 'Setoran murni tersisa';
  if (totalPaidDebt > 0) {
    sisaSetoranSub += `<div style="margin-top:4px;">Untuk bayar selisih: <span style="font-weight:600; color:#ef4444;">${fmt(totalPaidDebt)}</span></div>`;
  }

  const cards = [];
  const uniqueMonths = new Set(allTxs.filter(tx => tx.date).map(tx => tx.date.getFullYear() + '-' + tx.date.getMonth()));
  const avgContribution = uniqueMonths.size > 0 ? lifeIn / uniqueMonths.size : 0;
  if (startDate) {
    cards.push({ icon: 'fas fa-history', cls: 'yellow', label: 'Saldo Awal Pokok', value: fmt(saldoAwal), sub: `Per ${fmtDate(startDate)}` });
  }
  const isUserAdmin = currentUser && currentUser.role === 'admin';
  cards.push({ icon: 'fas fa-wallet', cls: 'blue', label: 'Sisa Setoran', value: fmt(rawSisaSetoran), sub: sisaSetoranSub });
  cards.push({ icon: 'fas fa-arrow-down', cls: 'green', label: 'Total Setoran', value: fmt(totalIn), sub: startDate ? 'Dalam periode filter' : `Rata-rata: ${fmt(Math.round(avgContribution))}/bln` });
  cards.push({ icon: 'fas fa-arrow-up', cls: 'red', label: 'Total Penarikan', value: fmt(totalOut), sub: empBrkHtml });

  if (isUserAdmin) {
    cards.push({ icon: 'fas fa-chart-line', cls: 'purple', label: 'Pengembangan (Bunga Historis)', value: fmt(Math.round(exactBunga)), sub: `ROI: ${roi.toFixed(2)}% (Audit Mode)` });
  }

  document.getElementById('empCards').innerHTML = cards.map(c => `
    <div class="summary-card">
      <div class="card-top">
        <div class="card-icon ${c.cls}"><i class="${c.icon}"></i></div>
        <div class="card-label">${c.label}</div>
      </div>
      <div class="card-value">${c.value}</div>
      <div class="card-sub" style="margin-top:2px;">${c.sub}</div>
    </div>
  `).join('');

  const monthsWithWithdrawals = new Set();
  allTxs.forEach(tx => { if (tx.type !== 'Tabungan' && tx.date) monthsWithWithdrawals.add(monthNames[tx.date.getMonth()] + ' ' + tx.date.getFullYear()); });
  const pointColors = labels.map(lbl => monthsWithWithdrawals.has(lbl) ? '#e11d48' : '#4f46e5');
  const pointBorderColors = labels.map(lbl => monthsWithWithdrawals.has(lbl) ? '#be123c' : '#3730a3');

  // Employee line chart
  const ctx1 = document.getElementById('empChart');
  if (charts.emp) charts.emp.dispose();
  charts.emp = echarts.init(ctx1);
  charts.emp.setOption({
    tooltip: {
      trigger: 'axis', backgroundColor: 'rgba(15, 23, 42, 0.9)', textStyle: { color: '#fff' }, formatter: (p) => {
        let html = `<div style="font-family:Inter;font-weight:600;margin-bottom:4px">${p[0].name}</div>`;
        p.forEach(s => { html += `<div><span style="display:inline-block;margin-right:4px;border-radius:10px;width:10px;height:10px;background-color:${s.color};"></span>${s.seriesName}: ${fmt(s.value)}</div>`; });
        return html;
      }
    },
    legend: { top: 0, textStyle: { fontFamily: 'Inter', color: '#64748b' } },
    grid: { top: 40, right: 20, bottom: 50, left: 60 },
    xAxis: { type: 'category', data: labels, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#64748b', fontFamily: 'Inter' } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: 'rgba(226,232,240,0.6)' } }, axisLabel: { color: '#64748b', fontFamily: 'Inter', formatter: (v) => v >= 1e6 ? (v / 1e6) + 'jt' : v } },
    dataZoom: [
      { type: 'slider', show: true, bottom: 10, height: 20, borderColor: 'transparent', backgroundColor: '#f1f5f9', handleSize: '100%', fillerColor: 'rgba(79,70,229,0.2)' },
      { type: 'inside', zoomOnMouseWheel: true, moveOnMouseMove: true }
    ],
    series: [
      {
        name: 'Total Saldo',
        data: balanceData.map((v, i) => ({ value: v, itemStyle: { color: pointColors[i], borderColor: pointBorderColors[i], borderWidth: 2 } })),
        type: 'line', smooth: 0.3, symbolSize: 6,
        lineStyle: { color: '#4f46e5', width: 2 },
        areaStyle: { color: 'rgba(79,70,229,0.1)' }
      },
      {
        name: 'Total Setoran',
        data: principalData,
        type: 'line', smooth: 0.3, symbol: 'none',
        lineStyle: { color: '#10b981', width: 2, type: 'dashed' }
      }
    ]
  });

  // Calculate specific metrics for the pie chart
  let pieSalah = 0;
  let pieSuspicious = 0;
  allAnomalies.forEach(a => {
    if (empSheetRows.has(a.originalNo)) {
      if (a.status === 'TERBUKTI' || a.status === 'Verified') {
        pieSalah += a.initialDebt;
      } else if (a.status === 'MENUNGGU REVIEW' || a.systemStatus === 'MENCURIGAKAN' || a.systemStatus === 'DICICIL') {
        pieSuspicious += a.initialDebt;
      } else {
        pieSalah += a.initialDebt;
      }
    }
  });

  // Pie chart
  const ctx2 = document.getElementById('empPieChart');
  if (charts.empPie) charts.empPie.dispose();
  charts.empPie = echarts.init(ctx2);
  
  const pieData = [
    { value: lifeIn, name: 'Total Setoran (Modal)', itemStyle: { color: '#4f46e5' } },
    { value: exactBunga, name: 'Total Bunga (Return)', itemStyle: { color: '#f59e0b' } }
  ];
  if (pieSalah > 0) {
    pieData.push({ value: pieSalah, name: 'Selisih (Defisit)', itemStyle: { color: '#ef4444' } });
  }
  if (pieSuspicious > 0) {
    pieData.push({ value: pieSuspicious, name: 'Transaksi Meragukan', itemStyle: { color: '#8b5cf6' } });
  }

  charts.empPie.setOption({
    tooltip: { trigger: 'item', backgroundColor: 'rgba(15, 23, 42, 0.9)', textStyle: { color: '#fff', fontFamily: 'Inter' }, formatter: (p) => `${p.marker}${p.name}: <br/><span style="margin-left:14px;font-weight:600">${fmt(p.value)}</span>` },
    legend: { bottom: 0, itemGap: 15, textStyle: { fontFamily: 'Inter', color: '#64748b' } },
    series: [{
      type: 'pie', radius: ['45%', '70%'], center: ['50%', '45%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
      label: { show: false }, labelLine: { show: false },
      data: pieData
    }]
  });

  // Transaction Table
  // Table
  currentEmpData = { name, nik };
  let tableRunBal = 0;
  let lastTxDateForTable = null;
  const tableData = [];

  const sortedTable = [...allTxs].filter(d => d.date).sort((a, b) => a.date - b.date);

  if (sortedTable.length > 0) {
    let tableLastInterestMonth = null;
    sortedTable.forEach(d => {
      let currentInterest = 0;
      const txMonth = d.date ? (d.date.getFullYear() + '-' + d.date.getMonth()) : null;

      if (!d.isDeleted) {
        if (d.type === 'Tabungan') {
          if (txMonth && tableLastInterestMonth !== txMonth) {
            if (tableRunBal > 0) currentInterest = tableRunBal * 0.0025;
            tableLastInterestMonth = txMonth;
          }
          tableRunBal += currentInterest;
          tableRunBal += d.nominal;
        } else {
          tableRunBal -= d.nominal;
          currentInterest = 0;
        }
      }

      let pass = true;
      if (startDate && d.date) pass = pass && d.date >= startDate;
      if (endDate && d.date) pass = pass && d.date <= endDate;
      if (filterType && d.type !== filterType) pass = false;

      if (pass) {
        const link = typeof getLinkFromKeterangan === 'function' ? getLinkFromKeterangan(d.keterangan) : null;
        const linkBtn = link ? `<a href="${link}" target="_blank" class="btn-view-tf" style="margin-left:8px; font-size:0.75rem;"><i class="fas fa-external-link-alt"></i> Bukti</a>` : '';

        const txKey = `anomali_${getEmpId(d)}_${d.date?.getTime() || 0}_${d.nominal}`.replace(/\s+/g, '_');
        const anom = allAnomalies.find(a => a.txKey === txKey || a.originalNo === d.sheetRow);
        
        let highlightBg = '';
        let alertIcon = '';
        let statusBadgeText = '';
        
        if (anom) {
          const sudahBayar = anom.initialDebt - anom.remainingDebt;
          const sisaCicilan = anom.remainingDebt;
          
          if (anom.status === 'TERBUKTI' || anom.status === 'Verified') {
            highlightBg = 'background-color: rgba(239, 68, 68, 0.05);';
            alertIcon = `<i class="fas fa-exclamation-circle" style="color:#ef4444; margin-right:4px;" title="Terbukti Selisih"></i>`;
            
            if (sisaCicilan > 0 && sudahBayar > 0) {
              statusBadgeText = `<span class="badge-status" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; font-size:0.7rem; padding: 1px 4px; border-radius: 4px; display:inline-block; margin-top:2px;">Terbukti (Dicicil: Sisa ${fmt(sisaCicilan)}, Bayar ${fmt(sudahBayar)})</span>`;
            } else if (sisaCicilan > 0) {
              statusBadgeText = `<span class="badge-status" style="background:#fee2e2; color:#b91c1c; border:1px solid #fecaca; font-size:0.7rem; padding: 1px 4px; border-radius: 4px; display:inline-block; margin-top:2px;">Terbukti (Sisa Selisih: ${fmt(sisaCicilan)})</span>`;
            } else {
              statusBadgeText = `<span class="badge-status" style="background:#dcfce7; color:#15803d; border:1px solid #bbf7d0; font-size:0.7rem; padding: 1px 4px; border-radius: 4px; display:inline-block; margin-top:2px;">Terbukti (Lunas: ${fmt(sudahBayar)})</span>`;
            }
          } else if (anom.status === 'MENUNGGU REVIEW' || anom.systemStatus === 'MENCURIGAKAN' || anom.systemStatus === 'DICICIL') {
            highlightBg = 'background-color: rgba(245, 158, 11, 0.05);';
            alertIcon = `<i class="fas fa-exclamation-triangle" style="color:#f59e0b; margin-right:4px;" title="Menunggu Review"></i>`;
            
            if (sisaCicilan > 0 && sudahBayar > 0) {
              statusBadgeText = `<span class="badge-status" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; font-size:0.7rem; padding: 1px 4px; border-radius: 4px; display:inline-block; margin-top:2px;">Meragukan (Dicicil: Sisa ${fmt(sisaCicilan)}, Bayar ${fmt(sudahBayar)})</span>`;
            } else {
              statusBadgeText = `<span class="badge-status" style="background:#fef3c7; color:#d97706; border:1px solid #fde68a; font-size:0.7rem; padding: 1px 4px; border-radius: 4px; display:inline-block; margin-top:2px;">Meragukan (Belum Direview: ${fmt(sisaCicilan)})</span>`;
            }
          } else if (anom.status === 'SALAH INPUT' || anom.status === 'Salah Orang') {
            statusBadgeText = `<span class="badge-status" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; font-size:0.7rem; padding: 1px 4px; border-radius: 4px; display:inline-block; margin-top:2px;">Salah Input</span>`;
          }
        }

        let jenisDisplay = d.jenis;
        if (statusBadgeText) {
          jenisDisplay += `<br/>${statusBadgeText}`;
        }
        if (d.isDeleted) {
          jenisDisplay += `<br/><span class="badge-status" style="background:#fee2e2; color:#ef4444; border:1px solid #fecaca; font-size:0.6rem; padding: 1px 4px; border-radius: 4px; display:inline-block; margin-top:2px;">DIABAIKAN / TIDAK DIHITUNG</span>`;
          jenisDisplay += `<br/><span style="color:#ef4444; font-style:italic; font-size:0.75rem; display:inline-block; margin-top:2px;">(transaksi diabaikan)</span>`;
          highlightBg = 'background-color: #f1f5f9; opacity: 0.5;';
          alertIcon = `<i class="fas fa-ban" style="color:#94a3b8; margin-right:4px;" title="Transaksi Diabaikan"></i>` + alertIcon;
        }

        // Tampilkan bunga yang cair di baris ini
        const bungaDisplay = (currentInterest > 0 && !d.isDeleted) ? fmt(currentInterest) : '-';

        tableData.push({
          date: d.date,
          dateStr: d.dateStr || fmtDate(d.date),
          jenis: jenisDisplay,
          linkBtn,
          nominal: d.nominal,
          type: d.type,
          bunga: d.isDeleted ? 0 : currentInterest,
          bungaDisplay,
          balance: tableRunBal,
          highlightBg,
          alertIcon,
          isEdited: d.isEdited,
          isDeleted: d.isDeleted,
          sheetRow: d.sheetRow,
          name: d.name,
          nik: d.nik,
          isDoubleDeposit: d.isDoubleDeposit
        });
      }
    });
  }

  // Apply Sorting to tableData
  tableData.sort((a, b) => {
    let v1, v2;
    switch (empTxSort.col) {
      case 1: v1 = a.date || 0; v2 = b.date || 0; break;
      case 4: v1 = a.nominal; v2 = b.nominal; break;
      case 6: v1 = a.bunga; v2 = b.bunga; break;
      case 7: v1 = a.balance; v2 = b.balance; break;
      default: return 0;
    }
    if (v1 < v2) return empTxSort.asc ? -1 : 1;
    if (v1 > v2) return empTxSort.asc ? 1 : -1;

    // Jika tanggal sama, gunakan sheetRow sebagai penentu urutan (secondary sort)
    if (empTxSort.col === 1) {
      const s1 = a.sheetRow || 0;
      const s2 = b.sheetRow || 0;
      if (s1 < s2) return empTxSort.asc ? -1 : 1;
      if (s1 > s2) return empTxSort.asc ? 1 : -1;
    }
    return 0;
  });

  const colBunga = document.querySelector('#empTable th[data-col="6"]');
  const colKumulatif = document.querySelector('#empTable th[data-col="7"]');
  if (colBunga) colBunga.style.display = isUserAdmin ? '' : 'none';
  if (colKumulatif) colKumulatif.style.display = isUserAdmin ? '' : 'none';

  const colRecapBunga = document.querySelector('#empRecapTable th:nth-child(4)');
  const colRecapKumulatif = document.querySelector('#empRecapTable th:nth-child(5)');
  if (colRecapBunga) colRecapBunga.style.display = isUserAdmin ? '' : 'none';
  if (colRecapKumulatif) colRecapKumulatif.style.display = isUserAdmin ? '' : 'none';

  document.querySelector('#empTable tbody').innerHTML = tableData.map((row, idx) => {
    const editedBadge = (!row.isDeleted && row.isEdited) ? `<span class="badge-status" style="font-size: 0.6rem; padding: 1px 4px; margin-left: 6px; background: #fef3c7; color: #b45309; border: 1px solid #fde68a; border-radius: 4px; vertical-align: middle;" title="Catatan: ${row.notes || '-'}">DIEDIT</span>` : '';
    const isAdmin = currentUser && currentUser.role === 'admin';
    const canEdit = true; // Buka akses edit untuk semua transaksi (Setoran & Penarikan)
    const editBtn = (isAdmin && canEdit) ? `<button class="btn btn-outline" style="padding: 2px 8px; font-size: 0.7rem; color: #f59e0b; border-color: #f59e0b; margin-left: 4px;" onclick="openEditModal(${row.sheetRow}, '${row.name.replace(/'/g, "\\'")}', ${row.nominal}, '${row.nik || ''}', '${row.type}', '${row.dateStr}', ${row.isDoubleDeposit ? 'true' : 'false'})"><i class="fas fa-pencil-alt"></i></button>` : '';

    const rowColorStyle = row.isDeleted ? 'color: #94a3b8;' : (row.balance < 0 ? 'color: #ef4444;' : '');
    const nominalDisplay = row.isDeleted ? `<del style="color: #94a3b8;">${fmt(row.nominal)}</del>` : fmt(row.nominal);

    return `
    <tr style="${row.highlightBg} ${rowColorStyle}">
      <td style="font-size: 0.8rem; color: ${row.isDeleted ? '#94a3b8' : (row.balance < 0 ? '#ef4444' : '#64748b')}; font-weight: 500;">${idx + 1}</td>
      <td style="color: ${row.isDeleted ? '#94a3b8' : (row.balance < 0 ? '#ef4444' : '')};">${row.alertIcon}${row.dateStr}${editedBadge}</td>
      <td style="font-size: 0.8rem; color: ${row.isDeleted ? '#94a3b8' : (row.balance < 0 ? '#ef4444' : '#64748b')}; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${row.name}">${row.name}</td>
      <td style="color: ${row.balance < 0 ? '#ef4444' : ''};">${row.jenis}${row.linkBtn}</td>
      <td style="font-weight:600; color: ${row.balance < 0 ? '#ef4444' : ''};">${nominalDisplay}</td>
      <td><span class="badge ${row.type === 'Tabungan' ? 'in' : 'out'}">${row.type}</span></td>
      <td style="color:${row.balance < 0 ? '#ef4444' : '#f59e0b'}; font-weight:600; ${isUserAdmin ? '' : 'display:none;'}">${row.bungaDisplay}</td>
      <td style="font-weight:700; color:${row.balance < 0 ? '#ef4444' : '#334155'}; ${isUserAdmin ? '' : 'display:none;'}">${fmt(row.balance)}</td>
      <td>${editBtn}</td>
    </tr>
  `}).join('');

  // 4. GENERATE MONTHLY RECAP (If in monthly mode)
  if (filterMode === 'monthly') {
    const monthlyRecap = Array.from({ length: 12 }, (_, i) => ({
      monthIdx: i,
      monthName: monthNames[i],
      totalIn: 0,
      totalOut: 0,
      totalBunga: 0,
      balance: 0
    }));

    // Re-calculate for recap table to get cumulative balance correctly
    let recapRunBal = 0;
    let recapLastInterestMonth = null;
    
    // Sort all transactions of this employee chronologically to get balance history
    const allChronological = [...allTxs].filter(d => d.date).sort((a, b) => a.date - b.date);
    
    allChronological.forEach(d => {
      if (d.isDeleted) return;
      const year = d.date.getFullYear();
      const monthIdx = d.date.getMonth();
      const txMonth = year + '-' + monthIdx;
      
      let interest = 0;
      if (d.type === 'Tabungan') {
        if (recapLastInterestMonth !== txMonth) {
          if (recapRunBal > 0) interest = recapRunBal * 0.0025;
          recapLastInterestMonth = txMonth;
        }
        recapRunBal += interest + d.nominal;
      } else {
        recapRunBal -= d.nominal;
        interest = 0;
      }

      // Only add to recap totals if within the selected year AND matches filterType
      if (year === filterYear) {
        const m = monthlyRecap[monthIdx];
        const matchType = !filterType || d.type === filterType;
        
        if (d.type === 'Tabungan') {
          if (matchType) m.totalIn += d.nominal;
          m.totalBunga += interest; // Bunga always counts for balance but might be shown differently
        } else {
          if (matchType) m.totalOut += d.nominal;
        }
        m.balance = recapRunBal;
      }
    });

    // Fill in balances for months with no transactions
    let lastKnownBal = 0;
    // Find balance at the end of the previous year
    allChronological.forEach(d => {
      if (d.date.getFullYear() < filterYear) {
        // Simple balance check (approximate but enough for recap start)
        let interest = 0;
        // This is a simplified replay - in a real app we'd reuse the main calculation engine
        lastKnownBal = (d.type === 'Tabungan' ? lastKnownBal + d.nominal : lastKnownBal - d.nominal);
      }
    });
    
    // Better: iterate month by month for the selected year
    let carryBal = lastKnownBal;
    monthlyRecap.forEach(m => {
      if (m.balance === 0 && m.totalIn === 0 && m.totalOut === 0) {
        m.balance = carryBal;
      } else {
        carryBal = m.balance;
      }
    });

    document.querySelector('#empRecapTable tbody').innerHTML = monthlyRecap.map(m => `
      <tr>
        <td style="font-weight: 600;">${m.monthName} ${filterYear}</td>
        <td style="color: #10b981;">${fmt(m.totalIn)}</td>
        <td style="color: #ef4444;">${fmt(m.totalOut)}</td>
        <td style="color: #f59e0b; ${isUserAdmin ? '' : 'display:none;'}">${fmt(Math.round(m.totalBunga))}</td>
        <td style="font-weight: 700; ${isUserAdmin ? '' : 'display:none;'}">${fmt(Math.round(m.balance))}</td>
      </tr>
    `).join('');
  }

  setTimeout(() => {
    if (charts.emp) charts.emp.resize();
    if (charts.empPie) charts.empPie.resize();
  }, 50);
}

function exportTxData() {
  const q = (document.getElementById('txSearch')?.value || '').toLowerCase().trim();
  const type = document.getElementById('globalTypeFilter')?.value || '';
  
  const inputStart = document.getElementById('globalStartDate');
  const inputEnd = document.getElementById('globalEndDate');
  const startDate = inputStart?.value ? new Date(inputStart.value) : null;
  const endDate = inputEnd?.value ? new Date(inputEnd.value) : null;
  if (startDate) startDate.setHours(0, 0, 0, 0);
  if (endDate) endDate.setHours(23, 59, 59, 999);

  let filtered = allData.filter(d => {
    let pass = true;
    if (startDate && d.date) pass = pass && d.date >= startDate;
    if (endDate && d.date) pass = pass && d.date <= endDate;
    if (type && d.type !== type) pass = false;
    if (q) pass = pass && (d.name.toLowerCase().includes(q) || (d.nik && d.nik.toLowerCase().includes(q)));
    return pass;
  });

  if (filtered.length === 0) {
    toast('Tidak ada data transaksi untuk didownload', 'error');
    return;
  }

  const exportData = filtered.map((d, i) => ({
    No: i + 1,
    Tanggal: d.dateStr,
    Nama: d.name,
    NIK: d.nik || '-',
    Tipe: d.type,
    Jenis: d.jenis,
    Nominal: d.nominal,
    Keterangan: d.keterangan || '-'
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data Transaksi");
  XLSX.writeFile(wb, `Data_Transaksi_${new Date().toISOString().split('T')[0]}.xlsx`);
  toast('Data transaksi berhasil didownload', 'success');
}

// ===== ANALYTICS =====
// ===== NEW ANALYTICS ENGINE =====
function initAnalytics() {
  const timeFilterBtns = document.querySelectorAll('#analyticsTimeFilter button');
  const yearGroup = document.getElementById('analyticsYearSelectGroup');
  const monthGroup = document.getElementById('analyticsMonthSelectGroup');
  const customGroup = document.getElementById('analyticsCustomRangeGroup');
  const yearSelect = document.getElementById('analyticsYearSelect');
  const monthSelect = document.getElementById('analyticsMonthSelect');
  const btnApply = document.getElementById('btnApplyAnalyticsFilter');

  // 1. Setup Filters
  if (yearSelect && yearSelect.options.length === 0) {
    const years = [...new Set(allData.filter(d => d.date).map(d => d.date.getFullYear()))].sort((a, b) => b - a);
    if (years.length === 0) years.push(new Date().getFullYear());
    yearSelect.innerHTML = years.map(y => `<option value="${y}" ${y === new Date().getFullYear() ? 'selected' : ''}>${y}</option>`).join('');
  }

  if (monthSelect && monthSelect.options.length === 0) {
    monthSelect.innerHTML = monthNames.map((m, i) => `<option value="${i}">${m}</option>`).join('');
    monthSelect.value = new Date().getMonth();
  }

  timeFilterBtns.forEach(btn => {
    btn.onclick = () => {
      timeFilterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const range = btn.dataset.range;
      
      yearGroup.classList.add('hidden');
      monthGroup.classList.add('hidden');
      customGroup.classList.add('hidden');

      if (range === 'yearly') yearGroup.classList.remove('hidden');
      if (range === 'monthly') { yearGroup.classList.remove('hidden'); monthGroup.classList.remove('hidden'); }
      if (range === 'custom') customGroup.classList.remove('hidden');

      renderAnalyticsContent();
    };
  });

  if (btnApply) btnApply.onclick = renderAnalyticsContent;
  
  const btnDownload = document.getElementById('btnDownloadAnalytics');
  if (btnDownload) btnDownload.onclick = exportAnalyticsReport;

  // Initial Render
  renderAnalyticsContent();
}

function renderAnalyticsContent() {
  const range = document.querySelector('#analyticsTimeFilter button.active').dataset.range;
  const year = parseInt(document.getElementById('analyticsYearSelect').value);
  const month = parseInt(document.getElementById('analyticsMonthSelect').value);
  const startStr = document.getElementById('analyticsStartDate').value;
  const endStr = document.getElementById('analyticsEndDate').value;

  let filtered = [...allData];
  let anomFiltered = [...allAnomalies];

  if (range === 'yearly') {
    filtered = filtered.filter(d => d.date && d.date.getFullYear() === year);
    anomFiltered = anomFiltered.filter(a => a.date && a.date.getFullYear() === year);
  } else if (range === 'monthly') {
    filtered = filtered.filter(d => d.date && d.date.getFullYear() === year && d.date.getMonth() === month);
    anomFiltered = anomFiltered.filter(a => a.date && a.date.getFullYear() === year && a.date.getMonth() === month);
  } else if (range === 'custom') {
    const s = startStr ? new Date(startStr) : null;
    const e = endStr ? new Date(endStr) : null;
    if (e) e.setHours(23, 59, 59);
    if (s) {
      filtered = filtered.filter(d => d.date && d.date >= s);
      anomFiltered = anomFiltered.filter(a => a.date && a.date >= s);
    }
    if (e) {
      filtered = filtered.filter(d => d.date && d.date <= e);
      anomFiltered = anomFiltered.filter(a => a.date && a.date <= e);
    }
  }

  let filterEndDate = new Date();
  if (range === 'yearly') {
    filterEndDate = new Date(year, 11, 31, 23, 59, 59);
  } else if (range === 'monthly') {
    filterEndDate = new Date(year, month + 1, 0, 23, 59, 59);
  } else if (range === 'custom') {
    if (endStr) {
      filterEndDate = new Date(endStr);
      filterEndDate.setHours(23, 59, 59);
    }
  }

  const cumulativeData = allData.filter(d => d.date && d.date <= filterEndDate);
  const emps = {};
  const monthlyRate = 0.03 / 12;
  const sorted = [...cumulativeData].sort((a,b)=>a.date-b.date);
  sorted.forEach(d => {
    if (d.isDeleted) return;
    const id = typeof getEmpId === 'function' ? getEmpId(d) : (d.nik || d.name);
    if (!emps[id]) emps[id] = { balance: 0, lastInterestMonth: null };
    
    if (d.type === 'Tabungan') {
      const txMonth = d.date ? (d.date.getFullYear() + '-' + d.date.getMonth()) : null;
      let interest = 0;
      if (txMonth && emps[id].lastInterestMonth !== txMonth) {
        if (emps[id].balance > 0) interest = emps[id].balance * monthlyRate;
        emps[id].lastInterestMonth = txMonth;
      }
      emps[id].balance += interest + d.nominal;
    } else {
      emps[id].balance -= d.nominal;
    }
  });
  const totalSaldoWithInterest = Object.values(emps).reduce((sum, e) => sum + e.balance, 0);

  // CALCULATE KPI CATEGORIES
  renderFinancialKpis(filtered, anomFiltered, totalSaldoWithInterest);
  renderBehavioralKpis(filtered, anomFiltered);
  renderOperationalKpis(filtered, anomFiltered);
  
  // RENDER TRENDS
  renderAnomaliTrends(anomFiltered);
  renderRecoveryTrend(anomFiltered);
  
  // RENDER MATRIX
  renderInsightMatrix(anomFiltered);
  
  // RENDER TABLES
  renderDeepAnalysisTables(anomFiltered);

}

function renderFinancialKpis(data, anoms, totalSaldoWithInterest = 0) {
  const totalIn = data.filter(d => !d.isDeleted && d.type === 'Tabungan').reduce((sum, d) => sum + d.nominal, 0);
  const totalOut = data.filter(d => !d.isDeleted && d.type === 'Penarikan').reduce((sum, d) => sum + d.nominal, 0);
  
  // Over-withdraw logic
  const totalInitialLoss = anoms.reduce((sum, a) => sum + (a.initialDebt || 0), 0);
  const totalRemainingLoss = anoms.reduce((sum, a) => sum + (a.remainingDebt || 0), 0);
  const provenLoss = anoms.filter(a => a.status === 'TERBUKTI').reduce((sum, a) => sum + (a.remainingDebt || 0), 0);
  
  const recovery = totalInitialLoss - totalRemainingLoss;
  const recoveryRate = totalInitialLoss > 0 ? (recovery / totalInitialLoss * 100) : 100; // Default to 100% if no losses

  const kpis = [
    { label: 'TOTAL (MODAL + BUNGA)', val: fmt(totalSaldoWithInterest), icon: 'fa-wallet', cls: 'indigo', sub: 'Akumulasi riil hingga akhir periode filter' },
    { label: 'SAAT INI (YANG DIPEGANG)', val: fmt(totalIn - totalOut), icon: 'fa-hand-holding-usd', cls: 'blue', sub: 'Sisa Modal Pokok murni (Masuk - Ditarik)' },
    { label: 'Total Uang Masuk', val: fmt(totalIn), icon: 'fa-arrow-down', cls: 'green', sub: 'Hanya Modal Pokok / Setoran (Tanpa Bunga)' },
    { label: 'Total Penarikan', val: fmt(totalOut), icon: 'fa-external-link-alt', cls: 'amber', sub: 'Total akumulasi penarikan dana' },
    { label: 'Total Over-Withdraw', val: fmt(totalInitialLoss), icon: 'fa-exclamation-circle', cls: 'orange', sub: 'Potensi defisit penarikan awal' },
    { label: 'Selisih Terbukti', val: fmt(provenLoss), icon: 'fa-shield-alt', cls: 'red', sub: 'Total selisih yang terkonfirmasi' },
    { label: 'Total Recovery', val: fmt(recovery), icon: 'fa-redo', cls: 'green', sub: 'Dana selisih yang berhasil dipulihkan' },
    { label: 'Recovery Rate %', val: recoveryRate.toFixed(1) + '%', icon: 'fa-percent', cls: 'cyan', sub: 'Rasio keberhasilan pemulihan selisih' }
  ];

  document.getElementById('analyticsFinancialKpis').innerHTML = kpis.map(k => `
    <div class="summary-card">
      <div class="card-top">
        <div class="card-icon ${k.cls}"><i class="fas ${k.icon}"></i></div>
        <div class="card-label">${k.label}</div>
      </div>
      <div class="card-value" style="font-size: 1.2rem;">${k.val}</div>
      ${k.sub ? `<div style="font-size: 0.7rem; color: #94a3b8; margin-top: 8px; font-weight: 500; line-height: 1.3;"><i class="fas fa-info-circle" style="color: #cbd5e1; margin-right: 4px;"></i>${k.sub}</div>` : ''}
    </div>
  `).join('');
}

function renderBehavioralKpis(data, anoms) {
  // Filter only genuine anomalies (same as Anomali table default visibility)
  const validAnoms = anoms.filter(a => a.systemStatus === 'MENCURIGAKAN' || a.systemStatus === 'DICICIL' || a.status === 'TERBUKTI');

  // Top Offender
  const empMap = {};
  validAnoms.forEach(a => {
    const id = a.nik || a.name;
    if (!empMap[id]) empMap[id] = { name: a.name, count: 0, total: 0 };
    empMap[id].count++;
    empMap[id].total += a.initialDebt;
  });
  const topEmp = Object.values(empMap).sort((a,b) => b.total - a.total)[0] || { name: '-', total: 0 };

  const kpis = [
    { label: 'Top Offender (Value)', val: topEmp.name, sub: fmt(topEmp.total), icon: 'fa-user-ninja' },
    { label: 'Unique Employees', val: new Set(validAnoms.map(a => a.nik || a.name)).size + ' Orang', sub: 'Terlibat anomali', icon: 'fa-users' }
  ];

  document.getElementById('analyticsBehavioralKpis').innerHTML = kpis.map(k => `
    <div style="background:#f8fafc; padding:16px; border-radius:12px; border:1px solid #e2e8f0; display:flex; align-items:center; gap:12px;">
      <div style="background:#fff; width:40px; height:40px; border-radius:8px; display:flex; align-items:center; justify-content:center; color:var(--primary); box-shadow:var(--shadow-sm);"><i class="fas ${k.icon}"></i></div>
      <div>
        <div style="font-size:0.7rem; font-weight:700; color:#64748b; text-transform:uppercase;">${k.label}</div>
        <div style="font-size:1rem; font-weight:700; color:#1e293b;">${k.val}</div>
        <div style="font-size:0.75rem; color:#94a3b8;">${k.sub}</div>
      </div>
    </div>
  `).join('');
}

function renderOperationalKpis(data, anoms) {
  const total = anoms.length;
  const reviewed = anoms.filter(a => a.status !== 'MENUNGGU REVIEW').length;
  const pending = total - reviewed;

  const kpis = [
    { label: 'Review Selesai', val: reviewed + ' Kasus', sub: ((reviewed/total*100) || 0).toFixed(1) + '% Completion', icon: 'fa-check-circle' },
    { label: 'Pending Review', val: pending + ' Kasus', sub: 'Menunggu antrean', icon: 'fa-clock' }
  ];

  document.getElementById('analyticsOperationalKpis').innerHTML = kpis.map(k => `
    <div style="background:#f8fafc; padding:16px; border-radius:12px; border:1px solid #e2e8f0; display:flex; align-items:center; gap:12px;">
      <div style="background:#fff; width:40px; height:40px; border-radius:8px; display:flex; align-items:center; justify-content:center; color:var(--success); box-shadow:var(--shadow-sm);"><i class="fas ${k.icon}"></i></div>
      <div>
        <div style="font-size:0.7rem; font-weight:700; color:#64748b; text-transform:uppercase;">${k.label}</div>
        <div style="font-size:1rem; font-weight:700; color:#1e293b;">${k.val}</div>
        <div style="font-size:0.75rem; color:#94a3b8;">${k.sub}</div>
      </div>
    </div>
  `).join('');
}

function renderAnomaliTrends(anoms) {
  const monthly = {};
  anoms.forEach(a => {
    if (!a.date) return;
    const k = a.date.getFullYear() + '-' + String(a.date.getMonth()).padStart(2, '0');
    if (!monthly[k]) monthly[k] = { count: 0, value: 0 };
    monthly[k].count++;
    monthly[k].value += a.initialDebt;
  });

  const keys = Object.keys(monthly).sort();
  const labels = keys.map(k => { const [y, m] = k.split('-'); return monthNames[+m] + ' ' + y; });
  const counts = keys.map(k => monthly[k].count);
  const values = keys.map(k => monthly[k].value);

  // Volume Chart
  const ctxVol = document.getElementById('chartAnomaliVolume');
  if (charts.anomVol) charts.anomVol.dispose();
  charts.anomVol = echarts.init(ctxVol);
  charts.anomVol.setOption({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: labels, axisLabel: { color: '#64748b' } },
    yAxis: { type: 'value', axisLabel: { color: '#64748b' } },
    series: [{ data: counts, type: 'bar', itemStyle: { color: '#6366f1', borderRadius: [4, 4, 0, 0] } }]
  });

  // Value Chart
  const ctxVal = document.getElementById('chartAnomaliValue');
  if (charts.anomVal) charts.anomVal.dispose();
  charts.anomVal = echarts.init(ctxVal);
  charts.anomVal.setOption({
    tooltip: { trigger: 'axis', formatter: (p) => `${p[0].name}<br/>${fmt(p[0].value)}` },
    xAxis: { type: 'category', data: labels, axisLabel: { color: '#64748b' } },
    yAxis: { type: 'value', axisLabel: { color: '#64748b', formatter: v => v >= 1e6 ? (v/1e6).toFixed(1)+'jt' : v } },
    series: [{ data: values, type: 'line', smooth: true, itemStyle: { color: '#ef4444' }, areaStyle: { color: 'rgba(239, 68, 68, 0.1)' } }]
  });
}

function renderRecoveryTrend(anoms) {
  const monthly = {};
  anoms.forEach(a => {
    if (!a.date) return;
    const k = a.date.getFullYear() + '-' + String(a.date.getMonth()).padStart(2, '0');
    if (!monthly[k]) monthly[k] = { initial: 0, remaining: 0 };
    monthly[k].initial += a.initialDebt;
    monthly[k].remaining += a.remainingDebt;
  });

  const keys = Object.keys(monthly).sort();
  const labels = keys.map(k => { const [y, m] = k.split('-'); return monthNames[+m] + ' ' + y; });
  const dataRecovered = keys.map(k => monthly[k].initial - monthly[k].remaining);

  const ctx = document.getElementById('chartRecoveryTrend');
  if (charts.recoveryTrend) charts.recoveryTrend.dispose();
  charts.recoveryTrend = echarts.init(ctx);
  charts.recoveryTrend.setOption({
    tooltip: { trigger: 'axis', formatter: (p) => `${p[0].name}<br/>Recovered: ${fmt(p[0].value)}` },
    xAxis: { type: 'category', data: labels, axisLabel: { color: '#64748b' } },
    yAxis: { type: 'value', axisLabel: { color: '#64748b' } },
    series: [{ data: dataRecovered, type: 'line', smooth: true, symbolSize: 10, itemStyle: { color: '#10b981' }, lineStyle: { width: 4 } }]
  });
}

function renderInsightMatrix(anoms) {
  const matrix = [
    { label: 'Kasus Aktif Belum Dicek', icon: 'fa-hourglass-start', color: '#ef4444', desc: 'Meragukan + Menunggu Review', val: anoms.filter(a => a.systemStatus === 'MENCURIGAKAN' && a.status === 'MENUNGGU REVIEW').length },
    { label: 'Selisih Selesai Dibayar', icon: 'fa-check-double', color: '#10b981', desc: 'Lunas + Terbukti', val: anoms.filter(a => a.systemStatus === 'LUNAS' && a.status === 'TERBUKTI').length },
    { label: 'False Positive / Koreksi', icon: 'fa-user-edit', color: '#3b82f6', desc: 'Lunas + Salah Input', val: anoms.filter(a => a.status === 'SALAH INPUT').length },
    { label: 'Sedang Proses Recovery', icon: 'fa-sync', color: '#f59e0b', desc: 'Dicicil + Terbukti', val: anoms.filter(a => a.systemStatus === 'DICICIL' && a.status === 'TERBUKTI').length }
  ];

  document.getElementById('analyticsInsightMatrix').innerHTML = matrix.map(m => `
    <div class="matrix-card" style="border-left-color: ${m.color};">
      <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:12px;">
        <div style="background:${m.color}15; color:${m.color}; width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center;"><i class="fas ${m.icon}"></i></div>
        <div style="font-size:1.8rem; font-weight:800; color:#1e293b;">${m.val}</div>
      </div>
      <div style="font-weight:700; color:#1e293b; margin-bottom:4px; font-size:0.9rem;">${m.label}</div>
      <div style="font-size:0.75rem; color:#94a3b8;">${m.desc}</div>
    </div>
  `).join('');
}

function renderDeepAnalysisTables(anoms) {
  // Top Offenders Table
  const empMap = {};
  anoms.forEach(a => {
    const id = a.nik || a.name;
    if (!empMap[id]) empMap[id] = { nik: a.nik || '-', name: a.name, count: 0, total: 0 };
    empMap[id].count++;
    empMap[id].total += a.initialDebt;
  });
  const sortedOffenders = Object.values(empMap).sort((a,b) => b.total - a.total).slice(0, 10);
  document.querySelector('#tableTopAnomali tbody').innerHTML = sortedOffenders.map(o => `
    <tr class="clickable-row" onclick="goToEmployee('${o.name.replace(/'/g, "\\'")}', '${o.nik === '-' ? '' : o.nik}')">
      <td>${o.nik}</td>
      <td style="font-weight:600">${o.name}</td>
      <td>${o.count}</td>
      <td style="color:#ef4444; font-weight:700">${fmt(o.total)}</td>
      <td><span class="btn-detail-link">Detail <i class="fas fa-chevron-right"></i></span></td>
    </tr>
  `).join('');

  // Proven Loss Table
  const proven = anoms.filter(a => a.status === 'TERBUKTI').sort((a,b) => b.date - a.date).slice(0, 10);
  document.querySelector('#tableProvenLoss tbody').innerHTML = proven.map(a => `
    <tr class="clickable-row" onclick="goToEmployee('${a.name.replace(/'/g, "\\'")}', '${a.nik || ''}')">
      <td>${a.dateStr}</td>
      <td>${a.name}</td>
      <td style="color:#ef4444">${fmt(a.initialDebt)}</td>
      <td style="color:#10b981">${fmt(a.initialDebt - a.remainingDebt)}</td>
      <td><span class="btn-detail-link">Detail <i class="fas fa-chevron-right"></i></span></td>
    </tr>
  `).join('');
}



function exportAnalyticsReport() {
  const range = document.querySelector('#analyticsTimeFilter button.active').dataset.range;
  const year = document.getElementById('analyticsYearSelect').value;
  const month = document.getElementById('analyticsMonthSelect').value;
  const startStr = document.getElementById('analyticsStartDate').value;
  const endStr = document.getElementById('analyticsEndDate').value;

  let filtered = [...allData];
  let anomFiltered = [...allAnomalies];

  if (range === 'yearly') {
    filtered = filtered.filter(d => d.date && d.date.getFullYear() == year);
    anomFiltered = anomFiltered.filter(a => a.date && a.date.getFullYear() == year);
  } else if (range === 'monthly') {
    filtered = filtered.filter(d => d.date && d.date.getFullYear() == year && d.date.getMonth() == month);
    anomFiltered = anomFiltered.filter(a => a.date && a.date.getFullYear() == year && a.date.getMonth() == month);
  } else if (range === 'custom') {
    const s = startStr ? new Date(startStr) : null;
    const e = endStr ? new Date(endStr) : null;
    if (e) e.setHours(23, 59, 59);
    if (s) {
      filtered = filtered.filter(d => d.date && d.date >= s);
      anomFiltered = anomFiltered.filter(a => a.date && a.date >= s);
    }
    if (e) {
      filtered = filtered.filter(d => d.date && d.date <= e);
      anomFiltered = anomFiltered.filter(a => a.date && a.date <= e);
    }
  }

  const wb = XLSX.utils.book_new();

  // 1. KPI Summary Sheet
  const totalIn = filtered.filter(d => !d.isDeleted && d.type === 'Tabungan').reduce((sum, d) => sum + d.nominal, 0);
  const totalOut = filtered.filter(d => !d.isDeleted && d.type === 'Penarikan').reduce((sum, d) => sum + d.nominal, 0);
  const initialLoss = anomFiltered.reduce((sum, a) => sum + (a.initialDebt || 0), 0);
  const remainingLoss = anomFiltered.reduce((sum, a) => sum + (a.remainingDebt || 0), 0);
  const recovery = initialLoss - remainingLoss;
  
  const kpiData = [
    ["METRIK ANALYTICS", "NILAI"],
    ["Periode Laporan", range.toUpperCase()],
    ["SAAT INI (YANG DIPEGANG)", totalIn - totalOut],
    ["Total Uang Masuk", totalIn],
    ["Total Penarikan", totalOut],
    ["Potensi Selisih (Initial)", initialLoss],
    ["Sisa Selisih (Remaining)", remainingLoss],
    ["Total Pemulihan (Recovery)", recovery],
    ["Recovery Rate", initialLoss > 0 ? (recovery/initialLoss*100).toFixed(2) + "%" : "100%"]
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kpiData), "Ringkasan Eksekutif");

  // 2. Anomali Detail Sheet
  const anomData = anomFiltered.map(a => ({
    Tanggal: a.dateStr,
    Karyawan: a.name,
    NIK: a.nik || '-',
    'Nominal Transaksi': a.nominal,
    'Selisih': a.initialDebt,
    'Sisa Cicilan': a.remainingDebt,
    Status: a.status,
    Sistem: a.systemStatus,
    Reviewer: a.reviewer || '-',
    Catatan: a.notes || '-'
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(anomData), "Detail Kasus");

  // 3. Top Offenders
  const offenderMap = {};
  anomFiltered.forEach(a => {
    const id = a.nik || a.name;
    if (!offenderMap[id]) offenderMap[id] = { Nama: a.name, NIK: a.nik || '-', 'Total Kasus': 0, 'Total Defisit': 0 };
    offenderMap[id]['Total Kasus']++;
    offenderMap[id]['Total Defisit'] += (a.initialDebt || 0);
  });
  const topOffenders = Object.values(offenderMap).sort((a,b) => b['Total Defisit'] - a['Total Defisit']);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(topOffenders), "Top Pelanggaran");

  const filename = `Laporan_Analytics_${range}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
  toast('Laporan Analytics berhasil diekspor', 'success');
}


// ===== ADMIN =====
function initAdmin() {
  const zone = document.getElementById('uploadZone'); const fi = document.getElementById('excelFile');

  // Admin Menu Logic
  const menuCards = document.getElementById('adminMenuCards');
  const formsContainer = document.getElementById('adminFormsContainer');

  document.querySelectorAll('.admin-menu-card').forEach(card => {
    card.addEventListener('click', () => {
      menuCards.classList.add('hidden');
      formsContainer.classList.remove('hidden');
      document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active', 'hidden'));
      document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.add('hidden'));

      const target = document.getElementById(card.dataset.target);
      target.classList.remove('hidden');
      target.classList.add('active');
    });
  });

  document.getElementById('btnBackToAdminMenu').addEventListener('click', () => {
    formsContainer.classList.add('hidden');
    menuCards.classList.remove('hidden');
  });

  // Penarikan Form (Upload Excel) Logic
  initTarikExcelUpload();

  // Update Data Logic
  const btnDownloadUpdate = document.getElementById('btnDownloadTemplateUpdate');
  if (btnDownloadUpdate) {
    btnDownloadUpdate.addEventListener('click', () => {
      const exportData = [{ 'NO': '', 'Bulan dan Tahun': '', 'Karyawan': '', 'Nominal': '', 'NIK': '' }];
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template_Update_Data");
      XLSX.writeFile(wb, `Template_Update_Data.xlsx`);
      toast('Template Update berhasil didownload', 'success');
    });
  }
  zone.addEventListener('click', () => fi.click());
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor = '#6366f1'; });
  zone.addEventListener('dragleave', () => { zone.style.borderColor = ''; });
  zone.addEventListener('drop', e => { e.preventDefault(); zone.style.borderColor = ''; if (e.dataTransfer.files.length) handleExcel(e.dataTransfer.files[0]); });
  fi.addEventListener('change', () => { if (fi.files.length) handleExcel(fi.files[0]); });

  document.getElementById('btnMerge').addEventListener('click', mergeData);
  document.getElementById('btnCancelUpload').addEventListener('click', () => { document.getElementById('previewSection').classList.add('hidden'); window._uploadData = null; });
}

let _uploadData = null;
let _uploadTarikData = null;

function handleExcel(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array', cellNF: true, cellText: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
      if (json.length < 2) { toast('File kosong atau format salah', 'error'); return; }

      let headerRowIdx = json.findIndex(r => r.some(c => typeof c === 'string' && (c.toLowerCase().includes('karyawan') || c.toLowerCase().includes('nama') || c.toLowerCase().includes('nik') || c.toLowerCase().includes('badge'))));
      if (headerRowIdx === -1) headerRowIdx = 0;
      const headers = json[headerRowIdx].map(h => String(h || '').toLowerCase().trim());

      const nikIdx = headers.findIndex(h => h === 'nik' || h.includes('badge') || h === 'no badge');
      const namaIdx = headers.findIndex(h => h.includes('karyawan') || h === 'nama' || h.includes('nama karyawan'));
      const nomIdx = headers.findIndex(h => h.includes('nominal') || h.includes('money box') || h.includes('jumlah') || h === 'potongan');
      const dateIdx = headers.findIndex(h => h.includes('tanggal') || h.includes('bulan') || h.includes('waktu') || h.includes('date') || h.includes('tgl'));

      _uploadData = [];
      let allUploadRows = [];

      json.slice(headerRowIdx + 1).filter(r => r.length > 0).forEach((r, idx) => {
        let rawNom = nomIdx >= 0 ? r[nomIdx] : r[2];
        let nominal = typeof rawNom === 'number' ? rawNom : (Number(String(rawNom || '').replace(/\./g, '').replace(/,/g, '.').replace(/[^0-9.-]/g, '')) || 0);
        if (!nominal) return;

        let dateVal = dateIdx >= 0 ? r[dateIdx] : undefined;
        if (!dateVal) dateVal = r[0]; // Fallback to col A

        if (typeof dateVal === 'number') {
          dateVal = new Date((dateVal - (25567 + 2)) * 86400 * 1000).toLocaleDateString('id-ID');
        } else if (!dateVal) {
          dateVal = '-';
        }

        let rawNik = nikIdx >= 0 ? String(r[nikIdx] || '').trim() : '';
        if (nikIdx >= 0 && typeof r[nikIdx] === 'number') {
          const cellRef = XLSX.utils.encode_cell({ r: headerRowIdx + 1 + idx, c: nikIdx });
          if (ws[cellRef] && ws[cellRef].w) rawNik = ws[cellRef].w.replace(/[^0-9]/g, '');
        }
        let rawName = namaIdx >= 0 ? String(r[namaIdx] || '').trim() : String(r[1] || '').trim();

        if (!rawName && !rawNik) return;

        allUploadRows.push({
          id: idx,
          raw: r,
          dateVal,
          nominal,
          nik: rawNik,
          nama: rawName || rawNik
        });
      });

      let doubleCount = 0;
      allUploadRows.forEach(val => {
        let isDouble = allData.some(x => x.type === 'Tabungan' && x.name.toLowerCase().trim() === val.nama.toLowerCase().trim() && String(x.dateStr).toLowerCase().trim() === String(val.dateVal).toLowerCase().trim() && x.nominal === val.nominal);
        val.isDouble = isDouble;
        val.forceKeep = false;
        if (isDouble) doubleCount++;
      });

      // Sort double ke atas
      allUploadRows.sort((a, b) => {
        if (a.isDouble && !b.isDouble) return -1;
        if (!a.isDouble && b.isDouble) return 1;
        return 0;
      });

      _uploadData = allUploadRows;
      renderPreviewUpdate();

      let msg = 'File dibaca: ' + _uploadData.length + ' baris.';
      if (doubleCount > 0) msg += ` Ditemukan ${doubleCount} data yang sudah ada di sistem.`;
      toast(msg, doubleCount > 0 ? 'info' : 'success');
    } catch (err) { toast('Gagal membaca file Excel', 'error'); console.error(err); }
  };
  reader.readAsArrayBuffer(file);
}

window.deleteUpdateRow = function (id) {
  _uploadData = _uploadData.filter(d => d.id !== id);
  renderPreviewUpdate();
};

window.keepUpdateRow = function (id) {
  const row = _uploadData.find(d => d.id === id);
  if (row) {
    row.forceKeep = true;
  }
  renderPreviewUpdate();
};

function renderPreviewUpdate() {
  const preview = document.getElementById('previewSection');
  preview.classList.remove('hidden');
  document.getElementById('previewCount').textContent = _uploadData.length;
  document.querySelector('#previewTable tbody').innerHTML = _uploadData.map((d, i) => {
    let jenis = 'Lainnya';
    if (d.nominal === 50000 || d.nominal === 100000) jenis = 'Investasi Jaminan Kerja A';
    else if (d.nominal === 150000) jenis = 'Investasi Jaminan Kerja B';
    else if (d.nominal === 175000) jenis = 'Investasi Jaminan Kerja C';
    else if (d.nominal === 200000) jenis = 'Investasi Jaminan Kerja D';
    else if (d.nominal === 250000) jenis = 'Investasi Jaminan Kerja E';

    const isDouble = d.isDouble && !d.forceKeep;
    const rowStyle = isDouble ? 'background: #fef2f2;' : '';
    
    let badge = '';
    if (isDouble) {
      badge = ' <span class="badge out" style="padding:2px 6px; font-size:0.7rem; margin-left:8px;">Sudah Ada</span>';
    } else if (d.forceKeep) {
      badge = ' <span class="badge" style="padding:2px 6px; font-size:0.7rem; margin-left:8px; background:#10b981; color:#fff;">Tetap Diupload</span>';
    }

    let actionBtn = '';
    if (isDouble) {
      actionBtn = `
        <button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem; color: #10b981; border-color: #10b981; margin-right: 4px;" onclick="keepUpdateRow(${d.id})"><i class="fas fa-check"></i> Tetap Upload</button>
        <button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem; color: #ef4444; border-color: #ef4444;" onclick="deleteUpdateRow(${d.id})"><i class="fas fa-trash"></i> Hapus</button>
      `;
    } else {
      actionBtn = `<button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem; color: #ef4444; border-color: #ef4444;" onclick="deleteUpdateRow(${d.id})"><i class="fas fa-trash"></i> Hapus</button>`;
    }

    return `<tr style="${rowStyle}"><td>${d.dateVal}</td><td>${d.nama || '-'}${badge}</td><td>${jenis}</td><td style="font-weight:600; color:var(--primary);">${fmt(d.nominal)}</td><td>${actionBtn}</td></tr>`;
  }).join('');
}

async function sendDataToSheet(dataArray) {
  try {
    toast('Menyimpan data ke spreadsheet...', 'info');
    const payload = { data: dataArray };
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (result.success) {
      toast('Data berhasil disimpan ke Spreadsheet!', 'success');
      return true;
    } else {
      throw new Error(result.error || 'Server error');
    }
  } catch (err) {
    toast('Gagal menyimpan: ' + err.message, 'error');
    console.error(err);
    return false;
  }
}

async function mergeData() {
  if (!_uploadData || !_uploadData.length) { toast('Tidak ada data untuk digabungkan', 'error'); return; }

  const hasUnresolvedDouble = _uploadData.some(d => d.isDouble && !d.forceKeep);
  if (hasUnresolvedDouble) {
    toast('Masih ada transaksi yang sudah ada! Harap pilih "Tetap Upload" atau "Hapus" sebelum menyimpan.', 'error');
    return;
  }

  const payload = _uploadData.map((d, i) => {
    let dateVal = d.dateVal;
    if (dateVal === '-') dateVal = new Date().toLocaleDateString('id-ID');

    const name = String(d.nama || '').trim();
    let nominal = d.nominal;

    let jenis = 'Lainnya';
    if (nominal === 50000 || nominal === 100000) jenis = 'Investasi Jaminan Kerja A';
    else if (nominal === 150000) jenis = 'Investasi Jaminan Kerja B';
    else if (nominal === 175000) jenis = 'Investasi Jaminan Kerja C';
    else if (nominal === 200000) jenis = 'Investasi Jaminan Kerja D';
    else if (nominal === 250000) jenis = 'Investasi Jaminan Kerja E';

    return {
      no: allData.length + i + 1,
      bulanTahun: dateVal,
      karyawan: name,
      nominal: nominal,
      nik: d.nik || '',
      keterangan: 'Tabungan'
    };
  }).filter(d => d.karyawan && d.nominal > 0);

  if (payload.length === 0) {
    toast('Semua data sudah ada atau tidak valid.', 'error');
    return;
  }

  const btnMerge = document.getElementById('btnMerge');
  btnMerge.disabled = true;
  btnMerge.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';

  const success = await sendDataToSheet(payload);
  if (success) setTimeout(() => { location.reload(); }, 1500);
  else {
    btnMerge.disabled = false;
    btnMerge.innerHTML = '<i class="fas fa-save"></i> Simpan ke Spreadsheet';
  }
}

function initTarikExcelUpload() {
  const zoneTarik = document.getElementById('uploadZoneTarik');
  const fiTarik = document.getElementById('excelFileTarik');
  const btnDownloadTemplate = document.getElementById('btnDownloadTemplateTarik');
  const btnMergeTarik = document.getElementById('btnMergeTarik');
  const btnCancelUploadTarik = document.getElementById('btnCancelUploadTarik');

  if (btnDownloadTemplate) {
    btnDownloadTemplate.addEventListener('click', () => {
      const exportData = [{ 'Bulan dan tahun': '', 'Karyawan': '', 'NIK': '', 'Nominal': '' }];
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template_Penarikan");
      XLSX.writeFile(wb, `Template_Penarikan.xlsx`);
      toast('Template berhasil didownload', 'success');
    });
  }

  if (zoneTarik && fiTarik) {
    zoneTarik.addEventListener('click', () => fiTarik.click());
    zoneTarik.addEventListener('dragover', e => { e.preventDefault(); zoneTarik.style.borderColor = '#10b981'; });
    zoneTarik.addEventListener('dragleave', () => { zoneTarik.style.borderColor = '#94a3b8'; });
    zoneTarik.addEventListener('drop', e => { e.preventDefault(); zoneTarik.style.borderColor = '#94a3b8'; if (e.dataTransfer.files.length) handleTarikExcel(e.dataTransfer.files[0]); });
    fiTarik.addEventListener('change', () => { if (fiTarik.files.length) handleTarikExcel(fiTarik.files[0]); });
  }

  if (btnMergeTarik) btnMergeTarik.addEventListener('click', mergeTarikData);
  if (btnCancelUploadTarik) btnCancelUploadTarik.addEventListener('click', () => {
    document.getElementById('previewSectionTarik').classList.add('hidden');
    _uploadTarikData = null;
    if (fiTarik) fiTarik.value = '';
  });
}

function handleTarikExcel(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array', cellNF: true, cellText: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
      if (json.length < 2) { toast('File kosong atau format salah', 'error'); return; }

      let headerRowIdx = json.findIndex(r => r.some(c => typeof c === 'string' && (c.toLowerCase().includes('karyawan') || c.toLowerCase().includes('nama') || c.toLowerCase().includes('nik') || c.toLowerCase().includes('badge'))));
      if (headerRowIdx === -1) headerRowIdx = 0;
      const headers = json[headerRowIdx].map(h => String(h || '').toLowerCase().trim());

      const nikIdx = headers.findIndex(h => h === 'nik' || h.includes('badge') || h === 'no badge');
      const namaIdx = headers.findIndex(h => h.includes('karyawan') || h === 'nama' || h.includes('nama karyawan'));
      const nomIdx = headers.findIndex(h => h.includes('nominal') || h.includes('money box') || h.includes('jumlah') || h === 'potongan');
      const dateIdx = headers.findIndex(h => h.includes('tanggal') || h.includes('bulan') || h.includes('waktu') || h.includes('date') || h.includes('tgl'));

      _uploadTarikData = [];
      let allUploadRows = [];

      json.slice(headerRowIdx + 1).filter(r => r.length > 0).forEach((r, idx) => {
        let rawNom = nomIdx >= 0 ? r[nomIdx] : r[2];
        let nominal = typeof rawNom === 'number' ? rawNom : (Number(String(rawNom || '').replace(/\./g, '').replace(/,/g, '.').replace(/[^0-9.-]/g, '')) || 0);
        if (!nominal) return;
        nominal = -Math.abs(nominal);

        let dateVal = dateIdx >= 0 ? r[dateIdx] : undefined;
        if (!dateVal) dateVal = r[0]; // Fallback to col A

        if (typeof dateVal === 'number') {
          dateVal = new Date((dateVal - (25567 + 2)) * 86400 * 1000).toLocaleDateString('id-ID');
        } else if (!dateVal) {
          dateVal = '-';
        }

        let rawNik = nikIdx >= 0 ? String(r[nikIdx] || '').trim() : '';
        if (nikIdx >= 0 && typeof r[nikIdx] === 'number') {
          const cellRef = XLSX.utils.encode_cell({ r: headerRowIdx + 1 + idx, c: nikIdx });
          if (ws[cellRef] && ws[cellRef].w) rawNik = ws[cellRef].w.replace(/[^0-9]/g, '');
        }
        let rawName = namaIdx >= 0 ? String(r[namaIdx] || '').trim() : String(r[1] || '').trim();

        if (!rawName && !rawNik) return;

        const identifier = rawNik ? rawNik.toLowerCase() : rawName.toLowerCase();
        const dStr = String(dateVal).toLowerCase().trim();

        let monthYear = dStr;
        const parsedDate = parseDateStr(dateVal) || new Date(dateVal);
        if (parsedDate && !isNaN(parsedDate)) {
          monthYear = parsedDate.getFullYear() + '-' + parsedDate.getMonth();
        }

        allUploadRows.push({
          id: idx,
          raw: r,
          dateVal,
          nominal,
          nik: rawNik,
          nama: rawName || rawNik,
          identifier,
          monthYear
        });
      });

      let groupCount = {};
      allUploadRows.forEach(row => {
        let key = row.identifier + '_' + row.monthYear;
        groupCount[key] = (groupCount[key] || 0) + 1;
      });

      let doubleCount = 0;
      allUploadRows.forEach(row => {
        let key = row.identifier + '_' + row.monthYear;
        row.isDoubleUpload = groupCount[key] > 1;
        if (row.isDoubleUpload) doubleCount++;
      });

      allUploadRows.sort((a, b) => {
        if (a.isDoubleUpload && !b.isDoubleUpload) return -1;
        if (!a.isDoubleUpload && b.isDoubleUpload) return 1;
        return 0;
      });

      _uploadTarikData = allUploadRows;
      renderPreviewTarik();

      let msg = 'File penarikan dibaca: ' + _uploadTarikData.length + ' baris.';
      if (doubleCount > 0) msg += ` Ditemukan data double dalam bulan yang sama (harap hapus salah satu).`;
      toast(msg, doubleCount > 0 ? 'info' : 'success');
    } catch (err) { toast('Gagal membaca file Excel', 'error'); console.error(err); }
  };
  reader.readAsArrayBuffer(file);
}

window.deleteTarikRow = function (id) {
  _uploadTarikData = _uploadTarikData.filter(d => d.id !== id);
  let groupCount = {};
  _uploadTarikData.forEach(row => {
    let key = row.identifier + '_' + row.monthYear;
    groupCount[key] = (groupCount[key] || 0) + 1;
  });
  _uploadTarikData.forEach(row => {
    let key = row.identifier + '_' + row.monthYear;
    row.isDoubleUpload = groupCount[key] > 1;
    if (!row.isDoubleUpload) row.forceKeep = false; // Reset if no longer double
  });
  _uploadTarikData.sort((a, b) => {
    if (a.isDoubleUpload && !b.isDoubleUpload) return -1;
    if (!a.isDoubleUpload && b.isDoubleUpload) return 1;
    return 0;
  });
  renderPreviewTarik();
};

window.keepTarikRow = function (id) {
  const row = _uploadTarikData.find(d => d.id === id);
  if (row) {
    row.forceKeep = true;
  }
  renderPreviewTarik();
};

function renderPreviewTarik() {
  const preview = document.getElementById('previewSectionTarik');
  preview.classList.remove('hidden');
  document.getElementById('previewCountTarik').textContent = _uploadTarikData.length;
  document.querySelector('#previewTableTarik tbody').innerHTML = _uploadTarikData.map((d, i) => {
    const nameVal = d.nama || '-';
    const nomVal = d.nominal ? fmt(d.nominal) : '-';

    const isDouble = d.isDoubleUpload && !d.forceKeep;
    const rowStyle = isDouble ? 'background: #fef2f2;' : '';

    let badge = '';
    if (isDouble) {
      badge = ' <span class="badge out" style="padding:2px 6px; font-size:0.7rem; margin-left:8px;">Transaksi Double</span>';
    } else if (d.forceKeep) {
      badge = ' <span class="badge" style="padding:2px 6px; font-size:0.7rem; margin-left:8px; background:#10b981; color:#fff;">Tetap Diupload</span>';
    }

    let actionBtn = '';
    if (isDouble) {
      actionBtn = `
        <button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem; color: #10b981; border-color: #10b981; margin-right: 4px;" onclick="keepTarikRow(${d.id})"><i class="fas fa-check"></i> Tetap Upload</button>
        <button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem; color: #ef4444; border-color: #ef4444;" onclick="deleteTarikRow(${d.id})"><i class="fas fa-trash"></i> Hapus</button>
      `;
    } else if (d.forceKeep || d.isDoubleUpload) {
      // If force keep is true, or it was a double but now allowed
      actionBtn = `<button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem; color: #ef4444; border-color: #ef4444;" onclick="deleteTarikRow(${d.id})"><i class="fas fa-trash"></i> Hapus</button>`;
    } else {
      // Normal row might also be deletable if they want to discard it, but initially it didn't have delete button.
      // We can add delete button for normal rows too so they can exclude any row.
      actionBtn = `<button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem; color: #ef4444; border-color: #ef4444;" onclick="deleteTarikRow(${d.id})"><i class="fas fa-trash"></i> Hapus</button>`;
    }

    return `<tr style="${rowStyle}"><td>${d.dateVal}</td><td>${nameVal}${badge}</td><td style="font-weight:600; color:var(--danger);">${nomVal}</td><td>${actionBtn}</td></tr>`;
  }).join('');
}

async function mergeTarikData() {
  if (!_uploadTarikData || !_uploadTarikData.length) { toast('Tidak ada data untuk disimpan', 'error'); return; }

  // Cek apakah masih ada double yang belum diputuskan
  const hasUnresolvedDouble = _uploadTarikData.some(d => d.isDoubleUpload && !d.forceKeep);
  if (hasUnresolvedDouble) {
    toast('Masih ada transaksi double! Harap pilih "Tetap Upload" atau "Hapus" sebelum menyimpan.', 'error');
    return;
  }

  const payload = _uploadTarikData.map((d, i) => {
    let dateVal = d.dateVal;
    if (dateVal === '-') dateVal = new Date().toLocaleDateString('id-ID');

    const name = String(d.nama || '').trim();
    const nominal = d.nominal;

    return {
      no: allData.length + i + 1,
      bulanTahun: dateVal, // Save date as string for now
      karyawan: name,
      nominal: nominal,
      nik: d.nik || '',
      keterangan: 'Penarikan'
    };
  }).filter(d => d.karyawan && d.nominal !== 0);

  if (payload.length === 0) {
    toast('Data tidak valid. Pastikan ada nama dan nominal.', 'error');
    return;
  }

  const btnMergeTarik = document.getElementById('btnMergeTarik');
  btnMergeTarik.disabled = true;
  btnMergeTarik.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';

  const success = await sendDataToSheet(payload);
  if (success) {
    toast('Data penarikan berhasil disimpan!', 'success');
    setTimeout(() => { location.reload(); }, 1500);
  } else {
    btnMergeTarik.disabled = false;
    btnMergeTarik.innerHTML = '<i class="fas fa-save"></i> Simpan Data Penarikan';
  }
}

// Helper to extract links from Keterangan
function getLinkFromKeterangan(ket) {
  if (!ket) return null;
  const match = ket.match(/https?:\/\/[^\s]+/);
  return match ? match[0] : null;
}

// ===== NAVIGASI =====
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    const page = item.dataset.page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    document.getElementById('pageTitle').textContent = item.querySelector('span').textContent;
    document.getElementById('sidebar').classList.remove('open');

    // Contextual Topbar Filters
    const globalFilterContainer = document.getElementById('globalFilterContainer');
    const typeFilter = document.getElementById('globalTypeFilter');
    const anomaliFilter = document.getElementById('topAnomaliStatusFilter');
    const exportBtn = document.getElementById('btnExportExcel');

    const isAdmin = currentUser && currentUser.role === 'admin';

    if (page === 'transaksi') {
      globalFilterContainer?.classList.add('hidden');
      exportBtn?.classList.remove('hidden');
    } else if (page === 'anomali') {
      globalFilterContainer?.classList.add('hidden');
      anomaliFilter?.classList.add('hidden');
      exportBtn?.classList.add('hidden');
    } else if (page === 'admin') {
      globalFilterContainer?.classList.add('hidden');
      exportBtn?.classList.add('hidden');
    } else if (page === 'analytics') {
      globalFilterContainer?.classList.add('hidden');
      exportBtn?.classList.add('hidden');
    } else {
      globalFilterContainer?.classList.remove('hidden');
      typeFilter?.classList.remove('hidden');
      anomaliFilter?.classList.add('hidden');
      exportBtn?.classList.remove('hidden');
    }

    // Fix for ECharts rendering tiny when container is display: none
    setTimeout(() => {
      if (charts) Object.values(charts).forEach(c => {
        if (c && typeof c.resize === 'function') c.resize();
      });
    }, 50);
  });
});

document.getElementById('menuToggle').addEventListener('click', () => {
  const sb = document.getElementById('sidebar');
  if (window.innerWidth > 1024) {
    document.body.classList.toggle('sidebar-collapsed');
    localStorage.setItem('sidebarCollapsed', document.body.classList.contains('sidebar-collapsed'));
  } else {
    sb.classList.toggle('open');
  }
});

// Apply saved sidebar state
if (localStorage.getItem('sidebarCollapsed') === 'true') {
  document.body.classList.add('sidebar-collapsed');
}

// ===== START =====
// fetchData() is now called within checkLogin() or after login success
initLogin();
checkLogin();
initEditModal();

window.addEventListener('resize', () => {
  if (charts) {
    Object.values(charts).forEach(c => {
      if (c && typeof c.resize === 'function') c.resize();
    });
  }
});

// Event Listener Sortir Tabel Karyawan
document.addEventListener('click', e => {
  const th = e.target.closest('.sortable-emp');
  if (th) {
    const col = parseInt(th.dataset.col);
    if (empTxSort.col === col) {
      empTxSort.asc = !empTxSort.asc;
    } else {
      empTxSort.col = col;
      empTxSort.asc = true;
    }
    if (currentEmpData.name) {
      showEmployee(currentEmpData.name, currentEmpData.nik);
    }
  }

  // Sorting untuk Tabel Anomali
  const thAnomali = e.target.closest('.sortable-anomali');
  if (thAnomali) {
    const col = parseInt(thAnomali.dataset.col);
    if (anomaliSort.col === col) {
      anomaliSort.asc = !anomaliSort.asc;
    } else {
      anomaliSort.col = col;
      anomaliSort.asc = true;
    }
    renderAnomaliTable();
  }

  // Sorting untuk Tabel Transaksi
  const thTx = e.target.closest('.sortable');
  if (thTx) {
    const col = parseInt(thTx.dataset.col);
    if (txSort.col === col) {
      txSort.asc = !txSort.asc;
    } else {
      txSort.col = col;
      txSort.asc = true;
    }
    txPage = 1;
    renderTxTable();
  }
});
function exportAnomaliData() {
  const q = (document.getElementById('anomaliSearch')?.value || '').toLowerCase().trim();
  const s = document.getElementById('anomaliStatusFilter')?.value || '';
  const filterRepeat = document.getElementById('anomaliRepeatFilter')?.value || 'all';
  const filterEmpStatus = document.getElementById('anomaliEmpStatusFilter')?.value || 'all';
  const mode = document.getElementById('anomaliFilterMode')?.value || 'custom';
  const startMonth = document.getElementById('anomaliFilterStartMonth')?.value || '';
  const endMonth = document.getElementById('anomaliFilterEndMonth')?.value || '';

  // Hitung frekuensi anomali per orang untuk filter repeat
  const frequencyMap = {};
  allAnomalies.forEach(a => {
    const id = a.nik && a.nik !== '-' ? a.nik : a.name;
    frequencyMap[id] = (frequencyMap[id] || 0) + 1;
  });

  const checkedStatuses = Array.from(document.querySelectorAll('.sys-status-chk:checked')).map(cb => cb.value);

  let filtered = allAnomalies.filter(a => {
    let pass = true;
    
    // 1. Search filter
    const variations = (a.nik && a.nik !== '-') ? (allAliasesMap[a.nik] ? Array.from(allAliasesMap[a.nik]) : [a.name]) : [a.name];
    if (q) pass = pass && (variations.some(v => v.toLowerCase().includes(q)) || (a.nik && a.nik.toLowerCase().includes(q)));
    
    // 2. Status filter (Manual Review)
    if (s) { // s is filterStatus
      if (s === 'SALAH INPUT') {
        pass = pass && (a.status === 'SALAH INPUT' || (a.originalName && a.originalName !== a.name));
      } else {
        pass = pass && a.status === s;
      }
    }

    // 2.5 System Status Filter (Checkboxes)
    const isKoreksi = (a.status === 'SALAH INPUT' || (a.originalName && a.originalName !== a.name));
    
    if (s === 'SALAH INPUT') {
      // Bypass checkbox filter if dropdown is set to 'SALAH INPUT'
    } else if (checkedStatuses.length > 0) {
      pass = pass && checkedStatuses.includes(a.systemStatus);
    } else {
      // If no checkboxes are checked and not filtering for 'SALAH INPUT', export nothing.
      // This is intentional for export to avoid exporting the whole list by accident.
      pass = false;
    }

    // 3. Repeat filter
    if (filterRepeat === 'repeat') {
      const id = a.nik && a.nik !== '-' ? a.nik : a.name;
      pass = pass && frequencyMap[id] > 1;
    }

    // 3.5. Employee Status Filter
    if (filterEmpStatus !== 'all') {
      const id = a.nik && a.nik !== '-' ? a.nik : a.name;
      const status = allEmployeesStatus[id] || { isActive: false };
      if (filterEmpStatus === 'on') pass = pass && status.isActive;
      if (filterEmpStatus === 'off') pass = pass && !status.isActive;
    }
    
    // 4. Date filter (Custom Mode)
    if (mode === 'custom' && a.date) {
      if (startMonth) {
        const [sy, sm] = startMonth.split('-').map(Number);
        const startDate = new Date(sy, sm, 1);
        pass = pass && a.date >= startDate;
      }
      if (endMonth) {
        const [ey, em] = endMonth.split('-').map(Number);
        const endDate = new Date(ey, em + 1, 0, 23, 59, 59);
        pass = pass && a.date <= endDate;
      }
    }
    
    return pass;
  });

  if (filtered.length === 0) {
    toast('Tidak ada data transaksi meragukan untuk diekspor', 'error');
    return;
  }

  const exportData = filtered.map((a, i) => {
    const emp = allEmployees.find(e => (e.nik && e.nik === a.nik) || e.name === a.name);
    const aliases = emp ? emp.variations.filter(v => v !== a.name).join(', ') : '-';

    return {
      No: i + 1,
      Tanggal: a.dateStr,
      Karyawan: a.name,
      Alias: aliases,
      'Nominal Penarikan': a.nominal,
      'Saldo Sebelum': a.balanceBefore,
      'Selisih': a.initialDebt,
      'Sisa Hutang': a.remainingDebt,
      'Status Sistem': a.systemStatus,
      'Status Review': a.status,
      'Review Notes': a.notes,
      'Reviewer': a.reviewer,
      'Update Terakhir': a.reviewTime ? new Date(a.reviewTime).toLocaleString('id-ID') : '-',
      'Nama Koreksi': a.correctName || '-',
      'NIK Koreksi': a.correctNik || '-'
    };
  });

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data Transaksi Meragukan");

  let statusSuffix = s ? `_${s.replace(/\s+/g, '_')}` : "_Semua_Status";
  const filename = `Data_Transaksi_Meragukan${statusSuffix}_${new Date().toISOString
    ().split('T')[0]}.xlsx`;

  XLSX.writeFile(wb, filename);
  toast('Data transaksi meragukan berhasil didownload', 'success');
}

window.exportEmployeeData = function() {
  if (!currentEmpData.name) return;
  
  const name = currentEmpData.name;
  const filterMode = document.getElementById('empFilterMode')?.value || 'custom';
  const filterYear = document.getElementById('empFilterYear')?.value || '';

  // 1. Get History Data from the table rows
  const historyRows = Array.from(document.querySelectorAll('#empTable tbody tr')).map(tr => {
    const tds = tr.querySelectorAll('td');
    if (tds.length < 8) return null; // Skip empty/invalid rows
    const isSuspicious = tr.innerHTML.includes('fa-exclamation-triangle') || tr.innerHTML.includes('Meragukan');
    const isTerbukti = tr.innerHTML.includes('fa-exclamation-circle') || tr.innerHTML.includes('Terbukti');
    let statusText = 'Tidak';
    if (isSuspicious || isTerbukti) statusText = 'Ya';
    
    return {
      No: tds[0].innerText.trim(),
      Tanggal: tds[1].innerText.replace('DIEDIT', '').trim(),
      'Nama Record': tds[2].innerText.trim(),
      Keterangan: tds[3].innerText.replace('Bukti', '').trim(),
      Nominal: tds[4].innerText.trim(),
      Tipe: tds[5].innerText.trim(),
      'Bunga bulan sebelumnya': tds[6].innerText.trim(),
      'Kumulatif (+BUNGA)': tds[7].innerText.trim(),
      'Transaksi Meragukan': statusText
    };
  }).filter(Boolean);

  if (historyRows.length === 0) {
    toast('Tidak ada data yang ditampilkan untuk didownload', 'error');
    return;
  }

  const wb = XLSX.utils.book_new();
  
  // Sheet 1: History
  const wsHistory = XLSX.utils.json_to_sheet(historyRows);
  XLSX.utils.book_append_sheet(wb, wsHistory, "Riwayat Transaksi");

  // 2. If Monthly mode, export Recap too
  if (filterMode === 'monthly') {
    const recapRows = Array.from(document.querySelectorAll('#empRecapTable tbody tr')).map(tr => {
      const tds = tr.querySelectorAll('td');
      if (tds.length < 5) return null;
      return {
        Bulan: tds[0].innerText.trim(),
        Setoran: tds[1].innerText.trim(),
        Penarikan: tds[2].innerText.trim(),
        'Bunga bulan sebelumnya': tds[3].innerText.trim(),
        'Saldo Akhir': tds[4].innerText.trim()
      };
    }).filter(Boolean);
    const wsRecap = XLSX.utils.json_to_sheet(recapRows);
    XLSX.utils.book_append_sheet(wb, wsRecap, "Rekap Bulanan " + filterYear);
  }

  const filename = `Laporan_Investasi_${name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
  toast('Laporan investasi berhasil didownload', 'success');
};

// Event Listeners for Anomali Filters
['anomaliSearch', 'anomaliFilterMode', 'anomaliFilterStartMonth', 'anomaliFilterEndMonth', 'anomaliStatusFilter', 'anomaliRepeatFilter', 'anomaliFilterYear', 'anomaliEmpStatusFilter'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener(id === 'anomaliSearch' ? 'input' : 'change', () => {
      if (id === 'anomaliFilterMode') {
        const mode = el.value;
        const customGrp = document.getElementById('anomaliFilterCustomGroup');
        const yearGrp = document.getElementById('anomaliFilterYearGroup');
        if (mode === 'monthly') {
          if (customGrp) customGrp.classList.add('hidden');
          if (yearGrp) yearGrp.classList.remove('hidden');
        } else {
          if (customGrp) customGrp.classList.remove('hidden');
          if (yearGrp) yearGrp.classList.add('hidden');
        }
        document.querySelectorAll('#anomaliModeFilterBtns button').forEach(b => {
          b.classList.toggle('active', b.dataset.mode === mode);
        });
      }
      renderAnomaliTable();
    });
  }
});

// Sync anomaliModeFilterBtns
const anomModeBtns = document.querySelectorAll('#anomaliModeFilterBtns button');
const anomFilterMode = document.getElementById('anomaliFilterMode');
anomModeBtns.forEach(btn => {
  btn.onclick = () => {
    anomModeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (anomFilterMode) {
      anomFilterMode.value = btn.dataset.mode;
      anomFilterMode.dispatchEvent(new Event('change'));
    }
  };
});

// Clear Anomali Filter
const btnClearAnomaliFilter = document.getElementById('btnClearAnomaliFilter');
if (btnClearAnomaliFilter) {
  btnClearAnomaliFilter.onclick = () => {
    document.getElementById('anomaliSearch').value = '';
    document.getElementById('anomaliFilterStartMonth').value = '';
    document.getElementById('anomaliFilterEndMonth').value = '';
    document.getElementById('anomaliStatusFilter').value = '';
    document.getElementById('anomaliRepeatFilter').value = 'all';
    const empStatusEl = document.getElementById('anomaliEmpStatusFilter');
    if (empStatusEl) empStatusEl.value = 'all';
    
    document.querySelectorAll('.sys-status-chk').forEach(chk => {
      chk.checked = (chk.value === 'MENCURIGAKAN' || chk.value === 'DICICIL');
    });

    if (anomFilterMode) {
      anomFilterMode.value = 'custom';
      anomFilterMode.dispatchEvent(new Event('change'));
    } else {
      renderAnomaliTable();
    }
  };
}

// Checkbox Listeners
document.querySelectorAll('.sys-status-chk').forEach(chk => {
  chk.addEventListener('change', () => {
    renderAnomaliTable();
  });
});
