import { addDays, localDate, monthKey, parseDate } from './model';
import { googleGet } from './google';
export interface GoogleCalendar { id: string; summary: string; primary?: boolean; accessRole?:string }
export interface GoogleEvent { id: string; summary?: string; status?: string; start: {dateTime?:string;date?:string}; end: {dateTime?:string;date?:string} }
export interface CalendarEvent { id: string; title: string; date: string; minutes: number; time: string; allDay: boolean }
export async function listCalendars(): Promise<GoogleCalendar[]> {
  const result: GoogleCalendar[]=[];let page='';
  do{const response=await googleGet<{items?:GoogleCalendar[];nextPageToken?:string}>(`users/me/calendarList?maxResults=250${page?`&pageToken=${encodeURIComponent(page)}`:''}`);result.push(...(response.items??[]));page=response.nextPageToken??'';}while(page);
  return result.filter(c=>c.accessRole==='owner');
}
export function splitEvents(events: GoogleEvent[], month: string): CalendarEvent[] {
  const output: CalendarEvent[]=[];
  for(const event of events){
    if(event.status==='cancelled')continue;
    const allDay=!event.start.dateTime;
    if(allDay){
      if(!event.start.date || !event.end.date)continue;
      let day=event.start.date;
      for(let n=0;day<event.end.date && n<400;n++,day=addDays(day,1))if(day.startsWith(month))output.push({id:`${event.id}:${day}`,title:event.summary??'Sin título',date:day,minutes:0,time:'Todo el día',allDay:true});
    }else{
      const start=new Date(event.start.dateTime!),end=new Date(event.end.dateTime!);
      if(isNaN(start.getTime()) || isNaN(end.getTime()) || end<=start)continue;
      let day=localDate(start);
      for(let n=0;n<400;n++,day=addDays(day,1)){
        const midnight=parseDate(day);midnight.setHours(0,0,0,0);
        if(midnight>=end)break;
        const next=new Date(midnight);next.setDate(next.getDate()+1);
        const a=new Date(Math.max(start.getTime(),midnight.getTime())),b=new Date(Math.min(end.getTime(),next.getTime()));
        if(day.startsWith(month) && b>a)output.push({id:`${event.id}:${day}`,title:event.summary??'Sin título',date:day,minutes:Math.round((b.getTime()-a.getTime())/60000),time:`${a.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})} – ${b.getTime()===next.getTime()?'24:00':b.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}`,allDay:false});
      }
    }
  }
  return output;
}
export async function loadEvents(calendarId: string, month: string): Promise<CalendarEvent[]> {
  const start=parseDate(`${month}-01`);start.setHours(0,0,0,0);const end=new Date(start);end.setMonth(end.getMonth()+1);
  const events: GoogleEvent[]=[];let page='';
  do{
    const params=new URLSearchParams({timeMin:start.toISOString(),timeMax:end.toISOString(),singleEvents:'true',orderBy:'startTime',maxResults:'2500',...(page?{pageToken:page}:{})});
    const result=await googleGet<{items?:GoogleEvent[];nextPageToken?:string}>(`calendars/${encodeURIComponent(calendarId)}/events?${params}`);
    events.push(...(result.items??[]));page=result.nextPageToken??'';
  }while(page);
  return splitEvents(events,monthKey(start));
}
