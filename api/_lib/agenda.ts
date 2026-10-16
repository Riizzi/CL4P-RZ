/**
 * Agenda: lê o "endereço secreto no formato iCal" do Google Agenda (ou de qualquer agenda .ics),
 * expande eventos repetidos e devolve só o que cai na janela pedida.
 */
import ICAL from 'ical.js';
import type { AgendaEvento } from '../../src/core/types.js';

const MAX_EVENTOS = 2500;
const FUSO_LOCAL = '-03:00';

/** Dia inteiro e horário "flutuante" (sem fuso) valem no horário de BH, não no do servidor. */
function ms(t: ICAL.Time): number {
  const flutuante = t.isDate || !t.zone || t.zone.tzid === 'floating';
  if (!flutuante) return t.toJSDate().getTime();
  const p = (n: number) => String(n).padStart(2, '0');
  return Date.parse(`${t.year}-${p(t.month)}-${p(t.day)}T${p(t.hour)}:${p(t.minute)}:${p(t.second)}${FUSO_LOCAL}`);
}
// alto o bastante para um evento diário criado anos atrás chegar até a janela
const MAX_REPETICOES = 20000;

export function lerIcs(texto: string, desde: number, ate: number, calendario?: string): AgendaEvento[] {
  const comp = new ICAL.Component(ICAL.parse(texto));
  for (const tz of comp.getAllSubcomponents('vtimezone')) {
    try {
      ICAL.TimezoneService.register(tz);
    } catch {
      /* fuso repetido ou inválido: segue com o padrão */
    }
  }
  const brutos = comp.getAllSubcomponents('vevent');
  const mestres = new Map<string, ICAL.Event>();
  const excecoes: ICAL.Event[] = [];
  for (const v of brutos) {
    const ev = new ICAL.Event(v);
    if (v.hasProperty('recurrence-id')) excecoes.push(ev);
    else mestres.set(ev.uid || Math.random().toString(36), ev);
  }
  for (const ex of excecoes) {
    const m = mestres.get(ex.uid);
    if (m) m.relateException(ex);
    else mestres.set(`${ex.uid}-${ex.recurrenceId}`, ex);
  }

  const out: AgendaEvento[] = [];
  const add = (ev: ICAL.Event, ini: ICAL.Time, fim: ICAL.Time) => {
    const status = String(ev.component.getFirstPropertyValue('status') || '').toUpperCase();
    if (status === 'CANCELLED') return;
    const inicio = ms(ini);
    const termino = ms(fim);
    if (termino < desde || inicio > ate) return;
    const transp = String(ev.component.getFirstPropertyValue('transp') || '').toUpperCase();
    out.push({
      inicio,
      fim: Math.max(inicio, termino),
      diaInteiro: ini.isDate,
      titulo: (ev.summary || '').trim().slice(0, 120) || 'Compromisso',
      ...(transp === 'TRANSPARENT' ? { livre: true } : {}),
      ...(calendario ? { calendario } : {}),
    });
  };

  for (const ev of mestres.values()) {
    if (out.length >= MAX_EVENTOS) break;
    if (!ev.startDate) continue;
    if (!ev.isRecurring()) {
      add(ev, ev.startDate, ev.endDate || ev.startDate);
      continue;
    }
    const it = ev.iterator();
    let n = 0;
    for (let t = it.next(); t && n < MAX_REPETICOES; t = it.next(), n++) {
      if (ms(t) > ate) break;
      const o = ev.getOccurrenceDetails(t);
      if (ms(o.endDate) < desde) continue;
      const item = o.item as ICAL.Event;
      add(item, o.startDate, o.endDate);
    }
  }
  return out.sort((a, b) => a.inicio - b.inicio).slice(0, MAX_EVENTOS);
}

/** Aceita o link do Google com webcal:// e confere que é um endereço http(s). */
export function normalizarLinkAgenda(bruto: string): string | null {
  const s = (bruto || '').trim().replace(/^webcal:\/\//i, 'https://');
  try {
    const u = new URL(s);
    return /^https?:$/.test(u.protocol) ? u.toString() : null;
  } catch {
    return null;
  }
}
