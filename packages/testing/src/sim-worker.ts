/**
 * The Telegram simulator as a Cloudflare Worker, for preview deployments: a
 * preview of the bot points TELEGRAM_API_ROOT (and GROQ_BASE_URL) here instead
 * of at Telegram, and the dashboard at this Worker's URL drives it.
 *
 * One Durable Object holds the simulated world, saved to its storage after
 * every change so it survives the object being evicted while idle. POST
 * /sim/reset starts a fresh world, still connected to the bot. The bot's data
 * in Convex stays, so each new world takes new user and chat IDs.
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
  /**
   * Shifts this world's user and chat IDs, so previews that share one Convex
   * deployment don't share channels (e.g. the PR number times a million).
   */
  SIM_ID_OFFSET?: string;
}

export class Simulator {
  private sim!: TelegramSimulator;
  private handle!: (request: Request) => Promise<Response>;

  constructor(
    private state: DurableObjectState,
    private env: Env,
  ) {
    void state.blockConcurrencyWhile(async () => {
      this.generation = (await state.storage.get<number>("generation")) ?? 0;
      this.start(await state.storage.get<SimulatorSnapshot>("world"));
    });
  }

  /** How many times the world was reset: each world gets IDs of its own. */
  private generation = 0;

  private start(saved?: SimulatorSnapshot, previous?: TelegramSimulator): void {
    const offset = Number(this.env.SIM_ID_OFFSET ?? 0) + this.generation * 1000;
    const sim = new TelegramSimulator({
      botToken: this.env.SIM_BOT_TOKEN,
      firstUserId: 100001 + offset,
      firstChatId: -1001000000001 - offset,
    });
    if (saved) sim.load(saved);
    else {
      const { channelId } = createWorld(sim);
      // A reset world stays connected to the bot.
      if (previous) {
        sim.webhook = previous.webhook;
        sim.menuButton = previous.menuButton;
      }
      // As if someone had just added the bot to the channel: it registers the
      // channel and its admins as soon as it can hear about it.
      sim.announceBot(channelId);
    }
    this.sim = sim;
    this.handle = createSimulatorHandler(sim, {
      controlToken: this.env.SIM_CONTROL_TOKEN,
      webAppUrl: this.env.SIM_WEB_APP_URL,
      awaitDelivery: true,
      reset: () => {
        this.generation++;
        void this.state.storage.put("generation", this.generation);
        this.start(undefined, this.sim);
      },
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
