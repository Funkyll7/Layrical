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
