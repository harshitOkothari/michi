// ============================================================
// EVEN MORE GAMES — Koi Glide · Ink Clash · Taiko Echo · Word Forge · Constitution Quiz · Tile Merge
// ============================================================
Games.catalog.push(
  { id: "koi", jp: "鯉", title: "Koi Glide", tag: "Arcade", line: "Guide the koi. Gather the petals.", how: "Swipe (or use arrow keys / WASD) to steer. Each petal makes the koi longer and faster. Don't touch the bank or your own tail.", c1: "#e0762c", c2: "#1d1107", init: "koi" },
  { id: "ink", jp: "色", title: "Ink Clash", tag: "Focus", line: "Name the colour of the ink, not the word.", how: "Thirty seconds. The word says one colour but is painted in another — tap the colour you SEE. A miss costs a point.", c1: "#7b5fc4", c2: "#150f2b", init: "ink" },
  { id: "taiko", jp: "鼓", title: "Taiko Echo", tag: "Focus", line: "Listen. Watch. Repeat the drums.", how: "The drums light up in a pattern. Repeat it in order — it grows by one every round.", c1: "#d3592b", c2: "#2a0f08", init: "taiko" },
  { id: "words", jp: "語", title: "Word Forge", tag: "Exam prep", line: "Unscramble the legal and civic words.", how: "Eight words. Tap the letters in order to build the answer. A hint is given for each word; skipping scores nothing.", c1: "#4f8a5e", c2: "#0e2318", init: "words" },
  { id: "consti", jp: "憲", title: "Constitution Quiz", tag: "Exam prep", line: "Ten quick questions on the Indian Constitution.", how: "Choose the right answer. A short note explains each one. Good revision for CLAT General Knowledge.", c1: "#4262b0", c2: "#0d1630", init: "consti" },
  { id: "merge", jp: "合", title: "Tile Merge", tag: "Arcade", line: "Slide, merge, reach 2048.", how: "Swipe or use the arrow keys. Equal tiles merge into one. Keep a free corner and plan two moves ahead.", c1: "#b8894a", c2: "#2a1c0b", init: "merge" },
);
Games.timers = [];
{ const _s = Games.stop; Games.stop = function () { _s.call(this); (this.timers || []).forEach(clearTimeout); this.timers = []; }; }
const keyGuard = (id, fn) => { const h = (e) => { if (!document.getElementById(id)?.isConnected) return document.removeEventListener("keydown", h); fn(e); }; document.addEventListener("keydown", h); };
const shuf = (a) => [...a].sort(() => Math.random() - 0.5);

// ---- Koi Glide (snake) ----
Games.koi = function () {
  const el = document.getElementById("koi"); if (!el) return;
  const C = 16, R = 20, S = 20; let snake, dir, nxt, food, acc, last;
  const place = () => { let p; do p = { x: Math.floor(Math.random() * C), y: Math.floor(Math.random() * R) }; while (snake.some((s) => s.x === p.x && s.y === p.y)); return p; };
  const api = this.canvasGame(el, { title: "koi", help: "Swipe or use arrow keys. Eat the petals; avoid the bank and your tail.",
    onStart() { snake = [{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }]; dir = nxt = { x: 1, y: 0 }; food = place(); acc = 0; last = 0; },
    draw(a, t) { const { g, W, H } = a; const dt = Math.min(100, (t - last) || 16); last = t; acc += dt; const ms = Math.max(65, 150 - a.score * 3);
      while (acc >= ms) { acc -= ms; dir = nxt; const h = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
        if (h.x < 0 || h.y < 0 || h.x >= C || h.y >= R || snake.some((s) => s.x === h.x && s.y === h.y)) return a.over("The koi struck the bank");
        snake.unshift(h); if (h.x === food.x && h.y === food.y) { a.set(a.score + 1); food = place(); } else snake.pop(); }
      const grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, "#0e2230"); grd.addColorStop(1, "#0a141c"); g.fillStyle = grd; g.fillRect(0, 0, W, H);
      g.strokeStyle = "rgba(255,255,255,.04)"; for (let i = 0; i <= C; i++) { g.beginPath(); g.moveTo(i * S, 0); g.lineTo(i * S, H); g.stroke(); } for (let j = 0; j <= R; j++) { g.beginPath(); g.moveTo(0, j * S); g.lineTo(W, j * S); g.stroke(); }
      g.font = "18px serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("🌸", food.x * S + S / 2, food.y * S + S / 2 + 1);
      snake.forEach((s, i) => { const k = 1 - i / (snake.length + 2); g.fillStyle = i % 3 === 1 ? `rgba(255,248,235,${0.5 + k * 0.5})` : `rgba(255,${Math.round(110 + 40 * k)},58,${0.55 + k * 0.45})`;
        g.beginPath(); g.arc(s.x * S + S / 2, s.y * S + S / 2, S / 2 - 1 - (i / snake.length) * 3, 0, 7); g.fill(); });
      const h = snake[0]; g.fillStyle = "#fff"; [[-4, -4], [4, -4]].forEach(([dx, dy]) => { g.beginPath(); g.arc(h.x * S + S / 2 + dx * (dir.y ? 1 : 0.4) + (dir.x ? dir.x * 3 : 0), h.y * S + S / 2 + dy * (dir.x ? 1 : 0.4) + (dir.y ? dir.y * 3 : 0), 2.2, 0, 7); g.fill(); }); } });
  const turn = (x, y) => { if (x === -dir.x && y === -dir.y) return; nxt = { x, y }; };
  keyGuard("koi", (e) => { const m = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] }[e.key]; if (m && api.run) { e.preventDefault(); turn(...m); } });
  let sx, sy; api.cv.addEventListener("pointerdown", (e) => { sx = e.clientX; sy = e.clientY; });
  api.cv.addEventListener("pointermove", (e) => { if (sx == null || !api.run) return; const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.hypot(dx, dy) < 18) return; if (Math.abs(dx) > Math.abs(dy)) turn(Math.sign(dx), 0); else turn(0, Math.sign(dy)); sx = e.clientX; sy = e.clientY; });
  api.cv.addEventListener("pointerup", () => (sx = null));
};

// ---- Ink Clash (Stroop) ----
Games.ink = function () {
  const el = document.getElementById("ink"); if (!el) return;
  const COLS = [["RED", "#e0452f"], ["BLUE", "#4a90c2"], ["GREEN", "#46aa6e"], ["GOLD", "#d9a53b"]]; let score, left, timer, ink;
  const show = () => { const w = COLS[Math.floor(Math.random() * 4)]; ink = Math.random() < 0.75 ? COLS[(COLS.indexOf(w) + 1 + Math.floor(Math.random() * 3)) % 4] : w;
    el.querySelector(".ik-w").textContent = w[0]; el.querySelector(".ik-w").style.color = ink[1]; };
  const intro = () => { clearInterval(timer); el.innerHTML = `<div class="game-stats"><span>Best <b>${Games.best("ink")}</b></span></div><div class="cv-over static"><b>30 seconds. Tap the colour of the INK, not the word.</b><button class="btn btn-primary" type="button">Start</button></div>`; el.querySelector("button").onclick = start; };
  const start = () => { score = 0; left = 30;
    el.innerHTML = `<div class="game-stats"><span>Score <b class="ik-s">0</b></span><span>Time <b class="ik-t">30</b>s</span><span>Best <b>${Games.best("ink")}</b></span></div><div class="ik-w"></div><div class="sp-bar"><u></u></div>
      <div class="sp-o">${COLS.map((c) => `<button type="button" class="sp-btn ik-b" data-n="${c[0]}">${c[0]}</button>`).join("")}</div>`;
    show(); el.querySelectorAll(".ik-b").forEach((b) => (b.onclick = () => { if (b.dataset.n === ink[0]) score++; else score = Math.max(0, score - 1); el.querySelector(".ik-s").textContent = score; show(); }));
    timer = setInterval(() => { left--; el.querySelector(".ik-t") && (el.querySelector(".ik-t").textContent = left); el.querySelector(".sp-bar u") && (el.querySelector(".sp-bar u").style.width = (left / 30) * 100 + "%");
      if (left <= 0) { clearInterval(timer); if (score > Games.best("ink")) Games.setBest("ink", score); el.innerHTML = `<div class="cv-over static"><b>Time! Score ${score}</b><button class="btn btn-primary" type="button">Again</button></div>`; el.querySelector("button").onclick = start; } }, 1000);
    (Games.ivs = Games.ivs || []).push(timer); };
  intro();
};

// ---- Taiko Echo (Simon) ----
Games.taiko = function () {
  const el = document.getElementById("taiko"); if (!el) return;
  const PADS = ["#d9362b", "#d9a53b", "#2f8f82", "#4262b0"], F = [262, 330, 392, 523]; let seq, pos, lock, ac;
  const tone = (i) => { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = F[i]; o.type = "triangle"; g.gain.setValueAtTime(0.18, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.35); o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.36); } catch {} };
  const sleep = (ms) => new Promise((r) => Games.timers.push(setTimeout(r, ms)));
  const pad = (i) => el.querySelector(`.tk-pad[data-i="${i}"]`);
  const flash = async (i) => { const p = pad(i); if (!p) return; p.classList.add("lit"); tone(i); await sleep(380); p.classList.remove("lit"); };
  const play = async () => { lock = true; el.querySelector(".tk-msg").textContent = "Watch…"; await sleep(600); for (const i of seq) { await flash(i); await sleep(170); } lock = false; pos = 0; el.querySelector(".tk-msg").textContent = "Your turn"; };
  const next = () => { seq.push(Math.floor(Math.random() * 4)); el.querySelector(".tk-r").textContent = seq.length - 1; play(); };
  const over = () => { const sc = seq.length - 1; if (sc > Games.best("taiko")) Games.setBest("taiko", sc); el.innerHTML = `<div class="cv-over static"><b>You reached round ${sc}</b><button class="btn btn-primary" type="button">Again</button></div>`; el.querySelector("button").onclick = start; };
  const start = () => { seq = []; pos = 0; lock = true;
    el.innerHTML = `<div class="game-stats"><span>Round <b class="tk-r">0</b></span><span class="tk-msg">Watch…</span><span>Best <b>${Games.best("taiko")}</b></span></div><div class="tk-grid">${PADS.map((c, i) => `<button type="button" class="tk-pad" data-i="${i}" style="--c:${c}" aria-label="Drum ${i + 1}"></button>`).join("")}</div>`;
    el.querySelectorAll(".tk-pad").forEach((b) => (b.onclick = async () => { if (lock) return; const i = Number(b.dataset.i); flash(i); if (i !== seq[pos]) return over(); pos++; if (pos === seq.length) { lock = true; await sleep(550); next(); } }));
    next(); };
  el.innerHTML = `<div class="game-stats"><span>Best <b>${Games.best("taiko")}</b></span></div><div class="cv-over static"><b>Repeat the drum pattern. It grows every round.</b><button class="btn btn-primary" type="button">Start</button></div>`; el.querySelector("button").onclick = start;
};

// ---- Word Forge (anagrams) ----
Games.words = function () {
  const el = document.getElementById("words"); if (!el) return;
  const W = [["JUDGE", "Presides over a court"], ["VERDICT", "The decision reached by a jury"], ["STATUTE", "A written law made by a legislature"], ["APPEAL", "Ask a higher court to review a decision"], ["TRIBUNAL", "A body set up to settle particular disputes"], ["ADVOCATE", "A lawyer who pleads in court"],
    ["PRECEDENT", "An earlier case that guides later ones"], ["CONTRACT", "A legally binding agreement"], ["TESTIMONY", "A witness's statement under oath"], ["PLAINTIFF", "The person who brings a case"], ["DEFENDANT", "The person accused or sued"], ["WARRANT", "A document authorising an arrest or search"],
    ["EVIDENCE", "Facts presented to prove a case"], ["AMENDMENT", "A change made to the Constitution"], ["PREAMBLE", "The introduction to the Constitution"], ["SOVEREIGN", "Having supreme power"], ["REPUBLIC", "A state headed by an elected president"], ["BALLOT", "A vote cast in secret"], ["PARLIAMENT", "The legislature of India"], ["JUSTICE", "Fairness under the law"]];
  let list, i, score, built, tiles;
  const scramble = (w) => { let s; do s = shuf(w.split("")).join(""); while (s === w); return s; };
  const draw = () => { if (i >= 8) { if (score > Games.best("words")) Games.setBest("words", score); el.innerHTML = `<div class="cv-over static"><b>${score} / 8 solved${score === 8 ? " · flawless 🏆" : ""}</b><button class="btn btn-primary" type="button">Again</button></div>`; return (el.querySelector("button").onclick = start); }
    const [w, hint] = list[i]; if (!tiles) tiles = scramble(w).split(""); const used = built.map((b) => b.t);
    el.innerHTML = `<div class="game-stats"><span>Word <b>${i + 1}</b>/8</span><span>Score <b>${score}</b></span><span>Best <b>${Games.best("words")}</b></span></div>
      <p class="wf-hint">${hint}</p><div class="wf-ans">${w.split("").map((_, k) => `<span class="${built[k] ? "on" : ""}">${built[k] ? built[k].c : ""}</span>`).join("")}</div>
      <div class="wf-tiles">${tiles.map((c, t) => `<button type="button" class="wf-t" data-t="${t}" ${used.includes(t) ? "disabled" : ""}>${c}</button>`).join("")}</div>
      <div class="wf-ctl"><button type="button" class="btn btn-ghost" id="wf-undo">Undo</button><button type="button" class="btn btn-ghost" id="wf-shuf">Shuffle</button><button type="button" class="btn btn-ghost" id="wf-skip">Skip</button></div>`;
    el.querySelectorAll(".wf-t").forEach((b) => (b.onclick = () => { built.push({ t: Number(b.dataset.t), c: tiles[b.dataset.t] }); if (built.length === w.length) { if (built.map((x) => x.c).join("") === w) { score++; el.querySelector(".wf-ans").classList.add("ok"); setTimeout(() => { i++; built = []; tiles = null; draw(); }, 650); } else { el.querySelector(".wf-ans").classList.add("bad"); setTimeout(() => { built = []; draw(); }, 600); } } else draw(); }));
    el.querySelector("#wf-undo").onclick = () => { built.pop(); draw(); }; el.querySelector("#wf-shuf").onclick = () => { tiles = shuf(tiles); built = []; draw(); }; el.querySelector("#wf-skip").onclick = () => { i++; built = []; tiles = null; draw(); }; };
  const start = () => { list = shuf(W).slice(0, 8); i = 0; score = 0; built = []; tiles = null; draw(); };
  el.innerHTML = `<div class="game-stats"><span>Best <b>${Games.best("words")}</b></span></div><div class="cv-over static"><b>Eight scrambled words, one hint each.</b><button class="btn btn-primary" type="button">Start</button></div>`; el.querySelector("button").onclick = start;
};

// ---- Constitution Quiz ----
Games.consti = function () {
  const el = document.getElementById("consti"); if (!el) return;
  const Q = [["Who chaired the Drafting Committee of the Constitution?", ["B. R. Ambedkar", "Jawaharlal Nehru", "Rajendra Prasad"], "Dr B. R. Ambedkar chaired the Drafting Committee."], ["Which Article abolishes untouchability?", ["Article 17", "Article 15", "Article 21"], "Article 17 abolishes untouchability and forbids its practice."],
    ["Right to Life and Personal Liberty is in…", ["Article 21", "Article 19", "Article 32"], "Article 21 protects life and personal liberty."], ["Which Article gives the Right to Constitutional Remedies?", ["Article 32", "Article 14", "Article 226"], "Article 32 lets you move the Supreme Court for enforcement of Fundamental Rights."],
    ["Fundamental Rights are in which Part of the Constitution?", ["Part III", "Part IV", "Part II"], "Part III holds the Fundamental Rights; Part IV the Directive Principles."], ["The Constitution came into force on…", ["26 January 1950", "15 August 1947", "26 November 1949"], "It was adopted on 26 Nov 1949 and came into force on 26 Jan 1950."],
    ["Which Amendment added the Fundamental Duties?", ["42nd", "44th", "73rd"], "The 42nd Amendment (1976) added Fundamental Duties."], ["Right to Education is under which Article?", ["Article 21A", "Article 45", "Article 19"], "Article 21A, added by the 86th Amendment."], ["Equality before the law is guaranteed by…", ["Article 14", "Article 16", "Article 25"], "Article 14: equality before law and equal protection of the laws."],
    ["Who appoints the Chief Justice of India?", ["The President", "The Prime Minister", "The Parliament"], "The President appoints the CJI under Article 124."], ["Minimum age to be elected President of India?", ["35 years", "30 years", "25 years"], "A candidate must be at least 35."], ["How many Schedules does the Constitution have now?", ["12", "8", "10"], "There are 12 Schedules."],
    ["Who is the first law officer of the Government of India?", ["Attorney General", "Solicitor General", "Law Minister"], "The Attorney General of India (Article 76)."], ["Freedom of speech and expression is in…", ["Article 19(1)(a)", "Article 21", "Article 25"], "Article 19(1)(a)."], ["The words 'Socialist' and 'Secular' were added to the Preamble by the…", ["42nd Amendment", "1st Amendment", "44th Amendment"], "Through the 42nd Amendment (1976)."]];
  let order, i, score;
  const next = () => { if (i >= 10) { if (score > Games.best("consti")) Games.setBest("consti", score); el.innerHTML = `<div class="cv-over static"><b>${score} / 10 correct${score === 10 ? " · flawless 🏆" : ""}</b><button class="btn btn-primary" type="button">Again</button></div>`; return (el.querySelector("button").onclick = start); }
    const [q, opts, note] = order[i], o = shuf(opts);
    el.innerHTML = `<div class="game-stats"><span>Question <b>${i + 1}</b>/10</span><span>Score <b>${score}</b></span><span>Best <b>${Games.best("consti")}</b></span></div><div class="cq-q">${q}</div><div class="mx-o">${o.map((x) => `<button type="button" class="mx-btn" data-ok="${x === opts[0] ? 1 : 0}">${x}</button>`).join("")}</div><p class="cq-note" hidden>${note}</p>`;
    el.querySelectorAll(".mx-btn").forEach((b) => (b.onclick = () => { el.querySelectorAll(".mx-btn").forEach((x) => { x.disabled = true; if (x.dataset.ok === "1") x.classList.add("ok"); }); if (b.dataset.ok === "1") score++; else b.classList.add("bad"); el.querySelector(".cq-note").hidden = false; i++; setTimeout(next, 1900); })); };
  const start = () => { order = shuf(Q).slice(0, 10); i = 0; score = 0; next(); };
  el.innerHTML = `<div class="game-stats"><span>Best <b>${Games.best("consti")}</b></span></div><div class="cv-over static"><b>Ten questions on the Indian Constitution.</b><button class="btn btn-primary" type="button">Start</button></div>`; el.querySelector("button").onclick = start;
};

// ---- Tile Merge (2048) ----
Games.merge = function () {
  const el = document.getElementById("merge"); if (!el) return;
  let g, score, over;
  const add = () => { const e = g.map((v, k) => (v ? -1 : k)).filter((k) => k >= 0); if (e.length) g[e[Math.floor(Math.random() * e.length)]] = Math.random() < 0.9 ? 2 : 4; };
  const slide = (row) => { const a = row.filter(Boolean); for (let k = 0; k < a.length - 1; k++) if (a[k] === a[k + 1]) { a[k] *= 2; score += a[k]; a.splice(k + 1, 1); } while (a.length < 4) a.push(0); return a; };
  const move = (d) => { if (over) return; const b = [...g];
    for (let n = 0; n < 4; n++) { const idx = [0, 1, 2, 3].map((k) => (d === "L" ? n * 4 + k : d === "R" ? n * 4 + 3 - k : d === "U" ? k * 4 + n : (3 - k) * 4 + n)); const r = slide(idx.map((k) => g[k])); idx.forEach((k, j) => (g[k] = r[j])); }
    if (b.join() === g.join()) return; add(); if (score > Games.best("merge")) Games.setBest("merge", score);
    over = !g.includes(0) && !["L", "R", "U", "D"].some((m) => { const s = score, c = [...g]; const t = []; for (let n = 0; n < 4; n++) { const idx = [0, 1, 2, 3].map((k) => (m === "L" ? n * 4 + k : m === "R" ? n * 4 + 3 - k : m === "U" ? k * 4 + n : (3 - k) * 4 + n)); const r = slide(idx.map((k) => c[k])); r.forEach((v, j) => (t[idx[j]] = v)); score = s; } return t.join() !== g.join(); });
    draw(); };
  const draw = () => { el.innerHTML = `<div class="game-stats"><span>Score <b>${score}</b></span><span>Best <b>${Games.best("merge")}</b></span><button class="btn btn-ghost tm-new" type="button">New game</button></div>
      <div class="tm-board">${g.map((v) => `<div class="tm-cell" data-v="${v}">${v || ""}</div>`).join("")}${over ? `<div class="cv-over"><b>No more moves · ${score}</b><button class="btn btn-primary tm-new" type="button">Play again</button></div>` : ""}</div>`;
    el.querySelectorAll(".tm-new").forEach((b) => (b.onclick = start)); };
  const start = () => { g = Array(16).fill(0); score = 0; over = false; add(); add(); draw(); };
  keyGuard("merge", (e) => { const m = { ArrowLeft: "L", ArrowRight: "R", ArrowUp: "U", ArrowDown: "D" }[e.key]; if (m) { e.preventDefault(); move(m); } });
  let sx, sy; el.addEventListener("pointerdown", (e) => { if (e.target.closest(".tm-board")) { sx = e.clientX; sy = e.clientY; } });
  el.addEventListener("pointerup", (e) => { if (sx == null) return; const dx = e.clientX - sx, dy = e.clientY - sy; sx = null; if (Math.hypot(dx, dy) < 24) return; move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "R" : "L") : dy > 0 ? "D" : "U"); });
  el.style.touchAction = "none"; start();
};
