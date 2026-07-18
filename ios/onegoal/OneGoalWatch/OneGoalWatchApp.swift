import SwiftUI

@main
struct OneGoalWatchApp: App {
  @StateObject private var connectivity = WatchConnectivityController()

  var body: some Scene {
    WindowGroup {
      WatchRootView()
        .environmentObject(connectivity)
    }
  }
}
