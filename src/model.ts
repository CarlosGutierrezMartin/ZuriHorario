export interface Session { start: string; end: string; breakMinutes: number; nextDay: boolean }
export interface Entry { date: string; sessions: Session[]; note: string }
export interface Plan extends Session { date: string; title: string }
export interface Settings { name: string; defaultGoal: number; goals: Record<string, number>; calendarId: string; namespace: string }
export interface Data { version: 1; settings: Settings; entries: Record<string, Entry>; plans: Record<string, Plan> }
export const emptyData = (): Data => ({ version: 1, settings: { name: 'Zuri', defaultGoal: 0, goals: {}, calendarId: '', namespace:crypto.randomUUID() }, entries: {}, plans: {} });
export const localDate = (d = new Date()): string => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export const parseDate = (s: string): Date => new Date(`${s}T12:00:00`);
export function addDays(s: string, n: number): string { const d = parseDate(s); d.setDate(d.getDate()+n); return localDate(d); }
export const monthKey = (d = new Date()): string => localDate(d).slice(0,7);
export const formatDate = (s: string, options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }) => parseDate(s).toLocaleDateString('es-ES', options);
export function validDate(value: unknown): value is string { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(parseDate(value).getTime()) && localDate(parseDate(value)) === value; }
export function validMonth(value: string): boolean { return /^\d{4}-(0[1-9]|1[0-2])$/.test(value); }
export function minutesAt(time: string): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Introduce una hora válida.');
  const [h,m] = time.split(':').map(Number); return h*60+m;
}
export function sessionMinutes(session: Session): number {
  const duration = minutesAt(session.end) - minutesAt(session.start) + (session.nextDay ? 1440 : 0);
  if (duration <= 0 || duration > 1440) throw new Error('La salida debe ser posterior a la entrada. Marca «Termina al día siguiente» para un turno de noche.');
  if (!Number.isInteger(session.breakMinutes) || session.breakMinutes < 0 || session.breakMinutes > duration) throw new Error('La pausa debe estar entre 0 y la duración del turno.');
  return duration-session.breakMinutes;
}
export function entryMinutes(entry?: Entry): number { return entry?.sessions.reduce((n,s) => n+sessionMinutes(s),0) ?? 0; }
export function validateSessions(sessions: Session[]): void {
  if (!sessions.length || sessions.length>12) throw new Error('Añade entre 1 y 12 tramos.');
  const ranges = sessions.map(s => { sessionMinutes(s); return [minutesAt(s.start), minutesAt(s.end)+(s.nextDay?1440:0)]; }).sort((a,b) => a[0]-b[0]);
  if (ranges.some((r,i) => i>0 && r[0]<ranges[i-1][1])) throw new Error('Los tramos se solapan. Revisa las horas de entrada y salida.');
  if (sessions.reduce((n,s)=>n+sessionMinutes(s),0)>1440) throw new Error('No puedes registrar más de 24 horas en un día.');
}
export const duration = (minutes: number): string => { const abs = Math.abs(Math.round(minutes)); return `${minutes<0?'−':''}${Math.floor(abs/60)} h${abs%60 ? ` ${String(abs%60).padStart(2,'0')} min` : ''}`; };
export const goalFor = (data: Data, month: string) => data.settings.goals[month] ?? data.settings.defaultGoal;
export function monthStats(data: Data, month: string) {
  const entries = Object.values(data.entries).filter(e=>e.date.startsWith(month));
  const worked = entries.reduce((n,e)=>n+entryMinutes(e),0);
  const planned = Object.values(data.plans).filter(p=>p.date.startsWith(month)).reduce((n,p)=>n+sessionMinutes(p),0);
  const goal = goalFor(data,month);
  return { worked, planned, goal, remaining: Math.max(goal-worked,0), extra: Math.max(worked-goal,0), days: entries.length, percent: goal>0 ? Math.round(worked/goal*100) : 0 };
}
export function validateData(input: unknown): Data {
  if (!input || typeof input !== 'object') throw new Error('El archivo no es una copia de ZuriHorario.');
  const d = input as Data;
  if (d.version!==1 || !d.settings || !d.entries || !d.plans || typeof d.settings.name!=='string' || d.settings.name.length>50 || !Number.isInteger(d.settings.defaultGoal) || d.settings.defaultGoal<0 || d.settings.defaultGoal>44640 || typeof d.settings.calendarId!=='string' || !d.settings.goals || typeof d.settings.goals!=='object') throw new Error('La copia contiene datos no válidos.');
  for (const [m,g] of Object.entries(d.settings.goals)) if (!validMonth(m) || !Number.isInteger(g) || g<0 || g>44640) throw new Error('Objetivo mensual no válido.');
  for (const [date,e] of Object.entries(d.entries)) {
    if (!validDate(date) || e.date!==date || typeof e.note!=='string' || e.note.length>500 || !Array.isArray(e.sessions) || e.sessions.some(s=>typeof s.nextDay!=='boolean')) throw new Error('Registro no válido.');
    validateSessions(e.sessions);
  }
  for (const [date,p] of Object.entries(d.plans)) { if (!validDate(date) || p.date!==date || typeof p.title!=='string' || p.title.length>80 || typeof p.nextDay!=='boolean') throw new Error('Turno no válido.'); sessionMinutes(p); }
  // Return only recognized fields, never arbitrary properties from imported JSON.
  return { version: 1, settings: { name: d.settings.name, defaultGoal:d.settings.defaultGoal, goals: {...d.settings.goals}, calendarId:d.settings.calendarId, namespace:typeof d.settings.namespace==='string'&&/^[a-f0-9-]{36}$/.test(d.settings.namespace)?d.settings.namespace:crypto.randomUUID() }, entries:Object.fromEntries(Object.entries(d.entries).map(([k,e])=>[k,{date:k,note:e.note,sessions:e.sessions.map(s=>({start:s.start,end:s.end,breakMinutes:s.breakMinutes,nextDay:s.nextDay}))}])), plans:Object.fromEntries(Object.entries(d.plans).map(([k,p])=>[k,{date:k,title:p.title,start:p.start,end:p.end,breakMinutes:p.breakMinutes,nextDay:p.nextDay}])) };
}
