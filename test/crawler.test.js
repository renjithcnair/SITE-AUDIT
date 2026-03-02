const test = require('node:test');
const assert = require('node:assert/strict');

const { crawlSite } = require('../src/crawler');

test('crawlSite crawls same-origin links and respects maxDepth/maxPages', async () => {
  const pages = {
    'https://example.com/': '<a href="/a">A</a><a href="https://example.com/b">B</a><a href="https://other.com/x">X</a>',
    'https://example.com/a': '<a href="/c">C</a>',
    'https://example.com/b': '<a href="/d">D</a>',
    'https://example.com/c': '<a href="/e">E</a>'
  };

  const fetchFn = async (url) => ({
    ok: Boolean(pages[url]),
    text: async () => pages[url] || ''
  });

  const sleepCalls = [];
  const progressEvents = [];
  const sleepFn = async (ms) => {
    sleepCalls.push(ms);
  };

  const result = await crawlSite({
    startUrl: new URL('https://example.com/'),
    fetchFn,
    sleepFn,
    pauseMs: 100,
    maxDepth: 1,
    maxPages: 3,
    sitemapLinks: ['https://example.com/sitemap-page'],
    onProgress: (event) => progressEvents.push(event.type)
  });

  assert.deepEqual(result.pages, [
    'https://example.com/',
    'https://example.com/sitemap-page',
    'https://example.com/a'
  ]);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].reason, /failed to fetch/i);
  assert.ok(sleepCalls.length >= 2);
  assert.ok(progressEvents.includes('page_discovered'));
  assert.ok(progressEvents.includes('crawl_progress'));
});

test('crawlSite avoids scanning the same URL more than once', async () => {
  const pages = {
    'https://example.com/': '<a href="/same">same</a><a href="/same">same-again</a>',
    'https://example.com/same': '<html></html>'
  };

  const result = await crawlSite({
    startUrl: new URL('https://example.com/'),
    fetchFn: async (url) => ({
      ok: Boolean(pages[url]),
      text: async () => pages[url] || '',
      status: pages[url] ? 200 : 404
    }),
    sleepFn: async () => {},
    pauseMs: 0,
    maxDepth: 2,
    maxPages: 10,
    sitemapLinks: ['https://example.com/same']
  });

  assert.deepEqual(result.pages, [
    'https://example.com/',
    'https://example.com/same'
  ]);
  assert.equal(result.duplicateUrlsSkipped, 2);
});
