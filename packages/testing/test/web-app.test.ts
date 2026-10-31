/**
 * The real web app in a browser, signed in through simulated Telegram, against
 * a real Convex deployment — the full chain an admin uses.
 *
 * Needs a Convex dev deployment with this branch's functions (the web app's live
 * queries use Convex's WebSocket protocol, which the emulator doesn't speak):
 *
 *   CONVEX_DEPLOY_KEY=<dev key> bunx convex dev --once     (in packages/db)
 *   TEST_CONVEX_URL=https://<deployment>.convex.cloud \
 *   TEST_CONVEX_AUTH_PRIVATE_KEY=<key matching its CONVEX_AUTH_JWKS> bun run test:web
 *
 * Skipped without TEST_CONVEX_URL.
 */
import { afterAll, beforeAll, expect, test } from "bun:test";
import path from "node:path";
import { chromium, devices, type Browser, type Page } from "playwright";
import { api } from "@halakabot/db";
import { startStack, type Stack } from "../src/harness";
import { REGISTRATION_POST } from "./helpers";

const convexUrl = process.env.TEST_CONVEX_URL;
const WEB_DIR = path.resolve(import.meta.dir, "../../web");

let stack: Stack;
let vite: ReturnType<typeof Bun.spawn> | undefined;
let browser: Browser;
let webAppUrl: string;

beforeAll(async () => {
  if (!convexUrl) return;
  const port = 3000 + Math.floor(Math.random() * 1000);
  webAppUrl = `http://localhost:${port}`;
  stack = await startStack({ convexUrl, webAppUrl });

  vite = Bun.spawn(["bunx", "vite", "dev", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: WEB_DIR,
    env: { ...process.env, VITE_CONVEX_URL: convexUrl, VITE_BOT_API_URL: stack.workerUrl },
    stdout: "pipe",
    stderr: "pipe",
  });
  await stack.waitFor(() => fetch(`http://127.0.0.1:${port}/`).then((r) => r.ok), {
    message: "the web app's dev server",
    timeoutMs: 60_000,
  });

  // Telegram's Mini App script and Convex are on the internet; use the proxy if there is one.
  const proxy = process.env.HTTPS_PROXY;
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    ...(proxy ? { proxy: { server: proxy, bypass: "localhost,127.0.0.1" } } : {}),
  });
}, 180_000);

afterAll(async () => {
  await browser?.close();
  vite?.kill();
  await stack?.stop();
});

/** Opens the Mini App as `userId`, the way Telegram does: signed initData in the URL hash. */
async function openMiniApp(userId: number, route = "/"): Promise<Page> {
  const initData = await stack.sim.miniAppInitData(userId);
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 420, height: 860 } });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  (page as any).errors = errors;
  await page.goto(`${webAppUrl}${route}#tgWebAppData=${encodeURIComponent(initData)}&tgWebAppVersion=8.0&tgWebAppPlatform=web`);
  return page;
}

test.skipIf(!convexUrl)("an admin sends the participant list from the web app", async () => {
  const { sim, world } = stack;
  const { groupMessage } = sim.postToChannel(world.channelId, REGISTRATION_POST);
  const postId = groupMessage!.message_id;
  const [fatima, mona] = world.students;
  for (const [student, text] of [[fatima!, "انا فاطمة احمد تسميع"], [mona!, "منى علي حسن تلاوة"]] as const) {
    const comment = sim.sendUserMessage(world.groupId, student.id, text, { replyTo: postId });
    sim.react(world.groupId, comment.message_id, world.admin.id, ["👌"]);
  }
  await stack.waitFor(async () => {
    const list = await stack.query(api.queries.getUserList, { chatId: world.groupId, postId });
    return list.activeUsers.length === 2;
  }, { message: "both students to be added", timeoutMs: 30_000 });

  const page = await openMiniApp(world.admin.id, `/posts/${world.groupId}/${postId}`);
  await page.getByText("فاطمة احمد").waitFor({ timeout: 30_000 });
  await expect(page.getByText("منى علي حسن").count()).resolves.toBeGreaterThan(0);

  await page.locator("button:has(svg.lucide-more-vertical), button:has(svg.lucide-ellipsis-vertical)").first().click();
  await page.getByText("إرسال قائمة الأسماء").first().click();
  await page.getByText("تم إرسال قائمة الأسماء!").waitFor({ timeout: 30_000 });

  const lists = sim.history(world.groupId).filter((m) => m.from?.id === sim.bot.id && m.text);
  expect(lists).toHaveLength(1);
  expect(lists[0]!.reply_to_message?.message_id).toBe(postId);
  expect(lists[0]!.text).toContain("١. فاطمة احمد (تسميع)");
  expect(lists[0]!.text).toContain("٢. منى علي حسن (تلاوة)");
  expect((page as any).errors).toEqual([]);
});

test.skipIf(!convexUrl)("a student who opens the web app is turned away", async () => {
  const student = stack.world.students[0]!;
  const page = await openMiniApp(student.id);
  // The unauthorized screen, showing who Telegram says they are.
  await page.getByText("غير مصرح").waitFor({ timeout: 30_000 });
  await expect(page.getByText(`معرف: ${student.id}`).count()).resolves.toBe(1);
  await expect(page.getByText("الحلقات").count()).resolves.toBe(0);
});

test.skipIf(!convexUrl)("on a phone, the simulator floats over the Mini App and switches who's signed in", async () => {
  const context = await browser.newContext({ ...devices["iPhone 13"], ignoreHTTPSErrors: true });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(stack.simulatorUrl);

  // First visit: the sheet is open, acting as an admin, with the Mini App behind it.
  await page.locator("#whoName", { hasText: "admin" }).waitFor({ timeout: 30_000 });
  await page.tap("#close");
  const app = page.frameLocator("#app");
  await app.getByText("الحلقات").first().waitFor({ timeout: 30_000 });

  // The bubble can be dragged, and snaps to the nearer side.
  const before = (await page.locator("#bubble").boundingBox())!;
  await page.mouse.move(before.x + 28, before.y + 28);
  await page.mouse.down();
  await page.mouse.move(40, 300, { steps: 8 });
  await page.mouse.up();
  expect((await page.locator("#bubble").boundingBox())!.x).toBeLessThan(30);

  // Act as a student: the Mini App reopens as her and turns her away.
  await page.tap("#bubble");
  await page.tap('[data-tab="people"]');
  await page.locator("[data-act]", { hasText: stack.world.students[1]!.first_name }).tap();
  await page.tap("#close");
  await app.getByText("غير مصرح").waitFor({ timeout: 30_000 });
  expect(errors).toEqual([]);
  await context.close();
});
