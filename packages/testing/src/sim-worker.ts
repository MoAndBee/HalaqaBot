/**
 * The Telegram simulator as a Cloudflare Worker, for preview deployments: a
 * preview of the bot points TELEGRAM_API_ROOT (and GROQ_BASE_URL) here instead
 * of at Telegram, and the dashboard at this Worker's URL drives it.
 *
 * One Durable Object holds the simulated world, saved to its storage after
 * every change so it survives the object being evicted while idle. POST
 * /sim/reset starts a fresh world (the bot's data in Convex is not touched).
 */
import { TelegramSimulator, type SimulatorSnapshot } from "./telegram/simulator";
import { createSimulatorHandler } from "./telegram/server";
import { createWorld } from "./world";

interface DurableObjectState {
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>;
  storage: {
    get<T>(key: string): Promise<T | undefined>;
    put(key: string, value: unknown): Promise<void>;
  };
}

interface Env {
  SIMULATOR: {
    idFromName(name: string): unknown;
    get(id: unknown): { fetch(request: Request): Promise<Response> };
  };
  /** The token the preview bot is configured with (any "<digits>:<text>"). */
  SIM_BOT_TOKEN: string;
  /** Required for /sim/* — anyone with the URL could otherwise drive the bot. */
  SIM_CONTROL_TOKEN: string;
  /** The preview web app, opened by "Open Mini App as this user". */
  SIM_WEB_APP_URL?: string;
}

export class Simulator {
  private sim!: TelegramSimulator;
  private handle!: (request: Request) => Promise<Response>;

  constructor(
    private state: DurableObjectState,
    private env: Env,
  ) {
    void state.blockConcurrencyWhile(async () => {
      this.start(await state.storage.get<SimulatorSnapshot>("world"));
    });
  }

  private start(saved?: SimulatorSnapshot): void {
    const sim = new TelegramSimulator({ botToken: this.env.SIM_BOT_TOKEN });
    if (saved) sim.load(saved);
    else createWorld(sim);
    this.sim = sim;
    this.handle = createSimulatorHandler(sim, {
      controlToken: this.env.SIM_CONTROL_TOKEN,
      webAppUrl: this.env.SIM_WEB_APP_URL,
      awaitDelivery: true,
      reset: () => this.start(),
    }).handle;
  }

  async fetch(request: Request): Promise<Response> {
    const response = await this.handle(request);
    // Reads change nothing; everything else (Bot API calls, world actions) may.
    if (request.method !== "GET") await this.state.storage.put("world", this.sim.snapshot());
    return response;
  }
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    if (!env.SIM_BOT_TOKEN || !env.SIM_CONTROL_TOKEN) {
      return Promise.resolve(new Response("SIM_BOT_TOKEN and SIM_CONTROL_TOKEN must be set", { status: 500 }));
    }
    return env.SIMULATOR.get(env.SIMULATOR.idFromName("world")).fetch(request);
  },
};
