/* Suivi des QHP — CDES — fonctionnement de l’outil
   Découpage V2 du 05/10/2026. Ni liste nominative, ni adresse de serveur, ni secret. */
const LS='qhp_app_v5', LS_CONF='qhp_conf_v5';
const EPOCH='1970-01-01T00:00:00.000Z';
function nowISO(){return new Date().toISOString()}
/* V2 — PLUS AUCUNE LISTE NOMINATIVE DANS LA PAGE PUBLIQUE.
   Les collaborateurs viennent uniquement du serveur (onglet ROSTER), par la synchro,
   et seulement pour un appareil branché. Secteurs et agences : data/listes.json. */
let SEED={secteurs:[],agences:['IDF','NA','BPL'],roster:[]};
const SUPPORT='Fonctions Support';
let state={ secteurs:[], agences:['IDF','NA','BPL'], roster:[], chantiers:[], qhps:[], gestion:{}, exclus:{} };
let conf={ objPart:80, cadStd:1, cadSup:0.25, webhook:'', secret:'', appareil:'', autoSync:true };
let editId=null,pickPres={},piecesPending=null;
let anMode='collab', anAnnee=new Date().getFullYear(), anFiltre='(tous)';
const MOIS_S=['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
const MOIS_L=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const nowY=new Date().getFullYear(), nowM=new Date().getMonth();
const todayISO=new Date().toISOString().slice(0,10);
function uid(){return 'q'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function toast(m,e){const t=document.getElementById('toast');t.textContent=m;t.className=(e?'err ':'')+'show';clearTimeout(t._t);t._t=setTimeout(()=>t.className='',2600)}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function frDate(iso){const d=new Date(iso+'T00:00');if(isNaN(d))return iso;return d.getDate()+' '+MOIS_S[d.getMonth()]+' '+d.getFullYear()}
function mkey(y,i){return y+'-'+String(i+1).padStart(2,'0')}
function load(){try{const r=localStorage.getItem(LS);if(r){const s=JSON.parse(r);if(s&&Array.isArray(s.roster))state=Object.assign(state,s)}}catch(e){}
  if(!state.roster.length&&SEED){state.secteurs=SEED.secteurs.slice();state.roster=SEED.roster.map(p=>Object.assign({},p));state.agences=SEED.agences.slice()}
  if(!state.secteurs||!state.secteurs.length)state.secteurs=['Exploitation'];
  if(!state.agences||!state.agences.length)state.agences=['IDF','NA','BPL'];
  ['roster','chantiers','qhps'].forEach(k=>{if(!Array.isArray(state[k]))state[k]=[]});
  if(!state.gestion)state.gestion={}; if(!state.exclus)state.exclus={};
  state.roster.forEach(p=>{if(p.dateAjout===undefined)p.dateAjout='';if(p.dateDepart===undefined)p.dateDepart='';if(!p.agence)p.agence='IDF'});
  if(!state.tomb)state.tomb={qhps:{},roster:{},chantiers:{},secteurs:{}};
  ['qhps','roster','chantiers','secteurs'].forEach(k=>{if(!state.tomb[k])state.tomb[k]={}});
  if(!state.majDico)state.majDico={gestion:{},exclus:{},conf:{}};
  ['gestion','exclus','conf'].forEach(k=>{if(!state.majDico[k])state.majDico[k]={}});
  try{const c=localStorage.getItem(LS_CONF);if(c)conf=Object.assign(conf,JSON.parse(c))}catch(e){}}
function save(){try{localStorage.setItem(LS,JSON.stringify(state))}catch(e){toast('Mémoire pleine — sauvegarde puis retire d\'anciens PDF',true)}}
function saveConf(){conf.objPart=Math.max(0,Math.min(100,parseInt(document.getElementById('obj-part').value)||0));
  conf.cadStd=parseFloat(document.getElementById('cad-std').value)||1;conf.cadSup=parseFloat(document.getElementById('cad-sup').value)||0.25;
  ['objPart','cadStd','cadSup'].forEach(k=>state.majDico.conf['_|'+k]=nowISO());
  try{localStorage.setItem(LS_CONF,JSON.stringify(conf))}catch(e){}save();syncAuto()}
/* PDF idb */
function idb(){return new Promise((res,rej)=>{const r=indexedDB.open('qhp_pdf',1);r.onupgradeneeded=()=>r.result.createObjectStore('pdf');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function pdfPut(id,v){try{const db=await idb();await new Promise((r,j)=>{const t=db.transaction('pdf','readwrite');t.objectStore('pdf').put(v,id);t.oncomplete=r;t.onerror=()=>j(t.error)})}catch(e){}}
async function pdfGet(id){try{const db=await idb();return await new Promise((r,j)=>{const t=db.transaction('pdf','readonly');const q=t.objectStore('pdf').get(id);q.onsuccess=()=>r(q.result||null);q.onerror=()=>j(q.error)})}catch(e){return null}}
async function pdfDel(id){try{const db=await idb();await new Promise((r,j)=>{const t=db.transaction('pdf','readwrite');t.objectStore('pdf').delete(id);t.oncomplete=r;t.onerror=()=>j(t.error)})}catch(e){}}
/* helpers */
function conducteurs(){return state.roster.filter(p=>p.conducteur)}
function actifs(){return state.roster.filter(p=>!p.dateDepart||p.dateDepart>=todayISO)}
function cadence(p){return (p.secteur===SUPPORT)?conf.cadSup:conf.cadStd}
function grouper(list){const g={};state.secteurs.forEach(s=>g[s]=[]);g['(sans groupe)']=[];
  (list||state.roster).forEach(p=>{const s=state.secteurs.includes(p.secteur)?p.secteur:'(sans groupe)';g[s].push(p)});
  Object.keys(g).forEach(k=>{if(!g[k].length)delete g[k]});return g}
function fillSelect(sel,opts,cur,ph){sel.innerHTML=(ph?('<option value="">'+ph+'</option>'):'')+opts.map(o=>'<option value="'+esc(o)+'"'+(o===cur?' selected':'')+'>'+esc(o)+'</option>').join('')}
function moisActif(p,y,i){
  if(p.dateAjout){const ay=+p.dateAjout.slice(0,4),am=+p.dateAjout.slice(5,7)-1;if(y<ay)return false;if(y===ay&&i<=am)return false}
  if(p.dateDepart){const dy=+p.dateDepart.slice(0,4),dm=+p.dateDepart.slice(5,7)-1;if(y>dy)return false;if(y===dy&&i>dm)return false}
  return true}
function moisPasse(y,i){return y<nowY||(y===nowY&&i<=nowM)}
function estExclu(name,y,i){const k=mkey(y,i);return !!(state.exclus[k]&&state.exclus[k][name])}
function motifExclu(name,y,i){const k=mkey(y,i);return (state.exclus[k]||{})[name]||''}
function toggleExclu(name,y,i){const k=mkey(y,i);if(!state.exclus[k])state.exclus[k]={};
  if(state.exclus[k][name]){delete state.exclus[k][name];if(!Object.keys(state.exclus[k]).length)delete state.exclus[k]}else state.exclus[k][name]='N/A';
  state.majDico.exclus[k+'|'+name]=nowISO();save();renderAnnuel();syncAuto()}
function agPill(a){return a&&a!=='IDF'?'<span class="agpill '+esc(a)+'">'+esc(a)+'</span>':''}
function go(v){document.querySelectorAll('.view').forEach(s=>s.classList.remove('active'));document.getElementById(v).classList.add('active');document.querySelectorAll('nav.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));if(v==='v-mensuel')renderMensuel();if(v==='v-annuel')renderAnnuel();if(v==='v-reglages')renderReglages();if(v==='v-fiches')renderFiches();if(v==='v-accueil')renderAccueil();window.scrollTo(0,0)}

/* ===== Accueil : deux commandes, scanner ou saisir ===== */
function renderAccueil(){const b=document.getElementById('acc-etat');if(!b)return;
  b.innerHTML=syncConfigure()?'':'<div class="banner">🔌 <b>Appareil non branché.</b> Ouvre le Suivi des QHP depuis la tuile de l\'intranet HSE : la lecture automatique des fiches et l\'envoi au suivi seront activés. En attendant, ce que tu saisis reste sur cet appareil.</div>'}
function iaEtat(genre,txt){const b=document.getElementById('f-ia-etat');if(!b)return;
  b.innerHTML=txt?'<div class="banner '+(genre==='ok'?'ok':genre==='err'?'err':genre==='run'?'run':'')+'">'+txt+'</div>':''}
async function scanFiche(files){if(!files||!files.length)return;files=Array.from(files);   // copie : le champ fichier est vidé juste après l'appel
  await openFiche();document.getElementById('m-fiche-title').textContent='Fiche scannée';
  await attachFiles(files);
  if(syncConfigure())lireFicheIA();
  else iaEtat('warn','🔌 Lecture automatique indisponible : cet appareil n\'est pas branché. La fiche est jointe ; remplis les champs à la main, ou ouvre l\'outil depuis l\'intranet HSE.')}

/* ===== Fiches ===== */
function renderFiches(){const box=document.getElementById('fiches-list');const list=[...state.qhps].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  if(!list.length){box.innerHTML='<div class="empty"><div class="big">📋</div>Aucune fiche QHP pour l\'instant.<br>Enregistre ton premier QHP depuis l\'onglet « Accueil ».</div>';return}
  box.innerHTML=list.map(q=>{const d=new Date((q.date||'')+'T00:00');const nb=Object.values(q.present||{}).filter(Boolean).length;
    return `<div class="qhp" onclick="openDetail('${q.id}')"><div class="d"><b>${isNaN(d)?'?':d.getDate()}</b><span>${isNaN(d)?'':MOIS_S[d.getMonth()].replace('.','')}</span></div><div class="i"><div class="t">${esc(q.theme||'(sans thème)')}</div><div class="s">${esc(q.chantier||'—')}${q.cond?' · '+esc(q.cond):''} · ${nb} participant${nb>1?'s':''}${nbPieces(q)?' · 📎'+(nbPieces(q)>1?nbPieces(q):''):''}${q.emarg?' · ✍️':''}${q.remontees?' · 💬':''}</div></div><div>›</div></div>`}).join('')}
async function openFiche(id){editId=id||null;const q=id?state.qhps.find(x=>x.id===id):null;iaEtat('','');
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
  renderPieces();
  renderPickNames();document.getElementById('m-fiche').classList.add('open')}
function chantierPickConduc(){const v=document.getElementById('f-chantier').value.trim().toLowerCase();const ch=state.chantiers.find(c=>c.nom.toLowerCase()===v);const cf=document.getElementById('f-cond');if(ch&&ch.cond&&!cf.value.trim())cf.value=ch.cond}
function renderRecap(){
  const eff=actifs();const pres=eff.filter(p=>pickPres[p.name]);const abs=eff.filter(p=>!pickPres[p.name]);
  const box=document.getElementById('f-recap');
  box.innerHTML=`<div class="rt"><span>✅ ${pres.length} participant${pres.length>1?'s':''} coché${pres.length>1?'s':''}</span><span class="muted">${abs.length} non coché${abs.length>1?'s':''}</span></div>`+
   (pres.length?('<div class="chips">'+pres.map(p=>'<span class="chip">'+esc(p.name)+'</span>').join('')+'</div>')
    :'<div class="hint">Coche les présents ci-dessous — ils s\'afficheront ici.</div>');
}
function renderPickNames(){const term=(document.getElementById('f-search').value||'').toLowerCase();const box=document.getElementById('f-names');
  const list=actifs().filter(p=>p.name.toLowerCase().includes(term));const g=grouper(list);let h='';
  Object.keys(g).forEach(sec=>{const people=g[sec];if(!people.length)return;const on=people.filter(p=>pickPres[p.name]).length;
    h+=`<div class="secgrp"><div class="sh"><span>${esc(sec)}</span><span class="cnt">${on}/${people.length} · <a href="#" onclick="secAll('${esc(sec).replace(/'/g,"\\'")}',true);return false">tout</a> · <a href="#" onclick="secAll('${esc(sec).replace(/'/g,"\\'")}',false);return false">rien</a></span></div><div class="names">`;
    h+=people.map(p=>`<div class="nm ${pickPres[p.name]?'on':''}" onclick="togglePick(this,'${esc(p.name).replace(/'/g,"\\'")}')"><span class="bx">${pickPres[p.name]?'✓':''}</span><span class="nn">${esc(p.name)}${p.conducteur?' 🎓':''}${agPill(p.agence)}</span></div>`).join('');h+='</div></div>'});
  box.innerHTML=h||'<div class="hint">Aucun collaborateur actif.</div>';renderRecap()}
function togglePick(el,n){pickPres[n]=!pickPres[n];el.classList.toggle('on',pickPres[n]);el.querySelector('.bx').textContent=pickPres[n]?'✓':'';renderRecap()}
function secAll(sec,v){const g=grouper(actifs());(g[sec]||[]).forEach(p=>pickPres[p.name]=v);renderPickNames()}
function allNames(v){const term=(document.getElementById('f-search').value||'').toLowerCase();actifs().filter(p=>p.name.toLowerCase().includes(term)).forEach(p=>pickPres[p.name]=v);renderPickNames()}
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
  renderPieces();if(n)toast(n+' pièce'+(n>1?'s jointes':' jointe')+' ✓')}
function renderPieces(){const box=document.getElementById('f-pieces');if(!box)return;const arr=Array.isArray(piecesPending)?piecesPending:[];
  box.innerHTML=arr.map((p,i)=>{const img=(p.type||'').indexOf('image/')===0;
    return '<div class="pc"><button class="px" onclick="delPiece('+i+')" title="Retirer">✕</button>'+
      (img?'<img src="'+p.data+'" onclick="viewPending('+i+')" alt="">':'<div class="ph" onclick="viewPending('+i+')">📄</div>')+
      '<div class="pn">'+esc(p.name)+'</div></div>'}).join('');
  document.getElementById('f-pdf-info').innerHTML=arr.length?('<span class="muted">'+arr.length+' pièce'+(arr.length>1?'s':'')+' jointe'+(arr.length>1?'s':'')+' — touche une vignette pour l\'ouvrir</span>'):'';
  const bia=document.getElementById('f-ia');if(bia)bia.style.display=(arr.length&&syncConfigure())?'':'none'}
function delPiece(i){if(!Array.isArray(piecesPending))return;piecesPending.splice(i,1);renderPieces()}
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
async function saveFiche(){const date=document.getElementById('f-date').value,theme=document.getElementById('f-theme').value.trim();
  if(!date){toast('Renseigne la date',true);return}if(!theme){toast('Renseigne le thème',true);return}
  const present={};state.roster.forEach(p=>{if(pickPres[p.name])present[p.name]=true});
  let q;if(editId)q=state.qhps.find(x=>x.id===editId);else{q={id:uid()};state.qhps.push(q)}
  q.date=date;q.theme=theme;q.chantier=document.getElementById('f-chantier').value.trim();q.cond=document.getElementById('f-cond').value.trim();
  q.remontees=document.getElementById('f-remontees').value.trim();q.present=present;q.maj=nowISO();
  if(q.chantier){const ex=state.chantiers.find(c=>c.nom.toLowerCase()===q.chantier.toLowerCase());if(ex){ex.nom=q.chantier;if(q.cond)ex.cond=q.cond;ex.maj=nowISO()}else state.chantiers.push({id:uid(),nom:q.chantier,cond:q.cond||'',maj:nowISO()})}
  if(Array.isArray(piecesPending)){await piecesPut(q.id,piecesPending);
    q.pieces=piecesPending.map(p=>({name:p.name,type:p.type}));q.hasPdf=piecesPending.length>0;q.pdfName=piecesPending.length?piecesPending[0].name:''}
  save();closeModal();renderFiches();toast(editId?'Fiche mise à jour ✓':'Fiche enregistrée ✓');
  syncAuto(q.id)}
function deleteFiche(){if(!editId)return;if(!confirm('Supprimer cette fiche QHP ?'))return;pdfDel(editId);pdfDel('sig_'+editId);
  state.tomb.qhps[editId]=nowISO();state.qhps=state.qhps.filter(x=>x.id!==editId);save();closeModal();renderFiches();toast('Fiche supprimée');syncAuto()}
async function openDetail(id){const q=state.qhps.find(x=>x.id===id);if(!q)return;
  const pres=state.roster.filter(p=>q.present&&q.present[p.name]);
  const g=grouper(pres);let byg='';Object.keys(g).forEach(s=>{byg+=`<div style="margin-top:6px"><b class="small" style="color:var(--marine)">${esc(s)}</b><div>${g[s].map(p=>'<span class="pill ok" style="margin:2px">'+esc(p.name)+'</span>').join(' ')}</div></div>`});
  document.getElementById('detail-body').innerHTML=`<div class="grab"></div><h2>${esc(q.theme||'(sans thème)')}</h2><p class="muted small">${frDate(q.date)} · ${esc(q.chantier||'—')}${q.cond?' · animé par '+esc(q.cond):''}</p>
    <div class="kpis" style="margin:12px 0"><div class="kpi"><div class="v">${pres.length}</div><div class="l">Participants</div></div><div class="kpi"><div class="v">${actifs().length?Math.round(pres.length/actifs().length*100):0}%</div><div class="l">de l'effectif</div></div></div>
    ${q.remontees?`<label class="f">Remontées terrain</label><div class="card" style="margin:0 0 10px;padding:10px;white-space:pre-wrap">${esc(q.remontees)}</div>`:''}
    ${q.emarg?`<button class="btn btn-primary btn-block" style="margin-bottom:8px" onclick="printEmarg('${q.id}')">✍️ Ouvrir la fiche signée (impression / PDF)</button>`:''}
    <label class="f">Pièces jointes (${nbPieces(q)})</label>
    <div id="d-pieces" class="pieces">${nbPieces(q)?'<span class="muted small">chargement…</span>':'<span class="muted small">aucune</span>'}</div>
    ${q.externes&&q.externes.length?`<label class="f">Intervenants extérieurs</label><div>${q.externes.map(e=>'<span class="pill" style="margin:2px">'+esc(e.name)+(e.soc?' · '+esc(e.soc):'')+'</span>').join(' ')}</div>`:''}
    <label class="f">Participants CDES (${pres.length})</label>${byg||'<span class="muted small">aucun</span>'}
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
function appliquerSync(d){
  if(Array.isArray(d.qhps))state.qhps=d.qhps;
  if(Array.isArray(d.roster))state.roster=d.roster.map(p=>Object.assign({dateAjout:'',dateDepart:'',agence:'IDF'},p));
  if(Array.isArray(d.chantiers))state.chantiers=d.chantiers;
  if(Array.isArray(d.secteurs)&&d.secteurs.length)state.secteurs=d.secteurs;
  if(d.tombQhps)state.tomb.qhps=d.tombQhps;
  if(d.tombRoster)state.tomb.roster=d.tombRoster;
  if(d.gestion)state.gestion=d.gestion; if(d.gestionMaj)state.majDico.gestion=d.gestionMaj;
  if(d.exclus)state.exclus=d.exclus;    if(d.exclusMaj)state.majDico.exclus=d.exclusMaj;
  if(d.conf){['objPart','cadStd','cadSup'].forEach(k=>{if(d.conf[k]!==undefined&&d.conf[k]!=='')conf[k]=Number(d.conf[k])})}
  if(d.confMaj)state.majDico.conf=d.confMaj;
  state.roster.forEach(p=>{p.conducteur=(p.conducteur===true||p.conducteur==='oui')});
  save();try{localStorage.setItem(LS_CONF,JSON.stringify(conf))}catch(e){}}
async function syncNow(manuel){
  if(!syncConfigure()){if(manuel)toast('Renseigne d\'abord l\'adresse du webhook',true);return false}
  if(syncEnCours){if(manuel)toast('Synchro déjà en cours…');return false}
  syncEnCours=true;syncEtat('⏳ Synchronisation…','muted');
  try{
    const j=await syncAppel(syncPayload());
    appliquerSync(j.data||{});
    const reste=[];
    for(const id of syncFile){try{await pousserPieces(id)}catch(e){reste.push(id)}}
    syncFile=reste;
    conf.dernierSync=nowISO();try{localStorage.setItem(LS_CONF,JSON.stringify(conf))}catch(e){}
    renderFiches();
    if(document.getElementById('v-annuel').classList.contains('active'))renderAnnuel();
    if(document.getElementById('v-mensuel').classList.contains('active'))renderMensuel();
    if(document.getElementById('v-reglages').classList.contains('active'))renderReglages();
    syncEtat('✅ Synchronisé à '+new Date().toLocaleTimeString('fr-FR').slice(0,5),'ok-txt');
    if(manuel)toast('Synchronisé ✓ — '+state.qhps.length+' fiches');
    return true}
  catch(e){
    syncEtat('⚠️ '+(e.message||'échec'),'err-txt');
    if(manuel)toast('Échec : '+(e.message||'?'),true);
    return false}
  finally{syncEnCours=false}}
function syncAuto(idFiche){
  if(idFiche&&syncFile.indexOf(idFiche)<0)syncFile.push(idFiche);
  if(!syncConfigure()||conf.autoSync===false)return;
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
  const fini=()=>toast(avecEmarg?'Lien conducteur copié ✓ — envoie-le par SMS':'Lien de branchement copié ✓');
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

/* ===== Lecture IA de la fiche d'émargement ===== */
async function lireFicheIA(){
  if(!syncConfigure()){toast('La lecture IA nécessite la synchronisation configurée',true);return}
  const arr=piecesPending||[];
  const p=arr.filter(x=>(x.type||'').indexOf('image/')===0||x.type==='application/pdf')[0];
  if(!p){toast('Joins d\'abord le PDF ou la photo de la fiche',true);return}
  const btn=document.getElementById('f-ia');if(btn){btn.disabled=true;btn.textContent='🤖 Lecture en cours…'}
  iaEtat('run','🤖 <b>Lecture de la fiche en cours…</b> (jusqu\'à une minute, ne ferme pas)');
  try{
    const j=await syncAppel({secret:conf.secret,action:'lire-fiche',appareil:conf.appareil,
      nom:p.name,type:p.type,dataUrl:p.data,roster:actifs().map(x=>x.name)},120000);
    const e=j.extrait||{};
    if(e.date&&/^\d{4}-\d{2}-\d{2}$/.test(e.date))document.getElementById('f-date').value=e.date;
    if(e.chantier)document.getElementById('f-chantier').value=e.chantier;
    if(e.animateur)document.getElementById('f-cond').value=e.animateur;
    if(e.theme)document.getElementById('f-theme').value=e.theme;
    if(e.remontees)document.getElementById('f-remontees').value=e.remontees;
    (e.noms||[]).forEach(n=>{if(state.roster.some(p2=>p2.name===n))pickPres[n]=true});
    renderPickNames();
    const nbN=(e.noms||[]).length;
    iaEtat('ok','✅ <b>Champs remplis par l\'IA</b> · '+nbN+' participant'+(nbN>1?'s':'')+' reconnu'+(nbN>1?'s':'')+'. Vérifie, corrige si besoin, puis touche <b>Enregistrer</b> en bas.');
    toast(nbN+' nom(s) reconnu(s) ✓ — vérifie avant d\'enregistrer');
    let av='';
    if((e.ambigus||[]).length)av+='<br><span style="color:var(--mid)">🤔 Impossible de trancher : '+
      e.ambigus.map(a=>esc(a.lu)+' → '+a.candidats.map(esc).join(' ou ')).join(' · ')+' — coche à la main</span>';
    if((e.nonReconnus||[]).length)av+='<br><span style="color:var(--mid)">⚠️ Lus mais hors liste : '+esc(e.nonReconnus.join(', '))+'</span>';
    if(av)document.getElementById('f-pdf-info').innerHTML+=av;
  }catch(err){iaEtat('err','⚠️ Lecture automatique impossible ('+esc(err.message||'?')+'). La fiche reste jointe : remplis les champs à la main, ou réessaie avec « Lire la fiche automatiquement ».');toast('Lecture impossible : '+(err.message||'?'),true)}
  finally{if(btn){btn.disabled=false;btn.textContent='🤖 Lire la fiche automatiquement'}}}

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
  const noms=emargNoms();
  if(!noms.length){toast('Coche au moins un participant',true);return}
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
    if(!moisActif(p,y,i))continue;
    if(presentDansMois(p.name,y,i))tot++;
    if(moisPasse(y,i)&&!estExclu(p.name,y,i))attendu+=cadence(p);
  }
  const taux=attendu>0?tot/attendu:null;
  let etat='neutre';
  if(taux!==null){ if(tot===0&&attendu>=1)etat='ko'; else if(taux>=0.8)etat='ok'; else etat='moyen'; }
  return {tot,attendu:Math.round(attendu*10)/10,taux,etat}
}
const ICO={ok:'<span class="alert-ico" title="Objectif tenu">✅</span>',moyen:'<span class="alert-ico" title="En dessous de 80 % de l\'attendu">⚠️</span>',ko:'<span class="alert-ico" title="Aucun QHP">🚫</span>',neutre:''};

/* ===== MENSUEL ===== */
function setMoisCourant(){document.getElementById('bilan-mois').value=new Date().toISOString().slice(0,7);renderMensuel()}
function renderMensuel(){const mois=document.getElementById('bilan-mois').value||new Date().toISOString().slice(0,7);const [yy,mm]=mois.split('-');
  const y=+yy,i=(+mm)-1;
  const qs=state.qhps.filter(q=>(q.date||'').slice(0,7)===mois);
  const eff=actifs().filter(p=>moisActif(p,y,i)&&!estExclu(p.name,y,i));
  const N=eff.length;
  const vus=new Set();qs.forEach(q=>eff.forEach(p=>{if(q.present&&q.present[p.name])vus.add(p.name)}));
  const taux=N?Math.round(vus.size/N*100):0;const ok=taux>=conf.objPart;
  const nbExclus=actifs().filter(p=>moisActif(p,y,i)&&estExclu(p.name,y,i)).length;
  let h=`<div class="card"><h2>📊 ${MOIS_L[i]} ${yy}</h2><div class="kpis">
    <div class="kpi"><div class="v">${qs.length}</div><div class="l">QHP réalisés</div></div>
    <div class="kpi ${ok?'goodbg':'warnbg'}"><div class="v">${taux}%</div><div class="l">Participation (${vus.size}/${N})</div></div>
    <div class="kpi big"><div class="l" style="margin-bottom:2px">Objectif participation ${conf.objPart}%</div><div class="bar ${ok?'ok':'warn'}"><i style="width:${Math.min(100,taux)}%"></i><span class="seuil" style="left:${Math.min(100,conf.objPart)}%"></span></div><div class="sub">${ok?'✅ Objectif atteint':'⛔ '+(conf.objPart-taux)+' pts sous l\'objectif'}${nbExclus?' · '+nbExclus+' personne(s) non comptée(s) ce mois':''}</div></div></div></div>`;
  // par agence
  h+=`<div class="card"><h2>📍 Par agence</h2><div class="tbl-wrap"><table><thead><tr><th>Agence</th><th style="text-align:center">Vus / effectif</th><th style="text-align:center">Taux</th></tr></thead><tbody>`;
  state.agences.forEach(a=>{const l=eff.filter(p=>(p.agence||'IDF')===a);if(!l.length)return;const v=l.filter(p=>vus.has(p.name)).length;const pc=Math.round(v/l.length*100);
    h+=`<tr><td><b>${esc(a)}</b></td><td style="text-align:center">${v}/${l.length}</td><td style="text-align:center"><span class="pill ${pc>=conf.objPart?'ok':pc>=50?'mid':'warn'}">${pc}%</span></td></tr>`});
  h+='</tbody></table></div></div>';
  // par groupe
  h+=`<div class="card"><h2>🏗️ Par groupe</h2><div class="tbl-wrap"><table><thead><tr><th>Groupe</th><th style="text-align:center">Vus / effectif</th><th style="text-align:center">Taux</th></tr></thead><tbody>`;
  const g=grouper(eff);Object.keys(g).forEach(sec=>{const v=g[sec].filter(p=>vus.has(p.name)).length;const pc=g[sec].length?Math.round(v/g[sec].length*100):0;
    h+=`<tr><td>${esc(sec)}</td><td style="text-align:center">${v}/${g[sec].length}</td><td style="text-align:center"><span class="pill ${pc>=conf.objPart?'ok':pc>=50?'mid':'warn'}">${pc}%</span></td></tr>`});
  h+='</tbody></table></div></div>';
  // liste
  h+=`<div class="card"><h2>🗂 QHP du mois (${qs.length})</h2>`;
  if(!qs.length)h+='<p class="hint">Aucun QHP ce mois.</p>';else{h+='<div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Thème</th><th>Chantier</th><th>Conduc.</th><th style="text-align:center">Part.</th></tr></thead><tbody>';qs.sort((a,b)=>(a.date||'').localeCompare(b.date||'')).forEach(q=>{const nb=Object.values(q.present||{}).filter(Boolean).length;h+=`<tr><td>${frDate(q.date)}</td><td>${esc(q.theme||'')}</td><td>${esc(q.chantier||'—')}</td><td>${esc(q.cond||'—')}</td><td style="text-align:center">${nb}</td></tr>`});h+='</tbody></table></div>'}
  h+='</div>';
  document.getElementById('mensuel-body').innerHTML=h}

/* V2 — la reprise historique janvier→mars 2026 (import unique, déjà fait : fiches « Reprise historique »
   du classeur) contenait des présences nominatives : retirée de la page publique. */

/* ===== ANNUEL ===== */
function setAnnuel(m){anMode=m;document.getElementById('tg-collab').classList.toggle('on',m==='collab');document.getElementById('tg-cond').classList.toggle('on',m==='cond');renderAnnuel()}
function chgAnnee(d){anAnnee+=d;renderAnnuel()}
function renderAnnuel(){document.getElementById('an-annee').textContent=anAnnee;
  const filt=document.getElementById('an-filtre');
  const opts=['(tous)'].concat(state.secteurs).concat(state.agences.map(a=>'Agence '+a));
  if(!opts.includes(anFiltre))anFiltre='(tous)';
  filt.innerHTML='<select onchange="anFiltre=this.value;renderAnnuel()">'+opts.map(o=>'<option'+(o===anFiltre?' selected':'')+'>'+esc(o)+'</option>').join('')+'</select>';
  document.getElementById('annuel-body').innerHTML=anMode==='cond'?annuelConduc():annuelCollab()}
function filtrer(list){
  if(anFiltre==='(tous)')return list;
  if(anFiltre.startsWith('Agence '))return list.filter(p=>(p.agence||'IDF')===anFiltre.slice(7));
  return list.filter(p=>(state.secteurs.includes(p.secteur)?p.secteur:'(sans groupe)')===anFiltre)}
function annuelCollab(){
  const g=grouper(filtrer(state.roster.slice()));
  let h=`<div class="card"><h2>📅 Participation ${anAnnee}</h2><p class="hint">V = présent · ✗ = absent · N/A = non compté (arrêt, congés, non concerné) — <b>touche une case pour basculer en N/A</b>. Gris = hors période. Alerte proratisée à la date : ✅ ≥ 80 % · ⚠️ en dessous · 🚫 aucun QHP.</p><div class="tbl-wrap"><table class="an"><thead><tr><th class="nom">Collaborateur</th>`;
  for(let i=0;i<12;i++)h+=`<th>${MOIS_S[i].replace('.','')}</th>`;h+='<th>Tot</th><th>Att.</th></tr></thead><tbody>';
  let any=false;
  Object.keys(g).forEach(sec=>{const people=g[sec];if(!people.length)return;any=true;h+=`<tr><td class="sec" colspan="15">${esc(sec)} (${people.length})${sec===SUPPORT?' — 1 QHP / 4 mois':''}</td></tr>`;
    people.forEach(p=>{let cells='';
      for(let i=0;i<12;i++){
        if(!moisActif(p,anAnnee,i)){cells+='<td class="g"></td>';continue}
        const nm=esc(p.name).replace(/'/g,"\\'");
        if(presentDansMois(p.name,anAnnee,i)){cells+=`<td class="v" onclick="toggleExclu('${nm}',${anAnnee},${i})">V</td>`}
        else if(estExclu(p.name,anAnnee,i)){cells+=`<td class="na" onclick="toggleExclu('${nm}',${anAnnee},${i})">N/A</td>`}
        else if(moisPasse(anAnnee,i))cells+=`<td class="x" onclick="toggleExclu('${nm}',${anAnnee},${i})">✗</td>`;
        else cells+='<td class="fut">·</td>'}
      const b=bilanIndividuel(p,anAnnee);
      h+=`<tr><td class="nom">${esc(p.name)}${agPill(p.agence)}${ICO[b.etat]}</td>${cells}<td><b>${b.tot}</b></td><td class="muted">${b.attendu||'—'}</td></tr>`})});
  h+='</tbody></table></div>';
  if(!any)h+='<p class="hint">Aucun collaborateur.</p>';
  h+=`<div class="row no-print" style="margin-top:10px"><button class="btn btn-ghost grow" onclick="exportCollab(${anAnnee})">⬇ Export CSV</button><button class="btn btn-ghost grow" onclick="window.print()">🖨 Imprimer</button></div></div>`;return h}
/* ---- indicateurs conducteurs : valeur AUTO (fiches) + saisie MANUELLE ----
   La saisie manuelle est stockee dans state.gestion sous une cle composee
   'NOM Prenom|qhp' ou 'NOM Prenom|collab' : elle emprunte donc la synchro
   deja en place (onglet GESTION) sans rien changer au back-end.
   Regle : une valeur manuelle saisie prime ; sinon on prend la valeur
   calculee sur les fiches, affichee en filigrane dans la case. */
function qhpRealisesCond(cond,y,i){const k=mkey(y,i);
  return state.qhps.filter(q=>(q.date||'').slice(0,7)===k&&(q.cond||'').trim()===cond).length}
function collabSensibMois(cond,y,i){const k=mkey(y,i),vus={};
  state.qhps.forEach(q=>{if((q.date||'').slice(0,7)!==k)return;if((q.cond||'').trim()!==cond)return;
    Object.keys(q.present||{}).forEach(n=>{if(q.present[n])vus[n]=1})});
  return Object.keys(vus).length}
function manuelVal(key,cond,suf){const v=state.gestion[key]&&state.gestion[key][cond+'|'+suf];
  return (v===undefined||v===null||v==='')?'':v}
function setManuel(key,cond,suf,val){setGestion(key,cond+'|'+suf,val)}
function valEff_(man,auto){return man!==''?+man:auto}

function annuelConduc(){
  const g=grouper(filtrer(conducteurs()));
  let h=`<div class="card"><h2>👷 Réalisation conducteurs ${anAnnee}</h2><p class="hint">Trois indicateurs par conducteur. Chaque case est <b>pré-remplie automatiquement</b> d'après les fiches (nombre en gris) ; tape un chiffre pour la corriger, ou pour renseigner un mois sans fiche. Gris plein = hors période.<br>· <b>QHP réalisés</b> : fiches animées par ce conducteur · <b>Chantiers couv. / gérés</b> : couverts = chantiers différents avec un QHP (auto), gérés = à saisir, c'est le dénominateur du % · <b>Collab. sensibilisés</b> : personnes différentes touchées dans le mois.</p><div class="tbl-wrap"><table class="an"><thead><tr><th class="nom">Conducteur</th><th></th>`;
  for(let i=0;i<12;i++)h+=`<th>${MOIS_S[i].replace('.','')}</th>`;h+='<th>Total</th></tr></thead><tbody>';
  let any=false;
  Object.keys(g).forEach(sec=>{const people=g[sec];if(!people.length)return;any=true;
    h+=`<tr><td class="sec" colspan="15">${esc(sec)} (${people.length})</td></tr>`;
    people.forEach(p=>{
      const nm=esc(p.name).replace(/'/g,"\\'");
      let c1='',c2='',c3='',totQ=0,totS=0,cov=0,ger=0;
      for(let i=0;i<12;i++){
        if(!moisActif(p,anAnnee,i)){c1+='<td class="g"></td>';c2+='<td class="g"></td>';c3+='<td class="g"></td>';continue}
        const key=mkey(anAnnee,i);
        const aQ=qhpRealisesCond(p.name,anAnnee,i),mQ=manuelVal(key,p.name,'qhp');
        totQ+=valEff_(mQ,aQ);
        c1+=`<td class="cell"><input class="gr" type="number" min="0" inputmode="numeric" value="${mQ}" placeholder="${aQ}" onchange="setManuel('${key}','${nm}','qhp',this.value)"></td>`;
        const aC=chantiersCouvertsCond(p.name,anAnnee,i);
        const gv=(state.gestion[key]&&state.gestion[key][p.name]!=null)?state.gestion[key][p.name]:'';
        if(gv!==''){ger+=+gv;cov+=Math.min(aC,+gv)}
        const pc=(gv!==''&&+gv>0)?Math.round(Math.min(aC,+gv)/(+gv)*100):null;
        const bg=pc===null?'':(pc>=100?'background:var(--ok-bg)':(pc>=50?'background:var(--mid-bg)':'background:var(--warn-bg)'));
        c2+=`<td class="cell" style="${bg}"><span class="cov">${aC} couv.</span><input class="gr" type="number" min="0" inputmode="numeric" value="${gv}" placeholder="–" onchange="setGestion('${key}','${nm}',this.value)"></td>`;
        const aS=collabSensibMois(p.name,anAnnee,i),mS=manuelVal(key,p.name,'collab');
        totS+=valEff_(mS,aS);
        c3+=`<td class="cell"><input class="gr" type="number" min="0" inputmode="numeric" value="${mS}" placeholder="${aS}" onchange="setManuel('${key}','${nm}','collab',this.value)"></td>`;
      }
      const pcAn=ger>0?Math.round(cov/ger*100):null;
      h+=`<tr><td class="nom" rowspan="3">${esc(p.name)}${agPill(p.agence)}</td><td class="lbl">QHP réalisés</td>${c1}<td><b>${totQ||'—'}</b></td></tr>`;
      h+=`<tr><td class="lbl">Chantiers couv. / gérés</td>${c2}<td><b>${pcAn===null?'—':pcAn+'%'}</b></td></tr>`;
      h+=`<tr><td class="lbl">Collab. sensibilisés</td>${c3}<td><b>${totS||'—'}</b></td></tr>`;
    })});
  if(!any)h+='<tr><td class="nom">—</td><td colspan="14" style="text-align:left;padding:10px" class="muted">Aucun conducteur dans ce filtre.</td></tr>';
  h+='</tbody></table></div>';
  h+='<p class="hint">Le total « Collab. sensibilisés » est un <b>cumul des mois</b> : une personne touchée en mars puis en juin y compte deux fois.</p>';
  h+=`<div class="row no-print" style="margin-top:10px"><button class="btn btn-ghost grow" onclick="exportConduc(${anAnnee})">⬇ Export CSV</button><button class="btn btn-ghost grow" onclick="window.print()">🖨 Imprimer</button></div></div>`;return h}
function setGestion(key,cond,val){if(!state.gestion[key])state.gestion[key]={};const n=parseInt(val);if(val===''||isNaN(n))delete state.gestion[key][cond];else state.gestion[key][cond]=n;
  state.majDico.gestion[key+'|'+cond]=nowISO();save();renderAnnuel();syncAuto()}

/* ===== Réglages ===== */
function renderReglages(){
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
  const rf=document.getElementById('reg-filtre');const opts=['(tous)','(conducteurs)'].concat(state.secteurs).concat(state.agences.map(a=>'Agence '+a));
  const cur=rf.value||'(tous)';fillSelect(rf,opts,opts.includes(cur)?cur:'(tous)');
  let flt=rf.value||'(tous)';let list=state.roster;
  if(flt==='(conducteurs)')list=state.roster.filter(p=>p.conducteur);
  else if(flt.startsWith('Agence '))list=state.roster.filter(p=>(p.agence||'IDF')===flt.slice(7));
  else if(flt!=='(tous)')list=state.roster.filter(p=>(state.secteurs.includes(p.secteur)?p.secteur:'(sans groupe)')===flt);
  const g=grouper(list);let h='';
  Object.keys(g).forEach(sec=>{h+=`<h3>${esc(sec)} (${g[sec].length})</h3><div class="tbl-wrap"><table><tbody>`;
    g[sec].forEach(p=>{const idx=state.roster.indexOf(p);
      const st=p.dateDepart?('<span class="pill warn">parti '+moisLbl(p.dateDepart)+'</span>'):(p.dateAjout?('<span class="pill mid">dès '+moisLbl(p.dateAjout)+'</span>'):'');
      h+=`<tr><td>${esc(p.name)}${agPill(p.agence)}${p.conducteur?' <span class="pill ok">conducteur</span>':''} ${st}</td>
        <td style="width:190px;text-align:right;white-space:nowrap">${p.dateDepart?'':'<button class="btn btn-ghost btn-sm" onclick="retirer('+idx+')">↩ Départ</button> '}<button class="btn btn-danger btn-sm" onclick="delName(${idx})">🗑 Supprimer</button></td></tr>`});
    h+='</tbody></table></div>'});
  document.getElementById('roster-edit').innerHTML=h||'<p class="hint">Aucun collaborateur.</p>';
  document.getElementById('ch-list').innerHTML=state.chantiers.length?('<div class="tbl-wrap"><table><thead><tr><th>Chantier</th><th>Conducteur</th><th></th></tr></thead><tbody>'+state.chantiers.map((c,i)=>`<tr><td>${esc(c.nom)}</td><td>${esc(c.cond||'—')}</td><td style="width:40px;text-align:right"><button class="btn btn-ghost btn-sm" onclick="delChantier(${i})">🗑</button></td></tr>`).join('')+'</tbody></table></div>'):'<p class="hint">Aucun chantier (ils se créent depuis les fiches).</p>'}
function moisLbl(iso){return MOIS_S[(+iso.slice(5,7))-1].replace('.','')+' '+iso.slice(0,4)}
function addSecteur(){const el=document.getElementById('new-sec');const s=el.value.trim();if(!s)return;if(state.secteurs.some(x=>x.toLowerCase()===s.toLowerCase())){toast('Déjà présent',true);return}state.secteurs.push(s);delete state.tomb.secteurs[s];save();el.value='';renderReglages();toast('Groupe ajouté');syncAuto()}
function delSecteur(i){const s=state.secteurs[i];const n=state.roster.filter(p=>p.secteur===s).length;if(!confirm('Retirer le groupe « '+s+' » ?'+(n?'\n'+n+' personne(s) passeront en « sans groupe ».':'')))return;state.roster.forEach(p=>{if(p.secteur===s){p.secteur='';p.maj=nowISO()}});state.tomb.secteurs[s]=nowISO();state.secteurs.splice(i,1);save();renderReglages();toast('Groupe retiré');syncAuto()}
function addName(){const el=document.getElementById('new-name');const n=el.value.trim();if(!n){toast('Renseigne le nom',true);return}if(state.roster.some(p=>p.name.toLowerCase()===n.toLowerCase())){toast('Déjà présent',true);return}
  state.roster.push({name:n,secteur:document.getElementById('new-name-sec').value||'',agence:document.getElementById('new-name-ag').value||'IDF',conducteur:document.getElementById('new-name-cond').checked,dateAjout:todayISO,dateDepart:'',maj:nowISO()});
  delete state.tomb.roster[n];save();el.value='';document.getElementById('new-name-cond').checked=false;renderReglages();toast('« '+n+' » ajouté (actif dès le mois prochain)');syncAuto()}
function retirer(i){const p=state.roster[i];if(!confirm('Départ de « '+p.name+' » aujourd\'hui ?\nLes mois suivants seront grisés, l\'historique est conservé.'))return;p.dateDepart=todayISO;p.maj=nowISO();save();renderReglages();toast('Départ enregistré');syncAuto()}
function delName(i){const p=state.roster[i];if(!confirm('SUPPRIMER définitivement « '+p.name+' » ?\n\nPour garder l\'historique, utilise plutôt « ↩ Départ ».'))return;
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
    for(let i=0;i<12;i++){if(!moisActif(p,annee,i)){cells.push('');continue}
      if(presentDansMois(p.name,annee,i))cells.push('V');else if(estExclu(p.name,annee,i))cells.push('N/A');else if(moisPasse(annee,i))cells.push('X');else cells.push('')}
    const b=bilanIndividuel(p,annee);
    rows.push([sec,p.agence||'IDF',p.name,...cells,b.tot,b.attendu,{ok:'OK',moyen:'A SUIVRE',ko:'ALERTE',neutre:''}[b.etat]].map(csvCell).join(sep))}));
  dl('QHP-participation-'+annee+'.csv','\ufeff'+rows.join('\r\n'),'text/csv;charset=utf-8');toast('Export participation OK')}
function exportConduc(annee){const sep=';';
  let rows=[['Groupe','Conducteur','Indicateur',...MOIS_L,'Total'].map(csvCell).join(sep)];
  const g=grouper(conducteurs());Object.keys(g).forEach(sec=>g[sec].forEach(p=>{
    const q=[],cg=[],co=[];let totQ=0,totS=0,tc=0,tg=0;
    for(let i=0;i<12;i++){
      if(!moisActif(p,annee,i)){q.push('');cg.push('');co.push('');continue}
      const key=mkey(annee,i);
      const aQ=qhpRealisesCond(p.name,annee,i),mQ=manuelVal(key,p.name,'qhp');
      const vQ=valEff_(mQ,aQ);totQ+=vQ;q.push(vQ);
      const aC=chantiersCouvertsCond(p.name,annee,i);
      const gv=(state.gestion[key]&&state.gestion[key][p.name]!=null)?state.gestion[key][p.name]:'';
      if(gv!==''){tg+=+gv;tc+=Math.min(aC,+gv)}
      cg.push(aC+' / '+(gv===''?'-':gv));
      const aS=collabSensibMois(p.name,annee,i),mS=manuelVal(key,p.name,'collab');
      const vS=valEff_(mS,aS);totS+=vS;co.push(vS);
    }
    rows.push([sec,p.name,'QHP réalisés',...q,totQ].map(csvCell).join(sep));
    rows.push([sec,p.name,'Chantiers couv. / gérés',...cg,tg>0?Math.round(tc/tg*100)+'%':''].map(csvCell).join(sep));
    rows.push([sec,p.name,'Collab. sensibilisés',...co,totS].map(csvCell).join(sep));
  }));
  dl('QHP-realisation-'+annee+'.csv','\ufeff'+rows.join('\r\n'),'text/csv;charset=utf-8');toast('Export réalisation OK')}

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
  document.getElementById('logo').src=window.__LOGO__;
  document.getElementById('logo2').src=window.__LOGO__;
  load();document.getElementById('bilan-mois').value=new Date().toISOString().slice(0,7);renderFiches();
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
