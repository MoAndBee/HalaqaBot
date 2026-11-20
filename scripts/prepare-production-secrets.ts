/** Local only: validate the private env and write an allowlisted secrets file. */
import { mkdir, chmod, writeFile, readFile } from "node:fs/promises";
import { productionWorkerSecrets } from "./production-config";

const secrets = await productionWorkerSecrets(process.env);
// Reject accidental reuse of locally available staging credentials/signing keys.
for (const file of [".env.staging.local", ".env.staging.bosla.local"]) {
  const text = await readFile(new URL(`../${file}`, import.meta.url), "utf8").catch(() => "");
  for (const name of ["BOT_TOKEN", "GROQ_API_KEY", "CONVEX_AUTH_PRIVATE_KEY"]) {
    if (secrets[name] && text.includes(secrets[name]!)) throw new Error(`Production ${name} must differ from staging (value omitted)`);
  }
}
const folder = new URL("../.production/", import.meta.url);
await mkdir(folder, { recursive: true, mode: 0o700 });
await chmod(folder, 0o700);
for (const [name, value] of Object.entries({
  "worker-secrets.json": JSON.stringify(secrets),
  "convex-auth-jwks.txt": process.env.PRODUCTION_CONVEX_AUTH_JWKS!,
  "groq-key.txt": process.env.GROQ_API_KEY!,
})) {
  const file = new URL(name, folder);
  await writeFile(file, value, { mode: 0o600 });
  await chmod(file, 0o600);
}
console.log("Validated production targets/signing pair. Wrote 3 private files in .production/; nothing uploaded. Bot identity and real Groq still require provider checks.");
