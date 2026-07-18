import SwiftUI
import WidgetKit

// MARK: - Timeline

struct ComplicationEntry: TimelineEntry {
  let date: Date
  let goal: WatchGoalSnapshot?
}

struct ComplicationProvider: TimelineProvider {
  static let placeholderGoal = WatchGoalSnapshot(
    id: "placeholder",
    title: "Morning Run",
    isTrueFocus: true,
    type: .oncePerDay,
    completedDays: 42,
    totalDays: 66,
    streak: 12,
    todayCount: 0,
    dailyTarget: 1,
    isCompletedToday: false,
    canTrackToday: true
  )

  func placeholder(in context: Context) -> ComplicationEntry {
    ComplicationEntry(date: Date(), goal: Self.placeholderGoal)
  }

  func getSnapshot(in context: Context, completion: @escaping (ComplicationEntry) -> Void) {
    let goal = loadTrueFocusGoal() ?? Self.placeholderGoal
    completion(ComplicationEntry(date: Date(), goal: goal))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<ComplicationEntry>) -> Void) {
    let entry = ComplicationEntry(date: Date(), goal: loadTrueFocusGoal())
    let startOfTomorrow = Calendar.current.startOfDay(
      for: Calendar.current.date(byAdding: .day, value: 1, to: Date()) ?? Date()
    )
    completion(Timeline(entries: [entry], policy: .after(startOfTomorrow)))
  }

  private func loadTrueFocusGoal() -> WatchGoalSnapshot? {
    guard
      let defaults = UserDefaults(suiteName: "group.com.mj.onegoal"),
      let data = defaults.data(forKey: "watchSnapshot"),
      let snapshot = try? JSONDecoder().decode(WatchAppSnapshot.self, from: data)
    else {
      return nil
    }

    if let trueFocusGoalId = snapshot.trueFocusGoalId,
      let goal = snapshot.goals.first(where: { $0.id == trueFocusGoalId })
    {
      return goal
    }
    return snapshot.goals.first
  }
}

// MARK: - Views

struct ComplicationView: View {
  @Environment(\.widgetFamily) private var family
  let entry: ComplicationEntry

  var body: some View {
    Group {
      if let goal = entry.goal {
        switch family {
        case .accessoryCircular:
          circular(goal)
        case .accessoryCorner:
          corner(goal)
        case .accessoryRectangular:
          rectangular(goal)
        case .accessoryInline:
          inline(goal)
        default:
          circular(goal)
        }
      } else {
        emptyState
      }
    }
    .widgetURL(URL(string: "onegoalwatch://truefocus"))
    .containerBackground(.clear, for: .widget)
  }

  private func currentDay(_ goal: WatchGoalSnapshot) -> Int {
    let day = goal.isCompletedToday ? goal.completedDays : goal.completedDays + 1
    return min(max(day, 1), goal.totalDays)
  }

  private func progress(_ goal: WatchGoalSnapshot) -> Double {
    guard goal.totalDays > 0 else {
      return 0
    }
    return min(Double(goal.completedDays) / Double(goal.totalDays), 1)
  }

  private func circular(_ goal: WatchGoalSnapshot) -> some View {
    Gauge(value: progress(goal)) {
      Text("d")
    } currentValueLabel: {
      Text("\(goal.completedDays)")
        .font(.system(.title3, design: .rounded, weight: .bold))
        .widgetAccentable()
    }
    .gaugeStyle(.accessoryCircular)
    .tint(.green)
  }

  private func corner(_ goal: WatchGoalSnapshot) -> some View {
    Image(systemName: "flame.fill")
      .font(.title2)
      .foregroundStyle(.orange)
      .widgetAccentable()
      .widgetLabel {
        Text("\(goal.completedDays) days")
      }
  }

  private func rectangular(_ goal: WatchGoalSnapshot) -> some View {
    VStack(alignment: .leading, spacing: 1) {
      Text(goal.title)
        .font(.headline)
        .lineLimit(1)
        .widgetAccentable()
      Text("Day \(currentDay(goal)) of \(goal.totalDays)")
        .font(.caption2)
        .foregroundStyle(.secondary)
      HStack(spacing: 3) {
        Image(systemName: "flame.fill")
          .foregroundStyle(.orange)
        Text("\(goal.streak) day streak")
      }
      .font(.caption2)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  private func inline(_ goal: WatchGoalSnapshot) -> some View {
    Text("🔥 \(goal.completedDays) days · \(goal.title)")
  }

  private var emptyState: some View {
    Group {
      switch family {
      case .accessoryRectangular:
        Text("Open True Focus")
          .font(.caption)
          .foregroundStyle(.secondary)
      case .accessoryInline:
        Text("True Focus")
      default:
        Image(systemName: "target")
          .font(.title3)
          .widgetAccentable()
      }
    }
  }
}

// MARK: - Widget

@main
struct OneGoalWatchComplication: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(
      kind: "TrueFocusComplication",
      provider: ComplicationProvider()
    ) { entry in
      ComplicationView(entry: entry)
    }
    .configurationDisplayName("True Focus")
    .description("Days completed for your True Focus goal.")
    .supportedFamilies([
      .accessoryCircular,
      .accessoryCorner,
      .accessoryRectangular,
      .accessoryInline,
    ])
  }
}
