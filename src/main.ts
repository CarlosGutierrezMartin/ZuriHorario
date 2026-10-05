import { createIcons, House, CalendarDays, Settings2, Heart, ArrowUpRight, ChevronLeft, ChevronRight, Plus, Check, Clock3, ArrowRight, X, Trash2, Download, Cloud, LogOut, RefreshCw, Flower2, Sparkles, Coffee } from 'lucide';
import { registerSW } from 'virtual:pwa-register';
import { localDate, parseDate, addDays, monthKey, formatDate, duration, entryMinutes, sessionMinutes, validateSessions, monthStats, goalFor, type Session, type Entry, type Plan } from './model';
import * as store from './store';
import * as google from './google';
import { exportICS, exportGoogle } from './export';
import { listCalendars, loadEvents, type GoogleCalendar, type CalendarEvent } from './calendar';
import './style.css';

const app=document.querySelector<HTMLDivElement>('#app')!;
const dialog=document.querySelector<HTMLDialogElement>('#dialog')!;
const today=()=>localDate();
let view: 'home'|'calendar'|'settings'='home';
let month=monthKey();
let selected=today();
let homeDate=today();
let dirty=false;
let dirtyBeforeDialog=false;
let events: CalendarEvent[]=[];
let eventMonth='';
let eventCalendar='';
let calendars: GoogleCalendar[]=[];
let loadingCalendar=false;
let calendarError='';
let googleGeneration=0;
let calendarMode:'month'|'week'='month';
let weekStart=addDays(today(),-(parseDate(today()).getDay()+6)%7);
let exporting=false;
let toastTimer:ReturnType<typeof setTimeout>;
let installEvent: (Event & {prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>})|null=null;
let updateAvailable=false;
const updateSW=registerSW({onNeedRefresh(){updateAvailable=true;render();},onOfflineReady(){toast('Lista para acompañarte sin conexión.');}});
const ic=(name:string,cls='')=>`<i data-lucide="${name}" class="${cls}" aria-hidden="true"></i>`;
const esc=(value:unknown)=>String(value??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]!));
const titleMonth=()=>parseDate(`${month}-01`).toLocaleDateString('es-ES',{month:'long',year:'numeric'});
function toast(message:string){const el=document.querySelector<HTMLDivElement>('#toast')!;el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),4500);}
function errorMessage(error:unknown):string {
  const code=(error as {code?:string})?.code;
  if(code==='auth/popup-closed-by-user' || code==='auth/cancelled-popup-request')return 'Has cerrado la ventana de Google. Puedes volver a intentarlo cuando quieras.';
  if(code==='auth/popup-blocked')return 'El navegador ha bloqueado la ventana de Google. Permite las ventanas emergentes y vuelve a intentarlo.';
  if(code==='auth/unauthorized-domain')return 'Este dominio aún no está autorizado para iniciar sesión con Google.';
  if(code==='auth/network-request-failed')return 'No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo.';
  return error instanceof Error?error.message:'No se ha podido completar la acción. Inténtalo de nuevo.';
}
function paintIcons(){createIcons({icons:{House,CalendarDays,Settings2,Heart,ArrowUpRight,ChevronLeft,ChevronRight,Plus,Check,Clock3,ArrowRight,X,Trash2,Download,Cloud,LogOut,RefreshCw,Flower2,Sparkles,Coffee},attrs:{'stroke-width':1.7}});}
function monthControl(){return `<div class="month-control"><button data-action="prev-month" aria-label="Mes anterior">${ic('chevron-left')}</button><span>${esc(titleMonth())}</span><button data-action="next-month" aria-label="Mes siguiente">${ic('chevron-right')}</button></div>`;}
function syncLabel(){return navigator.onLine ? store.syncState : 'Guardado sin conexión';}
function render(){
  const name=store.data.settings.name||'Zuri';
  const labels={home:'Inicio',calendar:'Calendario',settings:'Configuración'};
  app.innerHTML=`<aside class="sidebar">
    <a class="brand" href="#inicio" aria-label="ZuriHorario, Inicio"><span class="brand-icon">${ic('flower-2')}</span><span>Zuri<span class="brand-light">Horario</span><small>TU TIEMPO, A TU RITMO</small></span></a>
    <nav aria-label="Navegación principal">${(['home','calendar','settings'] as const).map((v,i)=>`<button data-view="${v}" class="nav-item ${view===v?'active':''}" ${view===v?'aria-current="page"':''}>${ic(['house','calendar-days','settings-2'][i])}<span>${labels[v]}</span>${view===v?'<span class="nav-dot"></span>':''}</button>`).join('')}</nav>
    <div class="sidebar-bottom"><div class="love-note">${ic('heart')}<p>Para ti, con todo<br>mi cariño.</p><span>Tu novio te quiere mucho.</span></div><button class="install-side" data-action="install">${ic('download')} Instalar la app</button><div class="account"><div class="avatar">${esc(name.slice(0,1).toUpperCase())}</div><div><b>${esc(name)}</b><small class="sync-label">${esc(syncLabel())}</small></div>${ic('heart')}</div></div>
  </aside>
  <div class="workspace"><header class="topbar"><span class="breadcrumb">Mi espacio <span>/</span> <b>${labels[view]}</b></span><div class="topbar-right"><span class="connection ${navigator.onLine?'':'offline'}"><span></span>${navigator.onLine?'Un día a la vez':'Sin conexión'}</span><button class="avatar mobile-avatar" data-view="settings" aria-label="Abrir configuración">${esc(name.slice(0,1).toUpperCase())}</button></div></header>
  <main id="main"><div class="page-heading"><div><p class="eyebrow">${view==='home'?'TU PEQUEÑO MOMENTO DEL DÍA':view==='calendar'?'UN POCO DE ORDEN, MUCHA CALMA':'A TU MANERA'}</p><h1>${view==='home'?`Hola, ${esc(name)} <span class="greeting-flower">✿</span>`:view==='calendar'?'Tu calendario':'Tu espacio, tus reglas'}</h1><p class="subtitle">${view==='home'?'Cada hora cuenta. Y tú, todavía más.':view==='calendar'?'Lo que tienes previsto y lo que de verdad has trabajado.':'Deja todo listo para que apuntar tus horas sea fácil.'}</p></div>${view!=='settings'?monthControl():''}</div>
  ${store.storageIssue?`<div class="notice error">${esc(store.storageIssue)}</div>`:''}
  ${updateAvailable?`<div class="notice">Hay una nueva versión disponible. Guarda lo que estés editando.<button data-action="update" class="text-button">Actualizar</button></div>`:''}
  ${view==='home'?home():view==='calendar'?calendar():settings()}
  <footer class="page-footer"><span>Hecho con cariño, para que cuides tu tiempo.</span>${ic('heart')}<span>ZuriHorario</span></footer></main></div>
  <nav class="bottom-nav" aria-label="Navegación móvil">${(['home','calendar','settings'] as const).map((v,i)=>`<button data-view="${v}" class="${view===v?'active':''}" ${view===v?'aria-current="page"':''}>${ic(['house','calendar-days','settings-2'][i])}<span>${labels[v]}</span></button>`).join('')}</nav>`;
  paintIcons();bind();dirty=false;
}
function home(){
  const stats=monthStats(store.data,month);const entry=store.data.entries[homeDate];
  const weekStart=addDays(today(),-(parseDate(today()).getDay()+6)%7);
  const week=Array.from({length:7},(_,i)=>addDays(weekStart,i));
  const recent=Object.values(store.data.entries).filter(e=>e.date.startsWith(month)).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,4);
  return `${!stats.goal?`<div class="setup-banner"><div>${ic('sparkles')}<span><b>Empezamos a tu ritmo</b><small>Configura tus horas mensuales para ver cómo vas.</small></span></div><button data-view="settings" class="text-button">Configurar ${ic('arrow-right')}</button></div>`:''}
  <section class="overview" aria-label="Resumen mensual"><article class="progress-card"><div class="card-overline">${ic('flower-2')} TU MES, PASO A PASO <span>${esc(parseDate(`${month}-01`).toLocaleDateString('es-ES',{month:'long'}))}</span></div><div class="progress-content"><div><p class="stat-number">${duration(stats.worked)}<span>trabajadas</span></p><p class="progress-caption">${stats.goal?`de ${duration(stats.goal)} de tu objetivo mensual`:'Tu primer paso empieza con una hora.'}</p><div class="progress-track" role="progressbar" aria-label="Objetivo mensual" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(stats.percent,100)}"><span style="width:${Math.min(stats.percent,100)}%"></span></div><div class="progress-detail"><span>${stats.goal?`${stats.percent}% de tu objetivo`:'Objetivo pendiente'}</span><span>${stats.days} ${stats.days===1?'día registrado':'días registrados'}</span></div></div><div class="petal-illustration" aria-hidden="true"><span class="petal p1"></span><span class="petal p2"></span><span class="petal p3"></span><span class="petal p4"></span><span class="petal p5"></span><span class="petal p6"></span><span class="petal-center">${ic('heart')}</span></div></div></article>
  <article class="mini-stat"><span class="stat-icon">${ic(stats.extra?'sparkles':'clock-3')}</span><p>${stats.extra?'Horas de más':'Por completar'}</p><strong>${stats.goal?duration(stats.extra||stats.remaining):'—'}</strong><small>${stats.extra?'Objetivo cumplido. ¡Bien hecho!':stats.goal?'Todo suma, sin prisa.':'Añade tu objetivo mensual'}</small></article><article class="mini-stat"><span class="stat-icon lilac">${ic('calendar-days')}</span><p>Horas previstas</p><strong>${duration(stats.planned)}</strong><small>Tus turnos de este mes</small></article></section>
  <div class="home-grid"><section class="card entry-card"><div class="section-heading"><div class="section-icon">${ic('clock-3')}</div><div><h2>${homeDate===today()?'¿Cómo ha ido hoy?':'Tu jornada'}</h2><p>Un momento para apuntar tu día.</p></div><span class="pill">${entry?'Registrado':'Sin registrar'}</span></div><form id="entry-form"><div class="form-date"><label for="entry-date">Día de trabajo</label><input id="entry-date" name="date" type="date" value="${homeDate}" max="${today()}" required /></div>${sessionRows(entry?.sessions??[defaultSession(homeDate)])}<button type="button" class="add-session" data-action="add-session">${ic('plus')} Añadir otro tramo</button><label class="note-label" for="entry-note">Una nota <span>(si te apetece)</span></label><textarea id="entry-note" name="note" maxlength="500" rows="2" placeholder="¿Algo que quieras recordar de hoy?">${esc(entry?.note??'')}</textarea><div class="entry-total"><span>Total de la jornada <small>Pausas descontadas</small></span><strong id="live-total">${safeTotal(entry?.sessions??[defaultSession(homeDate)])}</strong></div><p class="form-error" role="alert"></p><button class="primary full" type="submit">${ic('check')} ${entry?'Guardar cambios':'Guardar mi jornada'}</button><p class="save-hint">${ic('cloud')} Se guarda en este dispositivo.</p></form></section>
  <div class="home-right"><section class="card week-card"><div class="section-title"><h2>Tu semana</h2><span>${formatDate(week[0],{day:'numeric'})}–${formatDate(week[6],{day:'numeric',month:'short'})}</span></div><div class="week-chart">${week.map(d=>{const n=entryMinutes(store.data.entries[d]);return `<button class="week-day ${d===today()?'is-today':''}" data-entry-date="${d}" aria-label="${esc(formatDate(d))}: ${duration(n)}" ${d>today()?'disabled':''}><span class="week-value">${n?duration(n):'—'}</span><span class="bar-space"><span class="week-bar ${n?'filled':''}" style="height:${n?Math.max(12,Math.min(100,n/720*100)):8}%"></span></span><span class="week-label">${formatDate(d,{weekday:'short'}).replace('.','')}</span><span class="week-num">${parseDate(d).getDate()}</span></button>`;}).join('')}</div><div class="week-bottom"><span><i class="legend-dot"></i> Horas reales</span><b>${duration(week.reduce((n,d)=>n+entryMinutes(store.data.entries[d]),0))} esta semana</b></div></section>
  <section class="encouragement"><div class="small-flower">${ic('heart')}</div><div><p>Estás haciendo mucho.<br><em>También mereces descansar.</em></p><span>Y recuerda: tu novio te quiere muchísimo.</span></div><span class="love-spark">✧</span></section>
  <section class="card recent-card"><div class="section-title"><h2>Últimos registros</h2><button class="text-button" data-view="calendar">Ver todos ${ic('arrow-up-right')}</button></div>${recent.length?recent.map(e=>`<button class="record-row" data-entry-date="${e.date}"><span class="date-tile"><small>${formatDate(e.date,{month:'short'}).replace('.','')}</small><b>${parseDate(e.date).getDate()}</b></span><span class="record-detail"><b>${esc(formatDate(e.date,{weekday:'long'}))}</b><small>${e.sessions.map(s=>`${s.start}–${s.end}${s.nextDay?' (+1)':''}`).join(' · ')}</small></span><strong>${duration(entryMinutes(e))}</strong>${ic('chevron-right')}</button>`).join(''):`<div class="empty-state">${ic('coffee')}<p>Tu historia empieza aquí.</p><span>Guarda tu primera jornada y la verás en este espacio.</span></div>`}</section></div></div>`;
}
function defaultSession(date:string):Session { const p=store.data.plans[date];return p?{start:p.start,end:p.end,breakMinutes:p.breakMinutes,nextDay:p.nextDay}:{start:'09:00',end:'17:00',breakMinutes:30,nextDay:false}; }
function safeTotal(sessions:Session[]){try{validateSessions(sessions);return duration(sessions.reduce((n,s)=>n+sessionMinutes(s),0));}catch{return 'Revisa los tramos';}}
function sessionRow(s:Session,index:number){return `<fieldset class="session-row"><legend>Tramo ${index+1}</legend>${index?`<button type="button" class="remove-session" aria-label="Quitar tramo ${index+1}">${ic('x')}</button>`:''}<div class="time-inputs"><label>Entrada<input type="time" name="start" value="${esc(s.start)}" required /></label><span class="time-arrow">${ic('arrow-right')}</span><label>Salida<input type="time" name="end" value="${esc(s.end)}" required /></label><label class="break-input">Pausa <span>(min)</span><input type="number" name="break" value="${s.breakMinutes}" min="0" max="1440" step="1" inputmode="numeric" required /></label></div><label class="checkbox-label"><input name="nextDay" type="checkbox" ${s.nextDay?'checked':''} /> Termina al día siguiente</label></fieldset>`;}
function sessionRows(sessions:Session[]){return `<div class="session-rows">${sessions.map(sessionRow).join('')}</div>`;}
function readSessions(form:HTMLFormElement):Session[]{return Array.from(form.querySelectorAll<HTMLFieldSetElement>('.session-row')).map(row=>({start:row.querySelector<HTMLInputElement>('[name=start]')!.value,end:row.querySelector<HTMLInputElement>('[name=end]')!.value,breakMinutes:Number(row.querySelector<HTMLInputElement>('[name=break]')!.value),nextDay:row.querySelector<HTMLInputElement>('[name=nextDay]')!.checked}));}
function calendar(){
  if(calendarMode==='week')return weeklyCalendar();
  const first=parseDate(`${month}-01`);const offset=(first.getDay()+6)%7;const begin=addDays(`${month}-01`,-offset);const last=new Date(first.getFullYear(),first.getMonth()+1,0).getDate();
  const cells=Array.from({length:Math.ceil((offset+last)/7)*7},(_,i)=>addDays(begin,i));
  const entry=store.data.entries[selected],plan=store.data.plans[selected];const dayEvents=events.filter(e=>e.date===selected);
  return `${calendarSwitcher()}<div class="calendar-top"><div class="legend"><span><i class="legend-dot"></i> Trabajado</span><span><i class="legend-dot planned"></i> Previsto</span><span><i class="legend-dot google"></i> Google Calendar</span></div><div class="calendar-actions"><button class="secondary" data-action="go-today">Hoy</button><button class="primary" data-action="new-plan">${ic('plus')} Añadir turno</button></div></div><div class="calendar-layout"><section class="card month-card"><div class="weekday-head">${['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d=>`<span>${d}</span>`).join('')}</div><div class="calendar-grid">${cells.map(d=>{const e=store.data.entries[d],p=store.data.plans[d],ge=events.filter(g=>g.date===d);return `<button class="day-cell ${d.startsWith(month)?'':'other-month'} ${d===today()?'today':''} ${d===selected?'selected':''}" data-day="${d}" aria-label="${esc(formatDate(d))}${e?`, trabajado ${duration(entryMinutes(e))}`:''}${p?', turno previsto':''}${ge.length?`, ${ge.length} eventos de Google`:''}" aria-pressed="${d===selected}"><span class="day-number">${parseDate(d).getDate()}</span><span class="day-badges">${e?`<span class="day-badge actual">${duration(entryMinutes(e))}</span>`:''}${p?`<span class="day-badge plan">${esc(p.start)}–${esc(p.end)}</span>`:''}${ge.length?`<span class="day-badge google-event">${ge.length} ${ge.length===1?'evento':'eventos'}</span>`:''}</span><span class="mobile-dots">${e?'<i class="legend-dot"></i>':''}${p?'<i class="legend-dot planned"></i>':''}${ge.length?'<i class="legend-dot google"></i>':''}</span></button>`;}).join('')}</div><div class="calendar-foot">Elige un día para ver o editar sus horas.</div></section>
  <div class="calendar-side"><section class="card day-detail"><p class="eyebrow">${selected===today()?'HOY':'EL DÍA QUE ELIGES'}</p><h2>${esc(formatDate(selected,{weekday:'long',day:'numeric'}))}</h2><p class="muted">${esc(formatDate(selected,{month:'long',year:'numeric'}))}</p><div class="day-section"><span class="detail-label"><i class="legend-dot"></i> Horas reales</span>${entry?`<strong class="detail-hours">${duration(entryMinutes(entry))}</strong><p class="muted">${entry.sessions.map(s=>`${s.start}–${s.end}${s.nextDay?' (+1 día)':''} · ${s.breakMinutes} min de pausa`).join('<br>')}</p>${entry.note?`<p class="day-note">${esc(entry.note)}</p>`:''}`:'<p class="detail-empty">Todavía no has registrado esta jornada.</p>'}<button class="secondary full" data-action="edit-actual" ${selected>today()?'disabled':''}>${ic(entry?'clock-3':'plus')} ${entry?'Editar jornada':'Registrar jornada'}</button>${selected>today()?'<small class="muted future-hint">Las horas reales se registran cuando llega el día.</small>':''}</div><div class="day-section"><span class="detail-label"><i class="legend-dot planned"></i> Tu turno previsto</span>${plan?`<strong class="plan-title">${esc(plan.title||'Turno de trabajo')}</strong><p>${plan.start}–${plan.end}${plan.nextDay?' (+1 día)':''} <span class="muted">· ${duration(sessionMinutes(plan))}</span></p>`:'<p class="detail-empty">Un día por organizar… o para descansar.</p>'}<button class="text-button" data-action="new-plan">${ic(plan?'calendar-days':'plus')} ${plan?'Editar turno':'Añadir turno'}</button></div>${dayEvents.length?`<div class="day-section"><span class="detail-label"><i class="legend-dot google"></i> Google Calendar</span>${dayEvents.map(e=>`<div class="google-item"><b>${esc(e.title)}</b><small>${esc(e.time)}</small></div>`).join('')}<small class="muted">Los eventos no cuentan como horas trabajadas.</small></div>`:''}</section>
  <section class="google-card"><span class="google-mark">G</span><h3>Tu calendario, conectado</h3><p>Consulta tus turnos de Google junto a tus registros.</p>${calendarPanel()}</section></div></div>`;
}
function calendarPanel(){return `${calendars.length?`<label class="calendar-select-label" for="calendar-select">Tu calendario de turnos<select id="calendar-select"><option value="">Elige tu calendario</option>${calendars.map(c=>`<option value="${esc(c.id)}" ${c.id===store.data.settings.calendarId?'selected':''}>${esc(c.summary)}</option>`).join('')}</select></label>`:''}${calendarError?`<p class="form-error" role="alert">${esc(calendarError)}</p>`:''}${!google.configured?'<p class="field-help">La conexión directa está pendiente de activación. La descarga en .ics ya está disponible.</p>':''}<button class="secondary full" data-action="connect-calendar" ${loadingCalendar?'disabled':''}>${ic(google.calendarConnected()?'refresh-cw':'calendar-days')} ${loadingCalendar?'Cargando…':google.calendarConnected()?'Actualizar calendario':'Conectar Google Calendar'}</button>${google.calendarConnected()?`<button class="text-button" data-action="disconnect-calendar">Desconectar calendario</button>`:''}`;}
function calendarSwitcher(){return `<div class="calendar-switcher"><div class="segmented"><button data-action="month-view" class="${calendarMode==='month'?'active':''}">Mes</button><button data-action="week-view" class="${calendarMode==='week'?'active':''}">Planificar semana</button></div><button class="secondary" data-action="open-export">${ic('arrow-up-right')} Exportar turnos</button></div>`;}
function weeklyCalendar(){
  const days=Array.from({length:7},(_,i)=>addDays(weekStart,i));
  const hasPlans=days.some(d=>store.data.plans[d]);
  return `${calendarSwitcher()}<section class="card weekly-planner"><div class="week-planner-head"><div><p class="eyebrow">TU SEMANA, A TU MANERA</p><h2>${formatDate(weekStart,{day:'numeric',month:'short'})} – ${formatDate(addDays(weekStart,6),{day:'numeric',month:'short',year:'numeric'})}</h2></div><div class="week-arrows"><button class="icon-button" data-action="prev-week" aria-label="Semana anterior">${ic('chevron-left')}</button><button class="secondary" data-action="current-week">Esta semana</button><button class="icon-button" data-action="next-week" aria-label="Semana siguiente">${ic('chevron-right')}</button></div></div><p class="muted">Introduce tus turnos, marca los días de descanso y repite la semana si lo necesitas.</p><form id="week-form"><div class="week-template"><label>Nombre de los turnos<input name="title" value="Trabajo" maxlength="80" required /></label><button class="text-button" type="button" data-action="copy-previous-week">Copiar semana anterior ${ic('arrow-right')}</button></div><div class="weekly-rows">${days.map((date,index)=>weekRow(date,index,store.data.plans[date],hasPlans)).join('')}</div><div class="week-repeat"><label for="repeat-weeks">Repetir en las siguientes semanas<select id="repeat-weeks" name="weeks">${Array.from({length:9},(_,i)=>`<option value="${i+1}">${i===0?'Solo esta semana':`${i} ${i===1?'semana más':'semanas más'}`}</option>`).join('')}</select></label><p class="field-help">Al guardar, se actualizan todos los días de las semanas elegidas, incluidos los descansos.</p></div><p class="form-error" role="alert"></p><div class="week-save"><button class="primary" type="submit">${ic('check')} Guardar semana</button><span>Guarda primero; después, exporta a Google.</span></div></form></section><section class="encouragement weekly-love"><div class="small-flower">${ic('heart')}</div><div><p>Organiza tu semana.<em> Deja también espacio para ti.</em></p><span>Tu novio te quiere mucho, en los días largos y en los de descanso.</span></div></section>`;
}
function weekRow(date:string,index:number,plan:Plan|undefined,hasPlans:boolean){
  const s=plan??{start:'09:00',end:'17:00',breakMinutes:30,nextDay:false};const enabled=!!plan||(!hasPlans&&index<5);
  return `<div class="weekly-row ${enabled?'':'rest-day'}" data-date="${date}" data-title="${esc(plan?.title??'Trabajo')}"><label class="workday-toggle"><input type="checkbox" name="working" ${enabled?'checked':''} /><span><b>${esc(formatDate(date,{weekday:'long'}))}</b><small>${esc(formatDate(date,{day:'numeric',month:'short'}))}</small></span></label><div class="weekly-times"><label>Entrada<input type="time" name="start" value="${s.start}" required ${enabled?'':'disabled'} /></label><label>Salida<input type="time" name="end" value="${s.end}" required ${enabled?'':'disabled'} /></label><label>Pausa (min)<input type="number" name="break" min="0" max="1440" step="1" value="${s.breakMinutes}" required inputmode="numeric" ${enabled?'':'disabled'} /></label><label class="checkbox-label"><input type="checkbox" name="nextDay" ${s.nextDay?'checked':''} ${enabled?'':'disabled'} /> Día siguiente</label></div><span class="rest-label">Descanso</span></div>`;
}
function openExport(start=calendarMode==='week'?weekStart:`${month}-01`,end=calendarMode==='week'?addDays(weekStart,6):localDate(new Date(parseDate(`${month}-01`).getFullYear(),parseDate(`${month}-01`).getMonth()+1,0))){
  openDialog(`${dialogHeader('Lleva tus turnos contigo','Exporta solo los horarios previstos que elijas.')}<form id="export-form"><div class="export-range"><label>Desde<input type="date" name="from" value="${start}" required /></label><label>Hasta<input type="date" name="to" value="${end}" required /></label></div><div id="export-preview"></div><p class="field-help">El evento incluye el turno completo y la pausa en su descripción. Las horas reales no se exportan.</p>${google.calendarConnected()?`<label for="export-calendar">Calendario de destino<select id="export-calendar" name="calendar"><option value="">Elige un calendario</option>${calendars.map(c=>`<option value="${esc(c.id)}" ${c.id===store.data.settings.calendarId?'selected':''}>${esc(c.summary)}</option>`).join('')}</select></label><button class="primary full" type="submit" name="method" value="google">${ic('arrow-up-right')} Exportar a Google Calendar</button><p class="field-help">Reexportar actualiza los turnos enviados desde esta app, sin duplicarlos. Borrar un turno aquí no lo borra en Google.</p>`:`${google.configured?`<button class="primary full" type="button" data-action="connect-calendar">Conectar Google Calendar</button>`:'<div class="notice">La conexión directa a Google aún no está activada.</div>'}`}<button class="secondary full" type="submit" name="method" value="ics">${ic('download')} Descargar archivo .ics</button><p class="field-help">Para importar el archivo en Google Calendar, usa un ordenador: Configuración → Importar y exportar. Reimportar archivos puede duplicar eventos.</p><p class="form-error" role="alert"></p></form>`);
  updateExportPreview();dialog.querySelectorAll('input[type=date]').forEach(input=>input.addEventListener('input',updateExportPreview));
}
function exportPlans(form:HTMLFormElement){const f=new FormData(form),from=String(f.get('from')),to=String(f.get('to'));if(from>to)throw new Error('El final debe ser posterior al inicio.');return Object.values(store.data.plans).filter(p=>p.date>=from&&p.date<=to).sort((a,b)=>a.date.localeCompare(b.date));}
function updateExportPreview(){const form=dialog.querySelector<HTMLFormElement>('#export-form');if(!form)return;const output=form.querySelector('#export-preview')!;try{const plans=exportPlans(form);output.innerHTML=plans.length?`<p class="export-count">${plans.length} ${plans.length===1?'turno':'turnos'} · ${duration(plans.reduce((n,p)=>n+sessionMinutes(p),0))} previstas</p><div class="export-list">${plans.map(p=>`<div><span>${esc(formatDate(p.date,{day:'numeric',month:'short'}))}</span><b>${esc(p.title)}</b><small>${p.start}–${p.end}${p.nextDay?' (+1)':''}</small></div>`).join('')}</div>`:'<p class="detail-empty">No hay turnos guardados entre estas fechas. Planifica y guarda tu semana primero.</p>';}catch{output.innerHTML='<p class="form-error">Revisa el intervalo de fechas.</p>';}}
function settings(){
  const s=store.data.settings;const goal=goalFor(store.data,month);
  return `<div class="settings-grid"><div><section class="card settings-card"><div class="section-heading"><div class="section-icon">${ic('settings-2')}</div><div><h2>Lo básico</h2><p>Un par de detalles, y listo.</p></div></div><form id="settings-form"><label for="name">¿Cómo te llamamos?</label><input id="name" name="name" maxlength="50" value="${esc(s.name)}" placeholder="Zuri" required /><label for="monthly-hours">Horas que debes trabajar cada mes</label><div class="goal-input"><input id="monthly-hours" name="goal" type="number" min="0.25" max="744" step="0.25" inputmode="decimal" value="${s.defaultGoal?s.defaultGoal/60:''}" placeholder="Por ejemplo, 160" required /><span>horas / mes</span></div><p class="field-help">Tu objetivo fijo, para seguir tu mes con calma.</p><p class="form-error" role="alert"></p><button type="submit" class="primary">${ic('check')} Guardar configuración</button></form><details class="month-override"><summary>Este mes es diferente</summary><form id="override-form"><label for="override-month">Mes</label><input id="override-month" name="month" type="month" value="${month}" required /><label for="override-goal">Objetivo de ese mes (horas)</label><input id="override-goal" name="goal" type="number" min="0.25" max="744" step="0.25" value="${goal?goal/60:''}" required /><p class="form-error" role="alert"></p><button class="secondary" type="submit">Guardar excepción</button><button class="text-button" type="button" data-action="reset-override">Usar objetivo fijo</button></form></details></section><section class="card settings-card"><div class="section-heading"><div class="section-icon">${ic('download')}</div><div><h2>Una copia de tus horas</h2><p>Tu tiempo también merece estar a salvo.</p></div></div><p class="muted">Tus datos se guardan en este dispositivo. Descarga una copia de vez en cuando: borrar los datos del navegador o cambiar de móvil puede eliminarlos.</p><div class="backup-actions"><button class="secondary" data-action="export">${ic('download')} Descargar copia</button><label class="secondary file-label">Importar copia<input id="import" type="file" accept="application/json,.json" /></label><button class="text-button" data-action="csv">Exportar este mes en CSV ${ic('arrow-up-right')}</button></div></section></div><div><section class="card settings-card"><div class="section-heading"><div class="section-icon lilac">${ic('calendar-days')}</div><div><h2>Tus turnos en Google</h2><p>Planifícalos aquí y llévalos a tu calendario.</p></div></div><p class="muted">Conecta Google para exportar una semana o varias de una vez. Tus registros de horas reales se quedan en tu dispositivo.</p>${calendarPanel()}<button class="text-button" data-action="open-export">Descargar turnos en .ics ${ic('download')}</button></section><section class="install-card"><div>${ic('flower-2')}<h3>Un sitio en tu iPhone</h3></div><p>Abre ZuriHorario en Safari, toca Compartir y elige «Añadir a pantalla de inicio». Tus jornadas también se guardan sin conexión.</p><button class="secondary" data-action="install">${ic('download')} Instalar ZuriHorario</button></section><section class="local-card"><span>${ic('heart')}</span><h3>Tu tiempo se queda contigo</h3><p>Sin cuotas, sin cuentas y sin una base de datos en la nube. Solo se envían a Google los turnos que tú elijas exportar.</p></section></div></div>`;
}
function openDialog(content:string){if(!dialog.open)dirtyBeforeDialog=dirty;dialog.innerHTML=content;dialog.showModal();paintIcons();bindForm(dialog);}
const dialogHeader=(title:string,sub:string)=>`<div class="dialog-header"><div><p class="eyebrow">UN MOMENTO PARA TI</p><h2 id="dialog-title">${title}</h2><p class="muted">${sub}</p></div><button type="button" data-close class="icon-button" aria-label="Cerrar">${ic('x')}</button></div>`;
function openActual(date:string){
  if(date>today())return;
  const entry=store.data.entries[date];
  openDialog(`${dialogHeader('Tu jornada',esc(formatDate(date)))}<form id="dialog-entry-form" data-date="${date}">${sessionRows(entry?.sessions??[defaultSession(date)])}<button type="button" class="add-session" data-action="add-session">${ic('plus')} Añadir otro tramo</button><label class="note-label" for="dialog-note">Una nota <span>(opcional)</span></label><textarea id="dialog-note" name="note" maxlength="500" rows="2">${esc(entry?.note??'')}</textarea><div class="entry-total"><span>Total trabajado</span><strong id="live-total">${safeTotal(entry?.sessions??[defaultSession(date)])}</strong></div><p class="form-error" role="alert"></p><button class="primary full" type="submit">${ic('check')} Guardar jornada</button>${entry?`<button class="danger-button" type="button" data-action="delete-entry" data-date="${date}">${ic('trash-2')} Eliminar registro</button>`:''}</form>`);
}
function openPlan(){const p=store.data.plans[selected];openDialog(`${dialogHeader(p?'Editar turno':'Un nuevo turno','Organiza el día, a tu ritmo.')}<form id="plan-form"><label for="plan-date">Día del turno</label><input id="plan-date" name="date" type="date" value="${selected}" required /><label for="plan-title">Nombre del turno</label><input id="plan-title" name="title" maxlength="80" value="${esc(p?.title??'Trabajo')}" required />${sessionRows([p??defaultSession(selected)])}<label for="repeat">Repetir este turno</label><select id="repeat" name="repeat"><option value="none">Solo este día</option><option value="weekdays">De lunes a viernes hasta fin de mes</option><option value="weekly">El mismo día de la semana hasta fin de mes</option></select><p class="field-help">La repetición solo añade días sin turno; conserva los que ya tenías.</p><p class="form-error" role="alert"></p><button type="submit" class="primary full">${ic('check')} Guardar turno</button>${p?`<button class="danger-button" type="button" data-action="delete-plan" data-date="${selected}">${ic('trash-2')} Eliminar este turno</button>`:''}</form>`);}
function confirmDialog(title:string,message:string,action:()=>void|Promise<void>){openDialog(`${dialogHeader(esc(title),esc(message))}<div class="dialog-actions"><button class="secondary" data-close>Cancelar</button><button class="primary" id="confirm-action">Continuar</button></div><p class="form-error" role="alert"></p>`);dialog.querySelector('#confirm-action')!.addEventListener('click',async()=>{try{await action();dialog.close();render();}catch(e){dialog.querySelector('.form-error')!.textContent=errorMessage(e);}});}
function bind(){
  bindForm(app);
  app.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.addEventListener('click',()=>{if(dirty){confirmDialog('Tienes cambios sin guardar','Si cambias de pantalla, se descartarán los cambios del formulario.',()=>{dirty=false;navigate(b.dataset.view as typeof view);});}else navigate(b.dataset.view as typeof view);}));
  app.querySelectorAll<HTMLButtonElement>('[data-day]').forEach(b=>b.addEventListener('click',()=>{selected=b.dataset.day!;if(!selected.startsWith(month)){month=selected.slice(0,7);events=[];}render();}));
  app.querySelectorAll<HTMLButtonElement>('[data-entry-date]').forEach(b=>b.addEventListener('click',()=>openActual(b.dataset.entryDate!)));
  app.querySelector('#entry-date')?.addEventListener('change',e=>{const date=(e.target as HTMLInputElement).value;if(!date)return;if(dirty){confirmDialog('Cambiar el día','Se descartarán los cambios sin guardar de esta jornada.',()=>{homeDate=date;dirty=false;render();});}else{homeDate=date;render();}});
  app.querySelector('#calendar-select')?.addEventListener('change',async e=>{try{store.saveSettings({...store.data.settings,calendarId:(e.target as HTMLSelectElement).value});events=[];eventMonth='';await refreshCalendar();}catch(err){calendarError=errorMessage(err);render();}});
  app.querySelector('#override-month')?.addEventListener('change',e=>{const m=(e.target as HTMLInputElement).value;const input=app.querySelector<HTMLInputElement>('#override-goal')!;input.value=String(goalFor(store.data,m)/60||'');});
  app.querySelector('#import')?.addEventListener('change',async e=>{const file=(e.target as HTMLInputElement).files?.[0];if(!file)return;try{if(file.size>2000000)throw new Error('La copia es demasiado grande (máximo 2 MB).');const parsed=JSON.parse(await file.text());confirmDialog('Recuperar tu copia','Se actualizarán la configuración y los días incluidos en esta copia. Los demás registros se conservarán.',async()=>{await store.restore(parsed);toast('Tu copia se ha recuperado.');});}catch(err){toast(errorMessage(err));}});
}
function bindForm(root:ParentNode){
  root.querySelectorAll<HTMLInputElement>('.weekly-row [name=working]').forEach(input=>input.addEventListener('change',()=>{const row=input.closest('.weekly-row')!;row.classList.toggle('rest-day',!input.checked);row.querySelectorAll<HTMLInputElement>('.weekly-times input').forEach(i=>i.disabled=!input.checked);}));
  root.querySelectorAll<HTMLFormElement>('form').forEach(form=>{
    form.addEventListener('input',e=>{if((e.target as HTMLInputElement).id==='entry-date')return;dirty=true;const total=form.querySelector('#live-total');if(total)total.textContent=safeTotal(readSessions(form));});
    form.addEventListener('submit',async e=>{e.preventDefault();try{
      const f=new FormData(form);
      if(form.id==='entry-form'||form.id==='dialog-entry-form'){
        const date=String(f.get('date')??form.dataset.date);if(date>today())throw new Error('Las horas reales solo se pueden registrar hasta hoy.');
        const sessions=readSessions(form);validateSessions(sessions);dirty=false;store.saveEntry({date,sessions,note:String(f.get('note')??'')});dialog.close();render();toast('Jornada guardada. Un paso más, a tu ritmo.');
      }else if(form.id==='settings-form'){
        dirty=false;store.saveSettings({...store.data.settings,name:String(f.get('name')).trim(),defaultGoal:Math.round(Number(f.get('goal'))*60)});render();toast('Tu configuración está guardada.');
      }else if(form.id==='override-form'){
        const m=String(f.get('month'));dirty=false;store.saveSettings({...store.data.settings,goals:{...store.data.settings.goals,[m]:Math.round(Number(f.get('goal'))*60)}});render();toast('Objetivo de ese mes guardado.');
      }else if(form.id==='week-form'){
        const weeks=Number(f.get('weeks')),plans:Plan[]=[];
        form.querySelectorAll<HTMLElement>('.weekly-row').forEach(row=>{
          if(!row.querySelector<HTMLInputElement>('[name=working]')!.checked)return;
          const session={start:row.querySelector<HTMLInputElement>('[name=start]')!.value,end:row.querySelector<HTMLInputElement>('[name=end]')!.value,breakMinutes:Number(row.querySelector<HTMLInputElement>('[name=break]')!.value),nextDay:row.querySelector<HTMLInputElement>('[name=nextDay]')!.checked};
          try{sessionMinutes(session);}catch(e){throw new Error(`${formatDate(row.dataset.date!,{weekday:'long'})}: ${errorMessage(e)}`);}
          for(let w=0;w<weeks;w++)plans.push({...session,date:addDays(row.dataset.date!,w*7),title:String(f.get('title')).trim()});
        });
        const start=weekStart;
        const save=()=>{dirty=false;store.saveWeeks(start,plans,weeks);render();toast(`${weeks===1?'Semana guardada':`${weeks} semanas guardadas`}. Ya puedes exportar tus turnos.`);};
        const existing=weeks>1?Object.keys(store.data.plans).filter(date=>date>=addDays(start,7)&&date<=addDays(start,weeks*7-1)).length:0;
        if(existing)confirmDialog('Actualizar las próximas semanas',`Se reemplazarán ${existing} turnos que ya tenías en las semanas siguientes. Los descansos también se actualizarán.`,save);else save();
      }else if(form.id==='export-form'){
        const plans=exportPlans(form);if(!plans.length)throw new Error('No hay turnos guardados en estas fechas.');
        const method=(e as SubmitEvent).submitter as HTMLButtonElement;
        if(method.value==='ics'){
          download(`ZuriHorario-turnos-${String(f.get('from'))}.ics`,exportICS(plans,store.data.settings.namespace),'text/calendar;charset=utf-8');dirty=false;toast('Tus turnos se han descargado.');
        }else{
          const target=String(f.get('calendar')??'');if(!target)throw new Error('Elige el calendario de destino.');
          exporting=true;form.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.disabled=true);
          try{await exportGoogle(plans,target,store.data.settings.namespace,n=>method.textContent=`Exportando ${n} de ${plans.length}…`);dirty=false;toast(`${plans.length} turnos exportados a Google Calendar.`);dialog.close();events=[];eventMonth='';}
          finally{exporting=false;form.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.disabled=false);method.textContent='Exportar a Google Calendar';}
        }
      }else if(form.id==='plan-form'){
        const date=String(f.get('date'));const s=readSessions(form)[0];sessionMinutes(s);const title=String(f.get('title')).trim();
        const plans:Plan[]=[{...s,date,title}];let next=addDays(date,1);
        while(next.slice(0,7)===date.slice(0,7)){
          const weekday=parseDate(next).getDay();if(!store.data.plans[next] && ((f.get('repeat')==='weekdays' && weekday>0 && weekday<6) || (f.get('repeat')==='weekly' && weekday===parseDate(date).getDay())))plans.push({...s,date:next,title});next=addDays(next,1);
        }
        dirty=false;store.savePlans(plans);selected=date;month=date.slice(0,7);dialog.close();render();toast(plans.length>1?`${plans.length} turnos guardados.`:'Turno guardado.');
      }
    }catch(err){form.querySelector('.form-error')!.textContent=errorMessage(err);}});
  });
  root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(b=>b.addEventListener('click',()=>void action(b)));
  root.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>dialog.close()));
  root.querySelectorAll<HTMLButtonElement>('.remove-session').forEach(b=>b.addEventListener('click',()=>{const form=b.closest('form')!;b.closest('fieldset')!.remove();dirty=true;const total=form.querySelector('#live-total');if(total)total.textContent=safeTotal(readSessions(form));}));
}
function navigate(next:typeof view){view=next;location.hash={home:'inicio',calendar:'calendario',settings:'configuracion'}[next];render();window.scrollTo({top:0,behavior:'smooth'});}
async function refreshCalendar(){
  if(!store.data.settings.calendarId)return;
  loadingCalendar=true;calendarError='';render();
  const generation=++googleGeneration,requestedMonth=month,requestedCalendar=store.data.settings.calendarId;
  try{const result=await loadEvents(requestedCalendar,requestedMonth);if(generation!==googleGeneration)return;events=result;eventMonth=requestedMonth;eventCalendar=requestedCalendar;}
  catch(e){if(generation===googleGeneration){calendarError=errorMessage(e);events=[];eventMonth='';}}
  finally{if(generation===googleGeneration){loadingCalendar=false;render();}}
}
async function action(button:HTMLButtonElement){
  const a=button.dataset.action;
  try{
    if(a==='week-view'||a==='month-view'){
      if(dirty){toast('Guarda la semana antes de cambiar de vista.');return;}calendarMode=a==='week-view'?'week':'month';render();
    }else if(a==='prev-week'||a==='next-week'||a==='current-week'){
      if(dirty){toast('Guarda la semana antes de cambiar de fecha.');return;}
      weekStart=a==='current-week'?addDays(today(),-(parseDate(today()).getDay()+6)%7):addDays(weekStart,a==='prev-week'?-7:7);render();
    }else if(a==='copy-previous-week'){
      const form=app.querySelector<HTMLFormElement>('#week-form')!;
      form.querySelectorAll<HTMLElement>('.weekly-row').forEach(row=>{
        const previous=store.data.plans[addDays(row.dataset.date!,-7)];const working=row.querySelector<HTMLInputElement>('[name=working]')!;working.checked=!!previous;working.dispatchEvent(new Event('change'));
        if(previous){row.querySelector<HTMLInputElement>('[name=start]')!.value=previous.start;row.querySelector<HTMLInputElement>('[name=end]')!.value=previous.end;row.querySelector<HTMLInputElement>('[name=break]')!.value=String(previous.breakMinutes);row.querySelector<HTMLInputElement>('[name=nextDay]')!.checked=previous.nextDay;}
      });dirty=true;toast('Semana anterior copiada. Revisa los horarios y guarda.');
    }else if(a==='open-export'){
      if(dirty){toast('Guarda tus turnos antes de exportarlos.');return;}openExport();
    }else if(a==='prev-month'||a==='next-month'){
      if(dirty){toast('Guarda los cambios de tu jornada antes de cambiar de mes.');return;}
      const d=parseDate(`${month}-01`);d.setMonth(d.getMonth()+(a==='prev-month'?-1:1));month=monthKey(d);selected=`${month}-01`;events=[];calendarError='';render();if(google.calendarConnected()&&store.data.settings.calendarId)await refreshCalendar();
    }else if(a==='go-today'){month=monthKey();selected=today();events=[];render();if(google.calendarConnected())await refreshCalendar();}
    else if(a==='new-plan')openPlan();
    else if(a==='edit-actual')openActual(selected);
    else if(a==='add-session'){
      const form=button.closest('form')!,container=form.querySelector('.session-rows')!;if(container.children.length>=12){toast('Puedes añadir hasta 12 tramos.');return;}
      container.insertAdjacentHTML('beforeend',sessionRow({start:'17:00',end:'20:00',breakMinutes:0,nextDay:false},container.children.length));
      const row=container.lastElementChild!;row.querySelector('.remove-session')?.addEventListener('click',()=>{row.remove();dirty=true;form.querySelector('#live-total')!.textContent=safeTotal(readSessions(form));});
      row.querySelectorAll('input').forEach(i=>i.addEventListener('input',()=>{dirty=true;form.querySelector('#live-total')!.textContent=safeTotal(readSessions(form));}));
      dirty=true;form.querySelector('#live-total')!.textContent=safeTotal(readSessions(form));paintIcons();
    }else if(a==='delete-entry'||a==='delete-plan'){
      const date=button.dataset.date!;dialog.close();confirmDialog(a==='delete-entry'?'Eliminar la jornada':'Eliminar el turno','Se eliminará solo este día. Esta acción no se puede deshacer.',()=>{if(a==='delete-entry')store.removeEntry(date);else store.removePlan(date);dirty=false;toast('Se ha eliminado.');});
    }else if(a==='connect-calendar'){
      button.disabled=true;
      if(!google.calendarConnected())await google.connectCalendar();
      calendars=await listCalendars();calendarError='';
      if(store.data.settings.calendarId&&!calendars.some(c=>c.id===store.data.settings.calendarId))store.saveSettings({...store.data.settings,calendarId:''});
      if(dialog.querySelector('#export-form')){const form=dialog.querySelector<HTMLFormElement>('#export-form')!;const f=new FormData(form);openExport(String(f.get('from')),String(f.get('to')));return;}
      // Explicit selection prevents counting a personal calendar as a work calendar.
      render();if(store.data.settings.calendarId)await refreshCalendar();
    }else if(a==='disconnect-calendar'){google.disconnectCalendar();store.saveSettings({...store.data.settings,calendarId:''});googleGeneration++;events=[];calendars=[];eventMonth='';calendarError='';loadingCalendar=false;render();}
    else if(a==='reset-override'){const m=app.querySelector<HTMLInputElement>('#override-month')!.value;const goals={...store.data.settings.goals};delete goals[m];dirty=false;store.saveSettings({...store.data.settings,goals});render();toast('Este mes usa el objetivo fijo.');}
    else if(a==='export')download(`ZuriHorario-${today()}.json`,JSON.stringify(store.data,null,2),'application/json');
    else if(a==='csv')exportCSV();
    else if(a==='install'){
      if(installEvent){await installEvent.prompt();const choice=await installEvent.userChoice;if(choice.outcome==='accepted')toast('ZuriHorario ya tiene un sitio contigo.');installEvent=null;}
      else openDialog(`${dialogHeader('ZuriHorario en tu móvil','Siempre a mano, al terminar tu día.')}<div class="install-instructions"><p><b>En iPhone o iPad</b><br>Abre esta app en Safari, toca Compartir y elige «Añadir a pantalla de inicio».</p><p><b>En Android</b><br>Abre el menú de Chrome y elige «Instalar aplicación» o «Añadir a pantalla de inicio».</p><p><b>En el ordenador</b><br>Usa el icono de instalación de la barra de direcciones o la opción de instalar del navegador.</p><p class="muted">Si ya está instalada, ábrela desde su icono.</p><button class="primary full" data-close>Entendido</button></div>`);
    }else if(a==='update'){if(dirty){toast('Guarda tus cambios antes de actualizar.');return;}await updateSW(true);}
  }catch(e){if(a==='connect-calendar'){calendarError=errorMessage(e);render();}else toast(errorMessage(e));}
  finally{if(button.isConnected)button.disabled=false;}
}
function download(name:string,content:string,type:string){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportCSV(){
  const cell=(s:unknown)=>{let value=String(s);if(/^[=+\-@\t\r]/.test(value))value=`'${value}`;return `"${value.replace(/"/g,'""')}"`;};
  const rows=[['Fecha','Entrada','Salida','Al día siguiente','Pausa (min)','Trabajado (min)','Nota']];
  Object.values(store.data.entries).filter(e=>e.date.startsWith(month)).sort((a,b)=>a.date.localeCompare(b.date)).forEach(e=>e.sessions.forEach(s=>rows.push([e.date,s.start,s.end,s.nextDay?'Sí':'No',String(s.breakMinutes),String(sessionMinutes(s)),e.note])));
  download(`ZuriHorario-${month}.csv`,'\uFEFF'+rows.map(r=>r.map(cell).join(';')).join('\r\n'),'text/csv;charset=utf-8');toast('Tu resumen del mes se ha descargado.');
}
store.subscribe(()=>{
  if(dirty||dialog.open){app.querySelectorAll('.sync-label').forEach(el=>el.textContent=syncLabel());return;}
  render();
});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvent=e as typeof installEvent;});
window.addEventListener('online',()=>{if(!dirty)render();});window.addEventListener('offline',()=>{if(!dirty)render();});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
window.addEventListener('hashchange',()=>{const next=location.hash==='#calendario'?'calendar':location.hash==='#configuracion'?'settings':'home';if(next!==view){if(dirty){toast('Guarda los cambios antes de cambiar de pantalla.');history.replaceState(null,'',`#${{home:'inicio',calendar:'calendario',settings:'configuracion'}[view]}`);}else{view=next;render();}}});
dialog.addEventListener('close',()=>{dirty=dirtyBeforeDialog;});
dialog.addEventListener('cancel',e=>{if(exporting)e.preventDefault();});
dialog.addEventListener('click',e=>{if(!exporting&&e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
view=location.hash==='#calendario'?'calendar':location.hash==='#configuracion'?'settings':'home';render();

void google.prepareGoogle().catch(()=>{});
void navigator.storage?.persist?.().catch(()=>{});
