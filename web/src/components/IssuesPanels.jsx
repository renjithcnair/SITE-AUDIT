function IssueList({ issues, emptyText }) {
  if (!issues?.length) return <p>{emptyText}</p>;

  return (
    <ul className="issues-list">
      {issues.map((issue) => (
        <li key={`${issue.title}-${issue.count}`}>
          <span>{issue.title}</span>
          <strong>{issue.count}</strong>
        </li>
      ))}
    </ul>
  );
}

export default function IssuesPanels({ lighthouseIssues, accessibilityIssues }) {
  return (
    <section className="panel issues-panel">
      <div>
        <h2>Lighthouse & Core Web Vitals Issues</h2>
        <IssueList
          issues={lighthouseIssues}
          emptyText="No Lighthouse/Core Web Vitals issues detected."
        />
      </div>
      <div>
        <h2>Accessibility Findings</h2>
        <IssueList
          issues={accessibilityIssues}
          emptyText="No accessibility issues detected."
        />
      </div>
    </section>
  );
}
