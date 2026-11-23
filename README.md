# Mon agenda perso

Agenda, budget, anniversaires, rendez-vous, jours fériés français, échéances
(carte d'identité, abonnements…) avec rappels et plafonds de budget par catégorie.

Site **100 % statique** (aucun build, aucune dépendance), installable sur
téléphone, qui fonctionne hors ligne. Les données ne sont **pas** dans ce
dépôt : elles vivent dans un second dépôt **privé**, lu et écrit directement
par le navigateur avec ton jeton GitHub.

> Pourquoi deux dépôts ? GitHub Pages publie tout le dossier. Si tes rendez-vous
> et ton budget étaient dans le même dépôt, ils seraient lisibles par n'importe
> qui connaissant l'adresse du site. Ici, le site est public, tes données non.

## Mise en place (10 minutes)

### 1. Le dépôt du site
1. Crée un dépôt GitHub `agenda` (public) et envoie-y le contenu de ce dossier
   (*Add file → Upload files*, ou `git push`).
2. **Settings → Pages → Deploy from a branch → `main` / `(root)` → Save.**
3. Ton site sera à `https://<ton-compte>.github.io/agenda/`.

### 2. Le dépôt des données
1. Crée un dépôt **privé** `agenda-data`, en cochant *Add a README*.
2. Génère un jeton : [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)
   - *Repository access* : **Only select repositories** → `agenda-data`
   - *Permissions → Repository permissions* : **Contents : Read and write**
   - Choisis une expiration : le site te redemandera un jeton à ce moment-là.

### 3. Brancher l'appli (une fois par appareil)
Ouvre le site → onglet **Accueil** → *Données* → **Synchro GitHub → Régler**,
puis entre `ton-compte/agenda-data` et le jeton. Le fichier `agenda-data.json`
est créé tout seul. Sur téléphone, utilise *Ajouter à l'écran d'accueil*.

## Fonctionnement
- Chaque ajout est envoyé environ une seconde plus tard ; l'appli relit le dépôt
  toutes les 30 secondes et à chaque retour sur l'onglet.
- En cas d'écritures simultanées sur deux appareils, la version la plus récente gagne.
- Le jeton reste dans le `localStorage` de chaque navigateur et n'est envoyé qu'à
  `api.github.com`. Ne le saisis pas sur un ordinateur partagé.
- Sans jeton, tout marche en local ; **Sauvegarde** exporte / importe en JSON.
- Les rappels s'affichent à l'ouverture de l'appli (pas de notification push).

## Tester en local
`python3 -m http.server 8000` dans ce dossier, puis http://localhost:8000
(le service worker exige http://localhost ou https).
