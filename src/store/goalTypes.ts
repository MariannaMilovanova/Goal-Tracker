export type Goal = {
  title: string;
  totalDays: number;
  completedDays: number;
  lastCompletedDate: string | null;
  createdAt: string;
  accentColor?: string;
};

export type GoalInput = {
  title: string;
  totalDays: number;
  accentColor?: string;
};
