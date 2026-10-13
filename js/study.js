// ============================================================
// STUDY — Timer (count-up stopwatch) + Pomodoro. Both can be
// tagged to any Goal + Subject + Topic, or left as "Personal"
// (no goal). State lives on this object so it survives
// switching tabs/pages without losing a running timer.
// ============================================================

const Study = {
  activeTab: "timer",
  displayMode: localStorage.getItem("clockDisplayMode") || "digital",

  // ---- stopwatch state ----
  timer: {
    running: false,
    startedAt: null,
    elapsedMs: 0,
    intervalId: null,
    goalId: "",
    subjectId: "",
    topicText: "",
  },

  // ---- pomodoro state ----
  pomo: {
    phase: "work", // work | short_break | long_break
    running: false,
    remainingSec: 0,
    intervalId: null,
    sessionsCompleted: 0,
    settings: null,
    goalId: "",
    subjectId: "",
    topicText: "",
  },

  async render() {
    await Goals.load();
    const el = document.getElementById("page-study");
    el.innerHTML = `
      <div class="page-header"><h2>Study</h2></div>
      <div class="tabs" id="study-tabs">
        <button class="tab ${this.activeTab === "timer" ? "active" : ""}" data-tab="timer">Timer</button>
        <button class="tab ${this.activeTab === "pomodoro" ? "active" : ""}" data-tab="pomodoro">Pomodoro</button>
      </div>
      <div id="study-body"></div>
      <div class="panel" id="study-history-panel">
        <h3>Recent Sessions</h3>
        <div id="study-history"></div>
      </div>
    `;
    document.querySelectorAll("#study-tabs .tab").forEach((t) => {
      t.onclick = () => {
        this.activeTab = t.dataset.tab;
        this.render();
      };
    });
    if (this.activeTab === "timer") this.renderTimer();
    else this.renderPomodoro();
    this.renderHistory();
  },

  toggleDisplayModeHtml() {
    return `
      <div class="display-mode-toggle">
        <button class="dm-btn ${this.displayMode === "digital" ? "active" : ""}" data-mode="digital">🔢 Digital</button>
        <button class="dm-btn ${this.displayMode === "analog" ? "active" : ""}" data-mode="analog">🕐 Analog</button>
        <button class="dm-btn" data-fx="focus" type="button">⛶ Focus</button>
      </div>`;
  },

  wireDisplayModeToggle(onChange) {
    document.querySelectorAll(".dm-btn[data-mode]").forEach((btn) => {
      btn.onclick = () => {
        this.displayMode = btn.dataset.mode;
        localStorage.setItem("clockDisplayMode", this.displayMode);
        onChange();
      };
    });
  },

  // ============================================================
  // GOAL/SUBJECT PICKER (shared markup for both timer & pomodoro)
  // ============================================================
  goalPickerHtml(prefix, state) {
    const activeGoals = Goals.list.filter((g) => !g.archived);
    return `
      <div class="tag-picker">
        <label>Goal
          <select id="${prefix}-goal">
            <option value="">Personal (no goal)</option>
            ${activeGoals.map((g) => `<option value="${g.id}" ${state.goalId === g.id ? "selected" : ""}>${escapeHtml(g.name)}</option>`).join("")}
          </select>
        </label>
        <label>Subject
          <select id="${prefix}-subject"><option value="">—</option></select>
        </label>
        <label>Topic
          <input id="${prefix}-topic" placeholder="optional" value="${escapeHtml(state.topicText || "")}" />
        </label>
      </div>`;
  },

  wireGoalPicker(prefix, state) {
    const goalSel = document.getElementById(`${prefix}-goal`);
    const subjSel = document.getElementById(`${prefix}-subject`);
    const topicInput = document.getElementById(`${prefix}-topic`);
    const refreshSubjects = () => {
      const subs = Goals.subjects.filter((s) => !s.archived && s.goal_id === goalSel.value);
      subjSel.innerHTML = `<option value="">—</option>` + subs.map((s) => `<option value="${s.id}" ${state.subjectId === s.id ? "selected" : ""}>${escapeHtml(s.name)}</option>`).join("");
    };
    goalSel.value = state.goalId || "";
    refreshSubjects();
    goalSel.onchange = () => { state.goalId = goalSel.value; state.subjectId = ""; refreshSubjects(); };
    subjSel.onchange = () => { state.subjectId = subjSel.value; };
    topicInput.oninput = () => { state.topicText = topicInput.value; };
  },

  // ============================================================
  // TIMER
  // ============================================================
  renderTimer() {
    const body = document.getElementById("study-body");
    const disabled = this.timer.running || this.timer.elapsedMs > 0;
    body.innerHTML = `
      <div class="panel timer-panel">
        ${this.toggleDisplayModeHtml()}
        <div id="timer-face">
          ${this.displayMode === "analog" ? `<div class="clock-face-wrap"></div>` : `<div class="timer-display" id="timer-display">${fmtStopwatch(this.timer.elapsedMs)}</div><div class="clock-bar"><i id="clock-bar-fill" style="transform:scaleX(${((this.timer.elapsedMs % 60000) / 60000).toFixed(3)})"></i></div>`}
        </div>
        <div class="timer-controls">
          ${!this.timer.running && this.timer.elapsedMs === 0 ? `<button class="btn btn-primary" id="timer-start">Start</button>` : ""}
          ${this.timer.running ? `<button class="btn btn-secondary" id="timer-pause">Pause</button>` : ""}
          ${!this.timer.running && this.timer.elapsedMs > 0 ? `<button class="btn btn-secondary" id="timer-resume">Resume</button>` : ""}
          ${this.timer.elapsedMs > 0 ? `<button class="btn btn-primary" id="timer-stop">Stop &amp; Save</button>` : ""}
          ${this.timer.elapsedMs > 0 && !this.timer.running ? `<button class="btn btn-ghost" id="timer-reset">Reset</button>` : ""}
        </div>
        <fieldset ${disabled ? "disabled" : ""} style="border:none;padding:0;margin-top:16px;">
          ${this.goalPickerHtml("timer", this.timer)}
        </fieldset>
      </div>
    `;
    this.wireDisplayModeToggle(() => this.renderTimer());
    if (this.displayMode === "analog") this.paintTimerFace();
    this.wireGoalPicker("timer", this.timer);
    document.getElementById("timer-start")?.addEventListener("click", () => this.startTimer());
    document.getElementById("timer-pause")?.addEventListener("click", () => this.pauseTimer());
    document.getElementById("timer-resume")?.addEventListener("click", () => this.startTimer());
    document.getElementById("timer-stop")?.addEventListener("click", () => this.openSaveSession());
    document.getElementById("timer-reset")?.addEventListener("click", () => {
      this.timer.elapsedMs = 0;
      this.renderTimer();
    });
  },

  paintTimerFace() {
    const wrap = document.querySelector("#timer-face .clock-face-wrap");
    if (wrap) renderAnalogClock(wrap, Math.floor(this.timer.elapsedMs / 1000), fmtStopwatch(this.timer.elapsedMs));
  },

  startTimer() {
    this.timer.running = true;
    this.timer.startedAt = Date.now() - this.timer.elapsedMs;
    this.timer.intervalId = setInterval(() => {
      this.timer.elapsedMs = Date.now() - this.timer.startedAt;
      if (this.displayMode === "analog") {
        this.paintTimerFace();
      } else {
        const disp = document.getElementById("timer-display");
        setDigits(disp, fmtStopwatch(this.timer.elapsedMs));
      }
    }, 1000);
    this.animateFace("timer");
    this.renderTimer();
  },

  // analog hands sweep smoothly (every frame) instead of jumping once a second
  animateFace(kind) {
    cancelAnimationFrame(this._raf);
    const step = () => {
      const t = kind === "timer" ? this.timer : this.pomo;
      if (!t.running) return;
      const fill = document.getElementById("clock-bar-fill");
      if (fill) {
        const f = kind === "timer" ? ((Date.now() - t.startedAt) % 60000) / 60000 : 1 - Math.max(0, t.endAt - Date.now()) / 1000 / (t.totalSec || 1);
        fill.style.transform = `scaleX(${Math.min(1, Math.max(0, f)).toFixed(4)})`;
      }
      if (this.displayMode === "analog") {
        const wrap = document.querySelector(kind === "timer" ? "#timer-face .clock-face-wrap" : "#pomo-face .clock-face-wrap");
        if (wrap) {
          if (kind === "timer") { const ms = Date.now() - t.startedAt; renderAnalogClock(wrap, ms / 1000, fmtStopwatch(ms)); }
          else { const ms = Math.max(0, t.endAt - Date.now()); renderAnalogClock(wrap, ms / 1000, fmtCountdown(Math.round(ms / 1000))); }
        }
      }
      this._raf = requestAnimationFrame(step);
    };
    this._raf = requestAnimationFrame(step);
  },

  pauseTimer() {
    this.timer.running = false;
    clearInterval(this.timer.intervalId);
    this.renderTimer();
  },

  openSaveSession() {
    if (this.timer.running) this.pauseTimer();
    const mins = Math.round(this.timer.elapsedMs / 60000);
    openModal(`
      <h3>Save Study Session</h3>
      <p class="modal-body-text">${mins} minute${mins === 1 ? "" : "s"} recorded.</p>
      <form id="save-session-form">
        <label>Notes<textarea id="session-notes" placeholder="optional"></textarea></label>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" id="ss-cancel">Discard</button>
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </form>
    `);
    document.getElementById("ss-cancel").onclick = () => {
      closeModal();
      this.timer.elapsedMs = 0;
      this.renderTimer();
    };
    document.getElementById("save-session-form").onsubmit = async (e) => {
      e.preventDefault();
      const durationSec = Math.round(this.timer.elapsedMs / 1000);
      if (durationSec < 10) {
        toast("Too short to save.");
        closeModal();
        this.timer.elapsedMs = 0;
        this.renderTimer();
        return;
      }
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - durationSec * 1000);
      const payload = {
        goal_id: this.timer.goalId || null,
        subject_id: this.timer.subjectId || null,
        topic_text: this.timer.topicText || null,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        duration_sec: durationSec,
        notes: document.getElementById("session-notes").value.trim(),
      };
      const saved = await DB.insert("study_sessions", payload);
      await DB.reward("xp_study_session", 15, "study_session", "study_session", `Studied for ${fmtDuration(durationSec)}`, saved.id);
      closeModal();
      toast("Study session saved.");
      this.timer.elapsedMs = 0;
      this.timer.subjectId = "";
      this.timer.topicText = "";
      this.render();
    };
  },

  // ============================================================
  // POMODORO
  // ============================================================
  async renderPomodoro() {
    if (!this.pomo.settings) {
      this.pomo.settings = await DB.getSettings();
      this.pomo.remainingSec = (this.pomo.settings?.pomodoro_work_min ?? 25) * 60; this.pomo.totalSec = this.pomo.remainingSec;
    }
    const s = this.pomo.settings;
    if (!this.pomo.today) await this.loadPomoToday();
    const { count: todayCount, minutes: todayMinutes } = this.pomo.today;

    const body = document.getElementById("study-body");
    const phaseLabel = { work: "Focus", short_break: "Short Break", long_break: "Long Break" }[this.pomo.phase];
    const disabled = this.pomo.running || this.pomo.sessionsCompleted > 0;

    body.innerHTML = `
      <div class="panel timer-panel">
        ${this.toggleDisplayModeHtml()}
        <div class="pomo-phase-label">${phaseLabel}</div>
        <div id="pomo-face">
          ${this.displayMode === "analog" ? `<div class="clock-face-wrap"></div>` : `<div class="timer-display" id="pomo-display">${fmtCountdown(this.pomo.remainingSec)}</div><div class="clock-bar"><i id="clock-bar-fill" style="transform:scaleX(${(1 - this.pomo.remainingSec / (this.pomo.totalSec || this.pomo.remainingSec || 1)).toFixed(3)})"></i></div>`}
        </div>
        <div class="timer-controls">
          ${!this.pomo.running ? `<button class="btn btn-primary" id="pomo-start">Start</button>` : `<button class="btn btn-secondary" id="pomo-pause">Pause</button>`}
          <button class="btn btn-ghost" id="pomo-skip">Skip</button>
          <button class="btn btn-ghost" id="pomo-reset">Reset</button>
        </div>
        <div class="pomo-stats-row">
          <span>Cycle: ${this.pomo.sessionsCompleted % s.pomodoro_sessions_before_long}/${s.pomodoro_sessions_before_long}</span>
          <span>Today: ${todayCount} pomodoros · ${fmtDuration(todayMinutes * 60)}</span>
        </div>
        <fieldset ${disabled ? "disabled" : ""} style="border:none;padding:0;margin-top:14px;">
          ${this.goalPickerHtml("pomo", this.pomo)}
        </fieldset>
        <details class="pomo-customize">
          <summary>Customize timings</summary>
          <div class="grid-form" style="margin-top:10px;">
            <label>Work (min)<input type="number" id="cfg-work" value="${s.pomodoro_work_min}" min="1" /></label>
            <label>Short break (min)<input type="number" id="cfg-short" value="${s.pomodoro_short_break_min}" min="1" /></label>
            <label>Long break (min)<input type="number" id="cfg-long" value="${s.pomodoro_long_break_min}" min="1" /></label>
            <label>Sessions before long break<input type="number" id="cfg-sessions" value="${s.pomodoro_sessions_before_long}" min="1" /></label>
            <button class="btn btn-secondary full" id="cfg-save" type="button">Save Timings</button>
          </div>
        </details>
      </div>
    `;
    this.wireGoalPicker("pomo", this.pomo);
    this.wireDisplayModeToggle(() => this.renderPomodoro());
    if (this.displayMode === "analog") this.paintPomoFace();
    document.getElementById("pomo-start")?.addEventListener("click", () => this.startPomodoro());
    document.getElementById("pomo-pause")?.addEventListener("click", () => this.pausePomodoro());
    document.getElementById("pomo-skip")?.addEventListener("click", () => this.advancePomodoroPhase(false));
    document.getElementById("pomo-reset")?.addEventListener("click", () => this.resetPomodoro());
    document.getElementById("cfg-save")?.addEventListener("click", async () => {
      const user2 = await DB.currentUser();
      const patch = {
        pomodoro_work_min: Number(document.getElementById("cfg-work").value) || 25,
        pomodoro_short_break_min: Number(document.getElementById("cfg-short").value) || 5,
        pomodoro_long_break_min: Number(document.getElementById("cfg-long").value) || 15,
        pomodoro_sessions_before_long: Number(document.getElementById("cfg-sessions").value) || 4,
      };
      await DB.client.from("user_settings").update(patch).eq("user_id", user2.id);
      this.pomo.settings = { ...this.pomo.settings, ...patch };
      this.resetPomodoro();
      toast("Pomodoro timings saved.");
    });
  },

  async loadPomoToday() {
    const user = await DB.currentUser();
    const { start } = dayBounds(todayStr());
    const rows = await DB.list("pomodoros", { filters: { user_id: user.id }, columns: "duration_min", gte: { completed_at: start } });
    this.pomo.today = { count: rows.length, minutes: rows.reduce((sum, p) => sum + (p.duration_min || 0), 0) };
  },

  startPomodoro() {
    this.pomo.running = true;
    // count down from a fixed end time so background-tab throttling can't slow the clock
    const endAt = (this.pomo.endAt = Date.now() + this.pomo.remainingSec * 1000);
    this.pomo.intervalId = setInterval(() => {
      this.pomo.remainingSec = Math.max(0, Math.round((endAt - Date.now()) / 1000));
      if (this.displayMode === "analog") {
        this.paintPomoFace();
      } else {
        const disp = document.getElementById("pomo-display");
        setDigits(disp, fmtCountdown(this.pomo.remainingSec));
      }
      if (this.pomo.remainingSec <= 0) {
        clearInterval(this.pomo.intervalId);
        this.advancePomodoroPhase(true);
      }
    }, 1000);
    this.animateFace("pomo");
    this.renderPomodoro();
  },

  paintPomoFace() {
    const wrap = document.querySelector("#pomo-face .clock-face-wrap");
    if (wrap) renderAnalogClock(wrap, this.pomo.remainingSec, fmtCountdown(this.pomo.remainingSec));
  },

  pausePomodoro() {
    this.pomo.running = false;
    clearInterval(this.pomo.intervalId);
    this.renderPomodoro();
  },

  async advancePomodoroPhase(completedNaturally) {
    clearInterval(this.pomo.intervalId);
    this.pomo.running = false;
    const s = this.pomo.settings;

    if (this.pomo.phase === "work") {
      if (completedNaturally) await this.saveCompletedPomodoro();
      this.pomo.sessionsCompleted++;
      const isLong = this.pomo.sessionsCompleted % s.pomodoro_sessions_before_long === 0;
      this.pomo.phase = isLong ? "long_break" : "short_break";
      this.pomo.remainingSec = (isLong ? s.pomodoro_long_break_min : s.pomodoro_short_break_min) * 60; this.pomo.totalSec = this.pomo.remainingSec;
    } else {
      this.pomo.phase = "work";
      this.pomo.remainingSec = s.pomodoro_work_min * 60; this.pomo.totalSec = this.pomo.remainingSec;
    }
    this.renderPomodoro();
    this.renderHistory();
  },

  async saveCompletedPomodoro() {
    const payload = {
      goal_id: this.pomo.goalId || null,
      subject_id: this.pomo.subjectId || null,
      topic_text: this.pomo.topicText || null,
      duration_min: this.pomo.settings.pomodoro_work_min,
      completed_at: new Date().toISOString(),
    };
    const saved = await DB.insert("pomodoros", payload);
    await DB.reward("xp_pomodoro", 10, "pomodoro", "pomodoro", `Completed a ${payload.duration_min}-minute Pomodoro`, saved.id);
    this.pomo.today = null; // recount next time the panel draws
    toast("Pomodoro complete. +XP");
  },

  resetPomodoro() {
    clearInterval(this.pomo.intervalId);
    this.pomo.running = false;
    this.pomo.phase = "work";
    this.pomo.sessionsCompleted = 0;
    this.pomo.remainingSec = (this.pomo.settings?.pomodoro_work_min ?? 25) * 60; this.pomo.totalSec = this.pomo.remainingSec;
    this.renderPomodoro();
  },

  // ============================================================
  // HISTORY (shared panel under both tabs)
  // ============================================================
  async renderHistory() {
    const el = document.getElementById("study-history");
    const user = await DB.currentUser();
    if (!user) return;
    const [sessions, pomos] = await Promise.all([
      DB.list("study_sessions", { filters: { user_id: user.id }, order: "start_time", ascending: false, limit: 8 }),
      DB.list("pomodoros", { filters: { user_id: user.id }, order: "completed_at", ascending: false, limit: 8 }),
    ]);

    const combined = [
      ...sessions.slice(0, 8).map((s) => ({ type: "Session", label: s.topic_text || "Study session", sub: fmtDuration(s.duration_sec), date: s.start_time, id: s.id, kind: "session" })),
      ...pomos.slice(0, 8).map((p) => ({ type: "Pomodoro", label: p.topic_text || "Pomodoro", sub: `${p.duration_min} min`, date: p.completed_at, id: p.id, kind: "pomodoro" })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);

    if (!combined.length) {
      el.innerHTML = `<p class="empty-state">No study sessions or Pomodoros yet.</p>`;
      return;
    }
    el.innerHTML = combined
      .map((r) => `<div class="mini-row"><span>${r.type === "Pomodoro" ? "⏱" : "📖"} ${escapeHtml(r.label)}</span><span>${r.sub}</span><span class="muted">${fmtDate(r.date)}</span><button class=\"rec-del\" type=\"button\" data-del-kind=\"${r.kind}\" data-del-id=\"${r.id}\" title=\"Delete (asks for your password)\" aria-label=\"Delete this record\">🗑</button></div>`)
      .join("");
  },
};

function fmtStopwatch(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0
    ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function fmtCountdown(sec) {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}
