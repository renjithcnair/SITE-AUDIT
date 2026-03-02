/**
 * Extracts href values from raw HTML.
 * @param {string} html
 * @returns {string[]}
 */
function extractLinks(html) {
  const matches = [...html.matchAll(/<a[^>]+href=["']([^"'#]+)["']/gims)];
  return matches.map((match) => match[1].trim()).filter(Boolean);
}

/**
 * @param {string} candidate
 * @param {URL} base
 * @returns {string|null}
 */
function toAbsoluteSameOrigin(candidate, base) {
  try {
    const url = new URL(candidate, base);
    url.hash = '';
    if (url.origin !== base.origin) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

/**
 * Crawls in-site pages from a starting URL and optional sitemap seeds.
 * @param {{
 *  startUrl: URL,
 *  fetchFn: (url: string) => Promise<{ok: boolean, text: () => Promise<string>}>,
 *  sleepFn: (ms: number) => Promise<void>,
 *  pauseMs: number,
 *  maxDepth: number,
 *  maxPages: number,
 *  sitemapLinks?: string[],
 *  onProgress?: (event: any) => void
 *  checkControl?: () => Promise<void>
 * }} options
 * @returns {Promise<{pages: string[], errors: {url: string, reason: string}[], duplicateUrlsSkipped: number}>}
 */
async function crawlSite(options) {
  const {
    startUrl,
    fetchFn,
    sleepFn,
    pauseMs,
    maxDepth,
    maxPages,
    sitemapLinks = [],
    onProgress,
    checkControl
  } = options;

  const queue = [];
  const queued = new Set();
  const seen = new Set();
  const pages = [];
  const errors = [];
  let duplicateUrlsSkipped = 0;

  const pushToQueue = (url, depth, source) => {
    if (seen.has(url) || queued.has(url)) {
      duplicateUrlsSkipped += 1;
      if (onProgress) {
        onProgress({
          type: 'duplicate_url_skipped',
          url,
          depth,
          source,
          duplicateUrlsSkipped
        });
      }
      return false;
    }

    queue.push({ url, depth });
    queued.add(url);
    return true;
  };

  const seed = startUrl.href;
  pushToQueue(seed, 0, 'seed');

  for (const sitemapLink of sitemapLinks) {
    const absolute = toAbsoluteSameOrigin(sitemapLink, startUrl);
    if (!absolute) continue;
    pushToQueue(absolute, 0, 'sitemap');
  }

  while (queue.length > 0 && (Number.isFinite(maxPages) ? pages.length < maxPages : true)) {
    if (checkControl) {
      await checkControl();
    }

    const current = queue.shift();
    if (current) {
      queued.delete(current.url);
    }
    if (!current || seen.has(current.url)) {
      continue;
    }

    seen.add(current.url);
    pages.push(current.url);
    if (onProgress) {
      onProgress({
        type: 'page_discovered',
        url: current.url,
        depth: current.depth,
        discoveredCount: pages.length
      });
    }

    try {
      const response = await fetchFn(current.url);
      let fetchErrorReason = null;
      if (!response.ok) {
        fetchErrorReason = response.status
          ? `Failed to fetch page content (HTTP ${response.status}).`
          : 'Failed to fetch page content.';
        errors.push({ url: current.url, reason: fetchErrorReason });
        if (onProgress) {
          onProgress({
            type: 'crawl_error',
            url: current.url,
            statusCode: response.status || null,
            reason: fetchErrorReason
          });
        }
      } else if (onProgress) {
        onProgress({
          type: 'page_crawled',
          url: current.url,
          depth: current.depth,
          status: 'ok',
          statusCode: response.status || 200
        });
      }

      if (response.ok && current.depth < maxDepth) {
        const html = await response.text();
        const links = extractLinks(html);
        for (const link of links) {
          const absolute = toAbsoluteSameOrigin(link, startUrl);
          if (!absolute) {
            continue;
          }
          pushToQueue(absolute, current.depth + 1, 'link');
        }
      } else if (!response.ok) {
        if (onProgress) {
          onProgress({
            type: 'page_crawled',
            url: current.url,
            depth: current.depth,
            status: 'error',
            statusCode: response.status || null,
            reason: fetchErrorReason
          });
        }
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unexpected crawl error.';
      errors.push({
        url: current.url,
        reason
      });
      if (onProgress) {
        onProgress({
          type: 'crawl_error',
          url: current.url,
          statusCode: null,
          reason
        });
        onProgress({
          type: 'page_crawled',
          url: current.url,
          depth: current.depth,
          status: 'error',
          statusCode: null,
          reason
        });
      }
    }

    if (onProgress) {
      onProgress({
        type: 'crawl_progress',
        scannedCount: pages.length,
        queuedCount: queue.length,
        errorCount: errors.length,
        duplicateUrlsSkipped
      });
    }

    if (
      queue.length > 0 &&
      (Number.isFinite(maxPages) ? pages.length < maxPages : true) &&
      pauseMs > 0
    ) {
      if (checkControl) {
        await checkControl();
      }
      await sleepFn(pauseMs);
    }
  }

  return { pages, errors, duplicateUrlsSkipped };
}

module.exports = {
  crawlSite,
  extractLinks
};
