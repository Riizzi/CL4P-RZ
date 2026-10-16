import { Clock, MapPin, Receipt, ShoppingBasket, Tag } from 'lucide-react';
import { ROTULO_CATEGORIA_LUGAR } from '../../core/metrics.js';
import { APP_IDS, NOME_FONTE } from '../../core/types.js';
import type { Dados } from '../../services/dados.js';
import { AchadosCard, HumorCard, SaudeHojeCard } from '../BemEstar.tsx';
import { Aviso, Barra, Cartao, Numero, Rotulo, brl, haQuanto, hhmm } from '../kit.tsx';

const rotuloCat = (c: string) => ROTULO_CATEGORIA_LUGAR[c as keyof typeof ROTULO_CATEGORIA_LUGAR] ?? c;

export default function Hoje({ d, irPara }: { d: Dados; irPara: (aba: 'apps' | 'ajustes' | 'cruzamentos') => void }) {
  const { hoje, mercado90d, desejos } = d.painel;
  const horas = Object.entries(hoje.horasHoje).sort((a, b) => b[1] - a[1]);
  const maxHoras = Math.max(1, ...horas.map(([, v]) => v));
  const orc = hoje.orcamentoMes;

  return (
    <div className="space-y-4">
      {d.fonte === 'exemplo' && (
        <Aviso>
          <strong>Dados de exemplo.</strong> Nenhum app enviou dados ainda.{' '}
          <button className="underline font-bold" onClick={() => irPara('apps')}>
            Vincular apps
          </button>
        </Aviso>
      )}
      {d.erro && d.fonte !== 'exemplo' && <Aviso>{d.erro} Mostrando a última cópia salva.</Aviso>}

      <HumorCard />

      <Cartao>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F3EDE3] border border-[#E8DFD1] flex items-center justify-center shrink-0">
            <MapPin className="w-5 h-5 text-[#292524]" />
          </div>
          <div className="min-w-0">
            <Rotulo>Agora</Rotulo>
            {hoje.lugarAtual ? (
              <>
                <p className="font-bold text-base mt-0.5 truncate">{hoje.lugarAtual.nome}</p>
                <p className="text-xs text-[#78716C]">
                  {rotuloCat(hoje.lugarAtual.categoria)} · desde {hhmm(hoje.lugarAtual.desde)}
                </p>
              </>
            ) : (
              <p className="text-sm text-[#78716C] mt-0.5">Sem estadia aberta no RoutineTracker.</p>
            )}
          </div>
        </div>
        {horas.length > 0 && (
          <div className="mt-4 pt-3 border-t border-dashed border-[#E8DFD1] space-y-2.5">
            <Rotulo>Horas hoje</Rotulo>
            {horas.map(([c, h]) => (
              <Barra key={c} rotulo={rotuloCat(c)} valor={h} max={maxHoras} texto={`${h.toLocaleString('pt-BR')} h`} />
            ))}
          </div>
        )}
      </Cartao>

      <SaudeHojeCard d={d} />

      <div className="grid grid-cols-2 gap-3">
        <Numero rotulo="Gasto hoje" valor={brl(hoje.gastoHoje)} />
        <Numero
          rotulo="Gasto no mês"
          valor={brl(hoje.gastoMes, false)}
          detalhe={orc ? `${Math.round((hoje.gastoMes / orc) * 100)}% do orçamento de ${brl(orc, false)}` : undefined}
        />
        <Numero rotulo="Receitas no mês" valor={brl(hoje.receitaMes, false)} />
        <Numero rotulo="Saldo nas contas" valor={hoje.saldoContas === null ? '—' : brl(hoje.saldoContas, false)} detalhe="sem cartão de crédito" />
      </div>

      <AchadosCard d={d} max={2} />

      {hoje.ultimoGasto && (
        <Cartao>
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#78716C]" />
            <Rotulo>Último gasto</Rotulo>
          </div>
          <div className="flex items-baseline justify-between gap-3 mt-2">
            <p className="font-bold truncate">{hoje.ultimoGasto.descricao}</p>
            <p className="font-mono font-bold shrink-0">{brl(hoje.ultimoGasto.valor)}</p>
          </div>
          <p className="text-xs text-[#78716C] mt-0.5">
            {haQuanto(hoje.ultimoGasto.quando)}
            {hoje.ultimoGasto.lugar ? ` · em ${hoje.ultimoGasto.lugar}` : ''}
          </p>
          <button onClick={() => irPara('cruzamentos')} className="mt-3 text-xs font-mono font-bold uppercase text-[#3F6FA8]">
            Ver gasto por lugar →
          </button>
        </Cartao>
      )}

      {mercado90d && (mercado90d.vencendo.length > 0 || mercado90d.essenciaisFaltando.length > 0) && (
        <Cartao>
          <div className="flex items-center gap-2">
            <ShoppingBasket className="w-4 h-4 text-[#78716C]" />
            <Rotulo>Despensa</Rotulo>
          </div>
          {mercado90d.vencendo.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {mercado90d.vencendo.map((v) => (
                <li key={v.nome} className="flex justify-between gap-3 text-sm">
                  <span className="truncate">{v.nome}</span>
                  <span className={`font-mono text-xs shrink-0 ${v.dias < 0 ? 'text-[#B4413A] font-bold' : 'text-[#57534E]'}`}>
                    {v.dias < 0 ? 'vencido' : v.dias === 0 ? 'vence hoje' : `${v.dias} d`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {mercado90d.essenciaisFaltando.length > 0 && (
            <p className="text-sm text-[#57534E] mt-3">
              <strong>Faltando:</strong> {mercado90d.essenciaisFaltando.join(', ')}
            </p>
          )}
        </Cartao>
      )}

      {desejos && desejos.noAlvo.length > 0 && (
        <Cartao>
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-[#78716C]" />
            <Rotulo>No preço-alvo</Rotulo>
          </div>
          <ul className="mt-2 space-y-1.5">
            {desejos.noAlvo.map((w) => (
              <li key={w.nome} className="flex justify-between gap-3 text-sm">
                <span className="truncate">{w.nome}</span>
                <span className="font-mono font-bold shrink-0">{brl(w.preco)}</span>
              </li>
            ))}
          </ul>
        </Cartao>
      )}

      <Cartao>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#78716C]" />
          <Rotulo>Última atualização de cada app</Rotulo>
        </div>
        <ul className="mt-2 divide-y divide-dashed divide-[#E8DFD1]">
          {APP_IDS.map((id) => {
            const e = d.snapshots[id];
            return (
              <li key={id} className="flex justify-between gap-3 py-2 text-sm">
                <span>{NOME_FONTE[id]}</span>
                <span className={`font-mono text-xs ${e ? 'text-[#57534E]' : 'text-[#A8A29E]'}`}>{e ? haQuanto(Date.parse(e.generatedAt)) : 'não vinculado'}</span>
              </li>
            );
          })}
        </ul>
      </Cartao>
    </div>
  );
}
