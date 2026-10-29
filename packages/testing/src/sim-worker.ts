/**
 * The Telegram simulator as a Cloudflare Worker, for preview deployments: a
 * preview of the bot points TELEGRAM_API_ROOT (and GROQ_BASE_URL) here instead
 * of at Telegram, and the dashboard at this Worker's URL drives it.
 *
 * One Durable Object holds the simulated world in memory. It's ephemeral: when
 * the object is evicted after a period of inactivity the world starts over, as
 * does POST /sim/reset (the bot's data in Convex is not touched).
 */
import { TelegramSimulator } from "./telegram/simulator";
import { createSimulatorHandler } from "./telegram/server";
import { createWorld } from "./world";

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
  private handle!: (request: Request) => Promise<Response>;

  constructor(_state: unknown, private env: Env) {
    this.start();
  }

  private start(): void {
    const sim = new TelegramSimulator({ botToken: this.env.SIM_BOT_TOKEN });
    createWorld(sim);
    this.handle = createSimulatorHandler(sim, {
      controlToken: this.env.SIM_CONTROL_TOKEN,
      webAppUrl: this.env.SIM_WEB_APP_URL,
      awaitDelivery: true,
      reset: () => this.start(),
    }).handle;
  }

  fetch(request: Request): Promise<Response> {
    return this.handle(request);
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
