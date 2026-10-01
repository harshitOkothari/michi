// ============================================================
// Shared UI helpers
// ============================================================

function toast(message, type = "") {
  const wrap = document.getElementById("toast-wrap");
  const el = document.createElement("div");
  el.className = "toast" + (type ? " toast-" + type : "");
  el.setAttribute("role", type === "error" ? "alert" : "status");
  el.textContent = message;
  if (!type && typeof FX !== "undefined") {
    if (/🎉|Level \d+ reached/.test(message)) FX.confetti(150);
    else if (/Pomodoro complete/.test(message)) FX.confetti(90);
    else if (/^Task completed/.test(message)) FX.confetti(35);
  }
  wrap.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  }, type === "error" ? 4500 : 2800);
}

function openModal(html) {
  const root = document.getElementById("modal-root");
  root.innerHTML = `<div class="modal-backdrop" id="modal-backdrop">
    <div class="modal-card" role="dialog" aria-modal="true">${html}</div>
  </div>`;
  const firstField = root.querySelector("input:not([type=hidden]):not([type=color]), textarea");
  if (firstField && !window.matchMedia("(hover: none)").matches) firstField.focus();
  root.querySelector("#modal-backdrop").addEventListener("click", (e) => {
    if (e.target.id === "modal-backdrop") closeModal();
  });
}

function closeModal() {
  CustomSelect.closeAll();
  document.getElementById("modal-root").innerHTML = "";
}

// small text-input dialog (replaces the browser's ugly prompt())
function promptDialog(title, label, initial = "", confirmLabel = "Save") {
  return new Promise((resolve) => {
    openModal(`
      <h3>${title}</h3>
      <form id="prompt-form">
        <label>${label}<input id="prompt-input" value="${escapeHtml(initial)}" required /></label>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" id="prompt-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary">${confirmLabel}</button>
        </div>
      </form>
    `);
    const input = document.getElementById("prompt-input");
    input.focus(); input.select();
    document.getElementById("prompt-cancel").onclick = () => { closeModal(); resolve(null); };
    document.getElementById("prompt-form").onsubmit = (e) => {
      e.preventDefault();
      const v = input.value.trim();
      closeModal();
      resolve(v || null);
    };
  });
}

function confirmDialog(title, body, confirmLabel = "Delete", danger = true) {
  return new Promise((resolve) => {
    openModal(`
      <h3>${title}</h3>
      <p class="modal-body-text">${body}</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="confirm-cancel">Cancel</button>
        <button class="btn ${danger ? "btn-danger" : "btn-primary"}" id="confirm-ok">${confirmLabel}</button>
      </div>
    `);
    document.getElementById("confirm-cancel").onclick = () => {
      closeModal();
      resolve(false);
    };
    document.getElementById("confirm-ok").onclick = () => {
      closeModal();
      resolve(true);
    };
  });
}

function fmtDate(d) {
  if (!d) return "";
  const date = new Date(d);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function pct(n, d) {
  if (!d) return 0;
  return Math.round((n / d) * 100);
}

function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// simple horizontal bar chart renderer (no external lib needed for Phase 1)
function renderBarChart(containerEl, labels, values, opts = {}) {
  const max = Math.max(...values, opts.min || 1);
  containerEl.innerHTML = labels
    .map((label, i) => {
      const v = values[i] || 0;
      const w = max ? Math.round((v / max) * 100) : 0;
      return `
      <div class="bar-row">
        <span class="bar-label">${escapeHtml(label)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${w}%"></div></div>
        <span class="bar-value">${opts.formatter ? opts.formatter(v) : v}</span>
      </div>`;
    })
    .join("");
}

function renderLineTrend(containerEl, values, { width = 320, height = 80 } = {}) {
  if (!values.length) {
    containerEl.innerHTML = `<p class="empty-state">No data yet.</p>`;
    return;
  }
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const stepX = width / Math.max(values.length - 1, 1);
  const points = values
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * (height - 10) - 5;
      return `${x},${y}`;
    })
    .join(" ");
  containerEl.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="trend-svg" preserveAspectRatio="none">
      <polyline points="${points}" fill="none" stroke="var(--accent)" stroke-width="2" />
      ${values
        .map((v, i) => {
          const x = i * stepX;
          const y = height - ((v - min) / range) * (height - 10) - 5;
          return `<circle cx="${x}" cy="${y}" r="3" fill="var(--accent)" />`;
        })
        .join("")}
    </svg>`;
}

// ============================================================
// ANALOG CLOCK FACE — used by the Study Timer / Pomodoro as an
// alternative to the digital readout. Behaves like a chronograph:
// the thin (second) hand sweeps once per 60s, the thick (minute)
// hand sweeps once per hour. A digital MM:SS readout sits below
// since reading exact elapsed/remaining time off hands alone is
// slow — this keeps both precision and the analog feel.
// ============================================================
function renderAnalogClock(containerEl, totalSeconds, label) {
  // build the face once; after that only the hands move (called every animation frame)
  if (!containerEl.querySelector(".analog-clock")) {
    const ticks = Array.from({ length: 12 }, (_, i) => {
      const a = (i * 30 * Math.PI) / 180;
      return `<line x1="${50 + 42 * Math.sin(a)}" y1="${50 - 42 * Math.cos(a)}" x2="${50 + 37 * Math.sin(a)}" y2="${50 - 37 * Math.cos(a)}" stroke="var(--text-muted)" stroke-width="${i % 3 === 0 ? 2 : 1}" />`;
    }).join("");
    containerEl.innerHTML = `
      <svg viewBox="0 0 100 100" class="analog-clock">
        <circle cx="50" cy="50" r="46" fill="var(--surface-alt)" stroke="var(--border)" stroke-width="1.5" />
        <circle class="ac-ring" cx="50" cy="50" r="46" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" pathLength="100" stroke-dasharray="100" transform="rotate(-90 50 50)" />
        ${ticks}
        <line class="ac-min" x1="50" y1="50" x2="50" y2="20" stroke="var(--text)" stroke-width="3" stroke-linecap="round" />
        <line class="ac-sec" x1="50" y1="50" x2="50" y2="12" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" />
        <circle cx="50" cy="50" r="2.5" fill="var(--accent)" />
      </svg>
      <div class="analog-clock-label"></div>`;
  }
  const sec = ((totalSeconds % 60) / 60) * 360;
  const min = ((totalSeconds % 3600) / 3600) * 360;
  containerEl.querySelector(".ac-sec").setAttribute("transform", `rotate(${sec.toFixed(2)} 50 50)`);
  containerEl.querySelector(".ac-min").setAttribute("transform", `rotate(${min.toFixed(2)} 50 50)`);
  containerEl.querySelector(".ac-ring").setAttribute("stroke-dashoffset", (100 - (totalSeconds % 60) / 0.6).toFixed(2));
  const lab = containerEl.querySelector(".analog-clock-label");
  if (lab.textContent !== label) lab.textContent = label;
}


// ============================================================
// DATE HELPERS — always the user's LOCAL calendar day.
// (new Date().toISOString() is UTC, which is "yesterday" in India
// between 12:00am and 5:30am and broke streaks/today/calendar.)
// ============================================================
function localDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function todayStr() { return localDateStr(new Date()); }
// local calendar day of an ISO timestamp coming back from the database
function dayOf(iso) { return iso ? localDateStr(new Date(iso)) : ""; }
// whole days between two YYYY-MM-DD strings (DST-safe)
function daysBetween(a, b) {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}
// ISO start/end (in UTC) of a local calendar day — for timestamp column filters
function dayBounds(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return { start: new Date(y, m - 1, d).toISOString(), end: new Date(y, m - 1, d + 1).toISOString() };
}

// ============================================================
// CUSTOM SELECT — replaces the browser's native <select> popup
// with a modern dropdown (rounded list, check on the selected
// item, keyboard support, bottom-sheet on phones).
// It's an enhancement layer: the real <select> stays in the DOM
// (visually hidden), so all existing code that reads .value,
// listens to "change" or rebuilds the <option>s keeps working.
// ============================================================
const CustomSelect = {
  openInst: null,
  chevron: `<svg class="cs-chev" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  check: `<svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><path d="M4.5 10.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  closeAll() {
    if (this.openInst) this.openInst.close(false);
    DatePicker.close(false);
  },

  enhance(select) {
    if (select.dataset.enhanced || select.multiple || select.classList.contains("no-enhance")) return;
    select.dataset.enhanced = "1";

    const wrap = document.createElement("div");
    wrap.className = "cs";
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "cs-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.innerHTML = `<span class="cs-value"></span>${this.chevron}`;
    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(trigger);
    wrap.appendChild(select);
    select.classList.add("cs-native");
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");

    const valueEl = trigger.querySelector(".cs-value");
    const inst = { select, wrap, trigger, pop: null, backdrop: null, active: -1, typed: "", typedTimer: null };

    const isPlaceholder = (opt) => !opt || opt.value === "";
    inst.sync = () => {
      const opt = select.options[select.selectedIndex];
      const text = opt ? opt.text.trim() : "";
      valueEl.textContent = text || "Select…";
      valueEl.classList.toggle("cs-placeholder", isPlaceholder(opt));
      trigger.disabled = select.disabled;
    };

    inst.buildList = () => {
      let lastGroup = null;
      inst.pop.innerHTML = [...select.options]
        .map((o, i) => {
          const g = o.parentElement && o.parentElement.tagName === "OPTGROUP" ? o.parentElement.label : null;
          const head = g !== lastGroup && g ? `<div class="cs-group">${escapeHtml(g)}</div>` : "";
          lastGroup = g;
          return head + `<div class="cs-opt${o.selected ? " selected" : ""}${o.disabled ? " disabled" : ""}${o.value === "" ? " cs-empty-opt" : ""}" role="option" id="cs-o-${i}" data-i="${i}" aria-selected="${o.selected}">
          <span>${escapeHtml(o.text.trim() || "—")}</span>${o.selected ? this.check : ""}</div>`;
        })
        .join("");
    };

    inst.setActive = (i, scroll = true) => {
      const opts = inst.pop.querySelectorAll(".cs-opt");
      opts.forEach((el, idx) => el.classList.toggle("active", idx === i));
      inst.active = i;
      const el = opts[i];
      if (el) {
        trigger.setAttribute("aria-activedescendant", el.id);
        if (scroll) el.scrollIntoView({ block: "nearest" });
      }
    };

    inst.position = () => {
      const r = trigger.getBoundingClientRect();
      const pop = inst.pop;
      if (window.matchMedia("(max-width: 640px)").matches) { pop.style.cssText = ""; return; }
      const below = window.innerHeight - r.bottom - 12;
      const above = r.top - 12;
      const want = Math.min(pop.scrollHeight + 8, 300);
      const openUp = below < want && above > below;
      const maxH = Math.max(120, Math.min(300, openUp ? above : below));
      pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - Math.max(r.width, 180) - 8)) + "px";
      pop.style.minWidth = r.width + "px";
      pop.style.maxHeight = maxH + "px";
      pop.style.top = openUp ? "auto" : r.bottom + 6 + "px";
      pop.style.bottom = openUp ? window.innerHeight - r.top + 6 + "px" : "auto";
      pop.classList.toggle("up", openUp);
    };

    inst.open = () => {
      if (trigger.disabled) return;
      CustomSelect.closeAll();
      inst.pop = document.createElement("div");
      inst.pop.className = "cs-pop";
      inst.pop.setAttribute("role", "listbox");
      inst.pop.id = "cs-pop-" + Math.random().toString(36).slice(2, 7);
      trigger.setAttribute("aria-controls", inst.pop.id);
      inst.buildList();
      const isSheet = window.matchMedia("(max-width: 640px)").matches;
      if (isSheet) {
        inst.backdrop = document.createElement("div");
        inst.backdrop.className = "cs-backdrop";
        inst.backdrop.addEventListener("pointerdown", () => inst.close(true));
        document.body.appendChild(inst.backdrop);
      }
      document.body.appendChild(inst.pop);
      inst.position();
      trigger.setAttribute("aria-expanded", "true");
      wrap.classList.add("open");
      CustomSelect.openInst = inst;
      inst.setActive(select.selectedIndex);

      inst.pop.addEventListener("pointerdown", (e) => e.preventDefault()); // keep focus on trigger
      inst.pop.addEventListener("click", (e) => {
        const el = e.target.closest(".cs-opt");
        if (el && !el.classList.contains("disabled")) inst.choose(Number(el.dataset.i));
      });
      inst.pop.addEventListener("pointermove", (e) => {
        const el = e.target.closest(".cs-opt");
        if (el) inst.setActive(Number(el.dataset.i), false);
      });
    };

    inst.close = (refocus) => {
      if (!inst.pop) return;
      inst.pop.remove(); inst.pop = null;
      inst.backdrop?.remove(); inst.backdrop = null;
      trigger.setAttribute("aria-expanded", "false");
      trigger.removeAttribute("aria-activedescendant");
      wrap.classList.remove("open");
      if (CustomSelect.openInst === inst) CustomSelect.openInst = null;
      if (refocus) trigger.focus();
    };

    inst.choose = (i) => {
      const changed = select.selectedIndex !== i;
      select.selectedIndex = i;
      inst.sync();
      inst.close(true);
      if (changed) {
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    };

    const step = (dir) => {
      const opts = [...select.options];
      let i = inst.active;
      do { i += dir; } while (i >= 0 && i < opts.length && opts[i].disabled);
      if (i >= 0 && i < opts.length) inst.setActive(i);
    };

    trigger.addEventListener("click", () => (inst.pop ? inst.close(false) : inst.open()));
    trigger.addEventListener("keydown", (e) => {
      const isOpen = !!inst.pop;
      if (!isOpen && ["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); inst.open(); return; }
      if (!isOpen) return;
      if (e.key === "ArrowDown") { e.preventDefault(); step(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); step(-1); }
      else if (e.key === "Home") { e.preventDefault(); inst.setActive(0); }
      else if (e.key === "End") { e.preventDefault(); inst.setActive(select.options.length - 1); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (inst.active >= 0) inst.choose(inst.active); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); inst.close(true); }
      else if (e.key === "Tab") { inst.close(false); }
      else if (e.key.length === 1) {
        clearTimeout(inst.typedTimer);
        inst.typed += e.key.toLowerCase();
        inst.typedTimer = setTimeout(() => (inst.typed = ""), 600);
        const idx = [...select.options].findIndex((o) => o.text.trim().toLowerCase().startsWith(inst.typed));
        if (idx >= 0) inst.setActive(idx);
      }
    });
    trigger.addEventListener("blur", () => setTimeout(() => { if (inst.pop && document.activeElement !== trigger) inst.close(false); }, 120));

    // keep the label in step with code that changes the select
    select.addEventListener("change", inst.sync);
    const proto = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
    Object.defineProperty(select, "value", {
      get() { return proto.get.call(this); },
      set(v) { proto.set.call(this, v); inst.sync(); },
      configurable: true,
    });
    new MutationObserver(() => { inst.sync(); if (inst.pop) inst.buildList(); })
      .observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "selected"] });

    inst.sync();
  },

  scan(root = document) {
    root.querySelectorAll("select:not([data-enhanced])").forEach((s) => this.enhance(s));
    root.querySelectorAll("input[type=date]:not([data-enhanced])").forEach((i) => DatePicker.enhance(i));
  },

  init() {
    DatePicker.init();
    this.scan();
    let pending = false;
    new MutationObserver((muts) => {
      if (pending || !muts.some((m) => m.addedNodes.length)) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; this.scan(); });
    }).observe(document.body, { childList: true, subtree: true });

    document.addEventListener("pointerdown", (e) => {
      const inst = this.openInst;
      if (inst && !inst.pop.contains(e.target) && !inst.wrap.contains(e.target)) inst.close(false);
    }, true);
    window.addEventListener("resize", () => this.closeAll());
    window.addEventListener("scroll", (e) => {
      if (this.openInst && !this.openInst.pop.contains(e.target)) this.closeAll();
    }, true);
  },
};


// ============================================================
// DATE PICKER — replaces the browser's date popup. Same idea as
// CustomSelect: the real <input type="date"> stays (hidden) so
// .value / change events / required all keep working.
// ============================================================
const DatePicker = {
  openInst: null,
  chev: (d) => `<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  cal: `<svg class="cs-chev" viewBox="0 0 20 20" width="17" height="17" aria-hidden="true"><rect x="3" y="4.5" width="14" height="12.5" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 8.5h14M7 3v3M13 3v3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  fmt(v) {
    if (!v) return "";
    const [y, m, d] = v.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  },

  close(refocus) {
    const i = this.openInst;
    if (!i) return;
    i.pop.remove(); i.backdrop?.remove();
    i.trigger.setAttribute("aria-expanded", "false");
    i.wrap.classList.remove("open");
    this.openInst = null;
    if (refocus) i.trigger.focus();
  },

  enhance(input) {
    if (input.dataset.enhanced) return;
    input.dataset.enhanced = "1";
    const wrap = document.createElement("div");
    wrap.className = "cs dp";
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "cs-trigger";
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-expanded", "false");
    trigger.innerHTML = `<span class="cs-value"></span>${this.cal}`;
    input.parentNode.insertBefore(wrap, input);
    wrap.append(trigger, input);
    input.classList.add("cs-native");
    input.tabIndex = -1;
    const valueEl = trigger.querySelector(".cs-value");
    const sync = () => {
      valueEl.textContent = this.fmt(input.value) || "Pick a date";
      valueEl.classList.toggle("cs-placeholder", !input.value);
    };
    const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    Object.defineProperty(input, "value", { get() { return proto.get.call(this); }, set(v) { proto.set.call(this, v); sync(); }, configurable: true });
    input.addEventListener("change", sync);
    sync();

    const open = () => {
      CustomSelect.closeAll();
      const start = input.value ? input.value.split("-").map(Number) : todayStr().split("-").map(Number);
      const inst = { wrap, trigger, input, y: start[0], m: start[1] - 1 };
      const isSheet = window.matchMedia("(max-width: 640px)").matches;
      inst.pop = document.createElement("div");
      inst.pop.className = "cs-pop dp-pop";
      inst.pop.setAttribute("role", "dialog");
      inst.pop.setAttribute("aria-label", "Choose a date");
      if (isSheet) {
        inst.backdrop = document.createElement("div");
        inst.backdrop.className = "cs-backdrop";
        inst.backdrop.addEventListener("pointerdown", () => this.close(true));
        document.body.appendChild(inst.backdrop);
      }
      document.body.appendChild(inst.pop);
      this.openInst = inst;
      trigger.setAttribute("aria-expanded", "true");
      wrap.classList.add("open");
      this.draw(inst);
      this.place(inst, isSheet);
      inst.pop.querySelector(".dp-day.sel, .dp-day.today, .dp-day")?.focus();
      inst.pop.addEventListener("keydown", (e) => {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); this.close(true); }
      });
    };
    trigger.addEventListener("click", () => (this.openInst?.trigger === trigger ? this.close(false) : open()));
  },

  place(inst, isSheet) {
    if (isSheet) return;
    const r = inst.trigger.getBoundingClientRect(), pop = inst.pop;
    const h = pop.offsetHeight, below = innerHeight - r.bottom - 12, up = below < h && r.top > below;
    pop.style.left = Math.max(8, Math.min(r.left, innerWidth - 300)) + "px";
    pop.style.top = up ? Math.max(8, r.top - h - 6) + "px" : r.bottom + 6 + "px";
    pop.classList.toggle("up", up);
  },

  draw(inst) {
    const { y, m, input } = inst, sel = input.value, today = todayStr();
    const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
    const label = new Date(y, m, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    let cells = "";
    for (let i = 0; i < first; i++) cells += `<span></span>`;
    for (let d = 1; d <= days; d++) {
      const ds = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells += `<button type="button" class="dp-day${ds === sel ? " sel" : ""}${ds === today ? " today" : ""}" data-d="${ds}" aria-label="${this.fmt(ds)}">${d}</button>`;
    }
    inst.pop.innerHTML = `
      <div class="dp-head">
        <button type="button" class="dp-nav" data-nav="-1" aria-label="Previous month">${this.chev("M12 5l-5 5 5 5")}</button>
        <strong>${label}</strong>
        <button type="button" class="dp-nav" data-nav="1" aria-label="Next month">${this.chev("M8 5l5 5-5 5")}</button>
      </div>
      <div class="dp-grid dp-dow">${["S", "M", "T", "W", "T", "F", "S"].map((d) => `<span>${d}</span>`).join("")}</div>
      <div class="dp-grid">${cells}</div>
      <div class="dp-foot"><button type="button" class="text-btn" data-today>Today</button>${input.required ? "" : `<button type="button" class="text-btn" data-clear>Clear</button>`}</div>`;
    const pick = (v) => {
      input.value = v;
      this.close(true);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };
    inst.pop.querySelectorAll("[data-nav]").forEach((b) => (b.onclick = () => {
      const d = new Date(inst.y, inst.m + Number(b.dataset.nav), 1);
      inst.y = d.getFullYear(); inst.m = d.getMonth(); this.draw(inst);
    }));
    inst.pop.querySelectorAll(".dp-day").forEach((b) => (b.onclick = () => pick(b.dataset.d)));
    inst.pop.querySelector("[data-today]").onclick = () => pick(todayStr());
    inst.pop.querySelector("[data-clear]")?.addEventListener("click", () => pick(""));
  },

  init() {
    document.addEventListener("pointerdown", (e) => {
      const i = this.openInst;
      if (i && !i.pop.contains(e.target) && !i.wrap.contains(e.target)) this.close(false);
    }, true);
    window.addEventListener("resize", () => this.close(false));
    window.addEventListener("scroll", (e) => { if (this.openInst && !this.openInst.pop.contains(e.target)) this.close(false); }, true);
  },
};


// Clock digits: only the characters that changed roll in (smooth, no flicker)
function setDigits(el, text) {
  if (!el || el.dataset.t === text) return;
  const prev = el.dataset.t || "";
  if (prev.length !== text.length || !el.firstElementChild) {
    el.innerHTML = [...text].map((c) => `<span class="dg">${c}</span>`).join("");
  } else {
    [...text].forEach((c, i) => {
      if (c === prev[i]) return;
      const s = el.children[i];
      s.textContent = c; s.classList.remove("roll"); void s.offsetWidth; s.classList.add("roll");
    });
  }
  el.dataset.t = text;
}
