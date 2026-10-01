// ============================================================
// XP / Level math. Level is always DERIVED from total XP,
// never stored directly — so changing XP rules later never
// leaves stale level data.
//
// Formula: XP required to REACH level N (from 0) grows
// quadratically, giving a smooth, slightly increasing curve:
//   totalXpForLevel(n) = 100 * n * (n + 1) / 2
// i.e. level 1->2 costs 100xp more than 0->1, etc.
// Tune BASE_XP_STEP to change overall pacing.
// ============================================================

const BASE_XP_STEP = 100;

// Fixed rewards — the same for everyone, so levels mean the same thing.
const XP_RULES = {
  xp_task: 10,
  xp_study_session: 15,
  xp_pomodoro: 10,
  xp_test: 25,
  xp_workout: 20,
  xp_weekly_milestone: 75,
  xp_streak_bonus: 50,
};

function totalXpForLevel(level) {
  return BASE_XP_STEP * level * (level + 1) / 2;
}

function levelFromXP(totalXP) {
  let level = 0;
  while (totalXpForLevel(level + 1) <= totalXP) level++;
  return level;
}

function xpProgress(totalXP) {
  const level = levelFromXP(totalXP);
  const floor = totalXpForLevel(level);
  const ceil = totalXpForLevel(level + 1);
  return {
    level,
    xpIntoLevel: totalXP - floor,
    xpForNextLevel: ceil - floor,
    xpToNext: ceil - totalXP,
    progressPct: Math.round(((totalXP - floor) / (ceil - floor)) * 100),
  };
}

async function getTotalXP() {
  const user = await DB.currentUser();
  if (!user) return 0;
  const { data, error } = await DB.client
    .from("xp_events")
    .select("amount")
    .eq("user_id", user.id);
  if (error || !data) return 0;
  return data.reduce((sum, r) => sum + r.amount, 0);
}

// The streak stored in the database only changes when you do something.
// If you've skipped more days than allowed, it's really 0 — show that
// instead of a stale number.
function effectiveStreak(streak, settings) {
  if (!streak || !streak.last_active_date) return 0;
  const grace = settings?.streak_grace_days ?? 0;
  return daysBetween(streak.last_active_date, todayStr()) > 1 + grace ? 0 : (streak.current_streak || 0);
}

// true if this thing already earned XP once (stops complete → un-complete →
// complete again from paying out over and over)
async function alreadyRewarded(reason, refId) {
  if (!refId) return false;
  const user = await DB.currentUser();
  const { data } = await DB.client
    .from("xp_events").select("id").eq("user_id", user.id).eq("reason", reason).eq("ref_id", refId).limit(1);
  return !!(data && data.length);
}
