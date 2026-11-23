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
`{ items, tx, bud, ts }`
- `items[]` : `{id, type: rdv|anniv|travail|renouv|abo, title, date, rep: none|yearly|monthly, amt, note, lead}`
- `tx[]` : `{id, label, date, amt (négatif = dépense), cat}`
- `bud` : plafond mensuel par catégorie, `{ "Courses": 400 }`
- `ts` : date de dernière modification (la plus récente gagne à la synchro)

## Où ajouter quoi
- Nouveau type d'élément : `TY` dans app.js, puis `alerts()` pour son délai d'alerte.
- Nouvelle catégorie de budget : `CATS` dans app.js.
- Couleurs : variables `:root` dans app.css.
- Changer la version du cache : `V` dans sw.js (purge les anciens caches).
