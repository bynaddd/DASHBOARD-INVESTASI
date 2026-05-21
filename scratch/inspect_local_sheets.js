const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/nadia/Downloads/ASUKA/DASHBOARD INVESTASI';
const files = [
  'DATA FIX UPLOAD.xlsx',
  'Money Box April 2026 Upload.xlsx',
  'Penarikan januari- maret 2026.xlsx',
  'Rekap Moneybox dari mas fadli.xlsx'
];

files.forEach(file => {
  const filePath = path.join(dir, file);
  if (fs.existsSync(filePath)) {
    console.log(`\n=================== FILE: ${file} ===================`);
    try {
      const workbook = xlsx.readFile(filePath);
      console.log('Sheets:', workbook.SheetNames);
      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const range = xlsx.utils.decode_range(sheet['!ref'] || 'A1:A1');
        console.log(`  Sheet: ${sheetName}, Range: ${sheet['!ref']}`);
        // Let's print headers (first row)
        const headers = [];
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellRef = xlsx.utils.encode_cell({ r: range.s.r, c: col });
          const cell = sheet[cellRef];
          headers.push(cell ? cell.v : '');
        }
        console.log(`    Headers: [${headers.join(', ')}]`);
      });
    } catch (e) {
      console.error(`Error reading ${file}:`, e.message);
    }
  } else {
    console.log(`File not found: ${file}`);
  }
});
