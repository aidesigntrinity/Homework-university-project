/* Due Board UI kit: DOM helpers, icons and the shared components every screen is built from. */
(function () {
  "use strict";
  const DB = (window.DB = window.DB || {});
  const C = DB.core;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
  // el("button", {class: "btn", onclick: fn}, "Label", child...) — props with null/false are skipped.
  function el(tag, props, ...kids) {
    const n = document.createElement(tag);
    if (props) for (const k in props) {
      const v = props[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k === "style" && typeof v === "object") Object.assign(n.style, v);
      else if (k === "vars") Object.keys(v).forEach((x) => n.style.setProperty(x, v[x]));
      else if (k === "value") { if ("defaultValue" in n && n.tagName !== "SELECT") n.defaultValue = v; n.value = v; }
      else if (k === "checked") n.checked = !!v;
      else if (k.slice(0, 2) === "on" && typeof v === "function") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    }
    append(n, kids);
    return n;
  }
  function append(n, kids) {
    kids.forEach((c) => {
      if (c === null || c === undefined || c === false) return;
      if (Array.isArray(c)) append(n, c);
      else n.append(c.nodeType ? c : document.createTextNode(String(c)));
    });
    return n;
  }
  // Replace a node's children; null/false entries are skipped (replaceChildren would print them as text).
  function fill(n, ...kids) { n.replaceChildren(); return append(n, kids); }
  function add(n, ...kids) { return append(n, kids); }
  const NS = "http://www.w3.org/2000/svg";
  function svg(tag, attrs, ...kids) { const n = document.createElementNS(NS, tag); for (const k in attrs || {}) n.setAttribute(k, attrs[k]); kids.forEach((k) => k && n.append(k)); return n; }

  // Stroke icons on a 24px grid.
  const ICONS = {
    home: '<path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    planner: '<rect x="3.5" y="4" width="17" height="16.5" rx="2.5"/><path d="M9.5 4v16.5M15 4v16.5M3.5 9h17"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
    timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 10v3.5l2.5 2M9.5 2.5h5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    left: '<path d="M15 5l-7 7 7 7"/>', right: '<path d="M9 5l7 7-7 7"/>', down: '<path d="m6 9 6 6 6-6"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>',
    bell: '<path d="M6 10a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 16 6 10M10 20.5a2 2 0 0 0 4 0"/>',
    repeat: '<path d="M17 2.5 20.5 6 17 9.5"/><path d="M3.5 11.5V10A4 4 0 0 1 7.5 6h13M7 21.5 3.5 18 7 14.5"/><path d="M20.5 12.5V14a4 4 0 0 1-4 4h-13"/>',
    archive: '<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v10a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V9M10 13h4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    more: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11"/>',
    monitor: '<rect x="3" y="4" width="18" height="12.5" rx="2"/><path d="M8.5 20.5h7M12 16.5v4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    logout: '<path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H15M10 16.5 14.5 12 10 7.5M14.5 12H4"/>',
    cloud: '<path d="M7 18.5a4.5 4.5 0 0 1-.6-8.96 6 6 0 0 1 11.6 1.46A3.75 3.75 0 0 1 17.25 18.5z"/>',
    cloudOff: '<path d="M3 3l18 18M8.5 7.6a6 6 0 0 1 9.5 3.4 3.75 3.75 0 0 1 2 6.4M17 18.5H7a4.5 4.5 0 0 1-1.6-8.7"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5M4 4.5v4h4M4 13a8 8 0 0 0 14.6 4.5M20 19.5v-4h-4"/>',
    download: '<path d="M12 4v11M7 10.5l5 5 5-5M4.5 20h15"/>',
    upload: '<path d="M12 16V5M7 9.5l5-5 5 5M4.5 20h15"/>',
    star: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/>',
    flame: '<path d="M12 21.5c-4 0-7-2.8-7-6.6 0-3.3 2.2-5.2 3.6-7.4.5 1.6 1.4 2.6 2.4 3 .2-3.2 1.6-5.6 3.8-7.5.3 2.8 1.6 4.4 3 6 1.2 1.4 2.2 3 2.2 5.4 0 4.1-3.4 7.1-8 7.1z"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5v1.5A3.5 3.5 0 0 0 8 11M16 6h3.5v1.5A3.5 3.5 0 0 1 16 11M12 13v4M8.5 21h7M9.5 17h5v4h-5z"/>',
    medal: '<circle cx="12" cy="15" r="5.5"/><path d="M8.5 10.5 6 3h4l2 5 2-5h4l-2.5 7.5M12 12.5v5"/>',
    sunrise: '<path d="M4 18h16M6.3 14a6 6 0 0 1 11.4 0M12 3v4M4.9 8.9l1.4 1.4M19.1 8.9l-1.4 1.4M9 6l3-3 3 3M2 22h20"/>',
    hourglass: '<path d="M6.5 3h11M6.5 21h11M7.5 3v3.5a4.5 4.5 0 0 0 9 0V3M7.5 21v-3.5a4.5 4.5 0 0 1 9 0V21"/>',
    filter: '<path d="M4 5h16l-6.2 7.5V19l-3.6 1.8v-8.3z"/>',
    sort: '<path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1.2 1.2L7 5M3.5 12l1.2 1.2L7 11M3.5 18l1.2 1.2L7 17"/>',
    alert: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.5v.01"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.5v.01"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M3 3l18 18M10.6 5.6A9 9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3 3.7M6.6 6.6C3.9 8.4 2.5 12 2.5 12s3.5 6.5 9.5 6.5a9 9 0 0 0 4.4-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14.5V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V7.5A1.5 1.5 0 0 1 5.5 6H10"/>',
    play: '<path d="M7 4.5v15l12.5-7.5z"/>', pause: '<path d="M8 4.5v15M16 4.5v15"/>',
    skip: '<path d="M5 5v14l10-7zM19 5v14"/>',
    coffee: '<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 2.5v3M12 2.5v3"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
    cap: '<path d="M2.5 9 12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11v5c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3v-5M21.5 9v5"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
    grip: '<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
    wand: '<path d="M4 20 15 9M14 4v3M12.5 5.5h3M19 9v3M17.5 10.5h3M18 3l1 1M6.5 6.5 8 8"/>',
    google: '<path d="M21 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5.1a4.4 4.4 0 0 1-1.9 2.9v2.4h3.1c1.7-1.6 2.7-4 2.7-7z"/><path d="M12 21.5c2.6 0 4.7-.9 6.3-2.3l-3.1-2.4c-.9.6-2 .9-3.2.9-2.5 0-4.6-1.7-5.3-3.9H3.5v2.5A9.5 9.5 0 0 0 12 21.5z"/><path d="M6.7 13.8a5.7 5.7 0 0 1 0-3.6V7.7H3.5a9.5 9.5 0 0 0 0 8.6z"/><path d="M12 6.3c1.4 0 2.6.5 3.6 1.4l2.7-2.7A9.5 9.5 0 0 0 3.5 7.7l3.2 2.5C7.4 8 9.5 6.3 12 6.3z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M7.5 14h9"/>',
    bolt: '<path d="M13 3 5 14h6l-1 7 8-11h-6z"/>',
  };
  function icon(name, size) {
    const s = svg("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false" });
    if (size) { s.setAttribute("width", size); s.setAttribute("height", size); }
    s.innerHTML = ICONS[name] || ICONS.info;
    return s;
  }

  // ---------- small components ----------
  function btn(label, opts) {
    opts = opts || {};
    const b = el(opts.href ? "a" : "button", { class: "btn" + (opts.kind ? " " + opts.kind : "") + (opts.size ? " " + opts.size : "") + (opts.block ? " block" : ""), type: opts.href ? null : opts.type || "button",
      href: opts.href || null, target: opts.target || null, rel: opts.target ? "noopener" : null, onclick: opts.onclick || null, id: opts.id || null, disabled: opts.disabled || null, "aria-label": opts.label || null, title: opts.title || null });
    if (opts.icon) b.append(icon(opts.icon));
    if (label) b.append(label);
    return b;
  }
  function iconBtn(name, label, onclick, extra) {
    const b = el("button", Object.assign({ class: "icon-btn", type: "button", "aria-label": label, title: label, onclick }, extra || {}));
    b.append(icon(name)); return b;
  }
  function tag(subject, store) { if (!subject) return null; return el("span", { class: "tag", vars: { "--c": store.subjectColor(subject) }, text: subject }); }
  function prio(p) {
    if (!p) return null;
    const names = ["", "Low", "Medium", "High"];
    return el("span", { class: "prio p" + p, title: names[p] + " priority" }, icon("flag"), el("span", { class: "sr-only", text: names[p] + " priority" }), p === 3 ? "High" : null);
  }
  function cbx(checked, label, onchange, cls) {
    const b = el("button", { class: "cbx" + (cls ? " " + cls : ""), type: "button", role: "checkbox", "aria-checked": String(!!checked), "aria-label": label });
    b.append(icon("check"));
    b.addEventListener("click", (e) => { e.stopPropagation(); onchange(b.getAttribute("aria-checked") !== "true", b); });
    return b;
  }
  function meter(pct, cls, label) { return el("div", { class: "meter" + (cls ? " " + cls : ""), role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(Math.round(pct)), "aria-label": label || null }, el("i", { style: { width: Math.max(0, Math.min(100, pct)) + "%" } })); }
  function ring(size, stroke, pct, color, inner, label) {
    const r = (size - stroke) / 2, c = size / 2, C2 = 2 * Math.PI * r;
    const s = svg("svg", { width: size, height: size, viewBox: "0 0 " + size + " " + size, "aria-hidden": "true" },
      svg("circle", { cx: c, cy: c, r, fill: "none", stroke: "var(--line-2)", "stroke-width": stroke }));
    if (pct > 0) s.append(svg("circle", { class: "arc", cx: c, cy: c, r, fill: "none", stroke: color || "var(--amber)", "stroke-width": stroke, "stroke-linecap": "round",
      "stroke-dasharray": C2.toFixed(2), "stroke-dashoffset": (C2 * (1 - Math.min(pct, 100) / 100)).toFixed(2), transform: "rotate(-90 " + c + " " + c + ")" }));
    return el("div", { class: "ring", role: label ? "img" : null, "aria-label": label || null, style: { width: size + "px", height: size + "px" } }, s, inner ? el("div", { class: "mid" }, inner) : null);
  }
  function empty(iconName, title, text, action) {
    return el("div", { class: "empty" + (action === "small" ? " small" : "") }, el("div", { class: "em-ic" }, icon(iconName)), el("h3", { text: title }), text ? el("p", { text }) : null, action && action !== "small" ? action : null);
  }
  function banner(kind, iconName, title, body, actions) {
    return el("div", { class: "banner " + (kind || ""), role: kind === "bad" ? "alert" : "status" }, icon(iconName), el("div", { class: "b-body" }, title ? el("b", { text: title }) : null, body ? el("span", { text: body }) : null, actions ? el("div", { class: "btn-row" }, actions) : null));
  }
  function field(label, input, hint, id) {
    const fid = id || input.id || "f" + Math.random().toString(36).slice(2, 8);
    input.id = fid;
    const h = hint ? el("span", { class: "hint", id: fid + "-hint", text: hint }) : null;
    if (h) input.setAttribute("aria-describedby", fid + "-hint");
    return el("div", { class: "field" }, el("label", { for: fid, text: label }), input, h);
  }
  function seg(options, value, onpick, label, cls) {
    const box = el("div", { class: "seg" + (cls ? " " + cls : ""), role: "group", "aria-label": label || null });
    options.forEach((o) => box.append(el("button", { type: "button", "aria-pressed": String(o.v === value), text: o.label, onclick: () => { $$("button", box).forEach((b) => b.setAttribute("aria-pressed", "false")); box.children[options.indexOf(o)].setAttribute("aria-pressed", "true"); onpick(o.v); } })));
    return box;
  }
  function switchEl(on, label, onchange, id) {
    const b = el("button", { class: "switch", type: "button", role: "switch", "aria-checked": String(!!on), "aria-label": label, id: id || null });
    b.addEventListener("click", () => { const v = b.getAttribute("aria-checked") !== "true"; b.setAttribute("aria-checked", String(v)); onchange(v); });
    return b;
  }
  function switchRow(title, desc, on, onchange, id) {
    return el("div", { class: "switch-row" }, el("div", { class: "grow" }, el("div", { class: "t", text: title }), desc ? el("div", { class: "d", text: desc }) : null), switchEl(on, title, onchange, id));
  }
  function select(options, value, onchange, extra) {
    const s = el("select", Object.assign({ class: "select" }, extra || {}));
    options.forEach((o) => s.append(el("option", { value: String(o.v), text: o.label, selected: String(o.v) === String(value) ? true : null })));
    s.addEventListener("change", () => onchange(s.value));
    return s;
  }

  // ---------- reminder time picker ----------
  // Chips for common times (10 min … 2 days) plus any custom time. `selected` and the list passed to
  // onchange are hours before the due time (0.5 = 30 minutes).
  function leadPicker(o) {
    let sel = C.cleanLeads(o.selected);
    const box = el("div", { class: "stack sm" });
    const chips = el("div", { class: "chips", role: "group", "aria-label": o.label || "Reminder times" });
    const num = el("input", { class: "input sm", type: "number", min: "1", max: "999", step: "1", id: o.id + "-n", placeholder: "45", style: { width: "88px" }, "aria-label": "Custom reminder amount" });
    const unit = select([{ v: "min", label: "minutes before" }, { v: "h", label: "hours before" }, { v: "d", label: "days before" }], "min", () => {}, { class: "select sm", id: o.id + "-u", "aria-label": "Custom reminder unit", style: { width: "auto" } });
    const err = el("span", { class: "hint coral", hidden: true });
    const custom = el("div", { class: "row wrap", hidden: true, style: { gap: "8px" } }, num, unit, btn("Add", { size: "sm", id: o.id + "-add", onclick: addCustom }), err);
    function set(list) { sel = C.cleanLeads(list); draw(); o.onchange(sel.slice()); }
    function addCustom() {
      const n = Math.round(+num.value), mult = { min: 1 / 60, h: 1, d: 24 }[unit.value];
      const v = C.cleanLead(n * mult);
      if (!(n >= 1) || !v) { err.textContent = "Pick a time up to 14 days before."; err.hidden = false; num.focus(); return; }
      err.hidden = true; num.value = "";
      if (sel.indexOf(v) === -1) set(sel.concat([v]));
    }
    num.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } });
    function draw() {
      const all = C.REMINDER_CHOICES.slice();
      sel.forEach((v) => { if (all.indexOf(v) === -1) all.push(v); });
      all.sort((a, b) => a - b);
      fill(chips, ...all.map((h) => el("button", { class: "chip", type: "button", "aria-pressed": String(sel.indexOf(h) !== -1), onclick: () => {
        const i = sel.indexOf(h); set(i === -1 ? sel.concat([h]) : sel.filter((x) => x !== h));
      } }, C.fmtLead(h))), el("button", { class: "chip dashed", type: "button", id: o.id + "-custom", "aria-expanded": String(!custom.hidden), onclick: () => { custom.hidden = !custom.hidden; draw(); if (!custom.hidden) num.focus(); } }, icon("plus", 15), "Custom"));
    }
    draw();
    box.append(chips, custom);
    box.setSelected = (list) => { sel = C.cleanLeads(list); draw(); };
    return box;
  }

  // ---------- toasts ----------
  let toastBox = null;
  function toast(message, opts) {
    opts = opts || {};
    if (!toastBox) { toastBox = el("div", { class: "toasts", role: "status", "aria-live": "polite" }); document.body.append(toastBox); }
    while (toastBox.children.length >= 3) toastBox.firstChild.remove();
    const t = el("div", { class: "toast" }, opts.icon ? el("div", { class: "ic" }, icon(opts.icon)) : null, el("div", { class: "tx" }, message, opts.detail ? el("small", { text: opts.detail }) : null));
    let timer;
    const close = () => { clearTimeout(timer); t.classList.add("leaving"); setTimeout(() => t.remove(), 220); };
    if (opts.undo) t.append(el("button", { class: "undo", type: "button", text: "Undo", onclick: () => { close(); opts.undo(); } }));
    if (opts.action) t.append(el("button", { type: "button", text: opts.action.label, onclick: () => { close(); opts.action.run(); } }));
    t.append(el("button", { type: "button", "aria-label": "Dismiss", onclick: close }, icon("x", 16)));
    toastBox.append(t);
    timer = setTimeout(close, opts.ms || (opts.undo ? 8000 : 5000));
    t.addEventListener("mouseenter", () => clearTimeout(timer));
    t.addEventListener("mouseleave", () => { timer = setTimeout(close, 3000); });
    return close;
  }

  // ---------- dialogs ----------
  // A sheet on phones, a centred panel on tablets, and (with drawer: true) a side panel on desktop.
  function sheet(opts) {
    const d = el("dialog", { "aria-labelledby": "sh-t-" + (opts.id || "x"), id: opts.id || null });
    const box = el("div", { class: "sheet" + (opts.drawer ? " drawer" : "") + (opts.narrow ? " narrow" : "") });
    const head = el("div", { class: "sh-head" }, el("h2", { id: "sh-t-" + (opts.id || "x"), text: opts.title }), opts.headExtra || null, iconBtn("x", "Close", () => close()));
    const body = el("div", { class: "sh-body" });
    const foot = el("div", { class: "sh-foot" });
    box.append(el("div", { class: "grab", "aria-hidden": "true" }), head, body);
    if (opts.foot !== false) box.append(foot);
    d.append(box);
    let closed = false;
    function close(result) {
      if (closed) return; closed = true;
      if (opts.onclose) opts.onclose(result);
      if (d.open) d.close();
      d.remove();
    }
    d.addEventListener("cancel", (e) => { if (opts.beforeClose && opts.beforeClose() === false) { e.preventDefault(); return; } e.preventDefault(); close(); });
    d.addEventListener("click", (e) => { if (e.target === d && !opts.modal) { if (opts.beforeClose && opts.beforeClose() === false) return; close(); } });
    document.body.append(d);
    return { dialog: d, box, head, body, foot, close, open() { d.showModal(); const f = opts.focus ? $(opts.focus, d) : null; if (f) f.focus(); return this; } };
  }
  function confirmDialog(o) {
    return new Promise((resolve) => {
      const s = sheet({ title: o.title, narrow: true, id: "confirm", onclose: (r) => resolve(!!r) });
      s.body.append(el("p", { class: "muted", text: o.text }), o.extra || null);
      s.foot.append(btn(o.cancel || "Cancel", { onclick: () => s.close(false) }), btn(o.ok || "OK", { kind: o.danger ? "danger solid" : "primary", onclick: () => s.close(true), id: "confirm-ok" }));
      s.open();
      $("#confirm-ok", s.dialog).focus();
    });
  }
  // A small popup menu next to a button. items: [{label, icon, run, danger}] or "-" for a divider.
  function menu(anchor, items) {
    closeMenus();
    const m = el("div", { class: "menu", role: "menu" });
    items.forEach((it) => {
      if (it === "-") { m.append(el("hr")); return; }
      m.append(el("button", { type: "button", role: "menuitem", class: it.danger ? "danger" : null, onclick: () => { closeMenus(); it.run(); } }, it.icon ? icon(it.icon) : null, it.label));
    });
    document.body.append(m);
    const r = anchor.getBoundingClientRect(), w = m.offsetWidth, h = m.offsetHeight;
    m.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)) + "px";
    m.style.top = (r.bottom + h + 8 > window.innerHeight ? Math.max(8, r.top - h - 6) : r.bottom + 6) + "px";
    const first = m.querySelector("button"); if (first) first.focus();
    m.addEventListener("keydown", (e) => {
      const bs = $$("button", m), i = bs.indexOf(document.activeElement);
      if (e.key === "ArrowDown") { e.preventDefault(); bs[(i + 1) % bs.length].focus(); }
      if (e.key === "ArrowUp") { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length].focus(); }
      if (e.key === "Escape") { closeMenus(); anchor.focus(); }
    });
    setTimeout(() => document.addEventListener("pointerdown", outside, true));
    function outside(e) { if (!m.contains(e.target)) { closeMenus(); } }
    m._cleanup = () => document.removeEventListener("pointerdown", outside, true);
    return m;
  }
  function closeMenus() { $$(".menu").forEach((m) => { if (m._cleanup) m._cleanup(); m.remove(); }); }

  // ---------- task row ----------
  // A homework row: tick box, title, subject, due time, priority, checklist progress, and quick actions.
  function taskRow(t, ctx) {
    const now = ctx.now, store = ctx.store, g = C.groupOf(t, now);
    const sp = C.subtaskProgress(t);
    const dueCls = g === "overdue" ? "due over" : g === "today" ? "due today" : "due";
    const dueText = t.done ? "Done " + C.relDay(t.doneAt, now).toLowerCase() : g === "overdue" ? C.countdown(t.due - now) : (ctx.showDay === false ? (t.allDay ? "All day" : C.fmtTime(t.due)) : C.relDay(t.due, now) + (t.allDay ? "" : " · " + C.fmtTime(t.due)));
    const meta = el("span", { class: "t-meta" },
      tag(t.subject, store),
      el("span", { class: "m " + dueCls }, icon(g === "overdue" ? "alert" : "clock"), dueText),
      sp.total ? el("span", { class: "m", title: sp.done + " of " + sp.total + " steps done" }, icon("list"), sp.done + "/" + sp.total) : null,
      t.est ? el("span", { class: "m", title: "Estimated time" }, icon("hourglass"), C.fmtMins(t.est)) : null,
      t.recur ? el("span", { class: "m", title: C.RECUR[t.recur.freq] }, icon("repeat")) : null,
      t.kind === "exam" ? el("span", { class: "badge amber" }, "Exam") : null,
      t.source === "managebac" ? el("span", { class: "m", title: "From ManageBac" }, icon("cap")) : null,
      prio(t.priority));
    const main = el("button", { class: "t-main", type: "button", onclick: () => ctx.open(t.id) },
      el("span", { class: "t-title", text: t.title }), meta,
      t.remaining && !t.done ? el("span", { class: "t-left", text: "Left: " + t.remaining }) : null);
    const row = el("div", { class: "task" + (g === "overdue" ? " overdue" : "") + (t.done ? " done" : "") + (ctx.compact ? " compact" : ""), "data-id": t.id });
    const box = cbx(t.done, (t.done ? "Mark not done: " : "Mark done: ") + t.title, (val) => {
      if (val && ctx.animate !== false && !ctx.keepDone) { row.classList.add("leaving"); setTimeout(() => ctx.complete(t.id, true), 240); }
      else ctx.complete(t.id, val);
    }, t.priority >= 2 ? "p" + t.priority : null);
    const side = el("div", { class: "t-side" });
    if (!t.done && ctx.focus) side.append(iconBtn("timer", "Focus on " + t.title, () => ctx.focus(t.id), { class: "icon-btn sm reveal" }));
    if (ctx.more) side.append(iconBtn("more", "More for " + t.title, (e) => ctx.more(t, e.currentTarget), { class: "icon-btn sm" }));
    row.append(box, main, side);
    return row;
  }

  // ---------- charts ----------
  // Column chart, one series. data: [{label, value, hi, title}]
  function bars(data, opts) {
    opts = opts || {};
    const max = Math.max(1, ...data.map((d) => d.value));
    const wrap = el("div", { class: "chart" });
    const box = el("div", { class: "bars" + (opts.color === "amber" ? " amber" : ""), role: "img", "aria-label": opts.label || null });
    const labels = el("div", { class: "bar-labels", "aria-hidden": "true" });
    const tip = el("div", { class: "tip", hidden: true });
    data.forEach((d) => {
      const h = Math.round((d.value / max) * 100);
      const col = el("div", { class: "b" + (d.hi ? " hi" : "") }, d.value ? el("span", { class: "v", text: opts.fmt ? opts.fmt(d.value) : String(d.value) }) : null,
        el("i", { class: d.value ? null : "zero", style: { height: d.value ? Math.max(3, h) + "%" : "0" } }));
      col.addEventListener("pointerenter", () => { tip.hidden = false; tip.textContent = d.title || d.label + ": " + (opts.fmt ? opts.fmt(d.value) : d.value); const r = col.getBoundingClientRect(), w = wrap.getBoundingClientRect(); tip.style.left = r.left - w.left + r.width / 2 + "px"; tip.style.top = "8px"; });
      col.addEventListener("pointerleave", () => { tip.hidden = true; });
      box.append(col);
      labels.append(el("span", { class: d.hi ? "hi" : null, text: d.label }));
    });
    wrap.append(tip, box, labels);
    if (!data.some((d) => d.value)) wrap.append(el("div", { class: "chart-empty", text: opts.empty || "Nothing yet" }));
    if (opts.table !== false) {
      const t = el("table", null, el("caption", { text: opts.label || "" }), el("tr", null, el("th", { text: opts.labelHead || "Day" }), el("th", { text: opts.valueHead || "Value" })));
      data.forEach((d) => t.append(el("tr", null, el("td", { text: d.title || d.label }), el("td", { text: opts.fmt ? opts.fmt(d.value) : String(d.value) }))));
      wrap.append(el("div", { class: "sr-only" }, t));
    }
    return wrap;
  }

  // Keep what the user has typed (fields with an id) across a re-render of the same screen.
  function keepTyping(root, fn) {
    const typed = {};
    root.querySelectorAll("input[id], textarea[id], select[id]").forEach((n) => {
      if (n.type === "file" || n.type === "password" && !n.value) return;
      if (n.type === "checkbox" || n.type === "radio") { if (n.checked !== n.defaultChecked) typed[n.id] = { checked: n.checked }; return; }
      const def = n.tagName === "SELECT" ? (Array.from(n.options).find((o) => o.defaultSelected) || n.options[0] || {}).value : n.defaultValue;
      if (n.value !== def) typed[n.id] = { value: n.value };
    });
    fn();
    Object.keys(typed).forEach((id) => { const n = document.getElementById(id); if (!n) return; if ("checked" in typed[id]) n.checked = typed[id].checked; else n.value = typed[id].value; });
  }
  // Keep keyboard focus and caret across a re-render.
  function keepFocus(fn) {
    const a = document.activeElement, id = a && a.id, start = a && "selectionStart" in a ? a.selectionStart : null;
    fn();
    if (id) { const n = document.getElementById(id); if (n && n !== document.activeElement) { n.focus({ preventScroll: true }); if (start !== null && n.setSelectionRange) try { n.setSelectionRange(start, start); } catch (e) { /* not a text field */ } } }
  }
  function initials(name, email) {
    const src = (name || "").trim() || (email || "").split("@")[0] || "?";
    const parts = src.split(/[\s._-]+/).filter(Boolean);
    return ((parts[0] || "?")[0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  }
  function download(filename, data, mime) {
    const url = URL.createObjectURL(new Blob([data], { type: mime })), a = el("a", { href: url, download: filename });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  DB.ui = { $, $$, el, append, fill, add, svg, icon, ICONS, btn, iconBtn, tag, prio, cbx, meter, ring, empty, banner, field, seg, switchEl, switchRow, select, toast, sheet, confirmDialog, menu, closeMenus, taskRow, bars, keepFocus, keepTyping, leadPicker, initials, download };
})();
