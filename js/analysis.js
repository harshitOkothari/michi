// ============================================================
// ANALYSIS — one tab per goal the user has created, each with
// overall average, subject breakdown, best/worst, and a score
// progression chart. Works identically for JEE, NEET, CLAT,
// College, Boards, or any custom goal.
// ============================================================

const Analysis = {
  activeGoalId: null,

  async render() {
    await Goals.load();
    await Tests.load();
    const el = document.getElementById("page-analysis");
    const activeGoals = Goals.list.filter((g) => !g.archived);

    if (!activeGoals.length) {
      el.innerHTML = `<div class="page-header"><h2>Analysis</h2></div><p class="empty-state">Add a goal and a few tests to see analysis here.</p>`;
      return;
    }
    if (!this.activeGoalId) this.activeGoalId = activeGoals[0].id;

    el.innerHTML = `
      <div class="page-header"><h2>Analysis</h2></div>
      <div class="tabs" id="analysis-tabs">
        ${activeGoals.map((g) => `<button class="tab ${g.id === this.activeGoalId ? "active" : ""}" data-goal="${g.id}">${escapeHtml(g.name)}</button>`).join("")}
      </div>
      <div id="analysis-body"></div>
    `;
    document.querySelectorAll("#analysis-tabs .tab").forEach((t) => {
      t.onclick = () => {
        this.activeGoalId = t.dataset.goal;
        this.render();
      };
    });
    this.renderGoalAnalysis(this.activeGoalId);
  },

  renderGoalAnalysis(goalId) {
    const body = document.getElementById("analysis-body");
    const tests = Tests.list.filter((t) => t.goal_id === goalId && t.total_marks);

    if (!tests.length) {
      body.innerHTML = `<p class="empty-state">Complete more tests under this goal to generate a trend.</p>`;
      return;
    }

    const scores = tests.map((t) => pct(t.marks_obtained, t.total_marks));
    const overallAvg = Math.round(avg(scores));

    const bySubject = {};
    tests.forEach((t) => {
      const key = t.subject_id || "none";
      bySubject[key] = bySubject[key] || [];
      bySubject[key].push(pct(t.marks_obtained, t.total_marks));
    });
    const subjectLabels = Object.keys(bySubject).map(
      (id) => Goals.subjects.find((s) => s.id === id)?.name || "Unassigned"
    );
    const subjectAverages = Object.values(bySubject).map((arr) => Math.round(avg(arr)));

    const best = tests.reduce((a, b) => (pct(a.marks_obtained, a.total_marks) > pct(b.marks_obtained, b.total_marks) ? a : b));
    const worst = tests.reduce((a, b) => (pct(a.marks_obtained, a.total_marks) < pct(b.marks_obtained, b.total_marks) ? a : b));

    body.innerHTML = `
      <div class="stat-cards">
        <div class="stat-card"><span class="stat-label">Overall Average</span><span class="stat-value">${overallAvg}%</span></div>
        <div class="stat-card"><span class="stat-label">Tests Recorded</span><span class="stat-value">${tests.length}</span></div>
        <div class="stat-card"><span class="stat-label">Best Recorded</span><span class="stat-value">${pct(best.marks_obtained, best.total_marks)}%</span><span class="stat-sub">${escapeHtml(best.name)}</span></div>
        <div class="stat-card"><span class="stat-label">Lowest Recorded</span><span class="stat-value">${pct(worst.marks_obtained, worst.total_marks)}%</span><span class="stat-sub">${escapeHtml(worst.name)}</span></div>
      </div>
      <div class="panel">
        <h3>Average by Subject</h3>
        <div id="subject-bar-chart"></div>
      </div>
      <div class="panel">
        <h3>Score Progression (chronological)</h3>
        <div id="score-trend"></div>
      </div>
    `;
    renderBarChart(document.getElementById("subject-bar-chart"), subjectLabels, subjectAverages, { formatter: (v) => v + "%" });
    const chronological = [...tests].sort((a, b) => new Date(a.test_date) - new Date(b.test_date));
    renderLineTrend(document.getElementById("score-trend"), chronological.map((t) => pct(t.marks_obtained, t.total_marks)));
  },
};
