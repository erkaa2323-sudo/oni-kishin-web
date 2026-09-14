# ONI WORLD V3 — World Readability & Asset Upgrade

## Goal
Turn ONI WORLD from a dark 3D menu into a readable, navigable cyberpunk mini-world while preserving mobile Safari performance and existing routes.

## Phase 1 — Readability (first implementation)
- Raise night exposure and ambient fill without losing cyberpunk mood.
- Reduce black crush and fog density.
- Give roads and major silhouettes stronger separation.
- Make each district visually identifiable at distance.

## Phase 2 — Navigation
- Persistent compass / mini-map style radar.
- `YOU ARE HERE` orientation state.
- Floating hologram labels for ONI Citadel, Kishin Garage, Kishin Mountain, Shizuki AI Tower, Battle Arena, Memory Archive, Akuma Docks.
- Selected destination distance and neon route guidance.
- First tap focuses a district; second tap enters the existing route.

## Phase 3 — Asset pipeline
Use licensed assets only. Priority is CC0 and self-contained GLB.

### Approved sources
1. 3DAssets.dev Cyberpunk Apartment and Neon Block — CC0 1.0, 68 models, 10.4 MB total, 276,540 tris. Individual CDN GLBs are CORS enabled and work with plain Three.js GLTFLoader.
2. Kenney City Kit (Commercial) — CC0, 50 city models.
3. Kenney Modular Buildings — CC0, 100 models.
4. Kenney Racing Kit — CC0, 110 files.
5. Kenney Car Kit — CC0, 45 files.
6. Kenney Modular Space Kit — CC0, 40 files.
7. Poly Haven — CC0 textures/HDRIs where appropriate.

### Reference-only / attribution-gated candidates
- Sketchfab Cyberpunk City #1 — CC Attribution, 64.2k tris.
- Sketchfab CyberCity 2099 V2 — CC Attribution, 149.5k tris.
Do not ship these until attribution and performance are explicitly handled.

## District art direction
- ONI Citadel: fortress + vertical red crown + antenna/hologram silhouette.
- Kishin Garage: wide industrial hangar, vehicle pads, animated neon strips, cameras.
- Shizuki AI Tower: cyan/blue vertical landmark, holographic crown, drone orbit.
- Kishin Mountain / Drift: readable elevated road loop, guard lighting, moving car-light cues.
- Battle Arena: circular red landmark visible from spawn.
- Memory Archive: quieter cyan/white landmark.
- Akuma Docks: cranes, containers, industrial lighting.

## Mobile performance rules
- Keep procedural geometry as fallback.
- Load district assets progressively.
- Mobile gets fewer decorative GLBs and lower DPR.
- Reuse/instance repeated props.
- Avoid shipping a monolithic high-poly city.
- Prefer 1K common textures and 2K only for hero landmarks.
- GLB failure must never block navigation.

## Delivery order
1. Brightness/readability + labels + compass/radar.
2. Route guidance and district distance.
3. Upgrade landmark silhouettes with approved CC0 assets.
4. Add restrained traffic/drone/NPC ambience.
5. Add player/avatar controls only after mobile frame budget is stable.
6. iPhone Safari/WebKit verification before merge/deploy.
