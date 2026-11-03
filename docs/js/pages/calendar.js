/* Calendar: month and week views with workload, plus the selected day's agenda and quick add. */
(function () {
  "use strict";
  const DB = window.DB, C = DB.core, U = DB.ui;
  const { el, icon } = U;
  DB.pages = DB.pages || {};

  function render(page, ctx) {
    const App = DB.app, S = ctx.store, now = ctx.now, st = S.settings(), ui = App.ui;
    ui.calAnchor = ui.calAnchor || C.startOfDay(now);
    ui.calSel = ui.calSel || C.dayKey(now);
    const mode = ui.calMode === "week" ? "week" : "month";
    const fSubj = ui.calSubject || "", showDone = ui.calShowDone !== false;
    const tasks = S.activeTasks().filter((t) => (showDone || !t.done) && (!fSubj || t.subject === fSubj));
    const byDay = {};
    tasks.forEach((t) => { const k = C.dayKey(t.due); (byDay[k] = byDay[k] || []).push(t); });
    Object.values(byDay).forEach((l) => l.sort((a, b) => a.due - b.due));
    const load = (k) => (byDay[k] || []).filter((t) => !t.done).reduce((a, t) => a + C.estOf(t, st.defaultEst), 0);
    const anchor = new Date(ui.calAnchor);

    const shift = (n) => { ui.calAnchor = mode === "month" ? new Date(anchor.getFullYear(), anchor.getMonth() + n, 1).getTime() : C.addDays(ui.calAnchor, 7 * n); App.render(); };
    const label = mode === "month" ? C.MONTH_FULL[anchor.getMonth()] + " " + anchor.getFullYear()
      : (() => { const d = C.weekDays(ui.calAnchor, st.weekStart); return C.fmtDay(d[0].ms).replace(/^\w+, /, "") + " – " + C.fmtDay(d[6].ms).replace(/^\w+, /, ""); })();
    U.add(page, el("div", { class: "cal-toolbar" },
      el("h1", { class: "month", text: label, "aria-live": "polite" }),
      el("div", { class: "row", style: { gap: "4px" } }, U.iconBtn("left", mode === "month" ? "Previous month" : "Previous week", () => shift(-1), { class: "icon-btn boxed" }),
        U.btn("Today", { size: "sm", onclick: () => { ui.calAnchor = C.startOfDay(now); ui.calSel = C.dayKey(now); App.render(); } }),
        U.iconBtn("right", mode === "month" ? "Next month" : "Next week", () => shift(1), { class: "icon-btn boxed" })),
      U.seg([{ v: "month", label: "Month" }, { v: "week", label: "Week" }], mode, (v) => { ui.calMode = v; App.saveUi(); App.render(); }, "View"),
      U.select([{ v: "", label: "All subjects" }].concat(S.subjects().map((x) => ({ v: x, label: x }))), fSubj, (v) => { ui.calSubject = v; App.render(); }, { class: "select sm", "aria-label": "Subject filter", style: { width: "auto", maxWidth: "170px" } }),
      el("label", { class: "check small" }, el("input", { type: "checkbox", checked: showDone, onchange: (e) => { ui.calShowDone = e.target.checked; App.render(); } }), "Show finished")));

    const split = el("div", { class: "split" }), mainCol = el("div", { class: "stack" }), aside = el("div", { class: "aside" });
    U.add(split, mainCol, aside); U.add(page, split);
    const todayKey = C.dayKey(now);

    if (mode === "month") {
      const cells = C.monthGrid(anchor.getFullYear(), anchor.getMonth(), st.weekStart);
      const dow = el("div", { class: "dow", "aria-hidden": "true" }, cells.slice(0, 7).map((c) => el("span", { text: C.DOW[new Date(c.ms).getDay()] })));
      const grid = el("div", { class: "days", role: "grid", "aria-label": label });
      const wide = window.innerWidth >= 900;
      cells.forEach((c) => {
        const list = byDay[c.key] || [], open = list.filter((t) => !t.done), done = list.length - open.length, mins = load(c.key), lv = C.workloadLevel(mins, st.capacity);
        const aria = C.fmtLong(c.ms) + ": " + (list.length ? open.length + " due" + (done ? ", " + done + " done" : "") : "nothing due") + (mins ? ", about " + C.fmtMins(mins) + " of work" : "");
        const cell = el("button", { class: "day" + (c.inMonth ? "" : " out") + (c.key === todayKey ? " today" : ""), type: "button", "aria-pressed": String(c.key === ui.calSel), "aria-label": aria, "data-key": c.key,
          onclick: () => { ui.calSel = c.key; if (!c.inMonth) ui.calAnchor = c.ms; App.render(); } },
          el("span", { class: "head" }, el("span", { class: "d", text: String(new Date(c.ms).getDate()) }), list.length ? el("span", { class: "cnt", text: open.length ? open.length + " due" : done + " done" }) : null),
          el("span", { class: "dots" }, list.slice(0, 4).map((t) => el("i", { class: (t.done ? "done" : "") + (!t.done && t.due < now ? " over" : ""), vars: { "--c": S.subjectColor(t.subject) } }))),
          wide ? el("span", { class: "chips-in" }, list.slice(0, 3).map((t) => el("span", { class: (t.done ? "done" : "") + (!t.done && t.due < now ? " over" : ""), vars: { "--c": S.subjectColor(t.subject) }, text: t.title }))) : null,
          wide && list.length > 3 ? el("span", { class: "more", text: "+" + (list.length - 3) + " more" }) : null,
          el("span", { class: "load l" + lv, "aria-hidden": "true" }));
        U.add(grid, cell);
      });
      grid.addEventListener("keydown", (e) => {
        const keys = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
        if (!(e.key in keys)) return;
        e.preventDefault();
        const next = C.addDays(C.keyToMs(ui.calSel), keys[e.key]);
        ui.calSel = C.dayKey(next);
        if (new Date(next).getMonth() !== anchor.getMonth()) ui.calAnchor = new Date(new Date(next).getFullYear(), new Date(next).getMonth(), 1).getTime();
        App.render();
        requestAnimationFrame(() => { const n = document.querySelector('.day[data-key="' + ui.calSel + '"]'); if (n) n.focus(); });
      });
      U.add(mainCol, el("div", { class: "cal-grid" }, dow, grid),
        el("div", { class: "legend", "aria-label": "Workload key" }, el("span", null, el("i", { style: { background: "var(--h2)" } }), "Light day"), el("span", null, el("i", { style: { background: "var(--amber)" } }), "Busy (" + C.fmtMins(st.capacity * 0.5) + "+)"),
          el("span", null, el("i", { style: { background: "var(--coral)" } }), "Over your " + C.fmtMins(st.capacity) + " daily capacity"), el("span", { class: "dim", text: "Estimates use " + C.fmtMins(st.defaultEst) + " when none is set." })));
    } else {
      const days = C.weekDays(ui.calAnchor, st.weekStart);
      U.add(mainCol, el("div", { class: "week-cols" }, days.map((d) => {
        const list = byDay[d.key] || [], mins = load(d.key), lv = C.workloadLevel(mins, st.capacity);
        return el("section", { class: "week-col" + (d.key === todayKey ? " today" : ""), "aria-label": C.fmtLong(d.ms) },
          el("div", { class: "wh" }, el("button", { class: "link-btn", type: "button", style: { textDecoration: "none", color: "inherit" }, onclick: () => { ui.calSel = d.key; App.render(); } },
            el("b", { text: C.DOW[new Date(d.ms).getDay()] + " " + new Date(d.ms).getDate() })), el("span", { class: "xs muted", text: (() => { const o = list.filter((t) => !t.done).length, dn = list.length - o; return o ? o + " due" : dn ? dn + " done" : ""; })() })),
          mins ? el("div", { class: "meter thin " + (lv === 3 ? "coral" : lv === 2 ? "" : "teal"), title: "About " + C.fmtMins(mins) + " of work", role: "img", "aria-label": "About " + C.fmtMins(mins) + " of work" }, el("i", { style: { width: Math.min(100, (mins / st.capacity) * 100) + "%" } })) : null,
          list.length ? el("div", { class: "task-list" }, list.map((t) => U.taskRow(t, Object.assign({}, ctx, { compact: true, showDay: false, keepDone: true })))) : el("span", { class: "empty-day", text: "Nothing due" }),
          el("button", { class: "btn ghost xs", type: "button", onclick: () => App.openTask(null, { due: C.keyToMs(d.key) + 23 * C.HOUR + 59 * C.MIN }) }, icon("plus"), "Add"));
      })));
    }

    // agenda for the selected day
    const selMs = C.keyToMs(ui.calSel), selList = (byDay[ui.calSel] || []), mins = load(ui.calSel);
    const quick = el("input", { class: "input", id: "cal-quick", type: "text", maxlength: "200", placeholder: "Add homework due " + C.relDay(selMs, now).toLowerCase() + "…", "aria-label": "Quick add for " + C.fmtLong(selMs) });
    quick.addEventListener("keydown", (e) => { if (e.key === "Enter" && quick.value.trim()) { DB.editor.quickAdd(quick.value, selMs + 23 * C.HOUR + 59 * C.MIN, { subject: fSubj }); quick.value = ""; } });
    const plannedHere = S.activeTasks().filter((t) => !t.done && t.plan === ui.calSel && C.dayKey(t.due) !== ui.calSel);
    U.add(aside, el("div", { class: "card" },
      el("div", { class: "card-head" }, el("div", null, el("div", { class: "eyebrow", text: C.relDay(selMs, now) }), el("div", { class: "card-title", style: { fontSize: "24px" }, text: C.fmtLong(selMs) })),
        U.iconBtn("plus", "Add homework on this day", () => App.openTask(null, { due: selMs + 23 * C.HOUR + 59 * C.MIN }), { class: "icon-btn boxed" })),
      el("p", { class: "small muted", style: { marginBottom: "12px" }, text: selList.length ? selList.filter((t) => !t.done).length + " due" + (mins ? " · about " + C.fmtMins(mins) + " of work" : "") : "Nothing due on this day." }),
      el("div", { class: "input-group", style: { marginBottom: "12px" } }, icon("plus"), quick),
      selList.length ? el("div", { class: "task-list" }, selList.map((t) => U.taskRow(t, Object.assign({}, ctx, { compact: true, showDay: false, keepDone: true })))) : null,
      plannedHere.length ? el("div", { class: "stack sm", style: { marginTop: "16px" } }, el("span", { class: "eyebrow", text: "Planned to work on" }),
        el("div", { class: "task-list" }, plannedHere.map((t) => U.taskRow(t, Object.assign({}, ctx, { compact: true }))))) : null));
  }
  DB.pages.calendar = { title: "Calendar", render };
})();
