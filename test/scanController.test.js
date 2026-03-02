const test = require('node:test');
const assert = require('node:assert/strict');

const { sanitizeScanOptions, createCustomerSummary } = require('../src/server/scanController');

test('sanitizeScanOptions uses full-site mode when maxPages is omitted', () => {
  const options = sanitizeScanOptions({});
  assert.equal(options.maxPages, null);
  assert.equal(options.maxDepth, 2);
  assert.equal(options.pauseMs, 1000);
});

test('sanitizeScanOptions constrains upper bounds', () => {
  const options = sanitizeScanOptions({ maxPages: 9999, maxDepth: 99, pauseMs: 90000 });
  assert.equal(options.maxPages, 500);
  assert.equal(options.maxDepth, 10);
  assert.equal(options.pauseMs, 10000);
});

test('sanitizeScanOptions treats blank maxPages as full-site mode', () => {
  const options = sanitizeScanOptions({ maxPages: '   ' });
  assert.equal(options.maxPages, null);
});

test('createCustomerSummary returns customer-friendly text', () => {
  const summary = createCustomerSummary(
    { overall: 78 },
    { pa11yIssueIndex: 72 }
  );

  assert.match(summary.headline, /good but can be improved/i);
  assert.match(summary.accessibility, /moderate accessibility risk/i);
  assert.equal(summary.topActions.length, 3);
});
