import assert from 'node:assert/strict';
import { test } from 'node:test';
import { montarDiasSaude, sessoesDeSono } from './saudeDias.js';

test('sessão de sono com estágios: soma só o tempo dormindo e pertence ao dia em que acordou', () => {
  const amostra = {
    startDate: '2026-10-15T02:00:00Z', // 23:00 em BH, dia 14
    endDate: '2026-10-15T09:30:00Z', // 06:30 em BH, dia 15
    stages: [
      { startDate: '2026-10-15T02:00:00Z', endDate: '2026-10-15T02:20:00Z', stage: 'awake' },
      { startDate: '2026-10-15T02:20:00Z', endDate: '2026-10-15T04:20:00Z', stage: 'light' },
      { startDate: '2026-10-15T04:20:00Z', endDate: '2026-10-15T05:50:00Z', stage: 'deep' },
      { startDate: '2026-10-15T05:50:00Z', endDate: '2026-10-15T07:20:00Z', stage: 'rem' },
      { startDate: '2026-10-15T07:20:00Z', endDate: '2026-10-15T09:30:00Z', stage: 'light' },
    ],
  };
  const [s] = sessoesDeSono([amostra]);
  assert.equal(s.dormindoMin, 430);
  assert.equal(s.profundoMin, 90);
  const dias = montarDiasSaude({ sono: [amostra], passos: [], calorias: [], fcRepouso: [], hrv: [] });
  assert.equal(dias[0].dia, '2026-10-15');
  assert.equal(dias[0].sonoMin, 430);
});

test('trechos separados por menos de 90 min viram uma sessão; cochilo à tarde soma no dia', () => {
  const sessoes = sessoesDeSono([
    { startDate: '2026-10-15T02:00:00Z', endDate: '2026-10-15T05:00:00Z', sleepState: 'asleep' },
    { startDate: '2026-10-15T05:30:00Z', endDate: '2026-10-15T09:00:00Z', sleepState: 'asleep' },
    { startDate: '2026-10-15T17:00:00Z', endDate: '2026-10-15T17:40:00Z', sleepState: 'asleep' },
  ]);
  assert.equal(sessoes.length, 2);
  const dias = montarDiasSaude({
    sono: [
      { startDate: '2026-10-15T02:00:00Z', endDate: '2026-10-15T05:00:00Z', sleepState: 'asleep' },
      { startDate: '2026-10-15T05:30:00Z', endDate: '2026-10-15T09:00:00Z', sleepState: 'asleep' },
      { startDate: '2026-10-15T17:00:00Z', endDate: '2026-10-15T17:40:00Z', sleepState: 'asleep' },
    ],
    passos: [{ startDate: '2026-10-15T03:00:00Z', value: 8421.4 }],
    calorias: [],
    fcRepouso: [{ startDate: '2026-10-15T12:00:00Z', value: 60 }, { startDate: '2026-10-15T13:00:00Z', value: 62 }],
    hrv: [],
  });
  assert.equal(dias[0].sonoMin, 390 + 40);
  assert.equal(dias[0].passos, 8421);
  assert.equal(dias[0].fcRepouso, 61);
  assert.equal(dias[0].acordou, Date.parse('2026-10-15T09:00:00Z'));
});
