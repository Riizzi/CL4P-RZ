import { useCallback, useEffect, useMemo, useState } from 'react';
import { snapshotsDemo } from '../core/demo.js';
import { montarPainel, type Painel } from '../core/metrics.js';
import { APP_IDS, type Snapshots } from '../core/types.js';
import { buscarSnapshots, snapshotsEmCache } from './api.js';
import { getConfig, onConfig } from './config.js';

export type Fonte = 'servidor' | 'cache' | 'exemplo' | 'vazio';

export interface Dados {
  snapshots: Snapshots;
  painel: Painel;
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
  const efetivo = useMemo(() => demo ?? snaps ?? {}, [demo, snaps]);
  const painel = useMemo(() => montarPainel(efetivo), [efetivo]);

  return {
    snapshots: efetivo,
    painel,
    fonte: usarExemplo ? 'exemplo' : fonte,
    carregando,
    erro,
    atualizar,
    vinculados,
  };
}
