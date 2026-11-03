/* Homework editor: one form for adding and editing, as a bottom sheet on phones and a side panel on desktop. */
(function () {
  "use strict";
  const DB = window.DB, C = DB.core, U = DB.ui;
  const { el, icon } = U;
  const QUICK_TIMES = ["08:00", "09:30", "12:00", "16:00", "23:59"];
  const EST = [15, 30, 45, 60, 90, 120];
  const LEADS = [1, 3, 6, 12, 24, 48];

  function open(id, preset) {
    const App = DB.app, S = App.store, now = App.now(), st = S.settings();
    const orig = id ? S.task(id) : null;
    if (id && !orig) return;
    // Working copy; nothing is saved until "Save".
    const base = orig ? JSON.parse(JSON.stringify(orig)) : Object.assign(C.blankTask(), {
      due: C.startOfDay(C.addDays(now, 1)) + 9.5 * C.HOUR, reminders: null, est: 0,
    }, preset || {});
    const w = base;
    const startJson = JSON.stringify(w);
    const s = U.sheet({ title: orig ? "Edit homework" : "New homework", id: "editor", drawer: true, focus: "#e-title",
      beforeClose: () => { if (JSON.stringify(collect()) === startJson) return true; confirmDiscard(); return false; } });
    s.box.classList.add("editing");
    function confirmDiscard() { U.confirmDialog({ title: "Discard changes?", text: "Your changes to this homework haven't been saved.", ok: "Discard", danger: true, cancel: "Keep editing" }).then((yes) => { if (yes) s.close(); }); }

    // ----- title, subject, type -----
    const title = el("input", { class: "input", id: "e-title", type: "text", maxlength: "200", required: true, placeholder: "e.g. Physics lab report", value: w.title, autocomplete: "off" });
    const titleErr = el("span", { class: "hint coral", id: "e-title-err", hidden: true });
    const subj = el("input", { class: "input", id: "e-subject", type: "text", maxlength: "40", placeholder: "e.g. Physics SL", value: w.subject, list: "e-subjects", autocomplete: "off" });
    const dl = el("datalist", { id: "e-subjects" }, S.subjects().map((x) => el("option", { value: x })));
    const subjChips = el("div", { class: "chips" });
    function drawSubjects() {
      U.fill(subjChips, ...S.subjects().slice(0, 8).map((x) => el("button", { class: "chip", type: "button", "aria-pressed": String(subj.value.trim().toLowerCase() === x.toLowerCase()), onclick: () => { subj.value = subj.value.trim().toLowerCase() === x.toLowerCase() ? "" : x; drawSubjects(); } },
        el("span", { class: "dot", vars: { "--c": S.subjectColor(x) } }), x)));
    }
    subj.addEventListener("input", drawSubjects); drawSubjects();
    const kind = U.seg([{ v: "homework", label: "Homework" }, { v: "exam", label: "Test or exam" }], w.kind, (v) => { w.kind = v; prepBtn.hidden = v !== "exam"; }, "Type");

    // ----- due date and time -----
    const date = el("input", { class: "input", type: "date", id: "e-date", value: C.dayKey(w.due), required: true });
    const tm = el("input", { class: "input", type: "time", id: "e-time", value: C.fmtTime(w.due), disabled: w.allDay || null });
    const allDay = U.switchEl(w.allDay, "All day (due by end of day)", (v) => { w.allDay = v; tm.disabled = v; }, "e-allday");
    const quickDays = el("div", { class: "chips" });
    [[0, "Today"], [1, "Tomorrow"], [2, null], [7, "In a week"]].forEach((p) => {
      const ms = C.addDays(C.startOfDay(now), p[0]);
      U.add(quickDays, el("button", { class: "chip", type: "button", onclick: () => { date.value = C.dayKey(ms); markQuick(); } }, p[1] || C.DOW_FULL[new Date(ms).getDay()]));
    });
    const quickTimes = el("div", { class: "chips" }, QUICK_TIMES.map((x) => el("button", { class: "chip", type: "button", onclick: () => { tm.value = x; markQuick(); } }, x)));
    function markQuick() {
      U.$$("button", quickDays).forEach((b, i) => b.setAttribute("aria-pressed", String(date.value === C.dayKey(C.addDays(C.startOfDay(now), [0, 1, 2, 7][i])))));
      U.$$("button", quickTimes).forEach((b) => b.setAttribute("aria-pressed", String(!tm.disabled && tm.value === b.textContent)));
    }
    date.addEventListener("input", markQuick); tm.addEventListener("input", markQuick); markQuick();
    const dueErr = el("span", { class: "hint coral", hidden: true });

    // ----- priority, estimate -----
    const prio = U.seg(C.PRIORITIES.map((p) => ({ v: p.v, label: p.label })), w.priority, (v) => { w.priority = v; }, "Priority", "full");
    const estIn = el("input", { class: "input sm", type: "number", min: "0", max: "1440", step: "5", id: "e-est", value: w.est || "", placeholder: "min", style: { width: "92px" } });
    const estChips = el("div", { class: "chips" }, EST.map((m) => el("button", { class: "chip", type: "button", "aria-pressed": String(w.est === m), onclick: () => { estIn.value = estIn.value == m ? "" : m; drawEst(); } }, C.fmtMins(m))), estIn);
    function drawEst() { U.$$("button", estChips).forEach((b, i) => b.setAttribute("aria-pressed", String(+estIn.value === EST[i]))); }
    estIn.addEventListener("input", drawEst);

    // ----- checklist -----
    const subList = el("div", { class: "subtasks" });
    function drawSubs() {
      U.fill(subList, ...w.subtasks.map((x, i) => el("div", { class: "subtask" + (x.done ? " done" : "") },
        U.cbx(x.done, (x.done ? "Untick " : "Tick ") + x.text, (v) => { x.done = v; drawSubs(); }),
        el("input", { class: "txt", type: "text", value: x.text, maxlength: "200", "aria-label": "Step " + (i + 1), oninput: (e) => { x.text = e.target.value; } }),
        x.due ? el("span", { class: "when", text: C.fmtDay(x.due) }) : null,
        U.iconBtn("x", "Remove step", () => { w.subtasks.splice(i, 1); drawSubs(); }, { class: "icon-btn sm" }))));
    }
    const subAdd = el("input", { class: "input", type: "text", id: "e-sub-add", placeholder: "Add a step and press Enter", maxlength: "200" });
    subAdd.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addSub(); } });
    function addSub() { const v = subAdd.value.trim(); if (!v) return; w.subtasks.push({ id: C.newId("s"), text: v, done: false, due: 0 }); subAdd.value = ""; drawSubs(); subAdd.focus(); }
    const prepBtn = U.btn("Add a revision plan", { kind: "outline", size: "sm", icon: "wand", onclick: () => {
      const d = readDue();
      if (!d) { dueErr.textContent = "Set the exam date first."; dueErr.hidden = false; return; }
      const ms = C.prepMilestones(d, now);
      if (!ms.length) { U.toast("The exam is too close for a revision plan. Add steps yourself."); return; }
      w.subtasks = w.subtasks.concat(ms); drawSubs();
    } });
    prepBtn.hidden = w.kind !== "exam";
    drawSubs();

    // ----- notes, links -----
    const notes = el("textarea", { class: "textarea", id: "e-notes", maxlength: "4000", placeholder: "Instructions, page numbers, anything you'll need" });
    notes.value = w.notes;
    const remaining = el("input", { class: "input", id: "e-left", type: "text", maxlength: "600", value: w.remaining, placeholder: "What's still left to do" });
    const linkList = el("div", { class: "stack sm" });
    function drawLinks() {
      U.fill(linkList, ...w.links.map((l, i) => el("div", { class: "row" }, icon("link", 16),
        el("a", { href: l.url, target: "_blank", rel: "noopener", class: "grow truncate", text: l.title || l.url }), U.iconBtn("x", "Remove link", () => { w.links.splice(i, 1); drawLinks(); }, { class: "icon-btn sm" }))));
    }
    const linkIn = el("input", { class: "input", type: "url", id: "e-link", placeholder: "Paste a link (Google Doc, worksheet…)" });
    const linkErr = el("span", { class: "hint coral", hidden: true });
    function addLink() {
      const u = C.safeUrl(linkIn.value);
      if (!u) { linkErr.textContent = linkIn.value.trim() ? "That doesn't look like a web address." : ""; linkErr.hidden = !linkIn.value.trim(); return; }
      let label = u; try { label = new URL(u).hostname.replace(/^www\./, ""); } catch (e) { /* keep the raw address */ }
      w.links.push({ url: u, title: label }); linkIn.value = ""; linkErr.hidden = true; drawLinks();
    }
    linkIn.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } });
    drawLinks();

    // ----- reminders, repeat, plan -----
    const useDefault = w.reminders === null;
    let rem = useDefault ? st.leads.slice() : w.reminders.slice();
    const remChips = el("div", { class: "chips" });
    function drawRem() {
      U.fill(remChips, ...LEADS.map((h) => el("button", { class: "chip", type: "button", "aria-pressed": String(rem.indexOf(h) !== -1), onclick: () => {
        const i = rem.indexOf(h); if (i === -1) rem.push(h); else rem.splice(i, 1); rem.sort((a, b) => b - a); w.reminders = rem.slice(); remDef.setAttribute("aria-checked", "false"); drawRem(); } }, h < 24 ? h + " h" : h / 24 + (h === 24 ? " day" : " days"))));
    }
    const remDef = U.switchEl(useDefault && st.remindDefault, "Use my default reminders", (v) => { w.reminders = v ? null : rem.slice(); if (v) { rem = st.leads.slice(); drawRem(); } }, "e-remdef");
    drawRem();
    const recur = U.select([{ v: "", label: "Doesn't repeat" }].concat(Object.keys(C.RECUR).map((k) => ({ v: k, label: C.RECUR[k] }))), w.recur ? w.recur.freq : "", (v) => { w.recur = v ? { freq: v, until: w.recur ? w.recur.until : 0 } : null; untilBox.hidden = !v; }, { id: "e-recur" });
    const until = el("input", { class: "input", type: "date", id: "e-until", value: w.recur && w.recur.until ? C.dayKey(w.recur.until) : "" });
    const untilBox = U.field("Repeat until (optional)", until);
    untilBox.hidden = !w.recur;
    const planOpts = [{ v: "", label: "Not planned" }];
    for (let i = 0; i < 14; i++) { const ms = C.addDays(C.startOfDay(now), i); planOpts.push({ v: C.dayKey(ms), label: (i === 0 ? "Today" : i === 1 ? "Tomorrow" : C.fmtDay(ms)) }); }
    if (w.plan && !planOpts.some((o) => o.v === w.plan)) planOpts.push({ v: w.plan, label: C.fmtDay(C.keyToMs(w.plan)) });
    const plan = U.select(planOpts, w.plan, (v) => { w.plan = v; }, { id: "e-plan" });

    // ----- ManageBac source -----
    let mbNote = null;
    if (orig && orig.source === "managebac") {
      const edited = Object.keys(orig.edited || {});
      const diff = orig.mb && edited.length ? edited.map((f) => f === "due" ? "due " + C.dueLabel({ due: orig.mb.due, allDay: orig.mb.allDay }) : f === "title" ? "title “" + orig.mb.title + "”" : f).join(", ") : "";
      mbNote = el("div", { class: "mb-note" }, icon("cap"), el("div", { class: "stack sm grow" },
        el("span", { text: "Imported from ManageBac. " + (edited.length ? "You changed " + edited.join(", ") + "; syncing won't overwrite your changes." : "Syncing keeps it up to date.") }),
        diff ? el("span", { class: "muted", text: "ManageBac currently says: " + diff + "." }) : null,
        el("div", { class: "btn-row" }, orig.url ? U.btn("Open in ManageBac", { size: "xs", kind: "outline", icon: "external", href: orig.url, target: "_blank" }) : null,
          edited.length ? U.btn("Use ManageBac's version", { size: "xs", kind: "outline", icon: "undo", onclick: () => { S.resetToManageBac(orig.id); s.close(); U.toast("Back to ManageBac's version", { undo: () => S.undo() }); } }) : null)));
    }

    // ----- layout -----
    const more = el("details", { class: "more-sect", open: orig && (orig.notes || orig.links.length || orig.recur || orig.reminders) ? true : null },
      el("summary", null, icon("right"), "Notes, links, reminders and repeat"),
      el("div", { class: "in" },
        U.field("Notes", notes),
        el("div", { class: "form-sect" }, el("span", { class: "label" }, icon("link"), "Links"), linkList, el("div", { class: "row" }, el("div", { class: "grow" }, linkIn), U.btn("Add", { size: "sm", onclick: addLink })), linkErr),
        el("div", { class: "form-sect" }, el("span", { class: "label" }, icon("bell"), "Reminders"),
          el("div", { class: "switch-row", style: { padding: 0 } }, el("span", { class: "small", text: "Use my default reminders (" + (st.leads.length ? st.leads.map((h) => h + " h").join(", ") + " before" : "none set") + ")" }), remDef),
          el("span", { class: "hint small muted", text: "Or pick when to be reminded before it's due:" }), remChips,
          el("span", { class: "hint xs dim", text: "Reminders appear while Due Board is open. For alerts on your phone, add homework to Google Calendar." })),
        el("div", { class: "field-row stack-sm" }, U.field("Repeat", recur), untilBox)));
    U.add(s.body, 
      mbNote,
      el("div", { class: "field" }, el("label", { for: "e-title", text: "What's due?" }), title, titleErr),
      el("div", { class: "form-sect" }, el("label", { class: "label", for: "e-subject", text: "Subject" }), subj, dl, subjChips),
      el("div", { class: "form-sect" }, el("span", { class: "label", text: "Due" }), quickDays,
        el("div", { class: "field-row" }, U.field("Date", date), U.field("Time", tm)),
        el("div", { class: "row", style: { gap: "10px" } }, allDay, el("label", { for: "e-allday", class: "small", text: "All day (due by the end of the day)" })), quickTimes, dueErr),
      el("div", { class: "field-row stack-sm" }, el("div", { class: "form-sect" }, el("span", { class: "label", text: "Type" }), kind), U.field("Plan to work on it", plan)),
      el("div", { class: "form-sect" }, el("span", { class: "label" }, icon("flag"), "Priority"), prio),
      el("div", { class: "form-sect" }, el("span", { class: "label" }, icon("hourglass"), "Estimated time"), estChips),
      el("div", { class: "form-sect" }, el("span", { class: "label" }, icon("list"), "Checklist"), subList, el("div", { class: "row" }, el("div", { class: "grow" }, subAdd), U.btn("Add", { size: "sm", onclick: addSub })), prepBtn),
      orig && (orig.remaining || !orig.done) ? U.field("Still left to do", remaining, "Shown on the homework until it's done.") : null,
      more);

    // ----- footer -----
    const save = U.btn(orig ? "Save changes" : "Add homework", { kind: "primary", id: "e-save", type: "submit" });
    if (orig) {
      U.add(s.foot, U.iconBtn("more", "More actions", (e) => U.menu(e.currentTarget, [
        { label: orig.done ? "Mark not done" : "Mark done", icon: orig.done ? "undo" : "check", run: () => { s.close(); App.complete(orig.id, !orig.done); } },
        !orig.done ? { label: "Start focus", icon: "timer", run: () => { s.close(); DB.focus.openFor(orig.id); } } : null,
        { label: "Add to Google Calendar", icon: "external", run: () => window.open(C.gcalUrl(orig), "_blank", "noopener") },
        { label: "Archive", icon: "archive", run: () => { s.close(); App.archive(orig.id); } },
        "-", { label: "Delete", icon: "trash", danger: true, run: () => { s.close(); App.remove(orig.id); } },
      ].filter(Boolean)), { class: "icon-btn boxed" }));
    }
    U.add(s.foot, U.btn("Cancel", { onclick: () => { if (JSON.stringify(collect()) === startJson) s.close(); else confirmDiscard(); } }), save);

    function readDue() {
      const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.value), tmm = /^(\d{2}):(\d{2})$/.exec(tm.value || "");
      if (!dm) return null;
      if (w.allDay) return new Date(+dm[1], +dm[2] - 1, +dm[3], 23, 59).getTime();
      if (!tmm) return null;
      return new Date(+dm[1], +dm[2] - 1, +dm[3], +tmm[1], +tmm[2]).getTime();
    }
    function collect() {
      const out = Object.assign({}, w);
      out.title = title.value.trim(); out.subject = subj.value.trim(); out.notes = notes.value; out.remaining = remaining.value.trim();
      out.due = readDue() || w.due; out.est = Math.max(0, Math.min(1440, Math.round(+estIn.value || 0)));
      out.subtasks = w.subtasks.filter((x) => x.text.trim()).map((x) => Object.assign({}, x, { text: x.text.trim() }));
      if (out.recur) out.recur = { freq: out.recur.freq, until: until.value ? C.keyToMs(until.value) + C.DAY - 1 : 0 };
      return out;
    }
    s.foot.addEventListener("click", (e) => { if (e.target.closest("#e-save")) submit(); });
    s.body.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } });
    title.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } });
    function submit() {
      const t = collect();
      titleErr.hidden = true; dueErr.hidden = true; title.removeAttribute("aria-invalid");
      if (!t.title) { titleErr.textContent = "Give it a title."; titleErr.hidden = false; title.setAttribute("aria-invalid", "true"); title.focus(); return; }
      if (!readDue()) { dueErr.textContent = w.allDay ? "Pick a due date." : "Pick a due date and time."; dueErr.hidden = false; date.focus(); return; }
      const saved = S.saveTask(t);
      s.close();
      if (!orig) U.toast("Added “" + saved.title + "”", { icon: "check", detail: C.dueLabel(saved), undo: () => S.undo() });
      else U.toast("Saved", { icon: "check", undo: () => S.undo() });
    }
    s.open();
    if (!orig) title.focus();
  }
  // A one-line add, used by the calendar and planner.
  function quickAdd(titleText, dueMs, extra) {
    const t = Object.assign({ title: titleText.trim().slice(0, 200), due: dueMs, reminders: null }, extra || {});
    if (!t.title) return null;
    const saved = DB.app.store.saveTask(t);
    U.toast("Added “" + saved.title + "”", { icon: "check", detail: C.dueLabel(saved), undo: () => DB.app.store.undo(), action: { label: "Edit", run: () => open(saved.id) } });
    return saved;
  }
  DB.editor = { open, quickAdd };
})();
