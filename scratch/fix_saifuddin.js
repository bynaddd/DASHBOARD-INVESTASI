const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

// Ambil konfigurasi dari file .env
const envPath = path.join(__dirname, '../.env');
let envContent = '';
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
}
const envVars = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    let val = parts.slice(1).join('=').trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.substring(1, val.length - 1);
    envVars[key] = val;
  }
});

async function fixSpreadsheet() {
  let email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || envVars.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let key = process.env.GOOGLE_PRIVATE_KEY || envVars.GOOGLE_PRIVATE_KEY;
  const sheetId = process.env.GOOGLE_SHEET_ID || envVars.GOOGLE_SHEET_ID;

  if (!key || !email || !sheetId) return console.error('Pastikan konfigurasi .env sudah lengkap.');
  const cleanKey = key.replace(/\\n/g, '\n');

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: cleanKey },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const sheetName = meta.data.sheets[0].properties.title;
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `'${sheetName}'!A:E`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return console.log('Tidak ada data.');

    const updates = [];
    
    rows.forEach((row, idx) => {
      const rowIndex = idx + 1; 
      const nama = (row[2] || '').trim();
      const nominal = row[3] || '';
      const nik = (row[4] || '').trim();

      if (nama.toLowerCase() === 'm. saifuddin' || nama.toLowerCase() === 'm. saifudin' || nik.toLowerCase() === 'm. saifuddin') {
        updates.push({
          range: `'${sheetName}'!E${rowIndex}`,
          values: [['3523121306880001']]
        });
        console.log(`Mengoreksi Baris ${rowIndex} - Nama Lama: ${nama}, NIK Lama: ${nik}`);
      }
    });

    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: updates
        }
      });
      console.log(`Berhasil mengubah ${updates.length} transaksi menjadi Muhammad Saifuddin di spreadsheet.`);
    } else {
      console.log('Tidak ditemukan data atas nama M. Saifuddin yang perlu diperbarui.');
    }

  } catch (err) {
    console.error('Terjadi Error:', err.message);
  }
}

fixSpreadsheet();