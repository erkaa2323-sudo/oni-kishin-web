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

type AndroidVoiceBridge = {
  postMessage: (message: string) => void;
};

declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        oniVoice?: WebKitMessageHandler;
      };
    };
    ONIVoice?: AndroidVoiceBridge;
  }

  interface WindowEventMap {
    "oni-native-voice-state": CustomEvent<NativeVoiceState>;
  }
}

export function hasNativeVoiceBridge(): boolean {
  return Boolean(window.webkit?.messageHandlers?.oniVoice || window.ONIVoice?.postMessage);
}

export function sendNativeVoiceCommand(command: NativeVoiceCommand): boolean {
  const iosHandler = window.webkit?.messageHandlers?.oniVoice;
  if (iosHandler) {
    iosHandler.postMessage(command);
    return true;
  }

  const androidHandler = window.ONIVoice;
  if (androidHandler?.postMessage) {
    androidHandler.postMessage(JSON.stringify(command));
    return true;
  }

  return false;
}
