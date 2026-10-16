import { AppLauncher } from '@capacitor/app-launcher';
import { Browser } from '@capacitor/browser';
import type { AppId } from '../core/types.js';
import { gerarCodigoApp, getConfig, isNative } from './config.js';

export interface AppInfo {
  id: AppId;
  nome: string;
  oQue: string;
  /** 'android' = APK com esquema próprio; 'web' = PWA aberto no navegador */
  tipo: 'android' | 'web';
  esquema?: string;
  urlPadrao?: string;
  repo: string;
}

export const APPS: AppInfo[] = [
  { id: 'retrofin', nome: 'RetroFin', oQue: 'Finanças e lançamentos pelas notificações do banco', tipo: 'android', esquema: 'retrofin', repo: 'Riizzi/RetroFin' },
  { id: 'routinetracker', nome: 'RoutineTracker', oQue: 'Chegadas e saídas dos seus lugares', tipo: 'android', esquema: 'routinetracker', repo: 'Riizzi/RoutineTracker' },
  { id: 'smartpantry', nome: 'SmartPantry', oQue: 'Despensa, notas do mercado e receitas', tipo: 'web', repo: 'Riizzi/SmartPantry' },
  { id: 'wishwatch', nome: 'WishWatch', oQue: 'Lista de desejos com preço monitorado', tipo: 'web', urlPadrao: 'https://wishwatch.onrender.com', repo: 'Riizzi/WishWatch' },
  { id: 'papertrail', nome: 'PaperTrail', oQue: 'Biblioteca acadêmica e referências ABNT', tipo: 'web', repo: 'Riizzi/PaperTrail' },
  { id: 'rotmg', nome: 'RotMG Account Manager', oQue: 'Personagens, vault e cemitério do RotMG', tipo: 'web', urlPadrao: 'https://riizzi.github.io/ROTMG_Account_Manager/', repo: 'Riizzi/ROTMG_Account_Manager' },
];

export const appPorId = (id: AppId) => APPS.find((a) => a.id === id)!;

export function urlDoApp(a: AppInfo): string {
  return (getConfig().urls[a.id] || a.urlPadrao || '').trim();
}

/**
 * Endereço que abre o app já levando o código de vínculo DAQUELE app. Nos apps web o código vai
 * no fragmento (#cl4p=...), que o navegador não manda para o servidor nem grava em logs.
 */
export async function linkDeAbertura(a: AppInfo, vincular = true): Promise<string | null> {
  const cod = vincular && getConfig().token ? await gerarCodigoApp(a.id) : '';
  if (a.tipo === 'android') return `${a.esquema}://cl4p${cod ? `?code=${encodeURIComponent(cod)}` : ''}`;
  const url = urlDoApp(a);
  if (!url) return null;
  if (!cod) return url;
  const u = new URL(url);
  const hash = new URLSearchParams(u.hash.replace(/^#/, ''));
  hash.set('cl4p', cod);
  u.hash = hash.toString();
  return u.toString();
}

export async function abrirApp(a: AppInfo, vincular = true): Promise<string | null> {
  let link: string | null;
  try {
    link = await linkDeAbertura(a, vincular);
  } catch (e) {
    return (e as Error).message;
  }
  if (!link) return 'Cadastre o endereço deste app em Ajustes.';
  try {
    if (a.tipo === 'android') {
      if (isNative) {
        const { completed } = await AppLauncher.openUrl({ url: link });
        if (!completed) return `${a.nome} não está instalado. Baixe o APK em github.com/${a.repo}/releases.`;
      } else window.location.href = link;
    } else if (isNative) await Browser.open({ url: link, toolbarColor: '#FAF7F2' });
    else window.open(link, '_blank', 'noopener');
    return null;
  } catch {
    return `Não consegui abrir o ${a.nome}.`;
  }
}
