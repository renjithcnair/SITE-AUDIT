function scoreTone(score) {
  if (score >= 90) return 'score good';
  if (score >= 70) return 'score warn';
  return 'score bad';
}

function ScoreCard({ label, score, grade, helper }) {
  return (
    <article className="card">
      <p>{label}</p>
      <div className={scoreTone(score)}>
        <strong>{Math.round(score)}</strong>
        <span>{grade}</span>
      </div>
      <small>{helper}</small>
    </article>
  );
}

export default function ScoreCards({ aggregates }) {
  if (!aggregates) return null;

  return (
    <section className="score-grid">
      <ScoreCard
        label="Overall Lighthouse"
        score={aggregates.lighthouse.overall}
        grade={aggregates.lighthouse.grade}
        helper="Overall site quality across performance, accessibility, SEO, and best practices."
      />
      <ScoreCard
        label="Accessibility (Lighthouse)"
        score={aggregates.accessibility.lighthouseAccessibility}
        grade={aggregates.accessibility.lighthouseAccessibilityGrade}
        helper="How accessible your pages appear from Lighthouse checks."
      />
      <ScoreCard
        label="Accessibility Issue Index"
        score={aggregates.accessibility.pa11yIssueIndex}
        grade={aggregates.accessibility.pa11yIssueIndexGrade}
        helper="Weighted index from detected accessibility issues across scanned pages."
      />
    </section>
  );
}
