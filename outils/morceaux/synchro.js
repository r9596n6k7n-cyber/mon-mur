  /* ---------- Storage: this device first, synchronised with Supabase when signed in ---------- */
  const LS_CACHE = "mur-cache-v1";
  const CFG = window.MUR_CONFIG || {};
  let sb = null, session = null, channel = null;
  let pending = {};          // id -> { op: "upsert" | "delete", v }
  let seq = Date.now(), flushing = false, retryTimer = null;

  function loadCache() {
    try {
      const c = JSON.parse(localStorage.getItem(LS_CACHE) || "null");
      if (c && c.tasks) { tasks = c.tasks; pending = c.pending || {}; return; }
    } catch (e) {}
    tasks = {}; pending = {};
  }
  function saveCache() {
    try { localStorage.setItem(LS_CACHE, JSON.stringify({ tasks, pending })); }
    catch (e) { toast("Impossible d'enregistrer sur cet appareil"); }
  }
  function mark(id, op) { pending[id] = { op, v: ++seq }; }

  function refreshSync() {
    if (!sb) { mode = "local"; setSync("Sur cet appareil seulement", "warn"); return; }
    if (!session) { mode = "local"; setSync("Non connecté · touche ici pour te connecter", "warn"); return; }
    mode = "db";
    const n = Object.keys(pending).length;
    if (!navigator.onLine) setSync("Hors ligne" + (n ? " · " + n + " modif. à envoyer" : " · tout est enregistré ici"), "warn");
    else if (n) setSync("Synchronisation…", "");
    else setSync("Synchronisé sur tous tes appareils", "ok");
  }

  const localStore = {
    save(t) { tasks[t.id] = t; mark(t.id, "upsert"); saveCache(); render(); flush(); },
    remove(id) { delete tasks[id]; mark(id, "delete"); saveCache(); render(); flush(); }
  };

  async function flush() {
    refreshSync();
    if (!sb || !session || flushing || !navigator.onLine) return;
    const ids = Object.keys(pending);
    if (!ids.length) return;
    flushing = true;
    const sent = {};
    try {
      const rows = ids.map((id) => {
        const p = pending[id]; sent[id] = p.v;
        const body = p.op === "delete" || !tasks[id] ? {} : Object.assign({}, tasks[id]);
        delete body.id;
        return { id, user_id: session.user.id, data: body, deleted: p.op === "delete" || !tasks[id], updated_at: new Date().toISOString() };
      });
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await sb.from("tasks").upsert(rows.slice(i, i + 200));
        if (error) throw error;
      }
      ids.forEach((id) => { if (pending[id] && pending[id].v === sent[id]) delete pending[id]; });
      saveCache();
    } catch (e) {
      console.warn("Synchronisation", e);
      clearTimeout(retryTimer); retryTimer = setTimeout(flush, 15000);
    } finally {
      flushing = false;
      refreshSync();
      if (Object.keys(pending).some((id) => pending[id].v !== sent[id])) setTimeout(flush, 0);
    }
  }

  function applyRow(r) {
    if (!r || !r.id || pending[r.id]) return;
    if (r.deleted) delete tasks[r.id];
    else tasks[r.id] = Object.assign({}, r.data, { id: r.id });
  }

  async function pull() {
    if (!sb || !session || !navigator.onLine) { refreshSync(); return; }
    const { data, error } = await sb.from("tasks").select("id,data,deleted").limit(5000);
    if (error) { console.warn("Lecture", error); refreshSync(); return; }
    const remote = new Set();
    data.forEach((r) => { remote.add(r.id); applyRow(r); });
    // tâches créées sur cet appareil avant la connexion : on les envoie en ligne
    Object.keys(tasks).forEach((id) => { if (!remote.has(id) && !pending[id]) mark(id, "upsert"); });
    saveCache(); render(); flush();
  }

  function subscribe() {
    if (channel) sb.removeChannel(channel);
    channel = sb.channel("taches-" + session.user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: "user_id=eq." + session.user.id }, (p) => {
        if (p.new && p.new.id) { applyRow(p.new); saveCache(); render(); }
      })
      .subscribe();
  }

  async function init() {
    hydrateIcons(document);
    renderHint();
    loadCache();
    loaded = true; backend = localStore;
    render();
    import("https://cdn.jsdelivr.net/npm/chrono-node@2.7.5/+esm").then((m) => { chronoFr = m.fr || (m.default && m.default.fr) || null; renderHint(); }).catch(() => {});
    import("https://cdn.jsdelivr.net/npm/@formkit/auto-animate@0.8.2/+esm").then((m) => { autoAnimate = m.default || m.autoAnimate || null; render(); }).catch(() => {});

    if (CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase) {
      try {
        sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
        const { data } = await sb.auth.getSession();
        session = data.session;
        if (session) { subscribe(); pull(); }
        sb.auth.onAuthStateChange((event, s) => {
          const before = session && session.user.id;
          session = s;
          if (s && s.user.id !== before) { subscribe(); pull(); }
          if (!s && channel) { sb.removeChannel(channel); channel = null; }
          refreshSync(); renderAccount(); render();
        });
      } catch (e) { console.warn(e); sb = null; }
    }
    refreshSync(); render();
    if (sb && !session) setTimeout(openAccount, 400);

    window.addEventListener("online", pull);
    window.addEventListener("offline", refreshSync);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") pull(); });
    setInterval(() => { if (document.visibilityState === "visible") pull(); }, 60000);
  }

  /* ---------- Account ---------- */
  const accountDlg = document.getElementById("account");
  function accMsg(text, ok) { const m = $("#acc-msg"); m.textContent = text || ""; m.className = "acc-msg" + (ok ? " ok" : ""); }
  function renderAccount() {
    $("#acc-nocfg").hidden = !!sb;
    $("#acc-out").hidden = !sb || !!session;
    $("#acc-in").hidden = !sb || !session;
    $("#acc-title").textContent = session ? "Ton compte" : "Synchronisation";
    if (session) $("#acc-who").textContent = session.user.email || "ton compte";
  }
  function openAccount() {
    renderAccount(); accMsg("");
    try { if (!accountDlg.open) accountDlg.showModal(); } catch (e) { accountDlg.setAttribute("open", ""); }
  }
  function frError(err) {
    const m = String((err && err.message) || err || "");
    if (/invalid login credentials/i.test(m)) return "E-mail ou mot de passe incorrect.";
    if (/email not confirmed/i.test(m)) return "Confirme d'abord ton adresse avec le lien reçu par e-mail, puis reconnecte-toi.";
    if (/already registered|already exists/i.test(m)) return "Ce compte existe déjà : appuie sur « Se connecter ».";
    if (/password should be at least|at least 6/i.test(m)) return "Le mot de passe doit faire au moins 6 caractères.";
    if (/unable to validate email|invalid email|valid email/i.test(m)) return "Cette adresse e-mail n'est pas valide.";
    if (/rate limit|too many/i.test(m)) return "Trop d'essais. Attends quelques minutes et réessaie.";
    if (/fetch|network/i.test(m)) return "Pas de connexion internet.";
    return "Ça n'a pas marché : " + m;
  }
  function creds() {
    const email = $("#acc-email").value.trim(), password = $("#acc-pass").value;
    if (!email || !password) { accMsg("Écris ton e-mail et ton mot de passe."); return null; }
    if (password.length < 6) { accMsg("Le mot de passe doit faire au moins 6 caractères."); return null; }
    return { email, password };
  }
  $("#account-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!sb) return;
    const c = creds(); if (!c) return;
    accMsg("Connexion…", true);
    const { error } = await sb.auth.signInWithPassword(c);
    if (error) { accMsg(frError(error)); return; }
    $("#acc-pass").value = ""; accMsg(""); accountDlg.close();
    toast("Connecté. Tes tâches se synchronisent.");
  });
  async function signUp() {
    if (!sb) return;
    const c = creds(); if (!c) return;
    accMsg("Création du compte…", true);
    const { data, error } = await sb.auth.signUp(Object.assign({}, c, { options: { emailRedirectTo: location.origin + location.pathname } }));
    if (error) { accMsg(frError(error)); return; }
    if (data && data.session) { $("#acc-pass").value = ""; accountDlg.close(); toast("Compte créé. Bienvenue !"); celebrate(true); }
    else accMsg("Compte créé ! Ouvre l'e-mail de confirmation que tu viens de recevoir, clique sur le lien, puis reviens ici et appuie sur « Se connecter ».", true);
  }
  async function signOut() {
    if (!sb) return;
    await sb.auth.signOut();
    tasks = {}; pending = {}; saveCache();
    accountDlg.close(); render(); refreshSync();
    toast("Déconnecté. Les tâches ont été retirées de cet appareil.");
  }

