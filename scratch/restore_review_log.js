const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Ambil konfigurasi dari file .env
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

async function restoreData() {
  const email = envVars.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let key = envVars.GOOGLE_PRIVATE_KEY;
  if (!key) return console.error('Tolong pastikan Private Key Google telah diatur di .env');
  const cleanKey = key.replace(/\\n/g, '\n');
  const sheetId = envVars.GOOGLE_SHEET_ID;

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: cleanKey },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  // Data yang Anda berikan, di-mapping sesuai format kolom asli backend: Timestamp, TxKey, Status, Notes, dsb
  const rawData = `2026-05-12T02:27:56.209Z	anomali_Sugiharto_1766682000000_8403192	Verified	No notes added	admin@moneybox.com		
2026-05-12T13:46:14.867Z	anomali_3578011212730001_1766682000000_8403192	Verified	No notes added	admin@moneybox.com		
2026-05-12T17:14:04.192Z	anomali_3578011212730001_1766682000000_8403192	Verified	proses pencairan dana investasi dilakukan 2 kali	admin@moneybox.com		
2026-05-13T07:04:18.413Z	anomali_3525141506740007_1776358800000_3327157	Verified	No notes added	admin@moneybox.com		
2026-05-13T07:12:50.245Z	anomali_3525141506740007_1776358800000_3327157	Verified	Pencairan yang pertama tidak di Update	admin@moneybox.com		
2026-05-13T07:13:09.523Z	anomali_3506140802760001_1776358800000_1113854	Verified	Pencairan yang pertama tidak diupdate	admin@moneybox.com		
2026-05-13T07:14:25.840Z	anomali_3579010810920009_1776358800000_1113854	Verified	Pencairan yang pertama belum diupdate	admin@moneybox.com		
2026-05-13T07:24:13.484Z	anomali_1403091708958881_1776358800000_1516988	Verified	Tabungan kurang	admin@moneybox.com		
2026-05-13T07:29:07.890Z	anomali_3525100304050001_1774803600000_2789606	Verified	Pencairan yang pertama tidak terupdate	admin@moneybox.com		
2026-05-13T09:24:44.422Z	anomali_3515152901780001_1422723600000_3984300	Salah Orang	No notes added	admin@moneybox.com	Ali Masruri, SH	3525100711790003
2026-05-14T05:01:06.743Z	anomali_Tomy_Zezandra_A_1693501200000_401500	Verified	karyawan tidak tercatat di AIS dan tidak melalukan setoran investasi tetapi mengambil dana investasi	admin@moneybox.com		
2026-05-14T06:37:42.339Z	anomali_3515152901780001_1422723600000_3984300	In Progress	No notes added	admin@moneybox.com		
2026-05-14T06:43:50.690Z	anomali_3515152901780001_1422723600000_3984300	Salah Orang	No notes added	admin@moneybox.com	Ali Masruri, SH	3525100711790003
2026-05-18T04:23:38.753Z	anomali_3525051506690008_1561914000000_8117600	SALAH INPUT	No notes added	admin@moneybox.com	Nursahid	3525052310820004
2026-05-18T04:24:00.702Z	anomali_3525051506690008_1561914000000_8117600	SALAH INPUT	No notes added	admin@moneybox.com	Nursahid	3525052310820004
2026-05-18T07:46:21.280Z	anomali_3525161506750122_1485882000000_5318800	SALAH INPUT	Correction test	admin@moneybox.com	M. Maksum Corrected	3525161506750123
2026-05-18T08:13:12.201Z	anomali_3525051506690008_1561914000000_8117600	SALAH INPUT	No notes added	admin@moneybox.com	Nursahid	3525052310820004
2026-05-18T09:41:59.507Z	anomali_3525161506750123_1485882000000_5318800	SALAH INPUT	Mengembalikan nama karyawan ke data asli (A. Maksum)	admin@moneybox.com	A. Maksum	3525161506750122
2026-05-18T09:56:42.395Z	anomali_3525161506750122_1485882000000_5318800	MENUNGGU REVIEW	Correction test	admin@moneybox.com	M. Maksum Corrected	3525161506750123
2026-05-22T02:40:03.488Z	anomali_3525161506750122_1485882000000_5318800	MENUNGGU REVIEW	No notes added	admin@moneybox.com		
2026-05-22T02:40:41.203Z	anomali_3525161506750122_1485882000000_5318800	MENUNGGU REVIEW	correction test	admin@moneybox.com		
2026-05-26T07:12:42.648Z	anomali_3525161506750122_1485882000000_5318800	TERBUKTI	kelebihan ambil	admin@moneybox.com		
2026-05-26T07:35:29.895Z	anomali_3525101909770002_1551373200000_8117600	TERBUKTI	tidak memotong investasi pada gaji di bulan april 2013	admin@moneybox.com		
2026-05-26T08:00:56.558Z	anomali_3578110601770002_1420045200000_1380300	TERBUKTI	"terdapat perbedaan cara menghitung bunga, pada transaksi ini dihitung dengan cara flat\\n\\njadi bunga dihitung berdasarkan  1.350  langsung dikalikan 3%"	admin@moneybox.com		
2026-05-26T08:03:21.869Z	anomali_3578110601770002_1420045200000_1380300	TERBUKTI	"terdapat perbedaan cara menghitung bunga, pada transaksi ini dihitung dengan cara flat\\n\\njadi bunga dihitung berdasarkan  1.350  langsung dikalikan 3%"	admin@moneybox.com		
2026-05-26T08:12:54.186Z	anomali_3525100711790003_1422723600000_3984300	TERBUKTI	terdapat perbedaan cara perhitungan bunga	admin@moneybox.com		
2026-05-26T08:15:59.394Z	anomali_3301172304870002_1427821200000_5643700	TERBUKTI	salah menghitung setoran, harusnya 27 bulan tetapi di bukti potong 30 bulan dan perbedaan menghitung bunga	admin@moneybox.com		
2026-05-26T08:17:05.739Z	anomali_351612_270475_0006_1443632400000_5043900	TERBUKTI	salah cara menghitung bunga	admin@moneybox.com		
2026-05-26T08:19:11.616Z	anomali_3573051006890001_1425142800000_1772200	TERBUKTI	salah erhitungan bunga	admin@moneybox.com		
2026-05-26T08:19:30.975Z	anomali_3573051006890001_1427821200000_1772200	TERBUKTI	pengambilan double dan salah perhitungan bunga	admin@moneybox.com		
2026-05-26T08:22:18.576Z	anomali_3525102508910003_1422723600000_1130200	TERBUKTI	salah menghitung setoran dan salah menghitung bunga	admin@moneybox.com		
2026-05-26T08:53:35.575Z	anomali_Ragil_1443632400000_705200	SALAH INPUT	No notes added	admin@moneybox.com	Ragil Bagus	Ragil Bagus`;

  const values = [["Timestamp", "TxKey", "Status", "Notes", "Reviewer", "CorrectName", "CorrectNik"]];
  
  rawData.split('\n').forEach(line => {
    const cols = line.split('\t');
    if (cols.length >= 5) {
      values.push([
        cols[0] || '', cols[1] || '', cols[2] || '', 
        cols[3] ? cols[3].replace(/^"|"$/g, '').replace(/\\n/g, '\n') : '', 
        cols[4] || '', cols[5] || '', cols[6] || ''
      ]);
    }
  });

  try {
    console.log('Menghapus sheet ReviewLog lama (reset)...');
    await sheets.spreadsheets.values.clear({ spreadsheetId: sheetId.trim(), range: 'ReviewLog!A:G' });

    console.log('Menyisipkan data milik Anda...');
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId.trim(), range: 'ReviewLog!A1', valueInputOption: 'RAW',
      requestBody: { values }
    });
    console.log('Selesai! Riwayat koreksi Anda telah kembali utuh.');
  } catch (e) {
    console.error('Error:', e.message);
  }
}

restoreData();