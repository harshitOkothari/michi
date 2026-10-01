// ============================================================
// FX — the "feel" layer: ambient background, 3D card tilt, button
// ripple, confetti, Focus mode and the Ctrl+K quick-actions palette.
// Everything here is decoration or shortcuts — no data. It is switched
// off for people who set "reduce motion" in their system settings.
// ============================================================
// ============================================================
// FALL — the drifting leaves / petals / snow in the background.
// Every part of it is user-customisable in Settings → Appearance.
// ============================================================
const FALL_TYPES = [
  { id: "sakura", name: "Sakura petals", icon: "🌸" },
  { id: "maple", name: "Maple leaves", icon: "🍁" },
  { id: "ginkgo", name: "Ginkgo leaves", icon: "🍂" },
  { id: "bamboo", name: "Bamboo leaves", icon: "🎋" },
  { id: "snow", name: "Snow", icon: "❄️" },
  { id: "firefly", name: "Fireflies", icon: "✨" },
  { id: "mix", name: "Autumn mix", icon: "🍃" },
  { id: "none", name: "Nothing", icon: "—" },
];
const FALL_DEFAULTS = { type: "sakura", amount: 14, speed: 1, size: 1, sway: 1, opacity: 0.75, front: false, spin: true };

const Fall = {
  get() {
    try { return { ...FALL_DEFAULTS, ...(JSON.parse(localStorage.getItem("fall") || "{}")) }; } catch { return { ...FALL_DEFAULTS }; }
  },
  set(patch) {
    const v = { ...this.get(), ...patch };
    try { localStorage.setItem("fall", JSON.stringify(v)); } catch {}
    this.apply();
    return v;
  },
  reset() { try { localStorage.removeItem("fall"); } catch {} this.apply(); },
  apply() {
    const layer = document.getElementById("fall-layer");
    if (!layer) return;
    const c = this.get();
    layer.classList.toggle("front", !!c.front);
    layer.style.setProperty("--o", c.opacity);
    if (c.type === "none" || c.amount <= 0) { layer.innerHTML = ""; return; }
    const mixPool = ["maple", "ginkgo", "maple", "bamboo", "sakura"];
    const rnd = (a, b) => a + Math.random() * (b - a);
    const base = c.type === "firefly" ? 1 : c.type === "snow" ? 0.55 : 1;
    layer.innerHTML = Array.from({ length: Math.round(c.amount) }, () => {
      const t = c.type === "mix" ? mixPool[(Math.random() * mixPool.length) | 0] : c.type;
      const dur = (c.type === "firefly" ? rnd(9, 18) : rnd(13, 26)) / c.speed;
      const size = (t === "snow" ? rnd(4, 9) : t === "firefly" ? rnd(3, 6) : rnd(11, 22)) * c.size * base;
      const sway = rnd(3, 11) * c.sway * (Math.random() < 0.5 ? -1 : 1);
      const rot = c.spin ? rnd(180, 620) * (Math.random() < 0.5 ? -1 : 1) : 0;
      return `<b class="lf lf-${t}" style="--x:${rnd(-2, 100).toFixed(1)}%;--y:${rnd(4, 92).toFixed(0)}%;--s:${size.toFixed(1)}px;--t:${dur.toFixed(1)}s;--dl:-${rnd(0, dur).toFixed(1)}s;--sw:${sway.toFixed(1)}vw;--rot:${rot.toFixed(0)}deg"><i></i></b>`;
    }).join("");
  },
};

const FX = {
  reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  canHover: window.matchMedia("(hover: hover) and (pointer: fine)").matches,

  // floating "+N XP" where you last clicked
  floatXP(n) {
    if (this.reduced || !n) return;
    const el = document.createElement("div");
    el.className = "float-xp";
    el.textContent = `+${n} XP`;
    el.style.left = (this.px ?? innerWidth / 2) + "px";
    el.style.top = (this.py ?? innerHeight / 2) + "px";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  },

  init() {
    document.addEventListener("pointerdown", (e) => { this.px = e.clientX; this.py = e.clientY; }, { passive: true, capture: true });
    if (!this.reduced) {
      const amb = document.createElement("div");
      amb.className = "ambient";
      amb.setAttribute("aria-hidden", "true");
      amb.innerHTML = "<i></i><i></i><i></i>";
      document.body.prepend(amb);
      const fl = document.createElement("div");
      fl.className = "fall"; fl.id = "fall-layer"; fl.setAttribute("aria-hidden", "true");
      document.body.appendChild(fl);
      Fall.apply();
    }
    this.initStars();
    if (this.canHover && !this.reduced) this.initTilt();
    this.initRipple();
    this.initScroll();
    this.initPalette();
    document.addEventListener("click", (e) => { if (e.target.closest("[data-fx=focus]")) this.toggleFocus(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && document.body.classList.contains("focus-mode") && !document.getElementById("modal-backdrop")) this.toggleFocus(); });
  },

  // ---- 3D tilt: cards lean toward the pointer ----
  initTilt() {
    const SEL = ".dash-grid > .panel, .stat-card, .subject-card, .milestone-card, .workout-card, .qa-btn, .auth-preview-wrap";
    let el = null, raf = 0, ev = null;
    const apply = () => {
      raf = 0;
      if (!el || !ev) return;
      const r = el.getBoundingClientRect();
      const x = (ev.clientX - r.left) / r.width - 0.5, y = (ev.clientY - r.top) / r.height - 0.5;
      const max = el.classList.contains("qa-btn") ? 6 : el.classList.contains("auth-preview-wrap") ? 9 : 5;
      el.style.transform = `perspective(900px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg) translateY(-3px)`;
      el.style.setProperty("--mx", ((x + 0.5) * 100).toFixed(0) + "%");
      el.style.setProperty("--my", ((y + 0.5) * 100).toFixed(0) + "%");
    };
    const reset = (t) => { if (t) { t.style.transform = ""; t.classList.remove("tilting"); } };
    document.addEventListener("pointermove", (e) => {
      let t = e.target.closest?.(SEL) || (e.target.closest?.(".auth-brand-panel") && document.querySelector(".auth-preview-wrap"));
      if (t?.closest?.(".editing")) t = null;
      if (t !== el) { reset(el); el = t; if (el) el.classList.add("tilting"); }
      ev = e;
      if (el && !raf) raf = requestAnimationFrame(apply);
    }, { passive: true });
    document.addEventListener("pointerleave", () => { reset(el); el = null; }, true);
  },

  // little stars for the landing-page night sky
  initStars() {
    const box = document.querySelector(".ld-stars");
    if (box) box.innerHTML = Array.from({ length: 70 }, () => `<i style="left:${(Math.random() * 100).toFixed(1)}%;top:${(Math.random() * 48).toFixed(1)}%;--d:${(2 + Math.random() * 4).toFixed(1)}s;--dl:-${(Math.random() * 5).toFixed(1)}s;--z:${(0.6 + Math.random() * 1.5).toFixed(1)}px"></i>`).join("");
    // anime-style 4-point sparkles + a couple of shooting stars
    const sp = document.querySelector(".ld-sparks");
    if (sp) sp.innerHTML = Array.from({ length: 22 }, () => `<i class="sp" style="left:${(Math.random() * 100).toFixed(1)}%;top:${(8 + Math.random() * 62).toFixed(1)}%;--s:${(8 + Math.random() * 18).toFixed(0)}px;--d:${(3 + Math.random() * 5).toFixed(1)}s;--dl:-${(Math.random() * 8).toFixed(1)}s"></i>`).join("")
      + `<i class="sh" style="--dl:2s;top:8%;left:70%"></i><i class="sh" style="--dl:9s;top:16%;left:40%"></i>`;
  },

  // ---- scroll: progress bar, hero, reveal-on-scroll, counters ----
  // The hero / zoom values are *damped*: they glide toward where you scrolled
  // instead of jumping, which is what makes the landing page feel smooth.
  initScroll() {
    const bar = document.createElement("div");
    bar.id = "scroll-bar";
    document.body.appendChild(bar);
    const clamp = (n) => Math.min(1, Math.max(0, n));
    const hero = document.getElementById("ld-hero");
    const zooms = [...document.querySelectorAll("[data-zoom]")];
    const cur = { p: 0, z: 0, mx: 0, my: 0 }, tgt = { p: 0, z: 0, mx: 0, my: 0 };
    let queued = false, looping = false;

    const glide = () => {
      const k = this.reduced ? 1 : 0.075;
      cur.p += (tgt.p - cur.p) * k;
      cur.z += (tgt.z - cur.z) * k;
      cur.mx += (tgt.mx - cur.mx) * 0.06; cur.my += (tgt.my - cur.my) * 0.06;
      if (Math.abs(tgt.mx - cur.mx) < 0.001) cur.mx = tgt.mx;
      if (Math.abs(tgt.my - cur.my) < 0.001) cur.my = tgt.my;
      if (Math.abs(tgt.p - cur.p) < 0.0005) cur.p = tgt.p;
      if (Math.abs(tgt.z - cur.z) < 0.0005) cur.z = tgt.z;
      if (hero) { hero.style.setProperty("--p", cur.p.toFixed(4)); hero.style.setProperty("--mx", cur.mx.toFixed(4)); hero.style.setProperty("--my", cur.my.toFixed(4)); }
      zooms.forEach((el) => (el.closest(".ld-zoom") || el).style.setProperty("--z", cur.z.toFixed(4)));
      if (cur.p !== tgt.p || cur.z !== tgt.z || cur.mx !== tgt.mx || cur.my !== tgt.my) requestAnimationFrame(glide); else looping = false;
    };
    const update = () => {
      queued = false;
      const max = document.documentElement.scrollHeight - innerHeight;
      bar.style.setProperty("--sp", max > 0 ? clamp(scrollY / max).toFixed(4) : 0);
      if (hero && hero.offsetParent) tgt.p = clamp(-hero.getBoundingClientRect().top / (hero.offsetHeight - innerHeight));
      if (zooms[0]) { const r = zooms[0].parentElement.getBoundingClientRect(); tgt.z = clamp((innerHeight - r.top) / (innerHeight * 0.9 + r.height * 0.5)); }
      if (!looping) { looping = true; requestAnimationFrame(glide); }
    };
    const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
    // gentle depth: layers drift a few pixels with the pointer (landing page only)
    if (hero && this.canHover && !this.reduced) {
      addEventListener("pointermove", (e) => {
        if (!hero.offsetParent) return;
        tgt.mx = (e.clientX / innerWidth - 0.5) * 2; tgt.my = (e.clientY / innerHeight - 0.5) * 2;
        if (!looping) { looping = true; requestAnimationFrame(glide); }
      }, { passive: true });
    }
    // spotlight that follows the pointer across landing cards
    document.addEventListener("pointermove", (e) => {
      const c = e.target.closest?.(".ld-card");
      if (!c) return;
      const r = c.getBoundingClientRect();
      c.style.setProperty("--cx", (e.clientX - r.left) + "px"); c.style.setProperty("--cy", (e.clientY - r.top) + "px");
    }, { passive: true });
    addEventListener("scroll", queue, { passive: true });
    addEventListener("resize", queue);
    update();

    // things below the fold fade + zoom in when they arrive; things already on screen just appear
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add("in");
        const c = en.target.querySelector("[data-count]");
        if (c) this.countUp(c);
        io.unobserve(en.target);
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -6% 0px" });
    const CARD = ".panel, .record-card, .subject-card, .stat-card, .milestone-card, .workout-card";
    const watch = (el) => { if (!el.dataset.rv) { el.dataset.rv = "1"; io.observe(el); } };
    const scan = (root) => {
      root.querySelectorAll?.(".rv").forEach(watch);
      if (this.reduced) return;
      root.querySelectorAll?.(`.page ${CARD.split(",").join(", .page ")}`).forEach((el) => {
        if (el.dataset.rv) return;
        if (el.getBoundingClientRect().top < innerHeight) { el.dataset.rv = "1"; return; }
        el.classList.add("rv"); el.style.setProperty("--d", "0ms"); watch(el);
      });
    };
    scan(document);
    new MutationObserver((muts) => { if (muts.some((m) => m.addedNodes.length)) requestAnimationFrame(() => scan(document)); })
      .observe(document.body, { childList: true, subtree: true });
  },

  countUp(el) {
    const to = Number(el.dataset.count), t0 = performance.now();
    if (this.reduced) return (el.textContent = to);
    (function step(t) { const k = Math.min(1, (t - t0) / 1400); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); })(t0);
  },

  // ---- button ripple ----
  initRipple() {
    document.addEventListener("pointerdown", (e) => {
      const b = e.target.closest?.(".btn, .qa-btn, .tab");
      if (!b || b.disabled || this.reduced) return;
      const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 1.6;
      const s = document.createElement("span");
      s.className = "ripple";
      s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
      b.appendChild(s);
      setTimeout(() => s.remove(), 600);
    }, { passive: true });
  },

  // ---- confetti ----
  confetti(count = 90) {
    if (this.reduced) return;
    const cv = document.createElement("canvas");
    cv.className = "confetti";
    const W = (cv.width = innerWidth), H = (cv.height = innerHeight);
    document.body.appendChild(cv);
    const ctx = cv.getContext("2d");
    const colors = ["#c8352a", "#e2483b", "#d4b062", "#f2c6cf", "#ecc3a5", "#6cc287"];
    const ps = Array.from({ length: count }, () => ({
      x: W / 2 + (Math.random() - 0.5) * 160, y: H * 0.72,
      vx: (Math.random() - 0.5) * 11, vy: -(Math.random() * 12 + 7),
      s: Math.random() * 6 + 4, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
      c: colors[(Math.random() * colors.length) | 0],
    }));
    const t0 = performance.now();
    (function frame(t) {
      const k = t - t0;
      ctx.clearRect(0, 0, W, H);
      for (const p of ps) {
        p.vy += 0.32; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.globalAlpha = Math.max(0, 1 - k / 2200);
        ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      }
      if (k < 2200) requestAnimationFrame(frame); else cv.remove();
    })(t0);
  },

  // ---- Focus mode: just the timer, nothing else ----
  toggleFocus() {
    const on = document.body.classList.toggle("focus-mode");
    document.getElementById("focus-exit")?.remove();
    if (on) {
      const b = document.createElement("button");
      b.id = "focus-exit"; b.className = "btn btn-ghost"; b.textContent = "Exit focus (Esc)";
      b.dataset.fx = "focus";
      document.body.appendChild(b);
    }
  },

  // ---- Ctrl/Cmd + K palette ----
  actions() {
    const page = (label, p) => ({ label: "Go to " + label, run: () => go(p) });
    const goAnd = (p, fn) => async () => { await go(p); fn(); };
    return [
      page("Dashboard", "dashboard"), page("Goals", "goals"), page("Tests", "tests"), page("Study", "study"), page("Tasks", "tasks"),
      page("Fitness", "fitness"), page("Analysis", "analysis"), page("History", "history"), page("Milestones", "milestones"),
      page("Skills", "skills"), page("Calendar", "calendar"), page("Settings", "settings"),
      { label: "Add task", run: goAnd("tasks", () => Tasks.openForm()) },
      { label: "Add test", run: goAnd("tests", () => Tests.openForm()) },
      { label: "Log workout", run: goAnd("fitness", () => { Fitness.activeTab = "workouts"; Fitness.openWorkoutForm(); }) },
      { label: "Add milestone", run: goAnd("milestones", () => Milestones.openForm()) },
      { label: "Start Pomodoro", run: () => { Study.activeTab = "pomodoro"; go("study"); } },
      { label: "Start study timer", run: () => { Study.activeTab = "timer"; go("study"); } },
      { label: "Focus mode", run: () => { Study.activeTab = "timer"; go("study").then(() => this.toggleFocus()); } },
      { label: "Next colour theme", run: () => Themes.next() },
      { label: "Toggle day / night", run: () => document.getElementById("theme-toggle")?.click() },
      { label: "Log out", run: () => Auth.signOut() },
    ];
  },

  initPalette() {
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); this.openPalette(); }
    });
    document.addEventListener("click", (e) => { if (e.target.closest("#cmdk-btn")) this.openPalette(); });
  },

  openPalette() {
    if (document.getElementById("cmdk") || document.getElementById("app-shell").classList.contains("hidden")) return;
    const root = document.createElement("div");
    root.id = "cmdk";
    root.innerHTML = `<div class="cmdk-card" role="dialog" aria-label="Quick actions"><input id="cmdk-input" placeholder="Type a page or action…" autocomplete="off" /><div id="cmdk-list" role="listbox"></div><div class="cmdk-foot">↑↓ move · Enter open · Esc close</div></div>`;
    document.body.appendChild(root);
    const input = root.querySelector("input"), list = root.querySelector("#cmdk-list");
    const all = this.actions();
    let shown = all, idx = 0;
    const close = () => { root.remove(); document.removeEventListener("keydown", onKey, true); };
    const draw = () => {
      list.innerHTML = shown.length ? shown.map((a, i) => `<div class="cmdk-item${i === idx ? " on" : ""}" data-i="${i}" role="option">${escapeHtml(a.label)}</div>`).join("") : `<div class="cmdk-empty">Nothing matches.</div>`;
      list.querySelector(".on")?.scrollIntoView({ block: "nearest" });
    };
    const pick = (i) => { const a = shown[i]; if (!a) return; close(); a.run(); };
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); idx = Math.min(idx + 1, shown.length - 1); draw(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); idx = Math.max(idx - 1, 0); draw(); }
      else if (e.key === "Enter") { e.preventDefault(); pick(idx); }
    };
    document.addEventListener("keydown", onKey, true);
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      shown = q ? all.filter((a) => a.label.toLowerCase().includes(q)) : all; idx = 0; draw();
    });
    list.addEventListener("click", (e) => { const it = e.target.closest(".cmdk-item"); if (it) pick(Number(it.dataset.i)); });
    root.addEventListener("pointerdown", (e) => { if (e.target === root) close(); });
    draw(); input.focus();
  },
};
