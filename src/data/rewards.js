export const LEVELS = [
  { key: 'newbie', name: 'Newbie', min: 0, max: 199 },
  { key: 'bronze', name: 'Bronze', min: 200, max: 499 },
  { key: 'silver', name: 'Silver', min: 500, max: 999 },
  { key: 'gold', name: 'Gold', min: 1000, max: 1999 },
  { key: 'diamond', name: 'Diamond', min: 2000, max: Infinity },
];

export const REWARD_MILESTONES = [1000, 2000, 3000];

export function getLevelForMinutes(mins) {
  const v = Number(mins) || 0;
  return LEVELS.find(l => v >= l.min && v <= l.max) || LEVELS[0];
}

export function getRewardBounds(totalMins) {
  const v = Number(totalMins) || 0;
  let prev = 0;
  for (const m of REWARD_MILESTONES) {
    if (v >= m) prev = m;
  }
  const next = REWARD_MILESTONES.find(m => m > v) ?? (Math.ceil((v + 1) / 1000) * 1000);
  return { prev, next };
}

export function clamp01(x) { return Math.max(0, Math.min(1, x)); }
export function formatMins(m) { const v = Math.max(0, Math.round(Number(m) || 0)); return `${v}m`; }
