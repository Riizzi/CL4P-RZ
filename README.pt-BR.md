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
| **Humor por tipo de dia** | Humor × RoutineTracker × relógio | Cada dia vira um tipo pela rotina (trabalho, treino, UFMG, folga em casa ou com saída) e mostra o humor médio de cada tipo, com quantos dias há por trás. |
| **Agenda cheia ou livre** | Agenda × Humor × relógio × RetroFin | Humor, sono e gasto por impulso nos dias livres contra os de 3 ou mais compromissos; sono antes de compromisso cedo. |
| **Clima** | Clima × Humor × relógio × RetroFin | Humor, passos e gasto por impulso em dias de chuva, de calor e secos. |
| **Sono, treino e humor** | Relógio (Health Connect) × Humor × RetroFin | Humor e gasto por impulso por faixa de sono da noite anterior; sono depois de dia com treino; gasto nos dias bons e ruins. |

Os cruzamentos são funções puras em `src/core/metrics.ts`, cobertas por testes, e as mesmas funções alimentam a tela e o chat.

## Saúde e humor

- **Relógio:** o APK lê do Health Connect o que o Mi Fitness escreve lá: sono, passos, calorias, batimentos em repouso, HRV e treinos. Só leitura. O sono conta no dia em que você acordou.
- **Humor:** registro de 1 a 5 na tela Hoje, com etiquetas e anotação opcionais e um lembrete diário opcional. A anotação não vai para a IA.
- Um achado só aparece quando cada lado tem pelo menos 3 dias. É correlação, não causa.

## Agenda e clima

O servidor do hub busca as duas fontes sozinho, a cada 30 minutos enquanto você usa o app:

- **Agenda:** um ou mais links iCal secretos (Google Agenda → Configurações → Integrar agenda → *Endereço secreto no formato iCal*). Eventos repetidos são expandidos; os de dia inteiro e os marcados como "disponível" não contam como compromisso. Os links ficam cifrados no banco e nunca voltam para o aparelho.
- **Clima:** dados diários do [Open-Meteo](https://open-meteo.com) (gratuito, sem chave), dos últimos 92 dias e dos próximos 7, para a cidade definida em Ajustes.

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
- **Código de vínculo**: `cl4p1.<base64url>` com o endereço do servidor e a chave. Chega pelo fragmento da URL (`#cl4p=`), por deep link (`retrofin://cl4p?code=`, `routinetracker://cl4p?code=`) ou colado nos ajustes do app.
- **Contrato**: `{ app, schema: 1, generatedAt, data }`, com os tipos de `data` em `src/core/types.ts`.

## Privacidade

- **Duas chaves.** A chave pessoal (`CL4P_TOKEN`) fica só no hub e é a única que lê os dados. Cada app recebe uma chave própria, derivada da pessoal por HMAC, que só consegue **enviar** o resumo daquele app. Se alguém pegar o celular e extrair a chave do SmartPantry, por exemplo, não lê nada.
- **Dados cifrados no banco.** O Upstash guarda cada resumo cifrado com AES-256-GCM, com chave derivada da `CL4P_TOKEN`. Um vazamento do banco sozinho não expõe nada.
- **Código fora dos logs.** O hub abre os apps com o código no fragmento da URL (`#cl4p=`), que o navegador não manda ao servidor.
- **Chat.** O Gemini gratuito pode usar as conversas para melhorar os modelos ([termos](https://ai.google.dev/gemini-api/terms)). Por padrão vão só métricas e totais por estabelecimento, sem coordenadas, sem nomes de pessoas e sem a lista de lançamentos. A lista detalhada é opcional, em Ajustes.
- **Repositório público.** O código pode ser público: nenhum segredo fica no repositório. As chaves vivem nas variáveis da Vercel e nos Secrets do GitHub. A `CL4P_TOKEN` precisa ter 32 caracteres ou mais (o teste de conexão avisa se for curta).
- Trocar a `CL4P_TOKEN` invalida as chaves dos apps e os dados guardados. Depois da troca, é só abrir cada app pelo hub de novo.

## Configuração (gratuita, sem cartão)

1. **Upstash**: crie um banco Redis em [console.upstash.com](https://console.upstash.com) e copie `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` (aba REST API).
2. **Chave pessoal**: um texto aleatório de 32 caracteres ou mais (ex.: gerador de senhas). Ele será o `CL4P_TOKEN`.
3. **Gemini**: gere a chave em [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
4. **Vercel**: importe este repositório, cadastre as variáveis do `.env.example` e publique.
5. Abra o site publicado, vá em **Ajustes**, cole a chave e toque em **Testar conexão**.
6. Em **Apps**, cadastre o endereço do SmartPantry e do PaperTrail e toque em **Abrir e vincular** em cada app.

### APK

O workflow **Build APK** gera o `CL4P-RZ.apk` a cada push na `main` e publica em **Releases**. A assinatura vem dos Secrets `ANDROID_KEYSTORE_BASE64` e `ANDROID_KEYSTORE_PASSWORD`; sem eles, o build usa uma chave temporária e não publica. No APK, informe em **Ajustes** o endereço da Vercel e a chave (ou cole o código de vínculo que aparece no site).

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
