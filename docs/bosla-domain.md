# Moving to bosla.to

The selected Mini App address is **https://halaqabot.bosla.to/**.
The account-pinned production configuration and local build/secret checks are
prepared. Use the [complete coordinated cutover runbook](production-cutover.md)
and [copyable maintainer-agent prompt](production-maintainer-prompt.md). Preparation
was verified with builds, guard tests and a Wrangler dry run; no live production
resource or DNS change was made.
`bosla.to` is owned and its DNS is already on Cloudflare. Application defaults
now use this production hostname; production DNS/deployment has not been changed.
Staging is already live at **https://halaqabot-staging.bosla.to** in Bosla
Cloudflare, with a verified webhook/menu and a single active scheduler. See the
[completed staging cutover](bosla-staging-cutover.md).

Use the topology already verified on staging: one production Worker serves the
Mini App assets and `/api/*` at `https://halaqabot.bosla.to`, plus the Telegram
webhook at `/telegram`. Build with an empty `VITE_BOT_API_URL` for same-origin
requests. The Telegram bot username and production Convex URL stay unchanged.

## Production inventory and required access (2026-11-11)

Read-only checks found:

- The old Mini App `https://halakabot.app.thawabcoding.work` responds over HTTPS;
  DNS resolves to `213.199.41.153`, and the response reports nginx. This locates
  the web server, not necessarily the live bot process or its hosting dashboard.
- Its public JavaScript embeds the known production Convex URL
  `https://incredible-lyrebird-981.convex.cloud` and a sample URL; confirm the
  actual runtime target with the operator before production deployment.
- Bosla Cloudflare has the staging Workers but no `halaqabot` production Worker
  or Workers Custom Domain at `halaqabot.bosla.to`.
- GitHub has no deployment records/environments or repository Actions secret
  names identifying the host. External auto-deployment remains unknown.
- Mohanad does not know who hosts the current bot. No production bot token,
  real Groq key or server access is available in this checkout.

Ask the current operator:

> Where does the production HalaqaBot process run, and who can stop and restart
> it? The old web app is halakabot.app.thawabcoding.work (213.199.41.153).
> Please provide hosting-dashboard/SSH access or be available for the cutover,
> confirm the production bot username and deployment method, and confirm whether
> merging main automatically deploys anything. Transfer the production bot and
> Groq credentials through the agreed private secret channel.

Keep #165 open until its merge/deployment behavior is understood. Prepare the
production config, scoped credentials, backup and rollback first; coordinate the
live switch with the operator. Bosla DNS access alone cannot stop the old bot.

The existing shared staging backend is `Bosla / halaqabotdb / staging`
(`perfect-clam-401`), a non-default deployment. The completed staging hosting move retained that backend, the Telegram bot and
the private chats. The old separate
Convex staging project was retired; follow the [agent handoff](agent-environment-handoff.md).

## Configuration that must move together

1. Use the prepared `packages/bot/wrangler.production.bosla.toml`, pinned to Bosla account
   `fe626a504678476d9e8c2d942794d30f`, with production queue names,
   bundled web assets and SPA fallback, following the active staging config.
   Bind only the production hostname:

   ```toml
   routes = [{ pattern = "halaqabot.bosla.to", custom_domain = true }]
   ```

   Check the custom-domain changeset before attaching it; do not overwrite an
   unrelated existing DNS record or origin. Cloudflare manages the certificate.
2. Use the existing production deployment `incredible-lyrebird-981`, after
   confirming its identity with the operator. Generate a production signing pair
   separate from staging; deploy its public JWKS with the authenticated Convex
   functions and retain the private key only in production Worker secrets.
3. Set production `WEB_APP_URL=https://halaqabot.bosla.to`, the real production
   bot token and real Groq key. Do not copy staging's fake classifier credentials
   or `GROQ_BASE_URL` into production. Preserve the real production channel and
   forwarding-group IDs supplied by the operator.
4. Build the Mini App with the confirmed production `VITE_CONVEX_URL` and empty
   `VITE_BOT_API_URL`; the production Worker serves both Mini App and API.
5. After the operator has stopped the old bot and the new authenticated backend
   and Worker are ready, run the webhook setup with explicit
   `WORKER_URL=https://halaqabot.bosla.to`, matching `WEB_APP_URL`, and the
   production token/webhook secret supplied privately. It sets `/telegram` and
   the default Telegram menu button. Keep a single active bot and scheduler.
6. Update any separately configured BotFather Main Mini App URL or per-chat
   menu overrides. Already-sent inline buttons still contain the old hostname;
   request a fresh `/admin` message when testing.

Search for the old hostname before cutover:

```bash
rg -n 'halakabot.app.thawabcoding.work' packages docs
```

The two executable defaults (`loadConfig` and `scripts/set-webhook.ts`) and the
older implementation guide now use `https://halaqabot.bosla.to`. Explicit
`WEB_APP_URL` settings override these defaults. Review existing per-channel
`webAppUrl` values as configuration inventory; changing production records is a
separate, explicit data change.

## Release sequence and acceptance

Resolve PR review findings and validate with a staging bot first. Follow the
README's coordinated Convex/Worker/web cutover: this PR's authentication changes
make old clients incompatible with the new database functions.

Keep the old hostname available until new links are verified. The API allows
one browser origin, so an old frontend may no longer work after the origin
switch. Plan its redirect and cache behavior with the chosen frontend host.

Phone tests required: TLS and Telegram menu opening, fresh `/admin` button,
login, channel selection, list sending, registration, and iOS/Safari navigation.
Check webhook pending updates and errors after switching; verify an actual new
Telegram event reaches the correct channel and database.

References: [Workers Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/),
[Telegram webhook API](https://core.telegram.org/bots/api#setwebhook),
[Telegram menu button API](https://core.telegram.org/bots/api#setchatmenubutton).
