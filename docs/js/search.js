/* Global search (press / or Ctrl+K): every piece of homework, including finished and archived. */
(function () {
  "use strict";
  const DB = window.DB, C = DB.core, U = DB.ui;
  const { el, icon } = U;

  function open() {
    const App = DB.app, S = App.store, now = App.now();
    if (!S || document.getElementById("search-dlg")) return;
    const d = el("dialog", { id: "search-dlg", "aria-label": "Search homework" });
    const input = el("input", { id: "search-q", type: "search", placeholder: "Search titles, subjects, notes, checklists…", autocomplete: "off", "aria-label": "Search", role: "combobox", "aria-expanded": "true", "aria-controls": "search-results" });
    let status = "open", subject = "";
    const filters = el("div", { class: "pal-filters row wrap", style: { gap: "8px" } });
    const results = el("div", { class: "pal-results", id: "search-results", role: "listbox" });
    let sel = 0, flat = [];
    function drawFilters() {
      U.fill(filters, ...[["open", "To do"], ["done", "Finished"], ["all", "Everything"]].map((x) => el("button", { class: "chip", type: "button", "aria-pressed": String(status === x[0]), onclick: () => { status = x[0]; drawFilters(); draw(); input.focus(); } }, x[1])),
        U.select([{ v: "", label: "All subjects" }].concat(S.subjects().map((x) => ({ v: x, label: x }))), subject, (v) => { subject = v; draw(); input.focus(); }, { class: "select sm", "aria-label": "Subject", style: { width: "auto" } }));
    }
    function draw() {
      const q = input.value.trim();
      let list = S.tasks().filter((t) => !t.purged && !t.historyOnly);
      if (status === "open") list = list.filter((t) => C.isOpen(t));
      if (status === "done") list = list.filter((t) => t.done && !t.deleted);
      list = C.filterTasks(list, { q, subject }, now);
      list = C.sortTasks(list, "due").sort((a, b) => (C.isOpen(b) - C.isOpen(a)));
      flat = list.slice(0, 60);
      sel = Math.min(sel, Math.max(0, flat.length - 1));
      U.fill(results, );
      if (!flat.length) { U.add(results, el("p", { class: "muted small", style: { padding: "16px", textAlign: "center" }, text: q ? "No homework matches “" + q + "”." : "No homework yet." })); return; }
      let last = "";
      flat.forEach((t, i) => {
        const grp = t.deleted ? "Deleted" : t.done ? "Finished" : t.archived || t.removed || t.cancelled ? "Archived" : C.groupOf(t, now) === "overdue" ? "Overdue" : "To do";
        if (grp !== last) { U.add(results, el("div", { class: "pal-group", text: grp })); last = grp; }
        U.add(results, el("button", { class: "pal-item", type: "button", role: "option", id: "sr-" + i, "aria-selected": String(i === sel), onclick: () => pick(t) },
          el("span", { class: "dot", vars: { "--c": S.subjectColor(t.subject) } }),
          el("span", { class: "grow", style: { minWidth: "0" } }, el("span", { class: "pi-t truncate", style: { display: "block" }, text: t.title }),
            el("span", { class: "pi-m", text: [t.subject, (t.done ? "Done " + C.fmtDay(t.doneAt) : "Due " + C.dueLabel(t))].filter(Boolean).join(" · ") })),
          t.done ? icon("check", 16) : null));
      });
      input.setAttribute("aria-activedescendant", "sr-" + sel);
    }
    function pick(t) { close(); App.openTask(t.id); }
    function close() { if (d.open) d.close(); d.remove(); }
    input.addEventListener("input", () => { sel = 0; draw(); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(flat.length - 1, sel + 1); draw(); const n = document.getElementById("sr-" + sel); if (n) n.scrollIntoView({ block: "nearest" }); }
      else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); const n = document.getElementById("sr-" + sel); if (n) n.scrollIntoView({ block: "nearest" }); }
      else if (e.key === "Enter" && flat[sel]) { e.preventDefault(); pick(flat[sel]); }
    });
    d.addEventListener("click", (e) => { if (e.target === d) close(); });
    d.addEventListener("close", () => d.remove());
    U.add(d, el("div", { class: "palette" }, el("div", { class: "pal-in" }, icon("search"), input, el("kbd", { text: "Esc" })), filters, results));
    document.body.append(d);
    drawFilters(); draw();
    d.showModal(); input.focus();
  }
  DB.search = { open };
})();
