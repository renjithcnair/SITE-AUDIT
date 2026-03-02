const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const { renderMarkdownReport, writeReports } = require('../src/report');

test('renderMarkdownReport returns separate lighthouse and accessibility sections', () => {
  const markdown = renderMarkdownReport({
    target: 'https://example.com',
    generatedAt: '2026-01-01T00:00:00.000Z',
    pagesScanned: ['https://example.com'],
    crawl: { errors: [] },
    lighthouse: {
      issueCount: 1,
      conciseIssues: [{ title: 'Low performance score', count: 1 }],
      results: []
    },
    accessibility: {
      issueCount: 1,
      conciseIssues: [{ title: 'Missing alt', count: 1 }],
      results: []
    },
    aggregates: {
      lighthouse: {
        overall: 88,
        grade: 'B',
        categories: {
          performance: 86,
          accessibility: 91,
          seo: 90,
          bestPractices: 85
        },
        categoryGrades: {
          performance: 'B',
          accessibility: 'A',
          seo: 'A',
          bestPractices: 'B'
        }
      },
      accessibility: {
        lighthouseAccessibility: 91,
        lighthouseAccessibilityGrade: 'A',
        pa11yIssueIndex: 83,
        pa11yIssueIndexGrade: 'B'
      }
    }
  });

  assert.match(markdown, /## Aggregate Scores/);
  assert.match(markdown, /## Lighthouse & Core Web Vitals/);
  assert.match(markdown, /## Accessibility Findings/);
});

test('writeReports creates json and markdown files', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-audit-'));
  const report = {
    target: 'https://example.com',
    generatedAt: '2026-01-01T00:00:00.000Z',
    pagesScanned: [],
    crawl: { errors: [] },
    lighthouse: { issueCount: 0, conciseIssues: [], results: [] },
    accessibility: { issueCount: 0, conciseIssues: [], results: [] }
  };

  const output = writeReports(report, tempDir, 'test-report');
  assert.ok(fs.existsSync(output.jsonPath));
  assert.ok(fs.existsSync(output.markdownPath));
});
