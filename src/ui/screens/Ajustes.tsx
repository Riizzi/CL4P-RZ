import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { APPS } from '../../services/apps.js';
import { apagarSnapshot, saude, type Saude } from '../../services/api.js';
import { apiBase, gerarCodigo, getConfig, isNative, lerCodigo, setConfig } from '../../services/config.js';
import type { Dados } from '../../services/dados.js';
import { Botao, Campo, Cartao, Chave, Rotulo, estiloInput } from '../kit.tsx';

export default function Ajustes({ d }: { d: Dados }) {
  const c = getConfig();
  const [api, setApi] = useState(c.api);
  const [token, setToken] = useState(c.token);
  const [urls, setUrls] = useState<Record<string, string>>(c.urls);
  const [teste, setTeste] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [colar, setColar] = useState('');

  const salvar = () => {
    setConfig({ api: api.trim().replace(/\/+$/, ''), token: token.trim(), urls });
    setTeste('Salvo.');
  };

  const testar = async () => {
    salvar();
    setTeste('Testando…');
    try {
      const s: Saude = await saude();
      const faltas = [!s.chave && 'CL4P_TOKEN', s.banco !== 'upstash' && 'Upstash (usando arquivo local)', !s.gemini && 'GEMINI_API_KEY'].filter(Boolean);
      await d.atualizar();
      setTeste(faltas.length ? `Servidor no ar. Falta configurar: ${faltas.join(', ')}.` : `Tudo certo. Banco Upstash, Gemini ${s.modelo}.`);
    } catch (e) {
      setTeste((e as Error).message);
    }
  };

  const codigo = token ? gerarCodigo(apiBase() || api, token) : '';

  return (
    <div className="space-y-4">
      <Cartao className="space-y-3">
        <Rotulo>Servidor</Rotulo>
        <Campo rotulo={isNative ? 'Endereço do servidor (Vercel)' : 'Endereço do servidor (vazio = este site)'}>
          <input className={estiloInput} value={api} onChange={(e) => setApi(e.target.value)} placeholder="https://cl4p-rz.vercel.app" inputMode="url" autoCapitalize="off" autoCorrect="off" />
        </Campo>
        <Campo rotulo="Sua chave (CL4P_TOKEN)">
          <input className={estiloInput} type="password" value={token} onChange={(e) => setToken(e.target.value)} autoCapitalize="off" autoCorrect="off" />
        </Campo>
        <details className="text-sm">
          <summary className="text-[#3F6FA8] font-bold cursor-pointer">Tenho um código de vínculo</summary>
          <div className="flex gap-2 mt-2">
            <input className={estiloInput} value={colar} onChange={(e) => setColar(e.target.value)} placeholder="cl4p1.…" autoCapitalize="off" />
            <Botao
              onClick={() => {
                const v = lerCodigo(colar);
                if (!v) return setTeste('Código inválido.');
                setApi(v.u);
                setToken(v.k);
                setConfig({ api: v.u, token: v.k });
                setColar('');
                setTeste('Código aplicado.');
              }}
            >
              Usar
            </Botao>
          </div>
        </details>
        <div className="flex gap-2">
          <Botao onClick={salvar} className="flex-1">
            Salvar
          </Botao>
          <Botao onClick={() => void testar()} variante="primario" className="flex-1 !bg-[#292524] !border-[#292524]">
            Testar conexão
          </Botao>
        </div>
        {teste && <p className="text-sm text-[#57534E]">{teste}</p>}
      </Cartao>

      {codigo && (
        <Cartao className="space-y-2">
          <Rotulo>Código de vínculo</Rotulo>
          <p className="text-xs text-[#78716C] leading-relaxed">Para vincular um app sem abrir pelo hub, cole este código na tela de ajustes dele (seção “Link CL4P-RZ”).</p>
          <div className="flex gap-2 items-center">
            <code className="flex-1 min-w-0 truncate text-xs font-mono bg-[#FAF7F2] border border-[#E8DFD1] rounded-lg px-2 py-2.5">{codigo}</code>
            <button
              className="w-11 h-11 shrink-0 rounded-xl bg-[#FFFDF9] retro-shadow-sm flex items-center justify-center"
              aria-label="Copiar código"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(codigo);
                  setCopiado(true);
                  setTimeout(() => setCopiado(false), 1500);
                } catch {
                  setTeste('Não consegui copiar. Selecione o código e copie à mão.');
                }
              }}
            >
              {copiado ? <Check className="w-4 h-4 text-[#4E7060]" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </Cartao>
      )}

      <Cartao className="space-y-3">
        <Rotulo>Endereço dos apps web</Rotulo>
        {APPS.filter((a) => a.tipo === 'web').map((a) => (
          <Campo key={a.id} rotulo={a.nome}>
            <input
              className={estiloInput}
              value={urls[a.id] ?? ''}
              placeholder={a.urlPadrao || 'https://…'}
              onChange={(e) => setUrls({ ...urls, [a.id]: e.target.value })}
              onBlur={() => setConfig({ urls })}
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
            />
          </Campo>
        ))}
        <p className="text-[11px] text-[#78716C]">RetroFin e RoutineTracker abrem como apps instalados no Android.</p>
      </Cartao>

      <Cartao className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-bold text-sm">Dados de exemplo</p>
            <p className="text-xs text-[#78716C]">Mostrados só enquanto nenhum app estiver vinculado.</p>
          </div>
          <Chave ligada={c.demo} onChange={(v) => setConfig({ demo: v })} rotulo="Dados de exemplo" />
        </div>
      </Cartao>

      {d.fonte !== 'exemplo' && d.vinculados > 0 && (
        <Cartao className="space-y-2">
          <Rotulo>Apagar dados recebidos</Rotulo>
          <p className="text-xs text-[#78716C]">Remove do servidor o último resumo enviado por um app. O app volta a enviar na próxima alteração.</p>
          {APPS.filter((a) => d.snapshots[a.id]).map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3">
              <span className="text-sm">{a.nome}</span>
              <Botao
                variante="perigo"
                onClick={async () => {
                  if (!confirm(`Apagar os dados do ${a.nome} no servidor?`)) return;
                  try {
                    await apagarSnapshot(a.id);
                    await d.atualizar();
                  } catch (e) {
                    setTeste((e as Error).message);
                  }
                }}
              >
                Apagar
              </Botao>
            </div>
          ))}
        </Cartao>
      )}
    </div>
  );
}
