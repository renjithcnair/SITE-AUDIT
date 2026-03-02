const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

/**
 * @param {any[]} rawIssues
 */
function normalizePa11yIssues(rawIssues) {
  return rawIssues.map((issue) => ({
    title: issue.message || issue.code || 'Accessibility issue',
    severity: issue.type || 'error',
    code: issue.code || 'unknown',
    selector: issue.selector || ''
  }));
}

/**
 * @param {string} url
 * @param {{ execFileFn?: typeof execFileAsync, timeoutMs?: number }} [deps]
 */
async function runAccessibility(url, deps = {}) {
  const execFileFn = deps.execFileFn || execFileAsync;
  const timeoutMs = deps.timeoutMs || 120000;
  const parseIssues = (raw) => {
    const parsed = JSON.parse(raw);
    return normalizePa11yIssues(Array.isArray(parsed) ? parsed : []);
  };

  try {
    const { stdout } = await execFileFn('pa11y', [
      url,
      '--reporter',
      'json',
      '--timeout',
      String(timeoutMs)
    ], { timeout: timeoutMs, maxBuffer: 20 * 1024 * 1024 });

    return {
      url,
      issues: parseIssues(stdout),
      toolStatus: 'ok'
    };
  } catch (error) {
    const errorStdout = error && typeof error === 'object' ? error.stdout : '';
    const stdoutText = typeof errorStdout === 'string'
      ? errorStdout
      : Buffer.isBuffer(errorStdout)
        ? errorStdout.toString('utf8')
        : '';

    if (stdoutText.trim()) {
      try {
        return {
          url,
          issues: parseIssues(stdoutText),
          toolStatus: 'ok'
        };
      } catch {
        // Fall through to failure payload when stdout is not valid JSON.
      }
    }

    const stderrText = error && typeof error === 'object' && typeof error.stderr === 'string'
      ? error.stderr.trim()
      : '';

    return {
      url,
      issues: [{
        title: 'Accessibility scan failed',
        severity: 'error',
        code: 'scan-failed',
        selector: '',
        details: stderrText || (error instanceof Error ? error.message : 'Unknown error')
      }],
      toolStatus: 'failed'
    };
  }
}

module.exports = {
  runAccessibility,
  normalizePa11yIssues
};
