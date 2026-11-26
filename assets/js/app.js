/* app.js — état, vues, formulaires. La synchro vit dans sync.js. */
const TY={rdv:['Rendez-vous','#2f6fdb','🗓️'],rappel:['Rappel','#0e7490','🔔'],anniv:['Anniversaire','#d6479a','🎂'],travail:['Quotidien','#b7791f','🛒'],renouv:['Renouvellement','#c8372d','🪪'],abo:['Abonnement','#7a4fd1','🔁'],credit:['Crédit','#0f766e','🏦'],fois:['En plusieurs fois','#b45309','🧾']};
const CATS=['Logement','Courses','Transport','Loisirs','Santé','Factures','Dettes','Imprévu','Autre'];
const RP={none:'Une seule fois',weekly:'Chaque semaine',monthly:'Chaque mois',m2:'Tous les 2 mois',m3:'Tous les 3 mois',m6:'Tous les 6 mois',yearly:'Chaque année'};
const repMonths=r=>r=='weekly'?12/52:r=='monthly'?1:r=='yearly'?12:/^m\d+$/.test(r||'')?+r.slice(1):0;
const MO=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const pad=n=>String(n).padStart(2,'0');
const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const P=s=>{const a=s.split('-');return new Date(+a[0],+a[1]-1,+a[2],12)};
const TD=iso(new Date());
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const eur=n=>n.toLocaleString('fr-FR',{style:'currency',currency:'EUR'});
const dl=s=>P(s).toLocaleDateString('fr-FR',Object.assign({weekday:'short',day:'numeric',month:'short'},s.slice(0,4)!=TD.slice(0,4)?{year:'numeric'}:{}));
const diff=s=>Math.round((P(s)-P(TD))/864e5);
const inj=n=>n==0?"Aujourd’hui":n==1?'Demain':'Dans '+n+' j';
let S={items:[],tx:[],debts:[],rec:[],sav:[],inv:[],subs:[],pushKey:null,notif:{hour:8},bal:null,plan:{inc:'',p:{poche:50,invest:25,pepin:25}},bud:{},ts:0,tab:'home',sel:TD,cy:+TD.slice(0,4),cm:+TD.slice(5,7)-1,by:+TD.slice(0,4),bm:+TD.slice(5,7)-1};
let SYNC='local';const apply=o=>{S.items=o.items||[];S.tx=o.tx||[];S.debts=o.debts||[];S.rec=o.rec||[];S.bal=o.bal||null;S.notes=o.notes||'';S.plan=o.plan||{inc:'',p:{poche:50,invest:25,pepin:25}};S.sav=o.sav||[];S.inv=o.inv||[];S.subs=o.subs||[];S.pushKey=o.pushKey||null;S.notif=o.notif||{hour:8};S.bud=o.bud||{};S.poche=o.poche||{tx:[],round:{on:true,x:1}};S.card=o.card||[];S.contacts=o.contacts||[];S.music=o.music||{url:'',wmode:'resume'};S.ts=o.ts||0};try{const r=localStorage.getItem('agenda-perso');if(r)apply(JSON.parse(r))}catch(e){}
const snap=()=>({items:S.items,tx:S.tx,debts:S.debts,rec:S.rec,bal:S.bal,notes:S.notes||'',plan:S.plan,sav:S.sav,inv:S.inv,subs:S.subs,pushKey:S.pushKey,notif:S.notif,bud:S.bud,poche:S.poche,card:S.card,contacts:S.contacts,music:S.music,ts:S.ts});
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
function occ(it,s){if(it.rep=='none')return it.date==s;if(it.date>s)return false;if(isInst(it)&&s>credEnd(it))return false;if(it.stu&&!payAt(it,mdiff(it.date,s)))return false;if(it.rep=='weekly')return Math.round((P(s)-P(it.date))/864e5)%7==0;if(it.rep=='yearly'){const md=it.date.slice(5);return (md=='02-29'&&dim(+s.slice(0,4),1)==28?'02-28':md)==s.slice(5)}const d=+it.date.slice(8),y=+s.slice(0,4),m=+s.slice(5,7)-1,N=repMonths(it.rep)||1,gap=(y-+it.date.slice(0,4))*12+m-(+it.date.slice(5,7)-1);return gap%N==0&&+s.slice(8)==Math.min(d,dim(y,m))}
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
const isDone=(it,s)=>!!(s&&it.dn&&it.dn.includes(s));
function doneIt(id,s){const it=S.items.find(x=>x.id==id);if(!it||!s)return;const was=isDone(it,s);it.dn=(it.dn||[]).filter(d=>d!=s&&d>=dayAdd(TD,-400));if(!was)it.dn.push(s);if(!it.dn.length)delete it.dn;save();render()}
function itemRow(it,s,nd){const t=TY[it.type],dn=isDone(it,s),inst=isInst(it),a=inst?(s?instAmt(it,s):+it.amt):it.amt===''||it.amt==null?null:+it.amt;
 const rep=it.rep&&it.rep!='none'&&it.type!='anniv'?(RP[it.rep]||'').toLowerCase():'';
 const sub=[s&&!nd?dRel(s):(it.type=='travail'&&!it.date?'sans date':''),it.time,rep,t[0]].filter(Boolean).join(' · ');
 const c=s&&!dn?chipFor(s,it.type=='renouv'):null;
 return L1({cls:dn?'done':'',ic:t[2],t:esc(it.title),s:sub+(dn?' · ✓ fait':''),a:a===null||isNaN(a)?'':a===0&&it.type=='renouv'?'gratuit':a?'−'+eur(a)+(inst||it.type=='abo'?'':''):'',chip:c?c[0]:'',cc:c?c[1]:'',on:"openEdit('it','"+it.id+"')",
  act:it.type=='rappel'&&s?'<button class="x dn'+(dn?' on':'')+'" aria-label="'+(dn?'Marquer comme pas fait':'Marquer comme fait')+'" onclick="'+stop("doneIt('"+it.id+"','"+s+"')")+'">✓</button>':''})}
function holRow(s,n){return L1({ic:'🇫🇷',t:esc(n),s:dRel(s)+' · jour férié'})}
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
function txRow(t){const fut=t.date>TD;return L1({ic:t.amt>0?'💶':(CAT_E[t.cat]||'📦'),t:(t.rec?'🔁 ':'')+esc(t.label),s:dl(t.date)+' · '+t.cat+(t.rec?' · fixe':'')+(fut?' · à venir':''),a:(t.amt>0?'+':'−')+eur(Math.abs(t.amt)),ac:t.amt>0?'pos':'',on:"openEdit('"+(t.rec?'rec':'tx')+"','"+(t.rec?t.rid:t.id)+"')"})}
const appVer=()=>{try{return window.AgendaNative&&AgendaNative.version?'<small class="ver">Appli '+esc(AgendaNative.version())+'</small>':''}catch(e){return ''}};
// ===== Mes adresses : un contact, une adresse, Waze en un geste =====
const CT_EMO=['🏠','👨‍👩‍👧','❤️','👫','💼','🏋️','🩺','✂️','🛒','🎓','⭐'];
const wazeUrl=a=>'https://waze.com/ul?q='+encodeURIComponent(a)+'&navigate=yes';
const gmapsUrl=a=>'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(a);
function contactsCard(){const L=(S.contacts||[]).slice().sort((a,b)=>a.name.localeCompare(b.name,'fr'));
 return '<h2>📍 Mes adresses</h2><div class="ctr">'+L.map(c=>'<button class="cc" onclick="goF(\''+c.id+'\')" aria-label="Aller chez '+esc(c.name)+'"><span>'+(c.emo||'📍')+'</span><b>'+esc(c.name)+'</b></button>').join('')
 +'<button class="cc add" onclick="ctF()" aria-label="Ajouter une adresse"><span>＋</span><b>Ajouter</b></button></div>'}
// 🎵 YouTube Music (appli Android) : ouvre YouTube Music et lance la reprise ou la playlist favorite
const okYtUrl=u=>/^https:\/\/(music\.youtube\.com|(www\.|m\.)?youtube\.com|youtu\.be)\//i.test(u||'');
function musicSync(){try{const m=S.music||{};if(window.AgendaNative&&AgendaNative.musicSet)AgendaNative.musicSet(m.url||'',m.wmode||'resume')}catch(e){}}
function musicF(){const m=S.music||{url:'',wmode:'resume'},has=!!m.url;
 const bub=!!(AgendaNative.bubbleShow),bon=bub&&AgendaNative.bubbleOn();
 sheet('<h2 style="margin-top:0">🎵 Musique</h2><button class="go" style="margin-top:0" onclick="musicGo(\'resume\')">▶ Reprendre ma dernière écoute</button>'
 +(has?'<button class="go" style="background:var(--acs);color:var(--ac)" onclick="musicGo(\'list\')">🎶 Lancer ma playlist</button>':'')
 +(bub?'<h3 class="mu-h">🫧 Bulle de contrôle</h3><small style="color:var(--mu);font-size:12.5px;display:block">Des boutons ⏮ ⏯ ⏭ qui flottent au-dessus de toutes les applis (Waze compris) et pilotent la musique en cours, quelle que soit l’appli. Glisse 🎵 pour la déplacer, touche-la pour ouvrir ou fermer les boutons.</small>'
  +'<button class="go" style="background:var(--ln);color:var(--ink)" onclick="bubToggle()">'+(bon?'Masquer la bulle':'Afficher la bulle')+'</button>'
  +'<label class="pk-r"><input type="checkbox" id="mu_b" '+(m.bub?'checked':'')+'> Afficher la bulle quand je lance la musique ou Waze + musique</label>':'')
 +'<label>Lien de ma playlist favorite</label><input id="mu_u" value="'+esc(m.url||'')+'" placeholder="https://music.youtube.com/playlist?list=…"><small style="color:var(--mu);font-size:12px;display:block;margin-top:4px">Dans YouTube Music : ta playlist → ⋮ → Partager → Copier le lien.</small>'
 +'<label>Le bouton ♫ du widget lance</label><div class="seg" id="mu_w"><button type="button" class="'+(m.wmode!='list'?'on':'')+'" onclick="pkT(this)">Ma dernière écoute</button><button type="button" class="'+(m.wmode=='list'?'on':'')+'" onclick="pkT(this)">Ma playlist</button></div>'
 +'<small style="color:var(--mu);font-size:12px;display:block;margin-top:8px">Sans YouTube Music Premium, la musique ne joue que quand YouTube Music est à l’écran : l’appli l’ouvre donc au premier plan et lance la lecture.</small>'
 +'<button class="go" onclick="musicSave()">Enregistrer</button>')}
function musicGo(k){if(S.music&&S.music.bub&&AgendaNative.bubbleShow)AgendaNative.bubbleShow();AgendaNative.musicPlay(k);closeF()}
function bubToggle(){if(AgendaNative.bubbleOn())AgendaNative.bubbleHide();else if(!AgendaNative.bubbleShow()){alert('Autorise « Agenda » à s’afficher par-dessus les autres applis, puis reviens et touche à nouveau « Afficher la bulle ».');}closeF()}
function musicSave(){const u=$('#mu_u').value.trim(),w=($('#mu_w button.on')||{}).textContent=='Ma playlist'?'list':'resume';if(u&&!okYtUrl(u)){alert('Colle un lien YouTube Music (https://music.youtube.com/…).');return}if(w=='list'&&!u){alert('Ajoute le lien de ta playlist pour que le widget la lance.');return}
 S.music={url:u,wmode:w,bub:!!($('#mu_b')&&$('#mu_b').checked)};save();musicSync();closeF()}
const BankNorm=s=>String(s||'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
// Fenêtre 📍 (barre du haut) : toutes les adresses, défilables, avec recherche
function adrF(){const L=(S.contacts||[]).slice().sort((a,b)=>a.name.localeCompare(b.name,'fr'));
 sheet('<h2 style="margin-top:0">📍 Mes adresses</h2>'+(L.length>5?'<input id="ad_q" placeholder="Chercher un nom ou une adresse…" oninput="adFilter(this.value)" style="margin:0 0 8px">':'')
 +'<div class="card cl adl">'+(L.length?L.map(c=>'<div data-n="'+esc(BankNorm(c.name+' '+c.addr))+'">'+L1({ic:c.emo||'📍',t:esc(c.name),s:esc(c.addr),on:"goF('"+c.id+"')",act:'<span class="cr-n">Waze ›</span>'})+'</div>').join(''):'<div class="empty">Aucune adresse pour l’instant.</div>')+'</div>'
 +'<button class="go" onclick="ctF()">＋ Ajouter une adresse</button>')}
function adFilter(q){const w=BankNorm(q).split(/\s+/).filter(Boolean);document.querySelectorAll('.adl>[data-n]').forEach(b=>b.style.display=w.every(x=>b.dataset.n.includes(x))?'':'none')}
function goF(id){const c=(S.contacts||[]).find(x=>x.id==id);if(!c)return;
 sheet('<h2 style="margin-top:0">'+(c.emo||'📍')+' '+esc(c.name)+'</h2><p style="margin:0 0 14px;color:var(--mu)">'+esc(c.addr)+'</p>'
 +'<a class="go waze" href="'+wazeUrl(c.addr)+'" target="_blank" rel="noopener" onclick="setTimeout(closeF,300)">🚗 Y aller avec Waze</a>'
 +(window.AgendaNative&&AgendaNative.wazeMusic?'<button class="go alt" onclick="AgendaNative.wazeMusic(\''+wazeUrl(c.addr)+'\','+(S.music&&S.music.bub?'true':'false')+');closeF()">🚗🎵 Waze + musique</button>':'')+'<a class="go alt" href="'+gmapsUrl(c.addr)+'" target="_blank" rel="noopener" onclick="setTimeout(closeF,300)">🗺️ Plutôt Google Maps</a>'
 +(c.tel?'<a class="go alt" href="tel:'+esc(c.tel.replace(/[^\d+]/g,''))+'">📞 Appeler '+esc(c.tel)+'</a>':'')
 +'<div style="display:flex;gap:8px;margin-top:10px"><button class="pill" style="border:0;cursor:pointer" onclick="ctF(\''+c.id+'\')">✎ Modifier</button><button class="pill" style="border:0;cursor:pointer" onclick="ctDel(\''+c.id+'\')">✕ Supprimer</button></div>')}
function ctF(id){const c=id?(S.contacts||[]).find(x=>x.id==id):null,e=c&&c.emo||'📍';
 sheet('<h2 style="margin-top:0">'+(c?'Modifier l’adresse':'📍 Nouvelle adresse')+'</h2><label>Nom</label><input id="c_n" value="'+esc(c?c.name:'')+'" placeholder="Ex. Maman, Salle de sport">'
 +'<label>Adresse</label><textarea id="c_a" rows="2" placeholder="Ex. 12 rue de la Paix, 75002 Paris">'+esc(c?c.addr:'')+'</textarea>'
 +'<label>Téléphone (facultatif)</label><input id="c_t" type="tel" value="'+esc(c&&c.tel||'')+'">'
 +'<label>Icône</label><div class="ctemo">'+['📍',...CT_EMO].map(x=>'<button type="button" class="'+(x==e?'on':'')+'" onclick="[...this.parentNode.children].forEach(b=>b.classList.toggle(\'on\',b==this))">'+x+'</button>').join('')+'</div>'
 +'<button class="go" onclick="ctSave(\''+(id||'')+'\')">Enregistrer</button>')}
function ctSave(id){const n=$('#c_n').value.trim(),a=$('#c_a').value.trim().replace(/\s*\n\s*/g,', '),t=$('#c_t').value.trim(),em=($('.ctemo button.on')||{}).textContent||'📍';
 if(!n||!a){alert('Indique un nom et une adresse.');return}S.contacts=S.contacts||[];const c=id?S.contacts.find(x=>x.id==id):null;
 if(c)Object.assign(c,{name:n,addr:a,tel:t,emo:em});else S.contacts.push({id:uid(),name:n,addr:a,tel:t,emo:em});save();render();adrF()}
function ctDel(id){const c=(S.contacts||[]).find(x=>x.id==id);if(!c||!confirm('Supprimer l’adresse de « '+c.name+' » ?'))return;S.contacts=S.contacts.filter(x=>x.id!=id);save();render();adrF()}
function todayCard(){const T=dayEvents(TD).filter(e=>!e.dn),D=dayEvents(dayAdd(TD,1)).filter(e=>!e.dn);
 const li=L=>L.map(e=>'<div class="tl"><span class="tl-e">'+e.e+'</span><b>'+esc(e.t)+'</b>'+(e.a?'<em class="'+(e.a<0?'neg':'pos')+'">'+(e.a>0?'+':'−')+eur(Math.abs(e.a))+'</em>':'')
  +(e.k=='rappel'?'<button class="x dn" aria-label="Marquer comme fait" title="C’est fait" onclick="doneIt(\''+e.id+'\',\''+(L===T?TD:dayAdd(TD,1))+'\')">✓</button>':'')+'</div>').join('');
 return '<h2>📅 Aujourd’hui</h2><div class="card tday">'+(T.length?li(T):'<div class="empty" style="padding:6px 0">Rien de prévu aujourd’hui ✨</div>')
  +(D.length?'<div class="tl-h">Demain</div>'+li(D):'<div class="tl-h" style="margin-bottom:4px">Demain · <span style="text-transform:none;letter-spacing:0;font-weight:500">rien de prévu</span></div>')+'</div>'}
function more(key,n,html){let o=false;try{o=localStorage.getItem('more-'+key)=='1'}catch(e){}
 return '<details class="more"'+(o?' open':'')+' ontoggle="try{localStorage.setItem(\'more-'+key+'\',this.open?\'1\':\'0\')}catch(e){}"><summary>'+n+'</summary>'+html+'</details>'}
// --- Accueil dense (inspiré de Revolut / Monzo : un solde en héros, des tuiles « coup d'œil », des listes sur une ligne) ---
function heroCard(inc,out){const n=balNow(),e=n===null?null:balEom(),m=MO[+TD.slice(5,7)-1];
 return '<div class="hero" role="button" tabindex="0" onclick="balF()"><small>Solde '+(n===null?'':'(estimé)')+'</small>'
 +(n===null?'<b class="hb-set">Touche pour définir ton solde</b>':'<b class="'+(n>=0?'pos':'neg')+'">'+eur(n)+'</b>')
 +'<div class="hstats"><span><small>Fin du mois</small><b class="'+(e!==null&&e<0?'neg':'')+'">'+(e===null?'—':eur(e))+'</b></span><span><small>Reçu en '+m+'</small><b>'+eur(inc)+'</b></span><span><small>Dépensé</small><b>'+eur(Math.abs(out))+'</b></span></div></div>'}
function tile(ic,lab,val,sub,cls,go,bar){return '<button class="tile'+(cls?' '+cls:'')+'" onclick="'+go+'"><small>'+ic+' '+lab+'</small><b>'+val+'</b>'+(bar!=null?'<i class="tbar"><i style="width:'+Math.max(0,Math.min(100,bar)).toFixed(0)+'%"></i></i>':'')+'<span>'+sub+'</span></button>'}
function tilesHTML(){const r=salRec(),f=r?forecast():null,go=t=>"S.tab='"+t+"';render();scrollTo(0,0)",T=[];
 if(!r)T.push(tile('💼','Salaire','À régler','touche pour l’indiquer','',"salF()"));
 else T.push(tile('💼','Salaire',f?inj(f.D):'—',f?dl(f.nxt)+' · '+eur(r.amt):'le '+r.day+' du mois','',go('bu')));
 if(f&&f.B!==null)T.push(tile(f.def?'⚠️':'📉','Point bas',eur(f.low),f.def?'sous ta limite : ouvre Budget':dl(f.lowDay)+' · limite '+eur(f.floor),f.def?'bad':f.low<0?'warn':'ok',go('bu')));
 else T.push(tile('📉','Point bas','—','définis ton solde','',"balF()"));
 const p=pocheStats(),tot=p.bud+p.inc;T.push(tile('🎉','Argent de poche',eur(p.left),(p.fix?'corrigé le '+dl(p.fix.date):'sur '+eur(tot))+(p.sp?' · '+eur(p.sp)+' dépensés':''),p.left<0?'bad':'',"try{localStorage.setItem('bt','poche')}catch(e){};"+go('bu'),tot?100*(p.sp+p.rd)/tot:0));
 let ep=0,iv=0;try{ep=pepTot();const st=invStats();iv=st.val==null?st.put:st.val}catch(e){}
 T.push(tile('🐷','Épargne',eur(ep+iv),'dont S&P 500 '+eur(iv),'',go('ep')));
 return '<div class="tiles">'+T.join('')+'</div>'}
function cRow(e){const it=e.it,ty=it?TY[it.type]:null,n=diff(e.s),d=e.s==TD?'Aujourd’hui':e.s==dayAdd(TD,1)?'Demain':dl(e.s);
 if(e.h)return '<div class="cr"><span class="cr-e">🇫🇷</span><span class="cr-t"><b>'+esc(e.h)+'</b><small>'+d+' · férié</small></span></div>';
 if(e.dt)return '<div class="cr"><span class="cr-e">💸</span><span class="cr-t"><b>'+esc(e.dt.who||'Dette')+'</b><small>'+d+' · remboursement</small></span></div>';
 const a=isInst(it)?instAmt(it,e.s):+it.amt||0;
 return '<button class="cr" onclick="openEdit(\'it\',\''+it.id+'\')"><span class="cr-e">'+ty[2]+'</span><span class="cr-t"><b>'+esc(it.title)+'</b><small>'+d+(it.time?' · '+it.time:'')+' · '+ty[0]+'</small></span>'+(a?'<em>−'+eur(a)+'</em>':'')+'<span class="cr-n'+(n<=3?' soon':'')+'">'+(n==0?'auj.':n+' j')+'</span></button>'}
function setRow(){return '<div class="sets"><button onclick="bk()">💾<span>Sauvegarde</span></button><button onclick="gs()">🔄<span>Synchro</span></button><button onclick="notifF()">🔔<span>Notifications</span></button>'
 +(window.AgendaNative?'':'<a href="https://github.com/Funkyll7/Layrical/releases/latest/download/agenda.apk" target="_blank" rel="noopener">📲<span>Appli Android</span></a>')+'</div>'}
// ---------- Composants compacts communs (lignes d'une ligne, héros, sections) ----------
const CAT_E={Logement:'🏠',Courses:'🛒',Transport:'🚗',Loisirs:'🎉',Santé:'🩺',Factures:'🧾',Dettes:'💸',Imprévu:'⚡',Autre:'📦',Revenu:'💶',Salaire:'💼'};
function L1(o){return '<div class="cr'+(o.cls?' '+o.cls:'')+'"'+(o.on?' role="button" tabindex="0" onclick="'+o.on+'"':'')+'><span class="cr-e">'+(o.ic||'•')+'</span><span class="cr-t"><b>'+o.t+'</b>'+(o.s?'<small>'+o.s+'</small>':'')
 +(o.bar!=null?'<i class="tbar"><i style="width:'+Math.max(0,Math.min(100,o.bar)).toFixed(0)+'%"></i></i>':'')+'</span>'+(o.a?'<em class="'+(o.ac||'')+'">'+o.a+'</em>':'')+(o.chip?'<span class="cr-n'+(o.cc?' '+o.cc:'')+'">'+o.chip+'</span>':'')+(o.act||'')+'</div>'}
const stop=js=>'event.stopPropagation();'+js;
function chipFor(s,far){const n=diff(s);if(n<0)return ['passé','soon'];const t=n==0?'auj.':n==1?'demain':n<60?n+' j':n<730?Math.round(n/30.4)+' mois':Math.round(n/365)+' ans';return [t,n<=(far?30:3)?'soon':far&&n<=90?'warn':'']}
const dRel=s=>s==TD?'Aujourd’hui':s==dayAdd(TD,1)?'Demain':dl(s);
function heroBox(lab,val,cls,stats,on){return '<div class="hero"'+(on?' role="button" tabindex="0" onclick="'+on+'"':' style="cursor:default"')+'><small>'+lab+'</small><b class="'+(cls||'')+'">'+val+'</b>'
 +(stats&&stats.length?'<div class="hstats">'+stats.map(x=>'<span><small>'+x[0]+'</small><b class="'+(x[2]||'')+'">'+x[1]+'</b></span>').join('')+'</div>':'')+'</div>'}
const sect=(t,inner,id)=>'<h2'+(id?' id="'+id+'"':'')+'>'+t+'</h2><div class="card cl">'+inner+'</div>';
const listMore=(key,L,n,row)=>L.slice(0,n).map(row).join('')+(L.length>n?more(key,'Voir les '+(L.length-n)+' autres',L.slice(n).map(row).join('')):'');
const goSec=id=>"var e=document.getElementById('"+id+"');if(e)e.scrollIntoView({behavior:'smooth',block:'start'})";
function delEdit(){const k=F.k,id=F.edit;if(!id)return;if(k=='rec'){closeF();return stopRec(id)}if(k=='tx'){if(!confirm('Supprimer ce mouvement ?'))return;closeF();return delTx(id)}if(k=='debt'){closeF();return delDebt(id)}closeF();delIt(id)}
function home(){
 let ev=[];for(let i=0;i<=30;i++){const d=P(TD);d.setDate(d.getDate()+i);const s=iso(d);on(s).forEach(it=>{if(!isDone(it,s))ev.push({s,it})});dueOn(s).forEach(dt=>ev.push({s,dt}));const h=holName(s);if(h)ev.push({s,h})}
 const ren=S.items.filter(i=>i.type=='renouv')
  .map(i=>({i,s:next(i)})).filter(o=>diff(o.s)<=60&&diff(o.s)>=0).sort((a,b)=>a.s<b.s?-1:1);
 const tx=monthAll(+TD.slice(0,4),+TD.slice(5,7)-1).filter(t=>t.date<=TD),inc=tx.filter(t=>t.amt>0).reduce((a,t)=>a+t.amt,0),out=tx.filter(t=>t.amt<0).reduce((a,t)=>a+t.amt,0);
 const hr=new Date().getHours(),hello=hr<5||hr>=18?'Bonsoir':'Bonjour',jour=P(TD).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
 const up=ev.filter(e=>e.s>dayAdd(TD,1));
 return '<div class="hd"><h1>'+hello+' 👋</h1><div class="hd-s">'+jour.charAt(0).toUpperCase()+jour.slice(1)+appVer()+'</div></div>'+alerts()
 +heroCard(inc,out)+tilesHTML()+todayCard()
 +(ren.length?'<h2>⏳ À surveiller</h2><div class="card cl">'+ren.map(o=>cRow({s:o.s,it:o.i})).join('')+'</div>':'')
 +'<h2>🗓️ À venir</h2><div class="card cl">'+(up.length?up.slice(0,6).map(cRow).join('')+(up.length>6?more('up','Voir les '+(up.length-6)+' suivants (30 jours)',up.slice(6).map(cRow).join('')):''):'<div class="empty">Rien de prévu. Appuie sur + pour ajouter.</div>')+'</div>'
 +setRow()}
function agenda(){if(wideAg())return bigAgenda();
 const y=S.cy,m=S.cm,first=new Date(y,m,1,12),off=(first.getDay()+6)%7,dim=new Date(y,m+1,0).getDate();
 let g=['L','M','M','J','V','S','D'].map((d,k)=>'<div class="h'+(k>4?' we':'')+'">'+d+'</div>').join('');
 for(let i=0;i<off;i++)g+='<div></div>';
 for(let d=1;d<=dim;d++){const s=y+'-'+pad(m+1)+'-'+pad(d),E=dayEvents(s).filter(e=>!e.dn),em=E.map(e=>e.e),wk=false,dots=E.slice(0,3).map(e=>'<s style="background:'+(TY[e.k]?TY[e.k][1]:e.k=='ho'?'#0e9f6e':e.k=='debt'?'#e0751f':e.a>0?'#0e9f6e':'var(--mu)')+'"></s>').join('');
  g+='<button class="'+(s==TD?'td ':'')+(s==S.sel?'sel ':'')+(s<TD?'past ':'')+(wk?'we ':'')+(em.length?'has':'')+'" onclick="S.sel=\''+s+'\';render()" aria-label="'+P(s).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})+(em.length?', '+em.length+' élément'+(em.length>1?'s':''):'')+'"><span>'+d+'</span><i>'+dots+'</i></button>'}
 // planning : le jour choisi puis les 14 jours suivants qui ont quelque chose
 let pl='';const st=S.sel||TD;
 for(let k=0;k<15;k++){const s=dayAdd(st,k),E=dayEvents(s);if(k&&!E.length)continue;
  const lab=s==TD?'Aujourd’hui':s==dayAdd(TD,1)?'Demain':s==dayAdd(TD,-1)?'Hier':'',full=P(s).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
  pl+='<div class="pd'+(k==0?' first':'')+'"><b>'+(lab||full.charAt(0).toUpperCase()+full.slice(1))+'</b>'+(lab?'<small>'+full+'</small>':'')+'</div><div class="card cl">'+(E.length?E.map(e=>{if(e.k=='ho')return holRow(s,e.t);if(e.k=='debt'){const d=S.debts.find(x=>x.id==e.id);return d?debtRow(d):''}if(e.k=='rec'||e.k=='tx')return L1({ic:e.e,t:esc(e.t),s:e.k=='rec'?'chaque mois':((S.tx.find(x=>x.id==e.id)||{}).cat||'mouvement'),a:(e.a>0?'+':'−')+eur(Math.abs(e.a)),ac:e.a>0?'pos':'',on:"openEdit('"+e.k+"','"+e.id+"')"});const it=S.items.find(x=>x.id==e.id);return it?itemRow(it,s,1):''}).join(''):'<div class="empty" style="padding:10px 0">Rien ce jour-là.</div>')+'</div>'}
 const cur=y==+TD.slice(0,4)&&m==+TD.slice(5,7)-1&&S.sel==TD;
 return '<div class="agh"><h1>Agenda</h1>'+(cur?'':'<button class="mini" onclick="S.sel=TD;S.cy=+TD.slice(0,4);S.cm=+TD.slice(5,7)-1;render()">Aujourd’hui</button>')+'</div>'
 +'<div class="nv"><button onclick="mv(\'c\',-1)" aria-label="Mois précédent">‹</button><b>'+MO[m]+' '+y+'</b><button onclick="mv(\'c\',1)" aria-label="Mois suivant">›</button></div><div class="card" style="padding:8px 6px"><div class="cal cal2">'+g+'</div></div>'
 +'<h2>🗓️ Planning</h2>'+pl}
function quotMonthly(){return S.items.filter(i=>i.type=='travail'&&+i.amt>0&&repMonths(i.rep)).reduce((a,i)=>a+(+i.amt)/repMonths(i.rep),0)}
function quotList(){const l=S.items.filter(i=>i.type=='travail').sort((a,b)=>a.title.localeCompare(b.title));return l.length?sect('🛒 Quotidien · '+eur(quotMonthly())+' / mois',l.map(i=>itemRow(i,i.date?next(i):undefined)).join(''),'s-quot'):''}
function aboList(){const l=S.items.filter(i=>i.type=='abo').sort((a,b)=>(+b.amt||0)/(repMonths(b.rep)||12)-(+a.amt||0)/(repMonths(a.rep)||12));if(!l.length)return '';
 return sect('🔁 Abonnements · '+eur(subMonthly())+' / mois',listMore('abo',l,5,i=>itemRow(i,next(i)))+more('abochart','📊 Comparer leur coût par mois','<div style="padding:4px 0 10px">'+hbars(l.map(i=>[esc(i.title),(+i.amt||0)/(repMonths(i.rep)||12),eur(+i.amt||0)+' · '+(RP[i.rep]||'').toLowerCase()]))+'</div>'),'s-abo')}
function recList(){const l=S.rec.filter(r=>!r.end||r.end>=TD);return l.length?sect('🔁 Revenus et dépenses fixes',l.map(r=>L1({ic:r.amt>0?'💶':(CAT_E[r.cat]||'📦'),t:esc(r.label),s:'le '+r.day+' de chaque mois · '+r.cat+(r.start>TD?' · dès le '+dl(r.start):''),a:(r.amt>0?'+':'−')+eur(Math.abs(r.amt)),ac:r.amt>0?'pos':'',on:"openEdit('rec','"+r.id+"')"})).join(''),'s-rec'):''}
function budget(){
 const y=S.by,m=S.bm,tx=monthAll(y,m).sort((a,b)=>a.date<b.date?1:-1),inc=tx.filter(t=>t.amt>0).reduce((a,t)=>a+t.amt,0),out=-tx.filter(t=>t.amt<0).reduce((a,t)=>a+t.amt,0);
 const bc={};tx.filter(t=>t.amt<0).forEach(t=>bc[t.cat]=(bc[t.cat]||0)-t.amt);
 CATS.forEach(c=>{if(S.bud[c]&&!(c in bc))bc[c]=0});const cats=Object.entries(bc).sort((a,b)=>b[1]-a[1]);
 const n=balNow(),p=pocheStats(),bil=inc-out;let bt='sum';try{bt=localStorage.getItem('bt')||'sum'}catch(e){}
 const T=[['sum','Résumé'],['poche','Poche'],['fix','Fixes'],['mv','Mouvements']];
 const head='<h1>Budget</h1><div class="bt-tabs" role="tablist">'+T.map(t=>'<button role="tab" class="'+(bt==t[0]?'on':'')+'" onclick="btSet(\''+t[0]+'\')">'+t[1]+'</button>').join('')+'</div>';
 const nav='<div class="nv nv-s"><button onclick="mv(\'b\',-1)" aria-label="Mois précédent">‹</button><b>'+MO[m]+' '+y+'</b><button onclick="mv(\'b\',1)" aria-label="Mois suivant">›</button></div>';
 if(bt=='poche')return head+pocheCard()+cardCard();
 if(bt=='fix')return head+'<p class="hint" style="margin-top:4px">Par mois : abonnements <b>'+eur(subMonthly())+'</b> · quotidien <b>'+eur(quotMonthly())+'</b> · crédits <b>'+eur(credMonthly())+'</b></p>'+recList()+quotList()+aboList();
 if(bt=='mv')return head+nav+sect('🧾 Mouvements de '+MO[m]+' · '+tx.length,tx.length?tx.map(txRow).join(''):'<div class="empty">Aucun mouvement. Appuie sur + pour en ajouter.</div>');
 const top=cats.slice(0,4);
 return head+nav
 +heroBox('Bilan de '+MO[m],(bil>=0?'+':'')+eur(bil),bil>=0?'pos':'neg',[['Reçu',eur(inc)],['Dépensé',eur(out)],['Solde',n===null?'—':eur(n),n!==null&&n<0?'neg':'']],'balF()')
 +'<div class="tiles">'+tile('🎉','Argent de poche',eur(p.left),'reste sur '+eur(p.bud+p.inc),p.left<0?'bad':'',"btSet('poche')",(p.bud+p.inc)?100*(p.sp+p.rd)/(p.bud+p.inc):0)
  +tile('🔁','Fixes / mois',eur(subMonthly()+quotMonthly()),'abonnements + quotidien','',"btSet('fix')")+'</div>'
 +fcCard(true)
 +(top.length?'<h2>📂 Où part l’argent</h2><div class="card" style="padding:6px 14px 8px">'+top.map(catBar).join('')+(cats.length>4?more('cats','Voir les '+(cats.length-4)+' autres catégories',cats.slice(4).map(catBar).join('')):'')+'<button class="lnk" onclick="cap()">Fixer des plafonds</button> · <button class="lnk" onclick="btSet(\'mv\')">Voir les mouvements</button></div>':'')
 +'<div class="card cl" style="margin-top:10px">'+more('charts','📊 Graphiques du mois et des mois précédents',budgetCharts())+'</div>'}
function btSet(t){try{localStorage.setItem('bt',t)}catch(e){}render();scrollTo(0,0)}
// Coûts de renouvellement connus (vérifiés en novembre 2026)
const COUTS=[[/passeport/i,86,'Timbre fiscal pour un adulte (service-public.gouv.fr)'],[/identit|\bcni\b/i,0,'Gratuit en rendant l’ancienne carte · 25 € si elle est perdue ou volée'],[/permis/i,0,'Démarche en ligne gratuite (ANTS) · seule la photo d’identité est à payer'],[/bours/i,0,'Renouvellement automatique et gratuit (BoursoBank)'],[/revolut/i,13.99,'Au plus 6 € de remplacement + 7,99 € de livraison (offre Standard) ; souvent gratuit à l’échéance, à vérifier dans l’appli Revolut'],[/pluxee|swile|edenred|ticket\s*resto/i,0,'Carte fournie par ton employeur, en principe sans frais pour toi (à confirmer auprès de lui)']];
const coutDe=t=>{const c=COUTS.find(x=>x[0].test(t||''));return c?{a:c[1],n:c[2]}:null};
function applyCout(id){const i=S.items.find(x=>x.id==id),c=i&&coutDe(i.title);if(!c)return;i.amt=c.a;if(!i.note)i.note=c.n;save();render()}
function applyCouts(){S.items.filter(i=>i.type=='renouv'&&i.amt===''&&coutDe(i.title)).forEach(i=>{const c=coutDe(i.title);i.amt=c.a;if(!i.note)i.note=c.n});save();render()}
const b64u=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const ub64=s=>{s=s.replace(/-/g,'+').replace(/_/g,'/');const r=atob(s+'==='.slice((s.length+3)%4));return Uint8Array.from(r,c=>c.charCodeAt(0))};
let NSUB=null;
const notifOn=()=>!!NSUB&&typeof Notification!='undefined'&&Notification.permission=='granted';
async function notifCheck(){try{const r=await navigator.serviceWorker.ready;NSUB=await r.pushManager.getSubscription()}catch(e){NSUB=null}}
function notifFApp(){const on=AgendaNative.canNotify();
 sheet('<h2 style="margin-top:0">🔔 Notifications</h2><small style="color:var(--mu);font-size:12.5px;display:block">Programmées directement dans ton téléphone par l’appli, à la minute près, même sans Internet : le résumé du matin (avancé à 6 h 30 si un rendez-vous a lieu avant 9 h), la liste de la veille au soir et un rappel 1 h avant chaque rendez-vous qui a une heure.</small>'
 +(on?'<p class="pos"><b>✓ Notifications autorisées</b></p>':'<p class="neg"><b>Les notifications sont bloquées pour l’appli.</b></p><button class="go" onclick="AgendaNative.openSettings()">Les autoriser</button>')
 +'<button class="go" style="margin-top:6px;background:var(--ln);color:var(--ink)" onclick="AgendaNative.test()">Tester maintenant</button>'
 +'<label>Heure du résumé du matin</label><select onchange="S.notif.hour=+this.value;save();nsched()">'+Array.from({length:17},(_,i)=>i+6).map(h=>'<option value="'+h+'"'+((S.notif.hour??8)==h?' selected':'')+'>'+h+' h</option>').join('')+'</select>'
 +'<label>Rappel de la veille (ce qui est prévu demain)</label><select onchange="S.notif.eve=+this.value;save();nsched()">'+[17,18,19,20,21,22,23].map(h=>'<option value="'+h+'"'+((S.notif.eve??20)==h?' selected':'')+'>'+h+' h</option>').join('')+'</select>'
 +'<small id="nf-n" style="color:var(--mu);font-size:12px;display:block;margin-top:8px"></small>');
 nsched().then(n=>{const e=$('#nf-n');if(e&&n!=null)e.textContent=n+' notification'+(n>1?'s':'')+' programmée'+(n>1?'s':'')+' pour les 8 prochains jours.'})}
function notifF(){if(window.AgendaNative&&AgendaNative.canNotify)return notifFApp();const ok='serviceWorker' in navigator&&'PushManager' in window&&typeof Notification!='undefined',k=S.pushKey,ios=/iPhone|iPad/.test(navigator.userAgent),standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone,st=(n,t,done)=>'<div class="nf-st'+(done?' nf-ok':'')+'"><b>'+(done?'✓':n)+'</b><div>'+t+'</div></div>';
 sheet('<h2 style="margin-top:0">🔔 Notifications</h2><small style="color:var(--mu);font-size:12.5px;display:block">Chaque matin, un résumé de tes rendez-vous, rappels, anniversaires, échéances et crédits à venir (avancé à 6 h 30 si un rendez-vous a lieu avant 9 h) ; la veille au soir, la liste de ce qui est prévu le lendemain ; et un rappel 1 h avant un rendez-vous qui a une heure. Envoyé par une tâche GitHub qui lit ton dépôt privé ; le contenu est chiffré jusqu’à ton téléphone.</small>'
 +(!ok?'<p class="neg"><b>Ce navigateur ne gère pas les notifications.</b>'+(ios?' Sur iPhone : ajoute d’abord le site à l’écran d’accueil (Partager → Sur l’écran d’accueil), puis ouvre-le depuis l’icône.':'')+'</p>':'')
 +st(1,'<b>Créer les clés de notification</b> (une seule fois)'+(k?'<br><small>Clé publique enregistrée. <a href="#" onclick="genKeys(true);return false">Recréer les clés</a></small>':'<br><button class="go" style="margin-top:6px" onclick="genKeys()">Créer les clés</button>')+'<div id="nf-k"></div>',!!k)
 +st(2,'<b>Ajouter 2 secrets dans GitHub</b> : <a href="https://github.com/Funkyll7/Layrical/settings/secrets/actions/new" target="_blank" rel="noopener">Layrical → Settings → Secrets → Actions</a><br><small><b>VAPID_PRIVATE_KEY</b> : la clé privée affichée à l’étape 1.<br><b>DATA_TOKEN</b> : ton jeton de synchro (accès à ton dépôt de données).</small>',false)
 +st(3,'<b>Activer sur cet appareil</b>'+(ios&&!standalone?'<br><small class="neg">Sur iPhone, ouvre d’abord le site depuis l’écran d’accueil.</small>':'')+'<br><button class="go" style="margin-top:6px" onclick="subNotif()" '+(!ok||!k?'disabled':'')+'>'+(notifOn()?'Réactiver':'Activer les notifications')+'</button>'+(notifOn()?'<button class="go" style="margin-top:6px;background:var(--ln);color:var(--ink)" onclick="testNotif()">Tester sur cet appareil</button>':''),notifOn())
 +'<label>Heure du résumé du matin</label><select id="n_h" onchange="S.notif.hour=+this.value;save()">'+Array.from({length:17},(_,i)=>i+6).map(h=>'<option value="'+h+'"'+((S.notif.hour??8)==h?' selected':'')+'>'+h+' h</option>').join('')+'</select>'
 +'<label>Rappel de la veille (ce qui est prévu demain)</label><select id="n_e" onchange="S.notif.eve=+this.value;save()">'+[17,18,19,20,21,22,23].map(h=>'<option value="'+h+'"'+((S.notif.eve??20)==h?' selected':'')+'>'+h+' h</option>').join('')+'</select>'
 +'<small style="color:var(--mu);font-size:12px;display:block;margin-top:8px">'+(S.subs.length?S.subs.length+' appareil'+(S.subs.length>1?'s':'')+' inscrit'+(S.subs.length>1?'s':'')+'. ':'')+'Les horaires sont approximatifs (à quelques minutes près).</small>')}
async function genKeys(again){if(again&&!confirm('Recréer les clés ? Il faudra remettre la clé privée dans GitHub et réactiver chaque appareil.'))return;
 const kp=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign']),pub=b64u(await crypto.subtle.exportKey('raw',kp.publicKey)),d=(await crypto.subtle.exportKey('jwk',kp.privateKey)).d;
 S.pushKey={pub,at:TD};if(again)S.subs=[];save();notifF();$('#nf-k').innerHTML='<div class="nf-key"><small><b>Clé privée</b> (à copier dans le secret VAPID_PRIVATE_KEY ; elle ne sera plus affichée) :</small><textarea readonly rows="2" onclick="this.select()">'+d+'</textarea><button class="pill" style="border:0;cursor:pointer" onclick="navigator.clipboard&&navigator.clipboard.writeText(\''+d+'\');this.textContent=\'Copiée ✓\'">Copier</button></div>'}
async function subNotif(){try{if(await Notification.requestPermission()!='granted'){alert('Notifications refusées : autorise-les dans les réglages du navigateur pour ce site.');return}
 const r=await navigator.serviceWorker.ready;let sub=await r.pushManager.getSubscription(),old=sub&&sub.endpoint;if(sub)await sub.unsubscribe();sub=await r.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:ub64(S.pushKey.pub)});
 const j=sub.toJSON();S.subs=S.subs.filter(x=>x.endpoint!=j.endpoint&&x.endpoint!=old);S.subs.push({id:uid(),endpoint:j.endpoint,keys:j.keys,ua:navigator.userAgent.slice(0,90),at:TD});NSUB=sub;save();notifF()}catch(e){alert('Activation impossible : '+e.message)}}
async function testNotif(){const r=await navigator.serviceWorker.ready;r.showNotification('🔔 Test réussi',{body:'Les notifications fonctionnent sur cet appareil.',icon:'assets/img/favicon.svg',tag:'test'})}
function rappels(){
 const l=S.items.filter(i=>i.type=='renouv').map(i=>({i,s:next(i)})).sort((a,b)=>a.s<b.s?-1:1),sug=l.filter(o=>o.i.amt===''&&coutDe(o.i.title)),nx=l.find(o=>o.s&&o.s>=TD),y1=l.filter(o=>o.s&&diff(o.s)<=365),cost=y1.reduce((a,o)=>a+(+o.i.amt||0),0);
 return '<h1>Échéances</h1>'+(nx?heroBox('Prochaine échéance',esc(nx.i.title),'',[['Dans',chipFor(nx.s,1)[0],diff(nx.s)<=30?'neg':''],['Date',P(nx.s).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'})],['Coût sur 12 mois',eur(cost)]],"openEdit('it','"+nx.i.id+"')"):'')
 +(sug.length?'<div class="card fc" style="margin-top:8px"><b>💡 J’ai trouvé le coût de '+sug.length+' renouvellement'+(sug.length>1?'s':'')+'</b><ul style="margin:6px 0 6px 18px;padding:0">'+sug.map(o=>{const c=coutDe(o.i.title);return '<li><b>'+esc(o.i.title)+'</b> : '+(c.a?eur(c.a):'gratuit')+' <small style="display:inline">· '+esc(c.n)+'</small></li>'}).join('')+'</ul><button class="go" style="margin-top:6px" onclick="applyCouts()">Ajouter ces coûts</button></div>':'')
 +sect('🪪 Papiers, cartes, assurances',l.length?l.map(o=>itemRow(o.i,o.s)).join(''):'<div class="empty">Ajoute un renouvellement avec +.</div>')
 +'<p class="hint">Rouge sous 30 jours, orange sous 90. Touche une ligne pour la modifier.</p>'}
// Bloc-notes : panneau à droite sur grand écran, fenêtre sur téléphone ; enregistré automatiquement
let NT=null;
function noteIn(v){S.notes=v;document.querySelectorAll('.np-ta').forEach(t=>{if(t!==document.activeElement)t.value=v});document.querySelectorAll('.np-st').forEach(e=>e.textContent='Enregistrement…');clearTimeout(NT);NT=setTimeout(()=>{save();document.querySelectorAll('.np-st').forEach(e=>e.textContent='Enregistré')},600)}
function noteSync(){document.querySelectorAll('.np-ta').forEach(t=>{if(t!==document.activeElement&&t.value!==(S.notes||''))t.value=S.notes||''})}
function noteF(){sheet('<h2 style="margin-top:0">Bloc-notes</h2><textarea class="np-ta" rows="14" style="min-height:50vh" placeholder="Tes notes, listes, idées…" oninput="noteIn(this.value)">'+esc(S.notes||'')+'</textarea><small class="np-st" style="color:var(--mu);font-size:12px;display:block;margin-top:6px">Enregistré automatiquement</small>')}
// Budget en pourcentages : panneau à gauche sur grand écran, fenêtre 💰 sinon
const PK=['poche','invest','pepin'],PL={poche:['🎉','Argent de poche'],invest:['📈','Investissement S&P 500'],pepin:['🐷','Épargne']};let PT=null;
const ruleOf=()=>Object.assign({cap:250,lowR:350,lowCap:100,seuil:1000,low:80,high:50},S.plan.rule||{});
const pocheCap=R=>{const r=ruleOf();return R<r.lowR?r.lowCap:r.cap};
const isAuto=()=>S.plan.mode!='pct';
// part (en %) du reste qui va à l'épargne, le reste allant à l'investissement
function epShare(){const r=ruleOf();if(isAuto())return pepTot()<r.seuil?r.low:r.high;const p=S.plan.p,a=+p.pepin||0,b=+p.invest||0;return a+b?a/(a+b)*100:80}
function autoAlloc(R,mn){const mP=+mn.poche||0,mI=+mn.invest||0,mE=+mn.pepin||0,mins=mP+mI+mE,r=ruleOf();
 if(R<=0)return {poche:0,invest:0,pepin:0};if(R<mins){const f=R/mins;return {poche:mP*f,invest:mI*f,pepin:mE*f}}
 const poche=Math.max(mP,Math.min(Math.max(pocheCap(R),mP),R-mI-mE)),rest=R-poche,ep=epShare();let e=rest*ep/100,i=rest-e;
 if(i<mI){i=mI;e=rest-i}if(e<mE){e=mE;i=rest-e}return {poche,invest:i,pepin:e}}
function planCalc(){const y=+TD.slice(0,4),m=+TD.slice(5,7)-1,rm=recMonth(y,m),auto=rm.filter(t=>t.amt>0).reduce((a,t)=>a+t.amt,0),fx=(-rm.filter(t=>t.amt<0).reduce((a,t)=>a+t.amt,0))||0,cr=credMonthly(),ab=subMonthly(),ov=S.plan.inc,rev=ov!==''&&ov!=null&&!isNaN(+ov)?+ov:auto,qu=quotMonthly(),ch=fx+cr+ab+qu,reste=rev-ch,p=S.plan.p,sum=PK.reduce((a,k)=>a+(+p[k]||0),0);
 const mn=S.plan.min||{},mins=PK.reduce((a,k)=>a+(+mn[k]||0),0),base=Math.max(0,reste),sur=Math.max(0,base-mins),al=isAuto()?autoAlloc(base,mn):null;
 return {auto,fx,cr,ab,qu,rev,ch,reste,sum,mins,sur,al,short:Math.max(0,mins-base),amt:k=>al?al[k]:mins?(base>=mins?(+mn[k]||0)+sur*(+p[k]||0)/100:(+mn[k]||0)*base/mins):base*(+p[k]||0)/100}}
function ruleMsg(){const r=ruleOf(),t=pepTot(),ep=epShare();return 'Ton épargne : '+eur(t)+(t<r.seuil?' (sous '+eur(r.seuil)+')':' (au-dessus de '+eur(r.seuil)+')')+' → '+Math.round(ep)+' % épargne / '+Math.round(100-ep)+' % investissement.'}
function sumMsg(c){if(c.short>0)return '⚠️ Il manque '+eur(c.short)+' par mois pour couvrir tes minimums ('+eur(c.mins)+') : ils sont réduits à proportion.';if(c.reste<0)return '⚠️ Tes charges fixes dépassent ton revenu : rien à répartir.';
 if(c.al){const cp=pocheCap(Math.max(0,c.reste));return '✓ Argent de poche : '+eur(c.al.poche)+(c.al.poche>=cp-0.005?' (plafond de '+eur(cp)+(cp!=ruleOf().cap?', car moins de '+eur(ruleOf().lowR)+' à répartir':'')+')':'')+' · le reste va '+Math.round(epShare())+' % à l’épargne et '+Math.round(100-epShare())+' % à l’investissement.'}
 if(c.mins&&c.sur<0.005)return '✓ Tes minimums prennent tout le reste.';const w=c.mins?'du surplus ('+eur(c.sur)+')':'de ton reste';return c.mins&&c.sum==100?'✓ Minimums couverts, 100 % '+w+' réparti':c.mins&&c.sum<100?'Minimums couverts. Encore '+(100-c.sum)+' % '+w+' à répartir':c.sum==100?'✓ 100 % de ton reste est réparti':c.sum<100?'Encore '+(100-c.sum)+' % à répartir ('+eur(Math.max(0,c.reste)*(100-c.sum)/100)+')':'⚠️ Tu dépasses de '+(c.sum-100)+' %'}
function planHTML(){const c=planCalc(),p=S.plan.p,au=isAuto(),r=ruleOf(),ri=(k,lab,u)=>'<div class="pl-l" style="margin-top:6px"><span>'+lab+'</span><span class="pl-pct"><input type="number" inputmode="decimal" min="0" step="1" data-pr="'+k+'" value="'+esc(r[k])+'" oninput="planIn(this)" aria-label="'+lab+'"> '+u+'</span></div>';
 return '<h2 style="margin-top:0">Mon budget du mois</h2><label>Revenu mensuel (€)</label><input class="pl-inc" type="number" inputmode="decimal" step="0.01" value="'+esc(S.plan.inc==null?'':S.plan.inc)+'" placeholder="'+(c.auto?c.auto.toFixed(2):'Ex. 1800')+'" oninput="planIn(this)">'
 +'<small class="pl-hint">'+(c.auto?'Laisse vide pour utiliser tes revenus fixes ('+eur(c.auto)+').':'Tape ton revenu, ou ajoute ton salaire en revenu fixe dans Budget.')+'</small>'
 +'<div class="pl-box"><div class="pl-l"><span>Revenu</span><b data-pl="rev">'+eur(c.rev)+'</b></div><div class="pl-l"><span>Charges fixes</span><b>− '+eur(c.ch)+'</b></div><small>dépenses fixes '+eur(c.fx)+' · crédits '+eur(c.cr)+' · abonnements '+eur(c.ab)+' · quotidien '+eur(c.qu)+'</small><div class="pl-l pl-big"><span>Reste à répartir</span><b data-pl="reste" class="'+(c.reste>=0?'pos':'neg')+'">'+eur(c.reste)+'</b></div></div>'
 +'<label>Répartition</label><div class="seg"><button type="button" class="'+(au?'on':'')+'" onclick="planMode(\'auto\')">💡 Ma règle</button><button type="button" class="'+(au?'':'on')+'" onclick="planMode(\'pct\')">Pourcentages</button></div>'
 +(au?'<div class="pl-box">'+ri('cap','Argent de poche au plus','€')+ri('lowR','Mais si le reste est sous','€')+ri('lowCap','… argent de poche au plus','€')+ri('seuil','Tant que mon épargne est sous','€')+ri('low','… part pour l’épargne','%')+ri('high','Au-delà, part pour l’épargne','%')+'<small data-pl="rule" style="margin-top:8px">'+ruleMsg()+'</small></div>':'')
 +PK.map(k=>'<div class="pl-c"><div class="pl-l"><span>'+PL[k][0]+' '+PL[k][1]+'</span><b data-pl="a-'+k+'">'+eur(c.amt(k))+'</b></div>'+(au?'':'<div class="pl-l" style="margin-top:6px"><span class="pl-pct"><input type="number" inputmode="decimal" min="0" max="100" step="1" data-pk="'+k+'" value="'+esc(p[k]==null?0:p[k])+'" oninput="planIn(this)" aria-label="Pourcentage '+PL[k][1]+'"> %'+' <small style="font-size:11px'+(c.mins?'':';display:none')+'">du surplus</small>'+'</span><div class="bar" style="flex:1;margin:0 0 0 10px"><i data-plw="'+k+'" style="width:'+Math.min(100,+p[k]||0)+'%"></i></div></div>')+'<div class="pl-l pl-min"><span>Minimum</span><span class="pl-pct"><input type="number" inputmode="decimal" min="0" step="1" data-pm="'+k+'" value="'+esc((S.plan.min||{})[k]||'')+'" placeholder="0" oninput="planIn(this)" aria-label="Minimum '+PL[k][1]+'"> €</span></div></div>').join('')
 +'<small data-pl="sum" class="pl-sum">'+sumMsg(c)+'</small><small class="pl-hint">Calculé sur le mois en cours, par mois. Ce sont tes règles : un outil de répartition, pas un conseil financier.</small>'}
function planUpd(){const c=planCalc();document.querySelectorAll('.pl-pct small').forEach(x=>x.style.display=c.mins?'':'none');document.querySelectorAll('[data-pl]').forEach(e=>{const k=e.dataset.pl;if(k=='rev')e.textContent=eur(c.rev);else if(k=='reste'){e.textContent=eur(c.reste);e.className=c.reste>=0?'pos':'neg'}else if(k=='sum')e.textContent=sumMsg(c);else if(k=='rule')e.textContent=ruleMsg();else if(k.slice(0,2)=='a-')e.textContent=eur(c.amt(k.slice(2)))});document.querySelectorAll('[data-plw]').forEach(e=>e.style.width=Math.min(100,+S.plan.p[e.dataset.plw]||0)+'%')}
function planIn(el){const inc=el.classList.contains('pl-inc'),mk=el.dataset.pm,rk=el.dataset.pr;
 if(inc)S.plan.inc=el.value;else if(mk){S.plan.min=S.plan.min||{};S.plan.min[mk]=el.value===''?0:Math.max(0,+el.value)}else if(rk){S.plan.rule=S.plan.rule||{};S.plan.rule[rk]=Math.max(0,+el.value||0);if(rk=='low'||rk=='high')S.plan.rule[rk]=Math.min(100,S.plan.rule[rk])}else S.plan.p[el.dataset.pk]=el.value===''?0:Math.max(0,+el.value);
 document.querySelectorAll(inc?'.pl-inc':mk?'[data-pm="'+mk+'"]':rk?'[data-pr="'+rk+'"]':'[data-pk="'+el.dataset.pk+'"]').forEach(x=>{if(x!==el)x.value=el.value});planUpd();clearTimeout(PT);PT=setTimeout(save,600)}
function planMode(m){S.plan.mode=m;save();const pop=$('#m').classList.contains('on')&&$('#sh .pl-inc');const p=$('#pl');if(p)p.innerHTML=planHTML();if(pop)planF()}
function planRender(){const p=$('#pl');if(p&&!p.contains(document.activeElement))p.innerHTML=planHTML()}
function planF(){sheet(planHTML())}
function planAmt(k){return Math.round(planCalc().amt(k))}
// Salaire et prévision « jusqu'au prochain salaire »
const salRec=()=>S.rec.find(r=>r.sal&&(!r.end||r.end>=TD));
function payAround(r){let y=+TD.slice(0,4),m=+TD.slice(5,7)-1,last=null,nxt=null;for(let k=-2;k<3;k++){let Y=y,M=m+k;while(M<0){M+=12;Y--}while(M>11){M-=12;Y++}const o=recOcc(r,Y,M);if(!o)continue;if(o.date<=TD)last=o.date;else if(!nxt)nxt=o.date}return {last,nxt}}
const dayAdd=(s,n)=>{const d=P(s);d.setDate(d.getDate()+n);return iso(d)},daysBetween=(a,b)=>Math.round((P(b)-P(a))/864e5);
function quotUndated(){return S.items.filter(i=>i.type=='travail'&&!i.date&&+i.amt>0&&repMonths(i.rep)).reduce((a,i)=>a+(+i.amt)/repMonths(i.rep),0)}
const odLim=()=>S.plan.od==null||S.plan.od===''?200:+S.plan.od;
const pepTot=()=>(S.sav||[]).filter(x=>x.dest=='pepin').reduce((a,x)=>a+(+x.amt),0);
function forecast(){const r=salRec();if(!r)return null;const {last,nxt}=payAround(r);if(!nxt)return null;
 const cyc=Math.max(last?daysBetween(last,nxt):30,1),D=daysBetween(TD,nxt),qd=quotUndated()/cyc,pc=planCalc(),pd=0,pm=Math.max(0,pc.amt('poche')),B=balNow(),floor=-odLim();
 // aujourd'hui compte aussi : quotidien sans date + argent de poche, au prorata des jours
 let bal=(B||0)-qd-pd,low=bal,lowDay=TD,prev=TD,need=qd+pd;
 for(let k=1;k<D;k++){const d=dayAdd(TD,k),f=flowBetween(prev,d)+S.tx.filter(t=>t.date==d&&(!S.bal||txAfter(t))).reduce((a,t)=>a+t.amt,0)-qd-pd;bal+=f;need-=f;prev=d;if(bal<low){low=bal;lowDay=d}}
 // sous le découvert autorisé : on puise d'abord sur l'argent de poche (avant le point bas), puis sur l'investissement, puis sur l'épargne « pépin »
 const def=Math.max(0,floor-low),pocheAvant=pm,cutP=Math.min(def,pocheAvant),cutI=Math.min(def-cutP,Math.max(0,pc.amt('invest'))),cutE=Math.min(def-cutP-cutI,Math.max(0,pepTot())),rest=Math.max(0,def-cutP-cutI-cutE);
 return {r,nxt,D,B,before:bal,eve:bal+cutP+cutI+cutE,low,lowDay,need,qd,pd,poche:pm,pm,floor,def,cutP,cutI,cutE,rest,days:Math.max(D,1)}}
// Règle : les prélèvements de crédit doivent toujours passer (jusqu'au salaire d'après le prochain)
const txOn=d=>S.tx.filter(t=>t.date==d&&(!S.bal||txAfter(t))).reduce((a,t)=>a+t.amt,0);
function loanWatch(f){const r=f.r,y=+f.nxt.slice(0,4),m=+f.nxt.slice(5,7)-1,o2=recOcc(r,m==11?y+1:y,(m+1)%12),end=o2?dayAdd(o2.date,-1):dayAdd(f.nxt,30);
 let bal=f.B-f.qd-f.pd,prev=TD;const out=[];
 for(let k=1;k<400;k++){const d=dayAdd(TD,k);if(d>end)break;bal+=flowBetween(prev,d)+txOn(d)-f.qd-f.pd-(d==f.nxt?f.pm:0);prev=d;
  S.items.filter(i=>isInst(i)&&occ(i,d)).forEach(i=>out.push({d,t:i.title,a:instAmt(i,d),bal,next:d>=f.nxt}))}
 return out}
function loanHTML(f){if(f.B===null)return '';const L=loanWatch(f);if(!L.length)return '';
 const inv=Math.max(0,planCalc().amt('invest')),pep=Math.max(0,pepTot());let worst=null;
 const li=L.map(x=>{const need=f.floor-x.bal;let st;
  if(need<=0.005)st='<span class="pos">✓ passe</span>';
  else if(!x.next&&need<=f.pd*(daysBetween(TD,x.d)+1)+inv+pep+0.005)st='<span class="pos">✓ passe si tu suis les étapes ci-dessus</span>';
  else{st='<span class="neg"><b>⚠️ risque d’être rejeté</b> (il manque '+eur(need)+')</span>';if(!worst)worst=x}
  return '<li><b>'+esc(x.t)+'</b> : '+eur(x.a)+' le '+dl(x.d)+(x.next?' <small style="display:inline;margin:0">(après le salaire)</small>':'')+' · '+st+'</li>'}).join('');
 let help='';const nxtNeed=Math.max(0,...L.filter(x=>x.next).map(x=>f.floor-x.bal));
 if(worst){const subs=S.items.filter(i=>i.type=='abo'&&+i.amt>0).map(i=>{let d=null;for(let k=0;k<=daysBetween(TD,worst.d);k++){const x=dayAdd(TD,k);if(occ(i,x)){d=x;break}}return d?{t:i.title,a:+i.amt,d}:null}).filter(Boolean),
   occ0=S.tx.filter(t=>t.amt<0&&t.date>TD&&t.date<=worst.d&&t.cat!='Épargne');
  help='<p><b>Pour que ton crédit passe quand même :</b></p><ul style="margin:4px 0 6px 18px;padding:0">'
   +(nxtNeed>0?'<li>la veille de ton salaire, garde au moins <b>'+eur(nxtNeed)+'</b> de plus sur ton compte (ne mets pas tout de côté)</li>':'')
   +(subs.length?'<li>suspends des abonnements d’ici là : '+subs.map(x=>esc(x.t)+' ('+eur(x.a)+' le '+dl(x.d)+')').join(', ')+'</li>':'')
   +(occ0.length?'<li>décale des dépenses prévues : '+occ0.map(t=>esc(t.label)+' ('+eur(-t.amt)+')').join(', ')+'</li>':'')
   +(pep>0?'<li>reprends de l’argent dans ton épargne ('+eur(pep)+' disponibles)</li>':'')
   +'<li><b>appelle ta banque avant le '+dl(worst.d)+'</b> : demande un report d’échéance ou une hausse ponctuelle de ton découvert. C’est toujours mieux qu’un prélèvement de crédit rejeté.</li></ul>'}
 return '<div class="loanbox"><b>🔒 Crédits à payer en priorité</b><ul style="margin:6px 0 4px 18px;padding:0">'+li+'</ul>'+help+'</div>'}
// ================= Graphiques (SVG / HTML faits main, sans bibliothèque) =================
const fmtE=v=>Math.round(v).toLocaleString('fr-FR')+' €';
const dShort=d=>P(d).toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
function niceStep(x){const p=Math.pow(10,Math.floor(Math.log10(Math.max(x,1e-9)))),f=x/p;return (f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*p}
// infobulle commune : tout élément portant data-tip
function tipShow(html,x,y){let t=document.getElementById('tip');if(!t){t=document.createElement('div');t.id='tip';t.setAttribute('role','tooltip');document.body.appendChild(t)}t.innerHTML=html;t.style.display='block';const w=t.offsetWidth,h=t.offsetHeight;t.style.left=Math.min(innerWidth-w-8,Math.max(8,x-w/2))+'px';t.style.top=(y-h-12<8?y+18:y-h-12)+'px'}
function tipHide(){const t=document.getElementById('tip');if(t)t.style.display='none';document.querySelectorAll('svg.lc .lc-x').forEach(x=>x.setAttribute('visibility','hidden'))}
document.addEventListener('pointerover',e=>{const el=e.target.closest&&e.target.closest('[data-tip]');if(el){const r=el.getBoundingClientRect();tipShow(el.dataset.tip,r.left+r.width/2,r.top)}});
document.addEventListener('pointerout',e=>{const el=e.target.closest&&e.target.closest('[data-tip]');if(el&&!el.contains(e.relatedTarget))tipHide()});
// courbe : réticule + infobulle
const LC={};let LCN=0;
function lcMove(e){const svg=e.target.closest&&e.target.closest('svg.lc');if(!svg)return;const c=LC[svg.id];if(!c)return;const r=svg.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*c.W;let i=Math.round((x-c.pl)/c.dx);i=Math.max(0,Math.min(c.pts.length-1,i));const p=c.pts[i],X=c.X(i),Y=c.Y(p.v);
 const g=svg.querySelector('.lc-x');g.setAttribute('visibility','visible');g.querySelector('line').setAttribute('x1',X);g.querySelector('line').setAttribute('x2',X);const ci=g.querySelector('circle');ci.setAttribute('cx',X);ci.setAttribute('cy',Y);
 tipShow('<b>'+dl(p.d)+'</b>'+(p.sal?' · 💼 salaire':'')+'<br>Solde : <b class="'+(p.v<c.floor?'neg':'')+'">'+eur(p.v)+'</b>'+(p.ev&&p.ev.length?'<div class="tip-ev">'+p.ev.map(x=>'<div><span>'+esc(x[0])+'</span><b>'+(x[1]>0?'+':'')+eur(x[1])+'</b></div>').join('')+'</div>':''),r.left+X/c.W*r.width,r.top+Y/c.H*r.height)}
document.addEventListener('pointermove',lcMove);document.addEventListener('pointerdown',lcMove);
document.addEventListener('pointerout',e=>{const svg=e.target.closest&&e.target.closest('svg.lc');if(svg&&!svg.contains(e.relatedTarget))tipHide()});
function lineChart(pts,o){const id='lc'+(++LCN),W=360,H=200,pl=44,pr=12,pt=16,pb=24,n=pts.length,floor=o.floor;
 const vs=pts.map(p=>p.v).concat([0,floor]),mx=Math.max(...vs),mn=Math.min(...vs),span=(mx-mn)||100,st=niceStep(span/3),top=Math.ceil((mx+span*0.06)/st)*st,bot=Math.floor((mn-span*0.06)/st)*st;
 const dx=n>1?(W-pl-pr)/(n-1):0,X=i=>pl+i*dx,Y=v=>pt+(top-v)*(H-pt-pb)/((top-bot)||1);LC[id]={pts,W,H,pl,dx,X,Y,floor};
 let g='';for(let v=bot;v<=top+1e-6;v+=st)g+='<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+Y(v)+'" y2="'+Y(v)+'" class="'+(Math.abs(v)<1e-6?'ax':'gr')+'"/><text x="'+(pl-6)+'" y="'+(Y(v)+3.5)+'" class="tk" text-anchor="end">'+fmtE(v)+'</text>';
 const lim='<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+Y(floor)+'" y2="'+Y(floor)+'" class="lim"/><text x="'+(pl+4)+'" y="'+(Y(floor)+11)+'" class="limt" text-anchor="start">⚠ limite '+fmtE(floor)+'</text>';
 const path=pts.map((p,i)=>(i?'L':'M')+X(i).toFixed(1)+' '+Y(p.v).toFixed(1)).join(' '),area=path+' L'+X(n-1).toFixed(1)+' '+Y(Math.max(bot,Math.min(top,0)))+' L'+X(0)+' '+Y(Math.max(bot,Math.min(top,0)))+' Z';
 const marks=pts.map((p,i)=>p.ev&&p.ev.length&&i?'<circle cx="'+X(i)+'" cy="'+Y(p.v)+'" r="4" class="mk'+(p.ev.some(x=>x[0].startsWith('🔒'))?' mk-l':'')+(p.sal?' mk-s':'')+'"/>':'').join('');
 const li=o.low?pts.findIndex(p=>p.d==o.low[0]):-1,lowL=li>0?'<text x="'+Math.min(W-pr-2,Math.max(pl+30,X(li)))+'" y="'+(Y(pts[li].v)+14)+'" class="lb" text-anchor="middle">point bas '+fmtE(pts[li].v)+'</text>':'';
 const xl=[0,Math.floor((n-1)/2),n-1].filter((v,i,a)=>a.indexOf(v)==i).map((i,k,a)=>'<text x="'+X(i)+'" y="'+(H-6)+'" class="tk" text-anchor="'+(k==0?'start':k==a.length-1?'end':'middle')+'">'+(i==0?'aujourd’hui':pts[i].sal?'💼 '+dShort(pts[i].d):dShort(pts[i].d))+'</text>').join('');
 return '<svg class="lc" id="'+id+'" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Solde prévu jour par jour, de '+eur(pts[0].v)+' à '+eur(pts[n-1].v)+'">'+g+lim+'<path d="'+area+'" class="ar"/><path d="'+path+'" class="ln"/>'+marks+lowL+xl
  +'<g class="lc-x" visibility="hidden"><line y1="'+pt+'" y2="'+(H-pb)+'" class="cx"/><circle r="5" class="cd"/></g><rect x="'+pl+'" y="0" width="'+(W-pl-pr)+'" height="'+H+'" fill="transparent"/></svg>'}
// barres horizontales classées, une seule teinte
function hbars(rows,o){o=o||{};const mx=Math.max(...rows.map(r=>r[1]),1e-9);return '<div class="hb">'+rows.map(r=>'<div class="hb-r" data-tip="'+esc('<b>'+r[0]+'</b><br>'+eur(r[1])+(o.total?' · '+Math.round(r[1]/o.total*100)+' %':'')+(r[2]?'<br>'+r[2]:''))+'"><span class="hb-l">'+r[0]+'</span><span class="hb-t"><i style="width:'+Math.max(1.5,r[1]/mx*100)+'%"></i></span><b>'+eur(r[1])+'</b></div>').join('')+'</div>'}
// barre segmentée : un tout découpé en parts (couleur fixée par part)
function segBar(parts){const tot=parts.reduce((a,p)=>a+Math.max(0,p[1]),0);if(tot<=0)return '';
 return '<div class="sb">'+parts.map((p,k)=>p[1]>0.005?'<div class="sb-p" style="flex:'+p[1]+';background:var(--c'+(k+1)+')" data-tip="'+esc('<b>'+p[0]+'</b><br>'+eur(p[1])+' · '+Math.round(p[1]/tot*100)+' %')+'">'+(p[1]/tot>=0.11?'<span style="color:'+(k==3?'#0b0b0b':'#fff')+'">'+Math.round(p[1]/tot*100)+' %</span>':'')+'</div>':'').join('')+'</div>'
 +'<div class="lg">'+parts.map((p,k)=>p[1]>0.005?'<div><i style="background:var(--c'+(k+1)+')"></i><span>'+p[0]+'</span><b>'+eur(p[1])+'</b><small>'+Math.round(p[1]/tot*100)+' %</small></div>':'').join('')+'</div>'}
// colonnes groupées : revenus / dépenses par mois
function colChart(G){const W=360,H=190,pl=44,pr=8,pt=12,pb=22,n=G.length,mx=Math.max(...G.map(g=>Math.max(g.a,g.b)),1),st=niceStep(mx/3),top=Math.ceil(mx/st)*st,gw=(W-pl-pr)/n,bw=Math.min(14,(gw-12)/2),Y=v=>pt+(top-v)*(H-pt-pb)/top,y0=Y(0);
 const bar=(x,v,cls,tip)=>{const y=Y(v),h=y0-y;if(h<0.5)return '';const r=Math.min(4,h);return '<path d="M'+x+' '+y0+' V'+(y+r)+' Q'+x+' '+y+' '+(x+r)+' '+y+' H'+(x+bw-r)+' Q'+(x+bw)+' '+y+' '+(x+bw)+' '+(y+r)+' V'+y0+' Z" class="'+cls+'" data-tip="'+esc(tip)+'"/>'};
 let s2='';for(let v=0;v<=top+1e-6;v+=st)s2+='<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+Y(v)+'" y2="'+Y(v)+'" class="'+(v?'gr':'ax')+'"/><text x="'+(pl-6)+'" y="'+(Y(v)+3.5)+'" class="tk" text-anchor="end">'+fmtE(v)+'</text>';
 G.forEach((g,i)=>{const cx=pl+gw*i+gw/2,tip='<b>'+g.lab+(g.fut?' (prévision)':'')+'</b><br>Revenus : '+eur(g.a)+'<br>Dépenses : '+eur(g.b)+'<br>Bilan : <b class="'+(g.a-g.b>=0?'pos':'neg')+'">'+(g.a-g.b>=0?'+':'')+eur(g.a-g.b)+'</b>';s2+=bar(cx-bw-1,g.a,'c1'+(g.fut?' fu':''),tip)+bar(cx+1,g.b,'c2'+(g.fut?' fu':''),tip)+'<text x="'+cx+'" y="'+(H-6)+'" class="tk'+(g.cur?' tk-b':'')+'" text-anchor="middle">'+g.short+'</text>'});
 return '<div class="lg lg-h"><div><i style="background:var(--c1)"></i><span>Revenus</span></div><div><i style="background:var(--c2)"></i><span>Dépenses</span></div></div><svg class="cc" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Revenus et dépenses des '+n+' derniers mois">'+s2+'</svg>'}
// ---------- données des graphiques ----------
function evOn(d){const y=+d.slice(0,4),m=+d.slice(5,7)-1,ev=[];
 S.items.forEach(i=>{if(+i.amt>0&&(isInst(i)||i.type=='abo'||(i.type=='travail'&&i.date))&&occ(i,d))ev.push([(isInst(i)?'🔒 ':i.type=='abo'?'🔁 ':'🛒 ')+i.title,-(isInst(i)?instAmt(i,d):+i.amt)])});
 S.rec.forEach(r=>{const o=recOcc(r,y,m);if(o&&o.date==d)ev.push([(r.sal?'💼 ':'')+r.label,o.amt])});
 S.tx.filter(t=>t.date==d&&(!S.bal||txAfter(t))).forEach(t=>ev.push([t.label,t.amt]));return ev}
function fcPath(f){const pts=[{d:TD,v:f.B,ev:[]}];let bal=f.B-f.qd-f.pd,prev=TD;
 for(let k=1;k<=f.D;k++){const d=dayAdd(TD,k);bal+=flowBetween(prev,d)+txOn(d)-(k<f.D?f.qd+f.pd:0);prev=d;const ev=evOn(d);if(k==f.D&&f.pm>0.005){bal-=f.pm;ev.push(['🎉 Argent de poche (sorti du compte)',-f.pm])}pts.push({d,v:bal,ev,sal:k==f.D})}return pts}
function fcBreak(f){let cr=0,ab=0,qd=0,fx=0,tx=0,inc=0;
 for(let k=1;k<f.D;k++){const d=dayAdd(TD,k),y=+d.slice(0,4),m=+d.slice(5,7)-1;
  S.items.forEach(i=>{if(+i.amt>0&&occ(i,d)){if(isInst(i))cr+=instAmt(i,d);else if(i.type=='abo')ab+=+i.amt;else if(i.type=='travail'&&i.date)qd+=+i.amt}});
  S.rec.forEach(r=>{const o=recOcc(r,y,m);if(o&&o.date==d){if(o.amt<0)fx-=o.amt;else inc+=o.amt}});
  S.tx.filter(t=>t.date==d&&(!S.bal||txAfter(t))).forEach(t=>{if(t.amt<0){if(t.cat!='Épargne')tx-=t.amt}else inc+=t.amt})}
 const rows=[['🛒 Logement et quotidien',qd+f.qd*f.D,'budget sans date réparti sur '+f.D+' j'+(qd?' + dépenses datées':'')],['🔒 Crédits',cr],['🔁 Abonnements',ab],['📌 Dépenses prévues',tx],['📋 Dépenses fixes',fx]].filter(r=>r[1]>0.005).sort((a,b)=>b[1]-a[1]);
 return {rows,out:rows.reduce((a,r)=>a+r[1],0),inc}}
function fcChart(f){const b=fcBreak(f);
 return '<div class="ch-t">📉 Ton solde jour par jour</div>'+lineChart(fcPath(f),{floor:f.floor,low:[f.lowDay,f.low]})
 +'<small style="margin-top:2px">Les points marquent un prélèvement ou une rentrée ; touche la courbe pour voir le détail du jour.</small>'
 +'<div class="ch-t">💸 Ce qui sort d’ici le salaire : '+eur(b.out)+'</div>'+hbars(b.rows.map(r=>[r[0],r[1],r[2]]),{total:b.out})
 +(b.inc>0.005?'<p style="margin-top:8px">💶 Rentrées d’ici là : <b class="pos">+'+eur(b.inc)+'</b></p>':'')}
function monthFlows(y,m){const all=monthAll(y,m);let a=0,b=0;all.forEach(t=>{if(t.amt>0)a+=t.amt;else if(t.cat!='Épargne')b-=t.amt});
 for(let d=1;d<=dim(y,m);d++){const s=y+'-'+pad(m+1)+'-'+pad(d);S.items.forEach(i=>{if(+i.amt>0&&(isInst(i)||i.type=='abo'||(i.type=='travail'&&i.date))&&occ(i,s))b+=isInst(i)?instAmt(i,s):+i.amt})}
 return {a,b:b+quotUndated()}}
function budgetCharts(){const c=planCalc(),y0=+TD.slice(0,4),m0=+TD.slice(5,7)-1,G=[];
 const ds=[...S.rec.map(r=>r.start),...S.tx.map(t=>t.date),...(S.sav||[]).map(x=>x.date),...(S.inv||[]).map(x=>x.date),S.bal?S.bal.date:TD].filter(Boolean).sort(),first=ds[0]||TD,back=Math.max(0,Math.min(5,mdiff(first,TD)));
 for(let k=back;k>=-2;k--){let y=y0,m=m0-k;while(m<0){m+=12;y--}while(m>11){m-=12;y++}const f=monthFlows(y,m);G.push({lab:MO[m]+' '+y,short:MO[m].slice(0,3)+'.',a:f.a,b:f.b,cur:!k,fut:k<0})}
 const parts=[['🛒 Logement et quotidien',c.qu+c.fx],['🔁 Abonnements',c.ab],['🔒 Crédits',c.cr],['🎉 Argent de poche',c.amt('poche')],['📈 Investissement',c.amt('invest')],['🐷 Épargne',c.amt('pepin')]];
 return '<h2>📊 Où va ton argent chaque mois</h2><div class="card fc">'+(c.rev>0?'<p>Sur <b>'+eur(c.rev)+'</b> de revenu'+(c.reste<0?', il manque <b class="neg">'+eur(-c.reste)+'</b> chaque mois :':' :')+'</p>':'')+segBar(parts)+'<small>Charges fixes, puis ta répartition (« Mon budget du mois »). Touche une couleur pour le détail.</small></div>'
 +'<h2>📈 Revenus et dépenses par mois</h2><div class="card fc">'+colChart(G)+'<small>En clair : les 2 prochains mois, en prévision. Dépenses = mouvements, crédits, abonnements, quotidien daté et budget du quotidien sans date (hors épargne et investissements).</small></div>'}
function fcCard(compact){const r=salRec();
 if(!r)return '<div class="card fc" role="button" tabindex="0" style="cursor:pointer" onclick="salF()"><b>💼 Mon salaire</b><small>Touche ici pour indiquer ton salaire, le jour où tu le reçois et ton découvert à ne pas dépasser : l’appli te dira si tu tiens jusqu’au prochain.</small></div>';
 const f=forecast(),hd='<div class="pl-l"><b>💼 Salaire : '+eur(r.amt)+' le '+r.day+' du mois</b><button class="pill" style="border:0;cursor:pointer" onclick="salF()">Modifier</button></div>';
 if(!f)return '<div class="card fc">'+hd+'</div>';
 const when=dl(f.nxt)+' ('+inj(f.D).toLowerCase()+')',lim=eur(f.floor);
 let body='<p>Prochain salaire : <b>'+when+'</b></p>';
 if(f.B===null)body+='<p>D’ici là, tes dépenses prévues : <b>'+eur(Math.max(0,f.need))+'</b> (argent de poche compris).</p><p><a href="#" onclick="balF();return false">Définis ton solde actuel</a> pour savoir si ça passe.</p>';
 else if(!f.def){body+=(f.low<0?'<p>Point le plus bas : <b class="neg">'+eur(f.low)+'</b> le '+dl(f.lowDay)+' (limite : '+lim+').</p>':'')
  +(f.pm>0.005?'<p>Argent de poche : <b>'+eur(f.pm)+'</b>, sorti du compte en une fois le jour du salaire (ce qu’il en reste à la fin va à l’épargne).</p>':'')
  +(f.before>0?'<p>La veille, il te restera environ <b class="pos">'+eur(f.before)+'</b> à mettre de côté.</p>':'<p>La veille, tu seras à <b>'+eur(f.before)+'</b>, dans ton découvert autorisé.</p>')}
 else{body+='<p class="neg"><b>⚠️ Tu descendrais à '+eur(f.low)+' le '+dl(f.lowDay)+'</b>, sous ta limite de '+lim+'.</p><p>Pour rester au-dessus :</p><ul style="margin:4px 0 6px 18px;padding:0">'
  +(f.cutP>0.005?'<li>remets <b>'+eur(f.cutP)+'</b> de ton argent de poche sur ton compte avant le '+dl(f.lowDay)+'</li>':'')
  +(f.cutI>0.005?'<li>prends <b>'+eur(f.cutI)+'</b> sur ton investissement S&P 500 de ce mois</li>':'')
  +(f.cutE>0.005?'<li>utilise <b>'+eur(f.cutE)+'</b> de ton épargne</li>':'')+'</ul>'
  +(f.rest>0.005?'<p class="neg"><b>Même ainsi, il manquerait '+eur(f.rest)+'</b> : décale une dépense ou un paiement.</p>':'')}
 let det=(f.B!==null?fcChart(f):'')+loanHTML(f)+'<small>Compte ton solde, tes revenus et dépenses fixes, crédits, abonnements, dépenses à venir, et ton budget du quotidien et réparti sur les jours ; l’argent de poche sort en une fois au salaire.</small>';
 if(compact&&f.B!==null){const mini='<div class="hstats" style="border:0;padding-top:2px"><span><small>Prochain salaire</small><b>'+inj(f.D)+'</b></span><span><small>Point bas</small><b class="'+(f.def?'neg':f.low<0?'warn-t':'')+'">'+eur(f.low)+'</b></span><span><small>La veille</small><b class="'+(f.before<0?'neg':'pos')+'">'+eur(f.before)+'</b></span></div>'+(f.def?'<p class="neg" style="margin:8px 0 0"><b>⚠️ Sous ta limite de '+lim+' le '+dl(f.lowDay)+'</b> : ouvre le détail pour savoir quoi faire.</p>':'');body=mini+more('fc','Voir le détail : explications, courbe, crédits',body+det)}
 else body+=compact?more('fc','Voir le détail : courbe, dépenses, crédits',det):det;if(f.B!==null&&f.D<=1)body+='<button class="go" style="margin-top:8px" onclick="savF()">🐷 C’est la veille du salaire : mettre de côté</button>';
 return '<div class="card fc">'+hd+body+'</div>'}
// ---------- S&P 500 : cours mis à jour chaque jour de bourse dans marche.json ----------
let MK=null;
function mkLoad(){fetch('marche.json?'+TD,{cache:'no-cache'}).then(r=>r.ok?r.json():null).then(j=>{if(j&&j.spx&&j.spx.length>1){MK=j;render()}}).catch(()=>{})}
function mkAt(arr,d){let lo=0,hi=arr.length-1,ans=null;while(lo<=hi){const m=(lo+hi)>>1;if(arr[m][0]<=d){ans=arr[m][1];lo=m+1}else hi=m-1}return ans==null?arr[0][1]:ans}
function idxEur(d){if(!MK)return null;return mkAt(MK.spx,d)/(MK.eurusd&&MK.eurusd.length?mkAt(MK.eurusd,d):1)}
const mkLast=()=>MK?MK.spx[MK.spx.length-1][0]:null;
function invStats(){const inv=S.inv||[],put=inv.reduce((a,i)=>a+(+i.amt),0);let val=null;
 if(S.plan.pv!==''&&S.plan.pv!=null&&!isNaN(+S.plan.pv))val=+S.plan.pv;else if(MK&&inv.length){const now=idxEur(mkLast());val=inv.reduce((a,i)=>a+(+i.amt)*now/idxEur(i.date),0)}
 return {put,val,gain:val==null?null:val-put}}
function cagr(){if(!MK||MK.spx.length<500)return null;const a=MK.spx[0][0],b=mkLast(),y=daysBetween(a,b)/365.25;return y>1?Math.pow(idxEur(b)/idxEur(a),1/y)-1:null}
function fv(V0,pmt,r,y){const rm=Math.pow(1+r,1/12)-1,n=y*12;return V0*Math.pow(1+r,y)+(rm?pmt*(Math.pow(1+rm,n)-1)/rm:pmt*n)}
const pct=x=>(x>=0?'+':'')+(x*100).toFixed(1).replace('.',',')+' %';
function rateNow(){const rc=cagr();return S.plan.rate!==''&&S.plan.rate!=null&&!isNaN(+S.plan.rate)?+S.plan.rate:(rc!=null?Math.round(rc*1000)/10:7)}
function mkHTML(st){const d=mkLast(),L=MK.spx,pts=L[L.length-1][1],ch=pts/L[L.length-2][1]-1,y1=idxEur(d)/idxEur(addM(d,-12))-1,first=(S.inv||[]).map(i=>i.date).sort()[0],rc=cagr();
 return '<p>Cours au '+dl(d)+' : <b>'+pts.toLocaleString('fr-FR')+' points</b> <span class="'+(ch>=0?'pos':'neg')+'">('+pct(ch)+' sur la séance)</span></p>'
 +'<p>Sur 1 an, en euros : <b class="'+(y1>=0?'pos':'neg')+'">'+pct(y1)+'</b>'+(rc!=null?' · moyenne sur 10 ans : <b>'+pct(rc)+' par an</b>':'')+'</p>'
 +(first&&first<=d?'<p>Depuis ton 1er achat ('+dl(first)+') : <b class="'+(idxEur(d)>=idxEur(first)?'pos':'neg')+'">'+pct(idxEur(d)/idxEur(first)-1)+'</b></p>':'')
 +'<small>Indice S&P 500 converti en euros, hors dividendes et hors frais. Mis à jour automatiquement chaque soir de bourse.</small>'}
function projRes(){const st=invStats(),V0=st.val==null?st.put:st.val,pmt=planCalc().amt('invest'),r=rateNow()/100;
 return '<p>Avec <b>'+eur(V0)+'</b> aujourd’hui et <b>'+eur(pmt)+' par mois</b> (ton budget « Investissement ») :</p>'
 +[1,5,10,20].map(y=>{const v=fv(V0,pmt,r,y),paid=V0+pmt*12*y;return '<div class="pl-l" style="margin-top:8px"><span>Dans '+y+' an'+(y>1?'s':'')+'</span><b>'+eur(v)+'</b></div><small style="margin-top:0">dont '+eur(paid)+' versés et <span class="'+(v-paid>=0?'pos':'neg')+'">'+eur(v-paid)+' d’intérêts</span></small>'}).join('')}
function epargne(){const st=invStats(),pep=pepTot(),iv=st.val==null?st.put:st.val,rc=cagr();
 let h='<h1>Épargne</h1>'+heroBox('Ton patrimoine',eur(pep+iv),'pos',[['🐷 Épargne',eur(pep)],['📈 S&P 500',eur(iv)],['Gain',st.gain!=null&&st.put?(st.gain>=0?'+':'')+eur(st.gain):'—',st.gain>=0?'pos':'neg']]);
 h+='<div class="sets" style="margin-top:8px"><button onclick="savF()">🐷<span>Mettre de côté</span></button><button onclick="invF()">📈<span>Acheter S&P</span></button><button onclick="wdF()">↩︎<span>Utiliser</span></button></div>';
 h+='<h2>📈 S&P 500</h2><div class="card cl">'+more('mk',MK?'Cours, rendement et valeur de ton portefeuille':'Valeur de ton portefeuille','<div class="fc" style="padding:0 0 10px">'+(MK?mkHTML(st):'<p>Le cours n’est pas encore disponible : la mise à jour automatique (chaque soir de bourse) n’a pas encore tourné.</p>')
  +'<label>Valeur actuelle de mon portefeuille (€, facultatif)</label><input type="number" inputmode="decimal" step="0.01" value="'+esc(S.plan.pv==null?'':S.plan.pv)+'" placeholder="'+(MK&&st.put?'Calculée : '+(st.put&&MK?(S.inv.reduce((a,i)=>a+(+i.amt)*idxEur(mkLast())/idxEur(i.date),0)).toFixed(2):''):'Ex. 250')+'" onchange="pvIn(this.value)"><small>Laisse vide pour la calculer avec le cours. Remplis-la pour recopier la valeur exacte affichée par ton courtier (frais et dividendes compris).</small></div>')+'</div>';
 h+='<h2>🔮 Intérêts composés</h2><div class="card cl">'+more('proj','Combien ça peut rapporter avec le temps','<div class="fc" style="padding:0 0 10px"><label style="margin-top:0">Rendement annuel supposé (%)</label><input type="number" inputmode="decimal" step="0.1" value="'+esc(S.plan.rate==null?'':S.plan.rate)+'" placeholder="'+String(rateNow()).replace('.',',')+'" oninput="rateIn(this.value)"><small>'+(rc!=null?'Par défaut : la moyenne des 10 dernières années ('+pct(rc)+' par an, en euros). ':'Par défaut : 7 % par an. ')+'Le passé ne garantit pas l’avenir : la bourse peut aussi baisser.</small><div id="projres">'+projRes()+'</div></div>')+'</div>';
 const hist=[...(S.sav||[]).map(x=>({...x,k:'sav'})),...(S.inv||[]).map(x=>({...x,k:'inv',dest:'invest'}))].sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
 const hrow=x=>L1({ic:x.dest=='invest'?'📈':x.amt<0?'↩︎':'🐷',t:x.dest=='invest'?'S&P 500':x.amt<0?'Retrait de l’épargne':'Épargne',s:dl(x.date)+(x.note?' · '+esc(x.note):'')+(x.k=='inv'&&MK?' · vaut '+eur(+x.amt*idxEur(mkLast())/idxEur(x.date)):''),a:(x.amt>=0?'+':'−')+eur(Math.abs(+x.amt)),ac:x.amt>=0?'pos':'neg',act:'<button class="x" aria-label="Supprimer" onclick="delSav(\''+x.k+'\',\''+x.id+'\')">✕</button>'});
 h+=sect('🧾 Historique',hist.length?listMore('hist',hist,8,hrow):'<div class="empty">Rien pour l’instant. La veille de ton salaire, touche « Mettre de côté ».</div>');
 return h}
let RT=null;
function rateIn(v){S.plan.rate=v;const e=$('#projres');if(e)e.innerHTML=projRes();clearTimeout(RT);RT=setTimeout(save,600)}
function pvIn(v){S.plan.pv=v===''?null:v;save();render()}
const chk=(id,txt)=>'<label style="display:flex;gap:8px;align-items:center;margin-top:12px"><input id="'+id+'" type="checkbox" checked style="width:auto"> '+txt+'</label>';
function savF(){const f=forecast(),base=f&&f.B!==null?Math.floor(f.D<=1?balNow():f.eve):0,marg=f&&f.B!==null?Math.min(Infinity,...loanWatch(f).filter(x=>x.next).map(x=>x.bal-f.floor)):Infinity,sug=Math.max(0,Math.floor(Math.min(base,marg))),res=Math.max(0,base-sug),ep=epShare(),inv=Math.round(sug*(100-ep)/100);
 sheet('<h2 style="margin-top:0">Mettre de côté</h2><small style="color:var(--mu);font-size:12.5px;display:block">'+(f&&f.B!==null?(f.D<=1?'C’est la veille de ton salaire : il te reste '+eur(balNow())+'.':'D’après la prévision, il devrait te rester environ '+eur(f.eve)+' la veille de ton salaire.'):'Indique ce que tu mets de côté.')+'</small>'
 +(res>0?'<small style="color:var(--rd);font-size:12.5px;display:block;margin-top:6px">🔒 '+eur(res)+' restent sur ton compte pour que tes crédits du mois prochain passent.</small>':'')+(sug>0?'<small style="color:var(--mu);font-size:12.5px;display:block;margin-top:6px">💡 Proposition : '+Math.round(ep)+' % épargne / '+Math.round(100-ep)+' % investissement'+(isAuto()?' ('+(pepTot()<ruleOf().seuil?'ton épargne est sous '+eur(ruleOf().seuil):'ton épargne a dépassé '+eur(ruleOf().seuil))+')':'')+'.</small>':'')+'<label>🐷 Vers mon épargne (€)</label><input id="v_p" type="number" inputmode="decimal" step="0.01" min="0" value="'+(sug-inv||'')+'">'
 +'<label>🎉 Reste de mon argent de poche → épargne (€)</label><input id="v_r" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0"><small style="color:var(--mu);font-size:12px;display:block;margin-top:4px">Ajouté à ton épargne sans toucher à ton compte courant (cet argent est déjà sorti).</small>'+'<label>📈 Investi dans le S&P 500 (€)</label><input id="v_i" type="number" inputmode="decimal" step="0.01" min="0" value="'+(inv||'')+'">'
 +'<label>Date</label><input id="v_d" type="date" value="'+TD+'">'+chk('v_t','Retirer ces sommes de mon compte courant')+'<button class="go" onclick="saveSav()">Enregistrer</button>')}
function saveSav(){const p=parseFloat($('#v_p').value)||0,i=parseFloat($('#v_i').value)||0,rp=parseFloat(($('#v_r')||{}).value)||0,d=$('#v_d').value||TD;if(p<0||i<0||rp<0||!(p+i+rp>0)){alert('Indique un montant à mettre de côté.');return}if(rp>0)S.sav.push({id:uid(),date:d,amt:Math.round(rp*100)/100,dest:'pepin',note:'Reste de l’argent de poche'});
 if(p>0)S.sav.push({id:uid(),date:d,amt:Math.round(p*100)/100,dest:'pepin'});if(i>0)S.inv.push({id:uid(),date:d,amt:Math.round(i*100)/100});
 if($('#v_t').checked&&p+i>0)S.tx.push({id:uid(),label:p&&i?'Épargne + S&P 500':p?'Épargne':'Investissement S&P 500',date:d,amt:-Math.round((p+i)*100)/100,cat:'Épargne',ct:Date.now()});save();closeF();render()}
function invF(){sheet('<h2 style="margin-top:0">Achat S&P 500</h2><label>Montant investi (€)</label><input id="i_a" type="number" inputmode="decimal" step="0.01" placeholder="Ex. 20"><label>Date de l’achat</label><input id="i_d" type="date" value="'+TD+'"><label>Note (facultatif)</label><input id="i_n" placeholder="Ex. ETF sur mon PEA">'+chk('i_t','Retirer ce montant de mon compte courant')+'<button class="go" onclick="saveInv()">Enregistrer</button>')}
function saveInv(){const a=parseFloat($('#i_a').value),d=$('#i_d').value||TD;if(!(a>0)){alert('Indique le montant investi.');return}S.inv.push({id:uid(),date:d,amt:Math.round(a*100)/100,note:$('#i_n').value.trim()});if($('#i_t').checked)S.tx.push({id:uid(),label:'Investissement S&P 500',date:d,amt:-Math.round(a*100)/100,cat:'Épargne',ct:Date.now()});save();closeF();render()}
function wdF(){sheet('<h2 style="margin-top:0">Utiliser mon épargne</h2><small style="color:var(--mu);font-size:12.5px;display:block">Ton épargne : '+eur(pepTot())+'.</small><label>Montant repris (€)</label><input id="w_a" type="number" inputmode="decimal" step="0.01"><label>Date</label><input id="w_d" type="date" value="'+TD+'">'+chk('w_t','Remettre ce montant sur mon compte courant')+'<button class="go" onclick="saveWd()">Enregistrer</button>')}
function saveWd(){const a=parseFloat($('#w_a').value),d=$('#w_d').value||TD;if(!(a>0)){alert('Indique le montant repris.');return}S.sav.push({id:uid(),date:d,amt:-Math.round(a*100)/100,dest:'pepin'});if($('#w_t').checked)S.tx.push({id:uid(),label:'Retrait de l’épargne',date:d,amt:Math.round(a*100)/100,cat:'Revenu',ct:Date.now()});save();closeF();render()}
function delSav(k,id){if(!confirm('Supprimer cette ligne ? Le mouvement correspondant dans ton budget n’est pas supprimé.'))return;if(k=='inv')S.inv=S.inv.filter(x=>x.id!=id);else S.sav=S.sav.filter(x=>x.id!=id);save();render()}
function salF(){const r=salRec();let days='';for(let i=1;i<=31;i++)days+='<option value="'+i+'"'+((r?r.day:1)==i?' selected':'')+'>le '+i+'</option>';
 sheet('<h2 style="margin-top:0">Mon salaire</h2><label>Montant net reçu (€)</label><input id="s_a" type="number" inputmode="decimal" step="0.01" value="'+(r?r.amt:'')+'" placeholder="Ex. 1800"><label>Je le reçois chaque mois</label><select id="s_d">'+days+'</select><small style="color:var(--mu);font-size:12px;display:block;margin-top:6px">Si le jour n’existe pas dans un mois (31…), c’est le dernier jour du mois. Le salaire est ajouté à tes revenus fixes et à « Mon budget du mois ».</small><label>Découvert à ne jamais dépasser (€)</label><input id="s_o" type="number" inputmode="decimal" step="1" min="0" value="'+esc(odLim())+'"><small style="color:var(--mu);font-size:12px;display:block;margin-top:6px">Au-delà, ta banque te prend des agios. L’appli puise d’abord sur ton argent de poche, puis sur ton investissement, pour ne pas descendre plus bas.</small><button class="go" onclick="saveSal()">Enregistrer</button>'+(r?'<button class="go" style="background:var(--ln);color:var(--ink);margin-top:8px" onclick="stopSal()">Je ne reçois plus ce salaire</button>':''))}
function saveSal(){const a=parseFloat($('#s_a').value),day=+$('#s_d').value,od=parseFloat($('#s_o').value);if(!(a>0)){alert('Indique le montant de ton salaire.');return}S.plan.od=isNaN(od)?200:Math.max(0,od);
 const y=+TD.slice(0,4),m=+TD.slice(5,7)-1;let st=y+'-'+pad(m+1)+'-'+pad(Math.min(day,dim(y,m)));if(st>TD){const Y=m?y:y-1,M=m?m-1:11;st=Y+'-'+pad(M+1)+'-'+pad(Math.min(day,dim(Y,M)))}
 const r=salRec();if(r){r.amt=a;r.day=day;if(st<r.start)r.start=st}else S.rec.push({id:uid(),sal:1,label:'Salaire',amt:a,cat:'Revenu',day,start:st});save();closeF();render()}
function stopSal(){const r=salRec();if(r&&confirm('Arrêter ce salaire ? Les mois passés restent dans l’historique.')){r.end=TD;save();closeF();render()}}
const wideAg=()=>S.tab=='ag'&&innerWidth>=1000;
// tout ce qui se passe un jour donné, avec un émoji
function dayEvents(s){const y=+s.slice(0,4),m=+s.slice(5,7)-1,L=[],h=holName(s);
 if(h)L.push({e:'🇫🇷',t:h,k:'ho'});
 on(s).forEach(i=>{const a=isInst(i)?instAmt(i,s):+i.amt||0;L.push({e:TY[i.type][2],t:(i.time?i.time+' ':'')+i.title,a:a?-a:null,k:i.type,id:i.id,dn:isDone(i,s)})});
 S.rec.forEach(r=>{const o=recOcc(r,y,m);if(o&&o.date==s)L.push({e:r.sal?'💼':o.amt>0?'💶':'📋',t:r.label,a:o.amt,k:'rec',id:r.id})});
 S.tx.filter(t=>t.date==s).forEach(t=>L.push({e:t.amt>0?'💶':t.cat=='Épargne'?'🐷':'📌',t:t.label,a:t.amt,k:'tx',id:t.id}));
 dueOn(s).forEach(d=>L.push({e:'💸',t:(d.dir=='owe'?'À rembourser : ':'À recevoir : ')+d.who,a:d.dir=='owe'?-dLeft(d):dLeft(d),k:'debt',id:d.id}));
 return L}
function bigAgenda(){const y=S.cy,m=S.cm,first=new Date(y,m,1,12),off=(first.getDay()+6)%7,nd=new Date(y,m+1,0).getDate(),weeks=Math.ceil((off+nd)/7);let tot=0,g='';
 ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'].forEach(d=>g+='<div class="bc-h">'+d+'</div>');
 for(let i=0;i<off;i++)g+='<div class="bc-x"></div>';
 for(let d=1;d<=nd;d++){const s=y+'-'+pad(m+1)+'-'+pad(d),L=dayEvents(s),wd=(off+d-1)%7;L.forEach(e=>{if(e.a&&e.k!='ho')tot+=e.a});
  const sh=L.slice(0,4).map(e=>'<span class="ev ev-'+e.k+'" title="'+esc(e.t+(e.a?' · '+eur(e.a):''))+'">'+e.e+' <span class="ev-t">'+esc(e.t)+'</span>'+(e.a?'<b class="'+(e.a>0?'pos':'')+'">'+(e.a>0?'+':'')+fmtE(e.a)+'</b>':'')+'</span>').join('')+(L.length>4?'<span class="ev ev-more">+'+(L.length-4)+' autre'+(L.length>5?'s':'')+'</span>':'');
  g+='<button class="bc-d'+(s==TD?' bc-td':'')+(s==S.sel?' bc-sel':'')+(wd>4?' bc-we':'')+(holName(s)?' bc-ho':'')+'" onclick="S.sel=\''+s+'\';render()" aria-label="'+esc(dl(s)+(L.length?' : '+L.map(e=>e.t).join(', '):''))+'"><span class="bc-n">'+d+'</span>'+sh+'</button>'}
 for(let i=(off+nd)%7;i&&i<7;i++)g+='<div class="bc-x"></div>';
 const L=dayEvents(S.sel),ev=on(S.sel),dd=dueOn(S.sel);
 return '<div class="bc-top"><h1>Agenda</h1><div class="nv"><button onclick="mv(\'c\',-1)" aria-label="Mois précédent">‹</button><b>'+MO[m]+' '+y+'</b><button onclick="mv(\'c\',1)" aria-label="Mois suivant">›</button></div><button class="pill bc-auj" style="border:0;cursor:pointer" onclick="S.cy=+TD.slice(0,4);S.cm=+TD.slice(5,7)-1;S.sel=TD;render()">Aujourd’hui</button><span class="bc-sum">Mouvements du mois : <b class="'+(tot>=0?'pos':'neg')+'">'+(tot>=0?'+':'')+eur(tot)+'</b></span></div>'
 +'<div class="bc" style="--w:'+weeks+'">'+g+'</div>'
 +'<h2>'+P(S.sel).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})+'</h2><div class="card">'
 +(holName(S.sel)?'<div class="row"><span class="dot" style="background:#0e9f6e"></span><div class="t"><b>🇫🇷 '+esc(holName(S.sel))+'</b><small>Jour férié</small></div></div>':'')
 +ev.map(i=>itemRow(i,S.sel)).join('')+dd.map(x=>debtRow(x)).join('')
 +L.filter(e=>e.k=='rec'||e.k=='tx').map(e=>'<div class="row"><div class="t"><b>'+e.e+' '+esc(e.t)+'</b><small>'+(e.k=='rec'?'Revenu ou dépense fixe':'Mouvement')+'</small></div><b class="'+(e.a>0?'pos':'')+'" style="flex:none">'+(e.a>0?'+':'')+eur(e.a)+'</b></div>').join('')
 +(!L.length?'<div class="empty">Rien ce jour-là. Appuie sur + pour ajouter quelque chose.</div>':'')+'</div>'}
let RZ=null;addEventListener('resize',()=>{clearTimeout(RZ);RZ=setTimeout(()=>{if(S.tab=='ag')render()},150)});
// ===== Argent de poche (dépenses lues dans les notifications Revolut) et achats carte hors argent de poche =====
const pk=()=>(S.poche=S.poche||{tx:[],round:{on:true,x:1}});
function pocheCycle(){const r=salRec();if(r){const {last,nxt}=payAround(r);return {from:last||TD.slice(0,8)+'01',to:nxt}}return {from:TD.slice(0,8)+'01',to:null}}
const inCyc=(d,c)=>d>=c.from&&(!c.to||d<c.to);
function roundOf(a){const R=pk().round;if(!R||!R.on)return 0;const c=Math.ceil(a-1e-9)-a;return c<0.005?0:Math.round(c*(+R.x||1)*100)/100}
const tsort=(a,b)=>(b.date+(b.time||''))>(a.date+(a.time||''))?1:-1;
function pocheStats(){const P=pk(),c=pocheCycle(),all=P.tx.filter(t=>inCyc(t.date,c)).sort(tsort),bud=Math.max(0,planCalc().amt('poche')||0),last=P.tx.filter(t=>t.bal!=null).sort(tsort)[0];
 // « Corriger » : ce qu'il y a vraiment sur Revolut à une date ; seuls les mouvements après comptent, jusqu'au prochain salaire
 const fix=P.set&&inCyc(P.set.date,c)?P.set:null,after=t=>!fix||t.date>fix.date||(t.date==fix.date&&(+t.at||0)>(+fix.at||0)),L=all.filter(after);
 const sp=L.filter(t=>!t.in).reduce((a,t)=>a+(+t.amt||0),0),inc=L.filter(t=>t.in).reduce((a,t)=>a+(+t.amt||0),0),rd=L.reduce((a,t)=>a+(+t.round||0),0),base=fix?+fix.amt:bud;
 return {c,L:all,sp,rd,inc,bud:base,fix,left:Math.round((base+inc-sp-rd)*100)/100,rev:last?last.bal:null}}
function pkSetF(){const s=pocheStats();sheet('<h2 style="margin-top:0">Corriger mon argent de poche</h2><label>Ce que j’ai vraiment sur Revolut maintenant (€)</label><input id="k_s" type="number" inputmode="decimal" step="0.01" value="'+(s.fix?s.left:'')+'" placeholder="Ex. 0">'
 +'<small style="color:var(--mu);font-size:12.5px;display:block;margin-top:6px">L’appli repart de ce montant et y ajoute ou retire les paiements suivants, jusqu’au prochain salaire ('+(s.c.to?dl(s.c.to):'—')+'). Ensuite, elle reprend le montant prévu par ton budget.</small>'
 +'<button class="go" onclick="pkSetSave()">Enregistrer</button>'+(pk().set?'<button class="go del" onclick="delete pk().set;save();closeF();render()">Revenir au calcul automatique</button>':''))}
function pkSetSave(){const a=parseFloat($('#k_s').value);if(isNaN(a)){alert('Indique un montant (0 si tu n’as rien).');return}pk().set={amt:Math.round(a*100)/100,date:TD,at:Date.now()};save();closeF();render()}
function pkRow(t){return L1({ic:t.in?'💶':'🎉',t:esc(t.label),s:dl(t.date)+(t.time?' · '+t.time:'')+(t.round?' · +'+eur(t.round)+' arrondi':'')+(t.auto?' · Revolut':''),a:(t.in?'+':'−')+eur(+t.amt),ac:t.in?'pos':'',on:"pkF('"+t.id+"')"})}
function listenHTML(){if(!(window.AgendaNative&&AgendaNative.canListen))return '<small style="display:block;margin:6px 0">Dans l’appli Android, tes paiements Revolut s’ajoutent ici tout seuls.</small>';
 return AgendaNative.canListen()?'<small style="display:block;margin:6px 0"><span class="pos">✓ Lecture automatique des notifications Revolut et Caisse d’Épargne</span> · <a href="#" onclick="rawF();return false">voir ce qui a été lu</a></small>'
  :'<p class="neg" style="margin:8px 0 4px"><b>Lecture automatique désactivée.</b> Autorise l’appli à lire les notifications pour noter tes paiements tout seul.</p><button class="go" onclick="AgendaNative.openListenerSettings()">Autoriser la lecture des notifications</button>'}
function pocheCard(){const s=pocheStats(),P=pk(),u=s.sp+s.rd,tot=s.bud+s.inc,pct=tot?Math.min(100,u/tot*100):(u?100:0);
 return '<h2 id="s-poche">🎉 Argent de poche</h2><div class="card pk">'
 +'<div class="pl-l"><b>Il te reste <span class="'+(s.left<0?'neg':'pos')+'">'+eur(s.left)+'</span>'+(s.fix?'':' sur '+eur(s.bud))+(s.inc>0.005?' (dont '+eur(s.inc)+' reçus)':'')+'</b><span style="display:flex;gap:6px"><button class="pill" style="border:0;cursor:pointer" onclick="pkSetF()">Corriger</button><button class="pill" style="border:0;cursor:pointer" onclick="pkF()">+ Dépense</button></span></div>'
 +'<div class="pk-bar" title="'+Math.round(pct)+' % utilisé"><i style="width:'+pct.toFixed(1)+'%;background:'+(s.left<0?'var(--crit)':'var(--c1)')+'"></i></div>'
 +(s.fix?'<small style="display:block">Corrigé à '+eur(+s.fix.amt)+' le '+dl(s.fix.date)+'</small>':'')+'<small style="display:block">Du '+dl(s.c.from)+(s.c.to?' au salaire du '+dl(s.c.to):'')+' : <b>'+eur(s.sp)+'</b> dépensés'+(s.rd>0.005?' + <b>'+eur(s.rd)+'</b> d’arrondis investis':'')+(s.inc>0.005?', <b class="pos">+'+eur(s.inc)+'</b> reçus':'')+'.'+(s.rev!=null?' Solde Revolut d’après la dernière notification : <b>'+eur(s.rev)+'</b>.':'')+'</small>'
 +listenHTML()+'<div class="cl-in">'+(s.L.length?listMore('pk',s.L,6,pkRow):'<div class="empty">Aucune dépense d’argent de poche depuis le salaire.</div>')+'</div>'
 +more('pkset','⚙️ Arrondi Revolut','<label class="pk-r" style="margin-top:0"><input type="checkbox" '+(P.round.on?'checked':'')+' onchange="pk().round.on=this.checked;save();render()"> Arrondi à l’euro supérieur investi par Revolut</label>'
 +(P.round.on?'<label class="pk-r">Multiplicateur de l’arrondi <select onchange="pk().round.x=+this.value;save();render()">'+[1,2,5,10].map(x=>'<option value="'+x+'"'+((+P.round.x||1)==x?' selected':'')+'>×'+x+'</option>').join('')+'</select></label>':''))
 +'</div>'}
function pkF(id){const t=id?pk().tx.find(x=>x.id==id):null;sheet('<h2 style="margin-top:0">'+(t?'Modifier la dépense':'🎉 Dépense d’argent de poche')+'</h2><div class="seg" id="k_t"><button type="button" class="'+(t&&t.in?'':'on')+'" onclick="pkT(this)">Dépense</button><button type="button" class="'+(t&&t.in?'on':'')+'" onclick="pkT(this)">Argent reçu</button></div><label>Quoi</label><input id="k_l" value="'+esc(t?t.label:'')+'" placeholder="Ex. ciné, resto"><label>Montant (€)</label><input id="k_a" type="number" inputmode="decimal" step="0.01" value="'+(t?t.amt:'')+'"><label>Date</label><input id="k_d" type="date" value="'+(t?t.date:TD)+'"><button class="go" onclick="pkSave(\''+(id||'')+'\')">Enregistrer</button>'+(id?'<button class="go del" onclick="closeF();pkDel(\''+id+'\')">Supprimer</button>':''))}
function pkT(b){[...b.parentNode.children].forEach(x=>x.classList.toggle('on',x==b))}
function pkSave(id){const ob=$('#k_t button.on'),inn=!!(ob&&ob.textContent!='Dépense');const a=parseFloat($('#k_a').value),l=$('#k_l').value.trim()||'Dépense',d=$('#k_d').value||TD;if(!(a>0)){alert('Indique le montant.');return}const a2=Math.round(a*100)/100;
 const t=id?pk().tx.find(x=>x.id==id):null;if(t){t.round=inn?0:(t.amt!=a2||t.in?roundOf(a2):t.round);Object.assign(t,{label:l,amt:a2,date:d,in:inn?1:0})}else pk().tx.push({id:uid(),label:l,amt:a2,date:d,round:inn?0:roundOf(a2),in:inn?1:0,at:Date.now()});save();closeF();render()}

function pkDel(id){const t=pk().tx.find(x=>x.id==id);if(!t||!confirm('Supprimer « '+t.label+' » ('+eur(+t.amt)+') ?'))return;pk().tx=pk().tx.filter(x=>x.id!=id);save();render()}
// Achats carte Caisse d'Épargne : déduits du budget principal (catégorie Imprévu) sauf si c'était prévu (courses, loyer…)
function cardCard(){const c=pocheCycle(),L=(S.card||[]).filter(x=>inCyc(x.date,c)).sort(tsort);if(!L.length&&!(window.AgendaNative&&AgendaNative.canListen))return '';
 const imp=L.filter(x=>x.st!='prevu'&&!x.in).reduce((a,x)=>a+(+x.amt),0),rin=L.filter(x=>x.st!='prevu'&&x.in).reduce((a,x)=>a+(+x.amt),0);
 return '<h2>💳 Compte Caisse d’Épargne (hors argent de poche)</h2><div class="card"><small style="display:block;margin-bottom:2px">Depuis le '+dl(c.from)+' · imprévus déduits : <b class="neg">'+eur(imp)+'</b>'+(rin>0.005?' · reçus : <b class="pos">+'+eur(rin)+'</b>':'')+'. Déjà prévu ? Touche « Prévu ».</small>'
 +'<div class="cl-in">'+(L.length?L.map(x=>L1({cls:x.st=='prevu'?'faded':'',ic:x.in?'💶':'💳',t:esc(x.label),s:dl(x.date)+(x.time?' · '+x.time:'')+' · '+(x.in?(x.st=='prevu'?'reçu, déjà prévu':'reçu, ajouté'):(x.st=='prevu'?'prévu, non déduit':'imprévu, déduit')),a:(x.in?'+':'−')+eur(+x.amt),ac:x.in?'pos':'neg',
  act:'<button class="mini" onclick="'+stop("cardToggle('"+x.id+"')")+'">'+(x.st=='prevu'?(x.in?'Compter':'Imprévu'):'Prévu')+'</button><button class="x" aria-label="Supprimer" onclick="'+stop("cardDel('"+x.id+"')")+'">✕</button>'})).join(''):'<div class="empty">Aucun mouvement Caisse d’Épargne lu depuis le salaire.</div>')+'</div></div>'}
const cardTx=c=>c.in?{id:'cb'+c.id,date:c.date,label:'💶 '+c.label,amt:+c.amt,cat:'Revenu',ct:c.ct||Date.now()}:{id:'cb'+c.id,date:c.date,label:'💳 '+c.label,amt:-(+c.amt),cat:'Imprévu',ct:c.ct||Date.now()};
function cardToggle(id){const c=(S.card||[]).find(x=>x.id==id);if(!c)return;S.tx=S.tx.filter(t=>t.id!='cb'+c.id);if(c.st=='prevu'){c.st='imprevu';S.tx.push(cardTx(c))}else c.st='prevu';save();render()}
function cardDel(id){const c=(S.card||[]).find(x=>x.id==id);if(!c||!confirm('Supprimer ce paiement ('+eur(+c.amt)+') ? Il ne sera plus déduit.'))return;S.card=S.card.filter(x=>x.id!=id);S.tx=S.tx.filter(t=>t.id!='cb'+id);save();render()}
// Paiements lus par l'appli Android dans les notifications (file d'attente côté téléphone)
function nimport(){try{if(!window.AgendaNative||!AgendaNative.pending)return 0;const L=JSON.parse(AgendaNative.pending()||'[]');if(!L.length)return 0;let n=0;S.card=S.card||[];
 for(const p of L){const amt=Math.round(+p.amt*100)/100;if(!(amt>0))continue;
  if(p.bank=='revolut'){if(pk().tx.some(x=>x.id==p.id))continue;const man=pk().tx.find(x=>!x.auto&&x.date==p.date&&Math.abs(+x.amt-amt)<0.005&&!x.in==!p.in);if(man){man.auto=1;if(p.bal!=null)man.bal=+p.bal;if(p.time&&!man.time)man.time=p.time;n++;continue}pk().tx.push({id:p.id,at:p.ts||Date.now(),date:p.date,time:p.time,amt,round:p.in?0:roundOf(amt),in:p.in?1:0,label:p.label||(p.in?'Argent reçu':'Paiement Revolut'),bal:p.bal==null?null:+p.bal,auto:1});n++}
  else if(p.bank=='ce'){if(S.card.some(x=>x.id==p.id))continue;if(S.tx.some(t=>!String(t.id).startsWith('cb')&&t.date==p.date&&Math.abs(Math.abs(+t.amt)-amt)<0.005&&(t.amt>0)==!!p.in))continue;const sr=salRec(),isSal=!!(p.in&&sr&&Math.abs(amt-sr.amt)<=sr.amt*0.15),c={id:p.id,date:p.date,time:p.time,amt,in:p.in?1:0,label:p.label||(p.in?(isSal?'Salaire (virement reçu)':'Virement reçu'):'Paiement carte'),st:isSal?'prevu':'imprevu',ct:p.ts||Date.now()};S.card.push(c);if(c.st!='prevu')S.tx.push(cardTx(c));n++}}
 if(n)save();AgendaNative.ack(JSON.stringify(L.map(p=>p.id)));if(n)render();return n}catch(e){console.warn('nimport',e);return 0}}
function rawF(){let L=[];try{L=JSON.parse(AgendaNative.raw()||'[]')}catch(e){}
 sheet('<h2 style="margin-top:0">Notifications bancaires lues</h2><small style="color:var(--mu);display:block">Les 15 dernières notifications Revolut et Caisse d’Épargne vues par l’appli (gardées seulement sur ce téléphone). Si un paiement est mal lu, envoie une capture de cet écran.</small>'
 +(L.length?L.slice().reverse().map(x=>'<div class="row"><div class="t"><b>'+(x.bank=='ce'?'Caisse d’Épargne':'Revolut')+' · '+esc(x.res||'')+'</b><small>'+esc(x.at||'')+'<br>'+esc(x.title||'')+' — '+esc(x.text||'')+'</small></div></div>').join(''):'<div class="empty">Rien pour l’instant.</div>'))}

// Résumé pour le widget de l'appli Android (fourni par l'appli via window.AgendaNative)
function widgetData(){const ln=d=>dayEvents(d).filter(e=>!e.dn).map(e=>e.e+' '+e.t+(e.a?' · '+eur(e.a):'')),f=forecast(),B=balNow(),n=new Date();
 return {w:widgetShort(),date:dl(TD),today:ln(TD),tomorrow:ln(dayAdd(TD,1)),bal:B===null?null:eur(B),neg:B!==null&&B<0,
  sal:f?dl(f.nxt)+' ('+inj(f.D).toLowerCase()+')':null,eve:f&&f.B!==null?eur(f.before):null,
  low:f&&f.B!==null&&f.low<0?eur(f.low)+' le '+dl(f.lowDay):null,poche:(()=>{const p=pocheStats();return p.bud||p.sp?eur(p.left)+' sur '+eur(p.bud):null})(),warn:!!(f&&f.def>0.005),at:pad(n.getHours())+':'+pad(n.getMinutes())}}
// Widget : version courte (date, solde arrondi, 3 lignes max aujourd'hui, demain en une ligne, 3 chiffres)
function widgetShort(){const e0=v=>(v<0?'−':'')+Math.abs(Math.round(v)).toLocaleString('fr-FR')+' €',f=salRec()?forecast():null,B=balNow(),p=pocheStats();
 const cl=t=>String(t).replace(/^[^\p{L}\p{N}]+/u,'').trim(),cut=t=>t.length>17?t.slice(0,16).trim()+'…':t,ev=d=>dayEvents(d).filter(e=>!e.dn&&e.k!='ho'),ln=d=>ev(d).map(e=>e.e+'  '+cut(cl(e.t))),T=ln(TD),TA=ev(TD).map(e=>e.a?(e.a>0?'+':'−')+Math.abs(e.a).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' €':''),D=ln(dayAdd(TD,1)),dd=P(TD).toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'});
 const st=[];if(p.bud||p.sp||p.fix)st.push('Poche  '+e0(p.left));if(f)st.push('Salaire  '+(f.D<=0?'auj.':'J−'+f.D));if(f&&f.B!==null)st.push((f.def?'⚠ ':'')+'Point bas  '+e0(f.low));
 return {d:dd.charAt(0).toUpperCase()+dd.slice(1),bal:B===null?'':e0(B),neg:B!==null&&B<0,t:T.slice(0,3),ta:TA.slice(0,3),tx:Math.max(0,T.length-3),tm:D.length?cl(D[0].replace(/^\S+\s+/,''))+(D.length>1?' +'+(D.length-1):''):'',st:st.join('\n'),warn:!!(f&&f.def)}}
function wpush(){try{const b=document.querySelector('.mub');if(b)b.hidden=!(window.AgendaNative&&AgendaNative.musicPlay)}catch(e){}musicSync();try{if(window.AgendaNative)AgendaNative.update(JSON.stringify(widgetData()))}catch(e){}clearTimeout(wpush.t);wpush.t=setTimeout(nsched,400)}
// Notifications programmées dans le téléphone par l'appli Android (8 jours d'avance, recalculées à chaque ouverture/synchro)
async function nsched(){try{if(!window.AgendaNative||!AgendaNative.schedule)return;const m=await import(new URL('scripts/rappels-calc.mjs',document.baseURI).href);const L=m.plan(snap(),TD,8).map(x=>({at:x.at,title:x.title,body:x.body,tag:x.tag}));AgendaNative.schedule(JSON.stringify(L));return L.length}catch(e){console.warn("nsched",e)}}
function render(){setTimeout(wpush,0);document.body.classList.toggle('wide',wideAg());
 const t=S.tab;$('#app').innerHTML=t=='home'?home():t=='ag'?agenda():t=='bu'?budget():t=='de'?dettes():t=='ep'?epargne():rappels();
 $('#nav').innerHTML=[['home','🏠','Accueil'],['ag','📅','Agenda'],['bu','💶','Budget'],['de','💳','Dettes'],['ep','🐷','Épargne'],['re','⏳','Échéances']].map(a=>'<button class="'+(t==a[0]?'on':'')+'" onclick="S.tab=\''+a[0]+'\';render();scrollTo(0,0)"><span>'+a[1]+'</span>'+a[2]+'</button>').join('');noteSync();planRender()}
function $(s){return document.querySelector(s)}
function mv(k,d){let m=S[k+'m']+d,y=S[k+'y'];if(m<0){m=11;y--}if(m>11){m=0;y++}S[k+'m']=m;S[k+'y']=y;render()}
function delIt(id){if(confirm('Supprimer cet élément ?')){S.items=S.items.filter(i=>i.id!=id);save();render()}}
function delTx(id){S.tx=S.tx.filter(i=>i.id!=id);save();render()}
let F={};
function seg(k,opts,cur){return '<div class="seg">'+opts.map(o=>'<button type="button" class="'+(cur==o[0]?'on':'')+'" onclick="F.'+k+'=\''+o[0]+'\';showForm()">'+o[1]+'</button>').join('')+'</div>'}
function openForm(){if(S.tab=='ep')return savF();$('#sh').innerHTML='';F=S.tab=='de'?{k:'debt',dm:'debt',dir:'owe',rep:'monthly'}:S.tab=='bu'?{k:'tx',kind:'out',freq:'once'}:{k:'it',type:S.tab=='re'?'renouv':'rdv',rep:'none'};showForm()}
function annivSel(d){const dd=+(F.dd||d.slice(8)),mm=F.mm||d.slice(5,7);let a='',b='';for(let i=1;i<=31;i++)a+='<option value="'+i+'"'+(i==dd?' selected':'')+'>'+i+'</option>';MO.forEach((n,i)=>{const v=pad(i+1);b+='<option value="'+v+'"'+(v==mm?' selected':'')+'>'+n+'</option>'});return '<div style="display:flex;gap:8px"><select id="f_dd" aria-label="Jour" style="flex:1">'+a+'</select><select id="f_mm" aria-label="Mois" style="flex:2">'+b+'</select></div><small style="color:var(--mu);font-size:12px;display:block;margin-top:4px">Rappelé chaque année, pas besoin de l’année.</small>'}
function showForm(){
 const v=id=>($('#'+id)||{}).value;if($('#f_t'))F.t=v('f_t'),F.d=v('f_d'),F.a=v('f_a'),F.n=v('f_n'),F.c=v('f_c'),F.l=v('f_l'),F.tot=v('f_tot'),F.h=v('f_h')??F.h,F.dd=v('f_dd')||F.dd,F.mm=v('f_mm')||F.mm,F.cap=v('f_cap')??F.cap,F.rate=v('f_rate')??F.rate,F.dur=v('f_dur')??F.dur,F.dfm=v('f_dfm')??F.dfm,F.ins=v('f_ins')??F.ins;
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
  +'<label>'+(F.type=='renouv'?'Date d’expiration':F.type=='abo'?'Date du prochain paiement':F.type=='credit'?(F.cm=='stu'&&(F.def||'p')!='n'?'Date de début du prêt (1er mois du différé)':'Date du 1er prélèvement'):F.type=='fois'?'Date de la 1re échéance':F.type=='anniv'?'Jour et mois':F.type=='travail'?'Date (facultatif)':'Date')+'</label>'+(F.type=='anniv'?annivSel(d):F.type=='travail'?'<input id="f_d" type="date" value="'+esc(F.d||'')+'"><small style="color:var(--mu);font-size:12px;display:block;margin-top:4px">Sans date : compté comme budget du mois (charges de « Mon budget du mois »). Avec une date : apparaît aussi dans l’agenda et est déduit de ton solde ce jour-là.</small>':'<input id="f_d" type="date" value="'+d+'">')+(F.type=='rdv'||F.type=='rappel'?'<label>Heure (facultatif)</label><input id="f_h" type="time" value="'+esc(F.h||'')+'"><small style="color:var(--mu);font-size:12px;display:block;margin-top:4px">Avec une heure, tu reçois aussi une notification environ 1 h avant.</small>':'')+(F.type=='fois'?'<small style="color:var(--mu);font-size:12px;display:block;margin-top:4px">Souvent le jour de l’achat. Les échéances suivantes tombent le même jour chaque mois ; celles déjà passées sont déduites.</small>':F.type=='credit'&&F.cm=='stu'?'<small style="color:var(--mu);font-size:12px;display:block;margin-top:4px">Prêt déjà commencé ? Mets sa vraie date de début : les mois déjà passés sont déduits automatiquement.</small>':F.type=='credit'?'<small style="color:var(--mu);font-size:12px;display:block;margin-top:4px">Crédit déjà commencé ? Mets la date du tout premier prélèvement : les mensualités passées sont déduites automatiquement.</small>':F.type=='anniv'?'':'<label>Répétition</label>'+seg('rep',Object.entries(RP),F.rep))
  +(F.type=='fois'?'<label>Montant total de l’achat (€)</label><input id="f_tot" type="number" inputmode="decimal" step="0.01" value="'+esc(F.tot||'')+'"><label>Nombre d’échéances</label>'+seg('nb',[['2','2 fois'],['3','3 fois'],['4','4 fois'],['10','10 fois']],F.nb||'3').replace('class="seg"','class="seg seg4"')+'<input id="f_nb" type="number" inputmode="numeric" min="2" max="60" value="'+esc(F.nb||'3')+'" oninput="F.nb=this.value" style="margin-top:6px" aria-label="Autre nombre d’échéances"><small style="color:var(--mu);font-size:12px;display:block;margin-top:4px">Ou tape un autre nombre (de 2 à 60).</small>':'')+(F.type=='credit'?credFields():'')+(F.type=='travail'?'<label>Montant (€)</label><input id="f_a" type="number" inputmode="decimal" step="0.01" value="'+esc(F.a||'')+'" placeholder="Ex. 300">':'')+(F.type=='abo'||F.type=='renouv'?'<label>Montant (€, facultatif)</label><input id="f_a" type="number" inputmode="decimal" step="0.01" value="'+esc(F.a||'')+'">':'')
  +'<label>Note (facultatif)</label><input id="f_n" value="'+esc(F.n||'')+'">'+(F.type=='abo'?'':'<label>Me prévenir (jours avant)</label><input id="f_l" type="number" inputmode="numeric" value="'+esc(F.l||'')+'" placeholder="'+({renouv:30,credit:3,fois:3,rappel:0}[F.type]??2)+'">')}
 if(F.edit)h=h.replace(/(<h2[^>]*>)[^<]*/,'$1Modifier');$('#sh').innerHTML=h+'<button class="go" onclick="submitF()">'+(F.edit?'Enregistrer les modifications':'Enregistrer')+'</button>'+(F.edit?'<button class="go del" onclick="delEdit()">'+(F.k=='rec'?'Arrêter':'Supprimer')+'</button>':'');if($('#prev'))credPrev();$('#m').classList.add('on')}
function closeF(){$('#m').classList.remove('on')}
function put(arr,o){const i=arr.findIndex(x=>x.id==o.id);if(i>=0){if(arr[i].dn&&!o.dn)o.dn=arr[i].dn;arr[i]=o}else arr.push(o)}
function openEdit(k,id){if(k=='rec'){const r0=S.rec.find(x=>x.id==id);if(r0&&r0.sal)return salF()}$('#sh').innerHTML='';let o;const st=x=>x==null?'':String(x);
 if(k=='it'){o=S.items.find(x=>x.id==id);if(!o)return;F={k:'it',edit:id,type:o.type,t:o.title,d:o.date,rep:o.rep,a:st(o.amt),n:o.note||'',l:st(o.lead),h:o.time||''};
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
 else{const it={id:F.edit||uid(),type:F.type,title:t,date:d,rep:F.rep,amt:isNaN(a)?'':a,note:$('#f_n').value.trim(),lead:$('#f_l')?$('#f_l').value:''};if($('#f_h')&&$('#f_h').value)it.time=$('#f_h').value;if(it.type=='renouv'&&it.amt===''){const c=coutDe(t);if(c){it.amt=c.a;if(!it.note)it.note=c.n}}
  if(F.type=='credit'&&F.cm=='stu'){const v=stuVals();if(!(v.C>0)){alert('Indique le montant emprunté.');return}if(!(v.r>=0&&v.r<100)){alert('Indique un taux entre 0 et 100 %.');return}if(v.def!='n'&&!(v.dfm>=1&&v.dfm<=120)){alert('Indique une durée de différé entre 1 et 120 mois.');return}if(!(v.n>=1&&v.n<=600)){alert('Indique une durée de remboursement entre 1 et 600 mois.');return}const k=stuCalc(v.C,v.r,v.n,v.def,v.dfm,v.ins);Object.assign(it,{stu:1,cap:v.C,rate:v.r,n:v.n,def:v.def,dfm:k.D,ins:v.ins,dpay:k.dPay,amt:Math.round((k.M+v.ins)*100)/100,total:k.total,rep:'monthly'})}
  else if(F.type=='credit'&&F.cm!='known'){const C=parseFloat($('#f_cap').value),r=parseFloat(($('#f_rate').value||'0').replace(',','.')),n=parseInt($('#f_dur').value,10);if(!(C>0)){alert('Indique le montant emprunté.');return}if(!(r>=0&&r<100)){alert('Indique un taux entre 0 et 100 %.');return}if(!(n>=1&&n<=600)){alert('Indique une durée entre 1 et 600 mois.');return}const M=mensu(C,r,n);it.amt=Math.round(M*100)/100;it.n=n;it.total=Math.round(M*n*100)/100;it.cap=C;it.rate=r;it.rep='monthly'}
  else if(F.type=='credit'){const tot=parseFloat($('#f_tot').value);if(!(a>0)||!(tot>0)){alert('Indique la mensualité et le montant total.');return}if(tot<a){alert('Le montant total doit être au moins égal à la mensualité.');return}it.rep='monthly';it.total=tot}
  if(F.type=='fois'){const tot=parseFloat($('#f_tot').value),nb=parseInt($('#f_nb').value,10);if(!(tot>0)){alert('Indique le montant total de l’achat.');return}if(!(nb>=2&&nb<=60)){alert('Indique un nombre d’échéances entre 2 et 60.');return}it.rep='monthly';it.total=tot;it.n=nb;it.amt=Math.round(tot/nb*100)/100}
  put(S.items,it)}}
 save();closeF();render()}
const catBar=c=>{const cap=+S.bud[c[0]]||0,over=cap&&c[1]>cap;return '<div style="margin:8px 0"><div style="display:flex;justify-content:space-between;font-size:14px"><span>'+c[0]+'</span><b class="'+(over?'neg':'')+'">'+eur(c[1])+(cap?' / '+eur(cap):'')+'</b></div><div class="bar"><i style="width:'+Math.min(100,Math.round(c[1]/(cap||1)*100))+'%;'+(over?'background:var(--rd)':'')+'"></i></div></div>'};
function alerts(){const l=S.items.filter(i=>i.type!='abo'&&i.date).map(i=>({i,s:next(i)})).filter(o=>!isDone(o.i,o.s)).filter(o=>{const n=diff(o.s),d=o.i.lead!==undefined&&o.i.lead!==''?+o.i.lead:({renouv:30,abo:7,credit:3,fois:3,rappel:0}[o.i.type]??2);return n>=0&&n<=d}).sort((a,b)=>a.s<b.s?-1:1);const dd=S.debts.filter(x=>x.due&&dLeft(x)>0&&diff(x.due)<=7);return l.length||dd.length?'<div class="card" style="border-color:var(--rd);margin-bottom:6px">'+l.map(o=>itemRow(o.i,o.s)).join('')+dd.map(x=>debtRow(x)).join('')+'</div>':''}
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
function credRow(c){const it=c.i,done=!c.l,tot=+it.total||0,inDef=it.stu&&c.k<(+it.dfm||0),m=inDef?payAt(it,c.k):+it.amt;
 return L1({cls:done?'faded':'',ic:TY[it.type][2],t:esc(it.title),s:(done?(it.type=='fois'?'payé':'remboursé'):eur(m)+(it.type=='fois'?' par échéance':'/mois')+(inDef?' (différé)':'')+' · fin '+P(credEnd(it)).toLocaleDateString('fr-FR',{month:'short',year:'numeric'}))+(it.stu?' · 🎓':''),
  bar:tot?(1-c.l/tot)*100:null,a:done?'':eur(c.l),ac:'neg',on:"openEdit('it','"+it.id+"')"})}
function debtRow(d){const l=dLeft(d),own=d.dir=='owe',c=d.due&&l?chipFor(d.due):null;
 return L1({cls:l?'':'faded',ic:own?'💸':'🤝',t:own?'Je dois à '+esc(d.who):esc(d.who)+' me doit',s:(l?'reste '+eur(l)+' sur '+eur(+d.amt):'soldée')+(d.due?' · avant le '+dl(d.due):'')+(d.note?' · '+esc(d.note):''),bar:l?dPaid(d)/(+d.amt||1)*100:null,
  a:l?eur(l):'',ac:own?'neg':'pos',chip:c?c[0]:'',cc:c?c[1]:'',on:"openEdit('debt','"+d.id+"')",act:l?'<button class="mini" onclick="'+stop("payF('"+d.id+"')")+'">'+(own?'Rembourser':'Reçu')+'</button>':''})}
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
 +'<div class="seg" style="margin-top:8px">'+(pep>0?'<button type="button" onclick="extraSet('+pep+')">🐷 Mon épargne du mois ('+eur(pep)+')</button>':'')+[50,100,200].map(v=>'<button type="button" onclick="extraSet('+v+')">'+v+' €</button>').join('')+'</div>'
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
 const tot=all.reduce((a,c)=>a+c.l,0)+owe,po=payoffCard();
 const ds=[...S.debts].sort((a,b)=>{const x=dLeft(a)>0,y=dLeft(b)>0;if(x!=y)return x?-1:1;return (a.due||'9999')<(b.due||'9999')?-1:1});
 return '<h1>Crédits et dettes</h1>'+heroBox('Reste à rembourser',eur(tot),tot?'neg':'pos',[['Par mois',eur(credMonthly())],['Je dois',eur(owe),owe?'neg':''],['On me doit',eur(owed),owed?'pos':'']])
 +sect('🏦 Crédits',cr.length?cr.map(credRow).join(''):'<div class="empty">Aucun crédit. Appuie sur + puis « Crédit ».</div>')
 +(pf.length?sect('🧾 Paiements en plusieurs fois',pf.map(credRow).join('')):'')
 +sect('🤝 Dettes et prêts entre proches',ds.length?ds.map(debtRow).join(''):'<div class="empty">Aucune dette. Appuie sur + pour en ajouter une.</div>')
 +(po?'<h2>🚀 Rembourser plus vite</h2><div class="card cl">'+more('payoff','Voir l’ordre conseillé et ce que tu gagnes','<div style="padding-bottom:8px">'+po.replace(/^<h2>[^<]*<\/h2>/,'').replace(/^<div class="card fc">/,'<div>')+'</div>')+'</div>':'')}
function delDebt(id){if(confirm('Supprimer cette dette ?')){S.debts=S.debts.filter(d=>d.id!=id);save();render()}}
function payF(id){const d=S.debts.find(x=>x.id==id);if(!d)return;const own=d.dir=='owe';sheet('<h2 style="margin-top:0">'+(own?'Remboursement à ':'Remboursement de ')+esc(d.who)+'</h2><label>Montant (€)</label><input id="p_a" type="number" inputmode="decimal" step="0.01" value="'+dLeft(d)+'"><label>Date</label><input id="p_d" type="date" value="'+TD+'"><label style="display:flex;gap:8px;align-items:center;margin-top:12px"><input id="p_b" type="checkbox" checked style="width:auto"> Ajouter aussi au budget ('+(own?'dépense':'revenu')+')</label><button class="go" onclick="savePay(\''+id+'\')">Enregistrer</button>')}
function savePay(id){const d=S.debts.find(x=>x.id==id),a=parseFloat($('#p_a').value),dt=$('#p_d').value||TD;if(!d||!(a>0)){alert('Indique un montant positif.');return}const own=d.dir=='owe';d.pays=(d.pays||[]).concat({a:Math.min(a,dLeft(d)),d:dt});if($('#p_b').checked)S.tx.push({id:uid(),ct:Date.now(),label:'Remboursement '+(own?'à ':'de ')+d.who,date:dt,amt:own?-a:a,cat:own?'Dettes':'Revenu'});save();closeF();render()}
$('#fab').onclick=openForm;mkLoad();notifCheck().then(()=>{if(S.tab=='home')render()});
render();
