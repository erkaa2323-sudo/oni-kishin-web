import SwiftUI

struct ContentView: View {
  var body: some View {
    ONIWebView(url: URL(string: "https://oni-hub-v3.vercel.app")!)
      .ignoresSafeArea()
      .preferredColorScheme(.dark)
  }
}
