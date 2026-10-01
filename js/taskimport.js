// ============================================================
// TASK IMPORT — upload a PDF / Excel / CSV / TXT and Michi turns
// it into a to-do list. Everything is parsed in the browser (the
// file never leaves the device). You get a preview first, so you
// can edit / untick anything before it is saved.
//
// Libraries (SheetJS for Excel, pdf.js for PDF) are loaded only
// when you actually pick a file of that type, so the app stays fast.
// ============================================================

const TaskImport = {
  MAX_BYTES: 10 * 1024 * 1024,
  MAX_TASKS: 300,
  MAX_PDF_PAGES: 60,
  LIBS: {
    xlsx: "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
    pdf: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
    pdfWorker: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
  },
  _loading: {},
  rows: [],

  // ---------- script loader ----------
  loadScript(src) {
    if (this._loading[src]) return this._loading[src];
    this._loading[src] = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = () => {
        delete this._loading[src];
        reject(new Error("Couldn't load the file reader. Check your internet and try again."));
      };
      document.head.appendChild(s);
    });
    return this._loading[src];
  },

  // ---------- step 1: pick a file ----------
  open() {
    openModal(`
      <h3>Import tasks from a file</h3>
      <p class="muted" style="font-size:13px;margin:0 0 12px">Upload a PDF, Excel sheet, CSV or text file — Michi reads it and builds your to-do list. You can review everything before it's saved.</p>
      <label class="imp-drop" id="imp-drop">
        <input type="file" id="imp-file" accept=".pdf,.xlsx,.xls,.csv,.txt,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain" hidden />
        <b>Choose a file</b>
        <span>or drag &amp; drop it here</span>
        <small>PDF · XLSX · XLS · CSV · TXT — up to 10 MB</small>
      </label>
      <p class="muted" style="font-size:12px;margin:10px 0 0">Tip for Excel: a header row like <i>Task · Due date · Priority</i> is picked up automatically.</p>
      <div id="imp-status" class="imp-status" hidden></div>
      <div class="modal-actions"><button type="button" class="btn btn-ghost" id="imp-cancel">Cancel</button></div>
    `);
    document.getElementById("imp-cancel").onclick = closeModal;
    const input = document.getElementById("imp-file");
    const drop = document.getElementById("imp-drop");
    input.onchange = () => input.files[0] && this.handleFile(input.files[0]);
    ["dragenter", "dragover"].forEach((ev) =>
      drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); })
    );
    ["dragleave", "drop"].forEach((ev) =>
      drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); })
    );
    drop.addEventListener("drop", (e) => {
      const f = e.dataTransfer?.files?.[0];
      if (f) this.handleFile(f);
    });
  },

  setStatus(msg, isError = false) {
    const el = document.getElementById("imp-status");
    if (!el) return;
    el.hidden = !msg;
    el.textContent = msg || "";
    el.classList.toggle("err", !!isError);
  },

  async handleFile(file) {
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (file.size > this.MAX_BYTES) return this.setStatus("That file is over 10 MB. Try a smaller one.", true);
    if (!["pdf", "xlsx", "xls", "csv", "txt"].includes(ext))
      return this.setStatus("Please pick a PDF, Excel (.xlsx/.xls), CSV or TXT file.", true);

    try {
      this.setStatus("Reading your file…");
      let items;
      if (ext === "pdf") items = await this.parsePdf(file);
      else if (ext === "txt") items = this.parseLines((await file.text()).split(/\r?\n/));
      else items = await this.parseSheet(file);

      // de-duplicate + cap
      const seen = new Set();
      items = items.filter((t) => {
        const k = t.title.toLowerCase();
        if (!t.title || seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      if (!items.length) {
        return this.setStatus(
          ext === "pdf"
            ? "Couldn't find any text to turn into tasks. If this PDF is a scan or photo, it has no readable text — try a text-based PDF or Excel."
            : "Couldn't find any tasks in that file.",
          true
        );
      }
      let capped = false;
      if (items.length > this.MAX_TASKS) { items = items.slice(0, this.MAX_TASKS); capped = true; }
      this.rows = items.map((t) => ({ ...t, keep: !t.done }));
      this.renderPreview(file.name, capped);
    } catch (err) {
      console.error("[TaskImport]", err);
      this.setStatus(err?.message || "Something went wrong reading that file.", true);
    }
  },

  // ---------- parsing: spreadsheets ----------
  async parseSheet(file) {
    await this.loadScript(this.LIBS.xlsx);
    const buf = await file.arrayBuffer();
    const wb = window.XLSX.read(buf, { type: "array" });
    const out = [];
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      const rows = window.XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
      out.push(...this.parseTable(rows, wb.SheetNames.length > 1 ? name : ""));
    }
    return out;
  },

  parseTable(rows, sheetName) {
    rows = rows.filter((r) => r.some((c) => String(c).trim() !== ""));
    if (!rows.length) return [];

    const RE = {
      title: /^(task|tasks|to.?do|title|name|topic|topics|chapter|item|activity|work|assignment|action|goal)s?$/i,
      due: /(due|deadline|date|by when|target|submit)/i,
      prio: /(priorit|urgen|importan)/i,
      cat: /(categor|type)/i,
      notes: /(note|remark|comment|detail|description)/i,
      status: /(status|done|complete)/i,
      subj: /(subject|course|exam|class)/i,
    };

    // find the header row (first 10 rows) — one that has a title-like column
    let hi = -1, map = {};
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const cells = rows[i].map((c) => String(c).trim());
      const titleCol = cells.findIndex((c) => RE.title.test(c));
      if (titleCol !== -1) {
        hi = i;
        map.title = titleCol;
        cells.forEach((c, idx) => {
          if (idx === titleCol) return;
          if (map.prio == null && RE.prio.test(c)) map.prio = idx;
          else if (map.status == null && RE.status.test(c)) map.status = idx;
          else if (map.cat == null && RE.cat.test(c)) map.cat = idx;
          else if (map.subj == null && RE.subj.test(c)) map.subj = idx;
          else if (map.due == null && RE.due.test(c)) map.due = idx;
          else if (map.notes == null && RE.notes.test(c)) map.notes = idx;
        });
        break;
      }
    }

    const out = [];
    const start = hi === -1 ? 0 : hi + 1;
    for (let i = start; i < rows.length; i++) {
      const r = rows[i];
      let title;
      if (hi === -1) {
        // no header: longest text cell in the row is the task
        const texts = r.map((c) => String(c).trim()).filter((c) => c && isNaN(Number(c)));
        title = texts.sort((a, b) => b.length - a.length)[0] || "";
      } else {
        title = String(r[map.title] ?? "").trim();
      }
      if (!title) continue;

      let due = null;
      if (map.due != null) due = this.cellToDate(r[map.due]);
      if (!due && hi === -1) for (const c of r) { due = this.cellToDate(c); if (due) break; }

      const prio = map.prio != null ? this.normPriority(r[map.prio]) : this.detectPriority(title).priority;
      const notesParts = [];
      if (map.notes != null && String(r[map.notes]).trim()) notesParts.push(String(r[map.notes]).trim());
      let goal_id = null;
      if (map.subj != null && String(r[map.subj]).trim()) {
        const sv = String(r[map.subj]).trim();
        const g = (typeof Goals !== "undefined" ? Goals.list : []).find((x) => !x.archived && x.name.toLowerCase() === sv.toLowerCase());
        if (g) goal_id = g.id; else notesParts.unshift(sv);
      }
      if (sheetName) notesParts.push(`Sheet: ${sheetName}`);

      let category = this.normCategory(map.cat != null ? r[map.cat] : "") || this.guessCategory(title + " " + notesParts.join(" "));
      let done = false;
      if (map.status != null) done = /^(done|complete[d]?|yes|y|true|1|✓|✔|x)$/i.test(String(r[map.status]).trim());

      out.push({ title: title.slice(0, 200), description: notesParts.join(" · "), due_date: due, priority: prio, category, goal_id, done });
    }
    return out;
  },

  // ---------- parsing: PDF ----------
  async parsePdf(file) {
    await this.loadScript(this.LIBS.pdf);
    const pdfjs = window.pdfjsLib;
    pdfjs.GlobalWorkerOptions.workerSrc = this.LIBS.pdfWorker;
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = Math.min(doc.numPages, this.MAX_PDF_PAGES);
    const lines = [];
    for (let p = 1; p <= pages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      // group text pieces into visual lines by their y position
      const buckets = [];
      for (const it of content.items) {
        if (!it.str || !it.str.trim()) continue;
        const y = it.transform[5], x = it.transform[4];
        let b = buckets.find((k) => Math.abs(k.y - y) < 3);
        if (!b) { b = { y, parts: [] }; buckets.push(b); }
        b.parts.push({ x, s: it.str, w: it.width || 0 });
      }
      buckets.sort((a, b) => b.y - a.y);
      for (const b of buckets) {
        b.parts.sort((a, c) => a.x - c.x);
        let text = "", prevEnd = null;
        for (const part of b.parts) {
          if (prevEnd !== null && part.x - prevEnd > 12) text += "   "; // wide gap = table column
          text += part.s;
          prevEnd = part.x + part.w;
        }
        lines.push(text.replace(/\s+$/g, ""));
      }
    }
    return this.parseLines(lines);
  },

  // ---------- parsing: plain lines (PDF text / .txt) ----------
  parseLines(rawLines) {
    const BULLET = /^\s*(?:[-–—•*▪◦○●□☐■▫✓✔☑►▶➤>·]|\[[ xX✓]?\]|\d{1,3}[.)]|\(?[a-zA-Z][.)]|\(\d{1,3}\))\s+/;
    const lines = rawLines.map((l) => l.replace(/\u00a0/g, " ").trimEnd()).filter((l) => l.trim());
    const marked = lines.filter((l) => BULLET.test(l)).length;
    const bulletMode = marked >= 3;

    const items = [];
    let section = "";
    for (const raw of lines) {
      let line = raw.trim();
      if (/^(page\s*)?\d+(\s*(of|\/)\s*\d+)?$/i.test(line)) continue; // page numbers
      if (line.length < 3) continue;

      const isBullet = BULLET.test(line);
      const wasDone = /^\s*(?:\[[xX✓]\]|[✓✔☑])/.test(line);
      const stripped = line.replace(BULLET, "").trim();

      // headings -> context for the tasks under them
      const looksHeading = !isBullet && (/[:：]$/.test(stripped) || (stripped.length < 60 && stripped === stripped.toUpperCase() && /[A-Z]{3}/.test(stripped)));
      if (looksHeading) { section = stripped.replace(/[:：]$/, ""); continue; }

      if (bulletMode && !isBullet) {
        // wrapped continuation of the previous bullet
        const prev = items[items.length - 1];
        if (prev && /^[a-z(]/.test(stripped) && prev.title.length < 160) { prev.title += " " + stripped; continue; }
        // a short standalone line without a full stop is probably a task too; long prose is skipped
        if (stripped.length > 100 || /[.!?]$/.test(stripped)) continue;
      }

      let text = stripped;
      const d = this.extractDate(text);
      text = d.text;
      const p = this.detectPriority(text);
      text = p.text.replace(/\s{2,}/g, " ").trim().replace(/\s+(by|on|before|due|till|until|from|at)$/i, "").replace(/^[-–—:|,\s]+|[-–—:|,\s]+$/g, "").trim();
      if (text.length < 3) continue;

      let description = section ? `Section: ${section}` : "";
      if (text.length > 160) { description = (description ? description + " · " : "") + text; text = text.slice(0, 157).trimEnd() + "…"; }
      items.push({
        title: text,
        description,
        due_date: d.date,
        priority: p.priority,
        category: this.guessCategory(text + " " + section),
        goal_id: null,
        done: wasDone,
      });
    }
    return items;
  },

  // ---------- helpers ----------
  MONTHS: { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 },

  ymd(y, m, d) {
    if (y < 100) y += 2000;
    const dt = new Date(y, m, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m || dt.getDate() !== d) return null;
    return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  },

  // a date with no year: assume this year, or next year if it's well in the past
  yearless(m, d) {
    const now = new Date();
    let y = now.getFullYear();
    const cand = new Date(y, m, d);
    if (cand < new Date(now.getFullYear(), now.getMonth(), now.getDate() - 60)) y += 1;
    return this.ymd(y, m, d);
  },

  extractDate(text) {
    let m;
    // 2026-10-12
    if ((m = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/))) {
      const v = this.ymd(+m[1], +m[2] - 1, +m[3]);
      if (v) return { date: v, text: text.replace(m[0], " ") };
    }
    // 12/10/2026, 12-10-26 (day first — Indian format)
    if ((m = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})\b/))) {
      const v = this.ymd(+m[3], +m[2] - 1, +m[1]);
      if (v) return { date: v, text: text.replace(m[0], " ") };
    }
    // 12 Oct 2026 / 12th October / 12 Oct
    if ((m = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?[\s-]+(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?(?:,?\s+(\d{4}))?\b/i))) {
      const mo = this.MONTHS[m[2].toLowerCase()];
      const v = m[3] ? this.ymd(+m[3], mo, +m[1]) : this.yearless(mo, +m[1]);
      if (v) return { date: v, text: text.replace(m[0], " ") };
    }
    // Oct 12 / October 12, 2026
    if ((m = text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/i))) {
      const mo = this.MONTHS[m[1].toLowerCase()];
      const v = m[3] ? this.ymd(+m[3], mo, +m[2]) : this.yearless(mo, +m[2]);
      if (v) return { date: v, text: text.replace(m[0], " ") };
    }
    return { date: null, text };
  },

  cellToDate(v) {
    if (v === "" || v == null) return null;
    if (v instanceof Date) return localDateStr(v);
    if (typeof v === "number") {
      if (v > 20000 && v < 80000) { // Excel serial date -> exact day, no timezone drift
        const dt = new Date(Math.round((v - 25569) * 86400000));
        return this.ymd(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
      }
      return null;
    }
    const s = String(v).trim();
    const r = this.extractDate(s);
    return r.date;
  },

  normPriority(v) {
    const s = String(v ?? "").trim().toLowerCase();
    if (!s) return "medium";
    if (/^(h|1|urgent|high|critical|imp)/.test(s)) return "high";
    if (/^(l|3|low|optional|minor)/.test(s)) return "low";
    return "medium";
  },

  normCategory(v) {
    const s = String(v ?? "").trim().toLowerCase();
    if (/(academ|study|college|school|exam|class)/.test(s)) return "academic";
    if (/(fit|gym|workout|health|sport)/.test(s)) return "fitness";
    if (/personal|home|other|general/.test(s)) return "personal";
    return "";
  },

  detectPriority(text) {
    let priority = "medium", out = text;
    if (/\b(urgent|asap|high priority|priority:\s*high|!!+)/i.test(text) || /\((high)\)/i.test(text)) {
      priority = "high";
      out = out.replace(/\b(urgent|asap|high priority|priority:\s*high)\b|!!+|\((high)\)/gi, " ");
    } else if (/\b(low priority|priority:\s*low|optional|someday)\b/i.test(text) || /\((low)\)/i.test(text)) {
      priority = "low";
      out = out.replace(/\b(low priority|priority:\s*low)\b|\((low)\)/gi, " ");
    } else if (/\(medium\)|priority:\s*medium/i.test(text)) {
      out = out.replace(/\(medium\)|priority:\s*medium/gi, " ");
    }
    return { priority, text: out };
  },

  guessCategory(text) {
    const t = text.toLowerCase();
    if (/\b(gym|workout|run|running|exercise|diet|yoga|cardio|squat|pushup|push-up|steps|protein|stretch)/.test(t)) return "fitness";
    if (/\b(study|chapter|revise|revision|solve|practice|assignment|exam|test|mock|lecture|read|notes|submit|project|lab|homework|syllabus|unit|module|paper|quiz|class|topic|formula|ncert|dsa|code)/.test(t)) return "academic";
    return "personal";
  },

  // ---------- step 2: preview + edit ----------
  renderPreview(fileName, capped) {
    const goals = (typeof Goals !== "undefined" ? Goals.list : []).filter((g) => !g.archived);
    openModal(`
      <h3>Review your tasks</h3>
      <p class="muted" style="font-size:12px;margin:0 0 10px"><b id="imp-count"></b> from <i>${escapeHtml(fileName)}</i>${capped ? ` — showing the first ${this.MAX_TASKS}` : ""}. Edit or untick anything you don't want.</p>
      <div class="imp-tools">
        <button type="button" class="link-btn" id="imp-all">Select all</button>
        <button type="button" class="link-btn" id="imp-none">None</button>
        <label class="imp-goal">Goal for all
          <select id="imp-goal"><option value="">—</option>${goals.map((g) => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join("")}</select>
        </label>
      </div>
      <div class="imp-list" id="imp-list"></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="imp-back">Back</button>
        <button type="button" class="btn btn-primary" id="imp-save"></button>
      </div>
    `);
    const modal = document.querySelector("#modal-root .modal-card");
    if (modal) modal.classList.add("imp-wide");

    const list = document.getElementById("imp-list");
    list.innerHTML = this.rows
      .map(
        (t, i) => `
      <div class="imp-row ${t.keep ? "" : "off"}" data-i="${i}">
        <input type="checkbox" class="imp-keep" ${t.keep ? "checked" : ""} aria-label="Include this task" />
        <input type="text" class="imp-title" value="${escapeHtml(t.title)}" maxlength="200" />
        <input type="date" class="imp-due" value="${t.due_date || ""}" />
        <select class="imp-prio">
          ${["high", "medium", "low"].map((p) => `<option value="${p}" ${t.priority === p ? "selected" : ""}>${p[0].toUpperCase() + p.slice(1)}</option>`).join("")}
        </select>
      </div>`
      )
      .join("");

    list.addEventListener("input", (e) => {
      const row = e.target.closest(".imp-row");
      if (!row) return;
      const t = this.rows[+row.dataset.i];
      if (e.target.classList.contains("imp-title")) t.title = e.target.value;
      if (e.target.classList.contains("imp-due")) t.due_date = e.target.value || null;
    });
    list.addEventListener("change", (e) => {
      const row = e.target.closest(".imp-row");
      if (!row) return;
      const t = this.rows[+row.dataset.i];
      if (e.target.classList.contains("imp-keep")) { t.keep = e.target.checked; row.classList.toggle("off", !t.keep); this.updateCount(); }
      if (e.target.classList.contains("imp-prio")) t.priority = e.target.value;
    });

    const setAll = (v) => {
      this.rows.forEach((t) => (t.keep = v));
      list.querySelectorAll(".imp-row").forEach((r) => {
        r.classList.toggle("off", !v);
        r.querySelector(".imp-keep").checked = v;
      });
      this.updateCount();
    };
    document.getElementById("imp-all").onclick = () => setAll(true);
    document.getElementById("imp-none").onclick = () => setAll(false);
    document.getElementById("imp-back").onclick = () => this.open();
    document.getElementById("imp-save").onclick = () => this.save();
    this.updateCount();
  },

  updateCount() {
    const n = this.rows.filter((t) => t.keep && t.title.trim()).length;
    const c = document.getElementById("imp-count");
    const b = document.getElementById("imp-save");
    if (c) c.textContent = `${this.rows.length} task${this.rows.length === 1 ? "" : "s"} found`;
    if (b) { b.textContent = n ? `Add ${n} task${n === 1 ? "" : "s"}` : "Nothing selected"; b.disabled = !n; }
  },

  // ---------- step 3: save ----------
  async save() {
    const btn = document.getElementById("imp-save");
    const chosen = this.rows.filter((t) => t.keep && t.title.trim());
    if (!chosen.length) return;
    btn.disabled = true;
    btn.textContent = "Saving…";
    try {
      const user = await DB.currentUser();
      if (!user) throw new Error("Please log in again.");
      const allGoal = document.getElementById("imp-goal")?.value || null;
      const payload = chosen.map((t) => ({
        user_id: user.id,
        title: t.title.trim().slice(0, 200),
        description: t.description || null,
        category: ["academic", "fitness", "personal"].includes(t.category) ? t.category : "personal",
        priority: ["high", "medium", "low"].includes(t.priority) ? t.priority : "medium",
        goal_id: t.goal_id || allGoal || null,
        due_date: t.due_date || null,
        status: "pending",
      }));
      for (let i = 0; i < payload.length; i += 100) {
        const { error } = await supabaseClient.from("tasks").insert(payload.slice(i, i + 100));
        if (error) throw error;
      }
      DB._invalidate("tasks");
      closeModal();
      toast(`${payload.length} task${payload.length === 1 ? "" : "s"} added to your list.`);
      Tasks.render();
    } catch (err) {
      console.error("[TaskImport save]", err);
      toast(err?.message || "Couldn't save the tasks.", "error");
      btn.disabled = false;
      this.updateCount();
    }
  },
};
