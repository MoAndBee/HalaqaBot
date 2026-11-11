/**
 * Signs Mini App initData the way Telegram does, so the simulator can open the
 * web app (or call the bot's API) as any simulated user.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */

const encoder = new TextEncoder();

async function hmacSha256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
}

const toHex = (buffer: ArrayBuffer) =>
  [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");

export async function signInitData(
  botToken: string,
  user: { id: number; first_name: string; last_name?: string; username?: string },
  authDate: number = Math.floor(Date.now() / 1000),
): Promise<string> {
  const params = new URLSearchParams({
    query_id: `SIM${user.id}${authDate}`,
    user: JSON.stringify(user),
    auth_date: String(authDate),
  });
  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
  const secretKey = await hmacSha256(encoder.encode("WebAppData"), botToken);
  params.set("hash", toHex(await hmacSha256(secretKey, dataCheckString)));
  return params.toString();
}
