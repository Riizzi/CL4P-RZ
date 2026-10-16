import { montarContexto } from '../src/core/context.js';
import { autorizado, cors, lerCorpo, sendJson } from './_lib/http.js';
import { gerar, GEMINI_MODEL, mensagemErro, temGemini } from './_lib/gemini.js';
import { instrucoesSistema } from './_lib/persona.js';
import { carregarSnapshots } from './_lib/snapshots.js';

interface Msg {
  role: 'user' | 'model';
  text: string;
}

/** POST /api/chat { messages: [{ role, text }] } → { text } */
export default async function handler(req: any, res: any) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Use POST.' });
  if (!autorizado(req, res)) return;
  if (!temGemini) return sendJson(res, 503, { error: 'Cadastre a variável GEMINI_API_KEY na Vercel para ligar o chat.' });

  const { messages, nivel } = (await lerCorpo(req)) as { messages?: Msg[]; nivel?: string };
  const historico = (Array.isArray(messages) ? messages : [])
    .filter((m) => (m.role === 'user' || m.role === 'model') && typeof m.text === 'string' && m.text.trim())
    .slice(-16)
    .map((m) => ({ role: m.role, parts: [{ text: m.text.slice(0, 4000) }] }));
  if (!historico.length || historico[historico.length - 1].role !== 'user') return sendJson(res, 400, { error: 'Mande uma pergunta.' });

  try {
    const contexto = montarContexto(await carregarSnapshots(), Date.now(), nivel === 'detalhado' ? 'detalhado' : 'resumo');
    const { resposta, model } = await gerar({
      model: GEMINI_MODEL,
      contents: historico,
      config: {
        systemInstruction: instrucoesSistema(process.env.CL4P_DONO || 'João Pedro', contexto),
        temperature: 0.8,
        maxOutputTokens: 1200,
      },
    });
    const text = (resposta.text || '').trim();
    sendJson(res, 200, { text: text || '*bzzzt* Meus circuitos travaram no meio da frase. Pergunta de novo?', model });
  } catch (err) {
    console.error('[chat]', err);
    sendJson(res, 502, { error: mensagemErro(err) });
  }
}
