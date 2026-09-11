import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const bridge = readFileSync("src/lib/native-voice.ts", "utf8");
const meetVoice = readFileSync("src/components/oni/MeetVoice.tsx", "utf8");
const project = readFileSync("ios/project.yml", "utf8");
const manager = readFileSync("ios/ONIHub/NativeVoiceManager.swift", "utf8");

test("native bridge receives the existing server-issued LiveKit grant", () => {
  assert.match(bridge, /oniVoice/);
  assert.match(bridge, /action: "join"/);
  assert.match(meetVoice, /getMeetVoiceToken/);
  assert.match(meetVoice, /hasNativeVoiceBridge\(\)/);
  assert.match(meetVoice, /url: grant\.url/);
  assert.match(meetVoice, /token: grant\.token/);
  assert.match(meetVoice, /expiresAt: grant\.expiresAt/);
});

test("iOS target declares microphone and background audio support", () => {
  assert.match(project, /NSMicrophoneUsageDescription/);
  assert.match(project, /UIBackgroundModes:/);
  assert.match(project, /- audio/);
  assert.match(project, /client-sdk-swift/);
});

test("native LiveKit path enables mic, mixes audio, and expires with the Meet", () => {
  assert.match(manager, /ConnectOptions\(enableMicrophone: true\)/);
  assert.match(manager, /setMicrophone\(enabled: true\)/);
  assert.match(manager, /\.playAndRecord/);
  assert.match(manager, /\.voiceChat/);
  assert.match(manager, /\.mixWithOthers/);
  assert.match(manager, /scheduleExpiry/);
  assert.match(manager, /await room\.disconnect\(\)/);
});
