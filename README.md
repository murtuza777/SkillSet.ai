# SkillSet.ai Backend

Cloudflare-native backend for SkillSet.ai built from [impl.md](./impl.md).

## Stack

- Cloudflare Workers for the API runtime
- Hono for routing
- D1 for relational data
- Durable Objects for realtime rooms and WebSocket coordination
- Workers AI for learning-path generation, task generation, and embeddings
- Vectorize for semantic search
- KV for cache, rate limiting, and verification/session helpers
- R2 for raw content payloads and attachments
- Queues for content ingestion and gamification processing

## Implemented Scope

Phase 1:
- JWT access token auth with refresh-token rotation
- user profiles and user skills
- curated content discovery
- AI-generated learning paths
- task submission and progress tracking
- 1:1 and small-room chat with Durable Objects
- basic points system

Phase 2:
- YouTube and docs connectors
- queue-based ingestion pipeline
- project rooms and collaboration spaces
- peer matching
- badges, levels, and leaderboards
- admin content curation and reindex APIs

## Folder Structure

```text
SkillSet.ai/
+-- impl.md
+-- schema.sql
+-- seed.sql
+-- wrangler.jsonc
+-- .dev.vars.example
+-- package.json
+-- src/
    +-- index.ts
    +-- types.ts
    +-- db/
    |   +-- client.ts
    +-- durable/
    |   +-- room-hub.ts
    +-- lib/
    |   +-- auth.ts
    |   +-- crypto.ts
    |   +-- http.ts
    |   +-- rate-limit.ts
    |   +-- session.ts
    +-- middleware/
    |   +-- auth.ts
    +-- routes/
    |   +-- admin.ts
    |   +-- auth.ts
    |   +-- chat.ts
    |   +-- content.ts
    |   +-- gamification.ts
    |   +-- learning.ts
    |   +-- matching.ts
    |   +-- projects.ts
    |   +-- skills.ts
    |   +-- users.ts
    +-- services/
        +-- admin-service.ts
        +-- ai-service.ts
        +-- auth-service.ts
        +-- chat-service.ts
        +-- content-service.ts
        +-- gamification-service.ts
        +-- learning-service.ts
        +-- matching-service.ts
        +-- project-service.ts
        +-- skills-service.ts
        +-- user-service.ts
```

## Cloudflare Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Authenticate Wrangler

```bash
npx wrangler login
```

### 3. Create Cloudflare resources

Create D1:

```bash
npx wrangler d1 create skillset-ai-db
```

Create KV:

```bash
npx wrangler kv namespace create CACHE
npx wrangler kv namespace create CACHE --preview
```

Create R2 buckets:

```bash
npx wrangler r2 bucket create skillset-ai-content
npx wrangler r2 bucket create skillset-ai-content-preview
```

Create queues:

```bash
npx wrangler queues create skillset-ai-content-jobs
npx wrangler queues create skillset-ai-gamification-jobs
```

Create Vectorize index.
This project uses `@cf/baai/bge-base-en-v1.5`, which produces 768-dimension embeddings, so the index must match that:

```bash
npx wrangler vectorize create skillset-ai-content-index --dimensions=768 --metric=cosine
```

Workers AI is bound directly in `wrangler.jsonc`, so you do not need an external AI API key.

### 4. Update `wrangler.jsonc`

Replace placeholder values in [wrangler.jsonc](./wrangler.jsonc):

- `database_id` for the D1 database
- KV namespace ids
- bucket names if you changed them
- Vectorize index name if you changed it

### 5. Set secrets

Required:

```bash
npx wrangler secret put JWT_SECRET
```

Optional:

```bash
npx wrangler secret put YOUTUBE_API_KEY
```

## D1 Setup

Run the schema and seed files against your D1 database after updating `wrangler.jsonc`:

```bash
npx wrangler d1 execute skillset-ai-db --remote --file=schema.sql
npx wrangler d1 execute skillset-ai-db --remote --file=seed.sql
```

If you want a disposable local database during development, you can also use:

```bash
npx wrangler d1 execute skillset-ai-db --local --file=schema.sql
npx wrangler d1 execute skillset-ai-db --local --file=seed.sql
```

## Local Development

Copy [.dev.vars.example](./.dev.vars.example) to `.dev.vars` and fill in local values:

```bash
Copy-Item .dev.vars.example .dev.vars
```

Then run:

```bash
npm run typecheck
npm run dev
```

Note:
- `npm run dev` uses `wrangler dev --remote`
- remote dev is intentional because Workers AI and your bound Cloudflare resources run on Cloudflare

## Production Deployment

Do not deploy until you are ready. When you are, deploy with:

```bash
npm run deploy
```

## Required Endpoints

Auth:
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`
- `POST /auth/verify-email`

Users:
- `GET /users/me`
- `PATCH /users/me`
- `PUT /users/me/skills`
- `GET /users/me/activity`
- `GET /profiles/:id`

Skills:
- `GET /skills`
- `GET /skills/search?q=`
- `GET /skills/:slug`

Content:
- `POST /content/discover`
- `GET /content/sources/:id`
- `POST /content/reindex`
- `GET /content/search?q=`

Learning:
- `POST /learning-paths/generate`
- `GET /learning-paths/:id`
- `POST /learning-paths/:id/enroll`
- `GET /modules/:id`
- `POST /tasks/:id/submit`

Projects:
- `POST /projects`
- `GET /projects/:id`
- `POST /projects/:id/join`
- `PATCH /projects/:id`
- `GET /projects/:id/members`

Matching:
- `GET /matches/recommendations`
- `POST /matches/:id/accept`
- `POST /matches/:id/reject`

Chat:
- `GET /rooms`
- `POST /rooms`
- `GET /rooms/:id/messages`
- `POST /rooms/:id/messages`
- `POST /rooms/:id/join-token`
- `GET /ws/rooms/:roomId`

Gamification:
- `GET /gamification/me`
- `GET /badges`
- `GET /leaderboards`
- `GET /leaderboards/:scope`

Admin:
- `GET /admin/metrics`
- `POST /admin/content-sources`
- `POST /admin/badges`
- `POST /admin/reindex-skill`
