const test = require('node:test');
const assert = require('node:assert/strict');

const { buildPagesTree } = require('../src/server/tree');

test('buildPagesTree groups urls into nested path nodes', () => {
  const tree = buildPagesTree([
    'https://example.com/',
    'https://example.com/docs',
    'https://example.com/docs/getting-started',
    'https://example.com/blog/post-1'
  ], {
    'https://example.com/docs': { lighthouse: { overall: 91 } }
  });

  assert.equal(tree.path, '/');
  const docs = tree.children.find((node) => node.name === 'docs');
  assert.ok(docs);
  assert.equal(docs.page.lighthouse.overall, 91);
  const child = docs.children.find((node) => node.name === 'getting-started');
  assert.ok(child);
});
