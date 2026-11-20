/**
 * The Telegram simulator as a Cloudflare Worker, for previews: the bot's
 * Preview points TELEGRAM_API_ROOT (and GROQ_BASE_URL) here instead of at
 * Telegram, and the page at this Worker's URL drives it (see dashboard.ts).
 *
 * In a Worker Preview the simulator connects the bot itself: it finds the bot's
 * Preview of the same branch from its own URL (bot/src/preview.ts) and sets the
 * webhook on first use, as the bot's webhook:set would.
 *
 * One Durable Object holds the simulated world, saved to its storage after
 * every change so it survives the object being evicted while idle. POST
 * /sim/reset starts a fresh world, still connected to the bot. The bot's data
 * in Convex stays, so each new world takes new user and chat IDs.
 */
import { TelegramSimulator, type SimulatorSnapshot } from "./telegram/simulator";
import { createSimulatorHandler } from "./telegram/server";
import { createWorld } from "./world";
import { ALLOWED_UPDATES } from "../../bot/src/allowed-updates";
import { siblingPreviewOrigin } from "../../bot/src/preview";

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
  /** The token the bot is configured with (any "<digits>:<text>"). */
  SIM_BOT_TOKEN: string;
  /** Required for /sim/* — anyone with the URL could otherwise drive the bot. */
  SIM_CONTROL_TOKEN: string;
  /** The bot's TELEGRAM_WEBHOOK_SECRET; with it, the simulator connects the bot itself. */
  SIM_WEBHOOK_SECRET?: string;
  /** The bot's origin. In a Preview it's found from this Worker's own URL instead. */
  SIM_BOT_URL?: string;
  /** Set in Previews: this Worker's name and the bot Worker's. */
  SIM_PREVIEW_WORKER_NAME?: string;
  SIM_BOT_WORKER_NAME?: string;
  /** The web app the Mini App opens; defaults to the bot's origin, which serves it. */
  SIM_WEB_APP_URL?: string;
  /**
   * Shifts this world's user and chat IDs, so previews that share one Convex
   * deployment don't share channels.
   */
  SIM_ID_OFFSET?: string;
}

export class Simulator {
  private sim!: TelegramSimulator;
  private handle!: (request: Request) => Promise<Response>;
  /** How many times the world was reset: each world gets IDs of its own. */
  private generation = 0;
  /** The bot's origin, once known. */
  private botOrigin: string | null = null;

  constructor(
    private state: DurableObjectState,
    private env: Env,
  ) {
    void state.blockConcurrencyWhile(async () => {
      this.generation = (await state.storage.get<number>("generation")) ?? 0;
      this.start(await state.storage.get<SimulatorSnapshot>("world"));
    });
  }

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
    this.buildHandler();
  }

  private buildHandler(): void {
    this.handle = createSimulatorHandler(this.sim, {
      controlToken: this.env.SIM_CONTROL_TOKEN,
      webAppUrl: this.env.SIM_WEB_APP_URL ?? this.botOrigin ?? undefined,
      awaitDelivery: true,
      reset: () => {
        this.generation++;
        void this.state.storage.put("generation", this.generation);
        this.start(undefined, this.sim);
      },
    }).handle;
  }

  /** Finds the bot and, if it isn't connected yet, points the webhook at it. */
  private async connect(requestUrl: string): Promise<void> {
    if (!this.botOrigin) {
      const { SIM_BOT_URL, SIM_PREVIEW_WORKER_NAME, SIM_BOT_WORKER_NAME } = this.env;
      this.botOrigin =
        SIM_BOT_URL ??
        (SIM_PREVIEW_WORKER_NAME
          ? siblingPreviewOrigin(requestUrl, SIM_PREVIEW_WORKER_NAME, SIM_BOT_WORKER_NAME ?? "halaqabot")
          : null);
      if (!this.botOrigin) return;
      this.buildHandler(); // the Mini App link: the bot serves the web app
    }
    if (this.sim.webhook || !this.env.SIM_WEBHOOK_SECRET) return;
    await this.sim.callApi("setWebhook", {
      url: `${this.botOrigin}/telegram`,
      secret_token: this.env.SIM_WEBHOOK_SECRET,
      allowed_updates: [...ALLOWED_UPDATES],
      max_connections: 1,
    });
    // What happened before the bot was connected (its own arrival) goes now.
    await this.sim.whenDelivered();
    await this.state.storage.put("world", this.sim.snapshot());
  }

  async fetch(request: Request): Promise<Response> {
    await this.connect(request.url);
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
