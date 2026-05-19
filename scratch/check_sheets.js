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
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId.trim() });
    const allSheetNames = meta.data.sheets.map(s => s.properties.title);
    console.log('ALL SHEETS:', allSheetNames);
  } catch (e) {
    console.error('ERROR:', e.message);
  }
}

run();
