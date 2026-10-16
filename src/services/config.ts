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
}

const CHAVE = 'cl4p.config.v1';
export const isNative = Capacitor.isNativePlatform();

function ler(): ConfigHub {
  const base: ConfigHub = { api: '', token: '', urls: {}, demo: true };
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
  const c = atual.api.trim().replace(/\/+$/, '');
  if (c) return c;
  return isNative ? '' : window.location.origin;
}

// ------------------------------------------------------------------ código de vínculo

/** Código "cl4p1.<base64url>" com { u: endereço da API, k: chave }. É o que os apps colam ou recebem por link. */
export function gerarCodigo(api = apiBase(), token = atual.token): string {
  const json = JSON.stringify({ u: api, k: token });
  const b64 = btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `cl4p1.${b64}`;
}

export function lerCodigo(codigo: string): { u: string; k: string } | null {
  const m = codigo.trim().match(/^cl4p1\.([A-Za-z0-9_-]+)$/);
  if (!m) return null;
  try {
    const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
    const o = JSON.parse(decodeURIComponent(escape(atob(b64 + '==='.slice((b64.length + 3) % 4)))));
    return typeof o.u === 'string' && typeof o.k === 'string' && o.u && o.k ? o : null;
  } catch {
    return null;
  }
}
