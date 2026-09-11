export type NativeVoiceState =
  | { state: "connecting"; muted?: boolean; message?: string }
  | { state: "connected"; muted?: boolean; message?: string }
  | { state: "reconnecting"; muted?: boolean; message?: string }
  | { state: "disconnected"; muted?: boolean; message?: string }
  | { state: "error"; muted?: boolean; message?: string };

type NativeVoiceCommand =
  | { action: "join"; url: string; token: string; expiresAt: string }
  | { action: "mute"; muted: boolean }
  | { action: "leave" };

type WebKitMessageHandler = {
  postMessage: (message: NativeVoiceCommand) => void;
};

declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        oniVoice?: WebKitMessageHandler;
      };
    };
  }

  interface WindowEventMap {
    "oni-native-voice-state": CustomEvent<NativeVoiceState>;
  }
}

export function hasNativeVoiceBridge(): boolean {
  return Boolean(window.webkit?.messageHandlers?.oniVoice);
}

export function sendNativeVoiceCommand(command: NativeVoiceCommand): boolean {
  const handler = window.webkit?.messageHandlers?.oniVoice;
  if (!handler) return false;
  handler.postMessage(command);
  return true;
}
