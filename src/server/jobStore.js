const { randomUUID } = require('node:crypto');

class JobStore {
  constructor() {
    this.jobs = new Map();
  }

  createJob(input) {
    const id = randomUUID();
    const now = new Date().toISOString();

    const job = {
      id,
      status: 'queued',
      createdAt: now,
      updatedAt: now,
      input,
      progress: {
        discoveredCount: 0,
        scannedCount: 0,
        totalPages: 0,
        errorCount: 0,
        duplicateUrlsSkipped: 0,
        phase: 'queued',
        startedAt: null,
        endedAt: null,
        elapsedMs: 0
      },
      control: {
        paused: false,
        stopped: false
      },
      clearMarks: {
        livePageStatus: null,
        liveAccessibilityIssues: null,
        errorsByUrl: null,
        scannedUrls: null,
        recentUpdates: null
      },
      pagesDiscovered: [],
      events: [],
      report: null,
      reportPaths: null,
      error: null,
      clients: new Set()
    };

    this.jobs.set(id, job);
    return job;
  }

  get(id) {
    return this.jobs.get(id) || null;
  }

  getRunningJob() {
    for (const job of this.jobs.values()) {
      if (
        job.status === 'running' ||
        job.status === 'queued' ||
        job.status === 'paused' ||
        job.status === 'stopping'
      ) {
        return job;
      }
    }
    return null;
  }

  patch(id, changes) {
    const job = this.get(id);
    if (!job) return null;

    Object.assign(job, changes);
    job.updatedAt = new Date().toISOString();
    return job;
  }

  appendEvent(id, event) {
    const job = this.get(id);
    if (!job) return null;

    const stamped = {
      at: new Date().toISOString(),
      ...event
    };

    job.events.push(stamped);
    if (job.events.length > 2000) {
      job.events.shift();
    }

    return stamped;
  }

  addClient(id, res) {
    const job = this.get(id);
    if (!job) return false;
    job.clients.add(res);
    return true;
  }

  removeClient(id, res) {
    const job = this.get(id);
    if (!job) return;
    job.clients.delete(res);
  }

  forEachClient(id, callback) {
    const job = this.get(id);
    if (!job) return;

    for (const client of job.clients) {
      callback(client);
    }
  }
}

module.exports = {
  JobStore
};
