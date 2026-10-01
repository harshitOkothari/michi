// ============================================================
// FITNESS — workout log (date + exercises with sets/reps/weight),
// optional templates (Push/Pull/Legs/custom), auto-detected PRs,
// and body measurements with a progression chart.
// ============================================================

const Fitness = {
  activeTab: "workouts",
  workouts: [],
  templates: [],
  measurements: [],

  async render() {
    this.wiz = null;
    const el = document.getElementById("page-fitness");
    el.innerHTML = `
      <div class="page-header">
        <h2>Fitness</h2>
        <div class="header-actions">
          <button class="btn btn-ghost" id="add-template-btn">+ Template</button>
          <button class="btn btn-primary" id="add-workout-btn">+ Add Workout</button>
        </div>
      </div>
      <div class="tabs" id="fitness-tabs">
        <button class="tab ${this.activeTab === "workouts" ? "active" : ""}" data-tab="workouts">Workouts</button>
        <button class="tab ${this.activeTab === "prs" ? "active" : ""}" data-tab="prs">Personal Records</button>
        <button class="tab ${this.activeTab === "measurements" ? "active" : ""}" data-tab="measurements">Body Measurements</button>
      </div>
      <div id="fitness-body"></div>
    `;
    document.getElementById("add-workout-btn").onclick = () => this.openWorkoutForm();
    document.getElementById("add-template-btn").onclick = () => this.openTemplateForm();
    document.querySelectorAll("#fitness-tabs .tab").forEach((t) => {
      t.onclick = () => {
        this.activeTab = t.dataset.tab;
        this.render();
      };
    });
    if (this.activeTab === "workouts") await this.renderWorkouts();
    else if (this.activeTab === "prs") await this.renderPRs();
    else await this.renderMeasurements();
  },

  async loadWorkouts() {
    const user = await DB.currentUser();
    // 3 requests in total, however many workouts there are
    // (it used to make one extra request PER workout)
    const [workouts, templates, exercises] = await Promise.all([
      DB.list("workouts", { filters: { user_id: user.id }, order: "workout_date", ascending: false, limit: 60 }),
      DB.list("workout_templates", { filters: { user_id: user.id } }),
      DB.list("workout_exercises", { filters: { user_id: user.id } }),
    ]);
    this.templates = templates;
    const byWorkout = {};
    exercises.forEach((ex) => (byWorkout[ex.workout_id] = byWorkout[ex.workout_id] || []).push(ex));
    this.workouts = workouts.map((w) => ({ ...w, exercises: byWorkout[w.id] || [] }));
  },

  async renderWorkouts() {
    await this.loadWorkouts();
    const body = document.getElementById("fitness-body");
    if (!this.workouts.length) {
      body.innerHTML = `<p class="empty-state">No workouts logged yet.</p>`;
      return;
    }
    body.innerHTML = this.workouts
      .map(
        (w) => `
      <div class="panel workout-card">
        <div class="page-header" style="margin-bottom:8px;">
          <h3>${escapeHtml(w.workout_type || "Workout")} <span class="muted small">· ${fmtDate(w.workout_date)}</span></h3>
          <div class="record-actions">
            <button class="link-btn" data-action="edit-w" data-id="${w.id}">Edit</button>
            <button class="link-btn danger" data-action="del-w" data-id="${w.id}">Delete</button>
          </div>
        </div>
        ${w.exercises.length
          ? w.exercises.map((ex) => `<div class="mini-row"><span>${escapeHtml(ex.exercise_name)}${ex.is_pr ? " 🏆" : ""}</span><span class="muted">${ex.sets || "?"}×${ex.reps || "?"} @ ${ex.weight || "?"}${ex.weight_unit || "kg"}</span></div>`).join("")
          : `<p class="empty-state">No exercises logged.</p>`}
        ${w.notes ? `<p class="muted small" style="margin-top:8px;">${escapeHtml(w.notes)}</p>` : ""}
      </div>`
      )
      .join("");

    body.querySelectorAll("[data-action='del-w']").forEach((btn) => {
      btn.onclick = async () => {
        const ok = await confirmDialog("Delete this workout?", "This removes it and its exercises from your log and PR history.", "Delete");
        if (!ok) return;
        await DB.remove("workouts", btn.dataset.id);
        toast("Workout deleted.");
        this.render();
      };
    });
    body.querySelectorAll("[data-action='edit-w']").forEach((btn) => {
      btn.onclick = () => {
        const w = this.workouts.find((x) => x.id === btn.dataset.id);
        this.openWorkoutForm(w);
      };
    });
  },

  openTemplateForm() {
    const existing = this.templates || [];
    openModal(`
      <h3>Workout Templates</h3>
      <p class="modal-body-text">Templates are the workout types you can pick when logging a workout.</p>
      ${existing.length ? `<div class="topic-list">${existing.map((t) => `<div class="topic-row"><span>${escapeHtml(t.name)}</span><button type="button" class="link-btn danger" data-del-tpl="${t.id}">Delete</button></div>`).join("")}</div>` : ""}
      <form id="template-form">
        <label>New template<input required id="tpl-name" placeholder="Push, Pull, Legs, Upper, Lower, custom..." /></label>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" id="tpl-cancel">Close</button>
          <button type="submit" class="btn btn-primary">Add</button>
        </div>
      </form>
    `);
    document.getElementById("tpl-cancel").onclick = closeModal;
    document.querySelectorAll("[data-del-tpl]").forEach((b) => {
      b.onclick = async () => {
        await DB.remove("workout_templates", b.dataset.delTpl);
        this.templates = this.templates.filter((t) => t.id !== b.dataset.delTpl);
        toast("Template deleted.");
        this.openTemplateForm();
      };
    });
    document.getElementById("template-form").onsubmit = async (e) => {
      e.preventDefault();
      const name = document.getElementById("tpl-name").value.trim();
      if (!name) return;
      const saved = await DB.insert("workout_templates", { name });
      this.templates = [...(this.templates || []), saved];
      toast("Template added.");
      this.openTemplateForm();
    };
  },

  // built-in workout types + the person's own templates (no duplicates)
  typeOptions(current) {
    const seen = new Set(), out = [];
    const add = (name, group) => { const k = name.toLowerCase(); if (seen.has(k)) return; seen.add(k); out.push({ name, group }); };
    (this.templates || []).forEach((t) => add(t.name, "Your templates"));
    if (current) add(current, "Your templates");
    WORKOUT_TYPES.forEach(([group, names]) => names.forEach((n) => add(n, group)));
    const groups = [];
    out.forEach((o) => { let g = groups.find((x) => x.name === o.group); if (!g) groups.push((g = { name: o.group, items: [] })); g.items.push(o.name); });
    return groups.map((g) => `<optgroup label="${escapeHtml(g.name)}">${g.items.map((n) => `<option value="${escapeHtml(n)}"${n === current ? " selected" : ""}>${escapeHtml(n)}</option>`).join("")}</optgroup>`).join("");
  },

  openWorkoutForm(workout = null) {
    const exercises = workout?.exercises || [{ exercise_name: "", sets: "", reps: "", weight: "" }];
    openModal(`
      <h3>${workout ? "Edit Workout" : "Add Workout"}</h3>
      <form id="workout-form">
        <label>Date<input type="date" id="w-date" value="${workout?.workout_date || todayStr()}" /></label>
        <label>Type<select id="w-type">
          <option value="">Select a workout type</option>
          ${this.typeOptions(workout?.workout_type)}
        </select></label>
        <div id="exercise-rows"></div>
        <button type="button" class="link-btn" id="add-exercise-row">+ Add exercise</button>
        <label>Notes<textarea id="w-notes">${workout ? escapeHtml(workout.notes || "") : ""}</textarea></label>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" id="w-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </form>
    `);

    const rowsEl = document.getElementById("exercise-rows");
    const addRow = (ex = { exercise_name: "", sets: "", reps: "", weight: "" }) => {
      const row = document.createElement("div");
      row.className = "exercise-row";
      row.innerHTML = `
        <input placeholder="Exercise" class="ex-name" value="${escapeHtml(ex.exercise_name || "")}" />
        <input placeholder="Sets" type="number" class="ex-sets" value="${ex.sets ?? ""}" />
        <input placeholder="Reps" type="number" class="ex-reps" value="${ex.reps ?? ""}" />
        <input placeholder="Weight (kg)" type="number" class="ex-weight" value="${ex.weight ?? ""}" />
        <button type="button" class="link-btn danger ex-remove">✕</button>
      `;
      row.querySelector(".ex-remove").onclick = () => row.remove();
      rowsEl.appendChild(row);
    };
    exercises.forEach((ex) => addRow(ex));
    document.getElementById("add-exercise-row").onclick = () => addRow();
    document.getElementById("w-cancel").onclick = closeModal;

    document.getElementById("workout-form").onsubmit = async (e) => {
      e.preventDefault();
      const payload = {
        workout_date: document.getElementById("w-date").value,
        workout_type: document.getElementById("w-type").value || null,
        notes: document.getElementById("w-notes").value.trim(),
      };
      let savedWorkout;
      if (workout) {
        savedWorkout = await DB.update("workouts", workout.id, payload);
        const existing = await DB.list("workout_exercises", { filters: { workout_id: workout.id } });
        for (const ex of existing) await DB.remove("workout_exercises", ex.id);
      } else {
        savedWorkout = await DB.insert("workouts", payload);
      }

      const rows = [...rowsEl.querySelectorAll(".exercise-row")];
      for (const row of rows) {
        const name = row.querySelector(".ex-name").value.trim();
        if (!name) continue;
        const weight = row.querySelector(".ex-weight").value;
        const isPR = await this.checkAndMarkPR(name, weight ? Number(weight) : null);
        await DB.insert("workout_exercises", {
          workout_id: savedWorkout.id,
          exercise_name: name,
          sets: numOrNullEl(row.querySelector(".ex-sets")),
          reps: numOrNullEl(row.querySelector(".ex-reps")),
          weight: weight ? Number(weight) : null,
          is_pr: isPR,
        });
      }

      if (!workout) {
        await DB.reward("xp_workout", 20, "workout", "workout", `Logged a ${payload.workout_type || "workout"}`, savedWorkout.id);
      }
      closeModal();
      toast("Workout saved.");
      this.render();
    };
  },

  // a PR = heaviest weight ever recorded for that exact exercise name (case-insensitive)
  async checkAndMarkPR(exerciseName, weight) {
    if (!weight) return false;
    const user = await DB.currentUser();
    const { data } = await DB.client
      .from("workout_exercises")
      .select("weight, exercise_name")
      .eq("user_id", user.id)
      .ilike("exercise_name", exerciseName.replace(/[\\%_]/g, (c) => "\\" + c));
    const maxPrev = Math.max(0, ...(data || []).map((r) => r.weight || 0));
    return weight > maxPrev;
  },

  async renderPRs() {
    const body = document.getElementById("fitness-body");
    const user = await DB.currentUser();
    const { data } = await DB.client
      .from("workout_exercises")
      .select("exercise_name, weight, weight_unit")
      .eq("user_id", user.id)
      .eq("is_pr", true)
      .order("weight", { ascending: false });

    if (!data || !data.length) {
      body.innerHTML = `<p class="empty-state">No personal records yet — they're detected automatically the first time you beat your previous best on an exercise.</p>`;
      return;
    }
    // keep only the current (highest) PR per exercise name
    const best = {};
    data.forEach((r) => {
      const key = r.exercise_name.toLowerCase();
      if (!best[key] || r.weight > best[key].weight) best[key] = r;
    });
    body.innerHTML = `<div class="stat-cards">${Object.values(best)
      .map((r) => `<div class="stat-card"><span class="stat-label">${escapeHtml(r.exercise_name)}</span><span class="stat-value">${r.weight}${r.weight_unit || "kg"}</span></div>`)
      .join("")}</div>`;
  },

  async renderMeasurements() {
    const body = document.getElementById("fitness-body");
    body.innerHTML = `
      <div class="page-header" style="margin-bottom:10px;">
        <span class="muted small">Tap a body part to measure just that, or start a guided walk-through.</span>
        <button class="btn btn-secondary" id="add-measurement-btn">+ Log Measurement</button>
      </div>
      <div class="meas-grid">
        <div class="panel meas-panel" id="body-panel"><h3>Body map</h3><div id="body-map"></div><div id="meas-wizard"></div></div>
        <div class="panel meas-panel" id="scale-panel"><h3>Body weight</h3><div id="weigh-scale"></div></div>
      </div>
      <div id="measurement-list" class="record-list"></div>
    `;
    document.getElementById("add-measurement-btn").onclick = () => this.startWizard();

    const user = await DB.currentUser();
    this.measurements = await DB.list("body_measurements", { filters: { user_id: user.id }, order: "measured_at", ascending: true });
    this.renderBodyMap();
    this.renderScale();
    this.renderWizard();

    const listEl = document.getElementById("measurement-list");
    if (!listEl) return;
    listEl.innerHTML = [...this.measurements].reverse()
      .map((m) => {
        const bits = BODY_PARTS.filter((p) => m[p.key] != null).map((p) => `${p.label} ${m[p.key]}`);
        return `<div class="record-card">
          <div class="record-main"><strong>${fmtDate(m.measured_at)}</strong><span class="muted">${m.weight != null ? m.weight + "kg" : ""}${bits.length ? (m.weight != null ? " · " : "") + bits.join(" · ") : ""}</span></div>
          <div class="record-actions"><button class="link-btn danger" data-id="${m.id}">Delete</button></div>
        </div>`;
      })
      .join("") || `<p class="empty-state">No measurements yet.</p>`;
    listEl.querySelectorAll("[data-id]").forEach((btn) => {
      btn.onclick = async () => {
        await DB.remove("body_measurements", btn.dataset.id);
        toast("Measurement deleted.");
        this.renderMeasurements();
      };
    });
  },

  // newest value that isn't empty, plus the one before it
  latestOf(key) {
    const rows = (this.measurements || []).filter((m) => m[key] != null);
    return { now: rows[rows.length - 1] || null, prev: rows[rows.length - 2] || null };
  },

  // ---- three-view, clay-mannequin body (front · side · back) ----
  // Shapes are drawn for one half and mirrored; soft gradients give the
  // rounded, sculpted "3D render" look. Measured parts tint in the accent
  // colour, and the part being asked about blinks red.
  renderBodyMap() {
    const el = document.getElementById("body-map");
    if (!el) return;
    const v = {};
    BODY_PARTS.forEach((p) => (v[p.key] = this.wiz?.vals?.[p.key] ?? this.latestOf(p.key).now?.[p.key] ?? null));
    const ask = this.wiz ? this.wiz.steps[this.wiz.i] : null;

    const mir = (d) => d.replace(/(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g, (m, x, y) => `${-x} ${y}`);
    const both = (d) => `${d} ${mir(d)}`;            // one path, both halves (torso, head…)
    const limb = (d, cls = "") => `<path class="${cls}" d="${d}"/><path class="${cls}" d="${mir(d)}"/>`; // separate halves, own shading
    const lines = (arr, cls = "bd") => arr.map((d) => `<path class="${cls}" d="${d}"/><path class="${cls}" d="${mir(d)}"/>`).join("");

    // ----- FRONT / BACK shared silhouette (right half) -----
    const S = {
      head: "M0 8 C12 8 19 17 19 30 C19 42 15 52 9 58 C6 61 3 62 0 62",
      neck: "M0 52 L11 52 C12 60 13 66 16 74 L0 76",
      torso: "M0 68 L13 70 C30 74 52 82 66 93 C62 106 52 116 48 128 C46 146 44 160 38 180 C32 194 30 204 32 218 C35 228 38 238 36 250 L0 254",
      arm: "M60 92 C72 88 83 97 84 111 C86 126 85 138 82 150 C80 162 77 170 76 180 C77 192 77 206 74 222 C72 234 69 246 67 256 L57 256 C58 244 60 232 60 220 C60 206 60 192 60 180 C60 164 58 150 55 138 C52 126 51 116 50 106 C52 98 56 93 60 92 Z",
      hand: "M57 256 L68 256 C72 268 72 280 68 290 C64 296 59 293 58 284 C56 274 56 264 57 256 Z",
      leg: "M2 246 L39 238 C46 252 51 272 50 290 C49 306 44 320 40 334 C37 342 38 350 38 358 C40 368 37 384 32 396 C30 400 29 404 29 408 L14 408 C14 398 12 386 11 372 C10 360 9 350 10 340 C11 326 10 306 8 288 C6 272 4 258 2 246 Z",
      foot: "M14 408 L29 408 C33 414 33 420 26 423 L12 423 C9 419 11 412 14 408 Z",
      brief: "M0 217 L40 215 C43 226 41 237 35 246 C25 256 14 262 3 268 L0 268 Z",
      briefB: "M0 217 L40 215 C44 228 44 242 40 254 C28 262 14 264 0 262 Z",
    };
    // muscle-group bands (curved so they wrap the form); clipped to the body
    const B = {
      shoulders: "M50 86 Q70 82 90 90 L90 128 Q70 124 50 128 Z",
      arms: "M52 132 Q70 136 90 132 L90 184 Q70 188 52 184 Z",
      chest: "M-54 90 Q0 102 54 90 L54 136 Q0 148 -54 136 Z",
      waist: "M-48 150 Q0 160 48 150 L48 218 Q0 228 -48 218 Z",
      thighs: "M0 252 Q28 259 56 252 L56 322 Q28 329 0 322 Z",
    };
    // ----- SIDE silhouette (faces left) -----
    const SIDE = {
      body: "M-2 8 C10 6 19 15 19 28 C19 40 16 50 12 56 L13 64 C15 72 22 78 30 86 C36 98 36 112 34 126 C32 146 28 164 27 180 C26 192 28 200 34 212 C41 224 42 242 37 256 C35 270 33 290 31 308 C30 322 29 332 29 342 C31 352 34 362 33 376 C32 388 27 398 24 404 L24 412 C24 418 18 421 10 421 L-28 421 C-36 421 -38 414 -32 411 C-24 408 -18 406 -15 402 C-14 394 -15 384 -15 372 C-16 358 -19 348 -21 340 C-23 330 -24 322 -25 312 C-28 296 -30 280 -29 268 C-28 256 -29 246 -30 236 C-32 226 -32 214 -30 204 C-30 192 -29 182 -29 172 C-31 158 -36 148 -41 136 C-46 124 -46 112 -42 104 C-38 96 -28 92 -20 88 L-14 84 L-12 68 L-11 60 C-14 58 -16 56 -15 53 L-16 47 L-14 45 L-17 40 C-21 38 -21 35 -18 33 L-16 29 C-17 24 -15 18 -10 12 C-8 9 -5 8 -2 8 Z",
      arm: "M-10 92 C2 88 14 94 15 108 C16 124 14 142 12 158 C11 170 11 184 11 196 C11 212 12 228 13 244 L-2 252 C-3 234 -6 216 -9 200 C-11 188 -12 176 -13 166 C-15 150 -17 134 -15 118 C-15 106 -13 97 -10 92 Z",
      hand: "M-2 252 L13 246 C16 260 16 274 10 284 C4 290 -3 284 -4 272 Z",
      brief: "M-31 216 C-30 232 -29 246 -26 262 C-10 266 14 266 32 260 C40 248 44 232 40 214 C12 220 -12 220 -31 216 Z",
    };
    const SB = {
      shoulders: "M-16 86 Q0 82 18 90 L18 120 Q0 116 -16 120 Z",
      arms: "M-18 122 Q0 126 18 122 L18 176 Q0 180 -18 176 Z",
      chest: "M-54 94 Q-34 102 -14 96 L-14 144 Q-34 152 -54 144 Z",
      waist: "M-40 154 Q0 164 46 154 L46 214 Q0 224 -40 214 Z",
      thighs: "M-40 252 Q0 259 48 252 L48 320 Q0 327 -40 320 Z",
    };

    const defs = `<defs>
      <linearGradient id="clay" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#85868d"/><stop offset=".2" stop-color="#c3c4c9"/><stop offset=".5" stop-color="#eceef0"/><stop offset=".8" stop-color="#c0c1c7"/><stop offset="1" stop-color="#7f8087"/></linearGradient>
      <linearGradient id="clayS" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d9dadd"/><stop offset=".35" stop-color="#e8e9ec"/><stop offset=".75" stop-color="#b6b7bd"/><stop offset="1" stop-color="#85868d"/></linearGradient>
      <linearGradient id="vshade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>
      <linearGradient id="briefG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b5b6bc"/><stop offset="1" stop-color="#8b8c93"/></linearGradient>
      <radialGradient id="floorG"><stop offset="0" stop-color="#000" stop-opacity=".42"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    </defs>`;

    // clip-paths for a view: everything / torso+legs / arms
    const clips = (id, all, bodyPaths, armPaths) => `<clipPath id="${id}-all">${all}</clipPath><clipPath id="${id}-body">${bodyPaths}</clipPath><clipPath id="${id}-arms">${armPaths}</clipPath>`;
    const cp = (ds) => ds.map((d) => `<path d="${d}"/>`).join("");
    const bandZone = (key, d, mirrorIt) => `<g class="bz${v[key] != null ? " has" : ""}${ask === key ? " ask" : ""}" data-part="${key}" tabindex="0" role="button" aria-label="${key}${v[key] != null ? " " + v[key] + " centimetres" : ", not measured"}"><path d="${d}"/>${mirrorIt ? `<path d="${mir(d)}"/>` : ""}</g>`;
    const zoneSet = (set, keys, mirrorKeys, clipId) => keys.map((k) => bandZone(k, set[k], mirrorKeys.includes(k))).join("");

    // ---------- FRONT ----------
    const frontAll = [both(S.head), both(S.neck), both(S.torso), mir(S.arm), S.arm, mir(S.hand), S.hand, mir(S.leg), S.leg, mir(S.foot), S.foot].join(" ");
    const front = `
      <g transform="translate(110 0)">
        <ellipse cx="0" cy="424" rx="64" ry="7" fill="url(#floorG)"/>
        ${clips("fr", `<path d="${frontAll}"/>`, cp([both(S.torso), S.leg, mir(S.leg), both(S.head), both(S.neck)]), cp([S.arm, mir(S.arm), S.hand, mir(S.hand)]))}
        <g class="bfig">
          ${limb(S.leg, "bs")}${limb(S.foot, "bs")}
          <path class="bs" d="${both(S.neck)}"/><path class="bs" d="${both(S.head)}"/>
          <ellipse class="bs" cx="-19.5" cy="34" rx="2.6" ry="5.4"/><ellipse class="bs" cx="19.5" cy="34" rx="2.6" ry="5.4"/>
          <path class="bs" d="${both(S.torso)}"/>
          <path class="brf" d="${both(S.brief)}"/>
          ${limb(S.hand, "bs")}
          <g class="bd-wrap">
            ${lines(["M8 60 C10 68 13 74 16 78", "M6 80 C20 78 36 82 58 92", "M3 120 C18 134 38 132 49 118", "M49 120 C52 112 54 104 55 98", "M2 148 C8 150 14 150 18 148", "M2 166 C8 168 15 168 19 166", "M2 184 C8 186 14 186 17 184", "M19 138 C22 160 21 188 17 212", "M46 134 L38 138", "M46 144 L39 148", "M45 154 L39 157", "M31 206 C26 212 17 216 9 217", "M26 262 C34 282 34 304 28 326", "M12 264 C17 286 19 308 15 330", "M26 352 C31 366 30 382 25 396", "M18 354 C17 372 18 388 19 398", "M56 98 C62 110 62 122 57 132", "M16 332 C22 328 30 329 34 335"])}
            <path class="bd" d="M0 70 L0 222"/><ellipse class="bd-fill" cx="0" cy="176" rx="1.6" ry="2.6"/>
            <path class="bd" d="M4 27 C8 25 13 25 14 28"/><path class="bd" d="M-4 27 C-8 25 -13 25 -14 28"/><path class="bd" d="M6 32 C8 31 11 31 12 32"/><path class="bd" d="M-6 32 C-8 31 -11 31 -12 32"/><path class="bd" d="M0 31 L0 41 M-4 43 C-2 45 2 45 4 43 M-6 51 C-2 53 2 53 6 51"/>
            <ellipse class="bd bd-soft" cx="24" cy="341" rx="6.5" ry="5.5"/><ellipse class="bd bd-soft" cx="-24" cy="341" rx="6.5" ry="5.5"/>
            <path class="bh" d="M-14 100 C-6 106 6 106 14 100"/>${lines(["M26 98 C34 104 40 112 44 122", "M70 104 C74 116 74 128 71 140", "M27 284 C30 298 30 308 27 320"], "bh")}
          </g>
          <g clip-path="url(#fr-body)">${zoneSet(B, ["chest", "waist"], [], "fr-body")}${bandZone("thighs", B.thighs, true)}</g>
          <path class="bs" d="${mir(S.arm)}"/><path class="bs" d="${S.arm}"/>
          <g class="bd-wrap">${lines(["M68 120 C71 134 71 148 68 160", "M62 178 C67 181 72 181 76 178", "M68 192 C69 210 67 226 64 244"])}</g>
          <g clip-path="url(#fr-arms)">${bandZone("shoulders", B.shoulders, true)}${bandZone("arms", B.arms, true)}</g>
          <rect x="-90" y="0" width="180" height="430" fill="url(#vshade)" clip-path="url(#fr-all)" pointer-events="none"/>
        </g>
        <text class="bcap" x="0" y="440">FRONT</text>
      </g>`;

    // ---------- BACK ----------
    const backAll = frontAll;
    const back = `
      <g transform="translate(490 0)">
        <ellipse cx="0" cy="424" rx="64" ry="7" fill="url(#floorG)"/>
        ${clips("bk", `<path d="${backAll}"/>`, cp([both(S.torso), S.leg, mir(S.leg), both(S.head), both(S.neck)]), cp([S.arm, mir(S.arm), S.hand, mir(S.hand)]))}
        <g class="bfig">
          ${limb(S.leg, "bs")}${limb(S.foot, "bs")}
          <path class="bs" d="${both(S.neck)}"/><path class="bs" d="${both(S.head)}"/>
          <ellipse class="bs" cx="-19.5" cy="34" rx="2.6" ry="5.4"/><ellipse class="bs" cx="19.5" cy="34" rx="2.6" ry="5.4"/>
          <path class="bs" d="${both(S.torso)}"/>
          <path class="brf" d="${both(S.briefB)}"/>
          ${limb(S.hand, "bs")}
          <g class="bd-wrap">
            <path class="bd" d="M0 70 L0 222"/>
            ${lines(["M10 76 C24 96 36 112 44 128", "M3 82 C16 100 28 116 36 128", "M12 100 C24 98 36 106 36 122 C32 130 20 130 14 122", "M46 134 C42 156 32 178 20 198", "M49 120 C52 112 54 104 55 98", "M26 262 C34 282 34 304 28 326", "M12 264 C17 286 19 308 15 330", "M14 336 C22 340 32 340 36 336", "M18 348 C13 362 15 380 20 394", "M32 348 C38 362 36 380 31 394", "M21 396 L22 406", "M68 192 C69 210 67 226 64 244"])}
            <path class="bd" d="M-14 42 C-8 50 8 50 14 42"/>
            ${lines(["M20 240 C28 232 38 232 44 240", "M26 268 C28 286 28 304 25 322"], "bh")}
          </g>
          <g clip-path="url(#bk-body)">${zoneSet(B, ["chest", "waist"], [], "bk-body")}${bandZone("thighs", B.thighs, true)}</g>
          <path class="bs" d="${mir(S.arm)}"/><path class="bs" d="${S.arm}"/>
          <g class="bd-wrap">${lines(["M68 124 C72 138 72 152 68 166", "M68 192 C69 210 67 226 64 244"])}</g>
          <g clip-path="url(#bk-arms)">${bandZone("shoulders", B.shoulders, true)}${bandZone("arms", B.arms, true)}</g>
          <rect x="-90" y="0" width="180" height="430" fill="url(#vshade)" clip-path="url(#bk-all)" pointer-events="none"/>
        </g>
        <text class="bcap" x="0" y="440">BACK</text>
      </g>`;

    // ---------- SIDE ----------
    const side = `
      <g transform="translate(300 0)">
        <ellipse cx="0" cy="424" rx="60" ry="7" fill="url(#floorG)"/>
        ${clips("sd", `<path d="${SIDE.body} ${SIDE.arm} ${SIDE.hand}"/>`, cp([SIDE.body]), cp([SIDE.arm, SIDE.hand]))}
        <g class="bfig">
          <path class="bs bsS" d="${SIDE.body}"/>
          <path class="brf" d="${SIDE.brief}"/>
          <g class="bd-wrap">
            <ellipse class="bd-fill" cx="-8" cy="27" rx="1.5" ry="1.2"/><ellipse class="bd bd-soft" cx="5" cy="34" rx="3" ry="5.5"/>
            ${["M-10 54 C-2 57 6 55 11 50", "M-8 62 C-2 70 6 76 12 82", "M-40 130 C-30 141 -20 139 -12 131", "M-28 152 C-30 172 -29 192 -27 206", "M32 214 C40 224 40 240 34 254", "M33 268 C33 290 31 310 29 326", "M-22 266 C-26 288 -26 310 -23 330", "M31 352 C34 364 32 378 27 394", "M-16 352 C-17 370 -16 384 -15 398", "M-16 100 C-28 110 -34 122 -34 132"].map((d) => `<path class="bd" d="${d}"/>`).join("")}
            <ellipse class="bd bd-soft" cx="-20" cy="338" rx="5" ry="6.5"/>
          </g>
          <g clip-path="url(#sd-body)">${zoneSet(SB, ["chest", "waist", "thighs"], [], "sd-body")}</g>
          <path class="bs bsS" d="${SIDE.arm}"/><path class="bs bsS" d="${SIDE.hand}"/>
          <g class="bd-wrap">${["M8 112 C10 130 10 146 9 160", "M-9 120 C-12 134 -11 148 -10 160", "M-10 172 C-2 175 6 175 11 172", "M-4 192 C-4 212 -3 230 -2 246"].map((d) => `<path class="bd" d="${d}"/>`).join("")}</g>
          <g clip-path="url(#sd-arms)">${zoneSet(SB, ["shoulders", "arms"], [], "sd-arms")}</g>
          <rect x="-90" y="0" width="180" height="430" fill="url(#vshade)" clip-path="url(#sd-all)" pointer-events="none"/>
        </g>
        <text class="bcap" x="0" y="440">SIDE</text>
      </g>`;

    const chips = BODY_PARTS.map((p) => {
      const has = v[p.key] != null;
      return `<button type="button" class="bchip-btn${has ? " has" : ""}${ask === p.key ? " ask" : ""}" data-part="${p.key}"><span>${p.label}</span><b>${has ? v[p.key] + " cm" : "+ add"}</b></button>`;
    }).join("");

    el.innerHTML = `
      <svg viewBox="0 0 600 446" class="body-svg body-3" role="img" aria-label="Body measurements map — front, side and back views">${defs}${front}${side}${back}</svg>
      <div class="bchips" id="body-chips">${chips}</div>`;

    el.querySelectorAll("[data-part]").forEach((n) => {
      const open = () => { if (!this.wiz) this.startWizard([n.dataset.part]); else this.gotoWizardPart(n.dataset.part); };
      n.addEventListener("click", open);
      n.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    });
  },

  // ---- weighing scale: the needle is a real spring, the number follows it ----
  renderScale() {
    const el = document.getElementById("weigh-scale");
    if (!el) return;
    cancelAnimationFrame(this._scaleRaf);
    const { now, prev } = this.latestOf("weight");
    const W = now ? Number(now.weight) : 0, MAX = 150;
    const ang = (w) => -120 + (Math.min(Math.max(w, 0), MAX) / MAX) * 240;
    const pt = (deg, r) => [120 + r * Math.sin((deg * Math.PI) / 180), 92 - r * Math.cos((deg * Math.PI) / 180)];
    const ticks = Array.from({ length: 76 }, (_, i) => {
      const d = -120 + i * 3.2, major = i % 5 === 0, [x1, y1] = pt(d, 54), [x2, y2] = pt(d, major ? 46 : 50);
      return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="st${major ? " big" : ""}"/>`;
    }).join("");
    const nums = Array.from({ length: 6 }, (_, i) => { const [tx, ty] = pt(-120 + i * 48, 37); return `<text x="${tx.toFixed(1)}" y="${(ty + 2.5).toFixed(1)}" class="sn">${i * 30}</text>`; }).join("");
    const pm = prev ? pt(ang(Number(prev.weight)), 58) : null;
    const diff = now && prev ? Math.round((W - Number(prev.weight)) * 10) / 10 : null;
    el.innerHTML = `
      <svg viewBox="0 0 240 262" class="scale-svg" id="scale-svg" role="img" aria-label="Weighing scale">
        <defs>
          <linearGradient id="sc-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--surface-alt)"/><stop offset="1" style="stop-color:var(--border)"/></linearGradient>
          <linearGradient id="sc-bezel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f4f6"/><stop offset=".5" stop-color="#8d8d95"/><stop offset="1" stop-color="#e6e6ea"/></linearGradient>
          <radialGradient id="sc-face" cx=".4" cy=".3" r=".9"><stop offset="0" style="stop-color:var(--surface)"/><stop offset="1" style="stop-color:var(--surface-alt)"/></radialGradient>
          <linearGradient id="sc-sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient>
          <radialGradient id="sc-floor"><stop offset="0" stop-color="#000" stop-opacity=".4"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
        </defs>
        <ellipse cx="120" cy="252" rx="98" ry="9" fill="url(#sc-floor)"/>
        <g id="scale-plate">
          <rect x="12" y="12" width="216" height="232" rx="46" fill="url(#sc-body)" class="s-body"/>
          <rect x="22" y="22" width="196" height="212" rx="36" class="s-glass"/>
          <path d="M40 22 H150 L22 150 V58 Q22 22 40 22Z" fill="url(#sc-sheen)"/>
          <circle cx="120" cy="92" r="68" fill="url(#sc-bezel)"/>
          <circle cx="120" cy="92" r="63" fill="url(#sc-face)" class="s-dial"/>
          <circle cx="120" cy="92" r="57" fill="none" class="s-track" stroke-width="4" stroke-linecap="round" stroke-dasharray="240 360" pathLength="360" transform="rotate(150 120 92)"/>
          <circle id="scale-arc" cx="120" cy="92" r="57" fill="none" stroke="var(--accent)" stroke-width="4" stroke-linecap="round" stroke-dasharray="0 360" pathLength="360" transform="rotate(150 120 92)"/>
          ${ticks}${nums}
          <text x="120" y="122" class="s-unit">KG</text>
          ${pm ? `<circle cx="${pm[0]}" cy="${pm[1]}" r="3" class="s-prev"><title>Last time</title></circle>` : ""}
          <g id="scale-needle" transform="rotate(${this._angle ?? -120} 120 92)" class="s-needle"><polygon points="118.6,98 120,42 121.4,98 120,110"/><circle cx="120" cy="92" r="6.5"/><circle cx="118.4" cy="90.4" r="2" fill="#fff" opacity=".7"/></g>
          <g class="s-feet"><path class="foot" d="M82 176c0-10 8-16 14-16s12 6 12 16-4 36-13 36-13-26-13-36z"/><path class="foot" d="M132 176c0-10 6-16 12-16s14 6 14 16-4 36-13 36-13-26-13-36z"/></g>
        </g>
      </svg>
      <div class="scale-read"><span class="scale-num" id="scale-num">${now ? (this._angle != null ? (((this._angle + 120) / 240) * MAX).toFixed(1) : "0.0") : "--"}</span><span class="scale-unit">kg</span></div>
      <div class="scale-meta">${now ? `Logged ${fmtDate(now.measured_at)}${diff !== null ? ` · <span class="delta ${diff > 0 ? "up" : diff < 0 ? "down" : ""}">${diff > 0 ? "▲" : diff < 0 ? "▼" : "•"} ${Math.abs(diff)} kg</span> since ${fmtDate(prev.measured_at)}` : ""}` : "Step on the scale to log your weight."}</div>
      <div class="scale-actions"><button class="btn btn-primary" id="step-on-btn">⚖ Step on the scale</button></div>
      <div id="weight-trend"></div>`;
    document.getElementById("step-on-btn").onclick = () => this.openMeasurementForm("m-weight");
    const weights = this.measurements.filter((m) => m.weight != null).map((m) => m.weight);
    if (weights.length > 1) renderLineTrend(document.getElementById("weight-trend"), weights);
    if (!now) return;

    const svg = document.getElementById("scale-svg"), plate = document.getElementById("scale-plate"), needle = document.getElementById("scale-needle"),
      arc = document.getElementById("scale-arc"), num = document.getElementById("scale-num");
    const target = ang(W);
    let pos = this._angle ?? -120, vel = 0;
    const paint = () => {
      needle.setAttribute("transform", `rotate(${pos.toFixed(2)} 120 92)`);
      arc.setAttribute("stroke-dasharray", `${Math.max(0, pos + 120).toFixed(2)} 360`);
      num.textContent = Math.max(0, ((pos + 120) / 240) * MAX).toFixed(1);
    };
    if (FX.reduced || Math.abs(target - pos) < 0.05) { pos = target; paint(); this._angle = target; return; }
    const spring = () => {
      svg.classList.add("stepping");
      let last = performance.now(); const t0 = last, k = 90, c = 12.5; // small overshoot, then settles
      const frame = (nowT) => {
        const dt = Math.min(0.032, (nowT - last) / 1000); last = nowT;
        const t = (nowT - t0) / 1000, a = target - pos;
        vel += (k * a - c * vel) * dt; pos += vel * dt;
        plate.setAttribute("transform", `translate(0 ${(4.5 * Math.exp(-4.5 * t) * Math.cos(15 * t)).toFixed(2)})`);
        paint();
        if (Math.abs(a) < 0.04 && Math.abs(vel) < 0.08 && t > 0.7) { pos = target; paint(); plate.removeAttribute("transform"); this._angle = target; return; }
        this._scaleRaf = requestAnimationFrame(frame);
      };
      this._scaleRaf = requestAnimationFrame(frame);
    };
    this._scaleTimer = setTimeout(spring, 260); // a short beat before the "step on"
  },


  // ---------- guided, one-part-at-a-time measuring ----------
  startWizard(steps) {
    const full = !steps;
    this.wiz = { steps: full ? ["shoulders", "chest", "arms", "waist", "thighs", "weight", "review"] : [...steps], i: 0, vals: {}, full, date: todayStr(), notes: "" };
    this.refreshWizard();
    document.getElementById("body-panel")?.scrollIntoView({ behavior: FX.reduced ? "auto" : "smooth", block: "nearest" });
  },

  async openMeasurementForm(focusId) {
    if (!document.getElementById("meas-wizard")) { this.activeTab = "measurements"; await this.render(); }
    const k = focusId && focusId.startsWith("m-") ? focusId.slice(2) : null;
    this.startWizard(k && (k === "weight" || BODY_PARTS.some((p) => p.key === k)) ? [k] : undefined);
  },

  gotoWizardPart(key) {
    const w = this.wiz, i = w.steps.indexOf(key);
    if (i < 0) return;
    this.readWizardInput();
    w.i = i;
    this.refreshWizard();
  },

  refreshWizard() {
    this.renderBodyMap();
    this.renderWizard();
    const key = this.wiz?.steps[this.wiz.i];
    document.getElementById("scale-panel")?.classList.toggle("ask", key === "weight");
    if (key === "weight" && this.wiz.vals.weight != null) this.tweenScale(this.wiz.vals.weight);
  },

  cancelWizard() {
    this.wiz = null;
    document.getElementById("scale-panel")?.classList.remove("ask");
    this.renderBodyMap();
    this.renderWizard();
    this.tweenScale(this.latestOf("weight").now ? Number(this.latestOf("weight").now.weight) : 0);
  },

  readWizardInput() {
    const w = this.wiz, inp = document.getElementById("wz-input");
    if (!w || !inp) return;
    const key = w.steps[w.i];
    if (inp.value === "") delete w.vals[key]; else w.vals[key] = Number(inp.value);
  },

  renderWizard() {
    const el = document.getElementById("meas-wizard");
    if (!el) return;
    const w = this.wiz;
    if (!w) { el.innerHTML = ""; return; }
    const key = w.steps[w.i], n = w.steps.length, isReview = key === "review", isLast = w.i === n - 1;
    const part = key === "weight" ? WEIGHT_STEP : BODY_PARTS.find((p) => p.key === key);
    const dots = `<div class="wiz-dots" aria-hidden="true">${w.steps.map((s, i) => `<i class="${i < w.i ? "done" : i === w.i ? "now" : ""}"></i>`).join("")}</div>`;

    if (isReview) {
      const rows = [...BODY_PARTS, WEIGHT_STEP].map((p) => `<button type="button" class="wiz-row" data-jump="${p.key}"><span>${p.label}</span><b>${w.vals[p.key] != null ? w.vals[p.key] + " " + p.unit : "skipped"}</b></button>`).join("");
      el.innerHTML = `<div class="wiz wiz-in">${dots}
        <div class="wiz-head"><span class="wiz-step">Review</span><button type="button" class="link-btn" id="wz-cancel">Cancel</button></div>
        <h4 class="wiz-title">All done — check and save</h4>
        <div class="wiz-rows">${rows}</div>
        <div class="wiz-meta"><label>Date<input type="date" id="wz-date" value="${w.date}" /></label><label>Notes<input type="text" id="wz-notes" placeholder="optional" value="${escapeHtml(w.notes)}" /></label></div>
        <div class="wiz-actions"><button type="button" class="btn btn-ghost" id="wz-back">Back</button><button type="button" class="btn btn-primary" id="wz-save">Save measurement</button></div></div>`;
      el.querySelectorAll("[data-jump]").forEach((b) => (b.onclick = () => { w.date = document.getElementById("wz-date").value || w.date; w.notes = document.getElementById("wz-notes").value; this.gotoWizardPart(b.dataset.jump); }));
      document.getElementById("wz-back").onclick = () => { w.i--; this.refreshWizard(); };
      document.getElementById("wz-cancel").onclick = () => this.cancelWizard();
      document.getElementById("wz-save").onclick = () => { w.date = document.getElementById("wz-date").value || todayStr(); w.notes = document.getElementById("wz-notes").value.trim(); this.saveWizard(); };
      return;
    }

    const last = this.latestOf(key).now?.[key];
    el.innerHTML = `<div class="wiz wiz-in">${dots}
      <div class="wiz-head"><span class="wiz-step">Step ${w.i + 1} of ${n}</span><button type="button" class="link-btn" id="wz-cancel">Cancel</button></div>
      <h4 class="wiz-title">${part.ask}</h4>
      <p class="wiz-hint">${part.hint}</p>
      <div class="wiz-input"><input type="number" id="wz-input" step="0.1" min="0" inputmode="decimal" autocomplete="off" placeholder="${last != null ? "last: " + last : "0.0"}" value="${w.vals[key] ?? ""}" /><span class="wiz-unit">${part.unit}</span></div>
      <div class="wiz-actions">
        <button type="button" class="btn btn-ghost" id="wz-back" ${w.i === 0 ? "disabled" : ""}>Back</button>
        <button type="button" class="btn btn-ghost" id="wz-skip">Skip</button>
        <button type="button" class="btn btn-primary" id="wz-next">${isLast ? "Save" : w.steps[w.i + 1] === "review" ? "Review" : "Next"}</button>
      </div></div>`;
    const inp = document.getElementById("wz-input");
    const go = (dir) => { this.readWizardInput(); w.i += dir; this.refreshWizard(); };
    const next = () => {
      if (inp.value === "" || Number(inp.value) <= 0) { inp.classList.remove("shake"); void inp.offsetWidth; inp.classList.add("shake"); return toast("Type a number, or press Skip.", "error"); }
      if (isLast) { this.readWizardInput(); this.saveWizard(); } else go(1);
    };
    document.getElementById("wz-next").onclick = next;
    document.getElementById("wz-skip").onclick = () => { delete w.vals[key]; if (isLast) { Object.keys(w.vals).length ? this.saveWizard() : this.cancelWizard(); } else { w.i++; this.refreshWizard(); } };
    document.getElementById("wz-back").onclick = () => go(-1);
    document.getElementById("wz-cancel").onclick = () => this.cancelWizard();
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); next(); } else if (e.key === "Escape") { e.stopPropagation(); this.cancelWizard(); } });
    if (key === "weight") inp.addEventListener("input", () => { const x = Number(inp.value); if (x >= 0) this.tweenScale(x); });
    else inp.addEventListener("input", () => { w.vals[key] = inp.value === "" ? undefined : Number(inp.value); const chip = document.querySelector(`.bchip-btn[data-part="${key}"] b`); if (chip) chip.textContent = inp.value === "" ? "+ add" : inp.value + " cm"; });
    setTimeout(() => inp.focus({ preventScroll: true }), 60);
  },

  async saveWizard() {
    const w = this.wiz;
    const row = { measured_at: w.date || todayStr(), notes: w.notes || "" };
    [...BODY_PARTS.map((p) => p.key), "weight"].forEach((k) => (row[k] = w.vals[k] != null && !Number.isNaN(w.vals[k]) ? w.vals[k] : null));
    if ([...BODY_PARTS.map((p) => p.key), "weight"].every((k) => row[k] == null)) return toast("Enter at least one measurement.", "error");
    await DB.insert("body_measurements", row);
    this.wiz = null;
    toast("Measurement saved.");
    this.renderMeasurements();
  },

  // eases the scale needle to a weight (used while typing in the weight step)
  tweenScale(wt) {
    const needle = document.getElementById("scale-needle"), arc = document.getElementById("scale-arc"), num = document.getElementById("scale-num");
    if (!needle) return;
    cancelAnimationFrame(this._scaleRaf); cancelAnimationFrame(this._twRaf); clearTimeout(this._scaleTimer);
    const MAX = 150, target = -120 + (Math.min(Math.max(wt, 0), MAX) / MAX) * 240;
    let pos = this._angle ?? -120;
    const paint = () => {
      needle.setAttribute("transform", `rotate(${pos.toFixed(2)} 120 92)`);
      arc.setAttribute("stroke-dasharray", `${Math.max(0, pos + 120).toFixed(2)} 360`);
      num.textContent = Math.max(0, ((pos + 120) / 240) * MAX).toFixed(1);
    };
    const step = () => {
      pos += (target - pos) * (FX.reduced ? 1 : 0.16);
      if (Math.abs(target - pos) < 0.05) pos = target;
      this._angle = pos; paint();
      if (pos !== target) this._twRaf = requestAnimationFrame(step);
    };
    step();
  },
};

const WEIGHT_STEP = { key: "weight", label: "Weight", unit: "kg", ask: "What do you weigh right now?", hint: "Step on the scale barefoot — mornings, before eating, give the most consistent reading." };

const WORKOUT_TYPES = [
  ["Split", ["Push", "Pull", "Legs", "Upper body", "Lower body", "Full body"]],
  ["Muscle group", ["Chest", "Back", "Shoulders", "Arms", "Core / Abs", "Glutes"]],
  ["Cardio", ["Running", "Walking", "Cycling", "Swimming", "HIIT", "Jump rope", "Cardio (general)"]],
  ["Other", ["Calisthenics", "Yoga", "Mobility / Stretching", "Sports", "Martial arts", "Other"]],
];

const BODY_PARTS = [
  { key: "shoulders", label: "Shoulders", unit: "cm", ask: "Measure your shoulders", hint: "Stand tall and relaxed. Wrap the tape around the widest point of your shoulders, over the deltoids." },
  { key: "chest", label: "Chest", unit: "cm", ask: "Measure your chest", hint: "Wrap the tape under your armpits around the fullest part of your chest. Breathe out normally." },
  { key: "arms", label: "Arms", unit: "cm", ask: "Measure your upper arm", hint: "Around the thickest part of your upper arm. Keep it relaxed (or flexed) — just stay consistent." },
  { key: "waist", label: "Waist", unit: "cm", ask: "Measure your waist", hint: "At the narrowest point, usually just above the belly button. Don't suck in." },
  { key: "thighs", label: "Thighs", unit: "cm", ask: "Measure your thigh", hint: "Around the fullest part of your upper thigh, just below the glutes. Weight evenly on both feet." },
];

function numOrNullEl(input) {
  return input.value === "" ? null : Number(input.value);
}
