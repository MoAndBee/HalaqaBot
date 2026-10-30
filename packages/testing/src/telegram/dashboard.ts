/**
 * The simulator's dashboard: a small Telegram-like client for trying the bot by
 * hand, with no Telegram account. Pick a user to act as and a chat, then post,
 * comment, react or change admins; the Mini App runs alongside, signed in as
 * that user; the bottom strip shows what the bot was sent and what it did.
 * Talks to the /sim control API.
 *
 * A link may carry the control token as `#token=...` (previews post one on the
 * PR); it's kept in localStorage and dropped from the address bar.
 */
export function renderDashboard(options: { needsToken: boolean; hasMiniApp: boolean; canReset: boolean }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Telegram Simulator</title>
<style>
  :root { --bg:#f4f4f5; --panel:#fff; --line:#e4e4e7; --text:#18181b; --muted:#71717a; --accent:#2563eb; --bot:#eef2ff; --ok:#16a34a; --bad:#dc2626; }
  @media (prefers-color-scheme: dark) { :root { --bg:#0b0b0d; --panel:#18181b; --line:#27272a; --text:#f4f4f5; --muted:#a1a1aa; --accent:#60a5fa; --bot:#1e1b4b; } }
  * { box-sizing: border-box; }
  html, body { height:100%; }
  body { margin:0; font:14px/1.45 system-ui, sans-serif; background:var(--bg); color:var(--text); display:flex; flex-direction:column; }
  header { display:flex; gap:10px; align-items:center; flex-wrap:wrap; padding:8px 14px; border-bottom:1px solid var(--line); background:var(--panel); }
  header h1 { font-size:15px; margin:0 6px 0 0; }
  .status { color:var(--muted); font-size:12px; }
  .status.bad { color:var(--bad); }
  main { flex:1; min-height:0; display:grid; grid-template-columns: 230px minmax(0,1fr) ${options.hasMiniApp ? "390px" : ""}; }
  @media (max-width: 900px) { main { grid-template-columns: 1fr; } aside, #phoneCol { max-height:60vh; } }
  aside { border-right:1px solid var(--line); background:var(--panel); overflow:auto; }
  h2 { font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); margin:12px 12px 6px; }
  .item { padding:7px 12px; cursor:pointer; border-left:3px solid transparent; }
  .item:hover { background:var(--bg); }
  .item.active { border-left-color:var(--accent); background:var(--bg); }
  .item small { display:block; color:var(--muted); }
  section { display:flex; flex-direction:column; min-width:0; min-height:0; }
  .toolbar { display:flex; gap:6px; flex-wrap:wrap; align-items:center; padding:8px 14px; border-bottom:1px solid var(--line); background:var(--panel); }
  .messages { flex:1; overflow:auto; padding:14px; display:flex; flex-direction:column; gap:8px; }
  .msg { max-width:640px; background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:8px 10px; }
  .msg.bot { background:var(--bot); }
  .msg.selected { outline:2px solid var(--accent); }
  .meta { font-size:12px; color:var(--muted); display:flex; gap:8px; justify-content:space-between; }
  .text { white-space:pre-wrap; margin-top:2px; }
  .reply { font-size:12px; color:var(--muted); border-left:2px solid var(--accent); padding-left:6px; margin-top:4px; }
  .reacts, .actions { display:flex; gap:4px; margin-top:6px; flex-wrap:wrap; }
  .chip { font-size:12px; padding:1px 6px; border-radius:999px; border:1px solid var(--line); }
  button, select, textarea { font:inherit; color:inherit; background:var(--panel); border:1px solid var(--line); border-radius:6px; padding:4px 9px; }
  button { cursor:pointer; }
  button:disabled { opacity:.5; cursor:default; }
  button.primary { background:var(--accent); border-color:var(--accent); color:#fff; }
  button.small { padding:1px 7px; font-size:12px; }
  .composer { display:flex; gap:8px; padding:8px 14px; border-top:1px solid var(--line); background:var(--panel); }
  .composer textarea { flex:1; min-height:36px; resize:vertical; }
  .empty { color:var(--muted); margin:auto; text-align:center; }
  #phoneCol { border-left:1px solid var(--line); background:var(--panel); display:flex; flex-direction:column; padding:10px; gap:8px; min-height:0; }
  #phoneCol .bar { display:flex; gap:6px; align-items:center; font-size:12px; color:var(--muted); }
  #phone { flex:1; width:100%; min-height:0; border:8px solid #18181b; border-radius:26px; background:#fff; }
  #activity { height:150px; border-top:1px solid var(--line); background:var(--panel); display:grid; grid-template-columns:1fr 1fr; font-size:12px; }
  #activity > div { overflow:auto; padding:4px 14px; }
  #activity > div + div { border-left:1px solid var(--line); }
  #activity .row { font-family:ui-monospace, monospace; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .ok { color:var(--ok); } .fail { color:var(--bad); }
  #toast { position:fixed; bottom:170px; right:16px; background:var(--text); color:var(--bg); padding:8px 12px; border-radius:8px; display:none; max-width:420px; }
</style>
</head>
<body>
<header>
  <h1>Telegram Simulator</h1>
  <label>Act as <select id="actor"></select></label>
  <button id="addUser" class="small">+ user</button>
  <button id="dm" class="small">Chat with the bot</button>
  ${options.canReset ? '<button id="reset" class="small" title="A fresh simulated world (data already in Convex stays)">Reset world</button>' : ""}
  <span id="status" class="status"></span>
</header>
<main>
  <aside id="chats"></aside>
  <section>
    <div class="toolbar" id="toolbar"></div>
    <div class="messages" id="messages"><p class="empty">Pick a chat.</p></div>
    <div class="composer">
      <textarea id="text" dir="auto" placeholder="Message as the selected user (click a message first to reply to it)"></textarea>
      <button id="send" class="primary">Send</button>
    </div>
  </section>
  ${options.hasMiniApp ? `<div id="phoneCol">
    <div class="bar"><span>Mini App as <b id="phoneUser"></b></span><span style="flex:1"></span><button id="reopen" class="small">Reopen</button><button id="newTab" class="small">New tab</button></div>
    <iframe id="phone" title="Mini App"></iframe>
  </div>` : ""}
</main>
<div id="activity">
  <div><h2>Updates sent to the bot</h2><div id="deliveries"></div></div>
  <div><h2>What the bot did (Bot API calls)</h2><div id="calls"></div></div>
</div>
<div id="toast"></div>
<script>
const NEEDS_TOKEN = ${options.needsToken};
const HAS_MINI_APP = ${options.hasMiniApp};
const REGISTRATION_POST = "حللتم أهلا ونزلتم سهلا 🌸\\nسجلي اسمك للحلقة";
const SIGN_UPS = ["انا فاطمة احمد تسميع", "انا منى علي تلاوة", "انا خديجة محمود تسميع", "انا مريم حسن تلاوة", "انا عائشة سالم تسميع"];

let token = "";
if (NEEDS_TOKEN) {
  const fromLink = new URLSearchParams(location.hash.slice(1)).get("token");
  try { token = fromLink || localStorage.getItem("simToken") || ""; } catch { token = fromLink || ""; }
  if (!token) token = prompt("Simulator control token") || "";
  try { localStorage.setItem("simToken", token); } catch {}
  if (fromLink) history.replaceState(null, "", location.pathname);
}
let state = null, chatId = null, chat = null, replyTo = null, phoneFor = null;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" })[c]);

async function sim(path, body) {
  const res = await fetch("/sim/" + path, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}
function toast(text) { const t = $("toast"); t.textContent = text; t.style.display = "block"; clearTimeout(toast.timer); toast.timer = setTimeout(() => t.style.display = "none", 3500); }
const actor = () => Number($("actor").value);
const user = (id) => state.users.find((u) => u.id === id);
const userName = (u) => u ? [u.first_name, u.last_name].filter(Boolean).join(" ") + (u.username ? " @" + u.username : "") : "";
const act = (fn) => async (...args) => { try { await fn(...args); await refresh(); } catch (e) { toast(e.message); } };
const statusIn = (c, userId) => (c && c.members[userId]) || "left";
const isAdmin = (s) => s === "administrator" || s === "creator";
const chats = (type) => state.chats.filter((c) => c.type === type);
const groupOf = (channel) => channel && state.chats.find((c) => c.id === channel.linked_chat_id);

// ---------------------------------------------------------------- set-ups
// Shortcuts for what a reviewer does most, built only from the control API.
async function latestPost(groupId) {
  const group = await sim("chats/" + groupId);
  const post = [...group.messages].reverse().find((m) => m.is_automatic_forward);
  if (!post) throw new Error("Publish a registration post first");
  return { group, post };
}
const setups = {
  async post(channel) {
    await sim("channel-posts", { channelId: channel.id, text: REGISTRATION_POST });
    chatId = channel.linked_chat_id ?? channel.id;
  },
  async signUps(groupId) {
    const { post } = await latestPost(groupId);
    for (const text of SIGN_UPS.slice(0, 3)) {
      const name = text.split(" ")[1];
      const student = state.users.find((u) => u.first_name === name) || await sim("users", { first_name: name });
      await sim("messages", { chatId: groupId, userId: student.id, text, replyTo: post.message_id });
    }
  },
  async approveAll(groupId) {
    const admin = actor();
    if (!isAdmin(statusIn(chat, admin))) throw new Error("Act as an admin to approve");
    const { group, post } = await latestPost(groupId);
    const pending = group.messages.filter((m) => m.reply_to_message?.message_id === post.message_id && !m.from?.is_bot && !(m.reactions[admin] || []).length);
    for (const m of pending) await sim("reactions", { chatId: groupId, messageId: m.message_id, userId: admin, emojis: ["👌"] });
    toast(pending.length ? "Approved " + pending.length + " sign-up(s)" : "Nothing left to approve");
  },
};

// ---------------------------------------------------------------- rendering
function renderChats() {
  const groups = { channel: "Channels", supergroup: "Groups", private: "Private chats with the bot" };
  let html = "";
  for (const [type, title] of Object.entries(groups)) {
    if (!chats(type).length) continue;
    html += "<h2>" + title + "</h2>";
    for (const c of chats(type)) {
      const name = c.title || userName(user(c.id));
      html += '<div class="item' + (c.id === chatId ? " active" : "") + '" data-chat="' + c.id + '">' + esc(name) +
        "<small>" + c.messageCount + " messages</small></div>";
    }
  }
  $("chats").innerHTML = html;
  for (const el of document.querySelectorAll("[data-chat]")) el.onclick = () => { chatId = Number(el.dataset.chat); replyTo = null; refresh(); };
}

function renderUsers() {
  const current = $("actor").value;
  const channel = chats("channel")[0];
  $("actor").innerHTML = state.users.filter((u) => !u.is_bot).map((u) => {
    const role = statusIn(channel, u.id);
    const label = userName(u) + (isAdmin(role) ? " (" + (role === "creator" ? "owner" : "admin") + ")" : "");
    return '<option value="' + u.id + '">' + esc(label) + "</option>";
  }).join("");
  if (current) $("actor").value = current;
}

function renderToolbar() {
  if (!chat) { $("toolbar").innerHTML = '<span class="status">Pick a chat on the left.</span>'; return; }
  const status = statusIn(chat, actor());
  let html = "<span class=status>" + esc(chat.type) + " · you are <b>" + esc(status) + "</b></span>";
  if (chat.type === "channel") html += '<button id="setupPost" class="small">📢 Publish registration post</button>';
  if (chat.type === "supergroup" && chat.linked_chat_id) {
    html += '<button id="setupSignUps" class="small">✍️ 3 students sign up</button>';
    html += '<button id="setupApprove" class="small">👌 Approve all (as admin)</button>';
  }
  if (chat.type !== "private") {
    html += isAdmin(status)
      ? '<button id="demote" class="small">Make me a member</button>'
      : '<button id="promote" class="small">Make me an admin</button>';
  }
  $("toolbar").innerHTML = html;
  if ($("setupPost")) $("setupPost").onclick = act(() => setups.post(chat));
  if ($("setupSignUps")) $("setupSignUps").onclick = act(() => setups.signUps(chatId));
  if ($("setupApprove")) $("setupApprove").onclick = act(() => setups.approveAll(chatId));
  if ($("promote")) $("promote").onclick = act(() => sim("members", { chatId, userId: actor(), status: "administrator" }));
  if ($("demote")) $("demote").onclick = act(() => sim("members", { chatId, userId: actor(), status: "member" }));
}

function renderMessages() {
  if (!chat) return;
  const box = $("messages");
  const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
  if (!chat.messages.length) {
    box.innerHTML = '<p class="empty">No messages yet.' + (chat.type === "channel" ? "<br>Try “Publish registration post” above." : "") + "</p>";
    return;
  }
  box.innerHTML = chat.messages.map((m) => {
    const from = m.from && m.from.id === 777000 && m.sender_chat ? m.sender_chat.title + " (automatic forward)"
      : m.from ? userName(m.from) : m.sender_chat ? m.sender_chat.title : "";
    const reacts = Object.entries(m.reactions || {}).flatMap(([uid, rs]) => rs.map((r) => {
      const u = user(Number(uid));
      return '<span class="chip">' + esc(r.emoji) + " " + esc(u ? u.first_name : uid) + "</span>";
    }));
    if (m.botReaction && m.botReaction.length) reacts.push('<span class="chip">' + esc(m.botReaction.map((r) => r.emoji).join("")) + " bot</span>");
    const buttons = (m.reply_markup && m.reply_markup.inline_keyboard || []).flat()
      .map((b) => '<span class="chip">🔘 ' + esc(b.text) + "</span>");
    return '<div class="msg' + (m.from && m.from.is_bot ? " bot" : "") + (m.message_id === replyTo ? " selected" : "") + '" data-msg="' + m.message_id + '">' +
      '<div class="meta"><b>' + esc(from) + "</b><span>#" + m.message_id + "</span></div>" +
      (m.reply_to_message ? '<div class="reply" dir="auto">↪ ' + esc((m.reply_to_message.text || "").slice(0, 80)) + "</div>" : "") +
      (m.photo ? '<div class="text">🖼️ photo</div>' : "") +
      (m.forward_origin && !m.is_automatic_forward ? '<div class="reply">forwarded</div>' : "") +
      '<div class="text" dir="auto">' + esc(m.text || m.caption || "") + "</div>" +
      (reacts.length || buttons.length ? '<div class="reacts">' + reacts.join("") + buttons.join("") + "</div>" : "") +
      '<div class="actions"><button class="small" data-react="👌">👌</button><button class="small" data-react="❤">❤</button><button class="small" data-react="">clear</button></div>' +
      "</div>";
  }).join("");
  for (const el of box.querySelectorAll("[data-msg]")) {
    const id = Number(el.dataset.msg);
    el.onclick = (e) => { if (e.target.dataset.react === undefined) { replyTo = replyTo === id ? null : id; renderMessages(); } };
    for (const b of el.querySelectorAll("[data-react]")) {
      b.onclick = act(() => sim("reactions", { chatId, messageId: id, userId: actor(), emojis: b.dataset.react ? [b.dataset.react] : [] }));
    }
  }
  if (atBottom) box.scrollTop = box.scrollHeight;
}

async function renderActivity() {
  const [deliveries, calls] = await Promise.all([sim("deliveries"), sim("api-calls")]);
  // Follow the newest entries, unless the reader scrolled up to look at older ones.
  const keep = (box, html) => {
    const pane = box.parentElement;
    const follow = !pane.dataset.seen || pane.scrollHeight - pane.scrollTop - pane.clientHeight < 20;
    box.innerHTML = html;
    pane.dataset.seen = "1";
    if (follow) pane.scrollTop = pane.scrollHeight;
  };
  keep($("deliveries"), deliveries.slice(-60).map((d) =>
    '<div class="row"><span class="' + (d.status === "delivered" ? "ok" : "fail") + '">' + (d.status === "delivered" ? "✓" : "✗") + "</span> #" + d.updateId + " " + esc(d.type) +
    (d.attempts > 1 ? " (" + d.attempts + " attempts)" : "") + (d.lastError && d.status !== "delivered" ? " — " + esc(d.lastError) : "") + "</div>").join(""));
  keep($("calls"), calls.slice(-60).map((c) => {
    const p = c.params || {};
    const detail = p.text || p.caption || (p.reaction ? JSON.stringify(p.reaction) : "") || (p.chat_id ? "chat " + p.chat_id : "");
    return '<div class="row"><span class="' + (c.ok ? "ok" : "fail") + '">' + (c.ok ? "✓" : "✗") + "</span> " + esc(c.method) + " " +
      esc(String(detail).replace(/\\s+/g, " ").slice(0, 120)) + (c.ok ? "" : " — " + esc(c.description || "")) + "</div>";
  }).join(""));
}

function renderStatus() {
  const hook = state.webhook;
  $("status").className = "status" + (hook ? "" : " bad");
  $("status").textContent = hook
    ? "bot connected (webhook set) · " + state.pendingUpdateCount + " pending"
    : "bot not connected: no webhook set";
}

// The Mini App, signed in as whoever we're acting as, like Telegram opens it.
async function openPhone(force) {
  if (!HAS_MINI_APP || !state) return;
  const id = actor();
  if (!force && phoneFor === id) return;
  phoneFor = id;
  $("phoneUser").textContent = userName(user(id));
  const { url } = await sim("mini-app", { userId: id });
  $("phone").src = url;
}

async function refresh() {
  try {
    state = await sim("state");
    chat = chatId === null ? null : await sim("chats/" + chatId);
    renderUsers(); renderChats(); renderToolbar(); renderMessages(); renderStatus();
    await renderActivity();
    await openPhone(false);
  } catch (e) { $("status").textContent = e.message; $("status").className = "status bad"; }
}

$("send").onclick = act(async () => {
  const text = $("text").value.trim();
  if (!text || chatId === null) return;
  await sim("messages", { chatId, userId: actor(), text, replyTo: replyTo ?? undefined });
  $("text").value = ""; replyTo = null;
});
$("text").onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("send").click(); } };
$("addUser").onclick = act(async () => {
  const name = prompt("First name");
  if (name) { const u = await sim("users", { first_name: name }); $("actor").value = u.id; }
});
if ($("reset")) $("reset").onclick = act(async () => {
  if (!confirm("Start over with a fresh simulated world? Data the bot already stored stays.")) return;
  await sim("reset", {});
  chatId = null; replyTo = null; phoneFor = null;
});
$("actor").onchange = () => { renderToolbar(); renderUsers(); void openPhone(false); };
$("dm").onclick = act(async () => { chatId = (await sim("private-chats", { userId: actor() })).chatId; replyTo = null; });
if (HAS_MINI_APP) {
  $("reopen").onclick = () => openPhone(true);
  $("newTab").onclick = async () => { const { url } = await sim("mini-app", { userId: actor() }); window.open(url, "_blank"); };
}

// Start on an admin, looking at the discussion group: what a reviewer wants first.
(async () => {
  await refresh();
  const channel = state && chats("channel")[0];
  if (channel) {
    const admin = state.users.find((u) => !u.is_bot && statusIn(channel, u.id) === "administrator");
    if (admin) $("actor").value = admin.id;
    chatId = channel.id;
    await refresh();
  }
  setInterval(refresh, 1500);
})();
</script>
</body>
</html>`;
}
