// ============================================================
// SKILLS — personal skill tracking (Java, Python, SQL, Power BI,
// Communication, or anything custom), current vs target level.
// ============================================================

const Skills = {
  list: [],

  async load() {
    const user = await DB.currentUser();
    this.list = await DB.list("skills", { filters: { user_id: user.id }, order: "created_at", ascending: true });
  },

  async render() {
    await this.load();
    const el = document.getElementById("page-skills");
    el.innerHTML = `
      <div class="page-header">
        <h2>Skills</h2>
        <button class="btn btn-primary" id="add-skill-btn">+ Add Skill</button>
      </div>
      <div id="skills-grid" class="subject-grid"></div>
    `;
    document.getElementById("add-skill-btn").onclick = () => this.openForm();
    this.renderGrid();
  },

  renderGrid() {
    const el = document.getElementById("skills-grid");
    if (!this.list.length) {
      el.innerHTML = `<p class="empty-state">No skills yet. Add one — Java, Python, SQL, Power BI, Communication, or anything custom.</p>`;
      return;
    }
    el.innerHTML = this.list
      .map((s) => {
        const pctVal = Math.min(100, Math.round((s.current_level / Math.max(1, s.target_level)) * 100));
        return `
        <div class="subject-card">
          <div class="subject-card-top"><h3>${escapeHtml(s.name)}</h3></div>
          <div class="bar-row" style="grid-template-columns:1fr 40px;">
            <div class="bar-track"><div class="bar-fill" style="width:${pctVal}%"></div></div>
            <span class="bar-value">${s.current_level}/${s.target_level}</span>
          </div>
          ${s.notes ? `<p class="subject-desc">${escapeHtml(s.notes)}</p>` : ""}
          <div class="subject-card-actions">
            <button class="link-btn" data-action="edit" data-id="${s.id}">Edit</button>
            <button class="link-btn danger" data-action="delete" data-id="${s.id}">Delete</button>
          </div>
        </div>`;
      })
      .join("");
    el.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const skill = this.list.find((s) => s.id === btn.dataset.id);
        if (btn.dataset.action === "edit") this.openForm(skill);
        else this.deleteFlow(skill);
      });
    });
  },

  openForm(skill = null) {
    openModal(`
      <h3>${skill ? "Edit Skill" : "Add Skill"}</h3>
      <form id="skill-form">
        <label>Skill name<input required id="sk-name" value="${skill ? escapeHtml(skill.name) : ""}" /></label>
        <label>Current level (1-10)<input type="number" min="1" max="10" id="sk-current" value="${skill?.current_level ?? 1}" /></label>
        <label>Target level (1-10)<input type="number" min="1" max="10" id="sk-target" value="${skill?.target_level ?? 10}" /></label>
        <label>Notes<textarea id="sk-notes">${skill ? escapeHtml(skill.notes || "") : ""}</textarea></label>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" id="sk-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </form>
    `);
    document.getElementById("sk-cancel").onclick = closeModal;
    document.getElementById("skill-form").onsubmit = async (e) => {
      e.preventDefault();
      const clamp = (v, d) => Math.min(10, Math.max(1, Math.round(Number(v) || d)));
      const payload = {
        name: document.getElementById("sk-name").value.trim(),
        current_level: clamp(document.getElementById("sk-current").value, 1),
        target_level: clamp(document.getElementById("sk-target").value, 10),
        notes: document.getElementById("sk-notes").value.trim(),
      };
      if (payload.current_level > payload.target_level) payload.target_level = payload.current_level;
      if (!payload.name) return;
      if (skill) await DB.update("skills", skill.id, payload);
      else await DB.insert("skills", payload);
      closeModal();
      toast(skill ? "Skill updated." : "Skill added.");
      this.render();
    };
  },

  async deleteFlow(skill) {
    const ok = await confirmDialog("Delete this skill?", "This can't be undone.", "Delete");
    if (!ok) return;
    await DB.remove("skills", skill.id);
    toast("Skill deleted.");
    this.render();
  },
};
