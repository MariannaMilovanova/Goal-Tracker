import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

import { clearWidgetSnapshot, writeWidgetSnapshot } from '../native/widgetBridge';
import {
  addDaysToDateString,
  canMarkDone,
  getDateDiffInDays,
  getLocalDateString,
  isTrackedOnDate,
  normalizeTrackedWeekdays,
} from '../utils/date';
import { normalizeGoal, normalizeGoalsState } from '../utils/goalValidation';
import { buildWidgetSnapshot } from '../utils/widgetSnapshot';
import { MAX_GOALS } from './goalConfig';
import { Goal, GoalDayState, GoalInput, GoalsState, GoalUpdate } from './goalTypes';

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

function fillTimelineUntilIndex(goal: Goal, timeline: GoalDayState[], targetIndex: number): GoalDayState[] {
  const startDate = getGoalStartDate(goal);
  const nextTimeline = [...timeline];
  while (nextTimeline.length < targetIndex) {
    const date = addDaysToDateString(startDate, nextTimeline.length);
    nextTimeline.push(getTrackedStateForDate(date, goal.trackedWeekdays));
  }
  return nextTimeline;
}

function normalizeGoalForRuntime(goal: Goal, today: string): Goal {
  return ensureCompletedDays(reconcilePastTimeline(goal, today));
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
      normalizedGoal.completedDays !== goal.completedDays
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

  const selectedGoal = useMemo(
    () => goals.find((goal) => goal.id === selectedGoalId) ?? null,
    [goals, selectedGoalId],
  );

  const loadGoal = useCallback(async () => {
    setIsLoading(true);
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) {
        applyState({ goals: [], trueFocusGoalId: null }, null);
        return;
      }

      const parsed = JSON.parse(raw) as unknown;
      const today = getLocalDateString();

      let persistedState: GoalsState;
      let didMigrateLegacy = false;

      if (isPersistedGoalsState(parsed)) {
        persistedState = normalizeGoalsState(parsed);
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
          await AsyncStorage.removeItem(STORAGE_KEY);
          applyState({ goals: [], trueFocusGoalId: null }, null);
          return;
        }

        persistedState = {
          goals: [legacyGoal],
          trueFocusGoalId: legacyGoal.id,
        };
        didMigrateLegacy = true;
      }

      const normalizedState = normalizeRuntimeState(persistedState, today);
      applyState(normalizedState.state, getDefaultGoalId(normalizedState.state.goals, normalizedState.state.trueFocusGoalId));

      if (didMigrateLegacy || normalizedState.didChange) {
        await persistState(normalizedState.state);
        await syncWidget(normalizedState.state);
      }
    } catch (error) {
      console.warn('Failed to load goals from storage.', error);
      applyState({ goals: [], trueFocusGoalId: null }, null);
      await AsyncStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, [applyState, persistState, syncWidget]);

  const createGoal = useCallback(async (input: GoalInput) => {
    if (goalsRef.current.length >= MAX_GOALS) {
      return null;
    }

    const now = new Date().toISOString();
    const nextGoal: Goal = {
      id: generateGoalId(),
      title: input.title.trim(),
      totalDays: Math.max(1, Math.floor(input.totalDays)),
      completedDays: 0,
      timeline: [],
      trackedWeekdays: normalizeTrackedWeekdays(input.trackedWeekdays),
      lastCompletedDate: null,
      createdAt: now,
      updatedAt: now,
      accentColor: input.accentColor,
    };

    const nextGoals = [...goalsRef.current, nextGoal];
    const nextState = buildPersistedState(
      nextGoals,
      trueFocusGoalIdRef.current ?? nextGoal.id,
    );
    applyState(nextState, nextGoal.id);
    await persistState(nextState);
    await syncWidget(nextState);
    return nextGoal;
  }, [applyState, persistState, syncWidget]);

  const commitGoals = useCallback(async (
    nextGoals: Goal[],
    nextTrueFocusGoalId: string | null,
    nextSelectedGoalId?: string | null,
  ) => {
    const nextState = buildPersistedState(nextGoals, nextTrueFocusGoalId);
    applyState(nextState, nextSelectedGoalId);
    await persistState(nextState);
    await syncWidget(nextState);
    return nextState;
  }, [applyState, persistState, syncWidget]);

  const markDone = useCallback(async (goalId?: string) => {
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

    if (reconciledGoal.completedDays >= reconciledGoal.totalDays || reconciledGoal.totalDays <= 0) {
      return false;
    }

    const startDate = getGoalStartDate(reconciledGoal);
    const todayIndex = getDateDiffInDays(startDate, today);
    if (todayIndex < 0) {
      return false;
    }

    let nextTimeline = fillTimelineUntilIndex(reconciledGoal, reconciledGoal.timeline, todayIndex);
    nextTimeline = [...nextTimeline];
    if (nextTimeline.length === todayIndex) {
      nextTimeline.push('completed');
    } else {
      nextTimeline[todayIndex] = 'completed';
    }

    const now = new Date().toISOString();
    const nextGoal: Goal = {
      ...reconciledGoal,
      timeline: nextTimeline,
      completedDays: Math.min(reconciledGoal.totalDays, countCompletedDays(nextTimeline)),
      lastCompletedDate: today,
      updatedAt: now,
    };

    await commitGoals(replaceGoal(currentGoals, nextGoal), trueFocusGoalIdRef.current, activeGoalId);
    return true;
  }, [commitGoals]);

  const markDay = useCallback(async (date: string, goalId?: string) => {
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

    if (reconciledGoal.completedDays >= reconciledGoal.totalDays || reconciledGoal.totalDays <= 0) {
      return false;
    }

    const startDate = getGoalStartDate(reconciledGoal);
    const targetIndex = getDateDiffInDays(startDate, date);
    if (targetIndex < 0) {
      return false;
    }

    const nextTimeline = fillTimelineUntilIndex(reconciledGoal, reconciledGoal.timeline, targetIndex);
    if (targetIndex < nextTimeline.length && nextTimeline[targetIndex] === 'completed') {
      return false;
    }

    const writableTimeline = [...nextTimeline];
    if (writableTimeline.length === targetIndex) {
      writableTimeline.push('completed');
    } else {
      writableTimeline[targetIndex] = 'completed';
    }

    const nextGoal: Goal = {
      ...reconciledGoal,
      timeline: writableTimeline,
      completedDays: Math.min(reconciledGoal.totalDays, countCompletedDays(writableTimeline)),
      lastCompletedDate: getLastCompletedDateFromTimeline(reconciledGoal, writableTimeline),
      updatedAt: new Date().toISOString(),
    };

    await commitGoals(replaceGoal(currentGoals, nextGoal), trueFocusGoalIdRef.current, activeGoalId);
    return true;
  }, [commitGoals]);

  const undoDay = useCallback(async (date: string, goalId?: string) => {
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

    if (reconciledGoal.timeline[targetIndex] !== 'completed' || reconciledGoal.completedDays <= 0) {
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

    const nextGoal: Goal = {
      ...reconciledGoal,
      timeline: nextTimeline,
      completedDays: Math.min(reconciledGoal.totalDays, countCompletedDays(nextTimeline)),
      lastCompletedDate: getLastCompletedDateFromTimeline(reconciledGoal, nextTimeline),
      updatedAt: new Date().toISOString(),
    };

    await commitGoals(replaceGoal(currentGoals, nextGoal), trueFocusGoalIdRef.current, activeGoalId);
    return true;
  }, [commitGoals]);

  const undoToday = useCallback(async (goalId?: string) => undoDay(getLocalDateString(), goalId), [undoDay]);

  const resetGoal = useCallback(async (goalId?: string) => {
    const activeGoalId = goalId ?? selectedGoalIdRef.current;
    if (!activeGoalId) {
      return;
    }

    const currentGoals = goalsRef.current;
    const currentSelectedGoalId = selectedGoalIdRef.current;
    const currentTrueFocusGoalId = trueFocusGoalIdRef.current;
    const nextGoals = currentGoals.filter((goal) => goal.id !== activeGoalId);
    const nextTrueFocusGoalId =
      currentTrueFocusGoalId === activeGoalId ? nextGoals[0]?.id ?? null : currentTrueFocusGoalId;
    const nextSelectedGoalId =
      currentSelectedGoalId === activeGoalId
        ? getDefaultGoalId(nextGoals, nextTrueFocusGoalId)
        : currentSelectedGoalId;

    await commitGoals(nextGoals, nextTrueFocusGoalId, nextSelectedGoalId);
  }, [commitGoals]);

  const restartGoal = useCallback(async (goalId?: string) => {
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
      lastCompletedDate: null,
      createdAt: now,
      updatedAt: now,
    };

    await commitGoals(replaceGoal(currentGoals, nextGoal), trueFocusGoalIdRef.current, activeGoalId);
    return nextGoal;
  }, [commitGoals]);

  const updateGoal = useCallback(async (updates: GoalUpdate, goalId?: string) => {
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
    const trackedWeekdays = normalizeTrackedWeekdays(updates.trackedWeekdays ?? goal.trackedWeekdays);
    const currentStartDate = getGoalStartDate(goal);
    const requestedStartDate =
      updates.createdAt !== undefined ? getLocalDateFromIsoString(updates.createdAt) : currentStartDate;
    const nextStartDate = requestedStartDate ?? currentStartDate;
    const didStartDateChange = nextStartDate !== currentStartDate;

    let nextLastCompletedDate =
      updates.lastCompletedDate !== undefined ? updates.lastCompletedDate : goal.lastCompletedDate;
    let nextTimeline = [...goal.timeline];
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

    const nextGoal = normalizeGoalForRuntime(
      {
        ...goal,
        title: nextTitle,
        totalDays: nextTotalDays,
        accentColor: updates.accentColor ?? goal.accentColor,
        timeline: nextTimeline,
        trackedWeekdays,
        lastCompletedDate: nextLastCompletedDate,
        createdAt: nextCreatedAt,
        updatedAt: new Date().toISOString(),
      },
      today,
    );

    await commitGoals(replaceGoal(currentGoals, nextGoal), trueFocusGoalIdRef.current, activeGoalId);
    return nextGoal;
  }, [commitGoals]);

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

  const setTrueFocusGoal = useCallback(async (goalId: string) => {
    const currentGoals = goalsRef.current;
    if (!currentGoals.some((goal) => goal.id === goalId)) {
      return;
    }
    await commitGoals(currentGoals, goalId, selectedGoalIdRef.current);
  }, [commitGoals]);

  React.useEffect(() => {
    if (autoLoad) {
      void loadGoal();
    }
  }, [autoLoad, loadGoal]);

  const value = useMemo<GoalStore>(() => ({
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
    resetGoal,
    restartGoal,
    updateGoal,
    setSelectedGoal,
    setTrueFocusGoal,
  }), [
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
    resetGoal,
    restartGoal,
    updateGoal,
    setSelectedGoal,
    setTrueFocusGoal,
  ]);

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
