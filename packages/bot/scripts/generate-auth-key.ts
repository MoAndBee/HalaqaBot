/**
 * Generates the key pair that lets Convex trust the bot's Worker:
 *
 *   bun scripts/generate-auth-key.ts
 *
 * then set the two values it prints:
 *   bunx convex env set CONVEX_AUTH_JWKS '<data: URI>'      (in packages/db)
 *   bunx wrangler secret put CONVEX_AUTH_PRIVATE_KEY       (in packages/bot)
 * Convex picks up the JWKS at once; no deploy needed.
 *
 * Rotating without downtime: pass the current CONVEX_AUTH_JWKS,
 *
 *   bun scripts/generate-auth-key.ts '<current data: URI>'
 *
 * which prints a JWKS holding both keys. Set it on Convex first, then the new
 * private key on the Worker. Once the old tokens have expired (an hour), set
 * CONVEX_AUTH_JWKS to the new key alone (the second JWKS printed).
 */
import { generateKeyPair } from "../src/convex-auth";

function decode(dataUri: string): { keys: unknown[] } {
  const base64 = dataUri.slice(dataUri.indexOf("base64,") + "base64,".length);
  return JSON.parse(atob(base64));
}
const encode = (jwks: { keys: unknown[] }) =>
  `data:text/plain;charset=utf-8;base64,${btoa(JSON.stringify(jwks))}`;

const { privateJwk, jwksDataUri } = await generateKeyPair();
const current = process.argv[2];

console.log(`CONVEX_AUTH_PRIVATE_KEY (Worker secret):\n${privateJwk}\n`);
if (current) {
  const both = { keys: [...decode(current).keys, ...decode(jwksDataUri).keys] };
  console.log(`CONVEX_AUTH_JWKS while rotating (old and new keys), set this first:\n${encode(both)}\n`);
  console.log(`CONVEX_AUTH_JWKS once the old tokens have expired (new key only):\n${jwksDataUri}`);
} else {
  console.log(`CONVEX_AUTH_JWKS (Convex environment variable):\n${jwksDataUri}`);
}
