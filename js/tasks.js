// ============================================================
// TASKS
// ============================================================

const Tasks = {
  list: [],
  activeFilter: "all",

  async load() {
    const user = await DB.currentUser();
    if (!user) return;
    this.list = await DB.list("tasks", { filters: { user_id: user.id }, order: "due_date", ascending: true });
  },

  async render() {
    await Goals.load();
    await this.load();
    const el = document.getElementById("page-tasks");
    el.innerHTML = `
      <div class="page-header">
        <h2>Tasks</h2>
        <div class="page-actions">
          <button class="btn btn-ghost" id="import-task-btn">Import PDF / Excel</button>
          <button class="btn btn-primary" id="add-task-btn">+ Add Task</button>
        </div>
      </div>
      <div class="tabs" id="task-filters">
        ${["all", "today", "upcoming", "completed", "academic", "fitness", "personal"]
          .map((f) => `<button class="tab ${f === this.activeFilter ? "active" : ""}" data-filter="${f}">${f[0].toUpperCase() + f.slice(1)}</button>`)
          .join("")}
      </div>
      <div id="task-list" class="record-list"></div>
    `;
    document.getElementById("add-task-btn").onclick = () => this.openForm();
    document.getElementById("import-task-btn").onclick = () => TaskImport.open();
    document.querySelectorAll("#task-filters .tab").forEach((t) => {
      t.onclick = () => {
        document.querySelectorAll("#task-filters .tab").forEach((x) => x.classList.remove("active"));
        t.classList.add("active");
        this.activeFilter = t.dataset.filter;
        this.renderList();
      };
    });
    this.renderList();
  },

  filtered() {
    const today = todayStr();
    switch (this.activeFilter) {
      case "today":
        return this.list.filter((t) => t.due_date === today && t.status !== "completed");
      case "upcoming":
        return this.list.filter((t) => t.due_date && t.due_date > today && t.status !== "completed");
      case "completed":
        return this.list.filter((t) => t.status === "completed");
      case "academic":
      case "fitness":
      case "personal":
        return this.list.filter((t) => t.category === this.activeFilter);
      default:
        return this.list;
    }
  },

  renderList() {
    const el = document.getElementById("task-list");
    const list = this.filtered();
    if (!list.length) {
      el.innerHTML = `<p class="empty-state">No tasks here.</p>`;
      return;
    }
    el.innerHTML = list
      .map((t) => {
        const goal = Goals.list.find((g) => g.id === t.goal_id);
        const overdue = t.due_date && t.due_date < todayStr() && t.status !== "completed";
        return `
        <div class="record-card task-card ${t.status === "completed" ? "task-done" : ""}">
          <label class="task-check">
            <input type="checkbox" data-id="${t.id}" ${t.status === "completed" ? "checked" : ""} />
          </label>
          <div class="record-main">
            <strong>${escapeHtml(t.title)}</strong>
            <span class="muted">
              <span class="priority-dot priority-${t.priority}"></span>
              ${escapeHtml(t.category || "general")}${goal ? " · " + escapeHtml(goal.name) : ""}
              ${t.due_date ? " · " + (overdue ? `<span class="overdue">Overdue ${fmtDate(t.due_date)}</span>` : fmtDate(t.due_date)) : ""}
            </span>
          </div>
          <div class="record-actions">
            <button class="link-btn" data-action="edit" data-id="${t.id}">Edit</button>
            <button class="link-btn danger" data-action="delete" data-id="${t.id}">Delete</button>
          </div>
        </div>`;
      })
      .join("");

    el.querySelectorAll("input[type=checkbox]").forEach((cb) => {
      cb.addEventListener("change", () => this.toggleComplete(cb.dataset.id, cb.checked));
    });
    el.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const task = this.list.find((t) => t.id === btn.dataset.id);
        if (btn.dataset.action === "edit") this.openForm(task);
        if (btn.dataset.action === "delete") this.deleteFlow(task);
      });
    });
  },

  async toggleComplete(id, checked) {
    const task = this.list.find((t) => t.id === id);
    const wasCompleted = task.status === "completed";
    const patch = checked
      ? { status: "completed", completed_at: new Date().toISOString() }
      : { status: "pending", completed_at: null };
    await DB.update("tasks", id, patch);
    Object.assign(task, patch); // update the row on screen right away — no full reload

    if (checked && !wasCompleted) {
      if (await alreadyRewarded("task_complete", id)) toast("Task completed. (XP was already earned for this one.)");
      else {
        await DB.reward("xp_task", 10, "task_complete", "task", `Completed "${task.title}"`, id);
        toast("Task completed.");
      }
    }
    this.renderList();
  },

  openForm(task = null) {
    const activeGoals = Goals.list.filter((g) => !g.archived);
    openModal(`
      <h3>${task ? "Edit Task" : "Add Task"}</h3>
      <form id="task-form" class="grid-form">
        <label class="full">Title<input required id="task-title" value="${task ? escapeHtml(task.title) : ""}" /></label>
        <label class="full">Description<textarea id="task-desc">${task ? escapeHtml(task.description || "") : ""}</textarea></label>
        <label>Category
          <select id="task-category">
            <option value="academic" ${task?.category === "academic" ? "selected" : ""}>Academic</option>
            <option value="fitness" ${task?.category === "fitness" ? "selected" : ""}>Fitness</option>
            <option value="personal" ${!task || task?.category === "personal" ? "selected" : ""}>Personal</option>
          </select>
        </label>
        <label>Priority
          <select id="task-priority">
            <option value="high" ${task?.priority === "high" ? "selected" : ""}>High</option>
            <option value="medium" ${!task || task?.priority === "medium" ? "selected" : ""}>Medium</option>
            <option value="low" ${task?.priority === "low" ? "selected" : ""}>Low</option>
          </select>
        </label>
        <label>Goal (optional)
          <select id="task-goal">
            <option value="">—</option>
            ${activeGoals.map((g) => `<option value="${g.id}" ${task?.goal_id === g.id ? "selected" : ""}>${escapeHtml(g.name)}</option>`).join("")}
          </select>
        </label>
        <label>Due date<input type="date" id="task-due" value="${task?.due_date || ""}" /></label>
        <div class="modal-actions full">
          <button type="button" class="btn btn-ghost" id="task-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </form>
    `);
    document.getElementById("task-cancel").onclick = closeModal;
    document.getElementById("task-form").onsubmit = async (e) => {
      e.preventDefault();
      const payload = {
        title: document.getElementById("task-title").value.trim(),
        description: document.getElementById("task-desc").value.trim(),
        category: document.getElementById("task-category").value,
        priority: document.getElementById("task-priority").value,
        goal_id: document.getElementById("task-goal").value || null,
        due_date: document.getElementById("task-due").value || null,
      };
      if (!payload.title) return;
      if (task) await DB.update("tasks", task.id, payload);
      else await DB.insert("tasks", { ...payload, status: "pending" });
      closeModal();
      toast(task ? "Task updated." : "Task added.");
      this.render();
    };
  },

  async deleteFlow(task) {
    const ok = await confirmDialog("Delete this task?", "This can't be undone.", "Delete");
    if (!ok) return;
    await DB.remove("tasks", task.id);
    toast("Task deleted.");
    this.render();
  },
};
