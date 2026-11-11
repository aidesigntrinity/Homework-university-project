// Unit tests for docs/js/core.js. Run: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../docs/js/core.js");
const { DAY, HOUR } = C;
const at = (y, mo, d, h = 12, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();
const NOW = at(2026, 11, 4, 10);   // Wednesday 4 Nov 2026, 10:00

const ics = (events) => "BEGIN:VCALENDAR\r\nVERSION:2.0\r\n" + events.join("") + "END:VCALENDAR\r\n";
const ev = (o) => "BEGIN:VEVENT\r\n" + Object.keys(o).map((k) => k + (k === "DTSTART" && /^\d{8}$/.test(o[k]) ? ";VALUE=DATE:" : ":") + o[k] + "\r\n").join("") + "END:VEVENT\r\n";

test("parseICS reads times, all-day items, subjects, links, folding and alarms", () => {
  const text = ics([
    ev({ UID: "a1", SUMMARY: "[Physics SL] Lab report", DTSTART: "20261106T080000Z", URL: "https://school.managebac.com/student/tasks/1" }),
    ev({ UID: "a2", SUMMARY: "Essay", DTSTART: "20261110" }),
    "BEGIN:VEVENT\r\nUID:a3\r\nSUMMARY:Long titl\r\n e here\r\nDTSTART;TZID=Asia/Nicosia:20261112T150000\r\nBEGIN:VALARM\r\nSUMMARY:Alarm text\r\nEND:VALARM\r\nURL:https://evil.example.com/x\r\nEND:VEVENT\r\n",
    ev({ UID: "a4", SUMMARY: "Lesson", DTSTART: "20261106T080000Z", RRULE: "FREQ=WEEKLY" }),
    ev({ UID: "a5", SUMMARY: "Cancelled quiz", DTSTART: "20261107T080000Z", STATUS: "CANCELLED" }),
    ev({ UID: "a6", SUMMARY: "Old", DTSTART: "20250101T080000Z" }),
  ]);
  const r = C.parseICS(text, { now: NOW });
  assert.equal(r.stats.events, 6); assert.equal(r.stats.repeating, 1); assert.equal(r.stats.cancelled, 1); assert.equal(r.stats.past, 1);
  const byUid = Object.fromEntries(r.items.map((i) => [i.uid, i]));
  assert.equal(byUid.a1.subject, "Physics SL"); assert.equal(byUid.a1.title, "Lab report"); assert.equal(byUid.a1.due, Date.UTC(2026, 10, 6, 8));
  assert.match(byUid.a1.link, /managebac/);
  assert.equal(byUid.a2.allDay, true); assert.equal(byUid.a2.due, at(2026, 11, 10, 23, 59));
  assert.equal(byUid.a3.title, "Long title here"); assert.equal(byUid.a3.link, ""); assert.equal(byUid.a3.due, Date.UTC(2026, 10, 12, 13));   // Nicosia is UTC+2 in November
  assert.equal(byUid.a5.cancelled, true); assert.equal(byUid.a6.past, true);
});

test("parseICS skip words and events without a UID", () => {
  const r = C.parseICS(ics([ev({ SUMMARY: "Assembly", DTSTART: "20261106T080000Z" }), ev({ SUMMARY: "Maths sheet", DTSTART: "20261106T080000Z" })]), { now: NOW, ignore: ["assembly"] });
  assert.equal(r.stats.ignored, 1); assert.equal(r.items.length, 1); assert.match(r.items[0].key, /^nouid\|maths sheet\|2026-11-06$/);
});

function feed(events) { return C.parseICS(ics(events), { now: NOW }); }
function applyPuts(tasks, res) { res.puts.forEach((t) => { tasks[t.id] = t; }); return tasks; }

test("reconcileFeed adds, then a second import changes nothing (no duplicates)", () => {
  const tasks = {};
  const f = feed([ev({ UID: "x1", SUMMARY: "[Maths] Sheet 4", DTSTART: "20261106T080000Z" }), ev({ UID: "x2", SUMMARY: "Essay", DTSTART: "20261109T080000Z" })]);
  const r1 = C.reconcileFeed(tasks, f, { now: NOW, full: true }); applyPuts(tasks, r1);
  assert.equal(r1.counts.added, 2); assert.equal(Object.keys(tasks).length, 2);
  const r2 = C.reconcileFeed(tasks, f, { now: NOW, full: true });
  assert.equal(r2.puts.length, 0); assert.equal(r2.counts.unchanged, 2);
});

test("reconcileFeed keeps the student's own edits and records ManageBac's values", () => {
  const tasks = {};
  applyPuts(tasks, C.reconcileFeed(tasks, feed([ev({ UID: "x1", SUMMARY: "Sheet 4", DTSTART: "20261106T080000Z" })]), { now: NOW }));
  const id = Object.keys(tasks)[0];
  tasks[id] = Object.assign({}, tasks[id], { title: "Sheet 4 (questions 1-10 only)", edited: { title: 1 } });
  const r = C.reconcileFeed(tasks, feed([ev({ UID: "x1", SUMMARY: "Sheet 4 v2", DTSTART: "20261107T080000Z" })]), { now: NOW });
  applyPuts(tasks, r);
  assert.equal(tasks[id].title, "Sheet 4 (questions 1-10 only)");
  assert.equal(tasks[id].due, Date.UTC(2026, 10, 7, 8));   // not edited, so it follows ManageBac
  assert.equal(tasks[id].mb.title, "Sheet 4 v2");
});

test("reconcileFeed sets aside cancelled and vanished events, and brings them back", () => {
  const tasks = {};
  const base = [ev({ UID: "k1", SUMMARY: "Quiz", DTSTART: "20261108T080000Z" }), ev({ UID: "k2", SUMMARY: "Poster", DTSTART: "20261109T080000Z" }), ev({ UID: "k3", SUMMARY: "Done one", DTSTART: "20261109T080000Z" })];
  applyPuts(tasks, C.reconcileFeed(tasks, feed(base), { now: NOW, full: true }));
  const idOf = (title) => Object.values(tasks).find((t) => t.title === title).id;
  tasks[idOf("Done one")] = Object.assign({}, tasks[idOf("Done one")], { done: true, doneAt: NOW });
  const r = C.reconcileFeed(tasks, feed([ev({ UID: "k1", SUMMARY: "Quiz", DTSTART: "20261108T080000Z", STATUS: "CANCELLED" })]), { now: NOW, full: true });
  applyPuts(tasks, r);
  assert.equal(r.counts.cancelled, 1); assert.equal(r.counts.removed, 1);
  assert.ok(tasks[idOf("Quiz")].cancelled); assert.ok(tasks[idOf("Poster")].removed);
  assert.ok(!tasks[idOf("Done one")].removed, "finished work is never touched");
  assert.equal(Object.keys(tasks).length, 3, "nothing is deleted");
  const back = C.reconcileFeed(tasks, feed(base), { now: NOW, full: true }); applyPuts(tasks, back);
  assert.equal(back.counts.restored, 2); assert.ok(!tasks[idOf("Quiz")].cancelled && !tasks[idOf("Poster")].removed);
});

test("reconcileFeed: an empty feed or a partial import never sets anything aside", () => {
  const tasks = {};
  applyPuts(tasks, C.reconcileFeed(tasks, feed([ev({ UID: "k1", SUMMARY: "Quiz", DTSTART: "20261108T080000Z" })]), { now: NOW, full: true }));
  assert.equal(C.reconcileFeed(tasks, feed([]), { now: NOW, full: true }).puts.length, 0);
  assert.equal(C.reconcileFeed(tasks, feed([ev({ UID: "zz", SUMMARY: "Other", DTSTART: "20261108T080000Z" })]), { now: NOW, full: false }).counts.removed, 0);
});

test("reconcileFeed links a matching manual task instead of duplicating it, and stays linked", () => {
  const manual = Object.assign(C.blankTask(), { id: "t1", title: "Lab Report!", subject: "Physics", due: at(2026, 11, 6, 9), created: NOW });
  const tasks = { t1: manual };
  const f = feed([ev({ UID: "m1", SUMMARY: "[Physics] lab report", DTSTART: "20261106T080000Z" })]);
  const r = C.reconcileFeed(tasks, f, { now: NOW, full: true }); applyPuts(tasks, r);
  assert.equal(r.counts.linked, 1); assert.equal(Object.keys(tasks).length, 1); assert.equal(tasks.t1.title, "Lab Report!");
  assert.ok(tasks.t1.edited.title && tasks.t1.edited.due, "the student's own title and time count as edits");
  assert.equal(tasks.t1.due, at(2026, 11, 6, 9), "and are kept");
  const r2 = C.reconcileFeed(tasks, f, { now: NOW, full: true }); applyPuts(tasks, r2);
  assert.equal(Object.keys(tasks).length, 1, "second import does not duplicate the linked task");
});

test("reconcileFeed adopts items imported by the first app version", () => {
  const oldId = "i" + C.hash("u-77");
  const tasks = { [oldId]: Object.assign(C.blankTask(), { id: oldId, title: "Old import", due: at(2026, 11, 8), source: "managebac" }) };
  const r = C.reconcileFeed(tasks, feed([ev({ UID: "u-77", SUMMARY: "Old import", DTSTART: "20261108T080000Z" })]), { now: NOW, full: true, legacyIds: true });
  applyPuts(tasks, r);
  assert.equal(Object.keys(tasks).length, 1); assert.equal(tasks[oldId].feedKey, "u-77");
});

test("past events are not created, but known ones are still updated", () => {
  const r = C.reconcileFeed({}, feed([ev({ UID: "p", SUMMARY: "Old", DTSTART: "20250101T080000Z" })]), { now: NOW });
  assert.equal(r.counts.added, 0); assert.equal(r.counts.skippedPast, 1);
});

function doneTask(id, due, doneAt, extra) {
  return Object.assign(C.blankTask(), { id, title: id, due, done: true, doneAt, pts: C.pointsFor(due, doneAt, C.DEFAULT_PTS), bonus: 5 }, extra);
}
test("points: early, on time, late, and one daily bonus per day", () => {
  assert.equal(C.pointsFor(NOW + 2 * DAY, NOW), 15); assert.equal(C.pointsFor(NOW + HOUR, NOW), 10); assert.equal(C.pointsFor(NOW - HOUR, NOW), 5);
  const tasks = {
    a: doneTask("a", NOW + 2 * DAY, NOW), b: doneTask("b", NOW + HOUR, NOW + 1000), c: doneTask("c", NOW - DAY, NOW - DAY - HOUR),
    open: Object.assign(C.blankTask(), { id: "open", title: "x", due: NOW }),
  };
  const s = C.computeStats(tasks, {}, {}, null, NOW);
  assert.equal(s.points, 15 + 10 + 10 + 5 + 5);   // c was finished an hour before its due time
  assert.equal(s.doneCount, 3); assert.equal(s.streak, 2); assert.equal(s.best, 2);
  assert.equal(s.ledger.filter((e) => e.kind === "bonus").length, 2);
});
test("points: the bonus moves to the next task if the first one is reopened; deleted finished work still counts", () => {
  const tasks = { a: doneTask("a", NOW + HOUR, NOW), b: doneTask("b", NOW + HOUR, NOW + 1000, { deleted: NOW + 5000 }) };
  assert.equal(C.computeStats(tasks, {}, {}, null, NOW).points, 10 + 10 + 5);
  tasks.a = Object.assign({}, tasks.a, { done: false, doneAt: 0, pts: 0 });
  assert.equal(C.computeStats(tasks, {}, {}, null, NOW).points, 10 + 5);
});
test("points carried from an older version are added", () => {
  assert.equal(C.computeStats({}, {}, { "carry:x": { pts: 120, best: 9, done: 14 } }, null, NOW).points, 120);
  const s = C.computeStats({}, {}, { "carry:x": { pts: 0, best: 9, done: 14 } }, null, NOW);
  assert.equal(s.best, 9); assert.equal(s.totalDone, 14);
});
test("streaks: counts back from today or yesterday; a gap ends it", () => {
  const days = {};
  [0, 1, 2, 4, 5, 6, 7].forEach((n) => { days[C.startOfDay(C.addDays(NOW, -n))] = 1; });
  assert.equal(C.streakFromDays(days, NOW), 3); assert.equal(C.longestFromDays(days), 4);
  delete days[C.startOfDay(NOW)];
  assert.equal(C.streakFromDays(days, NOW), 2, "a streak survives until the end of today");
});
test("levels", () => {
  assert.equal(C.levelInfo(0).level, 1); assert.equal(C.levelInfo(49).level, 1); assert.equal(C.levelInfo(50).level, 2); assert.equal(C.levelInfo(150).level, 3);
  assert.equal(C.levelInfo(100).toNext, 50); assert.equal(C.levelInfo(20, ["A", "B"]).title, "A");
});
test("achievements are earned from history", () => {
  const tasks = {}; for (let i = 0; i < 10; i++) tasks["t" + i] = doneTask("t" + i, NOW + 3 * DAY, NOW - i * DAY, { subject: "Maths" });
  const a = Object.fromEntries(C.achievements(C.computeStats(tasks, {}, {}, null, NOW)).map((x) => [x.id, x]));
  assert.ok(a.first.earned && a.ten.earned && a.streak7.earned && a.early5.earned && a.subject10.earned);
  assert.ok(!a.fifty.earned); assert.equal(a.fifty.value, 10); assert.equal(a.fifty.pct, 20);
});

test("recurrence: weekly, month ends, series end and a stable id", () => {
  const t = Object.assign(C.blankTask(), { id: "w", title: "Vocab", due: at(2026, 11, 4, 9), recur: { freq: "weekly", until: 0 } });
  const n1 = C.nextInstance(t, NOW), n1b = C.nextInstance(t, NOW);
  assert.equal(n1.due, at(2026, 11, 11, 9)); assert.equal(n1.id, n1b.id); assert.equal(n1.series, "w"); assert.equal(n1.done, false);
  const m = Object.assign(C.blankTask(), { id: "m", title: "Log", due: at(2027, 1, 31, 9), recur: { freq: "monthly", until: 0 } });
  assert.equal(new Date(C.nextInstance(m, at(2027, 1, 31)).due).getDate(), 28);
  const ended = Object.assign({}, t, { recur: { freq: "weekly", until: at(2026, 11, 8) } });
  assert.equal(C.nextInstance(ended, NOW), null);
  const wd = Object.assign({}, t, { due: at(2026, 11, 6, 9), recur: { freq: "weekdays" } });   // a Friday
  assert.equal(new Date(C.nextInstance(wd, NOW).due).getDay(), 1);
});

test("autoPlan respects capacity and never plans past the due day", () => {
  const days = C.weekDays(NOW, 1);
  const mk = (id, dueDays, est, pr) => Object.assign(C.blankTask(), { id, title: id, due: C.startOfDay(C.addDays(NOW, dueDays)) + 20 * HOUR, est, priority: pr || 0 });
  const tasks = { a: mk("a", 1, 90), b: mk("b", 1, 60), c: mk("c", 4, 60), d: mk("d", 0, 30, 3) };
  const plan = C.autoPlan(tasks, days, { now: NOW, capacity: 120 });
  Object.keys(plan).forEach((id) => assert.ok(C.keyToMs(plan[id]) <= C.startOfDay(tasks[id].due), id + " planned after its due day"));
  const load = {}; Object.keys(plan).forEach((id) => { load[plan[id]] = (load[plan[id]] || 0) + tasks[id].est; });
  assert.ok(Object.values(load).every((m) => m <= 150));
  assert.equal(plan.d, C.dayKey(NOW));
});

test("search, filters and sorting", () => {
  const list = [
    Object.assign(C.blankTask(), { id: "1", title: "Chemistry lab", subject: "Chem", due: NOW + DAY, priority: 1, subtasks: [{ id: "s", text: "Graph the titration", done: false }] }),
    Object.assign(C.blankTask(), { id: "2", title: "Essay draft", subject: "English", due: NOW - HOUR, priority: 3 }),
    Object.assign(C.blankTask(), { id: "3", title: "Reading", subject: "English", due: NOW + 9 * DAY, done: true, doneAt: NOW }),
  ];
  assert.deepEqual(C.filterTasks(list, { q: "titration" }, NOW).map((t) => t.id), ["1"]);
  assert.deepEqual(C.filterTasks(list, { subject: "english", status: "open" }, NOW).map((t) => t.id), ["2"]);
  assert.deepEqual(C.filterTasks(list, { status: "overdue" }, NOW).map((t) => t.id), ["2"]);
  assert.deepEqual(C.filterTasks(list, { priority: 2 }, NOW).map((t) => t.id), ["2"]);
  assert.deepEqual(C.sortTasks(list, "priority").map((t) => t.id), ["2", "1", "3"]);
});

test("calendar export: .ics with reminders and folded lines; CSV guards formulas", () => {
  const t = Object.assign(C.blankTask(), { id: "e1", title: "A".repeat(100), subject: "Maths", due: NOW });
  const out = C.toIcs([t], { now: NOW, alarms: [24, 3] });
  assert.match(out, /BEGIN:VALARM\r\nACTION:DISPLAY/); assert.match(out, /TRIGGER:-PT3H/);
  assert.ok(out.split("\r\n").every((l) => l.length <= 75));
  assert.match(C.calendarCsv([Object.assign({}, t, { title: "=cmd" })]), /"Due: =cmd"/);
  assert.equal(C.csvCell("=1+1"), "\"'=1+1\"");
});

test("URLs: only web links are kept", () => {
  assert.equal(C.safeUrl("javascript:alert(1)"), ""); assert.equal(C.safeUrl("example.com/a"), "https://example.com/a");
  assert.ok(C.isSyncUrl("https://script.google.com/macros/s/AKfy_1/exec?key=x")); assert.ok(!C.isSyncUrl("https://evil.com/exec"));
});

test("reminder times: minutes, hours and days, kept to whole minutes", () => {
  assert.equal(C.fmtLead(0.5), "30 min"); assert.equal(C.fmtLead(10 / 60), "10 min"); assert.equal(C.fmtLead(1.5), "1 h 30 min");
  assert.equal(C.fmtLead(3), "3 h"); assert.equal(C.fmtLead(24), "1 day"); assert.equal(C.fmtLead(48), "2 days");
  assert.equal(C.cleanLead(45 / 60), 0.75); assert.equal(C.cleanLead(0), 0); assert.equal(C.cleanLead(400), 0); assert.equal(C.cleanLead("x"), 0);
  assert.deepEqual(C.cleanLeads([0.5, 24, 0.5, 3, -1]), [24, 3, 0.5], "deduplicated, largest first, bad values dropped");
  assert.ok(C.REMINDER_CHOICES.indexOf(C.cleanLead(0.5)) !== -1);
});
