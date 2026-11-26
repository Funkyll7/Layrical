# PROJET.md — carte du projet

> Si tu ajoutes, déplaces ou supprimes un fichier, mets ce document à jour.

```
marche.json             cours du S&P 500 et EUR/USD (10 ans), écrit chaque soir de bourse par la tâche ci-dessous
scripts/marche.mjs      récupère les cours (Yahoo Finance, secours Stooq) et écrit marche.json
.github/workflows/marche.yml  tâche GitHub quotidienne (et bouton « Run workflow ») qui lance le script
scripts/rappels-calc.mjs  calcul des notifications (même logique de répétition que app.js, sans dépendance)
scripts/rappels.mjs     envoi des notifications push (web-push) ; lit le dépôt de données avec le secret DATA_TOKEN
.github/workflows/rappels.yml  tâche horaire : résumé du matin + rappel 1 h avant un rendez-vous avec heure
index.html              structure de la page unique
sw.js                   cache hors ligne (réseau d'abord ; API GitHub jamais interceptée)
manifest.webmanifest    installation sur l'écran d'accueil
.nojekyll               empêche GitHub Pages de filtrer des dossiers
assets/css/app.css      tous les styles et jetons de couleur (clair + sombre auto)
assets/js/app.js        état (S), dates, jours fériés, vues, formulaires, sauvegarde JSON
assets/js/sync.js       synchro : lit/écrit agenda-data.json dans le dépôt privé (API GitHub)
assets/img/             favicon.svg, icône SVG (pas de PNG)
```

## Modèle de données (`agenda-data.json`, dans le dépôt privé)
`{ items, tx, debts, rec, sav, inv, bal, notes, plan, bud, ts }`
- `items[]` : `{id, type: rdv|anniv|travail|renouv|abo|credit, title, date, rep: none|yearly|monthly, amt, note, lead}`
  - paiement en plusieurs fois (`fois`) : `total`, `n` = nombre d'échéances, `amt` = total/n arrondi au centime ; la dernière échéance absorbe l'arrondi (`instAmt`).
  - `travail` s'affiche « 🛒 Quotidien » (clé interne inchangée) : `date` facultative. Sans date : compté seulement dans « Mon budget du mois » (`quotMonthly`), ni agenda ni solde. Avec date : agenda + déduit du solde (`flowBetween`).
  - prêt étudiant (`stu: 1`) : `cap`, `rate`, `n` (mois de remboursement), `def` (n | p partiel | t total), `dfm` (mois de différé), `ins` (assurance €/mois), `dpay` (intérêts payés pendant un différé partiel). Échéance du mois j : `payAt(it, j)` ; en différé total les intérêts sont capitalisés (`stuCalc`).
  - crédit saisi avec le taux : `cap` = capital emprunté, `rate` = taux annuel (%), `n` = durée en mois ; mensualité = `mensu(cap, rate, n)` (amortissement classique), `total` = mensualité × n.
  - crédit : `amt` = mensualité, `total` = montant total à rembourser, `date` = 1er prélèvement. Mensualités payées, reste et date de fin sont **calculés** (`credPaid`, `credLeft`, `credEnd`), jamais stockés.
- `debts[]` : `{id, who, dir: owe (je dois) | owed (on me doit), amt, due, note, pays: [{a, d}]}` ; le reste dû = `amt` − somme des `pays`.
- `tx[]` : `{id, label, date, amt (négatif = dépense), cat, ct}` : mouvements **occasionnels** (une fois, date future possible) ; `ct` = horodatage de saisie
- `rec[]` : `{id, label, amt, cat, day, start, end?}` : revenus et dépenses **fixes**, répétés chaque mois ; les occurrences sont calculées (`recOcc`), jamais stockées. « Arrêter » pose `end`.
- `bal` : `{amt, date, at}` : solde saisi à une date. Solde actuel = `bal.amt` + mouvements postérieurs + flux automatiques (`flowBetween` : fixes, mensualités de crédit, abonnements chiffrés). Voir `balNow()` / `balEom()`.
- `bud` : plafond mensuel par catégorie, `{ "Courses": 400 }`
- `plan` : `{inc, p: {poche, invest, pepin}, min: {poche, invest, pepin}, extra}` ; avec des minimums, chaque catégorie reçoit d'abord son minimum puis les % répartissent le surplus (si le reste ne couvre pas les minimums, ils sont réduits à proportion) : revenu saisi (vide = revenus fixes) et pourcentages du reste après charges fixes. Panneau à gauche ≥ 1340 px, bouton 💰 sinon (`planHTML`, `planCalc`).
- Salaire : entrée de `rec` avec `sal: 1` (fenêtre `salF`). `forecast()` simule jour par jour le solde jusqu'au prochain salaire (flux automatiques + mouvements à venir + quotidien sans date au prorata) ; carte `fcCard()` sur l'accueil et dans Budget.
- `plan.extra` : somme en plus par mois pour rembourser. `debtList()` (capital restant réel des crédits), `simPay()` (avalanche + boule de neige), `payoffCard()` dans l'onglet Dettes.
- `sav[]` : `{id, date, amt, dest: 'pepin'}` (négatif = retrait) ; `inv[]` : `{id, date, amt, note}` achats S&P 500. Valeur = montant × indice en euros aujourd'hui / indice à la date d'achat (`invStats`, `idxEur`), ou `plan.pv` saisi à la main.
- `plan.mode` : `auto` (par défaut, « Ma règle ») ou `pct` (pourcentages). Règle `plan.rule` = `{cap: 250, lowR: 350, lowCap: 100, seuil: 1000, low: 80, high: 50}` : argent de poche jusqu’au plafond (`lowCap` si le reste est sous `lowR`, voir `pocheCap`) (minimums respectés), puis le reste va `low` % à l'épargne tant que l'épargne (`pepTot`) est sous `seuil`, sinon `high` %. Voir `autoAlloc`, `epShare` (aussi utilisé par « Mettre de côté »). La catégorie `pepin` s'affiche « 🐷 Épargne ».
- `plan.od` : découvert à ne pas dépasser (200 € par défaut). `forecast()` répartit le quotidien sans date sur les jours ; l'argent de poche sort du compte en une fois le jour du salaire (`f.pm`). Sous la limite, il propose d'abord de remettre de l'argent de poche sur le compte, puis l'investissement du mois, puis l'épargne « pépin ».
- Règle des crédits : `loanWatch()` simule chaque jour jusqu'au salaire d'après le prochain et vérifie que chaque prélèvement de crédit laisse le compte au-dessus du découvert autorisé ; sinon `loanHTML()` liste les actions (abonnements à suspendre, dépenses à décaler, épargne, appel à la banque). « Mettre de côté » garde la réserve nécessaire aux crédits du mois suivant.
- `plan.rate` : rendement supposé pour les intérêts composés (par défaut, moyenne 10 ans en euros, `cagr()`).
- `notes` : texte du bloc-notes (panneau à droite ≥ 1000 px, bouton 📝 + fenêtre en dessous) ; `noteIn()` enregistre 0,6 s après la frappe.
- `ts` : date de dernière modification (la plus récente gagne à la synchro)

## Notifications
L'appli crée une paire de clés VAPID (`genKeys`) : la publique est enregistrée dans les données (`pushKey`), la privée est copiée par toi dans le secret GitHub `VAPID_PRIVATE_KEY`. Chaque appareil s'inscrit (`subNotif`) et son abonnement est stocké dans `subs`. `sw.js` affiche les notifications reçues. Secrets nécessaires dans Layrical : `VAPID_PRIVATE_KEY` et `DATA_TOKEN`.
Règles d'envoi (`scripts/rappels-calc.mjs`) : résumé du matin à `notif.hour` (8 h), avancé à 6 h 30 s'il y a un rendez-vous ou rappel avant 9 h ce jour-là (cron dédié `30 4,5 * * *`) ; rappel de la veille à `notif.eve` (20 h) listant tout ce qui a lieu le lendemain ; rappel 1 h avant chaque rendez-vous/rappel qui a une heure.

## Coûts de renouvellement
`COUTS` dans app.js : coûts connus (passeport 86 €, CNI gratuite…) proposés dans Échéances et ajoutés automatiquement à un nouveau renouvellement.

## Graphiques
Faits main en SVG/HTML (aucune bibliothèque) dans app.js, section « Graphiques » : `lineChart` (solde jour par jour + réticule), `hbars` (barres classées, une teinte), `segBar` (où va l'argent), `colChart` (revenus/dépenses par mois, mois à venir en clair). Couleurs `--c1…--c6` (palette validée daltonisme, clair et sombre) dans app.css ; infobulle commune via l'attribut `data-tip`.

## Où ajouter quoi
- Nouveau type d'élément : `TY` dans app.js, puis `alerts()` pour son délai d'alerte.
- Onglet Dettes : `dettes()`, `credRow()`, `debtRow()`, `payF()` / `savePay()` dans app.js.
- Nouvelle catégorie de budget : `CATS` dans app.js.
- Couleurs : variables `:root` dans app.css.
- Changer la version du cache : `V` dans sw.js (purge les anciens caches).

## Appli Android + widget
`android/` : petite appli Java sans dépendance, compilée par `.github/workflows/android.yml` et publiée en Release (`releases/latest/download/agenda.apk`).
- `MainActivity` : le site en plein écran dans une WebView (liens externes ouverts dans le navigateur).
- `AgendaWidget` : widget d'écran d'accueil. Le site lui envoie son résumé via `window.AgendaNative.update(json)` (`widgetData()` dans app.js : événements du jour et de demain, solde, prochain salaire, point bas). Toutes les 30 min (ou bouton ↻), le widget charge le site en arrière-plan avec `?bg=1` : synchro GitHub, envoi du résumé, puis `AgendaNative.done()`.
- Le jeton de synchro est collé une fois dans l'appli (stockage séparé de Chrome).
- Notifications locales (`Notif`, `AlarmReceiver`) : le site calcule 8 jours de notifications avec `plan()` de `scripts/rappels-calc.mjs` (mêmes règles que GitHub, heures exactes) et les passe via `AgendaNative.schedule(json)`. L'appli programme la prochaine avec AlarmManager (alarme exacte), l'affiche à l'heure, ne renvoie jamais un même `tag`, ignore celles en retard de plus de 20 min, et se reprogramme au redémarrage. À chaque notification, elle resynchronise en arrière-plan. Dès que l'appli est utilisée, le site met `notif.native` dans les données et la tâche GitHub n'envoie plus rien (pas de doublons ; ses horaires programmés ne sont pas fiables).
- Signature : secret GitHub `APK_KEYSTORE` (keystore en base64, alias `agenda`), jamais dans le dépôt ; toujours la même clé, pour que chaque version s'installe par-dessus la précédente. Sans ce secret, la tâche compile seulement (contrôle) et ne publie rien.

## Argent de poche et achats carte
- `S.poche = {tx:[{id,date,time,amt,round,label,bal,auto}], round:{on,x}}` : dépenses d'argent de poche (Revolut), avec l'arrondi à l'euro supérieur investi (×1/2/5/10). Reste = argent de poche du plan (`planCalc().amt('poche')`) − dépenses − arrondis, du dernier salaire au prochain (`pocheCycle`). Carte « 🎉 Argent de poche » dans Budget, ligne dans le widget.
- Argent reçu : `in:1`. Revolut : s'ajoute à l'argent de poche (les rechargements depuis ton compte sont ignorés). Caisse d'Épargne : revenu ajouté au budget, sauf s'il ressemble au salaire (±15 %), marqué « déjà prévu » pour ne pas le compter deux fois.
- `S.card = [{id,date,time,amt,in,label,st:'imprevu'|'prevu'}]` : paiements Caisse d'Épargne hors argent de poche. Imprévu = un mouvement `S.tx` (id `cb…`, catégorie Imprévu) qui baisse le solde et donc ce qui reste à épargner ; « C'était prévu » retire ce mouvement (déjà compté dans le budget, ex. courses).
- Appli Android : `BankListener` (accès aux notifications, à autoriser) lit seulement Revolut et Caisse d'Épargne ; `BankParse` (Java pur) extrait montant, solde et commerçant, ignore argent reçu, arrondis, refus, codes, promos. File d'attente locale → `AgendaNative.pending()` / `ack()` → `nimport()` dans le site (appli ouverte : tout de suite ; sinon synchro en arrière-plan). Journal des 15 dernières notifications lues, seulement sur le téléphone (`rawF`).
- Mise à jour automatique : `Updater` compare la dernière Release GitHub (`app-N`) au numéro installé, à chaque ouverture (toutes les 2 min au plus) et en arrière-plan (toutes les 3 h au plus), puis télécharge et installe tout seul (PackageInstaller, sans confirmation sur Android 12+ une fois que l'appli s'est mise à jour elle-même ; sinon Android affiche une confirmation, ou une notification si l'appli est fermée). Il faut une fois autoriser « installer des applis » pour Agenda.

## Rappels « fait »
Bouton ✓ sur les rappels (`doneIt`) : la date de l'occurrence est ajoutée à `it.dn`. Un rappel fait disparaît du bandeau d'alertes, des 30 prochains jours, du widget et des notifications (`rappels-calc.mjs` les saute) ; il reste barré dans l'agenda, et ✓ à nouveau annule.

## Mes adresses (Waze)
`S.contacts = [{id,name,addr,tel,emo}]`, bouton 📍 dans la barre du haut (à côté de 💰 et 📝) qui ouvre la liste défilable de toutes les adresses (recherche par mots au-delà de 5) ; plus sur l'Accueil. Toucher un contact ouvre une fenêtre de confirmation : « 🚗 Y aller avec Waze » (`https://waze.com/ul?q=<adresse>&navigate=yes`, ouvert par l'appli Waze), Google Maps en secours, appel si un numéro est enregistré, modifier/supprimer.

## Accueil (ordre et règles d'interface)
Inspiré des applis bancaires (Revolut, Monzo) : un solde « héros », des tuiles « coup d'œil » qui mènent au détail, des listes sur une ligne. Ordre : en-tête (Bonjour/Bonsoir, date, version) → alertes (si besoin) → héros (solde + fin du mois, reçu, dépensé) → 4 tuiles (💼 salaire dans N j, 📉 point bas, 🎉 argent de poche restant avec barre, 🐷 épargne + S&P) → 📅 Aujourd'hui/Demain (rappels cochables) → ⏳ À surveiller (si non vide) → 🗓️ À venir (6 lignes d'une ligne `cRow`, toucher = modifier, puis « Voir les N suivants ») → 📍 Mes adresses (rangée défilante) → réglages en 3 boutons. Le détail du salaire (courbe, crédits) est dans l'onglet Budget. Sur téléphone (< 1000 px), barre fixe en haut : synchro, 💰, 📝. Cibles tactiles ≥ 44 px.

## Toutes les pages : même style compact
Composants communs : `L1` (ligne d'une ligne : icône, titre, sous-titre, montant, pastille de délai `chipFor`, barre de progression, action rapide ; toucher la ligne ouvre sa fiche), `heroBox` (gros chiffre + 3 sous-chiffres), `tile`, `sect`, `listMore` (N lignes puis « Voir les autres »), `more` (bloc replié, état retenu). Les fiches de modification ont un bouton « Supprimer » (« Arrêter » pour un revenu/dépense fixe), donc plus de ✎/✕ sur chaque ligne.
- Budget : héros bilan du mois (reçu, dépensé, solde) → 4 tuiles (poche, abonnements, crédits, quotidien) → salaire (détail replié) → argent de poche → Caisse d'Épargne → catégories → graphiques (repliés) → fixes, quotidien, abonnements (5 + autres) → mouvements (8 + autres).
- Dettes : héros reste à rembourser (par mois, je dois, on me doit) → crédits (barre de progression) → plusieurs fois → dettes entre proches (bouton Rembourser) → « Rembourser plus vite » replié.
- Épargne : héros patrimoine → 3 boutons d'action → S&P 500 et intérêts composés repliés → historique.
- Échéances : héros prochaine échéance (dans, date, coût sur 12 mois) → liste avec pastilles rouge < 30 j, orange < 90 j.
- Agenda (téléphone) : liste du jour en lignes compactes.

## Agenda, Budget et widget (version claire)
- Agenda (téléphone) : calendrier sobre (chiffre dans un rond, jusqu'à 3 petits points de couleur par jour, jour sélectionné plein, aujourd'hui cerclé, jours passés grisés) ; dessous, un « Planning » : le jour choisi puis les jours suivants (14 jours) qui ont quelque chose, avec tout ce qui s'y passe (rendez-vous, prélèvements, salaire, mouvements, fériés). Bouton « Aujourd'hui » pour revenir.
- Budget : 4 sous-onglets mémorisés (`localStorage.bt`) : Résumé (bilan, 2 tuiles, salaire en 3 chiffres + détail replié, 4 premières catégories, graphiques repliés), Poche (argent de poche + Caisse d'Épargne), Fixes (fixes, quotidien, abonnements), Mouvements.
- Widget : `widgetData().w` = version courte (`widgetShort`). Fond dégradé, date en couleur d'accent, emojis par catégorie, montants en couleur, chiffres 🎉 💼 📉 colorés (vert/orange/rouge). Deux colonnes centrées : à gauche la date, aujourd'hui (3 lignes, une icône chacune) et « Demain · … » ; à droite le solde arrondi en grand puis Poche / Salaire J−N / Point bas. « À actualiser » si plus de 3 h.

## Argent de poche : correction
`S.poche.set = {amt,date,at}` (bouton « Corriger ») : ce qu'il y a vraiment sur Revolut à une date. Le reste repart de ce montant et ne compte que les mouvements suivants (`at` horodate chaque dépense), jusqu'au prochain salaire ; ensuite, retour au montant prévu par le budget.

## 🎵 YouTube Music
`S.music = {url, wmode:'resume'|'list'}`. Bouton 🎵 dans la barre du haut (seulement dans l'appli Android) et ♫ sur le widget. Sans Premium, YouTube Music ne joue qu'au premier plan : l'appli l'ouvre (`Music.openAndPlay` : lancement de YouTube Music puis « Lecture » via sa session média ou la touche média) ou ouvre directement le lien de la playlist (`Music.playList`). Le widget passe par un écran invisible (`MusicReceiver`) pour avoir le droit d'ouvrir YouTube Music. Pas de contournement de la restriction de lecture en arrière-plan de YouTube.
- Bulle de contrôle (`Bubble`, service au premier plan « specialUse » + fenêtre par-dessus les applis, permission « Afficher par-dessus les autres applis ») : 🎵 déplaçable, ⏮ ⏯ ⏭ et le titre de la musique en cours, branchée sur la session média active de n'importe quelle appli (via l'accès aux notifications), sinon touches média du système. Masquable par ✕ ou par sa notification.
- « 🚗🎵 Waze + musique » sur chaque adresse : relance la dernière musique (`Music.playAny`), affiche la bulle si l'option est cochée, puis ouvre Waze. La baisse du volume quand Waze parle est gérée par Android et l'appli de musique : rien à faire côté Agenda (réglage « Alertes seulement » dans Waze).
