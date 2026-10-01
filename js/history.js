// ============================================================
// HISTORY — unified view. Works across whatever goals the user
// has created.
// ============================================================

const History = {
  activeTab: "tests",

  async render() {
    const el = document.getElementById("page-history");
    el.innerHTML = `
      <div class="page-header"><h2>History</h2></div>
      <div class="tabs" id="history-tabs">
        <button class="tab active" data-tab="tests">Tests</button>
        <button class="tab" data-tab="all">All Activity</button>
      </div>
      <div class="search-row">
        <input id="history-search" placeholder="Search history..." />
      </div>
      <div id="history-body"></div>
    `;
    document.querySelectorAll("#history-tabs .tab").forEach((t) => {
      t.onclick = () => {
        document.querySelectorAll("#history-tabs .tab").forEach((x) => x.classList.remove("active"));
        t.classList.add("active");
        this.activeTab = t.dataset.tab;
        this.renderBody();
      };
    });
    this.cache = {};
    let t = null;
    document.getElementById("history-search").oninput = () => { clearTimeout(t); t = setTimeout(() => this.renderBody(), 150); };
    this.renderBody();
  },

  async renderBody() {
    const body = document.getElementById("history-body");
    const query = document.getElementById("history-search").value.toLowerCase();
    const user = await DB.currentUser();
    if (!user) return;

    if (this.activeTab === "tests") {
      if (!this.cache.tests) { await Promise.all([Tests.load(), Goals.load()]); this.cache.tests = true; }
      const filtered = Tests.list.filter((t) => t.name.toLowerCase().includes(query));
      if (!filtered.length) {
        body.innerHTML = `<p class="empty-state">No matching test records.</p>`;
        return;
      }
      body.innerHTML = filtered
        .map((t) => {
          const subject = Goals.subjects.find((s) => s.id === t.subject_id);
          const goal = Goals.list.find((g) => g.id === t.goal_id);
          const percentage = t.total_marks ? pct(t.marks_obtained, t.total_marks) : "—";
          return `<div class="record-card">
            <div class="record-main">
              <strong>${escapeHtml(t.name)}</strong>
              <span class="muted">${escapeHtml(goal?.name || "")}${subject ? " · " + escapeHtml(subject.name) : ""} · ${fmtDate(t.test_date)}</span>
            </div>
            <div class="record-stats"><span>${percentage}${percentage !== "—" ? "%" : ""}</span></div>
          </div>`;
        })
        .join("");
      return;
    }

    if (!this.cache.activity) {
      this.cache.activity = await DB.list("activity_log", {
        filters: { user_id: user.id },
        order: "occurred_at",
        ascending: false,
        limit: 300,
      });
    }
    const activity = this.cache.activity;
    const filtered = activity.filter((a) => a.description.toLowerCase().includes(query));
    if (!filtered.length) {
      body.innerHTML = `<p class="empty-state">No activity yet.</p>`;
      return;
    }
    body.innerHTML = filtered
      .map(
        (a) => `<div class="activity-row">
          <span class="activity-dot activity-${a.activity_type}"></span>
          <span>${escapeHtml(a.description)}</span>
          <span class="muted">${fmtDate(a.occurred_at)}</span>
        </div>`
      )
      .join("");
  },
};
