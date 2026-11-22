// Construit app/index.html à partir du mur (../organisation.html) en remplaçant le stockage
// par la synchronisation Supabase et en ajoutant tout ce qu'il faut pour une app installable.
// Usage : node outils/construire.js
const fs = require("fs");
const path = require("path");
const src = path.join(__dirname, "..", "..", "organisation.html");
const dest = path.join(__dirname, "..", "index.html");
let s = fs.readFileSync(src, "utf8");

function replace(oldStr, newStr) {
  const i = s.indexOf(oldStr);
  if (i < 0) throw new Error("Introuvable : " + oldStr.slice(0, 80));
  s = s.slice(0, i) + newStr + s.slice(i + oldStr.length);
}
function replaceBetween(start, end, newStr) {
  const a = s.indexOf(start), b = s.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error("Bloc introuvable : " + start.slice(0, 60));
  s = s.slice(0, a) + newStr + s.slice(b);
}

/* 1. Un vrai document HTML installable */
s = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#f4f2fb" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#16132a" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Mon Mur">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
<style>html{-webkit-text-size-adjust:100%;height:100%}body{margin:0}[hidden]{display:none!important}img{max-width:100%}</style>
` + s.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', "");
s = s.trimEnd() + "\n</body>\n</html>\n";

/* 2. Styles */
replace("padding-block: 0 104px; min-height: 100%;", "padding-block: env(safe-area-inset-top, 0px) calc(104px + env(safe-area-inset-bottom, 0px)); min-height: 100%;");
replace("</style>\n\n<div", `button.sync { border: 0; background: none; padding: 2px 0; cursor: pointer; text-align: left; }
button.sync:hover { color: var(--fg); }
dialog#account { width: min(460px, calc(100% - 24px)); border: 0; border-top: 12px solid var(--accent); border-radius: 20px; padding: 0; background: var(--surface); color: var(--fg); box-shadow: 0 30px 60px -20px rgba(0,0,0,.5); }
dialog#account::backdrop { background: rgba(30,15,60,.45); backdrop-filter: blur(3px); }
#account .field input { padding: 11px 12px; border: 2px solid var(--line); border-radius: 10px; background: var(--bg); width: 100%; font-size: 1rem; }
#account .field input:focus { border-color: var(--accent); outline: none; }
.acc-title { font-size: 1.35rem; flex: 1; }
.acc-msg { margin: 0; min-height: 1.3em; font-size: .9rem; font-weight: 700; color: var(--danger); }
.acc-msg.ok { color: var(--ok); }
.acc-section { display: flex; flex-direction: column; gap: 12px; }
.acc-section p { margin: 0; }
</style>

<div`);

/* 3. Le point de synchro devient un bouton vers le compte */
replace('<span class="sync" id="sync" data-state="">Chargement…</span>', '<button type="button" class="sync" id="sync" data-action="account" data-state="">Chargement…</button>');
replace("Ensuite, dans ton mur ouvert avec le lien Claude, colle le texte ici et appuie sur « Importer ».", "Ensuite, dans cette app (connectée à ton compte), colle le texte ici et appuie sur « Importer ».");

/* 4. Fenêtre du compte + bibliothèques */
replace('<script src="https://cdn.jsdelivr.net/npm/lucide@0.400.0/dist/umd/lucide.min.js"></script>', `<dialog id="account" aria-label="Compte et synchronisation">
  <form class="sheet-body" id="account-form" autocomplete="on">
    <div class="sheet-head"><h2 class="acc-title" id="acc-title">Synchronisation</h2><button type="button" class="icon-btn" data-action="close-account" aria-label="Fermer"><span data-icon="X" data-fb="×"></span></button></div>
    <div class="acc-section" id="acc-out">
      <p class="lead">Connecte-toi pour retrouver tes tâches sur ton iPhone, ton iPad et ton ordinateur. Utilise le même compte partout.</p>
      <label class="field"><span class="label">E-mail</span><input id="acc-email" name="email" type="email" autocomplete="email" inputmode="email" autocapitalize="off"></label>
      <label class="field"><span class="label">Mot de passe (6 caractères minimum)</span><input id="acc-pass" name="password" type="password" autocomplete="current-password"></label>
      <p class="acc-msg" id="acc-msg" role="status"></p>
      <div class="sheet-foot"><button type="button" class="tbtn" data-action="signup">Créer mon compte</button><button type="submit" class="primary" id="acc-login">Se connecter</button></div>
    </div>
    <div class="acc-section" id="acc-in" hidden>
      <p>Connecté avec <b id="acc-who"></b>.</p>
      <p class="lead">Tes tâches sont enregistrées en ligne et sur cet appareil. Elles se mettent à jour toutes seules sur tes autres appareils, et l'app marche aussi sans internet.</p>
      <div class="sheet-foot"><button type="button" class="danger-btn" data-action="signout">Se déconnecter</button><button type="button" class="primary" data-action="close-account">Fermer</button></div>
    </div>
    <div class="acc-section" id="acc-nocfg" hidden>
      <p class="lead">La synchronisation n'est pas encore réglée sur cette version de l'app. Tes tâches restent enregistrées sur cet appareil.</p>
      <div class="sheet-foot"><span></span><button type="button" class="primary" data-action="close-account">Fermer</button></div>
    </div>
  </form>
</dialog>

<script src="https://cdn.jsdelivr.net/npm/lucide@0.400.0/dist/umd/lucide.min.js"></script>`);
replace('<script src="https://cdn.jsdelivr.net/npm/morphdom@2.7.2/dist/morphdom-umd.min.js"></script>', `<script src="https://cdn.jsdelivr.net/npm/morphdom@2.7.2/dist/morphdom-umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js"></script>
<script src="config.js"></script>`);

/* 5. Stockage : cache sur l'appareil + synchronisation Supabase */
replaceBetween("  /* ---------- Storage backends ---------- */", "  /* ---------- Mutations ---------- */", fs.readFileSync(path.join(__dirname, "morceaux", "synchro.js"), "utf8"));
replaceBetween("  function modeBanner() {", "  const ID_RE", fs.readFileSync(path.join(__dirname, "morceaux", "bandeau.js"), "utf8"));
replaceBetween("  function pushLocal() {", "  /* ---------- Render + DOM reconciliation", "");
replace('      case "push-local": pushLocal(); break;', `      case "account": openAccount(); break;
      case "close-account": accountDlg.close(); break;
      case "signup": signUp(); break;
      case "signout": confirmBtn(el, "Confirmer la déconnexion", signOut); break;`);
replace("  init();\n})();", `  init();
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();`);

fs.writeFileSync(dest, s);
console.log("index.html construit (" + Math.round(s.length / 1024) + " Ko)");
