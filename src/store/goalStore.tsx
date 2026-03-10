import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { clearWidgetSnapshot, writeWidgetSnapshot } from '../native/widgetBridge';
import {
  addDaysToDateString,
  canMarkDone,
  getDateDiffInDays,
  getLocalDateString,
  isTrackedOnDate,
  normalizeTrackedWeekdays,
} from '../utils/date';
import { normalizeGoal } from '../utils/goalValidation';
import { buildWidgetSnapshot } from '../utils/widgetSnapshot';
import { Goal, GoalDayState, GoalInput, GoalUpdate } from './goalTypes';

export type GoalStore = {
  goal: Goal | null;
  isLoading: boolean;
  loadGoal: () => Promise<void>;
  createGoal: (input: GoalInput) => Promise<Goal>;
  markDone: () => Promise<boolean>;
  undoToday: () => Promise<boolean>;
  resetGoal: () => Promise<void>;
  updateGoal: (updates: GoalUpdate) => Promise<Goal | null>;
};

const STORAGE_KEY = 'one-goal/active-goal';

const GoalContext = createContext<GoalStore | undefined>(undefined);

function buildTimelineEntries(state: GoalDayState, count: number): GoalDayState[] {
  return Array.from({ length: Math.max(0, Math.floor(count)) }, () => state);
}

function countCompletedDays(timeline: GoalDayState[]): number {
  return timeline.reduce((count, state) => (state === 'completed' ? count + 1 : count), 0);
}

function getGoalStartDate(goal: Goal): string {
  const createdAt = new Date(goal.createdAt);
  if (Number.isNaN(createdAt.getTime())) {
    return getLocalDateString();
  }
  return getLocalDateString(createdAt);
}

function getTrackedStateForDate(date: string, trackedWeekdays: number[]): GoalDayState {
  return isTrackedOnDate(date, trackedWeekdays) ? 'skipped' : 'off';
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

export function GoalProvider({
  children,
  autoLoad = true,
}: React.PropsWithChildren<{ autoLoad?: boolean }>) {
  const [goal, setGoal] = useState<Goal | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const persistGoal = useCallback(async (nextGoal: Goal | null) => {
    try {
      if (!nextGoal) {
        await AsyncStorage.removeItem(STORAGE_KEY);
        return;
      }
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextGoal));
    } catch (error) {
      console.warn('Failed to persist goal to storage.', error);
    }
  }, []);

  const syncWidget = useCallback(async (nextGoal: Goal | null) => {
    try {
      if (!nextGoal) {
        await clearWidgetSnapshot();
        return;
      }
      await writeWidgetSnapshot(buildWidgetSnapshot(nextGoal));
    } catch (error) {
      console.warn('Failed to update widget snapshot.', error);
    }
  }, []);

  const loadGoal = useCallback(async () => {
    setIsLoading(true);
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setGoal(null);
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      const normalized = normalizeGoal(parsed);
      if (!normalized) {
        await AsyncStorage.removeItem(STORAGE_KEY);
        setGoal(null);
        return;
      }

      const today = getLocalDateString();
      const reconciled = ensureCompletedDays(reconcilePastTimeline(normalized, today));
      const didChange =
        reconciled.timeline.length !== normalized.timeline.length ||
        reconciled.completedDays !== normalized.completedDays;

      setGoal(reconciled);
      if (didChange) {
        await persistGoal(reconciled);
        await syncWidget(reconciled);
      }
    } catch (error) {
      console.warn('Failed to load goal from storage.', error);
      setGoal(null);
      await AsyncStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, [persistGoal, syncWidget]);

  const createGoal = useCallback(
    async (input: GoalInput) => {
      const totalDays = Math.max(1, Math.floor(input.totalDays));
      const trackedWeekdays = normalizeTrackedWeekdays(input.trackedWeekdays);
      const nextGoal: Goal = {
        title: input.title.trim(),
        totalDays,
        completedDays: 0,
        timeline: [],
        trackedWeekdays,
        lastCompletedDate: null,
        createdAt: new Date().toISOString(),
        accentColor: input.accentColor,
      };
      setGoal(nextGoal);
      await persistGoal(nextGoal);
      await syncWidget(nextGoal);
      return nextGoal;
    },
    [persistGoal, syncWidget],
  );

  const markDone = useCallback(async () => {
    if (!goal) {
      return false;
    }

    const today = getLocalDateString();
    const reconciledGoal = ensureCompletedDays(reconcilePastTimeline(goal, today));

    if (!isTrackedOnDate(today, reconciledGoal.trackedWeekdays)) {
      return false;
    }

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

    const nextGoal: Goal = {
      ...reconciledGoal,
      timeline: nextTimeline,
      completedDays: Math.min(reconciledGoal.totalDays, countCompletedDays(nextTimeline)),
      lastCompletedDate: today,
    };

    setGoal(nextGoal);
    await persistGoal(nextGoal);
    await syncWidget(nextGoal);
    return true;
  }, [goal, persistGoal, syncWidget]);

  const undoToday = useCallback(async () => {
    if (!goal) {
      return false;
    }

    const today = getLocalDateString();
    const reconciledGoal = ensureCompletedDays(reconcilePastTimeline(goal, today));

    if (reconciledGoal.lastCompletedDate !== today) {
      return false;
    }

    if (reconciledGoal.completedDays <= 0) {
      return false;
    }

    const startDate = getGoalStartDate(reconciledGoal);
    const todayIndex = getDateDiffInDays(startDate, today);
    const nextTimeline = [...reconciledGoal.timeline];

    if (todayIndex >= 0 && todayIndex < nextTimeline.length && nextTimeline[todayIndex] === 'completed') {
      if (todayIndex === nextTimeline.length - 1) {
        nextTimeline.pop();
      } else {
        nextTimeline[todayIndex] = getTrackedStateForDate(today, reconciledGoal.trackedWeekdays);
      }
    } else {
      const lastCompletedIndex = nextTimeline.lastIndexOf('completed');
      if (lastCompletedIndex < 0) {
        return false;
      }
      nextTimeline.splice(lastCompletedIndex, 1);
    }

    const nextGoal: Goal = {
      ...reconciledGoal,
      timeline: nextTimeline,
      completedDays: Math.min(reconciledGoal.totalDays, countCompletedDays(nextTimeline)),
      lastCompletedDate: null,
    };

    setGoal(nextGoal);
    await persistGoal(nextGoal);
    await syncWidget(nextGoal);
    return true;
  }, [goal, persistGoal, syncWidget]);

  const resetGoal = useCallback(async () => {
    setGoal(null);
    await persistGoal(null);
    await syncWidget(null);
  }, [persistGoal, syncWidget]);

  const updateGoal = useCallback(
    async (updates: GoalUpdate) => {
      if (!goal) {
        return null;
      }

      const nextTitleRaw = updates.title !== undefined ? updates.title.trim() : goal.title;
      const nextTitle = nextTitleRaw.length > 0 ? nextTitleRaw : goal.title;
      const nextTotalDaysRaw = updates.totalDays ?? goal.totalDays;
      const nextTotalDays = Math.max(1, Math.floor(nextTotalDaysRaw));
      const trackedWeekdays = normalizeTrackedWeekdays(updates.trackedWeekdays ?? goal.trackedWeekdays);

      const rawCompletedDays = updates.completedDays ?? goal.completedDays;
      const normalizedCompletedDays = Math.max(0, Math.floor(rawCompletedDays));
      const nextCompletedDays = Math.min(normalizedCompletedDays, nextTotalDays);

      let nextLastCompletedDate = goal.lastCompletedDate;
      if (updates.lastCompletedDate !== undefined) {
        nextLastCompletedDate = updates.lastCompletedDate;
      } else if (updates.completedDays !== undefined) {
        nextLastCompletedDate = null;
      }
      if (nextCompletedDays === 0) {
        nextLastCompletedDate = null;
      }

      let nextTimeline = [...goal.timeline];
      let nextCreatedAt = goal.createdAt;

      if (updates.completedDays !== undefined) {
        if (nextCompletedDays === 0) {
          nextTimeline = [];
          nextCreatedAt = new Date().toISOString();
        } else {
          nextTimeline = buildTimelineEntries('completed', nextCompletedDays);
        }
      }

      if (updates.trackedWeekdays !== undefined) {
        const startDate = getLocalDateString(new Date(nextCreatedAt));
        nextTimeline = nextTimeline.map((state, index) => {
          if (state === 'completed') {
            return 'completed';
          }
          const date = addDaysToDateString(startDate, index);
          return getTrackedStateForDate(date, trackedWeekdays);
        });
      }

      let nextGoal = ensureCompletedDays({
        ...goal,
        title: nextTitle,
        totalDays: nextTotalDays,
        accentColor: updates.accentColor ?? goal.accentColor,
        completedDays: nextCompletedDays,
        timeline: nextTimeline,
        trackedWeekdays,
        lastCompletedDate: nextLastCompletedDate,
        createdAt: nextCreatedAt,
      });

      if (nextGoal.completedDays === 0 && nextGoal.lastCompletedDate !== null) {
        nextGoal = {
          ...nextGoal,
          lastCompletedDate: null,
        };
      }

      setGoal(nextGoal);
      await persistGoal(nextGoal);
      await syncWidget(nextGoal);
      return nextGoal;
    },
    [goal, persistGoal, syncWidget],
  );

  React.useEffect(() => {
    if (autoLoad) {
      void loadGoal();
    }
  }, [autoLoad, loadGoal]);

  const value = useMemo<GoalStore>(
    () => ({
      goal,
      isLoading,
      loadGoal,
      createGoal,
      markDone,
      undoToday,
      resetGoal,
      updateGoal,
    }),
    [goal, isLoading, loadGoal, createGoal, markDone, undoToday, resetGoal, updateGoal],
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
