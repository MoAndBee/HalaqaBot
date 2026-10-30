/**
 * Generates the key pair that lets Convex trust the bot's Worker:
 *
 *   bun scripts/generate-auth-key.ts
 *
 * then set the two values it prints, private key first:
 *   bunx wrangler secret put CONVEX_AUTH_PRIVATE_KEY       (in packages/bot)
 *   bunx convex env set CONVEX_AUTH_JWKS '<data: URI>'      (in packages/db)
 *
 * Rotating: generate a new pair and set both again. Tokens signed with the
 * old key stop working once Convex has the new JWKS (users reopen the app).
 */
import { generateKeyPair } from "../src/convex-auth";

const { privateJwk, jwksDataUri } = await generateKeyPair();
console.log(`CONVEX_AUTH_PRIVATE_KEY (Worker secret):\n${privateJwk}\n`);
console.log(`CONVEX_AUTH_JWKS (Convex environment variable):\n${jwksDataUri}`);
