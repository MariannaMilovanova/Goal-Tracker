import { Goal } from '../store/goalTypes';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function normalizeGoal(raw: unknown): Goal | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const candidate = raw as Goal;
  const title = typeof candidate.title === 'string' ? candidate.title.trim() : '';
  const totalDays = isFiniteNumber(candidate.totalDays) ? Math.floor(candidate.totalDays) : 0;
  const completedDays = isFiniteNumber(candidate.completedDays)
    ? Math.floor(candidate.completedDays)
    : 0;
  const createdAt = typeof candidate.createdAt === 'string' ? candidate.createdAt : '';
  const accentColor = typeof candidate.accentColor === 'string' ? candidate.accentColor : undefined;

  const lastCompletedDate =
    candidate.lastCompletedDate === null
      ? null
      : typeof candidate.lastCompletedDate === 'string'
        ? candidate.lastCompletedDate
        : null;

  if (!title || totalDays <= 0 || !createdAt) {
    return null;
  }

  if (lastCompletedDate && !DATE_PATTERN.test(lastCompletedDate)) {
    return null;
  }

  return {
    title,
    totalDays,
    completedDays: Math.min(Math.max(completedDays, 0), totalDays),
    lastCompletedDate,
    createdAt,
    accentColor,
  };
}
