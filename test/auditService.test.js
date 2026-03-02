const test = require('node:test');
const assert = require('node:assert/strict');

const { runAudit } = require('../src/auditService');

test('runAudit orchestrates crawl and scans each discovered page', async () => {
  const events = [];
  const audit = await runAudit({
    targetUrl: new URL('https://example.com'),
    maxPages: 2,
    maxDepth: 0,
    pauseMs: 1,
    fetchFn: async (url) => {
      if (url.endsWith('/robots.txt')) {
        return { ok: true, text: async () => '' };
      }
      if (url.endsWith('/sitemap.xml')) {
        return {
          ok: true,
          text: async () => '<urlset><url><loc>https://example.com/page-2</loc></url></urlset>'
        };
      }
      return { ok: true, text: async () => '<html></html>' };
    },
    sleepFn: async () => {},
    lighthouseRunner: async (url) => ({
      url,
      scores: { performance: 90, accessibility: 91, seo: 92, bestPractices: 93 },
      coreWebVitals: { lcpMs: 2400, cls: 0.08, inpMs: 180 },
      issues: []
    }),
    accessibilityRunner: async (url) => ({
      url,
      issues: [{ title: 'Missing label', severity: 'error', code: 'x', selector: '#id' }]
    }),
    onProgress: (event) => events.push(event.type)
  });

  assert.equal(audit.pagesScanned.length, 2);
  assert.equal(audit.accessibility.issueCount, 2);
  assert.equal(audit.lighthouse.issueCount, 0);
  assert.equal(audit.accessibility.conciseIssues[0].title, 'Missing label');
  assert.ok(events.includes('scan_started'));
  assert.ok(events.includes('page_scan_completed'));
});
