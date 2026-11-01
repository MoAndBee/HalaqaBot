/**
 * How a Worker Preview of the bot and of the simulator find each other: from
 * their own URLs, since Previews of one branch share a name.
 */
import { expect, test } from "bun:test";
import { siblingPreviewOrigin } from "../../bot/src/preview";

test("a Preview finds its sibling Worker's Preview of the same branch", () => {
  expect(siblingPreviewOrigin("https://pr-12-halaqabot.acme.workers.dev/telegram", "halaqabot", "halaqabot-sim"))
    .toBe("https://pr-12-halaqabot-sim.acme.workers.dev");
  expect(siblingPreviewOrigin("https://feature-x-halaqabot-sim.acme.workers.dev/sim/state", "halaqabot-sim", "halaqabot"))
    .toBe("https://feature-x-halaqabot.acme.workers.dev");
});

test("production and other hosts never resolve to a sibling", () => {
  // The production Worker: no preview name in front.
  expect(siblingPreviewOrigin("https://halaqabot.acme.workers.dev/", "halaqabot", "halaqabot-sim")).toBeNull();
  // Not this Worker, or not workers.dev.
  expect(siblingPreviewOrigin("https://pr-1-otherbot.acme.workers.dev/", "halaqabot", "halaqabot-sim")).toBeNull();
  expect(siblingPreviewOrigin("https://pr-1-halaqabot.example.com/", "halaqabot", "halaqabot-sim")).toBeNull();
  expect(siblingPreviewOrigin("http://127.0.0.1:8802/telegram", "halaqabot", "halaqabot-sim")).toBeNull();
});
