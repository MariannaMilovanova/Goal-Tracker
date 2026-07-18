import SwiftUI

struct WatchGoalDetailView: View {
  @EnvironmentObject private var connectivity: WatchConnectivityController
  let goal: WatchGoalSnapshot

  @State private var showCelebration = false
  @State private var flameScale: CGFloat = 0.5

  private var buttonTitle: String {
    if connectivity.isSendingAction {
      return "Syncing..."
    }
    if goal.isCompletedToday {
      return "Done today"
    }
    return goal.type == .multipleTimesPerDay ? "Track one" : "Mark as done"
  }

  private var isDone: Bool {
    goal.isCompletedToday
  }

  private var currentDay: Int {
    let day = goal.isCompletedToday ? goal.completedDays : goal.completedDays + 1
    return min(max(day, 1), goal.totalDays)
  }

  var body: some View {
    content
      .onChange(of: goal.isCompletedToday) { wasDone, isDoneNow in
        if !wasDone && isDoneNow {
          flameScale = 0.5
          withAnimation(.spring(response: 0.35, dampingFraction: 0.6)) {
            showCelebration = true
          }
          DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
            withAnimation(.easeOut(duration: 0.3)) {
              showCelebration = false
            }
          }
        }
      }
      .overlay {
        if showCelebration {
          celebrationView
            .transition(.scale(scale: 0.8).combined(with: .opacity))
        }
      }
  }

  private var celebrationView: some View {
    VStack(spacing: 8) {
      Image(systemName: "flame.fill")
        .font(.system(size: 46))
        .foregroundStyle(.orange)
        .scaleEffect(flameScale)
        .onAppear {
          withAnimation(.spring(response: 0.4, dampingFraction: 0.45)) {
            flameScale = 1.15
          }
        }
      Text("\(goal.streak) day streak")
        .font(.headline)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.black.opacity(0.88))
    .ignoresSafeArea()
  }

  private var content: some View {
    ScrollView {
      VStack(spacing: 10) {
        // MARK: First screen — action only
        VStack(spacing: 2) {
          Text(goal.title)
            .font(.title3)
            .fontWeight(.semibold)
            .multilineTextAlignment(.center)
            .lineLimit(2)

          if goal.type == .multipleTimesPerDay {
            multipleTimesProgress
          } else {
            oncePerDayProgress
          }
        }

        streakBadge

        trackButton

        if let statusMessage = connectivity.statusMessage {
          Text(statusMessage)
            .font(.caption2)
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
        }

        // MARK: Below the fold — Digital Crown scroll
        Divider()
          .padding(.vertical, 2)

        todaySection

        Text("Day \(currentDay) of \(goal.totalDays)")
          .font(.caption2)
          .foregroundStyle(.secondary)

        NavigationLink {
          WatchGoalsListView()
        } label: {
          HStack(spacing: 3) {
            Text("All goals")
            Image(systemName: "chevron.forward")
              .font(.system(size: 9, weight: .semibold))
          }
        }
        .buttonStyle(.plain)
        .font(.caption2)
        .foregroundStyle(.secondary)
        .padding(.top, 2)
      }
      .frame(maxWidth: .infinity)
      .padding(.vertical, 4)
    }
  }

  // MARK: - Components

  private var oncePerDayProgress: some View {
    VStack(spacing: 0) {
      Text("\(goal.completedDays)")
        .font(.system(size: 50, weight: .heavy, design: .rounded))
        .monospacedDigit()
      Text("days completed")
        .font(.caption)
        .foregroundStyle(.secondary)
    }
  }

  private var multipleTimesProgress: some View {
    VStack(spacing: 6) {
      Text("\(min(goal.todayCount, goal.dailyTarget)) / \(goal.dailyTarget) today")
        .font(.system(size: 24, weight: .bold, design: .rounded))

      HStack(spacing: 4) {
        ForEach(0..<max(0, goal.dailyTarget), id: \.self) { index in
          Circle()
            .fill(index < goal.todayCount ? Color.green : Color.secondary.opacity(0.35))
            .frame(width: 7, height: 7)
        }
      }

      Text("\(goal.completedDays) days completed")
        .font(.caption2)
        .foregroundStyle(.secondary)
    }
  }

  private var streakBadge: some View {
    HStack(spacing: 3) {
      Image(systemName: "flame.fill")
        .foregroundStyle(.orange)
      Text(streakText)
        .foregroundStyle(.primary)
    }
    .font(.system(size: 13))
    .fontWeight(.medium)
    .padding(.horizontal, 10)
    .padding(.vertical, 5)
    .background(
      Capsule()
        .fill(Color.gray.opacity(0.25))
    )
  }

  private var trackButton: some View {
    Button {
      connectivity.track(goal)
    } label: {
      HStack(spacing: 5) {
        Image(systemName: isDone ? "checkmark.circle.fill" : "checkmark")
        Text(buttonTitle)
      }
      .font(.body)
      .fontWeight(.semibold)
      .padding(.horizontal, 18)
      .padding(.vertical, 10)
      .background(
        Capsule()
          .fill(
            isDone
              ? Color(red: 52 / 255, green: 199 / 255, blue: 89 / 255)  // #34C759 — success
              : Color(red: 20 / 255, green: 108 / 255, blue: 46 / 255)  // #146C2E — call to action
          )
      )
      .foregroundStyle(.white)
    }
    .buttonStyle(.plain)
    .disabled(connectivity.isSendingAction || !goal.canTrackToday || goal.isCompletedToday)
    .animation(.easeInOut(duration: 0.25), value: isDone)
  }

  private var todaySection: some View {
    VStack(spacing: 2) {
      Text("Today's status")
        .font(.caption2)
        .foregroundStyle(.secondary)
      HStack(spacing: 4) {
        Image(systemName: isDone ? "checkmark.circle.fill" : "circle")
        Text(isDone ? "Done" : "Not completed")
      }
      .font(.caption)
      .fontWeight(isDone ? .semibold : .regular)
      .foregroundStyle(isDone ? Color.green : Color.primary)
      .animation(.easeInOut(duration: 0.25), value: isDone)
    }
  }

  private var streakText: String {
    if goal.streak == 1 {
      return "1 day streak"
    }
    return "\(goal.streak) day streak"
  }
}
