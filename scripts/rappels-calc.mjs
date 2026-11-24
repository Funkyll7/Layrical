// Calcule les notifications à envoyer à un instant donné (heure de Paris), à partir des données de l'agenda.
// Aucune dépendance : testable seul. Utilisé par scripts/rappels.mjs.
const pad = (n) => String(n).padStart(2, '0');
const P = (s) => { const a = s.split('-'); return new Date(Date.UTC(+a[0], +a[1] - 1, +a[2], 12)); };
const iso = (d) => d.toISOString().slice(0, 10);
const dim = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
const addM = (s, k) => { const y = +s.slice(0, 4), m = +s.slice(5, 7) - 1 + k, d = +s.slice(8), Y = y + Math.floor(m / 12), M = ((m % 12) + 12) % 12; return Y + '-' + pad(M + 1) + '-' + pad(Math.min(d, dim(Y, M))); };
const days = (a, b) => Math.round((P(b) - P(a)) / 864e5);
const repMonths = (r) => r == 'weekly' ? 12 / 52 : r == 'monthly' ? 1 : r == 'yearly' ? 12 : /^m\d+$/.test(r || '') ? +r.slice(1) : 0;
const isInst = (it) => it.type == 'credit' || it.type == 'fois';
const credN = (it) => it.n ? (+it.n) + (+it.dfm || 0) : Math.max(1, Math.ceil((+it.total || 0) / (+it.amt || 1)));
const credEnd = (it) => addM(it.date, credN(it) - 1);
const mdiff = (a, b) => (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7)) - (+a.slice(5, 7));
// montant réellement prélevé ce jour-là (un prêt étudiant en différé ne prélève que les intérêts et/ou l'assurance)
const payOn = (it, s) => { if (!it.stu) return +it.amt; const j = mdiff(it.date, s), d = +it.dfm || 0, ins = +it.ins || 0; return j < d ? Math.round(((it.def == 'p' ? +it.dpay || 0 : 0) + ins) * 100) / 100 : +it.amt; };
const EMO = { rdv: '🗓️', rappel: '🔔', anniv: '🎂', travail: '🛒', renouv: '🪪', credit: '🏦', fois: '🧾' };
const LEAD = { renouv: 30, credit: 3, fois: 3, rappel: 0 };
const eur = (v) => (+v).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

export function occ(it, s) {
  if (!it.date) return false;
  if (it.rep == 'none' || !it.rep) return it.date == s;
  if (it.date > s) return false;
  if (isInst(it) && s > credEnd(it)) return false;
  if (it.rep == 'weekly') return days(it.date, s) % 7 == 0;
  if (it.rep == 'yearly') { const md = it.date.slice(5); return (md == '02-29' && dim(+s.slice(0, 4), 1) == 28 ? '02-28' : md) == s.slice(5); }
  const d = +it.date.slice(8), y = +s.slice(0, 4), m = +s.slice(5, 7) - 1, N = repMonths(it.rep) || 1,
    gap = (y - +it.date.slice(0, 4)) * 12 + m - (+it.date.slice(5, 7) - 1);
  return gap % N == 0 && +s.slice(8) == Math.min(d, dim(y, m));
}
export function nextOcc(it, TD) { const d = P(TD); for (let k = 0; k < 400; k++) { const s = iso(d); if (occ(it, s)) return s; d.setUTCDate(d.getUTCDate() + 1); } return null; }

// now = { TD: 'AAAA-MM-JJ', H: heure 0-23 } à Paris
export function reminders(S, now) {
  const { TD, H } = now, out = [], hour = S.notif && S.notif.hour != null ? +S.notif.hour : 8;
  const items = (S.items || []).filter((i) => i.type != 'abo' && i.date && EMO[i.type]);
  // 1) résumé du matin
  if (H == hour) {
    const today = [], soon = [];
    for (const it of items) {
      const s = nextOcc(it, TD); if (!s) continue;
      const n = days(TD, s), L = it.lead !== undefined && it.lead !== '' ? +it.lead : (LEAD[it.type] ?? 2);
      const v = isInst(it) ? payOn(it, s) : +it.amt, amt = isInst(it) || it.type == 'renouv' || it.type == 'travail' ? (v ? ' (' + eur(v) + ')' : '') : '';
      const lab = EMO[it.type] + ' ' + it.title + (it.time ? ' à ' + it.time : '') + amt;
      if (n == 0) today.push(lab); else if (L > 0 && n == L) soon.push((n == 1 ? 'Demain' : 'Dans ' + n + ' j') + ' : ' + lab);
    }
    for (const d of S.debts || []) {
      const left = (+d.amt) - (d.pays || []).reduce((a, p) => a + (+p.a), 0);
      if (d.dir == 'owe' && d.due && left > 0.005) { const n = days(TD, d.due); if (n == 0) today.push('💸 Rembourser ' + d.who + ' (' + eur(left) + ')'); else if (n == 7) soon.push('Dans 7 j : 💸 rembourser ' + d.who + ' (' + eur(left) + ')'); }
    }
    if (today.length || soon.length) {
      const lines = [...today.map((x) => 'Aujourd’hui : ' + x), ...soon];
      out.push({ title: today.length ? '📅 Aujourd’hui : ' + today.length + ' chose' + (today.length > 1 ? 's' : '') + ' à ne pas oublier' : '📅 À venir bientôt', body: lines.slice(0, 8).join('\n') + (lines.length > 8 ? '\n… et ' + (lines.length - 8) + ' autre(s)' : ''), tag: 'resume-' + TD });
    }
  }
  // 2) rendez-vous et rappels avec une heure : environ 1 h avant
  for (const it of items) {
    if (!it.time || !occ(it, TD)) continue;
    const h = +it.time.slice(0, 2);
    if (h == (H + 1) % 24 && H + 1 < 24) out.push({ title: '⏰ Dans 1 h : ' + it.title, body: EMO[it.type] + ' ' + it.title + ' à ' + it.time + (it.note ? '\n' + it.note : ''), tag: 'h-' + it.id + '-' + TD });
  }
  return out;
}

export function parisNow(date = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false }).formatToParts(date).map((x) => [x.type, x.value]));
  return { TD: p.year + '-' + p.month + '-' + p.day, H: (+p.hour) % 24 };
}
