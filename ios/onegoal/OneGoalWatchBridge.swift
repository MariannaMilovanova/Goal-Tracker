import Foundation
import React
import WatchConnectivity

@objc(OneGoalWatchBridge)
class OneGoalWatchBridge: RCTEventEmitter, WCSessionDelegate {
  private var pendingReplies: [String: ([String: Any]) -> Void] = [:]
  private var pendingActionPayloads: [String: String] = [:]
  private var hasListeners = false
  private var lastSnapshotPayload: String?
  private let appGroupIdentifier = "group.com.mj.onegoal"
  private let snapshotKey = "watchSnapshot"

  override init() {
    super.init()
    configureSession()
  }

  override static func requiresMainQueueSetup() -> Bool {
    return false
  }

  override func supportedEvents() -> [String]! {
    return ["watchActionReceived", "watchReachabilityChanged"]
  }

  override func startObserving() {
    DispatchQueue.main.async {
      self.hasListeners = true
      let payloads = self.pendingActionPayloads
      self.pendingActionPayloads.removeAll()
      for (actionId, payload) in payloads where self.pendingReplies[actionId] != nil {
        self.sendEvent(withName: "watchActionReceived", body: ["payload": payload])
      }
    }
  }

  override func stopObserving() {
    DispatchQueue.main.async {
      self.hasListeners = false
    }
  }

  private func configureSession() {
    guard WCSession.isSupported() else {
      return
    }

    let session = WCSession.default
    session.delegate = self
    session.activate()
  }

  @objc(publishSnapshot:resolver:rejecter:)
  func publishSnapshot(
    _ json: String,
    resolver: RCTPromiseResolveBlock,
    rejecter: RCTPromiseRejectBlock
  ) {
    lastSnapshotPayload = json
    if let defaults = UserDefaults(suiteName: appGroupIdentifier) {
      defaults.set(json, forKey: snapshotKey)
      defaults.synchronize()
    }

    guard WCSession.isSupported() else {
      resolver(false)
      return
    }

    let session = WCSession.default
    guard session.activationState == .activated else {
      resolver(false)
      return
    }

    do {
      try publishSnapshotPayload(json)
      resolver(true)
    } catch {
      rejecter("E_WATCH_CONTEXT", "Unable to publish Watch snapshot.", error)
    }
  }

  @objc(completeAction:responseJson:)
  func completeAction(_ actionId: String, responseJson: String) {
    DispatchQueue.main.async {
      self.pendingActionPayloads.removeValue(forKey: actionId)
      guard let reply = self.pendingReplies.removeValue(forKey: actionId) else {
        return
      }

      reply([
        "kind": "watchActionResponse",
        "payload": responseJson,
      ])
    }
  }

  func session(
    _ session: WCSession,
    didReceiveMessage message: [String: Any],
    replyHandler: @escaping ([String: Any]) -> Void
  ) {
    guard
      let kind = message["kind"] as? String,
      kind == "watchAction",
      let payload = message["payload"] as? String,
      let actionId = actionId(from: payload)
    else {
      replyHandler([
        "kind": "watchActionResponse",
        "payload": failurePayload(actionId: "unknown", reason: "unknown"),
      ])
      return
    }

    DispatchQueue.main.async {
      self.pendingReplies[actionId] = replyHandler

      if self.hasListeners {
        self.sendEvent(withName: "watchActionReceived", body: ["payload": payload])
      } else {
        // A Watch message can wake iOS before React Native and goal storage are
        // ready. Deliver the original request when the hydrated listener mounts.
        self.pendingActionPayloads[actionId] = payload
      }

      self.scheduleTimeout(for: actionId)
    }
  }

  func sessionReachabilityDidChange(_ session: WCSession) {
    guard hasListeners else {
      return
    }
    sendEvent(withName: "watchReachabilityChanged", body: ["isReachable": session.isReachable])
  }

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    if activationState == .activated, let payload = lastSnapshotPayload {
      try? publishSnapshotPayload(payload)
    }

    guard hasListeners else {
      return
    }
    sendEvent(withName: "watchReachabilityChanged", body: ["isReachable": session.isReachable])
  }

  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    session.activate()
  }

  private func scheduleTimeout(for actionId: String) {
    DispatchQueue.main.asyncAfter(deadline: .now() + 15) {
      // Expired requests must not execute when the listener eventually mounts.
      self.pendingActionPayloads.removeValue(forKey: actionId)
      guard let reply = self.pendingReplies.removeValue(forKey: actionId) else {
        return
      }

      reply([
        "kind": "watchActionResponse",
        "payload": self.failurePayload(actionId: actionId, reason: "notReachable"),
      ])
    }
  }

  private func actionId(from payload: String) -> String? {
    guard
      let data = payload.data(using: .utf8),
      let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
      let actionId = json["actionId"] as? String
    else {
      return nil
    }
    return actionId
  }

  private func publishSnapshotPayload(_ payload: String) throws {
    let message = [
      "kind": "watchSnapshot",
      "payload": payload,
    ]
    let session = WCSession.default
    try session.updateApplicationContext(message)
    if session.isReachable {
      session.sendMessage(message, replyHandler: nil, errorHandler: nil)
    }
  }

  private func failurePayload(actionId: String, reason: String) -> String {
    let response: [String: Any] = [
      "version": 1,
      "actionId": actionId,
      "ok": false,
      "reason": reason,
      "message": "Open True Focus on iPhone to sync.",
    ]

    guard
      let data = try? JSONSerialization.data(withJSONObject: response),
      let json = String(data: data, encoding: .utf8)
    else {
      return #"{"version":1,"actionId":"\#(actionId)","ok":false,"reason":"unknown"}"#
    }

    return json
  }
}
