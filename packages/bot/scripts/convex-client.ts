/**
 * A Convex client for maintenance scripts, signed in as the bot: most of what
 * they call is bot-only. Needs CONVEX_AUTH_PRIVATE_KEY, the Worker's secret.
 */
import { ConvexHttpClient } from "@halakabot/db";
import { BOT_SUBJECT, importSigningKey, signToken } from "../src/convex-auth";

export async function botConvexClient(convexUrl: string): Promise<ConvexHttpClient> {
  const privateKey = process.env.CONVEX_AUTH_PRIVATE_KEY;
  if (!privateKey) throw new Error("Missing CONVEX_AUTH_PRIVATE_KEY (the bot Worker's secret)");
  const client = new ConvexHttpClient(convexUrl);
  const { token } = await signToken(await importSigningKey(privateKey), BOT_SUBJECT, 60 * 60);
  client.setAuth(token);
  return client;
}
