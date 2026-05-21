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
  if (!fs.existsSync(filePath)) return;
  const workbook = xlsx.readFile(filePath);
  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    data.forEach((row, rIdx) => {
      row.forEach((cell, cIdx) => {
        if (cell && typeof cell === 'string' && (cell.toLowerCase().includes('sisa') || cell.toLowerCase().includes('setoran') || cell.toLowerCase().includes('kurang'))) {
          console.log(`Match in file ${file}, Sheet ${sheetName}, Row ${rIdx}, Col ${cIdx}: "${cell}"`);
        }
      });
    });
  });
});
console.log('Search complete.');
