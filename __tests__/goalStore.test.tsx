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

    await act(async () => {
      const result = await storeRef?.markDone();
      expect(result).toBe(false);
    });
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
