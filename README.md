# Due Board

A free homework planner for ManageBac students. Deadlines on a dashboard, a month and week calendar, a weekly study planner, a focus timer with Pomodoro cycles, and points, streaks, levels and achievements. Sign in to keep the same homework on your phone, tablet and laptop, or use it without an account.

It is a static website: no build step and no server code of its own. Accounts and sync use [Supabase](https://supabase.com) (free plan).

## What's in it

- **Home:** greeting, overdue / due today / next 7 days / done this week (tap to filter), the next deadline with a countdown, search, subject and priority filters, sorting, grouped lists, recently finished work, level, streak, study time and upcoming tests.
- **Homework:** title, subject, due date and time (or all day), priority, estimated time, checklist steps, notes, links, reminders, repeating homework (daily, weekdays, weekly, every 2 weeks, monthly), a day to work on it, test or exam with a generated revision plan.
- **Calendar:** month and week views, counts and subject colours per day, finished and overdue states, workload bars against your daily time budget, subject filter, the selected day's agenda and quick add. Arrow keys move between days.
- **Planner:** drag homework (or use the menu) onto the days of the week; "Plan it for me" spreads unplanned work before each due date within your daily capacity; revision steps show on their days.
- **Focus:** 25, 45, 60 minutes or a custom length; Pomodoro cycles with short and long breaks; pause; "Session completed"; *Did you make progress?* (mark complete, tick steps and note what's left, or skip). Study minutes are recorded per subject, with daily and weekly goals and a session history. The timer survives reloads and closing the app: a block that ended while the app was closed is recorded at the time it ended.
- **Progress:** points, level, completion rate (30 days), on-time rate, current and best streak, last 7 days and last 6 months (homework and study time), study goals, study time by subject, a subjects table, a 26-week activity map, 14 achievements and full history.
- **Archive:** completed, archived, removed-in-ManageBac and deleted homework. Everything can be restored.
- **Search:** press `/` or `Ctrl K` anywhere. Searches titles, subjects, notes, checklists and links, including finished work.
- **Settings:** account, sync, ManageBac, notifications, appearance (light, dark or match device; density; start page; week start), personal (name, subject colours and renaming, study goals, planner capacity), points and level names, data and backup, privacy.
- **Works offline** and installs to a phone's home screen. Keyboard shortcuts: `N` new homework, `/` search, `1`–`5` switch screens, `?` list.

## Your data is safe

- Nothing is deleted silently. Deleting, archiving, and ManageBac cancellations only move homework to the archive. Finished homework keeps its points even if you delete it.
- **Undo** for finishing, reopening, deleting, archiving, imports, planning and restores.
- Points, streaks and achievements are **calculated from your history** every time, so they can't drift out of step. Points are fixed at the moment you finish something; reopening takes them back exactly.
- **Backups** hold everything (all homework including finished, archived and deleted, focus sessions, settings). Restore can add to your list (keeping newer changes) or replace it (setting aside, not erasing, anything not in the backup).
- If the browser's storage is full or blocked, or saved data can't be read, Due Board says so and keeps the unreadable copy aside instead of overwriting it.
- Data from the first version of Due Board is upgraded automatically with the same points total, and the original is kept as a safety copy.
- **Sync** works item by item: two devices editing different homework never overwrite each other; when both edit the same one, the newer change wins. An older copy is never allowed to replace a newer one (checked by the database, not just the app). Offline changes are sent when you're back online, and signing out warns you if anything hasn't been sent yet.

## ManageBac

ManageBac's API needs a school administrator, so Due Board uses the calendar link every student has (My Workspace → View Full Calendar → Subscribe to Calendar). Keep that link private.

- **Import a file:** open the link in a browser tab to download the `.ics` file, then drop it into Settings → ManageBac.
- **Auto-sync:** a page can't read another site's calendar directly, so Due Board fetches it through a tiny free relay in *your own* Google account (Google Apps Script). Settings → ManageBac shows the code and the steps; then Due Board syncs when it opens and every 15 minutes.

Each sync is reconciled, not just added: new assignments are added, changed ones are updated, items you already added by hand are linked rather than duplicated, and anything you edited yourself (title, date, subject, notes) is kept. Assignments cancelled or removed in ManageBac move to Archive → Removed (they come back if they reappear). Finished homework is never changed. Lessons and other repeating events are skipped; add "skip words" to leave out things like assemblies.

## Publishing (free)

The site is the `docs/` folder.

- **Vercel:** the included `vercel.json` makes it a static site (no framework, no install or build, output folder `docs`). Import the repository in Vercel and deploy. If Vercel still shows a Python or build error, open Project Settings → Build & Development Settings, choose Framework Preset **Other** and Output Directory **docs**, then redeploy the latest commit.
- **GitHub Pages:** repository Settings → Pages → Deploy from a branch → this branch and the `/docs` folder.

### Accounts (Supabase)

`docs/config.js` points at the Supabase project and its publishable key. Both are public by design: the database rules make sure each person can only read and change their own data. To run without accounts, set both values to `""`.

The database setup is in `supabase/migrations/` (already applied to the project): one `items` table with row-level security, `push_items()` (only ever writes newer copies) and `delete_my_account()`.

**One-time settings in the Supabase dashboard** (these can't be set from code):

1. **Authentication → URL Configuration:** set **Site URL** to your website address (for example `https://your-site.vercel.app`), and add the same address followed by `/**` under **Redirect URLs**. Without this, the links in confirmation and password-reset emails go to the wrong place.
2. **Authentication → Emails:** Supabase's built-in email sender only sends a few emails per hour and is meant for testing. For a real class or school, add your own SMTP sender (Authentication → Emails → SMTP Settings), or turn off "Confirm email" under Authentication → Sign In / Providers if you're happy for accounts to work without email confirmation.
3. Optional: **Authentication → Sign In / Providers → Google** to show a "Continue with Google" button (it appears automatically once enabled).

Account features: create an account (with email confirmation), sign in, email a sign-in link, forgot password, change name, email and password, sign out (warns about unsent changes) and delete account (password required; removes everything).

## Download version

`node tools/build-standalone.js` writes `dist/Due-Board.html`, the whole app in one file that opens from disk. Accounts work in it when online; email links lead to the website.

## Code

```
docs/
  index.html          page shell (loads the scripts below in order)
  config.js           Supabase project address and publishable key
  css/app.css         design tokens (light and dark), layout (phone, tablet, desktop) and components
  js/core.js          pure logic: dates, calendar files, ManageBac reconciliation, points, streaks,
                      achievements, repeating homework, planning, search, exports
  js/store.js         saving and loading, upgrades from older versions, undo, sync merging, backups
  js/account.js       Supabase sign-in and the sync engine
  js/ui.js            DOM helpers, icons and shared components (task rows, charts, sheets, menus, toasts)
  js/app.js           start-up, navigation, layout, reminders, ManageBac auto-sync, shortcuts
  js/editor.js        add and edit homework
  js/search.js        search palette
  js/pages/*.js       Home, Calendar, Planner, Progress, Focus, Settings, Archive, sign-in
  sw.js               offline support
  vendor/supabase.js  Supabase client (v2.118.0)
supabase/migrations/  database setup
tests/                unit tests and browser tests
tools/                single-file build
```

## Tests

```
node --test tests/                      # 36 unit tests: calendar parsing and reconciliation, points, streaks, recurrence, planning, store, upgrades, sync merging, backups
cd tests && npm install                 # test-only packages (pg, axe-core); Playwright is also needed
node tests/e2e/guest.e2e.js             # 20 browser checks without an account, incl. layouts at 3 sizes, both themes and axe accessibility
node tests/e2e/fake-supabase.js &       # local stand-in for Supabase Auth + REST, running the real SQL on a local Postgres
node tests/e2e/accounts.e2e.js          # 16 browser checks: sign-up, confirmation, two devices, conflicts, offline, errors, password reset, sign-in links, moving guest data, delete account
```

The account tests use `tests/e2e/supabase-stub.sql` plus the migration on a local PostgreSQL (port 54329, database `dueboard`). Supabase Realtime isn't emulated; the app falls back to checking every minute and when the page regains focus.

## Limits

- Reminders appear while Due Board is open (browsers can't wake a closed web page). For alerts when it's closed, export to Google Calendar (Settings → ManageBac → download `.ics`, with reminders built in).
- ManageBac repeating events are skipped (they are usually lessons).
- The focus timer runs on the device where you started it.
