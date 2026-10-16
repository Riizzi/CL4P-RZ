import { APP_IDS, type AppId } from '../src/core/types.js';
import { autorizado, cors, sendJson } from './_lib/http.js';
import { carregarSnapshots, chaveSnapshot } from './_lib/snapshots.js';
import { del } from './_lib/store.js';

/**
 * GET    /api/snapshots           → { snapshots } com o último retrato de cada app
 * DELETE /api/snapshots?app=<id>  → apaga o retrato de um app
 */
export default async function handler(req: any, res: any) {
  if (cors(req, res)) return;
  if (!autorizado(req, res)) return;
  try {
    if (req.method === 'GET') return sendJson(res, 200, { snapshots: await carregarSnapshots() });
    if (req.method === 'DELETE') {
      const app = new URL(req.url, 'http://x').searchParams.get('app') as AppId;
      if (!APP_IDS.includes(app)) return sendJson(res, 400, { error: 'App desconhecido.' });
      await del(chaveSnapshot(app));
      return sendJson(res, 200, { ok: true });
    }
    sendJson(res, 405, { error: 'Método não permitido.' });
  } catch (err: any) {
    sendJson(res, 502, { error: `Falha no banco: ${err?.message || err}` });
  }
}
