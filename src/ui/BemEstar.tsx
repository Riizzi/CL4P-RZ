import { Activity, Lightbulb, Moon, Smile } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { Grupo } from '../core/bemestar.js';
import { MIN_DIAS } from '../core/bemestar.js';
import type { HumorRegistro } from '../core/types.js';
import type { Dados } from '../services/dados.js';
import { ETIQUETAS, ROTULOS_HUMOR, registrarHumor, useHumor } from '../services/humor.js';
import { Barra, Botao, Cartao, Numero, Rotulo, brl, hhmm } from './kit.tsx';

const NOTAS: HumorRegistro['nota'][] = [1, 2, 3, 4, 5];
const fmt = (v: number | null | undefined, casas = 1) => (v === null || v === undefined ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }));

// ------------------------------------------------------------------ registro de humor

export function HumorCard() {
  const registros = useHumor();
  const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const deHoje = registros.filter((r) => new Date(r.ts).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }) === hoje);
  const ultimo = deHoje[deHoje.length - 1];
  const [nota, setNota] = useState<HumorRegistro['nota'] | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [texto, setTexto] = useState('');
  const [editando, setEditando] = useState(!ultimo);

  if (!editando && ultimo) {
    return (
      <Cartao>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Smile className="w-4 h-4 text-[#78716C]" />
            <Rotulo>Humor de hoje</Rotulo>
          </div>
          <button onClick={() => setEditando(true)} className="text-xs font-mono font-bold uppercase text-[#3F6FA8] min-h-9">
            Registrar de novo
          </button>
        </div>
        <p className="mt-2 text-sm">
          <span className="font-mono font-bold text-lg">{ultimo.nota}</span> · {ROTULOS_HUMOR[ultimo.nota]} <span className="text-[#78716C]">às {hhmm(ultimo.ts)}</span>
        </p>
        {ultimo.tags?.length ? <p className="text-xs text-[#78716C] mt-1">{ultimo.tags.join(' · ')}</p> : null}
      </Cartao>
    );
  }

  return (
    <Cartao className="space-y-3">
      <div className="flex items-center gap-2">
        <Smile className="w-4 h-4 text-[#78716C]" />
        <Rotulo>Como está o dia?</Rotulo>
      </div>
      <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Humor de 1 a 5">
        {NOTAS.map((n) => (
          <button
            key={n}
            role="radio"
            aria-checked={nota === n}
            onClick={() => setNota(n)}
            className={`min-h-16 rounded-xl flex flex-col items-center justify-center gap-0.5 retro-press ${nota === n ? 'bg-[#292524] text-[#FAF7F2] border border-[#292524]' : 'bg-[#FAF7F2] text-[#292524] border border-[#E8DFD1]'}`}
          >
            <span className="font-mono font-bold text-lg leading-none">{n}</span>
            <span className={`text-[10px] ${nota === n ? 'text-[#E8DFD1]' : 'text-[#78716C]'}`}>{ROTULOS_HUMOR[n]}</span>
          </button>
        ))}
      </div>
      {nota !== null && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {ETIQUETAS.map((t) => {
              const on = tags.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => setTags(on ? tags.filter((x) => x !== t) : [...tags, t])}
                  aria-pressed={on}
                  className={`text-xs px-2.5 min-h-8 rounded-lg border ${on ? 'bg-[#F3EDE3] border-[#292524] text-[#292524] font-bold' : 'bg-[#FFFDF9] border-[#E8DFD1] text-[#57534E]'}`}
                >
                  {t}
                </button>
              );
            })}
          </div>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={2}
            placeholder="Anotação (opcional; não vai para a IA)"
            className="w-full resize-none bg-[#FAF7F2] border border-[#E8DFD1] rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#3F6FA8]"
          />
          <div className="flex gap-2">
            {ultimo && (
              <Botao onClick={() => setEditando(false)} className="flex-1">
                Cancelar
              </Botao>
            )}
            <Botao
              variante="primario"
              className="flex-1 !bg-[#292524] !border-[#292524]"
              onClick={() => {
                registrarHumor(nota, tags, texto);
                setNota(null);
                setTags([]);
                setTexto('');
                setEditando(false);
              }}
            >
              Salvar
            </Botao>
          </div>
        </>
      )}
    </Cartao>
  );
}

// ------------------------------------------------------------------ saúde de hoje

export function SaudeHojeCard({ d }: { d: Dados }) {
  const b = d.bemEstar;
  if (!b.temSaude) return null;
  const a = b.semanas.atual;
  return (
    <Cartao>
      <div className="flex items-center gap-2">
        <Moon className="w-4 h-4 text-[#78716C]" />
        <Rotulo>Sono e corpo</Rotulo>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-3">
        <div>
          <p className="text-[10px] font-mono uppercase text-[#78716C]">Última noite</p>
          <p className="font-mono font-bold text-lg">{b.ultimaNoite?.sonoH ? `${fmt(b.ultimaNoite.sonoH)} h` : '—'}</p>
          {b.ultimaNoite?.dormiu && b.ultimaNoite.acordou && (
            <p className="text-[11px] text-[#78716C]">
              {hhmm(b.ultimaNoite.dormiu)} → {hhmm(b.ultimaNoite.acordou)}
            </p>
          )}
        </div>
        <div>
          <p className="text-[10px] font-mono uppercase text-[#78716C]">Sono médio (7 dias)</p>
          <p className="font-mono font-bold text-lg">{a.sonoH !== null ? `${fmt(a.sonoH)} h` : '—'}</p>
        </div>
        <div>
          <p className="text-[10px] font-mono uppercase text-[#78716C]">Passos por dia (7 dias)</p>
          <p className="font-mono font-bold text-lg">{a.passos !== null ? a.passos.toLocaleString('pt-BR') : '—'}</p>
        </div>
        <div>
          <p className="text-[10px] font-mono uppercase text-[#78716C]">Treinos (7 dias)</p>
          <p className="font-mono font-bold text-lg">{a.treinos}</p>
        </div>
      </div>
    </Cartao>
  );
}

// ------------------------------------------------------------------ achados

export function AchadosCard({ d, max = 3 }: { d: Dados; max?: number }) {
  const lista = d.bemEstar.achados.slice(0, max);
  if (!lista.length) return null;
  return (
    <Cartao>
      <div className="flex items-center gap-2">
        <Lightbulb className="w-4 h-4 text-[#78716C]" />
        <Rotulo>O que os seus dados mostram</Rotulo>
      </div>
      <ul className="mt-2 space-y-2">
        {lista.map((a) => (
          <li key={a.texto} className="text-sm leading-relaxed text-[#292524] pl-3 border-l-2 border-[#E8DFD1]">
            {a.texto}
          </li>
        ))}
      </ul>
    </Cartao>
  );
}

// ------------------------------------------------------------------ seções de bem-estar (aba Cruzar)

function Secao({ titulo, fontes, children }: { titulo: string; fontes: string; children: ReactNode }) {
  return (
    <section>
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

function Pouco({ g }: { g: Grupo }) {
  return g.diasHumor < MIN_DIAS ? <span className="text-[#A8A29E]"> · poucos dias</span> : null;
}

function BarrasHumor({ grupos }: { grupos: Grupo[] }) {
  const com = grupos.filter((g) => g.humor !== null);
  if (!com.length) return <p className="text-sm text-[#78716C]">Registre o humor por alguns dias para ver este cruzamento.</p>;
  return (
    <div className="space-y-3.5">
      {com.map((g) => (
        <Barra
          key={g.rotulo}
          rotulo={g.rotulo}
          valor={g.humor! - 1}
          max={4}
          texto={fmt(g.humor, 1)}
          cor={g.diasHumor < MIN_DIAS ? '#B8B2A7' : '#3F6FA8'}
          sub={`${g.diasHumor} dias com humor${g.sonoH !== null ? ` · sono ${fmt(g.sonoH)} h` : ''}${g.passos !== null ? ` · ${g.passos.toLocaleString('pt-BR')} passos` : ''}`}
        />
      ))}
    </div>
  );
}

function Tabela({ cab, linhas }: { cab: string[]; linhas: (string | ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full text-sm">
        <thead>
          <tr>
            {cab.map((c, i) => (
              <th key={c} className={`text-[10px] font-mono font-bold uppercase text-[#78716C] pb-2 ${i ? 'text-right' : 'text-left'}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} className="border-t border-dashed border-[#E8DFD1]">
              {l.map((c, j) => (
                <td key={j} className={`py-2 ${j ? 'text-right font-mono' : 'pr-2'}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const delta = (a: number | null, b: number | null, casas = 1, sufixo = '') => {
  if (a === null || b === null) return undefined;
  const d = a - b;
  if (Math.abs(d) < 10 ** -casas) return 'igual à semana anterior';
  return `${d > 0 ? '+' : '−'}${fmt(Math.abs(d), casas)}${sufixo} vs semana anterior`;
};

export function BemEstarSecoes({ d }: { d: Dados }) {
  const b = d.bemEstar;
  const s = b.semanas;
  return (
    <div className="space-y-5">
      <AchadosCard d={d} max={5} />

      <Secao titulo="Humor por tipo de dia" fontes="Humor × RoutineTracker × relógio · 60 dias">
        <p className="text-xs text-[#78716C] leading-relaxed">
          O tipo do dia vem da rotina registrada: trabalho (3 h ou mais), treino (relógio ou academia), UFMG (1 h ou mais) e saída (2 h ou mais fora de casa em lazer ou lugar novo). Humor de 1 a 5.
        </p>
        <BarrasHumor grupos={b.porTipoDia} />
      </Secao>

      <Secao titulo="Humor por dia da semana" fontes="Humor · 60 dias">
        <BarrasHumor grupos={b.porDiaSemana} />
      </Secao>

      <Secao titulo="Sono da noite × o dia seguinte" fontes="Relógio × Humor × RetroFin">
        {b.porSono.length ? (
          <>
            <Tabela
              cab={['Sono', 'Humor', 'Impulso/dia', 'Dias']}
              linhas={b.porSono.map((g) => [
                <span key="r">
                  {g.rotulo}
                  <Pouco g={g} />
                </span>,
                fmt(g.humor),
                g.gastoImpulso !== null ? brl(g.gastoImpulso, false) : '—',
                String(g.dias),
              ])}
            />
            <p className="text-[11px] text-[#78716C]">Impulso: delivery, lanches, cafés, lazer e compras no dia.</p>
          </>
        ) : (
          <p className="text-sm text-[#78716C]">Precisa do sono vindo do relógio (Ajustes → Saúde).</p>
        )}
      </Secao>

      <Secao titulo="Humor × gastos do dia" fontes="Humor × RetroFin">
        {b.porHumor.some((g) => g.dias) ? (
          <Tabela
            cab={['Dia', 'Gasto total', 'Impulso', 'Dias']}
            linhas={b.porHumor.map((g) => [g.rotulo, g.gasto !== null ? brl(g.gasto, false) : '—', g.gastoImpulso !== null ? brl(g.gastoImpulso, false) : '—', String(g.dias)])}
          />
        ) : (
          <p className="text-sm text-[#78716C]">Registre o humor por alguns dias para ver este cruzamento.</p>
        )}
      </Secao>

      <Secao titulo="Dias com treino" fontes="Relógio × RoutineTracker × Humor">
        <div className="grid grid-cols-2 gap-3">
          <Numero rotulo="Humor com treino" valor={fmt(b.treino.com.humor)} detalhe={`${b.treino.com.diasHumor} dias`} />
          <Numero rotulo="Humor sem treino" valor={fmt(b.treino.sem.humor)} detalhe={`${b.treino.sem.diasHumor} dias`} />
          <Numero rotulo="Sono depois do treino" valor={b.treino.sonoDepoisCom !== null ? `${fmt(b.treino.sonoDepoisCom)} h` : '—'} />
          <Numero rotulo="Sono nos outros dias" valor={b.treino.sonoDepoisSem !== null ? `${fmt(b.treino.sonoDepoisSem)} h` : '—'} />
        </div>
      </Secao>

      <Secao titulo="Últimos 7 dias" fontes="Relógio × Humor">
        <div className="grid grid-cols-2 gap-3">
          <Numero rotulo="Sono médio" valor={s.atual.sonoH !== null ? `${fmt(s.atual.sonoH)} h` : '—'} detalhe={delta(s.atual.sonoH, s.anterior.sonoH, 1, ' h')} />
          <Numero rotulo="Passos por dia" valor={s.atual.passos !== null ? s.atual.passos.toLocaleString('pt-BR') : '—'} detalhe={delta(s.atual.passos, s.anterior.passos, 0)} />
          <Numero rotulo="Treinos" valor={String(s.atual.treinos)} detalhe={delta(s.atual.treinos, s.anterior.treinos, 0)} />
          <Numero rotulo="FC em repouso" valor={s.atual.fcRepouso !== null ? `${s.atual.fcRepouso} bpm` : '—'} detalhe={delta(s.atual.fcRepouso, s.anterior.fcRepouso, 0, ' bpm')} />
        </div>
        <div className="flex items-center gap-2 text-xs text-[#78716C]">
          <Activity className="w-3.5 h-3.5" />
          Humor médio da semana: <strong className="font-mono text-[#292524]">{fmt(s.atual.humor)}</strong>
          {delta(s.atual.humor, s.anterior.humor, 1) ? ` (${delta(s.atual.humor, s.anterior.humor, 1)})` : ''}
        </div>
      </Secao>
    </div>
  );
}
