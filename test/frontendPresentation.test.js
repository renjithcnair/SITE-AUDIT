const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadPresentationModule() {
  const modulePath = path.resolve(__dirname, '../web/src/lib/presentation.js');
  return import(pathToFileURL(modulePath).href);
}

test('scoreBadgeTone maps thresholds for frontend display', async () => {
  const module = await loadPresentationModule();
  assert.equal(module.scoreBadgeTone(93), 'good');
  assert.equal(module.scoreBadgeTone(70), 'warn');
  assert.equal(module.scoreBadgeTone(42), 'bad');
});

test('formatCustomerScore renders customer-friendly value', async () => {
  const module = await loadPresentationModule();
  assert.equal(module.formatCustomerScore(89.6, 'B'), '90/100 (B)');
});
