// ============================================================
// CALENDAR — month grid. Clicking a date shows everything that
// happened or is due that day: tasks, study sessions, pomodoros,
// tests, workouts, milestone deadlines.
// All dates are the user's LOCAL calendar days.
// ============================================================

// What the person did each day shows up as little hanko-style stickers.
const STICKER_KEYS = ["study", "pomo", "task", "test", "workout", "mile"];
const STICKERS = {
  study:   { kj: "学", label: "Study",     cls: "stk-study" },
  pomo:    { kj: "時", label: "Pomodoro",  cls: "stk-pomo" },
  task:    { kj: "務", label: "Task done", cls: "stk-task" },
  test:    { kj: "試", label: "Test",      cls: "stk-test" },
  workout: { kj: "鍛", label: "Workout",   cls: "stk-workout" },
  mile:    { kj: "節", label: "Milestone", cls: "stk-mile" },
};

const Calendar = {
  viewDate: (() => { const d = new Date(); d.setDate(1); return d; })(),
  markedDates: new Set(),
  days: {},   // { "YYYY-MM-DD": { study: n, pomo: n, ..., xp: n, studySec: n } }

  shiftMonth(delta) {
    // always land on day 1 — setMonth() on the 31st used to skip whole months
    this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() + delta, 1);
    this.render();
  },

  async render() {
    const el = document.getElementById("page-calendar");
    const y = this.viewDate.getFullYear();
    const m = this.viewDate.getMonth();
    const monthLabel = this.viewDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

    el.innerHTML = `
      <div class="page-header">
        <h2>Calendar</h2>
        <div class="header-actions">
          <button class="btn btn-ghost" id="cal-prev" aria-label="Previous month">‹</button>
          <span class="cal-month-label">${monthLabel}</span>
          <button class="btn btn-ghost" id="cal-next" aria-label="Next month">›</button>
          <button class="btn btn-ghost" id="cal-today">Today</button>
        </div>
      </div>
      <div class="cal-summary" id="cal-summary"></div>
      <div class="cal-board"><div class="cal-grid" id="cal-grid"></div></div>
      <div class="cal-legend" id="cal-legend">${Object.values(STICKERS).map((t) => `<span><i class="stk stk-xs ${t.cls}">${t.kj}</i>${t.label}</span>`).join("")}</div>
      <div id="cal-detail" class="panel hidden"></div>
    `;
    document.getElementById("cal-prev").onclick = () => this.shiftMonth(-1);
    document.getElementById("cal-next").onclick = () => this.shiftMonth(1);
    document.getElementById("cal-today").onclick = () => { const n = new Date(); this.viewDate = new Date(n.getFullYear(), n.getMonth(), 1); this.render(); };

    this.renderGrid(y, m); // grid first, dots fill in when the data arrives
    await this.loadMonthMarkers(y, m);
    if (document.getElementById("cal-grid")) { this.renderGrid(y, m); this.renderSummary(); }
  },

  renderSummary() {
    const el = document.getElementById("cal-summary");
    if (!el) return;
    const t = { xp: 0, active: 0, study: 0, workout: 0, task: 0, studySec: 0 };
    Object.values(this.days).forEach((d) => {
      t.xp += d.xp || 0; t.studySec += d.studySec || 0;
      t.study += (d.study || 0) + (d.pomo || 0); t.workout += d.workout || 0; t.task += d.task || 0;
      if (STICKER_KEYS.some((k) => d[k])) t.active++;
    });
    const cell = (kj, v, l) => `<div class="cal-sum"><span class="cal-sum-kj">${kj}</span><b>${v}</b><span>${l}</span></div>`;
    el.innerHTML = cell("日", t.active, "active days") + cell("経", t.xp.toLocaleString(), "XP earned") + cell("学", fmtDuration(t.studySec) || "0m", "studied") + cell("鍛", t.workout, "workouts") + cell("務", t.task, "tasks done");
  },

  async loadMonthMarkers(y, m) {
    const user = await DB.currentUser();
    const pad = (n) => String(n).padStart(2, "0");
    const startDate = `${y}-${pad(m + 1)}-01`;
    const endDate = localDateStr(new Date(y, m + 1, 0));
    const startTs = new Date(y, m, 1).toISOString();
    const endTs = new Date(y, m + 1, 1).toISOString();
    const days = {};
    const bump = (day, key, n = 1) => { if (!day) return; (days[day] = days[day] || {})[key] = (days[day][key] || 0) + n; };

    const [tasks, tests, workouts, milestones, sessions, pomos, xp] = await Promise.all([
      DB.client.from("tasks").select("due_date, status, completed_at").eq("user_id", user.id).or(`and(due_date.gte.${startDate},due_date.lte.${endDate}),and(completed_at.gte.${startTs},completed_at.lt.${endTs})`),
      DB.client.from("tests").select("test_date").eq("user_id", user.id).gte("test_date", startDate).lte("test_date", endDate),
      DB.client.from("workouts").select("workout_date").eq("user_id", user.id).gte("workout_date", startDate).lte("workout_date", endDate),
      DB.client.from("milestones").select("deadline, status").eq("user_id", user.id).gte("deadline", startDate).lte("deadline", endDate),
      DB.client.from("study_sessions").select("start_time, duration_sec").eq("user_id", user.id).gte("start_time", startTs).lt("start_time", endTs),
      DB.client.from("pomodoros").select("completed_at, duration_min").eq("user_id", user.id).gte("completed_at", startTs).lt("completed_at", endTs),
      DB.client.from("xp_events").select("amount, created_at").eq("user_id", user.id).gte("created_at", startTs).lt("created_at", endTs),
    ]);

    // a finished task is stamped on the day it was completed; an open one is only a "due" dot
    (tasks.data || []).forEach((t) => {
      if (t.status === "completed") bump(t.completed_at ? dayOf(t.completed_at) : t.due_date, "task");
      else if (t.due_date) bump(String(t.due_date).slice(0, 10), "due");
    });
    (tests.data || []).forEach((r) => bump(String(r.test_date).slice(0, 10), "test"));
    (workouts.data || []).forEach((r) => bump(String(r.workout_date).slice(0, 10), "workout"));
    (milestones.data || []).forEach((r) => bump(String(r.deadline).slice(0, 10), r.status === "completed" ? "mile" : "due"));
    (sessions.data || []).forEach((r) => { const d = dayOf(r.start_time); bump(d, "study"); bump(d, "studySec", r.duration_sec || 0); });
    (pomos.data || []).forEach((r) => bump(dayOf(r.completed_at), "pomo"));
    (xp.data || []).forEach((r) => bump(dayOf(r.created_at), "xp", r.amount || 0));

    this.days = days;
    this.markedDates = new Set(Object.keys(days));
  },

  renderGrid(y, m) {
    const grid = document.getElementById("cal-grid");
    if (!grid) return;
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const today = todayStr();

    let cells = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => `<div class="cal-dow${i === 0 || i === 6 ? " we" : ""}">${d}</div>`).join("");
    for (let i = 0; i < firstDay; i++) cells += `<div class="cal-cell cal-empty"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const isToday = dateStr === today, isFuture = dateStr > today;
      const info = this.days[dateStr] || {};
      const keys = STICKER_KEYS.filter((k) => info[k]);
      const shown = keys.slice(0, 4);
      const stickers = shown.map((k, i) => {
        const n = info[k], t = STICKERS[k];
        return `<i class="stk ${t.cls}" style="--r:${[-7, 5, -3, 8][i]}deg;--i:${i}" title="${t.label}${n > 1 ? " ×" + n : ""}">${t.kj}${n > 1 ? `<em>${n}</em>` : ""}</i>`;
      }).join("");
      const perfect = keys.length >= 3;
      cells += `<button type="button" class="cal-cell${isToday ? " cal-today" : ""}${keys.length ? " has" : ""}${isFuture ? " future" : ""}${perfect ? " perfect" : ""}" data-date="${dateStr}" style="--cd:${(d % 7) * 40 + Math.floor(d / 7) * 30}ms" aria-label="${fmtDate(dateStr)}${keys.length ? ", " + keys.map((k) => STICKERS[k].label).join(", ") : ""}">
        <span class="cal-num">${d}</span>
        ${info.xp ? `<span class="cal-xp">+${info.xp}</span>` : ""}
        <span class="cal-stk">${stickers}</span>
        ${info.due && !isFuture ? "" : ""}${info.due ? '<span class="cal-dot" title="Something is due"></span>' : ""}
      </button>`;
    }
    grid.innerHTML = cells;
    grid.querySelectorAll(".cal-cell[data-date]").forEach((cell) => {
      cell.addEventListener("click", () => this.renderDetail(cell.dataset.date));
    });
  },

  async renderDetail(dateStr) {
    const detailEl = document.getElementById("cal-detail");
    detailEl.classList.remove("hidden");
    detailEl.innerHTML = `<p class="empty-state">Loading...</p>`;
    detailEl.scrollIntoView({ behavior: "smooth", block: "nearest" });

    const user = await DB.currentUser();
    const { start, end } = dayBounds(dateStr);
    const [tasks, tests, workouts, milestones, sessions, pomos] = await Promise.all([
      DB.client.from("tasks").select("*").eq("user_id", user.id).eq("due_date", dateStr),
      DB.client.from("tests").select("*").eq("user_id", user.id).eq("test_date", dateStr),
      DB.client.from("workouts").select("*").eq("user_id", user.id).eq("workout_date", dateStr),
      DB.client.from("milestones").select("*").eq("user_id", user.id).eq("deadline", dateStr),
      DB.client.from("study_sessions").select("*").eq("user_id", user.id).gte("start_time", start).lt("start_time", end),
      DB.client.from("pomodoros").select("*").eq("user_id", user.id).gte("completed_at", start).lt("completed_at", end),
    ]);

    const section = (title, rows, render) =>
      rows.length ? `<h4 class="admin-section-title">${title}</h4>${rows.map(render).join("")}` : "";

    const parts = [
      section("Tasks", tasks.data || [], (t) => `<div class="mini-row"><span>${t.status === "completed" ? "✅" : "⬜"} ${escapeHtml(t.title)}</span><span class="muted">${escapeHtml(t.category || "")}</span></div>`),
      section("Tests", tests.data || [], (t) => `<div class="mini-row"><span>${escapeHtml(t.name)}</span><span>${t.total_marks ? pct(t.marks_obtained, t.total_marks) + "%" : "—"}</span></div>`),
      section("Study Sessions", sessions.data || [], (s) => `<div class="mini-row"><span>${escapeHtml(s.topic_text || "Study session")}</span><span>${fmtDuration(s.duration_sec)}</span><button class=\"rec-del\" type=\"button\" data-del-kind=\"session\" data-del-id=\"${s.id}\" title=\"Delete (asks for your password)\" aria-label=\"Delete this session\">🗑</button></div>`),
      section("Pomodoros", pomos.data || [], (p) => `<div class="mini-row"><span>${escapeHtml(p.topic_text || "Pomodoro")}</span><span>${p.duration_min} min</span></div>`),
      section("Workouts", workouts.data || [], (w) => `<div class="mini-row"><span>${escapeHtml(w.workout_type || "Workout")}</span></div>`),
      section("Milestone Deadlines", milestones.data || [], (g) => `<div class="mini-row"><span>${escapeHtml(g.title)}</span><span>${g.progress}%</span></div>`),
    ].filter(Boolean);

    const info = this.days[dateStr] || {};
    const row = STICKER_KEYS.filter((k) => info[k]).map((k) => `<span class="stk ${STICKERS[k].cls}" title="${STICKERS[k].label}">${STICKERS[k].kj}</span>`).join("");
    detailEl.innerHTML = `<div class="cal-detail-head"><h3>${fmtDate(dateStr)}</h3><div class="cal-detail-stk">${row}${info.xp ? `<b class="cal-detail-xp">+${info.xp} XP</b>` : ""}</div></div>${parts.length ? parts.join("") : `<p class="empty-state">Nothing recorded for this day.</p>`}`;
  },
};
