import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("web app exposes a bounded native notification bridge", async () => {
  const [bridge, root, client] = await Promise.all([
    read("src/components/oni/OniNativeNotificationBridge.tsx"),
    read("src/routes/__root.tsx"),
    read("src/lib/native-notifications.ts"),
  ]);

  assert.match(root, /<OniNativeNotificationBridge \/>/);
  assert.match(client, /oniNotifications/);
  assert.match(client, /ONINotifications/);
  assert.match(client, /type: "schedule"/);
  assert.match(client, /NativeNotificationPath/);
  assert.match(bridge, /oni-meet-reminder-/);
  assert.match(bridge, /progressionProfiles/);
  assert.match(bridge, /rankForXp/);
  assert.match(bridge, /socialEvents/);
  assert.match(bridge, /requestNativeNotificationPermission\(\)/);
});

test("iOS shell schedules notifications and deep-links back into ONI HUB", async () => {
  const [manager, webView, app] = await Promise.all([
    read("ios/ONIHub/NativeNotificationManager.swift"),
    read("ios/ONIHub/ONIWebView.swift"),
    read("ios/ONIHub/ONIHubApp.swift"),
  ]);

  assert.match(manager, /UNUserNotificationCenter/);
  assert.match(manager, /UNTimeIntervalNotificationTrigger/);
  assert.match(manager, /didReceive response: UNNotificationResponse/);
  assert.match(manager, /https:\/\/oni-hub-v3\.vercel\.app/);
  assert.match(webView, /name: "oniNotifications"/);
  assert.match(webView, /notificationManager\.syncPendingDeepLink\(\)/);
  assert.match(app, /NativeNotificationManager\.shared\.activate\(\)/);
});

test("Android shell persists scheduled notifications and handles deep links", async () => {
  const [manager, activity, receiver, manifest] = await Promise.all([
    read("android/app/src/main/java/mn/onikishin/hub/NativeNotificationManager.kt"),
    read("android/app/src/main/java/mn/onikishin/hub/MainActivity.kt"),
    read("android/app/src/main/java/mn/onikishin/hub/NotificationReceiver.kt"),
    read("android/app/src/main/AndroidManifest.xml"),
  ]);

  assert.match(manager, /setAndAllowWhileIdle/);
  assert.match(manager, /NotificationCompat\.Builder/);
  assert.match(manager, /PendingIntent\.getActivity/);
  assert.match(activity, /addJavascriptInterface\(NotificationBridge\(\), "ONINotifications"\)/);
  assert.match(activity, /override fun onNewIntent/);
  assert.match(receiver, /NativeNotificationManager\.show/);
  assert.match(manifest, /\.NotificationReceiver/);
  assert.match(manifest, /android\.permission\.POST_NOTIFICATIONS/);
});
