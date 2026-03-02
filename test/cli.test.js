const test = require('node:test');
const assert = require('node:assert/strict');

const { parseArgs, buildPageMetrics } = require('../src/cli');

test('parseArgs reads URL and options', () => {
  const parsed = parseArgs([
    'https://example.com',
    '--max-pages', '10',
    '--max-depth', '3',
    '--pause-ms', '1000',
    '--report-dir', './custom-reports'
  ]);

  assert.equal(parsed.url, 'https://example.com');
  assert.equal(parsed.maxPages, 10);
  assert.equal(parsed.maxDepth, 3);
  assert.equal(parsed.pauseMs, 1000);
  assert.ok(parsed.reportDir.endsWith('/custom-reports'));
});

test('parseArgs uses balanced defaults', () => {
  const parsed = parseArgs(['https://example.com']);
  assert.equal(parsed.maxPages, 50);
  assert.equal(parsed.maxDepth, 2);
  assert.equal(parsed.pauseMs, 1000);
});

test('buildPageMetrics maps per-page lighthouse and accessibility details', () => {
  const metrics = buildPageMetrics({
    lighthouse: {
      results: [
        {
          url: 'https://example.com',
          scores: { performance: 90, accessibility: 80, seo: 70, bestPractices: 60 },
          coreWebVitals: { lcpMs: 1200, cls: 0.01, inpMs: 120 },
          issues: [{ title: 'x' }]
        }
      ]
    },
    accessibility: {
      results: [
        {
          url: 'https://example.com',
          issues: [{ title: 'a11y' }]
        }
      ]
    }
  });

  assert.equal(metrics['https://example.com'].lighthouse.overall, 75);
  assert.equal(metrics['https://example.com'].accessibility.issueCount, 1);
});
