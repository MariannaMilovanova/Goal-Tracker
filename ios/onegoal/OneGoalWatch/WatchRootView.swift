import SwiftUI

struct WatchRootView: View {
  @EnvironmentObject private var connectivity: WatchConnectivityController

  var body: some View {
    NavigationStack {
      Group {
        if let snapshot = connectivity.snapshot {
          if snapshot.goals.isEmpty {
            VStack(spacing: 8) {
              Text("True Focus")
                .font(.headline)
              Text("Create a goal on iPhone.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            }
          } else if let goal = connectivity.selectedGoal {
            WatchGoalDetailView(goal: goal)
          }
        } else {
          VStack(spacing: 8) {
            ProgressView()
            Text("Syncing")
              .font(.caption)
              .foregroundStyle(.secondary)
          }
          .onAppear {
            connectivity.requestSnapshot()
          }
        }
      }
    }
  }
}
