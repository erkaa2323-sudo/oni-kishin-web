# ONI HUB — production backend

ONI HUB production identity and application data use **Firebase Authentication + Cloud Firestore**.

No private credentials belong in frontend code. Client-side authorization checks are UX only; Firestore Security Rules are the application-data security boundary. The ruleset keeps a final deny-all fallback so unrecognized collections fail closed.

## Core data domains

- `members` — public clan roster; admin writes.
- `memberAccounts/{uid}` — authenticated member-to-crew link; users can create only their own validated `pending` link, while approval/rejection is admin-only.
- `garage`, `gallery`, `products`, `site`, `music`, `meets` — public-facing data with admin-controlled writes.
- `meetParticipants`, `meetSlots`, `meetRoster`, `meetCredentials` — authenticated Meet access with approved-member checks and credential reveal rules.
- `progressionProfiles`, `progressionLedger`, mission/achievement/prestige claims — XP, rank, ONI Coin and cosmetic economy, protected by Firestore transaction invariants.
- creator and NEXUS collections are composed into the deployed ruleset from the dedicated rule fragments.

## Authentication and authorization

Firebase Authentication identifies the user. A member account is not automatically a Crew membership: `memberAccounts/{uid}` must match an existing Crew member nickname + CPM ID and remains `pending` until an admin approves it.

Admin access accepts a Firebase custom `admin` claim when provisioned. The current owner e-mail remains a compatibility fallback during the migration so production administration is not accidentally locked out. Frontend checks never replace Firestore/server authorization.

## ONI Creator AI

Creator image editing runs server-side through Cloudflare Workers AI with `@cf/black-forest-labs/flux-2-klein-4b`. The client prepares a private sub-512px reference image for FLUX while keeping the higher-resolution local preview. Firebase approved-member verification remains mandatory before inference.

Production requires these server-only environment variables:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

The Cloudflare token must have Workers AI access. Never expose either value through client-side `VITE_*` variables or commit them to the repository.

## ONI MEET

Meet registration requires an approved member account. Registration data must match the linked member identity and the current Meet. Slot creation and participant creation are cross-validated in Firestore rules, capacity is bounded, and room credentials stay protected until the Meet lifecycle allows reveal to an eligible registered member.

## Progression / Economy

XP, ONI Coin, cosmetic unlock/equip, weekly missions, achievements, prestige and Meet rewards use Firestore transactions plus rules that validate the corresponding profile/ledger/claim mutations. The client is not trusted to mint arbitrary XP or Coin.

## Deployment and verification

`npm run check` is the release gate. It covers formatting, lint, typecheck, production build, foundation tests, Firestore-rule tests, Economy audit, and Chromium/WebKit browser checks. Production Vercel deployment is manual and must run the same full verification job before the deploy job can start.

Firebase rule deployment composes the base rules plus creator, NEXUS and progression rule fragments and publishes the resulting ruleset only from `main`.

## Legacy backend note

Older Lovable/Supabase client and middleware sources were removed from the active application architecture. Firebase/Firestore is the single canonical production backend unless a future migration is explicitly designed and verified.
