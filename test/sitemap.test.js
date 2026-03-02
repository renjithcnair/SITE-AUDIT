const test = require('node:test');
const assert = require('node:assert/strict');

const { parseSitemapXml, discoverSitemapUrls } = require('../src/sitemap');

test('parseSitemapXml extracts loc entries', () => {
  const xml = `<?xml version="1.0"?><urlset><url><loc>https://example.com/</loc></url><url><loc>https://example.com/about</loc></url></urlset>`;
  assert.deepEqual(parseSitemapXml(xml), ['https://example.com/', 'https://example.com/about']);
});

test('discoverSitemapUrls reads robots.txt sitemap directives', async () => {
  const calls = [];
  const fetchFn = async (url) => {
    calls.push(url);
    if (url === 'https://example.com/robots.txt') {
      return {
        ok: true,
        text: async () => 'User-agent: *\nSitemap: https://example.com/custom-sitemap.xml\n'
      };
    }

    return { ok: false, text: async () => '' };
  };

  const urls = await discoverSitemapUrls(new URL('https://example.com'), { fetchFn });
  assert.equal(calls[0], 'https://example.com/robots.txt');
  assert.deepEqual(urls, ['https://example.com/custom-sitemap.xml', 'https://example.com/sitemap.xml']);
});
