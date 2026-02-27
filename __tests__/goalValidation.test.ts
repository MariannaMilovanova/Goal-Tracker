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
