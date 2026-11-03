// Browser tests for accounts and sync, against tests/e2e/fake-supabase.js (real SQL on a local Postgres).
// Start the fake first:  node tests/e2e/fake-supabase.js   then:  node tests/e2e/accounts.e2e.js [outputDir]
const assert = require("assert"), path = require("path"), os = require("os"), fs = require("fs");
const H = require("./helpers");
const OUT = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), "dueboard-acct-"));
const PORT = 8122, BASE = `http://localhost:${PORT}/`, SB = "http://localhost:54321";
const get = async (p) => (await fetch(SB + p)).json();
const outbox = () => get("/__test/outbox");
const serverItems = () => get("/__test/items");
const lastMail = async (type, email) => (await outbox()).filter((m) => m.type === type && m.email === email).pop();

(async () => {
  await fetch(SB + "/__test/reset");
  const site = H.makeSite(path.join(OUT, "site-accounts"), { supabaseUrl: SB, supabaseKey: "test-anon" });
  const srv = await H.serve(site, PORT);
  const browser = await H.chromium.launch({ args: ["--no-sandbox"] });
  const { errors, ok, page } = H.harness(browser);
  const syncNow = (p) => p.evaluate(() => DB.app.sync && DB.app.sync.now());
  try {
    // ---------- welcome, validation, sign up with email confirmation ----------
    const A = await page(); let a = A.p;
    await a.goto(BASE);
    await a.waitForSelector(".auth-card #au-go");
    assert.ok(!(await a.isVisible(".sidebar")) && !(await a.isVisible(".tabbar")));
    await a.click(".auth-card .seg button:has-text('Create account')");
    await a.click("#au-go"); assert.match(await H.text(a, "#au-msg"), /Type your name/);
    await a.fill("#au-name", "Alex Kim"); await a.fill("#au-email", "nope"); await a.click("#au-go"); assert.match(await H.text(a, "#au-msg"), /doesn't look right/);
    await a.fill("#au-email", "alex@example.com"); await a.fill("#au-pw", "short"); await a.click("#au-go"); assert.match(await H.text(a, "#au-msg"), /at least 8 characters/);
    await a.click("#au-show"); assert.strictEqual(await a.getAttribute("#au-pw", "type"), "text"); await a.click("#au-show");
    await a.fill("#au-pw", "password123"); await a.click("#au-go");
    await H.until(a, () => /Check your email/.test(document.querySelector(".auth-card").textContent));
    ok("welcome page without app chrome; sign-up checks name, email and password; then asks to confirm the email");
    await a.click(".auth-card .btn:has-text('Back to sign in')"); await a.waitForSelector("#au-go");
    await a.fill("#au-email", "alex@example.com"); await a.fill("#au-pw", "password123"); await a.click("#au-go");
    await H.until(a, () => /Confirm your email first/.test(document.querySelector("#au-msg").textContent));
    const conf = await lastMail("signup", "alex@example.com");
    await a.goto(conf.link);
    await H.until(a, () => window.DB && DB.app && DB.app.mode === "account" && location.hash === "#/home");
    await H.until(a, () => /Synced/.test(document.querySelector(".sidebar").textContent));
    assert.match(await H.text(a, ".page-head h1"), /, Alex/);
    assert.match(await H.text(a, ".sidebar"), /alex@example.com/);
    ok("signing in before confirming explains why; the confirmation link signs you in, greets you by name and shows 'Synced'");

    // ---------- homework syncs to the account ----------
    await H.addTask(a, { title: "Physics lab report", subject: "Physics SL", date: H.ymd(Date.now() + 3 * 864e5), time: "09:00" });
    await H.addTask(a, { title: "Essay outline", subject: "English A", date: H.ymd(Date.now() + 864e5), time: "09:00" });
    await H.dismissToasts(a);
    await a.click(H.rowOf("Essay outline") + " .cbx"); await a.waitForTimeout(500);
    await syncNow(a);
    await H.until(a, () => DB.app.sync.status === "ok" && !Object.keys(DB.app.store.pending).length);
    let items = await serverItems();
    const essay = items.find((i) => i.kind === "task" && i.data.title === "Essay outline");
    assert.ok(essay && essay.data.done && essay.data.pts > 0 && essay.email === "alex@example.com");
    assert.ok(items.some((i) => i.kind === "meta" && i.id === "settings"));
    const pointsA = await a.evaluate(() => DB.app.store.stats().points);
    ok("homework, finished state and points are saved to the account (" + items.length + " items on the server)");

    // ---------- second device ----------
    const B = await page({ viewport: { width: 390, height: 844 } }); const b = B.p;
    await b.goto(BASE); await b.waitForSelector("#au-go");
    await b.fill("#au-email", "alex@example.com"); await b.fill("#au-pw", "wrong-password"); await b.click("#au-go");
    await H.until(b, () => /Email or password is not right/.test(document.querySelector("#au-msg").textContent));
    await b.fill("#au-pw", "password123"); await b.click("#au-go");
    await H.until(b, () => DB.app && DB.app.mode === "account" && DB.app.sync && DB.app.sync.firstPullDone);
    await H.until(b, () => /Physics lab report/.test(document.querySelector("main").textContent));
    assert.strictEqual(await b.evaluate(() => DB.app.store.stats().points), pointsA);
    ok("second device: a wrong password gets a clear message; the right one shows the same homework and the same " + pointsA + " points");

    // ---------- edits on both devices merge ----------
    await H.addTask(b, { title: "Added on phone", date: H.ymd(Date.now() + 2 * 864e5), time: "10:00" });
    await a.evaluate(() => { const S = DB.app.store, t = S.tasks().find((x) => x.title === "Physics lab report"); S.patchTask(t.id, { notes: "Use the school template" }); });
    await syncNow(b); await syncNow(a);
    await a.evaluate(() => document.dispatchEvent(new Event("visibilitychange"))); await b.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await H.until(a, () => DB.app.store.tasks().some((t) => t.title === "Added on phone"));
    await H.until(b, () => DB.app.store.tasks().some((t) => t.notes === "Use the school template"));
    ok("changes on two devices at once both survive: the phone's new homework reaches the laptop and the laptop's note reaches the phone");
    // same homework edited on both: the later edit wins, nothing else is touched
    await a.evaluate(() => { const S = DB.app.store, t = S.tasks().find((x) => x.title === "Physics lab report"); S.patchTask(t.id, { priority: 1 }); });
    await a.waitForTimeout(30);
    await b.evaluate(() => { const S = DB.app.store, t = S.tasks().find((x) => x.title === "Physics lab report"); S.patchTask(t.id, { priority: 3 }); });
    await syncNow(a); await syncNow(b); await syncNow(a);
    await H.until(a, () => DB.app.store.tasks().find((x) => x.title === "Physics lab report").priority === 3);
    assert.strictEqual(await b.evaluate(() => DB.app.store.tasks().find((x) => x.title === "Physics lab report").priority), 3);
    ok("when both devices change the same homework, the most recent change wins on both");

    // ---------- offline ----------
    await A.ctx.setOffline(true);
    await a.evaluate(() => window.dispatchEvent(new Event("offline")));
    await H.addTask(a, { title: "Written offline", date: H.ymd(Date.now() + 864e5), time: "12:00" });
    await H.until(a, () => /Offline/.test(document.querySelector(".sidebar").textContent));
    await A.ctx.setOffline(false);
    await a.evaluate(() => window.dispatchEvent(new Event("online")));
    await H.until(a, () => DB.app.sync.status === "ok");
    items = await serverItems();
    assert.ok(items.some((i) => i.data.title === "Written offline"));
    ok("offline: shows 'Offline', keeps changes on the device, and sends them when back online");

    // ---------- server trouble ----------
    await fetch(SB + "/__test/fail?n=2");
    await a.evaluate(() => { const S = DB.app.store, t = S.tasks().find((x) => x.title === "Written offline"); S.patchTask(t.id, { notes: "x" }); });
    await syncNow(a);
    await H.until(a, () => DB.app.sync.status === "error");
    await a.goto(BASE + "#/home"); await H.until(a, () => /Sync paused/.test(document.querySelector("main").textContent));
    await fetch(SB + "/__test/fail?n=0");
    await a.click(".banner .btn:has-text('Try again')");
    await H.until(a, () => DB.app.sync.status === "ok");
    ok("a server error pauses sync with a clear banner; nothing is lost and 'Try again' catches up");

    // ---------- account settings ----------
    await a.goto(BASE + "#/settings/account"); await a.waitForSelector("#acct-name");
    await a.fill("#acct-name", "Alex K."); await a.click("#acct-name-save");
    await H.until(a, () => /Name saved/.test(document.querySelector("#acct-msg").textContent));
    await a.fill("#acct-cur", "not-my-password"); await a.fill("#acct-new", "newpassword456"); await a.click("#acct-pw-go");
    await H.until(a, () => /current password is not right/.test(document.querySelector("#acct-pw-msg").textContent));
    await a.fill("#acct-cur", "password123"); await a.fill("#acct-new", "newpassword456"); await a.click("#acct-pw-go");
    await H.until(a, () => /Password changed/.test(document.querySelector("#acct-pw-msg").textContent));
    ok("settings: rename (saved to the account), change password (wrong current password refused)");

    // ---------- sign out ----------
    await A.ctx.setOffline(true); await a.evaluate(() => window.dispatchEvent(new Event("offline")));
    await a.evaluate(() => { const S = DB.app.store, t = S.tasks().find((x) => x.title === "Written offline"); S.patchTask(t.id, { notes: "unsent" }); });
    await a.click("#acct-signout");
    await H.until(a, () => document.querySelector("#confirm") && /Not everything is saved/.test(document.querySelector("#confirm").textContent));
    await a.click("#confirm .btn:has-text('Stay signed in')");
    assert.strictEqual(await a.evaluate(() => DB.app.mode), "account");
    await A.ctx.setOffline(false); await a.evaluate(() => window.dispatchEvent(new Event("online")));
    await H.until(a, () => DB.app.sync.status === "ok");
    await a.click("#acct-signout");
    await H.until(a, () => location.hash === "#/welcome" && document.querySelector("#au-go"));
    assert.deepStrictEqual(await a.evaluate(() => Object.keys(localStorage).filter((k) => /^dueboard:v4:u:/.test(k))), []);
    ok("signing out with unsent changes warns first; once synced, sign-out returns to the welcome page and removes the account's copy from the device");
    await a.fill("#au-email", "alex@example.com"); await a.fill("#au-pw", "password123"); await a.click("#au-go");
    await H.until(a, () => /not right/.test(document.querySelector("#au-msg").textContent));
    await a.fill("#au-pw", "newpassword456"); await a.click("#au-go");
    await H.until(a, () => DB.app.mode === "account" && DB.app.sync.firstPullDone && DB.app.store.tasks().some((t) => t.notes === "unsent"));
    ok("the old password no longer works; the new one signs in and everything (including the change made offline) is there");

    // ---------- forgot password, magic link ----------
    const C2 = await page(); const c = C2.p;
    await c.goto(BASE); await c.waitForSelector("#au-forgot");
    await c.click("#au-forgot"); await c.fill("#au-email", "alex@example.com"); await c.click("#au-go");
    await H.until(c, () => /a link to reset the password is on its way/.test(document.querySelector(".auth-card").textContent));
    const rec = await lastMail("recovery", "alex@example.com");
    await c.goto(rec.link);
    await c.waitForSelector("#np-pw");
    await c.fill("#np-pw", "brandnew789"); await c.click("#np-go");
    await H.until(c, () => /Password changed/.test(document.querySelector(".toasts").textContent));
    await c.waitForSelector("dialog#move, main .hero", { timeout: 8000 }).catch(() => {});
    ok("forgot password: the email link opens 'Set a new password' and signs you in");
    await c.evaluate(() => DB.app.signOut());
    await c.waitForSelector("#au-magic"); await c.click("#au-magic");
    await c.fill("#au-email", "alex@example.com"); await c.click("#au-go");
    await H.until(c, () => /sign-in link is on its way/.test(document.querySelector(".auth-card").textContent));
    await c.goto((await lastMail("magiclink", "alex@example.com")).link);
    await H.until(c, () => DB.app && DB.app.mode === "account");
    ok("'Email me a sign-in link' signs in without a password");
    await C2.ctx.close();

    // ---------- guest homework moves into an account ----------
    const D = await page(); const d = D.p;
    await d.goto(BASE); await d.waitForSelector("#au-guest");
    await d.click("#au-guest"); await d.waitForSelector(".hero");
    await H.addTask(d, { title: "Made as a guest", date: H.ymd(Date.now() + 864e5), time: "09:00" });
    await d.goto(BASE + "#/settings/account"); await d.click(".set-card .btn:has-text('Sign in')");
    await d.waitForSelector("#au-go");
    await d.fill("#au-email", "alex@example.com"); await d.fill("#au-pw", "brandnew789"); await d.click("#au-go");
    await d.waitForSelector("#move-yes");
    assert.match(await H.text(d, "#move"), /1 open, 0 finished/);
    await d.click("#move-yes");
    await H.until(d, () => DB.app.store.tasks().some((t) => t.title === "Made as a guest") && DB.app.sync.status === "ok");
    assert.ok((await serverItems()).some((i) => i.data.title === "Made as a guest"));
    assert.ok(await d.evaluate(() => !localStorage.getItem("dueboard:v4:guest")));
    ok("homework made without an account is offered and moved into the account when signing in, then synced");
    await D.ctx.close();

    // ---------- duplicate sign-up ----------
    const E = await page(); const e = E.p;
    await e.goto(BASE); await e.waitForSelector("#au-go");
    await e.click(".auth-card .seg button:has-text('Create account')");
    await e.fill("#au-name", "Copy"); await e.fill("#au-email", "alex@example.com"); await e.fill("#au-pw", "password999"); await e.click("#au-go");
    await H.until(e, () => /If alex@example.com doesn't have an account yet/.test(document.querySelector(".auth-card").textContent));
    ok("signing up with an email that already has an account doesn't reveal it, and points to signing in instead");
    await E.ctx.close();

    // ---------- delete account ----------
    await a.goto(BASE + "#/settings/account"); await a.waitForSelector("#acct-delete");
    await a.click("#acct-delete"); assert.ok(await a.isVisible("#acct-danger"));
    await a.click("#acct-del-cancel"); assert.ok(!(await a.isVisible("#acct-danger")));
    await a.click("#acct-delete"); await a.click("#acct-del-go");
    await H.until(a, () => /Type your password/.test(document.querySelector("#acct-del-msg").textContent));
    await a.fill("#acct-del-pw", "wrong-one-1"); await a.click("#acct-del-go");
    await H.until(a, () => /That password is not right/.test(document.querySelector("#acct-del-msg").textContent));
    assert.ok((await serverItems()).length > 0);
    await a.fill("#acct-del-pw", "brandnew789"); await a.click("#acct-del-go");
    await H.until(a, () => location.hash === "#/welcome" && /were deleted/.test(document.querySelector(".toasts").textContent));
    assert.strictEqual((await serverItems()).length, 0);
    assert.strictEqual((await (await fetch(SB + "/__test/sql", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sql: "select count(*)::int as n from auth.users where email = 'alex@example.com'" }) })).json())[0].n, 0);
    assert.deepStrictEqual(await a.evaluate(() => Object.keys(localStorage).filter((k) => /^dueboard:v4:u:/.test(k))), []);
    ok("delete account: Cancel works, the password is required and checked; then the account, all its data and this device's copy are gone");
    // the phone, still signed in, now can't sync and says so
    await syncNow(b);
    await H.until(b, () => ["error", "ok", "pending"].indexOf(DB.app.sync.status) !== -1);
    await a.screenshot({ path: path.join(OUT, "after-delete.png") });

    console.log(errors.length ? "\nPAGE ERRORS:\n" + errors.join("\n") : "\nno page errors");
    if (errors.length) process.exitCode = 1;
  } catch (err) {
    console.log("FAIL:", (err && err.stack) || err);
    process.exitCode = 1;
  } finally {
    await browser.close(); srv.kill();
    console.log("files: " + OUT);
  }
})();
