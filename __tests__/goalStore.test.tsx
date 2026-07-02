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

  it('creates first goal as true focus and selected goal', async () => {
    let storeRef: StoreRef = null;
    renderWithStore((store) => {
      storeRef = store;
    });

    await act(async () => {
      await storeRef?.createGoal({ title: 'Read', totalDays: 30 });
    });

    expect(storeRef?.goals).toHaveLength(1);
    expect(storeRef?.goal?.title).toBe('Read');
    expect(storeRef?.trueFocusGoalId).toBe(storeRef?.goal?.id ?? null);
    expect(storeRef?.selectedGoalId).toBe(storeRef?.goal?.id ?? null);
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  });

  it('keeps the original true focus when creating a second goal', async () => {
    let storeRef: StoreRef = null;
    renderWithStore((store) => {
      storeRef = store;
    });

    await act(async () => {
      await storeRef?.createGoal({ title: 'Read', totalDays: 30 });
    });

    const firstGoalId = storeRef?.goal?.id;

    await act(async () => {
      await storeRef?.createGoal({ title: 'Run', totalDays: 20 });
    });

    expect(storeRef?.goals).toHaveLength(2);
    expect(storeRef?.trueFocusGoalId).toBe(firstGoalId);
    expect(storeRef?.goal?.title).toBe('Run');
    expect(storeRef?.selectedGoalId).toBe(storeRef?.goal?.id ?? null);
  });

  it('switches selected goal without changing true focus', async () => {
    let storeRef: StoreRef = null;
    renderWithStore((store) => {
      storeRef = store;
    });

    await act(async () => {
      await storeRef?.createGoal({ title: 'Read', totalDays: 30 });
      await storeRef?.createGoal({ title: 'Run', totalDays: 20 });
    });

    const firstGoalId = storeRef?.goals[0]?.id ?? null;

    act(() => {
      storeRef?.setSelectedGoal(firstGoalId);
    });

    expect(storeRef?.selectedGoalId).toBe(firstGoalId);
    expect(storeRef?.trueFocusGoalId).toBe(firstGoalId);
  });

  it('explicitly changes true focus goal', async () => {
    let storeRef: StoreRef = null;
    renderWithStore((store) => {
      storeRef = store;
    });

    await act(async () => {
      await storeRef?.createGoal({ title: 'Read', totalDays: 30 });
      await storeRef?.createGoal({ title: 'Run', totalDays: 20 });
    });

    const secondGoalId = storeRef?.goals[1]?.id;

    await act(async () => {
      if (secondGoalId) {
        await storeRef?.setTrueFocusGoal(secondGoalId);
      }
    });

    expect(storeRef?.trueFocusGoalId).toBe(secondGoalId);
  });

  it('does not create more than 10 goals', async () => {
    let storeRef: StoreRef = null;
    renderWithStore((store) => {
      storeRef = store;
    });

    for (let index = 0; index < 10; index += 1) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        await storeRef?.createGoal({ title: `Goal ${index}`, totalDays: 10 });
      });
    }

    let result = null;
    await act(async () => {
      result = await storeRef?.createGoal({ title: 'Overflow', totalDays: 10 });
    });

    expect(storeRef?.goals).toHaveLength(10);
    expect(result).toBeNull();
  });

  it('marks done once per day on the selected goal only', async () => {
    let storeRef: StoreRef = null;
    renderWithStore((store) => {
      storeRef = store;
    });

    await act(async () => {
      await storeRef?.createGoal({ title: 'Read', totalDays: 2 });
      await storeRef?.createGoal({ title: 'Run', totalDays: 2 });
    });

    const firstGoalId = storeRef?.goals[0]?.id ?? null;

    act(() => {
      storeRef?.setSelectedGoal(firstGoalId);
    });

    await act(async () => {
      await storeRef?.markDone();
    });

    expect(storeRef?.goals.find((goal) => goal.id === firstGoalId)?.completedDays).toBe(1);
    expect(storeRef?.goals[1]?.completedDays).toBe(0);
  });

  it('allows marking a past day on a specific goal without affecting another goal', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-14T15:00:00.000Z'));
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
      JSON.stringify({
        goals: [
          {
            id: 'goal-a',
            title: 'Read',
            totalDays: 5,
            completedDays: 1,
            timeline: ['completed', 'skipped'],
            trackedWeekdays: [0, 1, 2, 3, 4, 5, 6],
            lastCompletedDate: '2026-03-10',
            createdAt: '2026-03-10T15:00:00.000Z',
            updatedAt: '2026-03-10T15:00:00.000Z',
          },
          {
            id: 'goal-b',
            title: 'Run',
            totalDays: 5,
            completedDays: 0,
            timeline: [],
            trackedWeekdays: [0, 1, 2, 3, 4, 5, 6],
            lastCompletedDate: null,
            createdAt: '2026-03-10T15:00:00.000Z',
            updatedAt: '2026-03-10T15:00:00.000Z',
          },
        ],
        trueFocusGoalId: 'goal-a',
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
      const result = await storeRef?.markDay('2026-03-11', 'goal-a');
      expect(result).toBe(true);
    });

    expect(storeRef?.goals.find((goal) => goal.id === 'goal-a')?.completedDays).toBe(2);
    expect(storeRef?.goals.find((goal) => goal.id === 'goal-b')?.completedDays).toBe(0);
  });

  it('restarts only the selected goal progress', async () => {
    let storeRef: StoreRef = null;
    renderWithStore((store) => {
      storeRef = store;
    });

    await act(async () => {
      await storeRef?.createGoal({ title: 'Read', totalDays: 7 });
      await storeRef?.markDone();
      await storeRef?.createGoal({ title: 'Run', totalDays: 7 });
      await storeRef?.markDone();
    });

    const firstGoalId = storeRef?.goals[0]?.id ?? null;
    act(() => {
      storeRef?.setSelectedGoal(firstGoalId);
    });

    await act(async () => {
      await storeRef?.restartGoal();
    });

    expect(storeRef?.goals.find((goal) => goal.id === firstGoalId)?.completedDays).toBe(0);
    expect(storeRef?.goals[1]?.completedDays).toBe(1);
  });

  it('deletes a non-selected non-focus goal without changing selected or true focus', async () => {
    let storeRef: StoreRef = null;
    renderWithStore((store) => {
      storeRef = store;
    });

    await act(async () => {
      await storeRef?.createGoal({ title: 'Read', totalDays: 7 });
      await storeRef?.createGoal({ title: 'Run', totalDays: 7 });
      await storeRef?.createGoal({ title: 'Lift', totalDays: 7 });
    });

    const firstGoalId = storeRef?.goals[0]?.id ?? null;
    const secondGoalId = storeRef?.goals[1]?.id;
    const thirdGoalId = storeRef?.goals[2]?.id ?? null;

    let result = false;
    await act(async () => {
      if (secondGoalId) {
        result = (await storeRef?.deleteGoal(secondGoalId)) ?? false;
      }
    });

    expect(result).toBe(true);
    expect(storeRef?.goals.map((goal) => goal.title)).toEqual(['Read', 'Lift']);
    expect(storeRef?.trueFocusGoalId).toBe(firstGoalId);
    expect(storeRef?.selectedGoalId).toBe(thirdGoalId);
  });

  it('deletes the selected non-focus goal and falls back to true focus selection', async () => {
    let storeRef: StoreRef = null;
    renderWithStore((store) => {
      storeRef = store;
    });

    await act(async () => {
      await storeRef?.createGoal({ title: 'Read', totalDays: 7 });
      await storeRef?.createGoal({ title: 'Run', totalDays: 7 });
    });

    const firstGoalId = storeRef?.goals[0]?.id ?? null;

    let result = false;
    await act(async () => {
      result = (await storeRef?.deleteGoal()) ?? false;
    });

    expect(result).toBe(true);
    expect(storeRef?.goals).toHaveLength(1);
    expect(storeRef?.goal?.title).toBe('Read');
    expect(storeRef?.trueFocusGoalId).toBe(firstGoalId);
    expect(storeRef?.selectedGoalId).toBe(firstGoalId);
  });

  it('does not delete the true focus goal', async () => {
    let storeRef: StoreRef = null;
    renderWithStore((store) => {
      storeRef = store;
    });

    await act(async () => {
      await storeRef?.createGoal({ title: 'Read', totalDays: 7 });
      await storeRef?.createGoal({ title: 'Run', totalDays: 7 });
    });

    const firstGoalId = storeRef?.goals[0]?.id;

    jest.clearAllMocks();

    let result = true;
    await act(async () => {
      if (firstGoalId) {
        result = (await storeRef?.deleteGoal(firstGoalId)) ?? true;
      }
    });

    expect(result).toBe(false);
    expect(storeRef?.goals.map((goal) => goal.title)).toEqual(['Read', 'Run']);
    expect(storeRef?.trueFocusGoalId).toBe(firstGoalId);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  });

  it('does not delete the only goal because it is true focus', async () => {
    let storeRef: StoreRef = null;
    renderWithStore((store) => {
      storeRef = store;
    });

    await act(async () => {
      await storeRef?.createGoal({ title: 'Read', totalDays: 7 });
    });

    const onlyGoalId = storeRef?.goal?.id;

    jest.clearAllMocks();

    let result = true;
    await act(async () => {
      if (onlyGoalId) {
        result = (await storeRef?.deleteGoal(onlyGoalId)) ?? true;
      }
    });

    expect(result).toBe(false);
    expect(storeRef?.goals).toHaveLength(1);
    expect(storeRef?.goal?.title).toBe('Read');
    expect(storeRef?.trueFocusGoalId).toBe(onlyGoalId);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  });

  it('does not persist when deleting an unknown goal ID', async () => {
    let storeRef: StoreRef = null;
    renderWithStore((store) => {
      storeRef = store;
    });

    await act(async () => {
      await storeRef?.createGoal({ title: 'Read', totalDays: 7 });
      await storeRef?.createGoal({ title: 'Run', totalDays: 7 });
    });

    const firstGoalId = storeRef?.goals[0]?.id ?? null;
    act(() => {
      storeRef?.setSelectedGoal(firstGoalId);
    });

    jest.clearAllMocks();

    let result = true;
    await act(async () => {
      result = (await storeRef?.deleteGoal('missing-goal')) ?? true;
    });

    expect(result).toBe(false);
    expect(storeRef?.goals.map((goal) => goal.title)).toEqual(['Read', 'Run']);
    expect(storeRef?.trueFocusGoalId).toBe(firstGoalId);
    expect(storeRef?.selectedGoalId).toBe(firstGoalId);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  });

  it('migrates legacy single-goal storage into the new structure', async () => {
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

    expect(storeRef?.goals).toHaveLength(1);
    expect(storeRef?.goal?.id).toBeTruthy();
    expect(storeRef?.trueFocusGoalId).toBe(storeRef?.goal?.id ?? null);
  });
});
