# PROJET.md — carte du projet

> Si tu ajoutes, déplaces ou supprimes un fichier, mets ce document à jour.

```
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
`{ items, tx, debts, rec, bal, notes, plan, bud, ts }`
- `items[]` : `{id, type: rdv|anniv|travail|renouv|abo|credit, title, date, rep: none|yearly|monthly, amt, note, lead}`
  - paiement en plusieurs fois (`fois`) : `total`, `n` = nombre d'échéances, `amt` = total/n arrondi au centime ; la dernière échéance absorbe l'arrondi (`instAmt`).
  - prêt étudiant (`stu: 1`) : `cap`, `rate`, `n` (mois de remboursement), `def` (n | p partiel | t total), `dfm` (mois de différé), `ins` (assurance €/mois), `dpay` (intérêts payés pendant un différé partiel). Échéance du mois j : `payAt(it, j)` ; en différé total les intérêts sont capitalisés (`stuCalc`).
  - crédit saisi avec le taux : `cap` = capital emprunté, `rate` = taux annuel (%), `n` = durée en mois ; mensualité = `mensu(cap, rate, n)` (amortissement classique), `total` = mensualité × n.
  - crédit : `amt` = mensualité, `total` = montant total à rembourser, `date` = 1er prélèvement. Mensualités payées, reste et date de fin sont **calculés** (`credPaid`, `credLeft`, `credEnd`), jamais stockés.
- `debts[]` : `{id, who, dir: owe (je dois) | owed (on me doit), amt, due, note, pays: [{a, d}]}` ; le reste dû = `amt` − somme des `pays`.
- `tx[]` : `{id, label, date, amt (négatif = dépense), cat, ct}` : mouvements **occasionnels** (une fois, date future possible) ; `ct` = horodatage de saisie
- `rec[]` : `{id, label, amt, cat, day, start, end?}` : revenus et dépenses **fixes**, répétés chaque mois ; les occurrences sont calculées (`recOcc`), jamais stockées. « Arrêter » pose `end`.
- `bal` : `{amt, date, at}` : solde saisi à une date. Solde actuel = `bal.amt` + mouvements postérieurs + flux automatiques (`flowBetween` : fixes, mensualités de crédit, abonnements chiffrés). Voir `balNow()` / `balEom()`.
- `bud` : plafond mensuel par catégorie, `{ "Courses": 400 }`
- `plan` : `{inc, p: {poche, invest, pepin}}` : revenu saisi (vide = revenus fixes) et pourcentages du reste après charges fixes. Panneau à gauche ≥ 1340 px, bouton 💰 sinon (`planHTML`, `planCalc`).
- `notes` : texte du bloc-notes (panneau à droite ≥ 1000 px, bouton 📝 + fenêtre en dessous) ; `noteIn()` enregistre 0,6 s après la frappe.
- `ts` : date de dernière modification (la plus récente gagne à la synchro)

## Où ajouter quoi
- Nouveau type d'élément : `TY` dans app.js, puis `alerts()` pour son délai d'alerte.
- Onglet Dettes : `dettes()`, `credRow()`, `debtRow()`, `payF()` / `savePay()` dans app.js.
- Nouvelle catégorie de budget : `CATS` dans app.js.
- Couleurs : variables `:root` dans app.css.
- Changer la version du cache : `V` dans sw.js (purge les anciens caches).
