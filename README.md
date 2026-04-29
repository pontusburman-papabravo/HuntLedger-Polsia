# HuntLedger

Digital jakt- och skytteloggbok. Monorepo med Fastify-API och React/Vite-frontend.
Den här mappen är **källan av sanning** — vad som ligger här är vad som körs på Polsia.

## Layout

```
apps/
  api/                 Fastify + TypeScript API mot Postgres
  web/                 React 18 + Vite + i18next-frontend
    public/            Statiska assets (manifest, badges, guider, icons)
packages/
  shared/              Delade TypeScript-typer och Zod-scheman
_serve.mjs             Produktionsstart — serverar API + frontend på samma port
landing.html           Marknadssida som serveras på GET /
render.yaml            Polsia/Render-deploykonfig
```

## Lokal utveckling

Kräver Node.js >= 20.10 (med npm). På Mac: `brew install node@20`.

```bash
npm install --include=dev --legacy-peer-deps
npm run build              # bygger shared → api → web i rätt ordning
node _serve.mjs            # startar produktionsservern på PORT (default 10000)
```

För hot-reload under utveckling, kör API och webb i varsin terminal:

```bash
npm run dev:api            # tsx watch + Fastify på 10000
npm run dev:web            # Vite dev server på 5173 (proxar /api → 10000)
```

## Miljövariabler

Sätts i Polsia/Render UI:t under Environment Variables — **inte i koden**.

| Variabel | Krävs | Beskrivning |
|---|---|---|
| `DATABASE_URL` | ja | Postgres connection string (Neon, Supabase, etc.) |
| `JWT_SECRET` | ja | Slumpmässig 64-tecken-sträng för auth-tokens |
| `PORT` | nej | Default 10000 |
| `HOST` | nej | Default 0.0.0.0 |
| `POLSIA_ANALYTICS_SLUG` | nej | Default `huntlog` |
| `NODE_ENV` | nej | Sätts till `production` i render.yaml |

`apps/api/.env.example` och `apps/web/.env.example` listar exakta variabler.

## Deploy till Polsia

1. Pusha den här mappen till ett GitHub-repo. **Roten i repot ska vara den här mappen** — dvs `apps/` och `packages/` ska ligga direkt i repot, inte i en undermapp.
2. Anslut repot i Polsia.
3. Polsia läser `render.yaml` automatiskt och kör:
   - **Build**: `npm install --include=dev --legacy-peer-deps && npm run build`
   - **Start**: `node _serve.mjs`
4. Sätt miljövariablerna ovan i Polsia.

Inget mer. Ingen bootstrap, inga ZIP-nedladdningar, inga patchar vid runtime.

## Vad som *inte* finns kvar

Den gamla `bootstrap.mjs` (12 148 rader) som hämtade källkod från ett externt GitHub-repo och patchade den vid varje rendering är borttagen. All kod är nu fullt synlig i den här mappen.
