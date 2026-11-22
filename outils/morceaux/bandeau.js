  function modeBanner() {
    if (!sb) return '<div class="banner warn" data-key="nocfg-banner"><span><b>Synchronisation pas encore réglée.</b> Pour l\'instant, tes tâches restent sur cet appareil.</span></div>';
    if (!session) return '<div class="banner warn" data-key="login-banner"><span><b>Connecte-toi</b> pour retrouver tes tâches sur ton iPhone, ton iPad et ton ordinateur.</span><button class="primary" data-action="account">Se connecter</button></div>';
    return "";
  }
