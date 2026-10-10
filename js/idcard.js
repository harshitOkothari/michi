// MICHI ID CARD — one card used on the landing page (live preview) and in Settings → Profile.
const IDCard = {
  esc: (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])),
  code(seed) { // stable short ID from name/email, e.g. MCH-4F7A-21
    let h = 7; for (const ch of String(seed || "michi")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const x = h.toString(16).toUpperCase().padStart(8, "0");
    return `MCH-${x.slice(0, 4)}-${x.slice(4, 6)}`;
  },
  html(d) {
    const name = (d.name || "").trim() || "Your Name", ini = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    const id = this.code(d.seed || d.email || d.name);
    const bars = Array.from({ length: 26 }, (_, i) => `<i style="height:${40 + ((id.charCodeAt(i % id.length) * (i + 3)) % 60)}%"></i>`).join("");
    return `<div class="idc" data-idc>
      <div class="idc-top"><span class="idc-brand"><b>M</b> MICHI</span><span class="idc-tag">STUDENT · 学生証</span></div>
      <div class="idc-body">
        <div class="idc-photo">${d.avatar ? `<img src="${this.esc(d.avatar)}" alt="" />` : `<span>${this.esc(ini || "M")}</span>`}</div>
        <div class="idc-info">
          <h4 class="idc-name">${this.esc(name)}</h4>
          <p class="idc-mail">${this.esc(d.email || "you@example.com")}</p>
          <dl><div><dt>ID</dt><dd>${id}</dd></div><div><dt>Joined</dt><dd>${this.esc(d.joined || new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" }))}</dd></div>
          <div><dt>Level</dt><dd>${d.level ?? 1}</dd></div><div><dt>XP</dt><dd>${d.xp ?? 0}</dd></div><div><dt>Streak</dt><dd>${d.streak ?? 0}d</dd></div></dl>
        </div>
      </div>
      <div class="idc-bar">${bars}</div>
    </div>`;
  },
  // landing page: card fills in live as the person types in the login / sign-up forms
  initLanding() {
    const host = document.getElementById("idc-live"); if (!host) return;
    const q = (id) => document.getElementById(id);
    const draw = () => {
      const email = (q("signup-email")?.value || q("login-email")?.value || "").trim();
      const name = (q("signup-name")?.value || "").trim() || (email ? email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "");
      host.innerHTML = this.html({ name, email });
    };
    ["signup-name", "signup-email", "login-email"].forEach((id) => q(id)?.addEventListener("input", draw));
    draw();
  },
};
document.addEventListener("DOMContentLoaded", () => IDCard.initLanding());
