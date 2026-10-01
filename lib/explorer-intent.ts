export function plannerIntent(search: string): 'lunar' | null {
  const values = new URLSearchParams(search).getAll('planner');
  return values.length === 1 && values[0] === 'lunar' ? 'lunar' : null;
}

export function withoutPlannerIntent(search: string) {
  const params = new URLSearchParams(search);
  params.delete('planner');
  const remaining = params.toString();
  return remaining ? `?${remaining}` : '';
}
