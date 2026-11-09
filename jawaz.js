(()=>{
'use strict';
const $=id=>document.getElementById(id), KEY='medware_ndf_jawaz_v11';
let passages=[];try{passages=JSON.parse(localStorage.getItem(KEY)||'[]');if(!Array.isArray(passages))passages=[]}catch(e){passages=[]}
let editId=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>Number(n||0).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' DH';
const round=n=>Math.round(Number(n)*100)/100;
const hash=p=>[p.datetime,p.entry.toLowerCase(),p.exit.toLowerCase(),p.amount].join('|');
function store(){localStorage.setItem(KEY,JSON.stringify(passages));render();}
function parseRows(rows){const result=[];for(const row of rows){const text=row.map(x=>x.str).join(' ').replace(/\s+/g,' ').trim();const m=text.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})\s+(PASSAGE|RECHARGE\s+JAWAZ)\b/i);if(!m||m[7].toUpperCase()!=='PASSAGE')continue;
const datetime=`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6]}`;
const rest=text.slice(m.index+m[0].length).trim();
// PDF Jawaz: two station columns, voie (E03/S04), classe (01), debit.
const match=rest.match(/^(.*?)\s+([ES]\d{2})\s+(\d{2})\s+([\d\s.,]+)$/i);
if(!match)continue;const amount=Number(match[4].replace(/\s/g,'').replace(',','.'));
if(!Number.isFinite(amount)||amount<0||amount>10000)continue;
const stations=match[1].trim();
// Prefer PDF item x coordinates for column boundaries, preserving multiword station names.
const sorted=row.filter(x=>x.str.trim());
const marker=sorted.find(x=>/^(E|S)\d{2}$/i.test(x.str.trim()));
let entry='',exit='';
if(marker){const before=sorted.filter(x=>x.x<marker.x-4 && x.str.trim() && !/\d{2}\/\d{2}\/\d{4}|PASSAGE/i.test(x.str));
 const groups=[];for(const x of before){if(!groups.length||x.x-groups[groups.length-1].end>18)groups.push({str:x.str.trim(),end:x.x+x.width});else{groups[groups.length-1].str+=' '+x.str.trim();groups[groups.length-1].end=x.x+x.width;}}
 if(groups.length>=2){entry=groups[0].str;exit=groups.slice(1).map(g=>g.str).join(' ');}}
if(!entry||!exit){const halves=stations.split(/\s{2,}/);if(halves.length>=2){entry=halves[0];exit=halves.slice(1).join(' ')}else{entry=stations;exit='À vérifier'}}
result.push({datetime,entry,exit,amount:round(amount),missionId:null});
}return result;}
function extractRows(items){const rows=[];for(const item of items){const str=item.str||'';if(!str.trim())continue;const y=Math.round(item.transform[5]*2)/2;let row=rows.find(r=>Math.abs(r.y-y)<2.5);if(!row){row={y,items:[]};rows.push(row)}row.items.push({str,x:item.transform[4],width:item.width||0});}return rows.sort((a,b)=>b.y-a.y).map(r=>r.items.sort((a,b)=>a.x-b.x));}
async function getPdfJS(){if(window.pdfjsLib)return window.pdfjsLib;
 const script=document.createElement('script');script.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';script.crossOrigin='anonymous';
 await new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=()=>reject(Error('Lecteur PDF indisponible. Une connexion Internet est nécessaire pour le premier import PDF.'));document.head.appendChild(script)});
 if(!window.pdfjsLib)throw Error('Le lecteur PDF n’a pas pu démarrer');
 window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';return window.pdfjsLib;}
async function readPdf(file){const pdfjs=await getPdfJS();const doc=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;const all=[];for(let n=1;n<=doc.numPages;n++){const page=await doc.getPage(n);const content=await page.getTextContent();all.push(...parseRows(extractRows(content.items)));}return all;}
function render(){const ym=$('jawazMonth').value||$('month').value;const rows=passages.filter(p=>p.datetime.startsWith(ym)).sort((a,b)=>a.datetime.localeCompare(b.datetime));$('jawazCount').textContent=rows.length;$('jawazTotal').textContent=money(rows.reduce((s,p)=>s+p.amount,0));
const missions=state.missions.filter(m=>m.date.startsWith(ym));$('jawazMission').replaceChildren(new Option('Choisir une mission',''));for(const m of missions)$('jawazMission').add(new Option(m.date+' — '+m.place+' ('+m.purpose.slice(0,32)+')',m.id));
$('jawazList').innerHTML=rows.length?rows.map(p=>`<div class="item" style="font-size:13px"><label style="display:flex;align-items:center;gap:8px"><input type="checkbox" data-jawaz-check="${esc(p.id)}" style="width:auto" ${p.missionId?'disabled':''}><span><b>${esc(p.datetime.replace('T',' '))} — ${money(p.amount)}</b><small>${esc(p.entry)} → ${esc(p.exit)}${p.missionId?' · Associé à une mission':''}</small></span></label><div class="actions"><button type="button" class="secondary" data-jawaz-edit="${esc(p.id)}">Corriger</button><button type="button" class="secondary" data-jawaz-del="${esc(p.id)}">Supprimer</button></div></div>`).join(''):'Aucun passage pour ce mois.';}
function editor(p){editId=p?.id||null;$('jawazEditor').hidden=false;$('jawazDate').value=p?.datetime?.slice(0,16)||new Date().toISOString().slice(0,16);$('jawazEntry').value=p?.entry||'';$('jawazExit').value=p?.exit||'';$('jawazAmount').value=p?.amount??'';$('jawazEditor').scrollIntoView({block:'nearest',behavior:'smooth'});}
$('jawazMonth').value=$('month').value;
$('jawazMonth').addEventListener('change',render);
$('jawazManual').onclick=()=>editor(null);
$('jawazCancelEdit').onclick=()=>{$('jawazEditor').hidden=true;editId=null;};
$('jawazSaveEdit').onclick=()=>{const datetime=$('jawazDate').value,entry=$('jawazEntry').value.trim(),exit=$('jawazExit').value.trim(),amount=Number($('jawazAmount').value);if(!datetime||!entry||!exit||$('jawazAmount').value===''||!Number.isFinite(amount)||amount<0){alert('Complète la date, les gares et le montant.');return;}const current=passages.find(p=>p.id===editId);if(current?.missionId){alert('Ce passage est déjà associé à une mission. Pour éviter une différence de total, modifie la mission directement ou dissocie le passage avant correction.');return;}const next={id:editId||crypto.randomUUID(),datetime,entry,exit,amount:round(amount),missionId:null};if(passages.some(p=>p.id!==editId&&hash(p)===hash(next))){alert('Ce passage existe déjà.');return;}if(editId)passages=passages.map(p=>p.id===editId?next:p);else passages.push(next);$('jawazEditor').hidden=true;editId=null;store();};
$('jawazList').onclick=e=>{const ed=e.target.closest('[data-jawaz-edit]'),del=e.target.closest('[data-jawaz-del]');if(ed){editor(passages.find(p=>p.id===ed.dataset.jawazEdit));}if(del){const p=passages.find(p=>p.id===del.dataset.jawazDel);if(!p)return;if(p.missionId){alert('Ce passage est associé à une mission. Modifie la mission et son montant de péage avant de supprimer ce passage.');return;}if(confirm('Supprimer ce passage ?')){passages=passages.filter(x=>x.id!==p.id);store();}}};
$('jawazAssign').onclick=()=>{const id=$('jawazMission').value,m=state.missions.find(x=>x.id===id),selected=new Set([...document.querySelectorAll('[data-jawaz-check]:checked')].map(x=>x.dataset.jawazCheck));if(!m||!selected.size){alert('Sélectionne une mission et au moins un passage.');return;}const picks=passages.filter(p=>selected.has(p.id)&&!p.missionId);if(picks.some(p=>p.datetime.slice(0,10)!==m.date)&&!confirm('Certains passages ne sont pas à la date de la mission. Continuer ?'))return;const amount=round(picks.reduce((s,p)=>s+p.amount,0));if(Number(m.toll)>0&&!confirm('La mission contient déjà '+money(m.toll)+' de péages. Ajouter '+money(amount)+' ? Vérifie que ce ne sont pas des doublons.'))return;m.toll=round(Number(m.toll||0)+amount);for(const p of picks)p.missionId=id;save();store();render();};
$('jawazImport').onclick=async()=>{const file=$('jawazFile').files?.[0];if(!file){alert('Sélectionne un PDF Jawaz.');return;}if(file.size>15*1024*1024){alert('PDF trop volumineux (15 Mo maximum).');return;}$('jawazStatus').textContent='Lecture du PDF…';try{const rows=await readPdf(file);if(!rows.length)throw Error('Aucun passage reconnu. Vérifie que le PDF contient du texte sélectionnable.');const known=new Set(passages.map(hash));let added=0;for(const p of rows){if(known.has(hash(p)))continue;p.id=crypto.randomUUID();passages.push(p);known.add(hash(p));added++;}store();$('jawazMonth').value=rows[0].datetime.slice(0,7);render();$('jawazStatus').textContent=`${rows.length} passages lus, ${added} nouveaux, ${rows.length-added} doublons ignorés. Vérifie les gares et montants avant association.`;}catch(e){$('jawazStatus').textContent='Import impossible : '+e.message;}};
render();
})();
