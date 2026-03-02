const test = require('node:test');
const assert = require('node:assert/strict');

const {
  gradeFromScore,
  getLighthouseOverall,
  calculateLighthouseAggregates,
  calculateAccessibilityAggregates
} = require('../src/server/aggregation');

test('getLighthouseOverall averages four category scores equally', () => {
  const score = getLighthouseOverall({
    performance: 80,
    accessibility: 90,
    seo: 100,
    bestPractices: 70
  });

  assert.equal(score, 85);
});

test('calculateLighthouseAggregates returns category means and overall grade', () => {
  const aggregate = calculateLighthouseAggregates([
    { scores: { performance: 80, accessibility: 90, seo: 70, bestPractices: 90 } },
    { scores: { performance: 100, accessibility: 80, seo: 90, bestPractices: 80 } }
  ]);

  assert.equal(aggregate.overall, 85);
  assert.equal(aggregate.grade, 'B');
  assert.equal(aggregate.categories.performance, 90);
  assert.equal(aggregate.categoryGrades.seo, 'B');
});

test('calculateAccessibilityAggregates returns lighthouse score and pa11y index', () => {
  const aggregate = calculateAccessibilityAggregates(
    [
      { scores: { accessibility: 95 } },
      { scores: { accessibility: 85 } }
    ],
    [
      { issues: [{ severity: 'error' }, { severity: 'warning' }] },
      { issues: [{ severity: 'notice' }] }
    ]
  );

  assert.equal(aggregate.lighthouseAccessibility, 90);
  assert.equal(aggregate.lighthouseAccessibilityGrade, 'A');
  assert.equal(aggregate.pa11yIssueIndex, 96);
  assert.equal(aggregate.pa11yIssueIndexGrade, 'A');
  assert.equal(aggregate.severityTotals.error, 1);
});

test('gradeFromScore maps boundary scores', () => {
  assert.equal(gradeFromScore(90), 'A');
  assert.equal(gradeFromScore(80), 'B');
  assert.equal(gradeFromScore(70), 'C');
  assert.equal(gradeFromScore(60), 'D');
  assert.equal(gradeFromScore(59.9), 'F');
});
