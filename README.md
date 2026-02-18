# TaskPulse

**A real-time task monitoring dashboard built entirely by AI agents.**

TaskPulse is a showcase application demonstrating [WorkerMill](https://workermill.com) — an autonomous AI coding platform that takes Jira/Linear/GitHub tickets and ships production code. Every line of code in this repository was written, tested, and deployed by WorkerMill's AI workers.

[Live Demo](https://taskpulse.workermill.com) | [WorkerMill Platform](https://workermill.com) | [Documentation](https://workermill.com/docs)

[![CI](https://github.com/workermill-examples/taskpulse/actions/workflows/ci.yml/badge.svg)](https://github.com/workermill-examples/taskpulse/actions/workflows/ci.yml)
[![Deploy](https://github.com/workermill-examples/taskpulse/actions/workflows/deploy.yml/badge.svg)](https://github.com/workermill-examples/taskpulse/actions/workflows/deploy.yml)

---

## What's Inside

TaskPulse is a real, functional background task monitoring platform — not a toy demo. It includes:

- **Task Registry** — Register and manage background tasks across your infrastructure
- **Real-time Traces** — Monitor task execution with detailed timing and hierarchical trace visualization
- **Log Streaming** — Stream logs via Server-Sent Events with level filtering and search
- **Dashboard Analytics** — KPI cards, execution charts, and status breakdowns per project
- **Cron Scheduling** — Create and manage cron-based schedules with human-readable descriptions
- **Webhooks** — Event-driven notifications with HMAC signing and delivery tracking
- **API Keys** — Scoped API key management with hashed storage and usage tracking
- **Team Collaboration** — Multi-project organization with role-based access (Owner, Admin, Member, Viewer)
- **Keyboard Shortcuts** — Global search and navigation shortcuts

## How It Was Built

TaskPulse was created across multiple WorkerMill task runs (called "epics"), each triggered by tickets on a project board:

| Epic | Stories | What Was Built |
|------|---------|----------------|
| TP-1 | 8 | Project scaffolding, Prisma 7 + Neon adapter, auth, RBAC middleware, run simulation engine, task/run CRUD routes, expanded seed data, 40+ unit tests, CI/CD |
| TP-2 | 8 | Layout components, runs table with filtering, run detail (timeline + logs), tasks pages, dashboard with Recharts, settings page, E2E tests |
| TP-3 | 6 | Schedule API routes, API key routes, schedule UI, API key UI in settings, keyboard shortcuts + global search, unit tests for new features |
| TP-4 | 2 | Test infrastructure fixes (jsdom mocking), production config verification, landing page |

Each epic was planned by a WorkerMill planner agent, decomposed into parallel stories, executed by specialist AI personas (frontend developer, backend developer, QA engineer), reviewed by a tech lead agent, and consolidated into a single PR.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19 + TailwindCSS 4 + Headless UI |
| Charts | Recharts 3 |
| Database | PostgreSQL via Prisma 7 ORM (Neon serverless) |
| Auth | NextAuth v5 |
| Validation | Zod |
| Testing | Vitest (unit) + Playwright (E2E) |
| Hosting | Vercel |
| CI/CD | GitHub Actions |

## Try the Demo

Visit [taskpulse.workermill.com](https://taskpulse.workermill.com) and click **Try the Demo**, or sign in manually:

| | |
|-|-|
| **Email** | demo@workermill.com |
| **Password** | demo1234 |

The demo account comes pre-configured with projects, tasks, runs with traces and logs, schedules, and API keys.

## Run Locally

```bash
git clone https://github.com/workermill-examples/taskpulse.git
cd taskpulse
npm ci
```

Create `.env.local`:

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/taskpulse"
DIRECT_DATABASE_URL="postgresql://user:pass@localhost:5432/taskpulse"
NEXTAUTH_SECRET="any-random-string"
NEXTAUTH_URL="http://localhost:3000"
AUTH_TRUST_HOST="true"
SEED_TOKEN="any-random-string"
```

Set up the database and start:

```bash
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

Open [localhost:3000](http://localhost:3000).

---

## API

TaskPulse exposes a RESTful API for programmatic task management. All project endpoints require authentication via API key (`Authorization: Bearer <key>`) or session cookie.

### Task Triggering

```bash
curl -X POST https://taskpulse.workermill.com/api/trigger \
  -H "Authorization: Bearer tp_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"taskId": "...", "input": {"key": "value"}}'
```

### Key Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/projects/:slug/tasks` | List registered tasks |
| `POST /api/projects/:slug/runs` | Create a new run |
| `GET /api/projects/:slug/runs/:id` | Run details with traces |
| `GET /api/projects/:slug/runs/:id/stream` | SSE log stream |
| `POST /api/projects/:slug/runs/:id/retry` | Retry a failed run |
| `POST /api/projects/:slug/runs/:id/cancel` | Cancel a running task |
| `GET /api/projects/:slug/stats` | Dashboard statistics |
| `GET /api/health` | Health check |

---

## Project Structure

```
src/
  app/                    # Next.js App Router pages
    api/                  # Server-side API routes
    [project]/            # Dynamic project routes
      dashboard/          # KPI cards, charts, status breakdown
      tasks/              # Task registry and detail pages
      runs/               # Runs table with filtering + detail view
      schedules/          # Cron schedule management
      settings/           # API keys, members, webhooks
    login/ signup/        # Auth pages
  components/
    shared/               # Reusable UI (EmptyState, LoadingSpinner, etc.)
    layout/               # Header and Sidebar
    dashboard/            # Charts (Recharts)
    runs/                 # RunsTable, RunTimeline, RunLogs, TriggerRunDialog
    tasks/                # TaskCard, TaskConfig
    schedules/            # ScheduleForm, CronDisplay
  lib/
    auth.ts               # NextAuth v5 configuration
    prisma.ts             # PrismaClient singleton
    middleware.ts          # Auth & RBAC helpers
    validations.ts         # Zod schemas
  hooks/
    useSSE.ts             # Server-Sent Events hook
    useKeyboardShortcuts.ts
prisma/
  schema.prisma           # Database schema (11 models, 4 enums)
  seed.ts                 # Demo data seeder
tests/
  unit/                   # Vitest unit tests (101 test cases)
  e2e/                    # Playwright E2E tests
```

## Database Schema

```
User ──< ProjectMember >── Project
                              │
                              ├──< Task ──< Run ──< Log
                              │              └──< Trace (self-referential)
                              ├──< Schedule
                              ├──< ApiKey
                              └──< Webhook ──< WebhookEvent
```

11 models: User, Project, ProjectMember, Task, Run, Log, Trace, Schedule, ApiKey, Webhook, WebhookEvent.

## Development

```bash
npm run dev          # Start dev server
npm run lint         # ESLint
npm run typecheck    # TypeScript check
npm test             # Unit tests (Vitest)
npm run test:e2e     # E2E tests (Playwright)
npm run db:studio    # Prisma Studio
```

## About WorkerMill

[WorkerMill](https://workermill.com) is an autonomous AI coding platform. Point it at a ticket, and it:

1. **Plans** — Decomposes the task into parallel stories with file targets
2. **Executes** — Specialist AI personas (frontend dev, backend dev, QA) work in parallel
3. **Reviews** — Tech lead agent reviews each story for quality
4. **Ships** — Creates a consolidated PR with all changes

TaskPulse exists to demonstrate that WorkerMill can build and maintain a real application end-to-end. Every commit in this repo's history traces back to a WorkerMill task.

## For AI Agents

If you're an AI worker building on this codebase, see [CLAUDE.md](./CLAUDE.md) for development guidelines, version constraints, and deployment instructions.

## License

MIT
