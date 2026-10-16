import { useCallback, useEffect, useMemo, useState } from 'react';
import { snapshotsDemo } from '../core/demo.js';
import { montarBemEstar, type BemEstar } from '../core/bemestar.js';
import { montarPainel, type Painel } from '../core/metrics.js';
import { APP_IDS, type Snapshots } from '../core/types.js';
import { buscarSnapshots, snapshotsEmCache } from './api.js';
import { getConfig, onConfig } from './config.js';
import { mesclarDoServidor, useHumor } from './humor.js';

export type Fonte = 'servidor' | 'cache' | 'exemplo' | 'vazio';

export interface Dados {
  snapshots: Snapshots;
  painel: Painel;
  bemEstar: BemEstar;
  fonte: Fonte;
  carregando: boolean;
  erro: string | null;
  atualizar: () => Promise<void>;
  vinculados: number;
}

export function useDados(): Dados {
  const [snaps, setSnaps] = useState<Snapshots | null>(() => snapshotsEmCache());
  const [fonte, setFonte] = useState<Fonte>(() => (snapshotsEmCache() ? 'cache' : 'vazio'));
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [, forcar] = useState(0);

  const atualizar = useCallback(async () => {
    if (!getConfig().token) {
      setFonte('vazio');
      return;
    }
    setCarregando(true);
    try {
      const s = await buscarSnapshots();
      mesclarDoServidor(s.humor?.data);
      setSnaps(s);
      setFonte('servidor');
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
      if (snapshotsEmCache()) setFonte('cache');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void atualizar();
    const desliga = onConfig(() => {
      forcar((n) => n + 1);
      void atualizar();
    });
    const aoVoltar = () => document.visibilityState === 'visible' && void atualizar();
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      desliga();
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [atualizar]);

  const vinculados = snaps ? APP_IDS.filter((id) => snaps[id]).length : 0;
  const usarExemplo = vinculados === 0 && getConfig().demo;
  const demo = useMemo(() => (usarExemplo ? snapshotsDemo() : null), [usarExemplo]);
  const humorLocal = useHumor();
  // O humor deste aparelho vale mais que a cópia do servidor (pode ter registros ainda não enviados).
  const efetivo = useMemo(() => {
    const base = demo ?? snaps ?? {};
    if (demo || !humorLocal.length) return base;
    return { ...base, humor: { app: 'humor' as const, schema: 1 as const, generatedAt: new Date().toISOString(), data: { registros: humorLocal } } };
  }, [demo, snaps, humorLocal]);
  const painel = useMemo(() => montarPainel(efetivo), [efetivo]);
  const bemEstar = useMemo(() => montarBemEstar(efetivo), [efetivo]);

  return {
    snapshots: efetivo,
    painel,
    bemEstar,
    fonte: usarExemplo ? 'exemplo' : fonte,
    carregando,
    erro,
    atualizar,
    vinculados,
  };
}
