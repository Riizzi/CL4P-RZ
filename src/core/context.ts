/**
 * Monta o contexto que o chatbot recebe: métricas cruzadas + recortes dos dados brutos.
 * Fica abaixo de ~80 mil caracteres para a resposta sair rápida.
 */
import { montarBemEstar, type Grupo } from './bemestar.js';
import { DIA, diaLocal, estadias, montarPainel, momentoTransacao, lugarNoMomento, ROTULO_CATEGORIA_LUGAR } from './metrics.js';
import { APP_IDS, NOME_FONTE, type Snapshots } from './types.js';

const MAX_CHARS = 80_000;

const NOMES: Record<string, string> = {
  retrofin: 'RetroFin (finanças)',
  routinetracker: 'RoutineTracker (lugares e rotina)',
  smartpantry: 'SmartPantry (despensa e notas de mercado)',
  wishwatch: 'WishWatch (lista de desejos e preços)',
  papertrail: 'PaperTrail (textos acadêmicos)',
  rotmg: 'RotMG Account Manager (jogo Realm of the Mad God)',
  saude: 'Saúde (relógio Redmi via Mi Fitness → Health Connect: sono, passos, treinos, batimentos)',
  humor: 'Humor (registro diário de 1 a 5 no próprio hub)',
};

const brl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;
const hora = (ts: number) => new Date(ts - 3 * 3_600_000).toISOString().slice(0, 16).replace('T', ' ');

/** Esconde nomes de pessoas em Pix/transferências ("Pix para Maria Silva" → "Pix para [pessoa]"). */
export function ocultarPessoas(desc: string): string {
  const m = desc.trim().match(/^((?:pix|transfer[êe]ncia|ted|doc)(?: (?:enviad[oa]|recebid[oa]))? (?:para|de) )(.+)$/i);
  if (!m) return desc;
  if (/\b(ltda|s\.?a\.?|me|eireli|comercio|servicos|loja|mercado|restaurante|farmacia|drogaria|posto|academia|condominio)\b/i.test(m[2].normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) return desc;
  return `${m[1]}[pessoa]`;
}

/** Troca coordenadas de lugares não cadastrados por um número ("Lugar não cadastrado nº 2"). */
function semCoordenadas(texto: string): string {
  const vistos = new Map<string, number>();
  return texto.replace(/Lugar não cadastrado \((-?\d+\.\d+,-?\d+\.\d+)\)/g, (_, k: string) => {
    if (!vistos.has(k)) vistos.set(k, vistos.size + 1);
    return `Lugar não cadastrado nº ${vistos.get(k)}`;
  });
}

export type NivelDetalhe = 'resumo' | 'detalhado';

/**
 * `resumo` (padrão): métricas cruzadas e totais por estabelecimento, sem a lista de lançamentos
 * nem a lista de estadias. `detalhado`: inclui as listas. Nos dois, sem coordenadas e sem nomes de pessoas.
 */
export function montarContexto(s: Snapshots, agora = Date.now(), nivel: NivelDetalhe = 'resumo'): string {
  const p = montarPainel(s, agora);
  const linhas: string[] = [];
  const add = (t = '') => linhas.push(t);

  add(`AGORA: ${hora(agora)} (horário de Belo Horizonte)`);
  add('');
  add('FONTES (última atualização recebida):');
  for (const id of APP_IDS) {
    const e = s[id];
    add(`- ${NOMES[id] ?? NOME_FONTE[id]}: ${e ? `atualizado em ${hora(Date.parse(e.generatedAt))}` : 'NÃO VINCULADO (sem dados)'}`);
  }

  add('');
  add('== RESUMO DE HOJE ==');
  const h = p.hoje;
  if (h.lugarAtual) add(`Lugar atual: ${h.lugarAtual.nome} (${ROTULO_CATEGORIA_LUGAR[h.lugarAtual.categoria as 'casa'] ?? h.lugarAtual.categoria}) desde ${hora(h.lugarAtual.desde)}`);
  add(`Gasto hoje: ${brl(h.gastoHoje)} | gasto no mês: ${brl(h.gastoMes)} | receitas no mês: ${brl(h.receitaMes)}${h.orcamentoMes ? ` | orçamento mensal: ${brl(h.orcamentoMes)}` : ''}`);
  if (h.saldoContas !== null) add(`Saldo somado das contas: ${brl(h.saldoContas)}`);
  if (h.ultimoGasto) add(`Último gasto: ${ocultarPessoas(h.ultimoGasto.descricao)} ${brl(h.ultimoGasto.valor)} em ${hora(h.ultimoGasto.quando)}${h.ultimoGasto.lugar ? ` (estava em: ${h.ultimoGasto.lugar})` : ''}`);
  add(`Horas hoje por tipo de lugar: ${JSON.stringify(h.horasHoje)}`);
  add(`Horas nos últimos 7 dias por tipo de lugar: ${JSON.stringify(p.horas7d)}`);

  add('');
  add('== CRUZAMENTO: GASTO POR LUGAR (últimos 30 dias, RetroFin × RoutineTracker) ==');
  const g = p.gastoPorLugar30d;
  add(`Total analisado ${brl(g.totalAnalisado)}; ${g.cobertura}% do valor localizado; ${g.semHorario.qtd} gastos sem horário (${brl(g.semHorario.total)}) não dá para localizar.`);
  for (const l of g.linhas.slice(0, 15)) {
    add(`- ${l.nome} [${l.categoria}]: ${brl(l.total)} em ${l.qtd} compras (ticket médio ${brl(l.ticketMedio)}); principais: ${l.principais.map((x) => `${ocultarPessoas(x.descricao)} ${brl(x.total)}`).join('; ')}`);
  }
  add(`Por tipo de lugar: ${g.porCategoria.map((c) => `${c.rotulo} ${brl(c.total)}`).join(' | ')}`);

  if (p.academia30d) {
    const a = p.academia30d;
    add('');
    add('== CRUZAMENTO: ACADEMIA × GASTOS (30 dias) ==');
    add(`Dias com treino: ${a.diasComTreino}; sem treino: ${a.diasSemTreino}. Gasto médio por dia com treino ${brl(a.gastoMedioComTreino)} vs sem treino ${brl(a.gastoMedioSemTreino)}. Gasto com saúde/farmácia: ${brl(a.gastoSaude)}.`);
  }

  if (p.mercado90d) {
    const m = p.mercado90d;
    add('');
    add('== CRUZAMENTO: MERCADO × DESPENSA (90 dias, RetroFin × SmartPantry) ==');
    for (const mm of m.meses) add(`- ${mm.mes}: mercado no banco ${brl(mm.financeiro)} | notas fiscais lidas ${brl(mm.notas)}`);
    add(`Notas conciliadas com o extrato: ${m.notasConciliadas} de ${m.notasTotal}. Desperdício (itens descartados): ${brl(m.desperdicio)}.`);
    if (m.vencendo.length) add(`Vencendo em até 3 dias: ${m.vencendo.map((v) => `${v.nome} (${v.dias} d)`).join(', ')}`);
    if (m.essenciaisFaltando.length) add(`Essenciais faltando: ${m.essenciaisFaltando.join(', ')}`);
  }

  if (p.desejos) {
    const d = p.desejos;
    add('');
    add('== CRUZAMENTO: DESEJOS × CAIXA (WishWatch × RetroFin) ==');
    add(`${d.monitorando} itens monitorados somando ${brl(d.totalDesejos)}. Sobra média mensal (3 meses): ${brl(d.sobraMensal)}. ${d.mesesParaTudo !== null ? `Comprar tudo levaria ~${d.mesesParaTudo} meses de sobra.` : 'Sem sobra positiva no período.'}`);
    if (d.noAlvo.length) add(`No preço-alvo agora: ${d.noAlvo.map((x) => `${x.nome} ${brl(x.preco)} (alvo ${brl(x.alvo)})`).join('; ')}`);
    if (d.economizado) add(`Economia registrada em compras: ${brl(d.economizado)}`);
  }

  if (p.estudo8s.some((w) => w.horasEstudo || w.textosAdicionados || w.textosLidos)) {
    add('');
    add('== CRUZAMENTO: ESTUDO × LEITURAS (8 semanas, RoutineTracker × PaperTrail) ==');
    for (const w of p.estudo8s) add(`- semana de ${w.semana}: ${w.horasEstudo} h em lugares de estudo | ${w.textosAdicionados} textos adicionados | ${w.textosLidos} lidos`);
  }

  add('');
  add(`== RITMO DE GASTOS (90 dias) == pico: ${p.ritmo90d.picoTexto ?? 'sem dados com horário'}`);

  if (p.rotmg) {
    const r = p.rotmg;
    add('');
    add(`== ROTMG == ${r.contas} contas, ${r.personagens} personagens vivos (${r.maxados8} com 8/8), ${r.mortes} mortes (${r.famaPerdida} de fama perdida), classe que mais morreu: ${r.classeMaisMorta ?? '-'}`);
    for (const c of s.rotmg!.data.contas.slice(0, 5)) {
      add(`- conta ${c.nome}: ${c.personagens.map((x) => `${x.classe}${x.maxados !== undefined ? ` ${x.maxados}/8` : ''}`).join(', ')}; vault ${c.itensNoVault ?? '?'} itens; pets ${c.pets ?? '?'}`);
    }
  }

  // ---------------------------------------------------------- bem-estar (agregados; sem anotações de humor)
  const b = montarBemEstar(s, agora);
  if (b.diasComHumor || b.temSaude) {
    const g = (x: Grupo) =>
      `${x.rotulo}: humor ${x.humor ?? '—'} (${x.diasHumor} dias com humor de ${x.dias})${x.sonoH !== null ? `, sono ${x.sonoH} h` : ''}${x.passos !== null ? `, ${x.passos} passos` : ''}${x.gastoImpulso !== null ? `, impulso ${brl(x.gastoImpulso)}/dia` : ''}`;
    add('');
    add(`== BEM-ESTAR (60 dias; humor de 1 a 5; ${b.diasComHumor} dias com humor registrado) ==`);
    if (b.hojeHumor !== null) add(`Humor registrado hoje: ${b.hojeHumor}`);
    if (b.ultimaNoite?.sonoH) add(`Última noite: ${b.ultimaNoite.sonoH} h de sono`);
    if (b.achados.length) add(`Achados (cada lado com 3+ dias): ${b.achados.map((a) => a.texto).join(' | ')}`);
    add('Por tipo de dia da rotina:');
    for (const x of b.porTipoDia) add(`- ${g(x)}`);
    add('Por dia da semana:');
    for (const x of b.porDiaSemana) add(`- ${g(x)}`);
    if (b.porSono.length) {
      add('Por sono da noite anterior:');
      for (const x of b.porSono) add(`- ${g(x)}`);
    }
    add('Por humor do dia (gasto total e por impulso):');
    for (const x of b.porHumor) add(`- ${x.rotulo}: ${x.dias} dias, gasto ${x.gasto !== null ? brl(x.gasto) : '—'}/dia, impulso ${x.gastoImpulso !== null ? brl(x.gastoImpulso) : '—'}/dia`);
    const t = b.treino;
    add(`Treino: humor ${t.com.humor ?? '—'} com treino (${t.com.diasHumor} dias) × ${t.sem.humor ?? '—'} sem (${t.sem.diasHumor} dias); sono na noite seguinte ${t.sonoDepoisCom ?? '—'} h × ${t.sonoDepoisSem ?? '—'} h.`);
    const w = b.semanas;
    add(`Últimos 7 dias: sono ${w.atual.sonoH ?? '—'} h, ${w.atual.passos ?? '—'} passos/dia, ${w.atual.treinos} treinos, FC repouso ${w.atual.fcRepouso ?? '—'} bpm, humor ${w.atual.humor ?? '—'} (semana anterior: sono ${w.anterior.sonoH ?? '—'} h, ${w.anterior.passos ?? '—'} passos, ${w.anterior.treinos} treinos, FC ${w.anterior.fcRepouso ?? '—'}, humor ${w.anterior.humor ?? '—'})`);
  }

  // ---------------------------------------------------------- dados brutos (recortes)
  const fin = s.retrofin?.data;
  const rotina = s.routinetracker?.data;
  const lista = estadias(rotina, agora);
  if (fin) {
    add('');
    add('== CONTAS ==');
    for (const a of fin.accounts) add(`- ${a.name} (${a.institution}, ${a.type}): saldo ${brl(a.balance)}${a.purpose ? ` — uso: ${a.purpose}` : ''}`);
    const cats = fin.categories.filter((c) => c.monthlyBudget > 0);
    if (cats.length) add(`Metas por categoria: ${cats.map((c) => `${c.name} ${brl(c.monthlyBudget)}`).join('; ')}`);
    const limite = diaLocal(agora - 60 * DIA);
    const recentes = fin.transactions.filter((t) => t.date >= limite).sort((a, b) => (b.date + (b.time ?? '')).localeCompare(a.date + (a.time ?? '')));
    add('');
    add('== GASTOS POR ESTABELECIMENTO (60 dias: total | nº de compras | categoria) ==');
    const porLoja = new Map<string, { total: number; qtd: number; cat: string }>();
    for (const t of recentes) {
      if (!(t.amount < 0)) continue;
      const k = ocultarPessoas(t.description);
      const v = porLoja.get(k) ?? { total: 0, qtd: 0, cat: t.category };
      v.total += -t.amount;
      v.qtd++;
      porLoja.set(k, v);
    }
    for (const [k, v] of [...porLoja].sort((a, b) => b[1].total - a[1].total).slice(0, 50)) add(`- ${k}: ${brl(v.total)} | ${v.qtd} | ${v.cat}`);
    add('');
    add('== POR CATEGORIA E MÊS ==');
    const porCat = new Map<string, number>();
    for (const t of fin.transactions) {
      if (!(t.amount < 0) || t.date < diaLocal(agora - 180 * DIA)) continue;
      const k = `${t.date.slice(0, 7)} | ${t.category}`;
      porCat.set(k, (porCat.get(k) ?? 0) + -t.amount);
    }
    for (const [k, v] of [...porCat].sort()) add(`- ${k}: ${brl(v)}`);
    if (nivel === 'detalhado') {
      add('');
      add('== TRANSAÇÕES DOS ÚLTIMOS 60 DIAS (data hora | valor | categoria | descrição | lugar) ==');
      for (const t of recentes.slice(0, 400)) {
        const m = momentoTransacao(t);
        const e = m !== null ? lugarNoMomento(lista, m) : null;
        add(`${t.date} ${t.time ?? '--:--'} | ${t.amount.toFixed(2)} | ${t.category} | ${ocultarPessoas(t.description)}${e ? ` | ${e.nome}` : ''}`);
      }
    }
  }
  if (rotina) {
    add('');
    add('== LUGARES CADASTRADOS ==');
    for (const l of rotina.lugares) add(`- ${l.nome} (${l.categoria})`);
    if (nivel === 'detalhado') {
      add('');
      add('== ESTADIAS DOS ÚLTIMOS 14 DIAS (início → fim | lugar) ==');
      for (const e of lista.filter((x) => x.fim >= agora - 14 * DIA).slice(-150)) add(`${hora(e.inicio)} → ${hora(e.fim)} | ${e.nome}`);
    }
  }
  const pantry = s.smartpantry?.data;
  if (pantry) {
    add('');
    add('== DESPENSA (itens ativos) ==');
    for (const l of pantry.lotes.filter((x) => x.status === 'ativo').slice(0, 120)) add(`- ${l.nome}: ${l.quantidadeRestante} ${l.unidade}${l.validade ? `, validade ${l.validade.slice(0, 10)}` : ''}`);
    add(`Notas fiscais recentes: ${pantry.notas.slice(-10).map((n) => `${n.data.slice(0, 10)} ${n.emitente} ${brl(n.total)}`).join('; ')}`);
  }
  const wish = s.wishwatch?.data;
  if (wish) {
    add('');
    add('== LISTA DE DESEJOS ==');
    for (const w of wish.products.slice(0, 60)) add(`- ${w.name} [${w.status}${w.priority ? `, ${w.priority}` : ''}] preço ${w.currentPrice !== null ? brl(w.currentPrice) : '?'}${w.targetPrice ? `, alvo ${brl(w.targetPrice)}` : ''}${w.lowestPrice ? `, mínimo ${brl(w.lowestPrice)}` : ''}${w.reason ? ` — motivo: ${w.reason}` : ''}`);
  }
  const paper = s.papertrail?.data;
  if (paper) {
    add('');
    add('== BIBLIOTECA (PaperTrail) ==');
    for (const it of paper.items.slice(0, 150)) add(`- ${it.title}${it.authors ? ` — ${it.authors}` : ''}${it.year ? ` (${it.year})` : ''} [${it.status ?? 'sem status'}]${it.tags?.length ? ` tags: ${it.tags.join(', ')}` : ''}`);
  }

  let texto = semCoordenadas(linhas.join('\n'));
  if (texto.length > MAX_CHARS) texto = texto.slice(0, MAX_CHARS) + '\n[... contexto cortado por tamanho]';
  return texto;
}
