/**
 * How a Worker Preview of the bot and of the simulator find each other: from
 * their own URLs, since Previews of one branch share a name.
 */
import { expect, spyOn, test } from "bun:test";
import { siblingPreviewOrigin } from "../../bot/src/preview";
import { convexPreviewName, deployConvexAndBuildWebApp, previewDeploymentForKey } from "../../bot/scripts/build-preview";

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

test("a cloud preview rejects a shared dev backend before running any build or deployment", async () => {
  const spawn = spyOn(Bun, "spawn").mockImplementation(() => {
    throw new Error("A rejected backend must never start a subprocess");
  });
  try {
    await expect(deployConvexAndBuildWebApp("feature-a", "dev:shared-preview|test"))
      .rejects.toThrow("isolated Convex preview deployment");
    expect(spawn).not.toHaveBeenCalled();
  } finally {
    spawn.mockRestore();
  }
});

test("personal dev keys require the explicit local path, and production keys remain rejected", () => {
  expect(previewDeploymentForKey("dev:personal-preview|test", true))
    .toEqual({ kind: "dev", name: "personal-preview" });
  expect(previewDeploymentForKey("preview:team:project|test")).toEqual({ kind: "preview" });
  expect(() => previewDeploymentForKey("prod:production|test", true)).toThrow("isolated Convex preview deployment");
});

test("branches that normalize alike still receive distinct Convex deployment names", () => {
  const names = ["feature/a", "feature-a", "Feature-A"].map(convexPreviewName);
  expect(new Set(names).size).toBe(3);
  expect(convexPreviewName("feature/a")).toBe(convexPreviewName("feature/a"));
  expect(convexPreviewName("x".repeat(200))).toMatch(/^[a-z0-9-]{1,53}$/);
});
