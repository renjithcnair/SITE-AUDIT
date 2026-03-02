function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor((ms || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
}

export default function ProgressBar({ progress, status, elapsedMs }) {
  const total = progress.totalPages || progress.discoveredCount || 1;
  const current = progress.scannedCount || 0;
  const percent = Math.min(100, Math.round((current / total) * 100));

  return (
    <section className="panel">
      <h2>Live Progress</h2>
      <p className="status-line">Status: <strong>{status}</strong></p>
      <p className="status-line">Elapsed: <strong>{formatDuration(elapsedMs)}</strong></p>
      <div className="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={percent}>
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <div className="stats-grid">
        <div><span>Discovered</span><strong>{progress.discoveredCount || 0}</strong></div>
        <div><span>Scanned</span><strong>{progress.scannedCount || 0}</strong></div>
        <div><span>Total</span><strong>{progress.totalPages || 0}</strong></div>
        <div><span>Queued</span><strong>{progress.queuedCount || 0}</strong></div>
        <div><span>Errors</span><strong>{progress.errorCount || 0}</strong></div>
        <div><span>Duplicates</span><strong>{progress.duplicateUrlsSkipped || 0}</strong></div>
      </div>
    </section>
  );
}
