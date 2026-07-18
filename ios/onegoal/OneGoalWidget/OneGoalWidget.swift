import WidgetKit
import SwiftUI

struct WidgetSnapshot: Codable {
  let title: String
  let totalDays: Int
  let completedDays: Int
  let lastCompletedDate: String?
  let accentColor: String?
  let updatedAt: String
}

struct OneGoalEntry: TimelineEntry {
  let date: Date
  let snapshot: WidgetSnapshot?
}

struct OneGoalProvider: TimelineProvider {
  func placeholder(in context: Context) -> OneGoalEntry {
    OneGoalEntry(date: Date(), snapshot: WidgetSnapshot(
      title: "True Focus",
      totalDays: 30,
      completedDays: 12,
      lastCompletedDate: nil,
      accentColor: nil,
      updatedAt: ISO8601DateFormatter().string(from: Date())
    ))
  }

  func getSnapshot(in context: Context, completion: @escaping (OneGoalEntry) -> Void) {
    completion(OneGoalEntry(date: Date(), snapshot: loadSnapshot()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<OneGoalEntry>) -> Void) {
    let entry = OneGoalEntry(date: Date(), snapshot: loadSnapshot())
    let timeline = Timeline(entries: [entry], policy: .never)
    completion(timeline)
  }

  private func loadSnapshot() -> WidgetSnapshot? {
    guard let defaults = UserDefaults(suiteName: "group.com.mj.onegoal"),
          let json = defaults.string(forKey: "widgetSnapshot"),
          let data = json.data(using: .utf8) else {
      return nil
    }

    return try? JSONDecoder().decode(WidgetSnapshot.self, from: data)
  }
}

struct OneGoalWidgetView: View {
  var entry: OneGoalProvider.Entry

  var body: some View {
    if let snapshot = entry.snapshot {
      VStack(alignment: .leading, spacing: 8) {
        Text(snapshot.title)
          .font(.headline)
          .lineLimit(1)

        HStack(alignment: .lastTextBaseline, spacing: 6) {
          Text("\(snapshot.completedDays)")
            .font(.system(size: 36, weight: .bold))
          Text("/\(snapshot.totalDays)")
            .font(.caption)
            .foregroundStyle(.secondary)
        }

        ProgressView(value: Double(snapshot.completedDays), total: Double(snapshot.totalDays))
          .progressViewStyle(.linear)
      }
      .padding()
    } else {
      VStack(alignment: .leading, spacing: 8) {
        Text("True Focus")
          .font(.headline)
        Text("Start your goal")
          .font(.caption)
          .foregroundStyle(.secondary)
      }
      .padding()
    }
  }
}

@main
struct OneGoalWidget: Widget {
  let kind: String = "OneGoalWidget"

  var body: some WidgetConfiguration {
    let configuration = StaticConfiguration(kind: kind, provider: OneGoalProvider()) { entry in
      OneGoalWidgetView(entry: entry)
    }
    .configurationDisplayName("True Focus")
    .description("Track daily progress for your goal.")

    if #available(iOSApplicationExtension 16.0, *) {
      return configuration.supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
    }

    return configuration.supportedFamilies([.systemSmall, .systemMedium])
  }
}
