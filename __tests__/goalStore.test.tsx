import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { act, render } from '@testing-library/react-native';

import { GoalProvider, useGoalStore } from '../src/store/goalStore';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

type StoreRef = ReturnType<typeof useGoalStore> | null;

function renderWithStore(onReady: (store: StoreRef) => void, autoLoad = false) {
  function Harness() {
    const store = useGoalStore();
    onReady(store);
    return null;
  }

  return render(
    <GoalProvider autoLoad={autoLoad}>
      <Harness />
    </GoalProvider>,
  );
}

describe('GoalStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates and persists a goal', async () => {
    let storeRef: StoreRef = null;
    renderWithStore((store) => {
      storeRef = store;
    });

    await act(async () => {
      await storeRef?.createGoal({ title: 'Read', totalDays: 30 });
    });

    expect(storeRef?.goal?.title).toBe('Read');
    expect(storeRef?.goal?.completedDays).toBe(0);
    expect(storeRef?.goal?.timeline).toEqual([]);
    expect(storeRef?.goal?.trackedWeekdays).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  });

  it('marks done once per day', async () => {
    let storeRef: StoreRef = null;
    renderWithStore((store) => {
      storeRef = store;
    });

    await act(async () => {
      await storeRef?.createGoal({ title: 'Read', totalDays: 2 });
    });

    await act(async () => {
      await storeRef?.markDone();
    });

    expect(storeRef?.goal?.completedDays).toBe(1);
    expect(storeRef?.goal?.timeline).toContain('completed');

    await act(async () => {
      const result = await storeRef?.markDone();
      expect(result).toBe(false);
    });
  });

  it('allows marking done on a non-scheduled day', async () => {
    let storeRef: StoreRef = null;
    renderWithStore((store) => {
      storeRef = store;
    });

    const todayWeekday = new Date().getDay();
    const trackedWeekday = (todayWeekday + 1) % 7;

    await act(async () => {
      await storeRef?.createGoal({ title: 'Read', totalDays: 2, trackedWeekdays: [trackedWeekday] });
    });

    await act(async () => {
      const result = await storeRef?.markDone();
      expect(result).toBe(true);
    });

    expect(storeRef?.goal?.completedDays).toBe(1);
    expect(storeRef?.goal?.timeline).toContain('completed');
  });

  it('allows marking a past day as completed', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-14T15:00:00.000Z'));
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
      JSON.stringify({
        title: 'Read',
        totalDays: 5,
        completedDays: 1,
        timeline: ['completed', 'skipped'],
        trackedWeekdays: [0, 1, 2, 3, 4, 5, 6],
        lastCompletedDate: '2026-03-10',
        createdAt: '2026-03-10T15:00:00.000Z',
      }),
    );

    let storeRef: StoreRef = null;
    renderWithStore((store) => {
      storeRef = store;
    }, false);

    await act(async () => {
      await storeRef?.loadGoal();
    });

    await act(async () => {
      const result = await storeRef?.markDay('2026-03-11');
      expect(result).toBe(true);
    });

    expect(storeRef?.goal?.completedDays).toBe(2);
    expect(storeRef?.goal?.timeline[1]).toBe('completed');
    expect(storeRef?.goal?.lastCompletedDate).toBe('2026-03-11');
  });

  it('allows undoing a past completed day', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-14T15:00:00.000Z'));
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
      JSON.stringify({
        title: 'Read',
        totalDays: 5,
        completedDays: 2,
        timeline: ['completed', 'completed'],
        trackedWeekdays: [0, 1, 2, 3, 4, 5, 6],
        lastCompletedDate: '2026-03-11',
        createdAt: '2026-03-10T15:00:00.000Z',
      }),
    );

    let storeRef: StoreRef = null;
    renderWithStore((store) => {
      storeRef = store;
    }, false);

    await act(async () => {
      await storeRef?.loadGoal();
    });

    await act(async () => {
      const result = await storeRef?.undoDay('2026-03-11');
      expect(result).toBe(true);
    });

    expect(storeRef?.goal?.completedDays).toBe(1);
    expect(storeRef?.goal?.timeline[1]).toBe('skipped');
    expect(storeRef?.goal?.lastCompletedDate).toBe('2026-03-10');
  });

  it('resets goal and clears storage', async () => {
    let storeRef: StoreRef = null;
    renderWithStore((store) => {
      storeRef = store;
    });

    await act(async () => {
      await storeRef?.createGoal({ title: 'Read', totalDays: 7 });
    });

    await act(async () => {
      await storeRef?.resetGoal();
    });

    expect(storeRef?.goal).toBe(null);
    expect(AsyncStorage.removeItem).toHaveBeenCalledTimes(1);
  });

  it('drops invalid stored data on load', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('{"bad":"data"}');

    let storeRef: StoreRef = null;
    renderWithStore((store) => {
      storeRef = store;
    }, false);

    await act(async () => {
      await storeRef?.loadGoal();
    });

    expect(storeRef?.goal).toBe(null);
    expect(AsyncStorage.removeItem).toHaveBeenCalledTimes(1);
  });
});
