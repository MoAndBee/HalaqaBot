/**
 * Verifies the `initData` string Telegram hands a Mini App, which is how the web
 * app proves who is calling the bot's API. Telegram signs it with a key derived
 * from the bot token, so only data Telegram issued for this bot passes:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */

export interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

/** How long a Mini App session stays valid after Telegram issued it. */
const MAX_AGE_SECONDS = 24 * 60 * 60;

const encoder = new TextEncoder();

async function hmacSha256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compares two strings without leaking how much of one matched the other. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Returns the user `initData` was issued to, or null if it is forged, for
 * another bot, or expired.
 */
export async function verifyInitData(
  initData: string,
  botToken: string,
  now: number = Date.now(),
): Promise<TelegramWebAppUser | null> {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");

  const secretKey = await hmacSha256(encoder.encode("WebAppData"), botToken);
  const expected = toHex(await hmacSha256(secretKey, dataCheckString));
  if (!timingSafeEqual(expected, hash)) return null;

  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate) || now / 1000 - authDate > MAX_AGE_SECONDS) return null;

  const user = params.get("user");
  if (!user) return null;
  try {
    const parsed = JSON.parse(user) as TelegramWebAppUser;
    return typeof parsed.id === "number" ? parsed : null;
  } catch {
    return null;
  }
}
