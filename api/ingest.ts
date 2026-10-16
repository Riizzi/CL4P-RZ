import { APP_IDS, type AppId, type Envelope } from '../src/core/types.js';
import { autorizado, cors, lerCorpo, sendJson } from './_lib/http.js';
import { chaveSnapshot } from './_lib/snapshots.js';
import { set } from './_lib/store.js';

const MAX_BYTES = 3_500_000; // abaixo do limite de 4,5 MB da Vercel

/**
 * POST /api/ingest  { app, schema: 1, generatedAt, data }
 * Cada app manda o retrato completo dos próprios dados; o último substitui o anterior.
 */
export default async function handler(req: any, res: any) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Use POST.' });
  if (!autorizado(req, res)) return;

  const corpo = (await lerCorpo(req)) as Partial<Envelope>;
  const app = corpo.app as AppId;
  if (!APP_IDS.includes(app)) return sendJson(res, 400, { error: `App desconhecido. Use um de: ${APP_IDS.join(', ')}` });
  if (corpo.schema !== 1) return sendJson(res, 400, { error: 'Versão do contrato não suportada (schema deve ser 1).' });
  if (!corpo.data || typeof corpo.data !== 'object') return sendJson(res, 400, { error: 'Campo data ausente.' });

  const env: Envelope = {
    app,
    schema: 1,
    generatedAt: typeof corpo.generatedAt === 'string' ? corpo.generatedAt : new Date().toISOString(),
    receivedAt: new Date().toISOString(),
    data: corpo.data,
  };
  const texto = JSON.stringify(env);
  if (texto.length > MAX_BYTES) return sendJson(res, 413, { error: 'Retrato grande demais. Envie menos histórico.' });

  try {
    await set(chaveSnapshot(app), texto);
    sendJson(res, 200, { ok: true, app, receivedAt: env.receivedAt, bytes: texto.length });
  } catch (err: any) {
    sendJson(res, 502, { error: `Falha ao gravar: ${err?.message || err}` });
  }
}
