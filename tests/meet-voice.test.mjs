import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync("src/lib/meet-voice.functions.ts", "utf8");
const client = readFileSync("src/components/oni/MeetVoice.tsx", "utf8");

test("Meet voice token endpoint stays fail-closed and keeps LiveKit secrets server-only", () => {
  assert.match(server, /process\.env\.LIVEKIT_URL/);
  assert.match(server, /process\.env\.LIVEKIT_API_KEY/);
  assert.match(server, /process\.env\.LIVEKIT_API_SECRET/);
  assert.doesNotMatch(server, /VITE_LIVEKIT_(API_KEY|API_SECRET)/);
  assert.match(server, /meetVoiceAuthorization\/current/);
  assert.match(server, /authorization\.status !== 404/);
  assert.match(server, /body\.error\?\.status !== "NOT_FOUND"/);
});

test("Meet voice grants are audio-only and stop issuing at the Meet expiry boundary", () => {
  assert.match(server, /const MEET_DURATION_MS = 20 \* 60_000/);
  assert.match(server, /now < startAtMs \|\| now >= expiresAtMs/);
  assert.match(server, /canPublishSources: \["microphone"\]/);
  assert.match(server, /canPublishData: false/);
  assert.match(server, /exp: input\.expiresAtSeconds/);
  assert.match(server, /expiresAtSeconds: Math\.floor\(authorization\.expiresAtMs \/ 1000\)/);
});

test("Meet voice client joins, plays remote audio, mutes, leaves, and handles reconnect", () => {
  assert.match(client, /livekit-client@2\.22\.3\/dist\/livekit-client\.umd\.min\.js/);
  assert.match(client, /getMeetVoiceToken/);
  assert.match(client, /RoomEvent\.TrackSubscribed/);
  assert.match(client, /track\.attach\(\)/);
  assert.match(client, /room\.startAudio\(\)/);
  assert.match(client, /setMicrophoneEnabled\(true\)/);
  assert.match(client, /setMicrophoneEnabled\(!nextMuted\)/);
  assert.match(client, /RoomEvent\.Reconnecting/);
  assert.match(client, /RoomEvent\.Reconnected/);
  assert.match(client, /room\.disconnect\(true\)/);
});
