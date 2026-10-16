import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lerIcs, normalizarLinkAgenda } from './agenda.ts';
import { montarDiasClima } from './clima.ts';

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Google Inc//Google Calendar 70.9054//EN
BEGIN:VTIMEZONE
TZID:America/Sao_Paulo
BEGIN:STANDARD
TZOFFSETFROM:-0300
TZOFFSETTO:-0300
TZNAME:-03
DTSTART:19700101T000000
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
DTSTART;TZID=America/Sao_Paulo:20261005T090000
DTEND;TZID=America/Sao_Paulo:20261005T100000
RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=4
EXDATE;TZID=America/Sao_Paulo:20261012T090000
UID:reuniao@google.com
SUMMARY:Reunião GT Dados
END:VEVENT
BEGIN:VEVENT
DTSTART;TZID=America/Sao_Paulo:20261019T140000
DTEND;TZID=America/Sao_Paulo:20261019T150000
RECURRENCE-ID;TZID=America/Sao_Paulo:20261019T090000
UID:reuniao@google.com
SUMMARY:Reunião GT Dados (remarcada)
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20261010
DTEND;VALUE=DATE:20261011
UID:aniv@google.com
SUMMARY:Aniversário
TRANSP:TRANSPARENT
END:VEVENT
BEGIN:VEVENT
DTSTART:20261007T220000Z
DTEND:20261007T230000Z
UID:cancelado@google.com
STATUS:CANCELLED
SUMMARY:Cancelado
END:VEVENT
END:VCALENDAR`;

test('agenda: repetição, exceção, data excluída, dia inteiro e cancelado', () => {
  const ev = lerIcs(ICS, Date.parse('2026-10-01T00:00:00-03:00'), Date.parse('2026-11-30T00:00:00-03:00'), 'Pessoal');
  const t = ev.map((e) => [new Date(e.inicio).toISOString(), e.titulo]);
  assert.deepEqual(t, [
    ['2026-10-05T12:00:00.000Z', 'Reunião GT Dados'],
    ['2026-10-10T03:00:00.000Z', 'Aniversário'],
    ['2026-10-19T17:00:00.000Z', 'Reunião GT Dados (remarcada)'],
    ['2026-10-26T12:00:00.000Z', 'Reunião GT Dados'],
  ]);
  assert.equal(ev[1].diaInteiro, true);
  assert.equal(ev[1].livre, true);
  assert.equal(ev[0].calendario, 'Pessoal');
});

test('agenda: janela corta eventos fora', () => {
  const ev = lerIcs(ICS, Date.parse('2026-10-20T00:00:00-03:00'), Date.parse('2026-10-27T00:00:00-03:00'));
  assert.equal(ev.length, 1);
});

test('agenda: link webcal vira https e lixo é recusado', () => {
  assert.equal(normalizarLinkAgenda('webcal://calendar.google.com/calendar/ical/x/private-y/basic.ics'), 'https://calendar.google.com/calendar/ical/x/private-y/basic.ics');
  assert.equal(normalizarLinkAgenda('não é link'), null);
});

test('clima: monta os dias do Open-Meteo', () => {
  const d = montarDiasClima({ daily: { time: ['2026-10-15', '2026-10-16'], temperature_2m_max: [31.26, 25], temperature_2m_min: [18, null], precipitation_sum: [0, 12.34], weather_code: [1, 63] } });
  assert.deepEqual(d, [{ dia: '2026-10-15', tMax: 31.3, tMin: 18, chuvaMm: 0, codigo: 1 }]);
});
