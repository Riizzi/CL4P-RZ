/** Montagem dos dias de saúde a partir das amostras do Health Connect (pura, testável). */
import { diaLocal } from './metrics.js';
import type { SaudeDia } from './types.js';

export interface AmostraSono {
  startDate: string;
  endDate: string;
  value?: number;
  sleepState?: string;
  stages?: { startDate: string; endDate: string; stage: string }[];
}


interface Segmento {
  ini: number;
  fim: number;
  estagio: string;
}

const ACORDADO = new Set(['awake', 'inBed']);

/** Sessões de sono a partir das amostras (com ou sem estágios), juntando trechos com menos de 90 min de intervalo. */
export function sessoesDeSono(amostras: AmostraSono[]) {
  const segs: Segmento[] = [];
  for (const a of amostras) {
    if (a.stages?.length) for (const st of a.stages) segs.push({ ini: Date.parse(st.startDate), fim: Date.parse(st.endDate), estagio: st.stage });
    else segs.push({ ini: Date.parse(a.startDate), fim: Date.parse(a.endDate), estagio: a.sleepState ?? 'asleep' });
  }
  segs.sort((a, b) => a.ini - b.ini);
  const sessoes: Segmento[][] = [];
  for (const s of segs) {
    if (!(s.fim > s.ini)) continue;
    const ultima = sessoes[sessoes.length - 1];
    const fimUltima = ultima ? Math.max(...ultima.map((x) => x.fim)) : -Infinity;
    if (ultima && s.ini - fimUltima < 90 * 60_000) ultima.push(s);
    else sessoes.push([s]);
  }
  return sessoes.map((ss) => {
    const soCama = ss.every((x) => ACORDADO.has(x.estagio));
    const min = (f: (x: Segmento) => boolean) => Math.round(ss.filter(f).reduce((m, x) => m + (x.fim - x.ini) / 60_000, 0));
    return {
      ini: Math.min(...ss.map((x) => x.ini)),
      fim: Math.max(...ss.map((x) => x.fim)),
      dormindoMin: soCama ? min(() => true) : min((x) => !ACORDADO.has(x.estagio)),
      profundoMin: min((x) => x.estagio === 'deep'),
      remMin: min((x) => x.estagio === 'rem'),
    };
  });
}

export function montarDiasSaude(entrada: {
  sono: Parameters<typeof sessoesDeSono>[0];
  passos: { startDate: string; value: number }[];
  calorias: { startDate: string; value: number }[];
  fcRepouso: { startDate: string; value: number }[];
  hrv: { startDate: string; value: number }[];
}): SaudeDia[] {
  const dias = new Map<string, SaudeDia>();
  const dia = (d: string) => dias.get(d) ?? (dias.set(d, { dia: d }), dias.get(d)!);
  // O sono pertence ao dia em que a pessoa acordou; cochilos somam no total.
  const principal = new Map<string, number>();
  for (const s of sessoesDeSono(entrada.sono)) {
    if (s.dormindoMin < 20) continue;
    const d = dia(diaLocal(s.fim));
    d.sonoMin = (d.sonoMin ?? 0) + s.dormindoMin;
    d.sonoProfundoMin = (d.sonoProfundoMin ?? 0) + s.profundoMin;
    d.sonoRemMin = (d.sonoRemMin ?? 0) + s.remMin;
    if (s.dormindoMin > (principal.get(d.dia) ?? 0)) {
      principal.set(d.dia, s.dormindoMin);
      d.dormiu = s.ini;
      d.acordou = s.fim;
    }
  }
  // Baldes diários começam à meia-noite local: +2 h evita cair no dia anterior por fuso.
  const doBalde = (iso: string) => diaLocal(Date.parse(iso) + 2 * 3_600_000);
  for (const p of entrada.passos) if (p.value > 0) dia(doBalde(p.startDate)).passos = Math.round(p.value);
  for (const c of entrada.calorias) if (c.value > 0) dia(doBalde(c.startDate)).caloriasAtivas = Math.round(c.value);
  const mediaPorDia = (xs: { startDate: string; value: number }[]) => {
    const m = new Map<string, number[]>();
    for (const x of xs) if (x.value > 0) m.set(diaLocal(Date.parse(x.startDate)), [...(m.get(diaLocal(Date.parse(x.startDate))) ?? []), x.value]);
    return m;
  };
  for (const [d, vs] of mediaPorDia(entrada.fcRepouso)) dia(d).fcRepouso = Math.round(vs.reduce((a, b) => a + b, 0) / vs.length);
  for (const [d, vs] of mediaPorDia(entrada.hrv)) dia(d).hrv = Math.round(vs.reduce((a, b) => a + b, 0) / vs.length);
  return [...dias.values()].sort((a, b) => a.dia.localeCompare(b.dia));
}

