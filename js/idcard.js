// MICHI STUDENT ID — one card component for the landing page (live preview) and Settings → My Michi ID.
// Real card proportions (85.6 × 54 mm). Tap to flip: front = identity, back = this week's record.
const IDCard = {
  esc: (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])),
  code(seed) { // stable demo code from a seed (real accounts use the code stored in the database)
    let h = 7; for (const ch of String(seed || "michi")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const x = h.toString(16).toUpperCase().padStart(8, "0");
    return `MCH-${x.slice(0, 4)}-${x.slice(4, 6)}`;
  },
  rankTitle(level) {
    const T = [[1, "Apprentice", "見習い"], [5, "Disciple", "弟子"], [10, "Swordsman", "剣士"], [15, "Samurai", "侍"], [20, "Master", "師範"], [30, "Shogun", "将軍"]];
    let r = T[0]; for (const t of T) if (level >= t[0]) r = t; return r;
  },
  hm(sec) { sec = Math.max(0, Math.round(sec || 0)); const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60); return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`; },
  bars(seed) { let h = 5; for (const c of seed) h = (h * 33 + c.charCodeAt(0)) >>> 0; let out = ""; for (let i = 0; i < 46; i++) { h = (h * 1103515245 + 12345) >>> 0; out += `<i style="flex:${1 + (h >> 16) % 3}"></i>`; } return out; },
  html(d) {
    const e = this.esc, name = (d.name || "").trim() || "Your Name";
    const ini = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "M";
    const code = d.code || this.code(d.seed || d.email || d.name), level = d.level ?? 1, xp = d.xp ?? 0;
    const [, title, jp] = this.rankTitle(level);
    const days = d.days || [0, 0, 0, 0, 0, 0, 0], max = Math.max(1, ...days), today = (new Date().getDay() + 6) % 7;
    const bars = days.map((s, i) => `<span class="${i === today ? "on" : ""}"><i style="height:${Math.max(7, Math.round((s / max) * 100))}%"></i><b>${"MTWTFSS"[i]}</b></span>`).join("");
    const joined = d.joined || new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" });
    const rankTxt = d.rank ? `#${d.rank}` : "—", ofTxt = d.rankOf > 1 ? `of ${d.rankOf}` : "add friends";
    return `<div class="idc-wrap" data-idc-wrap>
      <div class="idc-scene" role="button" tabindex="0" aria-pressed="false" aria-label="Michi student ID card. Tap to flip.">
       <div class="idc-tilt"><div class="idc-flip">
        <div class="idc-face idc-front">
          <div class="idc-pattern"></div><div class="idc-mark">道</div>
          <div class="idc-head"><div class="idc-seal">道</div><div class="idc-brandblock"><b>MICHI</b><small>STUDENT IDENTITY CARD · 学生証</small></div></div>
          <div class="idc-slot"></div>
          <div class="idc-photo">${d.avatar ? `<img src="${e(d.avatar)}" alt="" />` : `<span data-f="ini">${e(ini)}</span>`}</div>
          <div class="idc-info">
            <h4 class="idc-name" data-f="name">${e(name)}</h4>
            <div class="idc-role"><b data-f="lvl">LV ${level}</b> · ${e(title)} <span>${jp}</span></div>
            <dl><div><dt>ID NO.</dt><dd data-f="code">${e(code)}</dd></div><div><dt>JOINED</dt><dd data-f="joined">${e(String(joined).toUpperCase())}</dd></div><div><dt>STREAK</dt><dd>${d.streak ?? 0} days</dd></div></dl>
          </div>
          <div class="idc-barcode"><span>${this.bars(code)}</span><em data-f="code2">${e(code)}</em></div>
          <div class="idc-sheen"></div>
        </div>
        <div class="idc-face idc-back">
          <div class="idc-pattern"></div>
          <div class="idc-stripe"><span>MICHI · WEEKLY RECORD</span>${d.sample ? "<em>SAMPLE</em>" : ""}</div>
          <div class="idc-lab l1">STUDIED THIS WEEK</div>
          <div class="idc-hours gf">${this.hm(d.weekSec)}</div>
          <div class="idc-pill"><b>RANK ${rankTxt}</b> <span>${ofTxt}</span></div>
          <div class="idc-bars">${bars}</div>
          <div class="idc-stats">
            <div><small>STREAK</small><strong>${d.streak ?? 0}d</strong></div>
            <div><small>LEVEL</small><strong>${level}</strong></div>
            <div class="xp"><small>XP ${xp}</small><i><u style="width:${clampPct(d.xpPct)}%"></u></i></div>
            <div class="code"><small>FRIEND CODE</small><strong>${e(code)}</strong></div>
          </div>
          <div class="idc-sheen"></div>
        </div>
       </div></div>
      </div>
      <p class="idc-hint">Tap card to flip</p>
    </div>`;
    function clampPct(v) { return Math.min(100, Math.max(0, Number(v) || 0)); }
  },
  // landing page: card is drawn once; typing in the login / sign-up forms only updates the fields on it
  initLanding() {
    const host = document.getElementById("idc-live"); if (!host) return;
    const q = (id) => document.getElementById(id);
    host.innerHTML = this.html({ name: "", sample: true, level: 1, weekSec: 12 * 3600 + 40 * 60, rank: 2, rankOf: 5, days: [5400, 9000, 3600, 12600, 7200, 5400, 2400], xp: 0, xpPct: 0, streak: 0 });
    const set = (k, v) => host.querySelectorAll(`[data-f="${k}"]`).forEach((n) => (n.textContent = v));
    const draw = () => {
      const email = (q("signup-email")?.value || q("login-email")?.value || "").trim();
      const name = (q("signup-name")?.value || "").trim() || (email ? email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "");
      const shown = name || "Your Name", code = this.code(email || name);
      set("name", shown); set("ini", shown.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "M"); set("code", code); set("code2", code);
      host.querySelectorAll(".idc-back .code strong").forEach((n) => (n.textContent = code));
    };
    ["signup-name", "signup-email", "login-email"].forEach((id) => q(id)?.addEventListener("input", draw));
    draw(); this.crane(host.querySelector(".idc-wrap"));
  },
  crane(wrap) { // attach the 3D crane as soon as its module is ready
    if (!wrap) return;
    if (window.Crane) window.Crane.attach(wrap); else document.addEventListener("crane-ready", () => window.Crane?.attach(wrap), { once: true });
  },
};
document.addEventListener("DOMContentLoaded", () => IDCard.initLanding());

// one set of listeners for every card on the page: tap/Enter/Space flips, mouse tilts, light follows the pointer
(() => {
  const flip = (scene) => { const f = scene.querySelector(".idc-flip"); const on = f.classList.toggle("is-flipped"); scene.setAttribute("aria-pressed", on); };
  document.addEventListener("click", (e) => { const s = e.target.closest?.(".idc-scene"); if (s) flip(s); });
  document.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.classList?.contains("idc-scene")) { e.preventDefault(); flip(e.target); } });
  document.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    const s = e.target.closest?.(".idc-scene"); if (!s) return;
    const r = s.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    s.style.setProperty("--ry", `${(x - 0.5) * 14}deg`); s.style.setProperty("--rx", `${-(y - 0.5) * 10}deg`);
    s.style.setProperty("--mx", `${x * 100}%`); s.style.setProperty("--my", `${y * 100}%`);
  }, { passive: true });
  document.addEventListener("pointerout", (e) => { const s = e.target.closest?.(".idc-scene"); if (s && !s.contains(e.relatedTarget)) { s.style.setProperty("--rx", "0deg"); s.style.setProperty("--ry", "0deg"); } });
})();
