// ============================================================
// NUDGES — friendly "the day is running out" alerts.
// Checks a few minutes after login, then every 20 min and when you
// come back to the tab. Each alert shows at most once per day per
// kind ("Later" hides it until tomorrow). All numbers come from the
// database; only the "hidden today" flags live in localStorage.
// ============================================================
const Nudges = {
  timer: null,
  running: false,

  start() {
    this.stop();
    this.running = true;
    setTimeout(() => this.check(), 3500);
    this.timer = setInterval(() => this.check(), 20 * 60 * 1000);
    this._vis = () => { if (!document.hidden) this.check(); };
    document.addEventListener("visibilitychange", this._vis);
  },
  stop() {
    this.running = false;
    clearInterval(this.timer);
    if (this._vis) document.removeEventListener("visibilitychange", this._vis);
    this.clear();
  },
  clear() {
    document.getElementById("nudge-wrap")?.remove();
  },

  seen(kind) { try { return localStorage.getItem(`nudge:${kind}`) === todayStr(); } catch { return false; } },
  hide(kind) { try { localStorage.setItem(`nudge:${kind}`, todayStr()); } catch {} },

  timeLeft(now = new Date()) {
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const mins = Math.max(0, Math.round((end - now) / 60000));
    return { text: `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`, elapsedPct: Math.round(((1440 - mins) / 1440) * 100) };
  },

  // opts.hour lets tests pretend it's evening
  async check(opts = {}) {
    if (!this.running || !DB._user || document.getElementById("app-shell").classList.contains("hidden")) return;
    const now = new Date(), hour = opts.hour ?? now.getHours(), user = DB._user, today = todayStr();
    const soon = localDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2));
    const { start } = dayBounds(today);
    let tasks = [], sessions = [], pomos = [], milestones = [], streak = null;
    try {
      [tasks, sessions, pomos, milestones, streak] = await Promise.all([
        DB.list("tasks", { filters: { user_id: user.id }, columns: "title,status,due_date", lte: { due_date: today } }),
        DB.list("study_sessions", { filters: { user_id: user.id }, columns: "duration_sec", gte: { start_time: start } }),
        DB.list("pomodoros", { filters: { user_id: user.id }, columns: "duration_min", gte: { completed_at: start } }),
        DB.list("milestones", { filters: { user_id: user.id }, columns: "title,deadline,status,progress", gte: { deadline: today }, lte: { deadline: soon } }),
        DB.client.from("streaks").select("*").eq("user_id", user.id).single().then((r) => r.data),
      ]);
    } catch (e) { console.error("Nudge check failed", e); return; }

    const open = tasks.filter((t) => t.status !== "completed");
    const dueToday = open.filter((t) => t.due_date === today);
    const overdue = open.filter((t) => t.due_date < today);
    const studied = sessions.length + pomos.length > 0;
    const grace = (await DB.getSettings())?.streak_grace_days ?? 0;
    const streakAtRisk = streak && streak.current_streak > 0 && streak.last_active_date !== today && effectiveStreak(streak, { streak_grace_days: grace }) > 0;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const late = hour >= 20;
    const list = [];

    if (streakAtRisk && hour >= 19)
      list.push({ kind: "streak", icon: "🔥", tone: "hot", title: `${streak.current_streak}-day streak on the line!`, text: pick(["Do one small thing before midnight and it's safe.", "One task, one Pomodoro — that's all it takes.", "Don't let the flame go out now."]), act: "Start a Pomodoro", go: () => { Study.activeTab = "pomodoro"; go("study"); } });
    if (dueToday.length && hour >= 16)
      list.push({ kind: "tasks", icon: late ? "🚨" : "🌇", tone: late ? "hot" : "warm", title: late ? "Last call for today's tasks" : "The day is almost over", text: `${dueToday.length} task${dueToday.length > 1 ? "s" : ""} still due today${dueToday[0] ? ` — "${dueToday[0].title}"${dueToday.length > 1 ? " and more" : ""}` : ""}.`, act: "Open tasks", go: () => go("tasks") });
    const ms = milestones.find((m) => m.status !== "completed" && m.status !== "archived");
    if (ms)
      list.push({ kind: "milestone", icon: "🏁", tone: "warm", title: ms.deadline === today ? "Milestone due today" : "Milestone due soon", text: `"${ms.title}" is at ${ms.progress || 0}%. ${pick(["Small push, big finish.", "You've got this."])}`, act: "Open milestones", go: () => go("milestones") });
    if (!studied && hour >= 15)
      list.push({ kind: "study", icon: "📚", tone: "cool", title: "No study logged yet", text: pick(["One Pomodoro is only 25 minutes.", "Even 15 minutes counts today.", "The timer is bored. Feed it."]), act: "Start studying", go: () => { Study.activeTab = "timer"; go("study"); } });
    if (overdue.length)
      list.push({ kind: "overdue", icon: "⏰", tone: "warm", title: `${overdue.length} overdue task${overdue.length > 1 ? "s" : ""}`, text: pick(["They're getting lonely.", "Clear one and feel lighter.", "Old tasks don't age well."]), act: "Fix it", go: () => go("tasks") });

    list.filter((n) => opts.force || !this.seen(n.kind)).slice(0, 2).forEach((n) => this.show(n));
  },

  show(n) {
    let wrap = document.getElementById("nudge-wrap");
    if (!wrap) { wrap = document.createElement("div"); wrap.id = "nudge-wrap"; document.body.appendChild(wrap); }
    if (wrap.querySelector(`[data-kind="${n.kind}"]`)) return;
    const tl = this.timeLeft();
    const el = document.createElement("div");
    el.className = `nudge nudge-${n.tone}`;
    el.dataset.kind = n.kind;
    el.setAttribute("role", "status");
    el.innerHTML = `
      <div class="nudge-ic" aria-hidden="true">${n.icon}</div>
      <div class="nudge-body">
        <strong>${escapeHtml(n.title)}</strong>
        <p>${escapeHtml(n.text)}</p>
        <div class="nudge-meter" title="Time left today"><i style="width:${tl.elapsedPct}%"></i></div>
        <span class="nudge-left">Day ends in ${tl.text}</span>
        <div class="nudge-actions"><button class="btn btn-primary" data-go>${escapeHtml(n.act)}</button><button class="btn btn-ghost" data-later>Later</button></div>
      </div>`;
    const dismiss = () => { this.hide(n.kind); el.classList.add("out"); setTimeout(() => { el.remove(); if (!wrap.children.length) wrap.remove(); }, 350); };
    el.querySelector("[data-go]").onclick = () => { dismiss(); n.go(); };
    el.querySelector("[data-later]").onclick = dismiss;
    wrap.appendChild(el);
  },
};
