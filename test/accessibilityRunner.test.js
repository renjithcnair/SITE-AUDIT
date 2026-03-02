const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizePa11yIssues, runAccessibility } = require('../src/accessibilityRunner');

test('normalizePa11yIssues maps fields to concise issue shape', () => {
  const normalized = normalizePa11yIssues([
    {
      code: 'WCAG2AA.Principle1.Guideline1_1.1_1_1.H37',
      type: 'error',
      message: 'Img element missing alt attribute',
      selector: '#hero img'
    }
  ]);

  assert.deepEqual(normalized, [
    {
      title: 'Img element missing alt attribute',
      severity: 'error',
      code: 'WCAG2AA.Principle1.Guideline1_1.1_1_1.H37',
      selector: '#hero img'
    }
  ]);
});

test('runAccessibility treats non-zero pa11y exit with JSON stdout as valid issues', async () => {
  const issueJson = JSON.stringify([
    {
      code: 'WCAG2AA.Principle1.Guideline1_1.1_1_1.H37',
      type: 'error',
      message: 'Img element missing alt attribute',
      selector: '#hero img'
    }
  ]);

  const error = new Error('Command failed');
  error.stdout = issueJson;

  const result = await runAccessibility('https://example.com', {
    execFileFn: async () => {
      throw error;
    }
  });

  assert.equal(result.toolStatus, 'ok');
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].title, 'Img element missing alt attribute');
});

test('runAccessibility keeps failure when pa11y output is not parseable JSON', async () => {
  const error = new Error('Command failed');
  error.stdout = 'not-json';
  error.stderr = 'navigation timeout';

  const result = await runAccessibility('https://example.com', {
    execFileFn: async () => {
      throw error;
    }
  });

  assert.equal(result.toolStatus, 'failed');
  assert.equal(result.issues[0].code, 'scan-failed');
  assert.match(result.issues[0].details, /navigation timeout/i);
});
