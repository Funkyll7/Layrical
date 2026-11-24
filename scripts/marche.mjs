// Récupère le cours de clôture du S&P 500 et le taux EUR/USD (10 ans, quotidien)
// et les écrit dans marche.json, lu par le site. Lancé par .github/workflows/marche.yml.
// Source principale : Yahoo Finance ; secours : Stooq. Aucune clé nécessaire.
import fs from 'node:fs';

const UA = { 'User-Agent': 'Mozilla/5.0 (agenda perso ; mise à jour quotidienne)' };
const r2 = (x) => Math.round(x * 100) / 100;
const r4 = (x) => Math.round(x * 10000) / 10000;

async function yahoo(sym, round) {
  const u = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=10y&interval=1d`;
  const r = await fetch(u, { headers: UA });
  if (!r.ok) throw new Error(`Yahoo ${sym} : HTTP ${r.status}`);
  const res = (await r.json())?.chart?.result?.[0];
  const ts = res?.timestamp, c = res?.indicators?.quote?.[0]?.close;
  if (!ts || !c) throw new Error(`Yahoo ${sym} : réponse inattendue`);
  const out = [];
  ts.forEach((t, i) => { if (c[i] != null && isFinite(c[i])) out.push([new Date(t * 1000).toISOString().slice(0, 10), round(c[i])]); });
  return out;
}

async function stooq(sym, round) {
  const r = await fetch(`https://stooq.com/q/d/l/?s=${encodeURIComponent(sym)}&i=d`, { headers: UA });
  if (!r.ok) throw new Error(`Stooq ${sym} : HTTP ${r.status}`);
  const since = new Date(Date.now() - 10 * 365.25 * 864e5).toISOString().slice(0, 10);
  const rows = (await r.text()).trim().split('\n').slice(1).map((l) => l.split(','));
  const out = rows.filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x[0]) && x[0] >= since && isFinite(+x[4]) && x[4] !== '').map((x) => [x[0], round(+x[4])]);
  if (!out.length) throw new Error(`Stooq ${sym} : aucune donnée`);
  return out;
}

async function serie(nom, yahooSym, stooqSym, round) {
  try { return await yahoo(yahooSym, round); }
  catch (e) { console.warn(e.message, '→ secours Stooq'); return await stooq(stooqSym, round); }
}

// Un doublon de date garde la dernière valeur ; tri croissant.
const propre = (a) => [...new Map(a.map((x) => [x[0], x])).values()].sort((x, y) => x[0].localeCompare(y[0]));

const spx = propre(await serie('S&P 500', '^GSPC', '^spx', r2));
const eurusd = propre(await serie('EUR/USD', 'EURUSD=X', 'eurusd', r4));
if (spx.length < 100) throw new Error('Trop peu de cours du S&P 500 : marche.json n’est pas modifié.');

fs.writeFileSync('marche.json', JSON.stringify({ maj: new Date().toISOString(), source: 'Yahoo Finance / Stooq', spx, eurusd }));
console.log(`marche.json : ${spx.length} cours S&P 500 (dernier ${spx.at(-1).join(' = ')}), ${eurusd.length} cours EUR/USD`);
