// ============================================================
// FRIENDS page (code, weekly board, privacy switches)  +  SAFE DELETE (asks for your password)
// ============================================================
const FRIEND_PRIVACY = [
  ["show_hours", "Study hours this week", "Your weekly total and the bar next to it"],
  ["show_streak", "Streak", "How many days in a row you've studied"],
  ["show_level", "Level & title", "Your level and rank title"],
  ["show_photo", "Profile photo", "Off = friends see your initial instead"],
];
const FriendPrivacy = {
  defaults: { show_hours: true, show_streak: true, show_level: true, show_photo: true },
  async get(user) {
    try { const { data } = await DB.client.from("friend_privacy").select("*").eq("user_id", user.id).maybeSingle(); if (data) return { ...this.defaults, ...data }; } catch {}
    try { const l = JSON.parse(localStorage.getItem(`fp:${user.id}`) || "null"); if (l) return { ...this.defaults, ...l }; } catch {}
    return { ...this.defaults };
  },
  async set(user, patch) {
    const next = { ...(await this.get(user)), ...patch };
    try { localStorage.setItem(`fp:${user.id}`, JSON.stringify(next)); } catch {}
    const { error } = await DB.client.from("friend_privacy").upsert({ user_id: user.id, show_hours: next.show_hours, show_streak: next.show_streak, show_level: next.show_level, show_photo: next.show_photo, updated_at: new Date().toISOString() });
    return !error;
  },
};

const Friends = {
  async render() {
    const el = document.getElementById("page-friends"); if (!el) return;
    const user = await DB.currentUser(); if (!user) return;
    el.innerHTML = `<div class="page-header"><h2>Friends</h2><span class="muted">Compare your week with people you trust</span></div><div id="fr-body"><p class="fr-note">Loading…</p></div>`;
    const ws = Profile.weekStart();
    const [profile, priv, r] = await Promise.all([
      DB.client.from("profiles").select("*").eq("id", user.id).maybeSingle().then((x) => x.data),
      FriendPrivacy.get(user),
      DB.client.rpc("friends_week", { week_start: ws.toISOString() }).then((x) => x, () => ({ error: true })),
    ]);
    this.draw(user, profile, priv, r.error ? null : r.data);
  },
  draw(user, profile, priv, board) {
    const body = document.getElementById("fr-body"); if (!body) return;
    const e = IDCard.esc, code = profile?.friend_code || IDCard.code(user.id), [p1, p2, p3] = code.split("-");
    if (!board) { body.innerHTML = `<div class="panel"><p class="fr-note">Friends need a one-time setup: run <b>sql/phase4.sql</b> and then <b>sql/phase6.sql</b> in Supabase (SQL Editor), then reload this page.</p></div>`; return; }
    const vis = board.filter((r) => r.week_sec != null), max = Math.max(1, ...vis.map((r) => r.week_sec)), medal = ["🥇", "🥈", "🥉"];
    const rows = board.map((r, i) => {
      const lvl = r.total_xp != null ? xpProgress(r.total_xp).level : null, title = lvl != null ? IDCard.rankTitle(lvl) : null;
      const meta = [lvl != null ? `Lv ${lvl} · ${title[1]}` : "🔒 level hidden", r.streak != null ? `${r.streak}d streak` : "🔒 streak hidden"].join(" · ");
      return `<li class="fr-row ${r.is_me ? "me" : ""}" style="--i:${i}"><span class="fr-pos">${r.week_sec != null ? medal[i] || i + 1 : "–"}</span>
        <span class="fr-av">${r.avatar_url ? `<img src="${e(r.avatar_url)}" alt="" />` : e((r.name || "?")[0].toUpperCase())}</span>
        <span class="fr-main"><div class="fr-name">${e(r.name || "Student")}${r.is_me ? ' <i class="fr-you">you</i>' : ""}</div><div class="fr-meta">${e(meta)}</div>
          <div class="fr-bar"><u style="width:${r.week_sec != null ? Math.max(3, Math.round((r.week_sec / max) * 100)) : 0}%"></u></div></span>
        <span class="fr-time">${r.week_sec != null ? IDCard.hm(r.week_sec) : "🔒"}<small>${r.week_sec != null ? "this week" : "hidden"}${r.is_me ? "" : ` <button class="fr-x" data-rm="${r.user_id}" aria-label="Remove friend" title="Remove friend">×</button>`}</small></span></li>`;
    }).join("");
    const wa = `https://wa.me/?text=${encodeURIComponent(`Join me on Michi 🗡️ add my friend code ${code} and let's compare our study hours this week.`)}`;
    body.innerHTML = `
      <div class="fr-pass"><div class="fr-pass-l"><small>YOUR FRIEND CODE</small>
        <div class="fr-code"><b>${e(p1)}</b><i></i><b>${e(p2)}</b><i></i><b>${e(p3)}</b></div>
        <p>Share it. When a friend types it, you both show up on each other's weekly board.</p></div>
        <div class="fr-pass-r"><button class="btn btn-secondary" type="button" id="fr-copy">Copy code</button><a class="btn btn-ghost" href="${wa}" target="_blank" rel="noopener">Share on WhatsApp</a></div></div>
      <form class="fr-join" id="fr-form" autocomplete="off"><span class="fr-pre">MCH</span>
        <input class="fr-seg" id="fr-a" maxlength="4" autocapitalize="characters" spellcheck="false" placeholder="••••" aria-label="Friend code, first part" /><span class="fr-dash">–</span>
        <input class="fr-seg s2" id="fr-b" maxlength="2" autocapitalize="characters" spellcheck="false" placeholder="••" aria-label="Friend code, last part" />
        <button class="btn btn-primary" type="submit">Add friend</button></form>
      <div class="panel"><div class="fr-head"><h3>This week</h3><span class="muted small">Monday → Sunday</span></div><ul class="fr-list">${rows}</ul>
        ${board.length < 2 ? `<p class="fr-note">Nobody here yet. Your friends show up with their hours the moment they use your code.</p>` : ""}</div>
      <div class="panel"><div class="fr-head"><h3>What my friends can see</h3></div>
        <p class="muted small" style="margin:0 0 12px">Your name is always shown. Everything else is your choice. <b>Admins can always see everything</b> — that's how they help students.</p>
        <div class="priv-list">${FRIEND_PRIVACY.map(([k, t, d]) => `<label class="priv-row"><span><b>${t}</b><small>${d}</small></span><input type="checkbox" class="switch" data-priv="${k}" ${priv[k] ? "checked" : ""} /></label>`).join("")}</div></div>`;
    const A = document.getElementById("fr-a"), B = document.getElementById("fr-b"), clean = (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, "");
    A.oninput = () => { A.value = clean(A.value).slice(0, 4); if (A.value.length === 4) B.focus(); };
    B.oninput = () => { B.value = clean(B.value).slice(0, 2); };
    B.onkeydown = (ev) => { if (ev.key === "Backspace" && !B.value) A.focus(); };
    A.onpaste = (ev) => { const t = clean((ev.clipboardData || window.clipboardData).getData("text")); if (t.length >= 6) { ev.preventDefault(); const c = t.startsWith("MCH") ? t.slice(3) : t; A.value = c.slice(0, 4); B.value = c.slice(4, 6); B.focus(); } };
    document.getElementById("fr-copy").onclick = async (ev) => { try { await navigator.clipboard.writeText(code); ev.target.textContent = "Copied ✓"; setTimeout(() => (ev.target.textContent = "Copy code"), 1600); } catch { toast(code); } };
    document.getElementById("fr-form").onsubmit = async (ev) => {
      ev.preventDefault(); const f = body.querySelector(".fr-join"), shake = () => { f.classList.add("shake"); setTimeout(() => f.classList.remove("shake"), 500); };
      if (A.value.length < 4 || B.value.length < 2) return shake();
      const { data, error } = await DB.client.rpc("add_friend", { code: `MCH-${A.value}-${B.value}` });
      if (error || !data?.ok) { shake(); return toast(data?.error || "Couldn't add that friend.", "error"); }
      toast(`${data.name || "Friend"} added 🎉`); Friends.render();
    };
    body.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = async () => { if (!confirm("Remove this friend?")) return; await DB.client.rpc("remove_friend", { fid: b.dataset.rm }); Friends.render(); }));
    body.querySelectorAll("[data-priv]").forEach((c) => (c.onchange = async () => {
      const ok = await FriendPrivacy.set(user, { [c.dataset.priv]: c.checked });
      toast(ok ? "Saved. Friends see the change right away." : "Saved on this device — run sql/phase6.sql so friends actually see it.", ok ? undefined : "error");
    }));
  },
};

// ---- Safe delete: removes a study session / pomodoro after re-checking the password ----
const Safe = {
  async hasPassword() { const { data } = await DB.client.auth.getUser(); return !!data?.user?.identities?.some((i) => i.provider === "email"); },
  async verifyPassword(email, password) {   // checked on a throw-away client so the real login session is never touched
    const c = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { error } = await c.auth.signInWithPassword({ email, password }); return !error;
  },
  ask({ title, message, confirmLabel = "Delete" }) {
    return new Promise(async (resolve) => {
      const pw = await this.hasPassword(), { data } = await DB.client.auth.getUser(), email = data?.user?.email;
      openModal(`<form id="safe-form"><h3>${title}</h3><p class="muted">${message}</p>
        <label class="field-label" for="safe-input">${pw ? "Your password" : "Type DELETE to confirm"}</label>
        <input class="input" id="safe-input" ${pw ? 'type="password" autocomplete="current-password"' : 'type="text" autocomplete="off" placeholder="DELETE"'} required />
        <p class="safe-err" id="safe-err" role="alert"></p>
        <div class="modal-actions"><button type="button" class="btn btn-ghost" id="safe-cancel">Cancel</button><button class="btn btn-danger" type="submit" id="safe-ok">${confirmLabel}</button></div></form>`);
      const input = document.getElementById("safe-input"), err = document.getElementById("safe-err"); input.focus();
      document.getElementById("safe-cancel").onclick = () => { closeModal(); resolve(false); };
      document.getElementById("safe-form").onsubmit = async (ev) => {
        ev.preventDefault(); const ok = document.getElementById("safe-ok"); ok.disabled = true; err.textContent = "";
        const good = pw ? await this.verifyPassword(email, input.value) : input.value.trim().toUpperCase() === "DELETE";
        if (!good) { err.textContent = pw ? "That password isn't right." : "Type DELETE exactly."; ok.disabled = false; input.select(); return; }
        closeModal(); resolve(true);
      };
    });
  },
  // removes the record, the XP it earned and its activity-log line
  async deleteRecord(kind, id) {
    const table = kind === "pomodoro" ? "pomodoros" : "study_sessions";
    const ok = await this.ask({ title: kind === "pomodoro" ? "Delete this Pomodoro?" : "Delete this study session?", message: "This removes the record and the XP it earned. It can't be undone. Enter your password to confirm." });
    if (!ok) return false;
    const user = await DB.currentUser();
    const steps = [DB.client.from("xp_events").delete().eq("user_id", user.id).eq("ref_id", id), DB.client.from("activity_log").delete().eq("user_id", user.id).eq("ref_id", id)];
    for (const s of steps) { const { error } = await s; if (error) { toast("Couldn't delete that record.", "error"); return false; } }
    const { error } = await DB.client.from(table).delete().eq("user_id", user.id).eq("id", id);
    if (error) { toast("Couldn't delete that record.", "error"); return false; }
    DB._invalidate?.(table); toast("Record deleted."); return true;
  },
};
// any list can show a trash button: <button class="rec-del" data-del-kind="session|pomodoro" data-del-id="…">
document.addEventListener("click", async (e) => {
  const b = e.target.closest?.(".rec-del"); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  if (await Safe.deleteRecord(b.dataset.delKind, b.dataset.delId)) { try { closeModal(); await go(currentPage); } catch {} }
});
