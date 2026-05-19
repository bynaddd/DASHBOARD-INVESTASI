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
  if (!key) {
    console.error("No private key");
    return;
  }
  const cleanKey = key.replace(/\\n/g, '\n');
  const sheetId = envVars.GOOGLE_SHEET_ID;

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: cleanKey },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId.trim(),
      range: 'Sheet1!A:G',
    });

    const allRows = response.data.values || [];
    console.log('Total Rows in Sheet1:', allRows.length);

    // Let's print rows matching Maksum
    const maksumRows = [];
    let totalIn = 0;
    let totalOut = 0;

    allRows.forEach((row, i) => {
      if (i === 0) return;
      const karyawan = (row[2] || '').trim();
      const nominalRaw = row[3] || '0';
      const ket = (row[5] || '').toLowerCase();
      
      let rawNominal = nominalRaw.toString().trim();
      let isNegative = false;
      if (rawNominal.startsWith('(') && rawNominal.endsWith(')')) {
        isNegative = true;
        rawNominal = rawNominal.substring(1, rawNominal.length - 1);
      } else if (rawNominal.startsWith('-')) {
        isNegative = true;
        rawNominal = rawNominal.substring(1);
      }
      const nominal = (parseFloat(rawNominal.replace(/\./g, '').replace(/,/g, '.')) || 0) * (isNegative ? -1 : 1);

      if (karyawan.toLowerCase().includes('maksum')) {
        maksumRows.push({ rowNo: i + 1, data: row, parsedNominal: nominal });
      }

      if (nominal > 0) {
        totalIn += nominal;
      } else {
        totalOut += Math.abs(nominal);
      }
    });

    console.log('Maksum rows:', JSON.stringify(maksumRows, null, 2));
    console.log('Total Savings (Positive):', totalIn);
    console.log('Total Withdrawals (Negative):', totalOut);
    console.log('Net Balance:', totalIn - totalOut);

  } catch (e) {
    console.error('ERROR:', e.message);
  }
}

run();
