// ============================================================
// THEMES — colour palettes + Day/Night. Saved on this device.
// (The CSS for each palette lives at the bottom of style.css.)
// ============================================================
const PALETTES = [{"id": "vermilion", "name": "Vermilion", "tag": "The classic", "light": {"bg": "#f1eadb", "ac": "#b3261e", "s": "#faf6ec"}, "dark": {"bg": "#0b0a0b", "ac": "#e2483b", "s": "#141213"}}, {"id": "sakura", "name": "Sakura", "tag": "Soft pink", "light": {"bg": "#f6ecee", "ac": "#c2417a", "s": "#fdf6f7"}, "dark": {"bg": "#0d0a0c", "ac": "#f0679f", "s": "#171114"}}, {"id": "matcha", "name": "Matcha", "tag": "Calm green", "light": {"bg": "#eaeee0", "ac": "#3f7d4e", "s": "#f6f8ee"}, "dark": {"bg": "#090c0a", "ac": "#6cc287", "s": "#121814"}}, {"id": "ocean", "name": "Ocean", "tag": "Cool blue", "light": {"bg": "#e8eef3", "ac": "#1f6fb2", "s": "#f4f8fb"}, "dark": {"bg": "#080b10", "ac": "#4da3ff", "s": "#10151d"}}, {"id": "wisteria", "name": "Wisteria", "tag": "Deep violet", "light": {"bg": "#eeeaf4", "ac": "#6d4bc4", "s": "#f8f5fc"}, "dark": {"bg": "#0a090e", "ac": "#a58bff", "s": "#131119"}}, {"id": "amber", "name": "Sunset", "tag": "Warm amber", "light": {"bg": "#f5ebdc", "ac": "#c2570f", "s": "#fcf5e8"}, "dark": {"bg": "#0d0a07", "ac": "#ff9a3d", "s": "#17120d"}}, {"id": "graphite", "name": "Graphite", "tag": "Minimal mono", "light": {"bg": "#ecebe8", "ac": "#2b2b2b", "s": "#f7f6f3"}, "dark": {"bg": "#0a0a0a", "ac": "#e8e8e8", "s": "#141414"}}];

const Themes = {
  id() { try { return localStorage.getItem("palette") || "vermilion"; } catch { return "vermilion"; } },
  mode() { return document.documentElement.getAttribute("data-theme") || "dark"; },
  apply(id) {
    document.documentElement.setAttribute("data-palette", id);
    try { localStorage.setItem("palette", id); } catch {}
    const p = PALETTES.find((x) => x.id === id) || PALETTES[0];
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", p[this.mode()].bg);
  },
  next() {
    const i = PALETTES.findIndex((p) => p.id === this.id());
    const p = PALETTES[(i + 1) % PALETTES.length];
    this.apply(p.id);
    toast(`Theme: ${p.name}`);
  },
  // the picker shown in Settings
  html() {
    const m = this.mode(), cur = this.id();
    return `<div class="panel settings-section" id="appearance-panel">
      <h3>Appearance</h3>
      <p class="settings-hint">Choose a colour theme and Day or Night. Saved on this device.</p>
      <div class="mode-row" role="group" aria-label="Day or night">
        <button type="button" class="chip${m === "light" ? " on" : ""}" data-mode="light">☀️ Day</button>
        <button type="button" class="chip${m === "dark" ? " on" : ""}" data-mode="dark">🌙 Night</button>
      </div>
      <div class="theme-grid">${PALETTES.map((p) => `
        <button type="button" class="theme-card${p.id === cur ? " on" : ""}" data-palette-id="${p.id}" aria-pressed="${p.id === cur}">
          <span class="theme-prev" style="background:${p[m].bg}"><i style="background:${p[m].s}"></i><b style="background:${p[m].ac}"></b><em style="background:${p[m].ac}"></em></span>
          <strong>${p.name}</strong><small>${p.tag}</small>
        </button>`).join("")}</div>
      ${this.fallHtml()}
    </div>`;
  },

  // ---- "Falling effect" customiser: what falls, how much, how fast … ----
  fallHtml() {
    const c = Fall.get();
    const sl = (key, label, min, max, step, fmt) => `<label class="fall-row"><span>${label}<b id="fv-${key}">${fmt(c[key])}</b></span><input type="range" class="fall-range" data-fall="${key}" min="${min}" max="${max}" step="${step}" value="${c[key]}" /></label>`;
    return `<div class="fall-box" id="fall-box">
      <h4>Falling effect <small>落ち葉</small></h4>
      <p class="settings-hint">Choose what drifts across the background and tune it any way you like.</p>
      <div class="fall-types" role="group" aria-label="What falls">${FALL_TYPES.map((t) => `<button type="button" class="chip${c.type === t.id ? " on" : ""}" data-fall-type="${t.id}">${t.icon} ${t.name}</button>`).join("")}</div>
      <div class="fall-sliders">
        ${sl("amount", "How many", 0, 80, 1, (v) => v)}
        ${sl("speed", "Fall speed", 0.3, 2.5, 0.1, (v) => Number(v).toFixed(1) + "×")}
        ${sl("size", "Size", 0.5, 2.2, 0.1, (v) => Number(v).toFixed(1) + "×")}
        ${sl("sway", "Wind / sway", 0, 2.5, 0.1, (v) => Number(v).toFixed(1) + "×")}
        ${sl("opacity", "Visibility", 0.15, 1, 0.05, (v) => Math.round(v * 100) + "%")}
      </div>
      <div class="fall-toggles">
        <label class="fall-check"><input type="checkbox" data-fall-flag="spin" ${c.spin ? "checked" : ""} /> <span>Tumble as they fall</span></label>
        <label class="fall-check"><input type="checkbox" data-fall-flag="front" ${c.front ? "checked" : ""} /> <span>Show in front of content</span></label>
        <button type="button" class="link-btn" id="fall-reset">Reset to default</button>
      </div>
    </div>`;
  },
  wireFall() {
    const box = document.getElementById("fall-box");
    if (!box) return;
    const fmt = { amount: (v) => v, speed: (v) => Number(v).toFixed(1) + "×", size: (v) => Number(v).toFixed(1) + "×", sway: (v) => Number(v).toFixed(1) + "×", opacity: (v) => Math.round(v * 100) + "%" };
    let t = 0;
    box.querySelectorAll("[data-fall-type]").forEach((b) => (b.onclick = () => {
      box.querySelectorAll("[data-fall-type]").forEach((x) => x.classList.toggle("on", x === b));
      const patch = { type: b.dataset.fallType };
      if (patch.type !== "none" && Fall.get().amount === 0) patch.amount = 14;
      Fall.set(patch);
      if (patch.amount) { box.querySelector('[data-fall="amount"]').value = 14; document.getElementById("fv-amount").textContent = 14; }
    }));
    box.querySelectorAll("[data-fall]").forEach((r) => (r.oninput = () => {
      const k = r.dataset.fall, v = Number(r.value);
      document.getElementById("fv-" + k).textContent = fmt[k](v);
      if (k === "opacity") { Fall.set({ opacity: v }); return; } // live, no rebuild needed
      clearTimeout(t); t = setTimeout(() => Fall.set({ [k]: v }), 120);
    }));
    box.querySelectorAll("[data-fall-flag]").forEach((c) => (c.onchange = () => Fall.set({ [c.dataset.fallFlag]: c.checked })));
    box.querySelector("#fall-reset").onclick = () => { Fall.reset(); this.refresh(); toast("Falling effect reset."); };
  },
  wire() {
    const root = document.getElementById("appearance-panel");
    if (!root) return;
    root.querySelectorAll("[data-mode]").forEach((b) => (b.onclick = () => {
      try { localStorage.setItem("theme", b.dataset.mode); } catch {}
      applyTheme(b.dataset.mode); this.apply(this.id()); this.refresh();
    }));
    root.querySelectorAll("[data-palette-id]").forEach((b) => (b.onclick = () => { this.apply(b.dataset.paletteId); this.refresh(); }));
    this.wireFall();
  },
  refresh() {
    const old = document.getElementById("appearance-panel");
    if (!old) return;
    old.outerHTML = this.html();
    this.wire();
  },
};
