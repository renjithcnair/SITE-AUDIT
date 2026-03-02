import { useEffect, useMemo, useState } from 'react';

import ScanForm from '../components/ScanForm';
import ProgressBar from '../components/ProgressBar';
import ScoreCards from '../components/ScoreCards';
import CategoryBreakdown from '../components/CategoryBreakdown';
import SubdirectoryTree from '../components/SubdirectoryTree';
import IssuesPanels from '../components/IssuesPanels';
import PageDetailsModal from '../components/PageDetailsModal';

const DEFAULT_CLEAR_MARKS = {
  livePageStatus: null,
  liveAccessibilityIssues: null,
  errorsByUrl: null,
  scannedUrls: null,
  recentUpdates: null
};

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

function normalizeClearMarks(clearMarks) {
  return {
    ...DEFAULT_CLEAR_MARKS,
    ...(clearMarks || {})
  };
}

function parseIsoTime(value) {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function eventMs(event) {
  return parseIsoTime(event.at) || parseIsoTime(event.payload?.at) || 0;
}

function isEventAfterMark(event, markIso) {
  const markMs = parseIsoTime(markIso);
  if (markMs == null) return true;
  return eventMs(event) > markMs;
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor((ms || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
}

function eventDetail(payload) {
  return payload.url || payload.phase || payload.message || payload.reason || payload.stage || '';
}

function formatPstDateTime(isoString) {
  const input = isoString || new Date().toISOString();
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);

  const get = (type) => parts.find((part) => part.type === type)?.value || '00';
  return `${get('month')}-${get('day')}-${get('year')} ${get('hour')}:${get('minute')}:${get('second')} PST`;
}

function computeElapsedMs(progress, nowMs) {
  if (!progress?.startedAt) {
    return progress?.elapsedMs || 0;
  }

  const startedMs = Date.parse(progress.startedAt);
  if (Number.isNaN(startedMs)) {
    return progress?.elapsedMs || 0;
  }

  const endMs = progress.endedAt ? Date.parse(progress.endedAt) : nowMs;
  if (Number.isNaN(endMs)) {
    return progress?.elapsedMs || 0;
  }

  return Math.max(0, endMs - startedMs);
}

function mergeProgress(current, payload) {
  return {
    ...current,
    ...payload,
    discoveredCount: payload.discoveredCount ?? current.discoveredCount,
    scannedCount: payload.current ?? payload.scannedCount ?? current.scannedCount,
    totalPages: payload.total ?? payload.totalPages ?? current.totalPages,
    errorCount: payload.errorCount ?? current.errorCount,
    queuedCount: payload.queuedCount ?? current.queuedCount,
    duplicateUrlsSkipped: payload.duplicateUrlsSkipped ?? current.duplicateUrlsSkipped,
    elapsedMs: payload.elapsedMs ?? current.elapsedMs
  };
}

export default function Dashboard() {
  const [scanId, setScanId] = useState('');
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState({});
  const [report, setReport] = useState(null);
  const [events, setEvents] = useState([]);
  const [clearMarks, setClearMarks] = useState(() => normalizeClearMarks());
  const [error, setError] = useState('');
  const [selectedPage, setSelectedPage] = useState(null);
  const [clockMs, setClockMs] = useState(Date.now());

  const isActive = ['running', 'queued', 'paused', 'stopping'].includes(status);
  const elapsedMs = useMemo(() => computeElapsedMs(progress, clockMs), [progress, clockMs]);

  useEffect(() => {
    const interval = setInterval(() => setClockMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleStart = async (payload) => {
    setError('');
    setReport(null);
    setEvents([]);
    setSelectedPage(null);
    setProgress({});
    setClearMarks(normalizeClearMarks());

    const response = await fetchJson('/api/scans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    setScanId(response.scanId);
    setStatus(response.status);
  };

  const runAction = async (path) => {
    const response = await fetchJson(path, { method: 'POST' });
    if (response.scanId) {
      setScanId(response.scanId);
    }
    if (response.status) {
      setStatus(response.status);
    }
    return response;
  };

  const handlePause = async () => {
    setError('');
    await runAction(`/api/scans/${scanId}/pause`);
  };

  const handleResume = async () => {
    setError('');
    await runAction(`/api/scans/${scanId}/resume`);
  };

  const handleStop = async () => {
    setError('');
    await runAction(`/api/scans/${scanId}/stop`);
  };

  const handleRestart = async () => {
    setError('');
    setReport(null);
    setEvents([]);
    setProgress({});
    setSelectedPage(null);
    setClearMarks(normalizeClearMarks());
    await runAction(`/api/scans/${scanId}/restart`);
  };

  const handleClear = async (section) => {
    if (!scanId) return;
    setError('');

    const response = await fetchJson(`/api/scans/${scanId}/clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section })
    });

    setClearMarks(normalizeClearMarks(response.clearMarks));
  };

  useEffect(() => {
    if (!scanId) return undefined;

    const eventSource = new EventSource(`/api/scans/${scanId}/events`);

    const handler = (event) => {
      const payload = JSON.parse(event.data);
      const at = new Date().toISOString();

      if (event.type === 'view_cleared') {
        if (payload.clearMarks) {
          setClearMarks(normalizeClearMarks(payload.clearMarks));
        }
      } else {
        setEvents((current) => [...current.slice(-400), { type: event.type, payload, at: payload.at || at }]);
      }

      if (event.type === 'scan_failed') {
        setStatus('failed');
        setError(payload.message || 'Scan failed.');
      }

      if (event.type === 'scan_completed') {
        setStatus('completed');
      }

      if (event.type === 'scan_stopped') {
        setStatus('stopped');
      }

      if (event.type === 'scan_paused') {
        setStatus('paused');
      }

      if (event.type === 'scan_resumed') {
        setStatus('running');
      }

      if (event.type === 'scan_stopping') {
        setStatus('stopping');
      }

      if (event.type === 'connected' && payload.progress) {
        setProgress(payload.progress);
      }

      if (event.type === 'connected' && payload.clearMarks) {
        setClearMarks(normalizeClearMarks(payload.clearMarks));
      }

      if (
        event.type === 'scan_started' ||
        event.type === 'crawl_progress' ||
        event.type === 'page_scan_started' ||
        event.type === 'page_scan_completed' ||
        event.type === 'page_discovered' ||
        event.type === 'page_crawled' ||
        event.type === 'duplicate_url_skipped' ||
        event.type === 'crawl_error' ||
        event.type === 'scan_completed' ||
        event.type === 'scan_failed' ||
        event.type === 'scan_stopped'
      ) {
        setProgress((current) => mergeProgress(current, payload));
      }
    };

    eventSource.addEventListener('connected', handler);
    eventSource.addEventListener('scan_started', handler);
    eventSource.addEventListener('crawl_progress', handler);
    eventSource.addEventListener('page_discovered', handler);
    eventSource.addEventListener('page_crawled', handler);
    eventSource.addEventListener('duplicate_url_skipped', handler);
    eventSource.addEventListener('crawl_error', handler);
    eventSource.addEventListener('page_scan_started', handler);
    eventSource.addEventListener('page_scan_completed', handler);
    eventSource.addEventListener('page_scan_error', handler);
    eventSource.addEventListener('accessibility_issues_found', handler);
    eventSource.addEventListener('scan_paused', handler);
    eventSource.addEventListener('scan_resumed', handler);
    eventSource.addEventListener('scan_stopping', handler);
    eventSource.addEventListener('scan_stopped', handler);
    eventSource.addEventListener('scan_completed', handler);
    eventSource.addEventListener('scan_failed', handler);
    eventSource.addEventListener('view_cleared', handler);

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [scanId]);

  useEffect(() => {
    if (!scanId) return undefined;

    let stopped = false;
    const tick = async () => {
      try {
        const state = await fetchJson(`/api/scans/${scanId}`);
        if (stopped) return;

        setStatus(state.status);
        setProgress(state.progress || {});
        setClearMarks(normalizeClearMarks(state.clearMarks));
        if (state.report) {
          setReport(state.report);
        }
        if (state.error) {
          setError(state.error);
        }
        if (Array.isArray(state.events)) {
          setEvents((current) => {
            if (current.length > 0) {
              return current;
            }
            return state.events.slice(-400).map((item) => ({
              type: item.type,
              payload: item.payload || {},
              at: item.at || item.payload?.at || new Date().toISOString()
            }));
          });
        }
      } catch (err) {
        if (!stopped) {
          setError(err instanceof Error ? err.message : 'Failed to refresh scan state.');
        }
      }
    };

    tick();
    const interval = setInterval(() => {
      if (['completed', 'failed', 'stopped'].includes(status)) {
        clearInterval(interval);
        return;
      }
      void tick();
    }, 2000);

    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [scanId, status]);

  const downloadLinks = useMemo(() => {
    if (!scanId || status !== 'completed') return null;
    return {
      json: `/api/scans/${scanId}/report.json`,
      markdown: `/api/scans/${scanId}/report.md`
    };
  }, [scanId, status]);

  const pageStatusRows = useMemo(() => {
    const byUrl = new Map();
    const filtered = events.filter((event) => isEventAfterMark(event, clearMarks.livePageStatus));

    for (const event of filtered) {
      if (!['page_discovered', 'page_crawled', 'page_scan_started', 'page_scan_completed', 'page_scan_error'].includes(event.type)) {
        continue;
      }

      const payload = event.payload || {};
      const url = payload.url;
      if (!url) continue;

      const current = byUrl.get(url) || {
        url,
        crawlStatus: 'pending',
        statusCode: null,
        scanStatus: 'pending',
        lcpMs: null,
        accessibilityIssueCount: 0,
        updatedAtMs: 0
      };

      if (event.type === 'page_discovered') {
        current.crawlStatus = 'discovered';
      }

      if (event.type === 'page_crawled') {
        current.crawlStatus = payload.status || current.crawlStatus;
        current.statusCode = payload.statusCode ?? current.statusCode;
      }

      if (event.type === 'page_scan_started') {
        current.scanStatus = 'scanning';
      }

      if (event.type === 'page_scan_completed') {
        current.scanStatus = payload.pageStatus || 'scanned';
        current.lcpMs = payload.lcpMs ?? current.lcpMs;
        current.accessibilityIssueCount = payload.accessibilityIssueCount ?? current.accessibilityIssueCount;
      }

      if (event.type === 'page_scan_error') {
        current.scanStatus = 'scan_failed';
      }

      current.updatedAtMs = eventMs(event);
      byUrl.set(url, current);
    }

    return [...byUrl.values()].sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  }, [events, clearMarks.livePageStatus]);

  const liveAccessibilityIssues = useMemo(() => {
    const issues = [];
    const filtered = events.filter((event) => (
      event.type === 'accessibility_issues_found' &&
      isEventAfterMark(event, clearMarks.liveAccessibilityIssues)
    ));

    for (const event of filtered) {
      const payload = event.payload || {};
      const url = payload.url || '';
      for (const issue of payload.issues || []) {
        issues.push({
          url,
          title: issue.title || issue.code || 'Accessibility issue',
          severity: issue.severity || 'error',
          elapsedMs: payload.elapsedMs || 0
        });
      }
    }

    return issues.slice(-150).reverse();
  }, [events, clearMarks.liveAccessibilityIssues]);

  const allErrors = useMemo(() => {
    const seen = new Set();
    const rows = [];
    const filtered = events.filter((event) => (
      (event.type === 'crawl_error' || event.type === 'page_scan_error') &&
      isEventAfterMark(event, clearMarks.errorsByUrl)
    ));

    for (const event of filtered) {
      const payload = event.payload || {};
      const row = {
        url: payload.url || '(scan)',
        reason: payload.reason || payload.message || 'Unknown error',
        stage: payload.stage || 'crawl',
        elapsedMs: payload.elapsedMs || 0
      };
      const key = `${row.stage}|${row.url}|${row.reason}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }

    return rows;
  }, [events, clearMarks.errorsByUrl]);

  const allScannedUrls = useMemo(() => {
    const urls = [];
    const seen = new Set();
    const filtered = events.filter((event) => (
      event.type === 'page_discovered' &&
      isEventAfterMark(event, clearMarks.scannedUrls)
    ));

    for (const event of filtered) {
      const url = event.payload?.url;
      if (!url || seen.has(url)) continue;
      seen.add(url);
      urls.push(url);
    }
    return urls;
  }, [events, clearMarks.scannedUrls]);

  const duplicateScannedCount = Math.max(0, allScannedUrls.length - new Set(allScannedUrls).size);

  const recentEvents = useMemo(() => {
    return events
      .filter((event) => event.type !== 'connected')
      .filter((event) => isEventAfterMark(event, clearMarks.recentUpdates))
      .slice(-30)
      .reverse();
  }, [events, clearMarks.recentUpdates]);

  return (
    <main className="layout">
      <header className="hero">
        <p className="eyebrow">Site Quality Dashboard</p>
        <h1>Scan your website and review Lighthouse + accessibility health.</h1>
        <p>Customer-friendly summary first, technical detail on demand.</p>
      </header>

      <ScanForm onStart={handleStart} disabled={isActive} />

      {scanId ? (
        <section className="panel">
          <h2>Scan Controls</h2>
          <div className="controls-row">
            {(status === 'running' || status === 'queued') ? (
              <button type="button" onClick={handlePause}>Pause</button>
            ) : null}
            {status === 'paused' ? (
              <button type="button" onClick={handleResume}>Resume</button>
            ) : null}
            {(status === 'running' || status === 'queued' || status === 'paused' || status === 'stopping') ? (
              <button type="button" onClick={handleStop}>Stop</button>
            ) : null}
            {(status === 'completed' || status === 'failed' || status === 'stopped') ? (
              <button type="button" onClick={handleRestart}>Restart</button>
            ) : null}
            <button type="button" onClick={() => handleClear('all')}>Clear All Panels</button>
          </div>
        </section>
      ) : null}

      <ProgressBar progress={progress} status={status} elapsedMs={elapsedMs} />

      {error ? <p className="error-text">{error}</p> : null}

      <section className="panel">
        <div className="panel-head">
          <h2>Live Page Status and LCP</h2>
          <button type="button" className="secondary-btn" onClick={() => handleClear('livePageStatus')}>Clear</button>
        </div>
        {pageStatusRows.length ? (
          <ul className="mono-list">
            {pageStatusRows.slice(0, 300).map((row) => (
              <li key={row.url}>
                <code>{row.url}</code>
                <span>
                  crawl: {row.crawlStatus}
                  {row.statusCode ? ` (${row.statusCode})` : ''} | scan: {row.scanStatus} | LCP: {
                    row.lcpMs == null ? 'n/a' : `${Math.round(row.lcpMs)}ms`
                  } | a11y issues: {row.accessibilityIssueCount}
                </span>
              </li>
            ))}
          </ul>
        ) : <p>No live page status data.</p>}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Live Accessibility Issues</h2>
          <button type="button" className="secondary-btn" onClick={() => handleClear('liveAccessibilityIssues')}>Clear</button>
        </div>
        {liveAccessibilityIssues.length ? (
          <ul className="mono-list">
            {liveAccessibilityIssues.slice(0, 300).map((issue, index) => (
              <li key={`${issue.url}-${issue.title}-${index}`}>
                <code>{issue.url}</code>
                <span>[{issue.severity}] {issue.title} ({formatDuration(issue.elapsedMs)})</span>
              </li>
            ))}
          </ul>
        ) : <p>No live accessibility issues.</p>}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Errors by URL</h2>
          <button type="button" className="secondary-btn" onClick={() => handleClear('errorsByUrl')}>Clear</button>
        </div>
        {allErrors.length ? (
          <ul className="mono-list">
            {allErrors.map((item, index) => (
              <li key={`${item.stage}-${item.url}-${index}`}>
                <code>{item.url}</code>
                <span>{item.stage}: {item.reason}</span>
              </li>
            ))}
          </ul>
        ) : <p>No errors logged for the selected range.</p>}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>{status === 'completed' ? 'Complete Site URLs Scanned' : 'Discovered URLs'}</h2>
          <button type="button" className="secondary-btn" onClick={() => handleClear('scannedUrls')}>Clear</button>
        </div>
        <p>Duplicate scan validation: <strong>{duplicateScannedCount}</strong> duplicated URL scans.</p>
        {allScannedUrls.length ? (
          <ul className="mono-list">
            {allScannedUrls.map((url) => (
              <li key={url}>
                <code>{url}</code>
              </li>
            ))}
          </ul>
        ) : <p>No scanned URLs in this view.</p>}
      </section>

      {report ? (
        <>
          <section className="panel">
            <h2>Summary</h2>
            <p>{report.customerSummary?.headline}</p>
            <p>{report.customerSummary?.accessibility}</p>
            <ul>
              {(report.customerSummary?.topActions || []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {downloadLinks ? (
              <div className="download-row">
                <a href={downloadLinks.json}>Download JSON</a>
                <a href={downloadLinks.markdown}>Download Markdown</a>
              </div>
            ) : null}
          </section>

          <ScoreCards aggregates={report.aggregates} />
          <CategoryBreakdown lighthouse={report.aggregates?.lighthouse} />
          <IssuesPanels
            lighthouseIssues={report.lighthouse?.conciseIssues}
            accessibilityIssues={report.accessibility?.conciseIssues}
          />
          <SubdirectoryTree
            tree={report.pagesTree}
            discoveredCount={report.pagesScanned?.length || 0}
            onSelectPage={setSelectedPage}
          />
        </>
      ) : null}

      <section className="panel">
        <div className="panel-head">
          <h2>Recent Scan Updates</h2>
          <button type="button" className="secondary-btn" onClick={() => handleClear('recentUpdates')}>Clear</button>
        </div>
        {recentEvents.length ? (
          <ul className="event-log">
            {recentEvents.map((event, index) => (
              <li key={`${event.type}-${index}-${event.at}`}>
                <strong>{event.type}</strong>
                <span>{formatPstDateTime(event.payload?.at || event.at)} | {event.type} | {eventDetail(event.payload || {})}</span>
              </li>
            ))}
          </ul>
        ) : <p>No recent updates in this view.</p>}
      </section>

      <PageDetailsModal page={selectedPage} onClose={() => setSelectedPage(null)} />
    </main>
  );
}
