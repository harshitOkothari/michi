// ============================================================
// ADMIN — read-only view across all users. Only visible to
// accounts granted admin via the admin_users table (set
// manually in Supabase SQL Editor — never from this app).
// ============================================================

const Admin = {
  isAdmin: false,
  users: [],

  async checkIsAdmin() {
    const user = await DB.currentUser();
    if (!user) return false;
    const { data } = await DB.client.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
    this.isAdmin = !!data;
    document.getElementById("nav-admin-btn")?.classList.toggle("hidden", !this.isAdmin);
    return this.isAdmin;
  },

  async render() {
    const el = document.getElementById("page-admin");
    if (!this.isAdmin) {
      el.innerHTML = `<div class="page-header"><h2>Admin</h2></div><p class="empty-state">Not available.</p>`;
      return;
    }
    const { data: users, error } = await DB.client
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error || !users) {
      el.innerHTML = `<div class="page-header"><h2>Admin</h2></div><p class="empty-state">Could not load users.</p>`;
      return;
    }
    this.users = users;

    // pull streaks for everyone in one go for the summary list
    const { data: streaks } = await DB.client.from("streaks").select("*");

    el.innerHTML = `
      <div class="page-header"><h2>Admin</h2></div>
      <p class="muted small" style="margin-bottom:14px">${users.length} user${users.length === 1 ? "" : "s"} total. Click anyone to see their full profile.</p>
      <div id="admin-user-list" class="record-list"></div>
      <div id="admin-detail"></div>
    `;

    const listEl = document.getElementById("admin-user-list");
    listEl.innerHTML = users
      .map((u) => {
        const streak = (streaks || []).find((s) => s.user_id === u.id);
        return `
        <div class="record-card admin-user-row" data-id="${u.id}">
          <div class="record-main" style="flex-direction:row; align-items:center; gap:12px;">
            <span class="sidebar-avatar" style="width:36px;height:36px;font-size:14px;">
              ${u.avatar_url ? `<img src="${u.avatar_url}" alt="" />` : initials(u.name)}
            </span>
            <span>
              <strong>${escapeHtml(u.name || "Unnamed")}</strong><br/>
              <span class="muted small">${escapeHtml(u.email || "")}</span>
            </span>
          </div>
          <div class="record-stats">
            <span>🔥 ${streak?.current_streak || 0}</span>
            <span>Joined ${fmtDate(u.created_at)}</span>
          </div>
        </div>`;
      })
      .join("");

    listEl.querySelectorAll(".admin-user-row").forEach((row) => {
      row.addEventListener("click", () => this.renderUserDetail(row.dataset.id));
    });
  },

  async renderUserDetail(userId) {
    const detailEl = document.getElementById("admin-detail");
    detailEl.innerHTML = `<p class="empty-state">Loading...</p>`;
    detailEl.scrollIntoView({ behavior: "smooth", block: "nearest" });

    const profile = this.users.find((u) => u.id === userId);
    const [{ data: streak }, goals, subjects, tests, tasks, activity, { data: totalXpRows }] = await Promise.all([
      DB.client.from("streaks").select("*").eq("user_id", userId).single(),
      DB.client.from("goals").select("*").eq("user_id", userId).order("created_at", { ascending: true }).then((r) => r.data || []),
      DB.client.from("subjects").select("*").eq("user_id", userId).then((r) => r.data || []),
      DB.client.from("tests").select("*").eq("user_id", userId).order("test_date", { ascending: false }).limit(10).then((r) => r.data || []),
      DB.client.from("tasks").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20).then((r) => r.data || []),
      DB.client.from("activity_log").select("*").eq("user_id", userId).order("occurred_at", { ascending: false }).limit(15).then((r) => r.data || []),
      DB.client.from("xp_events").select("amount").eq("user_id", userId),
    ]);

    const totalXP = (totalXpRows || []).reduce((sum, r) => sum + r.amount, 0);
    const progress = xpProgress(totalXP);

    detailEl.innerHTML = `
      <div class="panel admin-detail-panel">
        <div class="profile-top">
          <div class="avatar-circle-lg">
            ${profile?.avatar_url ? `<img src="${profile.avatar_url}" alt="" />` : initials(profile?.name)}
          </div>
          <div class="profile-top-info">
            <h3>${escapeHtml(profile?.name || "Unnamed")}</h3>
            <span class="muted">${escapeHtml(profile?.email || "")}</span>
            <span class="muted small">Member since ${fmtDate(profile?.created_at)}</span>
          </div>
        </div>

        <div class="profile-stats-row">
          <div class="mini-stat"><span>Level</span><strong>${progress.level}</strong></div>
          <div class="mini-stat"><span>Total XP</span><strong>${totalXP.toLocaleString()}</strong></div>
          <div class="mini-stat"><span>Current streak</span><strong>${streak?.current_streak || 0} days</strong></div>
          <div class="mini-stat"><span>Best streak</span><strong>${streak?.longest_streak || 0} days</strong></div>
        </div>

        <h4 class="admin-section-title">Goals &amp; Subjects</h4>
        ${goals.length ? goals.map((g) => {
          const subs = subjects.filter((s) => s.goal_id === g.id);
          return `<div class="mini-row"><span>${escapeHtml(g.name)}</span><span class="muted">${subs.length} subject${subs.length === 1 ? "" : "s"}</span></div>`;
        }).join("") : `<p class="empty-state">No goals yet.</p>`}

        <h4 class="admin-section-title">Recent Tests</h4>
        ${tests.length ? tests.map((t) => {
          const pctVal = t.total_marks ? pct(t.marks_obtained, t.total_marks) : null;
          return `<div class="mini-row"><span>${escapeHtml(t.name)}</span><span>${pctVal !== null ? pctVal + "%" : "—"}</span><span class="muted">${fmtDate(t.test_date)}</span></div>`;
        }).join("") : `<p class="empty-state">No tests yet.</p>`}

        <h4 class="admin-section-title">Tasks / To-do</h4>
        ${tasks.length ? tasks.map((t) => `<div class="mini-row"><span>${t.status === "completed" ? "✅" : "⬜"} ${escapeHtml(t.title)}</span><span class="muted">${escapeHtml(t.category)}</span></div>`).join("") : `<p class="empty-state">No tasks yet.</p>`}

        <h4 class="admin-section-title">Recent Activity</h4>
        ${activity.length ? activity.map((a) => `<div class="mini-row"><span>${escapeHtml(a.description)}</span><span class="muted">${fmtDate(a.occurred_at)}</span></div>`).join("") : `<p class="empty-state">No activity yet.</p>`}
      </div>
    `;
  },
};
