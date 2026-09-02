# ONI HUB APP CORE V1

Upload these files into `erkaa2323-sudo/oni-kishin-web` preserving folders.

## Replace
- `manifest.webmanifest`
- `sw.js`
- `src/secure-worker.js`
- `wrangler.toml`

## Add
- `offline.html`
- `app/app.css`
- `app/app.js`
- `icons/icon-192.png`
- `icons/icon-512.png`
- `icons/icon-maskable-512.png`
- `icons/apple-touch-icon.png`

## index.html
Add the two `<link>` tags from `INDEX_INTEGRATION_SNIPPET.html` inside `<head>`.
Add `<script src="app/app.js" defer></script>` immediately before `</body>`.

Do not delete existing Firebase, ONI AI, Meet, Market, Garage or Admin code.

## What V1 adds
- Installable PWA metadata
- iPhone safe-area support
- 5-button mobile bottom navigation
- Home quick-action dashboard
- Offline indicator + offline page
- Service-worker update prompt
- Versioned caches and stale-cache cleanup
- Rapid form double-submit guard
- Stronger ONI AI Worker request validation/body-size enforcement
- Safer rate-limit identity (`CF-Connecting-IP`)
- Fixed API-path and method/content-type enforcement

## Important
`src/secure-worker.js` is source code only. Deploy the Worker separately after upload.
Keep `OPENAI_API_KEY` as a Cloudflare runtime secret, never in GitHub.
