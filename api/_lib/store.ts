/**
 * Armazenamento: Upstash Redis via REST (plano gratuito, sem cartão).
 * Aceita as variáveis do Upstash direto (UPSTASH_REDIS_REST_*) ou as criadas pela integração
 * da Vercel (KV_REST_API_*). Sem nenhuma delas, usa um arquivo local (só para desenvolvimento).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { cifrar, decifrar } from './cripto.js';

const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';

export const temBanco = Boolean(URL_ && TOKEN);

async function redis(cmd: (string | number)[]): Promise<any> {
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const j = (await r.json().catch(() => ({}))) as { result?: unknown; error?: string };
  if (!r.ok || j.error) throw new Error(`Upstash: ${j.error || r.status}`);
  return j.result;
}

const ARQ = path.resolve('.data/cl4p.json');
async function lerArquivo(): Promise<Record<string, string>> {
  try {
    return JSON.parse(await readFile(ARQ, 'utf8'));
  } catch {
    return {};
  }
}

async function getBruto(chave: string): Promise<string | null> {
  if (temBanco) return (await redis(['GET', chave])) as string | null;
  return (await lerArquivo())[chave] ?? null;
}

/** Os valores ficam cifrados (AES-256-GCM) no banco; aqui já saem em texto. */
export async function get(chave: string): Promise<string | null> {
  const v = await getBruto(chave);
  return v === null ? null : decifrar(v);
}

export async function mget(chaves: string[]): Promise<(string | null)[]> {
  if (!chaves.length) return [];
  const brutos = temBanco ? ((await redis(['MGET', ...chaves])) as (string | null)[]) : await lerArquivo().then((d) => chaves.map((k) => d[k] ?? null));
  return brutos.map((v) => (v === null ? null : decifrar(v)));
}

export async function set(chave: string, valorTexto: string): Promise<void> {
  const valor = cifrar(valorTexto);
  if (temBanco) {
    await redis(['SET', chave, valor]);
    return;
  }
  const d = await lerArquivo();
  d[chave] = valor;
  await mkdir(path.dirname(ARQ), { recursive: true });
  await writeFile(ARQ, JSON.stringify(d));
}

export async function del(chave: string): Promise<void> {
  if (temBanco) {
    await redis(['DEL', chave]);
    return;
  }
  const d = await lerArquivo();
  delete d[chave];
  await mkdir(path.dirname(ARQ), { recursive: true });
  await writeFile(ARQ, JSON.stringify(d));
}
