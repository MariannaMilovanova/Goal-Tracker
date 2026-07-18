import SwiftUI

@main
struct OneGoalWatchApp: App {
  @StateObject private var connectivity = WatchConnectivityController()

  var body: some Scene {
    WindowGroup {
      WatchRootView()
        .environmentObject(connectivity)
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
