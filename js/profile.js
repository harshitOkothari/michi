// ============================================================
// SETTINGS (Profile) — name + avatar + stats, XP rules, study
// timer defaults, change password, data export/import, and
// delete account. Avatar is stored in Supabase Storage (bucket
// "avatars"), not the database, so it stays small and fast.
// ============================================================

const XP_FIELDS = [
  ["xp_task", "Task completed", "務", "stk-task"],
  ["xp_study_session", "Study session saved", "学", "stk-study"],
  ["xp_pomodoro", "Pomodoro finished", "時", "stk-pomo"],
  ["xp_test", "Test added", "試", "stk-test"],
  ["xp_workout", "Workout logged", "鍛", "stk-workout"],
  ["xp_weekly_milestone", "Milestone completed", "節", "stk-mile"],
  ["xp_streak_bonus", "Every 7-day streak", "火", "stk-streak"],
];
const TIMER_FIELDS = [
  ["pomodoro_work_min", "Focus (min)", 25],
  ["pomodoro_short_break_min", "Short break (min)", 5],
  ["pomodoro_long_break_min", "Long break (min)", 15],
  ["pomodoro_sessions_before_long", "Focus rounds before long break", 4],
];

// tables included in export / import, in dependency order.
// fk = columns that point at another exported table.
const BACKUP_TABLES = [
  { t: "goals", fk: {} },
  { t: "subjects", fk: { goal_id: "goals" }, need: ["goal_id"] },
  { t: "topics", fk: { subject_id: "subjects" }, need: ["subject_id"] },
  { t: "tests", fk: { goal_id: "goals", subject_id: "subjects" }, need: ["goal_id"] },
  { t: "study_sessions", fk: { goal_id: "goals", subject_id: "subjects" } },
  { t: "pomodoros", fk: { goal_id: "goals", subject_id: "subjects" } },
  { t: "tasks", fk: { goal_id: "goals" } },
  { t: "workout_templates", fk: {} },
  { t: "workouts", fk: {} },
  { t: "workout_exercises", fk: { workout_id: "workouts" }, need: ["workout_id"] },
  { t: "body_measurements", fk: {} },
  { t: "milestones", fk: { goal_id: "goals" } },
  { t: "skills", fk: {} },
  { t: "activity_log", fk: {}, nullCols: ["ref_id"] },
  { t: "xp_events", fk: {}, nullCols: ["ref_id"] },
];

const AVATAR_PRESETS = [
  ["🦊", "#f97316", "#facc15"], ["🐼", "#64748b", "#cbd5e1"], ["🐯", "#f59e0b", "#ef4444"], ["🦉", "#8b5cf6", "#6366f1"],
  ["🐙", "#ec4899", "#8b5cf6"], ["🦄", "#a78bfa", "#f472b6"], ["🚀", "#0ea5e9", "#6366f1"], ["🎧", "#14b8a6", "#22d3ee"],
  ["📚", "#6366f1", "#22d3ee"], ["⚡", "#eab308", "#f97316"], ["🔥", "#ef4444", "#f59e0b"], ["🌙", "#312e81", "#6366f1"],
];
function presetAvatar([emoji, c1, c2]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/><text x="50" y="52" font-size="52" text-anchor="middle" dominant-baseline="central">${emoji}</text></svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

const Profile = {
  openAvatarPicker() {
    openModal(`
      <h3>Choose your picture</h3>
      <div class="avatar-grid">${AVATAR_PRESETS.map((p, i) => `<button type="button" class="avatar-opt" data-i="${i}" aria-label="Avatar ${i + 1}"><img src="${presetAvatar(p)}" alt="" /></button>`).join("")}</div>
      <div class="modal-actions" style="justify-content:space-between">
        <button type="button" class="btn btn-ghost" id="av-remove">Remove photo</button>
        <span><button type="button" class="btn btn-ghost" id="av-close">Close</button> <button type="button" class="btn btn-primary" id="av-upload">Upload my own</button></span>
      </div>`);
    const save = async (url) => {
      const user = await DB.currentUser();
      const { error } = await DB.client.from("profiles").update({ avatar_url: url, updated_at: new Date().toISOString() }).eq("id", user.id);
      if (error) return toast("Couldn't save your picture.", "error");
      closeModal(); toast("Picture updated."); updateSidebarProfile(); Profile.render();
    };
    document.querySelectorAll(".avatar-opt").forEach((b) => (b.onclick = () => save(presetAvatar(AVATAR_PRESETS[b.dataset.i]))));
    document.getElementById("av-remove").onclick = () => save(null);
    document.getElementById("av-close").onclick = closeModal;
    document.getElementById("av-upload").onclick = () => { closeModal(); document.getElementById("avatar-file").click(); };
  },

  async render() {
    const user = await DB.currentUser();
    if (!user) return;
    const [{ data: profile }, { data: streak }, totalXP, settings] = await Promise.all([
      DB.client.from("profiles").select("*").eq("id", user.id).single(),
      DB.client.from("streaks").select("*").eq("user_id", user.id).single(),
      getTotalXP(),
      DB.getSettings(),
    ]);
    const progress = xpProgress(totalXP);
    const memberSince = user.created_at ? fmtDate(user.created_at) : "";
    const val = (k, d) => (settings?.[k] ?? d);

    const el = document.getElementById("page-settings");
    el.innerHTML = `
      <div class="page-header"><h2>Settings</h2></div>

      ${Themes.html()}

      <div class="panel idc-panel"><h3>My Michi ID</h3>${IDCard.html({ name: profile?.name, email: profile?.email || user.email, avatar: profile?.avatar_url, seed: user.id, joined: user.created_at ? new Date(user.created_at).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "", level: progress.level, xp: totalXP, streak: effectiveStreak(streak, settings) })}</div>

      <div class="panel profile-panel">
        <div class="profile-top">
          <div class="avatar-upload">
            <div class="avatar-circle-lg" id="avatar-circle-lg">
              ${profile?.avatar_url ? `<img src="${escapeHtml(profile.avatar_url)}" alt="" />` : initials(profile?.name)}
            </div>
            <button class="avatar-edit-btn" id="avatar-edit-btn">Change photo</button>
            <input type="file" id="avatar-file" accept="image/*" class="hidden" />
          </div>
          <div class="profile-top-info">
            <h3 id="profile-display-name">${escapeHtml(profile?.name || "Add your name")}</h3>
            <span class="muted">${escapeHtml(user.email)}</span>
            <span class="muted small">Member since ${memberSince}</span>
          </div>
        </div>

        <div class="profile-stats-row">
          <div class="mini-stat"><span>Level</span><strong>${progress.level}</strong></div>
          <div class="mini-stat"><span>Total XP</span><strong>${totalXP.toLocaleString()}</strong></div>
          <div class="mini-stat"><span>Current streak</span><strong>${effectiveStreak(streak, settings)} days</strong></div>
          <div class="mini-stat"><span>Best streak</span><strong>${streak?.longest_streak || 0} days</strong></div>
        </div>

        <form id="profile-name-form" class="profile-name-form">
          <label>Name
            <input type="text" id="profile-name-input" value="${profile ? escapeHtml(profile.name || "") : ""}" placeholder="Your name" />
          </label>
          <button type="submit" class="btn btn-primary">Save</button>
        </form>

      </div>

      <div class="panel settings-section">
        <h3>XP rewards <small class="jp-sm">経験値</small></h3>
        <p class="settings-hint">XP rewards are set by Michi so every level means the same thing for everyone. Here's what each action earns.</p>
        <div class="xp-rules">
          ${XP_FIELDS.map(([k, label, kj, cls]) => `<div class="xp-rule"><span class="stk ${cls}" aria-hidden="true">${kj}</span><span class="xp-rule-name">${label}</span><b>+${XP_RULES[k]} XP</b></div>`).join("")}
        </div>
        <form id="xp-form" class="streak-form">
          <label>Missed days allowed in a streak<input type="number" min="0" max="7" step="1" name="streak_grace_days" value="${val("streak_grace_days", 0)}" /></label>
          <button type="submit" class="btn btn-primary">Save</button>
        </form>
      </div>

      <div class="panel settings-section">
        <h3>Study timer</h3>
        <p class="settings-hint">Default lengths for the Pomodoro timer.</p>
        <form id="timer-form">
          <div class="settings-grid">
            ${TIMER_FIELDS.map(([k, label, d]) => `<label>${label}<input type="number" min="1" max="240" step="1" name="${k}" value="${val(k, d)}" /></label>`).join("")}
          </div>
          <div class="settings-actions"><button type="submit" class="btn btn-primary">Save timer</button></div>
        </form>
      </div>

      <div class="panel settings-section">
        <h3>Password</h3>
        <form id="password-form" class="settings-inline">
          <label>New password<input type="password" id="new-password" minlength="6" required autocomplete="new-password" placeholder="At least 6 characters" /></label>
          <label>Confirm<input type="password" id="new-password2" minlength="6" required autocomplete="new-password" placeholder="Type it again" /></label>
          <button type="submit" class="btn btn-primary">Change password</button>
        </form>
      </div>

      <div class="panel settings-section">
        <h3>Your data</h3>
        <p class="settings-hint">Download a copy of everything in your account, or restore from a copy. Restoring adds records — it never deletes what you already have.</p>
        <div class="settings-actions" style="margin-top:0">
          <button class="btn btn-secondary" id="export-btn">Export my data</button>
          <button class="btn btn-ghost" id="import-btn">Import from file</button>
          <input type="file" id="import-file" accept="application/json,.json" class="file-input-hidden" />
        </div>
      </div>

      <div class="panel settings-section session-section">
        <h3>Session <small class="jp-sm">退出</small></h3>
        <p class="settings-hint">Signing out keeps all your data safe in your account — just log back in any time.</p>
        <button class="btn btn-ghost" id="profile-logout-btn">Log out</button>
      </div>

      <div class="panel settings-section danger-zone">
        <h3>Delete account</h3>
        <p class="settings-hint">Permanently deletes your account and every record in it. This can't be undone. Export your data first if you might want it later.</p>
        <button class="btn btn-danger" id="delete-account-btn">Delete my account</button>
      </div>
    `;

    Themes.wire();
    // ---- profile ----
    document.getElementById("profile-name-form").onsubmit = async (e) => {
      e.preventDefault();
      const name = document.getElementById("profile-name-input").value.trim();
      const { error } = await DB.client.from("profiles").update({ name, updated_at: new Date().toISOString() }).eq("id", user.id);
      if (error) return toast("Couldn't save your name.", "error");
      toast("Profile updated.");
      updateSidebarProfile();
      Profile.render();
    };
    document.getElementById("avatar-edit-btn").onclick = () => Profile.openAvatarPicker();
    document.getElementById("avatar-file").onchange = (e) => Profile.uploadAvatar(e, user.id);
    document.getElementById("profile-logout-btn").onclick = async () => { await Auth.signOut(); };

    // ---- XP rules + timer ----
    const readForm = (form, fields) => {
      const patch = {};
      for (const [k] of fields) {
        const n = Number(form.elements[k].value);
        if (!Number.isFinite(n) || n < 0) throw new Error("Numbers only, and no negatives.");
        patch[k] = Math.round(n);
      }
      return patch;
    };
    document.getElementById("xp-form").onsubmit = async (e) => {
      e.preventDefault();
      try {
        const patch = readForm(e.target, [["streak_grace_days"]]);
        await DB.saveSettings({ ...patch, updated_at: new Date().toISOString() });
        toast("Streak setting saved.");
      } catch (err) { toast(err.message || "Couldn't save.", "error"); }
    };
    document.getElementById("timer-form").onsubmit = async (e) => {
      e.preventDefault();
      try {
        const patch = readForm(e.target, TIMER_FIELDS);
        if (Object.values(patch).some((n) => n < 1)) throw new Error("Timer values must be at least 1.");
        await DB.saveSettings({ ...patch, updated_at: new Date().toISOString() });
        Study.pomo.settings = null; // reload next time the timer opens
        toast("Timer saved.");
      } catch (err) { toast(err.message || "Couldn't save.", "error"); }
    };

    // ---- password ----
    document.getElementById("password-form").onsubmit = async (e) => {
      e.preventDefault();
      const a = document.getElementById("new-password").value;
      if (a !== document.getElementById("new-password2").value) return toast("The two passwords don't match.", "error");
      try {
        await Auth.updatePassword(a);
        e.target.reset();
        toast("Password changed.");
      } catch (err) { toast(friendlyAuthError(err), "error"); }
    };

    // ---- data ----
    document.getElementById("export-btn").onclick = () => Profile.exportData(user);
    document.getElementById("import-btn").onclick = () => document.getElementById("import-file").click();
    document.getElementById("import-file").onchange = (e) => Profile.importData(e);

    // ---- delete account ----
    document.getElementById("delete-account-btn").onclick = () => Profile.deleteAccountFlow();
  },

  async exportData(user) {
    const btn = document.getElementById("export-btn");
    btn.disabled = true; btn.textContent = "Preparing…";
    try {
      const results = await Promise.all(
        BACKUP_TABLES.map(({ t }) => DB.client.from(t).select("*").eq("user_id", user.id).then((r) => {
          if (r.error) throw r.error;
          return [t, r.data || []];
        }))
      );
      const { data: profile } = await DB.client.from("profiles").select("name").eq("id", user.id).single();
      const payload = {
        app: "dashboard",
        version: 1,
        exported_at: new Date().toISOString(),
        name: profile?.name || "",
        tables: Object.fromEntries(results),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `dashboard-backup-${todayStr()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      const total = results.reduce((n, [, rows]) => n + rows.length, 0);
      toast(`Exported ${total} records.`);
    } catch (err) {
      console.error(err);
      toast("Export failed. Check your connection and try again.", "error");
    } finally {
      btn.disabled = false; btn.textContent = "Export my data";
    }
  },

  async importData(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    let payload;
    try {
      payload = JSON.parse(await file.text());
      if (payload.app !== "dashboard" || typeof payload.tables !== "object") throw new Error("bad file");
    } catch {
      return toast("That doesn't look like a Dashboard backup file.", "error");
    }
    const total = BACKUP_TABLES.reduce((n, { t }) => n + (payload.tables[t]?.length || 0), 0);
    if (!total) return toast("The file has no records in it.", "error");
    const ok = await confirmDialog(
      "Import this backup?",
      `This adds ${total} records to your account. Nothing you already have is changed or removed, so importing the same file twice creates duplicates.`,
      "Import",
      false
    );
    if (!ok) return;

    const user = await DB.currentUser();
    const idMap = {}; // table -> { oldId: newId }
    let added = 0;
    try {
      for (const { t, fk, need = [], nullCols = [] } of BACKUP_TABLES) {
        const rows = payload.tables[t] || [];
        if (!rows.length) continue;
        idMap[t] = {};
        const prepared = [];
        const oldIds = [];
        for (const r of rows) {
          const row = { ...r };
          const oldId = row.id;
          delete row.id;
          row.user_id = user.id;
          let skip = false;
          for (const [col, parent] of Object.entries(fk)) {
            if (row[col] == null) continue;
            const mapped = idMap[parent]?.[row[col]];
            if (mapped) row[col] = mapped;
            else if (need.includes(col)) skip = true;
            else row[col] = null;
          }
          for (const c of nullCols) row[c] = null;
          if (need.some((c) => row[c] == null)) skip = true;
          if (skip) continue;
          prepared.push(row);
          oldIds.push(oldId);
        }
        for (let i = 0; i < prepared.length; i += 200) {
          const chunk = prepared.slice(i, i + 200);
          const { data, error } = await DB.client.from(t).insert(chunk).select("id");
          if (error) throw error;
          data.forEach((d, j) => { idMap[t][oldIds[i + j]] = d.id; });
          added += data.length;
        }
        DB._invalidate(t);
      }
      toast(`Imported ${added} records.`);
      Goals.list = []; Goals.subjects = []; Goals.activeGoalId = null;
      Profile.render();
    } catch (err) {
      console.error(err);
      toast(`Import stopped after ${added} records: ${err.message || "unknown error"}`, "error");
    }
  },

  deleteAccountFlow() {
    openModal(`
      <h3>Delete your account?</h3>
      <p class="modal-body-text">Your profile, goals, tests, study history, tasks, workouts and XP will be deleted for good. Type <strong>DELETE</strong> to confirm.</p>
      <form id="delete-form">
        <input id="delete-confirm" placeholder="DELETE" autocomplete="off" />
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" id="delete-cancel">Cancel</button>
          <button type="submit" class="btn btn-danger" id="delete-go" disabled>Delete forever</button>
        </div>
      </form>
    `);
    const input = document.getElementById("delete-confirm");
    const go = document.getElementById("delete-go");
    input.oninput = () => { go.disabled = input.value.trim() !== "DELETE"; };
    document.getElementById("delete-cancel").onclick = closeModal;
    document.getElementById("delete-form").onsubmit = async (e) => {
      e.preventDefault();
      if (input.value.trim() !== "DELETE") return;
      go.disabled = true; go.textContent = "Deleting…";
      const { error } = await DB.client.rpc("delete_my_account");
      if (error) {
        closeModal();
        const missing = /delete_my_account|function|schema cache/i.test(error.message || "");
        toast(missing ? "Delete isn't set up yet — run sql/phase3.sql in Supabase (see README)." : "Couldn't delete the account. Try again.", "error");
        return;
      }
      closeModal();
      await Auth.signOut();
      toast("Your account was deleted.");
    };
  },

  async uploadAvatar(e, userId) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast("Image too large — please pick one under 3MB.", "error");
      return;
    }
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await DB.client.storage.from("avatars").upload(path, file, { upsert: true });
    if (uploadError) {
      toast("Could not upload photo. Check that the 'avatars' storage bucket exists (see README).", "error");
      return;
    }
    const { data: urlData } = DB.client.storage.from("avatars").getPublicUrl(path);
    const avatar_url = `${urlData.publicUrl}?t=${Date.now()}`; // cache-bust
    await DB.client.from("profiles").update({ avatar_url, updated_at: new Date().toISOString() }).eq("id", userId);
    toast("Photo updated.");
    updateSidebarProfile();
    Profile.render();
  },
};

function initials(name) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

async function updateSidebarProfile() {
  const user = await DB.currentUser();
  if (!user) return;
  const { data: profile } = await DB.client.from("profiles").select("name, avatar_url").eq("id", user.id).single();
  const nameEl = document.getElementById("sidebar-profile-name");
  const avatarEl = document.getElementById("sidebar-avatar");
  if (nameEl) nameEl.textContent = profile?.name || user.email.split("@")[0];
  if (avatarEl) {
    avatarEl.innerHTML = profile?.avatar_url ? `<img src="${escapeHtml(profile.avatar_url)}" alt="" />` : initials(profile?.name);
  }
}
