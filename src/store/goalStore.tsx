import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { clearWidgetSnapshot, writeWidgetSnapshot } from '../native/widgetBridge';
import { canMarkDone, getLocalDateString } from '../utils/date';
import { normalizeGoal } from '../utils/goalValidation';
import { buildWidgetSnapshot } from '../utils/widgetSnapshot';
import { Goal, GoalInput } from './goalTypes';

export type GoalStore = {
  goal: Goal | null;
  isLoading: boolean;
  loadGoal: () => Promise<void>;
  createGoal: (input: GoalInput) => Promise<Goal>;
  markDone: () => Promise<boolean>;
  resetGoal: () => Promise<void>;
  updateGoal: (updates: Partial<GoalInput>) => Promise<Goal | null>;
};

const STORAGE_KEY = 'one-goal/active-goal';

const GoalContext = createContext<GoalStore | undefined>(undefined);

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
      setGoal(normalized);
    } catch (error) {
      console.warn('Failed to load goal from storage.', error);
      setGoal(null);
      await AsyncStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createGoal = useCallback(
    async (input: GoalInput) => {
      const totalDays = Math.max(1, Math.floor(input.totalDays));
      const nextGoal: Goal = {
        title: input.title.trim(),
        totalDays,
        completedDays: 0,
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
    if (!canMarkDone(today, goal.lastCompletedDate)) {
      return false;
    }

    if (goal.completedDays >= goal.totalDays || goal.totalDays <= 0) {
      return false;
    }

    const nextGoal: Goal = {
      ...goal,
      completedDays: goal.completedDays + 1,
      lastCompletedDate: today,
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
    async (updates: Partial<GoalInput>) => {
      if (!goal) {
        return null;
      }

      const nextTotalDaysRaw = updates.totalDays ?? goal.totalDays;
      const nextTotalDays = Math.max(1, Math.floor(nextTotalDaysRaw));
      const nextGoal: Goal = {
        ...goal,
        title: updates.title ? updates.title.trim() : goal.title,
        totalDays: nextTotalDays,
        accentColor: updates.accentColor ?? goal.accentColor,
        completedDays: Math.min(goal.completedDays, nextTotalDays),
      };

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
      resetGoal,
      updateGoal,
    }),
    [goal, isLoading, loadGoal, createGoal, markDone, resetGoal, updateGoal],
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
