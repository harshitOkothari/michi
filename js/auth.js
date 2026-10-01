// ============================================================
// AUTH — Supabase email/password auth
//
// Views on the auth screen: login · signup · forgot · sent · recovery
// "recovery" is the screen people land on from the password-reset
// email link, where they actually choose the new password. (It was
// missing before, which is why "Forgot password" never really worked:
// the email link logged you straight in and never asked for a new one.)
// ============================================================

const Auth = {
  inRecovery: false,      // true while the user is choosing a new password
  lastEmail: "",          // email used for the last sign-up / reset request
  sentKind: "",           // "signup" | "reset" — what the "sent" view is about
  cooldownUntil: 0,       // stops resend spam (Supabase also rate-limits emails)

  async signUp(name, email, password) {
    const { data, error } = await DB.client.auth.signUp({
      email,
      password,
      options: { data: { name }, emailRedirectTo: Auth.appUrl() },
    });
    if (error) throw error;
    return data;
  },

  async signIn(email, password) {
    const { data, error } = await DB.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  // Google login — Supabase sends the user to Google, then back to appUrl()
  async signInWithGoogle() {
    const { error } = await DB.client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: Auth.appUrl(), queryParams: { prompt: "select_account" } },
    });
    if (error) throw error;
  },

  async signOut() {
    await DB.client.auth.signOut();
  },

  async sendPasswordReset(email) {
    const { error } = await DB.client.auth.resetPasswordForEmail(email, { redirectTo: Auth.appUrl() });
    if (error) throw error;
  },

  async resendConfirmation(email) {
    const { error } = await DB.client.auth.resend({ type: "signup", email, options: { emailRedirectTo: Auth.appUrl() } });
    if (error) throw error;
  },

  async updatePassword(password) {
    const { data, error } = await DB.client.auth.updateUser({ password });
    if (error) throw error;
    return data;
  },

  // must match an entry in Supabase → Authentication → URL Configuration → Redirect URLs
  appUrl() {
    return window.location.origin + window.location.pathname;
  },

  onAuthStateChange(callback) {
    if (!DB.client) return;
    DB.client.auth.onAuthStateChange((event, session) => {
      callback(event, session?.user || null);
    });
  },

  // Reads what the email link left in the URL (captured in index.html before
  // Supabase clears it). Returns "recovery", "error:<message>" or "".
  readUrlResult() {
    const raw = (window.__authHash || "") + "&" + (window.__authSearch || "").replace(/^\?/, "");
    const params = new URLSearchParams(raw.replace(/^[#?&]+/, "").replace(/[#?]/g, "&"));
    const cleanUrl = () => history.replaceState(null, "", window.location.pathname);
    if (params.get("error") || params.get("error_code")) {
      cleanUrl();
      const code = params.get("error_code") || "";
      if (code === "otp_expired") return "error:That link has expired or was already used. Request a new one below.";
      return "error:" + (params.get("error_description") || "That link didn't work. Please try again.").replace(/\+/g, " ");
    }
    if (params.get("type") === "recovery") { cleanUrl(); return "recovery"; }
    return "";
  },
};

function friendlyAuthError(err) {
  const msg = (err && err.message) || String(err || "");
  if (/invalid login credentials/i.test(msg)) return "Wrong email or password.";
  if (/email not confirmed/i.test(msg)) return "Please confirm your email first — check your inbox for the link.";
  if (/rate limit|too many|security purposes|after \d+ seconds?/i.test(msg)) return "Too many emails or attempts. Please wait a minute and try again.";
  if (/already (been )?registered|already exists/i.test(msg)) return "This email already has an account. Log in instead.";
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(msg)) return "Can't reach the server. Check your internet connection and try again.";
  if (/same password|different from the old/i.test(msg)) return "Choose a password you haven't used before.";
  if (/session missing|not authenticated|jwt/i.test(msg)) return "This reset link is no longer valid. Request a new one.";
  return msg || "Something went wrong. Please try again.";
}

// ---- wire up the auth screen ----
function initAuthScreen() {
  const $ = (id) => document.getElementById(id);
  const msgEl = $("auth-msg");
  const tabs = $("auth-tabs");
  const views = [...document.querySelectorAll("#auth-card [data-view]")];

  function setMsg(text, kind = "error") {
    msgEl.textContent = text || "";
    msgEl.className = "auth-msg" + (text ? " show " + kind : "");
  }
  window.setAuthMsg = setMsg;

  // switch between the panels on the auth card
  function showView(name, { keepMsg = false } = {}) {
    views.forEach((v) => v.classList.toggle("hidden", v.dataset.view !== name));
    const isTabView = name === "login" || name === "signup";
    tabs.classList.toggle("hidden", !isTabView);
    $("show-login").classList.toggle("active", name === "login");
    $("show-signup").classList.toggle("active", name === "signup");
    $("show-login").setAttribute("aria-selected", String(name === "login"));
    $("show-signup").setAttribute("aria-selected", String(name === "signup"));
    if (!keepMsg) setMsg("");
    const first = document.querySelector(`#auth-card [data-view="${name}"] input`);
    if (first && !window.matchMedia("(hover: none)").matches) first.focus({ preventScroll: true });
  }
  window.showAuthView = showView;

  function busy(btn, on, label) {
    if (!btn) return;
    if (on) { btn.dataset.label = btn.textContent; btn.textContent = label; }
    else if (btn.dataset.label) btn.textContent = btn.dataset.label;
    btn.disabled = on;
    btn.setAttribute("aria-busy", String(on));
  }

  function needConfig() {
    if (DB.client) return false;
    setMsg(DB.configError || "The app isn't connected to Supabase yet.");
    return true;
  }

  // header "Log in / Sign up" buttons glide down to the form
  document.querySelectorAll("[data-begin]").forEach((b) =>
    b.addEventListener("click", () => {
      showView(b.dataset.begin);
      $("begin").scrollIntoView({ behavior: FX.reduced ? "auto" : "smooth", block: "center" });
    })
  );

  // tabs + every "switch view" text link
  $("show-login").addEventListener("click", () => showView("login"));
  $("show-signup").addEventListener("click", () => showView("signup"));
  document.querySelectorAll("#auth-card [data-go]").forEach((b) =>
    b.addEventListener("click", () => {
      Auth.inRecovery = false;
      showView(b.dataset.go);
    })
  );

  // show / hide password
  document.querySelectorAll(".pw-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = $(btn.dataset.for);
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.classList.toggle("on", show);
      btn.setAttribute("aria-pressed", String(show));
      btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
    });
  });

  // ---- continue with Google ----
  document.querySelectorAll("[data-google]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      setMsg("");
      if (needConfig()) return;
      btn.disabled = true;
      const label = btn.querySelector("span");
      const old = label.textContent;
      label.textContent = "Opening Google…";
      try {
        await Auth.signInWithGoogle(); // page navigates away to Google
      } catch (err) {
        setMsg(/provider is not enabled|unsupported provider/i.test(err?.message || "")
          ? "Google login isn't switched on in Supabase yet. See GUIDE.md, step 2."
          : friendlyAuthError(err));
        btn.disabled = false;
        label.textContent = old;
      }
    })
  );

  // ---- log in ----
  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg("");
    if (needConfig()) return;
    const btn = e.submitter || e.target.querySelector("[type=submit]");
    const email = $("login-email").value.trim();
    const password = $("login-password").value;
    busy(btn, true, "Logging in…");
    try {
      await Auth.signIn(email, password);
      // the auth listener in app.js takes it from here
    } catch (err) {
      const text = friendlyAuthError(err);
      if (/confirm your email/i.test(text)) {
        Auth.lastEmail = email; Auth.sentKind = "signup";
        showSent(`Your email isn't confirmed yet. Open the link we sent to ${email}, or send a new one.`);
      } else {
        setMsg(text);
      }
    } finally {
      busy(btn, false);
    }
  });

  // ---- sign up ----
  $("signup-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg("");
    if (needConfig()) return;
    const btn = e.submitter || e.target.querySelector("[type=submit]");
    const name = $("signup-name").value.trim();
    const email = $("signup-email").value.trim();
    const password = $("signup-password").value;
    busy(btn, true, "Creating account…");
    try {
      const data = await Auth.signUp(name, email, password);
      if (data.session) return; // email confirmation is off — auth listener logs them in
      // Supabase hides "already registered" by returning a user with no identities
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setMsg("This email already has an account. Log in instead.");
        return;
      }
      Auth.lastEmail = email; Auth.sentKind = "signup";
      showSent();
    } catch (err) {
      setMsg(friendlyAuthError(err));
    } finally {
      busy(btn, false);
    }
  });

  // ---- forgot password ----
  $("forgot-password").addEventListener("click", () => {
    const typed = $("login-email").value.trim();
    showView("forgot");
    if (typed) $("forgot-email").value = typed;
  });

  $("forgot-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg("");
    if (needConfig()) return;
    const btn = e.submitter || e.target.querySelector("[type=submit]");
    const email = $("forgot-email").value.trim();
    busy(btn, true, "Sending…");
    try {
      await Auth.sendPasswordReset(email);
      Auth.lastEmail = email; Auth.sentKind = "reset";
      Auth.cooldownUntil = Date.now() + 60000;
      showSent();
    } catch (err) {
      setMsg(friendlyAuthError(err));
    } finally {
      busy(btn, false);
    }
  });

  // ---- "check your email" view (sign-up confirmation + reset link) ----
  let cooldownTimer = null;
  function showSent(override) {
    const reset = Auth.sentKind === "reset";
    $("sent-title").textContent = "Check your email";
    $("sent-text").textContent = override ? override : reset
      ? `If an account exists for ${Auth.lastEmail}, a link to reset your password is on its way. It can take a minute — check spam too.`
      : `We sent a confirmation link to ${Auth.lastEmail}. Open it, then come back here and log in.`;
    showView("sent");
    tickCooldown();
  }
  function tickCooldown() {
    const btn = $("sent-resend");
    clearInterval(cooldownTimer);
    const update = () => {
      const left = Math.ceil((Auth.cooldownUntil - Date.now()) / 1000);
      if (left > 0) { btn.disabled = true; btn.textContent = `Send it again in ${left}s`; }
      else { btn.disabled = false; btn.textContent = "Send it again"; clearInterval(cooldownTimer); }
    };
    update();
    cooldownTimer = setInterval(update, 1000);
  }
  $("sent-resend").addEventListener("click", async () => {
    if (needConfig()) return;
    const btn = $("sent-resend");
    btn.disabled = true;
    try {
      if (Auth.sentKind === "reset") await Auth.sendPasswordReset(Auth.lastEmail);
      else await Auth.resendConfirmation(Auth.lastEmail);
      Auth.cooldownUntil = Date.now() + 60000;
      setMsg("Sent again. Check your inbox.", "success");
    } catch (err) {
      setMsg(friendlyAuthError(err));
    }
    tickCooldown();
  });

  // ---- set a new password (from the reset link) ----
  $("recovery-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg("");
    const btn = e.submitter || e.target.querySelector("[type=submit]");
    const pw = $("recovery-password").value;
    if (pw !== $("recovery-confirm").value) { setMsg("The two passwords don't match."); return; }
    busy(btn, true, "Updating…");
    try {
      await Auth.updatePassword(pw);
      Auth.inRecovery = false;
      $("recovery-form").reset();
      toast("Password updated. You're logged in.");
      await enterApp(await DB.currentUser(), true);
      if (!activeUserId) { setMsg("Password updated. Please log in with your new password."); showView("login", { keepMsg: true }); }
    } catch (err) {
      const text = friendlyAuthError(err);
      setMsg(text);
      if (/no longer valid/i.test(text)) { Auth.inRecovery = false; setTimeout(() => showView("forgot", { keepMsg: true }), 1200); }
    } finally {
      busy(btn, false);
    }
  });

  // what arrived from an email link?
  const result = Auth.readUrlResult();
  if (result === "recovery") {
    Auth.inRecovery = true;
    showView("recovery");
    setTimeout(() => $("begin").scrollIntoView({ block: "center" }), 60);
  } else if (result.startsWith("error:")) {
    showView("forgot");
    setMsg(result.slice(6));
    setTimeout(() => $("begin").scrollIntoView({ block: "center" }), 60);
  }
}
