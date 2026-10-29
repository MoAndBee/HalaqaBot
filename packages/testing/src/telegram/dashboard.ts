/**
 * The simulator's dashboard: a small Telegram-like client for poking at the bot
 * by hand. Pick a user to act as, pick a chat, then post, comment, react, change
 * admins, or open the Mini App as that user. Talks to the /sim control API.
 */
export function renderDashboard(options: { needsToken: boolean }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Telegram Simulator</title>
<style>
  :root { --bg:#f4f4f5; --panel:#fff; --line:#e4e4e7; --text:#18181b; --muted:#71717a; --accent:#2563eb; --bot:#eef2ff; --mine:#ecfdf5; }
  @media (prefers-color-scheme: dark) { :root { --bg:#0b0b0d; --panel:#18181b; --line:#27272a; --text:#f4f4f5; --muted:#a1a1aa; --accent:#60a5fa; --bot:#1e1b4b; --mine:#052e16; } }
  * { box-sizing: border-box; }
  body { margin:0; font:14px/1.45 system-ui, sans-serif; background:var(--bg); color:var(--text); }
  header { display:flex; gap:12px; align-items:center; flex-wrap:wrap; padding:10px 16px; border-bottom:1px solid var(--line); background:var(--panel); }
  header h1 { font-size:15px; margin:0 8px 0 0; }
  .status { color:var(--muted); font-size:12px; }
  .status.bad { color:#dc2626; }
  main { display:grid; grid-template-columns: 260px 1fr; height: calc(100vh - 50px); }
  @media (max-width: 720px) { main { grid-template-columns: 1fr; height:auto; } }
  aside { border-right:1px solid var(--line); background:var(--panel); overflow:auto; }
  aside h2 { font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); margin:14px 12px 6px; }
  .item { padding:8px 12px; cursor:pointer; border-left:3px solid transparent; }
  .item:hover { background:var(--bg); }
  .item.active { border-left-color:var(--accent); background:var(--bg); }
  .item small { display:block; color:var(--muted); }
  section { display:flex; flex-direction:column; min-width:0; }
  .toolbar { display:flex; gap:8px; flex-wrap:wrap; padding:10px 16px; border-bottom:1px solid var(--line); background:var(--panel); }
  .messages { flex:1; overflow:auto; padding:16px; display:flex; flex-direction:column; gap:8px; }
  .msg { max-width: 640px; background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:8px 10px; }
  .msg.bot { background:var(--bot); }
  .msg.selected { outline:2px solid var(--accent); }
  .msg .meta { font-size:12px; color:var(--muted); display:flex; gap:8px; justify-content:space-between; }
  .msg .text { white-space:pre-wrap; margin-top:2px; }
  .msg .reply { font-size:12px; color:var(--muted); border-left:2px solid var(--accent); padding-left:6px; margin-top:4px; }
  .msg .reacts { display:flex; gap:4px; margin-top:6px; flex-wrap:wrap; }
  .chip { font-size:12px; padding:1px 6px; border-radius:999px; border:1px solid var(--line); }
  .msg .actions { display:flex; gap:4px; margin-top:6px; }
  button, select, input, textarea { font:inherit; color:inherit; background:var(--panel); border:1px solid var(--line); border-radius:6px; padding:5px 9px; }
  button { cursor:pointer; }
  button.primary { background:var(--accent); border-color:var(--accent); color:#fff; }
  button.small { padding:1px 7px; font-size:12px; }
  .composer { display:flex; gap:8px; padding:10px 16px; border-top:1px solid var(--line); background:var(--panel); }
  .composer textarea { flex:1; min-height:38px; resize:vertical; }
  .empty { color:var(--muted); margin:auto; }
  #toast { position:fixed; bottom:16px; right:16px; background:var(--text); color:var(--bg); padding:8px 12px; border-radius:8px; display:none; max-width:420px; }
</style>
</head>
<body>
<header>
  <h1>Telegram Simulator</h1>
  <label>Act as <select id="actor"></select></label>
  <button id="addUser" class="small">+ user</button>
  <button id="dm" class="small">Chat with the bot</button>
  <button id="miniApp" class="small">Open Mini App as this user</button>
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
</main>
<div id="toast"></div>
<script>
const NEEDS_TOKEN = ${options.needsToken};
const REGISTRATION_POST = "حللتم أهلا ونزلتم سهلا 🌸\\nسجلي اسمك للحلقة";
let token = NEEDS_TOKEN ? (localStorage.getItem("simToken") || prompt("Simulator control token") || "") : "";
if (NEEDS_TOKEN) try { localStorage.setItem("simToken", token); } catch {}
let state = null, chatId = null, chat = null, replyTo = null;
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
const userName = (u) => u ? [u.first_name, u.last_name].filter(Boolean).join(" ") + (u.username ? " @" + u.username : "") : "";
const act = (fn) => async (...args) => { try { await fn(...args); await refresh(); } catch (e) { toast(e.message); } };

function renderChats() {
  const groups = { channel: "Channels", supergroup: "Groups", private: "Private chats with the bot" };
  let html = "";
  for (const [type, title] of Object.entries(groups)) {
    const list = state.chats.filter((c) => c.type === type);
    if (!list.length) continue;
    html += "<h2>" + title + "</h2>";
    for (const c of list) {
      const name = c.title || userName(state.users.find((u) => u.id === c.id));
      html += '<div class="item' + (c.id === chatId ? " active" : "") + '" data-chat="' + c.id + '">' + esc(name) +
        "<small>" + c.id + " · " + c.messageCount + " messages</small></div>";
    }
  }
  $("chats").innerHTML = html;
  for (const el of document.querySelectorAll("[data-chat]")) el.onclick = () => { chatId = Number(el.dataset.chat); replyTo = null; refresh(); };
}

function renderUsers() {
  const current = $("actor").value;
  $("actor").innerHTML = state.users.filter((u) => !u.is_bot)
    .map((u) => '<option value="' + u.id + '">' + esc(userName(u)) + "</option>").join("");
  if (current) $("actor").value = current;
}

function renderToolbar() {
  if (!chat) { $("toolbar").innerHTML = ""; return; }
  const status = chat.members[actor()] || "left";
  let html = "<span class=status>" + esc(chat.type) + " · you are <b>" + esc(status) + "</b></span>";
  if (chat.type === "channel") html += '<button id="post" class="small">Publish registration post</button>';
  if (chat.type !== "private") {
    html += status === "administrator" || status === "creator"
      ? '<button id="demote" class="small">Make me a member</button>'
      : '<button id="promote" class="small">Make me an admin</button>';
  }
  $("toolbar").innerHTML = html;
  if ($("post")) $("post").onclick = act(() => sim("channel-posts", { channelId: chatId, text: $("text").value.trim() || REGISTRATION_POST }));
  if ($("promote")) $("promote").onclick = act(() => sim("members", { chatId, userId: actor(), status: "administrator" }));
  if ($("demote")) $("demote").onclick = act(() => sim("members", { chatId, userId: actor(), status: "member" }));
}

function renderMessages() {
  if (!chat) return;
  const box = $("messages");
  const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
  if (!chat.messages.length) { box.innerHTML = '<p class="empty">No messages yet.</p>'; return; }
  box.innerHTML = chat.messages.map((m) => {
    const from = m.from && m.from.id === 777000 && m.sender_chat ? m.sender_chat.title + " (automatic forward)"
      : m.from ? userName(m.from) : m.sender_chat ? m.sender_chat.title : "";
    const isBot = m.from && m.from.is_bot;
    const reacts = Object.entries(m.reactions || {}).flatMap(([uid, rs]) => rs.map((r) => {
      const u = state.users.find((x) => String(x.id) === uid);
      return '<span class="chip">' + esc(r.emoji) + " " + esc(u ? u.first_name : uid) + "</span>";
    }));
    if (m.botReaction && m.botReaction.length) reacts.push('<span class="chip">' + esc(m.botReaction.map((r) => r.emoji).join("")) + " bot</span>");
    const buttons = (m.reply_markup && m.reply_markup.inline_keyboard || []).flat()
      .map((b) => '<span class="chip">🔘 ' + esc(b.text) + (b.web_app ? " → " + esc(b.web_app.url) : "") + "</span>");
    return '<div class="msg' + (isBot ? " bot" : "") + (m.message_id === replyTo ? " selected" : "") + '" data-msg="' + m.message_id + '">' +
      '<div class="meta"><b>' + esc(from) + "</b><span>#" + m.message_id + "</span></div>" +
      (m.reply_to_message ? '<div class="reply" dir="auto">↪ ' + esc((m.reply_to_message.text || "").slice(0, 80)) + "</div>" : "") +
      (m.photo ? '<div class="text">🖼️ photo (' + (m.photo[0].file_size ?? "?") + " bytes)</div>" : "") +
      (m.forward_origin && !m.is_automatic_forward ? '<div class="reply">forwarded from ' + esc(m.forward_origin.type) + "</div>" : "") +
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

function renderStatus() {
  const hook = state.webhook;
  const el = $("status");
  el.className = "status" + (hook ? "" : " bad");
  el.textContent = hook
    ? "webhook → " + hook.url + " · max_connections " + hook.maxConnections + " · " + state.pendingUpdateCount + " pending"
    : "no webhook set — run the bot's webhook:set against this simulator";
}

async function refresh() {
  try {
    state = await sim("state");
    chat = chatId === null ? null : await sim("chats/" + chatId);
    renderUsers(); renderChats(); renderToolbar(); renderMessages(); renderStatus();
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
$("miniApp").onclick = act(async () => {
  const { url, initData } = await sim("mini-app", { userId: actor() });
  if (url) window.open(url, "_blank"); else { await navigator.clipboard?.writeText(initData); toast("initData copied (no web app URL configured)"); }
});
$("actor").onchange = () => { renderToolbar(); };
$("dm").onclick = act(async () => { chatId = (await sim("private-chats", { userId: actor() })).chatId; replyTo = null; });
refresh();
setInterval(refresh, 1000);
</script>
</body>
</html>`;
}
