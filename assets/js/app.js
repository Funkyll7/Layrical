/* app.js — état, vues, formulaires. La synchro vit dans sync.js. */
const TY={rdv:['Rendez-vous','#2f6fdb','🗓️'],anniv:['Anniversaire','#d6479a','🎂'],travail:['Travail','#b7791f','💼'],renouv:['Renouvellement','#c8372d','🪪'],abo:['Abonnement','#7a4fd1','🔁'],credit:['Crédit','#0f766e','🏦']};
const CATS=['Logement','Courses','Transport','Loisirs','Santé','Factures','Dettes','Autre'];
const RP={none:'Une seule fois',yearly:'Chaque année',monthly:'Chaque mois'};
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
let S={items:[],tx:[],debts:[],bud:{},ts:0,tab:'home',sel:TD,cy:+TD.slice(0,4),cm:+TD.slice(5,7)-1,by:+TD.slice(0,4),bm:+TD.slice(5,7)-1};
let SYNC='local';const apply=o=>{S.items=o.items||[];S.tx=o.tx||[];S.debts=o.debts||[];S.bud=o.bud||{};S.ts=o.ts||0};try{const r=localStorage.getItem('agenda-perso');if(r)apply(JSON.parse(r))}catch(e){}
const snap=()=>({items:S.items,tx:S.tx,debts:S.debts,bud:S.bud,ts:S.ts});
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
function occ(it,s){if(it.rep=='none')return it.date==s;if(it.date>s)return false;if(it.type=='credit'&&s>credEnd(it))return false;if(it.rep=='yearly')return it.date.slice(5)==s.slice(5);const d=+it.date.slice(8),y=+s.slice(0,4),m=+s.slice(5,7)-1;return +s.slice(8)==Math.min(d,dim(y,m))}
function addM(s,k){const y=+s.slice(0,4),m=+s.slice(5,7)-1+k,d=+s.slice(8),Y=y+Math.floor(m/12),M=((m%12)+12)%12;return Y+'-'+pad(M+1)+'-'+pad(Math.min(d,dim(Y,M)))}
function credN(it){return Math.max(1,Math.ceil((+it.total||0)/(+it.amt||1)))}
function credEnd(it){return addM(it.date,credN(it)-1)}
function credPaid(it){const n=credN(it);let k=0;while(k<n&&addM(it.date,k)<=TD)k++;return k}
function credLeft(it){return Math.max(0,(+it.total||0)-credPaid(it)*(+it.amt||0))}
const dPaid=d=>(d.pays||[]).reduce((a,p)=>a+(+p.a),0);
const dLeft=d=>Math.max(0,(+d.amt)-dPaid(d));
const dueOn=s=>S.debts.filter(d=>d.due==s&&dLeft(d)>0);
function next(it){if(it.rep=='none')return it.date;let d=P(TD);for(let i=0;i<400;i++){const s=iso(d);if(s>=it.date&&occ(it,s))return s;d.setDate(d.getDate()+1)}return it.date}
const on=s=>S.items.filter(i=>occ(i,s));
function pill(n){return '<span class="pill'+(n<0?' d':n<=30?' d':n<=90?' w':'')+'">'+(n<0?'Expiré':inj(n))+'</span>'}
function itemRow(it,s){const t=TY[it.type];return '<div class="row"><span class="dot" style="background:'+t[1]+'"></span><div class="t"><b>'+t[2]+' '+esc(it.title)+'</b><small>'+(s?dl(s)+' · ':'')+t[0]+(it.amt?' · '+eur(+it.amt)+(it.type=='credit'?'/mois':''):'')+(it.note?' · '+esc(it.note):'')+'</small></div>'+(s?pill(diff(s)):'')+'<button class="x" aria-label="Supprimer" onclick="delIt(\''+it.id+'\')">✕</button></div>'}
function holRow(s,n){return '<div class="row"><span class="dot" style="background:#0e9f6e"></span><div class="t"><b>🇫🇷 '+esc(n)+'</b><small>'+dl(s)+' · Jour férié</small></div>'+pill(diff(s))+'</div>'}
function monthTx(y,m){return S.tx.filter(t=>t.date.slice(0,7)==y+'-'+pad(m+1))}
function subMonthly(){return S.items.filter(i=>i.type=='abo'&&i.amt&&i.rep!='none'&&next(i)>=TD).reduce((a,i)=>a+(i.rep=='monthly'?+i.amt:+i.amt/12),0)}
function home(){
 let ev=[];for(let i=0;i<=30;i++){const d=P(TD);d.setDate(d.getDate()+i);const s=iso(d);on(s).forEach(it=>ev.push({s,it}));dueOn(s).forEach(dt=>ev.push({s,dt}));const h=holName(s);if(h)ev.push({s,h})}
 const ren=S.items.filter(i=>(i.type=='renouv'||i.type=='abo'))
  .map(i=>({i,s:next(i)})).filter(o=>diff(o.s)<=60&&diff(o.s)>=0).sort((a,b)=>a.s<b.s?-1:1);
 const tx=monthTx(+TD.slice(0,4),+TD.slice(5,7)-1),inc=tx.filter(t=>t.amt>0).reduce((a,t)=>a+t.amt,0),out=tx.filter(t=>t.amt<0).reduce((a,t)=>a+t.amt,0);
 return '<h1>Bonjour 👋</h1>'+alerts()+'<div class="sum"><div class="big"><small>Solde de '+MO[+TD.slice(5,7)-1]+'</small><b class="'+(inc+out>=0?'pos':'neg')+'">'+eur(inc+out)+'</b></div><div><small>Revenus</small><b>'+eur(inc)+'</b></div><div><small>Dépenses</small><b>'+eur(Math.abs(out))+'</b></div></div>'
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
function budget(){
 const y=S.by,m=S.bm,tx=monthTx(y,m).sort((a,b)=>a.date<b.date?1:-1),inc=tx.filter(t=>t.amt>0).reduce((a,t)=>a+t.amt,0),out=-tx.filter(t=>t.amt<0).reduce((a,t)=>a+t.amt,0);
 const bc={};tx.filter(t=>t.amt<0).forEach(t=>bc[t.cat]=(bc[t.cat]||0)-t.amt);
 CATS.forEach(c=>{if(S.bud[c]&&!(c in bc))bc[c]=0});const cats=Object.entries(bc).sort((a,b)=>b[1]-a[1]);
 return '<h1>Budget</h1><div class="nv"><button onclick="mv(\'b\',-1)" aria-label="Mois précédent">‹</button><b>'+MO[m]+' '+y+'</b><button onclick="mv(\'b\',1)" aria-label="Mois suivant">›</button></div>'
 +'<div class="sum"><div class="big"><small>Reste du mois</small><b class="'+(inc-out>=0?'pos':'neg')+'">'+eur(inc-out)+'</b></div><div><small>Revenus</small><b>'+eur(inc)+'</b></div><div><small>Dépenses</small><b>'+eur(out)+'</b></div></div>'
 +'<p style="color:var(--mu);font-size:14px;margin:10px 2px">Tes abonnements actifs coûtent environ <b style="color:var(--ink)">'+eur(subMonthly())+'</b> par mois.'+(credMonthly()?' Tes crédits en cours : <b style="color:var(--ink)">'+eur(credMonthly())+'</b> par mois.':'')+'</p>'
 +(cats.length?'<h2>Dépenses par catégorie</h2><div class="card" style="padding:10px 14px">'+cats.map(catBar).join('')+'</div>':'')
 +'<button class="go" style="background:var(--acs);color:var(--ac);margin-top:12px" onclick="cap()">Fixer des plafonds par catégorie</button><h2>Mouvements</h2><div class="card">'+(tx.length?tx.map(t=>'<div class="row"><div class="t"><b>'+esc(t.label)+'</b><small>'+dl(t.date)+' · '+t.cat+'</small></div><b class="'+(t.amt>0?'pos':'')+'" style="flex:none">'+(t.amt>0?'+':'')+eur(t.amt)+'</b><button class="x" aria-label="Supprimer" onclick="delTx(\''+t.id+'\')">✕</button></div>').join(''):'<div class="empty">Aucun mouvement. Appuie sur + pour en ajouter.</div>')+'</div>'}
function rappels(){
 const l=S.items.filter(i=>i.type=='renouv'||i.type=='abo').map(i=>({i,s:next(i)})).sort((a,b)=>a.s<b.s?-1:1);
 return '<h1>Échéances</h1><p style="color:var(--mu);margin:-6px 0 6px;font-size:14px">Carte d’identité, passeport, assurances, abonnements : rouge sous 30 jours, orange sous 90.</p><div class="card">'+(l.length?l.map(o=>itemRow(o.i,o.s)).join(''):'<div class="empty">Ajoute un renouvellement ou un abonnement avec +.</div>')+'</div>'}
function render(){
 const t=S.tab;$('#app').innerHTML=t=='home'?home():t=='ag'?agenda():t=='bu'?budget():t=='de'?dettes():rappels();
 $('#nav').innerHTML=[['home','🏠','Accueil'],['ag','📅','Agenda'],['bu','💶','Budget'],['de','💳','Dettes'],['re','⏳','Échéances']].map(a=>'<button class="'+(t==a[0]?'on':'')+'" onclick="S.tab=\''+a[0]+'\';render();scrollTo(0,0)"><span>'+a[1]+'</span>'+a[2]+'</button>').join('')}
function $(s){return document.querySelector(s)}
function mv(k,d){let m=S[k+'m']+d,y=S[k+'y'];if(m<0){m=11;y--}if(m>11){m=0;y++}S[k+'m']=m;S[k+'y']=y;render()}
function delIt(id){if(confirm('Supprimer cet élément ?')){S.items=S.items.filter(i=>i.id!=id);save();render()}}
function delTx(id){S.tx=S.tx.filter(i=>i.id!=id);save();render()}
let F={};
function seg(k,opts,cur){return '<div class="seg">'+opts.map(o=>'<button type="button" class="'+(cur==o[0]?'on':'')+'" onclick="F.'+k+'=\''+o[0]+'\';form()">'+o[1]+'</button>').join('')+'</div>'}
function openForm(){$('#sh').innerHTML='';F=S.tab=='de'?{k:'debt',dir:'owe',type:'credit',rep:'monthly'}:S.tab=='bu'?{k:'tx',kind:'out'}:{k:'it',type:S.tab=='re'?'renouv':'rdv',rep:'none'};form()}
function form(){
 const v=id=>($('#'+id)||{}).value;if($('#f_t'))F.t=v('f_t'),F.d=v('f_d'),F.a=v('f_a'),F.n=v('f_n'),F.c=v('f_c'),F.l=v('f_l'),F.tot=v('f_tot');
 const d=F.d||(S.tab=='ag'?S.sel:TD);let h;
 if(S.tab=='de'&&F.k=='it')F.type='credit';if(F.k=='it'&&F.type=='credit')F.rep='monthly';
 const top=S.tab=='de'?seg('k',[['debt','💸 Dette ou prêt'],['it','🏦 Crédit']],F.k):'';
 if(F.k=='debt'){h='<h2 style="margin-top:0">Nouvelle dette</h2>'+top+'<div style="height:8px"></div>'+seg('dir',[['owe','Je dois'],['owed','On me doit']],F.dir)+'<label>'+(F.dir=='owe'?'À qui ?':'Qui te doit ?')+'</label><input id="f_t" value="'+esc(F.t||'')+'" placeholder="Ex. Thomas">'+'<label>Montant total (€)</label><input id="f_a" type="number" inputmode="decimal" step="0.01" value="'+esc(F.a||'')+'">'+'<label>Date limite (facultatif)</label><input id="f_d" type="date" value="'+esc(F.d||'')+'">'+'<label>Note (facultatif)</label><input id="f_n" value="'+esc(F.n||'')+'">'}
 else if(F.k=='tx'){h='<h2 style="margin-top:0">Nouveau mouvement</h2>'+seg('kind',[['out','Dépense'],['in','Revenu']],F.kind)
  +'<label>Libellé</label><input id="f_t" value="'+esc(F.t||'')+'" placeholder="Ex. Courses"><label>Montant (€)</label><input id="f_a" type="number" inputmode="decimal" step="0.01" value="'+esc(F.a||'')+'"><label>Date</label><input id="f_d" type="date" value="'+d+'">'
  +'<label>Catégorie</label><select id="f_c">'+CATS.map(c=>'<option'+(F.c==c?' selected':'')+'>'+c+'</option>').join('')+'</select>'}
 else{h=(S.tab=='de'?'<h2 style="margin-top:0">Nouveau crédit</h2>'+top:'<h2 style="margin-top:0">Nouvel élément</h2>'+seg('type',Object.entries(TY).map(e=>[e[0],e[1][2]+' '+e[1][0]]),F.type))
  +'<label>Titre</label><input id="f_t" value="'+esc(F.t||'')+'" placeholder="'+(F.type=='renouv'?'Ex. Carte d’identité':F.type=='anniv'?'Ex. Anniversaire de Léa':F.type=='abo'?'Ex. Netflix':F.type=='credit'?'Ex. Crédit auto':'Ex. Dentiste')+'">'
  +'<label>'+(F.type=='renouv'?'Date d’expiration':F.type=='abo'?'Prochain paiement ou date de fin':F.type=='credit'?'Date du 1er prélèvement':'Date')+'</label><input id="f_d" type="date" value="'+d+'">'+(F.type=='credit'?'<small style="color:var(--mu);font-size:12px;display:block;margin-top:4px">Crédit déjà commencé ? Mets la date du tout premier prélèvement : les mensualités passées sont déduites automatiquement.</small>':'<label>Répétition</label>'+seg('rep',Object.entries(RP),F.rep))
  +(F.type=='credit'?'<label>Mensualité (€)</label><input id="f_a" type="number" inputmode="decimal" step="0.01" value="'+esc(F.a||'')+'"><label>Montant total à rembourser (€)</label><input id="f_tot" type="number" inputmode="decimal" step="0.01" value="'+esc(F.tot||'')+'">':'')+(F.type=='abo'||F.type=='renouv'?'<label>Montant (€, facultatif)</label><input id="f_a" type="number" inputmode="decimal" step="0.01" value="'+esc(F.a||'')+'">':'')
  +'<label>Note (facultatif)</label><input id="f_n" value="'+esc(F.n||'')+'"><label>Me prévenir (jours avant)</label><input id="f_l" type="number" inputmode="numeric" value="'+esc(F.l||'')+'" placeholder="'+({renouv:30,abo:7,credit:3}[F.type]||2)+'">'}
 $('#sh').innerHTML=h+'<button class="go" onclick="submitF()">Enregistrer</button><button class="go" style="background:var(--ln);color:var(--ink);margin-top:8px" onclick="closeF()">Annuler</button>';$('#m').classList.add('on')}
function closeF(){$('#m').classList.remove('on')}
function submitF(){
 const t=$('#f_t').value.trim(),d=$('#f_d').value,a=$('#f_a')?parseFloat($('#f_a').value):NaN;
 if(F.k=='debt'){if(!t){alert('Indique un nom.');return}if(!(a>0)){alert('Indique un montant positif.');return}S.debts.push({id:uid(),who:t,dir:F.dir,amt:a,due:d,note:$('#f_n').value.trim(),pays:[]})}
 else{if(!t||!d){alert('Indique un titre et une date.');return}
 if(F.k=='tx'){if(isNaN(a)||a<=0){alert('Indique un montant positif.');return}S.tx.push({id:uid(),label:t,date:d,amt:F.kind=='in'?a:-a,cat:F.kind=='in'?'Revenu':$('#f_c').value});S.by=+d.slice(0,4);S.bm=+d.slice(5,7)-1}
 else{const it={id:uid(),type:F.type,title:t,date:d,rep:F.rep,amt:isNaN(a)?'':a,note:$('#f_n').value.trim(),lead:$('#f_l').value};
  if(F.type=='credit'){const tot=parseFloat($('#f_tot').value);if(!(a>0)||!(tot>0)){alert('Indique la mensualité et le montant total.');return}if(tot<a){alert('Le montant total doit être au moins égal à la mensualité.');return}it.rep='monthly';it.total=tot}
  S.items.push(it)}}
 save();closeF();render()}
const catBar=c=>{const cap=+S.bud[c[0]]||0,over=cap&&c[1]>cap;return '<div style="margin:8px 0"><div style="display:flex;justify-content:space-between;font-size:14px"><span>'+c[0]+'</span><b class="'+(over?'neg':'')+'">'+eur(c[1])+(cap?' / '+eur(cap):'')+'</b></div><div class="bar"><i style="width:'+Math.min(100,Math.round(c[1]/(cap||1)*100))+'%;'+(over?'background:var(--rd)':'')+'"></i></div></div>'};
function alerts(){const l=S.items.map(i=>({i,s:next(i)})).filter(o=>{const n=diff(o.s),d=o.i.lead!==undefined&&o.i.lead!==''?+o.i.lead:({renouv:30,abo:7,credit:3}[o.i.type]||2);return n>=0&&n<=d}).sort((a,b)=>a.s<b.s?-1:1);const dd=S.debts.filter(x=>x.due&&dLeft(x)>0&&diff(x.due)<=7);return l.length||dd.length?'<div class="card" style="border-color:var(--rd);margin-bottom:6px">'+l.map(o=>itemRow(o.i,o.s)).join('')+dd.map(x=>debtRow(x)).join('')+'</div>':''}
function sheet(h){$('#sh').innerHTML=h+'<button class="go" style="background:var(--ln);color:var(--ink);margin-top:8px" onclick="closeF()">Fermer</button>';$('#m').classList.add('on')}
function cap(){sheet('<h2 style="margin-top:0">Plafonds mensuels (€)</h2>'+CATS.map((c,i)=>'<label>'+c+'</label><input id="cp'+i+'" type="number" inputmode="decimal" value="'+(S.bud[c]||'')+'" placeholder="Aucun">').join('')+'<button class="go" onclick="saveCap()">Enregistrer</button>')}
function saveCap(){CATS.forEach((c,i)=>{const v=parseFloat($('#cp'+i).value);if(v>0)S.bud[c]=v;else delete S.bud[c]});save();closeF();render()}
function bk(){sheet('<h2 style="margin-top:0">Sauvegarde</h2><label>Tes données (à garder dans un fichier de ton dépôt privé)</label><textarea id="bk" rows="5" readonly>'+esc(JSON.stringify(snap()))+'</textarea><button class="go" onclick="cp()">Copier</button><button class="go" style="margin-top:8px" onclick="dlf()">Télécharger le fichier</button><label>Importer (colle une sauvegarde)</label><textarea id="im" rows="4"></textarea><button class="go" onclick="imp()">Importer et remplacer</button>')}
async function cp(){try{await navigator.clipboard.writeText($('#bk').value);alert('Copié.')}catch(e){$('#bk').select()}}
function imp(){try{const o=JSON.parse($('#im').value);if(!Array.isArray(o.items)||!Array.isArray(o.tx))throw 0;if(!confirm('Remplacer tes données actuelles ?'))return;apply(o);save();closeF();render()}catch(e){alert('Sauvegarde invalide.')}}
function dlf(){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([$('#bk').value],{type:'application/json'}));a.download='agenda-sauvegarde.json';a.click()}
function credMonthly(){return S.items.filter(i=>i.type=='credit'&&credLeft(i)>0).reduce((a,i)=>a+(+i.amt||0),0)}
function credRow(c){const it=c.i,done=!c.l;return '<div class="row"'+(done?' style="opacity:.55"':'')+'><span class="dot" style="background:'+TY.credit[1]+'"></span><div class="t"><b>🏦 '+esc(it.title)+'</b><small>'+eur(+it.amt)+'/mois · '+(done?'Remboursé':'reste '+eur(c.l)+' sur '+eur(+it.total))+' · '+c.k+'/'+c.n+' mensualités · fin '+P(credEnd(it)).toLocaleDateString('fr-FR',{month:'short',year:'numeric'})+(it.note?' · '+esc(it.note):'')+'</small><div class="bar"><i style="width:'+Math.round((1-c.l/(+it.total||1))*100)+'%"></i></div></div><button class="x" aria-label="Supprimer" onclick="delIt(\''+it.id+'\')">✕</button></div>'}
function debtRow(d){const l=dLeft(d),own=d.dir=='owe';return '<div class="row"'+(l?'':' style="opacity:.55"')+'><span class="dot" style="background:'+(own?'#e0751f':'#0e9f6e')+'"></span><div class="t"><b>'+(own?'💸 Je dois à ':'🤝 ')+esc(d.who)+(own?'':' me doit')+'</b><small>'+(l?'Reste '+eur(l)+' sur '+eur(+d.amt):'Soldée · '+eur(+d.amt))+(d.due?' · avant le '+dl(d.due):'')+(d.note?' · '+esc(d.note):'')+'</small>'+(l?'<div class="bar"><i style="width:'+Math.round(dPaid(d)/(+d.amt||1)*100)+'%"></i></div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">'+(d.due?pill(diff(d.due)):'')+'<button class="pill" style="border:0;cursor:pointer" onclick="payF(\''+d.id+'\')">'+(own?'Noter un remboursement':'Noter un paiement reçu')+'</button></div>':'')+'</div><button class="x" aria-label="Supprimer" onclick="delDebt(\''+d.id+'\')">✕</button></div>'}
function dettes(){
 const cr=S.items.filter(i=>i.type=='credit').map(i=>({i,l:credLeft(i),k:credPaid(i),n:credN(i)})).sort((a,b)=>b.l-a.l);
 const owe=S.debts.filter(d=>d.dir=='owe').reduce((a,d)=>a+dLeft(d),0),owed=S.debts.filter(d=>d.dir=='owed').reduce((a,d)=>a+dLeft(d),0);
 const tot=cr.reduce((a,c)=>a+c.l,0)+owe;
 const ds=[...S.debts].sort((a,b)=>{const x=dLeft(a)>0,y=dLeft(b)>0;if(x!=y)return x?-1:1;return (a.due||'9999')<(b.due||'9999')?-1:1});
 return '<h1>Crédits et dettes</h1><div class="sum"><div class="big"><small>Reste à rembourser au total</small><b class="'+(tot?'neg':'pos')+'">'+eur(tot)+'</b></div><div><small>Mensualités de crédit</small><b>'+eur(credMonthly())+'</b></div><div><small>On te doit</small><b class="pos">'+eur(owed)+'</b></div></div>'
 +'<h2>Crédits</h2><div class="card">'+(cr.length?cr.map(credRow).join(''):'<div class="empty">Aucun crédit. Appuie sur + puis « Crédit ».</div>')+'</div>'
 +'<h2>Dettes et prêts</h2><div class="card">'+(ds.length?ds.map(debtRow).join(''):'<div class="empty">Aucune dette. Appuie sur + pour en ajouter une.</div>')+'</div>'}
function delDebt(id){if(confirm('Supprimer cette dette ?')){S.debts=S.debts.filter(d=>d.id!=id);save();render()}}
function payF(id){const d=S.debts.find(x=>x.id==id);if(!d)return;const own=d.dir=='owe';sheet('<h2 style="margin-top:0">'+(own?'Remboursement à ':'Remboursement de ')+esc(d.who)+'</h2><label>Montant (€)</label><input id="p_a" type="number" inputmode="decimal" step="0.01" value="'+dLeft(d)+'"><label>Date</label><input id="p_d" type="date" value="'+TD+'"><label style="display:flex;gap:8px;align-items:center;margin-top:12px"><input id="p_b" type="checkbox" checked style="width:auto"> Ajouter aussi au budget ('+(own?'dépense':'revenu')+')</label><button class="go" onclick="savePay(\''+id+'\')">Enregistrer</button>')}
function savePay(id){const d=S.debts.find(x=>x.id==id),a=parseFloat($('#p_a').value),dt=$('#p_d').value||TD;if(!d||!(a>0)){alert('Indique un montant positif.');return}const own=d.dir=='owe';d.pays=(d.pays||[]).concat({a:Math.min(a,dLeft(d)),d:dt});if($('#p_b').checked)S.tx.push({id:uid(),label:'Remboursement '+(own?'à ':'de ')+d.who,date:dt,amt:own?-a:a,cat:own?'Dettes':'Revenu'});save();closeF();render()}
$('#fab').onclick=openForm;$('#m').onclick=e=>{if(e.target.id=='m')closeF()};
render();
