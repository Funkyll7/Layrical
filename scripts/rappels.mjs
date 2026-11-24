// Envoie les notifications push des rappels (lancé chaque heure par .github/workflows/rappels.yml).
// Secrets GitHub nécessaires : DATA_TOKEN (lecture du dépôt de données privé) et VAPID_PRIVATE_KEY.
// Les journaux de ce dépôt public n'affichent jamais le contenu des rappels, seulement des compteurs.
import webpush from 'web-push';
import { reminders, parisNow } from './rappels-calc.mjs';

const REPO = process.env.DATA_REPO || 'Funkyll7/agenda-data';
const FILE = process.env.DATA_FILE || 'agenda-data.json';
const { DATA_TOKEN, VAPID_PRIVATE_KEY, TEST } = process.env;

if (!DATA_TOKEN || !VAPID_PRIVATE_KEY) {
  console.log('Secrets DATA_TOKEN et/ou VAPID_PRIVATE_KEY absents : aucune notification envoyée.');
  process.exit(0);
}
const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE}`, {
  headers: { Authorization: 'Bearer ' + DATA_TOKEN, Accept: 'application/vnd.github.raw+json', 'X-GitHub-Api-Version': '2022-11-28' },
});
if (!r.ok) { console.error('Lecture du dépôt de données impossible : HTTP ' + r.status); process.exit(1); }
const S = await r.json();
if (!S.pushKey?.pub || !(S.subs || []).length) { console.log('Aucun appareil inscrit aux notifications.'); process.exit(0); }

// le passage de 6 h 30 (cron dédié) n'envoie que le résumé avancé
const early = !!process.env.SCHEDULE && process.env.SCHEDULE.startsWith('30 ');
const now = { ...parisNow(), early };
if (early && now.H != 6) { console.log('Passage de 6 h 30 : pas la bonne heure (Paris ' + now.H + ' h).'); process.exit(0); }
const msgs = TEST === 'true' ? [{ title: '🔔 Test depuis GitHub', body: 'Les rappels arrivent bien sur cet appareil.', tag: 'test' }] : reminders(S, now);
console.log(`Paris ${now.H} h${early ? ' 30 (avancé)' : ''} : ${msgs.length} notification(s) pour ${S.subs.length} appareil(s).`);
if (!msgs.length) process.exit(0);

webpush.setVapidDetails('https://funkyll7.github.io/Layrical/', S.pushKey.pub, VAPID_PRIVATE_KEY);
let ok = 0, gone = 0, err = 0;
for (const sub of S.subs) {
  for (const m of msgs) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify({ ...m, url: './' }), { TTL: 6 * 3600, urgency: 'normal' });
      ok++;
    } catch (e) {
      if (e.statusCode == 404 || e.statusCode == 410) gone++; else { err++; console.error('Envoi refusé : HTTP ' + (e.statusCode || '?')); }
    }
  }
}
console.log(`Envoyées : ${ok} · appareils expirés : ${gone} · erreurs : ${err}`);
if (err && !ok) process.exit(1);
