import { GoalsState } from '../store/goalTypes';
import { canMarkDone, getLocalDateString } from './date';
import { getGoalDailyTarget, getRecordCount } from './goalProgress';
import { getGoalStreak } from './goalMetrics';

export type WatchGoalSnapshot = {
  id: string;
  title: string;
  isTrueFocus: boolean;
  type: 'oncePerDay' | 'multipleTimesPerDay';
  completedDays: number;
  totalDays: number;
  streak: number;
  todayCount: number;
  dailyTarget: number;
  isCompletedToday: boolean;
  canTrackToday: boolean;
};

export type WatchAppSnapshot = {
  version: 1;
  generatedAt: string;
  trueFocusGoalId: string | null;
  goals: WatchGoalSnapshot[];
};

export type WatchActionRequest = {
  version: 1;
  actionId: string;
  action: 'getGoalsSnapshot' | 'markDone' | 'trackOne' | 'undoLast';
  goalId?: string;
  sentAt: string;
};

export type WatchActionResponse = {
  version: 1;
  actionId: string;
  ok: boolean;
  reason?: 'notReachable' | 'goalNotFound' | 'alreadyDone' | 'notTrackableToday' | 'unknown';
  snapshot?: WatchAppSnapshot;
  message?: string;
};

function getDefaultGoalId(state: GoalsState): string | null {
  if (state.trueFocusGoalId && state.goals.some((goal) => goal.id === state.trueFocusGoalId)) {
    return state.trueFocusGoalId;
  }
  return state.goals[0]?.id ?? null;
}

export function buildWatchSnapshot(state: GoalsState): WatchAppSnapshot {
  const today = getLocalDateString();
  const trueFocusGoalId = getDefaultGoalId(state);

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    trueFocusGoalId,
    goals: state.goals.map((goal) => {
      const dailyTarget = getGoalDailyTarget(goal);
      const todayCount =
        goal.type === 'multipleTimesPerDay'
          ? getRecordCount(goal, today)
          : goal.lastCompletedDate === today
            ? 1
            : 0;
      const isCompletedToday = todayCount >= dailyTarget;
      const canTrackToday =
        goal.completedDays < goal.totalDays &&
        (goal.type === 'multipleTimesPerDay'
          ? todayCount < dailyTarget
          : canMarkDone(today, goal.lastCompletedDate));

      return {
        id: goal.id,
        title: goal.title,
        isTrueFocus: goal.id === trueFocusGoalId,
        type: goal.type,
        completedDays: goal.completedDays,
        totalDays: goal.totalDays,
        streak: getGoalStreak(goal),
        todayCount,
        dailyTarget,
        isCompletedToday,
        canTrackToday,
      };
    }),
  };
}
