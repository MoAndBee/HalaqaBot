/**
 * Tokens for Convex. The Worker is Convex's only token issuer (see
 * packages/db/convex/auth.config.ts): it signs one for itself, as subject
 * "bot", and one for each Mini App user after verifying Telegram's signature on
 * their initData, as their Telegram user ID.
 *
 * ES256 JWTs with WebCrypto, so the same code runs in the Worker, Bun and tests.
 */
import type { JsonWebKey } from "@cloudflare/workers-types";

export const TOKEN_ISSUER = "https://halaqabot.bot";
export const TOKEN_AUDIENCE = "convex";
export const BOT_SUBJECT = "bot";

const ALGORITHM = { name: "ECDSA", namedCurve: "P-256" } as const;
const SIGNATURE = { name: "ECDSA", hash: "SHA-256" } as const;

export interface SigningKey {
  key: CryptoKey;
  kid: string;
}

export interface SignedToken {
  token: string;
  /** Seconds since the epoch. */
  expiresAt: number;
}

const encoder = new TextEncoder();

function base64url(bytes: Uint8Array | string): string {
  const data = typeof bytes === "string" ? encoder.encode(bytes) : bytes;
  let binary = "";
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(text: string): Uint8Array {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** The private key as stored in the CONVEX_AUTH_PRIVATE_KEY secret (a JWK with a kid). */
export async function importSigningKey(privateJwk: string): Promise<SigningKey> {
  const jwk = JSON.parse(privateJwk) as JsonWebKey & { kid?: string };
  if (!jwk.kid) throw new Error("CONVEX_AUTH_PRIVATE_KEY has no kid");
  const key = await crypto.subtle.importKey("jwk", jwk, ALGORITHM, false, ["sign"]);
  return { key, kid: jwk.kid };
}

export async function signToken(
  signing: SigningKey,
  subject: string,
  ttlSeconds: number,
  now = Math.floor(Date.now() / 1000),
): Promise<SignedToken> {
  const expiresAt = now + ttlSeconds;
  const header = base64url(JSON.stringify({ alg: "ES256", typ: "JWT", kid: signing.kid }));
  const payload = base64url(
    JSON.stringify({ iss: TOKEN_ISSUER, aud: TOKEN_AUDIENCE, sub: subject, iat: now, exp: expiresAt }),
  );
  const signature = await crypto.subtle.sign(SIGNATURE, signing.key, encoder.encode(`${header}.${payload}`));
  return { token: `${header}.${payload}.${base64url(new Uint8Array(signature))}`, expiresAt };
}

/**
 * A fresh key pair: the private JWK for the Worker's CONVEX_AUTH_PRIVATE_KEY,
 * and the public JWKS as a data: URI for Convex's CONVEX_AUTH_JWKS.
 */
export async function generateKeyPair(): Promise<{ privateJwk: string; publicJwk: string; jwksDataUri: string }> {
  const pair = (await crypto.subtle.generateKey(ALGORITHM, true, ["sign", "verify"])) as CryptoKeyPair;
  const kid = crypto.randomUUID();
  const privateJwk = { ...(await crypto.subtle.exportKey("jwk", pair.privateKey)), kid, alg: "ES256", use: "sig" };
  const { kty, crv, x, y } = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey;
  const publicJwk = { kty, crv, x, y, kid, alg: "ES256", use: "sig" };
  const jwks = JSON.stringify({ keys: [publicJwk] });
  return {
    privateJwk: JSON.stringify(privateJwk),
    publicJwk: JSON.stringify(publicJwk),
    jwksDataUri: `data:text/plain;charset=utf-8;base64,${btoa(jwks)}`,
  };
}

/**
 * Checks a token the way Convex does, for the in-memory Convex emulator.
 * Returns the subject, or null if the token isn't valid.
 */
export async function verifyToken(
  token: string,
  publicJwk: string,
  now = Math.floor(Date.now() / 1000),
): Promise<string | null> {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) return null;
  const key = await crypto.subtle.importKey("jwk", JSON.parse(publicJwk), ALGORITHM, false, ["verify"]);
  const valid = await crypto.subtle.verify(
    SIGNATURE,
    key,
    fromBase64url(signature),
    encoder.encode(`${header}.${payload}`),
  );
  if (!valid) return null;
  const claims = JSON.parse(new TextDecoder().decode(fromBase64url(payload)));
  if (claims.iss !== TOKEN_ISSUER || claims.aud !== TOKEN_AUDIENCE) return null;
  if (typeof claims.exp !== "number" || claims.exp <= now) return null;
  return typeof claims.sub === "string" ? claims.sub : null;
}
