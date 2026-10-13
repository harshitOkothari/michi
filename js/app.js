// ============================================================
// APP — auth gate + navigation router
// ============================================================

let currentPage = "dashboard";

async function go(page) {
  currentPage = page;
  document.body.dataset.page = page;
  document.querySelectorAll(".nav-item").forEach((n) => n.classList.toggle("active", n.dataset.page === page));
  document.querySelectorAll(".page").forEach((p) => p.classList.add("hidden"));
  document.getElementById(`page-${page}`)?.classList.remove("hidden");

  if (page === "dashboard") await Dashboard.render();
  else if (page === "goals") { await Goals.render(); }
  else if (page === "tests") await Tests.render();
  else if (page === "study") await Study.render();
  else if (page === "tasks") await Tasks.render();
  else if (page === "milestones") await Milestones.render();
  else if (page === "fitness") await Fitness.render();
  else if (page === "skills") await Skills.render();
  else if (page === "calendar") await Calendar.render();
  else if (page === "history") await History.render();
  else if (page === "analysis") await Analysis.render();
  else if (page === "friends") await Friends.render();
  else if (page === "games") Games.render();
  else if (page === "settings") await Profile.render();
  else if (page === "admin") await Admin.render();
}

function initNav() {
  document.querySelectorAll(".nav-item[data-page]").forEach((item) => {
    item.addEventListener("click", () => go(item.dataset.page));
  });
  document.getElementById("sidebar-profile-btn")?.addEventListener("click", () => Profile.openCard());
  document.getElementById("logout-btn")?.addEventListener("click", async () => {
    await Auth.signOut();
  });
  document.getElementById("mobile-more-btn")?.addEventListener("click", () => openMobileMoreMenu());
}

function openMobileMoreMenu() {
  const pages = [
    ["goals", "Goals"], ["tests", "Tests"], ["fitness", "Fitness"],
    ["milestones", "Milestones"], ["skills", "Skills"], ["calendar", "Calendar"],
    ["history", "History"], ["friends", "Friends"], ["games", "Games"], ["settings", "Settings"],
  ];
  const adminRow = Admin.isAdmin ? `<button class="more-menu-item" data-page="admin">Admin</button>` : "";
  openModal(`
    <h3>More</h3>
    <div class="more-menu-grid">
      ${pages.map(([p, label]) => `<button class="more-menu-item" data-page="${p}">${label}</button>`).join("")}
      ${adminRow}
    </div>
  `);
  document.querySelectorAll(".more-menu-item").forEach((btn) => {
    btn.onclick = () => {
      closeModal();
      go(btn.dataset.page);
    };
  });
}

function showApp(show) {
  document.getElementById("auth-screen").classList.toggle("hidden", show);
  document.getElementById("app-shell").classList.toggle("hidden", !show);
}

let activeUserId = null; // who the app is currently showing

// clear everything that belongs to the previous user (shared computers!)
function resetAppState() {
  document.querySelectorAll(".page").forEach((p) => (p.innerHTML = ""));
  Goals.list = []; Goals.subjects = []; Goals.activeGoalId = null;
  Tasks.list = []; Tests.list = []; Milestones.list = []; Skills.list = [];
  Study.pomo.settings = null; Study.pomo.today = null; Study.pomo.sessionsCompleted = 0; Study.pomo.phase = "work"; Study.pomo.running = false;
  clearInterval(Study.pomo.intervalId); clearInterval(Study.timer.intervalId);
  Study.timer.running = false; Study.timer.elapsedMs = 0;
  Admin.isAdmin = false; Dashboard.lastLevel = null; Dashboard.editing = false;
  document.getElementById("nav-admin-btn")?.classList.add("hidden");
  DB.setUser(null);
}

async function enterApp(user, force = false) {
  if (!user) return;
  if (!force && activeUserId === user.id) return; // token refresh / tab refocus — stay where you are
  activeUserId = user.id;
  DB.setUser(user);
  showApp(true);
  updateSidebarProfile();
  await Admin.checkIsAdmin();
  await go("dashboard");
  Nudges.start();
}

function leaveApp() {
  Games.stop();
  Nudges.stop();
  activeUserId = null;
  resetAppState();
  showApp(false);
}

async function boot() {
  initNav();
  initAuthScreen();
  initThemeToggle();
  initInstallPrompt();
  registerServiceWorker();
  showConfigErrorIfAny();
  CustomSelect.init();
  FX.init();
  FloatTimer.init();
  initGlobalKeys();

  // any promise that fails without a catch (a network hiccup while saving, say)
  // now shows a message instead of silently doing nothing
  window.addEventListener("unhandledrejection", (e) => {
    console.error(e.reason);
    if (activeUserId) toast("Something went wrong. Check your connection and try again.", "error");
  });

  Auth.onAuthStateChange(async (event, user) => {
    if (event === "PASSWORD_RECOVERY") {
      Auth.inRecovery = true;
      leaveApp();
      showAuthView("recovery");
      return;
    }
    if (Auth.inRecovery) return; // stay on "set a new password" until it's done
    if (user) await enterApp(user);
    else if (event === "SIGNED_OUT" || activeUserId) { leaveApp(); showAuthView("login"); }
  });

  if (Auth.inRecovery) { showApp(false); return; } // arrived from a reset link
  const user = await DB.currentUser();
  if (user) await enterApp(user);
  else showApp(false);
}

// Escape closes a modal (custom dropdowns handle their own Escape first)
function initGlobalKeys() {
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (CustomSelect.openInst || DatePicker.openInst) return;
    if (document.getElementById("modal-backdrop")) closeModal();
  });
}

function showConfigErrorIfAny() {
  if (!DB.configError) return;
  const banner = document.createElement("div");
  banner.className = "config-error-banner";
  banner.innerHTML = `⚠️ ${escapeHtml(DB.configError)}`;
  document.querySelector(".auth-form-panel")?.prepend(banner);
}

function initThemeToggle() {
  buildThemeSky();
  const systemDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const saved = localStorage.getItem("theme") || (systemDark ? "dark" : "light");
  applyTheme(saved);
  document.getElementById("theme-toggle")?.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "light";   // the page itself is the source of truth
    const next = current === "dark" ? "light" : "dark";
    localStorage.setItem("theme", next);
    applyTheme(next, true);
  });
}

// scatter a few stars + a cloud into the theme switch track so it feels alive
function buildThemeSky() {
  const sky = document.getElementById("theme-switch-sky");
  if (!sky) return;
  const starSpots = [[10, 8], [18, 22], [8, 26], [15, 14]];
  sky.innerHTML =
    starSpots.map(([left, top]) => `<span class="theme-switch-star" style="left:${left}px; top:${top}px;"></span>`).join("") +
    `<span class="theme-switch-cloud" style="left:70px; top:8px;">☁️</span>
     <span class="theme-switch-cloud" style="left:92px; top:18px; font-size:9px;">☁️</span>`;
}

function applyTheme(mode) {
  document.documentElement.setAttribute("data-theme", mode);
  const label = document.getElementById("theme-switch-label");
  if (label) label.textContent = mode === "dark" ? "Night" : "Day";
  // keep the browser/PWA chrome (status bar, address bar, app-switcher card)
  // in sync with the in-app theme — this is what makes the installed app
  // match instead of always showing the light-mode purple.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", mode === "dark" ? "#0b0a0b" : "#f1eadb");
}

// ---- PWA: install prompt + service worker registration ----
let deferredInstallPrompt = null;

function initInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const btn = document.getElementById("install-btn");
    if (btn) btn.classList.remove("hidden");
  });

  document.getElementById("install-btn")?.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    document.getElementById("install-btn")?.classList.add("hidden");
  });
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {
      // silent fail — app still works without offline caching
    });
  }
}

document.addEventListener("DOMContentLoaded", boot);
