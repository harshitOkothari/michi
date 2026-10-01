# Michi — Google login + Admin + GitHub (step by step)

Replace these in every step:
- `YOURNAME` = your GitHub username
- `REPO` = your repo name (e.g. `michi`)
- Your Supabase project = `juvjgdaorufdlnmjnrzn` (already in js/config.js)

---

## PART A — Google login

### Step 1: Google Cloud (get Client ID + Secret)
1. Go to https://console.cloud.google.com → top bar → **New Project** → name it `Michi` → Create.
2. Left menu → **APIs & Services → OAuth consent screen** (new UI: *Google Auth Platform → Branding*).
   - App name: `Michi` · User support email: yours · Developer email: yours → Save.
   - Audience / user type: **External**.
3. **Credentials → Create Credentials → OAuth client ID → Web application**.
4. **Authorized JavaScript origins** → add:
   - `https://YOURNAME.github.io`
   - `http://localhost:8000` (only if you test locally)
5. **Authorized redirect URIs** → add exactly this (no changes):
   - `https://juvjgdaorufdlnmjnrzn.supabase.co/auth/v1/callback`
6. Create → copy the **Client ID** and **Client Secret**.
7. Audience → **Publish app** (otherwise only your "Test users" can log in). Basic email/profile login needs no Google verification.

### Step 2: Supabase (switch Google on)
1. Supabase → **Authentication → Sign In / Providers → Google** → Enable.
2. Paste Client ID + Client Secret → **Save**.
3. **Authentication → URL Configuration**:
   - Site URL: `https://YOURNAME.github.io/REPO/`
   - Redirect URLs → add: `https://YOURNAME.github.io/REPO/**` (and `http://localhost:8000/**` for local).
4. **SQL Editor → New query** → paste all of `sql/google.sql` → Run. (Makes Google users get their real name.)

### Step 3: Test
Open your live site → **Continue with Google** → pick account → you land inside the app.
Same email as an old password account? Supabase links them to one account automatically.

> Never put the Google Client Secret in your code. It lives only inside Supabase.

---

## PART B — Admin panel access

Admin can only be given from Supabase SQL (never from the app) — that's what keeps it safe.

1. Log in to your site once (Google or email) so your account exists.
2. Supabase → **SQL Editor → New query** → run (put YOUR Google/email address):
   ```sql
   insert into admin_users (user_id)
   select id from auth.users where email = 'you@gmail.com';
   ```
3. Check it worked:
   ```sql
   select * from admin_users;
   ```
   You should see 1 row.
4. On the site: **log out → log in again** (or hard refresh). A red **Admin** link appears at the bottom of the sidebar.
5. Admin is **read-only**: you can see users, XP, goals, tests, tasks — you can't edit or delete anyone's data.

Remove an admin:
```sql
delete from admin_users where user_id = (select id from auth.users where email = 'you@gmail.com');
```

If `relation "admin_users" does not exist` → you haven't run `sql/schema.sql` yet. Run it first, then redo step 2.

---

## PART C — Upload to GitHub + go live

Before you start: open `js/config.js` and paste your Supabase **anon public** key (safe to publish). Never paste the `service_role` key.
If you edited anything in `js/`, run `bash build.sh` first.

### Easiest: no git, browser only
1. https://github.com/new → Repository name `REPO` → **Public** → Create repository.
2. Click **uploading an existing file**.
3. Unzip michi first, open the folder, select **everything inside it** (not the zip, not the outer folder) and drag into the page.
4. Scroll down → **Commit changes**.
   (Hidden files like `.nojekyll` may not drag in — that's okay, the site still works.)

### With git (recommended — easy updates)
Install git, then in a terminal inside the project folder:
```bash
git init
git add .
git commit -m "Michi v21"
git branch -M main
git remote add origin https://github.com/YOURNAME/REPO.git
git push -u origin main
```
(GitHub asks you to log in the first time. If it asks for a password, use a **Personal Access Token**: GitHub → Settings → Developer settings → Tokens.)

### Turn on the website
1. Repo → **Settings → Pages**.
2. Source: **Deploy from a branch** → Branch: `main` → folder `/ (root)` → **Save**.
3. Wait ~1–2 min. Your site: `https://YOURNAME.github.io/REPO/`
4. Put this exact URL into Supabase (Part A, step 2.3) and Google origins (Part A, step 1.4).

### Updating later (one command)
```bash
bash deploy.sh "what I changed"
```
It rebuilds `bundle.js`, commits and pushes. Then hard refresh the site (Ctrl+Shift+R).

---

## If something breaks

| Problem | Fix |
|---|---|
| Google says `redirect_uri_mismatch` | Redirect URI in Google must be exactly `https://juvjgdaorufdlnmjnrzn.supabase.co/auth/v1/callback` |
| "Access blocked / app in testing" | Google Cloud → Audience → Publish app (or add yourself under Test users) |
| Button says "Google login isn't switched on" | Part A step 2.1–2.2 not saved in Supabase |
| After Google you're back on the landing page, not logged in | Your site URL is missing in Supabase → Redirect URLs (add the `/**` one) |
| Admin link not showing | Different email than the one you inserted, or not logged out/in again |
| Site shows old version after push | Hard refresh (Ctrl+Shift+R); PWA cache updates on next load |
| Blank page on GitHub Pages | Wait 2 min after first deploy; check Settings → Pages shows "Your site is live" |
