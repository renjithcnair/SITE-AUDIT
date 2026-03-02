export function scoreBadgeTone(score) {
  if (score >= 90) return 'good';
  if (score >= 70) return 'warn';
  return 'bad';
}

export function formatCustomerScore(score, grade) {
  return `${Math.round(score)}/100 (${grade})`;
}
