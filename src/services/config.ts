/** Configuração local do hub (endereço do servidor, chave e endereços dos apps). */
import { Capacitor } from '@capacitor/core';

export interface ConfigHub {
  /** endereço do servidor CL4P-RZ (Vercel), sem barra no fim. Vazio = mesma origem da página. */
  api: string;
  token: string;
  /** endereço de cada app web, sobrescrevendo o padrão */
  urls: Record<string, string>;
  /** mostra dados de exemplo quando nada foi vinculado */
  demo: boolean;
  /** manda a lista de lançamentos e estadias para a IA do chat (padrão: só totais) */
  chatDetalhado: boolean;
}

const CHAVE = 'cl4p.config.v1';
export const isNative = Capacitor.isNativePlatform();

function ler(): ConfigHub {
  const base: ConfigHub = { api: '', token: '', urls: {}, demo: true, chatDetalhado: false };
  try {
    const p = JSON.parse(localStorage.getItem(CHAVE) || '{}');
    return { ...base, ...p, urls: { ...(p.urls || {}) } };
  } catch {
    return base;
  }
}

let atual = ler();
const ouvintes = new Set<() => void>();

export const getConfig = () => atual;

export function setConfig(parcial: Partial<ConfigHub>) {
  atual = { ...atual, ...parcial };
  try {
    localStorage.setItem(CHAVE, JSON.stringify(atual));
  } catch {
    /* armazenamento indisponível */
  }
  ouvintes.forEach((f) => f());
}

export function onConfig(f: () => void) {
  ouvintes.add(f);
  return () => void ouvintes.delete(f);
}

/** Endereço base efetivo da API. Na Vercel a própria origem serve; no APK é obrigatório configurar. */
export function apiBase(): string {
  const c = normalizarEndereco(atual.api);
  if (c) return c;
  return isNative ? '' : window.location.origin;
}

/** "cl4p-rz.vercel.app/ " → "https://cl4p-rz.vercel.app". Vazio continua vazio. */
export function normalizarEndereco(bruto: string): string {
  const s = (bruto || '').trim().replace(/\s+/g, '').replace(/\/+$/, '');
  if (!s) return '';
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

// ------------------------------------------------------------------ código de vínculo

function base64url(bytes: Uint8Array): string {
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Chave de um app: HMAC-SHA256(chave pessoal, "cl4p-app:" + app), igual à do servidor.
 * Ela só permite que aquele app ENVIE o próprio resumo; não lê dados de ninguém.
 */
export async function chaveDoApp(app: string, token = atual.token): Promise<string> {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(token.trim()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(`cl4p-app:${app}`));
  return base64url(new Uint8Array(sig));
}

function codificar(u: string, k: string): string {
  return `cl4p1.${base64url(new TextEncoder().encode(JSON.stringify({ u, k })))}`;
}

/** Código de vínculo de um app: "cl4p1.<base64url>" com { u: servidor, k: chave do app }. */
export async function gerarCodigoApp(app: string, api = apiBase(), token = atual.token): Promise<string> {
  const u = normalizarEndereco(api);
  if (!u) throw new Error('Preencha o endereço do servidor em Ajustes antes de vincular.');
  return codificar(u, await chaveDoApp(app, token));
}

/** Código com a chave PESSOAL: só para configurar outro aparelho com o próprio hub. Nunca cole num app. */
export function gerarCodigoHub(api = apiBase(), token = atual.token): string {
  return codificar(api, token);
}

export function lerCodigo(codigo: string): { u: string; k: string } | null {
  const m = codigo.trim().match(/^cl4p1\.([A-Za-z0-9_-]+)$/);
  if (!m) return null;
  try {
    const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
    const o = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    return typeof o.u === 'string' && typeof o.k === 'string' && o.u && o.k ? o : null;
  } catch {
    return null;
  }
}
