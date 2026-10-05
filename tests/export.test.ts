import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../src/google',async importOriginal=>({...await importOriginal<typeof import('../src/google')>(),googleGet:vi.fn()}));
import { exportICS, exportGoogle, exportEventId, googleEventBody } from '../src/export';
import { googleGet, GoogleError } from '../src/google';
const p={date:'2026-10-05',title:'Trabajo',start:'09:00',end:'17:00',breakMinutes:30,nextDay:false};
const namespace='f2250510-5eaa-4fcd-bf65-3294654083cf';
beforeEach(()=>vi.mocked(googleGet).mockReset());
describe('Exportación de horarios',()=>{
  it('exporta .ics válido con horas UTC, pausa y UID estable',()=>{
    const result=exportICS([p],namespace,new Date('2026-10-01T10:00:00Z'));
    expect(result).toContain('BEGIN:VCALENDAR\r\nVERSION:2.0');
    expect(result).toContain('DTSTART:20261005T070000Z');
    expect(result).toContain('DTEND:20261005T150000Z');
    expect(result).toContain(`UID:${namespace}-2026-10-05@zurihorario`);
    expect(result).toContain('Pausa: 30 min.');expect(result).toContain('7 h 30 min');
  });
  it('mueve el final nocturno al día siguiente y escapa títulos',()=>{
    const result=exportICS([{...p,start:'22:00',end:'06:00',nextDay:true,title:'Turno, noche; A\nB'}],namespace);
    expect(result).toContain('DTEND:20261006T040000Z');expect(result).toContain('SUMMARY:Turno\\, noche\\; A\\nB');
  });
  it('pliega líneas largas por bytes sin romper Unicode',()=>{
    const result=exportICS([{...p,title:'é'.repeat(80)}],namespace);
    expect(result.split('\r\n').every(line=>new TextEncoder().encode(line).length<=75)).toBe(true);
    expect(result.replace(/\r\n /g,'')).toContain('SUMMARY:'+'é'.repeat(80));
  });
  it('genera un identificador estable permitido por Google',async()=>{
    const a=await exportEventId(namespace,p.date);expect(a).toMatch(/^[0-9a-v]{65}$/);expect(await exportEventId(namespace,p.date)).toBe(a);expect(await exportEventId(namespace,'2026-10-06')).not.toBe(a);
  });
  it('exporta el intervalo completo con la pausa en la descripción',()=>{
    expect(googleEventBody(p)).toMatchObject({summary:'Trabajo',start:{dateTime:'2026-10-05T07:00:00.000Z'},end:{dateTime:'2026-10-05T15:00:00.000Z'}});
    expect(googleEventBody(p).description).toContain('Pausa: 30 min');
  });
  it('actualiza su propio evento cuando una reexportación encuentra el mismo ID',async()=>{
    vi.mocked(googleGet).mockRejectedValueOnce(new GoogleError('Exists',409)).mockResolvedValueOnce({extendedProperties:{private:{source:'zurihorario'}}}).mockResolvedValueOnce({});
    const progress=vi.fn();await exportGoogle([p],'calendar@example.com',namespace,progress);
    expect(vi.mocked(googleGet).mock.calls[2][1]).toBe('PATCH');expect(progress).toHaveBeenCalledWith(1);
  });
  it('no sobrescribe un evento ajeno',async()=>{
    vi.mocked(googleGet).mockRejectedValueOnce(new GoogleError('Exists',409)).mockResolvedValueOnce({});
    await expect(exportGoogle([p],'primary',namespace,()=>{})).rejects.toThrow('ajeno');expect(googleGet).toHaveBeenCalledTimes(2);
  });
  it('informa de una exportación parcial y permite reintentar',async()=>{
    vi.mocked(googleGet).mockResolvedValueOnce({}).mockRejectedValueOnce(new GoogleError('Sin conexión',503));
    await expect(exportGoogle([p,{...p,date:'2026-10-06'}],'primary',namespace,()=>{})).rejects.toThrow('1 de 2');
  });
});
