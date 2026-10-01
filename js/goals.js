// ============================================================
// GOALS — generic exam/track system. A user creates any goal
// they want (JEE, NEET, Boards, CLAT, College, custom) and adds
// subjects/sections + topics under it. Nothing is hardcoded.
// ============================================================

const Goals = {
  list: [],
  subjects: [],
  activeGoalId: null,

  async load() {
    const user = await DB.currentUser();
    if (!user) return;
    const [goalsList, subjectsList] = await Promise.all([
      DB.list("goals", { filters: { user_id: user.id }, order: "sort_order", ascending: true }),
      DB.list("subjects", { filters: { user_id: user.id }, order: "created_at", ascending: true }),
    ]);
    this.list = goalsList;
    this.subjects = subjectsList;
    if (!this.activeGoalId && this.list.length) this.activeGoalId = this.list.find((g) => !g.archived)?.id;
  },

  async render() {
    await this.load();
    const el = document.getElementById("page-goals");
    if (!this.list.filter((g) => !g.archived).length) {
      el.innerHTML = `
        <div class="page-header"><h2>Goals</h2></div>
        <div class="empty-panel empty-hero">
          <div class="empty-icon" aria-hidden="true">🎯</div>
          <h3>Start with one goal</h3>
          <p>A goal is whatever you're working toward. Add it, then track subjects, tests and study time under it.</p>
          <div class="chip-row" role="group" aria-label="Quick start">
            ${["JEE", "NEET", "CLAT", "Boards", "College"].map((n) => `<button type="button" class="chip" data-goal="${n}">${n}</button>`).join("")}
          </div>
          <button class="btn btn-primary" id="first-goal-btn">+ Custom goal</button>
        </div>`;
      document.getElementById("first-goal-btn").onclick = () => this.openGoalForm();
      el.querySelectorAll(".chip[data-goal]").forEach((c) => (c.onclick = () => {
        this.openGoalForm();
        const f = document.getElementById("goal-name");
        if (f) { f.value = c.dataset.goal; f.focus(); }
      }));
      return;
    }

    el.innerHTML = `
      <div class="page-header">
        <h2>Goals</h2>
        <div class="header-actions">
          <button class="btn btn-ghost" id="add-goal-btn">+ Add Goal</button>
          <button class="btn btn-primary" id="add-subject-btn">+ Add Subject</button>
        </div>
      </div>
      <div class="semester-tabs" id="goal-tabs"></div>
      <div id="subject-grid" class="subject-grid"></div>
    `;

    const active = this.list.filter((g) => !g.archived);
    const tabsEl = document.getElementById("goal-tabs");
    tabsEl.innerHTML = active
      .map((g) => `<button class="tab ${g.id === this.activeGoalId ? "active" : ""}" data-goal="${g.id}">${escapeHtml(g.name)}</button>`)
      .join("");
    tabsEl.querySelectorAll(".tab").forEach((tab) => {
      tab.onclick = () => {
        this.activeGoalId = tab.dataset.goal;
        this.render();
      };
    });

    document.getElementById("add-goal-btn").onclick = () => this.openGoalForm();
    document.getElementById("add-subject-btn").onclick = () => this.openSubjectForm();

    this.renderSubjectGrid();
  },

  openGoalForm(goal = null) {
    openModal(`
      <h3>${goal ? "Edit Goal" : "Add Goal"}</h3>
      <form id="goal-form">
        <label>Name<input required id="goal-name" placeholder="e.g. JEE, NEET, Boards, CLAT, College" value="${goal ? escapeHtml(goal.name) : ""}" /></label>
        <label>Description<textarea id="goal-desc">${goal ? escapeHtml(goal.description || "") : ""}</textarea></label>
        <label>Color<input type="color" id="goal-color" value="${goal?.color || "#6366f1"}" /></label>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" id="goal-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </form>
    `);
    document.getElementById("goal-cancel").onclick = closeModal;
    document.getElementById("goal-form").onsubmit = async (e) => {
      e.preventDefault();
      const payload = {
        name: document.getElementById("goal-name").value.trim(),
        description: document.getElementById("goal-desc").value.trim(),
        color: document.getElementById("goal-color").value,
      };
      if (!payload.name) return;
      let saved;
      if (goal) saved = await DB.update("goals", goal.id, payload);
      else saved = await DB.insert("goals", { ...payload, sort_order: this.list.length });
      closeModal();
      toast(goal ? "Goal updated." : "Goal added.");
      this.activeGoalId = saved.id;
      this.render();
    };
  },

  async renderSubjectGrid() {
    const grid = document.getElementById("subject-grid");
    const list = this.subjects.filter((s) => !s.archived && s.goal_id === this.activeGoalId);
    const goal = this.list.find((g) => g.id === this.activeGoalId);

    const headerRow = `<div class="goal-actions-row">
      <button class="link-btn" id="edit-goal-btn">Edit "${escapeHtml(goal?.name || "")}"</button>
      <button class="link-btn danger" id="archive-goal-btn">Archive Goal</button>
    </div>`;

    if (!list.length) {
      grid.innerHTML = `<p class="empty-state">No subjects yet under this goal. Add your first subject or section.</p>`;
    } else {
      const user = await DB.currentUser();
      const allTests = await DB.list("tests", { filters: { user_id: user.id, goal_id: this.activeGoalId } });

      grid.innerHTML = list
        .map((s) => {
          const tests = allTests.filter((t) => t.subject_id === s.id && t.total_marks);
          const scores = tests.map((t) => pct(t.marks_obtained, t.total_marks));
          const average = scores.length ? Math.round(avg(scores)) : null;
          return `
          <div class="subject-card" style="--card-accent:${s.color || "#6366f1"}" data-id="${s.id}">
            <div class="subject-card-top">
              <span class="subject-dot"></span>
              <h3>${escapeHtml(s.name)}</h3>
            </div>
            <p class="subject-desc">${escapeHtml(s.description || "")}</p>
            <div class="subject-stats">
              <span>${tests.length} test${tests.length === 1 ? "" : "s"}</span>
              <span>${average !== null ? average + "% avg" : "No tests yet"}</span>
            </div>
            <div class="subject-card-actions">
              <button class="link-btn" data-action="topics" data-id="${s.id}">Topics</button>
              <button class="link-btn" data-action="edit" data-id="${s.id}">Edit</button>
              <button class="link-btn danger" data-action="delete" data-id="${s.id}">Delete</button>
            </div>
          </div>`;
        })
        .join("");
    }

    document.querySelector("#page-goals .goal-actions-row")?.remove();
    grid.insertAdjacentHTML("beforebegin", headerRow);
    document.getElementById("edit-goal-btn").onclick = () => this.openGoalForm(goal);
    document.getElementById("archive-goal-btn").onclick = async () => {
      const ok = await confirmDialog("Archive this goal?", "Subjects and tests stay in your history. You can keep using other goals.", "Archive", false);
      if (!ok) return;
      await DB.update("goals", goal.id, { archived: true });
      this.activeGoalId = null;
      toast("Goal archived.");
      this.render();
    };

    grid.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const subject = this.subjects.find((s) => s.id === id);
        if (btn.dataset.action === "edit") this.openSubjectForm(subject);
        if (btn.dataset.action === "delete") this.deleteSubjectFlow(subject);
        if (btn.dataset.action === "topics") this.openTopicsPanel(subject);
      });
    });
  },

  openSubjectForm(subject = null) {
    if (!this.list.filter((g) => !g.archived).length) {
      toast("Add a goal first.");
      return;
    }
    const goalOptions = this.list
      .filter((g) => !g.archived)
      .map((g) => `<option value="${g.id}" ${(subject?.goal_id || this.activeGoalId) === g.id ? "selected" : ""}>${escapeHtml(g.name)}</option>`)
      .join("");

    openModal(`
      <h3>${subject ? "Edit Subject" : "Add Subject"}</h3>
      <form id="subject-form">
        <label>Goal<select id="subj-goal">${goalOptions}</select></label>
        <label>Subject/Section Name<input required id="subj-name" value="${subject ? escapeHtml(subject.name) : ""}" /></label>
        <label>Description<textarea id="subj-desc">${subject ? escapeHtml(subject.description || "") : ""}</textarea></label>
        <label>Color<input type="color" id="subj-color" value="${subject?.color || "#6366f1"}" /></label>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" id="subj-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </form>
    `);
    document.getElementById("subj-cancel").onclick = closeModal;
    document.getElementById("subject-form").onsubmit = async (e) => {
      e.preventDefault();
      const payload = {
        goal_id: document.getElementById("subj-goal").value,
        name: document.getElementById("subj-name").value.trim(),
        description: document.getElementById("subj-desc").value.trim(),
        color: document.getElementById("subj-color").value,
      };
      if (!payload.name) return;
      if (subject) await DB.update("subjects", subject.id, payload);
      else await DB.insert("subjects", payload);
      closeModal();
      toast(subject ? "Subject updated." : "Subject added.");
      this.activeGoalId = payload.goal_id;
      this.render();
    };
  },

  async deleteSubjectFlow(subject) {
    openModal(`
      <h3>Delete Subject?</h3>
      <p class="modal-body-text">"${escapeHtml(subject.name)}" has related tests and study sessions. Archiving keeps your history intact and is usually the better choice.</p>
      <div class="modal-actions" style="flex-wrap:wrap">
        <button class="btn btn-ghost" id="del-cancel">Cancel</button>
        <button class="btn btn-secondary" id="del-archive">Archive Subject</button>
        <button class="btn btn-danger" id="del-permanent">Delete Permanently</button>
      </div>
      <p class="fine-print">Deleting permanently will also remove linked tests and study session references.</p>
    `);
    document.getElementById("del-cancel").onclick = closeModal;
    document.getElementById("del-archive").onclick = async () => {
      await DB.update("subjects", subject.id, { archived: true });
      closeModal();
      toast("Subject archived.");
      this.render();
    };
    document.getElementById("del-permanent").onclick = async () => {
      const ok = await confirmDialog("Are you sure?", "This permanently deletes the subject and cannot be undone.", "Delete Permanently");
      if (!ok) return;
      await DB.remove("subjects", subject.id);
      toast("Subject deleted.");
      this.render();
    };
  },

  async openTopicsPanel(subject) {
    const topics = await DB.list("topics", { filters: { subject_id: subject.id } });
    openModal(`
      <h3>${escapeHtml(subject.name)} — Topics</h3>
      <div id="topic-list" class="topic-list">
        ${topics.length ? topics.map((t) => `
          <div class="topic-row" data-id="${t.id}">
            <span>${escapeHtml(t.name)}</span>
            <div>
              <button class="link-btn" data-action="edit-topic" data-id="${t.id}">Edit</button>
              <button class="link-btn danger" data-action="del-topic" data-id="${t.id}">Delete</button>
            </div>
          </div>`).join("") : `<p class="empty-state">No topics yet.</p>`}
      </div>
      <form id="topic-form" class="inline-form">
        <input id="topic-name" placeholder="Add topic" required />
        <button type="submit" class="btn btn-primary">Add</button>
      </form>
      <div class="modal-actions"><button class="btn btn-ghost" id="topics-close">Close</button></div>
    `);
    document.getElementById("topics-close").onclick = closeModal;
    document.getElementById("topic-form").onsubmit = async (e) => {
      e.preventDefault();
      const name = document.getElementById("topic-name").value.trim();
      if (!name) return;
      await DB.insert("topics", { subject_id: subject.id, name });
      this.openTopicsPanel(subject);
    };
    document.querySelectorAll("[data-action='del-topic']").forEach((btn) => {
      btn.onclick = async () => {
        await DB.remove("topics", btn.dataset.id);
        this.openTopicsPanel(subject);
      };
    });
    document.querySelectorAll("[data-action='edit-topic']").forEach((btn) => {
      btn.onclick = async () => {
        const row = btn.closest(".topic-row");
        const current = row.querySelector("span").textContent;
        const name = await promptDialog("Rename topic", "Topic name", current);
        if (name) await DB.update("topics", btn.dataset.id, { name });
        this.openTopicsPanel(subject);
      };
    });
  },
};
