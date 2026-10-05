import { describe, it, expect, vi } from 'vitest';
vi.mock('../src/google',()=>({googleGet:vi.fn()}));
import { splitEvents } from '../src/calendar';
describe('Eventos previstos de Google',()=>{
  it('divide turnos nocturnos entre días',()=>{
    const result=splitEvents([{id:'night',summary:'Noche',start:{dateTime:'2026-10-05T22:00:00+02:00'},end:{dateTime:'2026-10-06T06:00:00+02:00'}}],'2026-10');
    expect(result.map(e=>[e.date,e.minutes])).toEqual([['2026-10-05',120],['2026-10-06',360]]);
  });
  it('recorta al mes visible y respeta el final exclusivo de eventos de todo el día',()=>{
    const result=splitEvents([{id:'holiday',start:{date:'2026-09-30'},end:{date:'2026-10-03'}}],'2026-10');
    expect(result.map(e=>e.date)).toEqual(['2026-10-01','2026-10-02']);
    expect(result.every(e=>e.minutes===0&&e.allDay)).toBe(true);
  });
  it('evita contar horas fantasma en cambios de horario de verano',()=>{
    const result=splitEvents([{id:'dst',start:{dateTime:'2026-10-25T01:00:00+02:00'},end:{dateTime:'2026-10-25T04:00:00+01:00'}}],'2026-10');
    expect(result[0].minutes).toBe(240);
  });
  it('omite eventos cancelados y evita un día extra a medianoche',()=>{
    const result=splitEvents([{id:'cancelled',status:'cancelled',start:{date:'2026-10-05'},end:{date:'2026-10-06'}},{id:'midnight',start:{dateTime:'2026-10-05T20:00:00+02:00'},end:{dateTime:'2026-10-06T00:00:00+02:00'}}],'2026-10');
    expect(result).toHaveLength(1);expect(result[0].minutes).toBe(240);
  });
});
