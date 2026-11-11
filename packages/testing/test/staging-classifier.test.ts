import { expect, test } from "bun:test";
import worker from "../src/staging-classifier";

const env = { STAGING_CLASSIFIER_TOKEN: "test-only-classifier-token" };

test("staging classifier identifies itself as simulated", async () => {
  const response = await worker.fetch(new Request("https://classifier.test/"), env);
  expect(await response.json()).toEqual({ mode: "simulated-classification", realLlm: false });
});

test("staging classification rejects unauthenticated requests", async () => {
  const response = await worker.fetch(new Request("https://classifier.test/openai/v1/chat/completions", { method: "POST" }), env);
  expect(response.status).toBe(401);
});

test("staging classification answers the bot's schema without a real LLM", async () => {
  const response = await worker.fetch(new Request("https://classifier.test/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.STAGING_CLASSIFIER_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: '1: "انا فاطمة احمد تسميع"' }],
      response_format: { json_schema: { schema: { contains_name: true } } },
    }),
  }), env);
  const body = await response.json() as { choices: Array<{ message: { content: string } }> };
  expect(JSON.parse(body.choices[0]!.message.content)).toEqual({
    results: [{ message_id: 1, contains_name: true, names: ["فاطمة", "احمد"], activity_type: "تسميع" }],
  });
});
