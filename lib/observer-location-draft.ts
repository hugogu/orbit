export function parseObserverLocationDraft(
  draft: string,
  range: { min: number; max: number },
): number | undefined {
  const text = draft.trim();
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return undefined;

  const value = Number(text);
  return Number.isFinite(value) && value >= range.min && value <= range.max
    ? value
    : undefined;
}
