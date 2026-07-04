import { Goal, GoalsState, GoalDayState } from '../store/goalTypes';
import {
  getGoalDailyTarget,
  normalizeDailyTarget,
  normalizeGoalRecords,
  normalizeGoalType,
  setRecordCount,
} from './goalProgress';
import {
  addDaysToDateString,
  getLocalDateString,
  isTrackedOnDate,
  normalizeTrackedWeekdays,
} from './date';

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
    completedDays: timeline.reduce(
      (count, entry) => (entry === 'completed' ? count + 1 : count),
      0,
    ),
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

function countCompletedDays(timeline: GoalDayState[]): number {
  return timeline.reduce((count, entry) => (entry === 'completed' ? count + 1 : count), 0);
}

function getLocalDateFromIsoString(value: string): string | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return getLocalDateString(parsed);
}

function getFallbackStateForDate(date: string, trackedWeekdays: number[]): GoalDayState {
  return isTrackedOnDate(date, trackedWeekdays) ? 'skipped' : 'off';
}

function getLastCompletedDateFromTimeline(
  timeline: GoalDayState[],
  startDate: string,
): string | null {
  const lastCompletedIndex = timeline.lastIndexOf('completed');
  if (lastCompletedIndex < 0) {
    return null;
  }
  return addDaysToDateString(startDate, lastCompletedIndex);
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
  const type = normalizeGoalType(candidate.type);
  const dailyTarget = normalizeDailyTarget(type, candidate.dailyTarget);
  const createdAt = typeof candidate.createdAt === 'string' ? candidate.createdAt : '';
  const updatedAt =
    typeof candidate.updatedAt === 'string' && candidate.updatedAt.length > 0
      ? candidate.updatedAt
      : (options?.fallbackUpdatedAt ?? createdAt);
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
  const startDate = getLocalDateFromIsoString(createdAt) ?? getLocalDateString();
  let timeline = normalizedTimeline.timeline;
  let records = normalizeGoalRecords(candidate.records, dailyTarget);

  if (type === 'multipleTimesPerDay') {
    let recordsGoal = {
      id,
      title,
      type,
      totalDays,
      completedDays: normalizedTimeline.completedDays,
      timeline,
      trackedWeekdays,
      lastCompletedDate,
      createdAt,
      updatedAt,
      accentColor,
      dailyTarget,
      records,
    };

    timeline.forEach((entry, index) => {
      if (entry !== 'completed') {
        return;
      }
      const date = addDaysToDateString(startDate, index);
      if (!records[date]) {
        records = setRecordCount(recordsGoal, date, dailyTarget);
        recordsGoal = {
          ...recordsGoal,
          records,
        };
      }
    });

    timeline = timeline.map((entry, index) => {
      const date = addDaysToDateString(startDate, index);
      const count = records[date]?.count ?? 0;
      if (count >= getGoalDailyTarget(recordsGoal)) {
        return 'completed';
      }
      if (entry === 'completed') {
        return getFallbackStateForDate(date, trackedWeekdays);
      }
      return entry;
    });
  }

  const normalizedCompletedDays = Math.min(countCompletedDays(timeline), totalDays);
  const normalizedLastCompletedDate =
    type === 'multipleTimesPerDay'
      ? getLastCompletedDateFromTimeline(timeline, startDate)
      : lastCompletedDate;

  return {
    id,
    title,
    type,
    totalDays,
    completedDays: normalizedCompletedDays,
    timeline,
    trackedWeekdays,
    lastCompletedDate: normalizedLastCompletedDate,
    createdAt,
    updatedAt,
    accentColor,
    dailyTarget,
    records,
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
      : (goals[0]?.id ?? null);

  return {
    goals,
    trueFocusGoalId,
  };
}
