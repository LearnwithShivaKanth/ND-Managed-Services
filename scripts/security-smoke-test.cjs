'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'assets/dashboard.js'), 'utf8');
const vendorSource = fs.readFileSync(path.join(root, 'assets/vendor/xlsx-0.20.3.js'), 'utf8');
const TicketFilterEngine = require(path.join(root, 'assets/filter-engine.js'));

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
assert.ok(html.includes('<script src="./assets/filter-engine.js"></script>'));
assert.ok(html.includes('<script src="./assets/dashboard.js"></script>'));
assert.ok(html.includes('id="dynamic-filter-panel"'));
assert.ok(html.includes('id="dynamic-filters"'));
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

const clientRows = [
  { "Logged At":"2026-10-01 09:00", "Case ID":"C-001", "Impact Level":"High", "Product / Service":"Finance ERP", "Status":"Open", "Resolver Group":"Finance Support", "Resolution Summary":"Initial review completed" },
  { "Logged At":"2026-10-01 10:00", "Case ID":"C-002", "Impact Level":"High", "Product / Service":"Finance ERP", "Status":"In Progress", "Resolver Group":"Finance Support", "Resolution Summary":"Investigating payment issue" },
  { "Logged At":"2026-10-02 11:00", "Case ID":"C-003", "Impact Level":"Low", "Product / Service":"HR Portal", "Status":"Closed", "Resolver Group":"HR Support", "Resolution Summary":"User access restored" },
  { "Logged At":"2026-10-02 12:00", "Case ID":"C-004", "Impact Level":"Medium", "Product / Service":"HR Portal", "Status":"Open", "Resolver Group":"HR Support", "Resolution Summary":"Password reset" },
  { "Logged At":"2026-10-03 13:00", "Case ID":"C-005", "Impact Level":"High", "Product / Service":"Finance ERP", "Status":"Closed", "Resolver Group":"Finance Support", "Resolution Summary":"Bank file processed" },
  { "Logged At":"2026-10-03 14:00", "Case ID":"C-006", "Impact Level":"Low", "Product / Service":"HR Portal", "Status":"In Progress", "Resolver Group":"HR Support", "Resolution Summary":"Leave balance checked" }
];
const detected = TicketFilterEngine.detectFilterColumns(Object.keys(clientRows[0]), clientRows);
const detectedNames = detected.map(field => field.name);
for (const expected of ["Impact Level", "Product / Service", "Status", "Resolver Group"]) {
  assert.ok(detectedNames.includes(expected), "Expected dynamic facet: " + expected);
}
for (const excluded of ["Logged At", "Case ID", "Resolution Summary"]) {
  assert.ok(!detectedNames.includes(excluded), "Should not show a filter for: " + excluded);
}
const selections = { "Impact Level":"High", "Product / Service":"Finance ERP" };
const filteredRows = clientRows.filter(row => TicketFilterEngine.matchesFacetValues(row, selections));
assert.equal(filteredRows.length, 3, "Multiple dynamic filters must combine with AND logic.");
assert.ok(filteredRows.every(row => row["Impact Level"] === "High" && row["Product / Service"] === "Finance ERP"));
assert.equal(clientRows.filter(row => TicketFilterEngine.matchesFacetValues(row, {})).length, clientRows.length);

console.log('Passed: SheetJS 0.20.3, CSV/XLSX parsing, self-hosted scripts, CSP, browser-only processing, upload limits and dynamic source-column filters.');
