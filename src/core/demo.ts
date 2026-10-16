/** Dados de exemplo (determinísticos) para ver o hub funcionando antes de vincular os apps. */
import { DIA, diaLocal, inicioDoDia } from './metrics.js';
import type { FinTransacao, HumorRegistro, RotinaRegistro, SaudeDia, SaudeTreino, Snapshots } from './types.js';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const H = 3_600_000;

export function snapshotsDemo(agora = Date.now()): Snapshots {
  const r = rng(42);
  const lugares = [
    { id: 'casa', nome: 'Casa', categoria: 'casa' as const, latitude: -19.9245, longitude: -43.9352, raio: 120 },
    { id: 'cidade-adm', nome: 'Cidade Administrativa', categoria: 'trabalho' as const, latitude: -19.7836, longitude: -43.9536, raio: 250 },
    { id: 'academia', nome: 'Academia', categoria: 'saude' as const, latitude: -19.9271, longitude: -43.9389, raio: 100 },
    { id: 'ufmg', nome: 'UFMG – Fafich', categoria: 'estudo' as const, latitude: -19.8687, longitude: -43.9659, raio: 300 },
    { id: 'mercado', nome: 'Supermercado do bairro', categoria: 'outro' as const, latitude: -19.9221, longitude: -43.9331, raio: 80 },
  ];
  const registros: RotinaRegistro[] = [];
  const transactions: FinTransacao[] = [];
  let n = 0;
  const reg = (lugarId: string | null, ini: number, fim: number | null, lat = 0, lng = 0) => {
    const l = lugares.find((x) => x.id === lugarId);
    registros.push({ id: `r${n++}`, lugarId, latitude: l?.latitude ?? lat, longitude: l?.longitude ?? lng, inicio: ini, fim });
  };
  const tx = (ts: number, description: string, amount: number, category: string, source = 'notificacao') => {
    const d = new Date(ts - 3 * H);
    transactions.push({
      id: `t${n++}`,
      date: diaLocal(ts),
      time: `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`,
      createdAt: new Date(ts).toISOString(),
      description,
      amount,
      category,
      channel: 'CARTAO_CREDITO',
      accountName: 'Nubank',
      source,
    });
  };

  const hoje0 = inicioDoDia(agora);
  // Saúde e humor de exemplo (sorteio separado para não mexer no resto)
  const r2 = rng(7);
  const diasSaude: SaudeDia[] = [];
  const treinos: SaudeTreino[] = [];
  const humores: HumorRegistro[] = [];
  let treinouOntem = false;
  for (let i = 60; i >= 0; i--) {
    const d0 = hoje0 - i * DIA;
    const dow = new Date(d0 - 3 * H + 12 * H).getUTCDay();
    const util = dow >= 1 && dow <= 5;
    const treino = util && dow % 2 === 1;
    let sonoH = 7.1 + (r2() - 0.5) * 1.6 - (dow === 1 ? 0.6 : 0) + (treinouOntem ? 0.4 : 0) - (r2() < 0.15 ? 1.4 : 0);
    sonoH = Math.round(Math.max(4.5, sonoH) * 10) / 10;
    const acordou = d0 + (util ? 6.6 : 9) * H;
    if (acordou <= agora) {
      diasSaude.push({
        dia: diaLocal(d0 + 12 * H),
        sonoMin: Math.round(sonoH * 60),
        sonoProfundoMin: Math.round(sonoH * 60 * 0.18),
        dormiu: acordou - sonoH * H - 15 * 60_000,
        acordou,
        passos: Math.round((util ? 6000 + r2() * 3000 : 4000 + r2() * 6000) + (treino ? 2500 : 0)),
        fcRepouso: Math.round(58 + r2() * 5),
      });
    }
    if (treino && d0 + 19.3 * H <= agora) treinos.push({ inicio: d0 + 18.3 * H, fim: d0 + 19.3 * H, tipo: 'strengthTraining', calorias: Math.round(280 + r2() * 120) });
    const nota = Math.min(5, Math.max(1, Math.round(3 + (treino ? 0.8 : 0) + (sonoH < 6 ? -1.1 : sonoH >= 7.5 ? 0.4 : 0) + (!util ? 0.4 : 0) + (r2() - 0.5) * 1.2))) as HumorRegistro['nota'];
    if (d0 + 21.5 * H <= agora && r2() < 0.85) {
      humores.push({ id: `h${i}`, ts: d0 + 21.5 * H, nota, tags: nota <= 2 ? ['Cansado'] : nota >= 4 ? ['Disposto'] : [] });
      if (nota <= 2 && d0 + 21 * H <= agora) {
        transactions.push({ id: `t${n++}`, date: diaLocal(d0 + 12 * H), time: '21:00', createdAt: new Date(d0 + 21 * H).toISOString(), description: 'iFood', amount: -Math.round((45 + r2() * 30) * 100) / 100, category: 'Alimentação & Mercado', source: 'notificacao' });
      }
    }
    treinouOntem = treino;
    if (util) {
      reg('casa', d0 - 3 * H, d0 + 7.5 * H);
      reg('cidade-adm', d0 + 8.3 * H, d0 + 17.4 * H);
      if (d0 + 8.3 * H < agora) {
        if (r() < 0.7) tx(d0 + (12 + r()) * H, r() < 0.5 ? 'Restaurante Cidade Adm' : 'Lanchonete Prédio Minas', -(22 + r() * 18), 'Alimentação & Mercado');
        if (r() < 0.35) tx(d0 + (15.5 + r()) * H, 'Café Expresso', -(6 + r() * 6), 'Snacks & Mimos');
      }
      if (dow % 2 === 1) {
        reg('academia', d0 + 18.2 * H, d0 + 19.4 * H);
        reg('casa', d0 + 19.6 * H, d0 + 24 * H + 0 * H);
      } else {
        reg('ufmg', d0 + 18.5 * H, d0 + 22 * H);
        if (r() < 0.4) tx(d0 + 19.5 * H, 'Cantina Fafich', -(9 + r() * 8), 'Snacks & Mimos');
        reg('casa', d0 + 22.6 * H, d0 + 24 * H);
      }
    } else {
      reg('casa', d0, d0 + 10 * H);
      reg('mercado', d0 + 10.3 * H, d0 + 11.1 * H);
      const valor = 120 + Math.round(r() * 160 * 100) / 100;
      tx(d0 + 10.8 * H, 'Supermercado do bairro', -valor, 'Alimentação & Mercado');
      reg(null, d0 + 14 * H, d0 + 18 * H, -19.9368, -43.9268);
      if (r() < 0.8) tx(d0 + 16 * H, 'Bar do Zé', -(45 + r() * 60), 'Lazer & Saídas');
      reg('casa', d0 + 18.5 * H, d0 + 24 * H);
      if (r() < 0.5) tx(d0 + 20.5 * H, 'iFood', -(38 + r() * 25), 'Alimentação & Mercado');
    }
    if (i % 30 === 5) tx(d0 + 9 * H, 'Salário SEGEM', 5200, 'Renda & Receitas', 'ofx');
    if (i % 30 === 8) {
      transactions.push({ id: `t${n++}`, date: diaLocal(d0 + 12 * H), description: 'Aluguel', amount: -1450, category: 'Moradia', source: 'ofx' });
    }
  }
  // corta o que é futuro e fecha o registro aberto em "agora"
  const regs = registros
    .filter((x) => x.inicio < agora)
    .map((x) => (x.fim !== null && x.fim > agora ? { ...x, fim: null } : x));
  const tx2 = transactions.filter((t) => !t.createdAt || Date.parse(t.createdAt) <= agora);
  const aberto = regs.filter((x) => x.fim === null);
  aberto.slice(0, -1).forEach((x) => (x.fim = x.inicio + H));

  const iso = (t: number) => new Date(t).toISOString();
  const gen = iso(agora);
  return {
    retrofin: {
      app: 'retrofin',
      schema: 1,
      generatedAt: gen,
      data: {
        accounts: [
          { id: 'nu', name: 'Nubank', institution: 'NUBANK', type: 'CONTA_CORRENTE', balance: 2380.45, purpose: 'Dia a dia' },
          { id: 'inter', name: 'Inter', institution: 'BANCO_INTER', type: 'CONTA_CORRENTE', balance: 6120.1, purpose: 'Reserva e contas fixas' },
        ],
        categories: [
          { id: 'alimentacao', name: 'Alimentação & Mercado', monthlyBudget: 1400 },
          { id: 'lazer', name: 'Lazer & Saídas', monthlyBudget: 500 },
        ],
        monthlyBudget: 3800,
        transactions: tx2,
      },
    },
    routinetracker: { app: 'routinetracker', schema: 1, generatedAt: gen, data: { lugares, registros: regs, metas: { trabalhoHorasDia: 9, academiaSemana: 4 } } },
    smartpantry: {
      app: 'smartpantry',
      schema: 1,
      generatedAt: gen,
      data: {
        notas: tx2
          .filter((t) => t.description === 'Supermercado do bairro')
          .slice(-6)
          .map((t) => ({ chave: t.id, emitente: 'SUPERMERCADO DO BAIRRO LTDA', data: `${t.date}T${t.time}:00-03:00`, total: Math.abs(t.amount) })),
        lotes: [
          { id: 'l1', nome: 'Leite integral 1 L', categoria: 'laticinios', quantidadeInicial: 6, quantidadeRestante: 2, unidade: 'un', precoUnitario: 5.49, compradoEm: iso(agora - 6 * DIA), validade: iso(agora + 1 * DIA), status: 'ativo' },
          { id: 'l2', nome: 'Peito de frango', categoria: 'carnes', quantidadeInicial: 1.2, quantidadeRestante: 0.6, unidade: 'kg', precoUnitario: 21.9, compradoEm: iso(agora - 3 * DIA), validade: iso(agora + 2 * DIA), status: 'ativo' },
          { id: 'l3', nome: 'Alface crespa', categoria: 'hortifruti', quantidadeInicial: 1, quantidadeRestante: 0, unidade: 'un', precoUnitario: 3.5, compradoEm: iso(agora - 12 * DIA), validade: iso(agora - 5 * DIA), status: 'descartado' },
          { id: 'l4', nome: 'Arroz 5 kg', categoria: 'graos', quantidadeInicial: 1, quantidadeRestante: 1, unidade: 'un', precoUnitario: 27.9, compradoEm: iso(agora - 9 * DIA), validade: null, status: 'ativo' },
        ],
        essenciaisFaltando: ['Café', 'Ovos'],
      },
    },
    wishwatch: {
      app: 'wishwatch',
      schema: 1,
      generatedAt: gen,
      data: {
        products: [
          { id: 'w1', name: 'Fone Bluetooth com cancelamento de ruído', store: 'Amazon', priority: 'Quero', currentPrice: 899, targetPrice: 750, lowestPrice: 820, initialPrice: 1099, status: 'monitorando', createdAt: iso(agora - 40 * DIA) },
          { id: 'w2', name: 'Kindle', store: 'Mercado Livre', priority: 'Desejo', currentPrice: 479, targetPrice: 499, lowestPrice: 479, initialPrice: 599, status: 'monitorando', createdAt: iso(agora - 25 * DIA) },
          { id: 'w3', name: 'Tênis de corrida', store: 'Netshoes', priority: 'Preciso', currentPrice: null, status: 'comprado', initialPrice: 549, purchasedPrice: 429, purchasedAt: iso(agora - 10 * DIA) },
        ],
      },
    },
    papertrail: {
      app: 'papertrail',
      schema: 1,
      generatedAt: gen,
      data: {
        items: [
          { id: 'p1', title: 'A distinção: crítica social do julgamento', authors: 'Bourdieu, P.', year: 2007, type: 'livro', status: 'lido', addedAt: iso(agora - 50 * DIA), updatedAt: iso(agora - 12 * DIA), hasSummary: true, notesCount: 6 },
          { id: 'p2', title: 'Rotulação e trajetórias escolares', authors: 'Silva, M.', year: 2019, type: 'artigo', status: 'lendo', addedAt: iso(agora - 9 * DIA), updatedAt: iso(agora - 2 * DIA), hasSummary: true, notesCount: 2 },
          { id: 'p3', title: 'Outsiders', authors: 'Becker, H.', year: 2008, type: 'livro', status: 'quero_ler', addedAt: iso(agora - 4 * DIA), hasSummary: false, notesCount: 0 },
        ],
      },
    },
    saude: { app: 'saude', schema: 1, generatedAt: gen, data: { dias: diasSaude, treinos } },
    humor: { app: 'humor', schema: 1, generatedAt: gen, data: { registros: humores } },
    rotmg: {
      app: 'rotmg',
      schema: 1,
      generatedAt: gen,
      data: {
        contas: [
          {
            nome: 'Principal',
            personagens: [
              { classe: 'Wizard', nivel: 20, fama: 1450, maxados: 8 },
              { classe: 'Knight', nivel: 20, fama: 610, maxados: 5 },
            ],
            mortes: [
              { classe: 'Rogue', data: iso(agora - 20 * DIA), fama: 980 },
              { classe: 'Wizard', data: iso(agora - 8 * DIA), fama: 2210 },
            ],
            itensNoVault: 64,
            pets: 3,
          },
        ],
      },
    },
  };
}
