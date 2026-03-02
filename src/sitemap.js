/**
 * Parses an XML sitemap and extracts all <loc> values.
 * @param {string} xml
 * @returns {string[]}
 */
function parseSitemapXml(xml) {
  const matches = [...xml.matchAll(/<loc>(.*?)<\/loc>/gims)];
  return matches.map((match) => match[1].trim()).filter(Boolean);
}

/**
 * Finds sitemap URLs via robots.txt and a default /sitemap.xml fallback.
 * @param {URL} baseUrl
 * @param {{ fetchFn: (url: string) => Promise<{ok: boolean, text: () => Promise<string>}> }} deps
 * @returns {Promise<string[]>}
 */
async function discoverSitemapUrls(baseUrl, { fetchFn }) {
  const robotsUrl = new URL('/robots.txt', baseUrl).href;
  const discovered = [];

  try {
    const res = await fetchFn(robotsUrl);
    if (res.ok) {
      const text = await res.text();
      const lines = text.split(/\r?\n/);

      for (const line of lines) {
        const match = line.match(/^\s*Sitemap:\s*(\S+)\s*$/i);
        if (match) {
          discovered.push(match[1]);
        }
      }
    }
  } catch {
    // robots.txt can be absent or blocked.
  }

  discovered.push(new URL('/sitemap.xml', baseUrl).href);
  return [...new Set(discovered)];
}

/**
 * Downloads and parses all available sitemap files.
 * @param {string[]} sitemapUrls
 * @param {{ fetchFn: (url: string) => Promise<{ok: boolean, text: () => Promise<string>}> }} deps
 * @returns {Promise<string[]>}
 */
async function loadSitemapLinks(sitemapUrls, { fetchFn }) {
  const found = [];

  for (const sitemapUrl of sitemapUrls) {
    try {
      const res = await fetchFn(sitemapUrl);
      if (!res.ok) {
        continue;
      }
      const xml = await res.text();
      found.push(...parseSitemapXml(xml));
    } catch {
      // Continue with other sitemap files.
    }
  }

  return [...new Set(found)];
}

module.exports = {
  parseSitemapXml,
  discoverSitemapUrls,
  loadSitemapLinks
};
