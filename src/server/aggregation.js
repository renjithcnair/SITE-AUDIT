function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function roundScore(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function gradeFromScore(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function getLighthouseOverall(scores) {
  const overall = mean([
    scores.performance || 0,
    scores.accessibility || 0,
    scores.seo || 0,
    scores.bestPractices || 0
  ]);
  return roundScore(overall);
}

function calculateLighthouseAggregates(lighthouseResults) {
  const pageCount = lighthouseResults.length;

  const pageOveralls = lighthouseResults.map((result) => getLighthouseOverall(result.scores || {}));
  const categories = {
    performance: roundScore(mean(lighthouseResults.map((item) => item.scores?.performance || 0))),
    accessibility: roundScore(mean(lighthouseResults.map((item) => item.scores?.accessibility || 0))),
    seo: roundScore(mean(lighthouseResults.map((item) => item.scores?.seo || 0))),
    bestPractices: roundScore(mean(lighthouseResults.map((item) => item.scores?.bestPractices || 0)))
  };

  const overall = roundScore(mean(pageOveralls));

  return {
    pageCount,
    overall,
    grade: gradeFromScore(overall),
    categories,
    categoryGrades: {
      performance: gradeFromScore(categories.performance),
      accessibility: gradeFromScore(categories.accessibility),
      seo: gradeFromScore(categories.seo),
      bestPractices: gradeFromScore(categories.bestPractices)
    }
  };
}

function calculateAccessibilityAggregates(lighthouseResults, accessibilityResults) {
  const lighthouseAccessibility = roundScore(mean(
    lighthouseResults.map((item) => item.scores?.accessibility || 0)
  ));

  const severityWeights = {
    error: 5,
    warning: 2,
    notice: 1
  };

  const severityTotals = {
    error: 0,
    warning: 0,
    notice: 0,
    other: 0
  };

  let weightedPenalty = 0;

  for (const result of accessibilityResults) {
    for (const issue of result.issues || []) {
      const severity = (issue.severity || '').toLowerCase();
      if (severityTotals[severity] === undefined) {
        severityTotals.other += 1;
      } else {
        severityTotals[severity] += 1;
      }

      weightedPenalty += severityWeights[severity] || 1;
    }
  }

  const pageCount = Math.max(accessibilityResults.length, 1);
  const normalizedPenalty = weightedPenalty / pageCount;
  const pa11yIssueIndex = roundScore(clamp(100 - normalizedPenalty, 0, 100));

  return {
    lighthouseAccessibility,
    lighthouseAccessibilityGrade: gradeFromScore(lighthouseAccessibility),
    pa11yIssueIndex,
    pa11yIssueIndexGrade: gradeFromScore(pa11yIssueIndex),
    severityTotals
  };
}

module.exports = {
  gradeFromScore,
  getLighthouseOverall,
  calculateLighthouseAggregates,
  calculateAccessibilityAggregates
};
