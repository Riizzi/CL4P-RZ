import { chaveDoApp, iguais } from './cripto.js';

/** CORS aberto: a proteção é a chave (Bearer), não a origem. Os apps rodam em domínios diferentes e no Capacitor. */
export function cors(req: any, res: any): boolean {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

export function sendJson(res: any, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

function tokenDoPedido(req: any): string {
  const h: string = req.headers?.authorization || req.headers?.Authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
}

function semChaveNoServidor(res: any): boolean {
  if ((process.env.CL4P_TOKEN || '').trim()) return false;
  sendJson(res, 503, { error: 'Servidor sem chave configurada. Cadastre a variável CL4P_TOKEN na Vercel.' });
  return true;
}

/** Só a chave pessoal (leitura dos dados, chat, apagar). */
export function autorizado(req: any, res: any): boolean {
  if (semChaveNoServidor(res)) return false;
  const token = tokenDoPedido(req);
  if (token && iguais(token, (process.env.CL4P_TOKEN || '').trim())) return true;
  sendJson(res, 401, { error: 'Chave inválida.' });
  return false;
}

/** Chave pessoal ou a chave daquele app (que só serve para as rotas do próprio app). */
export function autorizadoApp(req: any, res: any, app: string): boolean {
  if (semChaveNoServidor(res)) return false;
  const token = tokenDoPedido(req);
  if (token && (iguais(token, chaveDoApp(app)) || iguais(token, (process.env.CL4P_TOKEN || '').trim()))) return true;
  sendJson(res, 401, { error: 'Chave inválida para este app.' });
  return false;
}

/** Corpo JSON: a Vercel já entrega em req.body; no servidor de desenvolvimento lemos o stream. */
export async function lerCorpo(req: any): Promise<any> {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body);
      } catch {
        return {};
      }
    }
    return req.body;
  }
  const partes: Buffer[] = [];
  for await (const c of req) partes.push(typeof c === 'string' ? Buffer.from(c) : c);
  const txt = Buffer.concat(partes).toString('utf8');
  try {
    return txt ? JSON.parse(txt) : {};
  } catch {
    return {};
  }
}
