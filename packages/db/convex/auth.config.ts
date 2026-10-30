/**
 * The bot's Worker is the only token issuer: it signs JWTs for itself and, after
 * verifying Telegram's signature on their Mini App initData, for users (see
 * packages/bot/src/convex-auth.ts and auth.ts here).
 *
 * CONVEX_AUTH_JWKS holds the Worker's public key as a data: URI, so Convex
 * never has to reach the Worker. Generate the pair with
 * `bun packages/bot/scripts/generate-auth-key.ts`.
 */
export default {
  providers: [
    {
      type: "customJwt",
      issuer: "https://halaqabot.bot",
      applicationID: "convex",
      algorithm: "ES256",
      jwks: process.env.CONVEX_AUTH_JWKS!,
    },
  ],
};
