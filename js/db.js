// ============================================================
// Supabase client + thin DB helper layer.
// Every function here talks to Postgres via Supabase — nothing
// important is ever stored in localStorage.
//
// Speed notes:
//  - currentUser() reads the locally stored session (no network
//    round-trip). It used to call auth.getUser() every time, which
//    is a full request to Supabase — and almost every action awaits it.
//  - goals / subjects / settings are cached in memory and dropped
//    the moment anything writes to that table.
// ============================================================

let supabaseClient = null;
let dbConfigError = null;
try {
  const url = window.SUPABASE_URL || "";
  const key = window.SUPABASE_ANON_KEY || "";
  if (!url || !key || url.includes("YOUR_SUPABASE") || key.includes("YOUR_SUPABASE")) {
    throw new Error("Supabase isn't configured yet — open js/config.js and paste your Project URL and anon key.");
  }
  supabaseClient = window.supabase.createClient(url, key);
} catch (err) {
  dbConfigError = err?.message || String(err);
  console.error("[Supabase config error]", dbConfigError);
}

const CACHEABLE_TABLES = new Set(["goals", "subjects", "user_settings"]);

const DB = {
  client: supabaseClient,
  configError: dbConfigError,
  _user: null,
  _userReady: null,
  _cache: new Map(),

  // ---- session / user ----
  setUser(user) {
    if ((this._user?.id || null) !== (user?.id || null)) this._cache.clear();
    this._user = user || null;
    // no user -> forget the cached lookup so the next call re-reads the session
    this._userReady = user ? Promise.resolve(user) : null;
  },

  async currentUser() {
    if (!supabaseClient) return null;
    if (this._user) return this._user;
    if (!this._userReady) {
      this._userReady = supabaseClient.auth.getSession().then(({ data }) => {
        this._user = data?.session?.user || null;
        return this._user;
      });
    }
    return this._userReady;
  },

  _invalidate(table) {
    for (const k of this._cache.keys()) if (k.startsWith(table + "|")) this._cache.delete(k);
  },

  // ---- generic CRUD ----
  async list(table, { filters = {}, order = null, ascending = false, limit = null, columns = "*", gte = null, lte = null } = {}) {
    const cacheKey = CACHEABLE_TABLES.has(table)
      ? `${table}|${JSON.stringify([filters, order, ascending, limit, columns])}`
      : null;
    if (cacheKey && this._cache.has(cacheKey)) return this._cache.get(cacheKey);

    let q = supabaseClient.from(table).select(columns);
    for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
    if (gte) for (const [k, v] of Object.entries(gte)) q = q.gte(k, v);
    if (lte) for (const [k, v] of Object.entries(lte)) q = q.lte(k, v);
    if (order) q = q.order(order, { ascending });
    if (limit) q = q.limit(limit);
    const { data, error } = await q;
    if (error) throw error;
    if (cacheKey) this._cache.set(cacheKey, data);
    return data;
  },

  async insert(table, row) {
    const user = await this.currentUser();
    if (!user) throw new Error("Not authenticated");
    const { data, error } = await supabaseClient
      .from(table)
      .insert({ ...row, user_id: user.id })
      .select()
      .single();
    if (error) throw error;
    this._invalidate(table);
    return data;
  },

  async update(table, id, patch) {
    const { data, error } = await supabaseClient
      .from(table)
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    this._invalidate(table);
    return data;
  },

  async remove(table, id) {
    const { error } = await supabaseClient.from(table).delete().eq("id", id);
    if (error) throw error;
    this._invalidate(table);
    // deleting a goal/subject can cascade — drop dependent caches too
    if (table === "goals") this._invalidate("subjects");
    return true;
  },

  // ---- activity log + xp + streak, called after any completion event ----
  // Awards XP and logs activity together (in parallel) so saving something
  // doesn't wait on three sequential round-trips.
  async reward(xpKey, fallbackXp, reason, activityType, description, refId = null) {
    // XP values are fixed by Michi (see XP_RULES in xp.js) — not user-editable
    const amount = XP_RULES[xpKey] ?? fallbackXp;
    await Promise.all([
      this.awardXP(amount, reason, refId),
      this.logActivity(activityType, description, refId),
    ]);
    if (typeof FX !== "undefined") FX.floatXP(amount);
    return amount;
  },

  async logActivity(activity_type, description, ref_id = null) {
    const user = await this.currentUser();
    if (!user) return;
    await supabaseClient.from("activity_log").insert({
      user_id: user.id,
      activity_type,
      description,
      ref_id,
    });
    await this.bumpStreak();
  },

  async awardXP(amount, reason, ref_id = null) {
    const user = await this.currentUser();
    if (!user) return;
    await supabaseClient.from("xp_events").insert({
      user_id: user.id,
      amount,
      reason,
      ref_id,
    });
  },

  async bumpStreak() {
    const user = await this.currentUser();
    if (!user) return;
    const today = todayStr(); // the user's LOCAL date, not UTC

    const { data: streak } = await supabaseClient
      .from("streaks")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!streak) return;
    if (streak.last_active_date === today) return; // already counted today

    const settings = await this.getSettings();
    const grace = settings?.streak_grace_days ?? 0;

    let newStreak = 1;
    if (streak.last_active_date) {
      const diffDays = daysBetween(streak.last_active_date, today);
      if (diffDays <= 1 + grace) {
        newStreak = streak.current_streak + 1;
      }
    }
    const longest = Math.max(newStreak, streak.longest_streak || 0);

    await supabaseClient
      .from("streaks")
      .update({
        current_streak: newStreak,
        longest_streak: longest,
        last_active_date: today,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (newStreak > 0 && newStreak % 7 === 0) {
      await this.awardXP(XP_RULES.xp_streak_bonus, "streak_bonus");
    }
  },

  async getSettings() {
    const user = await this.currentUser();
    if (!user) return null;
    const rows = await this.list("user_settings", { filters: { user_id: user.id } });
    return rows?.[0] || null;
  },

  async saveSettings(patch) {
    const user = await this.currentUser();
    const { error } = await supabaseClient.from("user_settings").update(patch).eq("user_id", user.id);
    if (error) throw error;
    this._invalidate("user_settings");
  },
};
