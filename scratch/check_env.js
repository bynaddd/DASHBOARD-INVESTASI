require('dotenv').config({ path: '.env.local' });
console.log('GOOGLE_SERVICE_ACCOUNT_EMAIL:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? 'FOUND' : 'MISSING');
console.log('GOOGLE_PRIVATE_KEY:', process.env.GOOGLE_PRIVATE_KEY ? 'FOUND' : 'MISSING');
console.log('GOOGLE_SHEET_ID:', process.env.GOOGLE_SHEET_ID ? 'FOUND' : 'MISSING');
console.log('ADMIN_EMAIL:', process.env.ADMIN_EMAIL ? 'FOUND' : 'MISSING');
console.log('ADMIN_PASSWORD:', process.env.ADMIN_PASSWORD ? 'FOUND' : 'MISSING');
