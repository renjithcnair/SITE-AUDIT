export default function CategoryBreakdown({ lighthouse }) {
  if (!lighthouse) return null;

  const entries = [
    ['Performance', lighthouse.categories.performance, lighthouse.categoryGrades.performance],
    ['Accessibility', lighthouse.categories.accessibility, lighthouse.categoryGrades.accessibility],
    ['SEO', lighthouse.categories.seo, lighthouse.categoryGrades.seo],
    ['Best Practices', lighthouse.categories.bestPractices, lighthouse.categoryGrades.bestPractices]
  ];

  return (
    <section className="panel">
      <h2>Lighthouse Category Aggregates</h2>
      <div className="category-grid">
        {entries.map(([label, score, grade]) => (
          <article className="category-card" key={label}>
            <p>{label}</p>
            <strong>{Math.round(score)}</strong>
            <span>{grade}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
