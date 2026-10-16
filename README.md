<div align="center">

<img src="public/icon.svg" width="88" alt="CL4P-RZ icon" />

# CL4P-RZ

**English** · [Português](README.pt-BR.md)

Personal hub that pulls data from my own apps, cross-references it, and answers questions about me in a chat with the personality of CL4P-TP (Claptrap, from Borderlands).

![React](https://img.shields.io/badge/React_19-292524?logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-292524?logo=typescript&logoColor=3178C6)
![Capacitor](https://img.shields.io/badge/Capacitor_8-292524?logo=capacitor&logoColor=119EFF)
![Vercel](https://img.shields.io/badge/Vercel-292524?logo=vercel&logoColor=white)
![Upstash](https://img.shields.io/badge/Upstash_Redis-292524?logo=upstash&logoColor=00E9A3)
![Gemini](https://img.shields.io/badge/Gemini_API-292524?logo=googlegemini&logoColor=8E75B2)

</div>

## Cross-references

| Insight | Apps | How |
| --- | --- | --- |
| **Spending by place** | RetroFin × RoutineTracker | Each purchase time is matched against the stay recorded at that moment (10-minute tolerance): work, home, university, unregistered places, in transit. |
| **Gym days × spending** | RoutineTracker × RetroFin | Average daily spending on workout days vs. other days. |
| **Groceries × pantry** | RetroFin × SmartPantry | Grocery spending in the bank vs. scanned receipts, receipt-to-statement matching and food waste. |
| **Wishlist × monthly surplus** | WishWatch × RetroFin | Months of surplus needed to buy the list, what fits this month, what is at target price. |
| **Study × reading** | RoutineTracker × PaperTrail | Weekly hours at study places vs. texts added and read. |
| **When money goes out** | RetroFin | Heatmap by weekday and time of day. |
| **RotMG** | RotMG Account Manager | Maxed characters, deaths, deadliest class. |
| **Calendar load** | Calendar × Mood × watch × RetroFin | Mood, sleep and impulse spending on free days vs. busy days (3+ meetings); sleep before early meetings. |
| **Weather** | Weather × Mood × watch × RetroFin | Mood, steps and impulse spending on rainy, hot and dry days. |

All insights are pure, tested functions in `src/core/metrics.ts`, shared by the UI and the chat.

## Architecture

```
RetroFin ───────┐
RoutineTracker ─┤                    ┌──────────────────── Vercel ───────────────────┐
SmartPantry ────┤  POST /api/ingest  │  /api/ingest     stores each app's latest summary
WishWatch ──────┼──────────────────► │  /api/snapshots  returns all of them           │──► Upstash Redis
PaperTrail ─────┤  (Bearer key)      │  /api/chat       cross-referenced context + Gemini ──► Gemini
RotMG ──────────┘                    └────────────────────────────────────────────────┘
                                                        ▲
                                     CL4P-RZ (PWA on Vercel or APK) reads, joins and displays
```

- **CL4P link** (`docs/cl4pLink.ts`): a small module copied into each app. It stores the link code, batches changes for 3 s, only sends when content changed, and retries when the connection comes back.
- **Link code**: `cl4p1.<base64url>` holding the server URL and key. It arrives via the URL fragment (`#cl4p=`), deep link (`retrofin://cl4p?code=`, `routinetracker://cl4p?code=`) or is pasted in the app settings.
- **Contract**: `{ app, schema: 1, generatedAt, data }`, with `data` types in `src/core/types.ts`.

## Calendar and weather

The hub's server fetches two sources itself, every 30 minutes while the app is in use:

- **Calendar:** one or more private iCal links (Google Calendar → Settings → Integrate calendar → *Secret address in iCal format*). Recurring events are expanded; all-day and "free" events don't count as meetings. The links are stored encrypted and never sent back to the device.
- **Weather:** [Open-Meteo](https://open-meteo.com) daily data (free, no key) for the last 92 days and the next 7, for the city set in Settings.


- **Two kinds of keys.** The personal key (`CL4P_TOKEN`) lives only in the hub and is the only one that can read data. Each app gets its own HMAC-derived key that can only **send** that app's summary.
- **Encrypted at rest.** Summaries are stored in Upstash with AES-256-GCM, keyed from `CL4P_TOKEN`.
- **Link codes stay out of server logs**: apps are opened with the code in the URL fragment (`#cl4p=`).
- **Chat.** Gemini's free tier may use prompts to improve Google's models ([terms](https://ai.google.dev/gemini-api/terms)). By default only metrics and per-merchant totals are sent, without coordinates or personal names. The detailed list is opt-in.
- No secret lives in the repository: keys are Vercel environment variables and GitHub Secrets.

## Setup (free tiers, no credit card)

1. Create an Upstash Redis database and copy the REST URL and token.
2. Pick a long random personal key (`CL4P_TOKEN`).
3. Get a Gemini API key.
4. Import the repo on Vercel, add the variables from `.env.example`, deploy.
5. Open the site, go to **Ajustes**, paste the key and run **Testar conexão**.
6. In **Apps**, tap **Abrir e vincular** on each app.

The **Build APK** workflow publishes `CL4P-RZ.apk` to Releases on every push to `main`.

## Development

```bash
npm install
cp .env.example .env.local
npm run dev
npm test
```

## License

[MIT](LICENSE)
