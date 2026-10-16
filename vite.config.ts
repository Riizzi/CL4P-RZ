import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

// Em desenvolvimento, as rotas /api rodam dentro do Vite; na Vercel viram funções serverless.
const rotas = new Set(['/api/health', '/api/ingest', '/api/snapshots', '/api/chat']);

function apiDev(): Plugin {
  return {
    name: 'cl4p-api-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const caminho = req.url?.split('?')[0] || '';
        if (!rotas.has(caminho)) return next();
        try {
          const mod = await server.ssrLoadModule(caminho + '.ts');
          await (mod.default as (q: unknown, s: unknown) => Promise<unknown>)(req, res);
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err?.message || 'Erro interno' }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return {
    plugins: [react(), tailwindcss(), apiDev()],
    build: { target: 'es2020', chunkSizeWarningLimit: 900 },
  };
});
