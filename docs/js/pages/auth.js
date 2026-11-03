/* Welcome and sign-in: create an account, sign in (password or email link), reset a password, or continue without an account. */
(function () {
  "use strict";
  const DB = window.DB, U = DB.ui;
  const { el, icon } = U;
  DB.pages = DB.pages || {};
  let tab = "signin", notice = null, providers = null;

  function render(page) {
    const A = DB.account, App = DB.app;
    if (A.available && providers === null) { providers = {}; A.providers().then((p) => { providers = p || {}; if (providers.google && App.route.name === "welcome") App.render(); }); }
    const brand = el("div", { class: "auth-brand" },
      el("div", null, el("div", { class: "brand", style: { padding: 0 } }, el("span", { class: "brand-mark" }, icon("cap")), el("span", null, el("b", { text: "Due Board" }), el("small", { text: "Homework, sorted" }))),
        el("h1", null, "Every deadline. ", el("em", { text: "Handled." })),
        el("ul", null,
          feat("calendar", "ManageBac in one place", "Import your calendar once; it keeps itself up to date."),
          feat("planner", "Plan your week", "Spread homework across the days so nothing piles up."),
          feat("timer", "Focus sessions", "Pomodoro timers attached to the work you're doing."),
          feat("flame", "Points, streaks, levels", "Get rewarded for finishing early and keeping going."))),
      el("p", { class: "small muted", style: { position: "relative" }, text: "Free. Your homework is private to you." }), el("div", { class: "deco", "aria-hidden": "true" }));
    const card = el("div", { class: "auth-card" });
    U.add(card, el("div", { class: "mobile-brand" }, el("span", { class: "brand-mark" }, icon("cap")), el("b", { class: "display", style: { fontSize: "28px" }, text: "Due Board" })));
    if (!A.available) {
      U.add(card, el("h2", { text: "Welcome" }), el("p", { class: "muted", text: "Keep track of homework, plan your week and stay focused. Everything is saved in this browser." }),
        U.btn("Get started", { kind: "primary", size: "lg", block: true, onclick: () => App.continueAsGuest() }));
    } else if (tab === "sent") {
      U.add(card, el("div", { class: "empty" }, el("div", { class: "em-ic" }, icon("mail")), el("h3", { text: notice.title }), el("p", { text: notice.text }),
        notice.resend ? U.btn("Send it again", { kind: "outline", size: "sm", onclick: async (e) => { const btnEl = e.currentTarget; btnEl.disabled = true; try { await notice.resend(); U.toast("Sent again"); } catch (err) { U.toast(A.friendly(err), { icon: "alert" }); } } }) : null),
        U.btn("Back to sign in", { kind: "ghost", block: true, onclick: () => { tab = "signin"; App.render(); } }));
    } else {
      U.add(card, el("div", null, el("h2", { text: tab === "signup" ? "Create your account" : tab === "forgot" ? "Reset password" : tab === "magic" ? "Email me a link" : "Welcome back" }),
        el("p", { class: "muted", style: { marginTop: "6px" }, text: tab === "signup" ? "Free. Your homework syncs across your devices." : tab === "forgot" ? "We'll email you a link to set a new password." : tab === "magic" ? "We'll email you a link that signs you in, no password needed." : "Sign in to see your homework on any device." })));
      if (tab === "signin" || tab === "signup") U.add(card, U.seg([{ v: "signin", label: "Sign in" }, { v: "signup", label: "Create account" }], tab, (v) => { tab = v; notice = null; App.render(); }, "Sign in or create an account", "full"));
      if (notice && notice.text && tab !== "sent") U.add(card, el("div", { class: "note " + (notice.kind || ""), text: notice.text }));
      const form = el("form", { novalidate: true });
      const name = el("input", { class: "input", id: "au-name", autocomplete: "given-name", maxlength: "60" });
      const email = el("input", { class: "input", id: "au-email", type: "email", autocomplete: "email", inputmode: "email" });
      const pw = el("input", { class: "input", id: "au-pw", type: "password", autocomplete: tab === "signup" ? "new-password" : "current-password", minlength: "8" });
      const show = el("button", { class: "btn ghost xs suffix", type: "button", id: "au-show", "aria-label": "Show password", "aria-pressed": "false", onclick: () => { const on = pw.type === "password"; pw.type = on ? "text" : "password"; show.textContent = on ? "Hide" : "Show"; show.setAttribute("aria-pressed", String(on)); } }, "Show");
      const err = el("div", { class: "note bad", id: "au-msg", role: "alert", hidden: true });
      if (tab === "signup") U.add(form, U.field("Your name", name));
      U.add(form, U.field("Email", email));
      if (tab === "signin" || tab === "signup") U.add(form, el("div", { class: "field" }, el("label", { for: "au-pw", text: "Password" }), el("div", { class: "input-group" }, pw, show), tab === "signup" ? el("span", { class: "hint", text: "At least 8 characters." }) : null));
      const go = U.btn(tab === "signup" ? "Create account" : tab === "forgot" ? "Send reset link" : tab === "magic" ? "Send sign-in link" : "Sign in", { kind: "primary", size: "lg", block: true, type: "submit", id: "au-go" });
      U.add(form, err, go);
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const em = email.value.trim(), fail = (t, f) => { err.textContent = t; err.hidden = false; if (f) { f.setAttribute("aria-invalid", "true"); f.focus(); } };
        err.hidden = true; [name, email, pw].forEach((x) => x.removeAttribute("aria-invalid"));
        if (tab === "signup" && !name.value.trim()) return fail("Type your name.", name);
        if (!A.EMAIL_RE.test(em)) return fail("That email address doesn't look right.", email);
        if ((tab === "signin" || tab === "signup") && !pw.value) return fail("Type your password.", pw);
        if (tab === "signup" && pw.value.length < 8) return fail("Use at least 8 characters for your password.", pw);
        go.disabled = true; go.textContent = "Please wait…";
        try {
          if (tab === "signin") { await A.signIn(em, pw.value); return; }
          if (tab === "signup") {
            const r = await A.signUp(em, pw.value, name.value.trim());
            if (r.needsConfirm) { tab = "sent"; notice = { title: "Check your email", text: r.exists ? "If " + em + " doesn't have an account yet, we've sent a link to confirm it. If it does, sign in instead (or reset your password)." : "We sent a link to " + em + ". Open it to confirm your account, then you're in. Check spam if you can't find it.", resend: () => A.resend(em) }; App.render(); }
            return;
          }
          if (tab === "forgot") { await A.resetPassword(em); tab = "sent"; notice = { title: "Check your email", text: "If there's an account for " + em + ", a link to reset the password is on its way." }; App.render(); return; }
          if (tab === "magic") { await A.magicLink(em); tab = "sent"; notice = { title: "Check your email", text: "If there's an account for " + em + ", a sign-in link is on its way. Open it on this device." }; App.render(); return; }
        } catch (ex) { fail(A.friendly(ex)); if (/confirm your email/i.test(A.friendly(ex))) U.add(err, " ", el("button", { class: "link-btn", type: "button", onclick: async () => { try { await A.resend(em); U.toast("Confirmation email sent again"); } catch (x) { U.toast(A.friendly(x)); } } }, "Send it again")); }
        finally { go.disabled = false; go.textContent = tab === "signup" ? "Create account" : tab === "forgot" ? "Send reset link" : tab === "magic" ? "Send sign-in link" : "Sign in"; }
      });
      U.add(card, form);
      if (tab === "signin") U.add(card, el("div", { class: "row between wrap small" },
        el("button", { class: "link-btn", type: "button", id: "au-forgot", onclick: () => { tab = "forgot"; notice = null; App.render(); } }, "Forgot your password?"),
        el("button", { class: "link-btn", type: "button", id: "au-magic", onclick: () => { tab = "magic"; notice = null; App.render(); } }, "Email me a sign-in link")));
      if (tab === "forgot" || tab === "magic") U.add(card, U.btn("Back to sign in", { kind: "ghost", block: true, onclick: () => { tab = "signin"; App.render(); } }));
      if (providers && providers.google && (tab === "signin" || tab === "signup")) U.add(card, el("div", { class: "divider", text: "or" }), U.btn("Continue with Google", { size: "lg", block: true, icon: "google", onclick: () => A.signInWithGoogle().catch((e) => U.toast(A.friendly(e))) }));
    }
    if (A.available) U.add(card, el("div", { class: "divider", text: "or" }),
      U.btn(App.guest && !App.guest.isEmpty() ? "Continue without an account" : "Continue without an account", { kind: "outline", size: "lg", block: true, id: "au-guest", onclick: () => App.continueAsGuest() }),
      el("p", { class: "xs muted", style: { textAlign: "center" }, text: "Without an account, homework is saved in this browser only." }));
    U.add(page, el("div", { class: "auth" }, brand, el("div", { class: "auth-main" }, card)));
  }
  function feat(ic, t, d) { return el("li", null, el("span", { class: "fi" }, icon(ic)), el("div", null, el("b", { text: t }), el("span", { text: d }))); }
  function show(which, n) { tab = which || "signin"; notice = n || null; DB.app.go("welcome"); }
  // After following a password-reset link.
  function newPasswordDialog() {
    if (document.getElementById("newpw")) return;
    const A = DB.account;
    const s = U.sheet({ title: "Set a new password", narrow: true, id: "newpw", modal: true });
    const pw = el("input", { class: "input", id: "np-pw", type: "password", autocomplete: "new-password", minlength: "8" });
    const m = el("div", { class: "note bad", hidden: true, role: "alert" });
    U.add(s.body, U.field("New password", pw, "At least 8 characters."), m);
    U.add(s.foot, U.btn("Save password", { kind: "primary", id: "np-go", onclick: async (e) => {
            const btnEl = e.currentTarget;
      if (pw.value.length < 8) { m.textContent = "Use at least 8 characters."; m.hidden = false; return; }
      btnEl.disabled = true;
      try { await A.setNewPassword(pw.value); s.close(); U.toast("Password changed. You're signed in.", { icon: "check" }); }
      catch (err) { m.textContent = A.friendly(err); m.hidden = false; btnEl.disabled = false; }
    } }));
    s.open(); pw.focus();
  }
  DB.auth = { show, newPasswordDialog };
  DB.pages.welcome = { title: "Welcome", render };
})();
