# Personal Dashboard — Phases 1–3

A website you can install like an app. Track anything you're working toward — JEE, NEET, Boards, CLAT, College, or something custom — with subjects, tests, XP, streaks, and analysis. Cloud-synced via Supabase, same account on every device.

## What changed from v1
- **No more hardcoded College/CLAT.** You create your own **Goals** (e.g. "JEE", "NEET", "Boards", "CLAT 2027", "BCA College") — each gets its own subjects/sections, tests, and analysis tab. Works for any student, any exam.
- The old "Goals" feature (deadline + progress bars) is renamed **Milestones** to avoid clashing with the new term — ships in Phase 3.
- **Installable.** `manifest.json` + `service-worker.js` make this a PWA — visitors get an "Install" button (desktop Chrome/Edge) or can "Add to Home Screen" (mobile), and it opens like a standalone app with its own icon. It's still just the website underneath — no app store, no build step.

## What's in Phase 1 + 2
- Split-panel login/signup screen with a login↔signup toggle, password visibility toggle, forgot-password flow — per-user data via Supabase Row Level Security
- **Profile** (Settings page): editable name, avatar photo upload, email, member-since date, live Level/XP/streak stats, logout — click your name/avatar in the sidebar any time
- **Admin** (hidden unless granted — see below): a user directory showing everyone's profile, avatar, email, join date, level/XP/streak, goals & subjects, recent tests, tasks, and activity — read-only, cannot edit or delete anyone's data
- **Goals**: create any number of goals (JEE, NEET, Boards, CLAT, College, custom), each with its own subjects/sections and topics (add/edit/archive/delete, with an archive-vs-permanently-delete warning)
- **Tests**: full CRUD under any goal, auto-calculated percentage/accuracy, +25 XP on add
- **Study**: count-up stopwatch timer (Start/Pause/Resume/Stop&Save/Reset) and a full Pomodoro (customizable work/break lengths, auto-advancing cycle, Skip/Reset) — both taggable to any Goal + Subject + Topic or left as Personal; each completed session/Pomodoro awards XP and shows in a combined Recent Sessions list
- **Tasks**: full CRUD with priority, due date, optional Goal/category link, filters (All/Today/Upcoming/Completed/Academic/Fitness/Personal); completing a task awards XP
- **History**: searchable test list + full activity log
- **Analysis**: one tab per goal — overall average, average by subject, best/worst, score progression chart
- **Dashboard**: Level/XP header, streak, real weekly study hours chart, today's study time/tasks, recent tests, recent activity
- XP + streaks are fully live: study sessions, Pomodoros, tasks and tests all feed the same XP ledger and streak tracker
- Dark / light / system theme, responsive with mobile bottom nav, installable as a PWA
- Dashboard: Level/XP header, streak, XP bar, quick actions, today's overview, recent tests, recent activity
- **Goals**: create any number of goals, each with its own subjects/sections and topics (add/edit/archive/delete, with an archive-vs-permanently-delete warning)
- **Tests**: full CRUD under any goal, auto-calculated percentage/accuracy, +25 XP on add
- **History**: searchable test list + full activity log
- **Analysis**: one tab per goal — overall average, average by subject, best/worst, score progression chart
- Dark / light / system theme
- Responsive, with bottom nav on mobile
- PWA installability

**Phase 3 (included):** Fitness (workouts, templates, PRs, body measurements), Milestones, Skills, Calendar, Settings (XP/timer rules, change password, export/import, delete account).

## 1. Create your Supabase project
1. https://supabase.com → New Project.
2. **Project Settings → API** — copy the **Project URL** and the **anon public** key.
3. **Authentication → Providers** — enable Email. (Optional while testing: Authentication → Settings → turn off "Confirm email" so signup logs you straight in.)

## 2. Run the schema
1. **SQL Editor → New query** in Supabase.
2. Paste all of `sql/schema.sql` and run it. Creates every table (including ones later phases will use), enables RLS on all of them, and auto-creates a profile/settings/streak row on signup.

> If you ran the old v1 schema (College/CLAT) in this same project already, easiest is to start a fresh Supabase project for v2 — the table shapes changed.

## 3. Add your keys
`js/config.js`:
```js
window.SUPABASE_URL = "https://xxxxx.supabase.co";
window.SUPABASE_ANON_KEY = "eyJ...";
```
The anon key is safe in frontend code — RLS protects the data, not key secrecy.

## 3b. Enable avatar uploads
The schema already sets up the `avatars` storage bucket and its access policies, but Supabase also wants you to confirm the bucket exists in the dashboard: **Storage → New bucket → name it exactly `avatars` → Public bucket: ON**. (If the bucket already got created by the SQL script, you'll just see it listed — nothing more to do.) Without this, the profile photo upload will show an error toast but the rest of the app keeps working fine.

## 3c. Grant yourself admin access
Admin can **only** be granted by running SQL directly — never from the app, so no user can make themselves admin.
1. Sign up for your own account in the app first (so a row exists for you).
2. In Supabase: **Authentication → Users**, copy your user's UUID (or run `select id, email from auth.users;` in the SQL Editor).
3. In the **SQL Editor**, run:
   ```sql
   insert into admin_users (user_id) values ('paste-your-uuid-here');
   ```
4. Refresh the app — an **Admin** link (red) appears at the bottom of the sidebar. It shows every signed-up user: profile, avatar, email, join date, level/XP/streak, goals/subjects, recent tests, tasks, and activity. It's read-only by design — admins can view but never edit or delete another user's data from the app.
5. To revoke: `delete from admin_users where user_id = '...';`

## 4. Generate real icons (optional)
Placeholder icons are in `icons/`. Swap `icons/icon-192.png` and `icons/icon-512.png` for your own square PNGs (same filenames) whenever you want custom branding — the manifest already points at them.

## 5. Run it locally
```
cd project
python3 -m http.server 8000
```
Open `http://localhost:8000`. (Must be served over http(s), not opened as a `file://` path — the Supabase client and service worker both need a real origin.)

## 6. Deploy so it's a real, installable website
1. Push this folder to a GitHub repo.
2. Repo → Settings → Pages → Source: deploy from branch/root.
3. Visit the resulting `https://yourname.github.io/repo/` URL — that's your live site. Anyone can sign up with their own account and set up their own Goals/subjects.
4. On desktop Chrome/Edge, an install icon appears in the address bar (or use the sidebar's "Install App" button). On mobile, use the browser's "Add to Home Screen."

## Database schema
`sql/schema.sql` — tables: `profiles`, `user_settings`, `goals`, `goal_groups`, `subjects`, `topics`, `tests`, `test_sections`, `study_sessions`, `pomodoros`, `tasks`, `workout_templates`, `workouts`, `workout_exercises`, `body_measurements`, `milestones`, `skills`, `activity_log`, `xp_events`, `streaks`. Every user-owned table has `user_id` + an RLS policy restricting all operations to `auth.uid() = user_id`.

## How to add a Goal / subject
Goals page → **+ Add Goal** (name it anything — JEE, NEET, Boards, CLAT, College, custom) → **+ Add Subject** under it → add topics via the **Topics** link on each subject card.

## Project structure
```
index.html
manifest.json       ← PWA manifest
service-worker.js   ← offline app-shell caching
icons/               ← PWA icons (swap for your own)
css/style.css
js/
  config.js     ← your Supabase keys go here
  db.js         ← Supabase client + generic CRUD/XP/streak helpers
  xp.js         ← level math (derived from total XP)
  ui.js         ← toasts, modals, chart rendering, formatters
  auth.js       ← signup/login/logout/reset
  goals.js      ← generic goal/subject/topic management
  tests.js      ← test CRUD, goal-aware
  history.js    ← unified history view
  analysis.js   ← per-goal analysis charts
  dashboard.js  ← dashboard page
  app.js        ← router + auth gate + PWA install/service worker hookup
sql/schema.sql  ← full DB schema + RLS (all phases)
```

## Next
Test signup/login/logout, add 2 different Goals (try "JEE" and "College"), add subjects and a few tests under each, run a study session and a Pomodoro, add and complete a task, confirm XP/streak/dashboard all update, confirm Analysis and History are goal-aware, install it via the browser's install prompt, then tell me what to adjust before Phase 3 (Fitness, Milestones, Skills, Calendar).


---

## Setup notes for this version

1. **Keys:** open `js/config.js` and paste your Supabase **anon** key (the URL is already filled in). It is loaded separately from `bundle.js`, so rebuilding never overwrites it.
2. **Run `sql/phase3.sql`** once in Supabase → SQL Editor (needed for "Delete my account").
3. **Password reset + email links:** Supabase → Authentication → URL Configuration.
   - *Site URL* = your deployed address (e.g. `https://yourname.github.io/dashboard/`)
   - *Redirect URLs* → add the same address. If it isn't listed, reset links will not bring people back to the site.
4. **Editing code:** change files in `js/`, then run `bash build.sh` to rebuild `js/bundle.js` (minified if `esbuild` is installed: `npm i -g esbuild`).


---

## v20 additions
- **Import tasks from a file** — Tasks page → *Import PDF / Excel*. Upload a PDF, .xlsx/.xls, .csv or .txt; Michi reads it in the browser, finds tasks (and due dates / priority / category when present), shows a preview you can edit or untick, then adds them. Excel works best with a header row like `Task | Due date | Priority | Status | Subject`. Scanned (image-only) PDFs have no readable text, so they can't be imported. No database change needed.
- **Real photo of the girl on the landing page** — put a transparent-background PNG at `assets/hero/girl.png`. If the file is missing, the drawn silhouette stays. See `assets/hero/README.txt`.

## v21 additions
- **Continue with Google** on the login and signup screens (Supabase OAuth). Setup: `GUIDE.md` Part A + run `sql/google.sql`.
- `GUIDE.md` also covers granting Admin access (Part B) and uploading to GitHub Pages (Part C). `deploy.sh` = one-command rebuild + push.
