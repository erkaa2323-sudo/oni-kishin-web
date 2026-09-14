import SwiftUI
import WebKit

struct ONIWebView: UIViewRepresentable {
  let url: URL

  func makeCoordinator() -> Coordinator {
    Coordinator()
  }

  func makeUIView(context: Context) -> WKWebView {
    let configuration = WKWebViewConfiguration()
    configuration.allowsInlineMediaPlayback = true
    configuration.mediaTypesRequiringUserActionForPlayback = []
    configuration.userContentController.add(context.coordinator, name: "oniVoice")
    configuration.userContentController.add(context.coordinator, name: "oniNotifications")

    let webView = WKWebView(frame: .zero, configuration: configuration)
    webView.isOpaque = false
    webView.backgroundColor = .black
    webView.scrollView.backgroundColor = .black
    webView.navigationDelegate = context.coordinator
    context.coordinator.attach(webView: webView)
    webView.load(URLRequest(url: url))
    return webView
  }

  func updateUIView(_ webView: WKWebView, context: Context) {}

  static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
    webView.configuration.userContentController.removeScriptMessageHandler(forName: "oniVoice")
    webView.configuration.userContentController.removeScriptMessageHandler(forName: "oniNotifications")
  }

  @MainActor
  final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
    private let voiceManager = NativeVoiceManager()
    private let notificationManager = NativeNotificationManager.shared

    func attach(webView: WKWebView) {
      voiceManager.attach(webView: webView)
      notificationManager.attach(webView: webView)
    }

    func userContentController(
      _ userContentController: WKUserContentController,
      didReceive message: WKScriptMessage
    ) {
      if message.name == "oniVoice", let payload = message.body as? [String: Any] {
        Task { @MainActor in
          await voiceManager.handle(payload: payload)
        }
        return
      }

      if message.name == "oniNotifications", let payload = message.body as? [String: Any] {
        notificationManager.handle(payload: payload)
      }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
      voiceManager.syncStateToWeb()
      notificationManager.syncPendingDeepLink()
    }
  }
}
