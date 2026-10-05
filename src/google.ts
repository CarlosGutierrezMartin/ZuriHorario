const clientId=import.meta.env.VITE_GOOGLE_CLIENT_ID as string|undefined;
export const configured=!!clientId;
const scopes=['https://www.googleapis.com/auth/calendar.events.owned','https://www.googleapis.com/auth/calendar.calendarlist.readonly'];
let token='',expires=0;
interface TokenResponse{access_token?:string;expires_in?:number;error?:string;scope?:string}
interface OAuth{initTokenClient(config:{client_id:string;scope:string;callback:(r:TokenResponse)=>void;error_callback:(e:{type:string})=>void}):{requestAccessToken:()=>void};hasGrantedAllScopes:(response:TokenResponse,...scopes:string[])=>boolean;revoke:(token:string,callback:()=>void)=>void}
declare global{interface Window{google?:{accounts:{oauth2:OAuth}}}}
let scriptReady:Promise<void>|null=null;
export function prepareGoogle(){
  if(!configured)return Promise.resolve();
  if(window.google)return Promise.resolve();
  if(!scriptReady)scriptReady=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.onload=()=>resolve();script.onerror=()=>{scriptReady=null;script.remove();reject(new Error('No se pudo cargar Google. Comprueba tu conexión.'));};document.head.append(script);
  });
  return scriptReady;
}
export const calendarConnected=()=>!!token&&Date.now()<expires;
export async function connectCalendar(){
  if(!configured)throw new Error('La exportación directa a Google aún no está activada. Puedes descargar tus turnos como archivo de calendario.');
  if(!window.google){await prepareGoogle();throw new Error('Google está listo. Toca «Conectar Google Calendar» de nuevo para abrir su ventana.');}
  const oauth=window.google.accounts.oauth2;
  await new Promise<void>((resolve,reject)=>{
    const client=oauth.initTokenClient({client_id:clientId!,scope:scopes.join(' '),callback(response){
      if(response.error||!response.access_token){reject(new Error('Google no ha autorizado el acceso al calendario.'));return;}
      if(!oauth.hasGrantedAllScopes(response,...scopes)){reject(new Error('Para exportar, permite el acceso a la lista de calendarios y a sus eventos.'));return;}
      token=response.access_token;expires=Date.now()+Math.max(0,(response.expires_in??3600)-60)*1000;resolve();
    },error_callback(error){reject(new Error(error.type==='popup_closed'?'Has cerrado la ventana de Google. Puedes volver a intentarlo.':'Permite las ventanas emergentes y vuelve a conectar Google Calendar.'));}});
    client.requestAccessToken();
  });
}
export function disconnectCalendar(){if(token)window.google?.accounts.oauth2.revoke(token,()=>{});token='';expires=0;}
export class GoogleError extends Error{constructor(message:string,public status:number){super(message);}}
export async function googleGet<T>(path:string,method='GET',body?:unknown):Promise<T>{
  if(!calendarConnected())throw new Error('Conecta Google Calendar para continuar.');
  const response=await fetch(`https://www.googleapis.com/calendar/v3/${path}`,{method,headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
  if(response.status===401){token='';throw new GoogleError('El permiso temporal ha caducado. Vuelve a conectar Google Calendar.',401);}
  if(!response.ok)throw new GoogleError(response.status===403?'Google no ha permitido acceder al calendario. Comprueba los permisos y que Calendar API esté activada.':response.status===429?'Google ha limitado las solicitudes. Espera un momento y vuelve a intentarlo.':'No se pudo completar la operación de calendario. Inténtalo de nuevo.',response.status);
  return response.json() as Promise<T>;
}
