import { normalizeGoal, normalizeGoalsState } from '../src/utils/goalValidation';

describe('normalizeGoal', () => {
  it('returns null for invalid goal data', () => {
    expect(normalizeGoal(null)).toBeNull();
    expect(normalizeGoal({})).toBeNull();
  });

  it('clamps completedDays within totalDays', () => {
    const goal = normalizeGoal({
      id: 'goal-1',
      title: 'Read',
      totalDays: 10,
      completedDays: 20,
      lastCompletedDate: '2025-01-01',
      createdAt: '2025-01-01T12:00:00.000Z',
      updatedAt: '2025-01-01T12:00:00.000Z',
    });

    expect(goal?.completedDays).toBe(10);
    expect(goal?.timeline).toHaveLength(10);
    expect(goal?.timeline.every((entry) => entry === 'completed')).toBe(true);
    expect(goal?.trackedWeekdays).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(goal?.type).toBe('oncePerDay');
    expect(goal?.dailyTarget).toBe(1);
    expect(goal?.records).toEqual({});
  });

  it('keeps skipped days when timeline is provided', () => {
    const goal = normalizeGoal({
      id: 'goal-1',
      title: 'Read',
      totalDays: 10,
      completedDays: 1,
      timeline: ['completed', 'skipped', 'completed', 'invalid'],
      lastCompletedDate: '2025-01-03',
      createdAt: '2025-01-01T12:00:00.000Z',
      updatedAt: '2025-01-01T12:00:00.000Z',
    });

    expect(goal?.completedDays).toBe(2);
    expect(goal?.timeline).toEqual(['completed', 'skipped', 'completed']);
  });

  it('keeps explicit off days and normalizes tracked weekdays', () => {
    const goal = normalizeGoal({
      id: 'goal-1',
      title: 'Run',
      totalDays: 10,
      completedDays: 2,
      timeline: ['completed', 'off', 'skipped'],
      trackedWeekdays: [1, 3, 5, 9, -1],
      lastCompletedDate: null,
      createdAt: '2025-01-01T12:00:00.000Z',
      updatedAt: '2025-01-01T12:00:00.000Z',
    });

    expect(goal?.timeline).toEqual(['completed', 'off', 'skipped']);
    expect(goal?.trackedWeekdays).toEqual([1, 3, 5]);
  });

  it('accepts fallback id and updatedAt for legacy migration', () => {
    const goal = normalizeGoal(
      {
        title: 'Read',
        totalDays: 10,
        completedDays: 2,
        lastCompletedDate: '2025-01-01',
        createdAt: '2025-01-01T00:00:00.000Z',
      },
      {
        fallbackId: 'legacy-goal',
        fallbackUpdatedAt: '2025-01-02T00:00:00.000Z',
      },
    );

    expect(goal?.id).toBe('legacy-goal');
    expect(goal?.updatedAt).toBe('2025-01-02T00:00:00.000Z');
    expect(goal?.type).toBe('oncePerDay');
    expect(goal?.dailyTarget).toBe(1);
  });

  it('normalizes multiple-times-per-day target and records', () => {
    const goal = normalizeGoal({
      id: 'goal-1',
      title: 'Water',
      type: 'multipleTimesPerDay',
      dailyTarget: 12,
      totalDays: 10,
      completedDays: 0,
      timeline: ['skipped', 'skipped'],
      records: {
        '2025-01-01': { count: 2.8 },
        '2025-01-02': { count: 99 },
        invalid: { count: 3 },
        '2025-01-03': { count: 0 },
      },
      lastCompletedDate: null,
      createdAt: '2025-01-01T12:00:00.000Z',
      updatedAt: '2025-01-01T12:00:00.000Z',
    });

    expect(goal?.type).toBe('multipleTimesPerDay');
    expect(goal?.dailyTarget).toBe(10);
    expect(goal?.records).toEqual({
      '2025-01-01': { count: 2 },
      '2025-01-02': { count: 10 },
    });
    expect(goal?.timeline).toEqual(['skipped', 'completed']);
    expect(goal?.completedDays).toBe(1);
    expect(goal?.lastCompletedDate).toBe('2025-01-02');
  });

  it('backfills records for completed multiple-times-per-day timeline entries', () => {
    const goal = normalizeGoal({
      id: 'goal-1',
      title: 'Eat',
      type: 'multipleTimesPerDay',
      dailyTarget: 3,
      totalDays: 10,
      completedDays: 1,
      timeline: ['completed', 'skipped'],
      lastCompletedDate: '2025-01-01',
      createdAt: '2025-01-01T12:00:00.000Z',
      updatedAt: '2025-01-01T12:00:00.000Z',
    });

    expect(goal?.records).toEqual({
      '2025-01-01': { count: 3 },
    });
    expect(goal?.completedDays).toBe(1);
  });

  it('rejects invalid date format', () => {
    const goal = normalizeGoal({
      id: 'goal-1',
      title: 'Read',
      totalDays: 10,
      completedDays: 2,
      lastCompletedDate: '01-01-2025',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    });

    expect(goal).toBeNull();
  });
});

describe('normalizeGoalsState', () => {
  it('falls back to the first valid goal when trueFocusGoalId is invalid', () => {
    const state = normalizeGoalsState({
      goals: [
        {
          id: 'goal-1',
          title: 'Read',
          totalDays: 10,
          completedDays: 1,
          timeline: ['completed'],
          trackedWeekdays: [0, 1, 2, 3, 4, 5, 6],
          lastCompletedDate: '2025-01-01',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        },
      ],
      trueFocusGoalId: 'missing',
    });

    expect(state.trueFocusGoalId).toBe('goal-1');
    expect(state.goals).toHaveLength(1);
  });
});
