// ============================================================
// MILESTONES — deadline + progress tracking, optionally linked to a Goal
// ============================================================

const Milestones = {
  list: [],
  activeFilter: "active",

  async load() {
    const user = await DB.currentUser();
    if (!user) return;
    this.list = await DB.list("milestones", { filters: { user_id: user.id }, order: "deadline", ascending: true });
  },

  async render() {
    await Goals.load();
    await this.load();
    const el = document.getElementById("page-milestones");
    el.innerHTML = `
      <div class="page-header">
        <h2>Milestones</h2>
        <button class="btn btn-primary" id="add-milestone-btn">+ Add Milestone</button>
      </div>
      <div class="tabs" id="milestone-filters">
        ${["active", "completed", "academic", "fitness", "personal", "all"]
          .map((f) => `<button class="tab ${f === this.activeFilter ? "active" : ""}" data-filter="${f}">${f[0].toUpperCase() + f.slice(1)}</button>`)
          .join("")}
      </div>
      <div id="milestone-grid" class="milestone-grid"></div>
    `;
    document.getElementById("add-milestone-btn").onclick = () => this.openForm();
    document.querySelectorAll("#milestone-filters .tab").forEach((t) => {
      t.onclick = () => {
        document.querySelectorAll("#milestone-filters .tab").forEach((x) => x.classList.remove("active"));
        t.classList.add("active");
        this.activeFilter = t.dataset.filter;
        this.renderGrid();
      };
    });
    this.renderGrid();
  },

  filtered() {
    switch (this.activeFilter) {
      case "active":
        return this.list.filter((m) => m.status !== "completed" && m.status !== "archived");
      case "completed":
        return this.list.filter((m) => m.status === "completed");
      case "academic":
      case "fitness":
      case "personal":
        return this.list.filter((m) => m.category === this.activeFilter);
      default:
        return this.list.filter((m) => m.status !== "archived");
    }
  },

  renderGrid() {
    const el = document.getElementById("milestone-grid");
    const list = this.filtered();
    if (!list.length) {
      el.innerHTML = `<p class="empty-state">Nothing here yet — set a milestone and watch the ring fill up.</p>`;
      return;
    }
    const today = todayStr();
    el.innerHTML = list
      .map((m) => {
        const goal = Goals.list.find((g) => g.id === m.goal_id);
        const overdue = m.deadline && m.deadline < today && m.status !== "completed";
        const circumference = 2 * Math.PI * 21;
        const offset = circumference - (Math.min(100, Math.max(0, m.progress || 0)) / 100) * circumference;
        return `
        <div class="milestone-card" data-id="${m.id}">
          <div class="milestone-top">
            <div>
              <div class="milestone-title">${escapeHtml(m.title)}</div>
              ${m.description ? `<div class="milestone-desc">${escapeHtml(m.description)}</div>` : ""}
            </div>
            <span class="milestone-badge ${escapeHtml(m.category || "personal")}">${escapeHtml(m.category || "personal")}</span>
          </div>

          <div class="milestone-ring-row">
            <div class="milestone-ring-wrap">
              <svg class="milestone-ring" viewBox="0 0 48 48">
                <circle class="milestone-ring-bg" cx="24" cy="24" r="21"></circle>
                <circle class="milestone-ring-fill" cx="24" cy="24" r="21"
                  stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"></circle>
              </svg>
              <span class="milestone-ring-pct">${m.progress || 0}%</span>
            </div>
            <div class="milestone-meta">
              ${goal ? `<span>🎯 ${escapeHtml(goal.name)}</span>` : ""}
              ${m.deadline ? `<span class="milestone-deadline ${overdue ? "overdue" : ""}">${overdue ? "Overdue · " : "Due "}${fmtDate(m.deadline)}</span>` : `<span>No deadline</span>`}
              <span class="milestone-status ${m.status}">${m.status.replace("_", " ")}</span>
            </div>
          </div>

          <div class="milestone-progress-row">
            <input type="range" min="0" max="100" step="5" value="${m.progress || 0}" data-id="${m.id}" class="milestone-slider" ${m.status === "completed" ? "disabled" : ""} />
          </div>

          <div class="milestone-actions">
            <button class="link-btn" data-action="edit" data-id="${m.id}">Edit</button>
            <button class="link-btn danger" data-action="delete" data-id="${m.id}">Delete</button>
          </div>
        </div>`;
      })
      .join("");

    el.querySelectorAll(".milestone-slider").forEach((slider) => {
      slider.addEventListener("input", (e) => {
        const card = e.target.closest(".milestone-card");
        card.querySelector(".milestone-ring-pct").textContent = `${e.target.value}%`;
        const circumference = 2 * Math.PI * 21;
        const offset = circumference - (e.target.value / 100) * circumference;
        card.querySelector(".milestone-ring-fill").style.strokeDashoffset = offset;
      });
      slider.addEventListener("change", (e) => this.updateProgress(e.target.dataset.id, Number(e.target.value)));
    });
    el.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const m = this.list.find((x) => x.id === btn.dataset.id);
        if (btn.dataset.action === "edit") this.openForm(m);
        if (btn.dataset.action === "delete") this.deleteFlow(m);
      });
    });
  },

  async updateProgress(id, progress) {
    const m = this.list.find((x) => x.id === id);
    if (!m) return;
    const wasCompleted = m.status === "completed";
    const status = progress >= 100 ? "completed" : progress > 0 ? "in_progress" : "not_started";
    await DB.update("milestones", id, { progress, status, updated_at: new Date().toISOString() });

    if (status === "completed" && !wasCompleted) {
      if (await alreadyRewarded("milestone_complete", id)) toast("Milestone complete.");
      else {
        const xp = await DB.reward("xp_weekly_milestone", 75, "milestone_complete", "milestone", `Completed milestone "${m.title}"`, id);
        toast(`🎉 Milestone complete — +${xp} XP`);
      }
    } else {
      toast("Progress updated.");
    }
    this.render();
  },

  openForm(m = null) {
    const activeGoals = Goals.list.filter((g) => !g.archived);
    openModal(`
      <h3>${m ? "Edit Milestone" : "Add Milestone"}</h3>
      <form id="milestone-form" class="grid-form">
        <label class="full">Title<input required id="ms-title" value="${m ? escapeHtml(m.title) : ""}" /></label>
        <label class="full">Description<textarea id="ms-desc">${m ? escapeHtml(m.description || "") : ""}</textarea></label>
        <label>Category
          <select id="ms-category">
            <option value="academic" ${m?.category === "academic" ? "selected" : ""}>Academic</option>
            <option value="fitness" ${m?.category === "fitness" ? "selected" : ""}>Fitness</option>
            <option value="personal" ${!m || m?.category === "personal" ? "selected" : ""}>Personal</option>
          </select>
        </label>
        <label>Goal (optional)
          <select id="ms-goal">
            <option value="">—</option>
            ${activeGoals.map((g) => `<option value="${g.id}" ${m?.goal_id === g.id ? "selected" : ""}>${escapeHtml(g.name)}</option>`).join("")}
          </select>
        </label>
        <label>Deadline<input type="date" id="ms-deadline" value="${m?.deadline || ""}" /></label>
        <label>Progress (%)<input type="number" min="0" max="100" step="5" id="ms-progress" value="${m?.progress ?? 0}" /></label>
        <div class="modal-actions full">
          <button type="button" class="btn btn-ghost" id="ms-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </form>
    `);
    document.getElementById("ms-cancel").onclick = closeModal;
    document.getElementById("milestone-form").onsubmit = async (e) => {
      e.preventDefault();
      const progress = Math.min(100, Math.max(0, Number(document.getElementById("ms-progress").value) || 0));
      const payload = {
        title: document.getElementById("ms-title").value.trim(),
        description: document.getElementById("ms-desc").value.trim(),
        category: document.getElementById("ms-category").value,
        goal_id: document.getElementById("ms-goal").value || null,
        deadline: document.getElementById("ms-deadline").value || null,
        progress,
        status: progress >= 100 ? "completed" : progress > 0 ? "in_progress" : "not_started",
      };
      if (!payload.title) return;

      const wasCompleted = m?.status === "completed";
      let saved;
      if (m) saved = await DB.update("milestones", m.id, { ...payload, updated_at: new Date().toISOString() });
      else saved = await DB.insert("milestones", payload);

      if (payload.status === "completed" && !wasCompleted) {
        const refId = saved?.id || m?.id || null;
        if (!(await alreadyRewarded("milestone_complete", refId)))
          await DB.reward("xp_weekly_milestone", 75, "milestone_complete", "milestone", `Completed milestone "${payload.title}"`, refId);
      }

      closeModal();
      toast(m ? "Milestone updated." : "Milestone added.");
      this.render();
    };
  },

  async deleteFlow(m) {
    const ok = await confirmDialog("Delete this milestone?", "This can't be undone.", "Delete");
    if (!ok) return;
    await DB.remove("milestones", m.id);
    toast("Milestone deleted.");
    this.render();
  },
};
