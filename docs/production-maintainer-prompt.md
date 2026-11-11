# Prompt for the maintainer's agent

Copy the following into the agent that has access to the existing production
host, GitHub, Bosla Cloudflare, Convex and the production Telegram bot credentials.

```text
Prepare and coordinate HalaqaBot's production migration in one maintenance window.
Repository: https://github.com/MoAndBee/HalaqaBot
Release PR: https://github.com/MoAndBee/HalaqaBot/pull/165
Branch: claude/telegram-cloudflare-workers-migration-c09q4a

Fetch the current PR head and read CLAUDE.md, docs/production-cutover.md and
docs/bosla-domain.md before acting. Follow the complete runbook, including rollback.
The prepared config is packages/bot/wrangler.production.bosla.toml. Run
bun scripts/prepare-production.ts for local builds/dry-run/bootstrap config;
use .env.production.example and scripts/prepare-production-secrets.ts to validate
local production credentials without publishing them.

Target: one Worker named halaqabot serving Mini App, API and Telegram webhook at
https://halaqabot.bosla.to in Bosla Cloudflare account
fe626a504678476d9e8c2d942794d30f. Keep the existing production Telegram bot/chats
and Bosla/halaqabotdb production Convex deployment incredible-lyrebird-981,
after independently confirming they are the live resources.

Discover the actual old bot process, start/stop/restart controls, deployed image,
transport, credentials and external auto-deploy hooks yourself using your access.
The old Mini App is halakabot.app.thawabcoding.work (last DNS: 213.199.41.153);
that does not prove the bot runs there. Mohanad does not know its hosting details.
Verify real bot identity and real Groq before touching the running service.
Prepare backups and a rollback build that DOES NOT drop pending Telegram updates.

Show me the concrete targets, tested SHA, old-process stop/restart commands,
backup/rollback and expected interruption; obtain one production go-ahead as
required by CLAUDE.md. Then execute the whole approved window without separate
permission requests for each routine step: pause auto-deploy/restarts, merge #165,
stop old writers/poller, deploy production Convex auth/functions, deploy the
cron-disabled Worker with its secrets and domain, verify reads/security, switch
the real webhook/menu preserving pending updates, complete acceptance, then
enable one production cron. Read back webhook/menu independently. Preserve or
update separate BotFather/per-chat URL settings as needed. Keep old hosting for
rollback and arrange its redirect after acceptance.

PRs #168 and #169 are already merged into #165. CI was explicitly excluded as a
release gate; use the recorded tests and live acceptance. Staging Android/Wi-Fi
passed; real Groq and physical iPhone were not verified by that staging test.
The final runtime candidate 3f287da was deployed and checked on shared staging;
inspect later commits for runtime differences and test any such differences.

DO NOT repoint or redeploy shared staging, its bot/chats or perfect-clam-401,
and do not use staging secrets, fake Groq, simulator data or personal dev in prod.
Never print/commit secrets or overwrite live data from a backup. Preserve queued
work during rollback. Stop only for a real blocker, unexpected production target
or failed acceptance; explain exactly what is needed.

Coordinate one real Android/Wi-Fi check with me on the NEW production domain:
fresh /admin, open the panel, agreed test registration/approval and correct list
reply. Report final source SHA, Worker version, account/domain/backend, bot,
webhook/menu, queue/scheduler health, tests, remaining human settings and rollback
status. Leave production working or execute the prepared rollback; do not leave
two production bots running.
```
