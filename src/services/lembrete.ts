/** Lembrete diário para registrar o humor (notificação local do APK; nada passa por servidor). */
import { LocalNotifications } from '@capacitor/local-notifications';
import { isNative } from './config.js';

const ID = 7001;
const CHAVE = 'cl4p.lembrete.v1';

export interface Lembrete {
  ativo: boolean;
  hora: number;
}

export function lerLembrete(): Lembrete {
  try {
    return { ativo: false, hora: 21, ...JSON.parse(localStorage.getItem(CHAVE) || '{}') };
  } catch {
    return { ativo: false, hora: 21 };
  }
}

/** Liga, muda a hora ou desliga. Retorna mensagem de erro ou null. */
export async function definirLembrete(l: Lembrete): Promise<string | null> {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(l));
  } catch {
    /* sem armazenamento */
  }
  if (!isNative) return l.ativo ? 'O lembrete funciona no app Android do CL4P-RZ.' : null;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: ID }] });
    if (!l.ativo) return null;
    const p = await LocalNotifications.requestPermissions();
    if (p.display !== 'granted') return 'Permita as notificações do CL4P-RZ nos ajustes do Android.';
    await LocalNotifications.schedule({
      notifications: [
        {
          id: ID,
          title: 'Como foi o dia?',
          body: 'Um toque para registrar o humor de hoje.',
          schedule: { on: { hour: l.hora, minute: 0 }, repeats: true, allowWhileIdle: true },
        },
      ],
    });
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}
