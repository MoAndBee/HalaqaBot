# Moving to bosla.to

The selected Mini App address is **https://halaqabot.bosla.to/**.
`bosla.to` is owned and its DNS is already on Cloudflare. Application defaults
now use this hostname; no live DNS or production deployment has been changed.

The bot API can keep its deployed `https://halaqabot.<account>.workers.dev`
address, supplied as `VITE_BOT_API_URL`. A separate API custom domain is optional.
Telegram's `t.me/<bot_username>` address and the Convex URL do not change.

The existing shared staging backend is `Bosla / halaqabotdb / staging`
(`perfect-clam-401`), a non-default deployment. Moving staging hosting to Bosla
keeps that backend, the Telegram bot and the private chats. The old separate
Convex staging project was retired; follow the [agent handoff](agent-environment-handoff.md).

## Configuration that must move together

1. Attach the `halaqabot.bosla.to` hostname to the web host, with HTTPS and SPA
   fallback to `index.html` for routes such as `/halaqas`.
2. Optionally attach an API hostname such as `bot.bosla.to` to the production Worker. Cloudflare's custom-domain
   configuration is a top-level Wrangler setting, for example:

   ```toml
   routes = [{ pattern = "bot.bosla.to", custom_domain = true }]
   ```

   Add this above the first TOML section in `packages/bot/wrangler.toml` only
   when ready for production cutover. Deploying this binds the domain; merely
   editing application URLs does not. Cloudflare manages the domain's DNS and
   certificate for a Workers Custom Domain.
3. Set Worker `WEB_APP_URL=https://halaqabot.bosla.to`. This configures
   newly sent panel links and the API's allowed browser origin.
4. Build the web app with `VITE_BOT_API_URL` set to the deployed Worker origin and the existing
   production `VITE_CONVEX_URL`. Vite embeds these at build time.
5. Run the webhook setup script with explicit `WORKER_URL` set to that Worker origin,
   `WEB_APP_URL=https://halaqabot.bosla.to`, and production bot token/webhook secret supplied
   privately. It sets `/telegram` and the default Telegram menu button.
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
