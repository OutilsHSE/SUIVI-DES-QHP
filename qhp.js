/* Suivi des QHP — CDES — fonctionnement de l’outil
   Découpage V2 du 05/10/2026. Ni liste nominative, ni adresse de serveur, ni secret.
   V3 (19/10/2026) — accueil : tableau des derniers QHP ; Suivi : l'année d'abord, un mois au clic ;
   cases cliquables (a participé / N/A / absent) sans doublon ; l'animateur compte parmi les
   participants ; alerte « fiche en double » (même jour, même animateur) ; mois de départ = N/A ;
   « Animateur » remplace « Conducteur » ; liste des collaborateurs alignée sur le Référentiel. */
const APP_VERSION_QHP='V3.4.1';   // 20/10/2026 — menu d'une case du suivi : court, N/A en premier, QHP du mois en liste déroulante, reste dans l'écran
const LS='qhp_app_v5', LS_CONF='qhp_conf_v5';
const EPOCH='1970-01-01T00:00:00.000Z';
function nowISO(){return new Date().toISOString()}
/* V2 — PLUS AUCUNE LISTE NOMINATIVE DANS LA PAGE PUBLIQUE.
   Les collaborateurs viennent uniquement du serveur (onglet ROSTER), par la synchro,
   et seulement pour un appareil branché. Secteurs et agences : data/listes.json. */
let SEED={secteurs:[],agences:['IDF','NA','BPL'],roster:[]};
const SUPPORT='Fonctions Support';
let state={ secteurs:[], agences:['IDF','NA','BPL'], roster:[], chantiers:[], qhps:[], gestion:{}, exclus:{}, cadence:{} };
let conf={ objPart:80, cadStd:1, cadSup:0.25, webhook:'', secret:'', appareil:'', autoSync:true };
let editId=null,pickPres={},piecesPending=null,ficheCompacte=false,apercuPliee=false;
let anMode='collab', anAnnee=new Date().getFullYear(), anFiltre='(tous)', anMois='';   // anMois '' = année entière, sinon 0..11
const MOIS_S=['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
const MOIS_L=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const nowY=new Date().getFullYear(), nowM=new Date().getMonth();
const todayISO=new Date().toISOString().slice(0,10);
function uid(){return 'q'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function toast(m,e){const t=document.getElementById('toast');t.textContent=m;t.className=(e?'err ':'')+'show';clearTimeout(t._t);t._t=setTimeout(()=>t.className='',2600)}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function frDate(iso){const d=new Date(iso+'T00:00');if(isNaN(d))return iso;return d.getDate()+' '+MOIS_S[d.getMonth()]+' '+d.getFullYear()}
/* V3.3.1 — une date de fiche, quelle que soit sa forme (texte, instant ISO, ISO entre guillemets laissé
   par l'ancien serveur, jj/mm/aaaa), en « aaaa-mm-jj » lu à l'heure de Paris. */
function jourQ(v){if(v===null||v===undefined)return '';let s=String(v).trim().replace(/^'/,'');
  if(s.length>1&&s[0]==='"'&&s[s.length-1]==='"')s=s.slice(1,-1);
  if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
  const m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(m)return m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
  if(/^\d{4}-\d{2}-\d{2}T/.test(s)||/GMT|UTC/.test(s)){const d=new Date(s);if(!isNaN(d)){try{return new Intl.DateTimeFormat('fr-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}catch(e){return d.toISOString().slice(0,10)}}}
  return s.slice(0,10)}
function reparerDates(){(state.qhps||[]).forEach(q=>{const d=jourQ(q.date);if(d!==q.date)q.date=d});
  (state.roster||[]).forEach(p=>{p.dateAjout=jourQ(p.dateAjout);p.dateDepart=jourQ(p.dateDepart)})}
function mkey(y,i){return y+'-'+String(i+1).padStart(2,'0')}
function load(){try{const r=localStorage.getItem(LS);if(r){const s=JSON.parse(r);if(s&&Array.isArray(s.roster))state=Object.assign(state,s)}}catch(e){}
  if(!state.roster.length&&SEED){state.secteurs=SEED.secteurs.slice();state.roster=SEED.roster.map(p=>Object.assign({},p));state.agences=SEED.agences.slice()}
  if(!state.secteurs||!state.secteurs.length)state.secteurs=['Exploitation'];
  if(!state.agences||!state.agences.length)state.agences=['IDF','NA','BPL'];
  ['roster','chantiers','qhps'].forEach(k=>{if(!Array.isArray(state[k]))state[k]=[]});
  if(!state.gestion)state.gestion={}; if(!state.exclus)state.exclus={}; if(!state.cadence)state.cadence={};
  state.roster.forEach(p=>{if(p.dateAjout===undefined)p.dateAjout='';if(p.dateDepart===undefined)p.dateDepart='';if(!p.agence)p.agence='IDF'});
  if(!state.tomb)state.tomb={qhps:{},roster:{},chantiers:{},secteurs:{}};
  reparerDates();   // V3.3.1 : répare les dates déjà abîmées sur cet appareil
  ['qhps','roster','chantiers','secteurs'].forEach(k=>{if(!state.tomb[k])state.tomb[k]={}});
  if(!state.majDico)state.majDico={gestion:{},exclus:{},conf:{},cadence:{}};
  ['gestion','exclus','conf','cadence'].forEach(k=>{if(!state.majDico[k])state.majDico[k]={};const m=state.majDico[k];Object.keys(m).forEach(c=>{const s=String(m[c]||'');if(s&&!/^\d{4}-\d{2}-\d{2}T/.test(s)){const d=new Date(s);m[c]=isNaN(d)?EPOCH:d.toISOString()}})});   // V3.3.4
  try{const c=localStorage.getItem(LS_CONF);if(c)conf=Object.assign(conf,JSON.parse(c))}catch(e){}}
function save(){try{localStorage.setItem(LS,JSON.stringify(state))}catch(e){toast('Mémoire pleine — sauvegarde puis retire d\'anciens PDF',true)}}
function saveConf(){conf.objPart=Math.max(0,Math.min(100,parseInt(document.getElementById('obj-part').value)||0));
  conf.cadStd=parseFloat(document.getElementById('cad-std').value)||1;conf.cadSup=parseFloat(document.getElementById('cad-sup').value)||0.25;
  ['objPart','cadStd','cadSup'].forEach(k=>state.majDico.conf['_|'+k]=nowISO());
  try{localStorage.setItem(LS_CONF,JSON.stringify(conf))}catch(e){}save();syncAuto()}
/* PDF idb */
function idb(){return new Promise((res,rej)=>{const r=indexedDB.open('qhp_pdf',1);r.onupgradeneeded=()=>r.result.createObjectStore('pdf');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function pdfPut(id,v){try{const db=await idb();await new Promise((r,j)=>{const t=db.transaction('pdf','readwrite');t.objectStore('pdf').put(v,id);t.oncomplete=r;t.onerror=()=>j(t.error)});return true}catch(e){return false}}   // V2.2.1 : dit si c'est rangé
async function pdfGet(id){try{const db=await idb();return await new Promise((r,j)=>{const t=db.transaction('pdf','readonly');const q=t.objectStore('pdf').get(id);q.onsuccess=()=>r(q.result||null);q.onerror=()=>j(q.error)})}catch(e){return null}}
async function pdfDel(id){try{const db=await idb();await new Promise((r,j)=>{const t=db.transaction('pdf','readwrite');t.objectStore('pdf').delete(id);t.oncomplete=r;t.onerror=()=>j(t.error)})}catch(e){}}
/* helpers */
function conducteurs(){return state.roster.filter(p=>p.conducteur)}
const animateurs=conducteurs;
function actifs(){return state.roster.filter(p=>!p.dateDepart||p.dateDepart>=todayISO)}
/* V3.4 — rythme par collaborateur : curseur des Réglages (state.cadence.c[nom] = 4 ou 1), sinon le groupe
   Fonctions Support est à « 4 mois ». Une personne à 4 mois ne compte pas dans le % mensuel. */
function quatreMois(p){const v=((state.cadence||{}).c||{})[p.name];if(String(v)==='4')return true;if(String(v)==='1')return false;return p.secteur===SUPPORT}
function cadence(p){return quatreMois(p)?conf.cadSup:conf.cadStd}
function setRythme(name,quatre){if(!state.cadence)state.cadence={};if(!state.cadence.c)state.cadence.c={};
  state.cadence.c[name]=quatre?'4':'1';state.majDico.cadence['c|'+name]=nowISO();save();renderRythme();syncAuto();
  toast(name+(quatre?' : 1 QHP tous les 4 mois (hors % mensuel)':' : rythme mensuel (compté dans le %)'))}
function renderRythme(){const box=document.getElementById('ry-liste');if(!box)return;
  const sg=document.getElementById('ry-groupe');if(sg&&!sg.options.length){sg.innerHTML='<option value="">👥 Tous les groupes</option>'+state.secteurs.map(g=>'<option value="'+esc(g)+'">'+esc(g)+'</option>').join('')}
  const t=cleNomJs(document.getElementById('ry-cherche').value||''),g0=sg?sg.value:'';
  const L=actifs().filter(p=>(!t||cleNomJs(p.name).includes(t))&&(!g0||p.secteur===g0));
  const g=grouper(L);let h='';
  Object.keys(g).forEach(sec=>{const pp=g[sec];const n4=pp.filter(quatreMois).length;
    h+='<div class="ry-g"><span>'+esc(sec)+'</span><span class="muted">'+n4+' / '+pp.length+' à 4 mois</span></div>'
      +pp.map(p=>{const q=quatreMois(p),def=p.secteur===SUPPORT,force=((state.cadence||{}).c||{})[p.name]!==undefined;
        return '<label class="ry-l"><span>'+esc(p.name)+(force&&q!==def?' <span class="def">(réglé à la main)</span>':'')+'</span><span class="sw"><input type="checkbox" data-n="'+esc(p.name)+'" '+(q?'checked':'')+' onchange="setRythme(this.dataset.n,this.checked)"><i></i></span></label>'}).join('')});
  box.innerHTML=h||'<p class="hint">Aucun collaborateur ne correspond.</p>'}
function grouper(list){const g={};state.secteurs.forEach(s=>g[s]=[]);g['(sans groupe)']=[];
  (list||state.roster).forEach(p=>{const s=state.secteurs.includes(p.secteur)?p.secteur:'(sans groupe)';g[s].push(p)});
  Object.keys(g).forEach(k=>{if(!g[k].length)delete g[k]});return g}
function fillSelect(sel,opts,cur,ph){sel.innerHTML=(ph?('<option value="">'+ph+'</option>'):'')+opts.map(o=>'<option value="'+esc(o)+'"'+(o===cur?' selected':'')+'>'+esc(o)+'</option>').join('')}
function moisActif(p,y,i){
  if(p.dateAjout){const ay=+p.dateAjout.slice(0,4),am=+p.dateAjout.slice(5,7)-1;if(y<ay)return false;if(y===ay&&i<=am)return false}
  if(p.dateDepart){const dy=+p.dateDepart.slice(0,4),dm=+p.dateDepart.slice(5,7)-1;if(y>dy)return false;if(y===dy&&i>=dm)return false}   // V3 : N/A dès le mois de sortie
  return true}
function moisPasse(y,i){return y<nowY||(y===nowY&&i<=nowM)}
function estExclu(name,y,i){const k=mkey(y,i);return !!(state.exclus[k]&&state.exclus[k][name])}
function motifExclu(name,y,i){const k=mkey(y,i);return (state.exclus[k]||{})[name]||''}
function toggleExclu(name,y,i){const k=mkey(y,i);if(!state.exclus[k])state.exclus[k]={};
  if(state.exclus[k][name]){delete state.exclus[k][name];if(!Object.keys(state.exclus[k]).length)delete state.exclus[k]}else state.exclus[k][name]='N/A';
  state.majDico.exclus[k+'|'+name]=nowISO();save();renderSuivi();syncAuto()}
function agPill(a){return a&&a!=='IDF'?'<span class="agpill '+esc(a)+'">'+esc(a)+'</span>':''}
/* V2.2 — trois onglets : 🏠 Accueil (enregistrer + à vérifier + dernières fiches),
   📊 Suivi (ce mois / l'année), ⚙️ Réglages. L'historique complet s'ouvre depuis l'accueil. */
/* V3 : l'onglet Suivi est UN écran (v-suivi) : l'année entière d'abord, un mois quand on le choisit. */
function ongletDe(v){return v==='v-fiches'?'v-accueil':v}
function go(v){if(v==='v-mensuel'||v==='v-annuel')v='v-suivi';fermerPop();document.querySelectorAll('.view').forEach(s=>s.classList.remove('active'));document.getElementById(v).classList.add('active');document.querySelectorAll('nav.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.v===ongletDe(v)));
  if(v==='v-suivi')renderSuivi();if(v==='v-reglages')renderReglages();if(v==='v-fiches')renderFiches();if(v==='v-accueil')renderAccueil();window.scrollTo(0,0)}
function goSuivi(){go('v-suivi')}

/* ===== Accueil : deux commandes, scanner ou saisir ===== */
function renderAccueil(){const b=document.getElementById('acc-etat');if(!b)return;
  renderBrouillons();renderDernieres();
  b.innerHTML=syncConfigure()?'':'<div class="banner">🔌 <b>Appareil non branché.</b> Ouvre le Suivi des QHP depuis la tuile de l\'intranet HSE : la lecture automatique des fiches et l\'envoi au suivi seront activés. En attendant, ce que tu saisis reste sur cet appareil.</div>'}
function iaEtat(genre,txt){const b=document.getElementById('f-ia-etat');if(!b)return;
  b.innerHTML=txt?'<div class="banner '+(genre==='ok'?'ok':genre==='err'?'err':genre==='run'?'run':'')+'">'+txt+'</div>':''}
/* V3.3 — plus d'écran « une seule fiche » : une ou plusieurs fiches scannées (bouton ou glisser-déposer)
   vont toutes dans la liste « Fiches scannées » (certitude, Vérifier, Envoyer). */
function scanFiche(files){return deposerPlusieurs(files)}

/* ===== Fiches ===== */
/* ===== V3.3.2 — BILAN DE L'HISTORIQUE ET DOUBLONS PROBABLES =====
   Une fiche saisie à la main puis retrouvée dans un lot (ou scannée deux fois) n'est pas
   toujours repérée à l'import : animateur écrit autrement, pas d'animateur, date décalée d'un jour.
   On compare donc toutes les fiches deux à deux : même jour (ou un jour d'écart) ET même
   animateur, même chantier ou au moins la moitié des participants en commun. Rien n'est
   supprimé sans un clic ; « deux QHP différents » range la paire pour ne plus la proposer. */
const CLE_DBL_OK='qhp_dbl_ok_v1';
let dblOuvert=false;
function origineQ(q){const s=q.source||'';return s==='import'?'import':s==='scan'?'scan':s==='emargement'?'emarg':'saisie'}
const ORIG_LIB={import:'importées (lots)',scan:'scannées',emarg:'signées sur téléphone',saisie:'saisies dans l’appli (à la main ou scan vérifié)'};
const ORIG_UN={import:'importée (lot)',scan:'scannée',emarg:'signée sur téléphone',saisie:'saisie dans l’appli'};
function cleTexte(t){return String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function memeChantier(a,b){const x=cleTexte(a),y=cleTexte(b);if(!x||!y)return false;if(x===y||x.includes(y)||y.includes(x))return true;
  const my=new Set(y.split(' ').filter(w=>w.length>=4&&!['chantier','bateau','agence','canal'].includes(w)));return x.split(' ').some(w=>my.has(w))}
const MOTS_THEME_VIDES=new Set(['flash','flashs','sante','securite','regle','regles','sauve','sauvent','theme','themes','general','generale','rappel','point','joint','jointe','atelier','chantier','chantiers','retex','travail','prevention','quart','heure','accident','accidents','bateau','animation','sensibilisation']);
function motsTheme(t){return new Set(cleTexte(t).split(' ').filter(w=>w.length>=5&&!/^\d+$/.test(w)&&!MOTS_THEME_VIDES.has(w)))}
/* strict (deux fiches transcrites) : il faut un vrai mot commun ; souple (saisie à la main contre fiche
   transcrite, libellés différents) : un thème trop vague ne permet pas de conclure → « proches ». */
function themesProches(a,b,strict){const x=motsTheme(a),y=motsTheme(b);if(!x.size||!y.size)return strict?cleTexte(a)===cleTexte(b):true;
  return [...x].some(w=>y.has(w))}
function presentsQ(q){return Object.keys(q.present||{}).filter(n=>q.present[n])}
function recouvrement(a,b){const an=new Set([cleNomJs(a.cond),cleNomJs(b.cond)].filter(Boolean)),hors=n=>!an.has(cleNomJs(n));   // l'animateur ne compte pas : il est forcément des deux
  const A=presentsQ(a).filter(hors),B=new Set(presentsQ(b).filter(hors));if(!A.length||!B.size)return 0;return A.filter(n=>B.has(n)).length/Math.min(A.length,B.size)}
function richesse(q){return nbParticipants(q)+(nbPieces(q)?3:0)+(q.remontees?1:0)+(q.cond?1:0)}
function dblOk(){try{return JSON.parse(localStorage.getItem(CLE_DBL_OK)||'{}')}catch(e){return {}}}
function doublonsProbables(){
  const ok=dblOk(),L=state.qhps.filter(q=>/^\d{4}-\d{2}-\d{2}$/.test(jourQ(q.date))),out=[];
  for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++){const a=L[i],b=L[j];
    const ecart=Math.abs((new Date(jourQ(a.date)+'T12:00')-new Date(jourQ(b.date)+'T12:00'))/864e5);if(ecart>1)continue;
    const k=[a.id,b.id].sort().join('|');if(ok[k])continue;
    const anim=!!cleNomJs(a.cond)&&cleNomJs(a.cond)===cleNomJs(b.cond),ch=memeChantier(a.chantier,b.chantier),rec=recouvrement(a,b);
    const differents=!!(a.chantier&&b.chantier)&&!ch&&rec<0.3;   // deux chantiers distincts, équipes distinctes
    const deuxImports=a.source==='import'&&b.source==='import';
    const th=themesProches(a.theme,b.theme,deuxImports);
    if(!th&&deuxImports)continue;     // deux fiches transcrites, sujets différents : deux QHP (ex. 2 flashs le même jour)
    let fort=ecart===0?((anim&&(ch||rec>=0.5))||(ch&&rec>=0.5)||rec>=0.8):(anim&&ch&&rec>=0.5);
    let moyen=!fort&&(ecart===0?((anim&&!differents)||(ch&&rec>=0.3)):(ch&&rec>=0.5));
    if(fort&&!th){fort=false;moyen=true}                          // sujets différents : seulement « possible »
    if(!fort&&!moyen)continue;
    const raisons=[ecart?'un jour d’écart':'même jour'];if(!th)raisons.push('sujets différents');if(anim)raisons.push('même animateur');if(ch)raisons.push('même chantier');if(rec>0)raisons.push(Math.round(rec*100)+' % des participants en commun');
    out.push({a,b,k,fort,raisons})}
  return out.sort((x,y)=>(y.fort-x.fort)||jourQ(x.a.date).localeCompare(jourQ(y.a.date)))}
function renderBilanFiches(){const box=document.getElementById('fiches-bilan');if(!box)return;
  const n={import:0,scan:0,emarg:0,saisie:0};state.qhps.forEach(q=>n[origineQ(q)]++);
  const d=doublonsProbables(),fo=d.filter(x=>x.fort).length;
  box.innerHTML='<div class="fb"><b>'+state.qhps.length+' fiches</b> : '+Object.keys(n).filter(k=>n[k]).map(k=>'<span class="lot-pill">'+n[k]+' '+(n[k]>1?ORIG_LIB[k]:ORIG_UN[k])+'</span>').join('')
    +'<div class="row"><button class="btn '+(d.length?'btn-primary':'btn-ghost')+' btn-sm" onclick="basculerDoublons()">🔍 '+(d.length?(d.length+' doublon'+(d.length>1?'s':'')+' probable'+(d.length>1?'s':'')+(fo&&fo<d.length?' (dont '+fo+' très probable'+(fo>1?'s':'')+')':'')):'Aucun doublon probable')+(dblOuvert?' — masquer':'')+'</button></div></div>';
  renderDoublons(d)}
function basculerDoublons(){dblOuvert=!dblOuvert;renderBilanFiches()}
function carteDbl(q,conseil,k){const nb=nbParticipants(q);
  return '<div class="dbl-c'+(conseil?' conseil':'')+'">'+(conseil?'<div class="tag">✓ la plus complète — à garder</div>':'')
    +'<b>'+esc(frDate(jourQ(q.date)))+'</b> · '+esc(q.chantier||'chantier ?')+'<br>🎓 '+esc(q.cond||'sans animateur')+' · '+nb+' participant'+(nb>1?'s':'')+(nbPieces(q)?' · 📎':'')+(q.remontees?' · 💬':'')
    +'<br><span class="muted">'+esc(q.theme||'(sans thème)')+'</span><br><span class="src">'+esc(ORIG_UN[origineQ(q)])+'</span>'
    +'<div class="row"><button class="btn btn-ghost btn-sm" data-id="'+esc(q.id)+'" onclick="openDetail(this.dataset.id)">Ouvrir</button>'
    +'<button class="btn btn-ghost btn-sm" data-id="'+esc(q.id)+'" onclick="supprimerDoublon(this.dataset.id)">🗑 Supprimer celle-ci</button></div></div>'}
function renderDoublons(d){const box=document.getElementById('doublons-box');if(!box)return;
  if(!dblOuvert||!d.length){box.innerHTML='';return}
  box.innerHTML='<p class="hint">Chaque paire : deux fiches qui se ressemblent. Garde la plus complète (encadrée en vert), supprime l’autre — ou indique que ce sont deux QHP différents.</p>'
    +d.map(x=>{const ka=richesse(x.a)>=richesse(x.b);
      return '<div class="dbl-p"><div class="why">'+(x.fort?'Très probable':'Possible')+' · '+esc(x.raisons.join(' · '))+'</div><div class="dbl-g">'+carteDbl(x.a,ka)+carteDbl(x.b,!ka)+'</div>'
        +'<div class="row"><button class="btn btn-ghost btn-sm" data-k="'+esc(x.k)+'" onclick="pasDoublon(this.dataset.k)">✓ Ce sont deux QHP différents</button></div></div>'}).join('')}
function supprimerDoublon(id){const q=state.qhps.find(x=>x.id===id);if(!q)return;
  if(!confirm('Supprimer la fiche du '+frDate(jourQ(q.date))+' — '+(q.chantier||'?')+' ('+(q.cond||'sans animateur')+', '+nbParticipants(q)+' participants) ?'))return;
  pdfDel(id);pdfDel('sig_'+id);state.tomb.qhps[id]=nowISO();state.qhps=state.qhps.filter(x=>x.id!==id);
  syncFile=syncFile.filter(x=>x!==id);garderFile();
  save();renderFiches();renderDernieres();toast('Fiche supprimée');syncAuto()}
function pasDoublon(k){const ok=dblOk();ok[k]=nowISO();try{localStorage.setItem(CLE_DBL_OK,JSON.stringify(ok))}catch(e){}renderBilanFiches()}
function renderFiches(){renderBilanFiches();const box=document.getElementById('fiches-list');const list=[...state.qhps].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  if(!list.length){box.innerHTML='<div class="empty"><div class="big">📋</div>Aucune fiche QHP pour l\'instant.<br>Enregistre ton premier QHP depuis l\'onglet « Accueil ».</div>';return}
  box.innerHTML=list.map(q=>{const d=new Date(jourQ(q.date)+'T00:00');const nb=Object.values(q.present||{}).filter(Boolean).length;
    return `<div class="qhp" onclick="openDetail('${q.id}')"><div class="d"><b>${isNaN(d)?'?':d.getDate()}</b><span>${isNaN(d)?'':MOIS_S[d.getMonth()].replace('.','')}</span></div><div class="i"><div class="t">${esc(q.theme||'(sans thème)')}</div><div class="s">${esc(q.chantier||'—')}${q.cond?' · '+esc(q.cond):''} · ${nb} participant${nb>1?'s':''}${nbPieces(q)?' · 📎'+(nbPieces(q)>1?nbPieces(q):''):''}${q.emarg?' · ✍️':''}${q.remontees?' · 💬':''}</div></div><div>›</div></div>`}).join('')}
async function openFiche(id){editId=id||null;brouillonOuvert=null;certitudesFiche={};lusFiche={};const q=id?state.qhps.find(x=>x.id===id):null;iaEtat('','');
  piecesPending=id?await piecesGetOuTelecharger(id):[];
  document.getElementById('m-fiche-title').textContent=q?'Modifier la fiche QHP':'Nouvelle fiche QHP';
  document.getElementById('f-date').value=q?q.date:todayISO;document.getElementById('f-theme').value=q?q.theme||'':'';
  document.getElementById('f-remontees').value=q?(q.remontees||''):'';
  document.getElementById('dl-chantiers').innerHTML=state.chantiers.map(c=>'<option value="'+esc(c.nom)+'">').join('');
  const condNames=[...new Set(conducteurs().map(c=>c.name).concat(state.chantiers.map(c=>c.cond).filter(Boolean)))];
  document.getElementById('dl-conducteurs').innerHTML=condNames.map(n=>'<option value="'+esc(n)+'">').join('');
  document.getElementById('f-chantier').value=q?(q.chantier||''):'';document.getElementById('f-cond').value=q?(q.cond||''):'';
  document.getElementById('f-search').value='';document.getElementById('f-del').style.display=q?'':'none';
  pickPres={};state.roster.forEach(p=>pickPres[p.name]=q&&q.present?!!q.present[p.name]:false);
  ficheCompacte=false;apercuPliee=false;
  const sg=document.getElementById('f-groupe');if(sg)fillSelect(sg,state.secteurs.concat(state.agences.map(a=>'Agence '+a)),'','👥 Tous');
  renderPieces();
  renderPickNames();document.getElementById('m-fiche').classList.add('open');renderApercu()}
function chantierPickConduc(){const v=document.getElementById('f-chantier').value.trim().toLowerCase();const ch=state.chantiers.find(c=>c.nom.toLowerCase()===v);const cf=document.getElementById('f-cond');if(ch&&ch.cond&&!cf.value.trim())cf.value=ch.cond}
function renderRecap(){
  const eff=actifs();const pres=eff.filter(p=>pickPres[p.name]);const abs=eff.filter(p=>!pickPres[p.name]);
  const box=document.getElementById('f-recap');
  box.innerHTML=`<div class="rt"><span>✅ ${pres.length} participant${pres.length>1?'s':''} coché${pres.length>1?'s':''}</span><span class="muted">${abs.length} non coché${abs.length>1?'s':''}</span></div>`+
   (pres.length?('<div class="chips">'+pres.map(p=>'<span class="chip'+((certitudesFiche[p.name]||100)<85?' miss':'')+'" title="'+((certitudesFiche[p.name]||100)<85?'lu « '+esc(lusFiche[p.name]||'')+' » — '+certitudesFiche[p.name]+' % : vérifie sur l’aperçu':'')+'">'+esc(p.name)+(p.name===nomRoster(document.getElementById('f-cond').value)?' 🎓':'')+'<span class="x" data-n="'+esc(p.name)+'" onclick="retirerPick(this.dataset.n)" title="Retirer">✕</span></span>').join('')+'</div>')
    :'<div class="hint">'+(ficheCompacte?'Aucun participant reconnu : tape un nom ci-dessous.':'Coche les présents ci-dessous — ils s\'afficheront ici.')+'</div>');
}
function retirerPick(n){pickPres[n]=false;renderPickNames()}
/* V3.1 — mode COMPACT (fiche scannée / lue par l'IA) : plus de liste de 200 noms à faire défiler.
   Les reconnus sont dans le récapitulatif (✕ pour retirer) ; la liste n'apparaît que pour une
   recherche (2 lettres) ou un groupe / une agence choisi. « Afficher toute la liste » revient au mode complet. */
function filtreGroupe(list){const sg=document.getElementById('f-groupe');const v=sg?sg.value:'';if(!v)return list;
  if(v.startsWith('Agence '))return list.filter(p=>(p.agence||'IDF')===v.slice(7));
  return list.filter(p=>(state.secteurs.includes(p.secteur)?p.secteur:'(sans groupe)')===v)}
function renderPickNames(){const term=(document.getElementById('f-search').value||'').toLowerCase().trim();const box=document.getElementById('f-names');
  const sg=document.getElementById('f-groupe'),hint=document.getElementById('f-compact-hint'),tr=document.getElementById('f-toutrien');
  if(hint)hint.style.display=ficheCompacte?'':'none';if(tr)tr.style.display=ficheCompacte?'none':'';
  if(ficheCompacte&&term.length<2&&!(sg&&sg.value)){box.innerHTML='';renderRecap();return}
  const list=filtreGroupe(actifs().filter(p=>p.name.toLowerCase().includes(term)));const g=grouper(list);let h='';
  Object.keys(g).forEach(sec=>{const people=g[sec];if(!people.length)return;const on=people.filter(p=>pickPres[p.name]).length;
    h+=`<div class="secgrp"><div class="sh"><span>${esc(sec)}</span><span class="cnt">${on}/${people.length} · <a href="#" onclick="secAll('${esc(sec).replace(/'/g,"\\'")}',true);return false">tout</a> · <a href="#" onclick="secAll('${esc(sec).replace(/'/g,"\\'")}',false);return false">rien</a></span></div><div class="names">`;
    h+=people.map(p=>`<div class="nm ${pickPres[p.name]?'on':''} ${(certitudesFiche[p.name]||100)<85?'incertain':''}" title="${(certitudesFiche[p.name]||100)<85?'lu « '+esc(lusFiche[p.name]||'')+' » — '+certitudesFiche[p.name]+' % : vérifie':''}" onclick="togglePick(this,'${esc(p.name).replace(/'/g,"\\'")}')"><span class="bx">${pickPres[p.name]?'✓':''}</span><span class="nn">${esc(p.name)}${p.conducteur?' 🎓':''}${agPill(p.agence)}</span></div>`).join('');h+='</div></div>'});
  box.innerHTML=h||'<div class="hint">'+(term||(sg&&sg.value)?'Aucun nom ne correspond.':'Aucun collaborateur actif.')+'</div>';renderRecap()}
function togglePick(el,n){pickPres[n]=!pickPres[n];el.classList.toggle('on',pickPres[n]);el.querySelector('.bx').textContent=pickPres[n]?'✓':'';renderRecap()}
function secAll(sec,v){const g=grouper(actifs());(g[sec]||[]).forEach(p=>pickPres[p.name]=v);renderPickNames()}
function allNames(v){const term=(document.getElementById('f-search').value||'').toLowerCase().trim();filtreGroupe(actifs().filter(p=>p.name.toLowerCase().includes(term))).forEach(p=>pickPres[p.name]=v);renderPickNames()}
/* --- pièces jointes : PDF + photos (canaux 1 et 2) --- */
function readData(f){return new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.onerror=()=>rej(r.error);r.readAsDataURL(f)})}
async function compressImage(f,max){max=max||1600;let bmp=null;
  try{bmp=await createImageBitmap(f,{imageOrientation:'from-image'})}
  catch(e){const url=await readData(f);bmp=await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>rej(new Error('img'));im.src=url})}
  const w=bmp.width||1,h=bmp.height||1,s=Math.min(1,max/Math.max(w,h));
  const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w*s));c.height=Math.max(1,Math.round(h*s));
  const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(bmp,0,0,c.width,c.height);
  if(bmp.close)bmp.close();return c.toDataURL('image/jpeg',0.72)}
async function attachFiles(files){if(!files||!files.length)return;if(!Array.isArray(piecesPending))piecesPending=[];
  let n=0;
  for(const f of Array.from(files)){
    const isImg=(f.type||'').indexOf('image/')===0, isPdf=f.type==='application/pdf'||/\.pdf$/i.test(f.name||'');
    if(!isImg&&!isPdf){toast('Format non géré : '+(f.name||'?'),true);continue}
    try{const data=isImg?await compressImage(f):await readData(f);
      if(data.length>4200000){toast((f.name||'Fichier')+' trop lourd (>3 Mo)',true);continue}
      piecesPending.push({name:f.name||(isImg?'photo.jpg':'emargement.pdf'),type:isImg?'image/jpeg':'application/pdf',data});n++}
    catch(e){toast('Lecture impossible : '+(f.name||'?'),true)}
  }
  renderPieces();renderApercu();if(n)toast(n+' pièce'+(n>1?'s jointes':' jointe')+' ✓')}
function renderPieces(){const box=document.getElementById('f-pieces');if(!box)return;const arr=Array.isArray(piecesPending)?piecesPending:[];
  box.innerHTML=arr.map((p,i)=>{const img=(p.type||'').indexOf('image/')===0;
    return '<div class="pc"><button class="px" onclick="delPiece('+i+')" title="Retirer">✕</button>'+
      (img?'<img src="'+p.data+'" onclick="viewPending('+i+')" alt="">':'<div class="ph" onclick="viewPending('+i+')">📄</div>')+
      '<div class="pn">'+esc(p.name)+'</div></div>'}).join('');
  document.getElementById('f-pdf-info').innerHTML=arr.length?('<span class="muted">'+arr.length+' pièce'+(arr.length>1?'s':'')+' jointe'+(arr.length>1?'s':'')+' — touche une vignette pour l\'ouvrir</span>'):'';
  const bia=document.getElementById('f-ia');if(bia)bia.style.display=(arr.length&&syncConfigure())?'':'none'}
function delPiece(i){if(!Array.isArray(piecesPending))return;piecesPending.splice(i,1);renderPieces();renderApercu()}
function viewPending(i){const p=(piecesPending||[])[i];if(p)openBlob(p)}
function openBlob(p){try{const b64=String(p.data||'').split(',')[1]||'';const bin=atob(b64);const u8=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
  const url=URL.createObjectURL(new Blob([u8],{type:p.type||'application/octet-stream'}));
  const w=window.open(url,'_blank');if(!w){const a=document.createElement('a');a.href=url;a.download=p.name||'piece';a.click()}
  setTimeout(()=>URL.revokeObjectURL(url),60000)}catch(e){toast('Ouverture impossible',true)}}
async function piecesGet(id){const v=await pdfGet(id);if(!v)return [];if(Array.isArray(v.items))return v.items;if(v.data)return [{name:v.name||'Émargement.pdf',type:'application/pdf',data:v.data}];return []}
async function piecesGetOuTelecharger(id){
  let items=await piecesGet(id);
  if(!syncConfigure())return items;
  const q=state.qhps.find(x=>x.id===id);
  if(!q)return items;
  const sigLocal=await pdfGet('sig_'+id);
  const besoinPieces=nbPieces(q)>0&&items.length===0;
  const besoinSigs=!!q.emarg&&!(sigLocal&&sigLocal.sigs);
  if(!besoinPieces&&!besoinSigs)return items;
  try{const j=await syncAppel({secret:conf.secret,action:'piece-get',appareil:conf.appareil,qhpId:id},60000);
    items=(j.pieces||[]).filter(p=>p.nom!=='signatures.json').map(p=>({name:p.nom,type:p.type,data:p.dataUrl,driveId:'distant'}));
    const sg=(j.pieces||[]).find(p=>p.nom==='signatures.json');
    if(sg){try{const o=JSON.parse(decodeURIComponent(escape(atob(sg.dataUrl.split(',')[1]))));o.envoye=true;await pdfPut('sig_'+id,o)}catch(e){}}
    if(items.length)await piecesPut(id,items);
  }catch(e){}
  return items}
async function piecesPut(id,items){if(!items||!items.length){await pdfDel(id);return}await pdfPut(id,{items})}
function nbPieces(q){return q.pieces?q.pieces.length:(q.hasPdf?1:0)}
/* V3.1 — APERÇU DU SCAN en tête de fiche : la fiche d'émargement (photo, ou 1re page du PDF rendue
   par pdf.js) s'affiche en grand au-dessus des champs, pour contrôler d'un coup d'œil ce que l'IA a lu.
   Plusieurs pièces : ◀ ▶. Touche l'image pour l'ouvrir en plein écran, l'en-tête pour la replier. */
let apercuIdx=0;
async function apercuImage(p){
  if(!p)return '';
  if((p.type||'').indexOf('image/')===0)return p.data;
  if(p.type==='application/pdf'){if(p.apercu)return p.apercu;try{const pages=await pdfEnImages(p.data,1);p.apercu=pages[0]||'';return p.apercu}catch(e){return ''}}
  return ''}
async function renderApercu(){
  const box=document.getElementById('f-apercu');if(!box)return;const arr=Array.isArray(piecesPending)?piecesPending:[];
  if(!arr.length){box.style.display='none';box.innerHTML='';return}
  if(apercuIdx>=arr.length)apercuIdx=0;const p=arr[apercuIdx];
  box.style.display='';box.className='apercu'+(apercuPliee?' pliee':'');
  box.innerHTML='<div class="ap-h" onclick="apercuPliee=!apercuPliee;renderApercu()"><b>🖼 Fiche scannée</b><span>'+esc(p.name)+(arr.length>1?' · '+(apercuIdx+1)+'/'+arr.length:'')+'</span><span class="grow"></span>'
    +(arr.length>1?'<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();apercuIdx=(apercuIdx+'+(arr.length-1)+')%'+arr.length+';renderApercu()">◀</button><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();apercuIdx=(apercuIdx+1)%'+arr.length+';renderApercu()">▶</button>':'')
    +'<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();apercuPliee=!apercuPliee;renderApercu()">'+(apercuPliee?'Agrandir':'Replier')+'</button></div><div class="ap-i"><span class="hint" style="padding:8px;display:block">chargement…</span></div>';
  const src=await apercuImage(p);const zone=box.querySelector('.ap-i');if(!zone)return;
  zone.innerHTML=src?'<img src="'+src+'" alt="fiche scannée" onclick="'+(apercuPliee?'apercuPliee=false;renderApercu()':'viewPending('+apercuIdx+')')+'">':'<span class="hint" style="padding:8px;display:block">Aperçu indisponible — touche la vignette ci-dessous pour ouvrir le fichier.</span>';
}
/* --- glisser-déposer : TOUTE la page est une zone de dépôt --- */
(function(){
  const ov=document.getElementById('dropov');let hideT=null;
  function hasFiles(e){const dt=e.dataTransfer;if(!dt)return false;
    if(dt.types){for(let i=0;i<dt.types.length;i++)if(dt.types[i]==='Files')return true}
    return !!(dt.files&&dt.files.length)}
  function filesOf(e){const dt=e.dataTransfer;if(!dt)return [];
    if(dt.files&&dt.files.length)return Array.from(dt.files);
    const out=[];if(dt.items){for(let i=0;i<dt.items.length;i++){if(dt.items[i].kind==='file'){const f=dt.items[i].getAsFile();if(f)out.push(f)}}}
    return out}
  function show(v){if(ov)ov.classList.toggle('on',v);const dz=document.getElementById('f-drop');if(dz)dz.classList.toggle('over',v)}
  function ping(){show(true);clearTimeout(hideT);hideT=setTimeout(()=>show(false),260)}
  // on bloque le comportement par défaut du navigateur (qui ouvrirait le PDF et ferait perdre la saisie)
  ['dragenter','dragover'].forEach(ev=>window.addEventListener(ev,e=>{if(!hasFiles(e))return;
    e.preventDefault();try{e.dataTransfer.dropEffect='copy'}catch(_){}ping()},false));
  window.addEventListener('dragend',()=>{clearTimeout(hideT);show(false)},false);
  window.addEventListener('drop',async e=>{
    if(!hasFiles(e)&&!(e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files.length))return;
    e.preventDefault();clearTimeout(hideT);show(false);
    const fs=filesOf(e);if(!fs.length){toast('Fichier non lisible — utilise le bouton « choisir »',true);return}
    const em=document.getElementById('app-emarg');
    if(em&&em.style.display==='block'){toast("Termine la fiche d'émargement, puis joins le fichier depuis la fiche QHP",true);return}
    if(!document.getElementById('m-fiche').classList.contains('open')){scanFiche(fs);return}
    attachFiles(fs);
  },false);
})();
async function saveFiche(force){const date=document.getElementById('f-date').value,theme=document.getElementById('f-theme').value.trim();
  if(!date){toast('Renseigne la date',true);return}if(!theme){toast('Renseigne le thème',true);return}
  const condSaisi=document.getElementById('f-cond').value.trim();
  const an=nomRoster(condSaisi);if(an)pickPres[an]=true;   // V3 : l'animateur participe
  if(!force){const dbl=doublonFiche(date,condSaisi,editId);
    if(dbl){demanderDoublon(dbl,()=>saveFiche(true),()=>{const pending=piecesPending;openFiche(dbl.id).then(()=>{if(Array.isArray(pending)&&pending.length){piecesPending=(piecesPending||[]).concat(pending);renderPieces()}})});return}}
  const present={};state.roster.forEach(p=>{if(pickPres[p.name])present[p.name]=true});
  let q;if(editId)q=state.qhps.find(x=>x.id===editId);else{q={id:uid()};state.qhps.push(q)}
  q.date=date;q.theme=theme;q.chantier=document.getElementById('f-chantier').value.trim();q.cond=document.getElementById('f-cond').value.trim();
  q.remontees=document.getElementById('f-remontees').value.trim();q.present=present;q.maj=nowISO();
  majChantier(q);
  if(Array.isArray(piecesPending)){await piecesPut(q.id,piecesPending);
    q.pieces=piecesPending.map(p=>({name:p.name,type:p.type}));q.hasPdf=piecesPending.length>0;q.pdfName=piecesPending.length?piecesPending[0].name:''}
  if(brouillonOuvert){const bid=brouillonOuvert;state.brouillons=brouillons().filter(x=>x.id!==bid);pdfDel('br_'+bid);brouillonOuvert=null}
  save();closeModal();renderFiches();renderAccueil();toast(editId?'Fiche mise à jour ✓':'Fiche enregistrée ✓');
  syncAuto(q.id)}
function majChantier(q){if(!q.chantier)return;const ex=state.chantiers.find(c=>c.nom.toLowerCase()===q.chantier.toLowerCase());
  if(ex){ex.nom=q.chantier;if(q.cond)ex.cond=q.cond;ex.maj=nowISO()}else state.chantiers.push({id:uid(),nom:q.chantier,cond:q.cond||'',maj:nowISO()})}
function deleteFiche(){if(!editId)return;if(!confirm('Supprimer cette fiche QHP ?'))return;pdfDel(editId);pdfDel('sig_'+editId);
  state.tomb.qhps[editId]=nowISO();state.qhps=state.qhps.filter(x=>x.id!==editId);syncFile=syncFile.filter(x=>x!==editId);garderFile();save();closeModal();renderFiches();toast('Fiche supprimée');syncAuto()}
async function openDetail(id){const q=state.qhps.find(x=>x.id===id);if(!q)return;
  const pres=state.roster.filter(p=>q.present&&q.present[p.name]);
  const g=grouper(pres);let byg='';Object.keys(g).forEach(s=>{byg+=`<div style="margin-top:6px"><b class="small" style="color:var(--marine)">${esc(s)}</b><div>${g[s].map(p=>'<span class="pill ok" style="margin:2px">'+esc(p.name)+'</span>').join(' ')}</div></div>`});
  document.getElementById('detail-body').innerHTML=`<div class="grab"></div><h2>${esc(q.theme||'(sans thème)')}</h2><p class="muted small">${frDate(q.date)} · ${esc(q.chantier||'—')}${q.cond?' · 🎓 animateur : '+esc(q.cond):''}</p>
    <div class="kpis" style="margin:12px 0"><div class="kpi"><div class="v">${pres.length}</div><div class="l">Participants</div></div><div class="kpi"><div class="v">${actifs().length?Math.round(pres.length/actifs().length*100):0}%</div><div class="l">de l'effectif</div></div></div>
    ${q.remontees?`<label class="f">Remontées terrain</label><div class="card" style="margin:0 0 10px;padding:10px;white-space:pre-wrap">${esc(q.remontees)}</div>`:''}
    ${q.emarg?`<button class="btn btn-primary btn-block" style="margin-bottom:8px" onclick="printEmarg('${q.id}')">✍️ Ouvrir la fiche signée (impression / PDF)</button>`:''}
    <label class="f">Pièces jointes (${nbPieces(q)})</label>
    <div id="d-pieces" class="pieces">${nbPieces(q)?'<span class="muted small">chargement…</span>':'<span class="muted small">aucune</span>'}</div>
    ${q.externes&&q.externes.length?`<label class="f">Intervenants extérieurs</label><div>${q.externes.map(e=>'<span class="pill" style="margin:2px">'+esc(e.name)+(e.soc?' · '+esc(e.soc):'')+'</span>').join(' ')}</div>`:''}
    <label class="f">Participants CDES (${pres.length})</label>${byg||'<span class="muted small">aucun</span>'}
    <p class="hint">Pour ajouter ou retirer un participant : ✏ Modifier, ou touche sa case dans le Suivi.</p>
    <div class="row" style="margin-top:16px"><button class="btn btn-ghost grow" onclick="closeModal()">Fermer</button><button class="btn btn-primary grow" onclick="closeModal();openFiche('${q.id}')">✏ Modifier</button></div>`;
  document.getElementById('m-detail').classList.add('open');
  if(nbPieces(q)){const items=await piecesGetOuTelecharger(q.id);const box=document.getElementById('d-pieces');if(!box)return;
    box.innerHTML=items.length?items.map((p,i)=>{const img=(p.type||'').indexOf('image/')===0;
      return '<div class="pc">'+(img?'<img src="'+p.data+'" onclick="viewStored(\''+q.id+'\','+i+')" alt="">':'<div class="ph" onclick="viewStored(\''+q.id+'\','+i+')">📄</div>')+'<div class="pn">'+esc(p.name)+'</div></div>'}).join('')
      :'<span class="muted small">pièce introuvable sur cet appareil</span>'}}
async function viewStored(id,i){const items=await piecesGetOuTelecharger(id);const p=items[i];if(!p){toast('Pièce introuvable',true);return}openBlob(p)}
function closeModal(){document.querySelectorAll('.modal').forEach(m=>m.classList.remove('open'))}
document.querySelectorAll('.modal').forEach(m=>m.addEventListener('mousedown',e=>{if(e.target===m)closeModal()}));

/* ============================================================================
   SYNCHRONISATION  —  webhook Apps Script + Google Sheets
   Fusion élément par élément : pour chaque fiche / collaborateur / chantier,
   c'est la version dont l'horodatage « maj » est le plus récent qui gagne.
   Une suppression est une pierre tombale horodatée : elle gagne aussi si elle
   est plus récente. Rien n'écrase le travail d'un autre appareil.
   Tant qu'aucune adresse webhook n'est renseignée, ce module est inerte.
   ============================================================================ */
let syncEnCours=false, syncTimer=null, syncFile=[];
/* V3.3.1 — la file des scans à envoyer survit à la fermeture de la page */
const LS_FILE='qhp_envois_v1';
try{const f=JSON.parse(localStorage.getItem(LS_FILE)||'[]');if(Array.isArray(f))syncFile=f}catch(e){}
function garderFile(){try{localStorage.setItem(LS_FILE,JSON.stringify(syncFile))}catch(e){}}
/* Reprise : un scan importé ou scanné ces 7 derniers jours, resté sur l'appareil sans avoir été envoyé
   (page fermée pendant l'envoi, avant la V3.3.1), est remis dans la file. */
async function repriseEnvois(){try{const lim=new Date(Date.now()-7*864e5).toISOString();let n=0;
  for(const q of state.qhps){if(!(q.source==='import'||q.source==='scan')||String(q.maj||'')<lim||!nbPieces(q)||syncFile.includes(q.id))continue;
    const it=await piecesGet(q.id);if(it.length&&it.some(p=>!p.driveId)){syncFile.push(q.id);n++}}
  if(n){garderFile();syncAuto()}return n}catch(e){return 0}}
function syncConfigure(){return !!conf.webhook}
function syncEtat(txt,cls){const el=document.getElementById('sync-etat');if(el)el.innerHTML='<span class="'+(cls||'')+'">'+esc(txt)+'</span>'}
function dicoPayload(dico,majs){
  const out=[],vus={};
  Object.keys(majs||{}).forEach(k=>{
    const i=k.indexOf('|');if(i<0)return;
    const g=k.slice(0,i),n=k.slice(i+1);
    const v=(dico[g]&&dico[g][n]!==undefined)?dico[g][n]:'';
    out.push({cle:k,maj:majs[k],valeur:v});vus[k]=1});
  Object.keys(dico||{}).forEach(g=>Object.keys(dico[g]||{}).forEach(n=>{
    const k=g+'|'+n;if(!vus[k])out.push({cle:k,maj:EPOCH,valeur:dico[g][n]})}));
  return out}
function syncPayload(){
  const tombes=(map,cle)=>Object.keys(map||{}).map(k=>{const o={maj:map[k],supprime:true};o[cle]=k;return o});
  return {secret:conf.secret,action:'sync',appareil:conf.appareil||'appareil',data:{
    qhps:state.qhps.map(q=>Object.assign({},q,{maj:q.maj||EPOCH})).concat(tombes(state.tomb.qhps,'id')),
    roster:state.roster.map(p=>Object.assign({},p,{maj:p.maj||EPOCH})).concat(tombes(state.tomb.roster,'name')),
    chantiers:state.chantiers.map(c=>Object.assign({},c,{maj:c.maj||EPOCH})).concat(tombes(state.tomb.chantiers,'id')),
    secteurs:state.secteurs.map((n,i)=>({nom:n,maj:EPOCH,ordre:i})).concat(tombes(state.tomb.secteurs,'nom')),
    gestion:dicoPayload(state.gestion,state.majDico.gestion),
    exclus:dicoPayload(state.exclus,state.majDico.exclus),
    cadence:dicoPayload(state.cadence||{},state.majDico.cadence||{}),   // V3.4
    conf:dicoPayload({'_':{objPart:conf.objPart,cadStd:conf.cadStd,cadSup:conf.cadSup}},state.majDico.conf)
  }}}
/* Le piège classique : coller l'adresse de TEST (/dev) au lieu de celle du
   déploiement (/exec). La première ne marche que dans le navigateur où tu es
   connecté à Google — d'où un « Failed to fetch » incompréhensible. */
function verifierUrl(u){
  u=String(u||'').trim();
  if(!u)return "Renseigne l'adresse du webhook.";
  if(/\/dev\/?$/.test(u))return "Cette adresse finit par /dev : c'est l'adresse de TEST, elle ne fonctionne que dans ton navigateur connecté à Google. Il te faut celle qui finit par /exec — Déployer ▸ Gérer les déploiements ▸ copier l'URL de l'application Web.";
  return ''}
function urlInhabituelle(u){
  u=String(u||'').trim();
  return /^https:\/\/script\.google\.com\//.test(u)&&!/\/exec\/?$/.test(u)
    ? " · attention, l'adresse ne finit pas par /exec" : ''}
async function syncAppel(payload,ms){
  const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),ms||45000);
  try{
    const r=await fetch(conf.webhook,{method:'POST',redirect:'follow',signal:ctrl.signal,
      headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)});
    const txt=await r.text();
    let j;try{j=JSON.parse(txt)}catch(e){throw new Error('Réponse inattendue du serveur — vérifie « Qui a accès : Tout le monde » dans le déploiement')}
    if(!j.ok)throw new Error(j.erreur||'Erreur serveur');
    return j}
  catch(e){
    if(e&&e.name==='AbortError')throw new Error('Le serveur ne répond pas (délai dépassé)');
    if(e instanceof TypeError)throw new Error("Impossible de joindre l'adresse. "+(verifierUrl(conf.webhook)||'Vérifie ta connexion internet, et que le déploiement est en « Qui a accès : Tout le monde »'));
    throw e}
  finally{clearTimeout(t)}}
/* V3.3.3 — la réponse d'une synchro reflète l'appareil AU DÉPART de la synchro. Ce qui a changé ici
   pendant qu'elle tournait (fiche supprimée, ajoutée, modifiée — par exemple pendant l'envoi des scans)
   ne doit pas être écrasé : on garde les pierres tombales locales plus récentes, les fiches locales
   plus récentes que celles du serveur, et celles créées depuis le départ. Ces changements partent
   à la synchro suivante, relancée automatiquement. */
function fusionReponse(d,t0){
  const tombL=state.tomb.qhps||{},tomb=Object.assign({},d.tombQhps||{});
  Object.keys(tombL).forEach(k=>{if(!tomb[k]||String(tombL[k])>String(tomb[k]))tomb[k]=tombL[k]});
  const loc={};(state.qhps||[]).forEach(q=>loc[q.id]=q);
  const vus={},out=[];
  d.qhps.forEach(q0=>{const q=Object.assign({},q0,{date:jourQ(q0.date)}),l=loc[q.id];vus[q.id]=1;
    const v=(l&&String(l.maj||'')>String(q.maj||''))?l:q;
    if(tomb[v.id]&&String(tomb[v.id])>=String(v.maj||''))return;   // supprimée (ici ou ailleurs) après sa dernière modification
    out.push(v)});
  (state.qhps||[]).forEach(l=>{if(vus[l.id])return;
    if(String(l.maj||'')>=String(t0||'')&&!(tomb[l.id]&&String(tomb[l.id])>=String(l.maj||'')))out.push(l)});   // créée pendant la synchro
  state.tomb.qhps=tomb;
  return out}
/* V3.3.4 — un horodatage relu peut être « Tue Oct 20 2026 … » (date Sheets mise en texte par l'ancien
   serveur) : on le remet en ISO, sinon il paraît toujours plus récent qu'un horodatage de l'appli. */
function majIso(v){const s=String(v||'');if(/^\d{4}-\d{2}-\d{2}T/.test(s))return s;const d=new Date(s);return (s&&!isNaN(d))?d.toISOString():EPOCH}
function fusionDico(nom,srv,srvMaj){if(!srv)return;
  const loc=state[nom]||{},locMaj=state.majDico[nom]||{},out={},maj={};
  Object.keys(srv).forEach(g=>{out[g]=Object.assign({},srv[g])});
  Object.keys(srvMaj||{}).forEach(k=>maj[k]=majIso(srvMaj[k]));
  Object.keys(locMaj).forEach(k=>{const ml=majIso(locMaj[k]);if(maj[k]&&ml<=maj[k])return;   // le serveur a plus récent (ou pareil)
    const i=k.indexOf('|');if(i<0)return;const g=k.slice(0,i),n=k.slice(i+1);
    const v=loc[g]&&loc[g][n]!==undefined?loc[g][n]:'';
    if(v===''||v===null){if(out[g]){delete out[g][n];if(!Object.keys(out[g]).length)delete out[g]}}else{(out[g]=out[g]||{})[n]=v}
    maj[k]=ml});
  state[nom]=out;state.majDico[nom]=maj}
function appliquerSync(d,t0){
  if(Array.isArray(d.qhps))state.qhps=fusionReponse(d,t0);   // V3.3.3 (dates réparées dans fusionReponse, V3.3.1)
  if(Array.isArray(d.roster))state.roster=d.roster.map(p=>{const o=Object.assign({dateAjout:'',dateDepart:'',agence:'IDF'},p);o.dateAjout=jourQ(o.dateAjout);o.dateDepart=jourQ(o.dateDepart);return o});
  state.rosterSource=d.rosterSource==='referentiel'?'referentiel':'appli';   // V2.1 : liste tenue dans le Référentiel CDES
  if(d.referentiel&&typeof d.referentiel==='object')state.referentiel=d.referentiel;   // V3 : état du branchement, en clair
  if(Array.isArray(d.chantiers))state.chantiers=d.chantiers;
  if(Array.isArray(d.secteurs)&&d.secteurs.length)state.secteurs=d.secteurs;
  if(d.tombRoster)state.tomb.roster=d.tombRoster;
  fusionDico('gestion',d.gestion,d.gestionMaj);   // V3.3.4 : garde les cases changées ici pendant la synchro
  fusionDico('exclus',d.exclus,d.exclusMaj);
  fusionDico('cadence',d.cadence,d.cadenceMaj);   // V3.4
  if(d.conf){['objPart','cadStd','cadSup'].forEach(k=>{if(d.conf[k]!==undefined&&d.conf[k]!=='')conf[k]=Number(d.conf[k])})}
  if(d.confMaj)state.majDico.conf=d.confMaj;
  state.roster.forEach(p=>{p.conducteur=(p.conducteur===true||p.conducteur==='oui')});
  save();try{localStorage.setItem(LS_CONF,JSON.stringify(conf))}catch(e){}}
async function syncNow(manuel){
  if(!syncConfigure()){if(manuel)toast('Renseigne d\'abord l\'adresse du webhook',true);return false}
  if(syncEnCours){if(manuel)toast('Synchro déjà en cours…');return false}
  syncEnCours=true;syncRelance=false;syncEtat('⏳ Synchronisation…','muted');
  const t0=nowISO();
  try{
    const j=await syncAppel(syncPayload());
    appliquerSync(j.data||{},t0);
    renderFiches();renderDernieres();   // V3.3.3 : l'écran suit tout de suite, avant l'envoi des scans
    const aEnvoyer=syncFile.slice(),reste=[];
    for(const id of aEnvoyer){if(!state.qhps.some(q=>q.id===id))continue;   // fiche supprimée entre-temps : rien à envoyer
      try{await pousserPieces(id)}catch(e){reste.push(id)}}
    syncFile=reste.concat(syncFile.filter(id=>!aEnvoyer.includes(id)));garderFile();   // V3.3.3 : garde ce qui a été ajouté pendant l'envoi
    conf.dernierSync=nowISO();try{localStorage.setItem(LS_CONF,JSON.stringify(conf))}catch(e){}
    renderFiches();renderDernieres();
    if(document.getElementById('v-suivi').classList.contains('active'))renderSuivi();
    if(document.getElementById('v-reglages').classList.contains('active'))renderReglages();
    syncEtat('✅ Synchronisé à '+new Date().toLocaleTimeString('fr-FR').slice(0,5),'ok-txt');
    if(manuel)toast('Synchronisé ✓ — '+state.qhps.length+' fiches');
    return true}
  catch(e){
    syncEtat('⚠️ '+(e.message||'échec'),'err-txt');
    if(manuel)toast('Échec : '+(e.message||'?'),true);
    return false}
  finally{syncEnCours=false;if(syncRelance){syncRelance=false;clearTimeout(syncTimer);syncTimer=setTimeout(()=>syncNow(false),1500)}}}
let syncRelance=false;
function syncAuto(idFiche){
  if(idFiche&&syncFile.indexOf(idFiche)<0){syncFile.push(idFiche);garderFile()}
  if(!syncConfigure()||conf.autoSync===false)return;
  if(syncEnCours){syncRelance=true;return}   // V3.3.3 : une synchro tourne → on en relance une à la fin
  clearTimeout(syncTimer);syncTimer=setTimeout(()=>syncNow(false),2500)}
async function pousserPieces(qhpId){
  const items=await piecesGet(qhpId);
  let modif=false;
  for(const p of items){
    if(p.driveId)continue;
    await syncAppel({secret:conf.secret,action:'piece-put',appareil:conf.appareil,
      qhpId,nom:p.name,type:p.type,dataUrl:p.data},60000);
    p.driveId='envoye';modif=true;
  }
  if(modif)await piecesPut(qhpId,items);
  const st=await pdfGet('sig_'+qhpId);
  if(st&&st.sigs&&!st.envoye){
    await syncAppel({secret:conf.secret,action:'piece-put',appareil:conf.appareil,
      qhpId,nom:'signatures.json',type:'application/json',
      dataUrl:'data:application/json;base64,'+btoa(unescape(encodeURIComponent(JSON.stringify({sigs:st.sigs,noms:st.noms}))))},60000);
    st.envoye=true;await pdfPut('sig_'+qhpId,st);
  }}
async function testerWebhook(){
  const u=document.getElementById('sy-url').value.trim(),s=document.getElementById('sy-secret').value.trim();
  const pb=verifierUrl(u);
  if(pb){syncEtat('⚠️ '+pb,'err-txt');toast('Adresse incorrecte',true);return}
  syncEtat('⏳ Test en cours…','muted');
  const old={w:conf.webhook,s:conf.secret};conf.webhook=u;conf.secret=s;
  try{const j=await syncAppel({secret:s,action:'ping',appareil:conf.appareil||'test'},25000);
    syncEtat('✅ Connexion OK'+(j.ia?' · IA active':' · IA non configurée')+urlInhabituelle(u),'ok-txt');
    toast('Connexion réussie ✓')}
  catch(e){conf.webhook=old.w;conf.secret=old.s;syncEtat('⚠️ '+(e.message||'échec'),'err-txt');toast('Échec : '+(e.message||'?'),true)}}
function saveSync(){
  const pb=verifierUrl(document.getElementById('sy-url').value);
  if(pb){syncEtat('⚠️ '+pb,'err-txt');toast('Adresse incorrecte',true);return}
  conf.webhook=document.getElementById('sy-url').value.trim();
  conf.secret=document.getElementById('sy-secret').value.trim();
  conf.appareil=document.getElementById('sy-appareil').value.trim()||'appareil';
  conf.autoSync=document.getElementById('sy-auto').checked;
  try{localStorage.setItem(LS_CONF,JSON.stringify(conf))}catch(e){}
  renderReglages();toast('Synchronisation enregistrée ✓');if(syncConfigure())syncNow(true)}
/* --- Lien de branchement : contient déjà l'adresse ET le mot de passe.
      Un appareil se branche en ouvrant ce lien, sans rien taper. --- */
function b64url(txt){return btoa(unescape(encodeURIComponent(txt))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function deb64url(t){let b=String(t).replace(/-/g,'+').replace(/_/g,'/');while(b.length%4)b+='=';return decodeURIComponent(escape(atob(b)))}
function lienBranchement(avecEmarg){
  if(!conf.webhook)return '';
  return location.origin+location.pathname+'#config='+b64url(JSON.stringify({u:conf.webhook,s:conf.secret||''}))+(avecEmarg?'&emargement':'')}
function copierBranchement(avecEmarg){
  const l=lienBranchement(avecEmarg);
  if(!l){toast('Configure d\'abord la synchronisation',true);return}
  const fini=()=>toast(avecEmarg?'Lien encadrant copié ✓ — envoie-le par SMS':'Lien de branchement copié ✓');
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(l).then(fini).catch(()=>prompt('Copie ce lien :',l));
  else prompt('Copie ce lien :',l)}
function appliquerLienBranchement(){
  const h=location.hash||'';const m=h.match(/[#&]config=([^&]+)/);
  if(!m)return false;
  try{
    const o=JSON.parse(deb64url(m[1]));
    if(!o.u)return false;
    conf.webhook=o.u;conf.secret=o.s||'';conf.autoSync=true;
    if(!conf.appareil)conf.appareil=(/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)?'Téléphone':'PC')+' '+Math.random().toString(36).slice(2,6);
    try{localStorage.setItem(LS_CONF,JSON.stringify(conf))}catch(e){}
    const em=/[#&]emargement/.test(h);
    // Mode conducteur : on GARDE le lien dans la barre d'adresse, exprès.
    // Sur iPhone, une page ajoutée à l'écran d'accueil a sa propre mémoire,
    // séparée de Safari : si on effaçait le lien, le raccourci se retrouverait
    // débranché. En le gardant, le raccourci embarque sa configuration et se
    // rebranche tout seul à chaque ouverture. Sur PC on nettoie l'adresse.
    if(!em)history.replaceState(null,'',location.pathname);
    setTimeout(()=>toast('Appareil branché au suivi ✓'),700);
    return true}
  catch(e){toast('Lien de branchement illisible',true);return false}}
function oublierSync(){
  if(!confirm('Effacer l\'adresse et le mot de passe de synchronisation sur CET appareil ?\nLes données locales sont conservées.'))return;
  conf.webhook='';conf.secret='';try{localStorage.setItem(LS_CONF,JSON.stringify(conf))}catch(e){}
  renderReglages();toast('Paramètres effacés')}

/* ===== V2.3 — un PDF scanné est transformé EN IMAGES dans le navigateur avant la lecture IA.
   Google refusait certains PDF (« drive.files.create : Internal Error ») et le modèle de vision,
   le meilleur sur l'écriture manuscrite, ne lit que des images. pdf.js est embarqué (js/lib),
   jamais chargé depuis un CDN. 2 pages au plus (une fiche d'émargement en fait rarement plus). */
let pdfjsPret=null;
function chargerPdfjs(){
  if(window.pdfjsLib)return Promise.resolve(window.pdfjsLib);
  if(pdfjsPret)return pdfjsPret;
  pdfjsPret=new Promise((ok,ko)=>{const sc=document.createElement('script');sc.src='js/lib/pdf.min.js?v=2.3';
    sc.onload=()=>{try{window.pdfjsLib.GlobalWorkerOptions.workerSrc='js/lib/pdf.worker.min.js';ok(window.pdfjsLib)}catch(e){ko(e)}};sc.onerror=()=>ko(new Error('pdf.js introuvable (js/lib)'));document.head.appendChild(sc)});
  return pdfjsPret;
}
async function pdfEnImages(dataUrl,maxPages){
  const lib=await chargerPdfjs();
  const b64=String(dataUrl).split(',')[1]||'';const bin=atob(b64);const buf=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)buf[i]=bin.charCodeAt(i);
  const pdf=await lib.getDocument({data:buf,isEvalSupported:false}).promise;
  const out=[];const n=Math.min(pdf.numPages,maxPages||2);
  for(let i=1;i<=n;i++){
    const page=await pdf.getPage(i);const v1=page.getViewport({scale:1}),k=Math.min(3,1800/Math.max(v1.width,v1.height)),vp=page.getViewport({scale:k});
    const c=document.createElement('canvas');c.width=Math.round(vp.width);c.height=Math.round(vp.height);
    const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);
    await page.render({canvasContext:x,viewport:vp}).promise;
    out.push(c.toDataURL('image/jpeg',.85));
  }
  try{pdf.destroy()}catch(e){}
  return out;
}
/* la charge envoyée au serveur pour une pièce : une image telle quelle, un PDF converti en images */
async function chargeLecture(p){
  const base={secret:conf.secret,action:'lire-fiche',appareil:conf.appareil,nom:p.name,roster:actifs().map(x=>x.name)};
  if(p.type==='application/pdf'){
    try{const pages=await pdfEnImages(p.data,2);if(pages.length)return Object.assign(base,{type:'image/jpeg',dataUrl:pages[0],pages:pages.slice(1),origine:'pdf'})}
    catch(e){}   // pdf.js indisponible ou PDF illisible : on envoie le PDF tel quel, comme avant
  }
  return Object.assign(base,{type:p.type,dataUrl:p.data});
}
/* ===== Lecture IA de la fiche d'émargement ===== */
async function lireFicheIA(){
  if(!syncConfigure()){toast('La lecture IA nécessite la synchronisation configurée',true);return}
  const arr=piecesPending||[];
  const p=arr.filter(x=>(x.type||'').indexOf('image/')===0||x.type==='application/pdf')[0];
  if(!p){toast('Joins d\'abord le PDF ou la photo de la fiche',true);return}
  const btn=document.getElementById('f-ia');if(btn){btn.disabled=true;btn.textContent='🤖 Lecture en cours…'}
  iaEtat('run','🤖 <b>Lecture de la fiche en cours…</b> (jusqu\'à une minute, ne ferme pas)');
  try{
    const j=await syncAppel(await chargeLecture(p),120000);
    appliquerExtrait(j.extrait||{});
  }catch(err){iaEtat('err','⚠️ Lecture automatique impossible ('+esc(err.message||'?')+'). La fiche reste jointe : remplis les champs à la main, ou réessaie avec « Lire la fiche automatiquement ».');toast('Lecture impossible : '+(err.message||'?'),true)}
  finally{if(btn){btn.disabled=false;btn.textContent='🤖 Lire la fiche automatiquement'}}}

/* ===== V2.2 — résultat de la lecture IA appliqué à la fiche ouverte =====
   Les noms rattachés avec moins de 85 % de certitude sont surlignés en orange dans la
   liste des participants ; les noms lus mais non déchiffrés sont listés en rouge. */
let certitudesFiche={}, lusFiche={};
function tauxLecture(e){if(typeof e.taux==='number')return e.taux;const n=(e.noms||[]).length,t=n+(e.ambigus||[]).length+(e.nonReconnus||[]).length+(e.illisibles||0);return t?Math.round(100*n/t):0}
function classeTaux(t){return t>=90?'ok':t>=70?'mid':'ko'}
function appliquerExtrait(e){
  e=e||{};
  if(e.date&&/^\d{4}-\d{2}-\d{2}$/.test(e.date))document.getElementById('f-date').value=e.date;
  if(e.chantier)document.getElementById('f-chantier').value=e.chantier;
  if(e.animateur)document.getElementById('f-cond').value=e.animateur;
  if(e.theme)document.getElementById('f-theme').value=e.theme;
  if(e.remontees)document.getElementById('f-remontees').value=e.remontees;
  certitudesFiche=e.certitudes||{};lusFiche=e.lus||{};
  (e.noms||[]).forEach(n=>{if(state.roster.some(p2=>p2.name===n))pickPres[n]=true});
  renderPickNames();
  const nbN=(e.noms||[]).length, t=tauxLecture(e), inc=Object.keys(certitudesFiche).filter(n=>certitudesFiche[n]<85).length;
  let msg='✅ <b>Champs remplis par l’IA</b> · '+nbN+' participant'+(nbN>1?'s':'')+' reconnu'+(nbN>1?'s':'')+' · <span class="taux '+classeTaux(t)+'">lecture '+t+' %</span>';
  if(inc)msg+='<br>🟧 '+inc+' nom'+(inc>1?'s':'')+' rattaché'+(inc>1?'s':'')+' avec un doute : en orange dans le récapitulatif, compare avec la fiche scannée ci-dessous.';
  if((e.ambigus||[]).length)msg+='<br>🤔 <b>À trancher</b> : '+e.ambigus.map(a=>'« '+esc(a.lu)+' » → '+a.candidats.map(esc).join(' ou ')).join(' · ')+' — coche à la main.';
  if((e.nonReconnus||[]).length)msg+='<br><span class="nondech">🟥 <b>Non déchiffrés</b> : '+e.nonReconnus.map(n=>'« '+esc(n)+' »').join(', ')+' — personne de la liste ne correspond.</span>';
  if(e.illisibles)msg+='<br><span class="nondech">🟥 '+e.illisibles+' mot'+(e.illisibles>1?'s':'')+' illisible'+(e.illisibles>1?'s':'')+' sur la fiche : compare avec le papier.</span>';
  msg+='<br>Vérifie, corrige si besoin, puis touche <b>Enregistrer</b> en bas.';
  iaEtat(t>=90&&!inc&&!(e.ambigus||[]).length&&!(e.nonReconnus||[]).length?'ok':'warn',msg);
  toast(nbN+' nom(s) reconnu(s) ✓ — vérifie avant d’enregistrer');
}

/* ===== V2.2 — PLUSIEURS QHP D'UN COUP =====
   On dépose les fiches de plusieurs QHP (une fiche = un fichier). Chaque fichier est
   rangé sur l'appareil, lu par l'IA l'un après l'autre, et attend dans « Fiches scannées » :
   on ouvre, on corrige, on enregistre. Rien n'est enregistré sans vérification. */
let lectureEnCours=false, brouillonOuvert=null;
function brouillons(){if(!Array.isArray(state.brouillons))state.brouillons=[];return state.brouillons}
async function preparerPiece(f){
  const isImg=(f.type||'').indexOf('image/')===0, isPdf=f.type==='application/pdf'||/\.pdf$/i.test(f.name||'');
  if(!isImg&&!isPdf)throw new Error('format non géré');
  const data=isImg?await compressImage(f):await readData(f);
  if(data.length>4200000)throw new Error('trop lourd (> 3 Mo)');
  return {name:f.name||(isImg?'photo.jpg':'emargement.pdf'),type:isImg?'image/jpeg':'application/pdf',data};
}
async function deposerPlusieurs(files){
  files=Array.from(files||[]);if(!files.length)return;
  let n=0;
  for(const f of files){
    try{const p=await preparerPiece(f);const id=uid();
      if(!(await pdfPut('br_'+id,{items:[p]})))throw new Error('stockage indisponible sur cet appareil (navigation privée ?) — dépose les fiches une par une');
      brouillons().push({id,nom:p.name,etat:'attente',cree:nowISO()});n++}
    catch(e){toast((f.name||'Fichier')+' : '+e.message,true)}
  }
  save();renderAccueil();
  if(n)toast(n+' fiche'+(n>1?'s':'')+' en lecture — une par une, garde la page ouverte');
  lancerLectures();
}
async function lancerLectures(){
  if(lectureEnCours)return;
  if(!syncConfigure()){toast('Lecture automatique indisponible : appareil non branché. Ouvre chaque fiche pour la saisir.',true);return}
  lectureEnCours=true;
  try{
    for(;;){
      const b=brouillons().find(x=>x.etat==='attente');if(!b)break;
      b.etat='lecture';save();renderBrouillons();
      try{
        const v=await pdfGet('br_'+b.id);const p=v&&v.items&&v.items[0];
        if(!p)throw new Error('fichier introuvable sur cet appareil');
        const j=await syncAppel(await chargeLecture(p),120000);
        b.extrait=j.extrait||{};b.etat='pret';b.erreur='';
      }catch(e){b.etat='erreur';b.erreur=(e&&e.message)||'erreur'}
      save();renderBrouillons();
    }
  }finally{lectureEnCours=false}
}
function relireBrouillon(id){const b=brouillons().find(x=>x.id===id);if(!b)return;b.etat='attente';b.erreur='';save();renderBrouillons();lancerLectures()}
function retirerBrouillon(id){if(!confirm('Retirer cette fiche de la liste ? (rien n’est enregistré)'))return;
  state.brouillons=brouillons().filter(x=>x.id!==id);pdfDel('br_'+id);save();renderBrouillons()}
async function ouvrirBrouillon(id){
  const b=brouillons().find(x=>x.id===id);if(!b)return;
  await openFiche();
  const v=await pdfGet('br_'+id);piecesPending=(v&&v.items)?v.items.slice():[];renderPieces();renderApercu();
  document.getElementById('m-fiche-title').textContent='Fiche lue par l’IA — à vérifier';
  ficheCompacte=true;renderPickNames();
  if(b.extrait)appliquerExtrait(b.extrait);else iaEtat('warn','Lecture automatique non faite'+(b.erreur?' ('+esc(b.erreur)+')':'')+' : remplis les champs à la main.');
  brouillonOuvert=id;
}
function renderBrouillons(){
  const box=document.getElementById('acc-verif');if(!box)return;
  const l=brouillons();
  if(!lectureEnCours&&l.some(x=>x.etat==='lecture')){l.forEach(x=>{if(x.etat==='lecture')x.etat='attente'});setTimeout(lancerLectures,300)}
  if(!l.length){box.innerHTML='';return}
  const enAtt=l.filter(x=>x.etat==='attente'||x.etat==='lecture').length;
  box.innerHTML='<h2 class="acc-titre">Fiches scannées <span class="nbv">'+l.length+'</span>'+(enAtt?' <small class="muted">· '+enAtt+' en lecture…</small>':'')+'</h2>'
    +'<div class="brl">'+l.map(b=>{
      const e=b.extrait||{}, t=b.etat==='pret'?tauxLecture(e):null;
      const c=e.certitudes||{};
      const noms=(e.noms||[]).map(n=>'<span class="bn '+((c[n]||100)<85?'inc':'')+'" title="'+((c[n]||100)<85?'lu « '+esc((e.lus||{})[n]||'')+' » · '+c[n]+' %':'')+'">'+esc(n)+((c[n]||100)<85?' <i>'+c[n]+' %</i>':'')+'</span>').join('');
      const amb=(e.ambigus||[]).map(a=>'<span class="bn inc" title="à trancher">'+esc(a.lu)+' ?</span>').join('');
      const nr=(e.nonReconnus||[]).map(n=>'<span class="bn ko" title="non déchiffré">'+esc(n)+'</span>').join('');
      return '<div class="brc '+b.etat+'">'
        +'<div class="brh"><b>'+(e.date?esc(frDate(e.date)):'Date ?')+'</b> · '+esc(e.chantier||'chantier ?')+(e.animateur?' · '+esc(e.animateur):'')
        +(t!==null?'<span class="taux '+classeTaux(t)+'" title="part des noms lus avec certitude">certitude '+t+' %</span>':'')
        +(b.etat==='pret'&&doublonFiche(e.date,e.animateur,null)?'<span class="taux ko" title="une fiche existe déjà ce jour-là pour cet animateur">⚠️ doublon ?</span>':'')+'</div>'
        +'<div class="brt">'+(b.etat==='attente'?'⏳ En attente de lecture':b.etat==='lecture'?'🤖 Lecture en cours…':b.etat==='erreur'?'⚠️ Lecture impossible : '+esc(b.erreur||'?'):esc(e.theme||'(thème non lu)'))+'</div>'
        +(b.etat==='pret'?'<div class="brn">'+noms+amb+nr+(e.illisibles?'<span class="bn ko">'+e.illisibles+' illisible'+(e.illisibles>1?'s':'')+'</span>':'')+'</div>':'')
        +'<div class="bra"><span class="small muted">📎 '+esc(b.nom)+'</span><span class="grow"></span>'
        +(b.etat==='erreur'?'<button class="btn btn-ghost btn-sm" onclick="relireBrouillon(\''+b.id+'\')">↻ Relire</button>':'')
        +'<button class="btn btn-ghost btn-sm" onclick="retirerBrouillon(\''+b.id+'\')">🗑</button>'
        +(b.etat==='pret'&&manqueEnvoi(e)?'<span class="pourquoi">'+esc(manqueEnvoi(e))+' → Vérifier</span>':'')
        +'<button class="btn btn-ghost btn-sm" '+(b.etat==='lecture'||(b.etat==='attente'&&syncConfigure())?'disabled':'')+' data-id="'+esc(b.id)+'" onclick="ouvrirBrouillon(this.dataset.id)">🔍 Vérifier</button>'
        +'<button class="btn btn-sm btn-envoi" '+(b.etat!=='pret'||manqueEnvoi(e)?'disabled':'')+' data-id="'+esc(b.id)+'" onclick="envoyerBrouillon(this.dataset.id)">✅ Envoyer</button></div></div>'}).join('')+'</div>';
}
/* V3.3 — ENVOYER une fiche lue sans l'ouvrir : on enregistre ce que l'IA a lu (noms reconnus,
   animateur compté présent, scan joint), avec confirmation s'il reste des doutes. Doublon même jour
   même animateur : même fenêtre que la saisie. « Vérifier » ouvre la fiche pré-remplie comme avant. */
function manqueEnvoi(e){e=e||{};if(!e.date||!/^\d{4}-\d{2}-\d{2}$/.test(e.date))return 'date non lue';if(!String(e.theme||'').trim())return 'thème non lu';return ''}
function doutesLecture(e){const c=e.certitudes||{},d=[];const inc=Object.keys(c).filter(n=>c[n]<85).length;
  if(inc)d.push(inc+' nom'+(inc>1?'s':'')+' rattaché'+(inc>1?'s':'')+' avec un doute');
  if((e.ambigus||[]).length)d.push((e.ambigus.length)+' nom'+(e.ambigus.length>1?'s':'')+' à trancher (non comptés)');
  if((e.nonReconnus||[]).length)d.push(e.nonReconnus.length+' nom'+(e.nonReconnus.length>1?'s':'')+' non déchiffré'+(e.nonReconnus.length>1?'s':'')+' (non comptés)');
  if(e.illisibles)d.push(e.illisibles+' mot'+(e.illisibles>1?'s':'')+' illisible'+(e.illisibles>1?'s':''));
  return d}
async function envoyerBrouillon(id,force){
  const b=brouillons().find(x=>x.id===id);if(!b||b.etat!=='pret')return;const e=b.extrait||{};
  const m=manqueEnvoi(e);if(m){toast(m.charAt(0).toUpperCase()+m.slice(1)+' : ouvre la fiche avec « Vérifier »',true);return}
  if(!force){
    const dbl=doublonFiche(e.date,e.animateur||'',null);
    if(dbl){demanderDoublon(dbl,()=>envoyerBrouillon(id,true),()=>openFiche(dbl.id));return}
    const d=doutesLecture(e),t=tauxLecture(e);
    if(d.length&&!confirm('Certitude de lecture : '+t+' %\n- '+d.join('\n- ')+'\n\nEnvoyer quand même ? (sinon : Annuler, puis « Vérifier »)'))return}
  const present={};(e.noms||[]).forEach(n=>{if(state.roster.some(p=>p.name===n))present[n]=true});
  const an=nomRoster(e.animateur);if(an)present[an]=true;   // l'animateur participe
  const q={id:uid(),date:e.date,theme:String(e.theme).trim(),chantier:String(e.chantier||'').trim(),cond:String(e.animateur||'').trim(),
    remontees:String(e.remontees||'').trim(),present,externes:[],source:'scan',maj:nowISO()};
  const v=await pdfGet('br_'+id);const items=(v&&v.items)?v.items.slice():[];
  if(items.length){await piecesPut(q.id,items);q.pieces=items.map(p=>({name:p.name,type:p.type}));q.hasPdf=true;q.pdfName=items[0].name}
  state.qhps.push(q);majChantier(q);
  state.brouillons=brouillons().filter(x=>x.id!==id);pdfDel('br_'+id);
  save();renderFiches();renderAccueil();toast('QHP du '+frDate(q.date)+' envoyé ✓');syncAuto(q.id)}

/* V3 — l'accueil montre un TABLEAU simple des derniers QHP : date, animateur, chantier,
   participants, sujets. Un conducteur y voit sa fiche apparaître ; une ligne s'ouvre au clic. */
const ACC_NB=10;
function nbParticipants(q){return Object.values(q.present||{}).filter(Boolean).length+((q.externes||[]).length)}
function ligneQhp(q){const d=new Date((q.date||'')+'T00:00');
  return '<tr class="cl" data-id="'+esc(q.id)+'" onclick="openDetail(this.dataset.id)"><td><span class="dj">'+(isNaN(d)?'?':d.getDate())+'</span><span class="dm">'+(isNaN(d)?'':MOIS_S[d.getMonth()]+' '+d.getFullYear())+'</span></td>'
    +'<td>'+esc(q.cond||'—')+'</td><td>'+esc(q.chantier||'—')+'</td><td class="nb">'+nbParticipants(q)+'</td><td class="suj">'+esc(q.theme||'')+(q.emarg?' <span title="fiche signée en ligne">✍️</span>':'')+(nbPieces(q)?' <span title="pièce jointe">📎</span>':'')+'</td></tr>'}
function tableQhps(list){return '<div class="tbl-wrap"><table class="acc-tab"><thead><tr><th>Date</th><th>Animateur</th><th>Chantier</th><th style="text-align:center">Particip.</th><th>Sujets</th></tr></thead><tbody>'+list.map(ligneQhp).join('')+'</tbody></table></div>'}
function renderDernieres(){
  const box=document.getElementById('acc-fiches');if(!box)return;
  const list=[...state.qhps].sort((a,b)=>(b.date||'').localeCompare(a.date||'')||String(b.maj||'').localeCompare(String(a.maj||''))).slice(0,ACC_NB);
  if(!list.length){box.innerHTML='';return}
  box.innerHTML='<h2 class="acc-titre">Derniers QHP <a href="#" class="acc-tout" onclick="go(\'v-fiches\');return false">Tout l’historique ('+state.qhps.length+') ›</a></h2>'+tableQhps(list);
}

/* ===== V3 — L'ANIMATEUR PARTICIPE FORCÉMENT AU QHP =====
   Dans la fiche comme dans l'émargement, choisir l'animateur le coche parmi les participants
   (s'il est dans la liste des collaborateurs). Plus de doublon « animateur » / « participants ». */
function nomRoster(n){n=String(n||'').trim();if(!n)return '';const ex=state.roster.find(p=>p.name===n);if(ex)return ex.name;
  const c=cleNomJs(n);const l=state.roster.filter(p=>cleNomJs(p.name)===c);return l.length===1?l[0].name:''}
function cleNomJs(n){return String(n||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').split(' ').filter(Boolean).sort().join(' ')}
function animateurParticipe(){const n=nomRoster(document.getElementById('f-cond').value);if(!n)return;if(!pickPres[n]){pickPres[n]=true;renderPickNames();toast(n+' compté parmi les participants (animateur)')}}
function emargAnimateurParticipe(){const n=nomRoster(document.getElementById('e-anim').value);if(!n)return;if(!emargPick[n]){emargPick[n]=true;renderEmargPick();renderSigs();toast(n+' ajouté aux participants (animateur)')}}

/* ===== V3 — FICHE EN DOUBLE : même jour, même animateur =====
   Avant d'enregistrer (saisie, scan, lot IA, émargement, import) : si une fiche existe déjà ce
   jour-là pour cet animateur, on prévient, et on peut ouvrir l'existante au lieu d'en créer une. */
function doublonFiche(date,cond,saufId){const c=cleNomJs(cond);if(!date||!c)return null;
  return state.qhps.find(q=>q.id!==saufId&&q.date===date&&cleNomJs(q.cond)===c)||null}
function texteDoublon(q){return 'Une fiche existe déjà le <b>'+esc(frDate(q.date))+'</b> animée par <b>'+esc(q.cond)+'</b> : '+esc(q.chantier||'chantier ?')+', '+nbParticipants(q)+' participant'+(nbParticipants(q)>1?'s':'')+(q.theme?', « '+esc(q.theme)+' »':'')+'.'}
let dblGarder=null;
function demanderDoublon(q,surGarder,surOuvrir){
  document.getElementById('dbl-corps').innerHTML=texteDoublon(q)+'<br>S’agit-il du même QHP ? Ouvre l’existante pour la compléter, ou enregistre quand même s’il y a bien eu deux QHP.';
  document.getElementById('dbl-garder').onclick=()=>{closeModal();surGarder()};
  document.getElementById('dbl-ouvrir').onclick=()=>{closeModal();surOuvrir()};
  document.getElementById('m-doublon').classList.add('open')}

/* ============================================================================
   V3.2 — IMPORT D'UN LOT DE FICHES TRANSCRITES (fichier JSON « qhp-lot »)
   Les scans d'une année, transcrits une fois par le service HSE, entrent d'un coup :
   · chaque nom lu est rapproché de la liste des collaborateurs (mêmes mots, accents, ordre
     et majuscules indifférents ; une ou deux lettres d'écart ; nom seul → les personnes de ce
     nom). Seuls les noms non retrouvés sont demandés, UNE fois ; le choix est retenu sur cet
     appareil pour les lots suivants (qhp_alias_v1) ;
   · une fiche déjà présente (même jour, même animateur) est décochée d'office ;
   · une fiche sans date reste décochée tant qu'on ne lui en donne pas une ;
   · les scans peuvent être joints (dossier ou fichiers), rattachés par leur nom de fichier.
   ============================================================================ */
const CLE_ALIAS='qhp_alias_v1';
let lotEnCours=null, lotScans={};
function aliasLire(){try{return JSON.parse(localStorage.getItem(CLE_ALIAS)||'{}')||{}}catch(e){return {}}}
function aliasEcrire(a){try{localStorage.setItem(CLE_ALIAS,JSON.stringify(a))}catch(e){}}
function distLev(a,b){if(a===b)return 0;const m=a.length,n=b.length;if(!m||!n)return Math.max(m,n);let prev=Array.from({length:n+1},(_,j)=>j);
  for(let i=1;i<=m;i++){const cur=[i];for(let j=1;j<=n;j++)cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=cur}return prev[n]}
/* rapprochement d'un nom lu : {sur: nom de la liste | '', props: [noms proposés]} */
function rapprocherNomLot(lu){
  const k=cleNomJs(lu);if(!k)return {sur:'',props:[]};
  const r=state.roster.map(p=>({n:p.name,k:cleNomJs(p.name)}));
  const ex=r.filter(x=>x.k===k);if(ex.length===1)return {sur:ex[0].n,props:[],exact:true};
  const mots=k.split(' ').filter(w=>w.length>=2);
  const motOk=(w,mk)=>mk.some(m=>m===w||(w.length>=5&&distLev(w,m)<=1));
  // tous les mots lus (prénom absent, initiale ignorée) se retrouvent dans le nom de la liste
  const cont=r.filter(x=>{const mk=x.k.split(' ');return mots.length&&mots.every(w=>motOk(w,mk))});
  const flou=r.map(x=>({n:x.n,d:distLev(x.k,k)})).filter(x=>x.d<=2).sort((a,b)=>a.d-b.d);
  const props=[...new Set(cont.map(x=>x.n).concat(flou.map(x=>x.n)))];
  if(cont.length===1&&mots.length>=2)return {sur:cont[0].n,props};          // ex. « CROIZIER Loïc » → « CROIZER Loïc »
  if(!cont.length&&flou.length===1)return {sur:flou[0].n,props};             // une ou deux lettres d'écart, un seul candidat
  if(cont.length===1&&mots.length===1)return {sur:'',props,seul:cont[0].n}; // nom seul : proposé, à confirmer
  return {sur:'',props};
}
function lotNoms(){const c={};(lotEnCours.fiches||[]).forEach(f=>{(f.participants||[]).concat(f.animateur?[f.animateur]:[]).forEach(n=>{n=String(n||'').trim();if(n)c[n]=(c[n]||0)+1})});return c}
/* résolution courante d'un nom lu : choix fait dans l'écran > choix retenu (alias) > rapprochement sûr */
function resoudreNom(lu){const ch=lotEnCours.choix[lu];if(ch!==undefined)return ch;const a=aliasLire()[lu];if(a&&(a.startsWith('__')||state.roster.some(p=>p.name===a)))return a;return lotEnCours.rap[lu].sur||''}
async function ouvrirLot(file){
  if(!file)return;let j;
  try{j=JSON.parse(await file.text())}catch(e){toast('Fichier illisible (JSON attendu)',true);return}
  if(!j||j.type!=='qhp-lot'||!Array.isArray(j.fiches)){toast('Ce fichier n’est pas un lot de fiches QHP',true);return}
  if(!state.roster.length){toast('La liste des collaborateurs est vide : synchronise d’abord',true);return}
  lotEnCours={source:j.source||file.name,fiches:j.fiches.map(f=>Object.assign({},f)),choix:{},rap:{},coche:{}};
  Object.keys(lotNoms()).forEach(n=>lotEnCours.rap[n]=rapprocherNomLot(n));
  lotEnCours.fiches.forEach(f=>{f.statut=statutFicheLot(f);lotEnCours.coche[f.ref]=f.statut==='ok'});
  lotScans={};
  document.getElementById('lot-titre').textContent='📥 Import — '+lotEnCours.source;
  renderLot();document.getElementById('m-lot').classList.add('open');
}
function animateurLot(f){const r=f.animateur?resoudreNom(f.animateur):'';return (r&&!r.startsWith('__'))?r:(f.animateur||'')}
function statutFicheLot(f){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(f.date||''))return 'sansdate';
  if(state.qhps.some(q=>q.lotRef&&q.lotRef===f.ref))return 'deja';
  // V3.3.1 : le serveur ne garde pas lotRef → même date, même thème, même chantier, source import = déjà importée
  if(state.qhps.some(q=>q.source==='import'&&jourQ(q.date)===f.date&&String(q.theme||'').trim()===String(f.theme||'(thème non lu)').trim()&&String(q.chantier||'').trim()===String(f.chantier||'').trim()))return 'deja';
  const d=doublonFiche(f.date,animateurLot(f),null);if(d)return 'doublon';
  return 'ok'}
function renderLot(){
  const L=lotEnCours,noms=lotNoms(),aDemander=Object.keys(noms).filter(n=>!(L.rap[n].exact)).sort((a,b)=>a.localeCompare(b,'fr'));
  const nonRes=aDemander.filter(n=>!resoudreNom(n)).length;
  L.fiches.forEach(f=>{const st=statutFicheLot(f);if(st!==f.statut){f.statut=st;L.coche[f.ref]=st==='ok'}});
  const nb=L.fiches.filter(f=>L.coche[f.ref]).length;
  const cpt=st=>L.fiches.filter(f=>f.statut===st).length;
  document.getElementById('lot-resume').innerHTML='<p><span class="lot-pill">'+L.fiches.length+' fiches</span>'
    +(cpt('doublon')+cpt('deja')?'<span class="lot-pill mid">'+(cpt('doublon')+cpt('deja'))+' déjà dans le suivi</span>':'')
    +(cpt('sansdate')?'<span class="lot-pill ko">'+cpt('sansdate')+' sans date</span>':'')
    +'<span class="lot-pill ok">'+(Object.keys(noms).length-aDemander.length)+' noms retrouvés tels quels</span>'
    +(aDemander.length?'<span class="lot-pill '+(nonRes?'ko':'ok')+'">'+aDemander.length+' noms à vérifier'+(nonRes?' · '+nonRes+' à choisir':'')+'</span>':'')+'</p>';
  // --- noms
  const opts=state.roster.map(p=>p.name).sort((a,b)=>a.localeCompare(b,'fr'));
  let h='';
  if(aDemander.length){
    h+='<h3 style="margin:10px 0 6px;color:var(--marine)">👤 Noms à vérifier ('+aDemander.length+')</h3><p class="hint">Rouge = à choisir. Orange = proposé par l’appli (une ou deux lettres d’écart, ou un seul nom possible) : vérifie d’un coup d’œil. Ton choix est retenu pour les lots suivants.</p>'
      +'<div class="tbl-wrap" style="max-height:44vh;overflow:auto"><table class="lot-t"><thead><tr><th>Nom lu sur les fiches</th><th style="text-align:center">Fiches</th><th>Dans la liste des collaborateurs</th></tr></thead><tbody>';
    aDemander.forEach(n=>{const v=resoudreNom(n),rp=L.rap[n],props=rp.props||[];
      const auto=v&&L.choix[n]===undefined&&!aliasLire()[n];   // proposé par l'appli, pas encore confirmé
      const sel='<select class="'+(v?(auto?'aconf':''):'vide')+'" data-lu="'+esc(n)+'" onchange="lotChoix(this)" title="'+(auto?'Proposé par l’appli : confirme ou change':'')+'">'
        +'<option value="">— à choisir —</option>'
        +(props.length?'<optgroup label="Proposés">'+props.map(o=>'<option value="'+esc(o)+'"'+(o===v?' selected':'')+'>★ '+esc(o)+'</option>').join('')+'</optgroup>':'')
        +'<optgroup label="Autres"><option value="__ext"'+(v==='__ext'?' selected':'')+'>Extérieur / intérim (garder le nom)</option><option value="__ignore"'+(v==='__ignore'?' selected':'')+'>Ne pas compter</option>'
        +opts.filter(o=>!props.includes(o)).map(o=>'<option value="'+esc(o)+'"'+(o===v?' selected':'')+'>'+esc(o)+'</option>').join('')+'</optgroup></select>';
      h+='<tr><td><b>'+esc(n)+'</b>'+(rp.seul&&!v?'<div class="sug">nom seul : '+esc(rp.seul)+' ?</div>':'')+'</td><td style="text-align:center">'+noms[n]+'</td><td>'+sel+'</td></tr>'});
    h+='</tbody></table></div>';
  }
  document.getElementById('lot-noms').innerHTML=h;
  // --- scans
  const nScans=L.fiches.filter(f=>lotScans[f.fichier]).length;
  document.getElementById('lot-scans').innerHTML='<b>📎 Joindre les scans</b> <span class="muted small">(facultatif — rattachés par nom de fichier)</span>'
    +' <button class="btn btn-ghost btn-sm" onclick="document.getElementById(\'lot-dossier\').click()">📁 Dossier</button> <button class="btn btn-ghost btn-sm" onclick="document.getElementById(\'lot-fichiers\').click()">📂 Fichiers</button>'
    +(nScans?' <span class="lot-pill ok">'+nScans+' scan'+(nScans>1?'s':'')+' rattaché'+(nScans>1?'s':'')+'</span>':'');
  // --- fiches
  const lib={ok:'',doublon:'déjà dans le suivi (même jour, même animateur)',deja:'déjà importée',sansdate:'date à renseigner'};
  h='<h3 style="margin:14px 0 6px;color:var(--marine)">🗂 Fiches ('+L.fiches.length+')</h3><div class="tbl-wrap"><table class="lot-t"><thead><tr><th><input type="checkbox" onchange="lotTout(this.checked)" title="Tout cocher"></th><th>Date</th><th>Chantier</th><th>Animateur</th><th style="text-align:center">Part.</th><th>Thème</th><th>À vérifier</th></tr></thead><tbody>';
  L.fiches.slice().sort((a,b)=>(a.date||'9').localeCompare(b.date||'9')).forEach(f=>{
    const parts=(f.participants||[]).map(resoudreNom),ok=parts.filter(v=>v&&!v.startsWith('__')).length,ext=parts.filter(v=>v==='__ext').length+(f.externes||[]).length;
    h+='<tr class="'+(L.coche[f.ref]?'':'off')+'"><td><input type="checkbox" data-ref="'+esc(f.ref)+'" '+(L.coche[f.ref]?'checked':'')+(f.statut==='deja'?' disabled':'')+' onchange="lotCoche(this)"></td>'
      +'<td><input type="date" value="'+esc(f.date||'')+'" data-ref="'+esc(f.ref)+'" onchange="lotDate(this)"><div class="sug">'+esc(f.ref)+'</div></td>'
      +'<td>'+esc(f.chantier||'')+'</td><td>'+esc(animateurLot(f))+'</td>'
      +'<td style="text-align:center" title="'+ok+' collaborateur(s) retrouvé(s)'+(ext?', '+ext+' extérieur(s)':'')+'"><b>'+ok+'</b>'+(ext?'<span class="sug"> +'+ext+'</span>':'')+'<span class="sug">/'+((f.participants||[]).length+(f.externes||[]).length)+'</span></td>'
      +'<td>'+esc(f.theme||'')+'</td><td class="v">'+(f.statut!=='ok'?'<b>'+esc(lib[f.statut])+'</b><br>':'')+esc(f.aVerifier||'')+'</td></tr>'});
  h+='</tbody></table></div>';
  document.getElementById('lot-fiches').innerHTML=h;
  const go=document.getElementById('lot-go');go.textContent='✅ Importer '+nb+' fiche'+(nb>1?'s':'');go.disabled=!nb;
}
function lotChoix(sel){lotEnCours.choix[sel.dataset.lu]=sel.value;renderLot()}
function lotCoche(cb){lotEnCours.coche[cb.dataset.ref]=cb.checked;renderLot()}
function lotTout(v){lotEnCours.fiches.forEach(f=>{if(f.statut!=='deja'&&(f.statut!=='sansdate'||!v))lotEnCours.coche[f.ref]=v&&f.statut!=='sansdate'});renderLot()}
function lotDate(inp){const f=lotEnCours.fiches.find(x=>x.ref===inp.dataset.ref);if(!f)return;f.date=inp.value;f.statut='';renderLot()}
function lotScansChoisis(files){Array.from(files||[]).forEach(fi=>{lotScans[fi.name]=fi});const n=lotEnCours.fiches.filter(f=>lotScans[f.fichier]).length;toast(n+' scan(s) rattaché(s) sur '+lotEnCours.fiches.length);renderLot()}
async function importerLot(){
  const L=lotEnCours;if(!L)return;
  const choisis=L.fiches.filter(f=>L.coche[f.ref]&&/^\d{4}-\d{2}-\d{2}$/.test(f.date||''));
  if(!choisis.length){toast('Aucune fiche cochée',true);return}
  const aChoisir=Object.keys(lotNoms()).filter(n=>!L.rap[n].exact&&!resoudreNom(n)&&choisis.some(f=>(f.participants||[]).includes(n)||f.animateur===n));
  if(aChoisir.length&&!confirm(aChoisir.length+' nom(s) encore « à choisir » ne seront pas comptés :\n'+aChoisir.slice(0,10).map(n=>'· '+n).join('\n')+(aChoisir.length>10?'\n…':'')+'\n\nImporter quand même ?'))return;
  // mémoriser les choix faits pour les lots suivants
  const al=aliasLire();Object.keys(L.choix).forEach(n=>{if(L.choix[n])al[n]=L.choix[n];else delete al[n]});aliasEcrire(al);
  const go=document.getElementById('lot-go');go.disabled=true;go.textContent='⏳ Import…';
  let n=0,scans=0,tropLourds=0;const t=nowISO();
  for(const f of choisis){
    const present={},externes=(f.externes||[]).map(e=>({name:e.name||'',soc:e.soc||''}));
    (f.participants||[]).forEach(lu=>{const v=resoudreNom(lu);if(!v||v==='__ignore')return;if(v==='__ext'){externes.push({name:lu,soc:''});return}present[v]=true});
    const cond=animateurLot(f);if(cond&&state.roster.some(p=>p.name===cond))present[cond]=true;   // l'animateur participe
    const q={id:uid(),date:f.date,theme:f.theme||'(thème non lu)',chantier:f.chantier||'',cond,remontees:f.remontees||'',present,externes,
      pieces:[],hasPdf:false,pdfName:'',maj:t,source:'import',lotRef:f.ref};
    const fi=lotScans[f.fichier];
    if(fi){try{const isImg=(fi.type||'').indexOf('image/')===0;const data=isImg?await compressImage(fi):await readData(fi);
      if(data.length>4200000)tropLourds++;else{const pc={name:fi.name,type:isImg?'image/jpeg':'application/pdf',data};await piecesPut(q.id,[pc]);q.pieces=[{name:pc.name,type:pc.type}];q.hasPdf=true;q.pdfName=pc.name;scans++;if(syncFile.indexOf(q.id)<0){syncFile.push(q.id);garderFile()}}}catch(e){}}
    state.qhps.push(q);n++;
    if(q.chantier){const ex=state.chantiers.find(c=>c.nom.toLowerCase()===q.chantier.toLowerCase());if(!ex)state.chantiers.push({id:uid(),nom:q.chantier,cond:q.cond||'',maj:t})}
  }
  save();closeModal();lotEnCours=null;renderAccueil();renderFiches();
  toast('✅ '+n+' fiche'+(n>1?'s importées':' importée')+(scans?' · '+scans+' scan(s) joint(s), envoi en arrière-plan':'')+(tropLourds?' · '+tropLourds+' scan(s) trop lourd(s) (> 3 Mo) non joint(s)':''));
  syncAuto();
}

/* ===== CANAL 3 : fiche d'émargement HTML ===== */
let emargPick={},emargExt=[],emargSigs={},emargYN={risques:null,formes:null,nouvel:null,accueil:null,epi:null};
const YN_IDS=[['yn-risques','risques'],['yn-formes','formes'],['yn-nouvel','nouvel'],['yn-accueil','accueil'],['yn-epi','epi']];
function lienEmarg(){return location.origin+location.pathname+'#emargement'}
function copierLien(){const i=document.getElementById('lien-emarg');if(!i)return;i.select();i.setSelectionRange(0,999);
  const ok=(navigator.clipboard&&navigator.clipboard.writeText(i.value))||document.execCommand('copy');
  Promise.resolve(ok).then(()=>toast('Lien copié ✓')).catch(()=>toast('Copie impossible — sélectionne le lien',true))}
function openEmarg(){
  emargPick={};emargExt=[];emargSigs={};emargYN={risques:null,formes:null,nouvel:null,accueil:null,epi:null};
  document.getElementById('e-date').value=todayISO;
  ['e-chantier','e-anim','e-duree','e-theme','e-operation','e-risques','e-dialogue','e-search','e-ext-nom','e-ext-soc'].forEach(k=>{const el=document.getElementById(k);if(el)el.value=''});
  document.getElementById('dl-ch2').innerHTML=state.chantiers.map(c=>'<option value="'+esc(c.nom)+'">').join('');
  document.getElementById('dl-cond2').innerHTML=[...new Set(conducteurs().map(c=>c.name))].map(n=>'<option value="'+esc(n)+'">').join('');
  document.getElementById('em-apres').innerHTML='';
  const surLien=/[#&]config=/.test(location.hash||'');
  document.getElementById('em-banner').innerHTML=
    (surLien?'<div class="banner ok">📲 <b>À faire une seule fois :</b> ajoute cette page à ton écran d\'accueil — <b>Partager ▸ Sur l\'écran d\'accueil</b> (iPhone) ou <b>⋮ ▸ Ajouter à l\'écran d\'accueil</b> (Android). Tu l\'auras comme une appli, déjà branchée : plus jamais besoin du lien.</div>':'')+
    '<div class="banner">📱 <b>Sur le terrain :</b> remplis la fiche, fais signer l\'équipe au doigt, puis valide.'+
    (syncConfigure()?' La fiche remonte automatiquement dans le suivi HSE, même sans réseau sur le chantier : elle partira dès que tu en auras.':' La fiche est enregistrée sur <b>cet appareil</b> ; un bouton d\'envoi apparaîtra après validation.')+'</div>';
  YN_IDS.forEach(([id,k])=>renderYN(id,k));
  document.getElementById('q-accueil').style.display='none';
  renderEmargPick();renderSigs();
  document.getElementById('app-emarg').style.display='block';
  document.body.style.paddingBottom='0';
  document.querySelector('header').style.display='none';document.querySelector('main').style.display='none';document.querySelector('nav.tabs').style.display='none';
  window.scrollTo(0,0)}
/* ---- Route #emargement ----
   Le bouton « Fiche d'émargement » pointe vers une vraie route (URL avec #emargement).
   Le routeur ouvre / ferme l'écran selon le hash, donc le bouton « précédent »
   du navigateur referme la fiche et revient au suivi. */
function goEmarg(){
  if(/(^|[#&])emarg/i.test(location.hash||''))openEmarg();   // déjà sur la route (ex. lien conducteur)
  else location.hash='emargement';                            // ajoute une entrée d'historique -> hashchange -> openEmarg
}
function routeEmarg(){
  const surRoute=/(^|[#&])emarg/i.test(location.hash||'');
  const affiche=document.getElementById('app-emarg').style.display==='block';
  if(surRoute){if(!affiche)openEmarg();}
  else{if(affiche)closeEmargUI();}
}
function closeEmargUI(){
  document.getElementById('app-emarg').style.display='none';
  document.body.style.paddingBottom='80px';
  document.querySelector('header').style.display='';document.querySelector('main').style.display='';document.querySelector('nav.tabs').style.display='';
  renderFiches();go('v-accueil')}
function closeEmarg(){
  // Quitter la route : on nettoie le hash, le routeur ferme l'écran.
  if(/(^|[#&])emarg/i.test(location.hash||'')){
    const h=location.hash;history.back();
    // Cas d'un accès direct par lien (pas d'historique en amont) : on force la fermeture.
    setTimeout(()=>{if((location.hash||'')===h){history.replaceState(null,'',location.pathname+location.search);closeEmargUI()}},70);
  }else closeEmargUI();
}
function renderYN(id,k){const el=document.getElementById(id);if(!el)return;const v=emargYN[k];
  el.innerHTML='<span class="yn"><button class="o'+(v===true?' on':'')+'" onclick="setYN(\''+id+'\',\''+k+'\',true)">OUI</button><button class="n'+(v===false?' on':'')+'" onclick="setYN(\''+id+'\',\''+k+'\',false)">NON</button></span>'}
function setYN(id,k,v){emargYN[k]=(emargYN[k]===v)?null:v;renderYN(id,k);
  if(k==='nouvel'){const q=document.getElementById('q-accueil');q.style.display=(emargYN.nouvel===true)?'':'none';if(emargYN.nouvel!==true)emargYN.accueil=null;renderYN('yn-accueil','accueil')}}
function renderEmargPick(){const term=(document.getElementById('e-search').value||'').toLowerCase();
  const list=actifs().filter(p=>p.name.toLowerCase().includes(term));const g=grouper(list);let h='';
  Object.keys(g).forEach(sec=>{const people=g[sec];if(!people.length)return;const on=people.filter(p=>emargPick[p.name]).length;
    h+='<div class="secgrp"><div class="sh"><span>'+esc(sec)+'</span><span class="cnt">'+on+'/'+people.length+' · <a href="#" onclick="emargSecAll(\''+esc(sec).replace(/'/g,"\\'")+'\',true);return false">tout</a></span></div><div class="names">';
    h+=people.map(p=>'<div class="nm '+(emargPick[p.name]?'on':'')+'" onclick="emargToggle(\''+esc(p.name).replace(/'/g,"\\'")+'\')"><span class="bx">'+(emargPick[p.name]?'✓':'')+'</span><span class="nn">'+esc(p.name)+(p.conducteur?' 🎓':'')+agPill(p.agence)+'</span></div>').join('');
    h+='</div></div>'});
  document.getElementById('e-names').innerHTML=h||'<div class="hint">Aucun collaborateur.</div>'}
function emargToggle(n){emargPick[n]=!emargPick[n];if(!emargPick[n])delete emargSigs[n];renderEmargPick();renderSigs()}
function emargSecAll(sec,v){const g=grouper(actifs());(g[sec]||[]).forEach(p=>emargPick[p.name]=v);renderEmargPick();renderSigs()}
function emargClear(){emargPick={};emargSigs={};renderEmargPick();renderSigs()}
function addExterne(){const n=document.getElementById('e-ext-nom').value.trim(),s=document.getElementById('e-ext-soc').value.trim();
  if(!n){toast('Renseigne le nom',true);return}
  emargExt.push({id:uid(),name:n,soc:s});document.getElementById('e-ext-nom').value='';document.getElementById('e-ext-soc').value='';renderSigs();toast('Intervenant ajouté')}
function delExterne(id){const e=emargExt.find(x=>x.id===id);if(e)delete emargSigs['EXT:'+id];emargExt=emargExt.filter(x=>x.id!==id);renderSigs()}
function emargNoms(){const a=actifs().filter(p=>emargPick[p.name]).map(p=>({key:p.name,nom:p.name,sub:p.secteur||''}));
  emargExt.forEach(e=>a.push({key:'EXT:'+e.id,nom:e.name,sub:(e.soc?e.soc+' · ':'')+'extérieur',ext:e.id}));return a}
function majNbSig(){const n=Object.keys(emargSigs).length;const el=document.getElementById('e-nbsig');if(el)el.textContent=n}
function renderSigs(){const box=document.getElementById('e-sigs');if(!box)return;const noms=emargNoms();
  if(!noms.length){box.innerHTML='<div class="hint">Coche des participants ci-dessus — ils apparaîtront ici avec leur case à signer.</div>';majNbSig();return}
  box.innerHTML=noms.map(o=>'<div class="sigrow"><span class="snm">'+esc(o.nom)+'<em>'+esc(o.sub)+'</em></span>'+
    '<canvas data-k="'+esc(o.key)+'" width="336" height="104"></canvas>'+
    '<button class="sx" title="Effacer la signature" onclick="clearSig(\''+esc(o.key).replace(/'/g,"\\'")+'\')">🧽</button>'+
    (o.ext?'<button class="sx" title="Retirer" onclick="delExterne(\''+o.ext+'\')">✕</button>':'')+'</div>').join('');
  box.querySelectorAll('canvas').forEach(cv=>bindSig(cv,cv.getAttribute('data-k')));majNbSig()}
function clearSig(k){delete emargSigs[k];renderSigs()}
function bindSig(cv,key){const ctx=cv.getContext('2d');ctx.lineWidth=2.4;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#12283c';
  if(emargSigs[key]){const im=new Image();im.onload=()=>ctx.drawImage(im,0,0,cv.width,cv.height);im.src=emargSigs[key];cv.classList.add('signe')}
  let dr=false,lx=0,ly=0;
  const pos=e=>{const r=cv.getBoundingClientRect();return [(e.clientX-r.left)*(cv.width/(r.width||1)),(e.clientY-r.top)*(cv.height/(r.height||1))]};
  cv.addEventListener('pointerdown',e=>{e.preventDefault();dr=true;try{cv.setPointerCapture(e.pointerId)}catch(_){}
    const p=pos(e);lx=p[0];ly=p[1];ctx.beginPath();ctx.moveTo(lx,ly);ctx.lineTo(lx+0.4,ly+0.4);ctx.stroke()});
  cv.addEventListener('pointermove',e=>{if(!dr)return;e.preventDefault();const p=pos(e);ctx.beginPath();ctx.moveTo(lx,ly);ctx.lineTo(p[0],p[1]);ctx.stroke();lx=p[0];ly=p[1]});
  const end=()=>{if(!dr)return;dr=false;emargSigs[key]=cv.toDataURL('image/png');cv.classList.add('signe');majNbSig()};
  ['pointerup','pointerleave','pointercancel'].forEach(ev=>cv.addEventListener(ev,end))}
async function saveEmarg(){
  const chantier=document.getElementById('e-chantier').value.trim(),date=document.getElementById('e-date').value,
        anim=document.getElementById('e-anim').value.trim(),theme=document.getElementById('e-theme').value.trim();
  if(!chantier){toast('Renseigne le chantier',true);return}
  if(!date){toast('Renseigne la date',true);return}
  if(!anim){toast("Renseigne l'animateur",true);return}
  if(!theme){toast('Renseigne les flashs / thèmes abordés',true);return}
  const anR=nomRoster(anim);if(anR)emargPick[anR]=true;   // V3 : l'animateur participe
  const noms=emargNoms();
  if(!noms.length){toast('Coche au moins un participant',true);return}
  const dbl=doublonFiche(date,anim,null);
  if(dbl&&!window.__emargForce){if(!confirm('Une fiche existe déjà le '+frDate(dbl.date)+' animée par '+dbl.cond+' ('+(dbl.chantier||'chantier ?')+', '+nbParticipants(dbl)+' participants).\n\nValider quand même cette nouvelle fiche ?'))return}
  window.__emargForce=false;
  const nonSignes=noms.filter(o=>!emargSigs[o.key]);
  if(nonSignes.length&&!confirm(nonSignes.length+' participant(s) sans signature :\n'+nonSignes.slice(0,8).map(o=>'· '+o.nom).join('\n')+(nonSignes.length>8?'\n…':'')+'\n\nValider quand même ?'))return;
  const present={};actifs().forEach(p=>{if(emargPick[p.name])present[p.name]=true});
  const q={id:uid(),date,theme,chantier,cond:anim,remontees:document.getElementById('e-dialogue').value.trim(),present,
    externes:emargExt.map(e=>({name:e.name,soc:e.soc||''})),
    emarg:{duree:document.getElementById('e-duree').value.trim(),operation:document.getElementById('e-operation').value.trim(),
      risquesTxt:document.getElementById('e-risques').value.trim(),rep:Object.assign({},emargYN),
      nbSignes:noms.filter(o=>!!emargSigs[o.key]).length,total:noms.length,at:new Date().toISOString()},
    pieces:[],hasPdf:false,pdfName:'',maj:nowISO(),source:'emargement'};
  state.qhps.push(q);
  if(q.chantier){const ex=state.chantiers.find(c=>c.nom.toLowerCase()===q.chantier.toLowerCase());
    if(ex){if(q.cond)ex.cond=q.cond;ex.maj=nowISO()}else state.chantiers.push({id:uid(),nom:q.chantier,cond:q.cond||'',maj:nowISO()})}
  await pdfPut('sig_'+q.id,{sigs:emargSigs,noms});
  save();renderFiches();syncAuto(q.id);
  const payload={type:'qhp-fiche',v:1,fiche:q,sigs:emargSigs,noms};
  window.__lastEmarg={id:q.id,payload};
  document.getElementById('em-banner').innerHTML='';
  document.getElementById('em-apres').innerHTML=
    '<div class="banner ok">✅ <b>Fiche enregistrée</b> — '+noms.length+' participant(s), '+q.emarg.nbSignes+' signature(s).<br>'+
    (syncConfigure()
      ? 'Elle remonte automatiquement dans le suivi HSE. Tu peux fermer, c\'est fait.'
      : 'Si tu n\'es <b>pas</b> sur l\'appareil du service HSE, envoie-la avec le bouton « Envoyer au suivi » : le fichier s\'importe en un clic côté HSE (Réglages ▸ Importer une fiche signée).')+'</div>'+
    '<div class="row" style="margin-bottom:14px">'+
    '<button class="btn btn-ghost grow" onclick="printEmarg(\''+q.id+'\')">🖨 Imprimer / PDF</button>'+
    '<button class="btn btn-accent grow" onclick="envoyerEmarg()">📤 Envoyer au suivi</button>'+
    '<button class="btn btn-primary grow" onclick="openEmarg()">＋ Nouvelle fiche</button>'+
    '<button class="btn btn-ghost grow" onclick="closeEmarg()">↩ Retour au suivi</button></div>';
  toast('Fiche d\'émargement enregistrée ✓');window.scrollTo(0,document.body.scrollHeight)}
async function envoyerEmarg(){const L=window.__lastEmarg;if(!L){toast('Rien à envoyer',true);return}
  const txt=JSON.stringify(L.payload);const nom='QHP-'+(L.payload.fiche.date||'')+'-'+(L.payload.fiche.chantier||'').replace(/[^\w\-]+/g,'_').slice(0,28)+'.qhp.json';
  try{if(navigator.canShare){const f=new File([txt],nom,{type:'application/json'});
      if(navigator.canShare({files:[f]})){await navigator.share({files:[f],title:'Fiche QHP signée'});toast('Partage lancé');return}}}catch(e){}
  dl(nom,txt,'application/json');toast('Fichier téléchargé — envoie-le au service HSE')}
async function importFiche(inp){const f=inp.files[0];if(!f)return;inp.value='';
  try{const j=JSON.parse(await f.text());
    if(!j||j.type!=='qhp-fiche'||!j.fiche||!j.fiche.id)throw 0;
    const q=j.fiche;
    if(state.qhps.some(x=>x.id===q.id)){toast('Cette fiche est déjà importée',true);return}
    const dbl=doublonFiche(q.date,q.cond,null);if(dbl&&!confirm('Une fiche existe déjà le '+frDate(dbl.date)+' animée par '+dbl.cond+' ('+(dbl.chantier||'?')+'). Importer quand même ?'))return;
    if(!confirm('Importer la fiche du '+frDate(q.date)+' — '+(q.chantier||'?')+' ('+Object.keys(q.present||{}).length+' participants) ?'))return;
    q.present=q.present&&typeof q.present==='object'?q.present:{};
    state.qhps.push(q);
    if(q.chantier&&!state.chantiers.some(c=>c.nom.toLowerCase()===q.chantier.toLowerCase()))state.chantiers.push({id:uid(),nom:q.chantier,cond:q.cond||''});
    if(j.sigs)await pdfPut('sig_'+q.id,{sigs:j.sigs,noms:j.noms||[]});
    save();renderFiches();renderReglages();toast('Fiche importée ✓')}
  catch(e){toast('Fichier non reconnu',true)}}
async function printEmarg(id){const q=state.qhps.find(x=>x.id===id);if(!q||!q.emarg){toast('Fiche non signable',true);return}
  let st=await pdfGet('sig_'+id);
  if((!st||!st.sigs)&&syncConfigure()){await piecesGetOuTelecharger(id);st=await pdfGet('sig_'+id)}
  st=st||{};const sigs=st.sigs||{};const noms=st.noms&&st.noms.length?st.noms:Object.keys(q.present||{}).map(n=>({key:n,nom:n,sub:''}));
  const r=q.emarg.rep||{};const YN=v=>v===true?'<b style="color:#1B7A3D">☑ OUI</b> / ☐ NON':(v===false?'☐ OUI / <b style="color:#C00000">☑ NON</b>':'☐ OUI / ☐ NON');
  const lignes=noms.map(o=>'<tr><td class="n">'+esc(o.nom)+(o.sub?'<br><span class="sb">'+esc(o.sub)+'</span>':'')+'</td><td class="s">'+(sigs[o.key]?'<img src="'+sigs[o.key]+'">':'')+'</td></tr>').join('');
  const html='<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>QHP '+esc(q.date)+' — '+esc(q.chantier||'')+'</title><style>'+
    'body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;padding:16px 22px;font-size:12.5px}'+
    '.hd{background:#1B7FA8;color:#fff;padding:10px 14px;font-size:19px;font-weight:bold;display:flex;align-items:center;gap:12px;margin-bottom:14px}'+
    '.hd img{height:38px;background:#fff;border-radius:5px;padding:3px}'+
    'h2{font-size:13.5px;margin:14px 0 6px;color:#111}.bx{border:1px solid #000;padding:7px 9px;min-height:26px;white-space:pre-wrap}'+
    '.g{display:flex;gap:14px}.g>div{flex:1}.lb{text-decoration:underline;font-size:12px;margin-bottom:3px}'+
    'ul{margin:6px 0;padding-left:18px}li{margin:5px 0}'+
    'table{width:100%;border-collapse:collapse;margin-top:6px}th{background:#c9c9c9;border:1px solid #000;padding:6px;font-size:12.5px}'+
    'td{border:1px solid #000;height:44px;vertical-align:middle}td.n{width:47%;padding:4px 8px;font-weight:600}td.s{text-align:center}'+
    'td.s img{max-height:40px;max-width:96%}.sb{font-weight:400;color:#555;font-size:10px}'+
    '@media print{.np{display:none}}</style></head><body>'+
    '<div class="hd">'+(window.__LOGO__?'<img src="'+window.__LOGO__+'">':'')+'<span>QUART HEURE PREVENTION / MISE AU TRAVAIL</span></div>'+
    '<h2>➢ INFORMATIONS GENERALES :</h2><div class="g"><div><div class="lb">Chantier :</div><div class="bx">'+esc(q.chantier||'')+'</div></div>'+
    '<div style="flex:0 0 150px"><div class="lb">Date :</div><div class="bx">'+esc(frDate(q.date))+'</div></div></div>'+
    '<div class="g" style="margin-top:8px"><div><div class="lb">Animateur du QHP / Mise au Travail :</div><div class="bx">'+esc(q.cond||'')+'</div></div>'+
    '<div style="flex:0 0 150px"><div class="lb">Durée du QHP :</div><div class="bx">'+esc(q.emarg.duree||'')+'</div></div></div>'+
    '<h2>➢ FLASHS HSE PRESENTES / THEMES ABORDES :</h2><div class="bx">'+esc(q.theme||'')+'</div>'+
    '<h2>➢ DESCRIPTION DE L\'OPERATION PREVUE / EN COURS :</h2><div class="bx">'+esc(q.emarg.operation||'')+'</div>'+
    '<ul><li>Les risques liés à l\'opération de travail ont été abordés ? '+YN(r.risques)+
    (q.emarg.risquesTxt?'<div style="color:#1F4E79;margin:4px 0 0 8px">⇨ Les risques principaux sont : '+esc(q.emarg.risquesTxt)+'</div>':'')+'</li>'+
    '<li>Tous les intervenants sont formés pour la tâche en cours ? '+YN(r.formes)+'</li>'+
    '<li>Nouvel arrivant présent / intérimaire ? '+YN(r.nouvel)+(r.nouvel===true?'<div style="color:#1F4E79;margin:4px 0 0 8px">⇨ Accueil Sécurité ? '+YN(r.accueil)+'</div>':'')+'</li>'+
    '<li>Les EPI sont portés ? '+YN(r.epi)+'</li></ul>'+
    '<table><thead><tr><th>NOM DES PARTICIPANTS</th><th>SIGNATURES</th></tr></thead><tbody>'+lignes+'</tbody></table>'+
    '<h2 style="text-align:center;text-decoration:underline;margin-top:14px">DIALOGUE, SYNTHESE ET ENGAGEMENT DE L\'EQUIPE</h2>'+
    '<div class="bx" style="min-height:90px">'+esc(q.remontees||'')+'</div>'+
    '<p class="np" style="margin-top:16px;text-align:center"><button onclick="window.print()" style="padding:10px 20px;font-size:15px;cursor:pointer">🖨 Imprimer / Enregistrer en PDF</button></p>'+
    '</body></html>';
  const w=window.open('','_blank');
  if(!w){dl('QHP-'+q.date+'.html',html,'text/html;charset=utf-8');toast('Fenêtre bloquée — fichier téléchargé');return}
  w.document.open();w.document.write(html);w.document.close()}

/* ===== calculs ===== */
function presentDansMois(name,y,i){const k=mkey(y,i);return state.qhps.some(q=>(q.date||'').slice(0,7)===k&&q.present&&q.present[name])}
function chantiersCouvertsCond(cond,y,i){const k=mkey(y,i);const s=new Set();state.qhps.forEach(q=>{if((q.date||'').slice(0,7)===k&&q.cond===cond&&q.chantier)s.add(q.chantier)});return s.size}
function bilanIndividuel(p,y){
  let tot=0,attendu=0;
  for(let i=0;i<12;i++){
    if(presentDansMois(p.name,y,i))tot++;               // V3 : une présence compte toujours (même le mois du départ)
    if(!moisActif(p,y,i))continue;
    if(moisPasse(y,i)&&!estExclu(p.name,y,i))attendu+=cadence(p);
  }
  const taux=attendu>0?tot/attendu:null;
  let etat='neutre';
  if(taux!==null){ if(tot===0&&attendu>=1)etat='ko'; else if(taux>=0.8)etat='ok'; else etat='moyen'; }
  return {tot,attendu:Math.round(attendu*10)/10,taux,etat}
}
const ICO={ok:'<span class="alert-ico" title="Objectif tenu">✅</span>',moyen:'<span class="alert-ico" title="En dessous de 80 % de l\'attendu">⚠️</span>',ko:'<span class="alert-ico" title="Aucun QHP">🚫</span>',neutre:''};

/* ============================================================================
   V3 — SUIVI : UN SEUL ÉCRAN. L'ANNÉE ENTIÈRE D'ABORD, UN MOIS AU CLIC.
   Barre : [Collaborateurs | Animateurs] + menus Année · Mois · Groupe/agence.
   · Collaborateurs : qui a participé, mois par mois. Une case se touche :
       ✗ absent  → « a participé » (on choisit le QHP du mois, ou on crée la fiche) ou N/A ;
       V présent → retirer d'une fiche, ou N/A ;  N/A → remettre absent, ou « a participé ».
     Pas de doublon possible : une personne est comptée une fois par fiche, une fois par mois.
   · Animateurs : une ligne par animateur, QHP animés par mois + total.
   · Un mois : indicateurs du mois, QHP du mois (tableau), participation par agence.
   ============================================================================ */
function setAnnuel(m){anMode=m;document.getElementById('tg-collab').classList.toggle('on',m==='collab');document.getElementById('tg-cond').classList.toggle('on',m==='cond');renderSuivi()}
function setMois(v){anMois=(v===''||v===null||v===undefined)?'':+v;renderSuivi()}
function chgAnnee(d){anAnnee+=d;renderSuivi()}
function chgMois(d){if(anMois==='')return;let i=anMois+d;if(i<0){i=11;anAnnee--}if(i>11){i=0;anAnnee++}anMois=i;renderSuivi()}
function anneesConnues(){const s=new Set([nowY,anAnnee]);state.qhps.forEach(q=>{const y=+String(q.date||'').slice(0,4);if(y>2000)s.add(y)});return [...s].sort((a,b)=>b-a)}
function renderSelects(){
  const sa=document.getElementById('sel-annee'),sm=document.getElementById('sel-mois'),sf=document.getElementById('sel-filtre');if(!sa)return;
  sa.innerHTML=anneesConnues().map(y=>'<option value="'+y+'"'+(y===anAnnee?' selected':'')+'>'+y+'</option>').join('');
  sm.innerHTML='<option value=""'+(anMois===''?' selected':'')+'>📅 Année entière</option>'+MOIS_L.map((m,i)=>'<option value="'+i+'"'+(anMois===i?' selected':'')+'>'+m+'</option>').join('');
  // V3.3.1 : Tout le monde · Agences (une fois chacune) · Groupes (sans les groupes « Agence … » qui doublonnent) · Animateurs par nom
  const opt=(v,l)=>'<option value="'+esc(v)+'"'+(v===anFiltre?' selected':'')+'>'+esc(l)+'</option>';
  const groupes=filtreGroupes(),anims=animateurs().map(p=>p.name).sort((a,b)=>a.localeCompare(b,'fr'));
  const valeurs=['(tous)'].concat(state.agences.map(a=>'Agence '+a),groupes,anims.map(n=>'P:'+n));
  if(!valeurs.includes(anFiltre))anFiltre='(tous)';
  sf.innerHTML=opt('(tous)','👥 Tout le monde')
    +'<optgroup label="📍 Agences">'+state.agences.map(a=>opt('Agence '+a,'Agence '+a)).join('')+'</optgroup>'
    +(groupes.length?'<optgroup label="👥 Groupes">'+groupes.map(g=>opt(g,g)).join('')+'</optgroup>':'')
    +(anims.length?'<optgroup label="🎓 Animateurs">'+anims.map(n=>opt('P:'+n,n)).join('')+'</optgroup>':'')}
function filtreGroupes(){const ag=state.agences.map(a=>cleNomJs(a));
  return [...new Set(state.secteurs)].filter(g=>{const c=cleNomJs(g).split(' ');return !(c.includes('agence')&&ag.some(a=>c.includes(a)))})}
function renderSuivi(){fermerPop();renderSelects();const box=document.getElementById('suivi-body');if(!box)return;
  box.innerHTML=anMois===''?(anMode==='cond'?annuelConduc():annuelCollab()):renderMensuel(anAnnee,anMois)}
function renderAnnuel(){renderSuivi()}
function filtrer(list){
  if(anFiltre==='(tous)')return list;
  if(anFiltre.startsWith('P:'))return list.filter(p=>p.name===anFiltre.slice(2));   // V3.3.1 : une personne
  if(anFiltre.startsWith('Agence '))return list.filter(p=>(p.agence||'IDF')===anFiltre.slice(7));
  return list.filter(p=>(state.secteurs.includes(p.secteur)?p.secteur:'(sans groupe)')===anFiltre)}
function enteteMois(y){let h='';for(let i=0;i<12;i++)h+='<th class="mo'+(y===nowY&&i===nowM?' cur':'')+'" title="Voir '+MOIS_L[i]+' '+y+'" onclick="setMois('+i+')">'+MOIS_S[i].replace('.','')+'</th>';return h}
function qhpsDuMois(y,i){const k=mkey(y,i);return state.qhps.filter(q=>(q.date||'').slice(0,7)===k).sort((a,b)=>(a.date||'').localeCompare(b.date||''))}
function fichesOuPresent(name,y,i){return qhpsDuMois(y,i).filter(q=>q.present&&q.present[name])}

/* ---- COLLABORATEURS ---- */
function annuelCollab(){
  const g=grouper(filtrer(state.roster.slice()));
  let h='<div class="card"><h2>👥 Participation aux QHP · '+anAnnee+'</h2><div class="tbl-wrap"><table class="an"><thead><tr><th class="nom">Collaborateur</th>'+enteteMois(anAnnee)+'<th>Total</th></tr></thead><tbody>';
  let any=false;
  Object.keys(g).forEach(sec=>{const people=g[sec];if(!people.length)return;any=true;h+='<tr><td class="sec" colspan="14"><span>'+esc(sec)+' ('+people.length+')'+(sec===SUPPORT?' — 1 QHP / 4 mois par défaut':'')+'</span></td></tr>';
    people.forEach(p=>{let cells='';
      for(let i=0;i<12;i++){
        const nm=esc(p.name),attr=' data-n="'+nm+'" data-y="'+anAnnee+'" data-i="'+i+'" onclick="ouvrirMenuCase(event,this)"';
        if(presentDansMois(p.name,anAnnee,i)){cells+='<td class="v"'+attr+' title="Présent — touche pour voir / retirer">V</td>';continue}
        if(!moisActif(p,anAnnee,i)){const dep=p.dateDepart&&p.dateDepart.slice(0,7)<=mkey(anAnnee,i);cells+='<td class="g'+(dep?' dep':'')+'" title="'+(dep?'Parti en '+esc(moisLbl(p.dateDepart)):(p.dateAjout?'Arrivé en '+esc(moisLbl(p.dateAjout)):'Hors période'))+'">'+(dep?'N/A':'')+'</td>';continue}
        if(estExclu(p.name,anAnnee,i)){cells+='<td class="na"'+attr+' title="Non compté ce mois — touche pour changer">N/A</td>'}
        else if(moisPasse(anAnnee,i))cells+='<td class="x"'+attr+' title="Absent — touche pour l’ajouter à un QHP ou le passer en N/A">✗</td>';
        else cells+='<td class="fut">·</td>'}
      const b=bilanIndividuel(p,anAnnee);
      h+='<tr><td class="nom">'+esc(p.name)+(p.conducteur?' <span title="animateur">🎓</span>':'')+(quatreMois(p)?'<span class="r4" title="1 QHP tous les 4 mois — hors % mensuel (Réglages ▸ Rythme des QHP)">4 mois</span>':'')+agPill(p.agence)+ICO[b.etat]+'</td>'+cells+'<td class="tot" title="attendu à ce jour : '+(b.attendu||'—')+'">'+b.tot+'</td></tr>'})});
  h+='</tbody></table></div>';
  if(!any)h+='<p class="hint">Aucun collaborateur.</p>';
  h+='<div class="legende"><span><b class="lv">V</b> présent</span><span><b class="lx">✗</b> absent</span><span><b>N/A</b> non compté (arrêt, congés, parti)</span><span>· à venir</span><span>✅ ≥ 80 % de l’attendu · ⚠️ en dessous · 🚫 aucun QHP</span><span><b>Touche une case</b> pour ajouter une participation ou passer en N/A · <b>touche un mois</b> pour le détailler</span></div>';
  h+='<div class="row no-print" style="margin-top:10px"><button class="btn btn-ghost grow" onclick="exportCollab('+anAnnee+')">⬇ Export CSV</button><button class="btn btn-ghost grow" onclick="window.print()">🖨 Imprimer</button></div></div>';return h}

/* ---- le menu d'une case ---- */
let popCible=null;
function fermerPop(){const el=document.getElementById('popcell');if(el){el.style.display='none';el.innerHTML=''}popCible=null}
document.addEventListener('mousedown',e=>{const el=document.getElementById('popcell');if(el&&el.style.display!=='none'&&!el.contains(e.target)&&!(e.target.closest&&e.target.closest('td.v,td.x,td.na')))fermerPop()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')fermerPop()});
/* V3.4.1 — menu d'une case, COURT : l'action principale en premier (N/A / remettre absent), les QHP du mois
   dans une liste déroulante (plus la liste de toutes les fiches du mois qui débordait de l'écran et se
   refermait quand on faisait défiler la page). Le menu reste dans la fenêtre (position fixe). */
function ouvrirMenuCase(ev,td){
  const name=td.dataset.n,y=+td.dataset.y,i=+td.dataset.i;const el=document.getElementById('popcell');
  if(popCible===td){fermerPop();return}
  popCible=td;const qs=qhpsDuMois(y,i),dedans=fichesOuPresent(name,y,i),dehors=qs.filter(q=>!(q.present&&q.present[name]));
  const na=esc(name),ex=estExclu(name,y,i);
  const lq=q=>esc(frDate(jourQ(q.date)))+' · '+esc(q.cond||'sans animateur')+' <small>'+esc(q.chantier||'')+'</small>';
  let h='<div class="pt">'+na+'<small>'+MOIS_L[i]+' '+y+(dedans.length?' · présent à '+dedans.length+' QHP':ex?' · non compté (N/A)':' · absent')+'</small></div>';
  if(!dedans.length)h+='<button class="pri" data-n="'+na+'" onclick="fermerPop();toggleExclu(this.dataset.n,'+y+','+i+')">'+(ex?'✗ Remettre <b>absent</b>':'⛔ Passer en <b>N/A</b> <small>(non compté ce mois)</small>')+'</button>';
  else h+=dedans.map(q=>'<button class="q" data-n="'+na+'" data-q="'+esc(q.id)+'" onclick="retirerPresence(this.dataset.q,this.dataset.n)">➖ Retirer de : '+lq(q)+'</button>').join('');
  if(dehors.length)h+='<div class="sep"></div><label class="pl">✅ A participé au QHP…</label><select class="psel" data-n="'+na+'" onchange="if(this.value)ajouterPresence(this.value,this.dataset.n)"><option value="">— choisir parmi les '+dehors.length+' QHP du mois —</option>'
    +dehors.map(q=>'<option value="'+esc(q.id)+'">'+esc(frDate(jourQ(q.date))+' · '+(q.cond||'sans animateur')+(q.chantier?' · '+q.chantier:''))+'</option>').join('')+'</select>';
  h+='<button class="sec2" data-n="'+na+'" onclick="nouvelleFichePour(this.dataset.n,'+y+','+i+')">➕ Nouvelle fiche ce mois</button>';
  el.innerHTML=h;el.style.display='block';
  const r=td.getBoundingClientRect(),vw=document.documentElement.clientWidth,vh=window.innerHeight,w=el.offsetWidth||280,hh=el.offsetHeight||200;
  let x=Math.min(Math.max(8,r.left),vw-w-8),yv=r.bottom+4;if(yv+hh>vh-8)yv=Math.max(8,r.top-hh-4);
  el.style.left=x+'px';el.style.top=yv+'px'}
window.addEventListener('scroll',()=>{if(popCible)fermerPop()},{passive:true});   // le menu suit sa case : on le referme si la page défile
function ajouterPresence(qid,name){const q=state.qhps.find(x=>x.id===qid);if(!q)return;
  if(q.present&&q.present[name]){toast(name+' est déjà compté sur cette fiche');fermerPop();return}   // anti-doublon
  q.present=q.present||{};q.present[name]=true;q.maj=nowISO();save();fermerPop();renderSuivi();toast(name+' ajouté au QHP du '+frDate(q.date)+' ✓');syncAuto(q.id)}
function retirerPresence(qid,name){const q=state.qhps.find(x=>x.id===qid);if(!q||!q.present)return;
  if(nomRoster(q.cond)===name&&!confirm(name+' est l’animateur de cette fiche. Le retirer quand même ?'))return;
  delete q.present[name];q.maj=nowISO();save();fermerPop();renderSuivi();toast(name+' retiré du QHP du '+frDate(q.date));syncAuto(q.id)}
async function nouvelleFichePour(name,y,i){fermerPop();await openFiche();
  const dernier=new Date(y,i+1,0);const d=(y===nowY&&i===nowM)?todayISO:(dernier<new Date()?dernier:new Date(y,i,1)).toISOString().slice(0,10);
  document.getElementById('f-date').value=d;pickPres[name]=true;renderPickNames();document.getElementById('f-theme').focus()}

/* ---- ANIMATEURS : une ligne par animateur ---- */
function qhpRealisesCond(cond,y,i){const k=mkey(y,i),c=cleNomJs(cond);
  return state.qhps.filter(q=>(q.date||'').slice(0,7)===k&&cleNomJs(q.cond)===c).length}
function collabSensibMois(cond,y,i){const k=mkey(y,i),vus={},c=cleNomJs(cond);
  state.qhps.forEach(q=>{if((q.date||'').slice(0,7)!==k)return;if(cleNomJs(q.cond)!==c)return;
    Object.keys(q.present||{}).forEach(n=>{if(q.present[n])vus[n]=1})});
  return Object.keys(vus).length}
function annuelConduc(){
  const g=grouper(filtrer(animateurs()));
  let h='<div class="card"><h2>🎓 QHP animés · '+anAnnee+'</h2><div class="tbl-wrap"><table class="an"><thead><tr><th class="nom">Animateur</th>'+enteteMois(anAnnee)+'<th>Total</th></tr></thead><tbody>';
  let any=false;
  Object.keys(g).forEach(sec=>{const people=g[sec];if(!people.length)return;any=true;h+='<tr><td class="sec" colspan="14"><span>'+esc(sec)+' ('+people.length+')</span></td></tr>';
    people.forEach(p=>{let cells='',tot=0;
      for(let i=0;i<12;i++){
        if(!moisActif(p,anAnnee,i)&&!qhpRealisesCond(p.name,anAnnee,i)){cells+='<td class="g"></td>';continue}
        const n=qhpRealisesCond(p.name,anAnnee,i);tot+=n;
        cells+='<td class="n'+(n?'':' z')+'" title="'+MOIS_L[i]+' : '+n+' QHP animé'+(n>1?'s':'')+' — touche pour voir le mois" onclick="setMois('+i+')">'+(n||(moisPasse(anAnnee,i)?'0':'·'))+'</td>'}
      h+='<tr><td class="nom">'+esc(p.name)+agPill(p.agence)+'</td>'+cells+'<td class="tot">'+tot+'</td></tr>'})});
  h+='</tbody></table></div>';
  if(!any)h+='<p class="hint">Aucun animateur dans ce filtre. Un animateur est un collaborateur coché « animateur » (encadrant chantier) dans la liste.</p>';
  h+='<div class="legende"><span>Nombre de QHP animés dans le mois (d’après les fiches : champ « Animateur »)</span><span><b>Touche un mois</b> pour voir ses QHP</span></div>';
  h+='<div class="row no-print" style="margin-top:10px"><button class="btn btn-ghost grow" onclick="exportConduc('+anAnnee+')">⬇ Export CSV</button><button class="btn btn-ghost grow" onclick="window.print()">🖨 Imprimer</button></div></div>';return h}
function setGestion(key,cond,val){if(!state.gestion[key])state.gestion[key]={};const n=parseInt(val);if(val===''||isNaN(n))delete state.gestion[key][cond];else state.gestion[key][cond]=n;
  state.majDico.gestion[key+'|'+cond]=nowISO();save();syncAuto()}

/* ---- UN MOIS ---- */
function renderMensuel(y,i){
  const yy=String(y),mois=mkey(y,i);
  const qs=qhpsDuMois(y,i);
  const effTous=filtrer(actifs()).filter(p=>moisActif(p,y,i)&&!estExclu(p.name,y,i));
  const eff=effTous.filter(p=>!quatreMois(p)),hors4=effTous.length-eff.length;   // V3.4 : rythme 4 mois hors %
  const N=eff.length;
  const vus=new Set();qs.forEach(q=>eff.forEach(p=>{if(q.present&&q.present[p.name])vus.add(p.name)}));
  const taux=N?Math.round(vus.size/N*100):0;const ok=taux>=conf.objPart;
  const nbExclus=filtrer(actifs()).filter(p=>moisActif(p,y,i)&&estExclu(p.name,y,i)).length;
  let h='<div class="card no-print"><div class="mois-nav"><button class="btn btn-ghost btn-sm" onclick="setMois(\'\')">◀ Année entière</button><span class="grow"></span><button class="btn btn-ghost btn-sm" onclick="chgMois(-1)">◀</button><b>'+MOIS_L[i]+' '+yy+'</b><button class="btn btn-ghost btn-sm" onclick="chgMois(1)">▶</button></div></div>';
  h+='<div class="kpis"><div class="kpi"><div class="v">'+qs.length+'</div><div class="l">QHP réalisés</div></div>'
    +'<div class="kpi '+(ok?'goodbg':'warnbg')+'"><div class="v">'+taux+'%</div><div class="l">Participation ('+vus.size+'/'+N+')'+(hors4?'<br><span class="r4" title="réglé dans Réglages ▸ Rythme des QHP">+ '+hors4+' au rythme 4 mois, hors %</span>':'')+'</div></div>'
    +'<div class="kpi big"><div class="l" style="margin-bottom:2px">Objectif participation '+conf.objPart+'%</div><div class="bar '+(ok?'ok':'warn')+'"><i style="width:'+Math.min(100,taux)+'%"></i><span class="seuil" style="left:'+Math.min(100,conf.objPart)+'%"></span></div><div class="sub">'+(ok?'✅ Objectif atteint':'⛔ '+(conf.objPart-taux)+' pts sous l’objectif')+(nbExclus?' · '+nbExclus+' personne(s) non comptée(s) ce mois':'')+'</div></div></div>';
  // par agence (compact)
  const ags=state.agences.map(a=>{const l=eff.filter(p=>(p.agence||'IDF')===a);if(!l.length)return '';const v=l.filter(p=>vus.has(p.name)).length;const pc=Math.round(v/l.length*100);
    return '<span class="pill '+(pc>=conf.objPart?'ok':pc>=50?'mid':'warn')+'" title="'+v+' vus sur '+l.length+'">'+esc(a)+' '+pc+'%</span>'}).filter(Boolean).join(' ');
  if(ags)h+='<div class="card" style="margin-top:12px"><h2>📍 Par agence</h2><div class="row" style="gap:8px">'+ags+'</div></div>';
  h+='<div class="card"><h2>🗂 QHP du mois ('+qs.length+')</h2>'+(qs.length?tableQhps(qs):'<p class="hint">Aucun QHP ce mois. Enregistre-le depuis l’accueil, ou touche une case du suivi annuel.</p>')+'</div>';
  return h}

/* ===== Réglages ===== */
function renderReglages(){
  renderRythme();   // V3.4
  document.getElementById('lien-emarg').value=lienEmarg();
  document.getElementById('sy-url').value=conf.webhook||'';
  document.getElementById('sy-secret').value=conf.secret||'';
  document.getElementById('sy-appareil').value=conf.appareil||'';
  document.getElementById('sy-auto').checked=conf.autoSync!==false;
  document.getElementById('branchement-box').style.display=conf.webhook?'':'none';
  if(!syncEnCours)syncEtat(syncConfigure()
    ? (conf.dernierSync?('Dernière synchro : '+new Date(conf.dernierSync).toLocaleString('fr-FR')):'Configuré — pas encore synchronisé')
    : 'Non configuré — l\'appli travaille en local sur cet appareil','muted');
  document.getElementById('obj-part').value=conf.objPart;
  document.getElementById('cad-std').value=String(conf.cadStd);
  document.getElementById('cad-sup').value=String(conf.cadSup);
  document.getElementById('sec-list').innerHTML='<div class="tbl-wrap"><table><tbody>'+state.secteurs.map((s,i)=>`<tr><td>${esc(s)} <span class="muted small">(${state.roster.filter(p=>p.secteur===s).length})</span></td><td style="width:44px;text-align:right"><button class="btn btn-ghost btn-sm" onclick="delSecteur(${i})">🗑</button></td></tr>`).join('')+'</tbody></table></div><p class="hint">Agences : '+state.agences.join(' · ')+'</p>';
  fillSelect(document.getElementById('new-name-sec'),state.secteurs,state.secteurs[0]||'');
  fillSelect(document.getElementById('new-name-ag'),state.agences,'IDF');
  const rf=document.getElementById('reg-filtre');const opts=['(tous)','(animateurs)'].concat(state.secteurs).concat(state.agences.map(a=>'Agence '+a));
  const cur=rf.value||'(tous)';fillSelect(rf,opts,opts.includes(cur)?cur:'(tous)');
  let flt=rf.value||'(tous)';let list=state.roster;
  if(flt==='(animateurs)')list=state.roster.filter(p=>p.conducteur);
  else if(flt.startsWith('Agence '))list=state.roster.filter(p=>(p.agence||'IDF')===flt.slice(7));
  else if(flt!=='(tous)')list=state.roster.filter(p=>(state.secteurs.includes(p.secteur)?p.secteur:'(sans groupe)')===flt);
  const ref=rosterReferentiel();
  document.getElementById('roster-ref').style.display=ref?'':'none';document.getElementById('roster-ajout').style.display=ref?'none':'';
  document.getElementById('roster-etat').innerHTML=etatReferentielHtml();
  const g=grouper(list);let h='';
  Object.keys(g).forEach(sec=>{h+=`<h3>${esc(sec)} (${g[sec].length})</h3><div class="tbl-wrap"><table><tbody>`;
    g[sec].forEach(p=>{const idx=state.roster.indexOf(p);
      const st=p.dateDepart?('<span class="pill warn">parti '+moisLbl(p.dateDepart)+'</span>'):(p.dateAjout?('<span class="pill mid">dès '+moisLbl(p.dateAjout)+'</span>'):'');
      h+=`<tr><td>${esc(p.name)}${agPill(p.agence)}${p.conducteur?' <span class="pill ok">animateur</span>':''} ${st}</td>
        ${ref?'':`<td style="width:190px;text-align:right;white-space:nowrap">${p.dateDepart?'':'<button class="btn btn-ghost btn-sm" onclick="retirer('+idx+')">↩ Départ</button> '}<button class="btn btn-danger btn-sm" onclick="delName(${idx})">🗑 Supprimer</button></td>`}</tr>`});
    h+='</tbody></table></div>'});
  document.getElementById('roster-edit').innerHTML=h||'<p class="hint">Aucun collaborateur.</p>';
  document.getElementById('ch-list').innerHTML=state.chantiers.length?('<div class="tbl-wrap"><table><thead><tr><th>Chantier</th><th>Animateur</th><th></th></tr></thead><tbody>'+state.chantiers.map((c,i)=>`<tr><td>${esc(c.nom)}</td><td>${esc(c.cond||'—')}</td><td style="width:40px;text-align:right"><button class="btn btn-ghost btn-sm" onclick="delChantier(${i})">🗑</button></td></tr>`).join('')+'</tbody></table></div>'):'<p class="hint">Aucun chantier (ils se créent depuis les fiches).</p>'}
function rosterReferentiel(){return state.rosterSource==='referentiel'}
/* V3 — le serveur dit où en est le branchement au Référentiel CDES (V2.4) ; la page l'explique en clair. */
function etatReferentielHtml(){
  if(!syncConfigure())return '';
  const r=state.referentiel;if(!r)return '<div class="banner">ℹ️ Le script Suivi QHP n’a pas encore dit s’il est relié au Référentiel CDES : synchronise une fois (le script doit être en V2.4 ou plus).</div>';
  const seuls=(r.seulementQhp||[]);
  const liste=seuls.length?'<div class="banner" style="margin-top:8px">👤 <b>'+seuls.length+' personne'+(seuls.length>1?'s connues':' connue')+' du suivi QHP seulement</b> (absente'+(seuls.length>1?'s':'')+' du Référentiel, ou qhp ≠ oui) — gardée'+(seuls.length>1?'s':'')+' telle'+(seuls.length>1?'s':'')+' quelle'+(seuls.length>1?'s':'')+'. Toujours là ? Ajoute-la dans l’intranet (Collaborateurs) avec ce nom exact. Partie ? Ajoute-la avec sa date de départ.<div class="ref-liste">'+seuls.map(n=>'<span class="pill n">'+esc(n)+'</span>').join('')+'</div></div>':'';
  switch(r.etat){
    case 'ok':return liste;
    case 'sans-fichier':return '<div class="banner err">⚠️ <b>Référentiel non relié</b> : le fichier <code>Referentiel.gs</code> manque dans le script Apps Script « Suivi QHP ». Tant qu’il manque, les entrées / départs saisis dans l’intranet n’arrivent pas ici.</div>';
    case 'sans-id':return '<div class="banner err">⚠️ <b>Référentiel non relié</b> : la propriété <code>REFERENTIEL_ID</code> manque dans le script « Suivi QHP » (Paramètres du projet ▸ Propriétés du script). Tant qu’elle manque, les entrées / départs saisis dans l’intranet n’arrivent pas ici.</div>';
    case 'illisible':return '<div class="banner err">⚠️ <b>Référentiel illisible</b> : le classeur « Référentiel CDES » n’est pas accessible au script, ou son onglet COLLABORATEURS est vide. Vérifie REFERENTIEL_ID et le partage du classeur avec le compte du script.</div>';
    case 'desactive':return '<div class="banner">ℹ️ Liste tenue dans l’appli (propriété QHP_ROSTER_SOURCE = appli) : le Référentiel est ignoré volontairement.</div>';
    default:return ''}
}
function refBloque(){if(!rosterReferentiel())return false;toast('Liste tenue dans le Référentiel CDES : modifie-la là-bas',true);return true}
function moisLbl(iso){return MOIS_S[(+iso.slice(5,7))-1].replace('.','')+' '+iso.slice(0,4)}
function addSecteur(){const el=document.getElementById('new-sec');const s=el.value.trim();if(!s)return;if(state.secteurs.some(x=>x.toLowerCase()===s.toLowerCase())){toast('Déjà présent',true);return}state.secteurs.push(s);delete state.tomb.secteurs[s];save();el.value='';renderReglages();toast('Groupe ajouté');syncAuto()}
function delSecteur(i){const s=state.secteurs[i];const n=state.roster.filter(p=>p.secteur===s).length;if(!confirm('Retirer le groupe « '+s+' » ?'+(n?'\n'+n+' personne(s) passeront en « sans groupe ».':'')))return;state.roster.forEach(p=>{if(p.secteur===s){p.secteur='';p.maj=nowISO()}});state.tomb.secteurs[s]=nowISO();state.secteurs.splice(i,1);save();renderReglages();toast('Groupe retiré');syncAuto()}
function addName(){if(refBloque())return;const el=document.getElementById('new-name');const n=el.value.trim();if(!n){toast('Renseigne le nom',true);return}if(state.roster.some(p=>p.name.toLowerCase()===n.toLowerCase())){toast('Déjà présent',true);return}
  state.roster.push({name:n,secteur:document.getElementById('new-name-sec').value||'',agence:document.getElementById('new-name-ag').value||'IDF',conducteur:document.getElementById('new-name-cond').checked,dateAjout:todayISO,dateDepart:'',maj:nowISO()});
  delete state.tomb.roster[n];save();el.value='';document.getElementById('new-name-cond').checked=false;renderReglages();toast('« '+n+' » ajouté (actif dès le mois prochain)');syncAuto()}
function retirer(i){if(refBloque())return;const p=state.roster[i];if(!confirm('Départ de « '+p.name+' » aujourd\'hui ?\nLes mois suivants seront grisés, l\'historique est conservé.'))return;p.dateDepart=todayISO;p.maj=nowISO();save();renderReglages();toast('Départ enregistré');syncAuto()}
function delName(i){if(refBloque())return;const p=state.roster[i];if(!confirm('SUPPRIMER définitivement « '+p.name+' » ?\n\nPour garder l\'historique, utilise plutôt « ↩ Départ ».'))return;
  state.tomb.roster[p.name]=nowISO();state.roster.splice(i,1);save();renderReglages();toast('Supprimé');syncAuto()}
function delChantier(i){if(!confirm('Retirer « '+state.chantiers[i].nom+' » ?'))return;
  state.tomb.chantiers[state.chantiers[i].id]=nowISO();state.chantiers.splice(i,1);save();renderReglages();toast('Retiré');syncAuto()}

/* ===== Export ===== */
function dl(name,content,type){const b=new Blob([content],{type:type||'text/plain;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click();URL.revokeObjectURL(a.href)}
function csvCell(s){return '"'+String(s==null?'':s).replace(/"/g,'""')+'"'}
function exportJSON(){dl('sauvegarde-qhp-'+todayISO+'.json',JSON.stringify({state,conf},null,2),'application/json');toast('Sauvegarde téléchargée (hors PDF)')}
function importJSON(inp){const f=inp.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const j=JSON.parse(r.result);if(!j.state||!Array.isArray(j.state.roster))throw 0;if(!confirm('Remplacer les données actuelles ?'))return;state=Object.assign({secteurs:[],agences:['IDF','NA','BPL'],roster:[],chantiers:[],qhps:[],gestion:{},exclus:{}},j.state);if(j.conf)conf=Object.assign(conf,j.conf);save();try{localStorage.setItem(LS_CONF,JSON.stringify(conf))}catch(e){}renderReglages();renderFiches();toast('Restauré ✓')}catch(e){toast('Fichier invalide',true)}};r.readAsText(f);inp.value=''}
function exportCollab(annee){const sep=';';let rows=[['Groupe','Agence','Collaborateur',...MOIS_L,'Total','Attendu','Etat'].map(csvCell).join(sep)];
  const g=grouper();Object.keys(g).forEach(sec=>g[sec].forEach(p=>{const cells=[];
    for(let i=0;i<12;i++){if(presentDansMois(p.name,annee,i)){cells.push('V');continue}if(!moisActif(p,annee,i)){cells.push(p.dateDepart&&p.dateDepart.slice(0,7)<=mkey(annee,i)?'N/A':'');continue}
      if(estExclu(p.name,annee,i))cells.push('N/A');else if(moisPasse(annee,i))cells.push('X');else cells.push('')}
    const b=bilanIndividuel(p,annee);
    rows.push([sec,p.agence||'IDF',p.name,...cells,b.tot,b.attendu,{ok:'OK',moyen:'A SUIVRE',ko:'ALERTE',neutre:''}[b.etat]].map(csvCell).join(sep))}));
  dl('QHP-participation-'+annee+'.csv','\ufeff'+rows.join('\r\n'),'text/csv;charset=utf-8');toast('Export participation OK')}
function exportConduc(annee){const sep=';';
  let rows=[['Groupe','Animateur','Agence',...MOIS_L,'Total'].map(csvCell).join(sep)];
  const g=grouper(animateurs());Object.keys(g).forEach(sec=>g[sec].forEach(p=>{let tot=0;const q=[];
    for(let i=0;i<12;i++){const n=qhpRealisesCond(p.name,annee,i);tot+=n;q.push(moisActif(p,annee,i)||n?n:'')}
    rows.push([sec,p.name,p.agence||'IDF',...q,tot].map(csvCell).join(sep))}));
  dl('QHP-animateurs-'+annee+'.csv','﻿'+rows.join('\r\n'),'text/csv;charset=utf-8');toast('Export animateurs OK')}

/* le logo est dans js/logo.js */
/* ===================== LISTES (data/listes.json) =====================
   Secteurs et agences : non sensibles, modifiables sur GitHub sans toucher au
   code. Copie gardée sur l'appareil : sans réseau, la dernière liste reçue sert.
   Si rien n'est disponible, l'appli démarre quand même (valeurs par défaut). */
const CLE_LISTES='qhp_listes_v2';
async function chargerListes(){
  const appliquer=l=>{if(!l||!Array.isArray(l.secteurs)||!l.secteurs.length)return false;
    SEED.secteurs=l.secteurs.slice();if(Array.isArray(l.agences)&&l.agences.length)SEED.agences=l.agences.slice();return true};
  try{const r=await fetch('data/listes.json',{cache:'no-cache'});if(!r.ok)throw new Error('HTTP '+r.status);
    const l=await r.json();if(appliquer(l)){try{localStorage.setItem(CLE_LISTES,JSON.stringify(l))}catch(e){}return 'reseau'}}
  catch(e){}
  try{if(appliquer(JSON.parse(localStorage.getItem(CLE_LISTES)||'null')))return 'copie'}catch(e){}
  return 'defaut'}
async function demarrerQhp(){
await chargerListes();
setTimeout(repriseEnvois,4000);   // V3.3.1
  document.getElementById('logo').src=window.__LOGO__;
  document.getElementById('logo2').src=window.__LOGO__;
  load();renderFiches();
  appliquerLienBranchement();renderAccueil();
  if(syncConfigure()){document.getElementById('sync-pill').style.display='';setTimeout(()=>syncNow(false),800);
    setInterval(()=>{if(!document.hidden&&conf.autoSync!==false)syncNow(false)},300000);
    window.addEventListener('online',()=>syncNow(false));}
  routeEmarg();
  window.addEventListener('hashchange',()=>{
    // le lien de branchement peut être collé dans un onglet où l'appli tourne déjà
    if(/[#&]config=/.test(location.hash||'')){
      if(appliquerLienBranchement()){
        document.getElementById('sync-pill').style.display='';
        renderReglages();renderAccueil();setTimeout(()=>syncNow(false),400);
      }
    }
    routeEmarg();});
}
demarrerQhp();
