const XP_PER_SESSION = 10;
const XP_PER_TASK = 15;
const XP_PER_SUBTASK = 8;
const COINS_PER_10_MINUTES = 5;

export const calculateSessionRewards = (durationMinutes: number, isInterrupted: boolean) => {
    if (isInterrupted) return { xp: 0, coins: 0 };
    const xp = XP_PER_SESSION;
    const coinIntervals = Math.floor(durationMinutes / 10);
    const coins = coinIntervals * COINS_PER_10_MINUTES;
    return { xp, coins };
};

export const calculateLevel = (totalXp: number): number => {
    if (totalXp < 0) return 1;
    return Math.floor(Math.sqrt(totalXp / 100)) + 1;
};

export const hasLeveledUp = (oldXp: number, newXp: number): boolean => {
    return calculateLevel(newXp) > calculateLevel(oldXp);
};
