import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { clearWidgetSnapshot, writeWidgetSnapshot } from '../native/widgetBridge';
import { addDaysToDateString, canMarkDone, getDateDiffInDays, getLocalDateString } from '../utils/date';
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

function buildTimeline(completedCount: number, skippedCount: number): GoalDayState[] {
  return [
    ...buildTimelineEntries('completed', completedCount),
    ...buildTimelineEntries('skipped', skippedCount),
  ];
}

function countCompletedDays(timeline: GoalDayState[]): number {
  return timeline.reduce((count, state) => (state === 'completed' ? count + 1 : count), 0);
}

function countSkippedDays(timeline: GoalDayState[]): number {
  return timeline.reduce((count, state) => (state === 'skipped' ? count + 1 : count), 0);
}

function getGoalStartDate(goal: Goal): string {
  const createdAt = new Date(goal.createdAt);
  if (Number.isNaN(createdAt.getTime())) {
    return getLocalDateString();
  }
  return getLocalDateString(createdAt);
}

function reconcileSkippedDays(goal: Goal, today: string): Goal {
  const startDate = getGoalStartDate(goal);
  const yesterday = addDaysToDateString(today, -1);
  const nextTimelineDate = addDaysToDateString(startDate, goal.timeline.length);
  const missingPastDays = getDateDiffInDays(nextTimelineDate, yesterday) + 1;
  if (missingPastDays <= 0) {
    return goal;
  }

  return {
    ...goal,
    timeline: [...goal.timeline, ...buildTimelineEntries('skipped', missingPastDays)],
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
      const reconciled = ensureCompletedDays(reconcileSkippedDays(normalized, today));
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
      const nextGoal: Goal = {
        title: input.title.trim(),
        totalDays,
        completedDays: 0,
        timeline: [],
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
    const reconciledGoal = ensureCompletedDays(reconcileSkippedDays(goal, today));

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

    const nextTimeline = [...reconciledGoal.timeline];
    if (nextTimeline.length < todayIndex) {
      nextTimeline.push(...buildTimelineEntries('skipped', todayIndex - nextTimeline.length));
    }
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
    const reconciledGoal = ensureCompletedDays(reconcileSkippedDays(goal, today));

    if (reconciledGoal.lastCompletedDate !== today) {
      return false;
    }

    if (reconciledGoal.completedDays <= 0) {
      return false;
    }

    const startDate = getGoalStartDate(reconciledGoal);
    const todayIndex = getDateDiffInDays(startDate, today);
    const nextTimeline = [...reconciledGoal.timeline];
    if (todayIndex === nextTimeline.length - 1 && nextTimeline[todayIndex] === 'completed') {
      nextTimeline.pop();
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
      const rawCompletedDays = updates.completedDays ?? goal.completedDays;
      const normalizedCompletedDays = Math.max(0, Math.floor(rawCompletedDays));
      const nextCompletedDays = Math.min(normalizedCompletedDays, nextTotalDays);
      const existingSkippedDays = countSkippedDays(goal.timeline);

      let nextLastCompletedDate = goal.lastCompletedDate;
      if (updates.lastCompletedDate !== undefined) {
        nextLastCompletedDate = updates.lastCompletedDate;
      } else if (updates.completedDays !== undefined) {
        nextLastCompletedDate = null;
      }
      if (nextCompletedDays === 0) {
        nextLastCompletedDate = null;
      }

      let nextTimeline = goal.timeline;
      let nextCreatedAt = goal.createdAt;
      if (updates.completedDays !== undefined) {
        if (nextCompletedDays === 0) {
          nextTimeline = [];
          nextCreatedAt = new Date().toISOString();
        } else {
          nextTimeline = buildTimeline(nextCompletedDays, existingSkippedDays);
        }
      } else if (nextCompletedDays !== goal.completedDays) {
        nextTimeline = buildTimeline(nextCompletedDays, existingSkippedDays);
      }

      const nextGoal = ensureCompletedDays({
        ...goal,
        title: nextTitle,
        totalDays: nextTotalDays,
        accentColor: updates.accentColor ?? goal.accentColor,
        completedDays: nextCompletedDays,
        timeline: nextTimeline,
        lastCompletedDate: nextLastCompletedDate,
        createdAt: nextCreatedAt,
      });

      const persistedGoal: Goal = {
        ...goal,
        ...nextGoal,
      };

      setGoal(persistedGoal);
      await persistGoal(persistedGoal);
      await syncWidget(persistedGoal);
      return persistedGoal;
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
