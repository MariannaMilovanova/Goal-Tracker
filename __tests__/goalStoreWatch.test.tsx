import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { addWatchActionListener, WatchActionHandler } from '../src/native/watchBridge';
import { GoalProvider, goalStorageKey } from '../src/store/goalStore';
import { Goal } from '../src/store/goalTypes';
import { WatchActionRequest, WatchActionResponse } from '../src/utils/watchSnapshot';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn<() => Promise<string | null>>(),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('../src/native/watchBridge', () => ({
  addWatchActionListener: jest.fn(() => jest.fn()),
  publishWatchSnapshot: jest.fn(() => Promise.resolve()),
}));

jest.mock('../src/native/widgetBridge', () => ({
  clearWidgetSnapshot: jest.fn(() => Promise.resolve()),
  writeWidgetSnapshot: jest.fn(() => Promise.resolve()),
}));

const goal: Goal = {
  id: 'goal-1',
  title: 'Read',
  type: 'oncePerDay',
  totalDays: 30,
  completedDays: 1,
  timeline: ['completed'],
  trackedWeekdays: [0, 1, 2, 3, 4, 5, 6],
  lastCompletedDate: '2026-03-14',
  createdAt: '2026-03-14T12:00:00.000Z',
  updatedAt: '2026-03-14T12:00:00.000Z',
  dailyTarget: 1,
  records: {},
};

function request(action: WatchActionRequest['action']): WatchActionRequest {
  return {
    version: 1,
    actionId: 'first-tap',
    action,
    goalId: goal.id,
    sentAt: new Date().toISOString(),
  };
}

async function invoke(handler: WatchActionHandler, action: WatchActionRequest['action']) {
  let response!: WatchActionResponse;
  await act(async () => {
    response = await handler(request(action));
  });
  return response;
}

describe('Watch actions during iPhone startup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-15T15:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('waits for stored goals before accepting the first check-in', async () => {
    let finishLoading!: (value: string) => void;
    jest.mocked(AsyncStorage.getItem).mockReturnValueOnce(
      new Promise((resolve) => {
        finishLoading = resolve;
      }),
    );

    render(<GoalProvider>{null}</GoalProvider>);
    // The native bridge must retain the request until the hydrated listener mounts.
    expect(addWatchActionListener).not.toHaveBeenCalled();

    await act(async () => {
      finishLoading(JSON.stringify({ goals: [goal], trueFocusGoalId: goal.id }));
    });

    expect(addWatchActionListener).toHaveBeenCalledTimes(1);
    const handler = jest.mocked(addWatchActionListener).mock.calls[0][0];
    const response = await invoke(handler, 'markDone');

    expect(response.ok).toBe(true);
    expect(response.snapshot?.goals[0]).toEqual(
      expect.objectContaining({ completedDays: 2, todayCount: 1, isCompletedToday: true }),
    );
    const saved = JSON.parse(jest.mocked(AsyncStorage.setItem).mock.calls.at(-1)![1]);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(goalStorageKey, expect.any(String));
    expect(saved.goals[0].lastCompletedDate).toBe('2026-03-15');

    // Another tap on a once-per-day goal cannot add a second completed day.
    const duplicate = await invoke(handler, 'markDone');
    expect(duplicate.ok).toBe(false);
    expect(duplicate.snapshot?.goals[0].completedDays).toBe(2);
  });

  it("returns today's state on refresh and accepts the first multi-count action", async () => {
    const multipleGoal: Goal = {
      ...goal,
      type: 'multipleTimesPerDay',
      dailyTarget: 3,
      records: { '2026-03-14': { count: 3 } },
    };
    jest
      .mocked(AsyncStorage.getItem)
      .mockResolvedValueOnce(JSON.stringify({ goals: [multipleGoal], trueFocusGoalId: goal.id }));
    render(<GoalProvider>{null}</GoalProvider>);
    await waitFor(() => expect(addWatchActionListener).toHaveBeenCalledTimes(1));

    const handler = jest.mocked(addWatchActionListener).mock.calls[0][0];
    const refresh = await invoke(handler, 'getGoalsSnapshot');
    expect(refresh.snapshot?.localDate).toBe('2026-03-15');
    expect(refresh.snapshot?.goals[0]).toEqual(
      expect.objectContaining({ todayCount: 0, isCompletedToday: false, canTrackToday: true }),
    );

    const response = await invoke(handler, 'trackOne');
    expect(response.ok).toBe(true);
    expect(response.snapshot?.goals[0]).toEqual(
      expect.objectContaining({ completedDays: 1, todayCount: 1, isCompletedToday: false }),
    );
  });

  it('still handles an empty store after hydration', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce(null);
    render(<GoalProvider>{null}</GoalProvider>);
    await waitFor(() => expect(addWatchActionListener).toHaveBeenCalledTimes(1));

    const handler = jest.mocked(addWatchActionListener).mock.calls[0][0];
    const response = await invoke(handler, 'getGoalsSnapshot');
    expect(response.ok).toBe(true);
    expect(response.snapshot?.goals).toEqual([]);
  });
});
