const API_URL = '/api/sheets';
const INTEREST_RATE = 0.03;
let allData = [], globalFilteredData = [], charts = {}, txPage = 1, txPerPage = 20, txSort = { col: null, asc: true }, allAnomalies = [], allReviews = [], allEmployees = [], anomaliSort = { col: 0, asc: false }, globalTotalSaldo = 0, globalTotalActive = 0, allEmployeesStatus = {};
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

  // Guest Restrictions: No Download, No Email Input
  const exportBtn = document.getElementById('btnExportExcel');
  const emailContainer = document.getElementById('reviewerEmailContainer');

  if (exportBtn) {
    if (isAdmin) exportBtn.classList.remove('hidden');
    else exportBtn.classList.add('hidden');
  }

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

  document.getElementById('btnGuestLogin').addEventListener('click', () => {
    currentUser = { role: 'guest', name: 'Tamu' };
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    overlay.classList.add('hidden');
    applyAccessControl();
    fetchData();
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
        toast(res.error || 'Email atau Password salah!', 'error');
      }
    } catch (err) {
      toast('Gagal login: ' + err.message, 'error');
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

// ===== FETCH DATA DARI API SERVERLESS =====
async function fetchData() {
  try {
    const r = await fetch(API_URL);
    const json = await r.json();
    if (!json.success) {
      const msg = json.message || json.error || 'API error';
      const detail = json.detail ? ` - ${JSON.stringify(json.detail)}` : '';
      throw new Error(msg + detail);
    }

    // Fetch Review Logs
    try {
      const rRev = await fetch(API_URL + '?type=review');
      const jsonRev = await rRev.json();
      if (jsonRev.success) allReviews = jsonRev.data || [];
    } catch (e) {
      console.warn('Gagal memuat review logs:', e);
    }
    allData = json.data.map((row, i) => {
      const d = parseDateStr(row.bulanTahun);
      const ket = (row.keterangan || '').toLowerCase();
      return {
        sheetRow: row.sheetRow,
        no: row.no || i + 1,
        date: d,
        dateStr: fmtDate(d),
        name: String(row.karyawan || '').trim(),
        jenis: row.jenisPotongan,
        nominal: row.nominal,
        nik: String(row.nik || '').trim(),
        keterangan: ket,
        type: (ket.includes('debet') || ket.includes('penarikan')) ? 'Penarikan' : 'Tabungan',
        isEdited: row.isEdited,
        notes: row.notes || ''
      };
    }).filter(x => x && x.name);

    // Normalisasi Nama dihapus agar semua variasi nama muncul di daftar
    allData.sort((a, b) => (a.date || 0) - (b.date || 0));
    globalFilteredData = [...allData];
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

    initGlobalFilter();
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
  calculateAnomalies();
  renderSummary(); renderMiniInsights(); renderTrendChart(); renderCashFlowChart(); renderDashPieChart(); renderTopInvestors(); renderRecentTable(); renderAnomaliTable();
  if (isFirst) populateMonthFilter();
  renderTxTable(); initSearch(); initAnalytics();
  
  // Initialize Autocompletes for all relevant modals
  setupAutocomplete('editTxName', 'editTxNameResults', 'editTxName', 'editTxNik');
  setupAutocomplete('editTxNik', 'editTxNikResults', 'editTxName', 'editTxNik');
  setupAutocomplete('correctName', 'correctNameResults', 'correctName', 'correctNik');
  setupAutocomplete('correctNik', 'correctNikResults', 'correctName', 'correctNik');
  
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

    // Modal Review Events
    const btnCloseModal = document.getElementById('btnCloseModal');
    const btnCancelReview = document.getElementById('btnCancelReview');
    const btnSaveReview = document.getElementById('btnSaveReview');
    if (btnCloseModal) btnCloseModal.addEventListener('click', closeReviewModal);
    if (btnCancelReview) btnCancelReview.addEventListener('click', closeReviewModal);
    if (btnSaveReview) btnSaveReview.addEventListener('click', saveReview);

    // Toggle Correction Fields based on Status Selection
    const statusOptions = document.getElementsByName('reviewStatus');
    statusOptions.forEach(opt => {
      opt.addEventListener('change', () => {
        const cf = document.getElementById('correctionFields');
        if (opt.value === 'Salah Orang') cf.classList.remove('hidden');
        else cf.classList.add('hidden');
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

// ===== SUMMARY CARDS =====
function renderSummary() {
  const emps = {}; let totalIn = 0, totalOut = 0;

  // Deteksi bulan terakhir berdasarkan filter yang aktif
  const filteredWithDates = globalFilteredData.filter(d => d.date);
  if (filteredWithDates.length === 0) return;

  // Prioritas mencari bulan dari transaksi 'Setoran' (Tabungan)
  const setoranDates = filteredWithDates.filter(d => d.type === 'Tabungan').map(d => d.date);
  let latestDate;
  if (setoranDates.length > 0) {
    // Optimasi: Hindari spread operator (...) pada array besar karena bisa crash
    latestDate = new Date(setoranDates.reduce((max, d) => (d > max ? d : max), setoranDates[0]));
  } else {
    latestDate = new Date(filteredWithDates.reduce((max, d) => (d.date > max ? d.date : max), filteredWithDates[0].date));
  }

  const cm = latestDate.getMonth(), cy = latestDate.getFullYear();
  const currentMonthLabel = `${monthNames[cm]} ${cy}`;

  let lm = cm - 1, ly = cy;
  if (lm < 0) { lm = 11; ly--; }
  const lastMonthLabel = `${monthNames[lm]} ${ly}`;

  let monthIn = 0, monthOut = 0;
  let lastMonthIn = 0, lastMonthOut = 0;

  globalFilteredData.forEach(d => {
    const id = getEmpId(d);
    if (!emps[id]) emps[id] = 0;
    const isThisMonth = d.date && d.date.getMonth() === cm && d.date.getFullYear() === cy;
    const isLastMonth = d.date && d.date.getMonth() === lm && d.date.getFullYear() === ly;

    if (d.type === 'Tabungan') {
      totalIn += d.nominal;
      emps[id] += d.nominal;
      if (isThisMonth) monthIn += d.nominal;
      if (isLastMonth) lastMonthIn += d.nominal;
    } else {
      totalOut += d.nominal;
      emps[id] -= d.nominal;
      if (isThisMonth) monthOut += d.nominal;
      if (isLastMonth) lastMonthOut += d.nominal;
    }
  });

  // Gunakan total yang sudah dihitung di calculateAnomalies (termasuk bunga)
  const total = typeof globalTotalSaldo !== 'undefined' ? globalTotalSaldo : (totalIn - totalOut);



  const netFlow = monthIn - monthOut;
  const lastNetFlow = lastMonthIn - lastMonthOut;

  const getGrowthHtml = (curr, last) => {
    if (last === 0) return curr > 0 ? `<span class="positive" style="font-weight:600;"><i class="fas fa-arrow-up"></i> +100%</span>` : `<span style="color:#64748b">-</span>`;
    const pct = ((curr - last) / last * 100).toFixed(1);
    if (pct > 0) return `<span class="positive" style="font-weight:600;"><i class="fas fa-arrow-up"></i> +${pct}%</span>`;
    if (pct < 0) return `<span class="negative" style="font-weight:600;"><i class="fas fa-arrow-down"></i> ${pct}%</span>`;
    return `<span style="color:#64748b; font-weight:600;">0%</span>`;
  };

  const getFlowGrowthHtml = (curr, last) => {
    if (curr > last) return `<span class="positive" style="font-weight:600;"><i class="fas fa-arrow-up"></i> Naik dr bln lalu</span>`;
    if (curr < last) return `<span class="negative" style="font-weight:600;"><i class="fas fa-arrow-down"></i> Turun dr bln lalu</span>`;
    return `<span style="color:#64748b; font-weight:600;">Stabil</span>`;
  };

  const netFlowCls = netFlow >= 0 ? 'positive' : 'negative';
  const netFlowIcon = netFlow >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';

  const totalPrincipal = allData.reduce((sum, d) => sum + (d.type === 'Tabungan' ? d.nominal : -d.nominal), 0);

  const cards = [
    { 
      icon: 'fas fa-wallet', 
      cls: 'blue', 
      label: 'Total Saldo Saat Ini <br><span style="font-size:0.7rem; font-weight:normal; opacity:0.8; text-transform: none;">dengan bunga sebesar 3% per tahun</span>', 
      value: fmt(total), 
      sub: `${getFlowGrowthHtml(total, total - netFlow)} <span style="margin-left:4px; font-size:0.75rem;">(MoM)</span>` 
    },
    { 
      icon: 'fas fa-coins', 
      cls: 'indigo', 
      label: 'Modal Pokok Saat Ini', 
      value: fmt(totalPrincipal), 
      sub: 'Akumulasi Setoran - Penarikan' 
    },
    { icon: 'fas fa-arrow-down', cls: 'green', label: `Setoran (${currentMonthLabel})`, value: fmt(monthIn), sub: `${getGrowthHtml(monthIn, lastMonthIn)} vs bln lalu` },
    { icon: 'fas fa-arrow-up', cls: 'red', label: `Penarikan (${currentMonthLabel})`, value: fmt(monthOut), sub: `${getGrowthHtml(monthOut, lastMonthOut)} vs bln lalu` },
    { icon: 'fas fa-exchange-alt', cls: 'cyan', label: `Arus Kas (${currentMonthLabel})`, value: fmt(netFlow), sub: `<span class="${netFlowCls}" style="font-weight:600;"><i class="fas ${netFlowIcon}"></i> ${netFlow >= 0 ? 'Surplus' : 'Defisit'}</span>` },
    { icon: 'fas fa-users', cls: 'purple', label: 'Karyawan Aktif Berinvestasi', value: globalTotalActive, sub: 'Setoran < 3 bln terakhir' },
    { icon: 'fas fa-exclamation-triangle', cls: 'orange', label: 'Transaksi Mencurigakan', value: allAnomalies.filter(a => a.status === 'In Progress').length, sub: 'Segera Verifikasi' }
  ];
  document.getElementById('summaryCards').innerHTML = cards.map(c => `<div class="summary-card"><div class="card-icon ${c.cls}"><i class="${c.icon}"></i></div><div class="card-label">${c.label}</div><div class="card-value">${c.value}</div><div class="card-sub" style="margin-top:4px;">${c.sub}</div></div>`).join('');
}

// ===== CHART HELPERS =====
// ECharts doesn't need global chartOpts like Chart.js did, configuration is passed per instance.

// ===== TREND CHART =====
function renderTrendChart() {
  const monthly = {};
  globalFilteredData.forEach(d => { if (!d.date) return; const k = d.date.getFullYear() + '-' + String(d.date.getMonth()).padStart(2, '0'); if (!monthly[k]) monthly[k] = { in: 0, out: 0 }; d.type === 'Tabungan' ? monthly[k].in += d.nominal : monthly[k].out += d.nominal; });
  const keys = Object.keys(monthly).sort(); 
  let acc = 0; 
  let principalAcc = 0;
  const labels = [], dataAcc = [], dataPrincipal = [];
  const monthlyRate = 0.03 / 12;
  let lastDate = null;

  keys.forEach(k => {
    const [y, m] = k.split('-');
    const currentDate = new Date(parseInt(y), parseInt(m), 1);
    
    if (lastDate && currentDate > lastDate && acc > 0) {
      const diff = (currentDate.getFullYear() - lastDate.getFullYear()) * 12 + (currentDate.getMonth() - lastDate.getMonth());
      if (diff > 0) acc += acc * monthlyRate * diff;
    }
    
    acc += (monthly[k].in - monthly[k].out);
    principalAcc += (monthly[k].in - monthly[k].out);
    
    labels.push(monthNames[+m] + ' ' + y);
    dataAcc.push(acc); 
    dataPrincipal.push(principalAcc);
    lastDate = currentDate;
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
        name: 'Saldo Aktif',
        data: dataAcc, type: 'line', smooth: 0.4, symbol: 'circle', symbolSize: 6,
        itemStyle: { color: '#6366f1' }, lineStyle: { width: 3 },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(99, 102, 241, 0.2)' }, { offset: 1, color: 'rgba(99, 102, 241, 0.0)' }]) }
      },
      {
        name: 'Modal (Principal)',
        data: dataPrincipal, type: 'line', smooth: 0.4, symbol: 'none',
        itemStyle: { color: '#10b981' }, lineStyle: { width: 2, type: 'dashed' }
      }
    ]
  });
}

// ===== CASH FLOW CHART =====
function renderCashFlowChart() {
  const monthly = {};
  globalFilteredData.forEach(d => { if (!d.date) return; const k = d.date.getFullYear() + '-' + String(d.date.getMonth()).padStart(2, '0'); if (!monthly[k]) monthly[k] = { in: 0, out: 0 }; d.type === 'Tabungan' ? monthly[k].in += d.nominal : monthly[k].out += d.nominal; });
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

// ===== DASHBOARD PIE CHART =====
function renderDashPieChart() {
  let totalIn = 0, totalOut = 0;
  globalFilteredData.forEach(d => { d.type === 'Tabungan' ? totalIn += d.nominal : totalOut += d.nominal; });

  // Tampilkan akumulasi total: Modal Tersisa, Bunga Tersisa, dan Total Penarikan
  const modalTersisa = Math.max(0, totalIn - totalOut);
  const bungaTersisa = Math.max(0, globalTotalSaldo - modalTersisa);

  const ctx = document.getElementById('dashPieChart');
  if (!ctx) return;
  if (charts.dashPie) charts.dashPie.dispose();
  charts.dashPie = echarts.init(ctx);
  charts.dashPie.setOption({
    tooltip: { trigger: 'item', backgroundColor: 'rgba(15, 23, 42, 0.9)', textStyle: { color: '#fff', fontFamily: 'Inter' }, formatter: (p) => `${p.marker}${p.name}: <br/><span style="margin-left:14px;font-weight:600">${fmt(p.value)}</span>` },
    legend: { bottom: 0, itemGap: 15, textStyle: { fontFamily: 'Inter', color: '#64748b' } },
    series: [{
      type: 'pie', radius: ['45%', '70%'], center: ['50%', '45%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
      label: { show: false, position: 'center' },
      labelLine: { show: false },
      data: [
        { value: modalTersisa, name: 'Modal Pokok (Sisa)', itemStyle: { color: '#4f46e5' } },
        { value: bungaTersisa, name: 'Keuntungan (Sisa)', itemStyle: { color: '#f59e0b' } },
        { value: totalOut, name: 'Total Penarikan', itemStyle: { color: '#ef4444' } }
      ]
    }]
  });
}

// ===== MINI INSIGHTS =====
function renderMiniInsights() {
  const content = document.getElementById('miniInsightsContent');
  if (!content) return;

  const dataWithDates = globalFilteredData.filter(d => d.date);
  if (dataWithDates.length === 0) return;

  const latestDate = new Date(dataWithDates.reduce((max, d) => (d.date > max ? d.date : max), dataWithDates[0].date));
  const cm = latestDate.getMonth(), cy = latestDate.getFullYear();

  let pm = cm - 1, py = cy;
  if (pm < 0) { pm = 11; py--; }

  let currentMonthIn = 0, currentMonthOut = 0;
  let prevMonthIn = 0, prevMonthOut = 0;
  let totalIn = 0, totalOut = 0;
  const emps = {};

  globalFilteredData.forEach(d => {
    if (d.type === 'Tabungan') {
      totalIn += d.nominal;
      if (d.date) {
        if (d.date.getMonth() === cm && d.date.getFullYear() === cy) currentMonthIn += d.nominal;
        if (d.date.getMonth() === pm && d.date.getFullYear() === py) prevMonthIn += d.nominal;
      }
    } else {
      totalOut += d.nominal;
      if (d.date) {
        if (d.date.getMonth() === cm && d.date.getFullYear() === cy) currentMonthOut += d.nominal;
        if (d.date.getMonth() === pm && d.date.getFullYear() === py) prevMonthOut += d.nominal;
      }
    }

    const id = getEmpId(d);
    if (!emps[id]) emps[id] = 0;
    emps[id] += d.type === 'Tabungan' ? d.nominal : -d.nominal;
  });

  const insights = [];

  // Insight 1: Dana vs Prev Month
  if (prevMonthIn > 0) {
    const pct = ((currentMonthIn - prevMonthIn) / prevMonthIn) * 100;
    if (pct > 0) insights.push(`Dana masuk naik <strong style="color:#10b981;">+${pct.toFixed(1)}%</strong> dibanding bulan lalu`);
    else if (pct < 0) insights.push(`Dana masuk turun <strong style="color:#ef4444;">${pct.toFixed(1)}%</strong> dibanding bulan lalu`);
  }

  // Insight 2: Penarikan vs Prev Month
  if (prevMonthOut > 0) {
    const pctOut = ((currentMonthOut - prevMonthOut) / prevMonthOut) * 100;
    if (pctOut > 0) insights.push(`Penarikan naik <strong style="color:#ef4444;">+${pctOut.toFixed(1)}%</strong> dibanding bulan lalu`);
    else if (pctOut < 0) insights.push(`Penarikan turun <strong style="color:#10b981;">${pctOut.toFixed(1)}%</strong> dibanding bulan lalu`);
  } else if (currentMonthOut > 0) {
    insights.push(`Penarikan bulan ini mencapai <strong style="color:#ef4444;">${fmt(currentMonthOut)}</strong>`);
  }

  // Insight 3: Top 5 concentation
  const sortedEmps = Object.values(emps).sort((a, b) => b - a);
  const top5Total = sortedEmps.slice(0, 5).reduce((sum, val) => sum + (val > 0 ? val : 0), 0);
  const overallPositive = sortedEmps.reduce((sum, val) => sum + (val > 0 ? val : 0), 0);
  if (overallPositive > 0) {
    const conc = (top5Total / overallPositive) * 100;
    insights.push(`<strong style="color:#6366f1;">${conc.toFixed(0)}%</strong> dana berasal dari 5 karyawan teratas`);
  }

  container.innerHTML = insights.map(ins => `<div style="background:#f8fafc; border:1px solid #e2e8f0; padding:8px 12px; border-radius:6px; font-size:0.85rem; color:#475569; display:inline-flex; align-items:center; gap:8px;"><i class="fas fa-lightbulb" style="color:#f59e0b;"></i> ${ins}</div>`).join('');
}

// ===== TOP INVESTORS =====
function renderTopInvestors() {
  const emps = {}; globalFilteredData.forEach(d => {
    const id = getEmpId(d);
    if (!emps[id]) emps[id] = { balance: 0, name: d.name };
    emps[id].balance += d.type === 'Tabungan' ? d.nominal : -d.nominal;
  });
  const sorted = Object.entries(emps).sort((a, b) => a[1].balance - b[1].balance).filter(a => a[1].balance > 0);
  const top5 = sorted.slice(-5); // Ascending for horizontal bar

  const totalBalance = sorted.reduce((a, b) => a + b[1].balance, 0);
  const top5Total = top5.reduce((a, b) => a + b[1].balance, 0);
  const concentration = totalBalance > 0 ? (top5Total / totalBalance * 100) : 0;

  let riskColor = '#10b981'; // healthy
  let riskLabel = 'Sehat';
  if (concentration > 30) { riskColor = '#ef4444'; riskLabel = 'Risiko Tinggi'; }
  else if (concentration > 15) { riskColor = '#f59e0b'; riskLabel = 'Risiko Sedang'; }

  const ctx = document.getElementById('topInvestorChart');
  if (!ctx) return;
  if (charts.topInv) charts.topInv.dispose();
  charts.topInv = echarts.init(ctx);
  const bgColors = ['#e5effe', '#ccdefd', '#a6c5f9', '#81a9f4', '#4f46e5'];
  charts.topInv.setOption({
    title: { text: `Konsentrasi Top 5: ${concentration.toFixed(1)}%`, subtext: `Indikator: ${riskLabel}`, subtextStyle: { color: riskColor, fontWeight: 'bold' }, textStyle: { fontSize: 12, color: '#64748b' }, right: 0, top: 0 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: 'rgba(15, 23, 42, 0.9)', textStyle: { color: '#fff', fontFamily: 'Inter' }, formatter: (p) => `<div style="font-weight:600;margin-bottom:4px">${p[0].name}</div><div>${p[0].marker} ${fmt(p[0].value)}</div>` },
    grid: { top: 40, right: 40, bottom: 20, left: 100 },
    xAxis: { type: 'value', show: false },
    yAxis: { type: 'category', data: top5.map(s => s[1].name.length > 15 ? s[1].name.substring(0, 15) + '…' : s[1].name), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#475569', fontFamily: 'Inter', fontSize: 11 } },
    series: [{
      type: 'bar',
      data: top5.map((s, i) => ({ value: s[1].balance, itemStyle: { color: bgColors[i] } })),
      itemStyle: { borderRadius: [0, 6, 6, 0] },
      barWidth: 20,
      label: { show: true, position: 'right', formatter: (p) => (p.value / 1e6).toFixed(1) + 'jt', color: '#64748b', fontSize: 10 }
    }]
  });
}

// ===== RECENT TABLE =====
function renderRecentTable() {
  const sortedGlobal = [...globalFilteredData].filter(d => d.date).sort((a, b) => a.date - b.date);
  let rb = 0;
  const dataWithRb = sortedGlobal.map(d => {
    if (d.type === 'Tabungan') rb += d.nominal; else rb -= d.nominal;
    return { ...d, runBal: rb };
  });

  const recent = dataWithRb.reverse().slice(0, 10);
  document.querySelector('#recentTable tbody').innerHTML = recent.map(d => {
    // Cek apakah transaksi ini ada dalam daftar anomali (mencurigakan)
    const txKey = `anomali_${getEmpId(d)}_${d.date?.getTime() || 0}_${d.nominal}`.replace(/\s+/g, '_');
    const isAnomaly = allAnomalies.some(a => a.txKey === txKey && a.status === 'In Progress');

    const escName = d.name.replace(/'/g, "\\'");
    const empNik = d.nik || '';

    const highlightBg = isAnomaly ? 'background-color: rgba(239, 68, 68, 0.05);' : '';
    const editedBadge = d.isEdited ? `<span class="badge-status" style="font-size: 0.6rem; padding: 1px 4px; margin-left: 6px; background: #fef3c7; color: #b45309; border: 1px solid #fde68a; border-radius: 4px; vertical-align: middle;" title="Catatan: ${d.notes || '-'}">DIEDIT</span>` : '';
    const isAdmin = currentUser && currentUser.role === 'admin';
    const editBtn = isAdmin ? `<button class="btn btn-outline" style="padding: 2px 8px; font-size: 0.7rem; color: #f59e0b; border-color: #f59e0b; margin-right: 4px;" onclick="openEditModal(${d.sheetRow}, '${escName}', ${d.nominal}, '${empNik}', '${d.type}', '${d.dateStr}')"><i class="fas fa-pencil-alt"></i></button>` : '';
    const alertIcon = isAnomaly ? `<i class="fas fa-exclamation-triangle" style="color:#ef4444; margin-right:4px;" title="Transaksi Mencurigakan"></i>` : '';

    return `<tr style="${highlightBg}">
    <td>${alertIcon}${d.dateStr || fmtDate(d.date)}${editedBadge}</td><td>${d.name}</td><td>${d.jenis}</td>
    <td style="font-weight:600">${fmt(d.nominal)}</td>
    <td><span class="badge ${d.type === 'Tabungan' ? 'in' : 'out'}"><i class="fas fa-${d.type === 'Tabungan' ? 'arrow-down' : 'arrow-up'}"></i>${d.type}</span></td>
    <td>
      ${editBtn}
      <button class="btn btn-outline" style="padding: 2px 8px; font-size: 0.7rem;" onclick="goToEmployee('${escName}', '${empNik}')"><i class="fas fa-search"></i> Detail</button>
    </td>
  </tr>`;
  }).join('');
}

// ===== ANOMALI LOGIC =====
function calculateAnomalies() {
  const sortedData = allData.filter(d => d.date);
  const emps = {};
  allAnomalies = [];
  const reviewMap = {};
  if (allReviews && allReviews.length > 0) {
    allReviews.forEach(r => { reviewMap[r.txKey] = r; });
  }

  const monthlyRate = 0.03 / 12; // 0.25% per bulan

  // Group data by employee
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
    let lastDate = null;
    let lastDepositDate = null;

    txs.sort((a, b) => a.date - b.date);

    txs.forEach(t => {
      if (lastDate && t.date > lastDate && balance > 0) {
        const diffMonths = (t.date.getFullYear() - lastDate.getFullYear()) * 12 + (t.date.getMonth() - lastDate.getMonth());
        if (diffMonths > 0) pendingInterest = balance * monthlyRate * diffMonths;
      }

      const balanceBefore = balance;
      if (t.type === 'Tabungan') {
        balance += pendingInterest;
        balance += t.nominal;
        pendingInterest = 0;
        lastDepositDate = t.date;
      } else {
        balance -= t.nominal;
        pendingInterest = 0;
      }

      if (t.type === 'Penarikan' && balance < -10000) {
        const txKey = `anomali_${id}_${t.date?.getTime() || 0}_${t.nominal}`.replace(/\s+/g, '_');
        const review = reviewMap[txKey];
        allAnomalies.push({
          txKey, empId: id, nik: t.nik || '', originalNo: t.sheetRow, date: t.date,
          dateStr: t.dateStr || fmtDate(t.date), name: t.name, nominal: t.nominal,
          balanceBefore, balanceAfter: balance,
          reason: 'Saldo defisit > 10rb', status: review ? review.status : 'In Progress',
          notes: review ? review.notes : '-', reviewer: review ? (review.reviewer || '-') : '-',
          keterangan: t.keterangan || '-', jenis: t.jenis || 'Penarikan'
        });
      }
      lastDate = t.date;
    });

    // Hitung Status Aktif
    let isActive = false;
    if (balance > 1000 && lastDepositDate) {
      const monthsSinceLast = (new Date().getFullYear() - lastDepositDate.getFullYear()) * 12 + (new Date().getMonth() - lastDepositDate.getMonth());
      if (monthsSinceLast <= 3) isActive = true;
    }

    emps[id] = { balance, isActive, lastDepositDate };
  });

  globalTotalSaldo = Object.values(emps).reduce((sum, e) => sum + e.balance, 0);
  globalTotalActive = Object.values(emps).filter(e => e.isActive).length;
  allEmployeesStatus = emps; // Simpan untuk UI


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
          saldoSesudah: a.balanceAfter,
          alasan: a.reason,
          status: a.status === 'Verified' ? 'Terbukti' : (a.status === 'Salah Orang' ? 'Koreksi' : (a.status === 'In Progress' ? 'Masih Progres' : a.status)),
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
  const inputStart = document.getElementById('globalStartDate');
  const inputEnd = document.getElementById('globalEndDate');
  const startDate = inputStart?.value ? new Date(inputStart.value) : null;
  const endDate = inputEnd?.value ? new Date(inputEnd.value) : null;
  if (startDate) startDate.setHours(0, 0, 0, 0);
  if (endDate) endDate.setHours(23, 59, 59, 999);

  let filteredByDate = allAnomalies;
  if (startDate || endDate) {
    filteredByDate = allAnomalies.filter(a => {
      let pass = true;
      if (startDate && a.date) pass = pass && a.date >= startDate;
      if (endDate && a.date) pass = pass && a.date <= endDate;
      return pass;
    });
  }

  if (sumContainer) {
    const totalAnomali = filteredByDate.length;
    // Potensi Kerugian: Status 'In Progress'
    const potensiKerugian = allAnomalies
      .filter(a => a.status === 'In Progress')
      .reduce((sum, a) => sum + (a.balanceAfter < 0 ? Math.abs(a.balanceAfter) : 0), 0);

    // Kerugian Terbukti: Status 'Verified'
    const kerugianTerbukti = allAnomalies
      .filter(a => a.status === 'Verified')
      .reduce((sum, a) => sum + (a.balanceAfter < 0 ? Math.abs(a.balanceAfter) : 0), 0);

    const countVerified = allAnomalies.filter(a => a.status === 'Verified').length;
    const countKoreksi = allAnomalies.filter(a => a.status === 'Salah Orang').length;

    sumContainer.innerHTML = `
      <div class="summary-card"><div class="card-icon red"><i class="fas fa-exclamation-triangle"></i></div><div class="card-label">TRANSAKSI MENCURIGAKAN</div><div class="card-value">${totalAnomali}</div><div class="card-sub">Segera Verifikasi</div></div>
      <div class="summary-card"><div class="card-icon orange"><i class="fas fa-exclamation-circle"></i></div><div class="card-label">Potensi Kerugian</div><div class="card-value" style="color: #f59e0b;">${fmt(potensiKerugian)}</div><div class="card-sub">Status: Masih Progres</div></div>
      <div class="summary-card"><div class="card-icon red"><i class="fas fa-times-circle"></i></div><div class="card-label">Kerugian Terbukti</div><div class="card-value" style="color: #ef4444;">${fmt(kerugianTerbukti)}</div><div class="card-sub">Total Defisit Terkonfirmasi</div></div>
      <div class="summary-card"><div class="card-icon blue"><i class="fas fa-check-double"></i></div><div class="card-label">Transaksi Terbukti</div><div class="card-value">${countVerified}</div><div class="card-sub">Telah diverifikasi salah</div></div>
      <div class="summary-card"><div class="card-icon green"><i class="fas fa-user-check"></i></div><div class="card-label">Koreksi (Salah Orang)</div><div class="card-value">${countKoreksi}</div><div class="card-sub">Berhasil disesuaikan</div></div>
    `;
  }

  const tbody = document.querySelector('#anomaliTable tbody');
  if (!tbody) return;

  const q = (document.getElementById('anomaliSearch')?.value || '').toLowerCase().trim();
  const s = document.getElementById('topAnomaliStatusFilter')?.value || '';

  let filtered = filteredByDate.filter(a => {
    const id = (a.nik && a.nik !== '-') ? a.nik : a.name;
    const variations = allAliasesMap[id] ? Array.from(allAliasesMap[id]) : [a.name];
    const matchSearch = variations.some(v => v.toLowerCase().includes(q)) || (a.nik && a.nik.toLowerCase().includes(q));
    const matchStatus = s ? a.status === s : true;
    return matchSearch && matchStatus;
  });

  // Sorting
  filtered.sort((a, b) => {
    let v1, v2;
    switch (anomaliSort.col) {
      case 0: v1 = a.date || 0; v2 = b.date || 0; break;
      case 1: v1 = a.name; v2 = b.name; break;
      case 2: v1 = a.nominal; v2 = b.nominal; break;
      case 3: v1 = a.balanceBefore; v2 = b.balanceBefore; break;
      case 4: v1 = a.balanceAfter; v2 = b.balanceAfter; break;
      default: return 0;
    }
    if (v1 < v2) return anomaliSort.asc ? -1 : 1;
    if (v1 > v2) return anomaliSort.asc ? 1 : -1;
    return 0;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 20px; color: #10b981;"><i class="fas fa-check-circle"></i> Tidak ada transaksi mencurigakan terdeteksi.</td></tr>`;
  } else {
    tbody.innerHTML = filtered.map(a => {
      let statusClass = 'status-progress'; // default
      if (a.status === 'In Progress') statusClass = 'status-progress';
      if (a.status === 'Verified') statusClass = 'status-verified';
      if (a.status === 'Salah Orang') statusClass = 'status-flagged';

      const statusLabel = a.status === 'Verified' ? 'Terbukti' : (a.status === 'Salah Orang' ? 'Koreksi' : (a.status === 'In Progress' ? 'Masih Progres' : a.status));

      let noteContent = a.notes;
      if (a.status === 'Salah Orang' && (a.correctName || a.correctNik)) {
        noteContent = `[Koreksi: ${a.correctName || '-'} / ${a.correctNik || '-'}] ${a.notes !== '-' ? a.notes : ''}`;
      }

      const isAdmin = currentUser && currentUser.role === 'admin';
      const reviewBtn = isAdmin ? `<button class="btn btn-primary" style="padding: 4px 8px; font-size: 0.75rem;" onclick="openReviewModal('${a.txKey}')"><i class="fas fa-edit"></i> Review</button>` : '';

      const escName = a.name.replace(/'/g, "\\'");
      const empNik = a.nik || '';

      return `
        <tr style="background-color: rgba(239, 68, 68, 0.02);">
          <td>${a.dateStr}</td>
          <td style="font-weight: 500;">${a.name}</td>
          <td style="font-weight:600; color:#ef4444;">${fmt(a.nominal)}</td>
          <td style="font-weight:500; color:#64748b;">${fmt(a.balanceBefore)}</td>
          <td style="font-weight:600; color:${a.balanceAfter < 0 ? '#ef4444' : '#64748b'};">${fmt(a.balanceAfter)}</td>
          <td><span class="badge out" style="font-size: 0.7rem;">${a.reason}</span></td>
          <td><span class="badge-status ${statusClass}">${statusLabel}</span></td>
          <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.85rem;" title="${noteContent}">${noteContent}</td>
          <td style="font-size: 0.8rem; color: #64748b;">${a.reviewer}</td>
          <td style="display: flex; gap: 4px;">
            ${reviewBtn}
            <button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem;" onclick="goToEmployee('${escName}', '${empNik}')"><i class="fas fa-search"></i> Detail</button>
          </td>
        </tr>
      `;
    }).join('');
  }
}

// ===== REVIEW MODAL FUNCTIONS =====
let currentReviewTxKey = null;

window.openReviewModal = function (txKey) {
  currentReviewTxKey = txKey;
  const anomali = allAnomalies.find(a => a.txKey === txKey);
  if (!anomali) return;

  const info = document.getElementById('reviewTxInfo');
  info.innerHTML = `
    <div class="info-row"><span class="info-label">Karyawan:</span> <span class="info-value">${anomali.name}</span></div>
    <div class="info-row"><span class="info-label">Tanggal:</span> <span class="info-value">${anomali.dateStr}</span></div>
    <div class="info-row"><span class="info-label">Nominal:</span> <span class="info-value" style="color:#ef4444">${fmt(anomali.nominal)}</span></div>
    <div class="info-row"><span class="info-label">Alasan:</span> <span class="info-value">${anomali.reason}</span></div>
    ${anomali.reviewTime ? `<div class="info-row" style="margin-top:8px; font-style:italic; font-size:0.75rem; color:#94a3b8;"><span class="info-label">Terakhir diupdate:</span> <span>${new Date(anomali.reviewTime).toLocaleString('id-ID')} oleh ${anomali.reviewer}</span></div>` : ''}
  `;

  // Set current values
  const radios = document.getElementsByName('reviewStatus');
  let currentStatus = anomali.status;
  radios.forEach(r => { if (r.value === currentStatus) r.checked = true; });

  // Correction fields
  const cf = document.getElementById('correctionFields');
  if (currentStatus === 'Salah Orang') {
    cf.classList.remove('hidden');
    document.getElementById('correctName').value = anomali.correctName || '';
    document.getElementById('correctNik').value = anomali.correctNik || '';
  } else {
    cf.classList.add('hidden');
    document.getElementById('correctName').value = '';
    document.getElementById('correctNik').value = '';
  }

  document.getElementById('reviewNotes').value = anomali.notes === '-' ? '' : anomali.notes;

  document.getElementById('modalReview').classList.remove('hidden');
};

window.closeReviewModal = function () {
  document.getElementById('modalReview').classList.add('hidden');
  currentReviewTxKey = null;
};

async function saveReview() {
  if (!currentReviewTxKey) return;

  const status = document.querySelector('input[name="reviewStatus"]:checked')?.value || 'In Progress';
  const notes = document.getElementById('reviewNotes').value.trim() || 'No notes added';
  const reviewer = document.getElementById('reviewerEmail').value.trim() || 'anonymous@moneybox.com';

  const correctName = document.getElementById('correctName').value.trim();
  const correctNik = document.getElementById('correctNik').value.trim();

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
        }
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

      if (status === 'Salah Orang' && (correctName || correctNik)) {
        // Update main transaction row
        fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'updateRow',
            updateData: {
              rowNo: anomali.originalNo,
              name: correctName || anomali.name,
              nik: correctNik || ''
            }
          })
        }).catch(e => console.error('Gagal update row:', e));
      }

      toast('Status review berhasil disimpan!', 'success');
      closeReviewModal();
      fetchData(); // Reload all data to catch the name/nik updates and sync anomalies correctly
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

// ===== GLOBAL FILTER & EXPORT =====
function initGlobalFilter() {
  const inputStart = document.getElementById('globalStartDate');
  const inputEnd = document.getElementById('globalEndDate');
  const selectType = document.getElementById('globalTypeFilter');
  const btnExport = document.getElementById('btnExportExcel');

  if (!inputStart || !inputEnd || !selectType) return;

  function applyFilter() {
    const startVal = inputStart.value;
    const endVal = inputEnd.value;
    const typeVal = selectType.value;

    let startDate = startVal ? new Date(startVal) : null;
    let endDate = endVal ? new Date(endVal) : null;

    if (endDate) endDate.setHours(23, 59, 59, 999);
    if (startDate) startDate.setHours(0, 0, 0, 0);

    globalFilteredData = allData.filter(d => {
      let pass = true;
      if (startDate && d.date) pass = pass && d.date >= startDate;
      if (endDate && d.date) pass = pass && d.date <= endDate;
      if (typeVal) pass = pass && d.type === typeVal;
      return pass;
    });

    txPage = 1;
    initDashboard(false);
  }

  const btnApply = document.getElementById('btnApplyFilter');
  if (btnApply) btnApply.addEventListener('click', applyFilter);

  if (btnExport) {
    btnExport.addEventListener('click', () => {
      const activePage = document.querySelector('.page.active')?.id;
      if (activePage === 'page-anomali') {
        exportAnomaliData();
        return;
      }
      
      if (activePage === 'page-transaksi') {
        const txData = getFilteredTx();
        if (txData.length === 0) {
          toast('Tidak ada data transaksi untuk di-export', 'error');
          return;
        }
        const exportData = txData.map((d, i) => ({
          No: i + 1,
          Tanggal: d.dateStr || fmtDate(d.date),
          Karyawan: d.name,
          'Jenis Potongan': d.jenis,
          Nominal: d.nominal,
          Tipe: d.type,
          Keterangan: d.keterangan
        }));
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Transaksi");
        XLSX.writeFile(wb, `Export_Transaksi_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast('Data transaksi berhasil di-export', 'success');
        return;
      }

      // 2. Check if we are on Employee Detail Page
      const isEmpDetailOpen = !document.getElementById('employeeDetail')?.classList.contains('hidden');
      if (isEmpDetailOpen && currentEmpData.name) {
        exportSingleEmployeeData();
        return;
      }

      // 3. General Export (Filtered Data)
      if (globalFilteredData.length === 0) {
        toast('Tidak ada data untuk di-export', 'error');
        return;
      }
      const exportData = globalFilteredData.map((d, i) => ({
        No: i + 1,
        Tanggal: d.dateStr || fmtDate(d.date),
        Karyawan: d.name,
        'Jenis Potongan': d.jenis,
        Nominal: d.nominal,
        Tipe: d.type,
        Keterangan: d.keterangan,
        Status: d.isEdited ? 'DIEDIT' : ''
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Data Investasi");

      let nameParts = [];
      if (inputStart.value) nameParts.push("Dari_" + inputStart.value);
      if (inputEnd.value) nameParts.push("Sampai_" + inputEnd.value);
      if (selectType.value) nameParts.push(selectType.value);

      let suffix = nameParts.length > 0 ? nameParts.join("_") : "Semua_Waktu";
      const filename = `Export_Data_${suffix}.xlsx`;

      XLSX.writeFile(wb, filename);
      toast('File berhasil didownload', 'success');
    });
  }
}

// Function to export only ONE employee
function exportSingleEmployeeData() {
  if (!currentEmpData.name) return;

  const name = currentEmpData.name;
  const nik = currentEmpData.nik;

  // Filter data specifically for this person (NIK first, then Name)
  let empTxs = [];
  if (nik && nik !== '-') {
    empTxs = allData.filter(d => d.nik === nik);
  } else {
    empTxs = allData.filter(d => d.name === name);
  }

  if (empTxs.length === 0) {
    toast('Tidak ada data transaksi untuk karyawan ini', 'error');
    return;
  }

  // Sort chronological for report
  empTxs.sort((a, b) => (a.date || 0) - (b.date || 0));

  const exportData = empTxs.map((d, i) => ({
    No: i + 1,
    Tanggal: d.dateStr || fmtDate(d.date),
    Keterangan: d.jenis || d.keterangan,
    Nominal: d.nominal,
    Tipe: d.type,
    NIK: d.nik || '-'
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Riwayat_" + name.replace(/\s+/g, '_'));

  const filename = `Laporan_Investasi_${name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
  toast(`Riwayat ${name} berhasil didownload`, 'success');
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
  
  if (!selStart || !selEnd) return;

  if (!minMonth) {
    const startOptions = monthList.map(m => { 
      const [y, mo] = m.split('-'); 
      return `<option value="${m}">${monthNames[+mo]} ${y}</option>`; 
    }).join('');
    selStart.innerHTML = '<option value="">Semua Bulan</option>' + startOptions;
  }

  const filteredMonthList = minMonth ? monthList.filter(m => m >= minMonth) : monthList;
  const endOptions = filteredMonthList.map(m => { 
    const [y, mo] = m.split('-'); 
    return `<option value="${m}">${monthNames[+mo]} ${y}</option>`; 
  }).join('');

  const currentEndVal = selEnd.value;
  selEnd.innerHTML = '<option value="">s/d (Opsional)</option>' + endOptions;
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
  if (type) data = data.filter(d => d.type === type);
  
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

  if (txSort.col !== null) {
    data.sort((a, b) => {
      let va, vb; switch (txSort.col) { case 0: va = a.no; vb = b.no; break; case 1: va = a.date || 0; vb = b.date || 0; break; case 2: va = a.name; vb = b.name; break; case 4: va = a.nominal; vb = b.nominal; break; default: return 0; }
      if (va < vb) return txSort.asc ? -1 : 1; if (va > vb) return txSort.asc ? 1 : -1; return 0;
    });
  }
  return data;
}

function renderTxTable() {
  const data = getFilteredTx(); const total = data.length; const pages = Math.ceil(total / txPerPage) || 1;

  // Hitung ringkasan uang masuk/keluar dari data yang terfilter
  let totalIn = 0, totalOut = 0;
  data.forEach(d => {
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
  const start = (txPage - 1) * txPerPage; const slice = data.slice(start, start + txPerPage);
  document.querySelector('#txTable tbody').innerHTML = slice.map((d, i) => {
    const link = getLinkFromKeterangan(d.keterangan);
    const linkBtn = link ? `<a href="${link}" target="_blank" class="btn-view-tf"><i class="fas fa-external-link-alt"></i> Lihat TF</a>` : '';

    // Cek apakah transaksi ini anomali
    const txKey = `anomali_${getEmpId(d)}_${d.date?.getTime() || 0}_${d.nominal}`.replace(/\s+/g, '_');
    const isSuspicious = allAnomalies.some(a => a.txKey === txKey && a.status === 'In Progress');
    const highlightBg = isSuspicious ? 'background-color: rgba(239, 68, 68, 0.08);' : '';
    const escName = d.name.replace(/'/g, "\\'");
    const empNik = d.nik || '';

    const alertIcon = isSuspicious ? `<i class="fas fa-exclamation-triangle" style="color:#ef4444; margin-right:4px;" title="Transaksi Mencurigakan"></i>` : '';
    const isAdmin = currentUser && currentUser.role === 'admin';
    const editBtn = isAdmin ? `<button class="btn btn-outline" style="padding: 2px 8px; font-size: 0.7rem; color: #f59e0b; border-color: #f59e0b; margin-right: 4px;" onclick="openEditModal(${d.sheetRow}, '${escName}', ${d.nominal}, '${empNik}', '${d.type}', '${d.dateStr}')"><i class="fas fa-pencil-alt"></i></button>` : '';

    const editedBadge = d.isEdited ? `<span class="badge-status" style="font-size: 0.6rem; padding: 1px 4px; margin-left: 6px; background: #fef3c7; color: #b45309; border: 1px solid #fde68a; border-radius: 4px; vertical-align: middle;" title="Catatan: ${d.notes || '-'}">DIEDIT</span>` : '';

    return `<tr style="${highlightBg}">
    <td>${alertIcon}${start + i + 1}</td><td>${d.dateStr || fmtDate(d.date)}</td><td>${d.name}${editedBadge}</td><td>${d.jenis}</td>
    <td style="font-weight:600">${fmt(d.nominal)}</td>
    <td><span class="badge ${d.type === 'Tabungan' ? 'in' : 'out'}">${d.type}</span> ${linkBtn}</td>
    <td>
      ${editBtn}
      <button class="btn btn-outline" style="padding: 2px 8px; font-size: 0.7rem;" onclick="goToEmployee('${escName}', '${empNik}')"><i class="fas fa-search"></i> Detail</button>
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
document.querySelectorAll('#txTable th.sortable').forEach(th => {
  th.addEventListener('click', () => { const c = +th.dataset.col; if (txSort.col === c) txSort.asc = !txSort.asc; else { txSort.col = c; txSort.asc = true; } txPage = 1; renderTxTable(); });
});
['txSearch', 'txFilterType', 'txFilterStartMonth', 'txFilterEndMonth'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener(id === 'txSearch' ? 'input' : 'change', () => { 
      if (id === 'txFilterStartMonth') {
        const startVal = el.value;
        const endEl = document.getElementById('txFilterEndMonth');
        
        // Update pilihan di dropdown Hingga agar tidak lebih kecil dari Mulai
        populateMonthFilter(startVal);
        
        if (startVal && (!endEl.value || endEl.value < startVal)) {
          endEl.value = startVal;
        }
      }
      txPage = 1; 
      renderTxTable(); 
    });
  }
});

// ===== EDIT TRANSACTION MODAL =====
window.openEditModal = function(sheetRow, name, nominal, nik, type, dateStr) {
  document.getElementById('editTxRowNo').value = sheetRow;
  document.getElementById('editTxName').value = name;
  document.getElementById('editTxNominal').value = Math.abs(nominal);
  document.getElementById('editTxNik').value = nik;
  document.getElementById('editTxType').value = type;
  document.getElementById('editTxDate').value = dateStr;
  document.getElementById('editTxPassword').value = ''; // Reset password field
  document.getElementById('editTxNotes').value = ''; // Reset notes field
  document.getElementById('modalEditTx').classList.remove('hidden');
};

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
    const rowNo = parseInt(document.getElementById('editTxRowNo').value);
    const rawDate = document.getElementById('editTxDate').value;
    const dateObj = parseDateStr(rawDate);
    // Kirim format YYYY-MM-DD ke API agar Google Sheets tidak bingung
    const date = dateObj ? `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}` : rawDate;
    
    const name = document.getElementById('editTxName').value;
    const nominal = parseFloat(document.getElementById('editTxNominal').value);
    const nik = document.getElementById('editTxNik').value;
    const type = document.getElementById('editTxType').value;
    const pass = document.getElementById('editTxPassword').value;

    if (!date || !name || isNaN(nominal) || !pass) {
      toast('Harap isi semua data termasuk password konfirmasi!', 'error');
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
          pass, // Send password for verification
          updateData: { rowNo, date, name, nominal, nik, type, notes: document.getElementById('editTxNotes').value }
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

      return `<div class="emp-list-item" data-name="${e.name}">
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
  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    const filtered = empList.filter(e =>
      e.variations.some(v => v.toLowerCase().includes(q)) ||
      (e.nik && e.nik.toLowerCase().includes(q))
    );
    renderList(filtered);
  });

  document.getElementById('btnBackToEmpList').addEventListener('click', () => {
    document.getElementById('employeeDetail').classList.add('hidden');
    document.getElementById('employeeListContainer').classList.remove('hidden');
    input.value = '';
    renderList(empList);
  });
}

function showEmployee(name, nik = '') {
  const detail = document.getElementById('employeeDetail');
  const list = document.getElementById('employeeListContainer');
  if (!detail || !list) return;

  // Prioritas NIK jika ada
  let searchNik = nik;
  if (!searchNik || searchNik === '-') {
    const selectedEmp = allEmployees.find(e => e.name === name);
    if (selectedEmp && selectedEmp.nik && selectedEmp.nik !== '-') {
      searchNik = selectedEmp.nik;
    }
  }

  // Ambil data: Jika ada NIK, ambil semua yang NIK-nya sama. Jika tidak, ambil berdasarkan nama.
  let allTxs = [];
  if (searchNik && searchNik !== '-') {
    allTxs = allData.filter(d => d.nik === searchNik);
  } else {
    allTxs = allData.filter(d => d.name === name);
  }

  list.classList.add('hidden');
  detail.classList.remove('hidden');

  const inputStart = document.getElementById('globalStartDate');
  const inputEnd = document.getElementById('globalEndDate');
  const startDate = inputStart?.value ? new Date(inputStart.value) : null;
  const endDate = inputEnd?.value ? new Date(inputEnd.value) : null;
  if (startDate) startDate.setHours(0, 0, 0, 0);
  if (endDate) endDate.setHours(23, 59, 59, 999);

  let totalIn = 0, totalOut = 0;
  let lifeIn = 0, lifeOut = 0;

  allTxs.forEach(d => {
    d.type === 'Tabungan' ? lifeIn += d.nominal : lifeOut += d.nominal;
    let pass = true;
    if (startDate && d.date) pass = pass && d.date >= startDate;
    if (endDate && d.date) pass = pass && d.date <= endDate;
    if (pass) {
      d.type === 'Tabungan' ? totalIn += d.nominal : totalOut += d.nominal;
    }
  });

  let labels = [];
  let balanceData = [];
  let principalData = [];
  let currentBalance = 0;
  let currentPrincipal = 0;
  let exactBunga = 0;
  let lastContributionDate = null;

  if (allTxs.length > 0) {
    const sortedTxs = [...allTxs].filter(d => d.date).sort((a, b) => a.date - b.date);
    if (sortedTxs.length > 0) {
      let currentDate = new Date(sortedTxs[0].date);
      const today = new Date();
      const dailyRate = INTEREST_RATE / 365;

      const txsByDay = {};
      sortedTxs.forEach(tx => {
        const dStr = tx.date.getFullYear() + '-' + tx.date.getMonth() + '-' + tx.date.getDate();
        if (!txsByDay[dStr]) txsByDay[dStr] = 0;
        txsByDay[dStr] += (tx.type === 'Tabungan' ? tx.nominal : -tx.nominal);
        if (tx.type === 'Tabungan') {
          if (!lastContributionDate || tx.date > lastContributionDate) lastContributionDate = tx.date;
        }
      });

      const lastTxDate = sortedTxs[sortedTxs.length - 1].date;

      // Logika Bunga Majemuk (Hanya cair saat Tabungan)
      const monthlyRate = 0.03 / 12;
      let lastProcessedDate = sortedTxs[0].date;
      let accPrincipal = 0; // Running total for principal

      sortedTxs.forEach(tx => {
        // Hitung bunga tertunda sejak transaksi terakhir
        const diffMonths = (tx.date.getFullYear() - lastProcessedDate.getFullYear()) * 12 + (tx.date.getMonth() - lastProcessedDate.getMonth());
        let pendingInterest = 0;
        if (diffMonths > 0 && currentPrincipal > 0) {
          pendingInterest = currentPrincipal * monthlyRate * diffMonths;
        }

        if (tx.type === 'Tabungan') {
          currentPrincipal += pendingInterest; // Cairkan bunga
          exactBunga += pendingInterest;
          currentPrincipal += tx.nominal;
          accPrincipal += tx.nominal;
        } else {
          // Penarikan: Bunga tertunda hangus/tidak dihitung
          currentPrincipal -= tx.nominal;
          accPrincipal -= tx.nominal;
        }

        // Data untuk Grafik
        labels.push(monthNames[tx.date.getMonth()] + ' ' + tx.date.getFullYear());
        balanceData.push(currentPrincipal);
        principalData.push(accPrincipal);

        lastProcessedDate = tx.date;
      });
    }
  }

  const saldo = currentPrincipal;
  const bunga = exactBunga;
  const principal = lifeIn - lifeOut;
  const roi = principal > 0 ? (bunga / principal) * 100 : 0;

  let monthsFiltered = labels.length > 0 ? labels.length : 1;
  const avgContribution = totalIn / monthsFiltered;

  const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  const empNik = allTxs.length > 0 ? (allTxs[0].nik || '-') : '-';
  const status = allEmployeesStatus[getEmpId({ name, nik })] || { isActive: false };
  const statusLabel = status.isActive ? '<span class="badge-status status-verified">AKTIF</span>' : '<span class="badge-status status-progress">NON-AKTIF</span>';

  const uniqueNames = [...new Set(allTxs.map(d => d.name))];
  const aliases = uniqueNames.filter(n => n.toLowerCase().trim() !== name.toLowerCase().trim());
  const variationsHtml = aliases.length > 0 
    ? `<div style="font-size:0.75rem; color:#64748b; margin-top:2px; font-weight:normal; font-style:italic;">Alias: ${aliases.join(', ')}</div>` 
    : '';

  document.getElementById('empHeader').innerHTML = `
    <div class="emp-avatar">${initials}</div>
    <div>
      <div class="emp-name">${name} ${statusLabel}</div>
      ${variationsHtml}
      <div class="emp-meta" style="margin-top:4px;">NIK: <strong>${empNik}</strong> &bull; ${allTxs.length} transaksi tercatat &bull; Aktif sejak ${allTxs.length > 0 ? fmtDate(allTxs[0].date) : '-'}</div>
    </div>`;

  // SMART ALERTS
  const alerts = [];
  if (lastContributionDate) {
    const monthsSinceLast = (new Date().getFullYear() - lastContributionDate.getFullYear()) * 12 + (new Date().getMonth() - lastContributionDate.getMonth());
    if (monthsSinceLast >= 3) {
      alerts.push(`<div style="background:#fef2f2; color:#b91c1c; padding:10px 14px; border-radius:8px; border:1px solid #fecaca; display:flex; gap:10px; align-items:center; font-weight:500; font-size:0.9rem;"><i class="fas fa-exclamation-triangle"></i> Peringatan: Tidak ada setoran dalam ${monthsSinceLast} bulan terakhir.</div>`);
    }
  }
  if (roi > 5) {
    alerts.push(`<div style="background:#f0fdf4; color:#15803d; padding:10px 14px; border-radius:8px; border:1px solid #bbf7d0; display:flex; gap:10px; align-items:center; font-weight:500; font-size:0.9rem;"><i class="fas fa-trophy"></i> Hebat! Return On Investment (ROI) Anda mencapai performa sangat baik (${roi.toFixed(1)}%).</div>`);
  }

  const smartAlertsEl = document.getElementById('empSmartAlerts');
  if (smartAlertsEl) smartAlertsEl.innerHTML = alerts.join('');

  let saldoAwal = 0;
  if (startDate) {
    let tempBal = 0;
    const sortedAll = [...allTxs].filter(d => d.date).sort((a, b) => a.date - b.date);
    let tempDate = sortedAll.length > 0 ? new Date(sortedAll[0].date) : null;
    const dailyRate = INTEREST_RATE / 365;

    if (tempDate) {
      const txsByDay = {};
      sortedAll.forEach(tx => {
        const dStr = tx.date.getFullYear() + '-' + tx.date.getMonth() + '-' + tx.date.getDate();
        if (!txsByDay[dStr]) txsByDay[dStr] = 0;
        txsByDay[dStr] += (tx.type === 'Tabungan' ? tx.nominal : -tx.nominal);
      });

      while (tempDate < startDate) {
        const dStr = tempDate.getFullYear() + '-' + tempDate.getMonth() + '-' + tempDate.getDate();
        if (txsByDay[dStr]) tempBal += txsByDay[dStr];
        if (tempBal > 0) tempBal += tempBal * dailyRate;
        tempDate.setDate(tempDate.getDate() + 1);
      }
    }
    saldoAwal = Math.round(tempBal);
  }

  const cards = [];
  if (startDate) {
    cards.push({ icon: 'fas fa-history', cls: 'yellow', label: 'Saldo Awal', value: fmt(saldoAwal), sub: `Per ${fmtDate(startDate)}` });
  }
  cards.push({ icon: 'fas fa-wallet', cls: 'blue', label: 'Saldo Akhir', value: fmt(Math.round(saldo)), sub: 'Kumulatif saat ini' });
  cards.push({ icon: 'fas fa-arrow-down', cls: 'green', label: 'Total Setoran', value: fmt(totalIn), sub: startDate ? 'Dalam periode filter' : `Rata-rata: ${fmt(Math.round(avgContribution))}/bln` });
  cards.push({ icon: 'fas fa-arrow-up', cls: 'red', label: 'Total Penarikan', value: fmt(totalOut), sub: startDate ? 'Dalam periode filter' : '' });
  cards.push({ icon: 'fas fa-chart-line', cls: 'purple', label: 'ROI (Return)', value: roi.toFixed(2) + '%', sub: `Est. Keuntungan: ${fmt(Math.round(bunga))}` });

  document.getElementById('empCards').innerHTML = cards.map(c => `<div class="summary-card"><div class="card-icon ${c.cls}"><i class="${c.icon}"></i></div><div class="card-label">${c.label}</div><div class="card-value">${c.value}</div><div class="card-sub" style="margin-top:2px;">${c.sub}</div></div>`).join('');

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
        name: 'Saldo Aktif',
        data: balanceData.map((v, i) => ({ value: v, itemStyle: { color: pointColors[i], borderColor: pointBorderColors[i], borderWidth: 2 } })),
        type: 'line', smooth: 0.3, symbolSize: 6,
        lineStyle: { color: '#4f46e5', width: 2 },
        areaStyle: { color: 'rgba(79,70,229,0.1)' }
      },
      {
        name: 'Modal (Principal)',
        data: principalData,
        type: 'line', smooth: 0.3, symbol: 'none',
        lineStyle: { color: '#10b981', width: 2, type: 'dashed' }
      }
    ]
  });

  // Pie chart
  const ctx2 = document.getElementById('empPieChart');
  if (charts.empPie) charts.empPie.dispose();
  charts.empPie = echarts.init(ctx2);
  charts.empPie.setOption({
    tooltip: { trigger: 'item', backgroundColor: 'rgba(15, 23, 42, 0.9)', textStyle: { color: '#fff', fontFamily: 'Inter' }, formatter: (p) => `${p.marker}${p.name}: <br/><span style="margin-left:14px;font-weight:600">${fmt(p.value)}</span>` },
    legend: { bottom: 0, itemGap: 15, textStyle: { fontFamily: 'Inter', color: '#64748b' } },
    series: [{
      type: 'pie', radius: ['45%', '70%'], center: ['50%', '45%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
      label: { show: false }, labelLine: { show: false },
      data: [
        { value: lifeIn, name: 'Total Setoran (Modal)', itemStyle: { color: '#4f46e5' } },
        { value: bunga, name: 'Total Keuntungan (Return)', itemStyle: { color: '#f59e0b' } }
      ]
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
    sortedTable.forEach(d => {
      // 1. Hitung Bunga Tertunda (Hanya Cair saat Tabungan)
      let currentInterest = 0;
      if (lastTxDateForTable && d.date > lastTxDateForTable && tableRunBal > 0) {
        const diffMonths = (d.date.getFullYear() - lastTxDateForTable.getFullYear()) * 12 + (d.date.getMonth() - lastTxDateForTable.getMonth());
        if (diffMonths > 0) {
          currentInterest = tableRunBal * 0.0025 * diffMonths;
        }
      }

      if (d.type === 'Tabungan') {
        tableRunBal += currentInterest; // Tambah bunga ke saldo
        tableRunBal += d.nominal;
      } else {
        // Penarikan: Tidak tambah bunga
        tableRunBal -= d.nominal;
        currentInterest = 0;
      }

      lastTxDateForTable = d.date;

      let pass = true;
      if (startDate && d.date) pass = pass && d.date >= startDate;
      if (endDate && d.date) pass = pass && d.date <= endDate;

      if (pass) {
        const link = typeof getLinkFromKeterangan === 'function' ? getLinkFromKeterangan(d.keterangan) : null;
        const linkBtn = link ? `<a href="${link}" target="_blank" class="btn-view-tf" style="margin-left:8px; font-size:0.75rem;"><i class="fas fa-external-link-alt"></i> Bukti</a>` : '';

        const txKey = `anomali_${getEmpId(d)}_${d.date?.getTime() || 0}_${d.nominal}`.replace(/\s+/g, '_');
        const isSuspicious = allAnomalies.some(a => a.txKey === txKey && a.status === 'In Progress');
        const highlightBg = isSuspicious ? 'background-color: rgba(239, 68, 68, 0.08);' : '';
        const alertIcon = isSuspicious ? `<i class="fas fa-exclamation-triangle" style="color:#ef4444; margin-right:4px;" title="Transaksi Mencurigakan"></i>` : '';

        // Tampilkan bunga yang cair di baris ini
        const bungaDisplay = currentInterest > 0 ? fmt(currentInterest) : '-';

        tableData.push({
          date: d.date,
          dateStr: d.dateStr || fmtDate(d.date),
          jenis: d.jenis,
          linkBtn,
          nominal: d.nominal,
          type: d.type,
          bunga: currentInterest,
          bungaDisplay,
          balance: tableRunBal,
          highlightBg,
          alertIcon,
          isEdited: d.isEdited,
          sheetRow: d.sheetRow,
          name: d.name,
          nik: d.nik
        });
      }
    });
  }

  // Apply Sorting to tableData
  tableData.sort((a, b) => {
    let v1, v2;
    switch (empTxSort.col) {
      case 0: v1 = a.date || 0; v2 = b.date || 0; break;
      case 2: v1 = a.nominal; v2 = b.nominal; break;
      case 4: v1 = a.bunga; v2 = b.bunga; break;
      case 5: v1 = a.balance; v2 = b.balance; break;
      default: return 0;
    }
    if (v1 < v2) return empTxSort.asc ? -1 : 1;
    if (v1 > v2) return empTxSort.asc ? 1 : -1;
    return 0;
  });

  document.querySelector('#empTable tbody').innerHTML = tableData.map(row => {
    const editedBadge = row.isEdited ? `<span class="badge-status" style="font-size: 0.6rem; padding: 1px 4px; margin-left: 6px; background: #fef3c7; color: #b45309; border: 1px solid #fde68a; border-radius: 4px; vertical-align: middle;" title="Catatan: ${row.notes || '-'}">DIEDIT</span>` : '';
    const isAdmin = currentUser && currentUser.role === 'admin';
    const editBtn = isAdmin ? `<button class="btn btn-outline" style="padding: 2px 8px; font-size: 0.7rem; color: #f59e0b; border-color: #f59e0b; margin-left: 4px;" onclick="openEditModal(${row.sheetRow}, '${row.name.replace(/'/g, "\\'")}', ${row.nominal}, '${row.nik || ''}', '${row.type}', '${row.dateStr}')"><i class="fas fa-pencil-alt"></i></button>` : '';

    return `
    <tr style="${row.highlightBg}">
      <td>${row.alertIcon}${row.dateStr}${editedBadge}</td>
      <td style="font-size: 0.8rem; color: #64748b; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${row.name}">${row.name}</td>
      <td>${row.jenis}${row.linkBtn}</td>
      <td style="font-weight:600">${fmt(row.nominal)}</td>
      <td><span class="badge ${row.type === 'Tabungan' ? 'in' : 'out'}">${row.type}</span></td>
      <td style="color:#f59e0b; font-weight:600;">${row.bungaDisplay}</td>
      <td style="font-weight:700; color:#334155;">${fmt(row.balance)}</td>
      <td>${editBtn}</td>
    </tr>
  `}).join('');

  setTimeout(() => {
    if (charts.emp) charts.emp.resize();
    if (charts.empPie) charts.empPie.resize();
  }, 50);
}

// ===== ANALYTICS =====
function initAnalytics() {
  const container = document.getElementById('analyticsKpis');
  if (!container) return;

  // 1. DATA PREP (Monthly & All Time)
  const monthly = {};
  allData.forEach(d => {
    if (!d.date) return;
    const k = d.date.getFullYear() + '-' + String(d.date.getMonth()).padStart(2, '0');
    if (!monthly[k]) monthly[k] = { in: 0, out: 0, txCount: 0, users: new Set() };
    if (d.type === 'Tabungan') monthly[k].in += d.nominal;
    else monthly[k].out += d.nominal;
    monthly[k].txCount++;
    monthly[k].users.add(d.name);
  });

  const keys = Object.keys(monthly).sort();
  // Gunakan bulan terakhir yang tersedia di data
  const currentMonthKey = keys[keys.length - 1];
  const lastMonthKey = keys[keys.length - 2];

  const cur = monthly[currentMonthKey] || { in: 0, out: 0, users: new Set() };
  const prev = monthly[lastMonthKey] || { in: 0, out: 0, users: new Set() };

  const [cy, cm] = currentMonthKey.split('-');
  const currentMonthLabel = monthNames[parseInt(cm)] + ' ' + cy;

  const totalDana = allData.reduce((acc, d) => acc + (d.type === 'Tabungan' ? d.nominal : -d.nominal), 0);

  // Karyawan Aktif: Pernah menabung dalam 1 tahun terakhir
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const activeEmps = new Set(allData.filter(d => d.type === 'Tabungan' && d.date && d.date >= oneYearAgo).map(d => d.name)).size;

  const netFlow = cur.in - cur.out;
  const totalDanaBefore = totalDana - netFlow;

  // Growth % (Asset Growth MoM) - Lebih stabil dibanding Net Flow Growth
  let growthPct = 0;
  if (totalDanaBefore > 0) growthPct = (netFlow / totalDanaBefore) * 100;

  const totalPenarikan = cur.out;
  const avgInvest = activeEmps > 0 ? totalDana / activeEmps : 0;

  // 2. RENDER KPI CARDS
  const kpis = [
    { label: 'Total Dana Kelolaan', val: fmt(globalTotalSaldo), icon: 'fa-wallet', color: '4f46e5', trend: '', trendVal: '' },
    { label: 'Karyawan Aktif Berinvestasi', val: globalTotalActive, icon: 'fa-users', color: '7c3aed', trend: '', trendVal: 'Setoran < 3 bln' },
    { label: 'Net Cash Flow', val: fmt(netFlow), icon: 'fa-exchange-alt', color: '0ea5e9', trend: netFlow >= 0 ? 'up' : 'down', trendVal: currentMonthLabel },
    { label: 'Growth Bulanan', val: (growthPct >= 0 ? '+' : '') + growthPct.toFixed(2) + '%', icon: 'fa-chart-line', color: '10b981', trend: growthPct >= 0 ? 'up' : 'down', trendVal: 'MoM Asset' },
    { label: 'Total Penarikan', val: fmt(totalPenarikan), icon: 'fa-arrow-up', color: 'ef4444', trend: '', trendVal: currentMonthLabel },
    { label: 'Avg per Karyawan', val: fmt(avgInvest), icon: 'fa-user-tie', color: 'f59e0b', trend: '', trendVal: '' }
  ];

  container.innerHTML = kpis.map(k => `
    <div class="analytics-kpi-card">
      <div class="a-kpi-icon" style="color:#${k.color}"><i class="fas ${k.icon}"></i></div>
      <div class="a-kpi-label">${k.label}</div>
      <div class="a-kpi-value">${k.val}</div>
      ${k.trend ? `<div class="a-kpi-trend ${k.trend}"><i class="fas fa-caret-${k.trend}"></i> ${k.trendVal}</div>` : `<div class="a-kpi-trend" style="color:var(--text-muted)">${k.trendVal}</div>`}
    </div>
  `).join('');

  // 3. CHARTS
  renderAnalyticsAccum(keys, monthly);
  renderAnalyticsTop10();
  renderAnalyticsCashFlow(keys, monthly);
  renderAnalyticsSegment();

  // 4. ALERTS & INSIGHTS
  renderAnalyticsAlerts(cur, currentMonthKey);
  renderAnalyticsInsights(totalDana, activeEmps, cur, prev);
}

function renderAnalyticsAccum(keys, monthly) {
  const ctx = document.getElementById('analyticsAccum');
  if (!ctx) return;
  if (charts.accum) charts.accum.dispose();
  charts.accum = echarts.init(ctx);

  let acc = 0;
  const data = keys.map(k => {
    acc += (monthly[k].in - monthly[k].out);
    return acc;
  });
  const labels = keys.map(k => {
    const [y, m] = k.split('-');
    return monthNames[parseInt(m)] + ' ' + y;
  });

  charts.accum.setOption({
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(15, 23, 42, 0.9)', textStyle: { color: '#fff', fontFamily: 'Inter' } },
    grid: { top: 20, right: 30, bottom: 40, left: 80 },
    xAxis: { type: 'category', data: labels, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#94a3b8' } },
    yAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed', color: '#e2e8f0' } }, axisLabel: { color: '#94a3b8', formatter: v => v >= 1e6 ? (v / 1e6).toFixed(1) + 'jt' : v } },
    series: [{
      data: data, type: 'line', smooth: true, symbolSize: 8,
      itemStyle: { color: '#4f46e5' },
      lineStyle: { width: 4, shadowColor: 'rgba(79, 70, 229, 0.3)', shadowBlur: 10, shadowOffsetY: 5 },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(79, 70, 229, 0.2)' }, { offset: 1, color: 'rgba(79, 70, 229, 0)' }]) }
    }]
  });
}

function renderAnalyticsTop10() {
  const ctx = document.getElementById('analyticsDistrib');
  if (!ctx) return;
  if (charts.distrib) charts.distrib.dispose();
  charts.distrib = echarts.init(ctx);

  const emps = {};
  allData.forEach(d => { if (!emps[d.name]) emps[d.name] = 0; emps[d.name] += (d.type === 'Tabungan' ? d.nominal : -d.nominal); });
  const top10 = Object.entries(emps).sort((a, b) => b[1] - a[1]).slice(0, 10).reverse();

  charts.distrib.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { top: 10, right: 40, bottom: 20, left: 120 },
    xAxis: { type: 'value', splitLine: { show: false }, axisLabel: { show: false } },
    yAxis: { type: 'category', data: top10.map(t => t[0]), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#475569', fontWeight: 600 } },
    series: [{
      data: top10.map(t => t[1]), type: 'bar', barWidth: 18,
      itemStyle: { color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [{ offset: 0, color: '#4f46e5' }, { offset: 1, color: '#818cf8' }]), borderRadius: [0, 10, 10, 0] },
      label: { show: true, position: 'right', formatter: (p) => fmt(p.value), color: '#64748b', fontSize: 10 }
    }]
  });
}

function renderAnalyticsCashFlow(keys, monthly) {
  const ctx = document.getElementById('analyticsCashFlow');
  if (!ctx) return;
  if (charts.cashflow) charts.cashflow.dispose();
  charts.cashflow = echarts.init(ctx);

  const inData = keys.map(k => monthly[k].in);
  const outData = keys.map(k => monthly[k].out);
  const labels = keys.map(k => { const [y, m] = k.split('-'); return monthNames[parseInt(m)].substring(0, 3) + ' ' + y; });

  charts.cashflow.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { bottom: 0, left: 'center', itemGap: 20, icon: 'circle' },
    grid: { top: 30, right: 20, bottom: 60, left: 60 },
    xAxis: { type: 'category', data: labels, axisLine: { show: false }, axisTick: { show: false } },
    yAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed' } }, axisLabel: { formatter: v => v >= 1e6 ? (v / 1e6).toFixed(0) + 'jt' : v } },
    series: [
      { name: 'Setoran', type: 'bar', data: inData, itemStyle: { color: '#10b981', borderRadius: [4, 4, 0, 0] }, barWidth: 12 }
    ]
  });
}

function renderAnalyticsSegment() {
  const ctx = document.getElementById('analyticsSegment');
  if (!ctx) return;
  if (charts.segment) charts.segment.dispose();
  charts.segment = echarts.init(ctx);

  const emps = {};
  allData.forEach(d => { if (!emps[d.name]) emps[d.name] = 0; emps[d.name] += (d.type === 'Tabungan' ? d.nominal : -d.nominal); });

  let low = 0, med = 0, high = 0;
  Object.values(emps).forEach(v => {
    if (v < 1000000) low++;
    else if (v < 10000000) med++;
    else high++;
  });

  charts.segment.setOption({
    tooltip: { trigger: 'item' },
    legend: { orient: 'vertical', left: 'left', top: 'center' },
    series: [{
      type: 'pie', radius: ['50%', '80%'], avoidLabelOverlap: false,
      itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      data: [
        { value: low, name: 'Micro (<1jt)', itemStyle: { color: '#94a3b8' } },
        { value: med, name: 'Medium (1-10jt)', itemStyle: { color: '#6366f1' } },
        { value: high, name: 'High (>10jt)', itemStyle: { color: '#4338ca' } }
      ]
    }]
  });
}

function renderAnalyticsAlerts(cur, currentMonthKey) {
  const container = document.getElementById('analyticsAlerts');
  if (!container) return;

  const alerts = [];

  // Highest Withdrawal THIS MONTH only
  const withdrawalEmps = {};
  globalFilteredData.forEach(d => {
    if (d.type === 'Penarikan' && d.date) {
      const k = d.date.getFullYear() + '-' + String(d.date.getMonth()).padStart(2, '0');
      if (k === currentMonthKey) {
        if (!withdrawalEmps[d.name]) withdrawalEmps[d.name] = 0;
        withdrawalEmps[d.name] += d.nominal;
      }
    }
  });
  const topOut = Object.entries(withdrawalEmps).sort((a, b) => b[1] - a[1])[0];
  if (topOut) alerts.push({ type: 'warning', icon: 'fa-arrow-up-right-from-square', text: `Penarikan terbesar bulan ini oleh <b>${topOut[0]}</b> senilai <b>${fmt(topOut[1])}</b>.` });

  // Negative Balance
  const negativeCount = allAnomalies.filter(a => a.status === 'In Progress').length;
  if (negativeCount > 0) alerts.push({ type: 'danger', icon: 'fa-exclamation-triangle', text: `Ditemukan <b>${negativeCount} transaksi</b> anomali/defisit yang perlu segera divalidasi.` });

  // Passive Status
  const activeThisMonth = cur.users.size;
  const totalEmps = new Set(allData.map(d => d.name)).size;
  if (activeThisMonth < totalEmps * 0.5) alerts.push({ type: 'info', icon: 'fa-user-clock', text: `Tingkat aktivitas karyawan bulan ini rendah (hanya <b>${Math.round(activeThisMonth / totalEmps * 100)}%</b> aktif).` });

  if (alerts.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding: 40px; color:var(--text-muted);"><i class="fas fa-check-circle" style="font-size:2rem; color:var(--success); margin-bottom:10px; display:block;"></i> Kondisi keuangan stabil. Tidak ada alert khusus saat ini.</div>';
  } else {
    container.innerHTML = `<div class="alert-list">${alerts.map(a => `<div class="alert-card ${a.type}"><i class="fas ${a.icon}"></i> <span>${a.text}</span></div>`).join('')}</div>`;
  }
}

function renderAnalyticsInsights(totalDana, activeEmps, cur, prev) {
  const container = document.getElementById('smartInsights');
  if (!container) return;

  const insights = [];

  // 1. Growth Insight
  const flow = cur.in - cur.out;
  const prevFlow = prev.in - prev.out;
  if (flow > prevFlow) {
    insights.push(`Pertumbuhan dana bersih meningkat drastis dibandingkan bulan lalu, didorong oleh peningkatan setoran sebesar <b>${Math.round((cur.in - prev.in) / Math.max(1, prev.in) * 100)}%</b>.`);
  } else {
    insights.push(`Arus kas bersih menurun bulan ini. Disarankan memantau tren penarikan yang meningkat.`);
  }

  // 2. Concentration
  const emps = {}; allData.forEach(d => { if (!emps[d.name]) emps[d.name] = 0; emps[d.name] += (d.type === 'Tabungan' ? d.nominal : -d.nominal); });
  const sorted = Object.values(emps).sort((a, b) => b - a);
  const top10Total = sorted.slice(0, 10).reduce((a, b) => a + b, 0);
  const concentration = Math.round((top10Total / Math.max(1, totalDana)) * 100);
  insights.push(`<b>${concentration}%</b> dana saat ini terkonsentrasi hanya pada 10 karyawan utama. Ini menunjukkan ketergantungan modal yang tinggi pada kelompok kecil.`);

  // 3. Timing
  insights.push(`Aktivitas transaksi paling tinggi terjadi pada minggu ke-2 setiap bulannya.`);

  container.innerHTML = `<div class="insight-box">${insights.map(i => `<div class="insight-item">${i}</div>`).join('')}</div>`;
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
      let doubleCount = 0;
      const currentUploadMap = new Map();

      json.slice(headerRowIdx + 1).filter(r => r.length > 0).forEach(r => {
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
          const cellRef = XLSX.utils.encode_cell({ r: headerRowIdx + 1 + _uploadData.length, c: nikIdx });
          if (ws[cellRef] && ws[cellRef].w) rawNik = ws[cellRef].w.replace(/[^0-9]/g, '');
        }
        let rawName = namaIdx >= 0 ? String(r[namaIdx] || '').trim() : String(r[1] || '').trim();

        if (!rawName && !rawNik) return;

        const identifier = rawNik ? rawNik.toLowerCase() : rawName.toLowerCase();
        const dStr = String(dateVal).toLowerCase().trim();
        const groupKey = `Tabungan_${identifier}_${dStr}`;

        if (currentUploadMap.has(groupKey)) {
          currentUploadMap.get(groupKey).nominal += nominal;
        } else {
          currentUploadMap.set(groupKey, {
            raw: r,
            dateVal,
            nominal,
            nik: rawNik,
            nama: rawName || rawNik
          });
        }
      });

      currentUploadMap.forEach((val, key) => {
        let isDouble = allData.some(x => x.type === 'Tabungan' && x.name.toLowerCase().trim() === val.nama.toLowerCase().trim() && String(x.dateStr).toLowerCase().trim() === String(val.dateVal).toLowerCase().trim() && x.nominal === val.nominal);

        if (isDouble) doubleCount++;
        _uploadData.push({ ...val, isDouble });
      });

      const preview = document.getElementById('previewSection');
      preview.classList.remove('hidden');
      document.getElementById('previewCount').textContent = _uploadData.length;
      document.querySelector('#previewTable tbody').innerHTML = _uploadData.slice(0, 20).map((d, i) => {
        let jenis = 'Lainnya';
        if (d.nominal === 50000 || d.nominal === 100000) jenis = 'Investasi Jaminan Kerja A';
        else if (d.nominal === 150000) jenis = 'Investasi Jaminan Kerja B';
        else if (d.nominal === 175000) jenis = 'Investasi Jaminan Kerja C';
        else if (d.nominal === 200000) jenis = 'Investasi Jaminan Kerja D';
        else if (d.nominal === 250000) jenis = 'Investasi Jaminan Kerja E';

        const rowStyle = d.isDouble ? 'background: #fef2f2; opacity: 0.8;' : '';
        const doubleBadge = d.isDouble ? ' <span class="badge out" style="padding:2px 6px; font-size:0.7rem; margin-left:8px;">Double</span>' : '';

        return `<tr style="${rowStyle}"><td>${d.dateVal}</td><td>${d.nama || '-'}${doubleBadge}</td><td>${jenis}</td><td style="font-weight:600; color:var(--primary);">${fmt(d.nominal)}</td></tr>`;
      }).join('');

      let msg = 'File dibaca: ' + _uploadData.length + ' baris.';
      if (doubleCount > 0) msg += ` Ditemukan ${doubleCount} data double (akan dilewati).`;
      toast(msg, doubleCount > 0 ? 'info' : 'success');
    } catch (err) { toast('Gagal membaca file Excel', 'error'); console.error(err); }
  };
  reader.readAsArrayBuffer(file);
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
  const payload = _uploadData.filter(d => !d.isDouble).map((d, i) => {
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
  const success = await sendDataToSheet(payload);
  if (success) setTimeout(() => { location.reload(); }, 1500);
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
      if (isAdmin) exportBtn?.classList.remove('hidden');
      else exportBtn?.classList.add('hidden');
    } else if (page === 'anomali') {
      globalFilterContainer?.classList.remove('hidden');
      typeFilter?.classList.add('hidden');
      anomaliFilter?.classList.remove('hidden');
      if (isAdmin) exportBtn?.classList.remove('hidden');
      else exportBtn?.classList.add('hidden');
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
      if (isAdmin) exportBtn?.classList.remove('hidden');
      else exportBtn?.classList.add('hidden');
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
});
function exportAnomaliData() {
  const q = (document.getElementById('anomaliSearch')?.value || '').toLowerCase().trim();
  const s = document.getElementById('topAnomaliStatusFilter')?.value || '';

  const inputStart = document.getElementById('globalStartDate');
  const inputEnd = document.getElementById('globalEndDate');
  const startDate = inputStart?.value ? new Date(inputStart.value) : null;
  const endDate = inputEnd?.value ? new Date(inputEnd.value) : null;
  if (startDate) startDate.setHours(0, 0, 0, 0);
  if (endDate) endDate.setHours(23, 59, 59, 999);

  let filtered = allAnomalies;
  if (startDate || endDate) {
    filtered = filtered.filter(a => {
      let pass = true;
      if (startDate && a.date) pass = pass && a.date >= startDate;
      if (endDate && a.date) pass = pass && a.date <= endDate;
      return pass;
    });
  }

  filtered = filtered.filter(a => {
    const matchSearch = a.name.toLowerCase().includes(q);
    const matchStatus = s ? a.status === s : true;
    return matchSearch && matchStatus;
  });

  if (filtered.length === 0) {
    toast('Tidak ada data anomali untuk di-export', 'error');
    return;
  }

  const exportData = filtered.map((a, i) => ({
    No: i + 1,
    Tanggal: a.dateStr,
    Karyawan: a.name,
    'Nominal Penarikan': a.nominal,
    'Saldo Sebelum': a.balanceBefore,
    'Saldo Sesudah': a.balanceAfter,
    'Alasan Anomali': a.reason,
    'Review Status': a.status === 'Verified' ? 'Terbukti' : (a.status === 'Salah Orang' ? 'Koreksi' : (a.status === 'In Progress' ? 'Masih Progres' : a.status)),
    'Review Notes': a.notes,
    'Reviewer': a.reviewer,
    'Update Terakhir': a.reviewTime ? new Date(a.reviewTime).toLocaleString('id-ID') : '-',
    'Nama Koreksi': a.correctName || '-',
    'NIK Koreksi': a.correctNik || '-'
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data Anomali");

  let statusSuffix = s ? `_${s.replace(/\s+/g, '_')}` : "_Semua_Status";
  const filename = `Data_Anomali${statusSuffix}_${new Date().toISOString().split('T')[0]}.xlsx`;

  XLSX.writeFile(wb, filename);
  toast('Data anomali berhasil didownload', 'success');
}
