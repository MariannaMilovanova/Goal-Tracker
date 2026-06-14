import { Goal } from '../store/goalTypes';

export function getSkippedDaysCount(goal: Goal): number {
  return goal.timeline.reduce((count, state) => (state === 'skipped' ? count + 1 : count), 0);
}

export function getGoalStreak(goal: Goal): number {
  if (goal.timeline.length === 0) {
    return 0;
  }

  let streak = 0;
  for (let index = goal.timeline.length - 1; index >= 0; index -= 1) {
    const state = goal.timeline[index];

    if (state === 'off') {
      continue;
    }

    if (state === 'completed') {
      streak += 1;
      continue;
    }

    break;
  }

  return streak;
}
