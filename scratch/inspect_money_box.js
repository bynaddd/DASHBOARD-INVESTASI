const xlsx = require('xlsx');
const path = require('path');

const dir = 'c:/Users/nadia/Downloads/ASUKA/DASHBOARD INVESTASI';
const file = 'Money Box April 2026 Upload.xlsx';
const filePath = path.join(dir, file);

const workbook = xlsx.readFile(filePath);
const sheetName = 'MONEY BOX';
const sheet = workbook.Sheets[sheetName];

const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
console.log('First 20 rows of ' + file + ':');
for (let i = 0; i < Math.min(data.length, 25); i++) {
  console.log(`Row ${i}:`, data[i]);
}
