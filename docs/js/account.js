/* Due Board accounts (Supabase Auth) and sync between devices.
   Each device keeps a full copy of the account's homework. Changes are sent as items (push_items only
   writes an item when it is newer), and changes from other devices arrive live (Realtime) or on the next
   check (every minute, on focus, when back online). */
(function () {
  "use strict";
  const DB = (window.DB = window.DB || {});
  const cfg = window.DUEBOARD_CONFIG || {};
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Read what an email link brought us here for, before the Supabase client tidies the address bar.
  const linkParams = new URLSearchParams(/^#(?!\/)/.test(location.hash) ? location.hash.slice(1) : "");
  const account = {
    available: !!(cfg.supabaseUrl && cfg.supabaseKey && window.supabase && window.supabase.createClient),
    client: null, user: null, recovery: linkParams.get("type") === "recovery", listeners: [],
    linkType: linkParams.get("type") || "", linkError: linkParams.get("error_description") || linkParams.get("error") || "",
    EMAIL_RE,
  };
  if (account.available) {
    account.client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit", storageKey: "dueboard-auth" },
      realtime: { params: { eventsPerSecond: 5 } },
    });
  }
  account.onChange = (fn) => { account.listeners.push(fn); };
  function emit(evt) { account.listeners.forEach((fn) => { try { fn(evt, account.user); } catch (e) { setTimeout(() => { throw e; }); } }); }
  const here = () => location.origin + location.pathname;

  // Plain-language versions of Supabase Auth errors.
  function friendly(err) {
    const m = String((err && (err.message || err.error_description || err.msg)) || err || "").toLowerCase(), code = err && err.code;
    if (!navigator.onLine || /failed to fetch|networkerror|load failed|network request failed/.test(m)) return "Can't reach the server. Check your internet connection and try again.";
    if (code === "invalid_credentials" || /invalid login credentials/.test(m)) return "Email or password is not right.";
    if (code === "email_not_confirmed" || /email not confirmed/.test(m)) return "Confirm your email first: open the link we sent you (check spam too).";
    if (code === "user_already_exists" || /already registered|already been registered/.test(m)) return "There's already an account with this email. Sign in instead.";
    if (code === "same_password" || /different from the old password/.test(m)) return "The new password must be different from the current one.";
    if (code === "weak_password" || /password should|weak password/.test(m)) return "Choose a stronger password: at least 8 characters, ideally with letters and numbers.";
    if (code === "over_email_send_rate_limit" || /rate limit|too many/.test(m)) return "Too many attempts. Wait a few minutes, then try again.";
    if (code === "otp_expired" || /expired|invalid.*link/.test(m)) return "That link has expired. Ask for a new one.";
    if (code === "email_address_invalid" || /invalid.*email|email.*invalid/.test(m)) return "That email address doesn't look right.";
    if (/signups not allowed|signup.*disabled/.test(m)) return "New sign-ups are turned off for this site.";
    return (err && err.message) || "Something went wrong. Please try again.";
  }
  account.friendly = friendly;
  async function call(p) { const r = await p; if (r.error) throw r.error; return r.data; }

  account.init = async function () {
    if (!account.available) return null;
    const c = account.client;
    c.auth.onAuthStateChange((event, session) => {
      const prev = account.user && account.user.id;
      account.user = session ? session.user : null;
      if (event === "PASSWORD_RECOVERY") { account.recovery = true; emit("recovery"); return; }
      if (event === "USER_UPDATED") { emit("updated"); return; }
      if ((account.user && account.user.id) !== prev) emit(account.user ? "signedin" : "signedout");
    });
    try { const { data } = await c.auth.getSession(); account.user = data.session ? data.session.user : null; } catch (e) { account.user = null; }
    if (account.linkError && /^#(?!\/)/.test(location.hash)) history.replaceState(null, "", location.pathname + "#/welcome");
    return account.user;
  };
  account.name = () => (account.user && account.user.user_metadata && account.user.user_metadata.name) || "";
  account.signUp = async function (email, password, name) {
    const data = await call(account.client.auth.signUp({ email, password, options: { data: { name }, emailRedirectTo: here() } }));
    // With email confirmation on, an address that already has an account comes back with no identities.
    const exists = data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0;
    return { needsConfirm: !data.session, exists };
  };
  account.signIn = (email, password) => call(account.client.auth.signInWithPassword({ email, password }));
  account.magicLink = (email) => call(account.client.auth.signInWithOtp({ email, options: { emailRedirectTo: here(), shouldCreateUser: false } }));
  account.resetPassword = (email) => call(account.client.auth.resetPasswordForEmail(email, { redirectTo: here() }));
  account.resend = (email) => call(account.client.auth.resend({ type: "signup", email, options: { emailRedirectTo: here() } }));
  account.setNewPassword = async function (password) { await call(account.client.auth.updateUser({ password })); account.recovery = false; if (/type=recovery/.test(location.hash)) history.replaceState(null, "", location.pathname + "#/home"); };
  account.updateName = (name) => call(account.client.auth.updateUser({ data: { name } }));
  account.changeEmail = (email) => call(account.client.auth.updateUser({ email }, { emailRedirectTo: here() }));
  // Changing the password asks for the current one first, so a borrowed, signed-in device can't take the account over.
  account.verifyPassword = async function (password) {
    const email = account.user && account.user.email;
    await call(account.client.auth.signInWithPassword({ email, password }));
  };
  account.changePassword = async function (current, next) { await account.verifyPassword(current); await call(account.client.auth.updateUser({ password: next })); };
  account.signOut = async function () {
    try { await account.client.auth.signOut({ scope: "local" }); } catch (e) { /* the local session is cleared either way */ }
    account.user = null; emit("signedout");
  };
  account.deleteAccount = async function (password) {
    await account.verifyPassword(password);
    await call(account.client.rpc("delete_my_account"));
    try { await account.client.auth.signOut({ scope: "local" }); } catch (e) { /* already gone */ }
    account.user = null; emit("deleted");
  };
  // Which sign-in methods the project has switched on (for the Google button).
  account.providers = async function () {
    try {
      const r = await fetch(cfg.supabaseUrl + "/auth/v1/settings", { headers: { apikey: cfg.supabaseKey } });
      if (!r.ok) return {};
      const j = await r.json();
      return j.external || {};
    } catch (e) { return {}; }
  };
  account.signInWithGoogle = () => call(account.client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: here() } }));

  // ---------- sync engine ----------
  function createSync(store, userId) {
    const c = account.client, PAGE = 1000, CHUNK = 400;
    const S = { status: "starting", lastSync: 0, error: "", firstPullDone: false, listeners: [] };
    let pushTimer = null, pollTimer = null, channel = null, busy = null, stopped = false, again = false;
    const set = (status, error) => { S.status = status; S.error = error || ""; S.listeners.forEach((fn) => fn(S)); };
    S.on = (fn) => { S.listeners.push(fn); };

    async function pull() {
      for (;;) {
        // Ask again for a two-minute overlap: a slow write from another device may commit after a faster one.
        let since = "1970-01-01T00:00:00Z";
        if (store.cursor) { const t = Date.parse(store.cursor); if (isFinite(t)) since = new Date(t - 120000).toISOString(); }
        const { data, error } = await c.from("items").select("kind,id,data,mod,updated_at").gt("updated_at", since).order("updated_at", { ascending: true }).limit(PAGE);
        if (error) throw error;
        const before = store.cursor;
        store.applyRemote(data || []);
        if (!data || data.length < PAGE || store.cursor === before) break;
      }
      S.firstPullDone = true;
    }
    async function push() {
      let items = store.pendingItems();
      while (items.length) {
        const chunk = items.slice(0, CHUNK);
        const { data, error } = await c.rpc("push_items", { items: chunk.map((i) => ({ kind: i.kind, id: i.id, data: i.data, mod: i.mod })) });
        if (error) throw error;
        if (data && data.length) store.applyRemote(data);   // the server had newer copies of some of these
        store.markSynced(chunk);
        items = items.slice(CHUNK);
      }
    }
    function run() {
      if (stopped) return Promise.resolve();
      if (busy) { again = true; return busy; }
      if (!navigator.onLine) { set("offline"); return Promise.resolve(); }
      set("syncing");
      busy = (async () => {
        try {
          await pull();
          await push();
          S.lastSync = Date.now();
          set(Object.keys(store.pending).length ? "pending" : "ok");
        } catch (e) {
          const m = String((e && e.message) || e);
          if (!navigator.onLine || /fetch|network/i.test(m)) set("offline");
          else if (/jwt|token|401|not authenticated|sign in first/i.test(m)) set("error", "Your sign-in has expired. Sign in again to keep syncing.");
          else set("error", friendly(e));
        } finally {
          busy = null;
          if (again && !stopped) { again = false; setTimeout(run, 300); }
        }
      })();
      return busy;
    }
    function schedulePush() { clearTimeout(pushTimer); pushTimer = setTimeout(run, 700); }
    function onOnline() { run(); }
    function onVisible() { if (!document.hidden) run(); }
    S.start = function () {
      stopped = false;
      store.on((what) => { if (what === "change") { if (S.status === "ok") set("pending"); schedulePush(); } });
      window.addEventListener("online", onOnline);
      window.addEventListener("offline", () => set("offline"));
      document.addEventListener("visibilitychange", onVisible);
      pollTimer = setInterval(run, 60000);
      try {
        channel = c.channel("items-" + userId).on("postgres_changes", { event: "*", schema: "public", table: "items", filter: "user_id=eq." + userId }, (payload) => {
          if (payload.new && payload.new.id) store.applyRemote([payload.new]);
        }).subscribe();
      } catch (e) { channel = null; /* live updates are a bonus; the regular check still runs */ }
      return run();
    };
    S.stop = function () {
      stopped = true; clearTimeout(pushTimer); clearInterval(pollTimer);
      window.removeEventListener("online", onOnline); document.removeEventListener("visibilitychange", onVisible);
      if (channel) { try { c.removeChannel(channel); } catch (e) { /* closing anyway */ } channel = null; }
    };
    S.now = run;
    S.flush = async function () { await run(); return Object.keys(store.pending).length === 0; };
    return S;
  }
  account.createSync = createSync;
  DB.account = account;
})();
