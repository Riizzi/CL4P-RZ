/**
 * Registro de humor (1 a 5, com etiquetas e anotação opcionais). Fica no aparelho e vai para o
 * servidor do hub como a fonte "humor". A anotação livre nunca vai para a IA do chat.
 */
import { useSyncExternalStore } from 'react';
import type { HumorData, HumorRegistro } from '../core/types.js';
import { enviarSnapshot } from './api.js';
import { getConfig } from './config.js';

const CHAVE = 'cl4p.humor.v1';
const MAX = 2000;

export const ROTULOS_HUMOR: Record<HumorRegistro['nota'], string> = { 1: 'Péssimo', 2: 'Ruim', 3: 'Ok', 4: 'Bom', 5: 'Ótimo' };
export const ETIQUETAS = ['Disposto', 'Cansado', 'Ansioso', 'Tranquilo', 'Produtivo', 'Sobrecarregado', 'Social', 'Doente', 'Dor', 'Motivado'];

function ler(): HumorRegistro[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

let registros = ler();
const ouvintes = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

function gravar(novos: HumorRegistro[]) {
  registros = novos.sort((a, b) => a.ts - b.ts).slice(-MAX);
  try {
    localStorage.setItem(CHAVE, JSON.stringify(registros));
  } catch {
    /* sem armazenamento */
  }
  ouvintes.forEach((f) => f());
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void publicarHumor(), 1500);
}

export function useHumor(): HumorRegistro[] {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => registros,
  );
}

export const humorLocal = (): HumorData => ({ registros });

export function registrarHumor(nota: HumorRegistro['nota'], tags: string[] = [], texto = ''): HumorRegistro {
  const r: HumorRegistro = {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `h${Date.now()}`,
    ts: Date.now(),
    nota,
    ...(tags.length ? { tags } : {}),
    ...(texto.trim() ? { texto: texto.trim().slice(0, 500) } : {}),
  };
  gravar([...registros, r]);
  return r;
}

export function apagarHumor(id: string) {
  gravar(registros.filter((r) => r.id !== id));
}

/** Junta com o que está no servidor (outro aparelho pode ter registrado). */
export function mesclarDoServidor(data: HumorData | undefined) {
  if (!data?.registros?.length) return;
  const ids = new Set(registros.map((r) => r.id));
  const novos = data.registros.filter((r) => !ids.has(r.id));
  if (novos.length) {
    registros = [...registros, ...novos].sort((a, b) => a.ts - b.ts).slice(-MAX);
    try {
      localStorage.setItem(CHAVE, JSON.stringify(registros));
    } catch {
      /* sem armazenamento */
    }
    ouvintes.forEach((f) => f());
  }
}

export async function publicarHumor(): Promise<string | null> {
  if (!getConfig().token || !registros.length) return null;
  try {
    await enviarSnapshot('humor', humorLocal());
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}
