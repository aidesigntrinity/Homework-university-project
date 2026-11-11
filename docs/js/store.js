/* Due Board data store. Holds homework (tasks), focus sessions and settings as separate items, each
   stamped with the time it was last changed (mod). Saving is per item, so two devices editing different
   homework never overwrite each other, and an older copy never replaces a newer one.
   Nothing is ever silently removed: deleting, cancelling or archiving only sets a flag. */
(function (root) {
  "use strict";
  const C = root.DB && root.DB.core ? root.DB.core : require("./core.js");
  const { DAY, HOUR } = C;
  const VERSION = 4;
  const KEYS = {
    guest: "dueboard:v4:guest", user: (uid) => "dueboard:v4:u:" + uid,
    legacy: "dueboard:v1", legacyBackup: "dueboard:v1:before-upgrade", focus: "dueboard:focus", theme: "dueboard:theme",
  };
  // Subject colours: eight hues checked for colour-blind separation on both themes (values live in the CSS).
  const PALETTE = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)", "var(--c6)", "var(--c7)", "var(--c8)"];

  // ---------- validation (local data, synced rows and backups all pass through here) ----------
  const str = (v, n) => String(v == null ? "" : v).slice(0, n);
  const int = (v, lo, hi, d) => { v = Math.floor(+v); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
  const time = (v) => (typeof v === "number" && isFinite(v) && v > 0 && v < 8e15 ? v : 0);
  function defaultSettings() {
    return {
      theme: "system", startPage: "home", weekStart: 1, density: "comfortable",
      leads: [24, 3, 0.5], notify: false, remindDefault: true, reminderSound: true, ignore: [], syncUrl: "", removeMissing: true,
      pts: Object.assign({}, C.DEFAULT_PTS), names: C.DEFAULT_NAMES.slice(), subjectColors: {},
      focus: { mins: 25, pomodoro: false, cycles: 4, short: 5, long: 15, sound: true },
      goals: { daily: 60, weekly: 300 }, capacity: 120, defaultEst: 30, homeSort: "due", mod: 0,
    };
  }
  function cleanSettings(s) {
    const o = defaultSettings();
    if (!s || typeof s !== "object") return o;
    if (["system", "dark", "light"].indexOf(s.theme) !== -1) o.theme = s.theme;
    if (["home", "calendar", "planner", "progress", "focus"].indexOf(s.startPage) !== -1) o.startPage = s.startPage;
    if (s.weekStart === 0 || s.weekStart === 1) o.weekStart = s.weekStart;
    if (s.density === "compact") o.density = "compact";
    if (Array.isArray(s.leads)) o.leads = C.cleanLeads(s.leads);
    o.notify = !!s.notify; o.remindDefault = s.remindDefault !== false; o.reminderSound = s.reminderSound !== false; o.removeMissing = s.removeMissing !== false;
    if (Array.isArray(s.ignore)) o.ignore = s.ignore.map((w) => str(w, 40).trim()).filter(Boolean).slice(0, 30);
    o.syncUrl = C.isSyncUrl(s.syncUrl) ? s.syncUrl : "";
    if (s.pts && typeof s.pts === "object") ["early", "onTime", "late", "streak"].forEach((k) => { o.pts[k] = int(s.pts[k], 0, 100, o.pts[k]); });
    if (Array.isArray(s.names)) { const n = s.names.map((x) => str(x, 24).trim()).filter(Boolean).slice(0, 12); if (n.length) o.names = n; }
    if (s.subjectColors && typeof s.subjectColors === "object") Object.keys(s.subjectColors).slice(0, 80).forEach((k) => { const v = int(s.subjectColors[k], 0, PALETTE.length - 1, -1); if (v >= 0) o.subjectColors[str(k, 40).toLowerCase()] = v; });
    const f = s.focus || {};
    o.focus = { mins: int(f.mins, 5, 180, 25), pomodoro: !!f.pomodoro, cycles: int(f.cycles, 1, 8, 4), short: int(f.short, 1, 30, 5), long: int(f.long, 5, 60, 15), sound: f.sound !== false };
    const g = s.goals || {};
    o.goals = { daily: int(g.daily, 0, 720, 60), weekly: int(g.weekly, 0, 5000, 300) };
    o.capacity = int(s.capacity, 15, 720, 120); o.defaultEst = int(s.defaultEst, 5, 600, 30);
    if (C.sortTasks && ["due", "priority", "subject", "title", "created"].indexOf(s.homeSort) !== -1) o.homeSort = s.homeSort;
    o.mod = time(s.mod);
    return o;
  }
  function cleanTask(x, id) {
    if (!x || typeof x !== "object") return null;
    const t = C.blankTask();
    t.id = str(id || x.id, 80);
    if (!t.id) return null;
    t.mod = time(x.mod); t.created = time(x.created);
    t.deleted = time(x.deleted); t.purged = x.purged ? 1 : 0;
    if (t.purged && !x.done) { t.title = "(deleted)"; t.due = time(x.due) || t.mod || 1; return t; }
    if (typeof x.title !== "string" || !time(x.due)) return null;
    t.title = str(x.title, 200); t.subject = str(x.subject, 40).trim(); t.due = x.due; t.allDay = !!x.allDay;
    t.priority = int(x.priority, 0, 3, 0); t.est = int(x.est, 0, 1440, 0); t.notes = str(x.notes, 4000);
    t.subtasks = Array.isArray(x.subtasks) ? x.subtasks.slice(0, 50).map((s) => ({ id: str(s && s.id, 40) || C.newId("s"), text: str(s && s.text, 200), done: !!(s && s.done), due: time(s && s.due) })).filter((s) => s.text) : [];
    t.links = Array.isArray(x.links) ? x.links.slice(0, 12).map((l) => ({ url: C.safeUrl(l && l.url), title: str(l && l.title, 120) })).filter((l) => l.url) : [];
    t.reminders = Array.isArray(x.reminders) ? C.cleanLeads(x.reminders) : null;
    t.source = x.source === "managebac" ? "managebac" : "manual";
    t.feedKey = str(x.feedKey, 300); t.url = C.safeUrl(x.url);
    t.mb = x.mb && typeof x.mb === "object" ? { title: str(x.mb.title, 200), subject: str(x.mb.subject, 40), due: time(x.mb.due), allDay: !!x.mb.allDay, notes: str(x.mb.notes, 4000) } : null;
    t.edited = {}; if (x.edited && typeof x.edited === "object") C.MB_FIELDS.forEach((f) => { if (x.edited[f]) t.edited[f] = 1; });
    t.kind = x.kind === "exam" ? "exam" : "homework";
    t.recur = x.recur && C.RECUR[x.recur.freq] ? { freq: x.recur.freq, until: time(x.recur.until) } : null;
    t.series = str(x.series, 80); t.plan = /^\d{4}-\d{2}-\d{2}$/.test(x.plan || "") ? x.plan : "";
    t.done = !!x.done; t.doneAt = t.done ? time(x.doneAt) : 0;
    t.pts = t.done ? int(x.pts, 0, 1000, 0) : 0; t.bonus = t.done ? int(x.bonus, 0, 100, 0) : 0;
    t.remaining = str(x.remaining, 600);
    t.archived = time(x.archived); t.removed = time(x.removed); t.cancelled = time(x.cancelled);
    t.historyOnly = x.historyOnly ? 1 : 0;
    return t;
  }
  function cleanSession(x, id) {
    if (!x || typeof x !== "object") return null;
    const s = { id: str(id || x.id, 80), start: time(x.start), end: time(x.end), mins: int(x.mins, 0, 600, 0), taskId: str(x.taskId, 80), title: str(x.title, 200),
      subject: str(x.subject, 40), note: str(x.note, 300), result: ["complete", "left", "none", ""].indexOf(x.result) !== -1 ? x.result : "", deleted: time(x.deleted), mod: time(x.mod) };
    return s.id && s.end ? s : null;
  }
  function cleanMeta(id, x) {
    if (!x || typeof x !== "object") return null;
    if (id === "settings") return cleanSettings(x);
    if (id === "profile") return { name: str(x.name, 60).trim(), mod: time(x.mod) };
    if (/^carry:/.test(id)) return { pts: int(x.pts, 0, 1000000, 0), best: int(x.best, 0, 10000, 0), done: int(x.done, 0, 100000, 0), mod: time(x.mod) };
    return null;
  }
  function cleanItem(kind, id, data) {
    if (kind === "task") return cleanTask(data, id);
    if (kind === "session") return cleanSession(data, id);
    if (kind === "meta") return cleanMeta(id, data);
    return null;
  }
  const emptyData = () => ({ tasks: {}, sessions: {}, meta: { settings: defaultSettings(), profile: { name: "", mod: 0 } } });

  // ---------- upgrading data saved by earlier versions (one list, a points counter and a trimmed log) ----------
  function isLegacy(d) { return d && typeof d === "object" && d.tasks && typeof d.tasks === "object" && d.v !== VERSION && !d.items; }
  function migrateLegacy(old, now) {
    now = now || Date.now();
    const out = emptyData(), byDay = {};
    const log = Array.isArray(old.log) ? old.log.filter((e) => e && typeof e.at === "number") : [];
    Object.keys(old.tasks || {}).forEach((id) => {
      const x = old.tasks[id];
      if (!x || typeof x.title !== "string" || typeof x.due !== "number") return;
      const t = cleanTask({ id, title: x.title, subject: x.subject, due: x.due, allDay: x.allDay, notes: x.notes, done: x.done, doneAt: x.doneAt, pts: x.pts,
        source: x.src === "managebac" ? "managebac" : "manual", url: x.link, reminders: x.remind === false ? [] : null, remaining: x.remaining, created: now, mod: now }, id);
      if (t) out.tasks[t.id] = t;
    });
    // Finished homework the old version had already cleared away still shows in history and keeps its points.
    log.filter((e) => e.k === "t").forEach((e) => {
      if (e.task && out.tasks[e.task] && out.tasks[e.task].done) return;
      const id = "h-" + C.hash((e.task || "") + "|" + e.at);
      const due = e.how === "early" ? e.at + 2 * DAY : e.how === "late" ? e.at - HOUR : e.at + HOUR;
      out.tasks[id] = cleanTask({ id, title: e.title || "Homework", subject: e.subject, due, done: true, doneAt: e.at, pts: e.pts, historyOnly: 1, created: e.at, mod: now }, id);
    });
    // Daily bonuses: keep each day's bonus on that day's first finished task.
    const bonus = {};
    log.filter((e) => e.k === "b" && e.day).forEach((e) => { bonus[e.day] = (bonus[e.day] || 0) + (e.pts || 0); });
    Object.values(out.tasks).filter((t) => t.done && t.doneAt).sort((a, b) => a.doneAt - b.doneAt).forEach((t) => {
      const k = C.dayKey(t.doneAt);
      if (byDay[k]) { t.bonus = 0; return; }
      byDay[k] = 1; t.bonus = Math.min(100, bonus[k] || 0);
    });
    log.filter((e) => e.k === "f" && e.mins > 0).forEach((e) => {
      const id = "f-" + C.hash((e.task || "") + "|" + e.at);
      out.sessions[id] = cleanSession({ id, start: e.at - e.mins * 60000, end: e.at, mins: e.mins, taskId: e.task, title: e.title, subject: e.subject, mod: now }, id);
    });
    const st = old.settings || {};
    out.meta.settings = cleanSettings({ leads: st.leads, ignore: st.ignore, notify: st.notify, syncUrl: st.syncUrl, pts: st.pts, names: st.names,
      subjectColors: st.subjectColors, remindDefault: st.remindDefault, mod: now });
    out.meta.profile = { name: str(old.profile && old.profile.name, 60), mod: now };
    // Whatever the old points counter held beyond what the kept history explains is carried over, so no points are lost.
    const derived = C.computeStats(out.tasks, out.sessions, {}, out.meta.settings, now);
    const oldPts = int(old.points, 0, 1000000, 0), oldStats = old.stats || {};
    out.meta["carry:" + C.hash("legacy|" + now)] = { pts: Math.max(0, oldPts - derived.points), best: int(oldStats.best, 0, 10000, 0),
      done: Math.max(0, int(oldStats.done, 0, 100000, 0) - derived.doneCount), mod: now };
    return out;
  }

  // ---------- the store ----------
  function createStore(opts) {
    const storage = opts.storage, key = opts.key, now = opts.now || Date.now;
    const listeners = [];
    const S = {
      key, data: emptyData(), pending: {}, cursor: "", problem: null, saveError: null, lastSaved: 0,
      on(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
    };
    let batchLog = null;
    const emit = (what) => listeners.slice().forEach((fn) => { try { fn(what || "change"); } catch (e) { setTimeout(() => { throw e; }); } });
    const bucket = (kind) => (kind === "task" ? S.data.tasks : kind === "session" ? S.data.sessions : S.data.meta);
    const ref = (kind, id) => kind + ":" + id;

    S.load = function () {
      let raw = null;
      S.problem = null;
      try { raw = storage.getItem(key); } catch (e) { S.problem = "unavailable"; }
      S.data = emptyData(); S.pending = {}; S.cursor = "";
      if (!raw) return S;
      let blob;
      try { blob = JSON.parse(raw); } catch (e) { blob = null; }
      if (!blob || blob.v !== VERSION || !blob.data) {
        // Keep the unreadable copy aside instead of overwriting it.
        try { storage.setItem(key + ":unreadable:" + now(), raw); } catch (e) { /* no room: it stays under its own key until the next save */ }
        S.problem = "corrupt";
        return S;
      }
      readBlob(blob, true);
      lastWritten = raw;
      return S;
    };
    function readBlob(blob, replace) {
      const d = blob.data || {};
      if (replace) { S.data = emptyData(); S.pending = {}; }
      ["task", "session", "meta"].forEach((kind) => {
        const src = d[kind === "task" ? "tasks" : kind === "session" ? "sessions" : "meta"] || {};
        Object.keys(src).forEach((id) => {
          const item = cleanItem(kind, id, src[id]);
          if (!item) return;
          const cur = bucket(kind)[id];
          if (replace || !cur || (item.mod || 0) > (cur.mod || 0)) {
            bucket(kind)[id] = item;
            if (blob.pending && blob.pending[ref(kind, id)]) S.pending[ref(kind, id)] = true;
          }
        });
      });
      if (replace) S.cursor = typeof blob.cursor === "string" ? blob.cursor : "";
    }
    let lastWritten = null;
    S.save = function () {
      // Another tab may have saved since we last did: take its newer items first, so tabs never overwrite each other.
      try {
        const cur = storage.getItem(key);
        if (cur && cur !== lastWritten) { const b = JSON.parse(cur); if (b && b.v === VERSION && b.data) readBlob(b, false); }
      } catch (e) { /* unreadable copies were already kept aside when loading */ }
      const blob = { v: VERSION, savedAt: now(), data: S.data, pending: S.pending, cursor: S.cursor };
      try {
        const out = JSON.stringify(blob);
        storage.setItem(key, out);
        lastWritten = out;
        if (S.saveError) { S.saveError = null; emit("storage"); }
        S.lastSaved = blob.savedAt;
        return true;
      } catch (e) {
        S.saveError = e && (e.name === "QuotaExceededError" || e.code === 22 || e.code === 1014) ? "full" : "blocked";
        emit("storage");
        return false;
      }
    };
    // Another tab saved: take whatever is newer there.
    S.mergeFromStorage = function () {
      let blob;
      try { blob = JSON.parse(storage.getItem(key) || "null"); } catch (e) { blob = null; }
      if (!blob || blob.v !== VERSION) return false;
      const before = JSON.stringify(S.data);
      readBlob(blob, false);
      if (JSON.stringify(S.data) === before) return false;
      emit("remote");
      return true;
    };

    // ---------- reading ----------
    S.settings = () => S.data.meta.settings || defaultSettings();
    S.profile = () => S.data.meta.profile || { name: "" };
    S.carry = () => { const o = {}; Object.keys(S.data.meta).forEach((k) => { if (/^carry:/.test(k)) o[k] = S.data.meta[k]; }); return o; };
    S.task = (id) => S.data.tasks[id] || null;
    S.tasks = () => Object.values(S.data.tasks);
    S.activeTasks = () => S.tasks().filter(C.isActive);
    S.sessions = () => Object.values(S.data.sessions).filter((s) => !s.deleted);
    S.stats = (at) => C.computeStats(S.data.tasks, S.data.sessions, S.carry(), S.settings(), at || now());
    S.subjects = function () {
      const seen = {}, out = [];
      S.tasks().forEach((t) => { if (t.subject && !t.purged && !seen[t.subject.toLowerCase()]) { seen[t.subject.toLowerCase()] = 1; out.push(t.subject); } });
      return out.sort((a, b) => a.localeCompare(b));
    };
    S.subjectColor = function (s) {
      if (!s) return "var(--muted)";
      const k = s.toLowerCase(), m = S.settings().subjectColors;
      return PALETTE[k in m ? m[k] : C.cyrb53(k) % PALETTE.length];
    };

    // ---------- writing ----------
    function stamp(cur) { return Math.max(now(), ((cur && cur.mod) || 0) + 1); }
    function write(kind, id, item) {
      const b = bucket(kind), r = ref(kind, id);
      if (batchLog && !(r in batchLog)) batchLog[r] = b[id] ? JSON.parse(JSON.stringify(b[id])) : null;
      item.mod = stamp(b[id]);
      b[id] = item;
      S.pending[r] = true;
    }
    // Each new subject takes the next unused colour and keeps it (colour follows the subject, not its position).
    function ensureColor(subject) {
      if (!subject) return;
      const st = S.settings(), k = subject.toLowerCase();
      if (k in st.subjectColors) return;
      const used = Object.values(st.subjectColors), counts = PALETTE.map((_, i) => used.filter((u) => u === i).length);
      const idx = counts.indexOf(Math.min(...counts));
      const next = Object.assign({}, st, { subjectColors: Object.assign({}, st.subjectColors, { [k]: idx }) });
      write("meta", "settings", cleanSettings(next));
    }
    S.put = function (kind, id, data) {
      const item = cleanItem(kind, id, Object.assign({}, data, { mod: 1 }));
      if (!item) throw new Error("Invalid " + kind);
      write(kind, id, item);
      if (kind === "task" && Object.keys(S.settings().subjectColors).length < 80) ensureColor(item.subject);
      if (!batchLog) { S.save(); emit("change"); }
      return item;
    };
    // Group changes into one step that a single Undo reverses.
    S.batch = function (label, fn) {
      if (batchLog) return fn();
      batchLog = {};
      let result;
      try { result = fn(); } finally {
        const log = batchLog; batchLog = null;
        S.lastUndo = Object.keys(log).length ? { label, log, at: now() } : S.lastUndo;
        S.save(); emit("change");
      }
      return result;
    };
    S.undo = function (token) {
      const u = token || S.lastUndo;
      if (!u) return false;
      Object.keys(u.log).forEach((r) => {
        const i = r.indexOf(":"), kind = r.slice(0, i), id = r.slice(i + 1), before = u.log[r], b = bucket(kind);
        if (before) write(kind, id, cleanItem(kind, id, before));
        else if (kind === "task" && b[id]) write(kind, id, cleanItem(kind, id, { id, purged: 1, deleted: now(), due: b[id].due, mod: 1 }));
        else if (kind === "session" && b[id]) write(kind, id, Object.assign({}, b[id], { deleted: now() }));
      });
      if (S.lastUndo === u) S.lastUndo = null;
      S.save(); emit("change");
      return true;
    };

    S.setSettings = function (patch) { return S.put("meta", "settings", Object.assign({}, S.settings(), patch)); };
    S.setProfile = function (patch) { return S.put("meta", "profile", Object.assign({}, S.profile(), patch)); };

    // Save homework from the editor. Fields the student changes on a ManageBac item are remembered
    // so the next sync does not overwrite them.
    S.saveTask = function (t) {
      const cur = S.task(t.id);
      const next = Object.assign({}, cur || C.blankTask(), t);
      if (!next.id) next.id = C.newId("t");
      if (!cur) next.created = now();
      if (cur && cur.source === "managebac") {
        next.edited = Object.assign({}, cur.edited);
        C.MB_FIELDS.forEach((f) => { if (t[f] !== undefined && t[f] !== cur[f] && !(cur.mb && cur.mb[f] === t[f])) next.edited[f] = 1; });
        C.MB_FIELDS.forEach((f) => { if (cur.mb && next[f] === cur.mb[f]) delete next.edited[f]; });
      }
      return S.batch(cur ? "Saved" : "Added", () => S.put("task", next.id, next));
    };
    S.patchTask = function (id, patch, label) {
      const cur = S.task(id);
      if (!cur) return null;
      return S.batch(label || "Changed", () => S.put("task", id, Object.assign({}, cur, patch)));
    };
    // Bring back ManageBac's own values for fields the student had changed.
    S.resetToManageBac = function (id) {
      const cur = S.task(id);
      if (!cur || !cur.mb) return null;
      const patch = { edited: {} };
      C.MB_FIELDS.forEach((f) => { if (cur.mb[f] !== undefined && (f !== "due" || cur.mb.due)) patch[f] = cur.mb[f]; });
      return S.patchTask(id, patch, "Reset to ManageBac");
    };
    // Finish or reopen homework. Points are fixed at the moment of finishing; repeating homework gets its next copy.
    S.complete = function (id, done) {
      const cur = S.task(id);
      if (!cur || !!cur.done === !!done) return null;
      const at = now(), cfg = S.settings().pts, before = S.stats(at);
      let result = null;
      S.batch(done ? "Marked done" : "Marked not done", () => {
        const t = Object.assign({}, cur);
        if (done) {
          t.done = true; t.doneAt = at; t.pts = C.pointsFor(t.due, at, cfg); t.bonus = cfg.streak;
          const nxt = C.nextInstance(t, at);
          if (nxt && !S.task(nxt.id)) S.put("task", nxt.id, nxt);
          result = { pts: t.pts, how: C.howFor(t.due, at), next: nxt };
        } else { t.done = false; t.doneAt = 0; t.pts = 0; t.bonus = 0; result = {}; }
        S.put("task", id, t);
      });
      const after = S.stats(at);
      result.gained = after.points - before.points;
      result.bonusGained = done ? Math.max(0, result.gained - (result.pts || 0)) : 0;
      result.levelUp = after.level.level > before.level.level ? after.level : null;
      result.newAchievements = C.achievements(after).filter((a, i) => a.earned && !C.achievements(before)[i].earned);
      return result;
    };
    S.remove = function (id) { const t = S.task(id); if (!t) return; S.patchTask(id, { deleted: now() }, "Deleted"); };
    S.archive = function (id) { S.patchTask(id, { archived: now() }, "Archived"); };
    S.restore = function (id) { S.patchTask(id, { deleted: 0, archived: 0, removed: 0, cancelled: 0 }, "Restored"); };
    // Permanent removal from the archive. Finished work keeps a minimal record so its points stay.
    S.purge = function (id) {
      const t = S.task(id);
      if (!t) return;
      S.batch("Deleted for good", () => {
        if (t.done && t.doneAt) S.put("task", id, { id, title: t.title, subject: t.subject, due: t.due, done: true, doneAt: t.doneAt, pts: t.pts, bonus: t.bonus, historyOnly: 1, created: t.created });
        else S.put("task", id, { id, purged: 1, deleted: now(), due: t.due });
      });
    };
    S.addSession = function (s) { const id = s.id || C.newId("f"); S.batch("Focus session saved", () => S.put("session", id, Object.assign({}, s, { id }))); return S.data.sessions[id]; };

    // Calendar feed (ManageBac): one batch, so a single Undo reverts the whole import.
    S.importFeed = function (text, opts) {
      opts = opts || {};
      const st = S.settings();
      const parsed = C.parseICS(text, { now: now(), ignore: st.ignore });
      const copy = {};
      Object.keys(S.data.tasks).forEach((id) => { copy[id] = S.data.tasks[id]; });
      const res = C.reconcileFeed(copy, parsed, { now: now(), full: opts.full && st.removeMissing, legacyIds: true });
      if (res.puts.length) S.batch(opts.label || "Imported", () => res.puts.forEach((t) => S.put("task", t.id, t)));
      return { stats: parsed.stats, counts: res.counts, changed: res.puts.length };
    };

    // ---------- sync support ----------
    S.pendingItems = function () {
      return Object.keys(S.pending).map((r) => {
        const i = r.indexOf(":"), kind = r.slice(0, i), id = r.slice(i + 1), data = bucket(kind)[id];
        return data ? { kind, id, data: JSON.parse(JSON.stringify(data)), mod: data.mod || 1 } : null;
      }).filter(Boolean);
    };
    S.markSynced = function (items) {
      items.forEach((it) => { const cur = bucket(it.kind)[it.id]; if (cur && (cur.mod || 0) === it.mod) delete S.pending[ref(it.kind, it.id)]; });
      S.save();
    };
    // Rows from the server: newer ones replace the local copy; older ones mean this device's edit still needs sending.
    S.applyRemote = function (rows) {
      let changed = false, maxTs = S.cursor;
      rows.forEach((row) => {
        if (row.updated_at && (!maxTs || row.updated_at > maxTs)) maxTs = row.updated_at;
        const kind = row.kind, b = bucket(kind);
        if (!b) return;
        const cur = b[row.id], mod = +row.mod || 0, r = ref(kind, row.id);
        if (!cur || mod > (cur.mod || 0)) {
          const item = cleanItem(kind, row.id, Object.assign({}, row.data, { mod }));
          if (!item) return;
          b[row.id] = item; delete S.pending[r]; changed = true;
        } else if (mod === (cur.mod || 0)) delete S.pending[r];
        else S.pending[r] = true;
      });
      S.cursor = maxTs || "";
      S.save();
      if (changed) emit("remote");
      return changed;
    };
    S.isEmpty = function () { return !S.tasks().some((t) => !t.purged) && !S.sessions().length; };
    // Copy everything from another store (guest list moving into an account). Newer copies win.
    S.absorb = function (other) {
      S.batch("Moved into account", () => {
        ["task", "session", "meta"].forEach((kind) => {
          const src = kind === "task" ? other.data.tasks : kind === "session" ? other.data.sessions : other.data.meta;
          Object.keys(src).forEach((id) => {
            if (kind === "meta" && (id === "settings" || id === "profile") && !(src[id].mod > ((bucket(kind)[id] || {}).mod || 0))) return;
            const cur = bucket(kind)[id];
            if (!cur || (src[id].mod || 0) > (cur.mod || 0)) S.put(kind, id, src[id]);
          });
        });
      });
    };

    // ---------- backups ----------
    S.backup = function () {
      return { app: "Due Board", format: VERSION, exportedAt: new Date(now()).toISOString(), data: S.data };
    };
    // Accepts this version's backups and the older single-list format. "merge" keeps newer local edits;
    // "replace" makes the backup win and sets aside (not deletes) homework that is not in it.
    S.restoreBackup = function (obj, mode) {
      let data;
      if (obj && obj.format === VERSION && obj.data) data = obj.data;
      else if (obj && obj.v === VERSION && obj.data) data = obj.data;
      else if (isLegacy(obj)) data = migrateLegacy(obj, now());
      else throw new Error("not-a-backup");
      const incoming = { tasks: {}, sessions: {}, meta: {} };
      let n = 0;
      ["task", "session", "meta"].forEach((kind) => {
        const name = kind === "task" ? "tasks" : kind === "session" ? "sessions" : "meta", src = data[name] || {};
        Object.keys(src).slice(0, 25000).forEach((id) => { const it = cleanItem(kind, id, src[id]); if (it) { incoming[name][id] = it; if (kind === "task") n++; } });
      });
      if (!n && !Object.keys(incoming.sessions).length) throw new Error("empty-backup");
      S.batch("Backup restored", () => {
        ["task", "session", "meta"].forEach((kind) => {
          const name = kind === "task" ? "tasks" : kind === "session" ? "sessions" : "meta";
          Object.keys(incoming[name]).forEach((id) => {
            const it = incoming[name][id], cur = bucket(kind)[id];
            if (mode === "replace" || !cur || (it.mod || 0) > (cur.mod || 0)) S.put(kind, id, it);
          });
        });
        if (mode === "replace") S.tasks().forEach((t) => { if (!incoming.tasks[t.id] && !t.deleted && !t.purged) S.put("task", t.id, Object.assign({}, t, { deleted: now() })); });
      });
      return { tasks: n, sessions: Object.keys(incoming.sessions).length };
    };
    return S;
  }

  // Reads the oldest format, if present, once. The original text is kept under its own key.
  function upgradeLegacy(storage, store, now) {
    let raw = null;
    try { raw = storage.getItem(KEYS.legacy); } catch (e) { return false; }
    if (!raw) return false;
    let old;
    try { old = JSON.parse(raw); } catch (e) { return false; }
    if (!isLegacy(old)) return false;
    const d = migrateLegacy(old, now || Date.now());
    Object.keys(d.tasks).forEach((id) => { store.data.tasks[id] = d.tasks[id]; store.pending["task:" + id] = true; });
    Object.keys(d.sessions).forEach((id) => { store.data.sessions[id] = d.sessions[id]; store.pending["session:" + id] = true; });
    Object.keys(d.meta).forEach((id) => { store.data.meta[id] = d.meta[id]; store.pending["meta:" + id] = true; });
    if (!store.save()) return false;
    try { storage.setItem(KEYS.legacyBackup, raw); storage.removeItem(KEYS.legacy); } catch (e) { /* keep the old key if it cannot be moved */ }
    return true;
  }

  // A stand-in for localStorage when the browser refuses it (private mode, blocked storage).
  function memoryStorage() { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, key: (i) => Object.keys(m)[i], get length() { return Object.keys(m).length; } }; }
  function pickStorage() {
    try { const ls = root.localStorage; const k = "dueboard:probe"; ls.setItem(k, "1"); ls.removeItem(k); return { storage: ls, persistent: true }; }
    catch (e) { return { storage: memoryStorage(), persistent: false }; }
  }

  const api = { VERSION, KEYS, PALETTE, createStore, defaultSettings, cleanSettings, cleanTask, cleanSession, cleanItem, migrateLegacy, isLegacy, upgradeLegacy, memoryStorage, pickStorage };
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.DB = root.DB || {}).store = api;
})(typeof self !== "undefined" ? self : this);
