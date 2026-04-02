**SkillSet.ai Technical Implementation Plan**

Assumption: web-first, English-first MVP, designed to run fully on Cloudflare from day one.

This version is the single source of truth for a **Cloudflare-only** production architecture.

**Recommended Core Stack**
- Frontend: `Next.js` deployed on Cloudflare using `OpenNext`
- Backend: `Hono` on `Cloudflare Workers`
- Database: `Cloudflare D1`
- Real-time: `Durable Objects + WebSockets`
- AI generation and embeddings: `Cloudflare Workers AI`
- Vector search: `Cloudflare Vectorize`
- File storage: `Cloudflare R2`
- Cache and lightweight state: `Cloudflare KV`
- Async jobs: `Cloudflare Queues`

Why this stack:
- It keeps infrastructure inside one platform.
- It reduces external operational complexity.
- It matches the goal of a Cloudflare-native deployment.

**1. System Architecture**
Recommendation: build SkillSet.ai as a **modular Cloudflare-native TypeScript system**.

- `Next.js` handles landing, onboarding, auth pages, dashboard, learning, chat, projects, and admin.
- `Hono` Workers expose REST APIs for auth, users, skills, content, learning paths, matching, chat, projects, gamification, and admin.
- `D1` stores relational application data.
- `Durable Objects` manage room state, WebSocket sessions, presence, and room-level event ordering.
- `Workers AI` handles curriculum generation, task generation, challenge feedback, and embeddings.
- `Vectorize` stores embeddings for semantic retrieval and similarity search.
- `R2` stores raw content payloads, transcripts, thumbnails, and chat attachments.
- `KV` stores cache entries, verification tokens, rate-limit state, and lightweight derived data.
- `Queues` handle content ingestion, embedding generation, gamification processing, and periodic recomputation jobs.

Monolith vs microservices:
- Start as a **modular monolith** at the logical level.
- Use one Worker application with separated route and service modules.
- Use Durable Objects and Queue consumers for specialized runtime behavior.
- Extract services only if a part of the system later needs a different release cycle or scaling model.

High-level data flow:
1. User selects a skill and a goal in the frontend.
2. Frontend calls the Worker API.
3. Content service discovers videos and documentation sources.
4. Source metadata is stored in D1 and raw payloads are stored in R2.
5. Queue consumers clean, chunk, summarize, and embed the content.
6. Embeddings are inserted into Vectorize and linked back to D1 records.
7. Workers AI generates a structured learning path.
8. Learning path, modules, lessons, and tasks are stored in D1.
9. Users collaborate in rooms managed by Durable Objects.
10. Activity events trigger gamification processing through Queues and D1.

Deployment architecture:
- `Next.js` on Cloudflare via `OpenNext`
- `Hono` Worker API
- `D1` for relational persistence
- `Durable Objects` for realtime state
- `R2` for blobs and attachments
- `KV` for cache, verification, and rate limiting
- `Workers AI` for inference
- `Vectorize` for embeddings
- `Queues` for background processing

**2. Database Design**
Use **Cloudflare D1** as the main relational database.

Why D1 now:
- You want the full stack to stay inside Cloudflare.
- D1 is sufficient for the Phase 1 and Phase 2 scope.
- It supports structured relational data, indexes, and Worker-native access.

Core tables:

| Table | Example fields | Notes |
|---|---|---|
| `users` | `id`, `email`, `password_hash`, `role`, `status`, `email_verified_at`, `created_at`, `updated_at` | Primary auth identity |
| `profiles` | `user_id`, `display_name`, `bio`, `avatar_url`, `timezone`, `language`, `experience_level`, `weekly_hours` | 1:1 with users |
| `skills` | `id`, `slug`, `name`, `category`, `description`, `is_active` | Shared taxonomy |
| `user_skills` | `id`, `user_id`, `skill_id`, `direction`, `proficiency_level`, `target_level`, `priority` | `direction` = `have` or `want` |
| `learning_paths` | `id`, `skill_id`, `title`, `description`, `difficulty`, `goal_type`, `estimated_hours`, `source_strategy`, `version`, `created_at` | Path template |
| `user_learning_paths` | `id`, `user_id`, `learning_path_id`, `status`, `progress_pct`, `started_at`, `completed_at`, `current_module_id` | Enrollment |
| `modules` | `id`, `learning_path_id`, `title`, `summary`, `sequence_no`, `estimated_minutes`, `unlock_rule_json` | Ordered path units |
| `lessons` | `id`, `module_id`, `title`, `lesson_type`, `summary`, `content_ref_json`, `sequence_no` | Lesson layer |
| `tasks` | `id`, `module_id`, `title`, `task_type`, `instructions`, `difficulty`, `points_reward`, `acceptance_criteria_json` | Exercises/challenges |
| `task_attempts` | `id`, `task_id`, `user_id`, `submission_text`, `submission_url`, `score`, `status`, `feedback_json`, `submitted_at` | User submissions |
| `projects` | `id`, `learning_path_id`, `title`, `description`, `owner_id`, `visibility`, `repo_url`, `status`, `created_at` | Team projects |
| `project_members` | `id`, `project_id`, `user_id`, `role`, `joined_at` | Collaboration membership |
| `content_sources` | `id`, `provider`, `source_type`, `canonical_url`, `external_id`, `title`, `author_name`, `license`, `language`, `published_at`, `quality_score`, `metadata_json` | Normalized source metadata |
| `content_chunks` | `id`, `content_source_id`, `chunk_index`, `text`, `token_count`, `vector_id`, `keywords_json`, `summary` | Retrieval units |
| `chat_rooms` | `id`, `room_type`, `name`, `related_project_id`, `related_module_id`, `created_by`, `created_at` | Room registry |
| `chat_room_members` | `id`, `room_id`, `user_id`, `role`, `joined_at`, `last_read_message_id` | Membership/read state |
| `messages` | `id`, `room_id`, `sender_id`, `message_type`, `body`, `attachments_json`, `reply_to_message_id`, `created_at`, `edited_at`, `deleted_at` | Persistent chat |
| `peer_matches` | `id`, `user_id`, `matched_user_id`, `score`, `status`, `reason_codes_json`, `created_at`, `expires_at` | Matching results |
| `activity_logs` | `id`, `user_id`, `event_type`, `entity_type`, `entity_id`, `metadata_json`, `created_at` | Audit plus gamification events |
| `point_ledger` | `id`, `user_id`, `event_type`, `points_delta`, `source_entity`, `source_id`, `idempotency_key`, `created_at` | Immutable points ledger |
| `badge_definitions` | `id`, `code`, `name`, `description`, `rule_json`, `icon_url`, `rarity`, `is_active` | Badge rules |
| `user_badges` | `id`, `user_id`, `badge_id`, `awarded_at` | Earned badges |
| `level_definitions` | `id`, `level_no`, `title`, `min_points` | Level map |
| `leaderboard_snapshots` | `id`, `board_type`, `scope_type`, `scope_id`, `period_type`, `rankings_json`, `generated_at` | Cached leaderboard data |
| `refresh_tokens` | `id`, `user_id`, `token_hash`, `expires_at`, `revoked_at`, `created_at`, `ip_address`, `user_agent` | Refresh token rotation |
| `api_keys` | `id`, `name`, `key_hash`, `owner_user_id`, `scope_json`, `last_used_at`, `revoked_at` | Optional internal integrations |

Key relationships:
- `users -> profiles` is 1:1.
- `users <-> skills` is many-to-many through `user_skills`.
- `learning_paths -> modules -> lessons/tasks` is hierarchical.
- `users <-> learning_paths` is many-to-many through `user_learning_paths`.
- `projects` connect to `chat_rooms`.
- `content_sources -> content_chunks` supports retrieval and ranking.
- `activity_logs` drives gamification and reporting.

Suggested indexes:
- `users(email)` unique
- `skills(slug)` unique
- `user_skills(user_id, direction)`
- `modules(learning_path_id, sequence_no)`
- `tasks(module_id)`
- `messages(room_id, created_at desc)`
- `peer_matches(user_id, score desc)`
- `content_chunks(content_source_id, chunk_index)`

**3. Authentication and Security**
Use JWT-based auth with refresh-token rotation, fully implemented on Cloudflare.

Auth model:
- Email/password at MVP
- No external auth provider required for Phase 1 or Phase 2

Token strategy:
- Access JWT: short-lived, for example `15 minutes`
- Refresh token: longer-lived, for example `30 days`
- Store hashed refresh tokens in `D1`
- Rotate refresh tokens on each refresh
- Use secure cookies for refresh tokens

Cloudflare auth flow:
1. User registers or logs in through the Worker API.
2. Passwords are hashed in the Worker runtime.
3. API issues:
   - access JWT
   - secure refresh cookie
4. Verification tokens and temporary auth metadata are stored in `KV`.
5. Rate limiting is stored in `KV`.

Role-based access:
- `user`
- `mentor`
- `admin`

Security controls:
- Password hashing with `Argon2id`
- Strict schema validation
- Rate limiting via `KV`
- Email verification tokens in `KV`
- Secure cookies, HTTPS, signed tokens
- Audit logging in `D1`
- Signed R2 uploads for attachments
- Room-level authorization for WebSockets

**4. Content Aggregation System**
Goal: fetch relevant learning content from external sources, then normalize and store it using Cloudflare services.

Primary content inputs:
- YouTube Data API
- Official documentation such as MDN and framework docs
- Curated blogs and educational sources

Content pipeline:
1. User requests a skill or goal.
2. Worker fetches candidate source metadata.
3. Source metadata is stored in `content_sources`.
4. Raw payloads are stored in `R2`.
5. Queue consumer cleans and chunks content.
6. Workers AI creates embeddings.
7. Embeddings are inserted into `Vectorize`.
8. `content_chunks.vector_id` links chunk rows to Vectorize vectors.
9. Discovery results are cached in `KV`.

How to rank relevant content:
- semantic relevance
- authority of source
- freshness
- quality and completeness
- popularity and engagement signals
- fit to learner level and goal

Suggested scoring formula:
`final_score = 0.35 semantic_relevance + 0.20 authority + 0.15 quality + 0.10 freshness + 0.10 engagement + 0.10 learner_fit`

Caching strategy:
- `KV` for discovery and search cache
- `R2` for raw source payloads
- `D1` for normalized metadata
- `Vectorize` for semantic retrieval

**5. AI Learning Engine**
Use **Cloudflare Workers AI** for generation and embeddings.

Responsibilities:
- Generate learning paths
- Break content into modules, lessons, and tasks
- Generate challenges and exercises
- Generate task feedback
- Generate embeddings for semantic retrieval

Core AI workflow:
1. Retrieve the most relevant content chunks from `Vectorize`.
2. Build learner context from D1 user/profile data.
3. Call Workers AI with a strict JSON output schema.
4. Validate JSON output.
5. Store learning paths in D1.
6. Run an AI review pass for quality and prerequisite coverage.

Workers AI usage:
- Text generation for:
  - curriculum generation
  - task generation
  - challenge feedback
  - match explanation
- Embeddings for:
  - content retrieval
  - semantic ranking
  - optional profile similarity later

Prompt engineering strategy:
- Use dedicated prompt templates for each task.
- Force structured JSON output.
- Include only approved context snippets.
- Validate and reject malformed AI output.

Personalization:
- Inputs:
  - current proficiency
  - target skill
  - pace
  - preferred content type
  - weekly availability
  - completion history
  - quiz and task performance

**6. Peer Matching System**
Use a hybrid approach:
- rules and business logic in D1-backed queries
- optional semantic similarity using Workers AI embeddings + Vectorize for future enhancement

Matching factors:
- skill overlap
- goal alignment
- proficiency proximity
- weekly availability overlap
- timezone compatibility
- language compatibility
- collaboration style

Suggested score:
`0.40 goal_similarity + 0.20 skill_overlap + 0.15 level_proximity + 0.10 availability_overlap + 0.10 timezone_overlap + 0.05 collaboration_style`

Output:
- top peer recommendations
- reason labels
- suggested room type

**7. Real-Time Collaboration**
Use:
- `Durable Objects` for room state and WebSocket coordination
- `D1` for durable room metadata and message history
- `R2` for message attachments

Room model:
- `peer_room`
- `project_room`
- `module_room`
- `cohort_room`

Realtime events:
- `room.join`
- `room.leave`
- `message.send`
- `message.received`
- `typing.start`
- `typing.stop`
- `presence.update`
- `task.progress`
- `project.event`

**8. Gamification System**
Use D1 as the source of truth and Queues for background recomputation.

Points logic:
- task completed: `+10`
- module completed: `+50`
- project completed: `+100`
- daily streak: `+5 x streak multiplier`
- accepted helpful answer: `+15`
- peer mentoring session complete: `+20`

Rules:
- write every point change to `point_ledger`
- use idempotency keys
- support reversals for moderation cases

Badges:
- `First Task`
- `Fast Starter`
- `7-Day Streak`
- `Project Finisher`
- `Peer Mentor`
- `Consistency Master`

Leaderboards:
- global
- per skill
- per cohort
- weekly and all-time

**9. Frontend Design**
Frontend architecture:
- `Next.js App Router`
- server components for page data
- client components for chat and interactive flows
- `TanStack Query` for server state
- `Zustand` for local UI and realtime state

Pages:
- landing
- auth
- onboarding
- dashboard
- skill explorer
- learning path detail
- module/task view
- project room
- chat
- profile
- leaderboard
- admin

**10. API Design**
REST endpoints:

| Domain | Example endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/verify-email` |
| Users | `GET /users/me`, `PATCH /users/me`, `GET /profiles/:id`, `PUT /users/me/skills`, `GET /users/me/activity` |
| Skills | `GET /skills`, `GET /skills/search?q=`, `GET /skills/:slug` |
| Learning | `POST /learning-paths/generate`, `GET /learning-paths/:id`, `POST /learning-paths/:id/enroll`, `GET /modules/:id`, `POST /tasks/:id/submit` |
| Content | `POST /content/discover`, `GET /content/sources/:id`, `POST /content/reindex`, `GET /content/search?q=` |
| Projects | `POST /projects`, `GET /projects/:id`, `POST /projects/:id/join`, `PATCH /projects/:id`, `GET /projects/:id/members` |
| Matching | `GET /matches/recommendations`, `POST /matches/:id/accept`, `POST /matches/:id/reject` |
| Chat | `GET /rooms`, `POST /rooms`, `GET /rooms/:id/messages`, `POST /rooms/:id/messages`, `POST /rooms/:id/join-token` |
| Gamification | `GET /gamification/me`, `GET /badges`, `GET /leaderboards`, `GET /leaderboards/:scope` |
| Admin | `GET /admin/metrics`, `POST /admin/content-sources`, `POST /admin/badges`, `POST /admin/reindex-skill` |

Realtime handshake:
1. Client requests a room join token
2. Worker validates membership
3. Client connects to the target Durable Object
4. Durable Object verifies token and joins the session

**11. Development Roadmap**
Phase 1:
- Next.js frontend on Cloudflare
- Hono Worker API
- D1
- JWT + refresh auth
- profiles and skills
- curated content ingestion for a few skills
- Workers AI learning paths
- task submission tracking
- simple 1:1 and small-room chat
- basic points

Phase 2:
- YouTube and docs connectors
- queue-based ingestion
- project rooms
- peer matching
- badges, levels, leaderboards
- admin content curation

Phase 3:
- adaptive personalization
- stronger semantic recommendations
- mentor assistant

Phase 4:
- scaling, analytics, moderation, and more advanced AI refinement

**12. Tech Stack Justification**
- `Next.js`: best frontend fit
- `Hono`: lightweight Cloudflare-friendly API framework
- `Workers`: global API runtime
- `D1`: Cloudflare-native relational database
- `Durable Objects`: realtime room coordination
- `Workers AI`: Cloudflare-native generation and embeddings
- `Vectorize`: Cloudflare-native semantic search
- `R2`: Cloudflare-native blob storage
- `KV`: Cloudflare-native cache and ephemeral auth state
- `Queues`: Cloudflare-native background processing

**13. Risks and Challenges**
- D1 is not a full replacement for a large traditional relational database
  - Solution: keep schema and queries simple, indexed, and phase-appropriate

- Worker runtime limits for long-running AI work
  - Solution: use Queues for asynchronous processing

- Quality of AI-generated curriculum
  - Solution: strict JSON schema, review prompts, and curated source grounding

- External content licensing
  - Solution: source allowlists, attribution, and compliance tracking

**Final Recommendation**
For this project, use:
- `Next.js`
- `Hono on Workers`
- `D1`
- `Durable Objects`
- `Workers AI`
- `Vectorize`
- `R2`
- `KV`
- `Queues`

This is the correct Cloudflare-only implementation direction for SkillSet.ai.
