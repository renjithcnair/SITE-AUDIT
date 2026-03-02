const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

const THRESHOLDS = {
  performance: 90,
  accessibility: 90,
  seo: 90,
  bestPractices: 90,
  lcpMs: 2500,
  cls: 0.1,
  inpMs: 200
};

/**
 * @param {any} json
 * @returns {{scores: {performance: number, accessibility: number, seo: number, bestPractices: number}, coreWebVitals: {lcpMs: number|null, cls: number|null, inpMs: number|null}}}
 */
function parseLighthouseJson(json) {
  const categoryScore = (name) => Math.round(((json?.categories?.[name]?.score ?? 0) * 100));
  return {
    scores: {
      performance: categoryScore('performance'),
      accessibility: categoryScore('accessibility'),
      seo: categoryScore('seo'),
      bestPractices: categoryScore('best-practices')
    },
    coreWebVitals: {
      lcpMs: json?.audits?.['largest-contentful-paint']?.numericValue ?? null,
      cls: json?.audits?.['cumulative-layout-shift']?.numericValue ?? null,
      inpMs: json?.audits?.['interaction-to-next-paint']?.numericValue ?? null
    }
  };
}

/**
 * @param {{scores: {performance:number, accessibility:number, seo:number, bestPractices:number}, coreWebVitals: {lcpMs:number|null, cls:number|null, inpMs:number|null}}} parsed
 * @returns {{title: string, details: string}[]}
 */
function buildLighthouseIssues(parsed) {
  const issues = [];

  if (parsed.scores.performance < THRESHOLDS.performance) {
    issues.push({ title: 'Low performance score', details: `Performance ${parsed.scores.performance} < ${THRESHOLDS.performance}` });
  }
  if (parsed.scores.accessibility < THRESHOLDS.accessibility) {
    issues.push({ title: 'Low accessibility score', details: `Accessibility ${parsed.scores.accessibility} < ${THRESHOLDS.accessibility}` });
  }
  if (parsed.scores.seo < THRESHOLDS.seo) {
    issues.push({ title: 'Low SEO score', details: `SEO ${parsed.scores.seo} < ${THRESHOLDS.seo}` });
  }
  if (parsed.scores.bestPractices < THRESHOLDS.bestPractices) {
    issues.push({ title: 'Low best-practices score', details: `Best Practices ${parsed.scores.bestPractices} < ${THRESHOLDS.bestPractices}` });
  }

  if (typeof parsed.coreWebVitals.lcpMs === 'number' && parsed.coreWebVitals.lcpMs > THRESHOLDS.lcpMs) {
    issues.push({ title: 'LCP exceeds threshold', details: `LCP ${parsed.coreWebVitals.lcpMs}ms > ${THRESHOLDS.lcpMs}ms` });
  }
  if (typeof parsed.coreWebVitals.cls === 'number' && parsed.coreWebVitals.cls > THRESHOLDS.cls) {
    issues.push({ title: 'CLS exceeds threshold', details: `CLS ${parsed.coreWebVitals.cls} > ${THRESHOLDS.cls}` });
  }
  if (typeof parsed.coreWebVitals.inpMs === 'number' && parsed.coreWebVitals.inpMs > THRESHOLDS.inpMs) {
    issues.push({ title: 'INP exceeds threshold', details: `INP ${parsed.coreWebVitals.inpMs}ms > ${THRESHOLDS.inpMs}ms` });
  }

  return issues;
}

/**
 * @param {string} url
 * @param {{ execFileFn?: typeof execFileAsync, timeoutMs?: number }} [deps]
 */
async function runLighthouse(url, deps = {}) {
  const execFileFn = deps.execFileFn || execFileAsync;
  const timeoutMs = deps.timeoutMs || 120000;

  try {
    const { stdout } = await execFileFn('lighthouse', [
      url,
      '--quiet',
      '--chrome-flags=--headless',
      '--output=json',
      '--output-path=stdout',
      '--only-categories=performance,accessibility,seo,best-practices'
    ], { timeout: timeoutMs, maxBuffer: 20 * 1024 * 1024 });

    const parsed = parseLighthouseJson(JSON.parse(stdout));
    return {
      url,
      ...parsed,
      issues: buildLighthouseIssues(parsed),
      toolStatus: 'ok'
    };
  } catch (error) {
    return {
      url,
      scores: { performance: 0, accessibility: 0, seo: 0, bestPractices: 0 },
      coreWebVitals: { lcpMs: null, cls: null, inpMs: null },
      issues: [{ title: 'Lighthouse scan failed', details: error instanceof Error ? error.message : 'Unknown error' }],
      toolStatus: 'failed'
    };
  }
}

module.exports = {
  runLighthouse,
  parseLighthouseJson,
  buildLighthouseIssues,
  THRESHOLDS
};
