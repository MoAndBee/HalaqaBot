/**
 * The simulator's UI, mobile first. The Mini App fills the screen, as it does
 * inside Telegram, and the simulator floats over it: a bubble you can drag to
 * either side, which opens a sheet with everything else. In the sheet:
 *   - act as any simulated user (the Mini App reopens as them);
 *   - read the chats, post, comment, reply and react;
 *   - one-tap set-ups (registration post, sign-ups, approving them);
 *   - see what the bot was sent and what it did.
 * On a wide screen the Mini App sits in a phone-width column and the sheet
 * becomes a side panel. Talks to the /sim control API.
 *
 * A link may carry the control token as `#token=...` (previews post one on the
 * PR); it's kept in localStorage and dropped from the address bar.
 */
export function renderDashboard(options: { needsToken: boolean; hasMiniApp: boolean; canReset: boolean }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#17212b">
<title>Telegram Simulator</title>
<style>
  :root { --bg:#f1f1f4; --panel:#fff; --line:#e4e4e7; --text:#18181b; --muted:#71717a; --accent:#2aabee; --accent-ink:#fff; --bot:#e8f4fd; --ok:#16a34a; --bad:#dc2626; --shade:rgba(0,0,0,.35); }
  @media (prefers-color-scheme: dark) { :root { --bg:#0e1621; --panel:#17212b; --line:#2b3947; --text:#f4f4f5; --muted:#8b9aa8; --bot:#1f3347; --shade:rgba(0,0,0,.55); } }
  * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  [hidden] { display:none !important; }
  html, body { margin:0; height:100%; overflow:hidden; background:var(--bg); color:var(--text); font:15px/1.4 system-ui, -apple-system, sans-serif; }
  button, textarea, input { font:inherit; color:inherit; }
  button { cursor:pointer; border:0; background:none; }

  /* The Mini App, full screen like in Telegram; a phone-width column on wide screens. */
  #app { position:fixed; inset:0; width:100%; height:100%; border:0; background:#fff; }
  #noApp { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; text-align:center; padding:32px; color:var(--muted); }
  @media (min-width: 900px) {
    #app { left:calc(50% - 440px / 2 - 220px); width:440px; top:24px; height:calc(100% - 48px); border-radius:24px; box-shadow:0 10px 40px rgba(0,0,0,.18); }
  }

  /* The floating bubble. */
  #bubble { position:fixed; z-index:20; width:56px; height:56px; border-radius:50%; background:var(--accent); color:var(--accent-ink);
    box-shadow:0 6px 20px rgba(0,0,0,.25); display:flex; align-items:center; justify-content:center; font-size:26px;
    touch-action:none; user-select:none; transition:left .2s, top .2s, transform .15s; }
  #bubble.dragging { transition:none; transform:scale(1.08); }
  body.open #bubble { display:none; }
  #bubble .badge { position:absolute; top:-2px; right:-2px; min-width:20px; height:20px; padding:0 5px; border-radius:10px; background:var(--bad); color:#fff; font-size:12px; font-weight:600; display:flex; align-items:center; justify-content:center; }
  #bubble .dot { position:absolute; bottom:3px; right:3px; width:12px; height:12px; border-radius:50%; border:2px solid var(--accent); background:var(--ok); }
  #bubble .dot.off { background:var(--bad); }

  /* The sheet: from the bottom on a phone, a side panel on a wide screen. */
  #shade { position:fixed; inset:0; z-index:30; background:var(--shade); opacity:0; pointer-events:none; transition:opacity .2s; }
  #sheet { position:fixed; z-index:31; left:0; right:0; bottom:0; height:min(88dvh, 860px); background:var(--panel);
    border-radius:18px 18px 0 0; box-shadow:0 -8px 30px rgba(0,0,0,.2); display:flex; flex-direction:column;
    transform:translateY(105%); transition:transform .25s ease; padding-bottom:env(safe-area-inset-bottom); }
  body.open #sheet { transform:none; }
  body.open #shade { opacity:1; pointer-events:auto; }
  @media (min-width: 900px) {
    #sheet { left:auto; top:0; height:100%; width:440px; border-radius:0; transform:translateX(105%); }
    #shade { display:none; }
  }
  .grip { width:40px; height:5px; border-radius:3px; background:var(--line); margin:8px auto 2px; }
  @media (min-width: 900px) { .grip { display:none; } }
  .head { display:flex; align-items:center; gap:8px; padding:6px 12px 8px; }
  .who { flex:1; min-width:0; text-align:left; padding:8px 12px; border-radius:12px; background:var(--bg); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .who small { color:var(--muted); display:block; font-size:12px; }
  .icon { width:40px; height:40px; border-radius:50%; font-size:18px; }
  .icon:active { background:var(--bg); }
  .tabs { display:flex; border-bottom:1px solid var(--line); }
  .tabs button { flex:1; padding:10px 4px; color:var(--muted); border-bottom:2px solid transparent; }
  .tabs button.on { color:var(--accent); border-bottom-color:var(--accent); font-weight:600; }
  .tab { flex:1; min-height:0; display:flex; flex-direction:column; }
  .tab[hidden] { display:none; }

  .row { display:flex; gap:6px; overflow-x:auto; padding:8px 12px; scrollbar-width:none; flex-shrink:0; }
  .row::-webkit-scrollbar { display:none; }
  .chip { flex-shrink:0; padding:7px 12px; border-radius:999px; background:var(--bg); white-space:nowrap; font-size:14px; }
  .chip.on { background:var(--accent); color:var(--accent-ink); }
  .chip.action { border:1px solid var(--line); background:var(--panel); }
  .chip:disabled { opacity:.5; }

  .messages { flex:1; min-height:0; overflow-y:auto; padding:8px 12px; display:flex; flex-direction:column; gap:6px; background:var(--bg); }
  .msg { align-self:flex-start; max-width:88%; background:var(--panel); border-radius:14px; padding:7px 10px; box-shadow:0 1px 1px rgba(0,0,0,.06); }
  .msg.bot { background:var(--bot); }
  .msg.me { align-self:flex-end; }
  .msg.sel { outline:2px solid var(--accent); }
  .from { font-size:13px; font-weight:600; color:var(--accent); }
  .quote { font-size:13px; color:var(--muted); border-left:2px solid var(--accent); padding-left:6px; margin:3px 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .body { white-space:pre-wrap; word-wrap:break-word; }
  .meta { display:flex; flex-wrap:wrap; gap:4px; margin-top:4px; align-items:center; }
  .react { font-size:12px; padding:1px 7px; border-radius:999px; background:var(--bg); }
  .webapp { font-size:13px; padding:5px 10px; border-radius:8px; background:var(--accent); color:var(--accent-ink); }
  .acts { display:flex; gap:4px; margin-top:6px; }
  .acts button { padding:6px 10px; border-radius:8px; background:var(--bg); font-size:14px; }
  .empty { margin:auto; color:var(--muted); text-align:center; padding:24px; }

  .replying { display:flex; align-items:center; gap:8px; padding:6px 12px; font-size:13px; color:var(--muted); border-top:1px solid var(--line); }
  .replying span { flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .composer { display:flex; gap:8px; padding:8px 12px; border-top:1px solid var(--line); align-items:flex-end; }
  .composer textarea { flex:1; resize:none; max-height:120px; padding:9px 12px; border-radius:18px; border:1px solid var(--line); background:var(--bg); }
  .send { width:40px; height:40px; border-radius:50%; background:var(--accent); color:var(--accent-ink); font-size:18px; flex-shrink:0; }

  .list { flex:1; overflow-y:auto; }
  .person { display:flex; align-items:center; gap:10px; padding:10px 14px; border-bottom:1px solid var(--line); }
  .person.on { background:var(--bg); }
  .avatar { width:38px; height:38px; border-radius:50%; background:var(--accent); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:600; flex-shrink:0; }
  .person .name { flex:1; min-width:0; text-align:left; }
  .person .name small { display:block; color:var(--muted); font-size:12px; }
  .small { padding:6px 10px; border-radius:8px; border:1px solid var(--line); font-size:13px; flex-shrink:0; }
  .addrow { display:flex; gap:8px; padding:10px 14px; }
  .addrow input { flex:1; padding:8px 12px; border-radius:10px; border:1px solid var(--line); background:var(--bg); }

  .log { flex:1; overflow-y:auto; padding:6px 14px; font:12px/1.5 ui-monospace, monospace; }
  .log h3 { font:600 11px system-ui; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); margin:12px 0 4px; }
  .log div { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .ok { color:var(--ok); } .fail { color:var(--bad); }

  #toast { position:fixed; z-index:40; left:50%; bottom:calc(24px + env(safe-area-inset-bottom)); transform:translateX(-50%); max-width:calc(100% - 32px);
    background:#17212b; color:#fff; padding:9px 14px; border-radius:12px; font-size:14px; display:none; }
</style>
</head>
<body>
${options.hasMiniApp
  ? '<iframe id="app" title="Mini App" allow="clipboard-write"></iframe>'
  : '<div id="noApp"><p>No Mini App is configured for this simulator.<br>Tap the bubble to drive the bot.</p></div>'}

<button id="bubble" aria-label="Simulator">🤖<span class="dot off" id="conn"></span><span class="badge" id="badge" hidden></span></button>
<div id="shade"></div>

<section id="sheet" aria-label="Telegram simulator">
  <div class="grip"></div>
  <div class="head">
    <button class="who" id="who"><small>Acting as</small><b id="whoName">…</b></button>
    <button class="icon" id="close" aria-label="Close">✕</button>
  </div>
  <nav class="tabs">
    <button data-tab="chat" class="on">Chats</button>
    <button data-tab="people">People</button>
    <button data-tab="activity">Bot activity</button>
  </nav>

  <div class="tab" id="tab-chat">
    <div class="row" id="chatPicker"></div>
    <div class="row" id="setups"></div>
    <div class="messages" id="messages"></div>
    <div class="replying" id="replying" hidden><span id="replyText"></span><button class="icon" id="cancelReply" aria-label="Cancel reply">✕</button></div>
    <form class="composer" id="composer">
      <textarea id="text" rows="1" dir="auto" placeholder="Message"></textarea>
      <button class="send" aria-label="Send">➤</button>
    </form>
  </div>

  <div class="tab" id="tab-people" hidden>
    <div class="list" id="people"></div>
    <form class="addrow" id="addUser"><input id="newName" placeholder="New user's first name" dir="auto"><button class="small">Add</button></form>
    ${options.canReset ? '<div class="addrow"><button class="small" id="reset" style="flex:1">Reset the simulated world</button></div>' : ""}
  </div>

  <div class="tab" id="tab-activity" hidden>
    <div class="log" id="log"></div>
  </div>
</section>
<div id="toast"></div>

<script>
const NEEDS_TOKEN = ${options.needsToken};
const HAS_MINI_APP = ${options.hasMiniApp};
const REGISTRATION_POST = "حللتم أهلا ونزلتم سهلا 🌸\\nسجلي اسمك للحلقة";
const SIGN_UPS = ["انا فاطمة احمد تسميع", "انا منى علي تلاوة", "انا خديجة محمود تسميع"];

const store = {
  get(key) { try { return JSON.parse(localStorage.getItem("sim." + key)); } catch { return null; } },
  set(key, value) { try { localStorage.setItem("sim." + key, JSON.stringify(value)); } catch {} },
};
let token = "";
if (NEEDS_TOKEN) {
  const fromLink = new URLSearchParams(location.hash.slice(1)).get("token");
  token = fromLink || store.get("token") || prompt("Simulator control token") || "";
  store.set("token", token);
  if (fromLink) history.replaceState(null, "", location.pathname);
}

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" })[c]);
let state = null, chat = null, replyTo = null, selected = null, tab = "chat";
let actorId = store.get("actor"), chatId = store.get("chat"), appFor = null;
let seenMessages = store.get("seen") ?? 0;

async function sim(path, body) {
  const res = await fetch("/sim/" + path, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}
function toast(text) { const t = $("toast"); t.textContent = text; t.style.display = "block"; clearTimeout(toast.timer); toast.timer = setTimeout(() => t.style.display = "none", 2800); }
const act = (fn) => async (...args) => { try { await fn(...args); await refresh(); } catch (e) { toast(e.message); } };

const user = (id) => state.users.find((u) => u.id === id);
const nameOf = (u) => u ? [u.first_name, u.last_name].filter(Boolean).join(" ") : "";
const channel = () => state.chats.find((c) => c.type === "channel");
const roleIn = (c, id) => (c && c.members[id]) || "left";
const isAdmin = (role) => role === "administrator" || role === "creator";
const roleLabel = (id) => ({ creator: "owner", administrator: "admin" })[roleIn(channel(), id)] || "student";
const totalMessages = () => state.chats.reduce((n, c) => n + c.messageCount, 0);

// ------------------------------------------------------------ the bubble
const bubble = $("bubble");
function placeBubble(pos) {
  const size = 56, margin = 12;
  const x = pos.side === "left" ? margin : innerWidth - size - margin;
  const y = Math.min(Math.max(pos.y, margin + 40), innerHeight - size - margin - 40);
  bubble.style.left = x + "px"; bubble.style.top = y + "px";
}
let bubblePos = store.get("bubble") || { side: "right", y: innerHeight - 160 };
placeBubble(bubblePos);
addEventListener("resize", () => placeBubble(bubblePos));
// A tap opens the sheet; the click that ends a drag doesn't.
let dragged = false;
bubble.addEventListener("click", () => { if (!dragged) toggleSheet(); dragged = false; });
bubble.addEventListener("pointerdown", (down) => {
  bubble.setPointerCapture(down.pointerId);
  const start = { x: down.clientX, y: down.clientY, left: bubble.offsetLeft, top: bubble.offsetTop };
  dragged = false;
  const move = (e) => {
    if (!dragged && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 8) return;
    dragged = true; bubble.classList.add("dragging");
    bubble.style.left = start.left + e.clientX - start.x + "px";
    bubble.style.top = start.top + e.clientY - start.y + "px";
  };
  const up = (e) => {
    bubble.removeEventListener("pointermove", move); bubble.removeEventListener("pointerup", up);
    bubble.classList.remove("dragging");
    if (!dragged) return;
    // Snap to the nearer side, keep the height.
    bubblePos = { side: e.clientX < innerWidth / 2 ? "left" : "right", y: bubble.offsetTop };
    store.set("bubble", bubblePos); placeBubble(bubblePos);
  };
  bubble.addEventListener("pointermove", move); bubble.addEventListener("pointerup", up);
});

// ------------------------------------------------------------ the sheet
function toggleSheet(open = !document.body.classList.contains("open")) {
  document.body.classList.toggle("open", open);
  if (open) { refresh(); } else if (state) { seenMessages = totalMessages(); store.set("seen", seenMessages); renderBadge(); }
}
$("close").onclick = () => toggleSheet(false);
$("shade").onclick = () => toggleSheet(false);
$("who").onclick = () => showTab("people");
for (const b of document.querySelectorAll("[data-tab]")) b.onclick = () => showTab(b.dataset.tab);
function showTab(name) {
  tab = name;
  for (const b of document.querySelectorAll("[data-tab]")) b.classList.toggle("on", b.dataset.tab === name);
  for (const t of ["chat", "people", "activity"]) $("tab-" + t).hidden = t !== name;
  refresh();
}

// ------------------------------------------------------------ acting as someone
// The Mini App opens as whoever you act as, signed by the simulated Telegram.
async function openMiniApp(force) {
  if (!HAS_MINI_APP || (!force && appFor === actorId)) return;
  appFor = actorId;
  const { url } = await sim("mini-app", { userId: actorId });
  // A new query string, so the browser really reloads: a change of hash alone
  // wouldn't, and the app reads who's signed in only when it loads.
  const [page, hash] = url.split("#");
  $("app").src = page + (page.includes("?") ? "&" : "?") + "sim_open=" + Date.now() + "#" + hash;
}
async function actAs(id) {
  actorId = id; store.set("actor", id);
  await openMiniApp(false);
  toast("Acting as " + nameOf(user(id)) + " (" + roleLabel(id) + ")" + (HAS_MINI_APP ? " · Mini App reopened" : ""));
}

// ------------------------------------------------------------ set-ups
async function latestPost(groupId) {
  const group = await sim("chats/" + groupId);
  const post = [...group.messages].reverse().find((m) => m.is_automatic_forward);
  if (!post) throw new Error("Publish a registration post first");
  return { group, post };
}
const setups = {
  async post() {
    const c = channel();
    await sim("channel-posts", { channelId: c.id, text: REGISTRATION_POST });
    chatId = c.linked_chat_id ?? c.id; store.set("chat", chatId);
    toast("Posted · the bot registers it in the group");
  },
  async signUps() {
    const groupId = channel().linked_chat_id;
    const { post } = await latestPost(groupId);
    for (const text of SIGN_UPS) {
      const first = text.split(" ")[1];
      const student = state.users.find((u) => u.first_name === first) || await sim("users", { first_name: first });
      await sim("messages", { chatId: groupId, userId: student.id, text, replyTo: post.message_id });
    }
    chatId = groupId; store.set("chat", chatId);
    toast("3 students commented their names");
  },
  async approve() {
    const groupId = channel().linked_chat_id;
    const admin = isAdmin(roleIn(channel(), actorId)) ? actorId : state.users.find((u) => roleIn(channel(), u.id) === "administrator")?.id;
    if (!admin) throw new Error("No admin to approve with");
    const { group, post } = await latestPost(groupId);
    const pending = group.messages.filter((m) => m.reply_to_message?.message_id === post.message_id && !m.from?.is_bot && !(m.reactions[admin] || []).length);
    for (const m of pending) await sim("reactions", { chatId: groupId, messageId: m.message_id, userId: admin, emojis: ["👌"] });
    toast(pending.length ? nameOf(user(admin)) + " approved " + pending.length + " with 👌" : "Nothing left to approve");
  },
};

// ------------------------------------------------------------ rendering
function renderBadge() {
  const unseen = state ? Math.max(0, totalMessages() - seenMessages) : 0;
  $("badge").hidden = unseen === 0 || document.body.classList.contains("open");
  $("badge").textContent = unseen > 99 ? "99+" : unseen;
  $("conn").classList.toggle("off", !state?.webhook);
  bubble.title = state?.webhook ? "Bot connected" : "Bot not connected (no webhook set)";
}

function renderHead() {
  const u = user(actorId);
  $("whoName").textContent = u ? nameOf(u) + " · " + roleLabel(u.id) : "Pick someone";
}

function renderChatPicker() {
  const label = (c) => c.type === "channel" ? "📢 " + c.title : c.type === "supergroup" ? "💬 " + c.title : "🤖 Bot · " + nameOf(user(c.id));
  const chats = state.chats.filter((c) => c.type !== "private" || c.id === actorId);
  $("chatPicker").innerHTML = chats.map((c) => '<button class="chip' + (c.id === chatId ? " on" : "") + '" data-chat="' + c.id + '">' + esc(label(c)) + "</button>").join("") +
    (state.chats.some((c) => c.id === actorId) ? "" : '<button class="chip action" id="dm">+ Chat with the bot</button>');
  for (const b of $("chatPicker").querySelectorAll("[data-chat]")) b.onclick = () => { chatId = Number(b.dataset.chat); store.set("chat", chatId); replyTo = selected = null; refresh(); };
  if ($("dm")) $("dm").onclick = act(async () => { chatId = (await sim("private-chats", { userId: actorId })).chatId; store.set("chat", chatId); });
}

function renderSetups() {
  const c = channel();
  if (!c) { $("setups").innerHTML = ""; return; }
  $("setups").innerHTML =
    '<button class="chip action" data-setup="post">📢 Registration post</button>' +
    '<button class="chip action" data-setup="signUps">✍️ 3 sign-ups</button>' +
    '<button class="chip action" data-setup="approve">👌 Approve all</button>' +
    (chat && chat.type !== "private" ? '<button class="chip action" data-setup="role">' + (isAdmin(roleIn(chat, actorId)) ? "Make me a member" : "Make me an admin") + "</button>" : "");
  for (const b of $("setups").querySelectorAll("[data-setup]")) {
    b.onclick = act(async () => {
      b.disabled = true;
      if (b.dataset.setup === "role") {
        const status = isAdmin(roleIn(chat, actorId)) ? "member" : "administrator";
        await sim("members", { chatId, userId: actorId, status });
        toast(nameOf(user(actorId)) + " is now " + (status === "member" ? "a member" : "an admin") + " of " + (chat.title || "the chat"));
      } else await setups[b.dataset.setup]();
    });
  }
}

function renderMessages() {
  const box = $("messages");
  if (!chat) { box.innerHTML = '<p class="empty">Pick a chat above.</p>'; return; }
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
  if (!chat.messages.length) {
    box.innerHTML = '<p class="empty">No messages yet.' + (chat.type === "channel" ? "<br>Try “Registration post” above." : "") + "</p>";
    return;
  }
  box.innerHTML = chat.messages.map((m) => {
    const from = m.from && m.from.id === 777000 && m.sender_chat ? m.sender_chat.title : m.from ? nameOf(m.from) : m.sender_chat?.title || "";
    const reacts = Object.entries(m.reactions || {}).flatMap(([uid, rs]) => rs.map((r) => '<span class="react">' + esc(r.emoji) + " " + esc(nameOf(user(Number(uid))) || uid) + "</span>"));
    if (m.botReaction?.length) reacts.push('<span class="react">' + esc(m.botReaction.map((r) => r.emoji).join("")) + " bot</span>");
    const buttons = (m.reply_markup?.inline_keyboard || []).flat().map((b) =>
      b.web_app ? '<button class="webapp" data-open-app>' + esc(b.text) + "</button>" : '<span class="react">' + esc(b.text) + "</span>");
    const mine = m.from && m.from.id === actorId;
    return '<div class="msg' + (m.from?.is_bot ? " bot" : "") + (mine ? " me" : "") + (m.message_id === selected ? " sel" : "") + '" data-msg="' + m.message_id + '">' +
      '<div class="from">' + esc(from) + "</div>" +
      (m.reply_to_message ? '<div class="quote" dir="auto">' + esc(m.reply_to_message.text || "") + "</div>" : "") +
      (m.photo ? '<div class="body">🖼️ photo</div>' : "") +
      '<div class="body" dir="auto">' + esc(m.text || m.caption || "") + "</div>" +
      (reacts.length || buttons.length ? '<div class="meta">' + reacts.join("") + buttons.join("") + "</div>" : "") +
      (m.message_id === selected ? '<div class="acts"><button data-reply>↩︎ Reply</button><button data-react="👌">👌</button><button data-react="❤">❤</button><button data-react="">Clear</button></div>' : "") +
      "</div>";
  }).join("");
  for (const el of box.querySelectorAll("[data-msg]")) {
    const id = Number(el.dataset.msg);
    el.onclick = (e) => {
      if (e.target.closest("button")) return;
      selected = selected === id ? null : id; renderMessages();
    };
    el.querySelector("[data-reply]")?.addEventListener("click", () => {
      replyTo = id; selected = null;
      $("replyText").textContent = "Replying to: " + (chat.messages.find((m) => m.message_id === id)?.text || "").split("\\n")[0];
      $("replying").hidden = false; renderMessages(); $("text").focus();
    });
    for (const b of el.querySelectorAll("[data-react]")) {
      b.onclick = act(async () => {
        await sim("reactions", { chatId, messageId: id, userId: actorId, emojis: b.dataset.react ? [b.dataset.react] : [] });
        selected = null;
      });
    }
    for (const b of el.querySelectorAll("[data-open-app]")) b.onclick = () => { toggleSheet(false); openMiniApp(true); };
  }
  if (nearBottom || !box.dataset.seen) box.scrollTop = box.scrollHeight;
  box.dataset.seen = "1";
}

function renderPeople() {
  const c = channel();
  const people = state.users.filter((u) => !u.is_bot);
  $("people").innerHTML = people.map((u) => {
    const role = roleIn(c, u.id);
    return '<div class="person' + (u.id === actorId ? " on" : "") + '">' +
      '<div class="avatar">' + esc((u.first_name || "?").slice(0, 1)) + "</div>" +
      '<button class="name" data-act="' + u.id + '">' + esc(nameOf(u)) + "<small>" + roleLabel(u.id) + (u.username ? " · @" + esc(u.username) : "") + (u.id === actorId ? " · acting as" : "") + "</small></button>" +
      (role === "creator" ? "" : '<button class="small" data-role="' + u.id + '">' + (isAdmin(role) ? "Remove admin" : "Make admin") + "</button>") +
      "</div>";
  }).join("");
  for (const b of $("people").querySelectorAll("[data-act]")) b.onclick = act(async () => { await actAs(Number(b.dataset.act)); showTab("chat"); });
  for (const b of $("people").querySelectorAll("[data-role]")) {
    b.onclick = act(async () => {
      const id = Number(b.dataset.role);
      await sim("members", { chatId: c.id, userId: id, status: isAdmin(roleIn(c, id)) ? "member" : "administrator" });
    });
  }
}

async function renderActivity() {
  const [deliveries, calls] = await Promise.all([sim("deliveries"), sim("api-calls")]);
  const updates = deliveries.slice(-40).reverse().map((d) =>
    '<div><span class="' + (d.status === "delivered" ? "ok" : "fail") + '">' + (d.status === "delivered" ? "✓" : "✗") + "</span> " + esc(d.type) +
    (d.attempts > 1 ? " ×" + d.attempts : "") + (d.status !== "delivered" && d.lastError ? " · " + esc(d.lastError) : "") + "</div>").join("");
  const actions = calls.slice(-60).reverse().map((c) => {
    const p = c.params || {};
    const detail = p.text || p.caption || (p.reaction ? p.reaction.map((r) => r.emoji).join("") : "") || "";
    return '<div><span class="' + (c.ok ? "ok" : "fail") + '">' + (c.ok ? "✓" : "✗") + "</span> " + esc(c.method) + " " +
      esc(String(detail).replace(/\\s+/g, " ").slice(0, 80)) + (c.ok ? "" : " · " + esc(c.description || "")) + "</div>";
  }).join("");
  $("log").innerHTML = "<h3>What the bot did, newest first</h3>" + (actions || '<div class="empty">Nothing yet</div>') +
    "<h3>Updates Telegram sent it</h3>" + (updates || '<div class="empty">Nothing yet</div>');
}

async function refresh() {
  try {
    state = await sim("state");
    if (!user(actorId)) {
      // Start as an admin: what a reviewer usually checks first.
      actorId = (state.users.find((u) => !u.is_bot && roleIn(channel(), u.id) === "administrator") || state.users.find((u) => !u.is_bot))?.id;
      store.set("actor", actorId);
    }
    if (!state.chats.some((c) => c.id === chatId)) chatId = channel()?.linked_chat_id ?? channel()?.id ?? null;
    renderBadge(); renderHead();
    await openMiniApp(false);
    if (!document.body.classList.contains("open")) return;
    if (tab === "chat") {
      chat = chatId === null ? null : await sim("chats/" + chatId);
      renderChatPicker(); renderSetups(); renderMessages();
    } else if (tab === "people") renderPeople();
    else await renderActivity();
  } catch (e) { toast(e.message); }
}

$("composer").onsubmit = act(async (e) => {
  e.preventDefault();
  const text = $("text").value.trim();
  if (!text || chatId === null) return;
  await sim("messages", { chatId, userId: actorId, text, replyTo: replyTo ?? undefined });
  $("text").value = ""; replyTo = null; $("replying").hidden = true;
});
$("text").onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey && matchMedia("(pointer: fine)").matches) { e.preventDefault(); $("composer").requestSubmit(); } };
$("text").oninput = () => { $("text").style.height = "auto"; $("text").style.height = $("text").scrollHeight + "px"; };
$("cancelReply").onclick = () => { replyTo = null; $("replying").hidden = true; };
$("addUser").onsubmit = act(async (e) => {
  e.preventDefault();
  const name = $("newName").value.trim();
  if (!name) return;
  const u = await sim("users", { first_name: name });
  $("newName").value = "";
  toast("Added " + name + " · tap them to act as them");
  return u;
});
if ($("reset")) $("reset").onclick = act(async () => {
  if (!confirm("Start over with a fresh simulated world? What the bot already stored stays.")) return;
  await sim("reset", {});
  actorId = chatId = null; appFor = null; seenMessages = 0; store.set("seen", 0);
});

// The Mini App talks to Telegram through postMessage; answer what matters.
addEventListener("message", (e) => {
  let data = e.data;
  try { if (typeof data === "string") data = JSON.parse(data); } catch { return; }
  if (data?.eventType === "web_app_close") toast("The Mini App asked to close (Telegram would close it here)");
});

(async () => {
  await refresh();
  // First visit: show where everything is.
  if (!store.get("visited")) { store.set("visited", true); toggleSheet(true); }
  setInterval(refresh, 2000);
})();
</script>
</body>
</html>`;
}
