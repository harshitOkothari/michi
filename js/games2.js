// ============================================================
// MORE GAMES — Slash Rush · Stone Stack · Math Sprint · Maxim Match
// (added on top of Games; best scores stay on this device)
// ============================================================
Games.rafs = [];
{
  const _stop = Games.stop;
  Games.stop = function () { _stop.call(this); (this.rafs || []).forEach(cancelAnimationFrame); this.rafs = []; (this.ivs || []).forEach(clearInterval); this.ivs = []; };
}
Games.canvasGame = function (el, { title, help, draw, onStart, W = 320, H = 400 }) {
  const best = this.best(title);
  el.innerHTML = `<div class="game-stats"><span>Score <b id="${title}-s">0</b></span><span>Best <b id="${title}-b">${best}</b></span><span id="${title}-x"></span></div>
    <div class="cv-wrap"><canvas width="${W * 2}" height="${H * 2}" class="game-cv"></canvas><div class="cv-over" id="${title}-o"><b>${help}</b><button class="btn btn-primary" type="button">Play</button></div></div>`;
  const cv = el.querySelector("canvas"), g = cv.getContext("2d"), ov = el.querySelector(".cv-over");
  g.scale(2, 2);
  const api = { g, W, H, cv, score: 0, run: false, set(n) { api.score = n; el.querySelector(`#${title}-s`).textContent = n; }, extra(t) { el.querySelector(`#${title}-x`).textContent = t; },
    over: (msg) => { api.run = false; const b = Math.max(best, api.score); if (api.score > Games.best(title)) Games.setBest(title, api.score); el.querySelector(`#${title}-b`).textContent = Games.best(title);
      ov.hidden = false; ov.querySelector("b").textContent = `${msg} · score ${api.score}`; ov.querySelector("button").textContent = "Play again"; } };
  const loop = (t) => { if (!api.run) return; draw(api, t); Games.rafs.push(requestAnimationFrame(loop)); };
  ov.querySelector("button").onclick = () => { ov.hidden = true; api.set(0); api.run = true; onStart(api); Games.rafs.push(requestAnimationFrame(loop)); };
  return api;
};

// ---- Slash Rush: swipe through falling sakura petals, avoid the oni masks ----
Games.slash = function () {
  const el = document.getElementById("slash"); if (!el) return;
  let items = [], trail = [], parts = [], lives = 3, last = 0, spawn = 0;
  const api = this.canvasGame(el, {
    title: "slash", help: "Swipe through the petals 🌸 — never the oni 👹",
    onStart(a) { items = []; trail = []; parts = []; lives = 3; spawn = 0; last = 0; a.extra("♥♥♥"); },
    draw(a, t) {
      const dt = Math.min(0.05, ((t - last) || 16) / 1000); last = t; const { g, W, H } = a;
      g.fillStyle = "#17110f"; g.fillRect(0, 0, W, H);
      spawn -= dt; if (spawn <= 0) { spawn = Math.max(0.28, 0.9 - a.score * 0.012); const bomb = Math.random() < 0.18;
        items.push({ x: 30 + Math.random() * (W - 60), y: H + 20, vx: (Math.random() - 0.5) * 60, vy: -(520 + Math.random() * 110 + Math.min(a.score, 60) * 1.5), bomb, r: 20, a: 0, va: (Math.random() - 0.5) * 6 }); }
      items.forEach((it) => { it.vy += 520 * dt; it.x += it.vx * dt; it.y += it.vy * dt; it.a += it.va * dt; });
      // trail + hits
      const tr = trail.slice(-8); for (let i = 1; i < tr.length; i++) { const p = tr[i - 1], q = tr[i];
        items.forEach((it) => { if (it.dead) return; const dx = q.x - p.x, dy = q.y - p.y, l2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((it.x - p.x) * dx + (it.y - p.y) * dy) / l2));
          if (Math.hypot(it.x - (p.x + u * dx), it.y - (p.y + u * dy)) < it.r + 4) { it.dead = true;
            for (let k = 0; k < 10; k++) parts.push({ x: it.x, y: it.y, vx: (Math.random() - 0.5) * 260, vy: (Math.random() - 0.5) * 260, l: 0.6, c: it.bomb ? "#ff4a3d" : "#f6b5c8" });
            if (it.bomb) { lives--; a.extra("♥".repeat(Math.max(0, lives)) + "♡".repeat(3 - Math.max(0, lives))); } else a.set(a.score + 1); } }); }
      items = items.filter((it) => !it.dead && it.y < H + 60 && !(it.y > H + 30 && it.vy > 0)); if (lives <= 0) return a.over("Cut short");
      items.forEach((it) => { g.save(); g.translate(it.x, it.y); g.rotate(it.a); g.font = "34px serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(it.bomb ? "👹" : "🌸", 0, 0); g.restore(); });
      parts = parts.filter((p) => (p.l -= dt) > 0); parts.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; g.globalAlpha = Math.max(0, p.l / 0.6); g.fillStyle = p.c; g.fillRect(p.x, p.y, 3, 3); }); g.globalAlpha = 1;
      trail = trail.filter((p) => t - p.t < 140); g.lineCap = "round";
      for (let i = 1; i < trail.length; i++) { g.strokeStyle = `rgba(255,240,220,${i / trail.length})`; g.lineWidth = 1 + (i / trail.length) * 5; g.beginPath(); g.moveTo(trail[i - 1].x, trail[i - 1].y); g.lineTo(trail[i].x, trail[i].y); g.stroke(); }
    },
  });
  const pos = (e) => { const r = api.cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * api.W, y: ((e.clientY - r.top) / r.height) * api.H, t: performance.now() }; };
  let down = false; api.cv.style.touchAction = "none";
  api.cv.addEventListener("pointerdown", (e) => { down = true; api.cv.setPointerCapture(e.pointerId); trail.push(pos(e)); });
  api.cv.addEventListener("pointermove", (e) => { if (down && api.run) trail.push(pos(e)); });
  api.cv.addEventListener("pointerup", () => (down = false));
};

// ---- Stone Stack: drop each stone so it lands on the last one ----
Games.stones = function () {
  const el = document.getElementById("stones"); if (!el) return;
  let stack = [], cur, dir = 1, shake = 0;
  const api = this.canvasGame(el, {
    title: "stones", help: "Tap to drop the stone. Land it square — the overhang falls away.",
    onStart(a) { stack = [{ x: a.W / 2 - 70, w: 140 }]; cur = { x: 0, w: 140, v: 150 }; dir = 1; },
    draw(a, t) { const { g, W, H } = a; g.fillStyle = "#17110f"; g.fillRect(0, 0, W, H);
      cur.x += dir * cur.v * 0.016; if (cur.x < 0) { cur.x = 0; dir = 1; } if (cur.x + cur.w > W) { cur.x = W - cur.w; dir = -1; }
      const lift = Math.max(0, stack.length - 8) * 26, base = H - 30 + lift;
      g.fillStyle = "#2a201d"; g.fillRect(0, H - 30 + lift, W, 40);
      stack.forEach((s, i) => { const y = base - (i + 1) * 26; g.fillStyle = `hsl(${(i * 24) % 360} 28% ${52 - (i % 4) * 4}%)`; g.beginPath(); g.roundRect(s.x, y, s.w, 24, 6); g.fill(); });
      const y = base - (stack.length + 1) * 26; g.fillStyle = "#e8c36a"; g.beginPath(); g.roundRect(cur.x, y, cur.w, 24, 6); g.fill(); },
  });
  const drop = (e) => { e.preventDefault(); if (!api.run) return; const top = stack[stack.length - 1], L = Math.max(cur.x, top.x), R = Math.min(cur.x + cur.w, top.x + top.w);
    if (R - L < 6) return api.over("The tower fell"); const perfect = Math.abs(cur.x - top.x) < 4;
    stack.push(perfect ? { x: top.x, w: top.w } : { x: L, w: R - L }); cur = { x: 0, w: stack[stack.length - 1].w, v: Math.min(330, 150 + stack.length * 7) }; dir = 1; api.set(stack.length - 1); if (perfect) api.extra("perfect ✦"); else api.extra(""); };
  api.cv.addEventListener("pointerdown", drop); document.addEventListener("keydown", (e) => { if (e.code === "Space" && document.getElementById("stones")?.offsetParent && api.run) drop(e); });
};

// ---- Math Sprint: 60 seconds of quick sums (good for CLAT quant / any entrance) ----
Games.sprint = function () {
  const el = document.getElementById("sprint"); if (!el) return;
  let score = 0, left = 60, streak = 0, ans = 0, tries = 0, timer;
  const q = () => { const t = Math.random(), lv = Math.min(3, 1 + Math.floor(score / 8)); let a, b, txt, r;
    if (t < 0.35) { a = 10 * lv + Math.floor(Math.random() * 40); b = 5 + Math.floor(Math.random() * 40); txt = `${a} + ${b}`; r = a + b; }
    else if (t < 0.6) { a = 30 + Math.floor(Math.random() * 70); b = 3 + Math.floor(Math.random() * 28); txt = `${a} − ${b}`; r = a - b; }
    else if (t < 0.85) { a = 3 + Math.floor(Math.random() * (7 + lv * 3)); b = 3 + Math.floor(Math.random() * 10); txt = `${a} × ${b}`; r = a * b; }
    else { const p = [10, 20, 25, 50][Math.floor(Math.random() * 4)], n = (1 + Math.floor(Math.random() * 9)) * 20; txt = `${p}% of ${n}`; r = (p * n) / 100; }
    const opts = new Set([r]); while (opts.size < 4) opts.add(r + (Math.floor(Math.random() * 9) - 4) * (r > 40 ? 2 : 1) || r + 7);
    ans = r; return { txt, opts: [...opts].sort(() => Math.random() - 0.5) }; };
  const show = () => { const x = q(); el.querySelector(".sp-q").textContent = x.txt;
    el.querySelector(".sp-o").innerHTML = x.opts.map((o) => `<button class="sp-btn" type="button" data-v="${o}">${o}</button>`).join("");
    el.querySelectorAll(".sp-btn").forEach((b) => (b.onclick = () => { tries++; if (Number(b.dataset.v) === ans) { score++; streak++; if (streak % 5 === 0) left += 3; b.classList.add("ok"); } else { streak = 0; left = Math.max(0, left - 2); b.classList.add("bad"); }
      el.querySelector(".sp-s").textContent = score; setTimeout(show, 120); })); };
  const intro = () => { clearInterval(timer); el.innerHTML = `<div class="game-stats"><span>Best <b>${Games.best("sprint")}</b></span></div><div class="cv-over static"><b>60 seconds. Right answers add points, a streak of 5 gives +3 s, a miss costs 2 s.</b><button class="btn btn-primary" type="button">Start</button></div>`; el.querySelector("button").onclick = start; };
  const start = () => { score = 0; left = 60; streak = 0; tries = 0;
    el.innerHTML = `<div class="game-stats"><span>Score <b class="sp-s">0</b></span><span>Time <b class="sp-t">60</b>s</span><span>Best <b>${Games.best("sprint")}</b></span></div><div class="sp-q"></div><div class="sp-bar"><u></u></div><div class="sp-o"></div>`;
    show(); timer = setInterval(() => { left -= 1; el.querySelector(".sp-t") && (el.querySelector(".sp-t").textContent = Math.max(0, left)); el.querySelector(".sp-bar u") && (el.querySelector(".sp-bar u").style.width = Math.min(100, (left / 60) * 100) + "%");
      if (left <= 0) { clearInterval(timer); if (score > Games.best("sprint")) Games.setBest("sprint", score);
        el.innerHTML = `<div class="cv-over static"><b>Time! ${score} correct · ${tries ? Math.round((score / tries) * 100) : 0}% accuracy</b><button class="btn btn-primary" type="button">Again</button></div>`; el.querySelector("button").onclick = start; } }, 1000);
    (Games.ivs = Games.ivs || []).push(timer); };
  intro();
};

// ---- Maxim Match: legal maxims (CLAT favourites) ----
Games.maxims = function () {
  const el = document.getElementById("maxims"); if (!el) return;
  const M = [["Actus non facit reum nisi mens sit rea", "An act is not guilty unless the mind is guilty"], ["Ignorantia juris non excusat", "Ignorance of the law is no excuse"], ["Res ipsa loquitur", "The thing speaks for itself"], ["Caveat emptor", "Let the buyer beware"], ["Audi alteram partem", "Hear the other side"],
    ["Nemo judex in causa sua", "No one should be a judge in their own cause"], ["Volenti non fit injuria", "No wrong is done to one who consents"], ["Ubi jus ibi remedium", "Where there is a right, there is a remedy"], ["Pacta sunt servanda", "Agreements must be kept"], ["Injuria sine damno", "Legal wrong without actual loss"],
    ["Damnum sine injuria", "Loss without any legal wrong"], ["Ultra vires", "Beyond one's legal powers"], ["Sub judice", "Under judicial consideration"], ["Bona fide", "In good faith"], ["Stare decisis", "To stand by decided cases"], ["Habeas corpus", "Produce the person before the court"], ["Obiter dicta", "Remarks in passing by a judge, not binding"], ["Ratio decidendi", "The reasoning on which a decision rests"], ["Mens rea", "The guilty mind"], ["Locus standi", "The right to bring a case"]];
  let order, i, score;
  const next = () => { if (i >= 10) { if (score > Games.best("maxims")) Games.setBest("maxims", score);
      el.innerHTML = `<div class="cv-over static"><b>${score} / 10 correct${score === 10 ? " · flawless 🏆" : ""}</b><button class="btn btn-primary" type="button">Again</button></div>`; return (el.querySelector("button").onclick = start); }
    const [lat, mean] = order[i], wrong = M.filter((m) => m[1] !== mean).sort(() => Math.random() - 0.5).slice(0, 2).map((m) => m[1]), opts = [mean, ...wrong].sort(() => Math.random() - 0.5);
    el.innerHTML = `<div class="game-stats"><span>Round <b>${i + 1}</b>/10</span><span>Score <b>${score}</b></span><span>Best <b>${Games.best("maxims")}</b></span></div><div class="mx-lat">${lat}</div>
      <div class="mx-o">${opts.map((o) => `<button type="button" class="mx-btn" data-ok="${o === mean ? 1 : 0}">${o}</button>`).join("")}</div>`;
    el.querySelectorAll(".mx-btn").forEach((b) => (b.onclick = () => { el.querySelectorAll(".mx-btn").forEach((x) => { x.disabled = true; if (x.dataset.ok === "1") x.classList.add("ok"); }); if (b.dataset.ok === "1") score++; else b.classList.add("bad"); i++; setTimeout(next, 1100); })); };
  const start = () => { order = [...M].sort(() => Math.random() - 0.5); i = 0; score = 0; next(); };
  el.innerHTML = `<div class="game-stats"><span>Best <b>${Games.best("maxims")}</b></span></div><div class="cv-over static"><b>10 Latin maxims. Pick the right meaning.</b><button class="btn btn-primary" type="button">Start</button></div>`; el.querySelector("button").onclick = start;
};

// ============================================================
// GAMES LOBBY — roomy tiles to choose from, then one focused play screen at a time
// ============================================================
Games.catalog = [
  { id: "slash", jp: "斬", title: "Slash Rush", tag: "Reflex", line: "Slice the sakura. Spare the oni.", how: "Swipe across the falling petals to slice them. Touching an oni costs a life. It gets faster as you score.", c1: "#c0291f", c2: "#190b0b", init: "slash" },
  { id: "stones", jp: "石", title: "Stone Stack", tag: "Focus", line: "Build the tower as high as your focus lasts.", how: "Tap (or press Space) to drop the stone. Land it square — any overhang falls away. Perfect drops keep the stone's full width.", c1: "#66788a", c2: "#161d28", init: "stones" },
  { id: "sprint", jp: "算", title: "Math Sprint", tag: "Exam prep", line: "Sixty seconds of quick sums.", how: "Pick the right answer fast. A streak of 5 adds 3 seconds, a miss costs 2. A good warm-up before any entrance exam.", c1: "#d9a53b", c2: "#3a2508", init: "sprint" },
  { id: "maxims", jp: "法", title: "Maxim Match", tag: "Exam prep", line: "Latin legal maxims, the CLAT favourites.", how: "Ten rounds. Choose the correct meaning for each maxim.", c1: "#2f7a73", c2: "#0c2423", init: "maxims" },
  { id: "kana", jp: "記", title: "Memory Match", tag: "Focus", line: "Find every pair in the fewest moves.", how: "Flip two cards at a time and match all the study icons. Fewer moves is a better score.", c1: "#8f56a6", c2: "#1f0f2b", init: "kana", unit: "moves", low: true },
  { id: "reflex", jp: "門", title: "Torii Reflex", tag: "Reflex", line: "Wait for the gate to turn red. Then tap.", how: "Tap too early and you lose the round. Your fastest time is saved.", c1: "#e8573f", c2: "#3a130e", init: "reflex", unit: "ms", low: true },
  { id: "breath", jp: "息", title: "Breathe", tag: "Calm", line: "Box breathing to settle exam nerves.", how: "In, hold, out, hold — four seconds each. Follow the orb for a minute or two.", c1: "#3f86b0", c2: "#0b2132", init: "breath", noBest: true },
];
Games.bestText = function (g) { const b = this.best(g.id); return g.noBest ? "" : b ? `${b}${g.unit ? " " + g.unit : ""}` : "—"; };
Games.filter = "All";
Games.render = function () {
  this.stop(); this.current = null;
  const page = document.getElementById("page-games"), day = Math.floor(Date.now() / 864e5), pick = this.catalog[day % this.catalog.length];
  const tags = ["All", ...new Set(this.catalog.map((g) => g.tag))];
  const shown = this.catalog.filter((g) => this.filter === "All" || g.tag === this.filter);
  page.innerHTML = `<div class="globby">
    <header class="ghero"><div class="ghero-kanji" aria-hidden="true">遊</div>
      <div class="ghero-text"><span class="geyebrow">道場 · BREAK ROOM</span><h2>Rest the mind.<br>Sharpen it too.</h2><p>Two minutes here, then back to the path.</p>
        <button class="btn btn-primary ghero-btn" type="button" data-g="${pick.id}">Today's pick · ${pick.title} →</button></div></header>
    <div class="gchips" role="tablist">${tags.map((t) => `<button type="button" class="gchip${t === this.filter ? " on" : ""}" data-tag="${t}">${t}</button>`).join("")}</div>
    <div class="gtiles">${shown.map((g) => `<button type="button" class="gtile" data-g="${g.id}" style="--c1:${g.c1};--c2:${g.c2}">
        <span class="gtile-kanji" aria-hidden="true">${g.jp}</span>
        <span class="gtile-top"><span class="gtag">${g.tag}</span>${g.noBest ? "" : `<span class="gbest-chip">Best <b>${this.bestText(g)}</b></span>`}</span>
        <span class="gtile-bot"><span class="gtile-title">${g.title}</span><span class="gtile-line">${g.line}</span><span class="gplay">Play <i>→</i></span></span></button>`).join("")}</div></div>`;
  page.querySelectorAll("[data-g]").forEach((b) => (b.onclick = () => this.open(b.dataset.g)));
  page.querySelectorAll("[data-tag]").forEach((b) => (b.onclick = () => { this.filter = b.dataset.tag; this.render(); }));
};
Games.open = function (id) {
  const g = this.catalog.find((x) => x.id === id); if (!g) return; this.stop(); this.current = id;
  const next = this.catalog[(this.catalog.indexOf(g) + 1) % this.catalog.length];
  document.getElementById("page-games").innerHTML = `<div class="gstage" style="--c1:${g.c1};--c2:${g.c2}">
    <button type="button" class="gback" id="g-back">← All games</button>
    <header class="gstage-head"><span class="gstage-kanji" aria-hidden="true">${g.jp}</span>
      <div><span class="geyebrow">${g.tag.toUpperCase()}</span><h2>${g.title}</h2><p>${g.line}</p></div>
      ${g.noBest ? "" : `<div class="gstage-best"><small>BEST</small><b>${this.bestText(g)}</b></div>`}</header>
    <section class="gstage-body"><div id="${g.id}"></div></section>
    <p class="gstage-how"><b>How to play</b> ${g.how}</p>
    <button type="button" class="gnext" id="g-next"><small>Next game</small><span>${next.title} <i>→</i></span></button></div>`;
  document.getElementById("g-back").onclick = () => this.render();
  document.getElementById("g-next").onclick = () => this.open(next.id);
  this[g.init](); window.scrollTo({ top: 0, behavior: "smooth" });
};
