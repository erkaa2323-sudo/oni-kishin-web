import UIKit
import UserNotifications
import WebKit

@MainActor
final class NativeNotificationManager: NSObject, UNUserNotificationCenterDelegate {
  static let shared = NativeNotificationManager()

  private let center = UNUserNotificationCenter.current()
  private weak var webView: WKWebView?
  private var pendingDeepLink: String?
  private let allowedPaths: Set<String> = [
    "/meet",
    "/profile",
    "/garage",
    "/street-ops",
    "/gallery",
    "/admin",
  ]

  private override init() {
    super.init()
  }

  func activate() {
    center.delegate = self
  }

  func attach(webView: WKWebView) {
    self.webView = webView
  }

  func requestPermission() {
    center.requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
  }

  func handle(payload: [String: Any]) {
    guard let type = payload["type"] as? String else { return }
    switch type {
    case "requestPermission":
      requestPermission()
    case "show":
      guard let request = makeRequest(payload: payload, fireAt: nil) else { return }
      center.add(request)
    case "schedule":
      guard
        let rawDate = payload["fireAt"] as? String,
        let fireAt = parseDate(rawDate),
        let request = makeRequest(payload: payload, fireAt: fireAt)
      else { return }
      center.add(request)
    case "cancel":
      guard let id = safeId(payload["id"]) else { return }
      center.removePendingNotificationRequests(withIdentifiers: [id])
      center.removeDeliveredNotifications(withIdentifiers: [id])
    case "clearBadge":
      UIApplication.shared.applicationIconBadgeNumber = 0
      center.removeAllDeliveredNotifications()
    default:
      return
    }
  }

  func syncPendingDeepLink() {
    guard let path = pendingDeepLink else { return }
    pendingDeepLink = nil
    open(path: path)
  }

  private func makeRequest(payload: [String: Any], fireAt: Date?) -> UNNotificationRequest? {
    guard
      let id = safeId(payload["id"]),
      let title = safeText(payload["title"], max: 100),
      let body = safeText(payload["body"], max: 300)
    else { return nil }

    let path = safePath(payload["url"] as? String)
    let content = UNMutableNotificationContent()
    content.title = title
    content.body = body
    content.sound = .default
    content.userInfo = ["url": path]

    let trigger: UNNotificationTrigger?
    if let fireAt {
      let interval = max(1, fireAt.timeIntervalSinceNow)
      trigger = UNTimeIntervalNotificationTrigger(timeInterval: interval, repeats: false)
    } else {
      trigger = nil
    }
    return UNNotificationRequest(identifier: id, content: content, trigger: trigger)
  }

  private func safeId(_ value: Any?) -> String? {
    guard let raw = value as? String else { return nil }
    let id = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !id.isEmpty, id.count <= 160 else { return nil }
    return id
  }

  private func safeText(_ value: Any?, max: Int) -> String? {
    guard let raw = value as? String else { return nil }
    let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !text.isEmpty else { return nil }
    return String(text.prefix(max))
  }

  private func safePath(_ value: String?) -> String {
    let raw = value ?? "/"
    let path = raw.split(whereSeparator: { $0 == "?" || $0 == "#" }).first.map(String.init) ?? "/"
    return allowedPaths.contains(path) ? path : "/"
  }

  private func parseDate(_ value: String) -> Date? {
    let fractional = ISO8601DateFormatter()
    fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = fractional.date(from: value) { return date }
    return ISO8601DateFormatter().date(from: value)
  }

  private func open(path: String) {
    guard let webView else {
      pendingDeepLink = path
      return
    }
    guard let url = URL(string: "https://oni-hub-v3.vercel.app\(safePath(path))") else { return }
    webView.load(URLRequest(url: url))
  }

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    completionHandler([.banner, .sound, .badge])
  }

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    let path = safePath(response.notification.request.content.userInfo["url"] as? String)
    open(path: path)
    completionHandler()
  }
}
