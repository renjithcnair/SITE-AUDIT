import { useState } from 'react';

export default function ScanForm({ onStart, disabled }) {
  const [url, setUrl] = useState('');
  const [maxPages, setMaxPages] = useState(1);
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
        maxPages: Number(maxPages),
        maxDepth: Number(maxDepth),
        pauseMs: Number(pauseMs)
      };

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
          Max Pages
          <input
            type="number"
            min="1"
            max="500"
            value={maxPages}
            onChange={(event) => setMaxPages(event.target.value)}
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

      <details className="explain-toggle">
        <summary>What do these settings mean?</summary>
        <ul>
          <li><strong>Max Pages</strong>: Maximum number of same-origin URLs scanned in one run. Default is <strong>1</strong>.</li>
          <li><strong>Max Depth</strong>: How many link levels away from the start URL the crawler can follow.</li>
          <li><strong>Pause (ms)</strong>: Delay between crawl/scan steps. Higher values reduce request burst load.</li>
        </ul>
      </details>

      {error ? <p className="error-text">{error}</p> : null}

      <button type="submit" disabled={disabled}>
        {disabled ? 'Scan Running...' : 'Start Scan'}
      </button>
    </form>
  );
}
