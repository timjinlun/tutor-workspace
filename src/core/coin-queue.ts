export interface CoinEmission { id: string; at: number; radius: number }
export function scheduleCoins(pending: CoinEmission[], changes: {id: string; amount: number}[], value: number, now: number, delay: number): CoinEmission[] {
  const removed = new Set(changes.filter((c) => c.amount < 0).map((c) => c.id));
  const next = pending.filter((c) => !removed.has(c.id));
  const positive = changes.filter((c) => c.amount > 0).map((c) => ({ ...c, count: Math.min(240, Math.max(1, Math.round(c.amount / value))) }));
  const total = positive.reduce((n, c) => n + c.count, 0);
  const interval = Math.min(18, 600 / Math.max(1, total));
  let index = 0;
  for (const c of positive) for (let i = 0; i < c.count; i++) next.push({ id: c.id, at: now + delay + index++ * interval, radius: 4.5 * Math.max(0.85, Math.min(1.15, c.amount / (value * 30))) });
  return next.sort((a, b) => a.at - b.at);
}
