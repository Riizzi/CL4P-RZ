import { autorizadoApp, cors, lerCorpo, sendJson } from '../_lib/http.js';
import { gerar, GEMINI_MODEL, mensagemErro, temGemini } from '../_lib/gemini.js';

/** POST /api/retrofin/insights — observações do mês para o RetroFin (mesmo formato do servidor do RetroFin). */
export default async function handler(req: any, res: any) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Use POST.' });
  if (!autorizadoApp(req, res, 'retrofin')) return;
  if (!temGemini) return sendJson(res, 503, { error: 'GEMINI_API_KEY não configurada no CL4P-RZ.' });
  const { month, summary, topExpenses } = (await lerCorpo(req)) || {};
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  try {
    const { resposta } = await gerar({
      model: GEMINI_MODEL,
      contents: `Mês: ${String(month || '').slice(0, 7)}
Receitas: R$ ${num(summary?.income).toFixed(2)} | Despesas: R$ ${num(summary?.expense).toFixed(2)} | Saldo: R$ ${num(summary?.balance).toFixed(2)}
Maiores categorias: ${JSON.stringify(Array.isArray(topExpenses) ? topExpenses.slice(0, 8) : [])}`,
      config: {
        systemInstruction:
          'Você analisa as finanças pessoais de uma pessoa no Brasil. Gere de 3 a 4 observações objetivas em português, usando só os números recebidos, sem recomendar produtos de banco. Responda em JSON: {"insights":[{"title":"","type":"positive|warning|tip","message":"","action":""}]}',
        responseMimeType: 'application/json',
        temperature: 0.4,
      },
    });
    sendJson(res, 200, JSON.parse(resposta.text || '{"insights":[]}'));
  } catch (err) {
    sendJson(res, 502, { error: mensagemErro(err) });
  }
}
