const { discoverSitemapUrls, loadSitemapLinks } = require('./sitemap');
const { crawlSite } = require('./crawler');
const { runLighthouse } = require('./lighthouseRunner');
const { runAccessibility } = require('./accessibilityRunner');
const { summarizeIssues } = require('./summary');

/**
 * @param {{
 *  targetUrl: URL,
 *  maxPages?: number,
 *  maxDepth?: number,
 *  pauseMs?: number,
 *  fetchFn: (url: string) => Promise<{ok: boolean, text: () => Promise<string>}>,
 *  sleepFn: (ms: number) => Promise<void>,
 *  lighthouseRunner?: (url: string) => Promise<any>,
 *  accessibilityRunner?: (url: string) => Promise<any>,
 *  checkControl?: () => Promise<void>,
 *  onProgress?: (event: any) => void
 * }} options
 */
async function runAudit(options) {
  const {
    targetUrl,
    maxPages = 1,
    maxDepth = 2,
    pauseMs = 1000,
    fetchFn,
    sleepFn,
    lighthouseRunner = runLighthouse,
    accessibilityRunner = runAccessibility,
    checkControl,
    onProgress
  } = options;

  const effectiveMaxPages = Number.isFinite(maxPages) && maxPages > 0 ? maxPages : Number.POSITIVE_INFINITY;

  const maybeCheckControl = async () => {
    if (checkControl) {
      await checkControl();
    }
  };

  await maybeCheckControl();
  if (onProgress) {
    onProgress({
      type: 'scan_started',
      target: targetUrl.href,
      maxPages: Number.isFinite(effectiveMaxPages) ? effectiveMaxPages : null,
      maxDepth,
      pauseMs
    });
  }

  const sitemapUrls = await discoverSitemapUrls(targetUrl, { fetchFn });
  if (onProgress) {
    onProgress({ type: 'crawl_progress', phase: 'sitemap_discovery', sitemapUrls });
  }
  const sitemapLinks = await loadSitemapLinks(sitemapUrls, { fetchFn });
  if (onProgress) {
    onProgress({
      type: 'crawl_progress',
      phase: 'sitemap_loaded',
      sitemapLinkCount: sitemapLinks.length
    });
  }

  await maybeCheckControl();
  const crawl = await crawlSite({
    startUrl: targetUrl,
    fetchFn,
    sleepFn,
    pauseMs,
    maxDepth,
    maxPages: effectiveMaxPages,
    sitemapLinks,
    onProgress,
    checkControl: maybeCheckControl
  });

  const lighthouseResults = [];
  const accessibilityResults = [];

  for (let i = 0; i < crawl.pages.length; i += 1) {
    await maybeCheckControl();

    const page = crawl.pages[i];
    if (onProgress) {
      onProgress({
        type: 'page_scan_started',
        url: page,
        current: i + 1,
        total: crawl.pages.length
      });
    }

    const lighthouseResult = await lighthouseRunner(page);
    const accessibilityResult = await accessibilityRunner(page);
    lighthouseResults.push(lighthouseResult);
    accessibilityResults.push(accessibilityResult);

    const lighthouseFailed = lighthouseResult.toolStatus === 'failed';
    const accessibilityFailed = accessibilityResult.toolStatus === 'failed';
    const lcpMs = lighthouseResult.coreWebVitals?.lcpMs ?? null;
    const accessibilityIssueCount = Array.isArray(accessibilityResult.issues)
      ? accessibilityResult.issues.length
      : 0;

    if (onProgress) {
      onProgress({
        type: 'page_scan_completed',
        url: page,
        current: i + 1,
        total: crawl.pages.length,
        lcpMs,
        lighthouseStatus: lighthouseFailed ? 'failed' : 'ok',
        accessibilityStatus: accessibilityFailed ? 'failed' : 'ok',
        accessibilityIssueCount,
        pageStatus: lighthouseFailed || accessibilityFailed ? 'scan_failed' : 'scanned'
      });

      if (lighthouseFailed) {
        const issue = (lighthouseResult.issues || []).find((item) => /failed/i.test(item.title || ''));
        onProgress({
          type: 'page_scan_error',
          url: page,
          stage: 'lighthouse',
          message: issue?.details || issue?.title || 'Lighthouse scan failed.'
        });
      }

      if (accessibilityFailed) {
        const issue = (accessibilityResult.issues || []).find((item) => item.code === 'scan-failed');
        onProgress({
          type: 'page_scan_error',
          url: page,
          stage: 'accessibility',
          message: issue?.details || issue?.title || 'Accessibility scan failed.'
        });
      }

      if (accessibilityIssueCount > 0) {
        onProgress({
          type: 'accessibility_issues_found',
          url: page,
          issueCount: accessibilityIssueCount,
          issues: accessibilityResult.issues || []
        });
      }
    }

    if (i < crawl.pages.length - 1 && pauseMs > 0) {
      await maybeCheckControl();
      await sleepFn(pauseMs);
    }
  }

  const lighthouseIssues = lighthouseResults.flatMap((result) => result.issues || []);
  const accessibilityIssues = accessibilityResults.flatMap((result) => result.issues || []);

  return {
    target: targetUrl.href,
    generatedAt: new Date().toISOString(),
    pagesScanned: crawl.pages,
    crawl: {
      sitemapUrls,
      sitemapLinkCount: sitemapLinks.length,
      errors: crawl.errors,
      duplicateUrlsSkipped: crawl.duplicateUrlsSkipped
    },
    lighthouse: {
      issueCount: lighthouseIssues.length,
      conciseIssues: summarizeIssues(lighthouseIssues, 15),
      results: lighthouseResults
    },
    accessibility: {
      issueCount: accessibilityIssues.length,
      conciseIssues: summarizeIssues(accessibilityIssues, 15),
      results: accessibilityResults
    }
  };
}

module.exports = {
  runAudit
};
