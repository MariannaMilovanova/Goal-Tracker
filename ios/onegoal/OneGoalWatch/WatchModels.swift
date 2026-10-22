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
  // Optional so snapshots cached by older versions still decode.
  var localDate: String? = nil

  var generatedDate: Date? {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter.date(from: generatedAt) ?? ISO8601DateFormatter().date(from: generatedAt)
  }

  func forCurrentDay(at now: Date = Date(), timeZone: TimeZone = .autoupdatingCurrent)
    -> WatchAppSnapshot
  {
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = timeZone
    formatter.dateFormat = "yyyy-MM-dd"

    guard let snapshotDay = localDate ?? generatedDate.map({ formatter.string(from: $0) }),
      snapshotDay < formatter.string(from: now)
    else {
      return self
    }

    // Only the daily fields expire. Keep the saved progress and the original
    // timestamp; projecting a cached snapshot must not make it look newly synced.
    return WatchAppSnapshot(
      version: version,
      generatedAt: generatedAt,
      trueFocusGoalId: trueFocusGoalId,
      goals: goals.map { goal in
        WatchGoalSnapshot(
          id: goal.id,
          title: goal.title,
          isTrueFocus: goal.isTrueFocus,
          type: goal.type,
          completedDays: goal.completedDays,
          totalDays: goal.totalDays,
          streak: goal.streak,
          todayCount: 0,
          dailyTarget: goal.dailyTarget,
          isCompletedToday: false,
          canTrackToday: goal.completedDays < goal.totalDays
        )
      },
      localDate: localDate
    )
  }
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
