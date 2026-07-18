import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

import { addWatchActionListener, publishWatchSnapshot } from '../native/watchBridge';
import { clearWidgetSnapshot, writeWidgetSnapshot } from '../native/widgetBridge';
import {
  addDaysToDateString,
  canMarkDone,
  getDateDiffInDays,
  getLocalDateString,
  isTrackedOnDate,
  normalizeTrackedWeekdays,
} from '../utils/date';
import {
  getGoalDailyTarget,
  getRecordCount,
  normalizeDailyTarget,
  normalizeGoalType,
  normalizeGoalRecords,
  setRecordCount,
} from '../utils/goalProgress';
import { normalizeGoal, normalizeGoalsState } from '../utils/goalValidation';
import {
  buildWatchSnapshot,
  WatchActionRequest,
  WatchActionResponse,
} from '../utils/watchSnapshot';
import { buildWidgetSnapshot } from '../utils/widgetSnapshot';
import { MAX_GOALS } from './goalConfig';
import { Goal, GoalDayState, GoalInput, GoalsState, GoalUpdate, TrackOneResult } from './goalTypes';

export type GoalStore = {
  goals: Goal[];
  goal: Goal | null;
  trueFocusGoalId: string | null;
  selectedGoalId: string | null;
  isLoading: boolean;
  canCreateMoreGoals: boolean;
  loadGoal: () => Promise<void>;
  createGoal: (input: GoalInput) => Promise<Goal | null>;
  markDone: (goalId?: string) => Promise<boolean>;
  markDay: (date: string, goalId?: string) => Promise<boolean>;
  undoDay: (date: string, goalId?: string) => Promise<boolean>;
  undoToday: (goalId?: string) => Promise<boolean>;
  trackOneToday: (goalId?: string) => Promise<TrackOneResult>;
  undoTodayProgress: (goalId?: string) => Promise<boolean>;
  deleteGoal: (goalId?: string) => Promise<boolean>;
  resetGoal: (goalId?: string) => Promise<void>;
  restartGoal: (goalId?: string) => Promise<Goal | null>;
  updateGoal: (updates: GoalUpdate, goalId?: string) => Promise<Goal | null>;
  setSelectedGoal: (goalId: string | null) => void;
  setTrueFocusGoal: (goalId: string) => Promise<void>;
};

const STORAGE_KEY = 'one-goal/active-goal';

const GoalContext = createContext<GoalStore | undefined>(undefined);

function generateGoalId() {
  return `goal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getLocalDateFromIsoString(value: string): string | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return getLocalDateString(parsed);
}

function getGoalStartDate(goal: Goal): string {
  return getLocalDateFromIsoString(goal.createdAt) ?? getLocalDateString();
}

function getTrackedStateForDate(date: string, trackedWeekdays: number[]): GoalDayState {
  return isTrackedOnDate(date, trackedWeekdays) ? 'skipped' : 'off';
}

function countCompletedDays(timeline: GoalDayState[]): number {
  return timeline.reduce((count, state) => (state === 'completed' ? count + 1 : count), 0);
}

function isMultipleTimesPerDayGoal(goal: Goal): boolean {
  return goal.type === 'multipleTimesPerDay';
}

function syncMultipleTimesTimeline(goal: Goal): Goal {
  if (!isMultipleTimesPerDayGoal(goal)) {
    return goal;
  }

  const startDate = getGoalStartDate(goal);
  let didChange = false;
  const nextTimeline = goal.timeline.map((state, index) => {
    const date = addDaysToDateString(startDate, index);
    const count = getRecordCount(goal, date);
    const nextState =
      count >= getGoalDailyTarget(goal)
        ? 'completed'
        : state === 'completed'
          ? getTrackedStateForDate(date, goal.trackedWeekdays)
          : state;

    if (nextState !== state) {
      didChange = true;
    }
    return nextState;
  });

  const completedDays = Math.min(goal.totalDays, countCompletedDays(nextTimeline));
  const lastCompletedDate = getLastCompletedDateFromTimeline(goal, nextTimeline);
  if (
    !didChange &&
    completedDays === goal.completedDays &&
    lastCompletedDate === goal.lastCompletedDate
  ) {
    return goal;
  }

  return {
    ...goal,
    timeline: nextTimeline,
    completedDays,
    lastCompletedDate,
  };
}

function getLastCompletedDateFromTimeline(goal: Goal, timeline: GoalDayState[]): string | null {
  const lastCompletedIndex = timeline.lastIndexOf('completed');
  if (lastCompletedIndex < 0) {
    return null;
  }
  return addDaysToDateString(getGoalStartDate(goal), lastCompletedIndex);
}

function reconcilePastTimeline(goal: Goal, today: string): Goal {
  const startDate = getGoalStartDate(goal);
  const yesterday = addDaysToDateString(today, -1);
  const nextTimelineDate = addDaysToDateString(startDate, goal.timeline.length);
  const missingPastDays = getDateDiffInDays(nextTimelineDate, yesterday) + 1;
  if (missingPastDays <= 0) {
    return goal;
  }

  const entries = Array.from({ length: missingPastDays }, (_, index) => {
    const date = addDaysToDateString(nextTimelineDate, index);
    return getTrackedStateForDate(date, goal.trackedWeekdays);
  });

  return {
    ...goal,
    timeline: [...goal.timeline, ...entries],
  };
}

function ensureCompletedDays(goal: Goal): Goal {
  const completedFromTimeline = countCompletedDays(goal.timeline);
  const clampedCompleted = Math.min(goal.totalDays, completedFromTimeline);
  if (goal.completedDays === clampedCompleted) {
    return goal;
  }
  return {
    ...goal,
    completedDays: clampedCompleted,
  };
}

function fillTimelineUntilIndex(
  goal: Goal,
  timeline: GoalDayState[],
  targetIndex: number,
): GoalDayState[] {
  const startDate = getGoalStartDate(goal);
  const nextTimeline = [...timeline];
  while (nextTimeline.length < targetIndex) {
    const date = addDaysToDateString(startDate, nextTimeline.length);
    nextTimeline.push(getTrackedStateForDate(date, goal.trackedWeekdays));
  }
  return nextTimeline;
}

function normalizeGoalForRuntime(goal: Goal, today: string): Goal {
  return ensureCompletedDays(syncMultipleTimesTimeline(reconcilePastTimeline(goal, today)));
}

function getDefaultGoalId(goals: Goal[], trueFocusGoalId: string | null): string | null {
  if (trueFocusGoalId && goals.some((goal) => goal.id === trueFocusGoalId)) {
    return trueFocusGoalId;
  }
  return goals[0]?.id ?? null;
}

function getFocusGoal(goals: Goal[], trueFocusGoalId: string | null): Goal | null {
  const goalId = getDefaultGoalId(goals, trueFocusGoalId);
  if (!goalId) {
    return null;
  }
  return goals.find((goal) => goal.id === goalId) ?? null;
}

function getSelectedGoalId(
  goals: Goal[],
  trueFocusGoalId: string | null,
  currentSelectedGoalId: string | null,
): string | null {
  if (currentSelectedGoalId && goals.some((goal) => goal.id === currentSelectedGoalId)) {
    return currentSelectedGoalId;
  }
  return getDefaultGoalId(goals, trueFocusGoalId);
}

function normalizeRuntimeState(
  state: GoalsState,
  today: string,
): { state: GoalsState; didChange: boolean } {
  let didChange = false;
  const goals = state.goals.map((goal) => {
    const normalizedGoal = normalizeGoalForRuntime(goal, today);
    if (
      normalizedGoal.timeline.length !== goal.timeline.length ||
      normalizedGoal.timeline.some((state, index) => state !== goal.timeline[index]) ||
      normalizedGoal.completedDays !== goal.completedDays ||
      normalizedGoal.lastCompletedDate !== goal.lastCompletedDate
    ) {
      didChange = true;
    }
    return normalizedGoal;
  });

  const trueFocusGoalId = getDefaultGoalId(goals, state.trueFocusGoalId);
  if (trueFocusGoalId !== state.trueFocusGoalId) {
    didChange = true;
  }

  return {
    state: {
      goals,
      trueFocusGoalId,
    },
    didChange,
  };
}

function replaceGoal(goals: Goal[], nextGoal: Goal): Goal[] {
  return goals.map((goal) => (goal.id === nextGoal.id ? nextGoal : goal));
}

function buildPersistedState(goals: Goal[], trueFocusGoalId: string | null): GoalsState {
  return {
    goals,
    trueFocusGoalId: getDefaultGoalId(goals, trueFocusGoalId),
  };
}

function shiftRecordsForStartDate(
  records: Goal['records'],
  currentStartDate: string,
  nextStartDate: string,
): Goal['records'] {
  if (currentStartDate === nextStartDate) {
    return records;
  }

  const nextRecords: Goal['records'] = {};
  for (const [date, record] of Object.entries(records)) {
    const offset = getDateDiffInDays(currentStartDate, date);
    if (offset < 0) {
      continue;
    }
    nextRecords[addDaysToDateString(nextStartDate, offset)] = record;
  }
  return nextRecords;
}

function backfillCompletedRecords(
  goal: Goal,
  timeline: GoalDayState[],
  startDate: string,
): Goal['records'] {
  if (!isMultipleTimesPerDayGoal(goal)) {
    return {};
  }

  let nextRecords = normalizeGoalRecords(goal.records, getGoalDailyTarget(goal));
  let recordGoal = {
    ...goal,
    records: nextRecords,
  };

  timeline.forEach((state, index) => {
    if (state !== 'completed') {
      return;
    }
    const date = addDaysToDateString(startDate, index);
    if (!nextRecords[date]) {
      nextRecords = setRecordCount(recordGoal, date, getGoalDailyTarget(goal));
      recordGoal = {
        ...recordGoal,
        records: nextRecords,
      };
    }
  });

  return nextRecords;
}

function isPersistedGoalsState(raw: unknown): raw is GoalsState {
  return !!raw && typeof raw === 'object' && Array.isArray((raw as GoalsState).goals);
}

export function GoalProvider({
  children,
  autoLoad = true,
}: React.PropsWithChildren<{ autoLoad?: boolean }>) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [trueFocusGoalId, setTrueFocusGoalIdState] = useState<string | null>(null);
  const [selectedGoalId, setSelectedGoalIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const goalsRef = useRef<Goal[]>([]);
  const trueFocusGoalIdRef = useRef<string | null>(null);
  const selectedGoalIdRef = useRef<string | null>(null);

  const applyState = useCallback((nextState: GoalsState, nextSelectedGoalId?: string | null) => {
    const resolvedSelectedGoalId = getSelectedGoalId(
      nextState.goals,
      nextState.trueFocusGoalId,
      nextSelectedGoalId ?? selectedGoalIdRef.current,
    );

    goalsRef.current = nextState.goals;
    trueFocusGoalIdRef.current = nextState.trueFocusGoalId;
    selectedGoalIdRef.current = resolvedSelectedGoalId;
    setGoals(nextState.goals);
    setTrueFocusGoalIdState(nextState.trueFocusGoalId);
    setSelectedGoalIdState(resolvedSelectedGoalId);
  }, []);

  const persistState = useCallback(async (nextState: GoalsState) => {
    try {
      if (nextState.goals.length === 0) {
        await AsyncStorage.removeItem(STORAGE_KEY);
        return;
      }
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    } catch (error) {
      console.warn('Failed to persist goals to storage.', error);
    }
  }, []);

  const syncWidget = useCallback(async (nextState: GoalsState) => {
    try {
      const goal = getFocusGoal(nextState.goals, nextState.trueFocusGoalId);
      if (!goal) {
        await clearWidgetSnapshot();
        return;
      }
      await writeWidgetSnapshot(buildWidgetSnapshot(goal));
    } catch (error) {
      console.warn('Failed to update widget snapshot.', error);
    }
  }, []);

  const syncWatch = useCallback(async (nextState: GoalsState) => {
    try {
      await publishWatchSnapshot(buildWatchSnapshot(nextState));
    } catch (error) {
      console.warn('Failed to update Watch snapshot.', error);
    }
  }, []);

  const syncNativeSurfaces = useCallback(
    async (nextState: GoalsState) => {
      await syncWidget(nextState);
      await syncWatch(nextState);
    },
    [syncWidget, syncWatch],
  );

  const selectedGoal = useMemo(
    () => goals.find((goal) => goal.id === selectedGoalId) ?? null,
    [goals, selectedGoalId],
  );

  const loadGoal = useCallback(async () => {
    setIsLoading(true);
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const emptyState: GoalsState = { goals: [], trueFocusGoalId: null };
        applyState(emptyState, null);
        await syncNativeSurfaces(emptyState);
        return;
      }

      const parsed = JSON.parse(raw) as unknown;
      const today = getLocalDateString();

      let persistedState: GoalsState;
      let didMigrateLegacy = false;

      if (isPersistedGoalsState(parsed)) {
        persistedState = normalizeGoalsState(parsed);
        didMigrateLegacy = JSON.stringify(parsed) !== JSON.stringify(persistedState);
      } else {
        const fallbackTimestamp = new Date().toISOString();
        const legacyGoal = normalizeGoal(parsed, {
          fallbackId: generateGoalId(),
          fallbackUpdatedAt:
            typeof (parsed as { createdAt?: string })?.createdAt === 'string'
              ? (parsed as { createdAt: string }).createdAt
              : fallbackTimestamp,
        });

        if (!legacyGoal) {
          const emptyState: GoalsState = { goals: [], trueFocusGoalId: null };
          await AsyncStorage.removeItem(STORAGE_KEY);
          applyState(emptyState, null);
          await syncNativeSurfaces(emptyState);
          return;
        }

        persistedState = {
          goals: [legacyGoal],
          trueFocusGoalId: legacyGoal.id,
        };
        didMigrateLegacy = true;
      }

      const normalizedState = normalizeRuntimeState(persistedState, today);
      applyState(
        normalizedState.state,
        getDefaultGoalId(normalizedState.state.goals, normalizedState.state.trueFocusGoalId),
      );

      if (didMigrateLegacy || normalizedState.didChange) {
        await persistState(normalizedState.state);
      }
      await syncNativeSurfaces(normalizedState.state);
    } catch (error) {
      const emptyState: GoalsState = { goals: [], trueFocusGoalId: null };
      console.warn('Failed to load goals from storage.', error);
      applyState(emptyState, null);
      await AsyncStorage.removeItem(STORAGE_KEY);
      await syncNativeSurfaces(emptyState);
    } finally {
      setIsLoading(false);
    }
  }, [applyState, persistState, syncNativeSurfaces]);

  const createGoal = useCallback(
    async (input: GoalInput) => {
      if (goalsRef.current.length >= MAX_GOALS) {
        return null;
      }

      const now = new Date().toISOString();
      const type = normalizeGoalType(input.type);
      const dailyTarget = normalizeDailyTarget(type, input.dailyTarget);
      const nextGoal: Goal = {
        id: generateGoalId(),
        title: input.title.trim(),
        type,
        totalDays: Math.max(1, Math.floor(input.totalDays)),
        completedDays: 0,
        timeline: [],
        trackedWeekdays: normalizeTrackedWeekdays(input.trackedWeekdays),
        lastCompletedDate: null,
        createdAt: now,
        updatedAt: now,
        accentColor: input.accentColor,
        dailyTarget,
        records: {},
      };

      const nextGoals = [...goalsRef.current, nextGoal];
      const nextState = buildPersistedState(nextGoals, trueFocusGoalIdRef.current ?? nextGoal.id);
      applyState(nextState, nextGoal.id);
      await persistState(nextState);
      await syncNativeSurfaces(nextState);
      return nextGoal;
    },
    [applyState, persistState, syncNativeSurfaces],
  );

  const commitGoals = useCallback(
    async (
      nextGoals: Goal[],
      nextTrueFocusGoalId: string | null,
      nextSelectedGoalId?: string | null,
    ) => {
      const nextState = buildPersistedState(nextGoals, nextTrueFocusGoalId);
      applyState(nextState, nextSelectedGoalId);
      await persistState(nextState);
      await syncNativeSurfaces(nextState);
      return nextState;
    },
    [applyState, persistState, syncNativeSurfaces],
  );

  const markDone = useCallback(
    async (goalId?: string) => {
      const activeGoalId = goalId ?? selectedGoalIdRef.current;
      const currentGoals = goalsRef.current;
      const goal = currentGoals.find((entry) => entry.id === activeGoalId);
      if (!goal) {
        return false;
      }

      const today = getLocalDateString();
      const reconciledGoal = normalizeGoalForRuntime(goal, today);

      if (!canMarkDone(today, reconciledGoal.lastCompletedDate)) {
        return false;
      }

      if (
        reconciledGoal.completedDays >= reconciledGoal.totalDays ||
        reconciledGoal.totalDays <= 0
      ) {
        return false;
      }

      const startDate = getGoalStartDate(reconciledGoal);
      const todayIndex = getDateDiffInDays(startDate, today);
      if (todayIndex < 0) {
        return false;
      }

      let nextTimeline = fillTimelineUntilIndex(
        reconciledGoal,
        reconciledGoal.timeline,
        todayIndex,
      );
      nextTimeline = [...nextTimeline];
      if (nextTimeline.length === todayIndex) {
        nextTimeline.push('completed');
      } else {
        nextTimeline[todayIndex] = 'completed';
      }

      const now = new Date().toISOString();
      const nextRecords = isMultipleTimesPerDayGoal(reconciledGoal)
        ? setRecordCount(reconciledGoal, today, getGoalDailyTarget(reconciledGoal))
        : reconciledGoal.records;
      const nextGoal: Goal = {
        ...reconciledGoal,
        timeline: nextTimeline,
        completedDays: Math.min(reconciledGoal.totalDays, countCompletedDays(nextTimeline)),
        lastCompletedDate: today,
        updatedAt: now,
        records: nextRecords,
      };

      await commitGoals(
        replaceGoal(currentGoals, nextGoal),
        trueFocusGoalIdRef.current,
        activeGoalId,
      );
      return true;
    },
    [commitGoals],
  );

  const markDay = useCallback(
    async (date: string, goalId?: string) => {
      const activeGoalId = goalId ?? selectedGoalIdRef.current;
      const currentGoals = goalsRef.current;
      const goal = currentGoals.find((entry) => entry.id === activeGoalId);
      if (!goal) {
        return false;
      }

      const today = getLocalDateString();
      const reconciledGoal = normalizeGoalForRuntime(goal, today);

      if (date > today) {
        return false;
      }

      if (
        reconciledGoal.completedDays >= reconciledGoal.totalDays ||
        reconciledGoal.totalDays <= 0
      ) {
        return false;
      }

      const startDate = getGoalStartDate(reconciledGoal);
      const targetIndex = getDateDiffInDays(startDate, date);
      if (targetIndex < 0) {
        return false;
      }

      const nextTimeline = fillTimelineUntilIndex(
        reconciledGoal,
        reconciledGoal.timeline,
        targetIndex,
      );
      if (targetIndex < nextTimeline.length && nextTimeline[targetIndex] === 'completed') {
        return false;
      }

      const writableTimeline = [...nextTimeline];
      if (writableTimeline.length === targetIndex) {
        writableTimeline.push('completed');
      } else {
        writableTimeline[targetIndex] = 'completed';
      }

      const nextRecords = isMultipleTimesPerDayGoal(reconciledGoal)
        ? setRecordCount(reconciledGoal, date, getGoalDailyTarget(reconciledGoal))
        : reconciledGoal.records;
      const nextGoal: Goal = {
        ...reconciledGoal,
        timeline: writableTimeline,
        completedDays: Math.min(reconciledGoal.totalDays, countCompletedDays(writableTimeline)),
        lastCompletedDate: getLastCompletedDateFromTimeline(reconciledGoal, writableTimeline),
        updatedAt: new Date().toISOString(),
        records: nextRecords,
      };

      await commitGoals(
        replaceGoal(currentGoals, nextGoal),
        trueFocusGoalIdRef.current,
        activeGoalId,
      );
      return true;
    },
    [commitGoals],
  );

  const undoDay = useCallback(
    async (date: string, goalId?: string) => {
      const activeGoalId = goalId ?? selectedGoalIdRef.current;
      const currentGoals = goalsRef.current;
      const goal = currentGoals.find((entry) => entry.id === activeGoalId);
      if (!goal) {
        return false;
      }

      const today = getLocalDateString();
      const reconciledGoal = normalizeGoalForRuntime(goal, today);
      const startDate = getGoalStartDate(reconciledGoal);
      const targetIndex = getDateDiffInDays(startDate, date);

      if (date > today || targetIndex < 0 || targetIndex >= reconciledGoal.timeline.length) {
        return false;
      }

      if (
        reconciledGoal.timeline[targetIndex] !== 'completed' ||
        reconciledGoal.completedDays <= 0
      ) {
        return false;
      }

      const nextTimeline = [...reconciledGoal.timeline];

      if (date === today) {
        if (targetIndex !== nextTimeline.length - 1) {
          return false;
        }
        nextTimeline.pop();
      } else {
        nextTimeline[targetIndex] = getTrackedStateForDate(date, reconciledGoal.trackedWeekdays);
      }

      const nextRecords = isMultipleTimesPerDayGoal(reconciledGoal)
        ? setRecordCount(reconciledGoal, date, 0)
        : reconciledGoal.records;
      const nextGoal: Goal = {
        ...reconciledGoal,
        timeline: nextTimeline,
        completedDays: Math.min(reconciledGoal.totalDays, countCompletedDays(nextTimeline)),
        lastCompletedDate: getLastCompletedDateFromTimeline(reconciledGoal, nextTimeline),
        updatedAt: new Date().toISOString(),
        records: nextRecords,
      };

      await commitGoals(
        replaceGoal(currentGoals, nextGoal),
        trueFocusGoalIdRef.current,
        activeGoalId,
      );
      return true;
    },
    [commitGoals],
  );

  const undoToday = useCallback(
    async (goalId?: string) => undoDay(getLocalDateString(), goalId),
    [undoDay],
  );

  const trackOneToday = useCallback(
    async (goalId?: string): Promise<TrackOneResult> => {
      const activeGoalId = goalId ?? selectedGoalIdRef.current;
      const currentGoals = goalsRef.current;
      const goal = currentGoals.find((entry) => entry.id === activeGoalId);
      if (!goal || !isMultipleTimesPerDayGoal(goal)) {
        return false;
      }

      const today = getLocalDateString();
      const reconciledGoal = normalizeGoalForRuntime(goal, today);
      if (
        reconciledGoal.completedDays >= reconciledGoal.totalDays ||
        reconciledGoal.totalDays <= 0
      ) {
        return false;
      }

      const dailyTarget = getGoalDailyTarget(reconciledGoal);
      const currentCount = getRecordCount(reconciledGoal, today);
      if (currentCount >= dailyTarget) {
        return false;
      }

      const nextCount = Math.min(dailyTarget, currentCount + 1);
      const nextRecords = setRecordCount(reconciledGoal, today, nextCount);
      const now = new Date().toISOString();

      if (nextCount < dailyTarget) {
        const nextGoal: Goal = {
          ...reconciledGoal,
          records: nextRecords,
          updatedAt: now,
        };
        await commitGoals(
          replaceGoal(currentGoals, nextGoal),
          trueFocusGoalIdRef.current,
          activeGoalId,
        );
        return 'incremented';
      }

      const startDate = getGoalStartDate(reconciledGoal);
      const todayIndex = getDateDiffInDays(startDate, today);
      if (todayIndex < 0) {
        return false;
      }

      let nextTimeline = fillTimelineUntilIndex(
        reconciledGoal,
        reconciledGoal.timeline,
        todayIndex,
      );
      nextTimeline = [...nextTimeline];
      if (nextTimeline.length === todayIndex) {
        nextTimeline.push('completed');
      } else {
        nextTimeline[todayIndex] = 'completed';
      }

      const nextGoal: Goal = {
        ...reconciledGoal,
        records: nextRecords,
        timeline: nextTimeline,
        completedDays: Math.min(reconciledGoal.totalDays, countCompletedDays(nextTimeline)),
        lastCompletedDate: getLastCompletedDateFromTimeline(reconciledGoal, nextTimeline),
        updatedAt: now,
      };

      await commitGoals(
        replaceGoal(currentGoals, nextGoal),
        trueFocusGoalIdRef.current,
        activeGoalId,
      );
      return 'completed';
    },
    [commitGoals],
  );

  const undoTodayProgress = useCallback(
    async (goalId?: string) => {
      const activeGoalId = goalId ?? selectedGoalIdRef.current;
      const currentGoals = goalsRef.current;
      const goal = currentGoals.find((entry) => entry.id === activeGoalId);
      if (!goal || !isMultipleTimesPerDayGoal(goal)) {
        return false;
      }

      const today = getLocalDateString();
      const reconciledGoal = normalizeGoalForRuntime(goal, today);
      const dailyTarget = getGoalDailyTarget(reconciledGoal);
      const currentCount = getRecordCount(reconciledGoal, today);
      if (currentCount <= 0) {
        return false;
      }

      const nextCount = Math.max(0, currentCount - 1);
      const nextRecords = setRecordCount(reconciledGoal, today, nextCount);
      const startDate = getGoalStartDate(reconciledGoal);
      const targetIndex = getDateDiffInDays(startDate, today);
      let nextTimeline = [...reconciledGoal.timeline];

      if (
        currentCount >= dailyTarget &&
        nextCount < dailyTarget &&
        targetIndex >= 0 &&
        targetIndex < nextTimeline.length &&
        nextTimeline[targetIndex] === 'completed'
      ) {
        if (targetIndex === nextTimeline.length - 1) {
          nextTimeline.pop();
        } else {
          nextTimeline[targetIndex] = getTrackedStateForDate(today, reconciledGoal.trackedWeekdays);
        }
      }

      const nextGoal: Goal = {
        ...reconciledGoal,
        records: nextRecords,
        timeline: nextTimeline,
        completedDays: Math.min(reconciledGoal.totalDays, countCompletedDays(nextTimeline)),
        lastCompletedDate: getLastCompletedDateFromTimeline(reconciledGoal, nextTimeline),
        updatedAt: new Date().toISOString(),
      };

      await commitGoals(
        replaceGoal(currentGoals, nextGoal),
        trueFocusGoalIdRef.current,
        activeGoalId,
      );
      return true;
    },
    [commitGoals],
  );

  const deleteGoal = useCallback(
    async (goalId?: string) => {
      const activeGoalId = goalId ?? selectedGoalIdRef.current;
      if (!activeGoalId) {
        return false;
      }

      const currentGoals = goalsRef.current;
      if (!currentGoals.some((goal) => goal.id === activeGoalId)) {
        return false;
      }

      const currentSelectedGoalId = selectedGoalIdRef.current;
      const currentTrueFocusGoalId = trueFocusGoalIdRef.current;
      if (activeGoalId === currentTrueFocusGoalId) {
        return false;
      }

      const nextGoals = currentGoals.filter((goal) => goal.id !== activeGoalId);
      const nextSelectedGoalId =
        currentSelectedGoalId === activeGoalId
          ? getDefaultGoalId(nextGoals, currentTrueFocusGoalId)
          : currentSelectedGoalId;

      await commitGoals(nextGoals, currentTrueFocusGoalId, nextSelectedGoalId);
      return true;
    },
    [commitGoals],
  );

  const resetGoal = useCallback(
    async (goalId?: string) => {
      await deleteGoal(goalId);
    },
    [deleteGoal],
  );

  const restartGoal = useCallback(
    async (goalId?: string) => {
      const activeGoalId = goalId ?? selectedGoalIdRef.current;
      const currentGoals = goalsRef.current;
      const goal = currentGoals.find((entry) => entry.id === activeGoalId);
      if (!goal) {
        return null;
      }

      const now = new Date().toISOString();
      const nextGoal: Goal = {
        ...goal,
        completedDays: 0,
        timeline: [],
        records: {},
        lastCompletedDate: null,
        createdAt: now,
        updatedAt: now,
      };

      await commitGoals(
        replaceGoal(currentGoals, nextGoal),
        trueFocusGoalIdRef.current,
        activeGoalId,
      );
      return nextGoal;
    },
    [commitGoals],
  );

  const updateGoal = useCallback(
    async (updates: GoalUpdate, goalId?: string) => {
      const activeGoalId = goalId ?? selectedGoalIdRef.current;
      const currentGoals = goalsRef.current;
      const goal = currentGoals.find((entry) => entry.id === activeGoalId);
      if (!goal) {
        return null;
      }

      const today = getLocalDateString();
      const nextTitleRaw = updates.title !== undefined ? updates.title.trim() : goal.title;
      const nextTitle = nextTitleRaw.length > 0 ? nextTitleRaw : goal.title;
      const nextTotalDays = Math.max(1, Math.floor(updates.totalDays ?? goal.totalDays));
      const nextType = normalizeGoalType(updates.type ?? goal.type);
      const nextDailyTarget = normalizeDailyTarget(
        nextType,
        updates.dailyTarget ?? (nextType === goal.type ? goal.dailyTarget : undefined),
      );
      const trackedWeekdays = normalizeTrackedWeekdays(
        updates.trackedWeekdays ?? goal.trackedWeekdays,
      );
      const currentStartDate = getGoalStartDate(goal);
      const requestedStartDate =
        updates.createdAt !== undefined
          ? getLocalDateFromIsoString(updates.createdAt)
          : currentStartDate;
      const nextStartDate = requestedStartDate ?? currentStartDate;
      const didStartDateChange = nextStartDate !== currentStartDate;

      let nextLastCompletedDate =
        updates.lastCompletedDate !== undefined
          ? updates.lastCompletedDate
          : goal.lastCompletedDate;
      let nextTimeline = [...goal.timeline];
      let nextRecords =
        nextType === 'multipleTimesPerDay'
          ? normalizeGoalRecords(
              shiftRecordsForStartDate(goal.records, currentStartDate, nextStartDate),
              nextDailyTarget,
            )
          : {};
      const nextCreatedAt =
        requestedStartDate && updates.createdAt !== undefined ? updates.createdAt : goal.createdAt;

      if (didStartDateChange && goal.lastCompletedDate && updates.lastCompletedDate === undefined) {
        const lastCompletedOffset = getDateDiffInDays(currentStartDate, goal.lastCompletedDate);
        if (lastCompletedOffset >= 0) {
          nextLastCompletedDate = addDaysToDateString(nextStartDate, lastCompletedOffset);
        }
      }

      if (updates.trackedWeekdays !== undefined || didStartDateChange) {
        nextTimeline = nextTimeline.map((state, index) => {
          if (state === 'completed') {
            return 'completed';
          }
          const date = addDaysToDateString(nextStartDate, index);
          return getTrackedStateForDate(date, trackedWeekdays);
        });
      }

      if (nextTimeline.length > 0) {
        const lastTimelineDate = addDaysToDateString(nextStartDate, nextTimeline.length - 1);
        if (lastTimelineDate > today) {
          return null;
        }
      }

      const goalWithUpdatedProgressShape: Goal = {
        ...goal,
        type: nextType,
        dailyTarget: nextDailyTarget,
        records: nextRecords,
        timeline: nextTimeline,
        trackedWeekdays,
        totalDays: nextTotalDays,
        createdAt: nextCreatedAt,
      };
      nextRecords = backfillCompletedRecords(
        goalWithUpdatedProgressShape,
        nextTimeline,
        nextStartDate,
      );

      const nextGoal = normalizeGoalForRuntime(
        {
          ...goal,
          title: nextTitle,
          type: nextType,
          totalDays: nextTotalDays,
          accentColor: updates.accentColor ?? goal.accentColor,
          timeline: nextTimeline,
          trackedWeekdays,
          lastCompletedDate: nextLastCompletedDate,
          createdAt: nextCreatedAt,
          updatedAt: new Date().toISOString(),
          dailyTarget: nextDailyTarget,
          records: nextRecords,
        },
        today,
      );

      await commitGoals(
        replaceGoal(currentGoals, nextGoal),
        trueFocusGoalIdRef.current,
        activeGoalId,
      );
      return nextGoal;
    },
    [commitGoals],
  );

  const setSelectedGoal = useCallback((goalId: string | null) => {
    if (!goalId) {
      const fallbackGoalId = getDefaultGoalId(goalsRef.current, trueFocusGoalIdRef.current);
      selectedGoalIdRef.current = fallbackGoalId;
      setSelectedGoalIdState(fallbackGoalId);
      return;
    }
    if (!goalsRef.current.some((goal) => goal.id === goalId)) {
      return;
    }
    selectedGoalIdRef.current = goalId;
    setSelectedGoalIdState(goalId);
  }, []);

  const setTrueFocusGoal = useCallback(
    async (goalId: string) => {
      const currentGoals = goalsRef.current;
      if (!currentGoals.some((goal) => goal.id === goalId)) {
        return;
      }
      await commitGoals(currentGoals, goalId, selectedGoalIdRef.current);
    },
    [commitGoals],
  );

  const getCurrentWatchSnapshot = useCallback(
    () => buildWatchSnapshot(buildPersistedState(goalsRef.current, trueFocusGoalIdRef.current)),
    [],
  );

  const buildWatchActionResponse = useCallback(
    (
      request: WatchActionRequest,
      ok: boolean,
      reason?: WatchActionResponse['reason'],
      message?: string,
    ): WatchActionResponse => ({
      version: 1,
      actionId: request.actionId,
      ok,
      reason,
      message,
      snapshot: getCurrentWatchSnapshot(),
    }),
    [getCurrentWatchSnapshot],
  );

  React.useEffect(() => {
    return addWatchActionListener(async (request) => {
      if (request.action === 'getGoalsSnapshot') {
        return buildWatchActionResponse(request, true);
      }

      const activeGoalId =
        request.goalId ?? getDefaultGoalId(goalsRef.current, trueFocusGoalIdRef.current);
      const activeGoal = goalsRef.current.find((entry) => entry.id === activeGoalId);

      if (!activeGoalId || !activeGoal) {
        return buildWatchActionResponse(request, false, 'goalNotFound', 'Goal unavailable.');
      }

      if (request.action === 'markDone') {
        if (isMultipleTimesPerDayGoal(activeGoal)) {
          return buildWatchActionResponse(request, false, 'notTrackableToday', 'Use Track one.');
        }

        const didMark = await markDone(activeGoalId);
        return buildWatchActionResponse(
          request,
          didMark,
          didMark ? undefined : 'alreadyDone',
          didMark ? 'Nice work.' : 'Done today.',
        );
      }

      if (request.action === 'trackOne') {
        if (!isMultipleTimesPerDayGoal(activeGoal)) {
          return buildWatchActionResponse(request, false, 'notTrackableToday', 'Use Mark as done.');
        }

        const result = await trackOneToday(activeGoalId);
        return buildWatchActionResponse(
          request,
          result !== false,
          result === false ? 'alreadyDone' : undefined,
          result === 'completed'
            ? 'Nice work.'
            : result === 'incremented'
              ? 'Progress saved.'
              : 'Done today.',
        );
      }

      if (request.action === 'undoLast') {
        if (!isMultipleTimesPerDayGoal(activeGoal)) {
          return buildWatchActionResponse(request, false, 'notTrackableToday', 'Undo from iPhone.');
        }

        const didUndo = await undoTodayProgress(activeGoalId);
        return buildWatchActionResponse(
          request,
          didUndo,
          didUndo ? undefined : 'notTrackableToday',
          didUndo ? 'Progress updated.' : 'Nothing to undo.',
        );
      }

      return buildWatchActionResponse(request, false, 'unknown', 'Try again.');
    });
  }, [buildWatchActionResponse, markDone, trackOneToday, undoTodayProgress]);

  React.useEffect(() => {
    if (autoLoad) {
      void loadGoal();
    }
  }, [autoLoad, loadGoal]);

  const value = useMemo<GoalStore>(
    () => ({
      goals,
      goal: selectedGoal,
      trueFocusGoalId,
      selectedGoalId,
      isLoading,
      canCreateMoreGoals: goals.length < MAX_GOALS,
      loadGoal,
      createGoal,
      markDone,
      markDay,
      undoDay,
      undoToday,
      trackOneToday,
      undoTodayProgress,
      deleteGoal,
      resetGoal,
      restartGoal,
      updateGoal,
      setSelectedGoal,
      setTrueFocusGoal,
    }),
    [
      goals,
      selectedGoal,
      trueFocusGoalId,
      selectedGoalId,
      isLoading,
      loadGoal,
      createGoal,
      markDone,
      markDay,
      undoDay,
      undoToday,
      trackOneToday,
      undoTodayProgress,
      deleteGoal,
      resetGoal,
      restartGoal,
      updateGoal,
      setSelectedGoal,
      setTrueFocusGoal,
    ],
  );

  return <GoalContext.Provider value={value}>{children}</GoalContext.Provider>;
}

export function useGoalStore(): GoalStore {
  const context = useContext(GoalContext);
  if (!context) {
    throw new Error('useGoalStore must be used within a GoalProvider');
  }
  return context;
}

export const goalStorageKey = STORAGE_KEY;
