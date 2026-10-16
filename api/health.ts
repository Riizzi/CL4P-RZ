import { cors, sendJson } from './_lib/http.js';
import { temBanco } from './_lib/store.js';
import { iguais } from './_lib/cripto.js';
import { temGemini, GEMINI_MODEL } from './_lib/gemini.js';

/** Diagnóstico público (não expõe dados): o que está configurado no servidor. */
export default async function handler(req: any, res: any) {
  if (cors(req, res)) return;
  const h: string = req.headers?.authorization || '';
  const enviada = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  const servidor = (process.env.CL4P_TOKEN || '').trim();
  sendJson(res, 200, {
    // só diz se a chave enviada bate; não revela nada sobre ela
    chaveConfere: enviada && servidor ? iguais(enviada, servidor) : null,
    app: 'CL4P-RZ',
    ok: true,
    chave: Boolean(process.env.CL4P_TOKEN),
    chaveFraca: (process.env.CL4P_TOKEN || '').trim().length > 0 && (process.env.CL4P_TOKEN || '').trim().length < 32,
    banco: temBanco ? 'upstash' : 'arquivo-local',
    gemini: temGemini,
    modelo: GEMINI_MODEL,
  });
}
