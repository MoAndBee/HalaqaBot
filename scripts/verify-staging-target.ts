/** Run with the private staging env file before any shared-stage deployment. */
const deployment = "perfect-clam-401";
const convexUrl = `https://${deployment}.convex.cloud`;

if (process.env.CONVEX_DEPLOYMENT !== `prod:${deployment}`) {
  throw new Error("Expected the dedicated staging selector prod:perfect-clam-401");
}
if (!process.env.CONVEX_DEPLOY_KEY?.startsWith(`prod:${deployment}|`)) {
  throw new Error("A deploy key scoped to perfect-clam-401 is required; an empty or different key is refused");
}
if (process.env.CONVEX_URL !== convexUrl || process.env.VITE_CONVEX_URL !== convexUrl) {
  throw new Error("Both the staging Worker and Mini App must target perfect-clam-401");
}
const allowedOrigins = new Set([
  "https://halaqabot-staging.mhndahmd031.workers.dev",
  "https://halaqabot-staging.bosla.to",
]);
const origin = process.env.WEB_APP_URL;
if (!origin || !allowedOrigins.has(origin) || process.env.WORKER_URL !== origin) {
  throw new Error("Expected matching staging WEB_APP_URL and WORKER_URL; verify any new hostname before updating the allowlist");
}

console.log(`Verified bosla/halaqabotdb:staging (${deployment}), backend ${convexUrl}, app ${origin}.`);
