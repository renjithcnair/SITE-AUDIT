const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeLevel, shouldLog } = require('../src/logger');

test('normalizeLevel maps known levels and defaults to INFO', () => {
  assert.equal(normalizeLevel('debug'), 'DEBUG');
  assert.equal(normalizeLevel('INFO'), 'INFO');
  assert.equal(normalizeLevel('unknown'), 'INFO');
});

test('shouldLog compares requested level against LOG_LEVEL threshold', () => {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = 'ERROR';

  try {
    assert.equal(shouldLog('DEBUG'), false);
    assert.equal(shouldLog('INFO'), false);
    assert.equal(shouldLog('ERROR'), true);
    assert.equal(shouldLog('FATAL'), true);
  } finally {
    if (previous === undefined) {
      delete process.env.LOG_LEVEL;
    } else {
      process.env.LOG_LEVEL = previous;
    }
  }
});
