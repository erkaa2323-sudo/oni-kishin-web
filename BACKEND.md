# ONI HUB — backend (Lovable Cloud / Postgres + Auth)

No credentials live in this repository. The frontend uses only the generated
public client at `src/integrations/supabase/client.ts` (publishable key).
Service-role keys are never used in frontend code.

## Layers

- `src/lib/backend/errors.ts` — normalized `ServiceResult` / error codes.
- `src/services/domains.ts` — typed adapters: members, garage, applications,
  meet (+ isolated credentials, registrations), music, AI config.
- `src/services/admin-profiles.ts` — authorization from `user_roles`
  (owner > admin > moderator), fails closed.
- `src/services/audit.ts` — single centralized audit write pathway.
- `src/hooks/useOniAuth.tsx` — session + authorization phases.
- `src/components/oni/OniAdminGate.tsx` — `/admin` guard.

UI components never query the database directly.

## Tables and access

| Table                | Public read                  | Notes                                                |
| -------------------- | ---------------------------- | ---------------------------------------------------- |
| `profiles`           | no                           | own row (staff may read all)                         |
| `user_roles`         | no                           | own rows; only an **owner** may insert/update/delete |
| `members`            | `status = 'active'`          | admins write                                         |
| `garage_vehicles`    | `status = 'published'`       | admins write                                         |
| `music_tracks`       | `status = 'published'`       | admins write                                         |
| `applications`       | **insert only**, no readback | staff read/review                                    |
| `meets`              | `scheduled` / `live` only    | no credentials on this table                         |
| `meet_credentials`   | never                        | admins only; separate table                          |
| `meet_registrations` | no                           | staff read, admins write                             |
| `ai_config`          | no                           | staff read, admins write                             |
| `audit_logs`         | no                           | staff read + append; no update/delete policy         |

RLS is enabled on every table above. Role checks use the security-definer
functions `has_role`, `is_staff`, `is_admin`, so a user cannot self-promote:
role rows are writable only by an owner.

## First owner bootstrap (manual, safe)

1. Create the account: open `/admin` and sign in once with the intended owner
   e-mail/password (or create the user in Cloud → Auth → Users). A `profiles`
   row is created automatically. The user is still **not** authorized.
2. Find the user id in Cloud → Auth → Users.
3. In Cloud → Database (SQL), run once:

   ```sql
   INSERT INTO public.user_roles (user_id, role)
   VALUES ('<paste-user-id>', 'owner');
   ```

4. Reload `/admin` — the session is now authorized as `owner`. That owner can
   grant `admin` / `moderator` rows to other users.

Never hardcode an owner e-mail or id in application code.

## ONI MEET

Public meet access uses three security-definer functions; no public path can
touch `meet_credentials`:

- `meet_public_active()` — current scheduled/live meet + participant count.
- `meet_participants(meet_id)` — public nicknames only (never CPM ID).
- `meet_register(meet_id, nickname, cpm_id)` — enforces registration
  deadline, capacity and duplicate CPM ID **in the database**. Direct
  anonymous INSERT into `meet_registrations` stays blocked by RLS.

Admin Meet Control manages schedule, registration close time, capacity,
lifecycle (live / closed / ended), masked credentials and registration
removal. Credential values are never written to `audit_logs`.

**Remaining identity requirement:** ROOM ID / PASSWORD are still not released
to participants. A CPM nickname + ID pair does not prove identity, so reveal
stays closed until members have real authenticated accounts linked to
`members`. The CPM launch CTA uses a configurable official store URL
(`CPM_LAUNCH_URL`); no unofficial deep-link scheme is used and no credential
is ever placed in a URL.

## Not yet implemented (next phase)

- Real content migration / seeding.
- Verified-participant credential reveal (needs member auth identity).
- ONI Brain AI engine (offline; it refuses credential requests outright).
