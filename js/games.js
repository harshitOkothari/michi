// ============================================================
// GAMES — three tiny break-time games. Best scores are kept
// on this device only (nothing is sent to the database).
// ============================================================
const Games = {
  timers: [],
  stop() { this.timers.forEach(clearTimeout); this.timers = []; clearInterval(this.breathTimer); },
  best(k) { try { return Number(localStorage.getItem(`game:${DB._user?.id}:${k}`)) || 0; } catch { return 0; } },
  setBest(k, v) { try { localStorage.setItem(`game:${DB._user?.id}:${k}`, String(v)); } catch {} },

  render() {
    this.stop();
    document.getElementById("page-games").innerHTML = `
      <div class="page-header"><h2>Games</h2></div>
      <p class="muted" style="margin:-6px 0 18px">Take a short break. Two minutes here, then back to the path.</p>
      <div class="games-grid">
        <div class="panel game-card"><h3>Memory Match</h3><p class="game-sub">Flip two cards at a time and find all the matching study icons in as few moves as you can.</p><div id="kana"></div></div>
        <div class="panel game-card"><h3>Torii Reflex</h3><p class="game-sub">Wait for the gate to turn red, then tap as fast as you can.</p><div id="reflex"></div></div>
        <div class="panel game-card"><h3>Breathe</h3><p class="game-sub">Box breathing: in, hold, out, hold — four seconds each. Calms exam nerves.</p><div id="breath"></div></div>
      </div>`;
    this.kana(); this.reflex(); this.breath();
  },

  // ---- 1. Kana memory ----
  kana() {
    const set = ["📚", "✏️", "🧪", "🧮", "🔬", "🎯", "💪", "🔥", "⏱️", "🏆", "🧠", "🌸"];
    const el = document.getElementById("kana");
    let open = [], moves = 0, matched = 0, t0 = 0, lock = false;
    const start = () => {
      const pick = [...set].sort(() => Math.random() - 0.5).slice(0, 8);
      const cards = pick.flatMap((k) => [{ id: k, t: k }, { id: k, t: k }]).sort(() => Math.random() - 0.5);
      open = []; moves = 0; matched = 0; t0 = 0; lock = false;
      el.innerHTML = `<div class="game-stats"><span>Moves <b id="k-moves">0</b></span><span>Best <b>${this.best("kana") ? this.best("kana") + " moves" : "—"}</b></span><button class="link-btn" id="k-new">New game</button></div>
        <div class="kana-board">${cards.map((c, i) => `<button class="kcard" data-i="${i}" aria-label="Card ${i + 1}"><i class="kf">M</i><i class="kb">${c.t}</i></button>`).join("")}</div>`;
      document.getElementById("k-new").onclick = start;
      el.querySelectorAll(".kcard").forEach((b) => (b.onclick = () => {
        if (lock || b.classList.contains("up")) return;
        b.classList.add("up"); open.push(b);
        if (open.length < 2) return;
        moves++; document.getElementById("k-moves").textContent = moves;
        const [a, c] = open, same = cards[a.dataset.i].id === cards[c.dataset.i].id && a !== c;
        if (same) { a.classList.add("done"); c.classList.add("done"); open = []; if (++matched === 8) win(); }
        else { lock = true; this.timers.push(setTimeout(() => { a.classList.remove("up"); c.classList.remove("up"); open = []; lock = false; }, 800)); }
      }));
    };
    const win = () => {
      const b = this.best("kana");
      if (!b || moves < b) { this.setBest("kana", moves); toast(`🎌 New best: ${moves} moves!`); } else toast(`Cleared in ${moves} moves.`);
      FX.confetti(100);
    };
    start();
  },

  // ---- 2. reflex ----
  reflex() {
    const el = document.getElementById("reflex");
    let state = "idle", t = 0;
    const draw = (msg, cls = "") => (el.innerHTML = `<div class="game-stats"><span>Last <b id="r-last">—</b></span><span>Best <b>${this.best("reflex") ? this.best("reflex") + " ms" : "—"}</b></span></div><button class="reflex ${cls}" id="r-btn">${msg}</button>`);
    const arm = () => {
      draw("Wait for red…", "wait"); state = "wait";
      this.timers.push(setTimeout(() => { if (state !== "wait") return; const b = document.getElementById("r-btn"); if (!b) return; b.className = "reflex go"; b.textContent = "NOW!"; state = "go"; t = performance.now(); }, 1200 + Math.random() * 2800));
    };
    draw("Tap to start");
    el.addEventListener("click", (e) => {
      if (!e.target.closest("#r-btn")) return;
      if (state === "idle" || state === "done") return arm();
      if (state === "wait") { this.stop(); state = "done"; draw("Too soon! Tap to retry", "bad"); return; }
      if (state === "go") {
        const ms = Math.round(performance.now() - t); state = "done";
        const best = this.best("reflex"), isBest = !best || ms < best; if (isBest) this.setBest("reflex", ms);
        draw(`${ms} ms — tap to retry`); document.getElementById("r-last").textContent = ms + " ms";
        if (isBest) { toast(`⚡ New best: ${ms} ms`); FX.confetti(50); }
      }
    });
  },

  // ---- 3. box breathing ----
  breath() {
    const el = document.getElementById("breath");
    el.innerHTML = `<div class="breath"><div class="breath-orb" id="orb"></div><div class="breath-label" id="b-label">Ready?</div><button class="btn btn-secondary" id="b-btn">Start</button></div>`;
    const steps = [["Breathe in", "in"], ["Hold", "hold-in"], ["Breathe out", ""], ["Hold", "hold"]];
    let i = 0, on = false;
    const tick = () => { const [txt, cls] = steps[i % 4]; const orb = document.getElementById("orb"); if (!orb) return clearInterval(this.breathTimer); orb.className = "breath-orb " + cls; document.getElementById("b-label").textContent = txt; i++; };
    document.getElementById("b-btn").onclick = (e) => {
      on = !on; e.target.textContent = on ? "Stop" : "Start"; clearInterval(this.breathTimer);
      if (on) { i = 0; tick(); this.breathTimer = setInterval(tick, 4000); }
      else { document.getElementById("orb").className = "breath-orb"; document.getElementById("b-label").textContent = "Well done 🙏"; }
    };
  },
};
