import { BookOpen, Gem, MapPin, ShoppingBasket, Swords, Wallet, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import type { AppId } from '../../core/types.js';
import { APPS, abrirApp, urlDoApp } from '../../services/apps.js';
import { getConfig } from '../../services/config.js';
import type { Dados } from '../../services/dados.js';
import { Aviso, Botao, Cartao, haQuanto } from '../kit.tsx';

export const ICONES: Partial<Record<AppId, LucideIcon>> = {
  retrofin: Wallet,
  routinetracker: MapPin,
  smartpantry: ShoppingBasket,
  wishwatch: Gem,
  papertrail: BookOpen,
  rotmg: Swords,
};

export default function Apps({ d, irAjustes }: { d: Dados; irAjustes: () => void }) {
  const [msg, setMsg] = useState<string | null>(null);
  const temChave = Boolean(getConfig().token);

  return (
    <div className="space-y-3">
      {!temChave && (
        <Aviso>
          Configure o servidor e a chave em{' '}
          <button onClick={irAjustes} className="underline font-bold">
            Ajustes
          </button>{' '}
          primeiro: é assim que cada app recebe o vínculo ao ser aberto daqui.
        </Aviso>
      )}
      {msg && <Aviso>{msg}</Aviso>}
      {APPS.map((a) => {
        const Icone = ICONES[a.id] ?? Wallet;
        const e = d.fonte === 'exemplo' ? undefined : d.snapshots[a.id];
        const semUrl = a.tipo === 'web' && !urlDoApp(a);
        return (
          <Cartao key={a.id}>
            <div className="flex gap-3">
              <div className="w-12 h-12 rounded-[14px] bg-[#8A8A8A] flex items-center justify-center shrink-0">
                <Icone className="w-6 h-6 text-[#1C1C1C]" strokeWidth={2.2} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-bold">{a.nome}</h2>
                  <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-[#F3EDE3] text-[#78716C]">{a.tipo === 'android' ? 'app android' : 'web'}</span>
                </div>
                <p className="text-xs text-[#78716C] leading-snug mt-0.5">{a.oQue}</p>
                <p className={`text-[11px] font-mono mt-1.5 ${e ? 'text-[#4E7060]' : 'text-[#A8A29E]'}`}>
                  {e ? `● dados recebidos ${haQuanto(Date.parse(e.generatedAt))}` : '○ ainda não enviou dados'}
                </p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              {semUrl ? (
                <Botao onClick={irAjustes} className="flex-1">
                  Cadastrar endereço
                </Botao>
              ) : (
                <Botao
                  variante="primario"
                  className="flex-1 !bg-[#292524] !border-[#292524]"
                  onClick={async () => {
                    setMsg(await abrirApp(a));
                  }}
                >
                  {e || !temChave ? 'Abrir' : 'Abrir e vincular'}
                </Botao>
              )}
            </div>
          </Cartao>
        );
      })}
      <p className="text-xs text-[#78716C] leading-relaxed px-1">
        Ao abrir um app por aqui, ele recebe o código de vínculo e passa a enviar um resumo dos dados sempre que algo muda. O código também pode ser colado à mão na tela de ajustes de cada app.
      </p>
    </div>
  );
}
