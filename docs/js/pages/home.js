/* Home: the day at a glance. Next deadline, what's overdue, due today and this week, filters, recent work. */
(function () {
  "use strict";
  const DB = window.DB, C = DB.core, U = DB.ui;
  const { el, icon } = U;
  DB.pages = DB.pages || {};

  function greeting(now) { const h = new Date(now).getHours(); return h < 5 ? "Working late" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; }

  function render(page, ctx) {
    const App = DB.app, S = ctx.store, now = ctx.now, st = S.settings();
    const f = App.ui.homeFilter = App.ui.homeFilter || {};
    const sort = App.ui.homeSort || st.homeSort || "due";
    const active = S.activeTasks();
    const open = active.filter((t) => !t.done);
    const overdue = open.filter((t) => t.due < now);
    const today = open.filter((t) => t.due >= now && C.dayDiff(t.due, now) === 0);
    const week = open.filter((t) => t.due >= now && C.dayDiff(t.due, now) <= 7);
    const weekStart = C.weekStartOf(now, st.weekStart);
    const doneWeek = S.tasks().filter((t) => C.counted(t) && t.doneAt >= weekStart);
    const stats = S.stats(now);
    const name = (S.profile().name || (DB.account.user && DB.account.name()) || "").split(" ")[0];

    // greeting
    const summary = [];
    if (overdue.length) summary.push(overdue.length + " overdue");
    summary.push(today.length ? today.length + " due today" : "nothing due today");
    summary.push(week.length + " this week");
    U.add(page, el("div", { class: "page-head" },
      el("div", null, el("div", { class: "eyebrow", text: C.fmtLong(now) }), el("h1", { text: greeting(now) + (name ? ", " + name : "") }), el("p", { class: "sub", text: (summary.join(" · ") + ".").replace(/^./, (c) => c.toUpperCase()) })),
      el("div", { class: "btn-row" }, U.btn("Focus", { icon: "timer", onclick: () => App.go("focus") }), U.btn("New homework", { kind: "primary", icon: "plus", onclick: () => App.openTask(null) }))));

    // KPI tiles double as quick filters
    const kpi = (key, label, n, cls, ic) => el("button", { class: "kpi " + cls, type: "button", "aria-pressed": String(f.when === key || f.status === key), onclick: () => {
      const on = f.when === key || f.status === key;
      App.ui.homeFilter = Object.assign({}, f, { when: undefined, status: undefined }, on ? {} : key === "overdue" ? { status: "overdue" } : key === "done" ? { status: "done" } : { when: key });
      App.render();
    } }, el("span", { class: "v", text: String(n) }), el("span", { class: "l" }, icon(ic), label));
    U.add(page, el("div", { class: "kpis", style: { marginBottom: "var(--s5)" } },
      kpi("overdue", "Overdue", overdue.length, overdue.length ? "alert" : "", "alert"), kpi("today", "Due today", today.length, today.length ? "amber" : "", "clock"),
      kpi("week", "Next 7 days", week.length, "", "calendar"), kpi("done", "Done this week", doneWeek.length, "teal", "check")));

    const split = el("div", { class: "split" }), mainCol = el("div", { class: "stack lg" }), aside = el("div", { class: "aside" });
    U.add(split, mainCol, aside); U.add(page, split);

    // next deadline
    const next = open.slice().sort((a, b) => a.due - b.due)[0];
    if (next) U.add(mainCol, hero(next, ctx));
    else U.add(mainCol, el("div", { class: "hero empty" }, el("div", { class: "empty-ic", style: { width: "64px", height: "64px", borderRadius: "20px", background: "var(--teal-soft)", color: "var(--teal-text)", display: "grid", placeItems: "center", flex: "none" } }, icon("check", 30)),
      el("div", { class: "stack sm" }, el("h2", { text: active.length ? "All caught up" : "Welcome to Due Board" }),
        el("p", { class: "muted", text: active.length ? "Nothing left to do. Add homework as it's set, or import it from ManageBac." : "Add your first homework, or bring everything in from ManageBac in Settings." }),
        el("div", { class: "btn-row" }, U.btn("Add homework", { kind: "primary", icon: "plus", onclick: () => App.openTask(null) }), U.btn("Import from ManageBac", { icon: "cap", onclick: () => App.go("settings", false, "managebac") })))));

    // toolbar: search, subject, priority, sort
    const q = el("input", { class: "input sm", type: "search", id: "home-q", placeholder: "Filter this list", value: f.q || "", "aria-label": "Filter homework" });
    q.addEventListener("input", () => { App.ui.homeFilter = Object.assign({}, App.ui.homeFilter, { q: q.value }); App.render(); });
    const subjects = S.subjects();
    const toolbar = el("div", { class: "row wrap", style: { gap: "8px" } },
      el("div", { class: "input-group grow", style: { minWidth: "180px" } }, icon("search"), q),
      U.select([{ v: "", label: "All subjects" }].concat(subjects.map((x) => ({ v: x, label: x }))), f.subject || "", (v) => { App.ui.homeFilter = Object.assign({}, App.ui.homeFilter, { subject: v || undefined }); App.render(); }, { class: "select sm", "aria-label": "Subject", style: { width: "auto", maxWidth: "180px" } }),
      U.select([{ v: 0, label: "Any priority" }, { v: 1, label: "Low and up" }, { v: 2, label: "Medium and up" }, { v: 3, label: "High only" }], f.priority || 0, (v) => { App.ui.homeFilter = Object.assign({}, App.ui.homeFilter, { priority: +v || undefined }); App.render(); }, { class: "select sm", "aria-label": "Priority", style: { width: "auto" } }),
      U.select([{ v: "due", label: "Sort: due date" }, { v: "priority", label: "Sort: priority" }, { v: "subject", label: "Sort: subject" }, { v: "title", label: "Sort: A–Z" }, { v: "created", label: "Sort: newest" }], sort, (v) => { App.ui.homeSort = v; App.saveUi(); App.render(); }, { class: "select sm", "aria-label": "Sort", style: { width: "auto" } }));
    const activeFilters = ["q", "subject", "priority", "when", "status"].filter((k) => f[k]);
    U.add(mainCol, el("div", { class: "stack sm" }, toolbar, activeFilters.length ? el("div", { class: "row wrap small" }, el("span", { class: "muted", text: "Filtered." }),
      el("button", { class: "link-btn", type: "button", onclick: () => { App.ui.homeFilter = {}; App.render(); } }, "Clear filters")) : null));

    // grouped lists
    const status = f.status === "done" ? "done" : f.status || "";
    let list = C.filterTasks(status === "done" ? active.filter((t) => t.done) : open, { q: f.q, subject: f.subject, priority: f.priority, when: f.when, status: status === "done" ? "" : status }, now);
    list = C.sortTasks(list, sort);
    const listBox = el("div", { class: "stack" });
    if (!list.length) {
      U.add(listBox, activeFilters.length ? U.empty("filter", "Nothing matches", "Try another filter, or clear them.", U.btn("Clear filters", { onclick: () => { App.ui.homeFilter = {}; App.render(); } }))
        : open.length ? null : U.empty("sparkle", "Your list is clear", "Add homework with the + button, or press N."));
    } else if (status === "done" || sort !== "due") {
      U.add(listBox, el("div", { class: "task-list" }, list.map((t) => U.taskRow(t, Object.assign({}, ctx, { keepDone: status === "done" })))));
    } else {
      const groups = [["overdue", "Overdue"], ["today", "Today"], ["tomorrow", "Tomorrow"], ["week", "This week"], ["later", "Later"]];
      groups.forEach(([g, label]) => {
        const items = list.filter((t) => C.groupOf(t, now) === g);
        if (!items.length) return;
        const mins = items.reduce((a, t) => a + (t.est || 0), 0);
        U.add(listBox, el("section", { "aria-label": label },
          el("h2", { class: "section-title" + (g === "overdue" ? " overdue" : "") }, label, el("span", { class: "count", text: String(items.length) }), mins ? el("span", { class: "count", title: "Estimated work", text: "≈ " + C.fmtMins(mins) }) : null),
          el("div", { class: "task-list" }, items.map((t) => U.taskRow(t, ctx)))));
      });
    }
    U.add(mainCol, listBox);

    // recently completed
    const recent = S.tasks().filter((t) => t.done && !t.deleted && !t.historyOnly && !t.purged && t.doneAt > now - 7 * C.DAY).sort((a, b) => b.doneAt - a.doneAt).slice(0, 5);

    // side column
    U.add(aside, levelCard(stats, ctx), streakCard(stats, now, st), studyCard(stats, now, st));
    const exams = open.filter((t) => t.kind === "exam" && t.due - now < 21 * C.DAY).sort((a, b) => a.due - b.due).slice(0, 3);
    if (exams.length) U.add(aside, el("div", { class: "card" }, el("div", { class: "card-head" }, el("span", { class: "card-title", text: "Tests coming up" })),
      el("div", { class: "stack" }, exams.map((t) => {
        const ms = (t.subtasks || []).filter((x) => x.due), nextMs = ms.filter((x) => !x.done).sort((a, b) => a.due - b.due)[0], sp = C.subtaskProgress(t);
        return el("button", { class: "kpi", type: "button", onclick: () => App.openTask(t.id), style: { padding: "12px" } },
          el("span", { class: "row between" }, el("b", { class: "truncate", text: t.title }), el("span", { class: "badge amber", text: C.relDay(t.due, now) })),
          sp.total ? U.meter((sp.done / sp.total) * 100, "teal thin", "Revision progress") : null,
          el("span", { class: "small muted", text: nextMs ? "Next: " + nextMs.text + " (" + C.relDay(nextMs.due, now).toLowerCase() + ")" : sp.total ? sp.done + " of " + sp.total + " steps done" : "Add a revision plan in the editor" }));
      }))));
    U.add(aside, el("div", { class: "card" }, el("div", { class: "card-head" }, el("span", { class: "card-title", text: "Recently done" }), el("a", { href: "#/archive/completed", class: "small", onclick: (e) => { e.preventDefault(); App.go("archive", false, "completed"); } }, "All")),
      recent.length ? el("div", { class: "task-list" }, recent.map((t) => U.taskRow(t, Object.assign({}, ctx, { compact: true, keepDone: true, more: null, focus: null }))))
        : el("p", { class: "muted small", text: "Finished homework shows here for a week, then moves to the archive." })));
  }

  function hero(t, ctx) {
    const App = DB.app, now = ctx.now, left = t.due - now, over = left < 0, bc = C.bigCount(left), sp = C.subtaskProgress(t);
    return el("section", { class: "hero" + (over ? " overdue" : ""), "aria-label": "Next deadline" },
      el("div", { class: "row between" }, el("span", { class: "eyebrow", text: over ? "Overdue" : "Next deadline" }), el("span", { class: "badge " + (over ? "coral" : C.dayDiff(t.due, now) === 0 ? "solid-amber" : "amber"), text: over ? "Late" : C.relDay(t.due, now) })),
      el("div", { class: "when" }, el("span", { class: "big", text: bc.n }), el("span", { class: "unit", text: bc.unit + (over ? " late" : " left") })),
      el("h2", { text: t.title }),
      el("div", { class: "meta" }, U.tag(t.subject, ctx.store), el("span", { text: C.dueLabel(t) }), U.prio(t.priority), t.est ? el("span", { text: "≈ " + C.fmtMins(t.est) }) : null,
        sp.total ? el("span", { class: "row", style: { gap: "8px" } }, el("span", { class: "subbar" }, el("i", { style: { width: (sp.done / sp.total) * 100 + "%" } })), sp.done + "/" + sp.total) : null),
      t.remaining ? el("p", { class: "amber small", style: { marginTop: "8px", position: "relative" }, text: "Left: " + t.remaining }) : null,
      el("div", { class: "actions" },
        U.btn("Mark done", { kind: "go", icon: "check", onclick: () => App.complete(t.id, true) }),
        U.btn("Focus", { icon: "timer", onclick: () => DB.focus.openFor(t.id) }),
        U.btn("Open", { kind: "ghost", icon: "edit", onclick: () => App.openTask(t.id) })));
  }
  function levelCard(stats, ctx) {
    const L = stats.level;
    return el("button", { class: "card", type: "button", style: { textAlign: "left", color: "inherit", cursor: "pointer" }, onclick: () => DB.app.go("progress") },
      el("div", { class: "row", style: { gap: "16px" } },
        U.ring(76, 8, L.pct, "var(--amber)", el("span", { class: "num", style: { fontSize: "26px" }, text: String(L.level) })),
        el("div", { class: "stack sm grow" }, el("span", { class: "eyebrow", text: "Level " + L.level + " · " + L.title }),
          el("span", null, el("span", { class: "num", style: { fontSize: "34px" }, text: stats.points.toLocaleString() }), el("span", { class: "muted small", text: " points" })),
          el("span", { class: "small muted", text: L.toNext + " to level " + (L.level + 1) }))));
  }
  function streakCard(stats, now, st) {
    const days = C.weekDays(now, st.weekStart);
    return el("div", { class: "card" }, el("div", { class: "card-head" }, el("span", { class: "card-title", text: "Streak" }), el("span", { class: "card-sub", text: "Best " + stats.best + (stats.best === 1 ? " day" : " days") })),
      el("div", { class: "row", style: { marginBottom: "14px", gap: "10px" } }, el("span", { class: "num amber", style: { fontSize: "40px" }, text: String(stats.streak) }),
        el("span", { class: "small muted", text: stats.streak ? (stats.streak === 1 ? "day in a row. Finish something tomorrow to keep it going." : "days in a row. Keep it going!") : "Finish one piece of homework today to start a streak." })),
      el("div", { class: "week-dots", role: "img", "aria-label": "Days this week with finished homework" }, days.map((d) => {
        const on = stats.days[d.ms], isToday = d.key === C.dayKey(now);
        return el("span", null, el("i", { class: (on ? "on" : "") + (isToday ? " today" : "") }, on ? icon("check") : null), C.DOW[new Date(d.ms).getDay()][0]);
      })));
  }
  function studyCard(stats, now, st) {
    const today = stats.focusPerDay[C.dayKey(now)] || 0, goal = st.goals.daily || 0;
    return el("div", { class: "card" }, el("div", { class: "card-head" }, el("span", { class: "card-title", text: "Study today" }), goal ? el("span", { class: "card-sub", text: "Goal " + C.fmtMins(goal) }) : null),
      el("div", { class: "row", style: { gap: "16px" } },
        U.ring(64, 7, goal ? (today / goal) * 100 : 0, "var(--teal)", el("span", { class: "num", style: { fontSize: "18px" }, text: goal ? Math.min(100, Math.round((today / goal) * 100)) + "%" : "" }), goal ? Math.round((today / goal) * 100) + "% of today's study goal" : null),
        el("div", { class: "stack sm grow" }, el("span", { class: "num", style: { fontSize: "28px" }, text: C.fmtMins(today) }),
          U.btn("Start a session", { size: "sm", icon: "timer", onclick: () => DB.app.go("focus") }))));
  }
  DB.pages.home = { title: "Home", render };
})();
