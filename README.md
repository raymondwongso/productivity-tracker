# productivity-tracker

Plan your days in a calendar and record what actually happened. Activities (sleep, work, workouts, meals, things you watch and games you play) have planned and actual times, and each one is labeled automatically: pending, late, premature, overrun, done or cancelled. One activity can carry several labels, for example late and overrun. Tracker pages (Sleep, Fitness, Work, Cinema and Gaming) turn the finished activities in a date range into tiles and charts.

A pnpm monorepo with three packages: a Fastify API (`api/`), a Next.js web app (`web/`), and `shared/`, which holds the types and label rules both use.

| Service | Port |
| --- | --- |
| API | 3002 |
| Web | 3003 |
| Postgres | 5433 (Docker Compose project `productivity-tracker`) |

The session cookie is called `pt_session`.

## Quick start

Requirements: Node.js 24+, pnpm, Docker with Compose v2, make.

```bash
make api-dev   # terminal 1: Postgres + migrations + API on http://localhost:3002
make web-dev   # terminal 2: web on http://localhost:3003 (redirects to /calendar)
```

Create a test user against a running API (local use only):

```bash
curl -X POST localhost:3002/api/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"demo@example.com","firstName":"Demo","lastName":"User","password":"demo1234"}'
```

Running the API in Docker instead (`make api-docker-up`) requires a secret of 32+ characters: `JWT_SECRET="$(openssl rand -hex 32)" make api-docker-up`.

Other targets: `make api-test`, `make api-build`, `make api-migrate`, `make web-test`, `make web-build`, `make web-lint`, `make api-docker-down|logs|reset`. `make help` lists them all.

`make api-test` includes a suite against a real Postgres (`activity.repository.db.test.ts`). It creates and drops a throwaway database on the server in `DATABASE_URL` (default: the dev database on 5433), so start it first with `make api-dev` or `docker compose -f api/docker-compose.yml up -d db`. Without it that suite fails with a clear message; it is not skipped.

## Configuration

`api/.env.example` and `web/.env.example` list every setting. Copying them to `.env` is optional locally, because the defaults match the Compose database.

| Variable | Used by | Default |
| --- | --- | --- |
| `PORT` | api | `3002` |
| `DATABASE_URL` | api | `postgres://postgres:postgres@localhost:5433/productivity_tracker` |
| `JWT_SECRET` | api | dev-only value; **required, 32+ chars in production** |
| `CORS_ORIGIN` | api | `http://localhost:3003` |
| `COOKIE_SECURE` | api | `true` in production |
| `TRUST_PROXY` | api | `false` |
| `NEXT_PUBLIC_API_URL` | web | `http://localhost:3002` |

## Labels

Labels are computed by `computeLabels` (`shared/src/labels.ts`) and **stored** in `activities.labels` (`TEXT[]`).

- The API writes them when an activity is created, when a planned or actual time changes, and on cancel or restore, using the grace periods in the `settings` table at that moment (late 10, premature 15, overrun 15 minutes by default).
- Changing a grace period never relabels existing activities. Editing only the name, notes or category fields keeps the stored labels.
- "Late" depends on the actual start only. An activity that hasn't started is `pending`, however far past its planned start.
- Only nine sets can be stored: `{pending}`, `{}` (started on time, not finished), `{late}`, `{done}`, `{premature}`, `{overrun}`, `{late,premature}`, `{late,overrun}`, `{cancelled}`. Named CHECK constraints in `006_create_activities.sql` enforce this and every rule that doesn't depend on a grace period.

To change a grace period: `UPDATE settings SET value = 20 WHERE key = 'graceful_late_period';`

## API

All routes are under `/api`; everything except `health`, `auth/register` and `auth/login` requires the session cookie. Errors are `{ "error": "..." }`.

| Area | Routes |
| --- | --- |
| Health | `GET /health` |
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Activities | `GET /activities?from=&to=&category=` (ISO times, at most 92 days, optional category slug), `POST /activities`, `GET/PATCH/DELETE /activities/:id`, `POST /activities/:id/cancel`, `POST /activities/:id/restore` |
| Reference data | `GET /categories`, `GET /settings/grace-periods`, `GET /projects?status=ongoing`, `POST /projects`, `GET /titles`, `POST /titles`, `GET /games`, `POST /games` |
| Stats | `GET /stats/sleep`, `/stats/fitness`, `/stats/work`, `/stats/cinema`, `/stats/gaming`, each `?from=YYYY-MM-DD&to=YYYY-MM-DD&tz=Area/City` (inclusive local days, at most 92) |

Request and response types are in `shared/src/index.ts`. `Activity` is a union on `category`. `PATCH` is partial, and `items` replaces the whole list. The category can't be changed, and fields from another category are refused with 400.

Stats count finished activities only (actual start and end, not cancelled), on the local date of their planned start in `tz`. Responses carry every day of the range, and `averagedDays` (the days up to today) is what per-day averages divide by.

## Database

Migrations are plain SQL in `api/db/migrations/`, applied in order and tracked in `schema_migrations`. Add a new numbered file for any change; never edit an applied one.

- `categories` and `settings` are global and seeded by migrations.
- Each category's extra fields live in a one-to-one detail table (`workout_details`, `meal_details`, `work_details`, `watch_details`, `gaming_details`). Workouts and meals also have ordered item tables.
- Projects, titles and games belong to a user and are referenced from the work, watch and gaming details.
- Stats are computed on each request from the existing rows (`stats.repository.ts` reads one category's activities for the range; `lib/stats.ts` aggregates them). There are no stats tables.
- Activities last at most 24 hours, which lets the calendar's range query use the `planned_start` index from both ends.

## Project structure

```
api/src/
  controllers/            HTTP layer, one file per resource (JSON-schema validation)
  services/               business logic, one file per use case
  repositories/postgres/  raw SQL, one file per resource
  lib/                    auth, password hashing, activity validation, notes sanitizing, stats range + aggregation
shared/src/               API types and computeLabels
web/src/
  app/                    routes only: (auth)/login|register, (app)/calendar|sleep|fitness|work|cinema|gaming (workout, meals redirect to fitness)
  components/             app shell, auth gate, UI primitives (button, field, dropdown, modal, toast)
  features/calendar/      calendar view, time grid, month grid, layout math
  features/activities/    card, modal, category fields, draft model, data hooks
  features/trackers/      range presets, stats hook, charts (columns, share donut, sleep schedule), work board, pages
  lib/                    api-client (the only code that calls the API), dates
```

Request flow: controller → service → repository → Postgres. Web talks to the API only over HTTP.

## Trackers

Each tracker page has one date range (This week, This month, 7, 30 or 90 days, or a custom range of up to 92 days). This month is the default. The range is kept in the URL.

- **Sleep**: days on schedule, late, premature and overslept; time lost to late and premature sleep; hours slept per day; a bedtime and wake-up chart.
- **Fitness**: Workout (focus split, calories burned and minutes per day), Meals (calories consumed per day) and Diet (consumed against burned per day).
- **Work**: hours by project, hours per day, and a read-only board of pending and done work, filtered by project.
- **Cinema** and **Gaming**: hours by title or game, and hours per day.

Only finished activities count, on the day of their planned start. Per-day averages divide by the days in the range up to today.

## Security

- Passwords are hashed with scrypt and a random salt per user. Login does the same hashing work whether or not the email exists, so response times don't reveal accounts.
- Sessions are a JWT in an httpOnly, `SameSite=Lax` cookie that expires after 7 days. In production the API refuses to start without a `JWT_SECRET` of at least 32 characters.
- Login and register are rate-limited to 10 requests a minute. The API sends helmet headers, and CORS allows only the web origin.
- Writes (`POST`, `PATCH`, `DELETE`) from any other `Origin` are refused with 403, which blocks cross-site form posts that `SameSite=Lax` lets through from the same site.
- Every query is parameterized and scoped to the signed-in user.
- Notes are rich text. The API sanitizes them on every write to an allow-list of tags (b, strong, i, em, u, p, br, ul, ol, li) with no attributes.

Known limits:

- Logging out clears the cookie, but a copied token stays valid until it expires.
- Registering with an email that is already taken returns 409, so the API reveals whether an account exists.
- The local defaults are for development only: a fixed JWT secret outside production, and Postgres user `postgres` with password `postgres`, bound to 127.0.0.1.

This project is not production-ready as shipped.
