# Due Board

A free homework tracker for ManageBac students: deadlines on a Home screen, a Calendar, a Progress page with points, levels and streaks, and Focus sessions attached to each piece of homework. It is a static website with no server code of its own.

The app is [`docs/index.html`](docs/index.html) plus a few small files next to it. There is no build step.

Optional **user accounts** (sign in, settings, sign out, delete account) use Firebase's free plan. Without them the site still works, and each visitor's homework stays in their own browser.

## Publish it (free, GitHub Pages)

Repository **Settings → Pages → Build and deployment → Source: Deploy from a branch**, choose this repository's branch and the **/docs** folder, then **Save**. The address appears at the top of that page (normally `https://<owner>.github.io/<repository>/`).

### Publishing on Vercel instead

This repository includes `vercel.json`, which tells Vercel it is a static site: no framework, no install or build step, and the `docs/` folder is the output. If Vercel still reports a Python error, check Project Settings → Build & Development Settings (Framework Preset: Other, Output Directory: `docs`), and redeploy the **latest** commit rather than an old failed deployment.

## Turning on accounts (free, Firebase)

1. Go to <https://console.firebase.google.com>, **Add project** (Google Analytics is not needed). The free *Spark* plan is enough; no card is asked for.
2. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable → Save.**
3. **Build → Firestore Database → Create database** (production mode, any location). Open its **Rules** tab, replace everything with the contents of [`firestore.rules`](firestore.rules), and **Publish**.
4. **Authentication → Settings → Authorized domains → Add domain**: your site's address, for example `yourname.github.io` or `your-project.vercel.app`.
5. **Project settings (gear) → Your apps → Web (`</>`)**, register an app, and copy the `firebaseConfig` values into [`docs/firebase-config.js`](docs/firebase-config.js) in place of `null`:

   ```js
   window.DUEBOARD_FIREBASE = { apiKey: "...", authDomain: "...", projectId: "...", appId: "..." };
   ```

   These values are not secret: they only say which Firebase project to talk to. The rules in `firestore.rules` are what keep each person's data private (only the signed-in owner can read or change their own document).

Once that file is published, the site opens on a sign-in page. People can create an account, sign in on any device, or continue without an account. Homework added as a guest is offered to move into a new account.

## What it does

- **Home:** the next deadline with a live countdown, Mark done, level and streak, and what is coming up.
- **Calendar:** month and week views, tap a day to see its homework, add to Google Calendar.
- **Progress:** level ring, points, tasks per day, a 12-week activity map, progress by subject, points history.
- **Accounts:** sign in on phone and laptop and see the same homework, synced live; works offline and catches up later. Settings → Account: change name or password, sign out, delete the account and all its data.
- **Streaks:** current and best streak, on-time rate and total finished, saved with each account.
- **Focus Mode:** start a 25 or 45 minute session from any homework, with a short note of what you will work on, a pause button and "Session completed". The minutes studied are recorded against that subject (Progress → Focus time). When the timer ends it asks *Did you make progress?*: mark the homework complete, or write what's left (shown on the homework until it is done). The timer keeps going if you leave the page or close the app.
- **Points:** finish a day early, on time, or late for different points, plus a bonus for the first task each day. Point values and level names are editable in Settings.
- **Installable and offline:** add it to a phone's home screen; it opens without internet.
- **Backup:** Settings → Your data downloads or restores the homework list as a file.

## Connecting ManageBac

ManageBac's own API needs an administrator token, so students cannot use it. Due Board works from the **calendar subscription link** every student can copy (My Workspace → View Full Calendar → Subscribe to Calendar). The link is a private key to your calendar: keep it private.

Two ways to bring it in, both under Settings → ManageBac:

1. **Import a file.** Open the link in a browser tab to download the `.ics` file, then drop it into the app (or paste its text). Re-importing updates items instead of duplicating them.
2. **Auto-sync.** A browser page cannot read another site's calendar, so the app asks a tiny relay that runs in *your own* Google account (Google Apps Script, free). The code to paste is shown in Settings; the app fetches your deadlines when it opens and every 15 minutes while it is open.

Assumptions not yet checked against a real ManageBac feed: a task's due time is the event's start time, all-day items are due at 23:59, and lessons may appear in the feed (use "Skip these words" in Settings to hide them).

## Connecting Google Calendar

There is no Google sign-in. Instead: each task has an **Add to Google Calendar** link (opens Google Calendar with the due time filled in), Settings can download all upcoming homework as a file to import into Google Calendar, and you can also subscribe your ManageBac link directly in Google Calendar (Other calendars → From URL).

## Privacy

Without accounts, nothing is sent to a server: homework, points and settings live in the browser's local storage on the device. With accounts turned on, each person's homework, points, streaks, focus history and settings are stored in your Firebase project under their own user, readable only by them, and deleted when they delete their account. Other outside requests are the fonts and, if a student turns it on, the auto-sync relay they created themselves.
