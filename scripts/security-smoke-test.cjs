'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'assets/dashboard.js'), 'utf8');
const vendorSource = fs.readFileSync(path.join(root, 'assets/vendor/xlsx-0.20.3.js'), 'utf8');

const browserContext = { window: {} };
vm.runInNewContext(vendorSource, browserContext, { timeout: 5000 });
const XLSX = browserContext.window.XLSX;
assert.ok(XLSX, 'The browser UMD build must expose window.XLSX.');
assert.equal(XLSX.version, '0.20.3', 'Expected patched SheetJS 0.20.3.');
assert.equal(typeof XLSX.read, 'function');
assert.equal(typeof XLSX.utils.decode_range, 'function');

const inputCsv = 'Number,Status' + String.fromCharCode(10) + 'INC-SEC-001,Open';
const parsedCsv = XLSX.read(inputCsv, { type: 'string' });
const parsedRows = XLSX.utils.sheet_to_json(parsedCsv.Sheets[parsedCsv.SheetNames[0]], { defval: '', raw: true });
assert.deepEqual(JSON.parse(JSON.stringify(parsedRows)), [{ Number: 'INC-SEC-001', Status: 'Open' }], 'CSV parsing should work.');

const workbook = XLSX.utils.book_new();
const sheet = XLSX.utils.aoa_to_sheet([['Number', 'Status'], ['INC-XLSX-001', 'Open']]);
XLSX.utils.book_append_sheet(workbook, sheet, 'Tickets');
const arrayBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
const reopened = XLSX.read(arrayBuffer, { type: 'array' });
const reopenedRows = XLSX.utils.sheet_to_json(reopened.Sheets.Tickets);
assert.deepEqual(JSON.parse(JSON.stringify(reopenedRows)), [{ Number: 'INC-XLSX-001', Status: 'Open' }], 'XLSX round trip should work.');

assert.ok(html.includes('<script src="./assets/vendor/xlsx-0.20.3.js"></script>'));
assert.ok(html.includes('<script src="./assets/dashboard.js"></script>'));
assert.ok(!html.includes('<script>'), 'No inline scripts should remain.');
assert.ok(!html.includes('https://'), 'No external network resources should be referenced from the HTML.');
assert.ok(!html.includes('cdnjs.cloudflare.com'));
assert.ok(!html.includes('fonts.googleapis.com'));
assert.ok(html.includes("script-src 'self'"));
assert.ok(html.includes("connect-src 'none'"));
assert.ok(html.includes('name="referrer" content="no-referrer"'));

assert.ok(app.includes('const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;'));
assert.ok(app.includes('const MAX_TICKET_ROWS = 100000;'));
assert.ok(app.includes('const MAX_TICKET_COLUMNS = 200;'));
assert.ok(app.includes('sheetRows:MAX_TICKET_ROWS+1'));
assert.ok(app.includes('FileReader'));
for (const forbidden of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource', 'localStorage', 'sessionStorage', 'indexedDB']) {
  assert.ok(!app.includes(forbidden), 'Dashboard should not contain ' + forbidden);
}
new Function(app);

console.log('Passed: browser SheetJS 0.20.3, CSV parsing, XLSX round trip, self-hosted scripts, CSP, browser-only processing and upload limits.');
