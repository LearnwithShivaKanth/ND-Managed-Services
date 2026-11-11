'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'assets/dashboard.js'), 'utf8');
const XLSX = require(path.join(root, 'assets/vendor/xlsx-0.20.3.js'));

assert.equal(XLSX.version, '0.20.3');
assert.equal(typeof XLSX.read, 'function');
assert.equal(typeof XLSX.utils.decode_range, 'function');
const inputCsv = 'Number,Status\\nINC-SEC-001,Open';
const parsedCsv = XLSX.read(inputCsv, { type: 'string' });
const parsedRows = XLSX.utils.sheet_to_json(parsedCsv.Sheets[parsedCsv.SheetNames[0]], { defval: '', raw: true });
assert.deepEqual(parsedRows, [{ Number: 'INC-SEC-001', Status: 'Open' }]);

const workbook = XLSX.utils.book_new();
const sheet = XLSX.utils.aoa_to_sheet([['Number', 'Status'], ['INC-XLSX-001', 'Open']]);
XLSX.utils.book_append_sheet(workbook, sheet, 'Tickets');
const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
const reopened = XLSX.read(buffer, { type: 'buffer' });
assert.deepEqual(XLSX.utils.sheet_to_json(reopened.Sheets.Tickets), [{ Number: 'INC-XLSX-001', Status: 'Open' }]);

const scripts = [...html.matchAll(/<script\\b[^>]*\\bsrc=["']([^"']+)["'][^>]*>/gi)].map(m => m[1]);
assert.deepEqual(scripts, ['./assets/vendor/xlsx-0.20.3.js', './assets/dashboard.js']);
assert.doesNotMatch(html, /<script\\b(?![^>]*\\bsrc=)[^>]*>/i);
assert.doesNotMatch(html, /<link\\b[^>]*\\bhref=["']https?:/i);
assert.doesNotMatch(html, /cdnjs\\.cloudflare\\.com|fonts\\.googleapis\\.com|cdn\\.sheetjs\\.com/i);
assert.match(html, /script-src 'self'/);
assert.match(html, /connect-src 'none'/);
assert.match(html, /name="referrer" content="no-referrer"/);

assert.match(app, /MAX_UPLOAD_BYTES\\s*=\\s*20\\s*\\*\\s*1024\\s*\\*\\s*1024/);
assert.match(app, /MAX_TICKET_ROWS\\s*=\\s*100000/);
assert.match(app, /MAX_TICKET_COLUMNS\\s*=\\s*200/);
assert.match(app, /sheetRows:MAX_TICKET_ROWS\\+1/);
assert.match(app, /FileReader/);
assert.doesNotMatch(app, /\\bfetch\\s*\\(|\\bXMLHttpRequest\\b|\\bsendBeacon\\b|\\bWebSocket\\b|\\bEventSource\\b|\\blocalStorage\\b|\\bsessionStorage\\b|\\bindexedDB\\b/);
new Function(app);
console.log('Passed: SheetJS 0.20.3 CSV/XLSX parsing, self-hosted scripts, CSP, browser-only processing and upload bounds.');
