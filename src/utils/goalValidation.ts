import { Goal, GoalsState, GoalDayState } from '../store/goalTypes';
import { normalizeTrackedWeekdays } from './date';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_GOALS = 10;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeTimeline(
  rawTimeline: unknown,
  totalDays: number,
  completedDays: number,
): { timeline: GoalDayState[]; completedDays: number } {
  const timelineEntries = Array.isArray(rawTimeline) ? rawTimeline : [];
  const timeline = timelineEntries.filter(
    (entry): entry is GoalDayState =>
      entry === 'completed' || entry === 'skipped' || entry === 'off',
  );

  if (timeline.length === 0) {
    const normalizedCompleted = Math.min(Math.max(completedDays, 0), totalDays);
    return {
      completedDays: normalizedCompleted,
      timeline: Array.from({ length: normalizedCompleted }, () => 'completed'),
    };
  }

  let normalizedCompleted = 0;
  return {
    completedDays: timeline.reduce((count, entry) => (entry === 'completed' ? count + 1 : count), 0),
    timeline: timeline.map((entry) => {
      if (entry === 'completed' && normalizedCompleted < totalDays) {
        normalizedCompleted += 1;
        return 'completed';
      }
      if (entry === 'off') {
        return 'off';
      }
      return 'skipped';
    }),
  };
}

export function normalizeGoal(
  raw: unknown,
  options?: { fallbackId?: string; fallbackUpdatedAt?: string },
): Goal | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const candidate = raw as Partial<Goal>;
  const id = isNonEmptyString(candidate.id) ? candidate.id.trim() : options?.fallbackId;
  const title = isNonEmptyString(candidate.title) ? candidate.title.trim() : '';
  const totalDays = isFiniteNumber(candidate.totalDays) ? Math.floor(candidate.totalDays) : 0;
  const completedDays = isFiniteNumber(candidate.completedDays)
    ? Math.floor(candidate.completedDays)
    : 0;
  const createdAt = typeof candidate.createdAt === 'string' ? candidate.createdAt : '';
  const updatedAt =
    typeof candidate.updatedAt === 'string' && candidate.updatedAt.length > 0
      ? candidate.updatedAt
      : options?.fallbackUpdatedAt ?? createdAt;
  const accentColor = typeof candidate.accentColor === 'string' ? candidate.accentColor : undefined;
  const trackedWeekdays = normalizeTrackedWeekdays(candidate.trackedWeekdays);
  const lastCompletedDate =
    candidate.lastCompletedDate === null
      ? null
      : typeof candidate.lastCompletedDate === 'string'
        ? candidate.lastCompletedDate
        : null;

  if (!id || !title || totalDays <= 0 || !createdAt || !updatedAt) {
    return null;
  }

  if (lastCompletedDate && !DATE_PATTERN.test(lastCompletedDate)) {
    return null;
  }

  const normalizedTimeline = normalizeTimeline(candidate.timeline, totalDays, completedDays);

  return {
    id,
    title,
    totalDays,
    completedDays: Math.min(normalizedTimeline.completedDays, totalDays),
    timeline: normalizedTimeline.timeline,
    trackedWeekdays,
    lastCompletedDate,
    createdAt,
    updatedAt,
    accentColor,
  };
}

export function normalizeGoalsState(raw: unknown): GoalsState {
  if (!raw || typeof raw !== 'object') {
    return {
      goals: [],
      trueFocusGoalId: null,
    };
  }

  const candidate = raw as Partial<GoalsState>;
  if (!Array.isArray(candidate.goals)) {
    return {
      goals: [],
      trueFocusGoalId: null,
    };
  }

  const goals: Goal[] = [];
  const seenIds = new Set<string>();

  for (const goalCandidate of candidate.goals) {
    const normalizedGoal = normalizeGoal(goalCandidate);
    if (!normalizedGoal || seenIds.has(normalizedGoal.id)) {
      continue;
    }
    seenIds.add(normalizedGoal.id);
    goals.push(normalizedGoal);
    if (goals.length >= MAX_GOALS) {
      break;
    }
  }

  const trueFocusGoalId =
    typeof candidate.trueFocusGoalId === 'string' &&
    goals.some((goal) => goal.id === candidate.trueFocusGoalId)
      ? candidate.trueFocusGoalId
      : goals[0]?.id ?? null;

  return {
    goals,
    trueFocusGoalId,
  };
}
