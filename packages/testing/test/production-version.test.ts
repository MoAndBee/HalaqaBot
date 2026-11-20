import { expect, test } from "bun:test";
import { waitForWorkerRelease } from "../../../scripts/production-version";

test("release verification waits for a stale deployment list to reach the released Worker", async () => {
  let lists = 0;
  let waits = 0;
  const versions = await waitForWorkerRelease(async path => {
    if (path.endsWith("/deployments")) {
      return { deployments: [{ versions: [{ version_id: ++lists === 1 ? "old" : "new", percentage: 100 }] }] };
    }
    return { annotations: { "workers/tag": path.endsWith("/new") ? "released" : "previous" } };
  }, "halaqabot", "released", { wait: async () => { waits++; } });
  expect(versions).toEqual(["new"]);
  expect(lists).toBe(2);
  expect(waits).toBe(1);
});

test("release verification waits for the new version annotation to propagate", async () => {
  let versions = 0;
  const result = await waitForWorkerRelease(async path => {
    if (path.endsWith("/deployments")) return { deployments: [{ versions: [{ version_id: "new", percentage: 100 }] }] };
    return ++versions === 1 ? { annotations: {} } : { annotations: { "workers/tag": "released" } };
  }, "halaqabot", "released", { wait: async () => {} });
  expect(result).toEqual(["new"]);
  expect(versions).toBe(2);
});

test("release verification fails after bounded retries for the wrong commit", async () => {
  let lists = 0;
  let waits = 0;
  await expect(waitForWorkerRelease(async path => {
    if (path.endsWith("/deployments")) {
      lists++;
      return { deployments: [{ versions: [{ version_id: "old", percentage: 100 }] }] };
    }
    return { annotations: { "workers/tag": "previous" } };
  }, "halaqabot", "released", { attempts: 3, wait: async () => { waits++; } }))
    .rejects.toThrow("Active Worker does not match the released commit");
  expect(lists).toBe(3);
  expect(waits).toBe(2);
});

test("release verification rejects a partial rollout even if a version has the right tag", async () => {
  await expect(waitForWorkerRelease(async () => ({
    deployments: [{ versions: [{ version_id: "new", percentage: 50 }, { version_id: "old", percentage: 50 }] }],
  }), "halaqabot", "released", { attempts: 1 })).rejects.toThrow("Expected one fully active production Worker version");
});
