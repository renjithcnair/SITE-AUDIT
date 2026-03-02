const test = require('node:test');
const assert = require('node:assert/strict');

const { summarizeIssues } = require('../src/summary');

test('summarizeIssues groups same issue labels with counts', () => {
  const issues = [
    { title: 'Color contrast insufficient' },
    { title: 'Color contrast insufficient' },
    { title: 'Missing alt attribute' }
  ];

  const summary = summarizeIssues(issues, 5);
  assert.deepEqual(summary, [
    { title: 'Color contrast insufficient', count: 2 },
    { title: 'Missing alt attribute', count: 1 }
  ]);
});
