import type { PlannerTab } from './planet-events';

export function plannerIntent(search: string): PlannerTab | null {
  const values = new URLSearchParams(search).getAll('planner');
  const tabs: PlannerTab[] = ['lunar', 'opposition', 'transit'];
  return values.length === 1 && tabs.includes(values[0] as PlannerTab)
    ? (values[0] as PlannerTab)
    : null;
}

export function withoutPlannerIntent(search: string) {
  const params = new URLSearchParams(search);
  params.delete('planner');
  const remaining = params.toString();
  return remaining ? `?${remaining}` : '';
}
