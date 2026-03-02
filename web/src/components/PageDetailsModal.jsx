export default function PageDetailsModal({ page, onClose }) {
  if (!page) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <h3>Page Details</h3>
          <button onClick={onClose}>Close</button>
        </div>
        <p className="mono">{page.url}</p>

        <section>
          <h4>Lighthouse</h4>
          <p>Overall: <strong>{Math.round(page.lighthouse?.overall || 0)}</strong></p>
          <ul>
            <li>Performance: {Math.round(page.lighthouse?.scores?.performance || 0)}</li>
            <li>Accessibility: {Math.round(page.lighthouse?.scores?.accessibility || 0)}</li>
            <li>SEO: {Math.round(page.lighthouse?.scores?.seo || 0)}</li>
            <li>Best Practices: {Math.round(page.lighthouse?.scores?.bestPractices || 0)}</li>
          </ul>
        </section>

        <section>
          <h4>Accessibility</h4>
          <p>Issue count: <strong>{page.accessibility?.issueCount || 0}</strong></p>
          <details>
            <summary>Technical details</summary>
            <ul>
              {(page.accessibility?.issues || []).slice(0, 20).map((issue, index) => (
                <li key={`${issue.code}-${index}`}>
                  [{issue.severity}] {issue.title}
                </li>
              ))}
            </ul>
          </details>
        </section>
      </div>
    </div>
  );
}
