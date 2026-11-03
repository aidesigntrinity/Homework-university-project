/* Weekly study planner: decide which day to work on each piece of homework, within a daily time budget. */
(function () {
  "use strict";
  const DB = window.DB, C = DB.core, U = DB.ui;
  const { el, icon } = U;
  DB.pages = DB.pages || {};
  let dragId = null;

  function render(page, ctx) {
    const App = DB.app, S = ctx.store, now = ctx.now, st = S.settings(), ui = App.ui;
    const off = ui.planWeek || 0;
    const days = C.weekDays(C.addDays(now, off * 7), st.weekStart);
    const today = C.startOfDay(now), todayKey = C.dayKey(now);
    const open = S.activeTasks().filter((t) => !t.done);
    const est = (t) => C.estOf(t, st.defaultEst);
    const dayKeys = days.map((d) => d.key);
    const planned = {}; dayKeys.forEach((k) => { planned[k] = []; });
    open.forEach((t) => { if (t.plan && planned[t.plan]) planned[t.plan].push(t); });
    const horizon = C.addDays(days[6].ms, 14);
    const tray = open.filter((t) => (!t.plan || C.keyToMs(t.plan) < today) && t.due <= horizon).sort((a, b) => a.due - b.due);
    const milestones = [];
    open.forEach((t) => (t.subtasks || []).forEach((s) => { if (s.due && !s.done && dayKeys.indexOf(C.dayKey(s.due)) !== -1) milestones.push({ t, s }); }));
    const totalPlanned = dayKeys.reduce((a, k) => a + planned[k].reduce((b, t) => b + est(t), 0), 0);
    const totalDue = open.filter((t) => t.due >= days[0].ms && t.due < C.addDays(days[6].ms, 1)).reduce((a, t) => a + est(t), 0);
    const capWeek = st.capacity * days.filter((d) => d.ms >= today).length;

    U.add(page, el("div", { class: "page-head" },
      el("div", null, el("div", { class: "eyebrow", text: off === 0 ? "This week" : off === 1 ? "Next week" : off === -1 ? "Last week" : "Week of " + C.fmtDay(days[0].ms) }),
        el("h1", { text: "Study plan" }),
        el("p", { class: "sub", text: "Planned " + C.fmtMins(totalPlanned) + " · homework due this week ≈ " + C.fmtMins(totalDue) + " · your time left this week " + C.fmtMins(capWeek) + "." })),
      el("div", { class: "btn-row" },
        U.iconBtn("left", "Previous week", () => { ui.planWeek = off - 1; App.render(); }, { class: "icon-btn boxed" }),
        U.btn("This week", { size: "sm", onclick: () => { ui.planWeek = 0; App.render(); }, disabled: off === 0 }),
        U.iconBtn("right", "Next week", () => { ui.planWeek = off + 1; App.render(); }, { class: "icon-btn boxed" }),
        U.btn("Plan it for me", { kind: "primary", icon: "wand", disabled: !tray.length || days[6].ms < today, onclick: () => {
          const plan = C.autoPlan(Object.fromEntries(tray.map((t) => [t.id, t])), days, { now, capacity: st.capacity, defaultEst: st.defaultEst });
          const ids = Object.keys(plan);
          if (!ids.length) { U.toast("Nothing could be planned before its due date this week."); return; }
          S.batch("Planned", () => ids.forEach((id) => S.put("task", id, Object.assign({}, S.task(id), { plan: plan[id] }))));
          U.toast("Planned " + ids.length + " piece" + (ids.length === 1 ? "" : "s") + " of homework", { icon: "wand", detail: "Each day stays within " + C.fmtMins(st.capacity) + " where possible.", undo: () => S.undo() });
        } }))));

    const board = el("div", { class: "plan-board" });
    // unplanned tray
    const trayBox = el("section", { class: "plan-tray", "aria-label": "Not planned yet" },
      el("div", { class: "row between" }, el("b", { text: "Not planned yet" }), el("span", { class: "badge", text: String(tray.length) })),
      el("p", { class: "xs muted", text: "Drag onto a day, or use the menu. Shows what's due in the next three weeks." }));
    if (!tray.length) U.add(trayBox, el("p", { class: "small muted", text: open.length ? "Everything due soon has a day. Nice." : "No open homework." }));
    tray.forEach((t) => U.add(trayBox, item(t, ctx, days, null)));
    dropTarget(trayBox, "", ctx);
    U.add(board, trayBox);

    const grid = el("div", { class: "plan-days" });
    days.forEach((d) => {
      const list = planned[d.key], mins = list.reduce((a, t) => a + est(t), 0), pct = (mins / st.capacity) * 100, past = d.ms < today;
      const ms = milestones.filter((m) => C.dayKey(m.s.due) === d.key);
      const due = open.filter((t) => C.dayKey(t.due) === d.key);
      const col = el("section", { class: "plan-day" + (d.key === todayKey ? " today" : "") + (past ? " past" : ""), "aria-label": C.fmtLong(d.ms) },
        el("div", { class: "row between" }, el("b", { class: "display", style: { fontSize: "20px" }, text: C.DOW[new Date(d.ms).getDay()] + " " + new Date(d.ms).getDate() }),
          el("span", { class: "xs " + (pct > 100 ? "coral" : "muted"), text: C.fmtMins(mins) + " / " + C.fmtMins(st.capacity) })),
        U.meter(pct, pct > 100 ? "coral" : pct > 50 ? "" : "teal", "Planned time against your daily capacity"),
        due.length ? el("span", { class: "xs muted", text: "Due: " + due.map((t) => t.title).join(", ") }) : null);
      list.sort((a, b) => a.due - b.due).forEach((t) => U.add(col, item(t, ctx, days, d.key)));
      ms.forEach((m) => U.add(col, el("div", { class: "plan-item milestone" }, icon("flag", 16), el("div", { class: "pi-main" },
        el("button", { class: "pi-title", type: "button", onclick: () => DB.app.openTask(m.t.id), text: m.s.text }), el("span", { class: "pi-meta" }, "Revision step for ", el("b", { text: m.t.title }))))));
      if (!list.length && !ms.length) U.add(col, el("p", { class: "xs dim", text: past ? "—" : "Free" }));
      if (!past) dropTarget(col, d.key, ctx);
      U.add(grid, col);
    });
    U.add(board, grid);
    U.add(page, board);
  }

  function item(t, ctx, days, dayKey) {
    const App = DB.app, S = ctx.store, now = ctx.now, st = S.settings();
    const late = dayKey && C.keyToMs(dayKey) > C.startOfDay(t.due);
    const it = el("div", { class: "plan-item" + (late ? " late" : ""), draggable: "true", "data-id": t.id },
      U.cbx(false, "Mark done: " + t.title, () => App.complete(t.id, true)),
      el("div", { class: "pi-main" },
        el("button", { class: "pi-title", type: "button", onclick: () => App.openTask(t.id), text: t.title }),
        el("span", { class: "pi-meta" }, t.subject ? el("span", { class: "dot", vars: { "--c": S.subjectColor(t.subject) } }) : null, t.subject || null,
          el("span", { class: t.due < now ? "coral" : "", text: "due " + C.relDay(t.due, now).toLowerCase() }), el("span", { text: "≈ " + C.fmtMins(C.estOf(t, st.defaultEst)) + (t.est ? "" : " (guess)") })),
        late ? el("span", { class: "xs coral", text: "Planned after it's due" }) : null),
      U.iconBtn("more", "Plan " + t.title, (e) => {
        const items = days.filter((d) => d.ms >= C.startOfDay(now)).map((d) => ({ label: (d.key === C.dayKey(now) ? "Today" : C.fmtDay(d.ms)) + (d.ms > C.startOfDay(t.due) ? " (after due)" : ""), icon: "planner", run: () => setPlan(S, t.id, d.key) }));
        if (dayKey) items.push("-", { label: "Remove from plan", icon: "x", run: () => setPlan(S, t.id, "") });
        items.push("-", { label: "Start focus", icon: "timer", run: () => DB.focus.openFor(t.id) });
        U.menu(e.currentTarget, items);
      }, { class: "icon-btn sm" }));
    it.addEventListener("dragstart", (e) => { dragId = t.id; e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", t.id); } catch (x) { /* some browsers */ } });
    it.addEventListener("dragend", () => { dragId = null; U.$$(".drop").forEach((n) => n.classList.remove("drop")); });
    return it;
  }
  function dropTarget(node, key, ctx) {
    node.addEventListener("dragover", (e) => { if (!dragId) return; e.preventDefault(); node.classList.add("drop"); });
    node.addEventListener("dragleave", (e) => { if (!node.contains(e.relatedTarget)) node.classList.remove("drop"); });
    node.addEventListener("drop", (e) => { e.preventDefault(); node.classList.remove("drop"); if (dragId) setPlan(ctx.store, dragId, key); dragId = null; });
  }
  function setPlan(S, id, key) {
    S.patchTask(id, { plan: key }, key ? "Planned" : "Unplanned");
    U.toast(key ? "Planned for " + C.fmtDay(C.keyToMs(key)) : "Removed from the plan", { icon: "planner", undo: () => S.undo() });
  }
  DB.pages.planner = { title: "Planner", render };
})();
