const test = require('node:test');
const assert = require('node:assert/strict');

const { parseLighthouseJson, buildLighthouseIssues } = require('../src/lighthouseRunner');

test('parseLighthouseJson extracts category scores and vitals', () => {
  const input = {
    categories: {
      performance: { score: 0.88 },
      accessibility: { score: 0.91 },
      seo: { score: 0.95 },
      'best-practices': { score: 0.9 }
    },
    audits: {
      'largest-contentful-paint': { numericValue: 3200 },
      'cumulative-layout-shift': { numericValue: 0.2 },
      'interaction-to-next-paint': { numericValue: 180 }
    }
  };

  const output = parseLighthouseJson(input);
  assert.equal(output.scores.performance, 88);
  assert.equal(output.scores.accessibility, 91);
  assert.equal(output.coreWebVitals.lcpMs, 3200);
  assert.equal(output.coreWebVitals.cls, 0.2);
  assert.equal(output.coreWebVitals.inpMs, 180);
});

test('buildLighthouseIssues reports failed thresholds', () => {
  const issues = buildLighthouseIssues({
    scores: { performance: 70, accessibility: 95, seo: 100, bestPractices: 100 },
    coreWebVitals: { lcpMs: 3000, cls: 0.12, inpMs: 500 }
  });

  assert.equal(issues.length, 4);
  assert.match(issues[0].title, /performance/i);
});
