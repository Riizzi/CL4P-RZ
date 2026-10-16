import { APP_IDS, type AppId, type Snapshots } from '../../src/core/types.js';
import { mget } from './store.js';

export const chaveSnapshot = (app: AppId) => `cl4p:snap:${app}`;

export async function carregarSnapshots(): Promise<Snapshots> {
  const brutos = await mget(APP_IDS.map(chaveSnapshot));
  const out: Snapshots = {};
  APP_IDS.forEach((id, i) => {
    const b = brutos[i];
    if (!b) return;
    try {
      (out as any)[id] = JSON.parse(b);
    } catch {
      /* registro corrompido: ignora */
    }
  });
  return out;
}
