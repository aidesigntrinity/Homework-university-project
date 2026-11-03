/* Focus: a study timer attached to homework, with Pomodoro cycles and breaks.
   The running timer is kept on this device with absolute times, so it survives reloads and closing the app:
   a block that ended while the app was closed is recorded at the moment it ended. */
(function () {
  "use strict";
  const DB = window.DB, C = DB.core, U = DB.ui;
  const { el, icon } = U;
  DB.pages = DB.pages || {};
  const KEY = "dueboard:focus";
  let f = null, ticker = null, audio = null, wake = null;

  const now = () => DB.app.now();
  function save() { try { if (f) localStorage.setItem(KEY, JSON.stringify(f)); else localStorage.removeItem(KEY); } catch (e) { /* the timer still runs in memory */ } }
  function left() { return !f ? 0 : f.paused ? f.remaining : f.endAt - now(); }
  const running = () => f && (f.phase === "focus" || f.phase === "break");
  const active = () => f && ["focus", "break", "ask", "breakover", "between"].indexOf(f.phase) !== -1;

  function settings() { return DB.app.store.settings().focus; }
  function openFor(taskId) {
    if (active()) { DB.app.go("focus"); if (f.taskId !== taskId) U.toast("Finish or cancel the current session first.", { icon: "timer" }); return; }
    const t = taskId ? DB.app.store.task(taskId) : null, fs = settings();
    f = { phase: "setup", taskId: t ? t.id : "", title: t ? t.title : "", subject: t ? t.subject : "", note: t && t.remaining ? t.remaining : "", mins: fs.mins, pomodoro: fs.pomodoro, cycles: fs.cycles, cycle: 1, shortB: fs.short, longB: fs.long };
    save(); DB.app.go("focus");
  }
  function start() {
    f.phase = "focus"; f.paused = false; f.startedAt = now(); f.endAt = now() + f.mins * 60000; f.remaining = 0;
    save(); prime(); keepAwake(true); tick(); DB.app.render();
  }
  function togglePause() {
    if (!running()) return;
    if (f.paused) { f.endAt = now() + f.remaining; f.paused = false; keepAwake(true); }
    else { f.remaining = Math.max(0, f.endAt - now()); f.paused = true; keepAwake(false); }
    save(); update();
  }
  // Records the minutes actually studied (pauses not counted) against the homework and its subject.
  function finishFocus(natural, at) {
    if (!f || f.phase !== "focus") return;
    const end = at || now(), l = f.paused ? f.remaining : Math.max(0, f.endAt - end);
    const studied = Math.max(0, Math.round((f.mins * 60000 - l) / 60000));
    f.studied = studied; f.natural = !!natural; f.sessionId = "";
    if (studied >= 1) {
      const s = DB.app.store.addSession({ start: end - studied * 60000, end, mins: studied, taskId: f.taskId, title: f.title, subject: f.subject, note: f.note, result: "" });
      f.sessionId = s.id;
    }
    f.phase = "ask"; save(); keepAwake(false);
    if (natural) alertDone("Focus block done: " + (f.title || "study session"), "Did you make progress?");
    DB.app.render();
  }
  function answer(result, remainingText, ticks) {
    const S = DB.app.store, t = f.taskId ? S.task(f.taskId) : null;
    if (f.sessionId && S.data.sessions[f.sessionId]) S.put("session", f.sessionId, Object.assign({}, S.data.sessions[f.sessionId], { result }));
    if (t && result === "left") {
      const subtasks = (t.subtasks || []).map((x) => Object.assign({}, x, { done: ticks && ticks[x.id] !== undefined ? ticks[x.id] : x.done }));
      S.patchTask(t.id, { remaining: remainingText || "", subtasks }, "Progress saved");
    }
    f.result = result;
    if (t && result === "complete" && !t.done) { S.patchTask(t.id, { remaining: "" }, "Progress saved"); DB.app.complete(t.id, true); }
    f.phase = f.pomodoro && f.cycle < f.cycles && result !== "complete" ? "between" : "done";
    save(); DB.app.render();
  }
  function startBreak() {
    const long = f.cycle % f.cycles === 0;
    f.breakMins = long ? f.longB : f.shortB;
    f.phase = "break"; f.paused = false; f.startedAt = now(); f.endAt = now() + f.breakMins * 60000;
    save(); tick(); DB.app.render();
  }
  function endBreak(natural) {
    f.phase = "breakover"; f.cycle += 1; save(); stopTick();
    if (natural) alertDone("Break's over", "Ready for focus block " + f.cycle + "?");
    DB.app.render();
  }
  function nextBlock() { start(); }
  function close() { f = null; save(); stopTick(); keepAwake(false); DB.app.go("home"); }
  function discard() {
    U.confirmDialog({ title: "Cancel this session?", text: "This block won't be recorded. Blocks you already finished stay saved.", ok: "Cancel session", cancel: "Keep going", danger: true }).then((yes) => { if (yes) close(); });
  }
  function restore() {
    try { const x = JSON.parse(localStorage.getItem(KEY) || "null"); if (x && x.phase) f = x; } catch (e) { f = null; }
    if (!f) return;
    if (f.phase === "focus" && !f.paused && f.endAt <= now()) finishFocus(true, f.endAt);
    else if (f.phase === "break" && !f.paused && f.endAt <= now()) endBreak(false);
    else if (running()) tick();
  }
  function tick() {
    stopTick();
    ticker = setInterval(() => {
      if (!running()) { stopTick(); return; }
      if (!f.paused && left() <= 0) { if (f.phase === "focus") finishFocus(true, f.endAt); else endBreak(true); }
      else update();
    }, 500);
  }
  function stopTick() { if (ticker) clearInterval(ticker); ticker = null; }
  function update() {
    if (!f) return;
    const l = Math.max(0, left()), total = (f.phase === "break" ? f.breakMins : f.mins) * 60000;
    const t = document.getElementById("fc-time");
    if (t) {
      t.textContent = C.mmss(l);
      const ring = document.getElementById("fc-ring"), arc = ring && ring.querySelector(".arc");
      if (ring) ring.classList.toggle("paused", !!f.paused);
      if (arc) { const C2 = +arc.getAttribute("stroke-dasharray"); arc.setAttribute("stroke-dashoffset", (C2 * (1 - l / total)).toFixed(2)); }
      const p = document.getElementById("fc-pause"); if (p) U.fill(p, icon(f.paused ? "play" : "pause"), f.paused ? "Resume" : "Pause");
      const ph = document.getElementById("fc-phase"); if (ph) ph.textContent = phaseLabel();
    }
    const b = document.getElementById("fb-time"); if (b) b.textContent = C.mmss(l) + (f.paused ? " · paused" : " left");
    document.title = (running() ? C.mmss(l) + " · " : "") + (DB.pages[DB.app.route.name] ? DB.pages[DB.app.route.name].title + " · " : "") + "Due Board";
  }
  function phaseLabel() {
    if (f.paused) return "Paused";
    if (f.phase === "break") return (f.breakMins >= f.longB && f.cycle % f.cycles === 0 ? "Long break" : "Short break");
    return f.pomodoro ? "Focus · " + f.cycle + " of " + f.cycles : "Focus · " + f.mins + " min";
  }
  function prime() { try { const AC = window.AudioContext || window.webkitAudioContext; if (AC && !audio) audio = new AC(); if (audio && audio.state === "suspended") audio.resume(); } catch (e) { audio = null; } }
  function alertDone(title, body) {
    if (settings().sound && audio) try {
      [0, 0.32, 0.64].forEach((d) => { const o = audio.createOscillator(), g = audio.createGain(), t0 = audio.currentTime + d; o.frequency.value = 880; o.connect(g); g.connect(audio.destination);
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28); o.start(t0); o.stop(t0 + 0.3); });
    } catch (e) { /* no sound available */ }
    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) { /* not supported */ }
    try { if (document.hidden && DB.app.store.settings().notify && typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(title, { body, tag: "dueboard-focus" }); } catch (e) { /* not available */ }
  }
  function keepAwake(on) {
    try {
      if (on && navigator.wakeLock && !wake) navigator.wakeLock.request("screen").then((l) => { wake = l; }, () => {});
      if (!on && wake) { wake.release().catch(() => {}); wake = null; }
    } catch (e) { wake = null; }
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && f) { if (running() && !f.paused && left() <= 0) { if (f.phase === "focus") finishFocus(true, f.endAt); else endBreak(true); } else if (running()) { keepAwake(!f.paused); update(); } } });

  // Shown on other pages while a session is going.
  function banner() {
    if (!active()) return null;
    const isRun = running();
    return el("button", { class: "focus-banner", type: "button", id: "focus-banner", onclick: () => DB.app.go("focus"), "aria-label": isRun ? "Return to your focus session" : "Finish your focus session" },
      el("span", { class: "fb-ic" }, icon(f.phase === "break" ? "coffee" : "timer")),
      el("span", { class: "grow stack", style: { gap: "2px" } }, el("span", { class: "eyebrow", text: isRun ? (f.phase === "break" ? "On a break" : "Focus session") : f.phase === "ask" ? "Session finished" : "Focus session" }),
        el("b", { class: "truncate", text: f.title || f.subject || "Study session" }),
        el("span", { class: "small muted", id: isRun ? "fb-time" : null, text: isRun ? C.mmss(Math.max(0, left())) + (f.paused ? " · paused" : " left") : f.phase === "ask" ? "Did you make progress? Tap to answer." : "Tap to continue." })),
      icon("right", 20));
  }

  // ---------- page ----------
  function render(page, ctx) {
    const S = ctx.store, st = S.settings();
    if (!f) { const fs = st.focus; f = { phase: "setup", taskId: "", title: "", subject: "", note: "", mins: fs.mins, pomodoro: fs.pomodoro, cycles: fs.cycles, cycle: 1, shortB: fs.short, longB: fs.long }; }
    if (f.taskId && !S.task(f.taskId) && f.phase === "setup") { f.taskId = ""; f.title = ""; }
    const shell = el("div", { class: "focus-shell" });
    const stage = el("section", { class: "focus-stage" + (running() ? " running" : ""), "aria-label": "Focus timer" });
    U.add(shell, stage, sidePanel(ctx));
    U.add(page, shell);
    const live = f.taskId ? S.task(f.taskId) : null;
    const head = el("div", { class: "row between" },
      el("div", null, el("div", { class: "eyebrow", text: running() ? phaseLabel() : f.phase === "setup" ? "New session" : "Focus" }), el("h1", { class: "display", style: { fontSize: "36px" }, text: "Focus" })),
      active() && f.phase !== "setup" ? U.btn("Back", { kind: "ghost", icon: "left", onclick: () => DB.app.go("home") }) : null);
    U.add(stage, head);

    if (f.phase === "setup") return setup(stage, ctx);
    if (live || f.title) U.add(stage, el("div", { class: "focus-task" }, el("div", { class: "row wrap", style: { gap: "8px", marginBottom: "4px" } }, U.tag(f.subject, S), live ? el("span", { class: "small muted", text: "Due " + C.dueLabel(live) }) : null), el("b", { style: { fontSize: "18px" }, text: f.title || f.subject })));
    if (f.phase === "focus" || f.phase === "break") {
      const total = (f.phase === "break" ? f.breakMins : f.mins) * 60000, l = Math.max(0, left());
      const ring = U.ring(300, 14, (l / total) * 100, f.phase === "break" ? "var(--teal)" : "var(--amber)", null);
      ring.className = "focus-ring" + (f.paused ? " paused" : "") + (f.phase === "break" ? " break" : ""); ring.id = "fc-ring"; ring.removeAttribute("style");
      ring.querySelector("svg").removeAttribute("width"); ring.querySelector("svg").removeAttribute("height");
      U.add(ring, el("div", { class: "mid" }, el("span", { class: "time", id: "fc-time", role: "timer", "aria-live": "off", text: C.mmss(l) }), el("span", { class: "phase", id: "fc-phase", text: phaseLabel() })));
      U.add(stage, ring);
      if (f.pomodoro) U.add(stage, el("div", { class: "cycle-dots", "aria-label": "Block " + f.cycle + " of " + f.cycles }, Array.from({ length: f.cycles }, (_, i) => el("i", { class: i + 1 < f.cycle ? "on" : i + 1 === f.cycle ? "now" : "" }))));
      if (f.note && f.phase === "focus") U.add(stage, el("div", { class: "note" }, el("span", { class: "eyebrow", style: { display: "block", marginBottom: "4px" }, text: "Working on" }), f.note));
      const pause = el("button", { class: "btn outline lg", type: "button", id: "fc-pause", onclick: togglePause }, icon(f.paused ? "play" : "pause"), f.paused ? "Resume" : "Pause");
      if (f.phase === "focus") U.add(stage, el("div", { class: "focus-controls" }, pause, U.btn("Session completed", { kind: "go", size: "lg", icon: "check", id: "fc-done", onclick: () => finishFocus(false) })),
        el("div", { class: "row", style: { justifyContent: "center" } }, el("button", { class: "link-btn", type: "button", id: "fc-discard", onclick: discard }, "Cancel without saving")));
      else U.add(stage, el("div", { class: "focus-controls" }, pause, U.btn("Skip break", { kind: "primary", size: "lg", icon: "skip", id: "fc-skip-break", onclick: () => endBreak(false) })));
      return;
    }
    if (f.phase === "ask") {
      U.add(stage, el("div", { class: "stack", style: { alignItems: "center", textAlign: "center", gap: "8px" } },
        el("div", { style: { width: "72px", height: "72px", borderRadius: "50%", background: "var(--teal)", color: "var(--on-teal)", display: "grid", placeItems: "center" } }, icon("check", 36)),
        el("h2", { class: "display", style: { fontSize: "34px" }, text: f.natural ? "Time's up" : "Session saved" }),
        el("p", { class: "muted", id: "fc-recorded", text: f.studied >= 1 ? C.fmtMins(f.studied) + " recorded" + (f.subject ? " for " + f.subject : "") + "." : "Less than a minute, so nothing was recorded." })),
        el("h3", { class: "display", style: { fontSize: "24px", textAlign: "center" }, text: "Did you make progress?" }));
      const box = el("div", { class: "stack" });
      if (live && !live.done) U.add(box, U.btn("Yes, it's finished: mark it complete", { kind: "go", size: "lg", block: true, icon: "check", id: "fc-complete", onclick: () => answer("complete") }));
      const leftIn = el("textarea", { class: "textarea", id: "fc-left", maxlength: "600", placeholder: "e.g. conclusion and references" }); leftIn.value = live ? live.remaining || "" : "";
      const ticks = {};
      const subs = live && live.subtasks && live.subtasks.length ? el("div", { class: "subtasks" }, live.subtasks.map((x) => el("div", { class: "subtask" + (x.done ? " done" : "") },
        U.cbx(x.done, "Tick " + x.text, (v, b) => { ticks[x.id] = v; b.setAttribute("aria-checked", String(v)); }), el("span", { class: "grow", text: x.text })))) : null;
      const leftBox = el("div", { class: "stack", id: "fc-left-box", hidden: true }, subs ? el("span", { class: "label", text: "Tick what you finished" }) : null, subs,
        U.field("What's left to do?", leftIn), U.btn("Save what's left", { kind: "primary", id: "fc-left-save", onclick: () => answer("left", leftIn.value.trim(), ticks) }));
      if (live) U.add(box, U.btn("Some progress: note what's left", { kind: "outline", size: "lg", block: true, icon: "edit", id: "fc-some", onclick: () => { leftBox.hidden = false; leftIn.focus(); } }), leftBox);
      U.add(box, U.btn(live ? "Not really, skip" : "Continue", { kind: "ghost", block: true, id: "fc-skip", onclick: () => answer("none") }));
      U.add(stage, box);
      return;
    }
    if (f.phase === "between") {
      const long = f.cycle % f.cycles === 0;
      U.add(stage, el("div", { class: "stack", style: { alignItems: "center", textAlign: "center" } }, icon("coffee", 44),
        el("h2", { class: "display", style: { fontSize: "34px" }, text: "Block " + f.cycle + " of " + f.cycles + " done" }),
        el("p", { class: "muted", text: "Take a " + (long ? f.longB : f.shortB) + "-minute " + (long ? "long " : "") + "break, then start block " + (f.cycle + 1) + "." }),
        el("div", { class: "focus-controls" }, U.btn("Start break", { kind: "primary", size: "lg", icon: "coffee", id: "fc-break", onclick: startBreak }),
          U.btn("Skip the break", { size: "lg", onclick: () => { f.cycle += 1; start(); } }), U.btn("End session", { kind: "ghost", size: "lg", onclick: () => { f.phase = "done"; save(); DB.app.render(); } }))));
      return;
    }
    if (f.phase === "breakover") {
      U.add(stage, el("div", { class: "stack", style: { alignItems: "center", textAlign: "center" } }, icon("timer", 44),
        el("h2", { class: "display", style: { fontSize: "34px" }, text: "Break's over" }),
        el("p", { class: "muted", text: "Block " + f.cycle + " of " + f.cycles + ", " + f.mins + " minutes." }),
        el("div", { class: "focus-controls" }, U.btn("Start block " + f.cycle, { kind: "primary", size: "lg", icon: "play", id: "fc-next", onclick: nextBlock }), U.btn("End session", { kind: "ghost", size: "lg", onclick: () => { f.phase = "done"; save(); DB.app.render(); } }))));
      return;
    }
    // done
    const msgs = { complete: "Marked complete. Nice work.", left: "Saved what's left. It shows on the homework until it's done.", none: "Your study time is saved." };
    U.add(stage, el("div", { class: "stack", style: { alignItems: "center", textAlign: "center" } },
      el("div", { style: { width: "72px", height: "72px", borderRadius: "50%", background: "var(--amber)", color: "var(--on-amber)", display: "grid", placeItems: "center" } }, icon("star", 34)),
      el("h2", { class: "display", style: { fontSize: "34px" }, text: "All set" }), el("p", { class: "muted", id: "fc-result", text: msgs[f.result] || msgs.none }),
      el("div", { class: "focus-controls" }, live && !live.done ? U.btn("Start another session", { size: "lg", id: "fc-again", onclick: () => { const id = f.taskId; f = null; save(); openFor(id); } }) : null,
        U.btn("Done", { kind: "primary", size: "lg", id: "fc-back", onclick: close }))));
  }

  function setup(stage, ctx) {
    const S = ctx.store, now = ctx.now;
    const open = S.activeTasks().filter((t) => !t.done).sort((a, b) => a.due - b.due);
    const pick = U.select([{ v: "", label: "No specific homework" }].concat(open.map((t) => ({ v: t.id, label: t.title + (t.subject ? " · " + t.subject : "") + " (" + C.relDay(t.due, now).toLowerCase() + ")" }))), f.taskId, (v) => {
      const t = v ? S.task(v) : null; f.taskId = v; f.title = t ? t.title : ""; f.subject = t ? t.subject : subjIn.value.trim(); f.note = t && t.remaining ? t.remaining : f.note; subjBox.hidden = !!t; save();
    }, { id: "fc-task" });
    const subjIn = el("input", { class: "input", id: "fc-subject", type: "text", maxlength: "40", placeholder: "e.g. Maths", value: f.taskId ? "" : f.subject, list: "fc-subjects" });
    subjIn.addEventListener("input", () => { if (!f.taskId) { f.subject = subjIn.value.trim(); save(); } });
    const subjBox = el("div", null, U.field("Subject (for your study stats)", subjIn), el("datalist", { id: "fc-subjects" }, S.subjects().map((x) => el("option", { value: x }))));
    subjBox.hidden = !!f.taskId;
    const presets = el("div", { class: "presets", role: "group", "aria-label": "Session length" });
    const custom = el("input", { class: "input", type: "number", id: "fc-custom", min: "5", max: "180", step: "5", value: [25, 45, 60].indexOf(f.mins) === -1 ? f.mins : "", placeholder: "Minutes" });
    const customBox = el("div", { hidden: [25, 45, 60].indexOf(f.mins) !== -1 }, U.field("Custom length (5–180 minutes)", custom));
    function drawPresets() {
      const isCustom = [25, 45, 60].indexOf(f.mins) === -1 || !customBox.hidden;
      U.fill(presets, ...[25, 45, 60].map((m) => el("button", { class: "preset", type: "button", "data-m": String(m), "aria-pressed": String(!isCustom && f.mins === m), onclick: () => { f.mins = m; customBox.hidden = true; save(); drawPresets(); } }, el("b", { text: String(m) }), " ", el("span", { text: "min" }))),
        el("button", { class: "preset", type: "button", "aria-pressed": String(isCustom), onclick: () => { customBox.hidden = false; custom.focus(); drawPresets(); } }, el("b", { text: "…" }), el("span", { text: "Custom" })));
    }
    custom.addEventListener("input", () => { const v = Math.round(+custom.value); if (v >= 5 && v <= 180) { f.mins = v; save(); } });
    drawPresets();
    const note = el("input", { class: "input", id: "fc-note", type: "text", maxlength: "140", placeholder: "e.g. write the method section", value: f.note || "" });
    note.addEventListener("input", () => { f.note = note.value.trim(); save(); });
    const pomoBox = el("div", { class: "field-row", hidden: !f.pomodoro },
      U.field("Blocks", U.select([2, 3, 4, 5, 6].map((n) => ({ v: n, label: n + " blocks" })), f.cycles, (v) => { f.cycles = +v; save(); }, { id: "fc-cycles" })),
      U.field("Breaks", U.select([[5, 15], [5, 20], [10, 20], [10, 30]].map((p) => ({ v: p.join("/"), label: p[0] + " min, long " + p[1] })), f.shortB + "/" + f.longB, (v) => { const p = v.split("/"); f.shortB = +p[0]; f.longB = +p[1]; save(); }, { id: "fc-breaks" })));
    U.add(stage, 
      U.field("What are you studying?", pick),
      subjBox,
      el("div", { class: "form-sect" }, el("span", { class: "label", text: "How long?" }), presets, customBox),
      U.field("What will you work on?", note, "A short goal for this block helps you focus."),
      U.switchRow("Pomodoro cycles", "Repeat focus blocks with short breaks, and a long break at the end.", f.pomodoro, (v) => { f.pomodoro = v; pomoBox.hidden = !v; save(); }, "fc-pomo"), pomoBox,
      U.btn("Start focus", { kind: "primary", size: "lg", block: true, icon: "play", id: "fc-start", onclick: () => {
        if (!customBox.hidden) { const v = Math.round(+custom.value); if (!(v >= 5 && v <= 180)) { custom.setAttribute("aria-invalid", "true"); custom.focus(); U.toast("Pick a length between 5 and 180 minutes."); return; } f.mins = v; }
        if (!f.taskId) { f.subject = subjIn.value.trim(); f.title = f.subject ? f.subject + " study" : ""; }
        f.note = note.value.trim(); start();
      } }),
      el("p", { class: "xs muted", style: { textAlign: "center" }, text: "The timer keeps counting if you switch apps or close Due Board. You can pause at any time." }));
  }

  function sidePanel(ctx) {
    const S = ctx.store, now = ctx.now, st = S.settings(), stats = S.stats(now);
    const today = stats.focusPerDay[C.dayKey(now)] || 0, ws = C.weekStartOf(now, st.weekStart);
    const week = stats.sessions.filter((s) => s.end >= ws), weekMins = week.reduce((a, s) => a + s.mins, 0);
    const bySub = {}; week.forEach((s) => { const k = s.subject || "Other"; bySub[k] = (bySub[k] || 0) + s.mins; });
    const recent = stats.sessions.slice().reverse().slice(0, 8);
    const aside = el("div", { class: "aside" });
    U.add(aside, el("div", { class: "card" }, el("div", { class: "card-head" }, el("span", { class: "card-title", text: "Goals" }), U.btn("Change", { size: "xs", kind: "ghost", onclick: () => DB.app.go("settings", false, "personal") })),
      el("div", { class: "stack lg" },
        goal("Today", today, st.goals.daily), goal("This week", weekMins, st.goals.weekly))));
    const subs = Object.keys(bySub).sort((a, b) => bySub[b] - bySub[a]);
    if (subs.length) U.add(aside, el("div", { class: "card" }, el("div", { class: "card-head" }, el("span", { class: "card-title", text: "This week by subject" })),
      el("div", null, subs.map((k) => el("div", { class: "hbar" }, el("span", { class: "row", style: { gap: "8px", minWidth: "0" } }, el("span", { class: "dot", vars: { "--c": k === "Other" ? "var(--muted)" : S.subjectColor(k) } }), el("span", { class: "truncate", text: k })),
        el("span", { class: "track" }, el("i", { vars: { "--c": k === "Other" ? "var(--muted)" : S.subjectColor(k) }, style: { width: (bySub[k] / bySub[subs[0]]) * 100 + "%" } })), el("span", { class: "val", text: C.fmtMins(bySub[k]) }))))));
    U.add(aside, el("div", { class: "card" }, el("div", { class: "card-head" }, el("span", { class: "card-title", text: "Recent sessions" })),
      recent.length ? el("div", { class: "timeline" }, recent.map((s) => el("div", { class: "tl-item" }, el("span", { class: "ic focus" }, icon("timer")),
        el("div", { class: "tx" }, el("b", { text: s.title || s.subject || "Study session" }), el("span", { text: C.relDay(s.end, now) + " · " + C.fmtTime(s.end) + (s.result === "complete" ? " · finished it" : s.result === "left" ? " · some progress" : "") })),
        el("span", { class: "small muted", text: C.fmtMins(s.mins) }),
        U.iconBtn("x", "Remove this session", () => { S.batch("Session removed", () => S.put("session", s.id, Object.assign({}, s, { deleted: Date.now() }))); U.toast("Session removed", { undo: () => S.undo() }); }, { class: "icon-btn sm" }))))
        : el("p", { class: "muted small", text: "Sessions you complete appear here." })));
    return aside;
  }
  function goal(label, mins, target) {
    const pct = target ? (mins / target) * 100 : 0;
    return el("div", { class: "stack sm" }, el("div", { class: "row between" }, el("b", { text: label }), el("span", { class: "small " + (pct >= 100 ? "teal" : "muted"), text: C.fmtMins(mins) + (target ? " / " + C.fmtMins(target) : "") })), target ? U.meter(pct, "teal", label + " goal") : null);
  }

  DB.focus = { openFor, restore, banner, active, state: () => f };
  DB.pages.focus = { title: "Focus", render, immersive: () => running() };
})();
