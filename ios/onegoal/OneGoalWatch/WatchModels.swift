import Foundation

enum WatchGoalType: String, Codable {
  case oncePerDay
  case multipleTimesPerDay
}

struct WatchGoalSnapshot: Codable, Identifiable, Equatable {
  let id: String
  let title: String
  let isTrueFocus: Bool
  let type: WatchGoalType
  let completedDays: Int
  let totalDays: Int
  let streak: Int
  let todayCount: Int
  let dailyTarget: Int
  let isCompletedToday: Bool
  let canTrackToday: Bool
}

struct WatchAppSnapshot: Codable, Equatable {
  let version: Int
  let generatedAt: String
  let trueFocusGoalId: String?
  let goals: [WatchGoalSnapshot]
}

struct WatchActionRequest: Codable {
  let version: Int
  let actionId: String
  let action: String
  let goalId: String?
  let sentAt: String
}

struct WatchActionResponse: Codable {
  let version: Int
  let actionId: String
  let ok: Bool
  let reason: String?
  let snapshot: WatchAppSnapshot?
  let message: String?
}
