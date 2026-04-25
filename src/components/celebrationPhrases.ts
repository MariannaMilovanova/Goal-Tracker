const EARLY_MESSAGE_KEYS = [
  'celebration.early.0',
  'celebration.early.1',
  'celebration.early.2',
  'celebration.early.3',
  'celebration.early.4',
  'celebration.early.5',
] as const;

const HABIT_MESSAGE_KEYS = [
  'celebration.habit.0',
  'celebration.habit.1',
  'celebration.habit.2',
  'celebration.habit.3',
  'celebration.habit.4',
  'celebration.habit.5',
  'celebration.habit.6',
  'celebration.habit.7',
] as const;

const LATE_MESSAGE_KEYS = [
  'celebration.late.0',
  'celebration.late.1',
  'celebration.late.2',
  'celebration.late.3',
  'celebration.late.4',
  'celebration.late.5',
  'celebration.late.6',
  'celebration.late.7',
] as const;

function getPool(completedDays: number): readonly string[] {
  if (completedDays <= 7) {
    return EARLY_MESSAGE_KEYS;
  }
  if (completedDays <= 30) {
    return HABIT_MESSAGE_KEYS;
  }
  return LATE_MESSAGE_KEYS;
}

export function getCelebrationMessageKey(
  completedDays: number,
  previousMessageKey: string | null,
): string {
  const pool = getPool(completedDays);
  if (pool.length === 1) {
    return pool[0];
  }

  let nextMessageKey = pool[Math.floor(Math.random() * pool.length)];
  if (
    previousMessageKey &&
    pool.includes(previousMessageKey) &&
    nextMessageKey === previousMessageKey
  ) {
    const currentIndex = pool.indexOf(previousMessageKey);
    nextMessageKey = pool[(currentIndex + 1) % pool.length];
  }

  return nextMessageKey;
}
