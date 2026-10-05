import { emptyData, validateData, addDays, type Data, type Entry, type Plan, type Settings } from './model';
const key='zurihorario:guest';
const listeners=new Set<()=>void>();
export let storageIssue='';
function read():Data {
  try{const raw=localStorage.getItem(key);return raw?validateData(JSON.parse(raw)):emptyData();}
  catch{storageIssue='No se han podido leer los datos. Conservamos la copia original. Recupera una copia en Configuración.';return emptyData();}
}
export let data=read();
export const subscribe=(listener:()=>void)=>{listeners.add(listener);return ()=>listeners.delete(listener);};
export const syncState='Guardado en este dispositivo';
function commit(next:Data){
  if(storageIssue)throw new Error(storageIssue);
  const validated=validateData(next);
  try{localStorage.setItem(key,JSON.stringify(validated));}
  catch{throw new Error('No se han podido guardar tus datos. Descarga una copia y comprueba el espacio o los permisos del navegador.');}
  data=validated;listeners.forEach(l=>l());
}
export function saveEntry(entry:Entry){commit({...data,entries:{...data.entries,[entry.date]:entry}});}
export function removeEntry(date:string){const entries={...data.entries};delete entries[date];commit({...data,entries});}
export function savePlans(plans:Plan[]){commit({...data,plans:{...data.plans,...Object.fromEntries(plans.map(p=>[p.date,p]))}});}
export function removePlan(date:string){const plans={...data.plans};delete plans[date];commit({...data,plans});}
export function saveSettings(settings:Settings){commit({...data,settings});}
export async function restore(input:unknown){
  const imported=validateData(input);const previousIssue=storageIssue;storageIssue='';
  try{commit({version:1,settings:imported.settings,entries:{...data.entries,...imported.entries},plans:{...data.plans,...imported.plans}});}catch(e){storageIssue=previousIssue;throw e;}
}
export function saveWeeks(start:string,plans:Plan[],count=1){
  const next={...data.plans};
  for(let i=0;i<count*7;i++)delete next[addDays(start,i)];
  commit({...data,plans:{...next,...Object.fromEntries(plans.map(p=>[p.date,p]))}});
}
window.addEventListener('storage',e=>{if(e.key===key){data=read();listeners.forEach(l=>l());}});
