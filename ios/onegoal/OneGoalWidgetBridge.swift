import Foundation
import React
import WidgetKit

@objc(OneGoalWidgetBridge)
class OneGoalWidgetBridge: NSObject, RCTBridgeModule {
  static func moduleName() -> String! {
    return "OneGoalWidgetBridge"
  }

  static func requiresMainQueueSetup() -> Bool {
    return false
  }

  @objc(writeSnapshot:resolver:rejecter:)
  func writeSnapshot(_ json: String, resolver: RCTPromiseResolveBlock, rejecter: RCTPromiseRejectBlock) {
    guard let defaults = UserDefaults(suiteName: "group.com.mj.onegoal") else {
      rejecter("E_APP_GROUP", "Unable to access app group container.", nil)
      return
    }

    defaults.set(json, forKey: "widgetSnapshot")
    defaults.synchronize()
    resolver(true)
  }

  @objc(clearSnapshot:rejecter:)
  func clearSnapshot(_ resolver: RCTPromiseResolveBlock, rejecter: RCTPromiseRejectBlock) {
    guard let defaults = UserDefaults(suiteName: "group.com.mj.onegoal") else {
      rejecter("E_APP_GROUP", "Unable to access app group container.", nil)
      return
    }

    defaults.removeObject(forKey: "widgetSnapshot")
    defaults.synchronize()
    resolver(true)
  }

  @objc
  func reloadWidgets() {
    WidgetCenter.shared.reloadAllTimelines()
  }
}
