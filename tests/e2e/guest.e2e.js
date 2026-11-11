// Browser tests without an account: homework, points, undo, calendar, planner, ManageBac import,
// backups, storage problems, upgrading old data, focus timer recovery, search, layouts and accessibility.
// Run: node tests/e2e/guest.e2e.js [outputDir]
const assert = require("assert"), path = require("path"), os = require("os"), fs = require("fs");
const H = require("./helpers");
const OUT = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), "dueboard-e2e-"));
const PORT = 8121, BASE = `http://localhost:${PORT}/`;
const T0 = new Date(2026, 10, 4, 10, 0).getTime();   // Wednesday 4 November 2026, 10:00
const DAY = 864e5;

(async () => {
  const site = H.makeSite(path.join(OUT, "site-guest"), {});
  const srv = await H.serve(site, PORT);
  const browser = await H.chromium.launch({ args: ["--no-sandbox"] });
  const { errors, ok, page } = H.harness(browser);
  try {
    // ---------- first run ----------
    let { ctx, p } = await page();
    await p.clock.install({ time: T0 });
    await p.goto(BASE);
    await H.until(p, () => location.hash === "#/home" && document.querySelector(".hero"));
    assert.match(await H.text(p, ".hero"), /Welcome to Due Board/);
    assert.match(await H.text(p, ".sidebar"), /Guest/);
    ok("without accounts configured, the app opens straight on Home; the empty state explains what to do");

    // ---------- add, validate, edit ----------
    await p.keyboard.press("n"); await p.waitForSelector("#e-title");
    await p.click("#e-save");
    assert.match(await H.text(p, "#editor"), /Give it a title/);
    await p.keyboard.press("Escape"); await p.waitForSelector("#editor", { state: "detached" });
    await H.addTask(p, { title: "Physics lab report", subject: "Physics SL", date: H.ymd(T0 + 3 * DAY), time: "09:00", priority: "High", est: 90, steps: ["Method", "Results", "Conclusion"] });
    await H.addTask(p, { title: "Maths sheet 4", subject: "Maths AA", date: H.ymd(T0), time: "18:00", est: 30 });
    await H.addTask(p, { title: "Overdue reading", subject: "English A", date: H.ymd(T0 - DAY), time: "09:00" });
    await H.addTask(p, { title: "Vocab quiz", subject: "Spanish B", date: H.ymd(T0 + DAY), time: "08:00", recur: "weekly" });
    await H.dismissToasts(p);
    const home = await H.text(p, "main");
    assert.match(home, /1 overdue · 1 due today/);
    assert.ok(home.indexOf("Overdue reading") < home.indexOf("Maths sheet 4"), "overdue first");
    assert.match(await H.text(p, H.rowOf("Physics lab report")), /0\/3/);
    assert.match(await H.text(p, H.rowOf("Physics lab report")), /1 h 30 min/);
    assert.match(await H.text(p, ".hero"), /Overdue reading/);
    ok("homework added with subject, due time, priority, estimate, checklist and repeat; Home groups it (overdue, today, week) and shows the next deadline");
    await p.click(H.rowOf("Physics lab report") + " .t-main"); await p.waitForSelector("#e-title");
    await p.fill("#e-title", "Physics lab report v2");
    await p.keyboard.press("Escape");
    await H.until(p, () => document.querySelector("#confirm"));
    assert.match(await H.text(p, "#confirm"), /Discard changes\?/);
    await p.click("#confirm .btn:has-text('Keep editing')");
    await p.click("#e-save"); await p.waitForSelector("#editor", { state: "detached" });
    assert.ok(await p.isVisible(H.rowOf("Physics lab report v2")));
    ok("closing the editor with unsaved changes asks first; saving an edit works");

    // ---------- complete, undo, points, recurrence ----------
    await H.dismissToasts(p);
    await p.click(H.rowOf("Physics lab report v2") + " .cbx");
    await H.until(p, () => /\+15 points · Finished early/.test(document.querySelector(".toasts").textContent));
    assert.match(await H.text(p, ".toasts"), /\+5 daily bonus/);
    let pts = await p.evaluate(() => DB.app.store.stats().points);
    assert.strictEqual(pts, 20);
    await p.click(".toast:has-text('Finished early') button.undo");
    await H.until(p, () => DB.app.store.stats().points === 0);
    assert.ok(await p.isVisible(H.rowOf("Physics lab report v2")));
    ok("finishing early gives +15 and the daily +5 bonus; Undo takes the points back and returns the homework to the list");
    await H.dismissToasts(p);
    await p.click(H.rowOf("Overdue reading") + " .cbx"); await p.waitForTimeout(400);
    await p.click(H.rowOf("Maths sheet 4") + " .cbx"); await p.waitForTimeout(400);
    pts = await p.evaluate(() => DB.app.store.stats().points);
    assert.strictEqual(pts, 5 + 5 + 10, "late 5 + bonus 5 + on time 10");
    await p.click(H.rowOf("Vocab quiz") + " .cbx"); await p.waitForTimeout(400);
    assert.match(await H.text(p, ".toasts"), /Next one added for Thu, 12 Nov/);
    assert.ok(await p.evaluate(() => DB.app.store.activeTasks().some((t) => t.title === "Vocab quiz" && !t.done && new Date(t.due).getDate() === 12)));
    ok("late and on-time points are right, one bonus per day; finishing weekly homework adds next week's copy");
    await H.dismissToasts(p);

    // ---------- delete, archive, restore ----------
    await p.click(H.rowOf("Physics lab report v2") + " .t-side button[aria-label^='More']");
    await p.click(".menu button:has-text('Delete')");
    assert.ok(!(await p.isVisible(H.rowOf("Physics lab report v2"))));
    await p.click(".toast button.undo");
    await H.until(p, () => [...document.querySelectorAll(".t-title")].some((n) => n.textContent === "Physics lab report v2"));
    await p.click(H.rowOf("Physics lab report v2") + " .t-side button[aria-label^='More']");
    await p.click(".menu button:has-text('Delete')");
    await p.goto(BASE + "#/archive/deleted");
    await p.waitForSelector(H.rowOf("Physics lab report v2"));
    await p.click(H.rowOf("Physics lab report v2") + " .btn:has-text('Restore')");
    await p.goto(BASE + "#/archive/completed");
    await p.waitForSelector(H.rowOf("Maths sheet 4"));
    ok("delete has Undo and goes to Archive → Deleted, where it can be restored; finished work is listed under Completed");

    // ---------- calendar ----------
    await H.dismissToasts(p);
    await p.goto(BASE + "#/calendar");
    await p.waitForSelector(".cal-toolbar");
    assert.match(await H.text(p, ".cal-toolbar .month"), /November 2026/);
    const sat = await p.getAttribute('.day[data-key="2026-11-07"]', "aria-label");
    assert.match(await p.getAttribute('.day[data-key="2026-11-04"]', "aria-label"), /Wednesday, 4 November: 0 due, 1 done/);
    await p.click('.day[data-key="2026-11-07"]');
    assert.match(await H.text(p, ".aside"), /Saturday, 7 November/);
    assert.match(await H.text(p, ".aside"), /Physics lab report v2/);
    await p.fill("#cal-quick", "Poster for history"); await p.press("#cal-quick", "Enter");
    await H.until(p, () => /Poster for history/.test(document.querySelector(".aside").textContent));
    await p.focus('.day[data-key="2026-11-07"]'); await p.keyboard.press("ArrowRight");
    await H.until(p, () => /Sunday, 8 November/.test(document.querySelector(".aside").textContent));
    await p.click("button[aria-label='Next month']");
    assert.match(await H.text(p, ".cal-toolbar .month"), /December 2026/);
    await p.click(".cal-toolbar .btn:has-text('Today')");
    await p.click(".cal-toolbar .seg button:has-text('Week')");
    assert.strictEqual(await p.$$eval(".week-col", (n) => n.length), 7);
    assert.match(await H.text(p, ".week-cols"), /Poster for history/);
    assert.ok(sat);
    ok("calendar: counts per day, selected-day agenda, quick add, arrow-key navigation, next month, today and week view");

    // ---------- planner ----------
    await p.goto(BASE + "#/planner");
    await p.waitForSelector(".plan-tray");
    const trayBefore = await p.$$eval(".plan-tray .plan-item", (n) => n.length);
    await p.click(".page-head .btn:has-text('Plan it for me')");
    await H.until(p, () => document.querySelectorAll(".plan-day .plan-item").length > 0);
    const late = await p.$$eval(".plan-day .plan-item.late", (n) => n.length);
    assert.strictEqual(late, 0, "nothing planned after it is due");
    assert.ok(trayBefore > 0);
    await p.click(".toast button.undo");
    await H.until(p, (n) => document.querySelectorAll(".plan-tray .plan-item").length === n, trayBefore);
    ok("weekly planner: 'Plan it for me' spreads homework before each due date; Undo reverses it");

    // ---------- ManageBac import and reconciliation ----------
    const ev = (uid, title, date, extra) => "BEGIN:VEVENT\r\nUID:" + uid + "\r\nSUMMARY:" + title + "\r\nDTSTART:" + date + "\r\n" + (extra || "") + "END:VEVENT\r\n";
    const feed1 = "BEGIN:VCALENDAR\r\n" + ev("mb1", "[Chemistry HL] Titration write-up", "20261110T080000Z") + ev("mb2", "[History] Source analysis", "20261112T080000Z") + ev("mb3", "Assembly", "20261106T080000Z") + ev("mb4", "[Maths AA] Maths sheet 4", "20261104T160000Z") + "END:VCALENDAR\r\n";
    await p.goto(BASE + "#/settings/managebac");
    await p.fill("#mb-ignore", "assembly"); await p.click(".set-card .btn:has-text('Save words')");
    await p.fill("#mb-paste", feed1); await p.click("#mb-import");
    await H.until(p, () => /added/.test(document.querySelector("#import-msg").textContent));
    const msg1 = await H.text(p, "#import-msg");
    assert.match(msg1, /2 added/); assert.match(msg1, /1 matched to homework you'd already added/); assert.match(msg1, /1 matched your skip words/);
    await p.fill("#mb-paste", feed1); await p.click("#mb-import");
    await H.until(p, () => /0 added, 0 updated/.test(document.querySelector("#import-msg").textContent));
    ok("ManageBac import: adds new items, skips words, links to homework already added by hand, and re-importing creates no duplicates");
    // the student edits one; the feed then changes, cancels one and drops another
    await p.goto(BASE + "#/home");
    await p.click(H.rowOf("Titration write-up") + " .t-main"); await p.waitForSelector("#e-title");
    await p.fill("#e-title", "Titration write-up (with graphs)"); await p.click("#e-save");
    const feed2 = "BEGIN:VCALENDAR\r\n" + ev("mb1", "[Chemistry HL] Titration report", "20261111T080000Z") + ev("mb2", "[History] Source analysis", "20261112T080000Z", "STATUS:CANCELLED\r\n") + "END:VCALENDAR\r\n";
    await p.goto(BASE + "#/settings/managebac");
    await p.setInputFiles("#mb-file", { name: "calendar.ics", mimeType: "text/calendar", buffer: Buffer.from(feed2) });
    await H.until(p, () => /no longer in ManageBac/.test(document.querySelector("#import-msg").textContent));
    const st = await p.evaluate(() => { const S = DB.app.store, t = S.tasks().find((x) => x.feedKey === "mb1"); return { title: t.title, day: new Date(t.due).getUTCDate(), mbTitle: t.mb.title, hist: S.tasks().find((x) => x.feedKey === "mb2").cancelled > 0, maths: S.tasks().find((x) => x.title === "Maths sheet 4").removed }; });
    assert.strictEqual(st.title, "Titration write-up (with graphs)"); assert.strictEqual(st.day, 11); assert.strictEqual(st.mbTitle, "Titration report");
    assert.ok(st.hist, "cancelled event is set aside"); assert.ok(!st.maths, "finished homework is never touched");
    await p.goto(BASE + "#/archive/removed");
    await p.waitForSelector(H.rowOf("Source analysis"));
    await p.goto(BASE + "#/home");
    await p.click(H.rowOf("Titration write-up (with graphs)") + " .t-main"); await p.waitForSelector("#e-title");
    assert.match(await H.text(p, ".mb-note"), /You changed title/); assert.match(await H.text(p, ".mb-note"), /Titration report/);
    await p.click(".mb-note .btn:has-text(\"Use ManageBac's version\")");
    await H.until(p, () => [...document.querySelectorAll(".t-title")].some((n) => n.textContent === "Titration report"));
    ok("ManageBac sync keeps the student's own edits, follows the new date, sets cancelled items aside in the archive, leaves finished work alone; 'Use ManageBac's version' resets");

    // ---------- backup and restore ----------
    await H.dismissToasts(p);
    await p.goto(BASE + "#/settings/data");
    const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#backup-go")]);
    const backupPath = path.join(OUT, "backup.json"); await dl.saveAs(backupPath);
    const backup = JSON.parse(fs.readFileSync(backupPath, "utf8"));
    assert.strictEqual(backup.format, 4);
    assert.ok(Object.values(backup.data.tasks).some((t) => t.title === "Maths sheet 4" && t.done), "finished homework is in the backup");
    assert.ok(Object.values(backup.data.tasks).some((t) => t.deleted || t.cancelled), "deleted and cancelled homework is in the backup too");
    const pointsBefore = await p.evaluate(() => DB.app.store.stats().points);
    await p.evaluate(() => { const S = DB.app.store; S.tasks().forEach((t) => S.remove(t.id)); });
    await p.click(".set-card .seg button:has-text('Replace my list')");
    await p.setInputFiles("#restore-file", backupPath);
    await H.until(p, () => /Restored/.test(document.querySelector("#backup-msg").textContent));
    assert.ok(await p.evaluate(() => DB.app.store.activeTasks().some((t) => t.title === "Titration report")));
    assert.strictEqual(await p.evaluate(() => DB.app.store.stats().points), pointsBefore);
    await p.setInputFiles("#restore-file", { name: "x.json", mimeType: "application/json", buffer: Buffer.from('{"hello":1}') });
    await H.until(p, () => /isn't a Due Board backup/.test(document.querySelector("#backup-msg").textContent));
    ok("full backup includes finished, deleted and cancelled homework; restoring it brings everything back with the same points; other files are refused");

    // ---------- reload keeps everything ----------
    const count = await p.evaluate(() => DB.app.store.tasks().length);
    await p.reload(); await H.until(p, () => window.DB && DB.app && DB.app.store);
    assert.strictEqual(await p.evaluate(() => DB.app.store.tasks().length), count);
    ok("everything is still there after a reload");

    // ---------- search ----------
    await p.goto(BASE + "#/home"); await p.waitForSelector(".hero");
    await p.keyboard.press("/");
    await p.waitForSelector("#search-q");
    await p.fill("#search-q", "conclusion");
    await H.until(p, () => /Physics lab report v2/.test(document.querySelector("#search-results").textContent));
    await p.fill("#search-q", "maths");
    await p.click("#search-dlg .chip:has-text('Everything')");
    await H.until(p, () => /Finished/.test(document.querySelector("#search-results").textContent));
    await p.keyboard.press("Enter");
    await p.waitForSelector("#e-title");
    assert.strictEqual(await p.inputValue("#e-title"), "Maths sheet 4");
    await p.keyboard.press("Escape");
    ok("search (press /) finds homework by checklist text, includes finished work, and Enter opens it");

    // ---------- progress ----------
    await p.goto(BASE + "#/progress"); await p.waitForSelector(".ach-grid");
    const prog = await H.text(p, "main");
    assert.match(prog, /First step/); assert.match(prog, /1 of 14 earned|2 of 14 earned|3 of 14 earned/);
    assert.match(prog, /Subjects/); assert.match(prog, /History/);
    ok("Progress shows points, level, streaks, charts, subjects table, activity map, achievements and history");

    // ---------- focus timer ----------
    await p.goto(BASE + "#/home"); await p.waitForSelector(".hero");
    await p.click(H.rowOf("Physics lab report v2") + " button[aria-label^='Focus on']");
    await p.waitForSelector("#fc-start");
    assert.strictEqual(await p.inputValue("#fc-task"), await p.evaluate(() => DB.app.store.tasks().find((t) => t.title === "Physics lab report v2").id));
    await p.click(".preset[data-m='60']");
    await p.fill("#fc-note", "Write the method");
    await p.click("#fc-start");
    assert.strictEqual(await H.text(p, "#fc-time"), "60:00");
    await p.clock.runFor(10 * 60000);
    assert.match(await H.text(p, "#fc-time"), /^(50:00|49:59)$/);
    await p.click("#fc-pause"); await p.clock.runFor(5 * 60000);
    assert.match(await H.text(p, "#fc-time"), /^(50:00|49:59)$/);
    await p.click("#fc-pause");
    await p.goto(BASE + "#/calendar"); await p.waitForSelector("#focus-banner");
    await p.reload(); await p.waitForSelector("#focus-banner");
    ok("focus: start from homework with a 60-minute preset and a note; pause stops the clock; the session survives leaving the page and reloading");
    await p.clock.runFor(55 * 60000);
    await H.until(p, () => /Did you make progress/.test((document.querySelector("#focus-banner") || {}).textContent || ""));
    await p.click("#focus-banner");
    await p.waitForSelector("#fc-recorded");
    assert.match(await H.text(p, "#fc-recorded"), /1 h recorded for Physics SL/);
    await p.click("#fc-some");
    await p.click("#fc-left-box .subtask:has-text('Method') .cbx");
    await p.fill("#fc-left", "Results and conclusion"); await p.click("#fc-left-save");
    await H.until(p, () => document.querySelector("#fc-result"));
    const t = await p.evaluate(() => DB.app.store.tasks().find((x) => x.title === "Physics lab report v2"));
    assert.strictEqual(t.remaining, "Results and conclusion"); assert.ok(t.subtasks.find((s) => s.text === "Method").done);
    assert.deepStrictEqual(await p.evaluate(() => DB.app.store.sessions().map((s) => [s.mins, s.subject, s.result])), [[60, "Physics SL", "left"]]);
    await p.click("#fc-back");
    ok("when the timer ends (here while on another page) it asks 'Did you make progress?'; 60 min (pauses excluded) are recorded for the subject; ticking steps and noting what's left saves to the homework");
    // pomodoro with breaks, and recovery after the app was closed through the end of a block
    await p.goto(BASE + "#/focus"); await p.waitForSelector("#fc-start");
    await p.selectOption("#fc-task", await p.$eval("#fc-task", (s) => [...s.options].find((o) => /Titration report/.test(o.textContent)).value));
    await p.click(".preset:has-text('Custom')"); await p.fill("#fc-custom", "20");
    await p.click("#fc-pomo"); await p.selectOption("#fc-cycles", "2");
    await p.click("#fc-start");
    assert.strictEqual(await H.text(p, "#fc-time"), "20:00"); assert.match(await H.text(p, "#fc-phase"), /Focus · 1 of 2/);
    const p2ctx = ctx, closedAt = await p.evaluate(() => Date.now());
    await p.close();
    // "reopen the app" 30 minutes later: the block ended while closed and is recorded at its real end time
    p = await p2ctx.newPage();
    p.on("pageerror", (e) => errors.push("pageerror: " + e.message));
    await p.clock.install({ time: closedAt + 30 * 60000 });
    await p.goto(BASE + "#/focus");
    await p.waitForSelector("#fc-recorded");
    const sess = await p.evaluate(() => DB.app.store.sessions().find((s) => s.mins === 20));
    assert.ok(sess, "the 20-minute block was recorded");
    assert.ok(Math.abs(sess.end - (closedAt + 20 * 60000)) < 5000, "recorded at the moment the block ended, not when the app reopened");
    await p.click("#fc-skip");
    await p.waitForSelector("#fc-break");
    await p.click("#fc-break");
    assert.match(await H.text(p, "#fc-phase"), /Long break|Short break/);
    await p.click("#fc-skip-break");
    await p.waitForSelector("#fc-next");
    await p.click("#fc-next");
    assert.match(await H.text(p, "#fc-phase"), /Focus · 2 of 2/);
    await p.click("#fc-discard");
    await p.click("#confirm-ok");
    await H.until(p, () => location.hash === "#/home");
    ok("custom length and Pomodoro cycles; a block that ended while the app was closed is recorded on reopening; breaks, skip break, next block and cancel work");

    // ---------- layouts, theme and accessibility ----------
    const axeSrc = fs.readFileSync(require.resolve("axe-core/axe.min.js", { paths: [process.env.AXE_DIR || path.join(__dirname, "../..")] }), "utf8");
    const problems = [];
    for (const [w, h, name] of [[390, 844, "phone"], [820, 1180, "tablet"], [1440, 900, "desktop"]]) {
      await p.setViewportSize({ width: w, height: h });
      for (const theme of ["dark", "light"]) {
        await p.evaluate((th) => DB.app.store.setSettings({ theme: th }), theme);
        for (const pg of ["home", "calendar", "planner", "progress", "focus", "settings/account", "archive"]) {
          await p.goto(BASE + "#/" + pg); await p.waitForTimeout(250); await H.dismissToasts(p);
          const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          if (over > 0) problems.push(`${name}/${theme}/${pg}: ${over}px sideways scroll`);
          if (theme === "dark" || name === "desktop") await p.screenshot({ path: path.join(OUT, `${pg.replace("/", "-")}-${name}-${theme}.png`), fullPage: false });
          if (name !== "tablet") {
            await p.addScriptTag({ content: axeSrc });
            const res = await p.evaluate(async () => (await axe.run(document, { resultTypes: ["violations"] })).violations.filter((v) => v.impact === "critical" || v.impact === "serious").map((v) => v.id + " (" + v.nodes.length + "): " + v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(", ")));
            res.forEach((r) => problems.push(`${name}/${theme}/${pg} axe: ${r}`));
          }
        }
      }
    }
    if (problems.length) console.log(problems.join("\n"));
    assert.strictEqual(problems.length, 0, "layout/accessibility problems");
    ok("phone, tablet and desktop in dark and light themes: no sideways scrolling and no serious accessibility problems (axe)");
    await ctx.close();

    // ---------- upgrading data from the first version ----------
    ({ ctx, p } = await page());
    await p.clock.install({ time: T0 });
    await p.goto(BASE + "#/home");
    const old = { v: 3, rev: 9, points: 300, stats: { done: 25, best: 9 }, profile: { name: "Alex" }, settings: { leads: [24, 3] },
      tasks: { i1: { id: "i1", title: "Old import", subject: "Biology", due: T0 + DAY, done: false, src: "managebac", remind: true } },
      log: [{ k: "t", at: T0 - 50 * DAY, pts: 15, task: "gone", title: "Long-cleared task", subject: "Biology", how: "early" }] };
    await p.evaluate((o) => { localStorage.clear(); localStorage.setItem("dueboard:v1", JSON.stringify(o)); }, old);
    await p.reload(); await p.waitForSelector(".hero");
    assert.strictEqual(await p.evaluate(() => DB.app.store.stats().points), 300);
    assert.match(await H.text(p, ".page-head"), /, Alex/);
    assert.ok(await p.evaluate(() => !!localStorage.getItem("dueboard:v1:before-upgrade") && !localStorage.getItem("dueboard:v1")));
    ok("data from the first version upgrades in place: same points, name and homework; the original is kept as a safety copy");

    // ---------- storage problems ----------
    await p.close(); p = await ctx.newPage(); p.on("pageerror", (e) => errors.push("pageerror: " + e.message));
    await p.goto(BASE + "icon.svg");
    await p.evaluate(() => { localStorage.setItem("dueboard:v4:guest", "{not json"); });
    await p.goto(BASE + "#/home"); await p.waitForSelector(".banner");
    assert.match(await H.text(p, "main"), /Some saved data couldn't be read/);
    assert.ok(await p.evaluate(() => Object.keys(localStorage).some((k) => /unreadable/.test(k))));
    await p.evaluate(() => { Storage.prototype.setItem = function () { const e = new Error("full"); e.name = "QuotaExceededError"; throw e; }; });
    await H.addTask(p, { title: "Saved in memory", date: H.ymd(T0 + DAY), time: "10:00" });
    await H.until(p, () => /storage is full/.test(document.querySelector("main").textContent));
    assert.ok(await p.isVisible(H.rowOf("Saved in memory")));
    ok("unreadable saved data is kept aside with a clear message; a full storage shows a warning with a backup button and nothing is lost from the screen");
    await ctx.close();

    // ---------- reminder pop-ups ----------
    ({ ctx, p } = await page());
    await p.clock.install({ time: T0 });
    await p.goto(BASE + "#/settings/notifications"); await p.waitForSelector("#set-leads-custom");
    assert.strictEqual(await p.getAttribute("[aria-label='Default reminder times'] .chip:text-is('30 min')", "aria-pressed"), "true");
    await p.click("#set-leads-custom"); await p.fill("#set-leads-n", "45"); await p.selectOption("#set-leads-u", "min"); await p.click("#set-leads-add");
    await H.until(p, () => DB.app.store.settings().leads.indexOf(0.75) !== -1);
    assert.strictEqual(await p.getAttribute("[aria-label='Default reminder times'] .chip:text-is('45 min')", "aria-pressed"), "true");
    await p.click("#set-rem-test");
    await p.waitForSelector(".reminder:has-text('Example reminder')");
    await p.screenshot({ path: path.join(OUT, "reminder-test.png") });
    await p.click(".reminder button[aria-label='Dismiss reminder']");
    await H.until(p, () => !document.querySelector(".reminder"));
    ok("Settings: reminder times include minutes; a custom time (45 minutes) can be added; 'Show a test reminder' pops one up");
    await p.goto(BASE + "#/home"); await p.waitForSelector(".hero");
    await p.keyboard.press("n"); await p.waitForSelector("#e-title");
    await p.fill("#e-title", "Chemistry quiz prep"); await p.fill("#e-date", H.ymd(T0)); await p.fill("#e-time", "12:00");
    await p.click("#editor summary");
    for (const c of ["1 day", "3 h", "45 min"]) await p.click(`#editor [aria-label='Reminder times for this homework'] .chip:text-is('${c}')`);   // keep only 30 min for this homework
    await p.click("#e-save"); await p.waitForSelector("#editor", { state: "detached" });
    assert.deepStrictEqual(await p.evaluate(() => DB.app.store.tasks().find((t) => t.title === "Chemistry quiz prep").reminders), [0.5]);
    await H.dismissToasts(p);
    await p.clock.runFor(85 * 60000);   // 11:25, due in 35 minutes
    assert.strictEqual(await p.$$eval(".reminder", (n) => n.length), 0, "nothing before its time");
    await p.clock.runFor(6 * 60000);    // 11:31
    await p.waitForSelector(".reminder:has-text('Chemistry quiz prep')");
    assert.match(await H.text(p, ".reminder"), /Due in 2\d min/);
    await p.screenshot({ path: path.join(OUT, "reminder-30min.png") });
    await p.click(".reminder button:has-text('Snooze 10 min')");
    await H.until(p, () => !document.querySelector(".reminder"));
    await p.clock.runFor(5 * 60000);
    assert.strictEqual(await p.$$eval(".reminder", (n) => n.length), 0, "snoozed");
    await p.clock.runFor(6 * 60000);
    await p.waitForSelector(".reminder:has-text('Chemistry quiz prep')");
    await p.click(".reminder button:has-text('Mark done')");
    await H.until(p, () => DB.app.store.tasks().find((t) => t.title === "Chemistry quiz prep").done);
    ok("a 30-minute reminder pops up 30 minutes before the deadline (not earlier), stays until acted on, snoozes for 10 minutes, and 'Mark done' finishes the homework");
    await ctx.close();

    console.log(errors.length ? "\nPAGE ERRORS:\n" + errors.join("\n") : "\nno page errors");
    if (errors.length) process.exitCode = 1;
  } catch (e) {
    console.log("FAIL:", e && e.stack || e);
    process.exitCode = 1;
  } finally {
    await browser.close(); srv.kill();
    console.log("screenshots and files: " + OUT);
  }
})();
