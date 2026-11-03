/* Progress: points, level, completion, streaks, weekly and monthly work, study time, subjects,
   activity map, achievements and history. Every number is computed from the saved homework and sessions. */
(function () {
  "use strict";
  const DB = window.DB, C = DB.core, U = DB.ui;
  const { el, icon } = U;
  DB.pages = DB.pages || {};
  let histShown = 30;

  function render(page, ctx) {
    const App = DB.app, S = ctx.store, now = ctx.now, st = S.settings();
    const stats = S.stats(now), L = stats.level;
    const ws = C.weekStartOf(now, st.weekStart);
    const focusWeek = Object.keys(stats.focusPerDay).filter((k) => C.keyToMs(k) >= ws).reduce((a, k) => a + stats.focusPerDay[k], 0);
    const rate30 = C.completionRate(S.data.tasks, C.addDays(C.startOfDay(now), -30), C.startOfDay(now) + C.DAY);

    U.add(page, el("div", { class: "page-head" }, el("div", null, el("div", { class: "eyebrow", text: "Your progress" }), el("h1", { text: "Progress" }),
      el("p", { class: "sub", text: stats.totalDone ? stats.totalDone + " pieces of homework finished so far." : "Finish homework to earn points, build streaks and unlock achievements." }))));

    // headline
    const head = el("div", { class: "cols-2", style: { marginBottom: "var(--s4)" } });
    U.add(head, el("button", { class: "card", type: "button", style: { textAlign: "left", color: "inherit" }, onclick: levelDialog },
      el("div", { class: "row", style: { gap: "20px" } },
        U.ring(120, 11, L.pct, "var(--amber)", el("div", { class: "stack", style: { gap: "0", alignItems: "center" } }, el("span", { class: "num", style: { fontSize: "44px" }, text: String(L.level) }), el("span", { class: "eyebrow", text: "Level" }))),
        el("div", { class: "stack sm grow" }, el("span", { class: "display amber", style: { fontSize: "26px" }, text: L.title }),
          el("span", null, el("span", { class: "num", style: { fontSize: "40px" }, text: stats.points.toLocaleString() }), el("span", { class: "muted", text: " points" })),
          U.meter(L.pct, "", "Progress to the next level"), el("span", { class: "small muted", text: L.toNext + " points to level " + (L.level + 1) + " · see all levels" })))));
    U.add(head, el("div", { class: "kpis", style: { gridTemplateColumns: "repeat(2, minmax(0,1fr))" } },
      kpi(stats.streak + "", "Current streak", "flame", stats.streak ? "amber" : ""), kpi(stats.best + "", "Best streak", "trophy", ""),
      kpi(rate30 === null ? "–" : rate30 + "%", "Completed (30 days)", "check", "teal", "Of the homework due in the last 30 days, how much is finished"),
      kpi(stats.onTimeRate === null ? "–" : stats.onTimeRate + "%", "Done on time", "clock", "", "Finished before the due time, of everything finished")));
    U.add(page, head);

    const grid = el("div", { class: "cols-2" });
    // weekly productivity
    const last7 = []; for (let i = 6; i >= 0; i--) { const d = C.addDays(C.startOfDay(now), -i), k = C.dayKey(d); last7.push({ k, d, n: stats.perDay[k] || 0, m: stats.focusPerDay[k] || 0 }); }
    U.add(grid, el("div", { class: "card" }, el("div", { class: "card-head" }, el("span", { class: "card-title", text: "Last 7 days" }), el("span", { class: "card-sub", text: last7.reduce((a, x) => a + x.n, 0) + " finished · " + C.fmtMins(last7.reduce((a, x) => a + x.m, 0)) + " studied" })),
      el("div", { class: "cols-2", style: { gap: "20px" } },
        el("div", null, el("div", { class: "eyebrow", style: { marginBottom: "4px" }, text: "Homework finished" }),
          U.bars(last7.map((x, i) => ({ label: C.DOW[new Date(x.d).getDay()].slice(0, 2), value: x.n, hi: i === 6, title: C.fmtDay(x.d) + ": " + x.n + " finished" })), { label: "Homework finished per day, last 7 days", valueHead: "Finished" })),
        el("div", null, el("div", { class: "eyebrow", style: { marginBottom: "4px" }, text: "Study time" }),
          U.bars(last7.map((x, i) => ({ label: C.DOW[new Date(x.d).getDay()].slice(0, 2), value: x.m, hi: i === 6, title: C.fmtDay(x.d) + ": " + C.fmtMins(x.m) })), { color: "amber", fmt: C.fmtHours, label: "Minutes studied per day, last 7 days", valueHead: "Minutes" })))));
    // monthly productivity
    const months = [];
    for (let i = 5; i >= 0; i--) { const d = new Date(now); d.setDate(1); d.setMonth(d.getMonth() - i); months.push({ y: d.getFullYear(), m: d.getMonth(), n: 0, min: 0 }); }
    Object.keys(stats.perDay).forEach((k) => { const d = new Date(C.keyToMs(k)), x = months.find((mm) => mm.y === d.getFullYear() && mm.m === d.getMonth()); if (x) x.n += stats.perDay[k]; });
    Object.keys(stats.focusPerDay).forEach((k) => { const d = new Date(C.keyToMs(k)), x = months.find((mm) => mm.y === d.getFullYear() && mm.m === d.getMonth()); if (x) x.min += stats.focusPerDay[k]; });
    U.add(grid, el("div", { class: "card" }, el("div", { class: "card-head" }, el("span", { class: "card-title", text: "Last 6 months" })),
      el("div", { class: "cols-2", style: { gap: "20px" } },
        el("div", null, el("div", { class: "eyebrow", style: { marginBottom: "4px" }, text: "Homework finished" }),
          U.bars(months.map((x, i) => ({ label: C.MON[x.m], value: x.n, hi: i === 5, title: C.MONTH_FULL[x.m] + " " + x.y + ": " + x.n + " finished" })), { label: "Homework finished per month", labelHead: "Month", valueHead: "Finished" })),
        el("div", null, el("div", { class: "eyebrow", style: { marginBottom: "4px" }, text: "Study time" }),
          U.bars(months.map((x, i) => ({ label: C.MON[x.m], value: x.min, hi: i === 5, title: C.MONTH_FULL[x.m] + ": " + C.fmtMins(x.min) })), { color: "amber", fmt: C.fmtHours, label: "Minutes studied per month", labelHead: "Month", valueHead: "Minutes" })))));
    U.add(page, grid);

    // study time vs goals, subjects
    const grid2 = el("div", { class: "cols-2", style: { marginTop: "var(--s4)" } });
    const today = stats.focusPerDay[C.dayKey(now)] || 0;
    U.add(grid2, el("div", { class: "card" }, el("div", { class: "card-head" }, el("span", { class: "card-title", text: "Study goals" }), U.btn("Change", { size: "xs", kind: "ghost", onclick: () => App.go("settings", false, "personal") })),
      el("div", { class: "stack lg" },
        goalRow("Today", today, st.goals.daily), goalRow("This week", focusWeek, st.goals.weekly),
        el("p", { class: "small muted", text: "All time: " + C.fmtMins(stats.focusTotal) + " across " + stats.sessions.length + " focus session" + (stats.sessions.length === 1 ? "" : "s") + "." }))));
    // subject statistics
    const subj = {};
    const all = S.tasks().filter((t) => !t.purged && !t.removed && !t.cancelled);
    all.forEach((t) => {
      const k = t.subject || "No subject", x = subj[k] = subj[k] || { open: 0, done: 0, over: 0, onTime: 0, mins: 0 };
      if (C.counted(t)) { x.done++; if (t.doneAt <= t.due) x.onTime++; } else if (!t.deleted && !t.archived && !t.historyOnly) { x.open++; if (t.due < now) x.over++; }
    });
    Object.keys(stats.focusBySubject).forEach((k) => { const key = k || "No subject"; (subj[key] = subj[key] || { open: 0, done: 0, over: 0, onTime: 0, mins: 0 }).mins += stats.focusBySubject[k]; });
    const rows = Object.keys(subj).sort((a, b) => (subj[b].done + subj[b].open) - (subj[a].done + subj[a].open));
    const maxM = Math.max(1, ...rows.map((k) => subj[k].mins));
    U.add(grid2, el("div", { class: "card" }, el("div", { class: "card-head" }, el("span", { class: "card-title", text: "Study time by subject" })),
      rows.some((k) => subj[k].mins) ? el("div", null, rows.filter((k) => subj[k].mins).sort((a, b) => subj[b].mins - subj[a].mins).slice(0, 8).map((k) =>
        el("div", { class: "hbar" }, el("span", { class: "row", style: { gap: "8px", minWidth: "0" } }, el("span", { class: "dot", vars: { "--c": k === "No subject" ? "var(--muted)" : S.subjectColor(k) } }), el("span", { class: "truncate", text: k })),
          el("span", { class: "track", "aria-hidden": "true" }, el("i", { vars: { "--c": k === "No subject" ? "var(--muted)" : S.subjectColor(k) }, style: { width: (subj[k].mins / maxM) * 100 + "%" } })), el("span", { class: "val", text: C.fmtMins(subj[k].mins) }))))
        : el("p", { class: "muted small", text: "Focus sessions you start from homework are counted here by subject." })));
    U.add(page, grid2);

    if (rows.length) U.add(page, el("div", { class: "card", style: { marginTop: "var(--s4)" } }, el("div", { class: "card-head" }, el("span", { class: "card-title", text: "Subjects" })),
      el("div", { class: "table-scroll", tabindex: "0", role: "region", "aria-label": "Subjects table" }, el("table", { class: "data" },
        el("thead", null, el("tr", null, el("th", { text: "Subject" }), el("th", { class: "n", text: "Open" }), el("th", { class: "n", text: "Overdue" }), el("th", { class: "n", text: "Finished" }), el("th", { class: "n", text: "On time" }), el("th", { class: "n", text: "Studied" }))),
        el("tbody", null, rows.map((k) => { const x = subj[k]; return el("tr", null, el("td", null, el("span", { class: "row", style: { gap: "8px" } }, el("span", { class: "dot", vars: { "--c": k === "No subject" ? "var(--muted)" : S.subjectColor(k) } }), k)),
          el("td", { class: "n", text: String(x.open) }), el("td", { class: "n" + (x.over ? " coral" : ""), text: String(x.over) }), el("td", { class: "n", text: String(x.done) }), el("td", { class: "n", text: x.done ? Math.round((x.onTime / x.done) * 100) + "%" : "–" }), el("td", { class: "n", text: x.mins ? C.fmtMins(x.mins) : "–" })); }))))));

    // activity map
    U.add(page, el("div", { class: "card", style: { marginTop: "var(--s4)" } }, el("div", { class: "card-head" }, el("span", { class: "card-title", text: "Activity" }), el("span", { class: "card-sub", text: "Homework finished, last 26 weeks" })), heatmap(stats, now, st)));

    // achievements
    const ach = C.achievements(stats), earned = ach.filter((a) => a.earned).length;
    U.add(page, el("div", { class: "card", style: { marginTop: "var(--s4)" } }, el("div", { class: "card-head" }, el("span", { class: "card-title", text: "Achievements" }), el("span", { class: "card-sub", text: earned + " of " + ach.length + " earned" })),
      el("div", { class: "ach-grid" }, ach.map((a) => el("div", { class: "ach" + (a.earned ? " earned" : "") },
        el("div", { class: "ico" }, icon(a.icon)), el("b", { text: a.name }), el("p", { text: a.desc }),
        a.earned ? el("span", { class: "badge teal" }, icon("check"), "Earned") : el("div", { class: "stack", style: { gap: "4px" } }, U.meter(a.pct, "thin", a.name + " progress"), el("span", { class: "xs muted", text: (a.id.indexOf("focus") === 0 && a.id !== "focus1" ? C.fmtMins(a.value) + " of " + C.fmtMins(a.target) : a.value + " of " + a.target) })))))));

    // history
    const items = stats.ledger.map((e) => ({ at: e.at, kind: e.kind, e })).concat(stats.sessions.map((s) => ({ at: s.end, kind: "focus", s }))).sort((a, b) => b.at - a.at);
    const hist = el("div", { class: "timeline" });
    let lastDay = "";
    items.slice(0, histShown).forEach((x) => {
      const k = C.dayKey(x.at);
      if (k !== lastDay) { U.add(hist, el("div", { class: "tl-day", text: C.relDay(x.at, now) === "Today" || C.relDay(x.at, now) === "Yesterday" ? C.relDay(x.at, now) : C.fmtDay(x.at) })); lastDay = k; }
      if (x.kind === "task") U.add(hist, el("div", { class: "tl-item" }, el("span", { class: "ic" }, icon("check")), el("div", { class: "tx" }, el("b", { text: x.e.title }), el("span", { text: [x.e.subject, x.e.how === "early" ? "finished early" : x.e.how === "late" ? "finished late" : "on time"].filter(Boolean).join(" · ") })), el("span", { class: "pt", text: "+" + x.e.pts })));
      else if (x.kind === "bonus") U.add(hist, el("div", { class: "tl-item" }, el("span", { class: "ic bonus" }, icon("bolt")), el("div", { class: "tx" }, el("b", { text: "Daily bonus" }), el("span", { text: "First homework of the day" })), el("span", { class: "pt", text: "+" + x.e.pts })));
      else U.add(hist, el("div", { class: "tl-item" }, el("span", { class: "ic focus" }, icon("timer")), el("div", { class: "tx" }, el("b", { text: "Focus: " + (x.s.title || x.s.subject || "study session") }), el("span", { text: [x.s.subject, x.s.note].filter(Boolean).join(" · ") || "Focus session" })), el("span", { class: "small muted", text: C.fmtMins(x.s.mins) })));
    });
    U.add(page, el("div", { class: "card", style: { marginTop: "var(--s4)" } }, el("div", { class: "card-head" }, el("span", { class: "card-title", text: "History" }), stats.carried ? el("span", { class: "card-sub", text: stats.carried + " points carried over from before" }) : null),
      items.length ? hist : el("p", { class: "muted small", text: "Finished homework and focus sessions will appear here." }),
      items.length > histShown ? U.btn("Show more", { kind: "outline", size: "sm", onclick: () => { histShown += 50; App.render(); } }) : null));
  }

  function kpi(v, label, ic, cls, title) { return el("div", { class: "kpi " + cls, title: title || null }, el("span", { class: "v", text: v }), el("span", { class: "l" }, icon(ic), label)); }
  function goalRow(label, mins, goal) {
    const pct = goal ? (mins / goal) * 100 : 0;
    return el("div", { class: "stack sm" }, el("div", { class: "row between" }, el("b", { text: label }), el("span", { class: "small " + (pct >= 100 ? "teal" : "muted"), text: C.fmtMins(mins) + (goal ? " of " + C.fmtMins(goal) : "") + (pct >= 100 ? " · goal reached" : "") })),
      goal ? U.meter(pct, "teal", label + " study goal") : el("span", { class: "xs muted", text: "No goal set" }));
  }
  function heatmap(stats, now, st) {
    const start = C.addDays(C.weekStartOf(now, st.weekStart), -25 * 7), today = C.startOfDay(now);
    const months = el("div", { class: "heat-months", "aria-hidden": "true", style: { gridTemplateColumns: "repeat(26, var(--cell))" } });
    const grid = el("div", { class: "heat", role: "img", "aria-label": "Homework finished per day over the last 26 weeks" });
    let lastM = -1;
    for (let c = 0; c < 26; c++) {
      const m = new Date(C.addDays(start, c * 7)).getMonth();
      U.add(months, el("span", { text: m !== lastM ? C.MON[m] : "" })); lastM = m;
      for (let r = 0; r < 7; r++) {
        const ms = C.addDays(start, c * 7 + r), k = C.dayKey(ms), n = stats.perDay[k] || 0;
        U.add(grid, el("i", { class: (ms > today ? "future" : n ? "l" + Math.min(4, n) : "") + (ms === today ? " today" : ""), title: C.fmtDay(ms) + ": " + n + " finished" }));
      }
    }
    return el("div", null, el("div", { class: "heat-wrap", tabindex: "0", role: "region", "aria-label": "Activity map, scrollable" }, months, grid),
      el("div", { class: "heat-legend", "aria-hidden": "true" }, "Less", ["var(--h0)", "var(--h1)", "var(--h2)", "var(--h3)", "var(--h4)"].map((c) => el("i", { style: { background: c } })), "More"));
  }
  function levelDialog() {
    const S = DB.app.store, stats = S.stats(), L = stats.level, names = S.settings().names;
    const s = U.sheet({ title: "Levels", narrow: true, foot: false });
    const ladder = el("div", { class: "ladder" });
    for (let lv = Math.max(1, L.level - 2); lv <= L.level + 4; lv++) {
      const from = C.levelStart(lv), cls = lv < L.level ? "done" : lv === L.level ? "here" : "";
      U.add(ladder, el("div", { class: "rung " + cls }, el("span", { class: "node", text: String(lv) }), el("div", { class: "rt" }, el("b", { text: C.levelName(lv, names) }),
        el("span", { text: lv < L.level ? "Reached" : lv === L.level ? "You are here · " + L.toNext + " points to go" : "From " + from.toLocaleString() + " points" }))));
    }
    const p = S.settings().pts;
    U.add(s.body, el("p", { class: "muted", text: "You have " + stats.points.toLocaleString() + " points." }), ladder,
      el("div", { class: "note" }, el("b", { text: "How points work: " }), "+" + p.early + " for finishing a day or more early, +" + p.onTime + " on time, +" + p.late + " late, and +" + p.streak + " for the first homework you finish each day. Reopening homework takes its points back."));
    s.open();
  }
  DB.pages.progress = { title: "Progress", render };
})();
