/* Archive: finished, archived, removed-by-ManageBac and deleted homework. Everything here can be restored. */
(function () {
  "use strict";
  const DB = window.DB, C = DB.core, U = DB.ui;
  const { el, icon } = U;
  DB.pages = DB.pages || {};
  const TABS = [["completed", "Completed"], ["archived", "Archived"], ["removed", "Removed in ManageBac"], ["deleted", "Deleted"]];
  let q = "";

  function render(page, ctx) {
    const App = DB.app, S = ctx.store, now = ctx.now;
    const tab = TABS.some((t) => t[0] === App.route.sub) ? App.route.sub : "completed";
    const all = S.tasks().filter((t) => !t.purged);
    const groups = {
      completed: all.filter((t) => t.done && !t.deleted && !t.historyOnly).sort((a, b) => b.doneAt - a.doneAt),
      archived: all.filter((t) => t.archived && !t.deleted && !t.done).sort((a, b) => b.archived - a.archived),
      removed: all.filter((t) => (t.removed || t.cancelled) && !t.deleted && !t.done).sort((a, b) => (b.removed || b.cancelled) - (a.removed || a.cancelled)),
      deleted: all.filter((t) => t.deleted && !t.historyOnly).sort((a, b) => b.deleted - a.deleted),
    };
    U.add(page, el("div", { class: "page-head" }, el("div", null, el("div", { class: "eyebrow", text: "Nothing is thrown away" }), el("h1", { text: "Archive" }),
      el("p", { class: "sub", text: "Everything here can be restored. Finished homework keeps its points even if you delete it." }))));
    const qIn = el("input", { class: "input sm", id: "arch-q", type: "search", placeholder: "Search the archive", value: q, "aria-label": "Search the archive" });
    qIn.addEventListener("input", () => { q = qIn.value; App.render(); });
    U.add(page, el("div", { class: "row wrap archive-tabs", style: { gap: "10px" } },
      el("div", { class: "chips", role: "group", "aria-label": "Show" }, TABS.map((t) => el("button", { class: "chip", type: "button", "aria-pressed": String(t[0] === tab), onclick: () => App.go("archive", true, t[0]) },
        t[1], el("span", { class: "n", text: String(groups[t[0]].length) })))),
      el("div", { class: "input-group grow", style: { maxWidth: "320px" } }, icon("search"), qIn)));
    const list = groups[tab].filter((t) => C.matches(t, q));
    const descr = { completed: "Finished homework, newest first.", archived: "Homework you put away without finishing.", removed: "Assignments deleted or cancelled in ManageBac. They come back by themselves if they reappear.", deleted: "Deleted homework. Restore it, or delete it for good." }[tab];
    U.add(page, el("p", { class: "small muted", style: { marginBottom: "12px" }, text: descr }));
    if (!list.length) { U.add(page, U.empty("archive", q ? "Nothing matches" : "Nothing here", q ? "Try a different search." : null)); return; }
    const box = el("div", { class: "task-list" });
    list.slice(0, 300).forEach((t) => {
      const row = U.taskRow(t, Object.assign({}, ctx, { keepDone: true, focus: null, more: (task, anchor) => {
        const items = [];
        if (tab !== "completed") items.push({ label: "Restore", icon: "undo", run: () => { S.restore(task.id); U.toast("Restored", { undo: () => S.undo() }); } });
        if (tab === "completed") items.push({ label: "Mark not done", icon: "undo", run: () => App.complete(task.id, false) });
        items.push({ label: "Open", icon: "edit", run: () => App.openTask(task.id) });
        if (tab === "deleted") items.push("-", { label: "Delete for good", icon: "trash", danger: true, run: async () => {
          const yes = await U.confirmDialog({ title: "Delete for good?", text: "“" + task.title + "” will be removed permanently." + (task.done ? " Its points stay." : ""), ok: "Delete for good", danger: true });
          if (yes) S.purge(task.id);
        } });
        else items.push("-", { label: "Delete", icon: "trash", danger: true, run: () => App.remove(task.id) });
        U.menu(anchor, items);
      } }));
      const when = tab === "completed" ? "Finished " + C.fmtDay(t.doneAt) : tab === "archived" ? "Archived " + C.fmtDay(t.archived) : tab === "removed" ? (t.cancelled ? "Cancelled " : "Removed ") + C.fmtDay(t.removed || t.cancelled) : "Deleted " + C.fmtDay(t.deleted);
      row.querySelector(".t-meta").append(el("span", { class: "m dim", text: when }));
      if (tab !== "completed") row.querySelector(".t-side").prepend(U.btn("Restore", { size: "xs", kind: "outline", onclick: () => { S.restore(t.id); U.toast("Restored “" + t.title + "”", { undo: () => S.undo() }); } }));
      U.add(box, row);
    });
    U.add(page, box);
    if (list.length > 300) U.add(page, el("p", { class: "small muted", style: { marginTop: "10px" }, text: "Showing the newest 300. Search to find older items." }));
  }
  DB.pages.archive = { title: "Archive", render };
})();
