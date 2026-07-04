import {
  DEFAULT_MULTIPLE_DAILY_TARGET,
  MAX_DAILY_TARGET,
  MIN_MULTIPLE_DAILY_TARGET,
} from '../store/goalConfig';
import { Goal, GoalRecord, GoalType } from '../store/goalTypes';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeGoalType(value: unknown): GoalType {
  return value === 'multipleTimesPerDay' ? 'multipleTimesPerDay' : 'oncePerDay';
}

export function normalizeDailyTarget(type: GoalType, value: unknown): number {
  if (type === 'oncePerDay') {
    return 1;
  }

  const parsed =
    typeof value === 'number' && Number.isFinite(value)
      ? Math.floor(value)
      : DEFAULT_MULTIPLE_DAILY_TARGET;
  return Math.min(MAX_DAILY_TARGET, Math.max(MIN_MULTIPLE_DAILY_TARGET, parsed));
}

export function isMultipleTimesPerDayGoal(goal: Pick<Goal, 'type'>): boolean {
  return goal.type === 'multipleTimesPerDay';
}

export function getGoalDailyTarget(goal: Pick<Goal, 'type' | 'dailyTarget'>): number {
  return normalizeDailyTarget(goal.type, goal.dailyTarget);
}

export function normalizeGoalRecords(
  rawRecords: unknown,
  dailyTarget: number,
): Record<string, GoalRecord> {
  if (!rawRecords || typeof rawRecords !== 'object') {
    return {};
  }

  const records: Record<string, GoalRecord> = {};
  for (const [date, rawRecord] of Object.entries(rawRecords as Record<string, unknown>)) {
    if (!DATE_PATTERN.test(date) || !rawRecord || typeof rawRecord !== 'object') {
      continue;
    }

    const rawCount = (rawRecord as Partial<GoalRecord>).count;
    if (typeof rawCount !== 'number' || !Number.isFinite(rawCount)) {
      continue;
    }

    const count = Math.min(dailyTarget, Math.max(0, Math.floor(rawCount)));
    if (count > 0) {
      records[date] = { count };
    }
  }

  return records;
}

export function getRecordCount(goal: Pick<Goal, 'records' | 'dailyTarget'>, date: string): number {
  const count = goal.records[date]?.count ?? 0;
  return Math.min(goal.dailyTarget, Math.max(0, Math.floor(count)));
}

export function getDateProgressRatio(
  goal: Pick<Goal, 'records' | 'dailyTarget'>,
  date: string,
): number {
  if (goal.dailyTarget <= 0) {
    return 0;
  }
  return Math.min(1, getRecordCount(goal, date) / goal.dailyTarget);
}

export function setRecordCount(
  goal: Goal,
  date: string,
  count: number,
): Record<string, GoalRecord> {
  const nextRecords = { ...goal.records };
  const normalizedCount = Math.min(getGoalDailyTarget(goal), Math.max(0, Math.floor(count)));

  if (normalizedCount <= 0) {
    delete nextRecords[date];
    return nextRecords;
  }

  nextRecords[date] = { count: normalizedCount };
  return nextRecords;
}
