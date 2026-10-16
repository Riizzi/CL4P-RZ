import { X } from 'lucide-react';
import type { ReactNode } from 'react';

export function Cartao({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-[#FFFDF9] rounded-2xl p-4 retro-shadow ${className}`}>{children}</div>;
}

export function Rotulo({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h3 className={`text-[11px] font-mono font-bold text-[#57534E] uppercase tracking-wider ${className}`}>{children}</h3>
  );
}

type Variante = 'primario' | 'secundario' | 'perigo' | 'suave';

export function Botao({
  children,
  onClick,
  variante = 'secundario',
  desabilitado,
  className = '',
  tipo = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  variante?: Variante;
  desabilitado?: boolean;
  className?: string;
  tipo?: 'button' | 'submit';
}) {
  const estilos: Record<Variante, string> = {
    primario: 'bg-[#BC5A42] text-white border border-[#A54B35]',
    secundario: 'bg-[#FFFDF9] text-[#292524] border border-[#E8DFD1] retro-shadow-sm',
    perigo: 'bg-[#BC5A42]/10 text-[#BC5A42] border border-[#BC5A42]/30',
    suave: 'bg-[#FAF7F2] text-[#57534E] border border-[#E8DFD1]',
  };
  return (
    <button
      type={tipo}
      onClick={onClick}
      disabled={desabilitado}
      className={`min-h-11 px-4 rounded-xl text-sm font-bold retro-press disabled:opacity-40 disabled:pointer-events-none ${estilos[variante]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Chave({ ligada, onChange, rotulo }: { ligada: boolean; onChange: (v: boolean) => void; rotulo: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligada}
      aria-label={rotulo}
      onClick={() => onChange(!ligada)}
      className={`relative w-12 h-7 rounded-full shrink-0 transition-colors border ${
        ligada ? 'bg-[#5F8575] border-[#4E7060]' : 'bg-[#E8DFD1] border-[#D8CDBC]'
      }`}
    >
      <span
        className={`absolute top-0.5 w-5.5 h-5.5 rounded-full bg-white shadow transition-all ${ligada ? 'left-[22px]' : 'left-0.5'}`}
        style={{ width: 22, height: 22 }}
      />
    </button>
  );
}

/** Folha que sobe de baixo (edição rápida). */
export function Folha({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-[#292524]/45" onClick={onFechar}>
      <div
        className="w-full max-h-[88%] overflow-y-auto bg-[#FFFDF9] rounded-t-3xl border-t-2 border-[#E8DFD1] p-5 pb-safe space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-[#E8DFD1] rounded-full mx-auto" />
        <div className="flex items-center justify-between border-b border-[#E8DFD1] pb-2">
          <h2 className="text-xs font-mono font-bold uppercase text-[#292524]">{titulo}</h2>
          <button onClick={onFechar} className="p-2 -mr-2 text-[#78716C]" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-mono uppercase text-[#78716C]">{rotulo}</span>
      {children}
    </label>
  );
}

export const estiloInput =
  'w-full bg-[#FAF7F2] border border-[#E8DFD1] px-3 py-2.5 rounded-xl text-[#292524] focus:outline-none focus:border-[#4E6A8A]';

export function Vazio({ icone, titulo, texto, children }: { icone: ReactNode; titulo: string; texto: string; children?: ReactNode }) {
  return (
    <div className="text-center py-10 px-6 space-y-3">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-[#FFFDF9] retro-shadow flex items-center justify-center text-[#78716C]">
        {icone}
      </div>
      <p className="font-bold text-[#292524]">{titulo}</p>
      <p className="text-sm text-[#78716C] leading-relaxed">{texto}</p>
      {children}
    </div>
  );
}

export const brl = (v: number, centavos = true) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: centavos ? 2 : 0, maximumFractionDigits: centavos ? 2 : 0 });

export const hhmm = (ts: number) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

export const dataCurta = (ts: number) => new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });

export function haQuanto(ts: number, agora = Date.now()): string {
  const min = Math.round((agora - ts) / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `há ${h} h`;
  return `há ${Math.round(h / 24)} dias`;
}

/** Cartão de número único (KPI). */
export function Numero({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="bg-[#FFFDF9] rounded-2xl p-3.5 retro-shadow min-w-0">
      <p className="text-[10px] font-mono font-bold uppercase text-[#78716C] tracking-wide truncate">{rotulo}</p>
      <p className="font-mono font-bold text-lg text-[#292524] mt-1 truncate">{valor}</p>
      {detalhe && <p className="text-[11px] text-[#78716C] mt-0.5 leading-snug">{detalhe}</p>}
    </div>
  );
}

/** Barra horizontal de magnitude (uma série). */
export function Barra({ rotulo, valor, max, texto, sub, cor = '#3F6FA8' }: { rotulo: string; valor: number; max: number; texto: string; sub?: string; cor?: string }) {
  const pct = max > 0 && valor > 0 ? Math.max(2, (valor / max) * 100) : 0;
  return (
    <div className="space-y-1" title={`${rotulo}: ${texto}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-[#292524] truncate">{rotulo}</span>
        <span className="text-sm font-mono font-bold text-[#292524] shrink-0">{texto}</span>
      </div>
      <div className="h-2 rounded-full bg-[#F3EDE3] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cor }} />
      </div>
      {sub && <p className="text-[11px] text-[#78716C] leading-snug">{sub}</p>}
    </div>
  );
}

export function Aviso({ children }: { children: ReactNode }) {
  return <div className="bg-[#C07A3E]/10 border border-[#C07A3E]/30 rounded-xl p-3 text-sm text-[#57534E] leading-relaxed">{children}</div>;
}
