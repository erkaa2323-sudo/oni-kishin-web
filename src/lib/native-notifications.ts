export type NativeNotificationPath = "/meet" | "/profile" | "/garage" | "/street-ops" | "/gallery" | "/admin";

export type NativeNotificationCommand =
  | { type: "requestPermission" }
  | {
      type: "show";
      id: string;
      title: string;
      body: string;
      url: NativeNotificationPath;
    }
  | {
      type: "schedule";
      id: string;
      title: string;
      body: string;
      url: NativeNotificationPath;
      fireAt: string;
    }
  | { type: "cancel"; id: string }
  | { type: "clearBadge" };

type IosNotificationHandler = {
  postMessage: (payload: NativeNotificationCommand) => void;
};

type AndroidNotificationBridge = {
  postMessage: (payload: string) => void;
};

type NativeNotificationWindow = Window & {
  webkit?: {
    messageHandlers?: {
      oniNotifications?: IosNotificationHandler;
    };
  };
  ONINotifications?: AndroidNotificationBridge;
};

function nativeWindow(): NativeNotificationWindow | null {
  return typeof window === "undefined" ? null : (window as NativeNotificationWindow);
}

export function hasNativeNotificationBridge() {
  const target = nativeWindow();
  return Boolean(
    target?.webkit?.messageHandlers?.oniNotifications?.postMessage ||
      target?.ONINotifications?.postMessage,
  );
}

export function sendNativeNotificationCommand(command: NativeNotificationCommand) {
  const target = nativeWindow();
  if (!target) return false;

  const ios = target.webkit?.messageHandlers?.oniNotifications;
  if (ios?.postMessage) {
    ios.postMessage(command);
    return true;
  }

  const android = target.ONINotifications;
  if (android?.postMessage) {
    android.postMessage(JSON.stringify(command));
    return true;
  }

  return false;
}

export function requestNativeNotificationPermission() {
  return sendNativeNotificationCommand({ type: "requestPermission" });
}

export function showNativeNotification(input: {
  id: string;
  title: string;
  body: string;
  url: NativeNotificationPath;
}) {
  return sendNativeNotificationCommand({ type: "show", ...input });
}

export function scheduleNativeNotification(input: {
  id: string;
  title: string;
  body: string;
  url: NativeNotificationPath;
  fireAt: Date;
}) {
  return sendNativeNotificationCommand({
    type: "schedule",
    id: input.id,
    title: input.title,
    body: input.body,
    url: input.url,
    fireAt: input.fireAt.toISOString(),
  });
}

export function cancelNativeNotification(id: string) {
  return sendNativeNotificationCommand({ type: "cancel", id });
}

export function clearNativeNotificationBadge() {
  return sendNativeNotificationCommand({ type: "clearBadge" });
}
