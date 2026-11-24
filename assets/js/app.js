/* app.js — état, vues, formulaires. La synchro vit dans sync.js. */
const TY={rdv:['Rendez-vous','#2f6fdb','🗓️'],anniv:['Anniversaire','#d6479a','🎂'],travail:['Quotidien','#b7791f','🛒'],renouv:['Renouvellement','#c8372d','🪪'],abo:['Abonnement','#7a4fd1','🔁'],credit:['Crédit','#0f766e','🏦'],fois:['En plusieurs fois','#b45309','🧾']};
const CATS=['Logement','Courses','Transport','Loisirs','Santé','Factures','Dettes','Autre'];
const RP={none:'Une seule fois',monthly:'Chaque mois',m2:'Tous les 2 mois',m3:'Tous les 3 mois',m6:'Tous les 6 mois',yearly:'Chaque année'};
const repMonths=r=>r=='monthly'?1:r=='yearly'?12:/^m\d+$/.test(r||'')?+r.slice(1):0;
const MO=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const pad=n=>String(n).padStart(2,'0');
const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const P=s=>{const a=s.split('-');return new Date(+a[0],+a[1]-1,+a[2],12)};
const TD=iso(new Date());
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const eur=n=>n.toLocaleString('fr-FR',{style:'currency',currency:'EUR'});
const dl=s=>P(s).toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'});
const diff=s=>Math.round((P(s)-P(TD))/864e5);
const inj=n=>n==0?"Aujourd’hui":n==1?'Demain':'Dans '+n+' j';
let S={items:[],tx:[],debts:[],rec:[],bal:null,plan:{inc:'',p:{poche:50,invest:25,pepin:25}},bud:{},ts:0,tab:'home',sel:TD,cy:+TD.slice(0,4),cm:+TD.slice(5,7)-1,by:+TD.slice(0,4),bm:+TD.slice(5,7)-1};
let SYNC='local';const apply=o=>{S.items=o.items||[];S.tx=o.tx||[];S.debts=o.debts||[];S.rec=o.rec||[];S.bal=o.bal||null;S.notes=o.notes||'';S.plan=o.plan||{inc:'',p:{poche:50,invest:25,pepin:25}};S.bud=o.bud||{};S.ts=o.ts||0};try{const r=localStorage.getItem('agenda-perso');if(r)apply(JSON.parse(r))}catch(e){}
const snap=()=>({items:S.items,tx:S.tx,debts:S.debts,rec:S.rec,bal:S.bal,notes:S.notes||'',plan:S.plan,bud:S.bud,ts:S.ts});
let ERR='';const badge=()=>{const e=$('#sy');e.textContent=SYNC=='ok'?'☁️ Synchronisé':SYNC=='sav'?'☁️ Envoi…':SYNC=='err'?'⚠️ '+(ERR||'Hors ligne'):'📱 Local · touche pour régler la synchro';e.onclick=()=>gs();e.style.cursor='pointer'};
const lsave=()=>{try{localStorage.setItem('agenda-perso',JSON.stringify(snap()))}catch(e){}};
const save=()=>{S.ts=Date.now();lsave();if(GH.token&&GH.repo){SYNC='sav';badge();clearTimeout(tm);tm=setTimeout(push,1200)}};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
function easter(y){const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=(h+l-7*m+114)%31+1;return new Date(y,mo-1,da,12)}
const hc={};
function hol(y){if(hc[y])return hc[y];const e=easter(y),add=n=>{const d=new Date(e);d.setDate(d.getDate()+n);return iso(d)},f=(m,d)=>y+'-'+pad(m)+'-'+pad(d);
return hc[y]={[f(1,1)]:"Jour de l’an",[add(1)]:'Lundi de Pâques',[f(5,1)]:'Fête du travail',[f(5,8)]:'Victoire 1945',[add(39)]:'Ascension',[add(50)]:'Lundi de Pentecôte',[f(7,14)]:'Fête nationale',[f(8,15)]:'Assomption',[f(11,1)]:'Toussaint',[f(11,11)]:'Armistice',[f(12,25)]:'Noël'}}
const holName=s=>hol(+s.slice(0,4))[s];
function dim(y,m){return new Date(y,m+1,0).getDate()}
function occ(it,s){if(it.rep=='none')return it.date==s;if(it.date>s)return false;if(isInst(it)&&s>credEnd(it))return false;if(it.stu&&!payAt(it,mdiff(it.date,s)))return false;if(it.rep=='yearly'){const md=it.date.slice(5);return (md=='02-29'&&dim(+s.slice(0,4),1)==28?'02-28':md)==s.slice(5)}const d=+it.date.slice(8),y=+s.slice(0,4),m=+s.slice(5,7)-1,N=repMonths(it.rep)||1,gap=(y-+it.date.slice(0,4))*12+m-(+it.date.slice(5,7)-1);return gap%N==0&&+s.slice(8)==Math.min(d,dim(y,m))}
function addM(s,k){const y=+s.slice(0,4),m=+s.slice(5,7)-1+k,d=+s.slice(8),Y=y+Math.floor(m/12),M=((m%12)+12)%12;return Y+'-'+pad(M+1)+'-'+pad(Math.min(d,dim(Y,M)))}
const isInst=it=>it.type=='credit'||it.type=='fois';
function mdiff(a,b){return (+b.slice(0,4)-+a.slice(0,4))*12+(+b.slice(5,7))-(+a.slice(5,7))}
function payAt(it,j){const d=+it.dfm||0,ins=+it.ins||0;return j<d?Math.round(((it.def=='p'?+it.dpay||0:0)+ins)*100)/100:+it.amt}
function stuCalc(C,r,n,def,dfm,ins){const i=r/1200,D=def=='n'?0:dfm,base=def=='t'?C*Math.pow(1+i,D):C,M=Math.round(mensu(base,r,n)*100)/100,dPay=def=='p'?Math.round(C*i*100)/100:0;return {M,dPay,base,D,total:Math.round((D*(dPay+ins)+n*(M+ins))*100)/100,insTot:Math.round(ins*(D+n)*100)/100}}
function credN(it){return it.n?(+it.n)+(+it.dfm||0):Math.max(1,Math.ceil((+it.total||0)/(+it.amt||1)))}
function instAmt(it,s){if(it.stu)return payAt(it,mdiff(it.date,s));return s==credEnd(it)?Math.round(((+it.total||0)-(credN(it)-1)*(+it.amt||0))*100)/100:+it.amt}
function credEnd(it){return addM(it.date,credN(it)-1)}
function credPaid(it){const n=credN(it);let k=0;while(k<n&&addM(it.date,k)<=TD)k++;return k}
function credLeft(it){const k=credPaid(it),N=credN(it);if(it.stu){let v=0;for(let j=k;j<N;j++)v+=payAt(it,j);return Math.round(v*100)/100}return k>=N?0:Math.max(0,Math.round(((+it.total||0)-k*(+it.amt||0))*100)/100)}
const dPaid=d=>(d.pays||[]).reduce((a,p)=>a+(+p.a),0);
const dLeft=d=>Math.max(0,(+d.amt)-dPaid(d));
const dueOn=s=>S.debts.filter(d=>d.due==s&&dLeft(d)>0);
function next(it){if(it.rep=='none')return it.date;let d=P(TD);for(let i=0;i<400;i++){const s=iso(d);if(s>=it.date&&occ(it,s))return s;d.setDate(d.getDate()+1)}return it.date}
const on=s=>S.items.filter(i=>occ(i,s));
function pill(n){return '<span class="pill'+(n<0?' d':n<=30?' d':n<=90?' w':'')+'">'+(n<0?'Expiré':inj(n))+'</span>'}
function itemRow(it,s){const t=TY[it.type];return '<div class="row"><span class="dot" style="background:'+t[1]+'"></span><div class="t"><b>'+t[2]+' '+esc(it.title)+'</b><small>'+(s?dl(s)+' · ':'')+t[0]+(it.amt?' · '+eur(it.stu&&s?payAt(it,mdiff(it.date,s)):+it.amt)+(isInst(it)?'/mois':it.type=='travail'&&repMonths(it.rep)?' · '+RP[it.rep].toLowerCase():''):'')+(it.note?' · '+esc(it.note):'')+'</small></div>'+(s?pill(diff(s)):'')+'<button class="x" aria-label="Modifier" onclick="openEdit(\'it\',\''+it.id+'\')">✎</button><button class="x" aria-label="Supprimer" onclick="delIt(\''+it.id+'\')">✕</button></div>'}
function holRow(s,n){return '<div class="row"><span class="dot" style="background:#0e9f6e"></span><div class="t"><b>🇫🇷 '+esc(n)+'</b><small>'+dl(s)+' · Jour férié</small></div>'+pill(diff(s))+'</div>'}
function monthTx(y,m){return S.tx.filter(t=>t.date.slice(0,7)==y+'-'+pad(m+1))}
function subMonthly(){return S.items.filter(i=>i.type=='abo'&&i.amt&&i.rep!='none'&&next(i)>=TD).reduce((a,i)=>a+(+i.amt/(repMonths(i.rep)||12)),0)}
function recOcc(r,y,m){const s=y+'-'+pad(m+1)+'-'+pad(Math.min(r.day,dim(y,m)));return s>=r.start&&(!r.end||s<=r.end)?{id:'r'+r.id+s,rid:r.id,label:r.label,date:s,amt:r.amt,cat:r.cat,rec:1}:null}
function recMonth(y,m){return S.rec.map(r=>recOcc(r,y,m)).filter(Boolean)}
function monthAll(y,m){return monthTx(y,m).concat(recMonth(y,m))}
function eom(){const y=+TD.slice(0,4),m=+TD.slice(5,7)-1;return y+'-'+pad(m+1)+'-'+pad(dim(y,m))}
// Flux automatiques sur ]a ; b] : revenus/dépenses fixes, mensualités de crédit, abonnements chiffrés
function flowBetween(a,b){let v=0;if(b<=a)return v;
 S.rec.forEach(r=>{let y=+a.slice(0,4),m=+a.slice(5,7)-1;for(let k=0;k<1200;k++){const o=recOcc(r,y,m);if(o&&o.date>a&&o.date<=b)v+=o.amt;m++;if(m>11){m=0;y++}if(y+'-'+pad(m+1)>b.slice(0,7))break}});
 const ch=S.items.filter(i=>(isInst(i)||i.type=='abo'||(i.type=='travail'&&i.date))&&+i.amt>0);
 if(ch.length){const d=P(a);for(let k=0;k<20000;k++){d.setDate(d.getDate()+1);const s=iso(d);if(s>b)break;ch.forEach(i=>{if(occ(i,s))v-=isInst(i)?instAmt(i,s):+i.amt})}}
 return v}
const txAfter=t=>t.date>S.bal.date||(t.date==S.bal.date&&(t.ct||0)>S.bal.at);
function balNow(){if(!S.bal)return null;return +S.bal.amt+S.tx.filter(t=>t.date<=TD&&txAfter(t)).reduce((a,t)=>a+t.amt,0)+flowBetween(S.bal.date,TD)}
function balEom(){const n=balNow();if(n===null)return null;const e=eom();return n+S.tx.filter(t=>t.date>TD&&t.date<=e&&txAfter(t)).reduce((a,t)=>a+t.amt,0)+flowBetween(TD,e)-quotUndated()*(daysBetween(TD,e)+1)/dim(+TD.slice(0,4),+TD.slice(5,7)-1)}
function balCard(){const n=balNow();if(n===null)return '<div class="big" role="button" tabindex="0" style="cursor:pointer" onclick="balF()"><small>Solde actuel</small><b style="font-size:17px;color:var(--ac)">Touche ici pour définir ton solde</b></div>';
 const e=balEom();return '<div class="big" role="button" tabindex="0" style="cursor:pointer" onclick="balF()"><small>Solde actuel (estimé) · touche pour corriger</small><b class="'+(n>=0?'pos':'neg')+'">'+eur(n)+'</b><small style="margin-top:4px">Fin du mois prévue : <b style="font-size:14px;color:'+(e>=0?'var(--ink)':'var(--rd)')+'">'+eur(e)+'</b></small></div>'}
function balF(){sheet('<h2 style="margin-top:0">Mon solde actuel</h2><label>Solde de ton compte (€)</label><input id="b_a" type="number" inputmode="decimal" step="0.01" value="'+(S.bal?balNow().toFixed(2):'')+'" placeholder="Ex. 1250"><label>À la date du</label><input id="b_d" type="date" max="'+TD+'" value="'+TD+'"><small style="color:var(--mu);font-size:12px;display:block;margin-top:6px">Recopie le solde affiché par ta banque. L’appli y ajoute ensuite tes mouvements, tes revenus et dépenses fixes, tes mensualités de crédit et tes abonnements qui ont un montant.</small><button class="go" onclick="saveBal()">Enregistrer</button>'+(S.bal?'<button class="go" style="background:var(--ln);color:var(--ink);margin-top:8px" onclick="delBal()">Retirer le solde</button>':''))}
function saveBal(){const a=parseFloat($('#b_a').value),d=$('#b_d').value||TD;if(isNaN(a)){alert('Indique ton solde (il peut être négatif).');return}if(d>TD){alert('La date ne peut pas être dans le futur.');return}S.bal={amt:a,date:d,at:Date.now()};save();closeF();render()}
function delBal(){S.bal=null;save();closeF();render()}
function stopRec(id){const r=S.rec.find(x=>x.id==id);if(!r||!confirm('Arrêter « '+r.label+' » ? Les mois passés restent dans l’historique.'))return;if(r.start>TD)S.rec=S.rec.filter(x=>x!==r);else r.end=TD;save();render()}
function txRow(t){const fut=t.date>TD;return '<div class="row"><div class="t"><b>'+(t.rec?'🔁 ':'')+esc(t.label)+'</b><small>'+dl(t.date)+' · '+t.cat+' · '+(t.rec?'fixe, chaque mois':'occasionnelle')+'</small>'+(fut?'<div style="margin-top:6px"><span class="pill w">À venir</span></div>':'')+'</div><b class="'+(t.amt>0?'pos':'')+'" style="flex:none">'+(t.amt>0?'+':'')+eur(t.amt)+'</b>'+'<button class="x" aria-label="Modifier" onclick="openEdit(\''+(t.rec?'rec':'tx')+'\',\''+(t.rec?t.rid:t.id)+'\')">✎</button>'+(t.rec?'<span style="width:34px"></span>':'<button class="x" aria-label="Supprimer" onclick="delTx(\''+t.id+'\')">✕</button>')+'</div>'}
function home(){
 let ev=[];for(let i=0;i<=30;i++){const d=P(TD);d.setDate(d.getDate()+i);const s=iso(d);on(s).forEach(it=>ev.push({s,it}));dueOn(s).forEach(dt=>ev.push({s,dt}));const h=holName(s);if(h)ev.push({s,h})}
 const ren=S.items.filter(i=>i.type=='renouv')
  .map(i=>({i,s:next(i)})).filter(o=>diff(o.s)<=60&&diff(o.s)>=0).sort((a,b)=>a.s<b.s?-1:1);
 const tx=monthAll(+TD.slice(0,4),+TD.slice(5,7)-1).filter(t=>t.date<=TD),inc=tx.filter(t=>t.amt>0).reduce((a,t)=>a+t.amt,0),out=tx.filter(t=>t.amt<0).reduce((a,t)=>a+t.amt,0);
 return '<h1>Bonjour 👋</h1>'+alerts()+'<div class="sum">'+balCard()+'<div><small>Revenus de '+MO[+TD.slice(5,7)-1]+'</small><b>'+eur(inc)+'</b></div><div><small>Dépenses de '+MO[+TD.slice(5,7)-1]+'</small><b>'+eur(Math.abs(out))+'</b></div></div>'+fcCard()
 +'<h2>À surveiller (60 jours)</h2><div class="card">'+(ren.length?ren.map(o=>itemRow(o.i,o.s)).join(''):'<div class="empty">Aucune échéance proche.</div>')+'</div>'
 +'<h2>Les 30 prochains jours</h2><div class="card">'+(ev.length?ev.map(e=>e.h?holRow(e.s,e.h):e.dt?debtRow(e.dt):itemRow(e.it,e.s)).join(''):'<div class="empty">Rien de prévu. Appuie sur + pour ajouter.</div>')+'</div><h2>Données</h2><div class="card"><div class="row"><div class="t"><b>Sauvegarde</b><small>Exporter ou importer tout en JSON</small></div><button class="pill" style="border:0" onclick="bk()">Ouvrir</button></div><div class="row"><div class="t"><b>Synchro GitHub</b><small>Dépôt privé et token</small></div><button class="pill" style="border:0" onclick="gs()">Régler</button></div></div>'}
function agenda(){
 const y=S.cy,m=S.cm,first=new Date(y,m,1,12),off=(first.getDay()+6)%7,dim=new Date(y,m+1,0).getDate();
 let g=['L','M','M','J','V','S','D'].map(d=>'<div class="h">'+d+'</div>').join('');
 for(let i=0;i<off;i++)g+='<div></div>';
 for(let d=1;d<=dim;d++){const s=y+'-'+pad(m+1)+'-'+pad(d),ev=on(s),h=holName(s);
  g+='<button class="'+(s==TD?'td ':'')+(s==S.sel?'sel ':'')+(h?'ho':'')+'" onclick="S.sel=\''+s+'\';render()">'+d+'<i>'+ev.slice(0,3).map(e=>'<s style="background:'+TY[e.type][1]+'"></s>').join('')+(dueOn(s).length?'<s style="background:#e0751f"></s>':'')+'</i></button>'}
 const ev=on(S.sel),h=holName(S.sel),dd=dueOn(S.sel);
 return '<h1>Agenda</h1><div class="nv"><button onclick="mv(\'c\',-1)" aria-label="Mois précédent">‹</button><b>'+MO[m]+' '+y+'</b><button onclick="mv(\'c\',1)" aria-label="Mois suivant">›</button></div><div class="card" style="padding:10px"><div class="cal">'+g+'</div></div>'
 +'<h2>'+P(S.sel).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})+'</h2><div class="card">'+(h?'<div class="row"><span class="dot" style="background:#0e9f6e"></span><div class="t"><b>🇫🇷 '+esc(h)+'</b><small>Jour férié</small></div></div>':'')+ev.map(i=>itemRow(i)).join('')+dd.map(x=>debtRow(x)).join('')+(!h&&!ev.length&&!dd.length?'<div class="empty">Rien ce jour-là.</div>':'')+'</div>'}
function quotMonthly(){return S.items.filter(i=>i.type=='travail'&&+i.amt>0&&repMonths(i.rep)).reduce((a,i)=>a+(+i.amt)/repMonths(i.rep),0)}
function quotList(){const l=S.items.filter(i=>i.type=='travail').sort((a,b)=>a.title.localeCompare(b.title));return l.length?'<h2>Quotidien · '+eur(quotMonthly())+' par mois</h2><div class="card">'+l.map(i=>itemRow(i,i.date?next(i):undefined)).join('')+'</div>':''}
function aboList(){const l=S.items.filter(i=>i.type=='abo').sort((a,b)=>a.title.localeCompare(b.title));return l.length?'<h2>Abonnements</h2><div class="card">'+l.map(i=>itemRow(i)).join('')+'</div>':''}
function recList(){const l=S.rec.filter(r=>!r.end||r.end>=TD);return l.length?'<h2>Revenus et dépenses fixes</h2><div class="card">'+l.map(r=>'<div class="row"><div class="t"><b>🔁 '+esc(r.label)+'</b><small>'+(r.amt>0?'+':'')+eur(r.amt)+' le '+r.day+' de chaque mois · '+r.cat+(r.start>TD?' · à partir du '+dl(r.start):'')+'</small></div><button class="x" aria-label="Modifier" onclick="openEdit(\'rec\',\''+r.id+'\')">✎</button><button class="pill" style="border:0;cursor:pointer" onclick="stopRec(\''+r.id+'\')">Arrêter</button></div>').join('')+'</div>':''}
function budget(){
 const y=S.by,m=S.bm,tx=monthAll(y,m).sort((a,b)=>a.date<b.date?1:-1),inc=tx.filter(t=>t.amt>0).reduce((a,t)=>a+t.amt,0),out=-tx.filter(t=>t.amt<0).reduce((a,t)=>a+t.amt,0);
 const bc={};tx.filter(t=>t.amt<0).forEach(t=>bc[t.cat]=(bc[t.cat]||0)-t.amt);
 CATS.forEach(c=>{if(S.bud[c]&&!(c in bc))bc[c]=0});const cats=Object.entries(bc).sort((a,b)=>b[1]-a[1]);
 return '<h1>Budget</h1><div class="nv"><button onclick="mv(\'b\',-1)" aria-label="Mois précédent">‹</button><b>'+MO[m]+' '+y+'</b><button onclick="mv(\'b\',1)" aria-label="Mois suivant">›</button></div>'
 +'<div class="sum">'+balCard()+'<div><small>Revenus du mois</small><b>'+eur(inc)+'</b></div><div><small>Dépenses du mois</small><b>'+eur(Math.abs(out))+'</b></div></div>'
 +'<p style="color:var(--mu);font-size:14px;margin:10px 2px 0">Bilan de '+MO[m]+' : <b class="'+(inc-out>=0?'pos':'neg')+'">'+(inc-out>=0?'+':'')+eur(inc-out)+'</b></p>'+fcCard()
 +'<p style="color:var(--mu);font-size:14px;margin:10px 2px">Tes abonnements actifs coûtent environ <b style="color:var(--ink)">'+eur(subMonthly())+'</b> par mois.'+(credMonthly()?' Crédits et paiements en plusieurs fois : <b style="color:var(--ink)">'+eur(credMonthly())+'</b> par mois.':'')+'</p>'
 +(cats.length?'<h2>Dépenses par catégorie</h2><div class="card" style="padding:10px 14px">'+cats.map(catBar).join('')+'</div>':'')
 +'<button class="go" style="background:var(--acs);color:var(--ac);margin-top:12px" onclick="cap()">Fixer des plafonds par catégorie</button>'+recList()+quotList()+aboList()+'<h2>Mouvements de '+MO[m]+'</h2><div class="card">'+(tx.length?tx.map(txRow).join(''):'<div class="empty">Aucun mouvement. Appuie sur + pour en ajouter.</div>')+'</div>'}
function rappels(){
 const l=S.items.filter(i=>i.type=='renouv').map(i=>({i,s:next(i)})).sort((a,b)=>a.s<b.s?-1:1);
 return '<h1>Échéances</h1><p style="color:var(--mu);margin:-6px 0 6px;font-size:14px">Carte d’identité, passeport, permis, assurances : rouge sous 30 jours, orange sous 90.</p><div class="card">'+(l.length?l.map(o=>itemRow(o.i,o.s)).join(''):'<div class="empty">Ajoute un renouvellement avec +.</div>')+'</div>'}
// Bloc-notes : panneau à droite sur grand écran, fenêtre sur téléphone ; enregistré automatiquement
let NT=null;
function noteIn(v){S.notes=v;document.querySelectorAll('.np-ta').forEach(t=>{if(t!==document.activeElement)t.value=v});document.querySelectorAll('.np-st').forEach(e=>e.textContent='Enregistrement…');clearTimeout(NT);NT=setTimeout(()=>{save();document.querySelectorAll('.np-st').forEach(e=>e.textContent='Enregistré')},600)}
function noteSync(){document.querySelectorAll('.np-ta').forEach(t=>{if(t!==document.activeElement&&t.value!==(S.notes||''))t.value=S.notes||''})}
function noteF(){sheet('<h2 style="margin-top:0">Bloc-notes</h2><textarea class="np-ta" rows="14" style="min-height:50vh" placeholder="Tes notes, listes, idées…" oninput="noteIn(this.value)">'+esc(S.notes||'')+'</textarea><small class="np-st" style="color:var(--mu);font-size:12px;display:block;margin-top:6px">Enregistré automatiquement</small>')}
// Budget en pourcentages : panneau à gauche sur grand écran, fenêtre 💰 sinon
const PK=['poche','invest','pepin'],PL={poche:['🎉','Argent de poche'],invest:['📈','Investissement S&P 500'],pepin:['🛟','En cas de pépin']};let PT=null;
function planCalc(){const y=+TD.slice(0,4),m=+TD.slice(5,7)-1,rm=recMonth(y,m),auto=rm.filter(t=>t.amt>0).reduce((a,t)=>a+t.amt,0),fx=(-rm.filter(t=>t.amt<0).reduce((a,t)=>a+t.amt,0))||0,cr=credMonthly(),ab=subMonthly(),ov=S.plan.inc,rev=ov!==''&&ov!=null&&!isNaN(+ov)?+ov:auto,qu=quotMonthly(),ch=fx+cr+ab+qu,reste=rev-ch,p=S.plan.p,sum=PK.reduce((a,k)=>a+(+p[k]||0),0);
 return {auto,fx,cr,ab,qu,rev,ch,reste,sum,amt:k=>Math.max(0,reste)*(+p[k]||0)/100}}
function sumMsg(c){return c.reste<0?'⚠️ Tes charges fixes dépassent ton revenu : rien à répartir.':c.sum==100?'✓ 100 % de ton reste est réparti':c.sum<100?'Encore '+(100-c.sum)+' % à répartir ('+eur(Math.max(0,c.reste)*(100-c.sum)/100)+')':'⚠️ Tu dépasses de '+(c.sum-100)+' %'}
function planHTML(){const c=planCalc(),p=S.plan.p;
 return '<h2 style="margin-top:0">Mon budget du mois</h2><label>Revenu mensuel (€)</label><input class="pl-inc" type="number" inputmode="decimal" step="0.01" value="'+esc(S.plan.inc==null?'':S.plan.inc)+'" placeholder="'+(c.auto?c.auto.toFixed(2):'Ex. 1800')+'" oninput="planIn(this)">'
 +'<small class="pl-hint">'+(c.auto?'Laisse vide pour utiliser tes revenus fixes ('+eur(c.auto)+').':'Tape ton revenu, ou ajoute ton salaire en revenu fixe dans Budget.')+'</small>'
 +'<div class="pl-box"><div class="pl-l"><span>Revenu</span><b data-pl="rev">'+eur(c.rev)+'</b></div><div class="pl-l"><span>Charges fixes</span><b>− '+eur(c.ch)+'</b></div><small>dépenses fixes '+eur(c.fx)+' · crédits '+eur(c.cr)+' · abonnements '+eur(c.ab)+' · quotidien '+eur(c.qu)+'</small><div class="pl-l pl-big"><span>Reste à répartir</span><b data-pl="reste" class="'+(c.reste>=0?'pos':'neg')+'">'+eur(c.reste)+'</b></div></div>'
 +PK.map(k=>'<div class="pl-c"><div class="pl-l"><span>'+PL[k][0]+' '+PL[k][1]+'</span><b data-pl="a-'+k+'">'+eur(c.amt(k))+'</b></div><div class="pl-l" style="margin-top:6px"><span class="pl-pct"><input type="number" inputmode="decimal" min="0" max="100" step="1" data-pk="'+k+'" value="'+esc(p[k]==null?0:p[k])+'" oninput="planIn(this)" aria-label="Pourcentage '+PL[k][1]+'"> %</span><div class="bar" style="flex:1;margin:0 0 0 10px"><i data-plw="'+k+'" style="width:'+Math.min(100,+p[k]||0)+'%"></i></div></div></div>').join('')
 +'<small data-pl="sum" class="pl-sum">'+sumMsg(c)+'</small><small class="pl-hint">Calculé sur le mois en cours, par mois. Les pourcentages sont les tiens : c’est un outil de répartition, pas un conseil financier.</small>'}
function planUpd(){const c=planCalc();document.querySelectorAll('[data-pl]').forEach(e=>{const k=e.dataset.pl;if(k=='rev')e.textContent=eur(c.rev);else if(k=='reste'){e.textContent=eur(c.reste);e.className=c.reste>=0?'pos':'neg'}else if(k=='sum')e.textContent=sumMsg(c);else if(k.slice(0,2)=='a-')e.textContent=eur(c.amt(k.slice(2)))});document.querySelectorAll('[data-plw]').forEach(e=>e.style.width=Math.min(100,+S.plan.p[e.dataset.plw]||0)+'%')}
function planIn(el){const inc=el.classList.contains('pl-inc');if(inc)S.plan.inc=el.value;else S.plan.p[el.dataset.pk]=el.value===''?0:Math.max(0,+el.value);document.querySelectorAll(inc?'.pl-inc':'[data-pk="'+el.dataset.pk+'"]').forEach(x=>{if(x!==el)x.value=el.value});planUpd();clearTimeout(PT);PT=setTimeout(save,600)}
function planRender(){const p=$('#pl');if(p&&!p.contains(document.activeElement))p.innerHTML=planHTML()}
function planF(){sheet(planHTML())}
function planAmt(k){return Math.round(planCalc().amt(k))}
// Salaire et prévision « jusqu'au prochain salaire »
const salRec=()=>S.rec.find(r=>r.sal&&(!r.end||r.end>=TD));
function payAround(r){let y=+TD.slice(0,4),m=+TD.slice(5,7)-1,last=null,nxt=null;for(let k=-2;k<3;k++){let Y=y,M=m+k;while(M<0){M+=12;Y--}while(M>11){M-=12;Y++}const o=recOcc(r,Y,M);if(!o)continue;if(o.date<=TD)last=o.date;else if(!nxt)nxt=o.date}return {last,nxt}}
const dayAdd=(s,n)=>{const d=P(s);d.setDate(d.getDate()+n);return iso(d)},daysBetween=(a,b)=>Math.round((P(b)-P(a))/864e5);
function quotUndated(){return S.items.filter(i=>i.type=='travail'&&!i.date&&+i.amt>0&&repMonths(i.rep)).reduce((a,i)=>a+(+i.amt)/repMonths(i.rep),0)}
function forecast(){const r=salRec();if(!r)return null;const {last,nxt}=payAround(r);if(!nxt)return null;
 const cyc=last?daysBetween(last,nxt):30,D=daysBetween(TD,nxt),qd=quotUndated()/Math.max(cyc,1),B=balNow();
 let bal=B||0,low=bal,lowDay=TD,prev=TD,need=0;
 for(let k=1;k<D;k++){const d=dayAdd(TD,k),f=flowBetween(prev,d)+S.tx.filter(t=>t.date==d&&(!S.bal||txAfter(t))).reduce((a,t)=>a+t.amt,0)-qd;bal+=f;need-=f;prev=d;if(bal<low){low=bal;lowDay=d}}
 need+=qd; bal-=qd; // aujourd'hui compte aussi pour le budget du quotidien
 return {r,nxt,D,B,before:bal,low:Math.min(low,bal),lowDay:bal<low?dayAdd(nxt,-1):lowDay,need,qd,days:Math.max(D,1)}}
function fcCard(){const r=salRec();
 if(!r)return '<div class="card fc" role="button" tabindex="0" style="cursor:pointer" onclick="salF()"><b>💼 Mon salaire</b><small>Touche ici pour indiquer ton salaire et le jour où tu le reçois : l’appli te dira si tu tiens jusqu’au prochain.</small></div>';
 const f=forecast(),hd='<div class="pl-l"><b>💼 Salaire : '+eur(r.amt)+' le '+r.day+' du mois</b><button class="pill" style="border:0;cursor:pointer" onclick="salF()">Modifier</button></div>';
 if(!f)return '<div class="card fc">'+hd+'</div>';
 const when=dl(f.nxt)+' ('+inj(f.D).toLowerCase()+')';
 let body;
 if(f.B===null)body='<p>Prochain salaire : <b>'+when+'</b></p><p>D’ici là, tes dépenses prévues : <b>'+eur(Math.max(0,f.need))+'</b>.</p><p><a href="#" onclick="balF();return false">Définis ton solde actuel</a> pour savoir si ça passe.</p>';
 else if(f.before>=0)body='<p>Prochain salaire : <b>'+when+'</b></p><p>Il te restera environ <b class="pos">'+eur(f.before)+'</b> la veille.</p>'+(f.low<f.before-0.5?'<p>Point le plus bas : <b>'+eur(f.low)+'</b> le '+dl(f.lowDay)+'</p>':'')+'<p>Tu peux dépenser environ <b>'+eur(f.before/f.days)+' par jour</b> en plus de ce qui est prévu.</p>';
 else body='<p>Prochain salaire : <b>'+when+'</b></p><p class="neg"><b>⚠️ Il te manquera environ '+eur(-f.before)+'</b> avant ce salaire.</p>'+(f.low<0?'<p>Ton solde passerait sous zéro vers le <b>'+dl(dayAddFirstNeg(f))+'</b></p>':'')+'<p>Pense à décaler une dépense ou à puiser dans « En cas de pépin ».</p>';
 return '<div class="card fc">'+hd+body+'<small>Compte ton solde, tes revenus et dépenses fixes, crédits, abonnements, dépenses à venir et ton budget du quotidien au prorata des jours.</small></div>'}
function dayAddFirstNeg(f){let bal=f.B||0,prev=TD;for(let k=1;k<f.D;k++){const d=dayAdd(TD,k);bal+=flowBetween(prev,d)+S.tx.filter(t=>t.date==d&&(!S.bal||txAfter(t))).reduce((a,t)=>a+t.amt,0)-f.qd;prev=d;if(bal<0)return d}return dayAdd(f.nxt,-1)}
function salF(){const r=salRec();let days='';for(let i=1;i<=31;i++)days+='<option value="'+i+'"'+((r?r.day:1)==i?' selected':'')+'>le '+i+'</option>';
 sheet('<h2 style="margin-top:0">Mon salaire</h2><label>Montant net reçu (€)</label><input id="s_a" type="number" inputmode="decimal" step="0.01" value="'+(r?r.amt:'')+'" placeholder="Ex. 1800"><label>Je le reçois chaque mois</label><select id="s_d">'+days+'</select><small style="color:var(--mu);font-size:12px;display:block;margin-top:6px">Si le jour n’existe pas dans un mois (31…), c’est le dernier jour du mois. Le salaire est ajouté à tes revenus fixes et à « Mon budget du mois ».</small><button class="go" onclick="saveSal()">Enregistrer</button>'+(r?'<button class="go" style="background:var(--ln);color:var(--ink);margin-top:8px" onclick="stopSal()">Je ne reçois plus ce salaire</button>':''))}
function saveSal(){const a=parseFloat($('#s_a').value),day=+$('#s_d').value;if(!(a>0)){alert('Indique le montant de ton salaire.');return}
 const y=+TD.slice(0,4),m=+TD.slice(5,7)-1;let st=y+'-'+pad(m+1)+'-'+pad(Math.min(day,dim(y,m)));if(st>TD){const Y=m?y:y-1,M=m?m-1:11;st=Y+'-'+pad(M+1)+'-'+pad(Math.min(day,dim(Y,M)))}
 const r=salRec();if(r){r.amt=a;r.day=day;if(st<r.start)r.start=st}else S.rec.push({id:uid(),sal:1,label:'Salaire',amt:a,cat:'Revenu',day,start:st});save();closeF();render()}
function stopSal(){const r=salRec();if(r&&confirm('Arrêter ce salaire ? Les mois passés restent dans l’historique.')){r.end=TD;save();closeF();render()}}
function render(){
 const t=S.tab;$('#app').innerHTML=t=='home'?home():t=='ag'?agenda():t=='bu'?budget():t=='de'?dettes():rappels();
 $('#nav').innerHTML=[['home','🏠','Accueil'],['ag','📅','Agenda'],['bu','💶','Budget'],['de','💳','Dettes'],['re','⏳','Échéances']].map(a=>'<button class="'+(t==a[0]?'on':'')+'" onclick="S.tab=\''+a[0]+'\';render();scrollTo(0,0)"><span>'+a[1]+'</span>'+a[2]+'</button>').join('');noteSync();planRender()}
function $(s){return document.querySelector(s)}
function mv(k,d){let m=S[k+'m']+d,y=S[k+'y'];if(m<0){m=11;y--}if(m>11){m=0;y++}S[k+'m']=m;S[k+'y']=y;render()}
function delIt(id){if(confirm('Supprimer cet élément ?')){S.items=S.items.filter(i=>i.id!=id);save();render()}}
function delTx(id){S.tx=S.tx.filter(i=>i.id!=id);save();render()}
let F={};
function seg(k,opts,cur){return '<div class="seg">'+opts.map(o=>'<button type="button" class="'+(cur==o[0]?'on':'')+'" onclick="F.'+k+'=\''+o[0]+'\';showForm()">'+o[1]+'</button>').join('')+'</div>'}
function openForm(){$('#sh').innerHTML='';F=S.tab=='de'?{k:'debt',dm:'debt',dir:'owe',rep:'monthly'}:S.tab=='bu'?{k:'tx',kind:'out',freq:'once'}:{k:'it',type:S.tab=='re'?'renouv':'rdv',rep:'none'};showForm()}
function annivSel(d){const dd=+(F.dd||d.slice(8)),mm=F.mm||d.slice(5,7);let a='',b='';for(let i=1;i<=31;i++)a+='<option value="'+i+'"'+(i==dd?' selected':'')+'>'+i+'</option>';MO.forEach((n,i)=>{const v=pad(i+1);b+='<option value="'+v+'"'+(v==mm?' selected':'')+'>'+n+'</option>'});return '<div style="display:flex;gap:8px"><select id="f_dd" aria-label="Jour" style="flex:1">'+a+'</select><select id="f_mm" aria-label="Mois" style="flex:2">'+b+'</select></div><small style="color:var(--mu);font-size:12px;display:block;margin-top:4px">Rappelé chaque année, pas besoin de l’année.</small>'}
function showForm(){
 const v=id=>($('#'+id)||{}).value;if($('#f_t'))F.t=v('f_t'),F.d=v('f_d'),F.a=v('f_a'),F.n=v('f_n'),F.c=v('f_c'),F.l=v('f_l'),F.tot=v('f_tot'),F.dd=v('f_dd')||F.dd,F.mm=v('f_mm')||F.mm,F.cap=v('f_cap')??F.cap,F.rate=v('f_rate')??F.rate,F.dur=v('f_dur')??F.dur,F.dfm=v('f_dfm')??F.dfm,F.ins=v('f_ins')??F.ins;
 const d=F.d||(S.tab=='ag'?S.sel:TD);let h;
 if(S.tab=='de'){F.dm=F.dm||'debt';if(F.dm=='debt')F.k='debt';else{F.k='it';F.type=F.dm}}if(F.k=='it'&&isInst(F))F.rep='monthly';if(F.k=='it'&&F.type=='anniv'){F.rep='yearly';F._a=1}else if(F._a){F.rep='none';F._a=0}if(F.k=='it'&&F.type=='travail'){if(!F._q&&!F.edit){F.rep='monthly';F.d=''}F._q=1}else if(F._q){F.rep='none';F._q=0}
 const top=S.tab=='de'?seg('dm',[['debt','💸 Dette'],['credit','🏦 Crédit'],['fois','🧾 En plusieurs fois']],F.dm):'';
 if(F.k=='debt'){h='<h2 style="margin-top:0">Nouvelle dette</h2>'+top+'<div style="height:8px"></div>'+seg('dir',[['owe','Je dois'],['owed','On me doit']],F.dir)+'<label>'+(F.dir=='owe'?'À qui ?':'Qui te doit ?')+'</label><input id="f_t" value="'+esc(F.t||'')+'" placeholder="Ex. Thomas">'+'<label>Montant total (€)</label><input id="f_a" type="number" inputmode="decimal" step="0.01" value="'+esc(F.a||'')+'">'+'<label>Date limite (facultatif)</label><input id="f_d" type="date" value="'+esc(F.d||'')+'">'+'<label>Note (facultatif)</label><input id="f_n" value="'+esc(F.n||'')+'">'}
 else if(F.k=='tx'){h='<h2 style="margin-top:0">Nouveau mouvement</h2>'+seg('kind',[['out','Dépense'],['in','Revenu']],F.kind)+'<div style="height:8px"></div>'+seg('freq',[['once','Occasionnelle (une fois)'],['month','Fixe (chaque mois)']],F.freq)
  +'<label>Libellé</label><input id="f_t" value="'+esc(F.t||'')+'" placeholder="'+(F.freq=='month'?(F.kind=='in'?'Ex. Salaire':'Ex. Loyer'):(F.kind=='in'?'Ex. Vente Vinted':'Ex. Réparation voiture'))+'"><label>Montant (€)</label><input id="f_a" type="number" inputmode="decimal" step="0.01" value="'+esc(F.a||'')+'"><label>'+(F.freq=='month'?'Date du premier paiement':'Date')+'</label><input id="f_d" type="date" value="'+d+'">'
  +'<small style="color:var(--mu);font-size:12px;display:block;margin-top:4px">'+(F.freq=='month'?'Répété automatiquement le même jour chaque mois, jusqu’à ce que tu l’arrêtes.':'Une date future est possible : la dépense est alors comptée dans la fin du mois prévue.')+'</small>'
  +'<label>Catégorie</label><select id="f_c">'+CATS.map(c=>'<option'+(F.c==c?' selected':'')+'>'+c+'</option>').join('')+'</select>'}
 else{h=(S.tab=='de'?'<h2 style="margin-top:0">'+(F.type=='fois'?'Nouveau paiement en plusieurs fois':'Nouveau crédit')+'</h2>'+top:'<h2 style="margin-top:0">Nouvel élément</h2>'+seg('type',Object.entries(TY).map(e=>[e[0],e[1][2]+' '+e[1][0]]),F.type))
  +'<label>Titre</label><input id="f_t" value="'+esc(F.t||'')+'" placeholder="'+(F.type=='renouv'?'Ex. Carte d’identité':F.type=='anniv'?'Ex. Anniversaire de Léa':F.type=='travail'?'Ex. Courses du mois, Loyer':F.type=='abo'?'Ex. Netflix':F.type=='credit'?'Ex. Crédit auto':F.type=='fois'?'Ex. Télé en 4 fois (Klarna)':'Ex. Dentiste')+'">'
  +'<label>'+(F.type=='renouv'?'Date d’expiration':F.type=='abo'?'Date du prochain paiement':F.type=='credit'?(F.cm=='stu'&&(F.def||'p')!='n'?'Date de début du prêt (1er mois du différé)':'Date du 1er prélèvement'):F.type=='fois'?'Date de la 1re échéance':F.type=='anniv'?'Jour et mois':F.type=='travail'?'Date (facultatif)':'Date')+'</label>'+(F.type=='anniv'?annivSel(d):F.type=='travail'?'<input id="f_d" type="date" value="'+esc(F.d||'')+'"><small style="color:var(--mu);font-size:12px;display:block;margin-top:4px">Sans date : compté comme budget du mois (charges de « Mon budget du mois »). Avec une date : apparaît aussi dans l’agenda et est déduit de ton solde ce jour-là.</small>':'<input id="f_d" type="date" value="'+d+'">')+(F.type=='fois'?'<small style="color:var(--mu);font-size:12px;display:block;margin-top:4px">Souvent le jour de l’achat. Les échéances suivantes tombent le même jour chaque mois ; celles déjà passées sont déduites.</small>':F.type=='credit'&&F.cm=='stu'?'<small style="color:var(--mu);font-size:12px;display:block;margin-top:4px">Prêt déjà commencé ? Mets sa vraie date de début : les mois déjà passés sont déduits automatiquement.</small>':F.type=='credit'?'<small style="color:var(--mu);font-size:12px;display:block;margin-top:4px">Crédit déjà commencé ? Mets la date du tout premier prélèvement : les mensualités passées sont déduites automatiquement.</small>':F.type=='anniv'?'':'<label>Répétition</label>'+seg('rep',Object.entries(RP),F.rep))
  +(F.type=='fois'?'<label>Montant total de l’achat (€)</label><input id="f_tot" type="number" inputmode="decimal" step="0.01" value="'+esc(F.tot||'')+'"><label>Nombre d’échéances</label>'+seg('nb',[['2','2 fois'],['3','3 fois'],['4','4 fois'],['10','10 fois']],F.nb||'3').replace('class="seg"','class="seg seg4"')+'<input id="f_nb" type="number" inputmode="numeric" min="2" max="60" value="'+esc(F.nb||'3')+'" oninput="F.nb=this.value" style="margin-top:6px" aria-label="Autre nombre d’échéances"><small style="color:var(--mu);font-size:12px;display:block;margin-top:4px">Ou tape un autre nombre (de 2 à 60).</small>':'')+(F.type=='credit'?credFields():'')+(F.type=='travail'?'<label>Montant (€)</label><input id="f_a" type="number" inputmode="decimal" step="0.01" value="'+esc(F.a||'')+'" placeholder="Ex. 300">':'')+(F.type=='abo'||F.type=='renouv'?'<label>Montant (€, facultatif)</label><input id="f_a" type="number" inputmode="decimal" step="0.01" value="'+esc(F.a||'')+'">':'')
  +'<label>Note (facultatif)</label><input id="f_n" value="'+esc(F.n||'')+'">'+(F.type=='abo'?'':'<label>Me prévenir (jours avant)</label><input id="f_l" type="number" inputmode="numeric" value="'+esc(F.l||'')+'" placeholder="'+({renouv:30,credit:3,fois:3}[F.type]||2)+'">')}
 if(F.edit)h=h.replace(/(<h2[^>]*>)[^<]*/,'$1Modifier');$('#sh').innerHTML=h+'<button class="go" onclick="submitF()">'+(F.edit?'Enregistrer les modifications':'Enregistrer')+'</button>';if($('#prev'))credPrev();$('#m').classList.add('on')}
function closeF(){$('#m').classList.remove('on')}
function put(arr,o){const i=arr.findIndex(x=>x.id==o.id);if(i>=0)arr[i]=o;else arr.push(o)}
function openEdit(k,id){if(k=='rec'){const r0=S.rec.find(x=>x.id==id);if(r0&&r0.sal)return salF()}$('#sh').innerHTML='';let o;const st=x=>x==null?'':String(x);
 if(k=='it'){o=S.items.find(x=>x.id==id);if(!o)return;F={k:'it',edit:id,type:o.type,t:o.title,d:o.date,rep:o.rep,a:st(o.amt),n:o.note||'',l:st(o.lead)};
  if(o.type=='anniv'){F.dd=String(+o.date.slice(8));F.mm=o.date.slice(5,7);F._a=1}
  if(o.type=='credit'){if(o.stu){F.cm='stu';F.cap=st(o.cap);F.rate=st(o.rate);F.dur=st(o.n);F.def=o.def;F.dfm=st(o.dfm);F.ins=o.ins?st(o.ins):''}else if(o.cap){F.cm='rate';F.cap=st(o.cap);F.rate=st(o.rate);F.dur=st(o.n)}else{F.cm='known';F.tot=st(o.total)}}
  if(o.type=='fois'){F.tot=st(o.total);F.nb=st(o.n)}
  if(S.tab=='de')F.dm=o.type}
 else if(k=='debt'){o=S.debts.find(x=>x.id==id);if(!o)return;F={k:'debt',dm:'debt',edit:id,dir:o.dir,t:o.who,a:st(o.amt),d:o.due||'',n:o.note||''}}
 else{o=(k=='rec'?S.rec:S.tx).find(x=>x.id==id);if(!o)return;F={k:'tx',edit:id,kind:o.amt>0?'in':'out',freq:k=='rec'?'month':'once',t:o.label,a:st(Math.abs(o.amt)),d:k=='rec'?o.start:o.date,c:o.cat,ct:o.ct,end:o.end}}
 showForm()}
function submitF(){
 const an=F.k=='it'&&F.type=='anniv',t=$('#f_t').value.trim(),d=an?'2000-'+$('#f_mm').value+'-'+pad(+$('#f_dd').value):$('#f_d').value,a=$('#f_a')?parseFloat($('#f_a').value):NaN;
 if(F.k=='debt'){if(!t){alert('Indique un nom.');return}if(!(a>0)){alert('Indique un montant positif.');return}put(S.debts,{id:F.edit||uid(),who:t,dir:F.dir,amt:a,due:d,note:$('#f_n').value.trim(),pays:F.edit?((S.debts.find(x=>x.id==F.edit)||{}).pays||[]):[]})}
 else{const noDate=F.k=='it'&&F.type=='travail';if(!t||(!d&&!noDate)){alert(noDate?'Indique un titre.':'Indique un titre et une date.');return}if(noDate&&!(a>0)){alert('Indique un montant.');return}if(an&&+d.slice(8)>dim(2000,+d.slice(5,7)-1)){alert('Ce jour n’existe pas dans ce mois.');return}
 if(F.k=='tx'){if(isNaN(a)||a<=0){alert('Indique un montant positif.');return}const am=F.kind=='in'?a:-a,ca=F.kind=='in'?'Revenu':$('#f_c').value;if(F.edit){S.tx=S.tx.filter(x=>x.id!=F.edit);S.rec=S.rec.filter(x=>x.id!=F.edit)}const nid=F.edit||uid();if(F.freq=='month')S.rec.push(Object.assign({id:nid,label:t,amt:am,cat:ca,day:+d.slice(8),start:d},F.end?{end:F.end}:{}));else S.tx.push({id:nid,label:t,date:d,amt:am,cat:ca,ct:F.ct||Date.now()});S.by=+d.slice(0,4);S.bm=+d.slice(5,7)-1}
 else{const it={id:F.edit||uid(),type:F.type,title:t,date:d,rep:F.rep,amt:isNaN(a)?'':a,note:$('#f_n').value.trim(),lead:$('#f_l')?$('#f_l').value:''};
  if(F.type=='credit'&&F.cm=='stu'){const v=stuVals();if(!(v.C>0)){alert('Indique le montant emprunté.');return}if(!(v.r>=0&&v.r<100)){alert('Indique un taux entre 0 et 100 %.');return}if(v.def!='n'&&!(v.dfm>=1&&v.dfm<=120)){alert('Indique une durée de différé entre 1 et 120 mois.');return}if(!(v.n>=1&&v.n<=600)){alert('Indique une durée de remboursement entre 1 et 600 mois.');return}const k=stuCalc(v.C,v.r,v.n,v.def,v.dfm,v.ins);Object.assign(it,{stu:1,cap:v.C,rate:v.r,n:v.n,def:v.def,dfm:k.D,ins:v.ins,dpay:k.dPay,amt:Math.round((k.M+v.ins)*100)/100,total:k.total,rep:'monthly'})}
  else if(F.type=='credit'&&F.cm!='known'){const C=parseFloat($('#f_cap').value),r=parseFloat(($('#f_rate').value||'0').replace(',','.')),n=parseInt($('#f_dur').value,10);if(!(C>0)){alert('Indique le montant emprunté.');return}if(!(r>=0&&r<100)){alert('Indique un taux entre 0 et 100 %.');return}if(!(n>=1&&n<=600)){alert('Indique une durée entre 1 et 600 mois.');return}const M=mensu(C,r,n);it.amt=Math.round(M*100)/100;it.n=n;it.total=Math.round(M*n*100)/100;it.cap=C;it.rate=r;it.rep='monthly'}
  else if(F.type=='credit'){const tot=parseFloat($('#f_tot').value);if(!(a>0)||!(tot>0)){alert('Indique la mensualité et le montant total.');return}if(tot<a){alert('Le montant total doit être au moins égal à la mensualité.');return}it.rep='monthly';it.total=tot}
  if(F.type=='fois'){const tot=parseFloat($('#f_tot').value),nb=parseInt($('#f_nb').value,10);if(!(tot>0)){alert('Indique le montant total de l’achat.');return}if(!(nb>=2&&nb<=60)){alert('Indique un nombre d’échéances entre 2 et 60.');return}it.rep='monthly';it.total=tot;it.n=nb;it.amt=Math.round(tot/nb*100)/100}
  put(S.items,it)}}
 save();closeF();render()}
const catBar=c=>{const cap=+S.bud[c[0]]||0,over=cap&&c[1]>cap;return '<div style="margin:8px 0"><div style="display:flex;justify-content:space-between;font-size:14px"><span>'+c[0]+'</span><b class="'+(over?'neg':'')+'">'+eur(c[1])+(cap?' / '+eur(cap):'')+'</b></div><div class="bar"><i style="width:'+Math.min(100,Math.round(c[1]/(cap||1)*100))+'%;'+(over?'background:var(--rd)':'')+'"></i></div></div>'};
function alerts(){const l=S.items.filter(i=>i.type!='abo'&&i.date).map(i=>({i,s:next(i)})).filter(o=>{const n=diff(o.s),d=o.i.lead!==undefined&&o.i.lead!==''?+o.i.lead:({renouv:30,abo:7,credit:3,fois:3}[o.i.type]||2);return n>=0&&n<=d}).sort((a,b)=>a.s<b.s?-1:1);const dd=S.debts.filter(x=>x.due&&dLeft(x)>0&&diff(x.due)<=7);return l.length||dd.length?'<div class="card" style="border-color:var(--rd);margin-bottom:6px">'+l.map(o=>itemRow(o.i,o.s)).join('')+dd.map(x=>debtRow(x)).join('')+'</div>':''}
function sheet(h){$('#sh').innerHTML=h+'';$('#m').classList.add('on')}
function cap(){sheet('<h2 style="margin-top:0">Plafonds mensuels (€)</h2>'+CATS.map((c,i)=>'<label>'+c+'</label><input id="cp'+i+'" type="number" inputmode="decimal" value="'+(S.bud[c]||'')+'" placeholder="Aucun">').join('')+'<button class="go" onclick="saveCap()">Enregistrer</button>')}
function saveCap(){CATS.forEach((c,i)=>{const v=parseFloat($('#cp'+i).value);if(v>0)S.bud[c]=v;else delete S.bud[c]});save();closeF();render()}
function bk(){sheet('<h2 style="margin-top:0">Sauvegarde</h2><label>Tes données (à garder dans un fichier de ton dépôt privé)</label><textarea id="bk" rows="5" readonly>'+esc(JSON.stringify(snap()))+'</textarea><button class="go" onclick="cp()">Copier</button><button class="go" style="margin-top:8px" onclick="dlf()">Télécharger le fichier</button><label>Importer (colle une sauvegarde)</label><textarea id="im" rows="4"></textarea><button class="go" onclick="imp()">Importer et remplacer</button>')}
async function cp(){try{await navigator.clipboard.writeText($('#bk').value);alert('Copié.')}catch(e){$('#bk').select()}}
function imp(){try{const o=JSON.parse($('#im').value);if(!Array.isArray(o.items)||!Array.isArray(o.tx))throw 0;if(!confirm('Remplacer tes données actuelles ?'))return;apply(o);save();closeF();render()}catch(e){alert('Sauvegarde invalide.')}}
function dlf(){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([$('#bk').value],{type:'application/json'}));a.download='agenda-sauvegarde.json';a.click()}
function credMonthly(){return S.items.filter(i=>isInst(i)&&credLeft(i)>0).reduce((a,i)=>a+(i.stu?payAt(i,credPaid(i)):+i.amt||0),0)}
function mensu(C,r,n){const i=r/1200;return i?C*i/(1-Math.pow(1+i,-n)):C/n}
function credFields(){const cm=F.cm||'rate',inp=(id,lab,val,ph,ex)=>'<label>'+lab+'</label><input id="'+id+'" type="number" inputmode="decimal" step="'+(ex||'0.01')+'" value="'+esc(val==null?'':val)+'" placeholder="'+ph+'" oninput="credPrev()">';
 return '<label>Comment veux-tu le saisir ?</label>'+seg('cm',[['rate','Avec le taux'],['stu','🎓 Prêt étudiant'],['known','Je connais ma mensualité']],cm)
 +(cm=='stu'?stuFields(inp):cm=='rate'?inp('f_cap','Montant emprunté (€)',F.cap,'Ex. 16000')+inp('f_rate','Taux annuel (%)',F.rate,'Ex. 4,5 (0 si sans intérêts)')+inp('f_dur','Durée (en mois)',F.dur,'Ex. 60 pour 5 ans','1')
   +'<div id="prev" class="card" style="margin-top:12px;padding:12px 14px;font-size:14px;line-height:1.5"></div>'
  :'<label>Mensualité (€)</label><input id="f_a" type="number" inputmode="decimal" step="0.01" value="'+esc(F.a||'')+'"><label>Montant total à rembourser (€)</label><input id="f_tot" type="number" inputmode="decimal" step="0.01" value="'+esc(F.tot||'')+'">')}
function credPrev(){const e=$('#prev');if(!e)return;if(F.cm=='stu')return stuPrev(e);const C=parseFloat($('#f_cap').value),r=parseFloat(($('#f_rate').value||'0').replace(',','.')),n=parseInt($('#f_dur').value,10);
 if(!(C>0)||!(n>=1)||!(r>=0&&r<100)){e.innerHTML='<span style="color:var(--mu)">Remplis le montant, le taux et la durée : la mensualité et le total à rembourser se calculent tout seuls.</span>';return}
 const M=Math.round(mensu(C,r,n)*100)/100,T=Math.round(mensu(C,r,n)*n*100)/100;
 e.innerHTML='Mensualité : <b>'+eur(M)+'</b><br>Total à rembourser : <b>'+eur(T)+'</b><br><span style="color:var(--mu)">dont intérêts : '+eur(T-C)+(n>=12?' · '+(n%12?n+' mois':n/12+' an'+(n>12?'s':'')):'')+'</span>'}
function stuFields(inp){const def=F.def||'p';
 return inp('f_cap','Montant emprunté (€)',F.cap,'Ex. 16000')+inp('f_rate','Taux (TAEG, %)',F.rate,'Ex. 1,5')
 +'<label>Différé (pendant tes études)</label>'+seg('def',[['n','Aucun'],['p','Partiel'],['t','Total']],def)
 +'<small style="color:var(--mu);font-size:12px;display:block;margin-top:4px">'+(def=='p'?'Partiel : tu ne paies que les intérêts (et l’assurance) pendant le différé.':def=='t'?'Total : tu ne paies rien pendant le différé ; les intérêts s’ajoutent au capital, le prêt coûte donc plus cher.':'Tu rembourses dès le premier mois.')+'</small>'
 +(def!='n'?inp('f_dfm','Durée du différé (en mois)',F.dfm,'Ex. 36 pour 3 ans d’études','1'):'')
 +inp('f_dur',def=='n'?'Durée du remboursement (en mois)':'Durée du remboursement après le différé (en mois)',F.dur,'Ex. 60 pour 5 ans','1')
 +inp('f_ins','Assurance (€ par mois, facultatif)',F.ins,'Ex. 4')
 +'<div id="prev" class="card" style="margin-top:12px;padding:12px 14px;font-size:14px;line-height:1.5"></div>'
 +'<div class="card" style="margin-top:10px;padding:10px 14px;font-size:12.5px;line-height:1.5;color:var(--mu)"><b style="color:var(--ink)">Repères des banques (rentrée 2026)</b><br>Taux : de 0 % à environ 3,9 % selon la banque, la région et ton école ; beaucoup d’offres entre 1 % et 2 %.<br>Différé : jusqu’à 5 ans (60 mois) dans plusieurs banques.<br>Prêt garanti par l’État (moins de 28 ans) : jusqu’à 20 000 €, sans caution.<br>Assurance : souvent quelques euros par mois.</div>'}
function stuVals(){const g=id=>{const x=$('#'+id);return x?x.value:''};return {C:parseFloat(g('f_cap')),r:parseFloat((g('f_rate')||'0').replace(',','.')),n:parseInt(g('f_dur'),10),def:F.def||'p',dfm:parseInt(g('f_dfm'),10)||0,ins:parseFloat((g('f_ins')||'0').replace(',','.'))||0}}
function stuPrev(e){const v=stuVals();if(!(v.C>0)||!(v.n>=1)||!(v.r>=0&&v.r<100)||(v.def!='n'&&!(v.dfm>=1))){e.innerHTML='<span style="color:var(--mu)">Remplis le montant, le taux'+(v.def!='n'?', la durée du différé':'')+' et la durée du remboursement : tout se calcule seul.</span>';return}
 const k=stuCalc(v.C,v.r,v.n,v.def,v.dfm,v.ins),intr=k.total-v.C-k.insTot;
 e.innerHTML=(k.D?'Pendant le différé ('+k.D+' mois) : <b>'+(v.def=='p'?eur(k.dPay+v.ins)+'/mois':v.ins?eur(v.ins)+'/mois':'rien à payer')+'</b>'+(v.def=='p'?' <span style="color:var(--mu)">(intérêts'+(v.ins?' + assurance':'')+')</span>':v.ins?' <span style="color:var(--mu)">(assurance)</span>':'')+(v.def=='t'?'<br><span style="color:var(--mu)">intérêts ajoutés au capital : +'+eur(k.base-v.C)+'</span>':'')+'<br>Puis : ':'Mensualité : ')
 +'<b>'+eur(k.M+v.ins)+'/mois</b> pendant '+v.n+' mois<br>Total à rembourser : <b>'+eur(k.total)+'</b><br><span style="color:var(--mu)">dont intérêts : '+eur(intr)+(k.insTot?' · dont assurance : '+eur(k.insTot):'')+'</span>'}
function credRow(c){const it=c.i,done=!c.l;return '<div class="row"'+(done?' style="opacity:.55"':'')+'><span class="dot" style="background:'+TY[it.type][1]+'"></span><div class="t"><b>'+TY[it.type][2]+' '+esc(it.title)+'</b><small>'+(it.stu&&c.k<(+it.dfm||0)?eur(payAt(it,c.k))+'/mois pendant le différé, puis '+eur(+it.amt):eur(+it.amt))+(it.type=='fois'?' par échéance':'/mois')+' · '+(done?(it.type=='fois'?'Payé':'Remboursé'):'reste '+eur(c.l)+' sur '+eur(+it.total))+(it.stu?' · 🎓 prêt étudiant'+(+it.dfm?', différé '+(it.def=='p'?'partiel':'total')+' jusqu’en '+P(addM(it.date,+it.dfm-1)).toLocaleDateString('fr-FR',{month:'short',year:'numeric'}):''):'')+(it.rate!=null&&it.cap?' · emprunté '+eur(+it.cap)+(+it.rate?' à '+String(it.rate).replace('.',',')+' %, dont '+eur(it.total-it.cap-(+it.ins||0)*credN(it))+' d’intérêts'+(+it.ins?' et '+eur((+it.ins)*credN(it))+' d’assurance':''):' sans intérêts'):'')+' · '+c.k+'/'+c.n+(it.type=='fois'?' échéances':' mensualités')+' · fin '+P(credEnd(it)).toLocaleDateString('fr-FR',{month:'short',year:'numeric'})+(it.note?' · '+esc(it.note):'')+'</small><div class="bar"><i style="width:'+Math.round((1-c.l/(+it.total||1))*100)+'%"></i></div></div><button class="x" aria-label="Modifier" onclick="openEdit(\'it\',\''+it.id+'\')">✎</button><button class="x" aria-label="Supprimer" onclick="delIt(\''+it.id+'\')">✕</button></div>'}
function debtRow(d){const l=dLeft(d),own=d.dir=='owe';return '<div class="row"'+(l?'':' style="opacity:.55"')+'><span class="dot" style="background:'+(own?'#e0751f':'#0e9f6e')+'"></span><div class="t"><b>'+(own?'💸 Je dois à ':'🤝 ')+esc(d.who)+(own?'':' me doit')+'</b><small>'+(l?'Reste '+eur(l)+' sur '+eur(+d.amt):'Soldée · '+eur(+d.amt))+(d.due?' · avant le '+dl(d.due):'')+(d.note?' · '+esc(d.note):'')+'</small>'+(l?'<div class="bar"><i style="width:'+Math.round(dPaid(d)/(+d.amt||1)*100)+'%"></i></div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">'+(d.due?pill(diff(d.due)):'')+'<button class="pill" style="border:0;cursor:pointer" onclick="payF(\''+d.id+'\')">'+(own?'Noter un remboursement':'Noter un paiement reçu')+'</button></div>':'')+'</div><button class="x" aria-label="Modifier" onclick="openEdit(\'debt\',\''+d.id+'\')">✎</button><button class="x" aria-label="Supprimer" onclick="delDebt(\''+d.id+'\')">✕</button></div>'}
// Remboursement accéléré (méthode avalanche + effet boule de neige)
function debtList(){const L=[];
 S.items.filter(i=>isInst(i)&&credLeft(i)>0).forEach(i=>{const k=credPaid(i),r=+i.rate||0,j=r/1200;let bal;
  if(i.cap&&r>0){if(i.stu){const d=+i.dfm||0;if(k<d)bal=i.def=='t'?i.cap*Math.pow(1+j,k):+i.cap;else{const base=i.def=='t'?i.cap*Math.pow(1+j,d):+i.cap,m=k-d,M=+i.amt-(+i.ins||0);bal=base*Math.pow(1+j,m)-M*(Math.pow(1+j,m)-1)/j}}
   else{const M=+i.amt;bal=i.cap*Math.pow(1+j,k)-M*(Math.pow(1+j,k)-1)/j}}else bal=credLeft(i);
  L.push({id:i.id,name:i.title,kind:i.type,bal:Math.max(0,bal),rate:r,it:i,k,end:credEnd(i)})});
 S.debts.filter(d=>d.dir=='owe'&&dLeft(d)>0).forEach(d=>L.push({id:d.id,name:d.who,kind:'debt',bal:dLeft(d),rate:0,due:d.due||''}));
 return L}
function minPay(d,t){if(d.kind=='debt')return 0;const it=d.it,j=d.k+t;if(j>=credN(it))return 0;const p=it.stu?payAt(it,j)-(+it.ins||0):+it.amt;return Math.max(0,p)}
function payOrder(L){const soon=d=>d.due&&diff(d.due)<=90?0:1;return [...L].sort((a,b)=>soon(a)-soon(b)||b.rate-a.rate||(a.due||'9999').localeCompare(b.due||'9999')||a.bal-b.bal)}
function simPay(L,E,roll){const B=L.map(d=>d.bal),done=L.map(()=>null),ord=payOrder(L).map(d=>L.indexOf(d));let int=0,t=0;
 for(;t<600;t++){let avail=E;
  L.forEach((d,x)=>{if(B[x]<=0.005){if(roll)avail+=minPay(d,t);return}const i=B[x]*d.rate/1200;B[x]+=i;int+=i;const lastP=d.kind!='debt'&&d.k+t>=credN(d.it)-1,p=lastP?B[x]:Math.min(minPay(d,t),B[x]);B[x]-=p;if(roll&&p<minPay(d,t))avail+=minPay(d,t)-p});
  for(const x of ord){if(avail<=0)break;if(B[x]<=0.005)continue;const v=Math.min(avail,B[x]);B[x]-=v;avail-=v}
  L.forEach((d,x)=>{if(B[x]<=0.005&&done[x]===null){B[x]=0;done[x]=t}});
  if(B.every(b=>b<=0.005))break;
  if(!E&&!roll&&L.every((d,x)=>B[x]<=0.005||d.kind=='debt'))break}
 return {done,int,months:t}}
const monthLbl=t=>P(addM(TD,t)).toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
function payoffCard(){const L=debtList();if(!L.length)return '';
 const sv=S.plan.extra,E=sv!==''&&sv!=null?Math.max(0,+sv||0):0,pep=planAmt('pepin');
 return '<h2>🚀 Rembourser plus vite</h2><div class="card fc"><label style="margin-top:0">Somme en plus chaque mois pour rembourser (€)</label><input id="x_e" type="number" inputmode="decimal" step="1" min="0" value="'+(sv==null?'':esc(sv))+'" placeholder="Ex. 100" oninput="extraIn(this.value)">'
 +'<div class="seg" style="margin-top:8px">'+(pep>0?'<button type="button" onclick="extraSet('+pep+')">🛟 Mon « pépin » ('+eur(pep)+')</button>':'')+[50,100,200].map(v=>'<button type="button" onclick="extraSet('+v+')">'+v+' €</button>').join('')+'</div>'
 +'<div id="x_res">'+payoffRes(L,E)+'</div>'
 +'<small>Méthode « avalanche » : chaque mois, tu paies tes échéances normales, puis tu mets la somme en plus sur la dette au taux le plus élevé (une dette dont la date limite tombe dans les 3 mois passe avant). Quand une dette est soldée, son échéance s’ajoute à la suivante. Avant de rembourser un crédit en avance, préviens ta banque et vérifie les éventuels frais dans ton contrat.</small></div>'}
function payoffRes(L,E){if(!(E>0))return '<p style="color:var(--mu)">Indique une somme : l’appli te dit dans quel ordre rembourser et ce que tu gagnes.</p>';
 const ord=payOrder(L),base=simPay(L,0,false),opt=simPay(L,E,true),ix=d=>L.indexOf(d),ml=d=>P(d).toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
 // date de fin : échéancier réel décalé du gain simulé (crédits) ; mois simulé pour une dette sans échéancier
 const fin=d=>d.kind=='debt'?addM(TD,opt.done[ix(d)]+1):addM(d.end,opt.done[ix(d)]-(base.done[ix(d)]??opt.done[ix(d)]));
 let last='',lastBase='';
 const li=ord.map(d=>{const f=fin(d);if(f>last)last=f;if(d.kind!='debt'&&d.end>lastBase)lastBase=d.end;
  const same=d.kind!='debt'&&f.slice(0,7)==d.end.slice(0,7);
  return '<li><b>'+esc(d.name)+'</b>'+(d.rate?' ('+String(d.rate).replace('.',',')+' %)':'')+' : soldé en <b>'+ml(f)+'</b>'+(d.kind=='debt'?'':same?' (comme prévu)':' au lieu '+(/^[aeiouéh]/i.test(ml(d.end))?'d’':'de ')+ml(d.end))+'</li>'}).join('');
 const gainM=lastBase?mdiff(last,lastBase):0,gainI=Math.max(0,base.int-opt.int);
 return '<p>Ordre conseillé :</p><ol style="margin:4px 0 8px 18px;padding:0">'+li+'</ol><p>Tout est remboursé en <b>'+ml(last)+'</b>'+(gainM>0?', soit <b>'+gainM+' mois plus tôt</b> que tes échéanciers actuels':'')+(gainI>=1?(gainM>0?' et ':', avec ')+'<b>'+eur(gainI)+' d’intérêts économisés</b>':'')+'.</p>'}
let XT=null;
function extraIn(v){S.plan.extra=v;const e=$('#x_res');if(e)e.innerHTML=payoffRes(debtList(),Math.max(0,+v||0));clearTimeout(XT);XT=setTimeout(save,600)}
function extraSet(v){S.plan.extra=String(v);const i=$('#x_e');if(i)i.value=v;extraIn(String(v))}
function dettes(){
 const all=S.items.filter(isInst).map(i=>({i,l:credLeft(i),k:credPaid(i),n:credN(i)})).sort((a,b)=>b.l-a.l),cr=all.filter(c=>c.i.type=='credit'),pf=all.filter(c=>c.i.type=='fois');
 const owe=S.debts.filter(d=>d.dir=='owe').reduce((a,d)=>a+dLeft(d),0),owed=S.debts.filter(d=>d.dir=='owed').reduce((a,d)=>a+dLeft(d),0);
 const tot=all.reduce((a,c)=>a+c.l,0)+owe;
 const ds=[...S.debts].sort((a,b)=>{const x=dLeft(a)>0,y=dLeft(b)>0;if(x!=y)return x?-1:1;return (a.due||'9999')<(b.due||'9999')?-1:1});
 return '<h1>Crédits et dettes</h1><div class="sum"><div class="big"><small>Reste à rembourser au total</small><b class="'+(tot?'neg':'pos')+'">'+eur(tot)+'</b></div><div><small>Prélèvements par mois</small><b>'+eur(credMonthly())+'</b></div><div><small>On te doit</small><b class="pos">'+eur(owed)+'</b></div></div>'
 +payoffCard()+'<h2>Crédits</h2><div class="card">'+(cr.length?cr.map(credRow).join(''):'<div class="empty">Aucun crédit. Appuie sur + puis « Crédit ».</div>')+'</div>'
 +'<h2>Paiements en plusieurs fois</h2><div class="card">'+(pf.length?pf.map(credRow).join(''):'<div class="empty">Aucun paiement en plusieurs fois. Appuie sur + puis « En plusieurs fois ».</div>')+'</div>'
 +'<h2>Dettes et prêts</h2><div class="card">'+(ds.length?ds.map(debtRow).join(''):'<div class="empty">Aucune dette. Appuie sur + pour en ajouter une.</div>')+'</div>'}
function delDebt(id){if(confirm('Supprimer cette dette ?')){S.debts=S.debts.filter(d=>d.id!=id);save();render()}}
function payF(id){const d=S.debts.find(x=>x.id==id);if(!d)return;const own=d.dir=='owe';sheet('<h2 style="margin-top:0">'+(own?'Remboursement à ':'Remboursement de ')+esc(d.who)+'</h2><label>Montant (€)</label><input id="p_a" type="number" inputmode="decimal" step="0.01" value="'+dLeft(d)+'"><label>Date</label><input id="p_d" type="date" value="'+TD+'"><label style="display:flex;gap:8px;align-items:center;margin-top:12px"><input id="p_b" type="checkbox" checked style="width:auto"> Ajouter aussi au budget ('+(own?'dépense':'revenu')+')</label><button class="go" onclick="savePay(\''+id+'\')">Enregistrer</button>')}
function savePay(id){const d=S.debts.find(x=>x.id==id),a=parseFloat($('#p_a').value),dt=$('#p_d').value||TD;if(!d||!(a>0)){alert('Indique un montant positif.');return}const own=d.dir=='owe';d.pays=(d.pays||[]).concat({a:Math.min(a,dLeft(d)),d:dt});if($('#p_b').checked)S.tx.push({id:uid(),ct:Date.now(),label:'Remboursement '+(own?'à ':'de ')+d.who,date:dt,amt:own?-a:a,cat:own?'Dettes':'Revenu'});save();closeF();render()}
$('#fab').onclick=openForm;
render();
