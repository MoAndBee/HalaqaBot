/** Deterministic classifier for real-Telegram staging while no Groq key is available. */
import { createFakeGroq } from "./fake-groq";

export default {
  async fetch(request: Request, env: { STAGING_CLASSIFIER_TOKEN: string }): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/") {
      return Response.json({ mode: "simulated-classification", realLlm: false });
    }
    if (!env.STAGING_CLASSIFIER_TOKEN || request.headers.get("Authorization") !== `Bearer ${env.STAGING_CLASSIFIER_TOKEN}`) {
      return new Response("Unauthorized", { status: 401 });
    }
    if (request.method !== "POST" || url.pathname !== "/openai/v1/chat/completions") {
      return new Response("Not found", { status: 404 });
    }
    // Keep the test helper's call history request-local rather than retaining names.
    return createFakeGroq().handle(request);
  },
};
