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

test('agenda e clima entram no dia e geram achados', () => {
  const dias = 12;
  const inicio = T('2026-10-01T03:00:00Z');
  const eventos = [];
  const clima = [];
  const registros = [];
  const txs = [];
  for (let i = 0; i < dias; i++) {
    const dia = `2026-10-${String(i + 1).padStart(2, '0')}`;
    const cheio = i % 2 === 0;
    const chuva = i % 3 === 0;
    if (cheio) for (const h of [8, 10, 14]) eventos.push({ inicio: T(`${dia}T${String(h).padStart(2, '0')}:00:00-03:00`), fim: T(`${dia}T${String(h + 1).padStart(2, '0')}:00:00-03:00`), diaInteiro: false, titulo: 'Reunião' });
    eventos.push({ inicio: T(`${dia}T00:00:00-03:00`), fim: T(`${dia}T23:59:00-03:00`), diaInteiro: true, titulo: 'Feriado?' });
    clima.push({ dia, tMax: 26, tMin: 17, chuvaMm: chuva ? 10 : 0, codigo: chuva ? 63 : 1 });
    registros.push({ id: dia, ts: T(`${dia}T21:00:00-03:00`), nota: (cheio ? 2 : 4) as 2 | 4 });
    txs.push({ id: dia, date: dia, description: 'iFood', amount: chuva ? -80 : -20, category: 'Delivery' });
  }
  const s: Snapshots = {
    agenda: { app: 'agenda', schema: 1, generatedAt: '', data: { eventos, desde: inicio, ate: inicio + 40 * 86_400_000, calendarios: ['Pessoal'] } },
    clima: { app: 'clima', schema: 1, generatedAt: '', data: { local: 'BH', lat: 0, lon: 0, dias: clima } },
    humor: { app: 'humor', schema: 1, generatedAt: '', data: { registros } },
    retrofin: { app: 'retrofin', schema: 1, generatedAt: '', data: { accounts: [], categories: [], transactions: txs } },
  };
  const ds = montarDias(s, inicio, T('2026-10-12T23:00:00-03:00'));
  assert.equal(ds[0].compromissos, 3); // dia inteiro não conta
  assert.equal(ds[0].primeiroCompromisso, 8);
  assert.equal(ds[1].compromissos, 0);
  assert.equal(ds[0].chuvaMm, 10);
  const textos = achados(ds).map((a) => a.texto).join('\n');
  assert.match(textos, /3 ou mais compromissos/);
  assert.match(textos, /Dia de chuva custa mais/);
});

test('sem agenda, compromissos fica null (não vira "dia livre")', () => {
  const ds = montarDias({}, T('2026-10-01T03:00:00Z'), T('2026-10-02T23:00:00-03:00'));
  assert.equal(ds[0].compromissos, null);
  assert.equal(ds[0].tMax, null);
});
