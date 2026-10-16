/**
 * Leitura do Health Connect (Android) no APK do hub: sono, passos, calorias, batimentos em
 * repouso, HRV e treinos — o que o Mi Fitness (relógio Redmi) escreve lá. Monta um resumo por dia
 * e envia ao servidor como a fonte "saude". Só leitura: o hub nunca escreve no Health Connect.
 */
import { Health, type HealthDataType, type HealthSample } from '@capgo/capacitor-health';
import { montarDiasSaude } from '../core/saudeDias.js';
import type { SaudeData, SaudeTreino } from '../core/types.js';
import { enviarSnapshot } from './api.js';
import { getConfig, isNative } from './config.js';

const LEITURA: HealthDataType[] = ['sleep', 'steps', 'calories', 'restingHeartRate', 'heartRateVariability', 'workouts'];
const DIA = 86_400_000;
const CHAVE = 'cl4p.saude.estado.v1';
const INTERVALO_AUTO = 30 * 60_000;

export interface EstadoSaude {
  disponivel: boolean | null;
  motivo?: string;
  permitidos: string[];
  ultimaSync: number | null;
  erro: string | null;
  dias: number;
  treinos: number;
}

function lerEstado(): EstadoSaude {
  const base: EstadoSaude = { disponivel: null, permitidos: [], ultimaSync: null, erro: null, dias: 0, treinos: 0 };
  try {
    return { ...base, ...JSON.parse(localStorage.getItem(CHAVE) || '{}') };
  } catch {
    return base;
  }
}

let estado = lerEstado();
const ouvintes = new Set<() => void>();
let rodando = false;

function mudar(p: Partial<EstadoSaude>) {
  estado = { ...estado, ...p };
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
  } catch {
    /* sem armazenamento */
  }
  ouvintes.forEach((f) => f());
}

export const estadoSaude = () => estado;
export function ouvirSaude(f: () => void) {
  ouvintes.add(f);
  return () => void ouvintes.delete(f);
}

export async function verificarSaude(): Promise<EstadoSaude> {
  if (!isNative) {
    mudar({ disponivel: false, motivo: 'Disponível no app Android do CL4P-RZ.' });
    return estado;
  }
  try {
    const a = await Health.isAvailable();
    if (!a.available) {
      mudar({ disponivel: false, motivo: a.reason || 'Health Connect não encontrado neste celular.' });
      return estado;
    }
    const st = await Health.checkAuthorization({ read: LEITURA });
    mudar({ disponivel: true, motivo: undefined, permitidos: st.readAuthorized });
  } catch (e) {
    mudar({ erro: (e as Error).message });
  }
  return estado;
}

/** Abre a tela de permissões do Health Connect (só leitura; com histórico quando o aparelho permite). */
export async function conectarSaude(): Promise<EstadoSaude> {
  if (!isNative) return verificarSaude();
  try {
    const st = await Health.requestAuthorization({ read: LEITURA, write: [], requestHistoryAccess: true });
    mudar({ disponivel: true, permitidos: st.readAuthorized, erro: null });
    if (st.readAuthorized.length) await sincronizarSaude(true);
  } catch (e) {
    mudar({ erro: (e as Error).message });
  }
  return estado;
}

export const abrirAjustesHealthConnect = () => (isNative ? Health.openHealthConnectSettings() : Promise.resolve());

// ------------------------------------------------------------------ sincronização

async function tentar<T>(f: () => Promise<T>, padrao: T): Promise<T> {
  try {
    return await f();
  } catch {
    return padrao; // tipo sem permissão ou sem dados: segue com os outros
  }
}

/** Lê os últimos 60 dias (o Android limita a ~30 sem o acesso ao histórico) e envia ao hub. */
export async function sincronizarSaude(forcar = false): Promise<EstadoSaude> {
  if (!isNative || rodando) return estado;
  if (!forcar && estado.ultimaSync && Date.now() - estado.ultimaSync < INTERVALO_AUTO) return estado;
  if (!getConfig().token) return estado;
  rodando = true;
  try {
    const fim = new Date();
    const ini = new Date(fim.getTime() - 60 * DIA);
    const faixa = { startDate: ini.toISOString(), endDate: fim.toISOString() };
    const [sono, passos, calorias, fcRepouso, hrv] = await Promise.all([
      tentar(async () => (await Health.readSamples({ dataType: 'sleep', ...faixa, limit: 1000, ascending: true })).samples, [] as HealthSample[]),
      tentar(async () => (await Health.queryAggregated({ dataType: 'steps', ...faixa, bucket: 'day', aggregation: 'sum' })).samples, []),
      tentar(async () => (await Health.queryAggregated({ dataType: 'calories', ...faixa, bucket: 'day', aggregation: 'sum' })).samples, []),
      tentar(async () => (await Health.readSamples({ dataType: 'restingHeartRate', ...faixa, limit: 1000 })).samples, [] as HealthSample[]),
      tentar(async () => (await Health.readSamples({ dataType: 'heartRateVariability', ...faixa, limit: 1000 })).samples, [] as HealthSample[]),
    ]);
    const treinos: SaudeTreino[] = [];
    await tentar(async () => {
      let anchor: string | undefined;
      for (let pagina = 0; pagina < 10; pagina++) {
        const r = await Health.queryWorkouts({ ...faixa, limit: 100, ascending: true, ...(anchor ? { anchor } : {}) });
        for (const w of r.workouts) {
          treinos.push({
            inicio: Date.parse(w.startDate),
            fim: Date.parse(w.endDate),
            tipo: w.workoutType,
            ...(w.totalEnergyBurned ? { calorias: Math.round(w.totalEnergyBurned) } : {}),
            ...(w.totalDistance ? { distanciaM: Math.round(w.totalDistance) } : {}),
          });
        }
        if (!r.anchor) break;
        anchor = r.anchor;
      }
    }, undefined);

    const data: SaudeData = { dias: montarDiasSaude({ sono, passos, calorias, fcRepouso, hrv }), treinos };
    await enviarSnapshot('saude', data);
    mudar({ ultimaSync: Date.now(), erro: null, dias: data.dias.length, treinos: treinos.length });
  } catch (e) {
    mudar({ erro: (e as Error).message });
  } finally {
    rodando = false;
  }
  return estado;
}
