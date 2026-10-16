import { GoogleGenAI, type GenerateContentParameters } from '@google/genai';

export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
export const temGemini = Boolean(process.env.GEMINI_API_KEY);

let cliente: GoogleGenAI | null = null;
const ai = () => (cliente ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' }));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const transitorio = (m: string) => /503|UNAVAILABLE|overloaded|429|RESOURCE_EXHAUSTED|quota|500|INTERNAL/i.test(m);
const modeloSumiu = (m: string) => /404|NOT_FOUND|no longer available|not supported for/i.test(m);

let reservas: string[] | null = null;
/** Outros modelos Flash disponíveis na conta, para quando o principal estiver fora do ar. */
async function modelosReserva(principal: string): Promise<string[]> {
  if (reservas) return reservas;
  const env = (process.env.GEMINI_FALLBACK_MODELS || '').split(',').map((m) => m.trim()).filter(Boolean);
  const achados: string[] = [];
  try {
    const pager = await ai().models.list({ config: { pageSize: 100 } });
    for await (const m of pager) {
      const nome = (m.name || '').replace(/^models\//, '');
      if (!/gemini/i.test(nome) || !/flash/i.test(nome)) continue;
      if (/(image|tts|audio|live|embedding|exp|preview|thinking)/i.test(nome)) continue;
      if (m.supportedActions && !m.supportedActions.includes('generateContent')) continue;
      achados.push(nome);
    }
  } catch {
    /* sem lista: usa só a variável de ambiente */
  }
  achados.sort((a, b) => {
    const va = parseFloat(a.match(/(\d+(?:\.\d+)?)/)?.[1] || '0');
    const vb = parseFloat(b.match(/(\d+(?:\.\d+)?)/)?.[1] || '0');
    return vb - va || Number(/lite/.test(a)) - Number(/lite/.test(b));
  });
  reservas = [...new Set([...env, ...achados])].filter((m) => m !== principal).slice(0, 3);
  return reservas;
}

/** Chamada resiliente: repete em sobrecarga e troca de modelo se o principal sumir. */
export async function gerar(params: GenerateContentParameters, prazoMs = 50_000) {
  const limite = Date.now() + prazoMs;
  const modelos = [params.model, ...(await modelosReserva(params.model).catch(() => []))];
  let ultimo: any = null;
  for (const model of modelos) {
    const esperas = model === params.model ? [1500, 4000] : [2000];
    for (let i = 0; i <= esperas.length; i++) {
      if (limite - Date.now() < 3000) throw ultimo || new Error('DEADLINE');
      try {
        return { resposta: await ai().models.generateContent({ ...params, model }), model };
      } catch (err: any) {
        ultimo = err;
        const msg = String(err?.message || '');
        if (modeloSumiu(msg)) break;
        if (!transitorio(msg)) throw err;
        if (i < esperas.length && Date.now() + esperas[i] < limite) await sleep(esperas[i]);
        else break;
      }
    }
  }
  throw ultimo || new Error('IA indisponível');
}

export function mensagemErro(err: any): string {
  const msg = String(err?.message || '');
  if (/429|RESOURCE_EXHAUSTED|quota/i.test(msg)) return 'Limite de uso do Gemini atingido. Tente de novo em alguns minutos.';
  if (/API key|PERMISSION_DENIED|401|403/i.test(msg)) return 'Chave do Gemini inválida ou sem permissão.';
  if (/503|UNAVAILABLE|overloaded/i.test(msg)) return 'O Gemini está sobrecarregado agora. Tente de novo em instantes.';
  if (/DEADLINE/.test(msg)) return 'O Gemini demorou demais para responder.';
  if (/404|NOT_FOUND/i.test(msg)) return 'Modelo do Gemini indisponível. Ajuste a variável GEMINI_MODEL.';
  return 'Falha ao falar com o Gemini.';
}
