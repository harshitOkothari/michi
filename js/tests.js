// ============================================================
// TESTS — works for any goal (JEE mocks, NEET mocks, CLAT mocks,
// college exams, board exams...). Filtered by the active goal.
// ============================================================

const Tests = {
  list: [],

  async load(goalId = null) {
    const user = await DB.currentUser();
    if (!user) return;
    const filters = { user_id: user.id };
    if (goalId) filters.goal_id = goalId;
    this.list = await DB.list("tests", { filters, order: "test_date", ascending: false });
  },

  async render() {
    await Goals.load();
    await this.load();
    const el = document.getElementById("page-tests");
    if (!Goals.list.filter((g) => !g.archived).length) {
      el.innerHTML = `<div class="page-header"><h2>Tests</h2></div><p class="empty-state">Add a goal first (Goals page), then come back to log tests.</p>`;
      return;
    }
    const goalOptions = Goals.list
      .filter((g) => !g.archived)
      .map((g) => `<option value="${g.id}">${escapeHtml(g.name)}</option>`)
      .join("");

    el.innerHTML = `
      <div class="page-header">
        <h2>Tests</h2>
        <button class="btn btn-primary" id="add-test-btn">+ Add Test</button>
      </div>
      <div class="semester-tabs" id="test-goal-tabs">
        ${Goals.list.filter((g) => !g.archived).map((g, i) => `<button class="tab ${i === 0 ? "active" : ""}" data-goal="${g.id}">${escapeHtml(g.name)}</button>`).join("")}
        <button class="tab" data-goal="all">All</button>
      </div>
      <div id="test-list" class="record-list"></div>
    `;
    document.getElementById("add-test-btn").onclick = () => this.openForm();
    const tabsEl = document.getElementById("test-goal-tabs");
    tabsEl.querySelectorAll(".tab").forEach((tab) => {
      tab.onclick = () => {
        tabsEl.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        this.renderList(tab.dataset.goal);
      };
    });
    this.renderList(Goals.list.filter((g) => !g.archived)[0]?.id);
  },

  renderList(goalFilter) {
    const el = document.getElementById("test-list");
    const filtered = goalFilter === "all" ? this.list : this.list.filter((t) => t.goal_id === goalFilter);
    if (!filtered.length) {
      el.innerHTML = `<p class="empty-state">No tests recorded yet.</p>`;
      return;
    }
    el.innerHTML = filtered
      .map((t) => {
        const subject = Goals.subjects.find((s) => s.id === t.subject_id);
        const goal = Goals.list.find((g) => g.id === t.goal_id);
        const percentage = t.total_marks ? pct(t.marks_obtained, t.total_marks) : null;
        const accuracy = t.attempted ? pct(t.correct, t.attempted) : null;
        return `
        <div class="record-card">
          <div class="record-main">
            <strong>${escapeHtml(t.name)}</strong>
            <span class="muted">${escapeHtml(goal?.name || "")}${subject ? " · " + escapeHtml(subject.name) : ""} · ${fmtDate(t.test_date)}</span>
          </div>
          <div class="record-stats">
            ${percentage !== null ? `<span>${percentage}%</span>` : ""}
            ${accuracy !== null ? `<span>${accuracy}% accuracy</span>` : ""}
          </div>
          <div class="record-actions">
            <button class="link-btn" data-action="edit" data-id="${t.id}">Edit</button>
            <button class="link-btn danger" data-action="delete" data-id="${t.id}">Delete</button>
          </div>
        </div>`;
      })
      .join("");

    el.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const test = this.list.find((t) => t.id === btn.dataset.id);
        if (btn.dataset.action === "edit") this.openForm(test);
        if (btn.dataset.action === "delete") this.deleteFlow(test);
      });
    });
  },

  openForm(test = null) {
    const activeGoals = Goals.list.filter((g) => !g.archived);
    const goalOptions = activeGoals
      .map((g) => `<option value="${g.id}" ${(test?.goal_id || Goals.activeGoalId) === g.id ? "selected" : ""}>${escapeHtml(g.name)}</option>`)
      .join("");

    openModal(`
      <h3>${test ? "Edit Test" : "Add Test"}</h3>
      <form id="test-form" class="grid-form">
        <label>Goal<select id="t-goal">${goalOptions}</select></label>
        <label>Test name<input required id="t-name" value="${test ? escapeHtml(test.name) : ""}" /></label>
        <label>Subject/Section<select id="t-subject"><option value="">—</option></select></label>
        <label>Date<input type="date" id="t-date" value="${test?.test_date || todayStr()}" /></label>
        <label>Total marks<input type="number" id="t-total-marks" value="${test?.total_marks ?? ""}" /></label>
        <label>Marks obtained<input type="number" id="t-marks" value="${test?.marks_obtained ?? ""}" /></label>
        <label>Total questions<input type="number" id="t-total-q" value="${test?.total_questions ?? ""}" /></label>
        <label>Attempted<input type="number" id="t-attempted" value="${test?.attempted ?? ""}" /></label>
        <label>Correct<input type="number" id="t-correct" value="${test?.correct ?? ""}" /></label>
        <label>Incorrect<input type="number" id="t-incorrect" value="${test?.incorrect ?? ""}" /></label>
        <label>Time taken (min)<input type="number" id="t-time" value="${test?.time_taken_min ?? ""}" /></label>
        <label class="full">Notes<textarea id="t-notes">${test ? escapeHtml(test.notes || "") : ""}</textarea></label>
        <div class="modal-actions full">
          <button type="button" class="btn btn-ghost" id="t-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </form>
    `);

    const goalSelect = document.getElementById("t-goal");
    const subjectSelect = document.getElementById("t-subject");
    const refreshSubjects = () => {
      const subs = Goals.subjects.filter((s) => !s.archived && s.goal_id === goalSelect.value);
      subjectSelect.innerHTML = `<option value="">—</option>` + subs.map((s) => `<option value="${s.id}" ${test?.subject_id === s.id ? "selected" : ""}>${escapeHtml(s.name)}</option>`).join("");
    };
    goalSelect.addEventListener("change", refreshSubjects);
    refreshSubjects();

    document.getElementById("t-cancel").onclick = closeModal;
    document.getElementById("test-form").onsubmit = async (e) => {
      e.preventDefault();
      const totalQ = numOrNull("t-total-q");
      const attempted = numOrNull("t-attempted");
      const unattempted = totalQ != null && attempted != null ? totalQ - attempted : null;

      const payload = {
        goal_id: goalSelect.value,
        subject_id: subjectSelect.value || null,
        name: document.getElementById("t-name").value.trim(),
        test_date: document.getElementById("t-date").value,
        total_marks: numOrNull("t-total-marks"),
        marks_obtained: numOrNull("t-marks"),
        total_questions: totalQ,
        attempted,
        correct: numOrNull("t-correct"),
        incorrect: numOrNull("t-incorrect"),
        unattempted,
        time_taken_min: numOrNull("t-time"),
        notes: document.getElementById("t-notes").value.trim(),
      };
      if (!payload.name || !payload.goal_id) return;

      let saved;
      if (test) saved = await DB.update("tests", test.id, payload);
      else saved = await DB.insert("tests", payload);

      if (!test) {
        await DB.reward("xp_test", 25, "test", "test", `Added "${payload.name}" test`, saved.id);
      }
      closeModal();
      toast("Test saved.");
      this.render();
    };
  },

  async deleteFlow(test) {
    openModal(`
      <h3>Delete this test?</h3>
      <p class="modal-body-text">Deleting this record will remove it from history, graphs and performance calculations.</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="dt-cancel">Cancel</button>
        <button class="btn btn-danger" id="dt-ok">Delete</button>
      </div>
    `);
    document.getElementById("dt-cancel").onclick = closeModal;
    document.getElementById("dt-ok").onclick = async () => {
      await DB.remove("tests", test.id);
      closeModal();
      toast("Test deleted.");
      this.render();
    };
  },
};

function numOrNull(id) {
  const v = document.getElementById(id).value;
  return v === "" ? null : Number(v);
}
