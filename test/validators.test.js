const test = require('node:test');
const assert = require('node:assert/strict');

const { parseTargetUrl } = require('../src/validators');

test('parseTargetUrl accepts valid HTTPS URL', () => {
  const parsed = parseTargetUrl('https://example.com/docs');
  assert.equal(parsed.href, 'https://example.com/docs');
});

test('parseTargetUrl rejects non-http protocols', () => {
  assert.throws(() => parseTargetUrl('ftp://example.com'), /http or https/i);
});

test('parseTargetUrl rejects invalid URL', () => {
  assert.throws(() => parseTargetUrl('not-a-url'), /valid absolute URL/i);
});
