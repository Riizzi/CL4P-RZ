/**
 * Bem-estar: humor (registro no hub) × rotina (RoutineTracker) × sono, treinos e passos
 * (relógio via Health Connect) × gastos (RetroFin). Funções puras; testes em bemestar.test.ts.
 *
 * Regra de ouro: com poucos dias num grupo, a média engana. Todo grupo traz `dias`, e os
 * "achados" só aparecem quando cada lado tem pelo menos MIN_DIAS dias.
 */
import { arred, DIA, diaLocal, ehGasto, estadias, horaLocal, horasPorCategoria, inicioDoDia, type Estadia } from './metrics.js';
import type { AgendaEvento, ClimaDia, FinTransacao, HumorData, SaudeData, SaudeDia, Snapshots } from './types.js';

export const MIN_DIAS = 3;
const FUSO = '-03:00';
const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// ------------------------------------------------------------------ gasto "por impulso"

const IMPULSO = /snack|mimo|lazer|sa[ií]da|delivery|ifood|rappi|uber ?eats|compras|shopping|doce|sorvet|caf[eé]|bar\b|cerveja/i;

/** Gasto que costuma variar com humor e cansaço: delivery, lanches, lazer, compras. */
export function ehImpulso(tx: FinTransacao): boolean {
  return ehGasto(tx) && IMPULSO.test(`${tx.category} ${tx.description}`);
}

// ------------------------------------------------------------------ o dia, montado

export interface DiaBemEstar {
  dia: string;
  dow: number;
  humor: number | null;
  sonoH: number | null;
  passos: number | null;
  fcRepouso: number | null;
  treinou: boolean;
  /** minutos de treino (relógio ou estadia na academia) */
  treinoMin: number;
  horas: Record<string, number>;
  gasto: number;
  gastoImpulso: number;
  tipo: string;
  /** compromissos com horário (sem os de dia inteiro e os marcados como disponível); null sem agenda */
  compromissos: number | null;
  horasAgenda: number | null;
  /** hora (decimal) do primeiro compromisso do dia */
  primeiroCompromisso: number | null;
  tMax: number | null;
  chuvaMm: number | null;
}

/** Compromissos que ocupam o horário, agrupados pelo dia em que começam. */
export function agendaPorDia(eventos: AgendaEvento[]): Map<string, { n: number; horas: number; primeiro: number }> {
  const m = new Map<string, { n: number; horas: number; primeiro: number }>();
  for (const e of eventos) {
    if (e.diaInteiro || e.livre) continue;
    const d = diaLocal(e.inicio);
    const hora = arred((((e.inicio - 3 * 3_600_000) % DIA) + DIA) % DIA / 3_600_000, 2);
    const atual = m.get(d) ?? { n: 0, horas: 0, primeiro: 24 };
    atual.n += 1;
    atual.horas += Math.min(12, Math.max(0, e.fim - e.inicio) / 3_600_000);
    atual.primeiro = Math.min(atual.primeiro, hora);
    m.set(d, atual);
  }
  return m;
}

function inicioDia(dia: string): number {
  return Date.parse(`${dia}T00:00:00${FUSO}`);
}

/**
 * Tipo do dia pela rotina: trabalho (≥ 3 h em lugar de trabalho), treino (relógio ≥ 15 min ou
 * academia ≥ 20 min), UFMG/estudo (≥ 1 h), saída (≥ 2 h em lazer, social ou lugar não cadastrado).
 */
export function tipoDoDia(horas: Record<string, number>, treinou: boolean): string {
  const trabalhou = (horas.trabalho ?? 0) >= 3;
  const estudou = (horas.estudo ?? 0) >= 1;
  const saiu = (horas.lazer ?? 0) + (horas.social ?? 0) + (horas.desconhecido ?? 0) >= 2;
  if (trabalhou) return ['Trabalho', treinou && 'treino', estudou && 'UFMG'].filter(Boolean).join(' + ');
  const partes = [saiu ? 'Folga com saída' : 'Folga em casa', treinou && 'treino', estudou && 'UFMG'].filter(Boolean);
  return partes.join(' + ');
}

export function montarDias(s: Snapshots, desde: number, agora: number): DiaBemEstar[] {
  const humor = s.humor?.data;
  const saude = s.saude?.data;
  const rotina = s.routinetracker?.data;
  const fin = s.retrofin?.data;
  const lista: Estadia[] = estadias(rotina, agora);
  const agenda = s.agenda?.data;
  const agendaDia = agendaPorDia(agenda?.eventos ?? []);
  const climaDia = new Map<string, ClimaDia>((s.clima?.data?.dias ?? []).map((c) => [c.dia, c]));

  const humorDia = new Map<string, number[]>();
  for (const r of humor?.registros ?? []) {
    if (r.ts < desde || r.ts > agora) continue;
    const d = diaLocal(r.ts);
    humorDia.set(d, [...(humorDia.get(d) ?? []), r.nota]);
  }
  const saudeDia = new Map<string, SaudeDia>((saude?.dias ?? []).map((x) => [x.dia, x]));
  const treinoDia = new Map<string, number>();
  for (const t of saude?.treinos ?? []) {
    const d = diaLocal(t.inicio);
    treinoDia.set(d, (treinoDia.get(d) ?? 0) + Math.max(0, t.fim - t.inicio) / 60_000);
  }
  const gastoDia = new Map<string, { total: number; impulso: number }>();
  for (const tx of fin?.transactions ?? []) {
    if (!ehGasto(tx)) continue;
    const g = gastoDia.get(tx.date) ?? { total: 0, impulso: 0 };
    g.total += Math.abs(tx.amount);
    if (ehImpulso(tx)) g.impulso += Math.abs(tx.amount);
    gastoDia.set(tx.date, g);
  }

  const out: DiaBemEstar[] = [];
  for (let t = inicioDoDia(desde); t <= agora; t += DIA) {
    const dia = diaLocal(t + 12 * 3_600_000);
    const ini = inicioDia(dia);
    const horas = horasPorCategoria(lista, ini, Math.min(ini + DIA, agora));
    const academiaMin = lista
      .filter((e) => e.categoria === 'saude' && diaLocal(e.inicio) === dia)
      .reduce((m, e) => m + (e.fim - e.inicio) / 60_000, 0);
    const relogioMin = treinoDia.get(dia) ?? 0;
    const treinou = relogioMin >= 15 || academiaMin >= 20;
    const sd = saudeDia.get(dia);
    const notas = humorDia.get(dia);
    const g = gastoDia.get(dia);
    out.push({
      dia,
      dow: horaLocal(ini + 12 * 3_600_000).dow,
      humor: notas ? arred(notas.reduce((a, b) => a + b, 0) / notas.length, 2) : null,
      sonoH: sd?.sonoMin ? arred(sd.sonoMin / 60, 1) : null,
      passos: sd?.passos ?? null,
      fcRepouso: sd?.fcRepouso ?? null,
      treinou,
      treinoMin: Math.round(Math.max(relogioMin, academiaMin)),
      horas,
      gasto: arred(g?.total ?? 0),
      gastoImpulso: arred(g?.impulso ?? 0),
      tipo: rotina ? tipoDoDia(horas, treinou) : treinou ? 'Dia com treino' : 'Dia sem treino',
      // dia fora da janela lida da agenda = sem informação, não "dia livre"
      compromissos: agenda && ini >= agenda.desde ? (agendaDia.get(dia)?.n ?? 0) : null,
      horasAgenda: agenda && ini >= agenda.desde ? arred(agendaDia.get(dia)?.horas ?? 0, 1) : null,
      primeiroCompromisso: agendaDia.get(dia)?.primeiro ?? null,
      tMax: climaDia.get(dia)?.tMax ?? null,
      chuvaMm: climaDia.get(dia)?.chuvaMm ?? null,
    });
  }
  return out;
}

// ------------------------------------------------------------------ agregações

const media = (xs: number[]) => (xs.length ? arred(xs.reduce((a, b) => a + b, 0) / xs.length, 2) : null);

export interface Grupo {
  rotulo: string;
  dias: number;
  /** dias com humor registrado */
  diasHumor: number;
  humor: number | null;
  sonoH: number | null;
  passos: number | null;
  gasto: number | null;
  gastoImpulso: number | null;
}

function agrupar(dias: DiaBemEstar[], chave: (d: DiaBemEstar) => string | null, ordem?: string[]): Grupo[] {
  const grupos = new Map<string, DiaBemEstar[]>();
  for (const d of dias) {
    const k = chave(d);
    if (k === null) continue;
    grupos.set(k, [...(grupos.get(k) ?? []), d]);
  }
  const lista = [...grupos.entries()].map(([rotulo, ds]): Grupo => {
    const passos = media(ds.flatMap((d) => (d.passos !== null ? [d.passos] : [])));
    return {
      rotulo,
      dias: ds.length,
      diasHumor: ds.filter((d) => d.humor !== null).length,
      humor: media(ds.flatMap((d) => (d.humor !== null ? [d.humor] : []))),
      sonoH: media(ds.flatMap((d) => (d.sonoH !== null ? [d.sonoH] : []))),
      passos: passos !== null ? Math.round(passos) : null,
      gasto: media(ds.map((d) => d.gasto)),
      gastoImpulso: media(ds.map((d) => d.gastoImpulso)),
    };
  });
  if (ordem) return ordem.flatMap((o) => lista.filter((g) => g.rotulo === o));
  return lista.sort((a, b) => b.dias - a.dias);
}

export const humorPorTipoDia = (dias: DiaBemEstar[]) => agrupar(dias, (d) => d.tipo).sort((a, b) => (b.humor ?? -1) - (a.humor ?? -1) || b.dias - a.dias);

export const humorPorDiaSemana = (dias: DiaBemEstar[]) => {
  const ordem = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
  return agrupar(dias, (d) => DIAS_SEMANA[d.dow], ordem);
};

const FAIXAS_SONO = ['Menos de 6 h', '6 a 7 h', '7 a 8 h', '8 h ou mais'];
export function faixaSono(h: number): string {
  return h < 6 ? FAIXAS_SONO[0] : h < 7 ? FAIXAS_SONO[1] : h < 8 ? FAIXAS_SONO[2] : FAIXAS_SONO[3];
}
/** Sono da noite anterior × humor e gastos do dia. */
export const porSono = (dias: DiaBemEstar[]) => agrupar(dias, (d) => (d.sonoH !== null ? faixaSono(d.sonoH) : null), FAIXAS_SONO);

const FAIXAS_HUMOR = ['Dias ruins (1–2)', 'Dias ok (3)', 'Dias bons (4–5)'];
/** Humor × gasto do dia (total e por impulso). */
export const porHumor = (dias: DiaBemEstar[]) =>
  agrupar(dias, (d) => (d.humor === null ? null : d.humor < 2.5 ? FAIXAS_HUMOR[0] : d.humor < 3.5 ? FAIXAS_HUMOR[1] : FAIXAS_HUMOR[2]), FAIXAS_HUMOR);

/** Com treino × sem treino: humor do dia e sono da noite SEGUINTE. */
export function efeitoTreino(dias: DiaBemEstar[]): { com: Grupo; sem: Grupo; sonoDepoisCom: number | null; sonoDepoisSem: number | null } {
  const [com, sem] = ['Com treino', 'Sem treino'].map((r) => agrupar(dias, (d) => (d.treinou ? 'Com treino' : 'Sem treino')).find((g) => g.rotulo === r) ?? vazio(r));
  const seguinte = (filtro: boolean) =>
    media(dias.flatMap((d, i) => (d.treinou === filtro && dias[i + 1]?.sonoH != null ? [dias[i + 1].sonoH as number] : [])));
  return { com, sem, sonoDepoisCom: seguinte(true), sonoDepoisSem: seguinte(false) };
}

const FAIXAS_AGENDA = ['Dia livre', '1 a 2 compromissos', '3 ou mais'];
/** Carga da agenda × humor, sono e gastos. */
export const porAgenda = (dias: DiaBemEstar[]) =>
  agrupar(dias, (d) => (d.compromissos === null ? null : d.compromissos === 0 ? FAIXAS_AGENDA[0] : d.compromissos <= 2 ? FAIXAS_AGENDA[1] : FAIXAS_AGENDA[2]), FAIXAS_AGENDA);

const FAIXAS_CEDO = ['Começa antes das 9h', 'Começa às 9h ou depois'];
/** Sono da noite antes de um dia com compromisso cedo (o sono pertence ao dia em que acordou). */
export const porCompromissoCedo = (dias: DiaBemEstar[]) =>
  agrupar(dias, (d) => (d.primeiroCompromisso === null ? null : d.primeiroCompromisso < 9 ? FAIXAS_CEDO[0] : FAIXAS_CEDO[1]), FAIXAS_CEDO);

export const CHUVA_MM = 2;
export const CALOR_C = 30;
const FAIXAS_CLIMA = ['Chuva', 'Quente (30 °C+)', 'Seco'];
export function tipoClima(tMax: number, chuvaMm: number): string {
  return chuvaMm >= CHUVA_MM ? FAIXAS_CLIMA[0] : tMax >= CALOR_C ? FAIXAS_CLIMA[1] : FAIXAS_CLIMA[2];
}
/** Clima do dia × humor, passos e gastos. */
export const porClima = (dias: DiaBemEstar[]) =>
  agrupar(dias, (d) => (d.tMax === null || d.chuvaMm === null ? null : tipoClima(d.tMax, d.chuvaMm)), FAIXAS_CLIMA);

function vazio(rotulo: string): Grupo {
  return { rotulo, dias: 0, diasHumor: 0, humor: null, sonoH: null, passos: null, gasto: null, gastoImpulso: null };
}

// ------------------------------------------------------------------ saúde: semana atual × anterior

export interface Semana {
  sonoH: number | null;
  passos: number | null;
  treinos: number;
  fcRepouso: number | null;
  humor: number | null;
}

export function semanas(dias: DiaBemEstar[]): { atual: Semana; anterior: Semana } {
  const resumo = (ds: DiaBemEstar[]): Semana => {
    const passos = media(ds.flatMap((d) => (d.passos !== null ? [d.passos] : [])));
    const fc = media(ds.flatMap((d) => (d.fcRepouso !== null ? [d.fcRepouso] : [])));
    return {
      sonoH: media(ds.flatMap((d) => (d.sonoH !== null ? [d.sonoH] : []))),
      passos: passos !== null ? Math.round(passos) : null,
      treinos: ds.filter((d) => d.treinou).length,
      fcRepouso: fc !== null ? Math.round(fc) : null,
      humor: media(ds.flatMap((d) => (d.humor !== null ? [d.humor] : []))),
    };
  };
  return { atual: resumo(dias.slice(-7)), anterior: resumo(dias.slice(-14, -7)) };
}

// ------------------------------------------------------------------ achados em frases

export interface Achado {
  texto: string;
  /** diferença relativa, para ordenar */
  peso: number;
}

const fmt = (v: number, casas = 1) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
const brl = (v: number) => `R$ ${fmt(v, 0)}`;

/** Frases curtas com as diferenças mais fortes, só quando os dois lados têm dias suficientes. */
export function achados(dias: DiaBemEstar[]): Achado[] {
  const out: Achado[] = [];
  const ok = (a: Grupo, b: Grupo, campo: 'diasHumor' | 'dias' = 'diasHumor') => a[campo] >= MIN_DIAS && b[campo] >= MIN_DIAS;

  const t = efeitoTreino(dias);
  if (ok(t.com, t.sem) && t.com.humor !== null && t.sem.humor !== null && Math.abs(t.com.humor - t.sem.humor) >= 0.3) {
    out.push({ texto: `Humor médio ${fmt(t.com.humor)} nos dias com treino e ${fmt(t.sem.humor)} nos sem treino (${t.com.diasHumor} × ${t.sem.diasHumor} dias).`, peso: Math.abs(t.com.humor - t.sem.humor) / 4 });
  }
  if (t.sonoDepoisCom !== null && t.sonoDepoisSem !== null && Math.abs(t.sonoDepoisCom - t.sonoDepoisSem) >= 0.3) {
    out.push({ texto: `Depois de dia com treino você dorme ${fmt(t.sonoDepoisCom)} h, contra ${fmt(t.sonoDepoisSem)} h nos outros dias.`, peso: Math.abs(t.sonoDepoisCom - t.sonoDepoisSem) / 8 });
  }

  const sono = porSono(dias).filter((g) => g.diasHumor >= MIN_DIAS && g.humor !== null);
  if (sono.length >= 2) {
    const curto = sono[0];
    const melhor = sono.reduce((m, g) => (g.humor! > m.humor! ? g : m));
    if (curto.rotulo !== melhor.rotulo && melhor.humor! - curto.humor! >= 0.3) {
      out.push({ texto: `Com ${curto.rotulo.toLowerCase()} de sono, o humor do dia fica em ${fmt(curto.humor!)}; o seu melhor humor vem com ${melhor.rotulo.toLowerCase()} (${fmt(melhor.humor!)}).`, peso: (melhor.humor! - curto.humor!) / 4 });
    }
  }
  const sonoGasto = porSono(dias).filter((g) => g.dias >= MIN_DIAS && g.gastoImpulso !== null);
  if (sonoGasto.length >= 2) {
    const curto = sonoGasto[0];
    const menor = sonoGasto.slice(1).reduce((m, g) => (g.gastoImpulso! < m.gastoImpulso! ? g : m));
    if (curto.gastoImpulso! > 0 && curto.gastoImpulso! >= menor.gastoImpulso! * 1.3) {
      out.push({ texto: `Depois de dormir ${curto.rotulo.toLowerCase()}, o gasto com delivery, lanches e lazer é ${brl(curto.gastoImpulso!)} por dia, contra ${brl(menor.gastoImpulso!)} quando dorme ${menor.rotulo.toLowerCase()}.`, peso: (curto.gastoImpulso! - menor.gastoImpulso!) / Math.max(1, curto.gastoImpulso!) });
    }
  }

  const humor = porHumor(dias);
  const ruins = humor.find((g) => g.rotulo.startsWith('Dias ruins'));
  const bons = humor.find((g) => g.rotulo.startsWith('Dias bons'));
  if (ruins && bons && ok(ruins, bons, 'dias') && ruins.gastoImpulso !== null && bons.gastoImpulso !== null && ruins.gastoImpulso > bons.gastoImpulso * 1.3) {
    out.push({ texto: `Nos dias ruins o gasto por impulso sobe para ${brl(ruins.gastoImpulso)} por dia, contra ${brl(bons.gastoImpulso)} nos dias bons.`, peso: (ruins.gastoImpulso - bons.gastoImpulso) / Math.max(1, ruins.gastoImpulso) });
  }

  const ag = porAgenda(dias);
  const livre = ag.find((g) => g.rotulo === 'Dia livre');
  const cheio = ag.find((g) => g.rotulo === '3 ou mais');
  if (livre && cheio) {
    if (ok(livre, cheio) && livre.humor !== null && cheio.humor !== null && Math.abs(livre.humor - cheio.humor) >= 0.3) {
      out.push({ texto: `Com 3 ou mais compromissos na agenda, o humor fica em ${fmt(cheio.humor)}; nos dias livres, ${fmt(livre.humor)}.`, peso: Math.abs(livre.humor - cheio.humor) / 4 });
    }
    if (ok(livre, cheio, 'dias') && cheio.gastoImpulso !== null && livre.gastoImpulso !== null && cheio.gastoImpulso > Math.max(10, livre.gastoImpulso * 1.3)) {
      out.push({ texto: `Em dia de agenda cheia o gasto com delivery, lanches e lazer vai a ${brl(cheio.gastoImpulso)}, contra ${brl(livre.gastoImpulso)} nos dias livres.`, peso: (cheio.gastoImpulso - livre.gastoImpulso) / Math.max(1, cheio.gastoImpulso) });
    }
  }
  const cedo = porCompromissoCedo(dias);
  if (cedo.length === 2 && cedo[0].sonoH !== null && cedo[1].sonoH !== null && cedo[0].dias >= MIN_DIAS && cedo[1].dias >= MIN_DIAS && cedo[1].sonoH - cedo[0].sonoH >= 0.3) {
    out.push({ texto: `Na noite antes de compromisso antes das 9h você dorme ${fmt(cedo[0].sonoH)} h, contra ${fmt(cedo[1].sonoH)} h quando o dia começa mais tarde.`, peso: (cedo[1].sonoH - cedo[0].sonoH) / 8 });
  }

  const cl = porClima(dias);
  const chuva = cl.find((g) => g.rotulo === 'Chuva');
  const seco = cl.find((g) => g.rotulo === 'Seco');
  if (chuva && seco) {
    if (ok(chuva, seco) && chuva.humor !== null && seco.humor !== null && Math.abs(chuva.humor - seco.humor) >= 0.3) {
      out.push({ texto: `Em dia de chuva seu humor fica em ${fmt(chuva.humor)}, contra ${fmt(seco.humor)} nos dias secos.`, peso: Math.abs(chuva.humor - seco.humor) / 4 });
    }
    if (ok(chuva, seco, 'dias') && chuva.passos !== null && seco.passos !== null && seco.passos > chuva.passos * 1.2) {
      out.push({ texto: `A chuva derruba seus passos: ${chuva.passos.toLocaleString('pt-BR')} por dia, contra ${seco.passos.toLocaleString('pt-BR')} nos dias secos.`, peso: (seco.passos - chuva.passos) / seco.passos });
    }
    if (ok(chuva, seco, 'dias') && chuva.gastoImpulso !== null && seco.gastoImpulso !== null && chuva.gastoImpulso > Math.max(10, seco.gastoImpulso * 1.3)) {
      out.push({ texto: `Dia de chuva custa mais: ${brl(chuva.gastoImpulso)} em delivery, lanches e lazer, contra ${brl(seco.gastoImpulso)} nos dias secos.`, peso: (chuva.gastoImpulso - seco.gastoImpulso) / Math.max(1, chuva.gastoImpulso) });
    }
  }

  const tipos = humorPorTipoDia(dias).filter((g) => g.diasHumor >= MIN_DIAS && g.humor !== null);
  if (tipos.length >= 2) {
    const topo = tipos[0];
    const base = tipos[tipos.length - 1];
    if (topo.humor! - base.humor! >= 0.3) {
      out.push({ texto: `Seu melhor tipo de dia é "${topo.rotulo}" (humor ${fmt(topo.humor!)}); o mais baixo é "${base.rotulo}" (${fmt(base.humor!)}).`, peso: (topo.humor! - base.humor!) / 4 });
    }
  }
  return out.sort((a, b) => b.peso - a.peso).slice(0, 6);
}

// ------------------------------------------------------------------ tudo junto

export interface BemEstar {
  diasAnalisados: number;
  diasComHumor: number;
  temSaude: boolean;
  temAgenda: boolean;
  temClima: boolean;
  porTipoDia: Grupo[];
  porAgenda: Grupo[];
  porCompromissoCedo: Grupo[];
  porClima: Grupo[];
  porDiaSemana: Grupo[];
  porSono: Grupo[];
  porHumor: Grupo[];
  treino: ReturnType<typeof efeitoTreino>;
  semanas: ReturnType<typeof semanas>;
  achados: Achado[];
  hojeHumor: number | null;
  ultimaNoite: { sonoH: number | null; dormiu?: number; acordou?: number } | null;
}

export function montarBemEstar(s: Snapshots, agora = Date.now(), diasJanela = 60): BemEstar {
  const dias = montarDias(s, agora - (diasJanela - 1) * DIA, agora);
  const hoje = diaLocal(agora);
  const saudeHoje = (s.saude?.data as SaudeData | undefined)?.dias.find((d) => d.dia === hoje);
  const humor = s.humor?.data as HumorData | undefined;
  const hojeRegs = (humor?.registros ?? []).filter((r) => diaLocal(r.ts) === hoje);
  return {
    diasAnalisados: dias.length,
    diasComHumor: dias.filter((d) => d.humor !== null).length,
    temSaude: Boolean(s.saude),
    temAgenda: Boolean(s.agenda),
    temClima: Boolean(s.clima),
    porTipoDia: humorPorTipoDia(dias),
    porAgenda: porAgenda(dias),
    porCompromissoCedo: porCompromissoCedo(dias),
    porClima: porClima(dias),
    porDiaSemana: humorPorDiaSemana(dias),
    porSono: porSono(dias),
    porHumor: porHumor(dias),
    treino: efeitoTreino(dias),
    semanas: semanas(dias),
    achados: achados(dias),
    hojeHumor: hojeRegs.length ? hojeRegs[hojeRegs.length - 1].nota : null,
    ultimaNoite: saudeHoje ? { sonoH: saudeHoje.sonoMin ? arred(saudeHoje.sonoMin / 60, 1) : null, dormiu: saudeHoje.dormiu, acordou: saudeHoje.acordou } : null,
  };
}
