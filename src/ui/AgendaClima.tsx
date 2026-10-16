import { CalendarDays, CloudRain, CloudSun, Sun, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { diaLocal } from '../core/metrics.js';
import type { AgendaEvento, ClimaDia } from '../core/types.js';
import { configurarExternos, externos, type Externos } from '../services/api.js';
import type { Dados } from '../services/dados.js';
import { Botao, Campo, Cartao, Rotulo, estiloInput, haQuanto, hhmm } from './kit.tsx';

/** Códigos WMO do Open-Meteo, resumidos. */
export function descricaoTempo(codigo: number): string {
  if (codigo === 0) return 'Céu limpo';
  if (codigo <= 2) return 'Poucas nuvens';
  if (codigo === 3) return 'Nublado';
  if (codigo <= 48) return 'Neblina';
  if (codigo <= 57) return 'Garoa';
  if (codigo <= 67) return 'Chuva';
  if (codigo <= 77) return 'Neve';
  if (codigo <= 82) return 'Pancadas de chuva';
  return 'Tempestade';
}

function IconeTempo({ c, className = 'w-4 h-4' }: { c: ClimaDia; className?: string }) {
  if (c.chuvaMm >= 2 || (c.codigo >= 51 && c.codigo <= 99)) return <CloudRain className={className} />;
  if (c.codigo <= 1) return <Sun className={className} />;
  return <CloudSun className={className} />;
}

const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const graus = (v: number) => `${Math.round(v)}°`;

// ------------------------------------------------------------------ cartão da tela Hoje

export function HojeLaForaCard({ d, irPara }: { d: Dados; irPara: (aba: 'ajustes') => void }) {
  const clima = d.snapshots.clima?.data;
  const agenda = d.snapshots.agenda?.data;
  if (!clima && !agenda) {
    return (
      <Cartao className="space-y-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-[#78716C]" />
          <Rotulo>Agenda e clima</Rotulo>
        </div>
        <p className="text-sm text-[#57534E]">Conecte a sua agenda e veja o tempo do dia aqui.</p>
        <button className="text-sm font-bold underline" onClick={() => irPara('ajustes')}>
          Configurar em Ajustes
        </button>
      </Cartao>
    );
  }
  const agora = Date.now();
  const hoje = diaLocal(agora);
  const amanha = diaLocal(agora + 86_400_000);
  const climaHoje = clima?.dias.find((c) => c.dia === hoje);
  const proximos = clima?.dias.filter((c) => c.dia > hoje).slice(0, 4) ?? [];
  const doDia = (dia: string) => (agenda?.eventos ?? []).filter((e) => diaLocal(e.inicio) === dia && !e.livre);
  const deHoje = doDia(hoje).filter((e) => e.diaInteiro || e.fim > agora);
  const deAmanha = doDia(amanha);

  const Evento = ({ e }: { e: AgendaEvento }) => (
    <li className="flex gap-3 text-sm">
      <span className="font-mono text-xs text-[#78716C] w-12 shrink-0 pt-0.5">{e.diaInteiro ? 'dia' : hhmm(e.inicio)}</span>
      <span className="min-w-0 truncate">{e.titulo}</span>
    </li>
  );

  return (
    <Cartao className="space-y-3">
      {climaHoje && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] flex items-center justify-center shrink-0">
              <IconeTempo c={climaHoje} className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold">{descricaoTempo(climaHoje.codigo)}</p>
              <p className="text-xs text-[#78716C] truncate">
                {clima!.local}
                {climaHoje.chuvaMm > 0 ? ` · ${climaHoje.chuvaMm.toLocaleString('pt-BR')} mm` : ''}
              </p>
            </div>
          </div>
          <p className="font-mono font-bold text-lg shrink-0">
            {graus(climaHoje.tMax)} <span className="text-[#A8A29E] text-sm">{graus(climaHoje.tMin)}</span>
          </p>
        </div>
      )}
      {proximos.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {proximos.map((c) => (
            <div key={c.dia} className="rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] py-2 flex flex-col items-center gap-1">
              <span className="text-[10px] font-mono uppercase text-[#78716C]">{DOW[new Date(`${c.dia}T12:00:00-03:00`).getUTCDay()]}</span>
              <IconeTempo c={c} />
              <span className="text-xs font-mono">
                {graus(c.tMax)}
                <span className="text-[#A8A29E]">/{graus(c.tMin)}</span>
              </span>
            </div>
          ))}
        </div>
      )}
      {agenda && (
        <div className={climaHoje ? 'pt-3 border-t border-dashed border-[#E8DFD1] space-y-2' : 'space-y-2'}>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-[#78716C]" />
            <Rotulo>Agenda de hoje</Rotulo>
          </div>
          {deHoje.length ? (
            <ul className="space-y-1.5">
              {deHoje.slice(0, 6).map((e) => (
                <Evento key={`${e.inicio}-${e.titulo}`} e={e} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[#78716C]">Nada marcado pelo resto do dia.</p>
          )}
          {deAmanha.length > 0 && (
            <p className="text-xs text-[#78716C]">
              Amanhã: {deAmanha.filter((e) => !e.diaInteiro).length} compromisso{deAmanha.filter((e) => !e.diaInteiro).length === 1 ? '' : 's'}
              {deAmanha.find((e) => !e.diaInteiro) ? `, o primeiro às ${hhmm(deAmanha.find((e) => !e.diaInteiro)!.inicio)}` : ''}
            </p>
          )}
        </div>
      )}
    </Cartao>
  );
}

// ------------------------------------------------------------------ Ajustes

export function AgendaClimaAjustes({ aoMudar }: { aoMudar: () => void }) {
  const [info, setInfo] = useState<Externos | null>(null);
  const [nome, setNome] = useState('');
  const [url, setUrl] = useState('');
  const [cidade, setCidade] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    externos(0)
      .then(setInfo)
      .catch((e) => setMsg((e as Error).message));
  }, []);

  const rodar = async (f: () => Promise<Externos>, ok: string) => {
    setOcupado(true);
    setMsg(null);
    try {
      const x = await f();
      setInfo(x);
      const erro = [x.status.agenda.erro, x.status.clima.erro].filter(Boolean).join(' · ');
      setMsg(erro || ok);
      aoMudar();
      return true;
    } catch (e) {
      setMsg((e as Error).message);
      return false;
    } finally {
      setOcupado(false);
    }
  };

  const st = info?.status;
  return (
    <Cartao className="space-y-3">
      <div className="flex items-center gap-2">
        <CalendarDays className="w-4 h-4 text-[#78716C]" />
        <Rotulo>Agenda e clima</Rotulo>
      </div>
      <p className="text-xs text-[#78716C] leading-relaxed">
        O servidor do hub lê a agenda pelo link iCal secreto e o clima pelo Open-Meteo, a cada 30 minutos quando você abre o app. O link fica cifrado no seu banco e não volta para o celular.
      </p>

      {info?.agendas.length ? (
        <ul className="space-y-2">
          {info.agendas.map((a, i) => (
            <li key={`${a.nome}-${i}`} className="flex items-center gap-2">
              <span className="flex-1 min-w-0">
                <span className="text-sm font-bold block truncate">{a.nome}</span>
                <span className="text-[11px] font-mono text-[#78716C]">{a.host}</span>
              </span>
              <button
                aria-label={`Remover ${a.nome}`}
                disabled={ocupado}
                onClick={() => confirm(`Remover a agenda ${a.nome}?`) && void rodar(() => configurarExternos({ remover: i }), 'Agenda removida.')}
                className="w-11 h-11 rounded-xl bg-[#FFFDF9] retro-shadow-sm flex items-center justify-center"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <details className="text-sm" open={!info?.agendas.length}>
        <summary className="font-bold cursor-pointer">Adicionar agenda</summary>
        <ol className="text-xs text-[#57534E] leading-relaxed list-decimal pl-4 my-2 space-y-1">
          <li>No computador (ou no Chrome do celular em "Versão para computador"), abra calendar.google.com.</li>
          <li>Engrenagem → Configurações → clique na agenda na lateral → Integrar agenda.</li>
          <li>Copie o "Endereço secreto no formato iCal" e cole abaixo. Repita para outras agendas, como a do trabalho.</li>
        </ol>
        <div className="space-y-2">
          <input className={estiloInput} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome (ex.: Pessoal)" />
          <input className={estiloInput} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" inputMode="url" autoCapitalize="off" autoCorrect="off" />
          <Botao
            variante="primario"
            className="w-full"
            desabilitado={ocupado || !url.trim()}
            onClick={async () => {
              if (await rodar(() => configurarExternos({ adicionar: { nome, url } }), 'Agenda conectada.')) {
                setNome('');
                setUrl('');
              }
            }}
          >
            {ocupado ? 'Lendo…' : 'Conectar agenda'}
          </Botao>
        </div>
      </details>

      <Campo rotulo={`Cidade do clima${info ? ` (agora: ${info.local.nome})` : ''}`}>
        <div className="flex gap-2">
          <input className={estiloInput} value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Belo Horizonte" />
          <Botao desabilitado={ocupado || !cidade.trim()} onClick={() => void rodar(() => configurarExternos({ cidade }), 'Cidade salva.').then((ok) => ok && setCidade(''))}>
            Usar
          </Botao>
        </div>
      </Campo>

      {st && (
        <div className="text-xs text-[#57534E] space-y-1">
          <p>
            Agenda:{' '}
            {st.agenda.em ? `${st.agenda.itens ?? 0} compromissos lidos ${haQuanto(st.agenda.em)}` : info?.agendas.length ? 'ainda não lida' : 'não conectada'}
          </p>
          <p>Clima: {st.clima.em ? `${st.clima.itens ?? 0} dias lidos ${haQuanto(st.clima.em)}` : 'ainda não lido'}</p>
        </div>
      )}
      <Botao className="w-full" desabilitado={ocupado} onClick={() => void rodar(() => externos(2), 'Atualizado.')}>
        {ocupado ? 'Lendo…' : 'Ler agora'}
      </Botao>
      {msg && <p className="text-sm text-[#57534E]">{msg}</p>}
    </Cartao>
  );
}
