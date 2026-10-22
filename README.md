# Due Board

A free homework tracker for ManageBac students: deadlines on a Home screen, a Calendar, and a Progress page with points, levels and streaks. It is a static website with no server and no database. Each visitor's homework is stored only in their own browser.

The whole app is one file: [`docs/index.html`](docs/index.html). There is no build step and no backend code.

## Publish it (free, GitHub Pages)

Repository **Settings → Pages → Build and deployment → Source: Deploy from a branch**, choose this repository's branch and the **/docs** folder, then **Save**. The address appears at the top of that page (normally `https://<owner>.github.io/<repository>/`).

### Publishing on Vercel instead

This repository includes `vercel.json`, which tells Vercel it is a static site: no framework, no install or build step, and the `docs/` folder is the output. If Vercel still reports a Python error, check Project Settings → Build & Development Settings (Framework Preset: Other, Output Directory: `docs`), and redeploy the **latest** commit rather than an old failed deployment.

## What it does

- **Home:** the next deadline with a live countdown, Mark done, level and streak, and what is coming up.
- **Calendar:** month and week views, tap a day to see its homework, add to Google Calendar.
- **Progress:** level ring, points, tasks per day, a 12-week activity map, progress by subject, points history.
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

Nothing is sent to a server. Homework, points and settings live in the browser's local storage on the device. The only outside requests are the fonts and, if you turn it on, the auto-sync relay you created yourself.
