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
  }

  @MainActor
  final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
    private let voiceManager = NativeVoiceManager()

    func attach(webView: WKWebView) {
      voiceManager.attach(webView: webView)
    }

    func userContentController(
      _ userContentController: WKUserContentController,
      didReceive message: WKScriptMessage
    ) {
      guard message.name == "oniVoice", let payload = message.body as? [String: Any] else { return }
      Task { @MainActor in
        await voiceManager.handle(payload: payload)
      }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
      voiceManager.syncStateToWeb()
    }
  }
}
