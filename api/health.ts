import { cors, sendJson } from './_lib/http.js';
import { temBanco } from './_lib/store.js';
import { temGemini, GEMINI_MODEL } from './_lib/gemini.js';

/** Diagnóstico público (não expõe dados): o que está configurado no servidor. */
export default async function handler(req: any, res: any) {
  if (cors(req, res)) return;
  sendJson(res, 200, {
    app: 'CL4P-RZ',
    ok: true,
    chave: Boolean(process.env.CL4P_TOKEN),
    banco: temBanco ? 'upstash' : 'arquivo-local',
    gemini: temGemini,
    modelo: GEMINI_MODEL,
  });
}
