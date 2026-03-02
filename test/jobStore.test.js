const test = require('node:test');
const assert = require('node:assert/strict');

const { JobStore } = require('../src/server/jobStore');

test('JobStore creates and updates jobs', () => {
  const store = new JobStore();
  const job = store.createJob({ url: 'https://example.com' });

  assert.equal(job.status, 'queued');
  store.patch(job.id, { status: 'running' });
  assert.equal(store.get(job.id).status, 'running');

  const event = store.appendEvent(job.id, { type: 'scan_started', payload: {} });
  assert.equal(event.type, 'scan_started');
  assert.equal(store.get(job.id).events.length, 1);
});
