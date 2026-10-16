import assert from 'node:assert/strict';
import { test } from 'node:test';
import { snapshotsDemo } from './demo.js';
import { diaLocal, ehGasto, gastoPorLugar, lugarNoMomento, mercadoDespensa, momentoTransacao, montarPainel, estadias } from './metrics.js';
import type { RetroFinData, RoutineData } from './types.js';

const T = (s: string) => Date.parse(s);

test('momentoTransacao usa data + hora no fuso de BH', () => {
  const t = momentoTransacao({ id: 'a', date: '2026-10-10', time: '12:30', description: 'x', amount: -1, category: 'c' });
  assert.equal(t, T('2026-10-10T15:30:00Z'));
});

test('momentoTransacao ignora createdAt de outro dia (extrato importado)', () => {
  const t = momentoTransacao({ id: 'a', date: '2026-10-01', createdAt: '2026-10-10T15:00:00Z', description: 'x', amount: -1, category: 'c' });
  assert.equal(t, null);
});

test('diaLocal vira o dia às 03:00 UTC', () => {
  assert.equal(diaLocal(T('2026-10-11T02:59:00Z')), '2026-10-10');
  assert.equal(diaLocal(T('2026-10-11T03:00:00Z')), '2026-10-11');
});

test('ehGasto exclui transferência entre contas próprias', () => {
  assert.equal(ehGasto({ id: 'a', date: '2026-10-01', description: 'Transferência Inter → Nubank', amount: -100, category: 'Transferências' }), false);
  assert.equal(ehGasto({ id: 'b', date: '2026-10-01', description: 'Padaria', amount: -10, category: 'Alimentação & Mercado' }), true);
});

const rotina: RoutineData = {
  lugares: [
    { id: 'casa', nome: 'Casa', categoria: 'casa', latitude: 0, longitude: 0, raio: 100 },
    { id: 'trab', nome: 'Trabalho', categoria: 'trabalho', latitude: 1, longitude: 1, raio: 100 },
  ],
  registros: [
    { id: '1', lugarId: 'casa', latitude: 0, longitude: 0, inicio: T('2026-10-10T09:00:00Z'), fim: T('2026-10-10T11:00:00Z') },
    { id: '2', lugarId: 'trab', latitude: 1, longitude: 1, inicio: T('2026-10-10T11:30:00Z'), fim: T('2026-10-10T20:00:00Z') },
    { id: '3', lugarId: null, latitude: 2, longitude: 2, inicio: T('2026-10-10T21:00:00Z'), fim: T('2026-10-10T23:00:00Z') },
  ],
};

test('lugarNoMomento aceita tolerância de 10 min após sair', () => {
  const lista = estadias(rotina, T('2026-10-11T00:00:00Z'));
  assert.equal(lugarNoMomento(lista, T('2026-10-10T11:05:00Z'))?.nome, 'Casa');
  assert.equal(lugarNoMomento(lista, T('2026-10-10T11:15:00Z')), null);
});

test('gastoPorLugar cruza horário da compra com a estadia', () => {
  const fin: RetroFinData = {
    accounts: [],
    categories: [],
    transactions: [
      { id: 'a', date: '2026-10-10', time: '09:00', description: 'Restaurante', amount: -30, category: 'Alimentação' }, // 12:00Z → trabalho
      { id: 'b', date: '2026-10-10', time: '10:00', description: 'Restaurante', amount: -20, category: 'Alimentação' }, // 13:00Z → trabalho
      { id: 'c', date: '2026-10-10', time: '19:00', description: 'Bar', amount: -60, category: 'Lazer' }, // 22:00Z → desconhecido
      { id: 'd', date: '2026-10-10', time: '17:40', description: 'Uber', amount: -15, category: 'Transporte' }, // 20:40Z → trânsito
      { id: 'e', date: '2026-10-10', description: 'Conta de luz', amount: -100, category: 'Contas' }, // sem horário
      { id: 'f', date: '2026-10-10', time: '10:00', description: 'Salário', amount: 5000, category: 'Renda' },
    ],
  };
  const g = gastoPorLugar(fin, rotina, T('2026-10-01T00:00:00Z'), T('2026-10-11T00:00:00Z'));
  assert.equal(g.linhas[0].nome, 'Lugar não cadastrado (2.000,2.000)');
  const trab = g.linhas.find((l) => l.chave === 'trab')!;
  assert.equal(trab.total, 50);
  assert.equal(trab.qtd, 2);
  assert.equal(g.linhas.find((l) => l.chave === 'transito')?.total, 15);
  assert.deepEqual(g.semHorario, { qtd: 1, total: 100 });
  assert.equal(g.totalAnalisado, 225);
  assert.equal(g.cobertura, Math.round((110 / 225) * 100));
});

test('mercadoDespensa concilia nota fiscal com a compra no banco', () => {
  const fin: RetroFinData = {
    accounts: [],
    categories: [],
    transactions: [{ id: 'a', date: '2026-10-10', time: '10:00', description: 'Supermercado BH', amount: -152.37, category: 'Alimentação & Mercado' }],
  };
  const m = mercadoDespensa(fin, { notas: [{ chave: 'n', emitente: 'BH', data: '2026-10-10T09:58:00-03:00', total: 152.37 }], lotes: [] }, T('2026-10-01T00:00:00Z'), T('2026-10-12T00:00:00Z'))!;
  assert.equal(m.notasConciliadas, 1);
  assert.equal(m.meses[0].financeiro, 152.37);
});

test('painel com dados de exemplo não quebra e localiza a maior parte dos gastos', () => {
  const agora = T('2026-10-16T15:00:00Z');
  const p = montarPainel(snapshotsDemo(agora), agora);
  assert.ok(p.gastoPorLugar30d.linhas.length >= 4);
  assert.ok(p.gastoPorLugar30d.cobertura > 60, `cobertura ${p.gastoPorLugar30d.cobertura}`);
  assert.ok(p.academia30d && p.academia30d.diasComTreino > 0);
  assert.ok(p.mercado90d && p.mercado90d.notasConciliadas >= 1);
  assert.equal(p.estudo8s.length, 8);
});
