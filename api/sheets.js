const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('API Start', req.method);
    
    let email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    let key = process.env.GOOGLE_PRIVATE_KEY;
    let sheetId = process.env.GOOGLE_SHEET_ID;
    let adminEmail = process.env.ADMIN_EMAIL;
    let adminPass = process.env.ADMIN_PASSWORD;

    // Helper to strip quotes and handle newlines
    const cleanValue = (val) => {
      if (!val) return val;
      val = val.trim();
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1);
      }
      return val.replace(/\\n/g, '\n');
    };

    // Fallback for local development if process.env is not populated
    if (!email || !key || !sheetId) {
      const envFiles = ['.env.local', '.env'];
      for (const file of envFiles) {
        try {
          const envPath = path.join(process.cwd(), file);
          if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf8');
            envContent.split(/\r?\n/).forEach(line => {
              const m = line.match(/^([^=]+)=(.*)$/);
              if (m) {
                const k = m[1].trim();
                const v = m[2].trim();
                if (k === 'GOOGLE_SERVICE_ACCOUNT_EMAIL') email = email || v;
                if (k === 'GOOGLE_PRIVATE_KEY') key = key || v;
                if (k === 'GOOGLE_SHEET_ID') sheetId = sheetId || v;
                if (k === 'ADMIN_EMAIL') adminEmail = adminEmail || v;
                if (k === 'ADMIN_PASSWORD') adminPass = adminPass || v;
              }
            });
            if (email && key && sheetId) break; // Stop if we found everything
          }
        } catch (err) {
          console.error(`Failed to load ${file}:`, err.message);
        }
      }
    }

    email = cleanValue(email);
    key = cleanValue(key);
    sheetId = cleanValue(sheetId);
    adminEmail = cleanValue(adminEmail);
    adminPass = cleanValue(adminPass);


    if (!email || !key || !sheetId) {
      console.error('MISSING CONFIG:', { email: !!email, key: !!key, sheetId: !!sheetId });
      const availableKeys = Object.keys(process.env).filter(k => k.startsWith('GOOGLE_'));
      return res.status(500).json({ 
        success: false, 
        error: 'Missing ENV vars', 
        detail: { 
          email: !!email, 
          key: !!key, 
          sheetId: !!sheetId,
          detected_google_keys: availableKeys
        } 
      });
    }

    // SUPER ROBUST Pembersihan Private Key (untuk Vercel)
    let cleanKey = key;
    
    // 1. Jika terbungkus tanda kutip (sering terjadi saat copy-paste), bersihkan
    if (cleanKey.startsWith('"') && cleanKey.endsWith('"')) {
      cleanKey = cleanKey.substring(1, cleanKey.length - 1);
    }

    // 2. Tangani karakter \n literal menjadi baris baru asli
    cleanKey = cleanKey.replace(/\\n/g, '\n');

    // 3. Pastikan tidak ada spasi di awal/akhir kunci
    cleanKey = cleanKey.trim();

    // 4. Fallback jika masih gagal (beberapa sistem menambahkan extra backslashes)
    if (!cleanKey.includes('\n') && cleanKey.includes('-----BEGIN PRIVATE KEY-----')) {
       // Jika kunci terbaca satu baris tanpa newline, ini pasti salah. 
       // Kita coba pisahkan manual atau beri peringatan.
    }

    // Validasi format kunci sederhana
    if (!cleanKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
       return res.status(500).json({ 
         success: false, 
         error: 'Invalid Private Key format', 
         detail: 'Key must start with -----BEGIN PRIVATE KEY-----. Current start: ' + cleanKey.substring(0, 20)
       });
    }

    // Handle GET for Reviews or Sheets
    if (req.method === 'GET') {
      const { type } = req.query;
      
      const auth = new google.auth.GoogleAuth({
        credentials: { client_email: email, private_key: cleanKey },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      const sheets = google.sheets({ version: 'v4', auth });

      if (type === 'review') {
        try {
          const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId.trim(),
            range: 'ReviewLog!A:G',
          });
          const rows = response.data.values || [];
          const reviews = rows.slice(1).map(row => ({
            timestamp: row[0],
            txKey: row[1],
            status: row[2],
            notes: row[3],
            reviewer: row[4],
            correctName: row[5],
            correctNik: row[6]
          }));
          return res.status(200).json({ success: true, data: reviews });
        } catch (e) {
          return res.status(200).json({ success: true, data: [] });
        }
      }
    }

    // Handle Login, Review, and Update (POST)
    if (req.method === 'POST') {
      const { type, email: inputEmail, pass: inputPass, reviewData, updateData, data: uploadData } = req.body || {};
      
      const auth = new google.auth.GoogleAuth({
        credentials: { client_email: email, private_key: cleanKey },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      const sheets = google.sheets({ version: 'v4', auth });

      // 1. Admin Login
      if (type === 'login') {
        if (inputEmail === adminEmail && inputPass === adminPass) {
          return res.status(200).json({ 
            success: true, 
            user: { name: 'Administrator', role: 'admin', email: adminEmail } 
          });
        }
        return res.status(401).json({ success: false, error: 'Email atau Password salah!' });
      }

      // 2. Save Review to ReviewLog
      if (type === 'review' && reviewData) {
        const { txKey, status, notes, reviewer, correctName, correctNik } = reviewData;
        const timestamp = new Date().toISOString();
        
        try {
          await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId.trim(),
            range: 'ReviewLog!A:G',
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            requestBody: {
              values: [[timestamp, txKey, status, notes, reviewer, correctName, correctNik]]
            },
          });
        } catch (e) {
          if (e.message.includes('not found')) {
            await sheets.spreadsheets.batchUpdate({
              spreadsheetId: sheetId.trim(),
              requestBody: {
                requests: [{ addSheet: { properties: { title: 'ReviewLog' } } }]
              }
            });
            await sheets.spreadsheets.values.append({
              spreadsheetId: sheetId.trim(),
              range: 'ReviewLog!A:G',
              valueInputOption: 'RAW',
              requestBody: {
                values: [
                  ["Timestamp", "TxKey", "Status", "Notes", "Reviewer", "CorrectName", "CorrectNik"],
                  [timestamp, txKey, status, notes, reviewer, correctName, correctNik]
                ]
              },
            });
          } else throw e;
        }
        return res.status(200).json({ success: true });
      }

      // 3. Update Specific Row
      if (type === 'updateRow' && updateData) {
        const { rowNo, name, nik } = updateData;
        const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId.trim() });
        const sheetName = meta.data.sheets[0].properties.title;
        
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId.trim(),
          range: `'${sheetName}'!C${rowNo + 3}:E${rowNo + 3}`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [[name, "", nik]]
          }
        });
        return res.status(200).json({ success: true });
      }

      // 4. Batch Upload
      if (uploadData && Array.isArray(uploadData)) {
        const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId.trim() });
        const sheetName = meta.data.sheets[0].properties.title;
        const values = uploadData.map(d => [d.no, d.bulanTahun, d.karyawan, d.nominal, d.nik, d.keterangan]);
        
        await sheets.spreadsheets.values.append({
          spreadsheetId: sheetId.trim(),
          range: `'${sheetName}'!A:F`,
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          requestBody: { values },
        });
        return res.status(200).json({ success: true });
      }
    }

    // Default: Fetch Transactions (for GET with no type)
    const auth = new google.auth.GoogleAuth({
      credentials: { client_email: email, private_key: cleanKey },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId.trim() });
    const sheetName = meta.data.sheets[0].properties.title;
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId.trim(),
      range: `'${sheetName}'!A:F`,
    });

    const allRows = response.data.values || [];
    
    // Find the header row to determine where data starts
    const headerIndex = allRows.findIndex(r => r.includes('Karyawan') || r.includes('KARYAWAN'));
    const rows = headerIndex > -1 ? allRows.slice(headerIndex + 1) : allRows;

    const data = rows.map((row, index) => {
      let rawNominal = (row[3] || '0').toString().trim();
      let isNegative = false;
      
      // Handle accounting negative format: (1.234,00)
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

      // Logika Kategorisasi Otomatis berdasarkan nominal (Request User)
      let jenisPotongan = rawKet;
      if (!isNegative) {
        if (absNominal <= 100000) jenisPotongan = 'Investasi Jaminan Kerja A';
        else if (absNominal === 150000) jenisPotongan = 'Investasi Jaminan Kerja B';
        else if (absNominal === 175000) jenisPotongan = 'Investasi Jaminan Kerja C';
        else if (absNominal === 200000) jenisPotongan = 'Investasi Jaminan Kerja D';
        else if (absNominal === 250000) jenisPotongan = 'Investasi Jaminan Kerja E';
      }

      return {
        no: row[0] || (index + 1),
        bulanTahun: row[1] || '',
        karyawan: (row[2] || '').trim(),
        nominal: absNominal,
        isNegative: isNegative,
        nik: (row[4] || '').trim(),
        keterangan: rawKet,
        jenisPotongan: jenisPotongan // Ini yang dibaca oleh app.js (d.jenis)
      };
    }).filter(d => d.karyawan && d.nominal > 0);

    return res.status(200).json({ success: true, count: data.length, data });

  } catch (error) {
    console.error('BACKEND ERROR:', error);
    return res.status(500).json({
      success: false,
      error: 'Backend Crash',
      message: error.message,
      detail: error.response ? error.response.data : null
    });
  }
};
