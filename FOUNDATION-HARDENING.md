# Foundation hardening — local review

Base main: `f827f56b761d87a2324eae1b6d8c07a552b4e16d`
Branch: `gpt6/foundation-hardening`
State: local, uncommitted. No push, PR, merge, deployment, remote rules release, or production data mutation.

## Critical issues and implemented fixes

- Vercel project `oni-hub-v3` remains Git-linked to this repository. Latest main had no Git deployment opt-out. Added `vercel.json` with `git.deploymentEnabled: false`, as [documented by Vercel](https://vercel.com/docs/project-configuration/git-configuration). This local file does NOT prove the remote integration is disabled. Push remains blocked.
- Production prebuilt workflow could deploy when its own file was pushed to main. It now accepts only `workflow_dispatch` on main. Preserved prebuilt deployment steps without executing them. Pinned CLI to registry-reported 59.11.7. Removed unreferenced `.vercel-deploy-trigger` and stale redeploy comment.
- Both Bun and npm locks existed; Bun workspace metadata was stale. Retained the matching `package-lock.json`, removed `bun.lock`, pinned npm 11.9.0, Node 24.x (CI 24.19.0), and changed CI installs to `npm ci`. No existing locked dependency version changed. TanStack Start 1.168.32 explicitly depends on React Router 1.170.18; router-plugin 1.168.23 and React Router share router-core 1.171.15. No speculative alignment or runtime upgrades.
- Orders previously accepted independently chosen price/name/total. Read three public product documents to establish actual `name` and numeric `price` schema. Rules now require an existing product, matching product name and price, and `total == product.price * quantity`. Existing quantity/type/size bounds remain.
- Canonical admin model remains the existing exact Firebase owner email allowlist, matching Firestore `isAdmin`. Shared email helper is used by profile authorization, rewards, creator review, push bridge and verified-token push server function. Permission checks require the owner identity; copilot mutation checks also require the current Firebase UID. Sign-in copy no longer promises ADMIN/MODERATOR access. Reward dock moved inside the authorized gate. Auth generation guard prevents stale asynchronous profile resolution overwriting a later sign-out/account change. Firestore remains the authority.
- Custom push service worker retained. Cache writes are serialized, tied to event lifetime, and bounded to 96 runtime entries while retaining the offline shell. Version bumped to retire old caches. Removed unused vite-plugin-pwa and corrected generateSW documentation. Manifest, shortcuts, standalone/safe-area behavior and push handlers retained.
- Five overlapping audit workflows replaced by one verification workflow and `npm run check` (lint, typecheck, production build, foundation tests, emulator tests, browser tests). Deployment workflows remain separate. Shared Firestore composition script is used by emulator validation and the existing rules-release workflow. Verification contains no deployment command.
- Existing lint failures required formatting-only changes in 49 files, including the existing browser tests; comparisons against Prettier-formatted main confirmed those changes are formatting only. Two unnecessary escapes in dormant Kei HTML template strings were removed without changing the resulting string, and Creator response `any` types were replaced with structural types. Generated/vendor output excluded from lint; application/test lint rules were not relaxed. The active standalone Kei HTML was unchanged. No scale, framing, compatibility bridge, Meet lifecycle or feature behavior was intentionally changed.

## Tests

| Gate | Result |
| --- | --- |
| Clean `npm ci` using final lock | PASS — 1193 packages; lock/manifest consistent |
| Lint | PASS — 0 errors, 7 existing React refresh warnings |
| TypeScript | PASS |
| Default production `npm run build` | PASS — Cloudflare output; no deployment |
| Additional Node-preset production build | PASS — local browser-test fallback |
| Composed Firestore emulator tests | PASS — 13/13, demo-oni-hardening only |
| Foundation tests | PASS — 2/2: concurrent cache bound/offline retention and deployment config guard |
| Kei standalone Chromium | PASS — alpha count 9927; raw Pixi alpha 2571 |
| Kei standalone WebKit | BLOCKED — missing system libraries |
| Real `/meet` Chromium, built Node runtime | PASS — HTTP 200, parentVisible=true, iframe alpha 5469 |
| Real `/meet` WebKit | BLOCKED — missing system libraries |
| `/`, `/join`, `/crew`, `/garage`, `/gallery`, `/meet`, `/oni-ai`, `/admin` Chromium | PASS — 8/8, signed-out admin reward dock hidden |
| Same routes WebKit | BLOCKED — missing system libraries |
| `npm run check` overall | FAIL/BLOCKED at browser gates; never treated as green |
| `git diff --check` | PASS |

The default local Wrangler runtime cannot start in this sandbox (`uv_interface_addresses`, system error 1). The actual built app was therefore also built with supported `NITRO_PRESET=node-server` and tested in that runtime. This is not evidence of a verified Vercel production runtime. WebKit browser binaries downloaded, but required Linux libraries were absent. Standard dependency installation failed on sandbox setgroups/setegid restrictions. Tests were not skipped, weakened, or relabeled as passing. Chromium Meet also logged one external resource `ERR_EMPTY_RESPONSE` while passing its required pixel/parent checks.

## Remaining risks / deliberately unresolved

1. No confirmed remote Vercel Git deployment disablement. Do not push this branch until that precondition is verified. Local configuration alone is insufficient for this task's no-preview guarantee.
2. Mandatory WebKit gates are blocked. CI must execute full checks in an environment with browser dependencies before deploy readiness can be claimed.
3. Current main does not contain the Cloudflare ONI Worker source. Historical pre-V3 `src/secure-worker.js` has an in-memory per-IP limit (12/minute, 10,000 tracked clients); historical Wrangler configuration targets `oni-ai-v9`, not enough to establish the code running behind the current endpoint. Live server-side limiter deployment is unverified. No guessed Worker change, new paid service, timeout change, or personality change was made.
4. Public applications and orders retain unauthenticated create access. Schema validation and authoritative prices do not prevent repeated valid submissions. A trusted server/attestation design is still needed for effective spam control; no client cooldown is presented as security.
5. Current main has no order submission implementation. Tests verify the observed public product schema and existing rule order schema, but an end-to-end legacy checkout has not been exercised. A stale product price must be refreshed before submitting an order.
6. No authenticated owner browser session or production writes were exercised. Existing exact-email authorization retained; no new role-granting mechanism added.
7. Development tooling install reports an upstream superstatic engine-range warning on Node 24; emulator tests succeeded. Runtime dependencies were not upgraded.

`READY_FOR_DEPLOY = NO`

Final commit/PR SHA: none. Base SHA above is not a new hardening commit.

## Exact file manifest

- `.github/workflows/creator-audit.yml`
- `.github/workflows/firebase-rules.yml`
- `.github/workflows/kei-browser-smoke.yml`
- `.github/workflows/kei-live2d-audit.yml`
- `.github/workflows/meet-live2d-audit.yml`
- `.github/workflows/nexus-predeploy-audit.yml`
- `.github/workflows/vercel-prebuilt-production.yml`
- `.github/workflows/verify.yml`
- `.gitignore`
- `.vercel-deploy-trigger`
- `FOUNDATION-HARDENING.md`
- `bun.lock`
- `eslint.config.js`
- `firebase.test.json`
- `firestore.rules`
- `package-lock.json`
- `package.json`
- `public/sw.js`
- `scripts/check-browsers.mjs`
- `scripts/compose-firestore-rules.mjs`
- `scripts/prepare-live2d-core.mjs`
- `src/components/oni/KeiMeetHost.tsx`
- `src/components/oni/KeiMeetHostCubism5.tsx`
- `src/components/oni/KeiMeetHostHardened.tsx`
- `src/components/oni/KeiMeetHostStable.tsx`
- `src/components/oni/NexusMeetPushBridge.tsx`
- `src/components/oni/NiziiroJoinCharacter.tsx`
- `src/components/oni/OniAdminCopilot.tsx`
- `src/components/oni/OniAdminGate.tsx`
- `src/components/oni/OniAiChamber.tsx`
- `src/components/oni/OniControlCenter.tsx`
- `src/components/oni/OniCreatorReviewDock.tsx`
- `src/components/oni/OniCreatorStudio.tsx`
- `src/components/oni/OniCrewStage.tsx`
- `src/components/oni/OniEventRewardDock.tsx`
- `src/components/oni/OniJoinProtocol.tsx`
- `src/components/oni/OniLive2D.tsx`
- `src/components/oni/OniMeetAccess.tsx`
- `src/components/oni/OniMemberGate.tsx`
- `src/components/oni/OniNexusDock.tsx`
- `src/components/oni/OniProgressionRewardBridge.tsx`
- `src/components/oni/OniProgressionStage.tsx`
- `src/components/oni/OniRigBridge.tsx`
- `src/components/oni/OniSocialHub.tsx`
- `src/components/oni/OniWebRig.tsx`
- `src/components/oni/OniWorldTransition.tsx`
- `src/components/oni/oni-approved-character.ts`
- `src/components/oni/oni-rig-assets.ts`
- `src/components/oni/oni-rig-expression.ts`
- `src/components/oni/oni-web-live2d.ts`
- `src/data/admin-copilot.ts`
- `src/data/admin.ts`
- `src/data/creator-publish.ts`
- `src/data/crew.ts`
- `src/data/join.ts`
- `src/data/meet.ts`
- `src/data/member-auth.ts`
- `src/data/oni-ai.ts`
- `src/data/progression-admin.ts`
- `src/data/progression.ts`
- `src/data/social.ts`
- `src/hooks/useOniAuth.tsx`
- `src/lib/admin-authorization.ts`
- `src/lib/backend/errors.ts`
- `src/lib/nexus-push.functions.ts`
- `src/lib/nexus-push.ts`
- `src/lib/oni-brain.ts`
- `src/lib/oni-chat.functions.ts`
- `src/lib/oni-creator.functions.ts`
- `src/lib/oni-emotion.ts`
- `src/lib/oni-nav.ts`
- `src/lib/oni-progression.ts`
- `src/lib/progression-rewards.ts`
- `src/lib/pwa.ts`
- `src/routes/__root.tsx`
- `src/routes/admin.tsx`
- `src/routes/oni-ai.tsx`
- `src/routes/progression.tsx`
- `src/services/admin-profiles.ts`
- `src/services/domains.ts`
- `tests/firestore-rules.test.mjs`
- `tests/foundation.test.mjs`
- `tests/kei-browser-smoke.mjs`
- `tests/kei-meet-integration.mjs`
- `tests/route-smoke.mjs`
- `vercel.json`
- `vite.config.ts`
