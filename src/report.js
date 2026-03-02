const fs = require('node:fs');
const path = require('node:path');

/**
 * @param {any} report
 * @returns {string}
 */
function renderMarkdownReport(report) {
  const lighthouseLines = report.lighthouse.conciseIssues.length
    ? report.lighthouse.conciseIssues.map((issue) => `- ${issue.title} (count: ${issue.count})`).join('\n')
    : '- No Lighthouse/Core Web Vitals issues detected.';

  const accessibilityLines = report.accessibility.conciseIssues.length
    ? report.accessibility.conciseIssues.map((issue) => `- ${issue.title} (count: ${issue.count})`).join('\n')
    : '- No accessibility issues detected.';

  const crawlErrorLines = report.crawl.errors.length
    ? report.crawl.errors.map((err) => `- ${err.url}: ${err.reason}`).join('\n')
    : '- No crawl errors.';

  const lighthouseAggregateLines = report.aggregates?.lighthouse
    ? [
      `- Overall: ${Math.round(report.aggregates.lighthouse.overall)} (${report.aggregates.lighthouse.grade})`,
      `- Performance: ${Math.round(report.aggregates.lighthouse.categories.performance)} (${report.aggregates.lighthouse.categoryGrades.performance})`,
      `- Accessibility: ${Math.round(report.aggregates.lighthouse.categories.accessibility)} (${report.aggregates.lighthouse.categoryGrades.accessibility})`,
      `- SEO: ${Math.round(report.aggregates.lighthouse.categories.seo)} (${report.aggregates.lighthouse.categoryGrades.seo})`,
      `- Best Practices: ${Math.round(report.aggregates.lighthouse.categories.bestPractices)} (${report.aggregates.lighthouse.categoryGrades.bestPractices})`
    ].join('\n')
    : '- Aggregate Lighthouse scores are unavailable.';

  const accessibilityAggregateLines = report.aggregates?.accessibility
    ? [
      `- Lighthouse Accessibility: ${Math.round(report.aggregates.accessibility.lighthouseAccessibility)} (${report.aggregates.accessibility.lighthouseAccessibilityGrade})`,
      `- Pa11y Issue Index: ${Math.round(report.aggregates.accessibility.pa11yIssueIndex)} (${report.aggregates.accessibility.pa11yIssueIndexGrade})`
    ].join('\n')
    : '- Aggregate accessibility scores are unavailable.';

  return `# Site Audit Report\n\n` +
    `- Target: ${report.target}\n` +
    `- Generated At (UTC): ${report.generatedAt}\n` +
    `- Pages Scanned: ${report.pagesScanned.length}\n\n` +
    `## Aggregate Scores\n\n` +
    `### Lighthouse\n\n` +
    `${lighthouseAggregateLines}\n\n` +
    `### Accessibility\n\n` +
    `${accessibilityAggregateLines}\n\n` +
    `## Lighthouse & Core Web Vitals\n\n` +
    `${lighthouseLines}\n\n` +
    `## Accessibility Findings\n\n` +
    `${accessibilityLines}\n\n` +
    `## Crawl Errors\n\n` +
    `${crawlErrorLines}\n`;
}

/**
 * @param {any} report
 * @param {string} reportDir
 * @param {string} baseName
 */
function writeReports(report, reportDir, baseName) {
  fs.mkdirSync(reportDir, { recursive: true });
  const jsonPath = path.join(reportDir, `${baseName}.json`);
  const markdownPath = path.join(reportDir, `${baseName}.md`);

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(markdownPath, renderMarkdownReport(report));

  return { jsonPath, markdownPath };
}

module.exports = {
  renderMarkdownReport,
  writeReports
};
