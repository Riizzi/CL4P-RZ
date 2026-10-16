import { autorizadoApp, cors, lerCorpo, sendJson } from '../_lib/http.js';
import { GEMINI_MODEL, gerarCliente, mensagemErro, temGemini } from '../_lib/gemini.js';
import { categorizarComGemini, validarPedido, type PedidoCategorizacao } from '../_lib/retrofin/categorizacaoIA.js';

/**
 * POST /api/retrofin/categorize — IA de categorização do RetroFin servida pelo hub,
 * para o APK não precisar de servidor próprio. Aceita só a chave do RetroFin (ou a pessoal).
 */
export default async function handler(req: any, res: any) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Use POST.' });
  if (!autorizadoApp(req, res, 'retrofin')) return;
  if (!temGemini) return sendJson(res, 503, { error: 'GEMINI_API_KEY não configurada no CL4P-RZ.' });
  const pedido = (await lerCorpo(req)) as PedidoCategorizacao;
  const erro = validarPedido(pedido);
  if (erro) return sendJson(res, 400, { error: erro });
  try {
    const mapa = await categorizarComGemini(gerarCliente(), GEMINI_MODEL, pedido);
    sendJson(res, 200, { results: [...mapa].map(([id, c]) => ({ id, ...c })), engine: GEMINI_MODEL });
  } catch (err) {
    sendJson(res, 502, { error: mensagemErro(err) });
  }
}
