# ONI HUB V3 Stage 3 — ONI Brain + Character Asset Contract

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

## 4) Character Asset Slots (Original Art Ready)

Recommended canvas:

- **Character canvas**: `1536 x 2048` (2D layered master)
- **Runtime export target**: 2x and 1x responsive variants (e.g. 768x1024, 512x682)
- Transparent background for all character layers.

Layer names:

1. `body_base`
2. `torso`
3. `legs`
4. `arm_left`
5. `arm_right`
6. `hand_left`
7. `hand_right`
8. `neck`
9. `head`
10. `hair_back`
11. `hair_front`
12. `eyes`
13. `eyebrows`
14. `mouth`
15. `horns`
16. `clothes`
17. `accessory`
18. `aura_fx`

Anchor/pivot guidance:

- root pivot: center-bottom of `body_base`
- arm pivots: shoulder joints
- hand pivots: wrist joints
- head pivot: lower-center neck connection
- aura pivot: root pivot

Formats:

- Prefer `WebP`/`AVIF` for opaque/semi-opaque layers
- PNG only where alpha precision is required
- Optional SVG for symbolic accessories/emblems

Compression:

- each runtime layer ideally `< 200KB`
- first-render bundle target `< 1.5MB` on mobile
- lazy-load non-initial expression/pose assets

## 5) Expression / Gesture Coverage

Emotion coverage:

- neutral, happy, excited, thinking, confused, serious, concerned, sad, sorry, proud, playful, surprised, music, meet-live

Gesture coverage:

- idle, listen, talk, wave, nod, think, point, cheer, laugh, bow, hands-on-hip, surprised, calm, dance-subtle, battle-ready

## 6) External Runtime Configuration Still Required

- `OPENAI_API_KEY` must remain in Cloudflare Worker secret storage.
- Optional:
  - `ONI_MODEL`
  - `ONI_ALLOWED_ORIGINS`

