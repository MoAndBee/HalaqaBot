/**
 * Runs the app's real Convex functions (packages/db/convex) in memory with
 * convex-test, behind the same HTTP API a Convex deployment exposes to
 * ConvexHttpClient. Lets the bot Worker run against real queries and mutations
 * without a Convex account or network access.
 *
 * Covers the HTTP API only (query, mutation, action) — not the WebSocket sync
 * protocol the web app's live queries use. To run the web app, point it at a
 * real Convex dev deployment instead.
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { ConvexError, convexToJson, jsonToConvex, type JSONValue, type Value } from "convex/values";
import { TOKEN_ISSUER, verifyToken } from "../../bot/src/convex-auth";

export const CONVEX_DIR = path.resolve(import.meta.dir, "../../db/convex");

/** convex-test needs the generated api, which isn't committed. */
export async function ensureConvexCodegen(): Promise<void> {
  if (existsSync(path.join(CONVEX_DIR, "_generated/api.js"))) return;
  const proc = Bun.spawn(["bunx", "convex", "codegen", "--typecheck", "disable"], {
    cwd: path.dirname(CONVEX_DIR),
    env: { ...process.env, CONVEX_DEPLOYMENT: "anonymous:local" },
    stdout: "ignore",
    stderr: "inherit",
  });
  if ((await proc.exited) !== 0) throw new Error("convex codegen failed");
}

async function loadModules(): Promise<Record<string, () => Promise<any>>> {
  const modules: Record<string, () => Promise<any>> = {};
  for await (const file of new Bun.Glob("**/*.{ts,js}").scan(CONVEX_DIR)) {
    if (file.endsWith(".d.ts")) continue;
    const absolute = path.join(CONVEX_DIR, file);
    modules[`/convex/${file}`] = () => import(absolute);
  }
  return modules;
}

/**
 * convex-test hands back a ConvexError's data as JSON text, while a deployment
 * sends the value itself; decode it so clients see what production sends.
 */
function errorData(error: ConvexError<any>): Value {
  let data: Value = error.data;
  // Once per function boundary it crossed: an error from a runQuery inside an
  // action arrives encoded twice.
  for (let first = true; typeof data === "string" && (first || data.startsWith('"')); first = false) {
    try {
      data = JSON.parse(data);
    } catch {
      break;
    }
  }
  return data;
}

/** STATUS_CODE_UDF_FAILED in convex/browser: a function threw. */
const FUNCTION_FAILED = 560;

const ROUTES = { "/api/query": "query", "/api/mutation": "mutation", "/api/action": "action" } as const;

export type ConvexTestInstance = ReturnType<typeof convexTest>;

export interface ConvexEmulator {
  /** Direct access for seeding and asserting on data in tests. */
  t: ConvexTestInstance;
  handle(request: Request): Promise<Response>;
  /** Every function call the emulator served, in order. */
  calls: Array<{ kind: string; path: string; args: unknown; error?: string }>;
  /** Simulates an outage: every call fails with 503 until set back to false. */
  setUnavailable(unavailable: boolean): void;
}

export interface ConvexEmulatorOptions {
  /**
   * Public key (JWK) to check callers' tokens with, as auth.config.ts makes a
   * deployment do. Without it every call is anonymous.
   */
  authPublicKey?: string;
}

export async function createConvexEmulator(options: ConvexEmulatorOptions = {}): Promise<ConvexEmulator> {
  await ensureConvexCodegen();
  const { default: schema } = await import(path.join(CONVEX_DIR, "schema.ts"));
  const modules = await loadModules();
  const t = convexTest(schema, modules);

  /** Like a deployment, only public functions can be called over HTTP. */
  async function isPublic(functionPath: string): Promise<boolean> {
    const [file, name = "default"] = functionPath.split(":");
    const load = modules[`/convex/${file}.ts`] ?? modules[`/convex/${file}.js`];
    const fn = load ? (await load())[name!] : undefined;
    return Boolean(fn?.isPublic);
  }
  const calls: ConvexEmulator["calls"] = [];

  let unavailable = false;

  async function handle(request: Request): Promise<Response> {
    if (unavailable) return new Response("Service Unavailable", { status: 503 });
    const kind = ROUTES[new URL(request.url).pathname as keyof typeof ROUTES];
    if (!kind || request.method !== "POST") {
      return new Response("Not found", { status: 404 });
    }

    const body = (await request.json()) as { path: string; args?: JSONValue[] };
    const args = jsonToConvex(body.args?.[0] ?? {}) as Record<string, Value>;
    const call: ConvexEmulator["calls"][number] = { kind, path: body.path, args };
    calls.push(call);

    if (!(await isPublic(body.path))) {
      call.error = `Could not find public function for '${body.path}'`;
      return new Response(call.error, { status: 404 });
    }

    // Like a deployment: a token that doesn't check out is refused outright,
    // no token means an anonymous call.
    let caller: ConvexTestInstance = t;
    const authorization = request.headers.get("Authorization") ?? "";
    if (authorization.startsWith("Bearer ")) {
      const subject = options.authPublicKey
        ? await verifyToken(authorization.slice("Bearer ".length), options.authPublicKey)
        : null;
      if (!subject) {
        call.error = "InvalidAuthHeader";
        return new Response(JSON.stringify({ code: "InvalidAuthHeader", message: "Could not validate token" }), {
          status: 401,
        });
      }
      caller = t.withIdentity({ subject, issuer: TOKEN_ISSUER, tokenIdentifier: `${TOKEN_ISSUER}|${subject}` });
    }

    try {
      const ref = makeFunctionReference<any>(body.path);
      const value = await (caller[kind] as (ref: any, args: any) => Promise<Value | undefined>)(ref, args);
      return Response.json({ status: "success", value: convexToJson(value ?? null), logLines: [] });
    } catch (error) {
      call.error = error instanceof Error ? error.message : String(error);
      const failure: Record<string, unknown> = { status: "error", errorMessage: call.error, logLines: [] };
      if (error instanceof ConvexError) failure.errorData = convexToJson(errorData(error));
      return Response.json(failure, { status: FUNCTION_FAILED });
    }
  }

  return { t, handle, calls, setUnavailable: (value) => (unavailable = value) };
}
