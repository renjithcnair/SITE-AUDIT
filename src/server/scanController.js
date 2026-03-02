const path = require('node:path');

const { parseTargetUrl } = require('../validators');
const { runAudit } = require('../auditService');
const { writeReports } = require('../report');
const { resolveScannerProvider } = require('../providers');
const { createLogger } = require('../logger');
const {
  getLighthouseOverall,
  calculateLighthouseAggregates,
  calculateAccessibilityAggregates
} = require('./aggregation');
const { buildPagesTree } = require('./tree');
const { setSseHeaders, sendSse } = require('./progress');

const ACTIVE_STATUSES = new Set(['queued', 'running', 'paused', 'stopping']);
const STOPPED_ERROR_CODE = 'scan_stopped';
const VIEW_SECTIONS = [
  'livePageStatus',
  'liveAccessibilityIssues',
  'errorsByUrl',
  'scannedUrls',
  'recentUpdates'
];
const logger = createLogger('scan-controller');

function defaultClearMarks() {
  return {
    livePageStatus: null,
    liveAccessibilityIssues: null,
    errorsByUrl: null,
    scannedUrls: null,
    recentUpdates: null
  };
}

function sanitizeScanOptions(body) {
  const rawMaxPages = body?.maxPages;
  const hasMaxPages = rawMaxPages !== undefined && rawMaxPages !== null && String(rawMaxPages).trim() !== '';

  return {
    maxPages: hasMaxPages && Number(rawMaxPages) > 0 ? Math.min(Number(rawMaxPages), 500) : null,
    maxDepth: Number(body?.maxDepth) >= 0 ? Math.min(Number(body.maxDepth), 10) : 2,
    pauseMs: Number(body?.pauseMs) >= 0 ? Math.min(Number(body.pauseMs), 10000) : 1000
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function elapsedMsFromProgress(progress) {
  if (!progress?.startedAt) {
    return 0;
  }

  const startMs = Date.parse(progress.startedAt);
  if (Number.isNaN(startMs)) {
    return 0;
  }

  const endMs = progress.endedAt ? Date.parse(progress.endedAt) : Date.now();
  if (Number.isNaN(endMs)) {
    return 0;
  }

  return Math.max(0, endMs - startMs);
}

function withElapsedProgress(progress) {
  return {
    ...(progress || {}),
    elapsedMs: elapsedMsFromProgress(progress || {})
  };
}

function withClearMarks(clearMarks) {
  return {
    ...defaultClearMarks(),
    ...(clearMarks || {})
  };
}

function createStoppedError() {
  const error = new Error('Scan stopped by user.');
  error.code = STOPPED_ERROR_CODE;
  return error;
}

function createCustomerSummary(lighthouseAggregate, accessibilityAggregate) {
  const performanceState = lighthouseAggregate.overall >= 90
    ? 'excellent'
    : lighthouseAggregate.overall >= 70
      ? 'good but can be improved'
      : 'needs attention';

  const a11yState = accessibilityAggregate.pa11yIssueIndex >= 90
    ? 'strong accessibility health'
    : accessibilityAggregate.pa11yIssueIndex >= 70
      ? 'moderate accessibility risk'
      : 'high accessibility risk';

  return {
    headline: `Overall site quality is ${performanceState}.`,
    accessibility: `Accessibility posture shows ${a11yState}.`,
    topActions: [
      'Fix repeated accessibility issues first because they impact multiple pages.',
      'Improve low Lighthouse category scores beginning with performance.',
      'Re-run scans after fixes to verify score recovery.'
    ]
  };
}

function buildPageMetrics(report) {
  const byUrl = {};

  for (const item of report.lighthouse.results) {
    byUrl[item.url] = {
      lighthouse: {
        overall: getLighthouseOverall(item.scores || {}),
        scores: item.scores || {},
        coreWebVitals: item.coreWebVitals || {},
        issueCount: (item.issues || []).length
      }
    };
  }

  for (const item of report.accessibility.results) {
    const current = byUrl[item.url] || {};
    current.accessibility = {
      issueCount: (item.issues || []).length,
      issues: item.issues || []
    };
    byUrl[item.url] = current;
  }

  return byUrl;
}

function createScanController({ jobStore, reportDir }) {
  function appendAndBroadcast(jobId, type, payload = {}) {
    const job = jobStore.get(jobId);
    if (!job) return null;

    const withElapsed = {
      ...payload,
      elapsedMs: payload.elapsedMs ?? elapsedMsFromProgress(job.progress)
    };
    const appended = jobStore.appendEvent(jobId, {
      type,
      payload: withElapsed
    });
    if (!appended) return null;
    const ssePayload = {
      ...appended.payload,
      at: appended.at
    };

    if (type === 'scan_failed' || type === 'crawl_error' || type === 'page_scan_error') {
      logger.error('Scan event emitted', { jobId, type, payload: withElapsed });
    } else if (type === 'scan_completed' || type === 'scan_started' || type === 'scan_paused' || type === 'scan_resumed' || type === 'scan_stopped') {
      logger.info('Scan event emitted', { jobId, type, payload: withElapsed });
    } else {
      logger.debug('Scan event emitted', { jobId, type, payload: withElapsed });
    }

    jobStore.forEachClient(jobId, (res) => sendSse(res, appended.type, ssePayload));
    return appended;
  }

  async function waitForRunPermission(jobId) {
    while (true) {
      const job = jobStore.get(jobId);
      if (!job || job.control?.stopped) {
        throw createStoppedError();
      }

      if (!job.control?.paused) {
        return;
      }

      await sleep(250);
    }
  }

  async function runJob(job) {
    const provider = resolveScannerProvider();
    const startedAt = new Date().toISOString();

    logger.info('Scan job started', {
      jobId: job.id,
      url: job.input.url,
      maxPages: job.input.maxPages,
      maxDepth: job.input.maxDepth,
      pauseMs: job.input.pauseMs
    });

    jobStore.patch(job.id, {
      status: 'running',
      control: {
        ...(job.control || {}),
        paused: false,
        stopped: false
      },
      progress: {
        ...job.progress,
        phase: 'running',
        startedAt,
        endedAt: null,
        elapsedMs: 0
      }
    });

    try {
      const auditReport = await runAudit({
        targetUrl: parseTargetUrl(job.input.url),
        maxPages: job.input.maxPages,
        maxDepth: job.input.maxDepth,
        pauseMs: job.input.pauseMs,
        fetchFn: global.fetch,
        sleepFn: sleep,
        lighthouseRunner: provider.runLighthouse,
        accessibilityRunner: provider.runAccessibility,
        checkControl: async () => {
          await waitForRunPermission(job.id);
        },
        onProgress: (event) => {
          const jobState = jobStore.get(job.id);
          if (!jobState) return;

          if (event.type === 'page_discovered') {
            if (!jobState.pagesDiscovered.includes(event.url)) {
              jobState.pagesDiscovered.push(event.url);
            }
            jobState.progress.discoveredCount = jobState.pagesDiscovered.length;
          }

          if (event.type === 'page_scan_started' || event.type === 'page_scan_completed') {
            jobState.progress.scannedCount = event.current;
            jobState.progress.totalPages = event.total;
          }

          if (event.type === 'crawl_progress') {
            jobState.progress.errorCount = event.errorCount ?? jobState.progress.errorCount;
            jobState.progress.queuedCount = event.queuedCount ?? jobState.progress.queuedCount;
            jobState.progress.duplicateUrlsSkipped = event.duplicateUrlsSkipped ?? jobState.progress.duplicateUrlsSkipped;
          }

          if (event.type === 'crawl_error' || event.type === 'page_scan_error') {
            jobState.progress.errorCount = (jobState.progress.errorCount || 0) + 1;
          }

          if (event.type === 'duplicate_url_skipped') {
            jobState.progress.duplicateUrlsSkipped = event.duplicateUrlsSkipped ?? jobState.progress.duplicateUrlsSkipped;
          }

          jobState.progress.phase = event.type;
          jobState.progress.elapsedMs = elapsedMsFromProgress(jobState.progress);
          appendAndBroadcast(job.id, event.type, event);
        }
      });

      const lighthouseAggregate = calculateLighthouseAggregates(auditReport.lighthouse.results);
      const accessibilityAggregate = calculateAccessibilityAggregates(
        auditReport.lighthouse.results,
        auditReport.accessibility.results
      );
      const pageMetricsByUrl = buildPageMetrics(auditReport);
      const pagesTree = buildPagesTree(auditReport.pagesScanned, pageMetricsByUrl);
      const customerSummary = createCustomerSummary(lighthouseAggregate, accessibilityAggregate);

      const fullReport = {
        ...auditReport,
        aggregates: {
          lighthouse: lighthouseAggregate,
          accessibility: accessibilityAggregate
        },
        pagesTree,
        customerSummary
      };

      const output = writeReports(
        fullReport,
        reportDir,
        `scan-${job.id}`
      );

      const current = jobStore.get(job.id);
      const endedAt = new Date().toISOString();
      const completedProgress = {
        ...(current?.progress || {}),
        phase: 'completed',
        scannedCount: fullReport.pagesScanned.length,
        totalPages: fullReport.pagesScanned.length,
        errorCount: fullReport.crawl.errors.length,
        duplicateUrlsSkipped: fullReport.crawl.duplicateUrlsSkipped || 0,
        endedAt
      };
      completedProgress.elapsedMs = elapsedMsFromProgress(completedProgress);

      jobStore.patch(job.id, {
        status: 'completed',
        report: fullReport,
        reportPaths: output,
        progress: completedProgress
      });

      appendAndBroadcast(job.id, 'scan_completed', {
        scanId: job.id,
        pagesScanned: fullReport.pagesScanned.length,
        lighthouseOverall: fullReport.aggregates.lighthouse.overall,
        accessibilityIndex: fullReport.aggregates.accessibility.pa11yIssueIndex,
        duplicateUrlsSkipped: fullReport.crawl.duplicateUrlsSkipped || 0
      });
      logger.info('Scan job completed', {
        jobId: job.id,
        pagesScanned: fullReport.pagesScanned.length,
        errors: fullReport.crawl.errors.length,
        duplicateUrlsSkipped: fullReport.crawl.duplicateUrlsSkipped || 0
      });
    } catch (error) {
      const current = jobStore.get(job.id);
      if (!current) return;

      const endedAt = new Date().toISOString();

      if (error?.code === STOPPED_ERROR_CODE) {
        const stoppedProgress = {
          ...(current.progress || {}),
          phase: 'stopped',
          endedAt
        };
        stoppedProgress.elapsedMs = elapsedMsFromProgress(stoppedProgress);

        jobStore.patch(job.id, {
          status: 'stopped',
          progress: stoppedProgress
        });

        appendAndBroadcast(job.id, 'scan_stopped', {
          scanId: job.id,
          message: 'Scan stopped by user.'
        });
        logger.info('Scan job stopped', { jobId: job.id });
        return;
      }

      const message = error instanceof Error ? error.message : 'Unknown scan failure';
      const failedProgress = {
        ...(current.progress || {}),
        phase: 'failed',
        endedAt
      };
      failedProgress.elapsedMs = elapsedMsFromProgress(failedProgress);

      jobStore.patch(job.id, {
        status: 'failed',
        error: message,
        progress: failedProgress
      });

      appendAndBroadcast(job.id, 'scan_failed', {
        scanId: job.id,
        message
      });
      logger.error('Scan job failed', { jobId: job.id, message });
    }
  }

  async function startScan(req, res) {
    const running = jobStore.getRunningJob();
    if (running) {
      logger.error('Scan start rejected because another scan is active', {
        activeScanId: running.id,
        activeStatus: running.status
      });
      res.statusCode = 409;
      res.json({
        error: 'Another scan is currently running.',
        activeScanId: running.id
      });
      return;
    }

    const url = req.body?.url;
    if (!url) {
      logger.error('Scan start rejected because url is missing');
      res.statusCode = 400;
      res.json({ error: 'url is required' });
      return;
    }

    try {
      parseTargetUrl(url);
    } catch (error) {
      logger.error('Scan start rejected because url is invalid', {
        url,
        message: error instanceof Error ? error.message : 'Invalid URL'
      });
      res.statusCode = 400;
      res.json({ error: error instanceof Error ? error.message : 'Invalid URL' });
      return;
    }

    const options = sanitizeScanOptions(req.body);
    const job = jobStore.createJob({
      url,
      ...options
    });

    logger.info('Scan job created', { jobId: job.id, url, ...options });

    void runJob(job);

    res.statusCode = 202;
    res.json({
      scanId: job.id,
      status: 'running'
    });
  }

  function getScan(req, res) {
    const job = jobStore.get(req.params.scanId);
    if (!job) {
      logger.error('Scan lookup failed', { scanId: req.params.scanId });
      res.statusCode = 404;
      res.json({ error: 'Scan not found' });
      return;
    }

    res.json({
      scanId: job.id,
      status: job.status,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      input: job.input,
      progress: withElapsedProgress(job.progress),
      control: job.control,
      clearMarks: withClearMarks(job.clearMarks),
      pagesDiscovered: job.pagesDiscovered,
      events: job.events,
      report: job.report,
      error: job.error
    });
  }

  function scanEvents(req, res) {
    const scanId = req.params.scanId;
    const job = jobStore.get(scanId);
    if (!job) {
      logger.error('SSE connection rejected for unknown scan', { scanId });
      res.statusCode = 404;
      res.json({ error: 'Scan not found' });
      return;
    }

    setSseHeaders(res);
    jobStore.addClient(scanId, res);
    logger.debug('SSE client connected', { scanId });

    sendSse(res, 'connected', {
      scanId,
      status: job.status,
      progress: withElapsedProgress(job.progress),
      clearMarks: withClearMarks(job.clearMarks)
    });

    for (const event of job.events.slice(-50)) {
      sendSse(res, event.type, {
        ...(event.payload || {}),
        at: event.at
      });
    }

    req.on('close', () => {
      jobStore.removeClient(scanId, res);
      logger.debug('SSE client disconnected', { scanId });
    });
  }

  function pauseScan(req, res) {
    const job = jobStore.get(req.params.scanId);
    if (!job) {
      logger.error('Pause rejected for unknown scan', { scanId: req.params.scanId });
      res.statusCode = 404;
      res.json({ error: 'Scan not found' });
      return;
    }

    if (!ACTIVE_STATUSES.has(job.status) || job.status === 'paused') {
      logger.error('Pause rejected for current scan status', { scanId: job.id, status: job.status });
      res.statusCode = 409;
      res.json({ error: 'Scan cannot be paused in its current state.' });
      return;
    }

    const progress = {
      ...(job.progress || {}),
      phase: 'paused'
    };
    progress.elapsedMs = elapsedMsFromProgress(progress);

    jobStore.patch(job.id, {
      status: 'paused',
      control: {
        ...(job.control || {}),
        paused: true
      },
      progress
    });

    appendAndBroadcast(job.id, 'scan_paused', {
      scanId: job.id,
      message: 'Scan paused.'
    });
    logger.info('Scan paused', { scanId: job.id });

    res.json({
      scanId: job.id,
      status: 'paused'
    });
  }

  function resumeScan(req, res) {
    const job = jobStore.get(req.params.scanId);
    if (!job) {
      logger.error('Resume rejected for unknown scan', { scanId: req.params.scanId });
      res.statusCode = 404;
      res.json({ error: 'Scan not found' });
      return;
    }

    if (job.status !== 'paused') {
      logger.error('Resume rejected for current scan status', { scanId: job.id, status: job.status });
      res.statusCode = 409;
      res.json({ error: 'Scan is not paused.' });
      return;
    }

    const progress = {
      ...(job.progress || {}),
      phase: 'running',
      endedAt: null
    };
    progress.elapsedMs = elapsedMsFromProgress(progress);

    jobStore.patch(job.id, {
      status: 'running',
      control: {
        ...(job.control || {}),
        paused: false
      },
      progress
    });

    appendAndBroadcast(job.id, 'scan_resumed', {
      scanId: job.id,
      message: 'Scan resumed.'
    });
    logger.info('Scan resumed', { scanId: job.id });

    res.json({
      scanId: job.id,
      status: 'running'
    });
  }

  function stopScan(req, res) {
    const job = jobStore.get(req.params.scanId);
    if (!job) {
      logger.error('Stop rejected for unknown scan', { scanId: req.params.scanId });
      res.statusCode = 404;
      res.json({ error: 'Scan not found' });
      return;
    }

    if (!ACTIVE_STATUSES.has(job.status) && job.status !== 'paused') {
      logger.error('Stop rejected for current scan status', { scanId: job.id, status: job.status });
      res.statusCode = 409;
      res.json({ error: 'Scan cannot be stopped in its current state.' });
      return;
    }

    const progress = {
      ...(job.progress || {}),
      phase: 'stopping'
    };
    progress.elapsedMs = elapsedMsFromProgress(progress);

    jobStore.patch(job.id, {
      status: 'stopping',
      control: {
        ...(job.control || {}),
        paused: false,
        stopped: true
      },
      progress
    });

    appendAndBroadcast(job.id, 'scan_stopping', {
      scanId: job.id,
      message: 'Stopping scan...'
    });
    logger.info('Scan stopping requested', { scanId: job.id });

    res.json({
      scanId: job.id,
      status: 'stopping'
    });
  }

  async function restartScan(req, res) {
    const sourceJob = jobStore.get(req.params.scanId);
    if (!sourceJob) {
      logger.error('Restart rejected for unknown scan', { scanId: req.params.scanId });
      res.statusCode = 404;
      res.json({ error: 'Scan not found' });
      return;
    }

    if (ACTIVE_STATUSES.has(sourceJob.status)) {
      logger.error('Restart rejected because scan is still active', {
        scanId: sourceJob.id,
        status: sourceJob.status
      });
      res.statusCode = 409;
      res.json({ error: 'Stop the active scan before restarting.' });
      return;
    }

    const running = jobStore.getRunningJob();
    if (running) {
      logger.error('Restart rejected because another scan is active', {
        requestedScanId: sourceJob.id,
        activeScanId: running.id
      });
      res.statusCode = 409;
      res.json({
        error: 'Another scan is currently running.',
        activeScanId: running.id
      });
      return;
    }

    const nextJob = jobStore.createJob({ ...sourceJob.input });
    appendAndBroadcast(sourceJob.id, 'scan_restarted', {
      scanId: sourceJob.id,
      restartedScanId: nextJob.id
    });
    logger.info('Scan restarted', { sourceScanId: sourceJob.id, restartedScanId: nextJob.id });

    void runJob(nextJob);

    res.statusCode = 202;
    res.json({
      scanId: nextJob.id,
      status: 'running',
      restartedFrom: sourceJob.id
    });
  }

  function clearScanView(req, res) {
    const job = jobStore.get(req.params.scanId);
    if (!job) {
      logger.error('Clear view rejected for unknown scan', { scanId: req.params.scanId });
      res.statusCode = 404;
      res.json({ error: 'Scan not found' });
      return;
    }

    const section = String(req.body?.section || 'all').trim();
    const allowed = section === 'all' || VIEW_SECTIONS.includes(section);
    if (!allowed) {
      res.statusCode = 400;
      res.json({
        error: 'Invalid section. Use one of: all, livePageStatus, liveAccessibilityIssues, errorsByUrl, scannedUrls, recentUpdates.'
      });
      return;
    }

    const at = new Date().toISOString();
    const nextMarks = withClearMarks(job.clearMarks);
    if (section === 'all') {
      for (const key of VIEW_SECTIONS) {
        nextMarks[key] = at;
      }
    } else {
      nextMarks[section] = at;
    }

    jobStore.patch(job.id, {
      clearMarks: nextMarks
    });

    const payload = {
      scanId: job.id,
      section,
      at,
      clearMarks: nextMarks
    };
    jobStore.forEachClient(job.id, (client) => {
      sendSse(client, 'view_cleared', payload);
    });

    logger.info('Scan view cleared', { scanId: job.id, section, at });
    res.json(payload);
  }

  function downloadJsonReport(req, res) {
    const job = jobStore.get(req.params.scanId);
    if (!job || !job.reportPaths) {
      logger.error('JSON report download unavailable', { scanId: req.params.scanId });
      res.statusCode = 404;
      res.json({ error: 'Report not available' });
      return;
    }

    res.sendFile(path.resolve(job.reportPaths.jsonPath));
  }

  function downloadMarkdownReport(req, res) {
    const job = jobStore.get(req.params.scanId);
    if (!job || !job.reportPaths) {
      logger.error('Markdown report download unavailable', { scanId: req.params.scanId });
      res.statusCode = 404;
      res.json({ error: 'Report not available' });
      return;
    }

    res.sendFile(path.resolve(job.reportPaths.markdownPath));
  }

  return {
    startScan,
    getScan,
    scanEvents,
    pauseScan,
    resumeScan,
    stopScan,
    restartScan,
    clearScanView,
    downloadJsonReport,
    downloadMarkdownReport
  };
}

module.exports = {
  createScanController,
  sanitizeScanOptions,
  createCustomerSummary
};
