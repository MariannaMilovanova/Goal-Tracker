import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

import { WatchActionRequest, WatchActionResponse, WatchAppSnapshot } from '../utils/watchSnapshot';

const MODULE_NAME = 'OneGoalWatchBridge';
const ACTION_EVENT = 'watchActionReceived';

type WatchBridgeModule = {
  publishSnapshot: (json: string) => Promise<void>;
  completeAction: (actionId: string, responseJson: string) => void;
  addListener?: (eventName: string) => void;
  removeListeners?: (count: number) => void;
};

const nativeModule: WatchBridgeModule | undefined =
  Platform.OS === 'ios' ? NativeModules[MODULE_NAME] : undefined;

const emitter = nativeModule ? new NativeEventEmitter(nativeModule as never) : null;

export type WatchActionHandler = (
  request: WatchActionRequest,
) => Promise<WatchActionResponse> | WatchActionResponse;

export async function publishWatchSnapshot(snapshot: WatchAppSnapshot): Promise<void> {
  if (!nativeModule) {
    return;
  }
  await nativeModule.publishSnapshot(JSON.stringify(snapshot));
}

export function completeWatchAction(actionId: string, response: WatchActionResponse): void {
  if (!nativeModule) {
    return;
  }
  nativeModule.completeAction(actionId, JSON.stringify(response));
}

export function addWatchActionListener(handler: WatchActionHandler): () => void {
  if (!emitter) {
    return () => {};
  }

  const subscription = emitter.addListener(ACTION_EVENT, async (event: { payload?: string }) => {
    if (!event.payload) {
      return;
    }

    let request: WatchActionRequest;
    try {
      request = JSON.parse(event.payload) as WatchActionRequest;
    } catch {
      return;
    }

    try {
      const response = await handler(request);
      completeWatchAction(request.actionId, response);
    } catch (error) {
      completeWatchAction(request.actionId, {
        version: 1,
        actionId: request.actionId,
        ok: false,
        reason: 'unknown',
        message: error instanceof Error ? error.message : 'Unable to process Watch action.',
      });
    }
  });

  return () => {
    subscription.remove();
  };
}
