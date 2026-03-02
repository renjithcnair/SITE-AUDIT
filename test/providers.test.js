const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveScannerProvider } = require('../src/providers');

test('resolveScannerProvider defaults to local provider', () => {
  delete process.env.SCANNER_PROVIDER;
  const provider = resolveScannerProvider();
  assert.equal(provider.name, 'local');
});

test('resolveScannerProvider throws for unknown provider', () => {
  process.env.SCANNER_PROVIDER = 'unknown';
  assert.throws(() => resolveScannerProvider(), /Unknown scanner provider/i);
  delete process.env.SCANNER_PROVIDER;
});
