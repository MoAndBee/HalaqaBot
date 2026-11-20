import assert from "node:assert/strict";

/** Cloudflare's deployment list and version annotations can lag a successful deploy. */
export async function waitForWorkerRelease(
  read: (path: string) => Promise<any>,
  worker: string,
  commit: string,
  { attempts = 6, wait = () => Bun.sleep(5_000) }: { attempts?: number; wait?: () => Promise<unknown> } = {},
): Promise<string[]> {
  assert(Number.isSafeInteger(attempts) && attempts > 0);
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const deployments = await read(`workers/scripts/${worker}/deployments`);
      const active = deployments.deployments?.[0];
      assert(active?.versions?.length === 1 && active.versions[0].percentage === 100,
        "Expected one fully active production Worker version");
      const version = await read(`workers/scripts/${worker}/versions/${active.versions[0].version_id}`);
      assert.equal(version.annotations?.["workers/tag"], commit, "Active Worker does not match the released commit");
      return active.versions.map((entry: any) => entry.version_id);
    } catch (error) {
      if (attempt === attempts - 1) throw error;
      await wait();
    }
  }
  throw new Error("Production Worker version verification did not complete");
}
