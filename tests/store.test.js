// Unit tests for docs/js/store.js. Run: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../docs/js/core.js");
const St = require("../docs/js/store.js");
const { DAY, HOUR } = C;

function clock(start) { let t = start; const f = () => t; f.set = (v) => { t = v; }; f.add = (ms) => { t += ms; }; return f; }
const NOW = new Date(2026, 10, 4, 10).getTime();
function fresh(storage, now) { return St.createStore({ storage: storage || St.memoryStorage(), key: "k", now: now || clock(NOW) }).load(); }
function addTask(S, o) { return S.saveTask(Object.assign({ title: "Task", due: NOW + 2 * DAY }, o)); }

test("save and reload keeps everything, including what still needs syncing", () => {
  const mem = St.memoryStorage(), S = fresh(mem);
  const t = addTask(S, { title: "Essay", subject: "English", priority: 3, est: 45, subtasks: [{ text: "Outline" }], links: [{ url: "docs.google.com/x", title: "Draft" }] });
  const S2 = fresh(mem);
  const back = S2.task(t.id);
  assert.equal(back.title, "Essay"); assert.equal(back.priority, 3); assert.equal(back.subtasks[0].text, "Outline");
  assert.equal(back.links[0].url, "https://docs.google.com/x");
  assert.ok(S2.pending["task:" + t.id]);
});

test("unreadable saved data is kept aside, not overwritten", () => {
  const mem = St.memoryStorage(); mem.setItem("k", "{broken json");
  const S = fresh(mem);
  assert.equal(S.problem, "corrupt");
  const kept = Object.keys((() => { const o = {}; for (let i = 0; i < mem.length; i++) o[mem.key(i)] = 1; return o; })()).filter((k) => /unreadable/.test(k));
  assert.equal(kept.length, 1); assert.equal(mem.getItem(kept[0]), "{broken json");
});

test("a full or blocked storage is reported and the change stays in memory", () => {
  const mem = St.memoryStorage(), S = fresh(mem);
  const events = []; S.on((w) => events.push(w));
  mem.setItem = () => { const e = new Error("full"); e.name = "QuotaExceededError"; throw e; };
  const t = addTask(S, { title: "Kept in memory" });
  assert.equal(S.saveError, "full"); assert.ok(events.includes("storage")); assert.equal(S.task(t.id).title, "Kept in memory");
});

test("finishing gives points and the daily bonus once; Undo takes it all back", () => {
  const now = clock(NOW), S = fresh(null, now);
  const a = addTask(S, { title: "A", due: NOW + 3 * DAY }), b = addTask(S, { title: "B", due: NOW + HOUR });
  const r1 = S.complete(a.id, true);
  assert.equal(r1.pts, 15); assert.equal(r1.gained, 20); assert.equal(r1.bonusGained, 5);
  const r2 = S.complete(b.id, true);
  assert.equal(r2.gained, 10, "no second bonus on the same day");
  assert.equal(S.stats().points, 30);
  assert.ok(S.undo()); assert.equal(S.task(b.id).done, false); assert.equal(S.stats().points, 20);
  S.complete(a.id, false); assert.equal(S.stats().points, 0);
  assert.ok(r1.newAchievements.some((x) => x.id === "first"));
});

test("finishing repeating homework creates the next copy once; Undo removes it", () => {
  const now = clock(NOW), S = fresh(null, now);
  const t = addTask(S, { title: "Vocab quiz", due: NOW + HOUR, recur: { freq: "weekly" } });
  const r = S.complete(t.id, true);
  assert.ok(r.next); const next = S.task(r.next.id);
  assert.equal(next.due, NOW + HOUR + 7 * DAY); assert.equal(next.done, false);
  S.undo();
  assert.ok(S.task(r.next.id).purged, "the next copy is withdrawn"); assert.equal(S.task(t.id).done, false);
  assert.ok(!S.activeTasks().some((x) => x.id === r.next.id));
});

test("delete, archive and restore never lose homework", () => {
  const S = fresh();
  const t = addTask(S, { title: "Poster" });
  S.remove(t.id); assert.ok(S.task(t.id).deleted); assert.ok(!S.activeTasks().length);
  S.restore(t.id); assert.ok(!S.task(t.id).deleted);
  S.archive(t.id); assert.ok(!S.activeTasks().length); S.undo(); assert.equal(S.activeTasks().length, 1);
});

test("permanently deleting finished work keeps its points", () => {
  const S = fresh();
  const t = addTask(S, { title: "Done", due: NOW + HOUR });
  S.complete(t.id, true); const pts = S.stats().points;
  S.purge(t.id);
  assert.equal(S.stats().points, pts); assert.ok(S.task(t.id).historyOnly); assert.ok(!S.activeTasks().length);
});

test("ManageBac: the student's edits survive the next sync; reset brings ManageBac's version back", () => {
  const now = clock(NOW), S = fresh(null, now);
  const cal = (title, day) => "BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:mb-1\nSUMMARY:[Maths] " + title + "\nDTSTART:202611" + day + "T080000Z\nEND:VEVENT\nEND:VCALENDAR\n";
  S.importFeed(cal("Sheet 4", "06"), { full: true });
  const t = S.activeTasks()[0];
  assert.equal(t.source, "managebac");
  S.saveTask(Object.assign({}, t, { title: "Sheet 4: odd questions" }));
  assert.ok(S.task(t.id).edited.title);
  now.add(HOUR);
  S.importFeed(cal("Sheet 4 (updated)", "07"), { full: true });
  assert.equal(S.task(t.id).title, "Sheet 4: odd questions"); assert.equal(new Date(S.task(t.id).due).getUTCDate(), 7);
  assert.equal(S.task(t.id).mb.title, "Sheet 4 (updated)");
  S.resetToManageBac(t.id);
  assert.equal(S.task(t.id).title, "Sheet 4 (updated)"); assert.deepEqual(S.task(t.id).edited, {});
  assert.equal(S.tasks().length, 1, "no duplicates after three imports");
});

test("Undo reverses a whole import", () => {
  const S = fresh();
  const r = S.importFeed("BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:a\nSUMMARY:One\nDTSTART:20261106T080000Z\nEND:VEVENT\nBEGIN:VEVENT\nUID:b\nSUMMARY:Two\nDTSTART:20261107T080000Z\nEND:VEVENT\nEND:VCALENDAR");
  assert.equal(r.counts.added, 2); assert.equal(S.activeTasks().length, 2);
  S.undo(); assert.equal(S.activeTasks().length, 0);
});

test("the oldest saved format upgrades without losing points, history or settings", () => {
  const mem = St.memoryStorage(), d1 = new Date(2026, 9, 1, 10).getTime(), d2 = d1 + DAY;
  const old = {
    v: 3, rev: 7, points: 245, stats: { done: 30, best: 12 }, profile: { name: "Alex" },
    settings: { leads: [24], ignore: ["lesson"], pts: { early: 20, onTime: 10, late: 5, streak: 5 }, names: ["One", "Two"] },
    tasks: {
      i123: { id: "i123", title: "Imported", subject: "Maths", due: NOW + DAY, allDay: false, notes: "", done: false, doneAt: 0, pts: 0, src: "managebac", link: "https://x.managebac.com/a", remind: true },
      m9: { id: "m9", title: "Kept done", subject: "Art", due: d1 + 2 * DAY, done: true, doneAt: d1, pts: 20, src: "manual", remind: false },
    },
    log: [
      { k: "t", at: d1, pts: 20, task: "m9", title: "Kept done", subject: "Art", how: "early" }, { k: "b", at: d1, pts: 5, day: C.dayKey(d1) },
      { k: "t", at: d2, pts: 10, task: "gone", title: "Cleared long ago", subject: "Art", how: "on time" }, { k: "b", at: d2, pts: 5, day: C.dayKey(d2) },
      { k: "f", at: d2, pts: 0, task: "m9", title: "Kept done", subject: "Art", mins: 25 },
    ],
  };
  mem.setItem(St.KEYS.legacy, JSON.stringify(old));
  const S = fresh(mem, clock(NOW));
  assert.ok(St.upgradeLegacy(mem, S, NOW));
  const s = S.stats();
  assert.equal(s.points, 245, "points total is unchanged");
  assert.equal(s.best, 12); assert.equal(s.totalDone, 30);
  assert.equal(S.task("m9").bonus, 5); assert.deepEqual(S.task("m9").reminders, []);
  const ghost = S.tasks().find((t) => t.title === "Cleared long ago");
  assert.ok(ghost && ghost.historyOnly && ghost.done); assert.ok(!S.activeTasks().includes(ghost));
  assert.equal(S.sessions().length, 1); assert.equal(S.sessions()[0].mins, 25);
  assert.equal(S.settings().pts.early, 20); assert.deepEqual(S.settings().ignore, ["lesson"]); assert.equal(S.profile().name, "Alex");
  assert.equal(mem.getItem(St.KEYS.legacy), null); assert.ok(mem.getItem(St.KEYS.legacyBackup), "the original is kept");
  assert.ok(Object.keys(S.pending).length > 0);
  const again = fresh(mem); assert.equal(again.stats(NOW).points, 245);
  assert.equal(St.upgradeLegacy(mem, again, NOW), false, "runs once");
});

test("sync merge: newer wins, older local edits are re-sent, equal versions settle", () => {
  const now = clock(NOW), S = fresh(null, now);
  const t = addTask(S, { title: "Mine" });
  const mod = S.task(t.id).mod;
  S.applyRemote([{ kind: "task", id: t.id, data: Object.assign({}, S.task(t.id), { title: "Older" }), mod: mod - 5, updated_at: "2026-11-04T10:00:00.1Z" }]);
  assert.equal(S.task(t.id).title, "Mine"); assert.ok(S.pending["task:" + t.id]);
  S.applyRemote([{ kind: "task", id: t.id, data: Object.assign({}, S.task(t.id), { title: "Newer" }), mod: mod + 5, updated_at: "2026-11-04T10:00:00.2Z" }]);
  assert.equal(S.task(t.id).title, "Newer"); assert.ok(!S.pending["task:" + t.id]); assert.equal(S.cursor, "2026-11-04T10:00:00.2Z");
  S.applyRemote([{ kind: "task", id: "bad", data: { title: 5 }, mod: 1 }]);
  assert.equal(S.task("bad"), null, "invalid rows are ignored");
});

test("markSynced only clears items not edited again while sending", () => {
  const now = clock(NOW), S = fresh(null, now);
  const t = addTask(S, { title: "A" });
  const sent = S.pendingItems();
  now.add(1000); S.patchTask(t.id, { title: "A2" });
  S.markSynced(sent);
  assert.ok(S.pending["task:" + t.id], "the newer edit still needs sending");
});

test("two tabs on the same device merge instead of overwriting each other", () => {
  const mem = St.memoryStorage(), now = clock(NOW);
  const A = fresh(mem, now), B = fresh(mem, now);
  const a = addTask(A, { title: "From tab A" });
  now.add(10); const b = addTask(B, { title: "From tab B" });
  A.mergeFromStorage();
  assert.ok(A.task(a.id) && A.task(b.id));
  now.add(10); A.patchTask(a.id, { title: "A edited" });
  B.mergeFromStorage(); assert.equal(B.task(a.id).title, "A edited");
});

test("backups: full history out; merge keeps newer local edits; replace sets aside extras; old format accepted", () => {
  const now = clock(NOW), S = fresh(null, now);
  const keep = addTask(S, { title: "Original" });
  S.complete(addTask(S, { title: "Finished", due: NOW + HOUR }).id, true);
  const backup = JSON.parse(JSON.stringify(S.backup()));
  assert.equal(Object.keys(backup.data.tasks).length, 2);
  now.add(1000); S.patchTask(keep.id, { title: "Edited after backup" });
  const extra = addTask(S, { title: "Added after backup" });
  S.restoreBackup(backup, "merge");
  assert.equal(S.task(keep.id).title, "Edited after backup"); assert.ok(S.task(extra.id) && !S.task(extra.id).deleted);
  now.add(1000); S.restoreBackup(backup, "replace");
  assert.equal(S.task(keep.id).title, "Original"); assert.ok(S.task(extra.id).deleted, "set aside, not erased");
  const S2 = fresh(); S2.restoreBackup({ v: 3, points: 10, tasks: { x: { id: "x", title: "Old", due: NOW, done: false } } }, "merge");
  assert.equal(S2.task("x").title, "Old"); assert.equal(S2.stats().points, 10);
  assert.throws(() => S2.restoreBackup({ hello: 1 }, "merge"), /not-a-backup/);
});

test("guest homework moves into an account", () => {
  const G = fresh(), A = fresh();
  addTask(G, { title: "Guest work" }); A.setProfile({ name: "Sam" });
  A.absorb(G);
  assert.ok(A.tasks().some((t) => t.title === "Guest work")); assert.equal(A.profile().name, "Sam");
});

test("settings are validated", () => {
  const s = St.cleanSettings({ theme: "neon", pts: { early: 9999 }, focus: { mins: 2 }, syncUrl: "https://evil.example.com", names: [] });
  assert.equal(s.theme, "system"); assert.equal(s.pts.early, 100); assert.equal(s.focus.mins, 5); assert.equal(s.syncUrl, ""); assert.equal(s.names.length, 8);
});
