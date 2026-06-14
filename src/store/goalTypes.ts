export type GoalDayState = 'completed' | 'skipped' | 'off';

export type Goal = {
  id: string;
  title: string;
  totalDays: number;
  completedDays: number;
  timeline: GoalDayState[];
  trackedWeekdays: number[];
  lastCompletedDate: string | null;
  createdAt: string;
  updatedAt: string;
  accentColor?: string;
};

export type GoalsState = {
  goals: Goal[];
  trueFocusGoalId: string | null;
};

export type GoalInput = {
  title: string;
  totalDays: number;
  trackedWeekdays?: number[];
  accentColor?: string;
};

export type GoalUpdate = {
  title?: string;
  totalDays?: number;
  trackedWeekdays?: number[];
  lastCompletedDate?: string | null;
  createdAt?: string;
  accentColor?: string;
};
