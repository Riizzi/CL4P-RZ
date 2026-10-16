import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { montarContexto } from '../../src/core/context.js';
import { snapshotsDemo } from '../../src/core/demo.js';

process.env.CL4P_TOKEN = 'chave-de-teste-com-mais-de-32-caracteres-123';
const { chaveDoApp, cifrar, decifrar } = await import('./cripto.js');

test('chave do app é o mesmo HMAC que o navegador calcula', async () => {
  const esperado = createHmac('sha256', process.env.CL4P_TOKEN!).update('cl4p-app:retrofin').digest('base64url');
  assert.equal(chaveDoApp('retrofin'), esperado);
  // mesma conta com WebCrypto (é o que o hub faz em services/config.ts)
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(process.env.CL4P_TOKEN!), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = Buffer.from(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode('cl4p-app:retrofin'))).toString('base64url');
  assert.equal(sig, esperado);
  assert.notEqual(chaveDoApp('retrofin'), chaveDoApp('wishwatch'));
});

test('dados ficam cifrados e só abrem com a mesma chave', () => {
  const c = cifrar('{"segredo":42}');
  assert.ok(c.startsWith('enc1:') && !c.includes('segredo'));
  assert.equal(decifrar(c), '{"segredo":42}');
  assert.notEqual(cifrar('x'), cifrar('x'), 'IV aleatório');
  process.env.CL4P_TOKEN = 'outra-chave-qualquer-com-mais-de-32-caracteres';
  assert.equal(decifrar(c), null);
  process.env.CL4P_TOKEN = 'chave-de-teste-com-mais-de-32-caracteres-123';
});

test('contexto do chat não leva coordenadas nem nomes de pessoas; resumo não leva a lista de lançamentos', () => {
  const s = snapshotsDemo(Date.parse('2026-10-16T15:00:00Z'));
  s.retrofin!.data.transactions.push({ id: 'p', date: '2026-10-15', time: '10:00', description: 'Pix para Maria Silva', amount: -50, category: 'outros' });
  const resumo = montarContexto(s, Date.parse('2026-10-16T15:00:00Z'), 'resumo');
  const det = montarContexto(s, Date.parse('2026-10-16T15:00:00Z'), 'detalhado');
  for (const t of [resumo, det]) {
    assert.ok(!/-19\.\d{3}/.test(t), 'sem coordenadas');
    assert.ok(!t.includes('Maria Silva'), 'sem nome de pessoa');
  }
  assert.ok(resumo.includes('Lugar não cadastrado nº 1'));
  assert.ok(!resumo.includes('TRANSAÇÕES DOS ÚLTIMOS 60 DIAS'));
  assert.ok(det.includes('TRANSAÇÕES DOS ÚLTIMOS 60 DIAS'));
});
