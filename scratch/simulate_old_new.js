const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Manually parse .env
const envPath = path.join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    let val = parts.slice(1).join('=').trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.substring(1, val.length - 1);
    }
    envVars[key] = val;
  }
});

async function run() {
  const email = envVars.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let key = envVars.GOOGLE_PRIVATE_KEY;
  if (!key) return;
  const cleanKey = key.replace(/\\n/g, '\n');
  const sheetId = envVars.GOOGLE_SHEET_ID;

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: cleanKey },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  try {
    // 1. Fetch data
    const rData = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId.trim(),
      range: 'Sheet1!A:G',
    });
    const rRev = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId.trim(),
      range: 'ReviewLog!A:G',
    });

    const allRows = rData.data.values || [];
    const headerIndex = allRows.findIndex(r => r.includes('Karyawan') || r.includes('KARYAWAN'));
    const rows = headerIndex > -1 ? allRows.slice(headerIndex + 1) : allRows;

    const allData = [];
    rows.forEach((row, index) => {
      let rawNominal = (row[3] || '0').toString().trim();
      let isNegative = false;
      if (rawNominal.startsWith('(') && rawNominal.endsWith(')')) {
        isNegative = true;
        rawNominal = rawNominal.substring(1, rawNominal.length - 1);
      } else if (rawNominal.startsWith('-')) {
        isNegative = true;
        rawNominal = rawNominal.substring(1);
      }
      const nominal = (parseFloat(rawNominal.replace(/\./g, '').replace(/,/g, '.')) || 0) * (isNegative ? -1 : 1);
      const absNominal = Math.abs(nominal);
      const rawKet = (row[5] || (isNegative ? 'Penarikan' : 'Tabungan')).trim();
      const karyawan = (row[2] || '').trim();
      if (karyawan && absNominal > 0) {
        allData.push({
          sheetRow: (headerIndex > -1 ? headerIndex + 1 : 0) + index + 1,
          no: row[0] || (allData.length + 1),
          bulanTahun: row[1] || '',
          name: karyawan,
          nominal: absNominal,
          isNegative: isNegative,
          nik: (row[4] || '').trim(),
          keterangan: rawKet,
          type: (rawKet.toLowerCase().includes('debet') || rawKet.toLowerCase().includes('penarikan')) ? 'Penarikan' : 'Tabungan',
          isEdited: row[6] === 'DIEDIT',
          notes: row[7] || ''
        });
      }
    });

    const allReviews = (rRev.data.values || []).slice(1).map(row => ({
      timestamp: row[0],
      txKey: row[1],
      status: row[2],
      notes: row[3],
      reviewer: row[4],
      correctName: row[5],
      correctNik: row[6]
    }));

    // Find employees
    const empMap = {};
    allData.forEach(d => {
      const id = d.nik && d.nik !== '-' ? d.nik : d.name;
      if (!empMap[id]) {
        empMap[id] = { name: d.name, nik: d.nik || '', variations: new Set([d.name]) };
      } else {
        empMap[id].variations.add(d.name);
        if (d.name.length > empMap[id].name.length) {
          empMap[id].name = d.name;
        }
      }
    });
    const allEmployees = Object.values(empMap).map(e => ({ ...e, variations: Array.from(e.variations) }));

    // Helper functions
    function getEmpId(d) {
      return d.nik && d.nik !== '-' ? d.nik : d.name;
    }

    const reviewMap = {};
    allReviews.forEach(r => { reviewMap[r.txKey] = r; });

    // 0. Old Global Audit Trail map
    const globalNameAudit = {};
    allReviews.forEach(r => {
      if (r.correctName && r.correctName !== '-') {
        const parts = r.txKey.split('_');
        if (parts.length >= 4) {
          let originalNameFromKey = parts.slice(1, -2).join(' ');
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

    // Run calculations for OLD logic
    function runSim(useOld) {
      const emps = {};
      const allAnomalies = [];
      const sortedData = [...allData];

      // Group by employee
      const empGroups = {};
      sortedData.forEach(t => {
        const id = getEmpId(t);
        if (!empGroups[id]) empGroups[id] = [];
        empGroups[id].push(t);
      });

      Object.entries(empGroups).forEach(([id, txs]) => {
        let balance = 0;
        let empActiveAnomalies = [];

        txs.forEach(t => {
          const balanceBefore = balance;
          if (t.type === 'Tabungan') {
            balance += t.nominal;
          } else {
            balance -= t.nominal;
          }

          const idNik = t.nik || id;
          const idName = t.name.replace(/\s+/g, '_');
          const txKeyNik = `anomali_${idNik}_${t.date ? t.date.getTime() : 0}_${t.nominal}`.replace(/\s+/g, '_');
          const txKeyName = `anomali_${idName}_${t.date ? t.date.getTime() : 0}_${t.nominal}`.replace(/\s+/g, '_');
          
          const review = reviewMap[txKeyNik] || reviewMap[txKeyName];
          let correctionReview = null;
          if (!review) {
            correctionReview = allReviews.find(r => 
              (r.correctName === t.name || r.correctNik === t.nik) && 
              Math.abs(r.nominal - t.nominal) < 1
            );
          }

          const activeReview = review || correctionReview;
          const txKey = activeReview ? activeReview.txKey : txKeyNik;

          let originalName = t.name;
          if (useOld) {
            originalName = globalNameAudit[t.nik] || globalNameAudit[t.name] || t.name;
          } else {
            originalName = t.name;
            if (activeReview && activeReview.txKey) {
              const parts = activeReview.txKey.split('_');
              if (parts.length >= 4) {
                const nameFromKey = parts.slice(1, -2).join(' ');
                if (nameFromKey !== t.name && nameFromKey !== t.nik) {
                  originalName = nameFromKey;
                }
              }
            }
          }

          const isDeficit = balance < -10000;
          if (t.type === 'Penarikan' && (isDeficit || activeReview)) {
            let manualStatus = 'MENUNGGU REVIEW';
            if (activeReview) {
              if (activeReview.status === 'MENUNGGU REVIEW' || activeReview.status === 'In Progress') manualStatus = 'MENUNGGU REVIEW';
              else if (activeReview.status === 'SALAH INPUT' || activeReview.status === 'Salah Orang') manualStatus = 'SALAH INPUT';
              else if (activeReview.status === 'TERBUKTI' || activeReview.status === 'Verified') manualStatus = 'TERBUKTI';
              else manualStatus = activeReview.status;
            }

            const deficitCreated = isDeficit ? (balanceBefore > 0 ? Math.abs(balance) : t.nominal) : 0;
            allAnomalies.push({
              txKey, name: t.name, nominal: t.nominal, balanceBefore, balanceAfter: balance,
              originalName, initialDebt: deficitCreated, remainingDebt: deficitCreated, status: manualStatus
            });
          }
        });
      });

      return allAnomalies;
    }

    const anomOld = runSim(true);
    const anomNew = runSim(false);

    console.log('Old Anomaly Count:', anomOld.length);
    console.log('New Anomaly Count:', anomNew.length);

    // Sum initial debt
    const sumOld = anomOld.reduce((sum, a) => sum + a.initialDebt, 0);
    const sumNew = anomNew.reduce((sum, a) => sum + a.initialDebt, 0);
    console.log('Old Initial Debt Sum:', sumOld);
    console.log('New Initial Debt Sum:', sumNew);

    // Let's find differences between old and new anomalies
    const oldKeys = anomOld.map(a => a.txKey + '_' + a.name + '_' + a.nominal);
    const newKeys = anomNew.map(a => a.txKey + '_' + a.name + '_' + a.nominal);

    const missingInNew = anomOld.filter(a => !newKeys.includes(a.txKey + '_' + a.name + '_' + a.nominal));
    const extraInNew = anomNew.filter(a => !oldKeys.includes(a.txKey + '_' + a.name + '_' + a.nominal));

    console.log('Missing in New:', JSON.stringify(missingInNew, null, 2));
    console.log('Extra in New:', JSON.stringify(extraInNew, null, 2));

  } catch (e) {
    console.error('ERROR:', e);
  }
}

run();
