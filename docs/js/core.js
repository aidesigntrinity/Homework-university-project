/* Due Board core: pure functions with no DOM access (dates, calendar files, points, streaks,
   achievements, recurrence, planning, search). Loaded in the browser as DB.core and in Node tests. */
(function (root) {
  "use strict";
  const MIN = 60000, HOUR = 3600000, DAY = 86400000;

  // ---------- ids and hashing ----------
  function cyrb53(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }
  const hash = (s) => cyrb53(String(s)).toString(36);
  function newId(prefix) {
    let r = "";
    try { const a = new Uint32Array(2); (root.crypto || require("crypto").webcrypto).getRandomValues(a); r = a[0].toString(36) + a[1].toString(36); }
    catch (e) { r = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2); }
    return (prefix || "") + Date.now().toString(36) + r.slice(0, 8);
  }

  // ---------- dates (local time) ----------
  const pad = (n) => (n < 10 ? "0" : "") + n;
  function startOfDay(ms) { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function addDays(ms, n) { const d = new Date(ms); d.setDate(d.getDate() + n); return d.getTime(); }
  function addMonths(ms, n) {
    const d = new Date(ms), day = d.getDate();
    d.setDate(1); d.setMonth(d.getMonth() + n);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    return d.getTime();
  }
  function dayKey(ms) { const d = new Date(ms); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function keyToMs(key) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]).getTime() : NaN; }
  function dayDiff(ms, now) { return Math.round((startOfDay(ms) - startOfDay(now)) / DAY); }
  // First day of the week containing ms; weekStart 1 = Monday, 0 = Sunday.
  function weekStartOf(ms, weekStart) {
    const ws = weekStart === 0 ? 0 : 1, d = new Date(startOfDay(ms));
    d.setDate(d.getDate() - ((d.getDay() - ws + 7) % 7));
    return d.getTime();
  }
  function weekDays(anchor, weekStart) { const s = weekStartOf(anchor, weekStart), out = []; for (let i = 0; i < 7; i++) { const ms = addDays(s, i); out.push({ ms, key: dayKey(ms) }); } return out; }
  // Month grid with only the rows needed (4 to 6 weeks).
  function monthGrid(year, month, weekStart) {
    const first = new Date(year, month, 1).getTime(), last = new Date(year, month + 1, 0).getTime();
    const start = weekStartOf(first, weekStart), total = Math.round((startOfDay(last) - start) / DAY) + 1, cells = Math.ceil(total / 7) * 7, out = [];
    for (let i = 0; i < cells; i++) { const ms = addDays(start, i); out.push({ ms, key: dayKey(ms), inMonth: new Date(ms).getMonth() === month }); }
    return out;
  }
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const DOW_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const MONTH_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  function fmtDay(ms) { const d = new Date(ms); return DOW[d.getDay()] + ", " + d.getDate() + " " + MON[d.getMonth()]; }
  function fmtTime(ms) { const d = new Date(ms); return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function fmtLong(ms) { const d = new Date(ms); return DOW_FULL[d.getDay()] + ", " + d.getDate() + " " + MONTH_FULL[d.getMonth()]; }
  function dueLabel(t) { return t.allDay ? fmtDay(t.due) : fmtDay(t.due) + " · " + fmtTime(t.due); }
  function relDay(ms, now) {
    const n = dayDiff(ms, now);
    return n === 0 ? "Today" : n === 1 ? "Tomorrow" : n === -1 ? "Yesterday" : n > 1 && n < 7 ? DOW_FULL[new Date(ms).getDay()] : n > 0 ? "In " + n + " days" : -n + " days ago";
  }
  // "3 h 20 min", "2 days", "45 min" for a distance in ms
  function span(ms) {
    const a = Math.abs(ms), min = Math.floor(a / MIN);
    if (min < 1) return "under 1 min";
    if (min < 60) return min + " min";
    if (min < 48 * 60) { const h = Math.floor(min / 60), r = min % 60; return h + " h" + (h < 6 && r ? " " + r + " min" : ""); }
    return Math.floor(a / DAY) + " days";
  }
  function countdown(ms) { return ms < 0 ? (Math.abs(ms) < MIN ? "just passed" : span(ms) + " overdue") : "in " + span(ms); }
  // Big number + unit for a hero countdown: {n: "22", unit: "hours"}
  function bigCount(ms) {
    const a = Math.abs(ms), min = Math.floor(a / MIN);
    if (min < 60) return { n: String(Math.max(min, 1)), unit: min === 1 ? "minute" : "minutes" };
    if (a < 48 * HOUR) { const h = Math.floor(a / HOUR); return { n: String(h), unit: h === 1 ? "hour" : "hours" }; }
    const d = Math.floor(a / DAY); return { n: String(d), unit: d === 1 ? "day" : "days" };
  }
  function mmss(ms) { const s = Math.max(0, Math.ceil(ms / 1000)), m = Math.floor(s / 60); return pad(m) + ":" + pad(s % 60); }
  function fmtMins(m) { m = Math.round(m || 0); const h = Math.floor(m / 60), r = m % 60; return h ? h + " h" + (r ? " " + r + " min" : "") : r + " min"; }
  function fmtHours(m) { m = Math.round(m || 0); return m < 60 ? m + "m" : (Math.round(m / 6) / 10).toString().replace(/\.0$/, "") + "h"; }

  // ---------- reminders ----------
  // Reminder times are stored as hours before the due time; fractions give minutes (0.5 = 30 min).
  // Values are kept to whole minutes, up to 14 days before.
  function cleanLead(n) { n = Math.round(+n * 60) / 60; return n > 0 && n <= 336 ? n : 0; }
  function cleanLeads(list, max) {
    const out = [];
    (Array.isArray(list) ? list : []).forEach((n) => { const v = cleanLead(n); if (v && out.indexOf(v) === -1) out.push(v); });
    return out.sort((a, b) => b - a).slice(0, max || 8);
  }
  const REMINDER_CHOICES = [10 / 60, 15 / 60, 0.5, 1, 2, 3, 6, 12, 24, 48].map(cleanLead);
  // "30 min", "2 h", "1 h 30 min", "1 day", "2 days"
  function fmtLead(h) {
    const m = Math.round(h * 60);
    if (m < 60) return m + " min";
    if (m % 1440 === 0) { const d = m / 1440; return d + (d === 1 ? " day" : " days"); }
    return Math.floor(m / 60) + " h" + (m % 60 ? " " + (m % 60) + " min" : "");
  }

  // ---------- calendar files (iCalendar / ManageBac) ----------
  function tzOffsetMs(tz, ts) {
    const dtf = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" });
    const p = {};
    dtf.formatToParts(new Date(ts)).forEach((x) => { p[x.type] = x.value; });
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - (ts - (ts % 1000));
  }
  function zonedToUtc(y, mo, d, h, mi, s, tz) {
    const guess = Date.UTC(y, mo - 1, d, h, mi, s), t = guess - tzOffsetMs(tz, guess);
    return guess - tzOffsetMs(tz, t);
  }
  // All-day items are due at 23:59 local time on that day.
  function parseIcsDate(value, params) {
    let m = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
    if (m) return { ms: new Date(+m[1], +m[2] - 1, +m[3], 23, 59, 0).getTime(), allDay: true };
    m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(value);
    if (!m) return null;
    const y = +m[1], mo = +m[2], d = +m[3], h = +m[4], mi = +m[5], s = +m[6];
    if (m[7]) return { ms: Date.UTC(y, mo - 1, d, h, mi, s), allDay: false };
    if (params && params.TZID) {
      try { return { ms: zonedToUtc(y, mo, d, h, mi, s, params.TZID.replace(/^"|"$/g, "")), allDay: false }; } catch (e) { /* unknown zone: local time */ }
    }
    return { ms: new Date(y, mo - 1, d, h, mi, s).getTime(), allDay: false };
  }
  const unescapeText = (s) => s.replace(/\\([nN,;\\])/g, (_, c) => (c === "n" || c === "N" ? "\n" : c));
  const LINE = /^([A-Za-z0-9-]+)((?:;[^:;=]+=(?:"[^"]*"|[^;:]*))*):(.*)$/;
  const MB_LINK = /^https:\/\/([^\/@:]+\.)?managebac\.(com|cn)(:\d+)?\//i;

  // Reads calendar text. Every readable one-off event is returned (past and cancelled ones too, flagged),
  // so the caller can tell what disappeared from the feed. Repeating events (lessons) are skipped.
  function parseICS(text, opts) {
    opts = opts || {};
    const now = opts.now || Date.now(), ignore = (opts.ignore || []).map((w) => String(w).toLowerCase().trim()).filter(Boolean);
    const stats = { events: 0, past: 0, repeating: 0, ignored: 0, cancelled: 0, unreadable: 0 };
    const lines = String(text).replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "").split("\n");
    const items = [];
    let cur = null, nested = 0;
    for (const line of lines) {
      if (line === "BEGIN:VEVENT") { cur = {}; nested = 0; continue; }
      if (line === "END:VEVENT") { if (cur) finish(cur); cur = null; continue; }
      if (!cur) continue;
      if (/^BEGIN:/.test(line)) { nested++; continue; }
      if (/^END:/.test(line)) { nested = Math.max(0, nested - 1); continue; }
      if (nested) continue;
      const m = LINE.exec(line);
      if (!m) continue;
      const params = {};
      m[2].split(";").forEach((kv) => { const k = kv.indexOf("="); if (k > 0) params[kv.slice(0, k).toUpperCase()] = kv.slice(k + 1); });
      cur[m[1].toUpperCase()] = { value: m[3], params };
    }
    function finish(ev) {
      stats.events++;
      if (ev.RRULE) { stats.repeating++; return; }
      if (!ev.DTSTART) { stats.unreadable++; return; }
      const d = parseIcsDate(ev.DTSTART.value.trim(), ev.DTSTART.params);
      if (!d) { stats.unreadable++; return; }
      let title = unescapeText((ev.SUMMARY && ev.SUMMARY.value) || "").split(/\s+/).join(" ").trim() || "(untitled)";
      let notes = unescapeText((ev.DESCRIPTION && ev.DESCRIPTION.value) || "").trim();
      if (notes.length > 2000) notes = notes.slice(0, 1997) + "...";
      const hay = (title + "\n" + notes).toLowerCase();
      if (ignore.some((w) => hay.indexOf(w) !== -1)) { stats.ignored++; return; }
      let subject = "";
      const b = /^\[([^\]]{2,40})\]\s*(.+)$/.exec(title);
      if (b) { subject = b[1].trim(); title = b[2].trim(); }
      const uid = (ev.UID && ev.UID.value.trim()) || "";
      const rid = ev["RECURRENCE-ID"] ? ev["RECURRENCE-ID"].value.trim() : "";
      const key = uid ? uid + (rid ? "#" + rid : "") : "nouid|" + title.toLowerCase() + "|" + dayKey(d.ms);
      const link = ev.URL && MB_LINK.test(ev.URL.value.trim()) ? ev.URL.value.trim() : "";
      const cancelled = !!(ev.STATUS && ev.STATUS.value.trim().toUpperCase() === "CANCELLED");
      const past = d.ms < now - 2 * DAY;
      if (cancelled) stats.cancelled++; else if (past) stats.past++;
      items.push({ key, uid, title: title.slice(0, 200), subject: subject.slice(0, 40), due: d.ms, allDay: d.allDay, notes, link, cancelled, past });
    }
    return { items, stats };
  }
  const feedId = (key) => "mb-" + hash(key);
  const normTitle = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const MB_FIELDS = ["title", "subject", "due", "allDay", "notes"];

  /* Works out what a calendar feed changes. Returns {puts: [task objects to write], counts}.
     - New events become tasks; events already imported are updated, except fields the student edited.
     - A manual task with the same title and due day is linked instead of duplicated.
     - Events cancelled in ManageBac, or (for a full feed) missing from it, are set aside, never deleted:
       they move to the archive and come back if the event reappears. Finished work is never touched. */
  function reconcileFeed(tasks, parsed, opts) {
    opts = opts || {};
    const now = opts.now || Date.now(), full = !!opts.full, cap = opts.cap || 5000;
    const list = Object.values(tasks), byId = tasks, puts = [], seen = {};
    const counts = { added: 0, updated: 0, unchanged: 0, linked: 0, cancelled: 0, removed: 0, restored: 0, skippedPast: 0, full: 0 };
    let total = list.length;
    const manualIndex = {}, byKey = {};
    list.forEach((t) => {
      if (t.feedKey) byKey[t.feedKey] = t;
      else if (!t.deleted && t.source !== "managebac") manualIndex[normTitle(t.title) + "|" + dayKey(t.due)] = t;
    });
    const put = (t) => { puts.push(t); byId[t.id] = t; if (t.feedKey) byKey[t.feedKey] = t; };
    parsed.items.forEach((it) => {
      const id = feedId(it.key);
      // Items imported by the first version of the app used a different id scheme.
      const legacy = opts.legacyIds ? byId["i" + hash(it.uid || it.title + "|" + it.due)] : null;
      const ex = byKey[it.key] || byId[id] || (legacy && !legacy.feedKey ? legacy : null);
      if (!ex) {
        const twin = manualIndex[normTitle(it.title) + "|" + dayKey(it.due)];
        if (twin && !it.cancelled) {
          delete manualIndex[normTitle(it.title) + "|" + dayKey(it.due)];
          // Where the student's own version differs from ManageBac's, theirs counts as an edit and is kept.
          const edited = Object.assign({}, twin.edited);
          MB_FIELDS.forEach((f) => { if (twin[f] !== it[f]) edited[f] = 1; });
          const t = Object.assign({}, twin, { feedKey: it.key, url: twin.url || it.link, mb: pick(it), edited });
          seen[twin.id] = 1; put(t); counts.linked++; return;
        }
      }
      if (ex) seen[ex.id] = 1; else seen[id] = 1;
      if (!ex) {
        if (it.cancelled || it.past) { if (it.past) counts.skippedPast++; return; }
        if (total >= cap) { counts.full++; return; }
        total++;
        put(Object.assign(blankTask(), { id, title: it.title, subject: it.subject, due: it.due, allDay: it.allDay, notes: it.notes, url: it.link,
          source: "managebac", feedKey: it.key, mb: pick(it), created: now }));
        counts.added++; return;
      }
      const t = Object.assign({}, ex), edited = t.edited || {};
      let changed = false;
      if (t.feedKey !== it.key) { t.feedKey = it.key; changed = true; }
      // Finished homework keeps what it was finished as; only ManageBac's latest values are noted.
      if (!t.done) MB_FIELDS.forEach((f) => { if (!edited[f] && it[f] !== undefined && t[f] !== it[f]) { t[f] = it[f]; changed = true; } });
      if (it.link && t.url !== it.link) { t.url = it.link; changed = true; }
      const mb = pick(it);
      if (JSON.stringify(t.mb || {}) !== JSON.stringify(mb)) { t.mb = mb; changed = true; }
      if (it.cancelled) {
        if (!t.done && !t.cancelled) { t.cancelled = now; changed = true; counts.cancelled++; }
      } else if (t.cancelled || t.removed) {
        t.cancelled = 0; t.removed = 0; changed = true; counts.restored++;
      }
      if (changed) { put(t); counts.updated++; } else counts.unchanged++;
    });
    if (full && parsed.items.length) {
      list.forEach((t) => {
        if (t.source !== "managebac" || seen[t.id] || t.done || t.deleted || t.removed || t.cancelled) return;
        if (t.due < now - 2 * DAY) return;   // feeds drop old events; leave those alone
        put(Object.assign({}, t, { removed: now })); counts.removed++;
      });
    }
    return { puts, counts };
  }
  function pick(it) { return { title: it.title, subject: it.subject, due: it.due, allDay: it.allDay, notes: it.notes }; }

  // ---------- tasks ----------
  const PRIORITIES = [{ v: 0, label: "None" }, { v: 1, label: "Low" }, { v: 2, label: "Medium" }, { v: 3, label: "High" }];
  function blankTask() {
    return { id: "", title: "", subject: "", due: 0, allDay: false, priority: 0, est: 0, notes: "", subtasks: [], links: [], reminders: null,
      source: "manual", feedKey: "", url: "", mb: null, edited: {}, kind: "homework", recur: null, series: "", plan: "",
      done: false, doneAt: 0, pts: 0, bonus: 0, remaining: "", archived: 0, deleted: 0, removed: 0, cancelled: 0, created: 0, mod: 0 };
  }
  const isActive = (t) => !t.deleted && !t.removed && !t.cancelled && !t.archived && !t.historyOnly;
  const isOpen = (t) => isActive(t) && !t.done;
  const counted = (t) => t.done && t.doneAt && !t.purged;   // finished work counts for points and streaks, even if deleted later
  function groupOf(t, now) {
    if (t.done) return "done";
    if (t.due < now) return "overdue";
    const dd = dayDiff(t.due, now);
    return dd === 0 ? "today" : dd === 1 ? "tomorrow" : dd <= 7 ? "week" : "later";
  }
  function subtaskProgress(t) { const s = t.subtasks || []; return { done: s.filter((x) => x.done).length, total: s.length }; }
  const estOf = (t, def) => (t.est > 0 ? t.est : def || 30);

  // ---------- points, levels, streaks ----------
  const DEFAULT_PTS = { early: 15, onTime: 10, late: 5, streak: 5 };
  const DEFAULT_NAMES = ["Starter", "Planner", "Organiser", "Focused", "Scholar", "Ace", "Master", "Legend"];
  function pointsFor(due, doneAt, cfg) {
    cfg = cfg || DEFAULT_PTS;
    const left = due - doneAt;
    return left >= 24 * HOUR ? cfg.early : left >= 0 ? cfg.onTime : cfg.late;
  }
  function howFor(due, doneAt) { const left = due - doneAt; return left >= 24 * HOUR ? "early" : left >= 0 ? "on time" : "late"; }
  function levelStart(L) { return 25 * L * (L - 1); }
  function levelName(L, names) { names = names && names.length ? names : DEFAULT_NAMES; return names[Math.min(L, names.length) - 1]; }
  function levelInfo(points, names) {
    let L = 1;
    while (levelStart(L + 1) <= points) L++;
    const from = levelStart(L), to = levelStart(L + 1);
    return { level: L, title: levelName(L, names), from, to, into: points - from, need: to - from, toNext: to - points, pct: Math.round(((points - from) / (to - from)) * 100) };
  }
  function streakFromDays(days, now) {
    let d = startOfDay(now);
    if (!days[d]) d = startOfDay(d - 1);
    let n = 0;
    while (days[d]) { n++; d = startOfDay(d - 1); }
    return n;
  }
  function longestFromDays(days) {
    let best = 0, run = 0, prev = null;
    Object.keys(days).map(Number).sort((a, b) => a - b).forEach((d) => {
      run = prev !== null && startOfDay(addDays(prev, 1)) === d ? run + 1 : 1;
      best = Math.max(best, run); prev = d;
    });
    return best;
  }
  /* Everything on the Progress page is derived from the stored tasks and sessions, so it can never drift:
     points = points carried from older versions + points of finished tasks + one daily bonus per day. */
  function computeStats(tasks, sessions, carry, settings, now) {
    const cfg = (settings && settings.pts) || DEFAULT_PTS, names = settings && settings.names;
    const done = Object.values(tasks).filter(counted).sort((a, b) => a.doneAt - b.doneAt);
    const ledger = [], days = {}, perDay = {}, bonusDays = {};
    let points = 0, early = 0, onTime = 0, late = 0;
    done.forEach((t) => {
      const d = startOfDay(t.doneAt), k = dayKey(t.doneAt);
      days[d] = 1; perDay[k] = (perDay[k] || 0) + 1;
      points += t.pts || 0;
      const how = howFor(t.due, t.doneAt);
      if (how === "early") early++; else if (how === "on time") onTime++; else late++;
      ledger.push({ kind: "task", at: t.doneAt, pts: t.pts || 0, id: t.id, title: t.title, subject: t.subject, how });
      if (!bonusDays[k]) {
        bonusDays[k] = 1;
        const b = t.bonus >= 0 && t.bonus !== undefined ? t.bonus : cfg.streak;
        if (b > 0) { points += b; ledger.push({ kind: "bonus", at: t.doneAt, pts: b, day: k }); }
      }
    });
    let carried = 0, legacyBest = 0, legacyDone = 0;
    Object.values(carry || {}).forEach((c) => { carried += c.pts || 0; legacyBest = Math.max(legacyBest, c.best || 0); legacyDone += c.done || 0; });
    points += carried;
    const sess = Object.values(sessions || {}).filter((s) => !s.deleted && s.mins > 0).sort((a, b) => a.end - b.end);
    const focusPerDay = {}, focusBySubject = {};
    let focusTotal = 0;
    sess.forEach((s) => { const k = dayKey(s.end); focusPerDay[k] = (focusPerDay[k] || 0) + s.mins; focusTotal += s.mins; const sub = s.subject || ""; focusBySubject[sub] = (focusBySubject[sub] || 0) + s.mins; });
    const finished = done.length, bySubject = {};
    done.forEach((t) => { if (t.subject) bySubject[t.subject] = (bySubject[t.subject] || 0) + 1; });
    return {
      bySubjectDone: bySubject,
      points, carried, level: levelInfo(points, names), ledger: ledger.reverse(), doneCount: finished, totalDone: finished + legacyDone,
      streak: streakFromDays(days, now), best: Math.max(longestFromDays(days), legacyBest), perDay, days,
      early, onTime, late, onTimeRate: finished ? Math.round(((early + onTime) / finished) * 100) : null,
      focusTotal, focusPerDay, focusBySubject, sessions: sess,
    };
  }
  // Completion rate over a window: of the tasks due in it, how many are finished.
  function completionRate(tasks, from, to) {
    const due = Object.values(tasks).filter((t) => !t.deleted && !t.removed && !t.cancelled && !t.historyOnly && t.due >= from && t.due < to);
    if (!due.length) return null;
    return Math.round((due.filter((t) => t.done).length / due.length) * 100);
  }

  // ---------- achievements (all earned from history, so they never un-earn) ----------
  const ACHIEVEMENTS = [
    { id: "first", name: "First step", desc: "Finish your first homework", icon: "flag", target: 1, get: (s) => s.totalDone },
    { id: "ten", name: "Getting going", desc: "Finish 10 pieces of homework", icon: "check", target: 10, get: (s) => s.totalDone },
    { id: "fifty", name: "Half century", desc: "Finish 50 pieces of homework", icon: "medal", target: 50, get: (s) => s.totalDone },
    { id: "hundred", name: "Century", desc: "Finish 100 pieces of homework", icon: "trophy", target: 100, get: (s) => s.totalDone },
    { id: "streak3", name: "On a roll", desc: "Finish something 3 days in a row", icon: "flame", target: 3, get: (s) => s.best },
    { id: "streak7", name: "Unstoppable", desc: "Keep a 7-day streak", icon: "flame", target: 7, get: (s) => s.best },
    { id: "streak30", name: "Habit formed", desc: "Keep a 30-day streak", icon: "flame", target: 30, get: (s) => s.best },
    { id: "early5", name: "Early bird", desc: "Finish 5 pieces a day or more early", icon: "sunrise", target: 5, get: (s) => s.early },
    { id: "early25", name: "Ahead of the game", desc: "Finish 25 pieces a day or more early", icon: "sunrise", target: 25, get: (s) => s.early },
    { id: "focus1", name: "Deep work", desc: "Complete a focus session", icon: "timer", target: 1, get: (s) => s.sessions.length },
    { id: "focusday", name: "Focused hour", desc: "Study 60 minutes in one day", icon: "timer", target: 60, get: (s) => Math.max(0, ...Object.values(s.focusPerDay)) },
    { id: "focus10h", name: "Ten hours in", desc: "Study 10 hours in focus sessions", icon: "hourglass", target: 600, get: (s) => s.focusTotal },
    { id: "level5", name: "Scholar", desc: "Reach level 5", icon: "star", target: 5, get: (s) => s.level.level },
    { id: "subject10", name: "Specialist", desc: "Finish 10 pieces in one subject", icon: "book", target: 10, get: (s) => Math.max(0, ...Object.values(s.bySubjectDone || {})) },
  ];
  function achievements(stats) {
    return ACHIEVEMENTS.map((a) => {
      const v = Math.max(0, a.get(stats) || 0);
      return { id: a.id, name: a.name, desc: a.desc, icon: a.icon, target: a.target, value: Math.min(v, a.target), earned: v >= a.target, pct: Math.min(100, Math.round((v / a.target) * 100)) };
    });
  }
  function bySubjectDone(tasks) { const m = {}; Object.values(tasks).filter(counted).forEach((t) => { const k = t.subject || ""; if (k) m[k] = (m[k] || 0) + 1; }); return m; }

  // ---------- recurrence ----------
  const RECUR = { daily: "Every day", weekdays: "Every weekday", weekly: "Every week", biweekly: "Every 2 weeks", monthly: "Every month" };
  function nextDue(due, freq) {
    if (freq === "daily") return addDays(due, 1);
    if (freq === "weekdays") { let n = addDays(due, 1); while ([0, 6].indexOf(new Date(n).getDay()) !== -1) n = addDays(n, 1); return n; }
    if (freq === "weekly") return addDays(due, 7);
    if (freq === "biweekly") return addDays(due, 14);
    if (freq === "monthly") return addMonths(due, 1);
    return null;
  }
  // The next copy of a repeating task, or null when the series has ended. Its id is fixed by the series
  // and date, so two devices finishing the same task create the same next copy, not two.
  function nextInstance(t, now) {
    if (!t.recur || !RECUR[t.recur.freq]) return null;
    let due = nextDue(t.due, t.recur.freq);
    let guard = 0;
    while (due !== null && due < now - DAY && guard++ < 400) due = nextDue(due, t.recur.freq);
    if (due === null || (t.recur.until && due > t.recur.until + DAY - 1)) return null;
    const series = t.series || t.id;
    return Object.assign(blankTask(), {
      id: "r-" + hash(series + "|" + dayKey(due)), title: t.title, subject: t.subject, due, allDay: t.allDay, priority: t.priority, est: t.est,
      notes: t.notes, subtasks: (t.subtasks || []).map((s) => ({ id: s.id, text: s.text, done: false })), links: (t.links || []).slice(),
      reminders: t.reminders, kind: t.kind, recur: Object.assign({}, t.recur), series, created: now,
    });
  }

  // ---------- exam preparation ----------
  const PREP_STEPS = [[14, "Make a revision plan and gather notes"], [10, "Review notes and key ideas"], [7, "Practice questions"], [4, "Full past paper, timed"], [2, "Go over mistakes"], [1, "Light final review"]];
  function prepMilestones(examDue, now) {
    return PREP_STEPS.map((p) => ({ days: p[0], text: p[1], due: startOfDay(addDays(examDue, -p[0])) + 17 * HOUR }))
      .filter((m) => m.due > now).map((m) => ({ id: newId("s"), text: m.text, done: false, due: m.due }));
  }

  // ---------- planning ----------
  // Spreads unplanned open work over the given days without passing each task's due day or the daily
  // capacity (minutes). Returns {taskId: dayKey}. Earliest due first; high priority wins ties.
  function autoPlan(tasks, days, opts) {
    opts = opts || {};
    const now = opts.now || Date.now(), cap = opts.capacity || 120, def = opts.defaultEst || 30;
    const load = {}, out = {}, today = startOfDay(now);
    const usable = days.filter((d) => d.ms >= today);
    if (!usable.length) return out;
    usable.forEach((d) => { load[d.key] = 0; });
    Object.values(tasks).forEach((t) => { if (isOpen(t) && t.plan && load[t.plan] !== undefined) load[t.plan] += estOf(t, def); });
    const todo = Object.values(tasks).filter((t) => isOpen(t) && (!t.plan || keyToMs(t.plan) < today))
      .sort((a, b) => a.due - b.due || (b.priority || 0) - (a.priority || 0));
    todo.forEach((t) => {
      const est = estOf(t, def), latest = startOfDay(t.due) - (t.allDay ? 0 : t.due - startOfDay(t.due) < 10 * HOUR ? DAY : 0);
      const ok = usable.filter((d) => d.ms <= Math.max(latest, today));
      if (!ok.length) return;
      let pickDay = ok.find((d) => load[d.key] + est <= cap);
      if (!pickDay) pickDay = ok.reduce((a, b) => (load[b.key] < load[a.key] ? b : a));
      load[pickDay.key] += est; out[t.id] = pickDay.key;
    });
    return out;
  }
  function workloadLevel(mins, capacity) { if (!mins) return 0; const c = capacity || 120; return mins <= c * 0.5 ? 1 : mins <= c ? 2 : 3; }

  // ---------- search, filter, sort ----------
  function searchText(t) {
    return [t.title, t.subject, t.notes, t.remaining, (t.subtasks || []).map((s) => s.text).join(" "), (t.links || []).map((l) => l.title + " " + l.url).join(" ")].join(" ").toLowerCase();
  }
  function matches(t, q) {
    const words = String(q || "").toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return true;
    const hay = searchText(t);
    return words.every((w) => hay.indexOf(w) !== -1);
  }
  function filterTasks(list, f, now) {
    f = f || {};
    return list.filter((t) => {
      if (f.q && !matches(t, f.q)) return false;
      if (f.subject && (t.subject || "").toLowerCase() !== f.subject.toLowerCase()) return false;
      if (f.priority && (t.priority || 0) < f.priority) return false;
      if (f.source && t.source !== f.source) return false;
      if (f.kind && t.kind !== f.kind) return false;
      if (f.status === "open" && t.done) return false;
      if (f.status === "done" && !t.done) return false;
      if (f.status === "overdue" && (t.done || t.due >= now)) return false;
      if (f.when === "today" && (t.done || dayDiff(t.due, now) !== 0)) return false;
      if (f.when === "week" && (t.done || t.due < now || dayDiff(t.due, now) > 7)) return false;
      return true;
    });
  }
  const SORTS = {
    due: (a, b) => a.due - b.due || (b.priority || 0) - (a.priority || 0),
    priority: (a, b) => (b.priority || 0) - (a.priority || 0) || a.due - b.due,
    subject: (a, b) => (a.subject || "~").localeCompare(b.subject || "~") || a.due - b.due,
    title: (a, b) => a.title.localeCompare(b.title),
    created: (a, b) => (b.created || 0) - (a.created || 0),
  };
  function sortTasks(list, by) { return list.slice().sort(SORTS[by] || SORTS.due); }

  // ---------- exports ----------
  function gcalUrl(t) {
    const d = new Date(t.due);
    const ymd = (x) => x.getFullYear() + pad(x.getMonth() + 1) + pad(x.getDate());
    const utc = (ms) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const dates = t.allDay ? ymd(d) + "/" + ymd(new Date(startOfDay(t.due) + 36 * HOUR)) : utc(t.due) + "/" + utc(t.due + 15 * MIN);
    const details = [t.subject, t.notes].filter(Boolean).join("\n");
    return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent("Due: " + t.title) + "&dates=" + dates + (details ? "&details=" + encodeURIComponent(details) : "");
  }
  function icsEscape(s) { return String(s || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1"); }
  function icsFold(line) { const out = []; while (line.length > 74) { out.push(line.slice(0, 74)); line = " " + line.slice(74); } out.push(line); return out.join("\r\n"); }
  // An .ics file with a reminder on each item, for Google Calendar, Apple Calendar or Outlook.
  function toIcs(tasks, opts) {
    opts = opts || {};
    const stamp = new Date(opts.now || Date.now()).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const utc = (ms) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const ymd = (ms) => { const x = new Date(ms); return x.getFullYear() + pad(x.getMonth() + 1) + pad(x.getDate()); };
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Due Board//Homework//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Due Board homework"];
    tasks.forEach((t) => {
      lines.push("BEGIN:VEVENT", "UID:" + t.id + "@dueboard", "DTSTAMP:" + stamp);
      if (t.allDay) lines.push("DTSTART;VALUE=DATE:" + ymd(t.due), "DTEND;VALUE=DATE:" + ymd(addDays(startOfDay(t.due), 1)));
      else lines.push("DTSTART:" + utc(t.due), "DTEND:" + utc(t.due + 15 * MIN));
      lines.push(icsFold("SUMMARY:" + icsEscape("Due: " + (t.subject ? "[" + t.subject + "] " : "") + t.title)));
      if (t.notes) lines.push(icsFold("DESCRIPTION:" + icsEscape(t.notes)));
      (opts.alarms || [24]).forEach((h) => lines.push("BEGIN:VALARM", "ACTION:DISPLAY", icsFold("DESCRIPTION:" + icsEscape(t.title)), "TRIGGER:-PT" + h + "H", "END:VALARM"));
      lines.push("END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    return lines.join("\r\n") + "\r\n";
  }
  function csvCell(v) { v = String(v == null ? "" : v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; }
  function calendarCsv(tasks) {
    const mdy = (d) => pad(d.getMonth() + 1) + "/" + pad(d.getDate()) + "/" + d.getFullYear();
    const hm = (d) => { const h = d.getHours(); return pad(h % 12 || 12) + ":" + pad(d.getMinutes()) + " " + (h >= 12 ? "PM" : "AM"); };
    const rows = [["Subject", "Start Date", "Start Time", "End Date", "End Time", "All Day Event", "Description", "Location", "Private"]];
    tasks.forEach((t) => {
      const s = new Date(t.due), e = new Date(t.due + 15 * MIN), desc = [t.subject, t.notes].filter(Boolean).join("\n");
      rows.push(t.allDay ? ["Due: " + t.title, mdy(s), "", mdy(s), "", "True", desc, "", "False"] : ["Due: " + t.title, mdy(s), hm(s), mdy(e), hm(e), "False", desc, "", "False"]);
    });
    return rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
  }
  // The auto-sync address must be a Google Apps Script web app.
  function isSyncUrl(u) { return typeof u === "string" && /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec(\?[^\s#]*)?$/.test(u); }
  function safeUrl(u) { u = String(u || "").trim(); if (!u) return ""; if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = "https://" + u; return /^https?:\/\/[^\s]+$/i.test(u) ? u.slice(0, 500) : ""; }

  const api = {
    MIN, HOUR, DAY, cyrb53, hash, newId, pad, startOfDay, addDays, addMonths, dayKey, keyToMs, dayDiff, weekStartOf, weekDays, monthGrid,
    DOW, DOW_FULL, MON, MONTH_FULL, fmtDay, fmtTime, fmtLong, dueLabel, relDay, span, countdown, bigCount, mmss, fmtMins, fmtHours,
    cleanLead, cleanLeads, REMINDER_CHOICES, fmtLead,
    parseIcsDate, parseICS, reconcileFeed, feedId, MB_LINK, MB_FIELDS,
    PRIORITIES, blankTask, isActive, isOpen, counted, groupOf, subtaskProgress, estOf,
    DEFAULT_PTS, DEFAULT_NAMES, pointsFor, howFor, levelStart, levelName, levelInfo, streakFromDays, longestFromDays, computeStats, completionRate,
    ACHIEVEMENTS, achievements, bySubjectDone, RECUR, nextDue, nextInstance, prepMilestones, autoPlan, workloadLevel,
    matches, filterTasks, sortTasks, gcalUrl, toIcs, calendarCsv, csvCell, isSyncUrl, safeUrl,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else (root.DB = root.DB || {}).core = api;
})(typeof self !== "undefined" ? self : this);
