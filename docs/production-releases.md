# Production releases

Cloudflare Workers Builds deploys production. GitHub Actions no longer deploys
anything; the former `Production release` workflow was removed. Workers Builds
targets Bosla Worker `halaqabot`, `https://halaqabot.bosla.to`, and Convex
production `incredible-lyrebird-981`. Keep the old Coolify bot stopped.

On every push to `main`, the `halaqabot` Worker's production deploy command
runs `bun scripts/cloudflare-production.ts`. It does the following:

1. Runs the full test suite (`bun run test`, about a minute). It uses the local
   Telegram simulator and an in-memory Convex and needs no secrets. A failing
   test stops the release before anything is deployed.
2. Builds DB/bot, builds the Mini App against production Convex and dry-runs
   `packages/bot/wrangler.production.bosla.toml`, using
   `scripts/prepare-production.ts`.
3. Deploys production Convex first, then the Worker with the built assets and
   the production cron. It tags the Worker version with the commit SHA.
4. Checks the live site, without credentials: `/release.json` serves this
   commit, the pages load, and unsigned `/api/auth/token` and `/telegram`
   requests are rejected with 401.

Routine releases leave the following as they are: Worker runtime secrets, the
webhook and menu, the queues, and the Convex environment values.

## Dashboard settings (Workers & Pages → Worker → Settings → Build)

These settings exist only in the dashboard. No file in the repository
configures Workers Builds.

| | `halaqabot` (bot) | `halaqabot-sim` (simulator) |
| --- | --- | --- |
| Git repository | `MoAndBee/HalaqaBot` | `MoAndBee/HalaqaBot` |
| Root directory | `/` (repository root) | `/` (repository root) |
| Production branch | `main` | `main` |
| Build command | `bun install --frozen-lockfile` | `bun install --frozen-lockfile` |
| Deploy command | `bun scripts/cloudflare-production.ts` | `cd packages/testing && npx wrangler deploy` |
| Non-production branch builds | enabled | enabled |
| Non-production branch deploy command | `bun packages/bot/scripts/build-preview.ts` | `cd packages/testing && npx wrangler preview` |

Set these build variables on `halaqabot`:

| Variable | Type | Value |
| --- | --- | --- |
| `CONVEX_DEPLOY_KEY` | secret | Convex **preview** deploy key, for PR previews |
| `PRODUCTION_CONVEX_DEPLOY_KEY` | secret | `prod:incredible-lyrebird-981\|…` deployment-scoped write key |

The production key uses a different variable name from `CONVEX_DEPLOY_KEY`.
Preview builds then cannot push a branch to production Convex by mistake, and
`build-preview.ts` also rejects anything other than a preview key. Build
variables are shared by all branch builds of the Worker. Anyone who can push a
branch to this repository can therefore read the production key from a build.
Only give push access to people you would trust with production.

## What the Wrangler config controls

`wrangler deploy --config wrangler.production.bosla.toml` treats the file as
the source of truth for the Worker. On every release it sets the following
from the file, replacing dashboard edits: name, account, entry point,
compatibility settings, custom domain route, assets, queue bindings and
consumers, cron, and observability. The production config has no `[vars]`,
so plain-text variables added in the dashboard are removed by a release. Keep
runtime values as **secrets**, which are never touched. The deleted workflow
used this same command and config, so the Worker's settings stay as they are.

Workers Builds' own settings (the commands, the branch and the build variables)
are not in any config file. Changing a Wrangler config cannot overwrite them.

To pause production deploys, disable builds for the `halaqabot` Worker in the
dashboard, or temporarily set its deploy command to `echo paused`.

## Failure and phone checks

A failed step stops the build. If Convex deployed and the Worker failed,
inspect compatibility and fix forward. Do not roll back the backend or restore
a data snapshot without checking first. Follow the existing
[recovery procedure](production-cutover.md#5-rollback) when recovery is needed.
Worker versions can be rolled back from the dashboard (Deployments).

After a release that changes admin flows, open a halaqa on an existing
production admin's phone. Use only an agreed test halaqa.
