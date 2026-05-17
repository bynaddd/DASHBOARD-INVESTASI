const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

async function listSheets() {
  let email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let key = process.env.GOOGLE_PRIVATE_KEY;
  let sheetId = process.env.GOOGLE_SHEET_ID;

  if (!email || !key || !sheetId) {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      envContent.split(/\r?\n/).forEach(line => {
        const m = line.match(/^([^=]+)=(.*)$/);
        if (m) {
          const k = m[1].trim();
          let v = m[2].trim();
          if (v.startsWith('"') && v.endsWith('"')) v = v.substring(1, v.length - 1);
          if (k === 'GOOGLE_SERVICE_ACCOUNT_EMAIL') email = v;
          if (k === 'GOOGLE_PRIVATE_KEY') key = v.replace(/\\n/g, '\n');
          if (k === 'GOOGLE_SHEET_ID') sheetId = v;
        }
      });
    }
  }

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: key },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    console.log('Sheet Names:');
    meta.data.sheets.forEach(s => console.log(`- ${s.properties.title}`));

    // Try to read 'Dashboard' sheet if it exists
    const dashboardSheet = meta.data.sheets.find(s => s.properties.title === 'Dashboard');
    if (dashboardSheet) {
      console.log('\nContent of "Dashboard" sheet (A1:B10):');
      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: 'Dashboard!A1:B10'
      });
      console.table(resp.data.values);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

listSheets();
