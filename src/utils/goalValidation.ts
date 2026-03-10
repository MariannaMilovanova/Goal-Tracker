import { Goal, GoalDayState } from '../store/goalTypes';
import { normalizeTrackedWeekdays } from './date';

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
  const rawTimeline = Array.isArray(candidate.timeline) ? candidate.timeline : [];
  const trackedWeekdays = normalizeTrackedWeekdays(candidate.trackedWeekdays);
  const timeline = rawTimeline.filter(
    (entry): entry is GoalDayState =>
      entry === 'completed' || entry === 'skipped' || entry === 'off',
  );

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

  let normalizedCompleted = Math.min(Math.max(completedDays, 0), totalDays);
  let normalizedTimeline: GoalDayState[] = Array.from(
    { length: normalizedCompleted },
    () => 'completed',
  );

  if (timeline.length > 0) {
    normalizedCompleted = 0;
    normalizedTimeline = timeline.map((entry) => {
      if (entry === 'completed' && normalizedCompleted < totalDays) {
        normalizedCompleted += 1;
        return 'completed';
      }
      if (entry === 'off') {
        return 'off';
      }
      return 'skipped';
    });
  }

  return {
    title,
    totalDays,
    completedDays: normalizedCompleted,
    timeline: normalizedTimeline,
    trackedWeekdays,
    lastCompletedDate,
    createdAt,
    accentColor,
  };
}
