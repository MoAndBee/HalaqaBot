# Shared staging in the original Convex project

Completed on 2026-11-08 at Mohanad's request. This is a completed operation;
the colleague taking over Cloudflare/domain setup should reuse its result.

| Resource | Verified state |
| --- | --- |
| Team / project | `bosla / halaqabotdb` |
| Project ID | `1291942` |
| Named staging reference | `staging` (`bosla:halaqabotdb:staging`) |
| Physical staging deployment | `perfect-clam-401`, ID `6845796` |
| Type / default | `prod`, **not** the default production deployment |
| Staging backend | https://perfect-clam-401.convex.cloud |
| Dashboard | https://dashboard.convex.dev/d/perfect-clam-401 |
| Project's default production | `incredible-lyrebird-981`, unchanged |
| Mohanad's default personal dev | `doting-viper-550`, unchanged |
| Other developers' deployments | `wry-crab-519` and `fabulous-badger-100`, unchanged |
| Retired project | `bosla / halaqabot-staging`, ID `3377936`, deleted |
| Empty leftover dev removed with that project | `giant-snail-68` |

## What was done

Convex supports [transferring a deployment between projects in the same team](https://docs.convex.dev/management-api/transfer-deployment).
The existing tested staging deployment was moved into the original project,
given the `staging` reference and marked non-default. A second database was not
created. The physical deployment ID, backend URL, data, document IDs, functions,
environment variables and signing configuration were retained. No application
dependencies were upgraded.

Before transfer, private snapshots were exported for staging and the old
project's leftover dev deployment. The latter had no application tables/data.
A staging-scoped deploy key was saved privately. After the transfer, all **13
application table exports matched byte for byte**, including the existing two
posts, two sessions, active turns, participation history, users and admin cache.

The project's existing production and developer deployment IDs, references,
default flags and last-deploy timestamps were compared before and after. They
did not change. After live tests passed, the retired project was deleted, its
absence verified, and the live tests were rerun successfully.

The Telegram bot remains `@halaqabot_bosla_staging_bot`. The channel/discussion,
webhook, Cloudflare Workers, queues, cron and current Mini App URL remain the
same. No Worker/frontend redeploy or webhook pause was necessary because the
backend URL stayed the same.

## Tests performed against live staging

- Verified named deployment ownership/reference and that it is non-default.
- Used the real staging Worker's `/api/auth/token` with valid signed test login
  data; verified owner access to the existing staging channel and database.
- Opened the deployed Mini App in desktop Chromium and a Pixel 7 Chromium
  viewport; existing halaqa pages and supervisor queries loaded successfully.
- Wrote a temporary note to an existing unlocked turn as its authorized admin,
  observed the update through the live Mini App's Convex subscription, and
  restored the original note. The restored value was verified.
- Verified unsigned API requests return 401, an ordinary/non-admin identity
  cannot read the chat, and its Mini App shows `غير مصرح`.
- Verified mismatched channel/discussion supervisor requests are denied.
- Confirmed the staging webhook URL, zero pending updates and no webhook error.
- Repeated the live app/auth/write-and-restore checks after the retired project
  was deleted. No browser application errors occurred.
- Used the staging-scoped key after deletion for a backend deploy **dry run**;
  the CLI selected `https://perfect-clam-401.convex.cloud`. No backend push was
  performed. The staging env changed only its deploy key; personal dev selection
  stayed unchanged. The target verifier also refused a production deploy-key
  placeholder and production app origin before any deployment command.

These are live deployment checks. The mobile viewport is automated Chromium,
not a new physical Android or iPhone test. Earlier physical Android results
remain recorded separately. Classification still uses the fake staging service.

## Credentials and operations for the colleague

The root `.env.staging.local` on Mohanad's laptop is ignored and mode 600. It now
contains a non-empty deploy key scoped to `perfect-clam-401`. Transfer that key
through the team's secret manager/private secret-input flow, together with the
existing staging bot/signing/classifier credentials. Never print it or commit it,
and never upload the deployment key to Cloudflare Worker secrets or web assets.

Before any backend deployment, from the repository root:

```bash
bun --env-file=.env.staging.local scripts/verify-staging-target.ts
```

For the destination Cloudflare handoff file, substitute
`.env.staging.bosla.local`. The verifier accepts the current personal staging
origin and the proposed `https://halaqabot-staging.bosla.to` origin; it refuses
wrong/empty deploy keys, mismatched Convex URLs and the production app origin.
If the final staging hostname changes, verify that decision before updating its
allowlist.

Do not rely on `CONVEX_DEPLOYMENT=prod:perfect-clam-401` alone or run a bare
`convex deploy`: the project now also contains the application's production
default. Use the staging-scoped key and the explicit staging env file described
in the [full handoff](agent-environment-handoff.md).

Private migration snapshots, metadata and diagnostics are under
`.staging/convex-migration/` on Mohanad's laptop, with restricted directory/file
permissions. They are not in Git or the portable bundle. They contain staging
data and must be shared only through an approved private channel when needed.
Do not restore a snapshot over newer teammate data as part of a hosting move.

The remaining handoff is Cloudflare hosting/domain setup in Bosla's account,
using this existing named staging deployment. Do not recreate the old project,
change the default production deployment, or use a personal dev backend for the
shared bot.
