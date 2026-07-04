import { Goal } from '../store/goalTypes';
import { getLocalDateString } from './date';
import { getGoalDailyTarget, getRecordCount } from './goalProgress';

export type WidgetSnapshot = {
  title: string;
  totalDays: number;
  completedDays: number;
  lastCompletedDate: string | null;
  accentColor?: string;
  updatedAt: string;
  type: Goal['type'];
  dailyTarget: number;
  todayCount: number;
  todayProgressLabel: string;
  isDoneToday: boolean;
};

export function buildWidgetSnapshot(goal: Goal): WidgetSnapshot {
  const today = getLocalDateString();
  const dailyTarget = getGoalDailyTarget(goal);
  const todayCount =
    goal.type === 'multipleTimesPerDay'
      ? getRecordCount(goal, today)
      : goal.lastCompletedDate === today
        ? 1
        : 0;
  const isDoneToday = todayCount >= dailyTarget;

  return {
    title: goal.title,
    totalDays: goal.totalDays,
    completedDays: goal.completedDays,
    lastCompletedDate: goal.lastCompletedDate,
    accentColor: goal.accentColor,
    updatedAt: new Date().toISOString(),
    type: goal.type,
    dailyTarget,
    todayCount,
    todayProgressLabel:
      goal.type === 'multipleTimesPerDay'
        ? isDoneToday
          ? 'Done today'
          : `${todayCount} / ${dailyTarget} today`
        : isDoneToday
          ? 'Done today'
          : '',
    isDoneToday,
  };
}
