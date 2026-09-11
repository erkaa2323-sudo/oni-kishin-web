@preconcurrency import LiveKit
import AVFAudio
import Foundation
import WebKit

@MainActor
final class NativeVoiceManager: NSObject, RoomDelegate {
  private weak var webView: WKWebView?
  private var room: Room?
  private var expiryTask: Task<Void, Never>?
  private var muted = false
  private var state = "disconnected"
  private var lastMessage = ""

  func attach(webView: WKWebView) {
    self.webView = webView
  }

  func handle(payload: [String: Any]) async {
    guard let action = payload["action"] as? String else { return }
    switch action {
    case "join":
      guard
        let url = payload["url"] as? String,
        let token = payload["token"] as? String,
        let expiresAt = payload["expiresAt"] as? String
      else {
        emit(state: "error", message: "Native voice payload дутуу байна.")
        return
      }
      await join(url: url, token: token, expiresAt: expiresAt)
    case "mute":
      guard let muted = payload["muted"] as? Bool else { return }
      await setMuted(muted)
    case "leave":
      await leave(message: "Voice-оос гарлаа.")
    default:
      break
    }
  }

  private func configureAudioSession() throws {
    let session = AVAudioSession.sharedInstance()
    try session.setCategory(
      .playAndRecord,
      mode: .voiceChat,
      options: [.allowBluetoothHFP, .defaultToSpeaker, .mixWithOthers]
    )
    try session.setActive(true)
  }

  private func join(url: String, token: String, expiresAt: String) async {
    await leave(message: "", emitState: false)
    emit(state: "connecting", message: "Native LiveKit voice холбож байна…")

    do {
      try configureAudioSession()
      let nextRoom = Room()
      nextRoom.add(delegate: self)
      room = nextRoom

      try await nextRoom.connect(
        url: url,
        token: token,
        connectOptions: ConnectOptions(enableMicrophone: true)
      )
      try await nextRoom.localParticipant.setMicrophone(enabled: true)
      muted = false
      emit(state: "connected", message: "Voice LIVE. CPM рүү шилжсэн ч үргэлжилнэ.")
      scheduleExpiry(expiresAt)
    } catch {
      await leave(message: "", emitState: false)
      emit(state: "error", message: "Native LiveKit холболт амжилтгүй: \(error.localizedDescription)")
    }
  }

  private func setMuted(_ shouldMute: Bool) async {
    guard let room else { return }
    do {
      try await room.localParticipant.setMicrophone(enabled: !shouldMute)
      muted = shouldMute
      emit(
        state: "connected",
        message: shouldMute ? "Микрофон хаалттай." : "Микрофон нээлттэй."
      )
    } catch {
      emit(state: "error", message: "Микрофон өөрчилж чадсангүй: \(error.localizedDescription)")
    }
  }

  private func scheduleExpiry(_ expiresAt: String) {
    expiryTask?.cancel()
    guard let date = ISO8601DateFormatter().date(from: expiresAt) else { return }
    let delay = max(0, date.timeIntervalSinceNow)
    expiryTask = Task { [weak self] in
      try? await Task.sleep(for: .seconds(delay))
      guard !Task.isCancelled else { return }
      await self?.leave(message: "Meet хугацаа дууссан тул voice хаагдлаа.")
    }
  }

  private func leave(message: String, emitState: Bool = true) async {
    expiryTask?.cancel()
    expiryTask = nil

    if let room {
      room.remove(delegate: self)
      await room.disconnect()
      self.room = nil
    }

    muted = false
    if emitState {
      emit(state: "disconnected", message: message)
    }
  }

  func syncStateToWeb() {
    emit(state: state, message: lastMessage)
  }

  private func emit(state: String, message: String) {
    self.state = state
    self.lastMessage = message
    let payload: [String: Any] = [
      "state": state,
      "muted": muted,
      "message": message,
    ]

    guard
      let data = try? JSONSerialization.data(withJSONObject: payload),
      let json = String(data: data, encoding: .utf8)
    else { return }

    let script = "window.dispatchEvent(new CustomEvent('oni-native-voice-state',{detail:\(json)}));"
    webView?.evaluateJavaScript(script)
  }

  nonisolated func roomIsReconnecting(_ room: Room) {
    Task { @MainActor [weak self] in
      self?.emit(state: "reconnecting", message: "Voice холболтыг сэргээж байна…")
    }
  }

  nonisolated func roomDidReconnect(_ room: Room) {
    Task { @MainActor [weak self] in
      self?.emit(state: "connected", message: "Voice холболт сэргэлээ.")
    }
  }

  nonisolated func room(_ room: Room, didDisconnectWithError error: LiveKitError?) {
    Task { @MainActor [weak self] in
      self?.room = nil
      self?.muted = false
      self?.emit(
        state: "disconnected",
        message: error == nil ? "Voice холболт саллаа." : "Voice тасарлаа: \(error!.localizedDescription)"
      )
    }
  }
}
