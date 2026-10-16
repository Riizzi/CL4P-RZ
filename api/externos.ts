/**
 * Fontes que o próprio servidor do hub busca: agenda (links iCal) e clima (Open-Meteo).
 *
 * GET  /api/externos               → configuração (sem os links) e situação da última leitura
 * GET  /api/externos?atualizar=1   → lê de novo se a última leitura tem mais de 30 min
 * GET  /api/externos?atualizar=2   → lê de novo agora
 * POST /api/externos { adicionar?: {nome,url}, remover?: number, cidade?: string }
 *
 * Os links iCal são secretos: ficam cifrados no banco e nunca voltam para o aparelho.
 */
import type { Envelope } from '../src/core/types.js';
import { lerIcs, normalizarLinkAgenda } from './_lib/agenda.js';
import { buscarCidade, buscarClima, LOCAL_PADRAO, type Local } from './_lib/clima.js';
import { autorizado, cors, lerCorpo, sendJson } from './_lib/http.js';
import { chaveSnapshot } from './_lib/snapshots.js';
import { del, get, set } from './_lib/store.js';

const CFG = 'cl4p:cfg:externos';
const STATUS = 'cl4p:status:externos';
const VALIDADE_MS = 30 * 60_000;
const DIA = 86_400_000;
const MAX_AGENDAS = 6;

interface Config {
  agendas: { nome: string; url: string }[];
  local: Local;
}
interface Leitura {
  em: number | null;
  erro: string | null;
  itens?: number;
}
interface Status {
  agenda: Leitura;
  clima: Leitura;
}

async function lerJson<T>(chave: string, padrao: T): Promise<T> {
  try {
    const t = await get(chave);
    return t ? { ...padrao, ...JSON.parse(t) } : padrao;
  } catch {
    return padrao;
  }
}

const envelope = <T>(app: 'agenda' | 'clima', data: T): Envelope<T> => ({ app, schema: 1, generatedAt: new Date().toISOString(), receivedAt: new Date().toISOString(), data });

async function atualizar(cfg: Config, status: Status, agora: number): Promise<Status> {
  const novo: Status = { agenda: { ...status.agenda }, clima: { ...status.clima } };

  try {
    const clima = await buscarClima(cfg.local);
    await set(chaveSnapshot('clima'), JSON.stringify(envelope('clima', clima)));
    novo.clima = { em: agora, erro: null, itens: clima.dias.length };
  } catch (e: any) {
    novo.clima = { ...novo.clima, erro: `Clima: ${e?.message || e}` };
  }

  if (cfg.agendas.length) {
    const desde = agora - 120 * DIA;
    const ate = agora + 30 * DIA;
    const eventos = [];
    const erros: string[] = [];
    for (const a of cfg.agendas) {
      try {
        const r = await fetch(a.url, { signal: AbortSignal.timeout(20_000), headers: { Accept: 'text/calendar' } });
        if (!r.ok) throw new Error(r.status === 404 ? 'link não encontrado (foi redefinido?)' : `resposta ${r.status}`);
        const txt = await r.text();
        if (!/BEGIN:VCALENDAR/.test(txt)) throw new Error('o link não devolveu uma agenda .ics');
        eventos.push(...lerIcs(txt, desde, ate, a.nome));
      } catch (e: any) {
        erros.push(`${a.nome}: ${e?.message || e}`);
      }
    }
    if (erros.length < cfg.agendas.length) {
      eventos.sort((x, y) => x.inicio - y.inicio);
      await set(chaveSnapshot('agenda'), JSON.stringify(envelope('agenda', { eventos, desde, ate, calendarios: cfg.agendas.map((a) => a.nome) })));
      novo.agenda = { em: agora, erro: erros.length ? erros.join(' · ') : null, itens: eventos.length };
    } else {
      novo.agenda = { ...novo.agenda, erro: erros.join(' · ') };
    }
  } else {
    await del(chaveSnapshot('agenda'));
    novo.agenda = { em: null, erro: null, itens: 0 };
  }
  await set(STATUS, JSON.stringify(novo));
  return novo;
}

const publico = (cfg: Config, status: Status) => ({
  agendas: cfg.agendas.map((a) => ({ nome: a.nome, host: new URL(a.url).host })),
  local: cfg.local,
  status,
});

export default async function handler(req: any, res: any) {
  if (cors(req, res)) return;
  if (!autorizado(req, res)) return;
  const agora = Date.now();
  try {
    const cfg = await lerJson<Config>(CFG, { agendas: [], local: LOCAL_PADRAO });
    let status = await lerJson<Status>(STATUS, { agenda: { em: null, erro: null }, clima: { em: null, erro: null } });

    if (req.method === 'GET') {
      const modo = new URL(req.url, 'http://x').searchParams.get('atualizar');
      const velho = (l: Leitura) => !l.em || agora - l.em > VALIDADE_MS;
      if (modo === '2' || (modo === '1' && (velho(status.clima) || (cfg.agendas.length > 0 && velho(status.agenda))))) {
        status = await atualizar(cfg, status, agora);
      }
      return sendJson(res, 200, publico(cfg, status));
    }

    if (req.method === 'POST') {
      const b = (await lerCorpo(req)) as { adicionar?: { nome?: string; url?: string }; remover?: number; cidade?: string };
      if (b.adicionar) {
        const url = normalizarLinkAgenda(b.adicionar.url || '');
        if (!url) return sendJson(res, 400, { error: 'Link inválido. Use o "endereço secreto no formato iCal".' });
        if (cfg.agendas.length >= MAX_AGENDAS) return sendJson(res, 400, { error: `No máximo ${MAX_AGENDAS} agendas.` });
        const nome = (b.adicionar.nome || '').trim().slice(0, 40) || `Agenda ${cfg.agendas.length + 1}`;
        cfg.agendas.push({ nome, url });
      }
      if (typeof b.remover === 'number' && cfg.agendas[b.remover]) cfg.agendas.splice(b.remover, 1);
      if (b.cidade) {
        const l = await buscarCidade(b.cidade);
        if (!l) return sendJson(res, 400, { error: 'Não achei essa cidade.' });
        cfg.local = l;
      }
      await set(CFG, JSON.stringify(cfg));
      status = await atualizar(cfg, status, agora);
      return sendJson(res, 200, publico(cfg, status));
    }
    sendJson(res, 405, { error: 'Método não permitido.' });
  } catch (err: any) {
    sendJson(res, 502, { error: `Falha: ${err?.message || err}` });
  }
}
