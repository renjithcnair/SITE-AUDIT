const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

let createApp;
let expressAvailable = true;
try {
  ({ createApp } = require('../src/server/app'));
} catch {
  expressAvailable = false;
}

const allowListen = process.env.SITE_AUDIT_ALLOW_LISTEN === '1';

test('API can start and validate missing url input', { skip: !expressAvailable || !allowListen }, async () => {
  const tempReportDir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'site-audit-api-'));
  const app = createApp({ reportDir: tempReportDir });

  const server = app.listen(0, '127.0.0.1');
  const port = server.address().port;

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/scans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    const body = await response.json();
    assert.equal(response.status, 400);
    assert.match(body.error, /url is required/i);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
