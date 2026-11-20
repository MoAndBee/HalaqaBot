/**
 * Worker Previews: Cloudflare builds a Preview of each Worker for every pull
 * request (see scripts/build-preview.ts and packages/testing/wrangler.toml).
 * The bot's Preview talks to the Telegram simulator's Preview instead of
 * Telegram, and the two find each other from their own URLs: Previews of the
 * same branch share a name, so
 *
 *   https://<preview>-halaqabot.<account>.workers.dev
 *   https://<preview>-halaqabot-sim.<account>.workers.dev
 */

/**
 * The URL origin of a sibling Worker's Preview of the same branch, or null if
 * `url` isn't a Preview URL of `ownWorker` (so production never derives one).
 */
export function siblingPreviewOrigin(url: string, ownWorker: string, siblingWorker: string): string | null {
  const { protocol, hostname } = new URL(url);
  const [first = "", ...rest] = hostname.split(".");
  const suffix = `-${ownWorker}`;
  if (!first.endsWith(suffix) || first.length === suffix.length || rest.slice(-2).join(".") !== "workers.dev") {
    return null;
  }
  return `${protocol}//${first.slice(0, -ownWorker.length)}${siblingWorker}.${rest.join(".")}`;
}
