import { canMarkDone, getLocalDateString } from '../src/utils/date';

describe('date utils', () => {
  it('formats local date as YYYY-MM-DD', () => {
    const date = new Date(2025, 0, 5);
    expect(getLocalDateString(date)).toBe('2025-01-05');
  });

  it('allows marking done when lastCompletedDate is null', () => {
    expect(canMarkDone('2025-01-01', null)).toBe(true);
  });

  it('blocks marking done on the same day', () => {
    expect(canMarkDone('2025-01-01', '2025-01-01')).toBe(false);
  });

  it('allows marking done on a different day', () => {
    expect(canMarkDone('2025-01-02', '2025-01-01')).toBe(true);
  });

  it('blocks marking done when lastCompletedDate is in the future', () => {
    expect(canMarkDone('2025-01-01', '2025-02-01')).toBe(false);
  });
});
