export type GoalDayState = 'completed' | 'skipped' | 'off';

export type GoalType = 'oncePerDay' | 'multipleTimesPerDay';

export type GoalRecord = {
  count: number;
};

export type Goal = {
  id: string;
  title: string;
  type: GoalType;
  totalDays: number;
  completedDays: number;
  timeline: GoalDayState[];
  trackedWeekdays: number[];
  lastCompletedDate: string | null;
  createdAt: string;
  updatedAt: string;
  accentColor?: string;
  dailyTarget: number;
  records: Record<string, GoalRecord>;
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
  type?: GoalType;
  dailyTarget?: number;
};

export type GoalUpdate = {
  title?: string;
  totalDays?: number;
  trackedWeekdays?: number[];
  lastCompletedDate?: string | null;
  createdAt?: string;
  accentColor?: string;
  type?: GoalType;
  dailyTarget?: number;
};

export type TrackOneResult = 'incremented' | 'completed' | false;
