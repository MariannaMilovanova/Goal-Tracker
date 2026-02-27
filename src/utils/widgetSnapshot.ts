import { Goal } from '../store/goalTypes';

export type WidgetSnapshot = {
  title: string;
  totalDays: number;
  completedDays: number;
  lastCompletedDate: string | null;
  accentColor?: string;
  updatedAt: string;
};

export function buildWidgetSnapshot(goal: Goal): WidgetSnapshot {
  return {
    title: goal.title,
    totalDays: goal.totalDays,
    completedDays: goal.completedDays,
    lastCompletedDate: goal.lastCompletedDate,
    accentColor: goal.accentColor,
    updatedAt: new Date().toISOString(),
  };
}
