# ONI HUB V3 — ONI Brain + Living ONI AI Asset Contract

## 1) ONI Brain Response Contract

Server (`/src/index.js`) returns a backward-compatible payload:

```json
{
  "ok": true,
  "reply": "...",
  "text": "...",
  "emotion": "neutral",
  "gesture": "talk",
  "intensity": 0.46,
  "sources": [],
  "uiAction": null
}
```

- `reply` and `text` are equivalent for text-only compatibility.
- `emotion` allow-list:
  `neutral, happy, excited, thinking, confused, serious, concerned, sad, sorry, proud, playful, surprised, music, meet-live`
- `gesture` allow-list:
  `idle, listen, talk, wave, nod, shake-head, think, point, cheer, laugh, bow, hands-on-hip, surprised, calm, dance-subtle, battle-ready`
- `intensity` is clamped to `0.0-1.0`.
- `sources` appears only with valid web citations.

## 2) Tooling Boundaries

Server-side allow-listed tools:

- `get_clan_stats`
- `get_members`
- `find_member`
- `get_garage`
- `find_garage_build`
- `get_current_meet`
- `get_meet_status`
- `control_music`

Security:

- no provider secrets in frontend JS
- no arbitrary Firestore writes from model
- no arbitrary JS execution
- bounded tool rounds and per-tool timeout
- web content treated as untrusted

## 3) Shared Meet World State

`/v2/js/meet-world.js` publishes normalized shared states:

- `NONE`
- `UPCOMING`
- `LIVE`
- `FULL`
- `ENDED`

Used by ONI AI and global UI indicators to prevent contradictory state rendering.

## 4) Living ONI AI Presentation Contract

Frontend semantic allow-lists:

- `emotion`:
  `neutral, happy, excited, thinking, confused, serious, concerned, sad, sorry, proud, playful, surprised, music, meet-live`
- `gesture`:
  `idle, listen, talk, wave, nod, shake-head, think, point, cheer, laugh, bow, hands-on-hip, surprised, calm, dance-subtle, battle-ready`
- `posture`:
  `relaxed, attentive, forward, confident, closed, soft, battle, music`
- `gaze target`:
  `user, latest-user-message, latest-ai-message, composer, meet-area, neutral-left, neutral-right`
- `conversation state`:
  `idle, noticed-message, reading, listening, thinking, tool-working, responding, finished-speaking, error, music, meet-live`

Safety rules:

- unknown `emotion` falls back to `neutral`
- unknown `gesture` falls back to `talk`
- unknown `posture` falls back to `relaxed`
- unknown `gaze target` falls back to `user`
- `intensity` remains clamped to `0.0-1.0`
- backend/model must never send raw CSS transforms or raw DOM coordinates
- chat must continue working if character assets or motion logic fail

## 5) Character Asset Slots (Original Art Ready)

Recommended canvas:

- **Character canvas**: `1536 x 2048` layered master
- **Runtime export target**: 2x and 1x responsive variants, for example `768x1024` and `512x682`
- Transparent background for all character layers.
- Body origin: center-bottom of the full-body standing pose.

Layer names:

1. `head`
2. `eyes`
3. `eyelids`
4. `eyebrows`
5. `mouth`
6. `hair_back`
7. `hair_front`
8. `horns`
9. `neck`
10. `shoulders`
11. `torso`
12. `arm_left_upper`
13. `arm_left_forearm`
14. `hand_left`
15. `arm_right_upper`
16. `arm_right_forearm`
17. `hand_right`
18. `hips`
19. `legs`
20. `clothes`
21. `accessories`
22. `aura`

Anchor/pivot guidance:

- root pivot: center-bottom of body origin
- torso pivot: lower-center torso
- shoulder pivots: left/right shoulder joints
- upper arm pivots: shoulder joints
- forearm pivots: elbow joints
- hand pivots: wrist joints
- head pivot: lower-center neck connection
- eye motion zone: remain inside the eye whites for every gaze target
- aura pivot: root pivot

Gaze target expectations:

- `user`: near camera / viewer
- `latest-user-message`: glance toward the newest user bubble
- `latest-ai-message`: glance toward the newest ONI AI bubble
- `composer`: glance toward the message composer area
- `meet-area`: glance toward the Meet status chip
- `neutral-left`, `neutral-right`: restrained idle offsets

Expression support requirements:

- neutral
- happy
- excited
- thinking
- confused
- serious
- concerned
- sorry
- proud
- playful
- surprised
- music
- meet-live

Gesture support requirements:

- idle
- listen
- talk
- wave
- nod
- think
- point
- cheer
- laugh
- bow
- hands-on-hip
- surprised
- calm
- dance-subtle
- battle-ready

Pose requirements:

- full-body standing neutral
- attentive listen
- forward response
- confident hands-on-hip
- soft / apologetic
- restrained battle / meet-live
- subtle music groove
- at least 2-3 thinking-friendly arm/head variants

Formats:

- Prefer `WebP`/`AVIF` for opaque/semi-opaque layers
- PNG only where alpha precision is required
- Optional SVG for symbolic accessories/emblems

Compression:

- each runtime layer ideally `< 200KB`
- first-render bundle target `< 1.5MB` on mobile
- lazy-load non-initial expression/pose assets
- fallback silhouette/emblem mode must remain available when production art is absent or fails to load

## 6) Expression / Gesture Coverage

Emotion coverage:

- neutral, happy, excited, thinking, confused, serious, concerned, sad, sorry, proud, playful, surprised, music, meet-live

Gesture coverage:

- idle, listen, talk, wave, nod, think, point, cheer, laugh, bow, hands-on-hip, surprised, calm, dance-subtle, battle-ready

## 7) External Runtime Configuration Still Required

- `OPENAI_API_KEY` must remain in Cloudflare Worker secret storage.
- Optional:
  - `ONI_MODEL`
  - `ONI_ALLOWED_ORIGINS`
