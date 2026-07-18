import Foundation
import SwiftUI
import WatchConnectivity
import WatchKit
import WidgetKit

final class WatchConnectivityController: NSObject, ObservableObject, WCSessionDelegate {
  @Published var snapshot: WatchAppSnapshot?
  @Published var selectedGoalId: String?
  @Published var isSendingAction = false
  @Published var statusMessage: String?

  private let snapshotKey = "watchSnapshot"
  private let appGroupId = "group.com.mj.onegoal"
  private let decoder = JSONDecoder()
  private let encoder = JSONEncoder()

  private var sharedDefaults: UserDefaults? {
    UserDefaults(suiteName: appGroupId)
  }

  override init() {
    super.init()
    snapshot = loadCachedSnapshot()
    selectedGoalId = defaultGoalId(in: snapshot)
    configureSession()
  }

  var selectedGoal: WatchGoalSnapshot? {
    guard let snapshot = snapshot else {
      return nil
    }
    if let selectedGoalId = selectedGoalId,
      let goal = snapshot.goals.first(where: { $0.id == selectedGoalId })
    {
      return goal
    }
    return defaultGoal(in: snapshot)
  }

  func selectGoal(_ goal: WatchGoalSnapshot) {
    selectedGoalId = goal.id
  }

  func requestSnapshot() {
    sendAction("getGoalsSnapshot", goalId: nil)
  }

  func track(_ goal: WatchGoalSnapshot) {
    let action = goal.type == .multipleTimesPerDay ? "trackOne" : "markDone"
    sendAction(action, goalId: goal.id)
  }

  private func configureSession() {
    guard WCSession.isSupported() else {
      statusMessage = "Open True Focus on iPhone."
      return
    }

    let session = WCSession.default
    session.delegate = self
    session.activate()
  }

  private func sendAction(_ action: String, goalId: String?) {
    guard WCSession.isSupported(), WCSession.default.isReachable else {
      #if targetEnvironment(simulator)
      applyActionLocally(action, goalId: goalId)
      #else
      statusMessage = "Open True Focus on iPhone."
      #endif
      return
    }

    let request = WatchActionRequest(
      version: 1,
      actionId: UUID().uuidString,
      action: action,
      goalId: goalId,
      sentAt: ISO8601DateFormatter().string(from: Date())
    )

    guard
      let data = try? encoder.encode(request),
      let payload = String(data: data, encoding: .utf8)
    else {
      statusMessage = "Try again."
      return
    }

    isSendingAction = true
    statusMessage = nil

    WCSession.default.sendMessage(
      [
        "kind": "watchAction",
        "payload": payload,
      ],
      replyHandler: { [weak self] reply in
        DispatchQueue.main.async {
          self?.handleActionReply(reply)
        }
      },
      errorHandler: { [weak self] _ in
        DispatchQueue.main.async {
          self?.isSendingAction = false
          self?.statusMessage = "Open True Focus on iPhone."
        }
      }
    )
  }

  #if targetEnvironment(simulator)
  // Demo fallback: no paired iPhone in simulator, apply the action locally
  // so the UI (button state, haptics) can be previewed and screenshotted.
  private func applyActionLocally(_ action: String, goalId: String?) {
    guard
      let currentSnapshot = snapshot,
      let goalId = goalId,
      let index = currentSnapshot.goals.firstIndex(where: { $0.id == goalId })
    else {
      return
    }

    let goal = currentSnapshot.goals[index]
    guard goal.canTrackToday, !goal.isCompletedToday else {
      return
    }

    let newTodayCount = goal.todayCount + 1
    let completesToday =
      goal.type == .oncePerDay || newTodayCount >= goal.dailyTarget

    let updatedGoal = WatchGoalSnapshot(
      id: goal.id,
      title: goal.title,
      isTrueFocus: goal.isTrueFocus,
      type: goal.type,
      completedDays: completesToday ? goal.completedDays + 1 : goal.completedDays,
      totalDays: goal.totalDays,
      streak: completesToday ? goal.streak + 1 : goal.streak,
      todayCount: newTodayCount,
      dailyTarget: goal.dailyTarget,
      isCompletedToday: completesToday,
      canTrackToday: !completesToday
    )

    var goals = currentSnapshot.goals
    goals[index] = updatedGoal

    applySnapshot(
      WatchAppSnapshot(
        version: currentSnapshot.version,
        generatedAt: ISO8601DateFormatter().string(from: Date()),
        trueFocusGoalId: currentSnapshot.trueFocusGoalId,
        goals: goals
      )
    )

    WKInterfaceDevice.current().play(.success)
    statusMessage = "Progress saved."
    clearStatusMessageLater()
  }
  #endif

  private func handleActionReply(_ reply: [String: Any]) {
    isSendingAction = false

    guard
      let payload = reply["payload"] as? String,
      let data = payload.data(using: .utf8),
      let response = try? decoder.decode(WatchActionResponse.self, from: data)
    else {
      statusMessage = "Try again."
      return
    }

    if let snapshot = response.snapshot {
      applySnapshot(snapshot)
    }

    if response.ok {
      WKInterfaceDevice.current().play(.success)
      statusMessage = response.message ?? "Progress saved."
      clearStatusMessageLater()
    } else {
      statusMessage = response.message ?? "Try again."
    }
  }

  private func applySnapshot(_ nextSnapshot: WatchAppSnapshot) {
    snapshot = nextSnapshot
    if selectedGoalId == nil || !nextSnapshot.goals.contains(where: { $0.id == selectedGoalId }) {
      selectedGoalId = defaultGoalId(in: nextSnapshot)
    }
    cacheSnapshot(nextSnapshot)
  }

  private func clearStatusMessageLater() {
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
      self?.statusMessage = nil
    }
  }

  private func defaultGoal(in snapshot: WatchAppSnapshot) -> WatchGoalSnapshot? {
    if let trueFocusGoalId = snapshot.trueFocusGoalId,
      let goal = snapshot.goals.first(where: { $0.id == trueFocusGoalId })
    {
      return goal
    }
    return snapshot.goals.first
  }

  private func defaultGoalId(in snapshot: WatchAppSnapshot?) -> String? {
    guard let snapshot = snapshot else {
      return nil
    }
    return defaultGoal(in: snapshot)?.id
  }

  private func cacheSnapshot(_ snapshot: WatchAppSnapshot) {
    guard let data = try? encoder.encode(snapshot) else {
      return
    }
    sharedDefaults?.set(data, forKey: snapshotKey)
    // Keep the standard container in sync for backward compatibility.
    UserDefaults.standard.set(data, forKey: snapshotKey)
    // Refresh watch face complications with the new data.
    WidgetCenter.shared.reloadAllTimelines()
  }

  private func loadCachedSnapshot() -> WatchAppSnapshot? {
    // Prefer the App Group container (shared with the complication).
    if let data = sharedDefaults?.data(forKey: snapshotKey),
      let snapshot = try? decoder.decode(WatchAppSnapshot.self, from: data)
    {
      return snapshot
    }
    // Migration fallback: older builds cached in the standard container.
    guard let data = UserDefaults.standard.data(forKey: snapshotKey) else {
      return nil
    }
    let snapshot = try? decoder.decode(WatchAppSnapshot.self, from: data)
    if let snapshot = snapshot, let raw = try? encoder.encode(snapshot) {
      sharedDefaults?.set(raw, forKey: snapshotKey)
    }
    return snapshot
  }

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    if activationState == .activated {
      requestSnapshot()
    }
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    handleSnapshotMessage(applicationContext)
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    handleSnapshotMessage(message)
  }

  private func handleSnapshotMessage(_ message: [String: Any]) {
    guard
      let kind = message["kind"] as? String,
      kind == "watchSnapshot",
      let payload = message["payload"] as? String,
      let data = payload.data(using: .utf8),
      let nextSnapshot = try? decoder.decode(WatchAppSnapshot.self, from: data)
    else {
      return
    }

    DispatchQueue.main.async {
      self.applySnapshot(nextSnapshot)
    }
  }
}
