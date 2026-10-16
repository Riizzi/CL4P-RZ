<div align="center">

<img src="public/icon.svg" width="88" alt="Ícone do CL4P-RZ" />

# CL4P-RZ

[English](README.md) · **Português**

Hub pessoal que junta os dados dos meus apps, cruza tudo e responde perguntas sobre mim num chat com a personalidade do CL4P-TP (o Claptrap de Borderlands).

![React](https://img.shields.io/badge/React_19-292524?logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-292524?logo=typescript&logoColor=3178C6)
![Capacitor](https://img.shields.io/badge/Capacitor_8-292524?logo=capacitor&logoColor=119EFF)
![Vercel](https://img.shields.io/badge/Vercel-292524?logo=vercel&logoColor=white)
![Upstash](https://img.shields.io/badge/Upstash_Redis-292524?logo=upstash&logoColor=00E9A3)
![Gemini](https://img.shields.io/badge/Gemini_API-292524?logo=googlegemini&logoColor=8E75B2)

</div>

## O que ele cruza

| Cruzamento | Apps | Como funciona |
| --- | --- | --- |
| **Gasto por lugar** | RetroFin × RoutineTracker | O horário de cada compra é comparado com a estadia registrada naquele momento, com tolerância de 10 min. Mostra quanto saiu no trabalho, em casa, na UFMG, em lugares não cadastrados e em trânsito. |
| **Dias de treino × gasto** | RoutineTracker × RetroFin | Gasto médio nos dias com academia contra os dias sem. |
| **Mercado × despensa** | RetroFin × SmartPantry | Gasto em mercado no banco contra as notas fiscais lidas, conciliação nota × extrato e desperdício. |
| **Desejos × sobra do mês** | WishWatch × RetroFin | Quanto tempo de sobra para comprar a lista, o que cabe neste mês e o que está no preço-alvo. |
| **Estudo × leituras** | RoutineTracker × PaperTrail | Horas em lugares de estudo por semana contra textos adicionados e lidos. |
| **Quando o dinheiro sai** | RetroFin | Mapa de calor por dia da semana e faixa de horário. |
| **RotMG** | RotMG Account Manager | Personagens 8/8, mortes e classe que mais morreu. |

Os cruzamentos são funções puras em `src/core/metrics.ts`, cobertas por testes, e as mesmas funções alimentam a tela e o chat.

## Telas

- **Hoje**: onde você está agora, horas por tipo de lugar, gasto do dia e do mês, último gasto (com o lugar), despensa vencendo, wishlist no alvo e a última atualização de cada app.
- **Cruzar**: todos os cruzamentos acima.
- **Chat**: o CL4P-RZ responde com base nos dados de todos os apps.
- **Apps**: abre cada app (APK ou web) já levando o código de vínculo.
- **Ajustes**: servidor, chave, endereço dos apps e código de vínculo.

## Arquitetura

```
RetroFin ───────┐
RoutineTracker ─┤                    ┌──────────────────── Vercel ───────────────────┐
SmartPantry ────┤  POST /api/ingest  │  /api/ingest     guarda o último resumo de cada app
WishWatch ──────┼──────────────────► │  /api/snapshots  devolve todos                 │──► Upstash Redis
PaperTrail ─────┤  (Bearer chave)    │  /api/chat       contexto cruzado + Gemini     │──► Gemini
RotMG ──────────┘                    └────────────────────────────────────────────────┘
                                                        ▲
                                     CL4P-RZ (PWA na Vercel ou APK) lê, cruza e mostra
```

- **Link CL4P** (`docs/cl4pLink.ts`): módulo pequeno, copiado em cada app. Guarda o código de vínculo, junta as alterações por 3 s, só envia quando o conteúdo mudou e tenta de novo quando a internet volta.
- **Código de vínculo**: `cl4p1.<base64url>` com o endereço do servidor e a chave. Chega pela URL (`?cl4p=`), por deep link (`retrofin://cl4p?code=`, `routinetracker://cl4p?code=`) ou colado nos ajustes do app.
- **Contrato**: `{ app, schema: 1, generatedAt, data }`, com os tipos de `data` em `src/core/types.ts`.
- **Privacidade**: uma chave pessoal protege tudo. Os apps enviam resumos: nada de anexo, texto de notificação ou senha.

## Configuração (gratuita, sem cartão)

1. **Upstash**: crie um banco Redis em [console.upstash.com](https://console.upstash.com) e copie `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` (aba REST API).
2. **Chave pessoal**: invente um texto longo e aleatório. Ele será o `CL4P_TOKEN`.
3. **Gemini**: gere a chave em [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
4. **Vercel**: importe este repositório, cadastre as variáveis do `.env.example` e publique.
5. Abra o site publicado, vá em **Ajustes**, cole a chave e toque em **Testar conexão**.
6. Em **Apps**, cadastre o endereço do SmartPantry e do PaperTrail e toque em **Abrir e vincular** em cada app.

### APK

O workflow **Build APK** gera o `CL4P-RZ.apk` a cada push na `main` e publica em **Releases**. No APK, informe em **Ajustes** o endereço da Vercel e a chave (ou cole o código de vínculo que aparece no site).

## Desenvolvimento

```bash
npm install
cp .env.example .env.local   # CL4P_TOKEN basta; sem Upstash usa .data/ local
npm run dev                  # http://localhost:3000 (as rotas /api rodam no próprio Vite)
npm test                     # cruzamentos
```

Sem nenhum app vinculado, o hub mostra dados de exemplo (dá para desligar em Ajustes).

## Licença

[MIT](LICENSE)
