import assert from 'node:assert/strict';
import { test } from 'node:test';
import { achados, faixaSono, montarBemEstar, montarDias, tipoDoDia, MIN_DIAS } from './bemestar.js';
import { snapshotsDemo } from './demo.js';
import type { Snapshots } from './types.js';

const T = (s: string) => Date.parse(s);
const AGORA = T('2026-10-16T15:00:00Z');

test('tipo do dia pela rotina', () => {
  assert.equal(tipoDoDia({ trabalho: 8, saude: 1 }, true), 'Trabalho + treino');
  assert.equal(tipoDoDia({ trabalho: 8, estudo: 3 }, false), 'Trabalho + UFMG');
  assert.equal(tipoDoDia({ casa: 20 }, false), 'Folga em casa');
  assert.equal(tipoDoDia({ casa: 14, desconhecido: 4 }, false), 'Folga com saída');
});

test('faixas de sono', () => {
  assert.equal(faixaSono(5.9), 'Menos de 6 h');
  assert.equal(faixaSono(6), '6 a 7 h');
  assert.equal(faixaSono(8), '8 h ou mais');
});

test('dia monta humor (média), sono do dia em que acordou, treino do relógio e gasto por impulso', () => {
  const s: Snapshots = {
    humor: { app: 'humor', schema: 1, generatedAt: '', data: { registros: [
      { id: 'a', ts: T('2026-10-15T12:00:00Z'), nota: 2 },
      { id: 'b', ts: T('2026-10-15T23:00:00Z'), nota: 4 },
    ] } },
    saude: { app: 'saude', schema: 1, generatedAt: '', data: {
      dias: [{ dia: '2026-10-15', sonoMin: 330, passos: 9000 }],
      treinos: [{ inicio: T('2026-10-15T21:00:00Z'), fim: T('2026-10-15T21:40:00Z'), tipo: 'running' }],
    } },
    retrofin: { app: 'retrofin', schema: 1, generatedAt: '', data: { accounts: [], categories: [], transactions: [
      { id: '1', date: '2026-10-15', description: 'iFood', amount: -50, category: 'Alimentação & Mercado' },
      { id: '2', date: '2026-10-15', description: 'Cemig', amount: -200, category: 'Contas' },
    ] } },
  };
  const dias = montarDias(s, T('2026-10-15T03:00:00Z'), T('2026-10-16T02:59:00Z'));
  assert.equal(dias.length, 1);
  const d = dias[0];
  assert.equal(d.humor, 3);
  assert.equal(d.sonoH, 5.5);
  assert.equal(d.treinou, true);
  assert.equal(d.gasto, 250);
  assert.equal(d.gastoImpulso, 50);
  assert.equal(d.tipo, 'Dia com treino'); // sem RoutineTracker
});

test('com os dados de exemplo aparecem achados e grupos com tamanho', () => {
  const b = montarBemEstar(snapshotsDemo(AGORA), AGORA);
  assert.ok(b.diasComHumor > 30);
  assert.ok(b.porTipoDia.length >= 3);
  assert.ok(b.porTipoDia.every((g) => g.dias > 0));
  assert.ok(b.achados.length >= 2, JSON.stringify(b.achados));
  const tr = b.treino;
  assert.ok(tr.com.humor! > tr.sem.humor!, 'treino melhora o humor no exemplo');
});

test('sem dias suficientes, nenhum achado', () => {
  const s: Snapshots = { humor: { app: 'humor', schema: 1, generatedAt: '', data: { registros: [{ id: 'a', ts: AGORA - 3600_000, nota: 5 }] } } };
  assert.equal(achados(montarDias(s, AGORA - 10 * 86_400_000, AGORA)).length, 0);
  assert.equal(MIN_DIAS, 3);
});
