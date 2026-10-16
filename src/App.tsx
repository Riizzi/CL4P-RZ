import { App as CapApp } from '@capacitor/app';
import { Grid2x2, House, MessageSquare, RefreshCw, SlidersHorizontal, Waypoints, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { isNative, lerCodigo, setConfig } from './services/config.js';
import { useDados } from './services/dados.js';
import Ajustes from './ui/screens/Ajustes.tsx';
import Apps from './ui/screens/Apps.tsx';
import Chat from './ui/screens/Chat.tsx';
import Cruzamentos from './ui/screens/Cruzamentos.tsx';
import Hoje from './ui/screens/Hoje.tsx';

type Aba = 'hoje' | 'cruzamentos' | 'chat' | 'apps' | 'ajustes';

const ABAS: { id: Aba; rotulo: string; Icone: LucideIcon }[] = [
  { id: 'hoje', rotulo: 'Hoje', Icone: House },
  { id: 'cruzamentos', rotulo: 'Cruzar', Icone: Waypoints },
  { id: 'chat', rotulo: 'Chat', Icone: MessageSquare },
  { id: 'apps', rotulo: 'Apps', Icone: Grid2x2 },
  { id: 'ajustes', rotulo: 'Ajustes', Icone: SlidersHorizontal },
];

const TITULOS: Record<Aba, string> = {
  hoje: 'CL4P-RZ',
  cruzamentos: 'Cruzamentos',
  chat: 'Conversa',
  apps: 'Seus apps',
  ajustes: 'Ajustes',
};

/** Aceita #cl4p=<código> (ou ?cl4p=) na URL (mesmo formato que os apps usam) e limpa a barra de endereço. */
function capturarCodigoDaUrl() {
  try {
    const u = new URL(window.location.href);
    const hash = new URLSearchParams(u.hash.replace(/^#/, ''));
    const cod = hash.get('cl4p') || u.searchParams.get('cl4p');
    if (!cod) return;
    const v = lerCodigo(cod);
    if (v) setConfig({ api: v.u === window.location.origin ? '' : v.u, token: v.k });
    u.searchParams.delete('cl4p');
    hash.delete('cl4p');
    history.replaceState(null, '', u.pathname + u.search + (hash.toString() ? `#${hash}` : ''));
  } catch {
    /* URL inválida */
  }
}
capturarCodigoDaUrl();

export default function App() {
  const d = useDados();
  const [aba, setAba] = useState<Aba>(() => {
    try {
      return (sessionStorage.getItem('cl4p.aba') as Aba) || 'hoje';
    } catch {
      return 'hoje';
    }
  });
  const main = useRef<HTMLElement>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem('cl4p.aba', aba);
    } catch {
      /* ignora */
    }
    if (aba !== 'chat') main.current?.scrollTo({ top: 0 });
  }, [aba]);

  useEffect(() => {
    if (!isNative) return;
    const h = CapApp.addListener('backButton', () => {
      if (aba !== 'hoje') setAba('hoje');
      else void CapApp.minimizeApp();
    });
    const r = CapApp.addListener('resume', () => void d.atualizar());
    return () => {
      void h.then((x) => x.remove());
      void r.then((x) => x.remove());
    };
  }, [aba, d]);

  return (
    <div className="h-full flex flex-col bg-[#FAF7F2]">
      <header className="pt-safe bg-[#FAF7F2] border-b border-[#E8DFD1] shrink-0">
        <div className="h-12 px-4 flex items-center justify-between max-w-xl mx-auto w-full">
          <h1 className="font-mono font-bold text-xs uppercase tracking-wider">{TITULOS[aba]}</h1>
          <div className="flex items-center gap-2">
            {d.fonte === 'cache' && <span className="text-[10px] font-mono font-bold uppercase text-[#C07A3E]">offline</span>}
            {d.fonte === 'exemplo' && <span className="text-[10px] font-mono font-bold uppercase text-[#78716C]">exemplo</span>}
            <button onClick={() => void d.atualizar()} className="w-10 h-10 -mr-2 flex items-center justify-center text-[#57534E]" aria-label="Atualizar dados">
              <RefreshCw className={`w-4 h-4 ${d.carregando ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <main ref={main} className="flex-1 overflow-y-auto">
        <div className={`max-w-xl mx-auto px-4 pt-4 ${aba === 'chat' ? 'min-h-full flex flex-col' : 'pb-6'}`}>
          {aba === 'hoje' && <Hoje d={d} irPara={setAba} />}
          {aba === 'cruzamentos' && <Cruzamentos d={d} />}
          {aba === 'chat' && <Chat d={d} />}
          {aba === 'apps' && <Apps d={d} irAjustes={() => setAba('ajustes')} />}
          {aba === 'ajustes' && <Ajustes d={d} />}
        </div>
      </main>

      <nav className="pb-safe bg-[#FFFDF9] border-t border-[#E8DFD1] shrink-0">
        <div className="grid grid-cols-5 max-w-xl mx-auto">
          {ABAS.map(({ id, rotulo, Icone }) => {
            const ativa = aba === id;
            return (
              <button key={id} onClick={() => setAba(id)} className={`h-16 flex flex-col items-center justify-center gap-1 ${ativa ? 'text-[#292524]' : 'text-[#A8A29E]'}`} aria-current={ativa ? 'page' : undefined}>
                <span className={`px-3.5 py-1 rounded-full ${ativa ? 'bg-[#F3EDE3] border border-[#E8DFD1]' : 'border border-transparent'}`}>
                  <Icone className="w-5 h-5" strokeWidth={ativa ? 2.4 : 2} />
                </span>
                <span className={`text-[10px] ${ativa ? 'font-bold' : 'font-semibold'}`}>{rotulo}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
