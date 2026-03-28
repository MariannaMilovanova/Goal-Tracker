export type GoalDayState = 'completed' | 'skipped' | 'off';

export type Goal = {
  title: string;
  totalDays: number;
  completedDays: number;
  timeline: GoalDayState[];
  trackedWeekdays: number[];
  lastCompletedDate: string | null;
  createdAt: string;
  accentColor?: string;
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
  completedDays?: number;
  trackedWeekdays?: number[];
  lastCompletedDate?: string | null;
  createdAt?: string;
  accentColor?: string;
};
