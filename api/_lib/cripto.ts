/**
 * Chaves e criptografia do servidor, todas derivadas da chave pessoal (CL4P_TOKEN):
 * - chave de cada app (só pode ENVIAR o próprio resumo; não lê nada);
 * - chave de criptografia dos dados guardados no Upstash (AES-256-GCM).
 * Trocar o CL4P_TOKEN invalida as chaves dos apps e os dados guardados (é preciso vincular de novo).
 */
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const mestre = () => (process.env.CL4P_TOKEN || '').trim();

function hmac(rotulo: string): Buffer {
  return createHmac('sha256', mestre()).update(rotulo).digest();
}

/** Chave de um app: base64url(HMAC-SHA256(CL4P_TOKEN, "cl4p-app:" + app)). O hub calcula igual no navegador. */
export function chaveDoApp(app: string): string {
  return hmac(`cl4p-app:${app}`).toString('base64url');
}

export function iguais(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const PREFIXO = 'enc1:';

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', hmac('cl4p-dados'), iv);
  const corpo = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return PREFIXO + Buffer.concat([iv, c.getAuthTag(), corpo]).toString('base64');
}

/** Decifra; aceita texto antigo sem criptografia. Retorna null se a chave não bater. */
export function decifrar(guardado: string): string | null {
  if (!guardado.startsWith(PREFIXO)) return guardado;
  try {
    const b = Buffer.from(guardado.slice(PREFIXO.length), 'base64');
    const d = createDecipheriv('aes-256-gcm', hmac('cl4p-dados'), b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}
