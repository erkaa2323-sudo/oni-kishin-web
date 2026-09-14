# ONI WORLD 2099 — no-Blender production pipeline

This document defines the production path for the ONI WORLD experience in `erkaa2323-sudo/oni-kishin-web`.

## Goal

Build a high-quality 360° interactive 3D world for mobile web with the least possible manual 3D work. The web experience must remain compatible with the current ONI HUB React/TanStack/Firebase architecture and must not require a paid realtime 3D streaming service.

## Current architecture

- React/TanStack remains the application shell and owns authentication, Meet, Garage, Profile, Gallery and ONI AI data.
- `/street-ops` remains the compatibility route for the existing app/native links.
- `OniStreetOpsStage.tsx` is the React bridge between ONI HUB data and the 3D runtime.
- `public/oni-world-3d-host.html` is the stable iframe entry point.
- `public/oni-world-3d-runtime.html` is the isolated Three.js runtime.
- The runtime currently uses procedural geometry, so Blender is not required for the foundation.

## Runtime contract

React → 3D runtime messages:

- `oni-world:state`: Meet active state, active riders, machine count and world pulse.
- `oni-world:focus`: cinematic focus on a named district.
- `oni-world:reset`: return to the megacity overview.

3D runtime → React messages:

- `oni-world:ready`: renderer is ready.
- `oni-world:error`: renderer could not boot; React shows safe mode.
- `oni-world:district`: a district is selected.
- `oni-world:enter`: open the existing ONI route for the selected district.

## District map

| World district | Existing ONI system |
| --- | --- |
| ONI CITADEL | `/profile` |
| KISHIN MOUNTAIN | `/meet` |
| KISHIN GARAGE | `/garage` |
| MEMORY ARCHIVE | `/gallery` |
| SHIZUKI AI TOWER | `/oni-ai` |
| ONI BATTLE ARENA | `/meet` |
| AKUMA DOCKS | `/garage` |

## Asset pipeline without Blender

1. Keep procedural geometry as the always-available mobile fallback.
2. Generate one clean concept image per hero landmark.
3. Convert the concept image to GLB/glTF with Fal or to3D when generation quota is available.
4. Keep each landmark as a separate asset rather than one giant world file.
5. Store web-ready assets under `public/oni-world/assets/`.
6. Load hero assets lazily only when their district is near/focused.
7. Preserve procedural landmarks until each generated GLB has passed mobile performance checks.
8. If a generated asset is visually weak, regenerate it rather than introducing Blender as a required step.

Recommended asset names:

- `oni-citadel.glb`
- `kishin-mountain-gate.glb`
- `kishin-garage.glb`
- `memory-archive.glb`
- `shizuki-ai-tower.glb`
- `oni-arena.glb`
- `akuma-docks-hero.glb`

## Mobile performance budget

The world is designed for iPhone-first use.

- Render pixel ratio is capped.
- Mobile disables expensive scene shadows.
- Mobile uses a smaller procedural building budget.
- Districts are independent so future GLB assets can be lazy-loaded.
- Avoid a single monolithic world model.
- Prefer compressed textures and mesh compression for generated GLB assets.
- The initial world must remain usable even when external 3D asset/CDN loading fails.

## Visual direction

ONI WORLD is not a generic cyberpunk city. Every new asset should follow the same design language:

- Japanese dark-futuristic 2099 megacity.
- Oni mythology in architecture rather than pasted-on decoration.
- Black metal, deep graphite, red energy light and controlled cyan accents.
- Underground JDM culture, elevated roads, tunnels, industrial docks and mountain drift roads.
- Strong silhouettes readable on a phone screen.
- Minimal text embedded into generated assets; UI text stays in the React/HUD layer.

## Generation priority

When generation quota is available, upgrade assets in this order:

1. ONI CITADEL — center landmark and strongest identity anchor.
2. SHIZUKI AI TOWER — second-tallest silhouette and ONI AI identity.
3. KISHIN MOUNTAIN gate/road hero asset.
4. KISHIN GARAGE exterior.
5. ONI BATTLE ARENA.
6. AKUMA DOCKS hero crane/gate set.
7. MEMORY ARCHIVE.

## Release rule

Do not replace production procedural assets merely because a generated GLB exists. A hero asset is accepted only when:

- the route still works without it,
- mobile interaction remains smooth,
- loading failure falls back safely,
- existing Meet/Garage/Profile/AI functionality is unchanged,
- Foundation Verification is GREEN.

Production deployment stays guarded until the user explicitly moves the verified PR through merge/deploy.
