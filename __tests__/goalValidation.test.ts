import { normalizeGoal } from '../src/utils/goalValidation';

describe('normalizeGoal', () => {
  it('returns null for invalid goal data', () => {
    expect(normalizeGoal(null)).toBeNull();
    expect(normalizeGoal({})).toBeNull();
  });

  it('clamps completedDays within totalDays', () => {
    const goal = normalizeGoal({
      title: 'Read',
      totalDays: 10,
      completedDays: 20,
      lastCompletedDate: '2025-01-01',
      createdAt: '2025-01-01T00:00:00.000Z',
    });

    expect(goal?.completedDays).toBe(10);
    expect(goal?.timeline).toHaveLength(10);
    expect(goal?.timeline.every((entry) => entry === 'completed')).toBe(true);
    expect(goal?.trackedWeekdays).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('keeps skipped days when timeline is provided', () => {
    const goal = normalizeGoal({
      title: 'Read',
      totalDays: 10,
      completedDays: 1,
      timeline: ['completed', 'skipped', 'completed', 'invalid'],
      lastCompletedDate: '2025-01-03',
      createdAt: '2025-01-01T00:00:00.000Z',
    });

    expect(goal?.completedDays).toBe(2);
    expect(goal?.timeline).toEqual(['completed', 'skipped', 'completed']);
  });

  it('keeps explicit off days and normalizes tracked weekdays', () => {
    const goal = normalizeGoal({
      title: 'Run',
      totalDays: 10,
      completedDays: 2,
      timeline: ['completed', 'off', 'skipped'],
      trackedWeekdays: [1, 3, 5, 9, -1],
      lastCompletedDate: null,
      createdAt: '2025-01-01T00:00:00.000Z',
    });

    expect(goal?.timeline).toEqual(['completed', 'off', 'skipped']);
    expect(goal?.trackedWeekdays).toEqual([1, 3, 5]);
  });

  it('rejects invalid date format', () => {
    const goal = normalizeGoal({
      title: 'Read',
      totalDays: 10,
      completedDays: 2,
      lastCompletedDate: '01-01-2025',
      createdAt: '2025-01-01T00:00:00.000Z',
    });

    expect(goal).toBeNull();
  });
});
