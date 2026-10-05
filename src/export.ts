import { addDays, sessionMinutes, duration, type Plan } from './model';
import { googleGet, GoogleError } from './google';
export function planDates(plan:Plan){return {start:new Date(`${plan.date}T${plan.start}:00`),end:new Date(`${plan.nextDay?addDays(plan.date,1):plan.date}T${plan.end}:00`)};}
export function googleEventBody(plan:Plan){
  const {start,end}=planDates(plan);
  return {summary:plan.title||'Trabajo',description:`Turno previsto · ZuriHorario\nPausa: ${plan.breakMinutes} min\nHoras netas previstas: ${duration(sessionMinutes(plan))}`,start:{dateTime:start.toISOString()},end:{dateTime:end.toISOString()},extendedProperties:{private:{source:'zurihorario'}}};
}
export async function exportEventId(namespace:string,date:string){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${namespace}:${date}`));return `a${Array.from(new Uint8Array(hash)).map(n=>n.toString(16).padStart(2,'0')).join('')}`;}
export async function exportGoogle(plans:Plan[],calendarId:string,namespace:string,onProgress:(n:number)=>void){
  let completed=0;
  for(const plan of plans){
    const id=await exportEventId(namespace,plan.date),path=`calendars/${encodeURIComponent(calendarId)}/events`,body=googleEventBody(plan);
    try{
      try{await googleGet(`${path}?sendUpdates=none`,'POST',{...body,id});}
      catch(e){if(e instanceof GoogleError&&e.status===409){
        const existing=await googleGet<{extendedProperties?:{private?:{source?:string}}}>(`${path}/${id}`);
        if(existing.extendedProperties?.private?.source!=='zurihorario')throw new Error('Ya existe un evento ajeno con este identificador. No se ha modificado.');
        await googleGet(`${path}/${id}?sendUpdates=none`,'PATCH',body);
      }else throw e;}
    }catch(e){throw new Error(`${completed} de ${plans.length} turnos exportados. ${e instanceof Error?e.message:'No se pudo continuar.'} Puedes volver a intentarlo: los turnos ya enviados se actualizan sin duplicarse.`);}
    completed++;onProgress(completed);
  }
}
const icsEscape=(value:string)=>value.replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
const icsTime=(date:Date)=>date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
function foldLine(line:string){const chunks:string[]=[];let part='',bytes=0;for(const char of line){const n=new TextEncoder().encode(char).length;if(bytes+n>73){chunks.push(part);part=' '+char;bytes=1+n;}else{part+=char;bytes+=n;}}chunks.push(part);return chunks.join('\r\n');}
export function exportICS(plans:Plan[],namespace:string,now=new Date()):string{
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//ZuriHorario//Turnos//ES','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:ZuriHorario'];
  for(const p of plans){const {start,end}=planDates(p);lines.push('BEGIN:VEVENT',`UID:${namespace}-${p.date}@zurihorario`,`DTSTAMP:${icsTime(now)}`,`DTSTART:${icsTime(start)}`,`DTEND:${icsTime(end)}`,`SUMMARY:${icsEscape(p.title||'Trabajo')}`,`DESCRIPTION:${icsEscape(`Pausa: ${p.breakMinutes} min. Horas netas previstas: ${duration(sessionMinutes(p))}.`)}`,'END:VEVENT');}
  lines.push('END:VCALENDAR');return lines.map(foldLine).join('\r\n')+'\r\n';
}
