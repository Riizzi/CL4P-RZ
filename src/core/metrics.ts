/**
 * Cruzamentos entre os apps. Funções puras (sem DOM, sem rede), usadas pela interface
 * e pelo servidor do chat. Testes em metrics.test.ts.
 */
import type {
  CategoriaLugar,
  FinTransacao,
  PantryData,
  PaperData,
  RetroFinData,
  RotinaLugar,
  RotinaRegistro,
  RotmgData,
  RoutineData,
  Snapshots,
  WishData,
} from './types.js';

export const DIA = 86_400_000;
const HORA = 3_600_000;
/** Belo Horizonte: UTC-3 o ano todo (sem horário de verão desde 2019). */
const FUSO = '-03:00';

export const ROTULO_CATEGORIA_LUGAR: Record<CategoriaLugar | 'desconhecido' | 'transito', string> = {
  casa: 'Casa',
  trabalho: 'Trabalho',
  saude: 'Saúde / Academia',
  lazer: 'Lazer',
  estudo: 'Estudo',
  social: 'Social',
  transporte: 'Transporte',
  outro: 'Outro',
  desconhecido: 'Lugar não cadastrado',
  transito: 'Em trânsito / sem registro',
};

// ------------------------------------------------------------------ utilidades

export function arred(v: number, casas = 2): number {
  const f = 10 ** casas;
  return Math.round(v * f) / f;
}

/** Chave YYYY-MM-DD no fuso de BH. */
export function diaLocal(ts: number): string {
  return new Date(ts - 3 * HORA).toISOString().slice(0, 10);
}

/** Chave YYYY-MM no fuso de BH. */
export function mesLocal(ts: number): string {
  return diaLocal(ts).slice(0, 7);
}

/** Hora (0-23) e dia da semana (0 = domingo) no fuso de BH. */
export function horaLocal(ts: number): { hora: number; dow: number } {
  const d = new Date(ts - 3 * HORA);
  return { hora: d.getUTCHours(), dow: d.getUTCDay() };
}

/** Início do dia (00:00 de BH) em epoch ms. */
export function inicioDoDia(ts: number): number {
  return Date.parse(`${diaLocal(ts)}T00:00:00${FUSO}`);
}

/**
 * Momento da transação em epoch ms, ou null se só tiver a data.
 * Prioridade: data + hora informadas; senão createdAt, desde que caia no mesmo dia
 * (extratos importados têm createdAt = dia da importação, que não serve).
 */
export function momentoTransacao(tx: FinTransacao): number | null {
  if (tx.time && /^\d{1,2}:\d{2}/.test(tx.time)) {
    const [h, m] = tx.time.split(':');
    const t = Date.parse(`${tx.date}T${h.padStart(2, '0')}:${m.slice(0, 2)}:00${FUSO}`);
    if (Number.isFinite(t)) return t;
  }
  if (tx.createdAt) {
    const t = Date.parse(tx.createdAt);
    if (Number.isFinite(t) && diaLocal(t) === tx.date) return t;
  }
  return null;
}

const NAO_E_GASTO = /transa[cç][aã]o interna|transfer[eê]ncia|mesma titularidade|aporte|investiment|pagamento de fatura|fatura do cart/i;

/** Saída que conta como consumo (exclui transferências entre contas próprias e aportes). */
export function ehGasto(tx: FinTransacao): boolean {
  if (!(tx.amount < 0)) return false;
  return !NAO_E_GASTO.test(`${tx.category} ${tx.description}`);
}

export function ehReceita(tx: FinTransacao): boolean {
  if (!(tx.amount > 0)) return false;
  return !NAO_E_GASTO.test(`${tx.category} ${tx.description}`);
}

const MERCADO = /mercado|supermerc|aliment|hortifruti|sacol[aã]o|atacad|padaria|a[cç]ougue/i;

export function ehMercado(tx: FinTransacao): boolean {
  return ehGasto(tx) && MERCADO.test(`${tx.category} ${tx.description}`);
}

// ------------------------------------------------------------------ rotina × tempo

export interface Estadia {
  lugarId: string | null;
  nome: string;
  categoria: CategoriaLugar | 'desconhecido';
  inicio: number;
  fim: number;
  latitude: number;
  longitude: number;
}

/** Nome estável para estadias em lugar não cadastrado (agrupa num raio de ~110 m). */
function chaveDesconhecido(lat: number, lng: number): string {
  return `~${lat.toFixed(3)},${lng.toFixed(3)}`;
}

export function estadias(rotina: RoutineData | undefined, agora: number): Estadia[] {
  if (!rotina) return [];
  const porId = new Map<string, RotinaLugar>(rotina.lugares.map((l) => [l.id, l]));
  return rotina.registros
    .map((r: RotinaRegistro): Estadia => {
      const lugar = r.lugarId ? porId.get(r.lugarId) : undefined;
      return {
        lugarId: lugar ? lugar.id : null,
        nome: lugar ? lugar.nome : `Lugar não cadastrado (${chaveDesconhecido(r.latitude, r.longitude).slice(1)})`,
        categoria: lugar ? lugar.categoria : 'desconhecido',
        inicio: r.inicio,
        fim: r.fim ?? agora,
        latitude: r.latitude,
        longitude: r.longitude,
      };
    })
    .filter((e) => e.fim > e.inicio)
    .sort((a, b) => a.inicio - b.inicio);
}

/**
 * Onde a pessoa estava num instante. Prefere lugar cadastrado a estadia desconhecida; se não houver
 * estadia exata, aceita uma que começou ou terminou até `tolerancia` ms de distância
 * (a notificação do banco às vezes chega logo depois de sair do lugar).
 */
export function lugarNoMomento(lista: Estadia[], ts: number, tolerancia = 10 * 60_000): Estadia | null {
  let exata: Estadia | null = null;
  for (const e of lista) {
    if (e.inicio <= ts && ts <= e.fim) {
      if (!exata || (exata.lugarId === null && e.lugarId !== null)) exata = e;
    }
  }
  if (exata) return exata;
  let melhor: Estadia | null = null;
  let dist = tolerancia + 1;
  for (const e of lista) {
    const d = ts < e.inicio ? e.inicio - ts : ts - e.fim;
    if (d <= tolerancia && d < dist) {
      melhor = e;
      dist = d;
    }
  }
  return melhor;
}

/** Horas por categoria de lugar num intervalo. */
export function horasPorCategoria(lista: Estadia[], desde: number, ate: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of lista) {
    const ini = Math.max(e.inicio, desde);
    const fim = Math.min(e.fim, ate);
    if (fim <= ini) continue;
    out[e.categoria] = (out[e.categoria] ?? 0) + (fim - ini) / HORA;
  }
  for (const k of Object.keys(out)) out[k] = arred(out[k], 1);
  return out;
}

// ------------------------------------------------------------------ 1. gasto por lugar

export interface LinhaGastoLugar {
  chave: string;
  nome: string;
  categoria: CategoriaLugar | 'desconhecido' | 'transito';
  total: number;
  qtd: number;
  ticketMedio: number;
  /** maiores descrições (estabelecimentos) nesse lugar */
  principais: { descricao: string; total: number }[];
}

export interface GastoPorLugar {
  linhas: LinhaGastoLugar[];
  porCategoria: { categoria: string; rotulo: string; total: number; qtd: number }[];
  /** gastos que só têm a data (extrato importado): não dá para saber onde */
  semHorario: { qtd: number; total: number };
  totalAnalisado: number;
  /** % do valor gasto que conseguimos localizar */
  cobertura: number;
}

export function gastoPorLugar(fin: RetroFinData | undefined, rotina: RoutineData | undefined, desde: number, agora: number): GastoPorLugar {
  const vazio: GastoPorLugar = { linhas: [], porCategoria: [], semHorario: { qtd: 0, total: 0 }, totalAnalisado: 0, cobertura: 0 };
  if (!fin) return vazio;
  const lista = estadias(rotina, agora);
  const linhas = new Map<string, LinhaGastoLugar & { _desc: Map<string, number> }>();
  const sem = { qtd: 0, total: 0 };
  let total = 0;
  let localizado = 0;

  for (const tx of fin.transactions) {
    if (!ehGasto(tx)) continue;
    const t = momentoTransacao(tx) ?? Date.parse(`${tx.date}T12:00:00${FUSO}`);
    if (!(t >= desde && t <= agora)) continue;
    const valor = Math.abs(tx.amount);
    total += valor;
    const momento = momentoTransacao(tx);
    if (momento === null) {
      sem.qtd++;
      sem.total += valor;
      continue;
    }
    const e = lista.length ? lugarNoMomento(lista, momento) : null;
    const chave = e ? (e.lugarId ?? chaveDesconhecido(e.latitude, e.longitude)) : 'transito';
    const linha =
      linhas.get(chave) ??
      {
        chave,
        nome: e ? e.nome : ROTULO_CATEGORIA_LUGAR.transito,
        categoria: e ? e.categoria : ('transito' as const),
        total: 0,
        qtd: 0,
        ticketMedio: 0,
        principais: [],
        _desc: new Map<string, number>(),
      };
    linha.total += valor;
    linha.qtd++;
    linha._desc.set(tx.description, (linha._desc.get(tx.description) ?? 0) + valor);
    linhas.set(chave, linha);
    if (e) localizado += valor;
  }

  const saida = [...linhas.values()]
    .map(({ _desc, ...l }) => ({
      ...l,
      total: arred(l.total),
      ticketMedio: arred(l.total / l.qtd),
      principais: [..._desc.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([descricao, v]) => ({ descricao, total: arred(v) })),
    }))
    .sort((a, b) => b.total - a.total);

  const cats = new Map<string, { total: number; qtd: number }>();
  for (const l of saida) {
    const c = cats.get(l.categoria) ?? { total: 0, qtd: 0 };
    c.total += l.total;
    c.qtd += l.qtd;
    cats.set(l.categoria, c);
  }

  return {
    linhas: saida,
    porCategoria: [...cats.entries()]
      .map(([categoria, v]) => ({ categoria, rotulo: ROTULO_CATEGORIA_LUGAR[categoria as CategoriaLugar] ?? categoria, total: arred(v.total), qtd: v.qtd }))
      .sort((a, b) => b.total - a.total),
    semHorario: { qtd: sem.qtd, total: arred(sem.total) },
    totalAnalisado: arred(total),
    cobertura: total > 0 ? Math.round((localizado / total) * 100) : 0,
  };
}

// ------------------------------------------------------------------ 2. dias de academia × gasto

export interface DiasAcademia {
  diasComTreino: number;
  diasSemTreino: number;
  gastoMedioComTreino: number;
  gastoMedioSemTreino: number;
  /** gasto com saúde/farmácia/suplementos no período */
  gastoSaude: number;
}

export function diasDeAcademia(fin: RetroFinData | undefined, rotina: RoutineData | undefined, desde: number, agora: number): DiasAcademia | null {
  if (!fin || !rotina) return null;
  const lista = estadias(rotina, agora).filter((e) => e.categoria === 'saude' && e.fim - e.inicio >= 20 * 60_000);
  const comTreino = new Set(lista.filter((e) => e.inicio >= desde).map((e) => diaLocal(e.inicio)));
  const gastoDia = new Map<string, number>();
  let saude = 0;
  for (const tx of fin.transactions) {
    if (!ehGasto(tx)) continue;
    const t = Date.parse(`${tx.date}T12:00:00${FUSO}`);
    if (t < desde || t > agora) continue;
    gastoDia.set(tx.date, (gastoDia.get(tx.date) ?? 0) + Math.abs(tx.amount));
    if (/sa[uú]de|farm[aá]cia|suplement|academia/i.test(`${tx.category} ${tx.description}`)) saude += Math.abs(tx.amount);
  }
  const dias: string[] = [];
  for (let t = inicioDoDia(desde); t <= agora; t += DIA) dias.push(diaLocal(t + 12 * HORA));
  const com = dias.filter((d) => comTreino.has(d));
  const sem = dias.filter((d) => !comTreino.has(d));
  const media = (ds: string[]) => (ds.length ? arred(ds.reduce((s, d) => s + (gastoDia.get(d) ?? 0), 0) / ds.length) : 0);
  return {
    diasComTreino: com.length,
    diasSemTreino: sem.length,
    gastoMedioComTreino: media(com),
    gastoMedioSemTreino: media(sem),
    gastoSaude: arred(saude),
  };
}

// ------------------------------------------------------------------ 3. mercado × despensa

export interface MercadoMes {
  mes: string;
  /** gasto em mercado/alimentação no RetroFin */
  financeiro: number;
  /** soma das notas fiscais lidas no SmartPantry */
  notas: number;
}

export interface MercadoDespensa {
  meses: MercadoMes[];
  notasConciliadas: number;
  notasTotal: number;
  /** valor de itens descartados (venceram) no período */
  desperdicio: number;
  vencendo: { nome: string; validade: string; dias: number }[];
  essenciaisFaltando: string[];
}

export function mercadoDespensa(fin: RetroFinData | undefined, pantry: PantryData | undefined, desde: number, agora: number): MercadoDespensa | null {
  if (!pantry && !fin) return null;
  const meses = new Map<string, MercadoMes>();
  const mes = (m: string) => meses.get(m) ?? (meses.set(m, { mes: m, financeiro: 0, notas: 0 }), meses.get(m)!);
  const gastosMercado = (fin?.transactions ?? []).filter((tx) => ehGasto(tx) && Date.parse(`${tx.date}T12:00:00${FUSO}`) >= desde);
  for (const tx of gastosMercado) if (ehMercado(tx)) mes(tx.date.slice(0, 7)).financeiro += Math.abs(tx.amount);

  const notas = (pantry?.notas ?? []).filter((n) => Date.parse(n.data) >= desde);
  let conciliadas = 0;
  const usadas = new Set<string>();
  for (const n of notas) {
    const tn = Date.parse(n.data);
    mes(mesLocal(tn)).notas += n.total;
    // mesma compra no banco: valor igual (±R$ 0,10) com até 1 dia de diferença
    const par = gastosMercado.find(
      (tx) => !usadas.has(tx.id) && Math.abs(Math.abs(tx.amount) - n.total) <= 0.1 && Math.abs(Date.parse(`${tx.date}T12:00:00${FUSO}`) - tn) <= 1.5 * DIA,
    );
    if (par) {
      usadas.add(par.id);
      conciliadas++;
    }
  }

  const lotes = pantry?.lotes ?? [];
  const desperdicio = lotes
    .filter((l) => l.status === 'descartado' && Date.parse(l.compradoEm) >= desde)
    .reduce((s, l) => s + l.precoUnitario * l.quantidadeInicial, 0);
  const vencendo = lotes
    .filter((l) => l.status === 'ativo' && l.validade && l.quantidadeRestante > 0)
    .map((l) => ({ nome: l.nome, validade: l.validade as string, dias: Math.floor((Date.parse(l.validade as string) - inicioDoDia(agora)) / DIA) }))
    .filter((l) => l.dias <= 3)
    .sort((a, b) => a.dias - b.dias)
    .slice(0, 8);

  return {
    meses: [...meses.values()].map((m) => ({ ...m, financeiro: arred(m.financeiro), notas: arred(m.notas) })).sort((a, b) => a.mes.localeCompare(b.mes)),
    notasConciliadas: conciliadas,
    notasTotal: notas.length,
    desperdicio: arred(desperdicio),
    vencendo,
    essenciaisFaltando: pantry?.essenciaisFaltando ?? [],
  };
}

// ------------------------------------------------------------------ 4. desejos × caixa

export interface DesejosCaixa {
  monitorando: number;
  totalDesejos: number;
  /** média mensal de (receitas − gastos) nos últimos 3 meses fechados + mês atual */
  sobraMensal: number;
  /** meses de sobra para comprar tudo (null se a sobra for ≤ 0) */
  mesesParaTudo: number | null;
  noAlvo: { nome: string; preco: number; alvo: number }[];
  cabemNaSobra: { nome: string; preco: number }[];
  economizado: number;
}

export function desejosCaixa(fin: RetroFinData | undefined, wish: WishData | undefined, agora: number): DesejosCaixa | null {
  if (!wish) return null;
  const ativos = wish.products.filter((p) => p.status === 'monitorando' && p.currentPrice);
  const total = ativos.reduce((s, p) => s + (p.currentPrice ?? 0), 0);
  let sobra = 0;
  if (fin) {
    const limite = agora - 90 * DIA;
    let liquido = 0;
    for (const tx of fin.transactions) {
      const t = Date.parse(`${tx.date}T12:00:00${FUSO}`);
      if (t < limite || t > agora) continue;
      if (ehReceita(tx) || ehGasto(tx)) liquido += tx.amount;
    }
    sobra = arred(liquido / 3);
  }
  const economizado = wish.products
    .filter((p) => p.status === 'comprado' && p.initialPrice && p.purchasedPrice)
    .reduce((s, p) => s + ((p.initialPrice as number) - (p.purchasedPrice as number)), 0);
  return {
    monitorando: ativos.length,
    totalDesejos: arred(total),
    sobraMensal: sobra,
    mesesParaTudo: sobra > 0 ? arred(total / sobra, 1) : null,
    noAlvo: ativos
      .filter((p) => p.targetPrice && (p.currentPrice as number) <= p.targetPrice)
      .map((p) => ({ nome: p.name, preco: p.currentPrice as number, alvo: p.targetPrice as number })),
    cabemNaSobra: sobra > 0 ? ativos.filter((p) => (p.currentPrice as number) <= sobra).map((p) => ({ nome: p.name, preco: p.currentPrice as number })) : [],
    economizado: arred(Math.max(0, economizado)),
  };
}

// ------------------------------------------------------------------ 5. estudo × leituras

export interface SemanaEstudo {
  /** segunda-feira da semana (YYYY-MM-DD) */
  semana: string;
  horasEstudo: number;
  textosAdicionados: number;
  textosLidos: number;
}

function segundaDaSemana(ts: number): string {
  const { dow } = horaLocal(ts);
  const desloc = (dow + 6) % 7;
  return diaLocal(inicioDoDia(ts) - desloc * DIA + 12 * HORA);
}

export function estudoLeituras(rotina: RoutineData | undefined, paper: PaperData | undefined, semanas: number, agora: number): SemanaEstudo[] {
  if (!rotina && !paper) return [];
  const lista = estadias(rotina, agora);
  const out: SemanaEstudo[] = [];
  const seg0 = Date.parse(`${segundaDaSemana(agora)}T00:00:00${FUSO}`);
  for (let i = semanas - 1; i >= 0; i--) {
    const ini = seg0 - i * 7 * DIA;
    const fim = Math.min(ini + 7 * DIA, agora);
    const horas = horasPorCategoria(lista, ini, fim).estudo ?? 0;
    const itens = paper?.items ?? [];
    const dentro = (iso?: string) => {
      const t = iso ? Date.parse(iso) : NaN;
      return t >= ini && t < fim;
    };
    out.push({
      semana: diaLocal(ini + 12 * HORA),
      horasEstudo: horas,
      textosAdicionados: itens.filter((p) => dentro(p.addedAt)).length,
      textosLidos: itens.filter((p) => /lido|read|conclu/i.test(p.status ?? '') && dentro(p.updatedAt)).length,
    });
  }
  return out;
}

// ------------------------------------------------------------------ 6. ritmo de gastos (dia da semana × hora)

export interface MapaHorario {
  /** [dow][faixa] → total (faixas de 3 h: 0-3, 3-6, ..., 21-24) */
  matriz: number[][];
  maximo: number;
  picoTexto: string | null;
}

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export function mapaHorario(fin: RetroFinData | undefined, desde: number, agora: number): MapaHorario {
  const matriz = Array.from({ length: 7 }, () => Array(8).fill(0) as number[]);
  for (const tx of fin?.transactions ?? []) {
    if (!ehGasto(tx)) continue;
    const t = momentoTransacao(tx);
    if (t === null || t < desde || t > agora) continue;
    const { hora, dow } = horaLocal(t);
    matriz[dow][Math.floor(hora / 3)] += Math.abs(tx.amount);
  }
  let maximo = 0;
  let pico: [number, number] | null = null;
  matriz.forEach((linha, d) =>
    linha.forEach((v, f) => {
      if (v > maximo) {
        maximo = v;
        pico = [d, f];
      }
    }),
  );
  const p = pico as [number, number] | null;
  return {
    matriz: matriz.map((l) => l.map((v) => arred(v))),
    maximo: arred(maximo),
    picoTexto: p ? `${DIAS[p[0]]}, entre ${p[1] * 3}h e ${p[1] * 3 + 3}h` : null,
  };
}

// ------------------------------------------------------------------ 7. agora / hoje

export interface Hoje {
  lugarAtual: { nome: string; categoria: string; desde: number } | null;
  gastoHoje: number;
  gastoMes: number;
  receitaMes: number;
  orcamentoMes: number | null;
  saldoContas: number | null;
  horasHoje: Record<string, number>;
  ultimoGasto: { descricao: string; valor: number; lugar: string | null; quando: number } | null;
}

export function hoje(s: Snapshots, agora: number): Hoje {
  const fin = s.retrofin?.data;
  const rotina = s.routinetracker?.data;
  const lista = estadias(rotina, agora);
  const aberta = rotina?.registros.find((r) => r.fim === null);
  let lugarAtual: Hoje['lugarAtual'] = null;
  if (aberta) {
    const l = rotina!.lugares.find((x) => x.id === aberta.lugarId);
    lugarAtual = { nome: l ? l.nome : 'Lugar não cadastrado', categoria: l ? l.categoria : 'desconhecido', desde: aberta.inicio };
  }
  const dia = diaLocal(agora);
  const mes = dia.slice(0, 7);
  let gastoHoje = 0;
  let gastoMes = 0;
  let receitaMes = 0;
  let ultimo: Hoje['ultimoGasto'] = null;
  for (const tx of fin?.transactions ?? []) {
    if (ehGasto(tx)) {
      if (tx.date === dia) gastoHoje += Math.abs(tx.amount);
      if (tx.date.startsWith(mes)) gastoMes += Math.abs(tx.amount);
      const t = momentoTransacao(tx) ?? Date.parse(`${tx.date}T12:00:00${FUSO}`);
      if (t <= agora && (!ultimo || t > ultimo.quando)) {
        const e = momentoTransacao(tx) !== null ? lugarNoMomento(lista, t) : null;
        ultimo = { descricao: tx.description, valor: Math.abs(tx.amount), lugar: e?.nome ?? null, quando: t };
      }
    } else if (ehReceita(tx) && tx.date.startsWith(mes)) receitaMes += tx.amount;
  }
  return {
    lugarAtual,
    gastoHoje: arred(gastoHoje),
    gastoMes: arred(gastoMes),
    receitaMes: arred(receitaMes),
    orcamentoMes: fin?.monthlyBudget || null,
    saldoContas: fin ? arred(fin.accounts.reduce((sum, a) => sum + (a.type === 'CARTAO_CREDITO' ? 0 : a.balance || 0), 0)) : null,
    horasHoje: horasPorCategoria(lista, inicioDoDia(agora), agora),
    ultimoGasto: ultimo,
  };
}

// ------------------------------------------------------------------ 8. RotMG

export interface ResumoRotmg {
  contas: number;
  personagens: number;
  mortes: number;
  famaPerdida: number;
  classeMaisMorta: string | null;
  maxados8: number;
}

export function resumoRotmg(r: RotmgData | undefined): ResumoRotmg | null {
  if (!r) return null;
  const mortes = r.contas.flatMap((c) => c.mortes);
  const porClasse = new Map<string, number>();
  for (const m of mortes) porClasse.set(m.classe, (porClasse.get(m.classe) ?? 0) + 1);
  const top = [...porClasse.entries()].sort((a, b) => b[1] - a[1])[0];
  const personagens = r.contas.flatMap((c) => c.personagens);
  return {
    contas: r.contas.length,
    personagens: personagens.length,
    mortes: mortes.length,
    famaPerdida: mortes.reduce((s, m) => s + (m.fama ?? 0), 0),
    classeMaisMorta: top ? top[0] : null,
    maxados8: personagens.filter((p) => (p.maxados ?? 0) >= 8).length,
  };
}

// ------------------------------------------------------------------ tudo junto

export interface Painel {
  geradoEm: number;
  hoje: Hoje;
  gastoPorLugar30d: GastoPorLugar;
  academia30d: DiasAcademia | null;
  mercado90d: MercadoDespensa | null;
  desejos: DesejosCaixa | null;
  estudo8s: SemanaEstudo[];
  ritmo90d: MapaHorario;
  horas7d: Record<string, number>;
  rotmg: ResumoRotmg | null;
}

export function montarPainel(s: Snapshots, agora = Date.now()): Painel {
  const fin = s.retrofin?.data;
  const rotina = s.routinetracker?.data;
  return {
    geradoEm: agora,
    hoje: hoje(s, agora),
    gastoPorLugar30d: gastoPorLugar(fin, rotina, agora - 30 * DIA, agora),
    academia30d: diasDeAcademia(fin, rotina, agora - 30 * DIA, agora),
    mercado90d: mercadoDespensa(fin, s.smartpantry?.data, agora - 90 * DIA, agora),
    desejos: desejosCaixa(fin, s.wishwatch?.data, agora),
    estudo8s: estudoLeituras(rotina, s.papertrail?.data, 8, agora),
    ritmo90d: mapaHorario(fin, agora - 90 * DIA, agora),
    horas7d: horasPorCategoria(estadias(rotina, agora), agora - 7 * DIA, agora),
    rotmg: resumoRotmg(s.rotmg?.data),
  };
}
