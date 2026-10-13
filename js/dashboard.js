// ============================================================
// DASHBOARD
// ============================================================

// ---- quick-access buttons the user can add / remove / reorder ----
const QUICK = {
  task: { label: "+ Add Task", run: async () => { await go("tasks"); Tasks.openForm(); } },
  study: { label: "▶ Start Study", run: () => { Study.activeTab = "timer"; go("study"); } },
  pomodoro: { label: "⏱ Pomodoro", run: () => { Study.activeTab = "pomodoro"; go("study"); } },
  test: { label: "+ Add Test", run: async () => { await go("tests"); if (Goals.list.some((g) => !g.archived)) Tests.openForm(); } },
  workout: { label: "+ Add Workout", run: async () => { Fitness.activeTab = "workouts"; await go("fitness"); Fitness.openWorkoutForm(); } },
  milestone: { label: "+ Add Milestone", run: async () => { await go("milestones"); Milestones.openForm(); } },
  weight: { label: "⚖ Log Weight", run: async () => { Fitness.activeTab = "measurements"; await go("fitness"); Fitness.openMeasurementForm("m-weight"); } },
  skill: { label: "+ Add Skill", run: async () => { await go("skills"); Skills.openForm(); } },
  focus: { label: "⛶ Focus Mode", run: async () => { Study.activeTab = "timer"; await go("study"); FX.toggleFocus(); } },
  games: { label: "🎮 Play a Game", run: () => go("games") },
  calendar: { label: "🗓 Calendar", run: () => go("calendar") },
  analysis: { label: "📈 Analysis", run: () => go("analysis") },
  theme: { label: "🎨 Next Theme", run: () => Themes.next() },
  export: { label: "⬇ Export Data", run: () => go("settings") },
};
const QUICK_DEFAULT = ["task", "study", "pomodoro", "test", "workout", "milestone"];

// ---- dashboard widgets ----
const DASH_WIDGETS = {
  overview: { title: "Today's Overview", el: "today-overview" },
  checklist: { title: "Today's Checklist", el: "w-checklist" },
  ring: { title: "Daily Study Target", el: "w-ring" },
  weekly: { title: "Weekly Study", el: "weekly-study" },
  streak: { title: "This Week", el: "w-week" },
  tests: { title: "Recent Tests", el: "recent-tests" },
  activity: { title: "Recent Activity", el: "recent-activity" },
  quote: { title: "Daily Push", el: "w-quote" },
};
const DASH_ORDER = ["quote", ...Object.keys(DASH_WIDGETS).filter((k) => k !== "quote")];
const PUSH_LINES = [
  "Small steps, every day. That's the whole secret.", "Future you is watching. Make them proud.", "Done is better than perfect. Start the timer.",
  "One focused hour beats five distracted ones.", "You don't need motivation — you need the next tiny step.", "Consistency is quiet, and it wins.",
  "Hard now, easy later.", "Show up today. Results will catch up.", "Progress, not perfection.", "Break it down. Then knock it down.",
  "Your streak is a promise to yourself.", "Rest is part of the plan. So is starting again.", "The best time to study was yesterday. The next best is now.", "Level up a little today.",
];

// ---- drag-to-reorder (mouse, pen and touch) ----
function makeSortable(container, itemSel, { handleSel = null, onEnd }) {
  container.addEventListener("pointerdown", (e) => {
    if (!container.closest(".editing") || e.button > 0) return;
    if (e.target.closest(".dw-x, .qa-x")) return;
    const item = e.target.closest(itemSel);
    if (!item || !container.contains(item) || (handleSel && !e.target.closest(handleSel))) return;
    e.preventDefault();
    const r0 = item.getBoundingClientRect(), gx = e.clientX - r0.left, gy = e.clientY - r0.top;
    item.classList.add("dragging");
    const pid = e.pointerId;
    // listeners live on document: moving the item in the DOM would drop pointer capture
    const move = (ev) => {
      if (ev.pointerId !== pid) return;
      item.style.transform = "";
      const over = [...container.querySelectorAll(itemSel)].find((o) => {
        if (o === item) return false;
        const r = o.getBoundingClientRect();
        return ev.clientX > r.left && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom;
      });
      if (over) container.insertBefore(item, item.compareDocumentPosition(over) & Node.DOCUMENT_POSITION_FOLLOWING ? over.nextSibling : over);
      const n = item.getBoundingClientRect();
      item.style.transform = `translate(${ev.clientX - gx - n.left}px, ${ev.clientY - gy - n.top}px)`;
    };
    const up = (ev) => {
      if (ev.pointerId !== pid) return;
      item.classList.remove("dragging"); item.style.transform = "";
      document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
      onEnd();
    };
    document.addEventListener("pointermove", move); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
  });
}

const Dashboard = {
  editing: false,
  lastLevel: null,

  layout(uid) {
    let l = {};
    try { l = JSON.parse(localStorage.getItem(`dash:layout:${uid}`)) || {}; } catch {}
    let order = (l.order || []).filter((id) => DASH_WIDGETS[id]);
    DASH_ORDER.forEach((id) => { if (!order.includes(id)) order.push(id); });
    let moved = false; try { moved = localStorage.getItem(`dash:pushtop:${uid}`) === "1"; } catch {}
    if (!moved) { order = ["quote", ...order.filter((id) => id !== "quote")]; try { localStorage.setItem(`dash:pushtop:${uid}`, "1"); l.order = order; localStorage.setItem(`dash:layout:${uid}`, JSON.stringify({ ...l, order })); } catch {} }
    return { order, hidden: (l.hidden || []).filter((id) => DASH_WIDGETS[id]), quick: (l.quick || QUICK_DEFAULT).filter((id) => QUICK[id]) };
  },
  saveLayout(uid, l) { try { localStorage.setItem(`dash:layout:${uid}`, JSON.stringify(l)); } catch {} },
  target(uid) { try { return Number(localStorage.getItem(`dash:target:${uid}`)) || 120; } catch { return 120; } },

  async render() {
    const user = await DB.currentUser();
    if (!user) return;
    this._sessions = null;
    const [{ data: profile }, { data: streak }, totalXP, settings] = await Promise.all([
      DB.client.from("profiles").select("name").eq("id", user.id).single(),
      DB.client.from("streaks").select("*").eq("user_id", user.id).single(),
      getTotalXP(),
      DB.getSettings(),
    ]);
    const progress = xpProgress(totalXP);
    const streakNow = effectiveStreak(streak, settings);
    if (Dashboard.lastLevel && progress.level > Dashboard.lastLevel) toast(`🎉 Level ${progress.level} reached!`);
    Dashboard.lastLevel = progress.level;
    const L = this.layout(user.id);

    const el = document.getElementById("page-dashboard");
    el.classList.toggle("editing", this.editing);
    el.innerHTML = `
      <div class="dash-header">
        <h1>${greeting()}, ${escapeHtml(profile?.name || "there")}</h1>
        <div class="dash-header-stats">
          <span class="streak-pill">🔥 ${streakNow} day streak</span>
          <span class="level-pill">⭐ Level ${progress.level}</span>
        </div>
      </div>

      <div class="xp-panel">
        <div class="xp-row"><span>${totalXP.toLocaleString()} XP</span><span class="muted">${progress.xpToNext} XP to Level ${progress.level + 1}</span></div>
        <div class="xp-bar"><div class="xp-bar-fill" style="width:${progress.progressPct}%"></div></div>
        <div class="xp-row muted small"><span>Best streak: ${streak?.longest_streak || 0} days</span></div>
      </div>

      <div class="dash-toolbar">
        <span class="muted small">${this.editing ? "Drag to reorder · ✕ to hide" : "Your quick access"}</span>
        <button class="btn btn-ghost" id="dash-edit">${this.editing ? "✓ Done" : "✎ Customize"}</button>
      </div>
      <div class="quick-actions" id="quick-actions">
        ${L.quick.map((id) => `<button class="qa-btn" id="qa-${id}" data-qa="${id}">${QUICK[id].label}<span class="qa-x" data-x="${id}" aria-label="Remove">✕</span></button>`).join("")}
      </div>
      <div id="dash-tray"></div>

      <div class="dash-grid" id="dash-grid">
        ${L.order.filter((id) => !L.hidden.includes(id)).map((id) => `
          <div class="panel dash-widget" data-w="${id}">
            <div class="dw-tools"><span class="dw-grip" title="Drag to move" aria-label="Drag to move">⠿</span><button class="dw-x" data-hide="${id}" aria-label="Hide ${DASH_WIDGETS[id].title}">✕</button></div>
            <h3>${DASH_WIDGETS[id].title}</h3>
            <div id="${DASH_WIDGETS[id].el}"><p class="empty-state">Loading…</p></div>
          </div>`).join("")}
      </div>
    `;

    // quick actions run on click (in edit mode they are draggable / removable instead)
    el.querySelectorAll(".qa-btn").forEach((b) => (b.onclick = (e) => {
      if (this.editing) return;
      QUICK[b.dataset.qa].run();
    }));
    const commit = (patch) => { const l = { ...this.layout(user.id), ...patch }; this.saveLayout(user.id, l); return l; };
    el.querySelectorAll(".qa-x").forEach((x) => (x.onclick = (e) => { e.stopPropagation(); commit({ quick: this.layout(user.id).quick.filter((q) => q !== x.dataset.x) }); this.render(); }));
    el.querySelectorAll(".dw-x").forEach((x) => (x.onclick = () => { const l = this.layout(user.id); commit({ hidden: [...l.hidden, x.dataset.hide] }); this.render(); }));
    document.getElementById("dash-edit").onclick = () => { this.editing = !this.editing; this.render(); };
    makeSortable(document.getElementById("quick-actions"), ".qa-btn", { onEnd: () => commit({ quick: [...document.querySelectorAll("#quick-actions .qa-btn")].map((b) => b.dataset.qa) }) });
    makeSortable(document.getElementById("dash-grid"), ".dash-widget", {
      handleSel: ".dw-grip, h3",
      onEnd: () => {
        const shown = [...document.querySelectorAll("#dash-grid .dash-widget")].map((w) => w.dataset.w);
        const l = this.layout(user.id);
        commit({ order: [...shown, ...l.order.filter((id) => !shown.includes(id))] });
      },
    });
    if (this.editing) this.renderTray(user, L, commit);

    // each widget loads on its own, in parallel — one slow query doesn't hold the rest
    const shown = L.order.filter((id) => !L.hidden.includes(id));
    Promise.all(shown.map((id) => ({
      overview: () => this.renderTodayOverview(user), checklist: () => this.renderChecklist(user), ring: () => this.renderRing(user),
      weekly: () => this.renderWeeklyStudy(user), streak: () => this.renderWeekStrip(user), tests: () => this.renderRecentTests(user),
      activity: () => this.renderRecentActivity(user), quote: () => this.renderQuote(),
    }[id]())).map((p) => Promise.resolve(p).catch((e) => console.error("Dashboard widget failed", e))));
  },

  renderTray(user, L, commit) {
    const tray = document.getElementById("dash-tray");
    const hiddenW = L.order.filter((id) => L.hidden.includes(id));
    const freeQ = Object.keys(QUICK).filter((id) => !L.quick.includes(id));
    tray.innerHTML = `<div class="dash-tray">
      <div><b>Add widgets</b><div class="chip-row left">${hiddenW.length ? hiddenW.map((id) => `<button class="chip" data-add-w="${id}">+ ${DASH_WIDGETS[id].title}</button>`).join("") : `<span class="muted small">All widgets are showing.</span>`}</div></div>
      <div><b>Add quick actions</b><div class="chip-row left">${freeQ.length ? freeQ.map((id) => `<button class="chip" data-add-q="${id}">${QUICK[id].label.replace(/^\+ /, "")}</button>`).join("") : `<span class="muted small">All quick actions are in the bar.</span>`}</div></div>
      <div class="dash-tray-actions"><button class="btn btn-ghost" id="dash-reset">Reset layout</button></div>
    </div>`;
    tray.querySelectorAll("[data-add-w]").forEach((b) => (b.onclick = () => { commit({ hidden: L.hidden.filter((h) => h !== b.dataset.addW) }); this.render(); }));
    tray.querySelectorAll("[data-add-q]").forEach((b) => (b.onclick = () => { commit({ quick: [...L.quick, b.dataset.addQ] }); this.render(); }));
    document.getElementById("dash-reset").onclick = () => { try { localStorage.removeItem(`dash:layout:${user.id}`); } catch {} this.render(); };
  },

  // today's study seconds, fetched once per render and shared by two widgets
  todayStudy(user) {
    if (!this._sessions) {
      const { start } = dayBounds(todayStr());
      this._sessions = DB.list("study_sessions", { filters: { user_id: user.id }, columns: "start_time,duration_sec", gte: { start_time: start } }).catch(() => []);
    }
    return this._sessions;
  },

  async renderChecklist(user) {
    const el = document.getElementById("w-checklist");
    const today = todayStr();
    const rows = await DB.list("tasks", { filters: { user_id: user.id }, columns: "id,title,status,due_date", lte: { due_date: today }, order: "due_date", ascending: true, limit: 30 });
    if (!el) return;
    const open = rows.filter((t) => t.status !== "completed");
    const done = rows.filter((t) => t.status === "completed" && t.due_date === today).length;
    el.innerHTML = open.length
      ? `${open.slice(0, 6).map((t) => `<label class="dw-task"><input type="checkbox" data-id="${t.id}" /><span>${escapeHtml(t.title)}</span>${t.due_date < today ? "<em>overdue</em>" : ""}</label>`).join("")}
         <p class="muted small" style="margin-top:8px">${done} done today${open.length > 6 ? ` · ${open.length - 6} more` : ""}</p>`
      : `<p class="empty-state">${done ? `All ${done} done — nice work 🎉` : "Nothing due today. Add a task and it shows up here."}</p>`;
    el.querySelectorAll("input[data-id]").forEach((cb) => (cb.onchange = async () => {
      const id = cb.dataset.id, task = open.find((t) => t.id === id);
      cb.disabled = true;
      await DB.update("tasks", id, { status: "completed", completed_at: new Date().toISOString() });
      if (!(await alreadyRewarded("task_complete", id))) await DB.reward("xp_task", 10, "task_complete", "task", `Completed "${task.title}"`, id);
      toast("Task completed.");
      Tasks.list = [];
      this.renderChecklist(user); this.renderTodayOverview(user);
    }));
  },

  async renderRing(user) {
    const el = document.getElementById("w-ring");
    const sessions = await this.todayStudy(user);
    if (!el) return;
    const mins = Math.round(sessions.reduce((n, s) => n + s.duration_sec, 0) / 60), target = this.target(user.id);
    const f = Math.min(1, mins / target), C = 2 * Math.PI * 44;
    el.innerHTML = `<div class="ring-wrap">
      <svg viewBox="0 0 110 110" class="ring-svg" role="img" aria-label="${mins} of ${target} minutes"><circle cx="55" cy="55" r="44" class="ring-bg"/><circle cx="55" cy="55" r="44" class="ring-fg" id="ring-fg" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${C.toFixed(1)}" transform="rotate(-90 55 55)"/></svg>
      <div class="ring-text"><b>${mins}</b><span>/ ${target} min</span></div></div>
      <p class="muted small" style="text-align:center">${f >= 1 ? "Target reached 🎉" : `${target - mins} min to go`} · <button class="link-btn" id="ring-edit">Change target</button></p>`;
    requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById("ring-fg")?.setAttribute("stroke-dashoffset", (C * (1 - f)).toFixed(1))));
    document.getElementById("ring-edit").onclick = async () => {
      const v = Number(await promptDialog("Daily study target", "Minutes per day", String(target), "Save"));
      if (v >= 5 && v <= 1440) { try { localStorage.setItem(`dash:target:${user.id}`, String(Math.round(v))); } catch {} this.renderRing(user); }
    };
  },

  async renderWeekStrip(user) {
    const el = document.getElementById("w-week");
    const start = new Date(); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0);
    const rows = await DB.list("activity_log", { filters: { user_id: user.id }, columns: "occurred_at", gte: { occurred_at: start.toISOString() } });
    if (!el) return;
    const active = new Set(rows.map((r) => dayOf(r.occurred_at)));
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; });
    const n = days.filter((d) => active.has(localDateStr(d))).length;
    el.innerHTML = `<div class="wk-row">${days.map((d) => { const k = localDateStr(d); return `<div class="wk-day${active.has(k) ? " on" : ""}${k === todayStr() ? " today" : ""}"><i>${active.has(k) ? "✓" : ""}</i><b>${"SMTWTFS"[d.getDay()]}</b></div>`; }).join("")}</div>
      <p class="muted small" style="text-align:center;margin-top:10px">${n} of 7 days active</p>`;
  },

  // Daily Push stays covered until you move over it (tap on phones). Once uncovered it stays visible for the rest of the day;
  // tomorrow it is covered again with a new line.
  renderQuote() {
    const el = document.getElementById("w-quote");
    if (!el) return;
    const day = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 864e5);
    const key = `push:seen:${DB._user?.id || "x"}`, today = todayStr();
    let seen = false; try { seen = localStorage.getItem(key) === today; } catch {}
    el.innerHTML = `<div class="push-box${seen ? " revealed" : ""}" tabindex="0" role="button" aria-label="Today's push — move over it to read">
      <p class="push-line">“${PUSH_LINES[day % PUSH_LINES.length]}”</p>
      <div class="push-cover"><span class="push-kanji">今日</span><b>Today's push</b><small>Move your cursor here to uncover it</small></div></div>`;
    const box = el.querySelector(".push-box");
    const reveal = () => { if (box.classList.contains("revealed")) return; box.classList.add("revealed"); try { localStorage.setItem(key, today); } catch {} };
    box.addEventListener("pointerenter", reveal); box.addEventListener("pointerdown", reveal); box.addEventListener("focus", reveal);
  },

  async renderWeeklyStudy(user) {
    const el = document.getElementById("weekly-study");
    const start = new Date();
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    const sessions = await DB.list("study_sessions", {
      filters: { user_id: user.id }, columns: "start_time,duration_sec", gte: { start_time: start.toISOString() },
    });
    if (!el) return;
    if (!sessions.length) {
      el.innerHTML = `<p class="empty-state">No study time logged this week. Start a session and it shows up here.</p>`;
      return;
    }
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const labels = [];
    const hours = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayKey = localDateStr(d);
      const totalSec = sessions.filter((s) => dayOf(s.start_time) === dayKey).reduce((sum, s) => sum + s.duration_sec, 0);
      labels.push(days[d.getDay()]);
      hours.push(Math.round((totalSec / 3600) * 10) / 10);
    }
    renderBarChart(el, labels, hours, { formatter: (v) => v + "h" });
  },

  async renderTodayOverview(user) {
    const el = document.getElementById("today-overview");
    const today = todayStr();
    const [tasks, sessions] = await Promise.all([
      DB.list("tasks", { filters: { user_id: user.id, due_date: today }, columns: "status" }).catch(() => []),
      this.todayStudy(user),
    ]);
    if (!el) return;
    const doneToday = tasks.filter((t) => t.status === "completed").length;
    const todaySec = sessions.reduce((sum, s) => sum + s.duration_sec, 0);
    el.innerHTML = `
      <div class="overview-row"><span>Tasks due today</span><strong>${tasks.length}</strong></div>
      <div class="overview-row"><span>Completed today</span><strong>${doneToday}</strong></div>
      <div class="overview-row"><span>Study time today</span><strong>${todaySec ? fmtDuration(todaySec) : "0m"}</strong></div>
    `;
  },

  async renderRecentTests(user) {
    const el = document.getElementById("recent-tests");
    const [tests] = await Promise.all([
      DB.list("tests", { filters: { user_id: user.id }, order: "test_date", ascending: false, limit: 5 }),
      Goals.load(),
    ]);
    if (!el) return;
    if (!tests.length) {
      el.innerHTML = `<p class="empty-state">No tests recorded yet.</p>`;
      return;
    }
    el.innerHTML = tests
      .map((t) => {
        const goal = Goals.list.find((g) => g.id === t.goal_id);
        const percentage = t.total_marks ? pct(t.marks_obtained, t.total_marks) : null;
        return `<div class="mini-row">
          <span>${escapeHtml(t.name)}</span>
          <span class="muted">${escapeHtml(goal?.name || "")}</span>
          <span>${percentage !== null ? percentage + "%" : "—"}</span>
          <span class="muted">${fmtDate(t.test_date)}</span>
        </div>`;
      })
      .join("");
  },

  async renderRecentActivity(user) {
    const el = document.getElementById("recent-activity");
    const activity = await DB.list("activity_log", { filters: { user_id: user.id }, order: "occurred_at", ascending: false, limit: 8 });
    if (!el) return;
    if (!activity.length) {
      el.innerHTML = `<p class="empty-state">No activity yet. Complete a task or add a test to get started.</p>`;
      return;
    }
    el.innerHTML = activity
      .map((a) => `<div class="mini-row"><span>${escapeHtml(a.description)}</span><span class="muted">${fmtDate(a.occurred_at)}</span></div>`)
      .join("");
  },
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
