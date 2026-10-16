import { ArrowUp, Trash2 } from 'lucide-react';
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { conversar, type MsgChat } from '../../services/api.js';
import { getConfig } from '../../services/config.js';
import type { Dados } from '../../services/dados.js';

const CHAVE = 'cl4p.chat.v1';
const SUGESTOES = [
  'Onde eu mais gastei este mês?',
  'Quanto gastei no trabalho nos últimos 30 dias?',
  'Fui quantas vezes na academia esta semana?',
  'O que está vencendo na despensa?',
  'Dá para comprar algo da minha wishlist este mês?',
  'Quantas horas estudei esta semana?',
];

function carregar(): MsgChat[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) || '[]');
    return Array.isArray(v) ? v.slice(-60) : [];
  } catch {
    return [];
  }
}

/** Markdown mínimo e seguro: negrito, itálico, listas e parágrafos (sem HTML). */
function inline(txt: string): ReactNode[] {
  const partes = txt.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g);
  return partes.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (/^\*[^*]+\*$/.test(p)) return <em key={i}>{p.slice(1, -1)}</em>;
    return <Fragment key={i}>{p}</Fragment>;
  });
}

function Markdown({ texto }: { texto: string }) {
  const blocos: ReactNode[] = [];
  let lista: { tipo: 'ul' | 'ol'; itens: string[] } | null = null;
  const fecharLista = () => {
    if (!lista) return;
    const Tag = lista.tipo;
    blocos.push(
      <Tag key={blocos.length}>
        {lista.itens.map((it, i) => (
          <li key={i}>{inline(it)}</li>
        ))}
      </Tag>,
    );
    lista = null;
  };
  for (const linha of texto.split('\n')) {
    const ul = linha.match(/^\s*[-*•]\s+(.*)/);
    const ol = linha.match(/^\s*\d+[.)]\s+(.*)/);
    if (ul || ol) {
      const tipo = ul ? 'ul' : 'ol';
      if (lista && lista.tipo !== tipo) fecharLista();
      lista ??= { tipo, itens: [] };
      lista.itens.push((ul || ol)![1]);
      continue;
    }
    fecharLista();
    if (linha.trim()) blocos.push(<p key={blocos.length}>{inline(linha.replace(/^#+\s*/, ''))}</p>);
  }
  fecharLista();
  return <div className="chat-md">{blocos}</div>;
}

export default function Chat({ d }: { d: Dados }) {
  const [msgs, setMsgs] = useState<MsgChat[]>(carregar);
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(msgs.slice(-60)));
    } catch {
      /* sem armazenamento */
    }
    fim.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [msgs, pensando]);

  const semChave = !getConfig().token;

  async function enviar(pergunta: string) {
    const q = pergunta.trim();
    if (!q || pensando) return;
    const nova = [...msgs, { role: 'user' as const, text: q }];
    setMsgs(nova);
    setTexto('');
    setErro(null);
    setPensando(true);
    try {
      const { text } = await conversar(nova.slice(-16), getConfig().chatDetalhado ? 'detalhado' : 'resumo');
      setMsgs([...nova, { role: 'model', text }]);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setPensando(false);
    }
  }

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 space-y-3 pb-4">
        {msgs.length === 0 && (
          <div className="bg-[#FFFDF9] rounded-2xl p-4 retro-shadow space-y-3">
            <p className="font-mono text-[11px] font-bold uppercase text-[#78716C]">CL4P-RZ</p>
            <p className="text-sm leading-relaxed">
              *bip* Unidade CL4P-RZ online! Pergunte qualquer coisa sobre seus gastos, lugares, despensa, desejos, leituras ou o seu exército de personagens no RotMG.
              {d.fonte === 'exemplo' && ' (Por enquanto só tenho dados de exemplo nos circuitos.)'}
            </p>
            <p className="text-[11px] text-[#78716C] leading-relaxed">
              As respostas vêm do Gemini no plano gratuito, em que o Google pode usar as conversas para melhorar os modelos. Por isso vão só totais e métricas, sem nomes de pessoas nem coordenadas{getConfig().chatDetalhado ? ' (a lista de lançamentos está ligada em Ajustes)' : ''}.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGESTOES.map((s) => (
                <button key={s} onClick={() => void enviar(s)} disabled={semChave} className="text-left text-xs px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] retro-press disabled:opacity-40">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {msgs.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] bg-[#292524] text-[#FAF7F2] rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">{m.text}</div>
            </div>
          ) : (
            <div key={i} className="flex">
              <div className="max-w-[92%] bg-[#FFFDF9] retro-shadow rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm leading-relaxed">
                <p className="font-mono text-[10px] font-bold uppercase text-[#78716C] mb-1">CL4P-RZ</p>
                <Markdown texto={m.text} />
              </div>
            </div>
          ),
        )}
        {pensando && (
          <div className="flex">
            <div className="bg-[#FFFDF9] retro-shadow rounded-2xl rounded-bl-md px-4 py-3 font-mono text-sm pisca" aria-label="Pensando">
              <span>●</span> <span>●</span> <span>●</span>
            </div>
          </div>
        )}
        {erro && <p className="text-sm text-[#B4413A] bg-[#B4413A]/8 border border-[#B4413A]/25 rounded-xl p-3">{erro}</p>}
        {semChave && <p className="text-sm text-[#57534E]">Configure o servidor e a chave em Ajustes para conversar.</p>}
        <div ref={fim} />
      </div>

      <form
        className="sticky bottom-0 -mx-4 px-4 pt-2 pb-3 bg-[#FAF7F2] border-t border-[#E8DFD1] flex gap-2 items-end"
        onSubmit={(e) => {
          e.preventDefault();
          void enviar(texto);
        }}
      >
        {msgs.length > 0 && (
          <button type="button" onClick={() => setMsgs([])} className="w-11 h-11 shrink-0 rounded-xl bg-[#FFFDF9] retro-shadow-sm flex items-center justify-center text-[#78716C]" aria-label="Limpar conversa">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void enviar(texto);
            }
          }}
          rows={1}
          placeholder="Pergunte ao CL4P-RZ"
          className="flex-1 resize-none max-h-32 bg-[#FFFDF9] border border-[#E8DFD1] rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#3F6FA8]"
        />
        <button type="submit" disabled={!texto.trim() || pensando || semChave} className="w-11 h-11 shrink-0 rounded-xl bg-[#292524] text-[#FAF7F2] flex items-center justify-center retro-press disabled:opacity-30" aria-label="Enviar">
          <ArrowUp className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
