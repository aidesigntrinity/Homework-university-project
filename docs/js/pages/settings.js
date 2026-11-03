/* Settings: account, sync, ManageBac, notifications, appearance, personal, points, data and privacy. */
(function () {
  "use strict";
  const DB = window.DB, C = DB.core, U = DB.ui, St = DB.store;
  const { el, icon } = U;
  DB.pages = DB.pages || {};
  const SECTIONS = [
    ["account", "Account", "user"], ["sync", "Sync", "cloud"], ["managebac", "ManageBac", "cap"], ["notifications", "Notifications", "bell"],
    ["appearance", "Appearance", "sun"], ["personal", "Personal", "target"], ["points", "Points and levels", "star"], ["data", "Data and backup", "download"], ["privacy", "Privacy", "lock"],
  ];
  const RELAY = `// Due Board sync relay. Your ManageBac link stays inside your own Google account.
var CALENDAR_LINK = "PASTE YOUR MANAGEBAC CALENDAR LINK HERE";
var SECRET_KEY = "MAKE-UP-A-LONG-RANDOM-PHRASE";

function doGet(e) {
  if (!e.parameter.key || e.parameter.key !== SECRET_KEY) {
    return ContentService.createTextOutput("Wrong or missing key");
  }
  var cache = CacheService.getScriptCache();
  var ics = cache.get("ics");
  if (!ics) {
    ics = UrlFetchApp.fetch(CALENDAR_LINK.replace(/^webcal:/i, "https:")).getContentText();
    if (ics.length < 90000) cache.put("ics", ics, 300);
  }
  return ContentService.createTextOutput(ics);
}`;

  function render(page, ctx) {
    const App = DB.app, sub = SECTIONS.some((s) => s[0] === App.route.sub) ? App.route.sub : "account";
    if (sub !== lastSection) { Object.keys(flash).forEach((k) => delete flash[k]); lastSection = sub; }
    U.add(page, el("div", { class: "page-head hide-sm-title" }, el("div", null, el("h1", { text: "Settings" }))));
    const nav = el("nav", { class: "set-nav", "aria-label": "Settings sections" }, SECTIONS.map((s) => el("a", { class: "nav-item", href: "#/settings/" + s[0], "aria-current": s[0] === sub ? "page" : null,
      onclick: (e) => { e.preventDefault(); App.go("settings", true, s[0]); } }, icon(s[2]), el("span", { text: s[1] }))));
    const panel = el("div", { class: "set-panel" });
    U.add(page, el("div", { class: "settings" }, nav, panel));
    SECT[sub](panel, ctx);
  }
  const card = (title, desc, ...kids) => el("section", { class: "set-card" }, el("h2", { text: title }), desc ? el("p", { class: "desc", text: desc }) : null, ...kids);
  // Status messages survive the page redrawing (after a save, an import or a sync) until you leave the section.
  const flash = {};
  let lastSection = "";
  const msg = (id) => { const f = flash[id]; return el("div", { class: "note" + (f && f.kind ? " " + f.kind : ""), id, hidden: !(f && f.text), "aria-live": "polite", text: f ? f.text : "" }); };
  function say(node, text, kind) {
    flash[node.id] = { text, kind };
    const live = document.getElementById(node.id) || node;
    live.textContent = text; live.className = "note" + (kind ? " " + kind : ""); live.hidden = !text;
  }

  const SECT = {
    account(p, ctx) {
      const App = DB.app, A = DB.account, S = ctx.store;
      if (App.mode !== "account") {
        U.add(p, card("You're not signed in", A.available ? "Your homework is saved in this browser only. Create a free account to keep it safe and use it on your phone and laptop." : "Accounts aren't set up on this copy of Due Board, so homework is saved in this browser only.",
          A.available ? el("div", { class: "btn-row" }, U.btn("Create an account", { kind: "primary", icon: "user", onclick: () => DB.auth.show("signup") }), U.btn("Sign in", { onclick: () => DB.auth.show("signin") })) : null,
          A.available ? el("p", { class: "small muted", text: "When you sign in, Due Board offers to add the homework already on this device to your account." } ) : null));
        const name = el("input", { class: "input", id: "set-name", maxlength: "60", value: S.profile().name, placeholder: "Your first name" });
        U.add(p, card("Your name", "Used for the greeting on Home.", U.field("Name", name), el("div", null, U.btn("Save name", { onclick: () => { S.setProfile({ name: name.value.trim() }); U.toast("Name saved"); } }))));
        return;
      }
      const u = A.user || {}, name = S.profile().name || A.name();
      const out = msg("acct-msg");
      U.add(p, card("Account", null,
        el("div", { class: "row", style: { gap: "16px" } }, el("span", { class: "avatar lg" }, U.initials(name, u.email)), el("div", { class: "stack sm grow" }, el("b", { style: { fontSize: "18px" }, text: name || "No name yet" }), el("span", { class: "muted", text: u.email || "" }),
          u.email_confirmed_at || u.confirmed_at ? null : el("span", { class: "badge amber", text: "Email not confirmed yet" }))), out));
      const nameIn = el("input", { class: "input", id: "acct-name", maxlength: "60", value: name, autocomplete: "name" });
      U.add(p, card("Name", null, U.field("Name", nameIn), el("div", null, U.btn("Save name", { id: "acct-name-save", onclick: async () => {
        const v = nameIn.value.trim(); if (!v) { say(out, "Type a name first.", "bad"); return; }
        S.setProfile({ name: v });
        try { await A.updateName(v); say(out, "Name saved.", "good"); } catch (e) { say(out, "Saved here; it will reach your account when you're back online.", ""); }
      } }))));
      const cur = el("input", { class: "input", id: "acct-cur", type: "password", autocomplete: "current-password" }), nw = el("input", { class: "input", id: "acct-new", type: "password", autocomplete: "new-password", minlength: "8" });
      const pwMsg = msg("acct-pw-msg");
      U.add(p, card("Password", null, el("div", { class: "field-row stack-sm" }, U.field("Current password", cur), U.field("New password", nw, "At least 8 characters.")), pwMsg,
        el("div", null, U.btn("Change password", { id: "acct-pw-go", onclick: async (e) => {
            const btnEl = e.currentTarget;
          if (nw.value.length < 8) { say(pwMsg, "The new password needs at least 8 characters.", "bad"); return; }
          btnEl.disabled = true;
          try { await A.changePassword(cur.value, nw.value); cur.value = ""; nw.value = ""; say(pwMsg, "Password changed.", "good"); }
          catch (err) { say(pwMsg, /not right/.test(A.friendly(err)) ? "Your current password is not right." : A.friendly(err), "bad"); }
          finally { btnEl.disabled = false; }
        } }))));
      const email = el("input", { class: "input", id: "acct-email", type: "email", autocomplete: "email", value: "" });
      const emMsg = msg("acct-email-msg");
      U.add(p, card("Email address", "We'll send a confirmation link to the new address. The change happens once you open it.", U.field("New email", email), emMsg,
        el("div", null, U.btn("Change email", { onclick: async () => {
          if (!A.EMAIL_RE.test(email.value.trim())) { say(emMsg, "That email address doesn't look right.", "bad"); return; }
          try { await A.changeEmail(email.value.trim()); say(emMsg, "Check both inboxes: open the links to confirm the change.", "good"); } catch (err) { say(emMsg, A.friendly(err), "bad"); }
        } }))));
      U.add(p, card("Sign out", "Signing out removes your homework from this device. It stays safe in your account.", el("div", null, U.btn("Sign out", { icon: "logout", id: "acct-signout", onclick: () => App.signOut() }))));
      const delPw = el("input", { class: "input", id: "acct-del-pw", type: "password", autocomplete: "current-password" });
      const delMsg = msg("acct-del-msg");
      const danger = el("div", { class: "stack", id: "acct-danger", hidden: true },
        el("p", { class: "coral small", text: "This permanently deletes your account and everything in it: homework, points, streaks and focus history. It can't be undone. Download a backup first if you might want it later." }),
        U.field("Type your password to confirm", delPw), delMsg,
        el("div", { class: "btn-row" }, U.btn("Cancel", { id: "acct-del-cancel", onclick: () => { danger.hidden = true; delPw.value = ""; say(delMsg, ""); } }),
          U.btn("Delete my account", { kind: "danger solid", id: "acct-del-go", onclick: async (e) => {
            const btnEl = e.currentTarget;
            if (!delPw.value) { say(delMsg, "Type your password to confirm.", "bad"); delPw.focus(); return; }
            btnEl.disabled = true;
            try { await A.deleteAccount(delPw.value); } catch (err) { say(delMsg, /not right/.test(A.friendly(err)) ? "That password is not right." : A.friendly(err), "bad"); btnEl.disabled = false; }
          } })));
      U.add(p, card("Delete account", null, el("div", { class: "btn-row" }, U.btn("Download a backup", { icon: "download", onclick: backupNow }), U.btn("Delete account…", { kind: "danger", id: "acct-delete", onclick: () => { danger.hidden = false; delPw.focus(); } })), danger));
    },

    sync(p, ctx) {
      const App = DB.app, S = ctx.store;
      if (App.mode !== "account") {
        U.add(p, card("Sync between devices", "Sign in to keep the same homework on your phone, tablet and laptop. Without an account everything stays in this browser.",
          DB.account.available ? el("div", null, U.btn("Create an account or sign in", { kind: "primary", onclick: () => DB.auth.show("signin") })) : null));
        return;
      }
      const sy = App.sync, n = Object.keys(S.pending).length;
      const labels = { ok: "Up to date", syncing: "Syncing now", pending: "Saving changes", offline: "Offline", error: "Paused", starting: "Connecting" };
      U.add(p, card("Sync", null,
        el("div", { class: "row wrap", style: { gap: "10px" } }, el("span", { class: "badge " + (sy.status === "ok" ? "teal" : sy.status === "error" ? "coral" : "amber"), text: labels[sy.status] || sy.status }),
          el("span", { class: "small muted", text: sy.lastSync ? "Last synced " + C.relDay(sy.lastSync, Date.now()).toLowerCase() + " at " + C.fmtTime(sy.lastSync) : "Not synced yet" }),
          n ? el("span", { class: "small muted", text: n + " change" + (n === 1 ? "" : "s") + " waiting to be sent" }) : null),
        sy.error ? el("p", { class: "note bad", text: sy.error }) : null,
        el("div", null, U.btn("Sync now", { icon: "refresh", id: "sync-now", onclick: () => sy.now() })),
        el("ul", { class: "steps" },
          el("li", null, el("strong", { text: "Works offline. " }), "Changes are saved on this device straight away and sent when you're online."),
          el("li", null, el("strong", { text: "No lost edits. " }), "Each piece of homework syncs separately. If two devices change the same one, the most recent change wins, and nothing else is touched."),
          el("li", null, el("strong", { text: "Live. " }), "Other signed-in devices update within seconds, or within a minute at most."))));
    },

    managebac(p, ctx) {
      const App = DB.app, S = ctx.store, st = S.settings();
      const imp = msg("import-msg");
      const fileIn = el("input", { type: "file", accept: ".ics,text/calendar", hidden: true, id: "mb-file" });
      const drop = el("div", { class: "drop", tabindex: "0", role: "button", id: "mb-drop", "aria-label": "Choose a calendar file to import" }, icon("upload", 28), el("p", null, el("b", { text: "Drop your .ics file here" }), " or click to choose it"));
      const paste = el("textarea", { class: "textarea", id: "mb-paste", placeholder: "…or paste the calendar text (starts with BEGIN:VCALENDAR)" });
      function runImport(text) {
        text = (text || "").trim();
        if (!text) { say(imp, "Choose a file or paste the calendar text first.", "bad"); return; }
        if (/^(https?|webcal):\/\//i.test(text) && text.indexOf("\n") === -1) { say(imp, "That's the link itself. Open it in a new browser tab first, then drop the file it downloads here (or paste the text it shows). For automatic updates, set up auto-sync below.", "bad"); return; }
        if (text.indexOf("BEGIN:VCALENDAR") === -1) { say(imp, "That doesn't look like a calendar file. It should start with BEGIN:VCALENDAR.", "bad"); return; }
        let r;
        try { r = S.importFeed(text, { full: true, label: "Imported from ManageBac" }); } catch (e) { say(imp, "Something in that file couldn't be read.", "bad"); return; }
        const s = r.stats, c = r.counts, skipped = [];
        if (s.past) skipped.push(s.past + " already past");
        if (s.repeating) skipped.push(s.repeating + " repeating (like lessons)");
        if (s.ignored) skipped.push(s.ignored + " matched your skip words");
        if (s.unreadable) skipped.push(s.unreadable + " unreadable");
        const parts = [c.added + " added", c.updated + " updated"];
        if (c.linked) parts.push(c.linked + " matched to homework you'd already added");
        if (c.removed + c.cancelled) parts.push((c.removed + c.cancelled) + " no longer in ManageBac (moved to the archive)");
        say(imp, "Found " + s.events + " events: " + parts.join(", ") + (skipped.length ? ". Skipped: " + skipped.join(", ") : "") + ".", "good");
        paste.value = "";
        if (r.changed) U.toast("Imported from ManageBac", { icon: "cap", detail: c.added + " new, " + c.updated + " updated", undo: () => S.undo() });
      }
      function readFile(file) {
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { say(imp, "That file is too big to be a calendar export.", "bad"); return; }
        const r = new FileReader(); r.onload = () => runImport(String(r.result)); r.onerror = () => say(imp, "Couldn't read that file.", "bad"); r.readAsText(file);
      }
      drop.addEventListener("click", () => fileIn.click());
      drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileIn.click(); } });
      fileIn.addEventListener("change", () => { readFile(fileIn.files[0]); fileIn.value = ""; });
      ["dragenter", "dragover"].forEach((n) => drop.addEventListener(n, (e) => { e.preventDefault(); drop.classList.add("over"); }));
      ["dragleave", "drop"].forEach((n) => drop.addEventListener(n, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
      drop.addEventListener("drop", (e) => readFile(e.dataTransfer && e.dataTransfer.files[0]));
      U.add(p, card("Import from ManageBac", "ManageBac's API needs a school administrator, so Due Board uses the calendar link every student has: My Workspace → View Full Calendar → Subscribe to Calendar. Keep that link private.",
        el("ol", { class: "steps" }, el("li", null, "Open your calendar link in a new browser tab. It downloads a ", el("strong", { text: ".ics" }), " file."), el("li", null, "Drop that file below. Importing again updates items instead of duplicating them.")),
        drop, fileIn, paste, el("div", null, U.btn("Import pasted text", { id: "mb-import", onclick: () => runImport(paste.value) })), imp));

      const url = el("input", { class: "input", id: "mb-sync", type: "url", value: st.syncUrl, placeholder: "https://script.google.com/macros/s/…/exec?key=…" });
      const syncMsg = msg("mb-sync-msg");
      if (App.mbStatus && !flash["mb-sync-msg"]) say(syncMsg, App.mbStatus);
      const code = el("pre", { class: "code", id: "mb-code", text: RELAY });
      U.add(p, card("Auto-sync", "A web page can't read another site's calendar directly, so auto-sync goes through a tiny free relay that runs in your own Google account. Due Board then checks for changes when it opens and every 15 minutes.",
        el("details", null, el("summary", { class: "link-btn", style: { listStyle: "none", cursor: "pointer" } }, "How to set up the relay (about 5 minutes)"),
          el("ol", { class: "steps", style: { marginTop: "12px" } },
            el("li", null, "Go to ", el("strong", { text: "script.google.com" }), " and create a new project."),
            el("li", null, "Replace the code with the code below. Paste your ManageBac link and make up a long secret phrase."),
            el("li", null, el("strong", { text: "Deploy → New deployment → Web app" }), ". Execute as: Me. Who has access: Anyone. Deploy and allow access."),
            el("li", null, "Copy the web app address, add ", el("strong", { text: "?key=your-phrase" }), " to the end, and paste it below.")),
          code, el("div", { class: "btn-row", style: { marginTop: "8px" } }, U.btn("Copy the code", { size: "sm", icon: "layers", onclick: (e) => { const b = e.currentTarget; (navigator.clipboard ? navigator.clipboard.writeText(RELAY) : Promise.reject()).then(() => { b.lastChild.textContent = "Copied"; }, () => { const r = document.createRange(); r.selectNodeContents(code); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); b.lastChild.textContent = "Press Ctrl+C"; }); } }))),
        U.field("Relay address", url, "Keep it private: with the key, it returns your calendar."),
        el("div", { class: "btn-row" }, U.btn("Save and sync now", { kind: "primary", icon: "refresh", id: "mb-sync-go", onclick: async () => {
          const v = url.value.trim();
          if (!C.isSyncUrl(v)) { say(syncMsg, "That should be the web app address from Google: it starts with https://script.google.com/macros/s/ and ends with /exec?key=your-phrase", "bad"); return; }
          S.setSettings({ syncUrl: v }); say(syncMsg, "Syncing…"); await App.syncManageBac(true); say(syncMsg, App.mbStatus);
        } }), st.syncUrl ? U.btn("Turn off auto-sync", { onclick: () => { S.setSettings({ syncUrl: "" }); U.toast("Auto-sync is off"); } }) : null), syncMsg));

      const words = el("input", { class: "input", id: "mb-ignore", value: st.ignore.join(", "), placeholder: "lesson, assembly, CAS" });
      U.add(p, card("Import rules", null,
        U.field("Skip events containing these words", words, "Separate with commas. Matches the title or notes, so lessons in your calendar can stay off the board."),
        el("div", null, U.btn("Save words", { onclick: () => { S.setSettings({ ignore: words.value.split(",").map((w) => w.trim()).filter(Boolean).slice(0, 30) }); U.toast("Skip words saved"); } })),
        U.switchRow("Archive homework removed from ManageBac", "When a teacher deletes or cancels an assignment, move it to the archive (it comes back if it reappears). Finished homework is never touched.", st.removeMissing, (v) => S.setSettings({ removeMissing: v })),
        el("p", { class: "small muted", text: "Changes you make to imported homework (title, date, subject, notes) are kept: syncing won't overwrite them." }),
        el("div", null, U.btn("Archive all ManageBac homework", { kind: "outline", size: "sm", onclick: () => {
          const ids = S.activeTasks().filter((t) => t.source === "managebac" && !t.done).map((t) => t.id);
          if (!ids.length) { U.toast("No open ManageBac homework."); return; }
          S.batch("Archived", () => ids.forEach((id) => S.put("task", id, Object.assign({}, S.task(id), { archived: Date.now() }))));
          U.toast("Archived " + ids.length + " ManageBac items", { undo: () => S.undo() });
        } }))));
      U.add(p, card("Google Calendar", "For alerts on your phone (and email reminders), put your homework in Google Calendar.",
        el("ul", { class: "steps" },
          el("li", null, el("strong", { text: "One item: " }), "open homework → More → Add to Google Calendar."),
          el("li", null, el("strong", { text: "Everything upcoming: " }), "download the calendar file below (with reminders built in) and import it in Google Calendar → Settings → Import & export."),
          el("li", null, el("strong", { text: "Straight from ManageBac: " }), "in Google Calendar, Other calendars → From URL, paste your ManageBac link.")),
        el("div", { class: "btn-row" }, U.btn("Download upcoming (.ics)", { icon: "download", onclick: () => exportIcs(S) }), U.btn("Download as .csv", { kind: "ghost", onclick: () => exportCsv(S) }))));
    },

    notifications(p, ctx) {
      const App = DB.app, S = ctx.store, st = S.settings();
      const supported = App.notifySupported(), perm = supported ? Notification.permission : "unsupported";
      const status = el("p", { class: "small muted", id: "notify-status" });
      const sw = U.switchEl(st.notify && perm === "granted", "Pop-up alerts", (v) => {
        if (!v) { S.setSettings({ notify: false }); return; }
        if (!supported) return;
        const done = (pp) => { S.setSettings({ notify: pp === "granted" }); if (pp !== "granted") U.toast("Alerts are blocked. Allow notifications for this site in your browser settings."); };
        try { const r = Notification.requestPermission(done); if (r && r.then) r.then(done); } catch (e) { done("denied"); }
      }, "set-notify");
      if (!supported || perm === "denied") sw.disabled = true;
      status.textContent = !supported ? "This browser can't show pop-up alerts. Reminders still appear inside Due Board." : perm === "denied" ? "Alerts are blocked for this site. Allow them in your browser settings, then reload." : "Pop-ups appear while Due Board is open in a tab, even in the background.";
      const leads = el("div", { class: "chips" }, [1, 3, 6, 12, 24, 48].map((h) => el("button", { class: "chip", type: "button", "aria-pressed": String(st.leads.indexOf(h) !== -1), onclick: () => {
        const l = st.leads.slice(), i = l.indexOf(h); if (i === -1) l.push(h); else l.splice(i, 1); S.setSettings({ leads: l.sort((a, b) => b - a) }); } }, h < 24 ? h + " h before" : h / 24 + (h === 24 ? " day before" : " days before"))));
      U.add(p, card("Reminders", null,
        el("div", { class: "switch-row" }, el("div", { class: "grow" }, el("div", { class: "t", text: "Pop-up alerts" }), status), sw),
        U.switchRow("Remind me about new homework", "Use the default reminder times below for homework that doesn't set its own.", st.remindDefault, (v) => S.setSettings({ remindDefault: v })),
        el("div", { class: "form-sect" }, el("span", { class: "label", text: "Default reminder times" }), leads),
        el("p", { class: "small muted", text: "Browsers can't wake a closed web page, so reminders appear while Due Board is open. For reminders when it's closed, export to Google Calendar (Settings → ManageBac)." })));
      U.add(p, card("Focus sounds", null, U.switchRow("Play a sound when a focus block or break ends", null, st.focus.sound, (v) => S.setSettings({ focus: Object.assign({}, st.focus, { sound: v }) }))));
    },

    appearance(p, ctx) {
      const S = ctx.store, st = S.settings();
      U.add(p, card("Theme", null, U.seg([{ v: "system", label: "Match device" }, { v: "light", label: "Light" }, { v: "dark", label: "Dark" }], st.theme, (v) => S.setSettings({ theme: v }), "Theme", "full")));
      U.add(p, card("Layout", null,
        el("div", { class: "form-sect" }, el("span", { class: "label", text: "Density" }), U.seg([{ v: "comfortable", label: "Comfortable" }, { v: "compact", label: "Compact" }], st.density, (v) => S.setSettings({ density: v }), "Density")),
        el("div", { class: "field-row stack-sm" },
          U.field("Open on", U.select([{ v: "home", label: "Home" }, { v: "calendar", label: "Calendar" }, { v: "planner", label: "Planner" }, { v: "progress", label: "Progress" }, { v: "focus", label: "Focus" }], st.startPage, (v) => S.setSettings({ startPage: v }), { id: "set-start" })),
          U.field("Weeks start on", U.select([{ v: 1, label: "Monday" }, { v: 0, label: "Sunday" }], st.weekStart, (v) => S.setSettings({ weekStart: +v }), { id: "set-week" }))),
        el("p", { class: "small muted", text: "Times are shown in your device's time zone: " + (Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown") + "." })));
    },

    personal(p, ctx) {
      const S = ctx.store, st = S.settings();
      const name = el("input", { class: "input", id: "pers-name", maxlength: "60", value: S.profile().name });
      U.add(p, card("Name", null, U.field("What should we call you?", name), el("div", null, U.btn("Save", { onclick: () => { S.setProfile({ name: name.value.trim() }); if (DB.app.mode === "account") DB.account.updateName(name.value.trim()).catch(() => {}); U.toast("Name saved"); } }))));
      const num = (id, v, min, max, step) => el("input", { class: "input", id, type: "number", min: String(min), max: String(max), step: String(step || 5), value: String(v) });
      const daily = num("goal-daily", st.goals.daily, 0, 720), weekly = num("goal-weekly", st.goals.weekly, 0, 5000, 15), cap = num("cap", st.capacity, 15, 720, 15), est = num("def-est", st.defaultEst, 5, 600);
      U.add(p, card("Study goals and planning", "Goals show on Home, Focus and Progress. The planner keeps each day within your capacity.",
        el("div", { class: "field-row stack-sm" }, U.field("Daily study goal (minutes)", daily), U.field("Weekly study goal (minutes)", weekly)),
        el("div", { class: "field-row stack-sm" }, U.field("Homework time per day (minutes)", cap, "Used by the planner and the calendar's workload colours."), U.field("Default estimate (minutes)", est, "For homework without its own estimate.")),
        el("div", null, U.btn("Save", { kind: "primary", onclick: () => {
          const clamp = (n, lo, hi, d) => { n = Math.round(+n); return isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
          S.setSettings({ goals: { daily: clamp(daily.value, 0, 720, 60), weekly: clamp(weekly.value, 0, 5000, 300) }, capacity: clamp(cap.value, 15, 720, 120), defaultEst: clamp(est.value, 5, 600, 30) });
          U.toast("Saved");
        } }))));
      const subjects = S.subjects();
      const list = el("div");
      subjects.forEach((s) => {
        const key = s.toLowerCase(), cur = st.subjectColors[key];
        U.add(list, el("div", { class: "subj-row" }, el("span", { class: "tag", vars: { "--c": S.subjectColor(s) }, text: s }), el("span", { class: "nm" }),
          el("div", { class: "swatches", role: "group", "aria-label": "Colour for " + s }, St.PALETTE.map((c, i) => el("button", { class: "swatch", type: "button", vars: { "--c": c }, "aria-pressed": String(cur === i || (cur === undefined && S.subjectColor(s) === c)), "aria-label": "Colour " + (i + 1),
            onclick: () => { const m = Object.assign({}, st.subjectColors); m[key] = i; S.setSettings({ subjectColors: m }); } }))),
          U.iconBtn("edit", "Rename " + s, () => renameSubject(S, s), { class: "icon-btn sm" })));
      });
      U.add(p, card("Subjects", subjects.length ? "Pick a colour for each subject, or rename one everywhere at once." : "Subjects appear here once your homework has them.", list));
    },

    points(p, ctx) {
      const S = ctx.store, st = S.settings();
      const inp = (id, v) => el("input", { class: "input", id, type: "number", min: "0", max: "100", value: String(v) });
      const early = inp("p-early", st.pts.early), onTime = inp("p-ontime", st.pts.onTime), late = inp("p-late", st.pts.late), streak = inp("p-streak", st.pts.streak);
      const names = el("input", { class: "input", id: "p-names", value: st.names.join(", ") });
      U.add(p, card("Points", "Points are fixed when you finish homework, so changing these only affects homework you finish from now on.",
        el("div", { class: "field-row" }, U.field("A day or more early", early), U.field("On time", onTime)),
        el("div", { class: "field-row" }, U.field("Late", late), U.field("Daily bonus (first homework each day)", streak)),
        el("div", null, U.btn("Save points", { kind: "primary", onclick: () => {
          const v = (n, d) => { n = Math.round(+n.value); return isFinite(n) ? Math.max(0, Math.min(100, n)) : d; };
          S.setSettings({ pts: { early: v(early, 15), onTime: v(onTime, 10), late: v(late, 5), streak: v(streak, 5) } }); U.toast("Points saved");
        } }))));
      U.add(p, card("Level names", "Level 2 starts at 50 points, level 3 at 150, level 4 at 300, and so on.", U.field("Names, in order, separated by commas", names),
        el("div", null, U.btn("Save names", { onclick: () => { const n = names.value.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 12); S.setSettings({ names: n.length ? n : C.DEFAULT_NAMES.slice() }); U.toast("Level names saved"); } }))));
    },

    data(p, ctx) {
      const App = DB.app, S = ctx.store;
      const out = msg("backup-msg");
      const fileIn = el("input", { type: "file", accept: ".json,application/json", hidden: true, id: "restore-file" });
      let mode = "merge";
      fileIn.addEventListener("change", () => {
        const file = fileIn.files[0]; fileIn.value = "";
        if (!file) return;
        if (file.size > 20 * 1024 * 1024) { say(out, "That file is too big to be a Due Board backup.", "bad"); return; }
        const r = new FileReader();
        r.onerror = () => say(out, "Couldn't read that file.", "bad");
        r.onload = () => {
          let obj; try { obj = JSON.parse(String(r.result)); } catch (e) { obj = null; }
          try { const res = S.restoreBackup(obj, mode); say(out, "Restored " + res.tasks + " homework items and " + res.sessions + " focus sessions" + (mode === "replace" ? ". Homework that wasn't in the backup was moved to Archive → Deleted." : ", keeping any newer changes on this device."), "good"); U.toast("Backup restored", { undo: () => S.undo() }); }
          catch (e) { say(out, e.message === "empty-backup" ? "That backup is empty." : "That isn't a Due Board backup.", "bad"); }
        };
        r.readAsText(file);
      });
      const tasks = S.tasks().filter((t) => !t.purged), sessions = S.sessions();
      U.add(p, card("Backup", "A backup holds everything: all homework (including finished and archived), focus sessions, points history and settings.",
        el("div", { class: "btn-row" }, U.btn("Download backup", { kind: "primary", icon: "download", id: "backup-go", onclick: () => { backupNow(); say(out, "Backup downloaded.", "good"); } })),
        el("hr"),
        el("div", { class: "form-sect" }, el("span", { class: "label", text: "Restore a backup" }),
          U.seg([{ v: "merge", label: "Add to my list" }, { v: "replace", label: "Replace my list" }], mode, (v) => { mode = v; }, "Restore mode"),
          el("p", { class: "small muted", text: "“Add to my list” keeps your newer changes. “Replace” makes the backup win and moves anything not in it to Archive → Deleted, where you can get it back." }),
          el("div", null, U.btn("Choose backup file", { icon: "upload", id: "restore-go", onclick: () => fileIn.click() }), fileIn)), out));
      U.add(p, card("Export", null, el("div", { class: "btn-row" }, U.btn("Upcoming homework (.ics)", { icon: "calendar", onclick: () => exportIcs(S) }), U.btn("Upcoming homework (.csv)", { icon: "download", onclick: () => exportCsv(S) }), U.btn("Print list", { icon: "list", onclick: () => { App.go("home"); setTimeout(() => window.print(), 300); } }))));
      U.add(p, card("What's stored", null,
        el("table", { class: "data" },
          el("tr", null, el("td", { text: "Homework" }), el("td", { class: "n", text: String(tasks.filter((t) => !t.historyOnly).length) })),
          el("tr", null, el("td", { text: "Finished (all time)" }), el("td", { class: "n", text: String(tasks.filter((t) => t.done).length) })),
          el("tr", null, el("td", { text: "Focus sessions" }), el("td", { class: "n", text: String(sessions.length) })),
          el("tr", null, el("td", { text: "Saved on this device" }), el("td", { class: "n", text: App.persistent ? (S.lastSaved ? "at " + C.fmtTime(S.lastSaved) : "yes") : "no (blocked by the browser)" }))),
        el("div", null, U.btn("Open the archive", { icon: "archive", onclick: () => App.go("archive") }))));
    },

    privacy(p, ctx) {
      const App = DB.app, S = ctx.store;
      U.add(p, card("Where your data is", null, el("ul", { class: "steps" },
        el("li", null, el("strong", { text: "On this device: " }), "a copy of your homework, settings and focus sessions, so Due Board works offline."),
        el("li", null, el("strong", { text: "In your account (if signed in): " }), "the same data, stored with Supabase and readable only by you."),
        el("li", null, el("strong", { text: "Never: " }), "your ManageBac link (unless you use auto-sync, where it stays in your own Google account) or any tracking or ads."))));
      if (App.mode === "account") U.add(p, card("Delete your account", "Removes your account and everything in it from the server and this device.", el("div", null, U.btn("Go to account settings", { onclick: () => App.go("settings", false, "account") }))));
      else U.add(p, card("Clear this device", "Deletes the homework saved in this browser. Download a backup first if you want to keep it.",
        el("div", { class: "btn-row" }, U.btn("Download backup", { icon: "download", onclick: backupNow }), U.btn("Clear this device…", { kind: "danger", id: "clear-device", onclick: async () => {
          const yes = await U.confirmDialog({ title: "Delete everything on this device?", text: "All homework, points and focus history saved in this browser will be deleted. This can't be undone.", ok: "Delete everything", danger: true });
          if (!yes) return;
          App.ls.del(S.key); App.ls.del("dueboard:mode"); location.hash = "#/welcome"; location.reload();
        } }))));
    },
  };

  function renameSubject(S, from) {
    const s = U.sheet({ title: "Rename subject", narrow: true });
    const inp = el("input", { class: "input", id: "rename-subj", maxlength: "40", value: from });
    U.add(s.body, U.field("New name", inp, "Changes it on every piece of homework."));
    U.add(s.foot, U.btn("Cancel", { onclick: () => s.close() }), U.btn("Rename", { kind: "primary", onclick: () => {
      const to = inp.value.trim(); if (!to || to === from) { s.close(); return; }
      const ids = S.tasks().filter((t) => t.subject === from).map((t) => t.id);
      S.batch("Renamed subject", () => ids.forEach((id) => S.put("task", id, Object.assign({}, S.task(id), { subject: to }))));
      s.close(); U.toast("Renamed on " + ids.length + " items", { undo: () => S.undo() });
    } }));
    s.open(); inp.select();
  }
  function upcoming(S) { const now = Date.now(); return S.activeTasks().filter((t) => !t.done && t.due >= now).sort((a, b) => a.due - b.due); }
  function exportIcs(S) { const up = upcoming(S); if (!up.length) { U.toast("Nothing upcoming to export."); return; } U.download("due-board-homework.ics", C.toIcs(up, { alarms: S.settings().leads.length ? S.settings().leads : [24] }), "text/calendar"); U.toast("Downloaded " + up.length + " items", { detail: "Import it in Google Calendar → Settings → Import & export." }); }
  function exportCsv(S) { const up = upcoming(S); if (!up.length) { U.toast("Nothing upcoming to export."); return; } U.download("due-board-homework.csv", C.calendarCsv(up), "text/csv"); U.toast("Downloaded " + up.length + " items"); }
  function backupNow() { const S = DB.app.store; U.download("due-board-backup-" + C.dayKey(Date.now()) + ".json", JSON.stringify(S.backup(), null, 1), "application/json"); }

  DB.settings = { backupNow };
  DB.pages.settings = { title: "Settings", render };
})();
