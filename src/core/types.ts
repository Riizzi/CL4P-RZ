/**
 * Contrato de dados entre os apps e o CL4P-RZ ("Link CL4P", schema 1).
 *
 * Cada app envia um retrato (snapshot) completo e enxuto dos próprios dados para
 * POST /api/ingest. O hub guarda o último retrato de cada app e cruza tudo no cliente.
 * Datas: ISO 8601 (string) ou epoch em ms quando indicado.
 */

export type AppId = 'retrofin' | 'routinetracker' | 'smartpantry' | 'wishwatch' | 'papertrail' | 'rotmg' | 'saude' | 'humor';

/** Fontes de dados. As duas últimas são do próprio hub: Health Connect (relógio) e registro de humor. */
export const APP_IDS: AppId[] = ['retrofin', 'routinetracker', 'smartpantry', 'wishwatch', 'papertrail', 'rotmg', 'saude', 'humor'];

export const NOME_FONTE: Record<AppId, string> = {
  retrofin: 'RetroFin',
  routinetracker: 'RoutineTracker',
  smartpantry: 'SmartPantry',
  wishwatch: 'WishWatch',
  papertrail: 'PaperTrail',
  rotmg: 'RotMG Account Manager',
  saude: 'Saúde (relógio)',
  humor: 'Humor',
};

export interface Envelope<T = unknown> {
  app: AppId;
  schema: 1;
  /** ISO do momento em que o app montou o retrato */
  generatedAt: string;
  /** ISO do momento em que o hub recebeu (preenchido pelo servidor) */
  receivedAt?: string;
  data: T;
}

// ------------------------------------------------------------------ RetroFin

export interface FinTransacao {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm (pode faltar em extratos importados) */
  time?: string;
  /** ISO de quando o lançamento foi criado (notificações têm o horário exato) */
  createdAt?: string;
  description: string;
  /** positivo = entrada, negativo = saída */
  amount: number;
  category: string;
  channel?: string;
  accountName?: string;
  /** 'notificacao' | 'ofx' | 'manual' | ... */
  source?: string;
}

export interface RetroFinData {
  accounts: { id: string; name: string; institution: string; type: string; balance: number; purpose?: string }[];
  categories: { id: string; name: string; monthlyBudget: number }[];
  monthlyBudget?: number;
  transactions: FinTransacao[];
}

// ------------------------------------------------------------------ RoutineTracker

export type CategoriaLugar = 'casa' | 'trabalho' | 'saude' | 'lazer' | 'estudo' | 'social' | 'transporte' | 'outro';

export interface RotinaLugar {
  id: string;
  nome: string;
  categoria: CategoriaLugar;
  latitude: number;
  longitude: number;
  raio: number;
}

export interface RotinaRegistro {
  id: string;
  /** null = estadia em lugar não cadastrado */
  lugarId: string | null;
  latitude: number;
  longitude: number;
  /** epoch ms */
  inicio: number;
  /** epoch ms; null = ainda presente */
  fim: number | null;
}

export interface RoutineData {
  lugares: RotinaLugar[];
  registros: RotinaRegistro[];
  metas?: { trabalhoHorasDia?: number; academiaSemana?: number };
}

// ------------------------------------------------------------------ SmartPantry

export interface PantryNota {
  chave: string;
  emitente: string;
  /** ISO */
  data: string;
  total: number;
}

export interface PantryLote {
  id: string;
  nome: string;
  categoria: string;
  quantidadeInicial: number;
  quantidadeRestante: number;
  unidade: string;
  precoUnitario: number;
  /** ISO */
  compradoEm: string;
  validade: string | null;
  status: 'ativo' | 'acabou' | 'descartado';
}

export interface PantryData {
  notas: PantryNota[];
  lotes: PantryLote[];
  essenciaisFaltando?: string[];
}

// ------------------------------------------------------------------ WishWatch

export interface WishProduto {
  id: string;
  name: string;
  store?: string;
  category?: string;
  priority?: string;
  reason?: string;
  currentPrice: number | null;
  targetPrice?: number | null;
  lowestPrice?: number | null;
  initialPrice?: number | null;
  status: 'monitorando' | 'comprado' | 'arquivado';
  createdAt?: string;
  purchasedAt?: string;
  purchasedPrice?: number | null;
}

export interface WishData {
  products: WishProduto[];
}

// ------------------------------------------------------------------ PaperTrail

export interface PaperItem {
  id: string;
  title: string;
  authors?: string;
  year?: string | number;
  type?: string;
  /** 'quero_ler' | 'lendo' | 'lido' | ... */
  status?: string;
  favorite?: boolean;
  tags?: string[];
  collections?: string[];
  addedAt?: string;
  updatedAt?: string;
  hasSummary?: boolean;
  notesCount?: number;
}

export interface PaperData {
  items: PaperItem[];
}

// ------------------------------------------------------------------ RotMG

export interface RotmgPersonagem {
  classe: string;
  nivel?: number;
  fama?: number;
  maxados?: number;
}

export interface RotmgData {
  contas: {
    nome: string;
    personagens: RotmgPersonagem[];
    mortes: { classe: string; data?: string; fama?: number }[];
    itensNoVault?: number;
    pets?: number;
  }[];
}

// ------------------------------------------------------------------ Saúde (Health Connect, lido pelo APK do hub)

/** Um dia de saúde. O sono pertence ao dia em que a pessoa ACORDOU. */
export interface SaudeDia {
  /** YYYY-MM-DD (BH) */
  dia: string;
  passos?: number;
  caloriasAtivas?: number;
  /** minutos dormindo (sem os acordados) */
  sonoMin?: number;
  sonoProfundoMin?: number;
  sonoRemMin?: number;
  /** epoch ms de quando dormiu e acordou (sessão principal) */
  dormiu?: number;
  acordou?: number;
  fcRepouso?: number;
  hrv?: number;
}

export interface SaudeTreino {
  inicio: number;
  fim: number;
  tipo: string;
  calorias?: number;
  distanciaM?: number;
}

export interface SaudeData {
  dias: SaudeDia[];
  treinos: SaudeTreino[];
}

// ------------------------------------------------------------------ Humor (registrado no hub)

export interface HumorRegistro {
  id: string;
  /** epoch ms */
  ts: number;
  /** 1 péssimo · 2 ruim · 3 ok · 4 bom · 5 ótimo */
  nota: 1 | 2 | 3 | 4 | 5;
  tags?: string[];
  /** anotação livre: fica no aparelho e no seu banco; não vai para a IA */
  texto?: string;
}

export interface HumorData {
  registros: HumorRegistro[];
}

export interface DataMap {
  retrofin: RetroFinData;
  routinetracker: RoutineData;
  smartpantry: PantryData;
  wishwatch: WishData;
  papertrail: PaperData;
  rotmg: RotmgData;
  saude: SaudeData;
  humor: HumorData;
}

export type Snapshots = { [K in AppId]?: Envelope<DataMap[K]> };
