import { Goal } from '../src/store/goalTypes';
import { buildWatchSnapshot } from '../src/utils/watchSnapshot';

function buildGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-1',
    title: 'Read',
    type: 'oncePerDay',
    totalDays: 100,
    completedDays: 0,
    timeline: [],
    trackedWeekdays: [0, 1, 2, 3, 4, 5, 6],
    lastCompletedDate: null,
    createdAt: '2026-03-01T12:00:00.000Z',
    updatedAt: '2026-03-01T12:00:00.000Z',
    dailyTarget: 1,
    records: {},
    ...overrides,
  };
}

describe('buildWatchSnapshot', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-14T15:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns an empty snapshot when there are no goals', () => {
    const snapshot = buildWatchSnapshot({ goals: [], trueFocusGoalId: null });

    expect(snapshot.trueFocusGoalId).toBeNull();
    expect(snapshot.goals).toEqual([]);
  });

  it('marks a once-per-day goal as done today', () => {
    const snapshot = buildWatchSnapshot({
      trueFocusGoalId: 'goal-1',
      goals: [
        buildGoal({
          completedDays: 16,
          timeline: Array.from({ length: 16 }, () => 'completed'),
          lastCompletedDate: '2026-03-14',
        }),
      ],
    });

    expect(snapshot.goals[0]).toEqual(
      expect.objectContaining({
        completedDays: 16,
        todayCount: 1,
        dailyTarget: 1,
        isCompletedToday: true,
        canTrackToday: false,
        streak: 16,
      }),
    );
  });

  it('shows partial progress for a multiple-times-per-day goal', () => {
    const snapshot = buildWatchSnapshot({
      trueFocusGoalId: 'goal-1',
      goals: [
        buildGoal({
          title: 'Meaningful Eating',
          type: 'multipleTimesPerDay',
          dailyTarget: 3,
          completedDays: 4,
          timeline: Array.from({ length: 4 }, () => 'completed'),
          lastCompletedDate: '2026-03-13',
          records: {
            '2026-03-14': { count: 1 },
          },
        }),
      ],
    });

    expect(snapshot.goals[0]).toEqual(
      expect.objectContaining({
        type: 'multipleTimesPerDay',
        completedDays: 4,
        todayCount: 1,
        dailyTarget: 3,
        isCompletedToday: false,
        canTrackToday: true,
      }),
    );
  });

  it('falls back to the first goal when the true focus id is missing', () => {
    const snapshot = buildWatchSnapshot({
      trueFocusGoalId: 'missing-goal',
      goals: [buildGoal({ id: 'goal-a' }), buildGoal({ id: 'goal-b', title: 'Run' })],
    });

    expect(snapshot.trueFocusGoalId).toBe('goal-a');
    expect(snapshot.goals[0]?.isTrueFocus).toBe(true);
    expect(snapshot.goals[1]?.isTrueFocus).toBe(false);
  });
});
