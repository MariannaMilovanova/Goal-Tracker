import SwiftUI

struct WatchGoalsListView: View {
  @EnvironmentObject private var connectivity: WatchConnectivityController
  @Environment(\.dismiss) private var dismiss

  var body: some View {
    List {
      ForEach(connectivity.snapshot?.goals ?? []) { goal in
        Button {
          connectivity.selectGoal(goal)
          dismiss()
        } label: {
          HStack {
            if goal.isTrueFocus {
              Image(systemName: "star.fill")
                .foregroundStyle(.yellow)
                .font(.caption)
            }
            Text(goal.title)
              .lineLimit(1)
            Spacer()
            if goal.id == connectivity.selectedGoal?.id {
              Image(systemName: "checkmark")
                .font(.caption2)
                .foregroundStyle(.green)
            }
          }
        }
      }
    }
    .navigationTitle("Goals")
  }
}
