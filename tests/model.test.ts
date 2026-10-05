import { describe, it, expect } from 'vitest';
import { addDays, duration, emptyData, entryMinutes, monthStats, sessionMinutes, validDate, validateData, validateSessions } from '../src/model';
const day={start:'09:00',end:'17:00',breakMinutes:30,nextDay:false};
describe('Horas trabajadas',()=>{
  it('descuenta las pausas sin redondear a horas',()=>expect(sessionMinutes(day)).toBe(450));
  it('suma una jornada partida',()=>expect(entryMinutes({date:'2026-10-05',note:'',sessions:[{...day,end:'13:00',breakMinutes:15},{...day,start:'15:00',end:'19:00',breakMinutes:0}]})).toBe(465));
  it('calcula un turno nocturno atribuido al día de entrada',()=>expect(sessionMinutes({...day,start:'22:00',end:'06:00',nextDay:true})).toBe(450));
  it('no interpreta una salida anterior como un turno de noche sin confirmarlo',()=>expect(()=>sessionMinutes({...day,start:'22:00',end:'06:00'})).toThrow());
  it('rechaza pausas mayores que el turno y minutos decimales',()=>{expect(()=>sessionMinutes({...day,breakMinutes:481})).toThrow();expect(()=>sessionMinutes({...day,breakMinutes:1.5})).toThrow();});
  it('rechaza solapamientos y permite tramos consecutivos',()=>{expect(()=>validateSessions([day,{...day,start:'16:00',end:'18:00'}])).toThrow('solapan');expect(()=>validateSessions([day,{...day,start:'17:00',end:'19:00'}])).not.toThrow();});
  it('rechaza formatos de hora y fechas imposibles',()=>{expect(()=>sessionMinutes({...day,start:'25:00'})).toThrow();expect(validDate('2026-02-30')).toBe(false);expect(validDate('2028-02-29')).toBe(true);});
  it('muestra horas y minutos de forma legible',()=>{expect(duration(450)).toBe('7 h 30 min');expect(duration(480)).toBe('8 h');});
});
describe('Objetivos y calendario',()=>{
  it('separa horas previstas y reales, y usa la excepción del mes',()=>{const data=emptyData();data.settings.defaultGoal=9600;data.settings.goals['2026-10']=9000;data.entries['2026-10-05']={date:'2026-10-05',sessions:[day],note:''};data.entries['2026-09-30']={date:'2026-09-30',sessions:[day],note:''};data.plans['2026-10-06']={...day,date:'2026-10-06',title:'Trabajo'};expect(monthStats(data,'2026-10')).toMatchObject({worked:450,planned:450,goal:9000,remaining:8550,days:1,percent:5});});
  it('muestra el exceso sin horas pendientes negativas',()=>{const data=emptyData();data.settings.defaultGoal=300;data.entries['2026-10-05']={date:'2026-10-05',sessions:[day],note:''};expect(monthStats(data,'2026-10')).toMatchObject({remaining:0,extra:150,percent:150});});
  it('cambia de mes y año sin perder el día',()=>{expect(addDays('2026-12-31',1)).toBe('2027-01-01');expect(addDays('2026-03-01',-1)).toBe('2026-02-28');});
  it('valida las copias y elimina propiedades ajenas',()=>{expect(validateData({...emptyData(),unexpected:'test'})).not.toHaveProperty('unexpected');expect(()=>validateData({version:2})).toThrow();const d=emptyData();d.entries['2026-02-30']={date:'2026-02-30',sessions:[day],note:''};expect(()=>validateData(d)).toThrow();});
});
