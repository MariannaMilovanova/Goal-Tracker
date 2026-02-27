import { NativeModules, Platform } from 'react-native';

import { WidgetSnapshot } from '../utils/widgetSnapshot';

const MODULE_NAME = 'OneGoalWidgetBridge';

type WidgetBridgeModule = {
  writeSnapshot: (json: string) => Promise<void>;
  clearSnapshot: () => Promise<void>;
  reloadWidgets: () => void;
};

const nativeModule: WidgetBridgeModule | undefined =
  Platform.OS === 'ios' ? NativeModules[MODULE_NAME] : undefined;

export async function writeWidgetSnapshot(snapshot: WidgetSnapshot): Promise<void> {
  if (!nativeModule) {
    return;
  }
  await nativeModule.writeSnapshot(JSON.stringify(snapshot));
  nativeModule.reloadWidgets();
}

export async function clearWidgetSnapshot(): Promise<void> {
  if (!nativeModule) {
    return;
  }
  await nativeModule.clearSnapshot();
  nativeModule.reloadWidgets();
}
