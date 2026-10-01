// ============================================================
// FLOATING TIMER — while a study timer or Pomodoro is running (or
// paused) a small window floats above every page. Drag it anywhere.
// "Pop out" (Chrome / Edge 116+) moves it into a real always-on-top
// window that stays above other apps too. The tab title also shows
// the time, so you can see it from another tab.
// ============================================================
const FloatTimer = {
  el: null, tick: null, pip: null, baseTitle: "", posKey: "ft:pos",

  init() {
    if (this.el) return;
    this.baseTitle = document.title;
    const el = (this.el = document.createElement("div"));
    el.id = "float-timer";
    el.className = "ft hidden";
    el.setAttribute("role", "region");
    el.setAttribute("aria-label", "Running timer");
    el.innerHTML = `
      <div class="ft-head"><span class="ft-dot"></span><span class="ft-label" id="ft-label">Focus</span>
        <button class="ft-icon" data-ft="pip" title="Pop out (stays on top of other apps)" aria-label="Pop out">⧉</button>
        <button class="ft-icon" data-ft="open" title="Open timer page" aria-label="Open timer page">↗</button></div>
      <div class="ft-time" id="ft-time">00:00</div>
      <div class="ft-bar"><i id="ft-bar"></i></div>
      <div class="ft-actions"><button class="btn btn-secondary" data-ft="toggle" id="ft-toggle">Pause</button><button class="btn btn-primary" data-ft="end" id="ft-end">Stop</button></div>`;
    document.body.appendChild(el);
    this.place();
    el.addEventListener("click", (e) => { const b = e.target.closest("[data-ft]"); if (b) this.act(b.dataset.ft); });
    this.drag(el);
    this.tick = setInterval(() => this.update(), 250);
    addEventListener("resize", () => this.place(true));
  },

  // what is running right now? (Pomodoro wins over the stopwatch)
  state() {
    const T = Study.timer, P = Study.pomo;
    const pomoActive = P.running || (P.totalSec && P.remainingSec > 0 && P.remainingSec < P.totalSec);
    if (pomoActive) {
      const rem = P.running && P.endAt ? Math.max(0, (P.endAt - Date.now()) / 1000) : P.remainingSec;
      return { kind: "pomo", running: P.running, text: fmtCountdown(Math.round(rem)), frac: 1 - rem / (P.totalSec || 1), label: P.phase === "work" ? "Focus" : "Break" };
    }
    if (T.running || T.elapsedMs > 0) {
      const ms = T.running ? Date.now() - T.startedAt : T.elapsedMs;
      return { kind: "timer", running: T.running, text: fmtStopwatch(ms), frac: (ms % 60000) / 60000, label: "Study" };
    }
    return null;
  },

  update() {
    const s = document.getElementById("app-shell")?.classList.contains("hidden") ? null : this.state();
    const onStudy = document.body.dataset.page === "study" && !this.pip;
    this.el.classList.toggle("hidden", !s || onStudy);
    this.el.classList.toggle("paused", !!s && !s.running);
    if (!s) { if (document.title !== this.baseTitle) document.title = this.baseTitle; return; }
    setDigits(this.el.querySelector("#ft-time"), s.text);
    this.el.querySelector("#ft-label").textContent = s.label + (s.running ? "" : " · paused");
    this.el.querySelector("#ft-bar").style.transform = `scaleX(${Math.min(1, Math.max(0, s.frac)).toFixed(3)})`;
    this.el.querySelector("#ft-toggle").textContent = s.running ? "Pause" : "Resume";
    this.el.querySelector("#ft-end").textContent = s.kind === "pomo" ? "Skip" : "Stop & Save";
    document.title = `${s.text} · ${s.label} — Michi`;
  },

  async act(what) {
    const s = this.state();
    if (what === "open") { this.closePip(); return go("study"); }
    if (what === "pip") return this.pip ? this.closePip() : this.popOut();
    if (!s) return;
    if (what === "toggle") {
      if (s.kind === "pomo") s.running ? Study.pausePomodoro() : Study.startPomodoro();
      else s.running ? Study.pauseTimer() : Study.startTimer();
    } else if (what === "end") {
      if (s.kind === "pomo") Study.advancePomodoroPhase(false);
      else { this.closePip(); await go("study"); Study.openSaveSession(); }
    }
    this.update();
  },

  // ---- always-on-top window (Document Picture-in-Picture) ----
  async popOut() {
    if (!("documentPictureInPicture" in window)) return toast("Pop-out needs Chrome or Edge 116+. The floating timer still works inside Michi.", "error");
    try {
      const w = await documentPictureInPicture.requestWindow({ width: 290, height: 190 });
      this.pip = w;
      [...document.styleSheets].forEach((ss) => {
        if (!ss.href) return;
        const l = w.document.createElement("link"); l.rel = "stylesheet"; l.href = ss.href; w.document.head.appendChild(l);
      });
      ["data-theme", "data-palette"].forEach((a) => w.document.documentElement.setAttribute(a, document.documentElement.getAttribute(a) || ""));
      w.document.body.className = "ft-pip";
      this.el.classList.add("in-pip");
      w.document.body.appendChild(this.el);
      w.addEventListener("pagehide", () => { this.el.classList.remove("in-pip"); document.body.appendChild(this.el); this.pip = null; this.place(true); this.update(); });
      this.update();
    } catch (e) { console.error(e); toast("Couldn't open the pop-out window.", "error"); }
  },
  closePip() { try { this.pip?.close(); } catch {} },

  // ---- position + dragging ----
  place(clamp) {
    let pos = null;
    try { pos = JSON.parse(localStorage.getItem(this.posKey)); } catch {}
    const w = this.el.offsetWidth || 230, h = this.el.offsetHeight || 150;
    let x = pos?.x ?? (innerWidth > 860 ? 250 : innerWidth - w - 16), y = pos?.y ?? innerHeight - h - (innerWidth > 860 ? 24 : 84);
    x = Math.min(Math.max(8, x), Math.max(8, innerWidth - w - 8)); y = Math.min(Math.max(8, y), Math.max(8, innerHeight - h - 8));
    this.el.style.left = x + "px"; this.el.style.top = y + "px";
  },
  drag(el) {
    el.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button") || el.classList.contains("in-pip")) return;
      const r = el.getBoundingClientRect(), gx = e.clientX - r.left, gy = e.clientY - r.top;
      el.setPointerCapture(e.pointerId); el.classList.add("dragging");
      const move = (ev) => {
        el.style.left = Math.min(Math.max(8, ev.clientX - gx), innerWidth - el.offsetWidth - 8) + "px";
        el.style.top = Math.min(Math.max(8, ev.clientY - gy), innerHeight - el.offsetHeight - 8) + "px";
      };
      const up = () => {
        el.classList.remove("dragging"); el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up);
        try { localStorage.setItem(this.posKey, JSON.stringify({ x: parseInt(el.style.left), y: parseInt(el.style.top) })); } catch {}
      };
      el.addEventListener("pointermove", move); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    });
  },
};
