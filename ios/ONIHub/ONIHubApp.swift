import SwiftUI

@main
struct ONIHubApp: App {
  init() {
    NativeNotificationManager.shared.activate()
  }

  var body: some Scene {
    WindowGroup {
      ContentView()
    }
  }
}
