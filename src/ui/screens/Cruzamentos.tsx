import { useState, type ReactNode } from 'react';
import type { Dados } from '../../services/dados.js';
import { BemEstarSecoes } from '../BemEstar.tsx';
import { Barra, Cartao, Numero, brl, dataCurta } from '../kit.tsx';

const AZUL = '#3F6FA8';
const COBRE = '#C07A3E';
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function Secao({ titulo, fontes, children }: { titulo: string; fontes: string; children: ReactNode }) {
  return (
    <section className="space-y-0">
      <div className="flex gap-1 pl-3">
        <span className="aba">{fontes}</span>
      </div>
      <Cartao className="space-y-3">
        <h2 className="font-bold text-[15px]">{titulo}</h2>
        {children}
      </Cartao>
    </section>
  );
}

function SemDados({ texto }: { texto: string }) {
  return <p className="text-sm text-[#78716C]">{texto}</p>;
}

export default function Cruzamentos({ d }: { d: Dados }) {
  const [porTipo, setPorTipo] = useState(false);
  const [visao, setVisao] = useState<'bemestar' | 'dinheiro'>(() => {
    try {
      return (sessionStorage.getItem('cl4p.cruzar') as 'bemestar' | 'dinheiro') || 'bemestar';
    } catch {
      return 'bemestar';
    }
  });
  const escolher = (v: 'bemestar' | 'dinheiro') => {
    setVisao(v);
    try {
      sessionStorage.setItem('cl4p.cruzar', v);
    } catch {
      /* ignora */
    }
  };
  const seletor = (
    <div className="flex bg-[#F3EDE3] rounded-xl p-1 text-xs font-bold sticky top-0 z-10" role="tablist">
      {[
        ['bemestar', 'Bem-estar'],
        ['dinheiro', 'Dinheiro e rotina'],
      ].map(([v, r]) => (
        <button key={v} role="tab" aria-selected={visao === v} onClick={() => escolher(v as 'bemestar' | 'dinheiro')} className={`flex-1 min-h-10 rounded-lg ${visao === v ? 'bg-[#FFFDF9] retro-shadow-sm text-[#292524]' : 'text-[#78716C]'}`}>
          {r}
        </button>
      ))}
    </div>
  );
  if (visao === 'bemestar')
    return (
      <div className="space-y-5">
        {seletor}
        <BemEstarSecoes d={d} />
      </div>
    );
  const p = d.painel;
  const g = p.gastoPorLugar30d;
  const linhas = porTipo ? g.porCategoria.map((c) => ({ chave: c.categoria, nome: c.rotulo, total: c.total, sub: `${c.qtd} compras` })) : g.linhas.slice(0, 10).map((l) => ({ chave: l.chave, nome: l.nome, total: l.total, sub: `${l.qtd} compras · ticket ${brl(l.ticketMedio)} · ${l.principais.map((x) => x.descricao).join(', ')}` }));
  const maxG = Math.max(1, ...linhas.map((l) => l.total));

  return (
    <div className="space-y-5">
      {seletor}
      <Secao titulo="Quanto você gasta em cada lugar" fontes="RetroFin × RoutineTracker · 30 dias">
        {g.totalAnalisado === 0 ? (
          <SemDados texto="Precisa de transações no RetroFin e estadias no RoutineTracker." />
        ) : (
          <>
            <div className="flex bg-[#F3EDE3] rounded-xl p-1 text-xs font-bold" role="tablist">
              {[
                ['Por lugar', false],
                ['Por tipo de lugar', true],
              ].map(([r, v]) => (
                <button
                  key={String(r)}
                  role="tab"
                  aria-selected={porTipo === v}
                  onClick={() => setPorTipo(v as boolean)}
                  className={`flex-1 min-h-9 rounded-lg ${porTipo === v ? 'bg-[#FFFDF9] retro-shadow-sm text-[#292524]' : 'text-[#78716C]'}`}
                >
                  {r as string}
                </button>
              ))}
            </div>
            <div className="space-y-3.5">
              {linhas.map((l) => (
                <Barra key={l.chave} rotulo={l.nome} valor={l.total} max={maxG} texto={brl(l.total, false)} sub={l.sub} />
              ))}
            </div>
            <p className="text-[11px] text-[#78716C] leading-relaxed border-t border-dashed border-[#E8DFD1] pt-2">
              {g.cobertura}% do valor gasto foi localizado. {g.semHorario.qtd > 0 && `${g.semHorario.qtd} lançamentos sem horário (${brl(g.semHorario.total, false)}, em geral extrato importado) ficam de fora. `}
              O horário da compra é comparado com a estadia registrada, com tolerância de 10 min.
            </p>
          </>
        )}
      </Secao>

      <Secao titulo="Dias de treino × gasto do dia" fontes="RoutineTracker × RetroFin · 30 dias">
        {p.academia30d ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Numero rotulo="Com treino" valor={brl(p.academia30d.gastoMedioComTreino, false)} detalhe={`média por dia · ${p.academia30d.diasComTreino} dias`} />
              <Numero rotulo="Sem treino" valor={brl(p.academia30d.gastoMedioSemTreino, false)} detalhe={`média por dia · ${p.academia30d.diasSemTreino} dias`} />
            </div>
            <p className="text-sm text-[#57534E]">Gasto com saúde, farmácia e suplementos: <strong className="font-mono">{brl(p.academia30d.gastoSaude)}</strong></p>
            <p className="text-[11px] text-[#78716C]">Conta como treino uma estadia de 20 min ou mais num lugar da categoria Saúde / Academia.</p>
          </>
        ) : (
          <SemDados texto="Precisa do RetroFin e do RoutineTracker vinculados." />
        )}
      </Secao>

      <Secao titulo="Mercado no banco × notas da despensa" fontes="RetroFin × SmartPantry · 90 dias">
        {p.mercado90d && p.mercado90d.meses.length ? (
          <>
            <div className="flex gap-4 text-xs text-[#57534E]">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: AZUL }} /> Gasto em mercado (banco)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: COBRE }} /> Notas lidas
              </span>
            </div>
            {(() => {
              const max = Math.max(1, ...p.mercado90d.meses.flatMap((m) => [m.financeiro, m.notas]));
              return p.mercado90d.meses.map((m) => (
                <div key={m.mes} className="space-y-1">
                  <p className="text-xs font-mono text-[#78716C]">{m.mes.split('-').reverse().join('/')}</p>
                  <Barra rotulo="Banco" valor={m.financeiro} max={max} texto={brl(m.financeiro, false)} cor={AZUL} />
                  <Barra rotulo="Notas" valor={m.notas} max={max} texto={brl(m.notas, false)} cor={COBRE} />
                </div>
              ));
            })()}
            <div className="grid grid-cols-2 gap-3">
              <Numero rotulo="Notas conciliadas" valor={`${p.mercado90d.notasConciliadas}/${p.mercado90d.notasTotal}`} detalhe="mesmo valor no extrato" />
              <Numero rotulo="Desperdício" valor={brl(p.mercado90d.desperdicio)} detalhe="itens descartados" />
            </div>
          </>
        ) : (
          <SemDados texto="Precisa de gastos de mercado no RetroFin ou notas no SmartPantry." />
        )}
      </Secao>

      <Secao titulo="Lista de desejos × sobra do mês" fontes="WishWatch × RetroFin">
        {p.desejos ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Numero rotulo="Desejos" valor={brl(p.desejos.totalDesejos, false)} detalhe={`${p.desejos.monitorando} itens monitorados`} />
              <Numero rotulo="Sobra média" valor={brl(p.desejos.sobraMensal, false)} detalhe="por mês, últimos 90 dias" />
            </div>
            <p className="text-sm text-[#57534E]">
              {p.desejos.mesesParaTudo !== null
                ? `Com essa sobra, a lista inteira cabe em cerca de ${p.desejos.mesesParaTudo.toLocaleString('pt-BR')} meses.`
                : 'Nos últimos 90 dias os gastos passaram das receitas.'}
            </p>
            {p.desejos.cabemNaSobra.length > 0 && (
              <p className="text-sm text-[#57534E]">
                <strong>Cabem na sobra de um mês:</strong> {p.desejos.cabemNaSobra.map((x) => x.nome).join(', ')}
              </p>
            )}
            {p.desejos.economizado > 0 && <p className="text-sm text-[#57534E]">Economia registrada em compras: <strong className="font-mono">{brl(p.desejos.economizado)}</strong></p>}
          </>
        ) : (
          <SemDados texto="Precisa do WishWatch vinculado." />
        )}
      </Secao>

      <Secao titulo="Horas de estudo × leituras" fontes="RoutineTracker × PaperTrail · 8 semanas">
        {p.estudo8s.some((w) => w.horasEstudo || w.textosAdicionados || w.textosLidos) ? (
          (() => {
            const max = Math.max(1, ...p.estudo8s.map((w) => w.horasEstudo));
            return (
              <div className="space-y-3">
                {p.estudo8s.map((w) => (
                  <Barra
                    key={w.semana}
                    rotulo={`Semana de ${dataCurta(Date.parse(w.semana + 'T12:00:00-03:00'))}`}
                    valor={w.horasEstudo}
                    max={max}
                    texto={`${w.horasEstudo.toLocaleString('pt-BR')} h`}
                    sub={`${w.textosAdicionados} textos adicionados · ${w.textosLidos} lidos`}
                  />
                ))}
              </div>
            );
          })()
        ) : (
          <SemDados texto="Cadastre a UFMG como lugar de Estudo no RoutineTracker e vincule o PaperTrail." />
        )}
      </Secao>

      <Secao titulo="Quando o dinheiro sai" fontes="RetroFin · 90 dias">
        {p.ritmo90d.maximo > 0 ? (
          <>
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full border-separate" style={{ borderSpacing: 2 }}>
                <thead>
                  <tr>
                    <th />
                    {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
                      <th key={h} className="text-[9px] font-mono font-normal text-[#78716C]">
                        {h}h
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {p.ritmo90d.matriz.map((linha, dow) => (
                    <tr key={dow}>
                      <th className="text-[10px] font-mono font-normal text-[#78716C] text-left pr-1">{DIAS[dow]}</th>
                      {linha.map((v, f) => (
                        <td
                          key={f}
                          title={`${DIAS[dow]}, ${f * 3}h–${f * 3 + 3}h: ${brl(v)}`}
                          className="h-7 rounded-md"
                          style={{ background: v ? `color-mix(in oklab, ${AZUL} ${Math.round(12 + (v / p.ritmo90d.maximo) * 88)}%, #FFFDF9)` : '#F3EDE3' }}
                        />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-[#57534E]">Pico de gastos: <strong>{p.ritmo90d.picoTexto}</strong>. Quanto mais escuro, mais dinheiro saiu naquela faixa.</p>
          </>
        ) : (
          <SemDados texto="Precisa de transações com horário (as que entram pela notificação do banco)." />
        )}
      </Secao>

      {p.rotmg && (
        <Secao titulo="Realm of the Mad God" fontes="RotMG Account Manager">
          <div className="grid grid-cols-2 gap-3">
            <Numero rotulo="Personagens" valor={String(p.rotmg.personagens)} detalhe={`${p.rotmg.maxados8} com 8/8`} />
            <Numero rotulo="Mortes" valor={String(p.rotmg.mortes)} detalhe={`${p.rotmg.famaPerdida.toLocaleString('pt-BR')} de fama`} />
          </div>
          {p.rotmg.classeMaisMorta && <p className="text-sm text-[#57534E]">Classe que mais morreu: <strong>{p.rotmg.classeMaisMorta}</strong></p>}
        </Secao>
      )}

    </div>
  );
}
