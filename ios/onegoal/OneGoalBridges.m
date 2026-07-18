#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

// Registers the Swift native modules with React Native.
// The Swift implementations live in OneGoalWidgetBridge.swift and
// OneGoalWatchBridge.swift.

@interface RCT_EXTERN_MODULE (OneGoalWidgetBridge, NSObject)

RCT_EXTERN_METHOD(writeSnapshot:(NSString *)json
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(clearSnapshot:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(reloadWidgets)

@end

@interface RCT_EXTERN_MODULE (OneGoalWatchBridge, RCTEventEmitter)

RCT_EXTERN_METHOD(publishSnapshot:(NSString *)json
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(completeAction:(NSString *)actionId
                  responseJson:(NSString *)responseJson)

@end
