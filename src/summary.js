/**
 * Converts a flat issue list into grouped issue counts.
 * @param {{ title?: string, message?: string, code?: string }[]} issues
 * @param {number} limit
 * @returns {{ title: string, count: number }[]}
 */
function summarizeIssues(issues, limit = 10) {
  const counter = new Map();

  for (const issue of issues) {
    const title = issue.title || issue.message || issue.code || 'Unknown issue';
    counter.set(title, (counter.get(title) || 0) + 1);
  }

  return [...counter.entries()]
    .map(([title, count]) => ({ title, count }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
    .slice(0, limit);
}

module.exports = {
  summarizeIssues
};
