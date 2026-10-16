import type { Snapshots } from '../core/types.js';
import { apiBase, getConfig } from './config.js';

export class ErroApi extends Error {
  constructor(msg: string, public status = 0) {
    super(msg);
  }
}

async function chamar<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const base = apiBase();
  if (!base) throw new ErroApi('Configure o endereço do servidor em Ajustes.');
  const { token } = getConfig();
  if (!token && caminho !== '/api/health') throw new ErroApi('Informe sua chave em Ajustes.');
  let r: Response;
  try {
    r = await fetch(base + caminho, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) },
    });
  } catch {
    throw new ErroApi('Sem conexão com o servidor.');
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErroApi(j.error || `Erro ${r.status}`, r.status);
  return j as T;
}

export interface Saude {
  ok: boolean;
  chave: boolean;
  banco: string;
  gemini: boolean;
  modelo: string;
}

export const saude = () => chamar<Saude>('/api/health');

const CACHE = 'cl4p.snapshots.v1';

export function snapshotsEmCache(): Snapshots | null {
  try {
    const s = localStorage.getItem(CACHE);
    return s ? (JSON.parse(s) as Snapshots) : null;
  } catch {
    return null;
  }
}

export async function buscarSnapshots(): Promise<Snapshots> {
  const { snapshots } = await chamar<{ snapshots: Snapshots }>('/api/snapshots');
  try {
    localStorage.setItem(CACHE, JSON.stringify(snapshots));
  } catch {
    /* sem espaço: segue sem cache */
  }
  return snapshots;
}

export const apagarSnapshot = (app: string) => chamar<{ ok: true }>(`/api/snapshots?app=${encodeURIComponent(app)}`, { method: 'DELETE' });

export interface MsgChat {
  role: 'user' | 'model';
  text: string;
}

export const conversar = (messages: MsgChat[]) =>
  chamar<{ text: string }>('/api/chat', { method: 'POST', body: JSON.stringify({ messages }) });
