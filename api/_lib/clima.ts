/**
 * Clima diário pelo Open-Meteo (gratuito, sem chave): os últimos 92 dias e os próximos 7.
 */
import type { ClimaData, ClimaDia } from '../../src/core/types.js';

export interface Local {
  nome: string;
  lat: number;
  lon: number;
}

export const LOCAL_PADRAO: Local = { nome: 'Belo Horizonte', lat: -19.9167, lon: -43.9345 };

export function montarDiasClima(j: any): ClimaDia[] {
  const d = j?.daily;
  if (!d || !Array.isArray(d.time)) return [];
  const out: ClimaDia[] = [];
  d.time.forEach((dia: string, i: number) => {
    const tMax = d.temperature_2m_max?.[i];
    const tMin = d.temperature_2m_min?.[i];
    if (typeof tMax !== 'number' || typeof tMin !== 'number') return;
    out.push({
      dia,
      tMax: Math.round(tMax * 10) / 10,
      tMin: Math.round(tMin * 10) / 10,
      chuvaMm: Math.round((d.precipitation_sum?.[i] ?? 0) * 10) / 10,
      codigo: d.weather_code?.[i] ?? 0,
    });
  });
  return out;
}

export async function buscarClima(local: Local): Promise<ClimaData> {
  const u = new URL('https://api.open-meteo.com/v1/forecast');
  u.searchParams.set('latitude', String(local.lat));
  u.searchParams.set('longitude', String(local.lon));
  u.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code');
  u.searchParams.set('timezone', 'America/Sao_Paulo');
  u.searchParams.set('past_days', '92');
  u.searchParams.set('forecast_days', '7');
  const r = await fetch(u, { signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`Open-Meteo respondeu ${r.status}`);
  return { local: local.nome, lat: local.lat, lon: local.lon, dias: montarDiasClima(await r.json()) };
}

/** "Belo Horizonte" → coordenadas, pela busca de cidades do Open-Meteo. */
export async function buscarCidade(nome: string): Promise<Local | null> {
  const u = new URL('https://geocoding-api.open-meteo.com/v1/search');
  u.searchParams.set('name', nome.trim().slice(0, 80));
  u.searchParams.set('count', '1');
  u.searchParams.set('language', 'pt');
  const r = await fetch(u, { signal: AbortSignal.timeout(10_000) });
  if (!r.ok) return null;
  const j: any = await r.json();
  const c = j?.results?.[0];
  if (!c) return null;
  const extra = [c.admin1, c.country_code].filter(Boolean).join(', ');
  return { nome: extra ? `${c.name} (${extra})` : c.name, lat: c.latitude, lon: c.longitude };
}
