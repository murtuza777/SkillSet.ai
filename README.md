# SkillSet.ai

SkillSet.ai is a Cloudflare-native collaborative learning platform. It combines structured learning-path generation, curated content discovery, peer matching, realtime chat, project rooms, and gamified progress tracking in one production-oriented stack.

`impl.md` is the single source of truth for the implementation scope. This repo now aligns to that plan with:

- a Cloudflare Worker API built with Hono
- a Next.js App Router frontend prepared for Cloudflare with OpenNext
- D1, KV, R2, Vectorize, Durable Objects, Queues, and Workers AI integrations
- custom email/password auth plus guest sessions
- GitHub Actions for CI and deployment

## Features

- Email/password authentication with refresh-token rotation
- Temporary guest access backed by Workers + KV
- Profile management and skill onboarding
- Skill discovery and content discovery flows
- AI-generated learning paths with modules, lessons, and tasks
- Task submission and AI feedback
- Peer matching with accept/reject and room creation
- Realtime rooms and chat using Durable Objects + WebSockets
- Project creation, joining, completion, and room chat
- Points, badges, levels, and leaderboards
- Admin metrics, content curation, badge creation, and reindex jobs

## Stack

- Frontend: Next.js App Router, React Query, Zustand, OpenNext for Cloudflare
- Backend: Hono on Cloudflare Workers
- Database: Cloudflare D1
- Cache and lightweight state: Cloudflare KV
- File storage: Cloudflare R2
- Embeddings and retrieval: Workers AI + Vectorize
- Realtime: Durable Objects + WebSockets
- Background jobs: Cloudflare Queues
- CI/CD: GitHub Actions + Wrangler

## Repository Layout

```text
SkillSet.ai/
├─ apps/
│  └─ web/                 # Next.js frontend for Cloudflare
├─ src/                    # Hono Worker API
├─ schema.sql              # D1 schema
├─ seed.sql                # Seed data
├─ wrangler.jsonc          # API worker config
├─ impl.md                 # Source-of-truth implementation plan
├─ README.md               # Contributor-facing project guide
└─ uni.md                  # Final-year project documentation
```

## Cloudflare Services

The API worker expects these resources:

- `D1`: relational application data
- `KV`: cache, rate limits, email verification, guest-session state
- `R2`: raw content payloads and cache assets
- `Vectorize`: content embeddings
- `Queues`: content ingestion and gamification jobs
- `Durable Objects`: realtime room coordination
- `Workers AI`: generation and embeddings

The frontend worker uses:

- OpenNext worker bundle
- R2 incremental cache bucket
- Cloudflare Images binding

## Authentication Model

SkillSet.ai uses custom auth rather than Cloudflare Access or a third-party identity provider.

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`
- `POST /auth/verify-email`
- `POST /auth/guest`

Implementation details:

- access tokens are short-lived JWTs
- refresh tokens are stored as hashed records in D1
- verification tokens are stored in KV
- guest users are persisted in D1 with temporary KV-backed guest-session state
- the frontend uses same-origin Next.js API proxy routes so browser clients never need to store raw bearer tokens in local storage

## Local Development

### 1. Install dependencies

Backend:

```bash
npm ci
```

Frontend:

```bash
cd apps/web
npm ci
```

### 2. Configure local variables

Backend `.dev.vars`:

```bash
Copy-Item .dev.vars.example .dev.vars
```

Required backend values:

- `JWT_SECRET`
- `YOUTUBE_API_KEY` is optional

Frontend `.dev.vars`:

```bash
Copy-Item apps/web/.dev.vars.example apps/web/.dev.vars
```

Required frontend value:

- `SKILLSET_API_BASE_URL=http://127.0.0.1:8787`

### 3. Prepare the database

Remote D1:

```bash
npx wrangler d1 execute skillset-ai-db --remote --file=schema.sql
npx wrangler d1 execute skillset-ai-db --remote --file=seed.sql
```

Local D1:

```bash
npx wrangler d1 execute skillset-ai-db --local --file=schema.sql
npx wrangler d1 execute skillset-ai-db --local --file=seed.sql
```

### 4. Run the services

Backend API:

```bash
npm run dev
```

Frontend:

```bash
cd apps/web
npm run dev
```

Open these URLs in development:

- frontend: `http://localhost:3000`
- backend: `http://127.0.0.1:8787`

## Build and Validation

Backend:

```bash
npm run lint
npm run typecheck
npx wrangler deploy --dry-run
```

Frontend:

```bash
cd apps/web
npm run lint
npm run typecheck
npm run build
```

Notes:

- `npm run build:cloudflare` uses `opennextjs-cloudflare build`
- OpenNext currently behaves best on Linux/WSL; plain `next build` is the reliable validation command on Windows

## Deployment

### API worker

Deploy the backend with environment-specific runtime vars:

```bash
npx wrangler deploy --keep-vars \
  --var APP_BASE_URL:https://YOUR_API_URL \
  --var FRONTEND_ORIGIN:https://YOUR_WEB_URL
```

### Frontend worker

Build the OpenNext bundle and deploy the worker:

```bash
cd apps/web
npm run build:cloudflare
npx wrangler deploy --keep-vars --var SKILLSET_API_BASE_URL:https://YOUR_API_URL
```

### Required one-time Cloudflare setup

- create and bind D1, KV, R2, Vectorize, Queues, and Durable Objects for the API worker
- create the frontend R2 cache bucket for OpenNext
- set `JWT_SECRET` as a Wrangler secret on the API worker
- optionally set `YOUTUBE_API_KEY`

## CI/CD

Two workflows are included:

- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`

### CI workflow

- installs backend and frontend dependencies
- runs lint and typecheck on both apps
- runs a backend dry-run bundle
- runs a frontend production build

### Deploy workflow

- triggers automatically on push to `main`
- deploys the API worker first
- builds and deploys the frontend worker second

### Required GitHub secrets

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `SKILLSET_API_BASE_URL`
- `SKILLSET_WEB_BASE_URL`

`SKILLSET_API_BASE_URL` and `SKILLSET_WEB_BASE_URL` are used to inject runtime URLs during deployment without hardcoding production domains into the repo.

## Contributing

1. Read `impl.md` before changing product behavior.
2. Keep feature work aligned to the existing schema and route contracts.
3. Run backend lint/typecheck and frontend lint/typecheck/build before opening a PR.
4. Prefer changes that preserve Cloudflare-native architecture rather than introducing off-platform dependencies.
5. Update `README.md` and `uni.md` whenever architecture, API surface, or deployment flow changes materially.

## Open Source Notes

- This repo is designed as a modular monolith on Cloudflare.
- The frontend talks to the backend through Next.js proxy routes for secure cookie-based session handling.
- If you are contributing from Windows, validate with `next build` locally and rely on Linux CI for the OpenNext adapter build.
