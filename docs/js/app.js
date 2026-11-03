/* Due Board app shell: start-up, navigation, layout chrome, accounts and the background jobs
   (reminders, ManageBac auto-sync). Screens live in js/pages/ and register themselves in DB.pages. */
(function () {
  "use strict";
  const DB = window.DB, C = DB.core, St = DB.store, U = DB.ui, A = DB.account;
  const { el, icon } = U;
  const MODE_KEY = "dueboard:mode", UI_KEY = "dueboard:ui", FIRED_KEY = "dueboard:fired", MOVED_KEY = "dueboard:moved";

  const picked = St.pickStorage();
  const App = (DB.app = {
    storage: picked.storage, persistent: picked.persistent, store: null, guest: null, mode: "starting", sync: null,
    route: { name: "home", sub: "" }, now: () => Date.now(), ui: loadUi(), mbStatus: "", pages: DB.pages,
  });
  function loadUi() { try { return Object.assign({ calMode: "month", homeFilter: {}, planWeek: 0 }, JSON.parse(localStorage.getItem(UI_KEY) || "{}")); } catch (e) { return { calMode: "month", homeFilter: {}, planWeek: 0 }; } }
  App.saveUi = () => { try { localStorage.setItem(UI_KEY, JSON.stringify({ calMode: App.ui.calMode, homeSort: App.ui.homeSort, planWeek: 0 })); } catch (e) { /* convenience only */ } };
  const ls = {
    get: (k) => { try { return App.storage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { App.storage.setItem(k, v); } catch (e) { /* reported by the store when it matters */ } },
    del: (k) => { try { App.storage.removeItem(k); } catch (e) { /* nothing to remove */ } },
  };
  App.ls = ls;

  // ---------- theme ----------
  const darkQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  App.applyTheme = function () {
    const st = App.store ? App.store.settings() : null;
    const pref = st ? st.theme : ls.get(St.KEYS.theme) || "system";
    const resolved = pref === "system" ? (darkQuery && !darkQuery.matches ? "light" : "dark") : pref;
    document.documentElement.setAttribute("data-theme", resolved);
    document.documentElement.setAttribute("data-density", st ? st.density : "comfortable");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", resolved === "light" ? "#F2F6F4" : "#0B2E29");
    ls.set(St.KEYS.theme, pref);
  };
  if (darkQuery && darkQuery.addEventListener) darkQuery.addEventListener("change", App.applyTheme);

  // ---------- stores ----------
  function openStore(key) {
    const s = St.createStore({ storage: App.storage, key }).load();
    s.on((what) => {
      if (what === "storage") renderChrome();
      if (what === "change" || what === "remote") scheduleRender();
      if (what === "change" || what === "remote") App.applyTheme();
    });
    return s;
  }
  function useGuest() {
    if (App.sync) { App.sync.stop(); App.sync = null; }
    App.guest = App.guest || openStore(St.KEYS.guest);
    St.upgradeLegacy(App.storage, App.guest);
    App.store = App.guest; App.mode = "guest";
    afterStoreChange();
  }
  function useAccount(user) {
    if (App.mode === "account" && App.store && App.store.key === St.KEYS.user(user.id) && App.sync) return;   // already open
    if (App.sync) App.sync.stop();
    App.store = openStore(St.KEYS.user(user.id));
    App.mode = "account";
    if (!App.store.profile().name && A.name()) App.store.setProfile({ name: A.name() });
    App.sync = A.createSync(App.store, user.id);
    App.sync.on(() => renderChrome());
    App.sync.start().then(() => offerMove(user));
    afterStoreChange();
  }
  function afterStoreChange() {
    App.applyTheme();
    if (App.route.name === "welcome") go(App.store.settings().startPage || "home", true);
    render();
    checkReminders(true);
    maybeSyncManageBac();
    if (DB.focus) DB.focus.restore();
  }
  // Guest homework on this device can be added to the account once.
  function offerMove(user) {
    const g = App.guest || openStore(St.KEYS.guest);
    App.guest = g;
    St.upgradeLegacy(App.storage, g);
    if (g.isEmpty() || ls.get(MOVED_KEY + ":" + user.id)) return;
    const n = g.activeTasks().length, done = g.tasks().filter((t) => t.done).length;
    const s = U.sheet({ title: "Bring your homework?", narrow: true, id: "move" });
    U.add(s.body, el("p", { text: "This device has homework saved without an account" + (n || done ? " (" + n + " open, " + done + " finished)" : "") + ". Add it to " + (user.email || "your account") + " so it syncs to your other devices?" }),
      el("p", { class: "muted small", text: "Nothing is lost either way: if you keep it separate, it stays on this device for when you continue without an account." }));
    U.add(s.foot, U.btn("Keep separate", { onclick: () => { ls.set(MOVED_KEY + ":" + user.id, "kept"); s.close(); } }),
      U.btn("Add to my account", { kind: "primary", id: "move-yes", onclick: () => {
        App.store.absorb(g);
        ls.set(MOVED_KEY + ":" + user.id, "moved");
        // The guest copy is kept under another key as a safety net, then cleared.
        ls.set(St.KEYS.guest + ":moved-" + Date.now(), ls.get(St.KEYS.guest) || "");
        ls.del(St.KEYS.guest); App.guest = null;
        s.close(); U.toast("Your homework is now in your account", { icon: "check" });
        if (App.sync) App.sync.now();
      } }));
    s.open();
  }

  // ---------- account events ----------
  A.onChange((evt, user) => {
    if (evt === "signedin" && user) { ls.set(MODE_KEY, "account"); useAccount(user); }
    if (evt === "recovery") DB.auth && DB.auth.newPasswordDialog();
    if (evt === "updated") renderChrome();
    if (evt === "signedout" || evt === "deleted") {
      if (App.sync) { App.sync.stop(); App.sync = null; }
      if (App.mode === "account" && App.store) ls.del(App.store.key);
      App.store = null; App.mode = "none"; ls.del(MODE_KEY);
      if (evt === "deleted") U.toast("Your account and everything in it were deleted.", { icon: "check" });
      go("welcome", true);
    }
  });
  // Signing out removes the account's copy from this device, so unsent changes are sent (or the user is warned) first.
  App.signOut = async function () {
    if (App.sync) {
      const ok = await App.sync.flush().catch(() => false);
      if (!ok) {
        const n = Object.keys(App.store.pending).length;
        const go2 = await U.confirmDialog({ title: "Not everything is saved", danger: true, ok: "Sign out anyway", cancel: "Stay signed in",
          text: n + (n === 1 ? " change hasn't" : " changes haven't") + " reached your account yet (you seem to be offline). If you sign out now, they will be lost. Download a backup first, or stay signed in until you're back online." });
        if (!go2) return;
      }
    }
    await A.signOut();
  };
  App.continueAsGuest = function () { ls.set(MODE_KEY, "guest"); useGuest(); go(App.store.settings().startPage || "home", true); };

  // ---------- routing ----------
  const NAV = [
    { name: "home", label: "Home", icon: "home" }, { name: "calendar", label: "Calendar", icon: "calendar" },
    { name: "planner", label: "Planner", icon: "planner" }, { name: "progress", label: "Progress", icon: "chart" }, { name: "focus", label: "Focus", icon: "timer" },
  ];
  App.NAV = NAV;
  function parseHash() {
    const h = location.hash;
    if (!/^#\//.test(h)) return null;
    const parts = h.slice(2).split("/");
    return { name: parts[0] || "home", sub: decodeURIComponent(parts[1] || "") };
  }
  function go(name, replace, sub) {
    const hash = "#/" + name + (sub ? "/" + encodeURIComponent(sub) : "");
    if (replace) history.replaceState(null, "", hash); else if (location.hash !== hash) history.pushState(null, "", hash);
    App.route = { name, sub: sub || "" };
    render(true);
  }
  App.go = go;
  window.addEventListener("popstate", () => { const r = parseHash(); if (r) { App.route = r; render(true); } });
  window.addEventListener("hashchange", () => { const r = parseHash(); if (r && (r.name !== App.route.name || r.sub !== App.route.sub)) { App.route = r; render(true); } });

  // ---------- chrome (sidebar, rail, top bar, tab bar) ----------
  const root = document.getElementById("app");
  const parts = {};
  function navLink(n, cls, counts) {
    const a = el("a", { class: cls, href: "#/" + n.name, "aria-current": App.route.name === n.name ? "page" : null, onclick: (e) => { e.preventDefault(); go(n.name); } }, icon(n.icon), el("span", { text: n.label }));
    if (counts && counts[n.name]) U.add(a, el("span", { class: "count", text: String(counts[n.name]) }));
    return a;
  }
  function syncPill() {
    if (App.mode === "guest") return el("span", { class: "sync-pill", title: "Saved in this browser only" }, icon("monitor"), "This device");
    if (App.mode !== "account" || !App.sync) return null;
    const s = App.sync.status;
    const map = { starting: ["refresh", "Connecting", "", true], syncing: ["refresh", "Syncing", "", true], ok: ["cloud", "Synced", "ok"], pending: ["refresh", "Saving", "", true],
      offline: ["cloudOff", "Offline", "warn"], error: ["alert", "Sync problem", "bad"] };
    const m = map[s] || map.starting, ic = icon(m[0]);
    if (m[3]) ic.classList.add("spin");
    return el("button", { class: "sync-pill " + m[2], type: "button", title: s === "offline" ? "Offline: changes are kept on this device and sent when you're back online." : App.sync.error || "Your homework is saved to your account",
      onclick: () => go("settings", false, "sync") }, ic, m[1]);
  }
  function who() {
    if (App.mode === "account" && A.user) return { name: App.store.profile().name || A.name(), email: A.user.email };
    return { name: App.store ? App.store.profile().name : "", email: "" };
  }
  function renderChrome() {
    const page0 = DB.pages[App.route.name];
    parts.app.classList.toggle("no-chrome", App.route.name === "welcome");
    parts.app.classList.toggle("immersive", !!(page0 && page0.immersive && page0.immersive()));
    if (!App.store) return;
    const w = who(), openCount = App.store.activeTasks().filter((t) => !t.done).length;
    // desktop sidebar
    const subjects = App.store.subjects().map((s) => ({ s, n: App.store.activeTasks().filter((t) => !t.done && t.subject === s).length })).filter((x) => x.n);
    U.fill(parts.sidebar, 
      el("a", { class: "brand", href: "#/home", onclick: (e) => { e.preventDefault(); go("home"); } }, el("span", { class: "brand-mark" }, icon("cap")), el("span", null, el("b", { text: "Due Board" }), el("small", { text: "Homework, sorted" }))),
      U.btn("New homework", { kind: "primary", icon: "plus", onclick: () => App.openTask(null), id: "side-add" }),
      el("nav", { class: "nav-list", "aria-label": "Main" }, NAV.map((n) => navLink(n, "nav-item", { home: openCount }))),
      el("div", { class: "side-section" }, el("div", { class: "eyebrow" }, el("span", { text: "More" })),
        el("div", { class: "nav-list" }, navLink({ name: "archive", label: "Archive", icon: "archive" }, "nav-item"), navLink({ name: "settings", label: "Settings", icon: "settings" }, "nav-item"))),
      subjects.length ? el("div", { class: "side-section" }, el("div", { class: "eyebrow" }, el("span", { text: "Subjects" })),
        el("div", { class: "nav-list" }, subjects.slice(0, 10).map((x) => el("button", { class: "nav-item", type: "button", onclick: () => { App.ui.homeFilter = { subject: x.s }; go("home"); } },
          el("span", { class: "dot", vars: { "--c": App.store.subjectColor(x.s) } }), el("span", { class: "truncate", text: x.s }), el("span", { class: "count", text: String(x.n) }))))) : null,
      el("div", { class: "side-foot" }, syncPill(),
        el("a", { class: "acct-chip", href: "#/settings/account", onclick: (e) => { e.preventDefault(); go("settings", false, "account"); } },
          el("span", { class: "avatar" + (App.mode === "guest" ? " guest" : "") }, App.mode === "guest" && !w.name ? icon("user", 18) : U.initials(w.name, w.email)),
          el("span", { class: "grow" }, el("b", { class: "truncate", style: { display: "block", fontSize: "14px" }, text: w.name || (App.mode === "guest" ? "Guest" : "Your account") }),
            el("span", { class: "truncate xs muted", style: { display: "block" }, text: w.email || (App.mode === "guest" ? "Not signed in" : "") })))));
    // tablet rail
    U.fill(parts.rail, el("span", { class: "brand-mark", "aria-hidden": "true" }, icon("cap")),
      el("button", { class: "rail-add", type: "button", "aria-label": "New homework", title: "New homework (N)", onclick: () => App.openTask(null) }, icon("plus")),
      el("nav", { "aria-label": "Main", style: { display: "contents" } }, NAV.map((n) => navLink(n, "tab"))),
      el("span", { class: "spacer" }), navLink({ name: "archive", label: "Archive", icon: "archive" }, "tab"), navLink({ name: "settings", label: "Settings", icon: "settings" }, "tab"));
    // top bar
    const page = DB.pages[App.route.name];
    U.fill(parts.topbar, 
      el("span", { class: "page-title", text: page ? page.title : "" }),
      el("button", { class: "search-box", type: "button", onclick: () => DB.search.open(), "aria-label": "Search homework" }, icon("search"), el("span", { text: "Search homework" }), el("kbd", { text: "/" })),
      syncPill() && window.innerWidth >= 720 && window.innerWidth < 1100 ? syncPill() : null,
      U.iconBtn("search", "Search", () => DB.search.open(), { class: "icon-btn search-only" }),
      U.iconBtn(document.documentElement.getAttribute("data-theme") === "light" ? "moon" : "sun", "Switch to " + (document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light") + " mode", () => {
        const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light"; App.store.setSettings({ theme: next });
      }),
      window.innerWidth < 720 ? U.iconBtn("settings", "Settings", () => go("settings")) : null);
    // phone tab bar
    U.fill(parts.tabbar, ...NAV.map((n) => navLink(n, "tab")));
  }
  function buildFrame() {
    parts.app = el("div", { class: "app" });
    parts.sidebar = el("aside", { class: "sidebar", "aria-label": "Sidebar" });
    parts.rail = el("aside", { class: "rail", "aria-label": "Navigation" });
    parts.topbar = el("header", { class: "topbar" });
    parts.main = el("main", { class: "main", id: "main", tabindex: "-1" });
    parts.tabbar = el("nav", { class: "tabbar", "aria-label": "Main" });
    parts.fab = el("button", { class: "fab", type: "button", "aria-label": "New homework", onclick: () => App.openTask(null) }, icon("plus"));
    U.add(parts.app, el("a", { class: "skip", href: "#main", onclick: (e) => { e.preventDefault(); parts.main.focus(); } }, "Skip to content"), parts.sidebar, parts.rail, parts.topbar, parts.main, parts.tabbar, parts.fab);
    U.fill(root, parts.app);
    window.addEventListener("scroll", () => parts.topbar.classList.toggle("scrolled", window.scrollY > 4), { passive: true });
    let lastW = window.innerWidth;
    window.addEventListener("resize", () => { const w = window.innerWidth; if ((w < 720) !== (lastW < 720) || (w < 1100) !== (lastW < 1100) || (w < 900) !== (lastW < 900)) { lastW = w; render(); } });
  }

  // ---------- rendering ----------
  let pending = false;
  // Several changes in one go draw once. (A microtask, not requestAnimationFrame, which pauses in background tabs.)
  function scheduleRender() { if (pending) return; pending = true; queueMicrotask(() => { pending = false; render(); }); }
  App.render = scheduleRender;
  function render(routeChanged) {
    if (!parts.main) return;
    if (!App.store && App.route.name !== "welcome") { go("welcome", true); return; }
    if (App.route.name !== "welcome" && !DB.pages[App.route.name]) App.route = { name: "home", sub: "" };
    const page = DB.pages[App.route.name];
    renderChrome();
    if (document.querySelector("dialog[open] .sheet.editing") && !routeChanged) return;   // don't redraw under an open editor
    const sameScreen = !routeChanged && parts.main.getAttribute("data-route") === App.route.name + "/" + App.route.sub;
    parts.main.setAttribute("data-route", App.route.name + "/" + App.route.sub);
    const draw = (fn) => (sameScreen ? U.keepTyping(parts.main, fn) : fn());
    draw(() => U.keepFocus(() => {
      const frag = el("div", { class: "page page-" + App.route.name });
      const banners = storageBanners();
      if (banners) U.add(frag, banners);
      if (App.route.name !== "focus" && App.route.name !== "welcome" && DB.focus) { const b = DB.focus.banner(); if (b) U.add(frag, b); }
      page.render(frag, App.ctx());
      U.fill(parts.main, frag);
    }));
    if (routeChanged) {
      window.scrollTo(0, 0);
      document.title = (page && page.title ? page.title + " · " : "") + "Due Board";
      if (App.route.name !== "welcome" && document.activeElement === document.body) parts.main.focus({ preventScroll: true });
    }
  }
  function storageBanners() {
    if (!App.store) return null;
    const out = el("div");
    if (!App.persistent) U.add(out, U.banner("bad", "alert", "This browser isn't letting Due Board save.", "Changes last only until you close this tab (private browsing or blocked site data). Download a backup from Settings, or allow site data."));
    else if (App.store.saveError === "full") U.add(out, U.banner("bad", "alert", "This device's storage is full, so the latest changes aren't saved here yet.", "Download a backup now (Settings → Data) and free some space.", [U.btn("Download backup", { size: "sm", onclick: () => DB.settings.backupNow() })]));
    else if (App.store.saveError) U.add(out, U.banner("bad", "alert", "Changes couldn't be saved on this device.", "Download a backup to keep them safe."));
    if (App.store.problem === "corrupt") U.add(out, U.banner("warn", "info", "Some saved data couldn't be read.", "It was kept aside untouched. If something is missing, restore a backup from Settings → Data.", [U.btn("Dismiss", { size: "sm", onclick: () => { App.store.problem = null; render(); } })]));
    if (App.sync && App.sync.status === "error") U.add(out, U.banner("warn", "cloudOff", "Sync paused.", App.sync.error + " Your changes are kept on this device.", [U.btn("Try again", { size: "sm", onclick: () => App.sync.now() })]));
    return out.children.length ? out : null;
  }

  // ---------- shared actions ----------
  App.ctx = () => ({ now: App.now(), store: App.store, open: App.openTask, complete: App.complete, focus: (id) => DB.focus.openFor(id), more: App.taskMenu, ui: App.ui });
  App.openTask = (id, preset) => DB.editor.open(id, preset);
  App.complete = function (id, done) {
    const t = App.store.task(id);
    if (!t) return;
    const r = App.store.complete(id, done);
    if (!r) return;
    if (done) {
      const parts2 = [];
      if (r.bonusGained) parts2.push("+" + r.bonusGained + " daily bonus");
      if (r.next) parts2.push("Next one added for " + C.fmtDay(r.next.due));
      U.toast((r.pts ? "+" + r.pts + " points · " : "") + (r.how === "early" ? "Finished early" : r.how === "late" ? "Done, a bit late" : "Done on time"),
        { icon: "check", detail: parts2.join(" · ") || null, undo: () => App.store.undo() });
      if (r.levelUp) U.toast("Level " + r.levelUp.level + ": " + r.levelUp.title + "!", { icon: "star", detail: "You levelled up." });
      (r.newAchievements || []).forEach((a) => U.toast("Achievement: " + a.name, { icon: "trophy", detail: a.desc }));
    } else U.toast("Marked not done", { icon: "undo", undo: () => App.store.undo() });
  };
  App.remove = function (id) { const t = App.store.task(id); App.store.remove(id); U.toast("Deleted “" + (t ? t.title : "") + "”", { icon: "trash", detail: "Find it in Archive → Deleted.", undo: () => App.store.undo() }); };
  App.archive = function (id) { App.store.archive(id); U.toast("Archived", { icon: "archive", undo: () => App.store.undo() }); };
  App.taskMenu = function (t, anchor) {
    const items = [{ label: "Open", icon: "edit", run: () => App.openTask(t.id) }];
    if (!t.done) items.push({ label: "Start focus", icon: "timer", run: () => DB.focus.openFor(t.id) });
    items.push({ label: t.done ? "Mark not done" : "Mark done", icon: t.done ? "undo" : "check", run: () => App.complete(t.id, !t.done) });
    if (!t.done) {
      items.push("-", { label: "Plan for today", icon: "planner", run: () => { App.store.patchTask(t.id, { plan: C.dayKey(App.now()) }, "Planned"); U.toast("Planned for today", { undo: () => App.store.undo() }); } },
        { label: "Plan for tomorrow", icon: "planner", run: () => { App.store.patchTask(t.id, { plan: C.dayKey(C.addDays(App.now(), 1)) }, "Planned"); U.toast("Planned for tomorrow", { undo: () => App.store.undo() }); } });
    }
    items.push({ label: "Duplicate", icon: "layers", run: () => { const copy = Object.assign({}, t, { id: "", done: false, doneAt: 0, pts: 0, bonus: 0, source: "manual", feedKey: "", mb: null, edited: {}, title: t.title + " (copy)" }); App.store.saveTask(copy); U.toast("Duplicated", { undo: () => App.store.undo() }); } },
      { label: "Add to Google Calendar", icon: "external", run: () => window.open(C.gcalUrl(t), "_blank", "noopener") }, "-",
      { label: "Archive", icon: "archive", run: () => App.archive(t.id) }, { label: "Delete", icon: "trash", danger: true, run: () => App.remove(t.id) });
    U.menu(anchor, items);
  };

  // ---------- reminders (while the app is open) ----------
  let fired = {};
  try { fired = JSON.parse(ls.get(FIRED_KEY) || "{}") || {}; } catch (e) { fired = {}; }
  App.notifySupported = () => typeof Notification !== "undefined";
  function checkReminders(quiet) {
    if (!App.store) return;
    const now = App.now(), st = App.store.settings(), due = [];
    App.store.activeTasks().forEach((t) => {
      if (t.done || t.due < now) return;
      const leads = t.reminders === null ? (st.remindDefault ? st.leads : []) : t.reminders;
      leads.forEach((h) => {
        const k = t.id + "|" + h + "|" + t.due;
        if (fired[k] || t.due - now > h * C.HOUR) return;
        fired[k] = now; due.push(t);
      });
    });
    if (!due.length) return;
    const cut = now - 7 * C.DAY;
    Object.keys(fired).forEach((k) => { if (fired[k] < cut) delete fired[k]; });
    ls.set(FIRED_KEY, JSON.stringify(fired));
    const uniq = due.filter((t, i) => due.indexOf(t) === i);
    if (quiet && uniq.length > 2) { U.toast(uniq.length + " deadlines are coming up", { icon: "bell", detail: uniq.slice(0, 3).map((t) => t.title).join(", ") }); return; }
    uniq.forEach((t) => {
      const text = "Due " + C.countdown(t.due - now) + ": " + t.title;
      if (st.notify && App.notifySupported() && Notification.permission === "granted" && document.hidden) {
        try { new Notification(text, { body: [t.subject, C.dueLabel(t)].filter(Boolean).join(" · "), tag: t.id }); } catch (e) { U.toast(text, { icon: "bell" }); }
      } else U.toast(text, { icon: "bell", action: { label: "Open", run: () => App.openTask(t.id) } });
    });
  }
  App.checkReminders = checkReminders;

  // ---------- ManageBac auto-sync through the student's own Google Apps Script relay ----------
  let mbLast = 0, mbBusy = false;
  App.syncManageBac = async function (manual) {
    const url = App.store && App.store.settings().syncUrl;
    if (!url || mbBusy) return null;
    mbBusy = true; mbLast = Date.now(); App.mbStatus = "Syncing with ManageBac…"; renderChrome();
    try {
      const r = await fetch(url, { cache: "no-store", credentials: "omit" });
      if (!r.ok) throw new Error("http");
      const text = await r.text();
      if (text.indexOf("BEGIN:VCALENDAR") === -1) throw new Error("notcal");
      const res = App.store.importFeed(text, { full: true, label: "ManageBac sync" });
      const c = res.counts;
      App.mbStatus = "Synced at " + C.fmtTime(Date.now()) + ": " + c.added + " new, " + c.updated + " updated" + (c.removed + c.cancelled ? ", " + (c.removed + c.cancelled) + " set aside" : "") + ".";
      if (manual || c.added || c.removed || c.cancelled) U.toast("ManageBac: " + c.added + " new, " + c.updated + " updated" + (c.removed + c.cancelled ? ", " + (c.removed + c.cancelled) + " moved to the archive" : ""), { icon: "cap", undo: res.changed ? () => App.store.undo() : null });
      return res;
    } catch (e) {
      const m = e && e.message;
      App.mbStatus = m === "notcal" ? "The sync address answered, but not with a calendar. Check the key at the end of the address and that the web app is shared with Anyone."
        : m === "http" ? "The sync address returned an error. Check that the web app is deployed and shared with Anyone." : "Couldn't reach the sync address. Check your connection.";
      if (manual) U.toast(App.mbStatus, { icon: "alert" });
      return null;
    } finally { mbBusy = false; scheduleRender(); }
  };
  function maybeSyncManageBac() { if (App.store && App.store.settings().syncUrl && Date.now() - mbLast > 15 * 60000 && navigator.onLine) App.syncManageBac(false); }

  // ---------- keyboard ----------
  document.addEventListener("keydown", (e) => {
    if (!App.store || App.route.name === "welcome" || document.querySelector("dialog[open]")) return;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
    if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); DB.search.open(); return; }
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "/") { e.preventDefault(); DB.search.open(); }
    else if (e.key === "n" || e.key === "N") { e.preventDefault(); App.openTask(null); }
    else if (e.key === "?") { e.preventDefault(); shortcuts(); }
    else if (/^[1-5]$/.test(e.key)) { go(NAV[+e.key - 1].name); }
  });
  function shortcuts() {
    const s = U.sheet({ title: "Keyboard shortcuts", narrow: true, foot: false });
    const rows = [["N", "New homework"], ["/ or Ctrl K", "Search"], ["1 – 5", "Home, Calendar, Planner, Progress, Focus"], ["Esc", "Close a panel"], ["?", "This list"]];
    U.add(s.body, el("table", { class: "data" }, rows.map((r) => el("tr", null, el("td", null, el("kbd", { text: r[0] })), el("td", { text: r[1] })))));
    s.open();
  }

  // ---------- background ----------
  setInterval(() => { checkReminders(false); maybeSyncManageBac(); if (!document.hidden && !document.querySelector("dialog[open]")) scheduleRender(); }, 30000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { checkReminders(false); maybeSyncManageBac(); scheduleRender(); } });
  window.addEventListener("storage", (e) => { if (App.store && e.key === App.store.key) App.store.mergeFromStorage(); });

  // ---------- start ----------
  async function boot() {
    buildFrame();
    App.applyTheme();
    let user = null;
    if (A.available) {
      try { user = await A.init(); } catch (e) { user = null; }
    }
    const r = parseHash();
    if (r) App.route = r;
    const hadLegacy = !!ls.get(St.KEYS.legacy) || !!ls.get(St.KEYS.guest);
    if (user) { ls.set(MODE_KEY, "account"); useAccount(user); }
    else if (!A.available || ls.get(MODE_KEY) === "guest" || (hadLegacy && ls.get(MODE_KEY) !== "account")) { ls.set(MODE_KEY, "guest"); useGuest(); }
    else { App.mode = "none"; App.route = { name: "welcome", sub: "" }; history.replaceState(null, "", "#/welcome"); render(true); }
    if (App.store && (App.route.name === "welcome" || !r)) go(App.store.settings().startPage || "home", true);
    else render(true);
    if (A.recovery && A.user && DB.auth) DB.auth.newPasswordDialog();
    if (A.linkError) U.toast(/expired|invalid/i.test(A.linkError) ? "That email link has expired or was already used. Ask for a new one." : "That email link didn't work: " + A.linkError, { icon: "alert", ms: 10000 });
    else if (A.user && (A.linkType === "signup" || A.linkType === "email_change")) U.toast(A.linkType === "signup" ? "Email confirmed. Welcome to Due Board!" : "Your email address is updated.", { icon: "check" });
    if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol) && !window.DUEBOARD_NO_SW) navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  App.boot = boot;
  document.addEventListener("DOMContentLoaded", boot);
})();
