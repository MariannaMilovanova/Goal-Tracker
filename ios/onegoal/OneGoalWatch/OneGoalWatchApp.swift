import SwiftUI

@main
struct OneGoalWatchApp: App {
  @StateObject private var connectivity = WatchConnectivityController()
  @Environment(\.scenePhase) private var scenePhase

  var body: some Scene {
    WindowGroup {
      WatchRootView()
        .environmentObject(connectivity)
        .onChange(of: scenePhase, initial: true) { _, phase in
          if phase == .active {
            connectivity.requestSnapshot()
          }
        }
        .onReceive(NotificationCenter.default.publisher(for: .NSCalendarDayChanged)) { _ in
          connectivity.requestSnapshot()
        }
        .onReceive(NotificationCenter.default.publisher(for: .NSSystemTimeZoneDidChange)) { _ in
          connectivity.requestSnapshot()
        }
        .onOpenURL { url in
          guard url.scheme == "onegoalwatch", url.host == "truefocus" else {
            return
          }
          if let trueFocusGoalId = connectivity.snapshot?.trueFocusGoalId {
            connectivity.selectedGoalId = trueFocusGoalId
          }
        }
    }
  }
}
