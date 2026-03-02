import { useState } from 'react';

export default function ScanForm({ onStart, disabled }) {
  const [url, setUrl] = useState('');
  const [maxPages, setMaxPages] = useState('');
  const [maxDepth, setMaxDepth] = useState(2);
  const [pauseMs, setPauseMs] = useState(1000);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('URL must use http or https.');
      }

      const payload = {
        url,
        maxDepth: Number(maxDepth),
        pauseMs: Number(pauseMs)
      };

      if (String(maxPages).trim() !== '') {
        payload.maxPages = Number(maxPages);
      }

      await onStart(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Please enter a valid URL.');
    }
  };

  return (
    <form className="panel form-panel" onSubmit={handleSubmit}>
      <h2>Start Website Scan</h2>
      <p>Enter a homepage or parent URL to crawl subdirectories and scan quality metrics.</p>
      <label>
        Website URL
        <input
          type="url"
          placeholder="https://example.com"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          required
          disabled={disabled}
        />
      </label>

      <div className="field-grid">
        <label>
          Max Pages (leave empty for full site)
          <input
            type="number"
            min="1"
            max="500"
            value={maxPages}
            onChange={(event) => setMaxPages(event.target.value)}
            placeholder="Unlimited"
            disabled={disabled}
          />
        </label>

        <label>
          Max Depth
          <input
            type="number"
            min="0"
            max="10"
            value={maxDepth}
            onChange={(event) => setMaxDepth(event.target.value)}
            disabled={disabled}
          />
        </label>

        <label>
          Pause (ms)
          <input
            type="number"
            min="0"
            max="10000"
            value={pauseMs}
            onChange={(event) => setPauseMs(event.target.value)}
            disabled={disabled}
          />
        </label>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <button type="submit" disabled={disabled}>
        {disabled ? 'Scan Running...' : 'Start Scan'}
      </button>
    </form>
  );
}
