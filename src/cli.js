#!/usr/bin/env node
const path = require('node:path');

const { parseTargetUrl } = require('./validators');
const { runAudit } = require('./auditService');
const { writeReports } = require('./report');
const { createLogger } = require('./logger');
const {
  getLighthouseOverall,
  calculateLighthouseAggregates,
  calculateAccessibilityAggregates
} = require('./server/aggregation');
const { buildPagesTree } = require('./server/tree');

const logger = createLogger('cli');

/**
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  const options = {
    url: '',
    maxPages: 50,
    maxDepth: 2,
    pauseMs: 1000,
    reportDir: path.resolve(process.cwd(), 'reports')
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (!arg.startsWith('--') && !options.url) {
      options.url = arg;
      continue;
    }

    if (arg === '--max-pages') options.maxPages = Number(argv[i + 1]);
    if (arg === '--max-depth') options.maxDepth = Number(argv[i + 1]);
    if (arg === '--pause-ms') options.pauseMs = Number(argv[i + 1]);
    if (arg === '--report-dir') options.reportDir = path.resolve(argv[i + 1]);
  }

  return options;
}

function buildPageMetrics(report) {
  const byUrl = {};

  for (const item of report.lighthouse.results) {
    byUrl[item.url] = {
      lighthouse: {
        overall: getLighthouseOverall(item.scores || {}),
        scores: item.scores || {},
        coreWebVitals: item.coreWebVitals || {},
        issueCount: (item.issues || []).length
      }
    };
  }

  for (const item of report.accessibility.results) {
    const current = byUrl[item.url] || {};
    current.accessibility = {
      issueCount: (item.issues || []).length,
      issues: item.issues || []
    };
    byUrl[item.url] = current;
  }

  return byUrl;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.url) {
    logger.error('Missing required url argument', {
      usage: 'node src/cli.js <website-url> [--max-pages N] [--max-depth N] [--pause-ms N] [--report-dir PATH]'
    });
    process.exitCode = 1;
    return;
  }

  try {
    const targetUrl = parseTargetUrl(options.url);

    const report = await runAudit({
      targetUrl,
      maxPages: options.maxPages,
      maxDepth: options.maxDepth,
      pauseMs: options.pauseMs,
      fetchFn: global.fetch,
      sleepFn: sleep,
      onProgress: (event) => {
        if (event.type === 'crawl_error' || event.type === 'page_scan_error') {
          logger.error('Scan progress event', event);
          return;
        }
        if (event.type === 'scan_started') {
          logger.info('Scan started', event);
          return;
        }
        logger.debug('Scan progress event', event);
      }
    });

    const fullReport = {
      ...report,
      aggregates: {
        lighthouse: calculateLighthouseAggregates(report.lighthouse.results),
        accessibility: calculateAccessibilityAggregates(
          report.lighthouse.results,
          report.accessibility.results
        )
      },
      pagesTree: buildPagesTree(report.pagesScanned, buildPageMetrics(report))
    };

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const output = writeReports(fullReport, options.reportDir, `audit-${stamp}`);

    logger.info('Scan complete', {
      pagesScanned: fullReport.pagesScanned.length,
      lighthouseIssueCount: fullReport.lighthouse.issueCount,
      accessibilityIssueCount: fullReport.accessibility.issueCount,
      lighthouseOverall: Math.round(fullReport.aggregates.lighthouse.overall),
      lighthouseGrade: fullReport.aggregates.lighthouse.grade,
      jsonReport: output.jsonPath,
      markdownReport: output.markdownPath
    });
  } catch (error) {
    logger.fatal('Audit failed', {
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  parseArgs,
  buildPageMetrics,
  sleep,
  main
};
