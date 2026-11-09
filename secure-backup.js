(()=>{
'use strict';
const $=id=>document.getElementById(id);
const dataKey='medware_ndf_v1';
const lastKey='medware_ndf_last_secure_backup_v10';
const JAWAZ_KEY='medware_ndf_jawaz_v11';
const status=$('backupStatus');
const encoder=new TextEncoder();const decoder=new TextDecoder();
const b64=bytes=>btoa(Array.from(bytes,b=>String.fromCharCode(b)).join(''));
const unb64=str=>Uint8Array.from(atob(str),c=>c.charCodeAt(0));
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function validate(x){
 if(!isObj(x)||!Array.isArray(x.missions)||!isObj(x.months)||x.missions.length>100000)throw Error('Format de sauvegarde incorrect');
 if(!x.missions.every(m=>isObj(m)&&typeof m.id==='string'&&typeof m.date==='string'))throw Error('Missions invalides');
 if(x.customCities!==undefined&&(!Array.isArray(x.customCities)||!x.customCities.every(v=>typeof v==='string')))throw Error('Villes invalides');
 if(x.customRoutes!==undefined&&!isObj(x.customRoutes))throw Error('Distances invalides');
 if(x.jawazPassages!==undefined&&(!Array.isArray(x.jawazPassages)||x.jawazPassages.length>200000))throw Error('Passages Jawaz invalides');
 return x;
}
async function derive(pass,salt){
 const key=await crypto.subtle.importKey('raw',encoder.encode(pass),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'},key,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
function snapshot(){
 const state=JSON.parse(localStorage.getItem(dataKey)||'null');
 const x=isObj(state)?state:{missions:[],months:{},rate:3.3};
 return validate({...x,customCities:JSON.parse(localStorage.getItem(CUSTOM_CITY_KEY)||'[]'),customRoutes:JSON.parse(localStorage.getItem(CUSTOM_ROUTE_KEY)||'{}'),jawazPassages:JSON.parse(localStorage.getItem(JAWAZ_KEY)||'[]')});
}
function downloadBackup(name,content){const blob=new Blob([JSON.stringify(content)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function refreshStatus(){const date=localStorage.getItem(lastKey);status.textContent=date?'Dernière sauvegarde chiffrée préparée : '+new Date(date).toLocaleString('fr-FR')+'. Vérifie que le fichier est bien téléchargé et copié ailleurs.':'Aucune sauvegarde chiffrée préparée sur cet appareil.';}
$('backup').addEventListener('click',async()=>{
 const pass=$('backupPass').value,confirmPass=$('backupPass2').value;
 if(pass.length<12){alert('Choisis un mot de passe d’au moins 12 caractères.');return;}
 if(pass!==confirmPass){alert('Les deux mots de passe sont différents.');return;}
 if(!crypto.subtle){alert('Chiffrement indisponible : ouvre l’application en HTTPS.');return;}
 try{
  const payload={format:'medware-ndf-data',version:10,createdAt:new Date().toISOString(),data:snapshot()};
  const salt=crypto.getRandomValues(new Uint8Array(16));const iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await derive(pass,salt);const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,encoder.encode(JSON.stringify(payload))));
  const out={format:'medware-ndf-encrypted',version:1,kdf:'PBKDF2-SHA256',iterations:310000,cipher:'AES-256-GCM',salt:b64(salt),iv:b64(iv),data:b64(cipher)};
  downloadBackup('MEDWARE_Sauvegarde_chiffree_'+new Date().toISOString().slice(0,10)+'.json',out);
  localStorage.setItem(lastKey,new Date().toISOString());refreshStatus();
  $('backupPass').value='';$('backupPass2').value='';
 }catch(err){alert('Échec de sauvegarde : '+err.message);}
});
$('restore').addEventListener('click',()=>{$('file').click();});
$('file').addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{
  if(file.size>15*1024*1024)throw Error('Fichier trop volumineux (maximum 15 Mo)');
  let obj=JSON.parse(await file.text());let data;
  if(obj?.format==='medware-ndf-encrypted'){
   if(obj.version!==1||obj.iterations!==310000||obj.cipher!=='AES-256-GCM')throw Error('Format chiffré non pris en charge');
   const pass=$('backupPass').value;
   if(!pass)throw Error('Saisis le mot de passe de la sauvegarde dans le champ ci-dessus');
   try{
    const key=await derive(pass,unb64(obj.salt));
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(obj.iv)},key,unb64(obj.data));
    const payload=JSON.parse(decoder.decode(plain));
    if(payload.format!=='medware-ndf-data')throw Error('Contenu invalide');
    data=validate(payload.data);
   }catch(err){throw Error('Mot de passe incorrect ou fichier endommagé');}
  }else{data=validate(obj);}
  if(!confirm('Attention : restaurer ce fichier REMPLACERA les missions, avances, villes et distances actuellement enregistrées sur cet appareil. Avant de continuer, crée une sauvegarde de tes données actuelles. Continuer ?'))return;
  const core={...data};delete core.customCities;delete core.customRoutes;delete core.jawazPassages;
  const cities=Array.isArray(data.customCities)?data.customCities:[];
  const routes=isObj(data.customRoutes)?data.customRoutes:{};
  const jawaz=Array.isArray(data.jawazPassages)?data.jawazPassages:[];
  const original={core:localStorage.getItem(dataKey),cities:localStorage.getItem(CUSTOM_CITY_KEY),routes:localStorage.getItem(CUSTOM_ROUTE_KEY),jawaz:localStorage.getItem(JAWAZ_KEY)};
  try{
   localStorage.setItem(dataKey,JSON.stringify(core));localStorage.setItem(CUSTOM_CITY_KEY,JSON.stringify(cities));localStorage.setItem(CUSTOM_ROUTE_KEY,JSON.stringify(routes));localStorage.setItem(JAWAZ_KEY,JSON.stringify(jawaz));
  }catch(err){for(const [k,v] of [[dataKey,original.core],[CUSTOM_CITY_KEY,original.cities],[CUSTOM_ROUTE_KEY,original.routes],[JAWAZ_KEY,original.jawaz]]){if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v);}throw err;}
  alert('Restauration terminée. La page va se recharger.');location.reload();
 }catch(err){alert('Restauration impossible : '+err.message);}finally{e.target.value='';$('backupPass').value='';$('backupPass2').value='';}
});
refreshStatus();
})();
