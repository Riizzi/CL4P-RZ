import { HeartPulse } from 'lucide-react';
import { useEffect, useState } from 'react';
import { isNative } from '../services/config.js';
import { definirLembrete, lerLembrete } from '../services/lembrete.js';
import { abrirAjustesHealthConnect, conectarSaude, estadoSaude, ouvirSaude, sincronizarSaude, verificarSaude } from '../services/saude.js';
import { Botao, Cartao, Chave, Rotulo, haQuanto } from './kit.tsx';

/** Ajustes da saúde (Health Connect) e do lembrete de humor. */
export function SaudeAjustes({ aoSincronizar }: { aoSincronizar: () => void }) {
  const [st, setSt] = useState(estadoSaude);
  const [lembrete, setLembrete] = useState(lerLembrete);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const desliga = ouvirSaude(() => setSt(estadoSaude()));
    void verificarSaude();
    return desliga;
  }, []);

  const permitiu = st.permitidos.length > 0;
  const mudarHora = async (delta: number) => {
    const l = { ...lembrete, hora: (lembrete.hora + delta + 24) % 24 };
    setLembrete(l);
    setMsg(await definirLembrete(l));
  };

  return (
    <>
      <Cartao className="space-y-3">
        <div className="flex items-center gap-2">
          <HeartPulse className="w-4 h-4 text-[#78716C]" />
          <Rotulo>Saúde (relógio)</Rotulo>
        </div>
        <p className="text-xs text-[#78716C] leading-relaxed">
          Lê do Health Connect o que o Mi Fitness grava: sono, passos, calorias, batimentos em repouso e treinos. Só leitura. O estresse do relógio não é compartilhado pelo Mi Fitness.
        </p>
        {!isNative ? (
          <p className="text-sm text-[#57534E]">Disponível no app Android do CL4P-RZ.</p>
        ) : st.disponivel === false ? (
          <p className="text-sm text-[#57534E]">{st.motivo}</p>
        ) : (
          <>
            <p className="text-sm text-[#57534E]">
              {permitiu ? (
                <>
                  <strong>Conectado.</strong> {st.ultimaSync ? `Última leitura ${haQuanto(st.ultimaSync)}: ${st.dias} dias e ${st.treinos} treinos.` : 'Nenhuma leitura ainda.'}
                </>
              ) : (
                'Ainda sem permissão.'
              )}
            </p>
            {st.erro && <p className="text-xs text-[#B4413A]">{st.erro}</p>}
            <div className="flex gap-2">
              {!permitiu ? (
                <Botao variante="primario" className="flex-1 !bg-[#292524] !border-[#292524]" onClick={() => void conectarSaude().then(aoSincronizar)}>
                  Conectar Health Connect
                </Botao>
              ) : (
                <Botao variante="primario" className="flex-1 !bg-[#292524] !border-[#292524]" onClick={() => void sincronizarSaude(true).then(aoSincronizar)}>
                  Ler agora
                </Botao>
              )}
              <Botao onClick={() => void abrirAjustesHealthConnect()}>Permissões</Botao>
            </div>
          </>
        )}
      </Cartao>

      <Cartao className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-bold text-sm">Lembrete do humor</p>
            <p className="text-xs text-[#78716C]">Uma notificação por dia para registrar como foi.</p>
          </div>
          <Chave
            ligada={lembrete.ativo}
            rotulo="Lembrete do humor"
            onChange={async (v) => {
              const l = { ...lembrete, ativo: v };
              setLembrete(l);
              setMsg(await definirLembrete(l));
            }}
          />
        </div>
        {lembrete.ativo && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">Horário</span>
            <div className="flex items-center gap-2">
              <button aria-label="Mais cedo" className="w-11 h-11 rounded-xl bg-[#FFFDF9] retro-shadow-sm font-mono font-bold" onClick={() => void mudarHora(-1)}>
                −
              </button>
              <span className="font-mono font-bold w-12 text-center">{String(lembrete.hora).padStart(2, '0')}h</span>
              <button aria-label="Mais tarde" className="w-11 h-11 rounded-xl bg-[#FFFDF9] retro-shadow-sm font-mono font-bold" onClick={() => void mudarHora(1)}>
                +
              </button>
            </div>
          </div>
        )}
        {msg && <p className="text-xs text-[#B4413A]">{msg}</p>}
      </Cartao>
    </>
  );
}
