import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { APP_IDS, NOME_FONTE } from '../../core/types.js';
import { APPS } from '../../services/apps.js';
import { apagarSnapshot, saude, type Saude } from '../../services/api.js';
import { apiBase, gerarCodigoApp, getConfig, isNative, lerCodigo, normalizarEndereco, setConfig } from '../../services/config.js';
import type { Dados } from '../../services/dados.js';
import AtualizacaoCard from '../AtualizacaoCard.tsx';
import { SaudeAjustes } from '../SaudeAjustes.tsx';
import { Botao, Campo, Cartao, Chave, Rotulo, estiloInput } from '../kit.tsx';

export default function Ajustes({ d }: { d: Dados }) {
  const c = getConfig();
  const [api, setApi] = useState(c.api);
  const [token, setToken] = useState(c.token);
  const [urls, setUrls] = useState<Record<string, string>>(c.urls);
  const [teste, setTeste] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [codigos, setCodigos] = useState<Record<string, string>>({});
  const [colar, setColar] = useState('');

  const salvar = () => {
    const a = normalizarEndereco(api);
    setApi(a);
    setConfig({ api: a, token: token.trim(), urls });
    setTeste('Salvo.');
  };

  const testar = async () => {
    salvar();
    setTeste('Testando…');
    try {
      const s: Saude = await saude();
      const faltas = [!s.chave && 'CL4P_TOKEN', s.chaveFraca && 'CL4P_TOKEN mais longa (32+ caracteres)', s.banco !== 'upstash' && 'Upstash (usando arquivo local)', !s.gemini && 'GEMINI_API_KEY'].filter(Boolean);
      await d.atualizar();
      setTeste(faltas.length ? `Servidor no ar. Falta configurar: ${faltas.join(', ')}.` : `Tudo certo. Banco Upstash, Gemini ${s.modelo}.`);
    } catch (e) {
      setTeste((e as Error).message);
    }
  };

  useEffect(() => {
    const t = c.token;
    if (!t || !apiBase()) return setCodigos({});
    let vivo = true;
    void Promise.all(APPS.map(async (a) => [a.id, await gerarCodigoApp(a.id, apiBase(), t)] as const))
      .then((pares) => vivo && setCodigos(Object.fromEntries(pares)))
      .catch(() => vivo && setCodigos({}));
    return () => {
      vivo = false;
    };
  }, [c.token, c.api]);

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

      {c.token && !apiBase() && (
        <Cartao className="space-y-1">
          <Rotulo>Códigos de vínculo</Rotulo>
          <p className="text-sm text-[#B4413A]">Preencha o endereço do servidor (Vercel) e toque em Salvar. Sem ele os códigos não funcionam.</p>
        </Cartao>
      )}

      {Object.keys(codigos).length > 0 && (
        <Cartao className="space-y-2">
          <Rotulo>Códigos de vínculo</Rotulo>
          <p className="text-xs text-[#78716C] leading-relaxed">
            Cada app tem o próprio código, que só permite enviar os dados daquele app. Abrir pelo hub já vincula; use estes só para colar à mão nos ajustes do app.
          </p>
          {APPS.map((a) => (
            <div key={a.id} className="flex gap-2 items-center">
              <span className="text-sm w-28 shrink-0 truncate">{a.nome}</span>
              <code className="flex-1 min-w-0 truncate text-xs font-mono bg-[#FAF7F2] border border-[#E8DFD1] rounded-lg px-2 py-2.5">{codigos[a.id]}</code>
              <button
                className="w-11 h-11 shrink-0 rounded-xl bg-[#FFFDF9] retro-shadow-sm flex items-center justify-center"
                aria-label={`Copiar código do ${a.nome}`}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(codigos[a.id]);
                    setCopiado(a.id);
                    setTimeout(() => setCopiado(null), 1500);
                  } catch {
                    setTeste('Não consegui copiar. Selecione o código e copie à mão.');
                  }
                }}
              >
                {copiado === a.id ? <Check className="w-4 h-4 text-[#4E7060]" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          ))}
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

      <SaudeAjustes aoSincronizar={() => void d.atualizar()} />

      {isNative && <AtualizacaoCard repo="Riizzi/CL4P-RZ" apk="CL4P-RZ.apk" />}

      <Cartao className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-bold text-sm">Lançamentos detalhados no chat</p>
            <p className="text-xs text-[#78716C]">Manda a lista de compras e de estadias para o Gemini. Desligado, vão só totais. O plano gratuito do Gemini pode usar os dados para treinar.</p>
          </div>
          <Chave ligada={c.chatDetalhado} onChange={(v) => setConfig({ chatDetalhado: v })} rotulo="Lançamentos detalhados no chat" />
        </div>
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
          {APP_IDS.filter((id) => d.snapshots[id]).map((id) => ({ id, nome: NOME_FONTE[id] })).map((a) => (
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
