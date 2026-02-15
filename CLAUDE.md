# TaskPulse Developer Guide

**TaskPulse** is a background task monitoring dashboard built with modern web technologies. This guide provides essential information for developers working on the project.

## Project Overview

TaskPulse provides real-time observability for background tasks with features including:
- Task Registry and real-time execution traces
- Log streaming and monitoring
- Scheduling and webhook management
- Multi-project organization with team collaboration

## Tech Stack

### Core Framework
- **Next.js 16** - React framework with App Router and Turbopack
- **React 19** - UI library with latest features
- **TypeScript 5.9** - Type safety and developer experience

### Database & Auth
- **Prisma 7** - Database ORM with Neon adapter for PostgreSQL
- **Neon PostgreSQL** - Serverless PostgreSQL database
- **NextAuth v5** - Authentication (beta.30 - exact pin)

### UI & Styling
- **Tailwind CSS v4** - Utility-first CSS framework (CSS-first config)
- **Headless UI** - Accessible UI components
- **Recharts 3** - Data visualization and charts

### Testing & Quality
- **Vitest 4** - Unit testing framework
- **Playwright** - End-to-end testing
- **ESLint 9** - Code linting (flat config)
- **Prettier** - Code formatting

## Local Development Setup

### Prerequisites
- Node.js 22+
- npm or yarn
- PostgreSQL database (recommended: Neon)

### Setup Steps
```bash
# 1. Clone and install dependencies
npm install

# 2. Generate Prisma client
npx prisma generate

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your database URLs and secrets

# 4. Run database migrations
npx prisma db push

# 5. Seed demo data
npm run db:seed

# 6. Start development server
npm run dev
```

The application will be available at http://localhost:3000

### Demo Credentials
- **Email**: demo@workermill.com
- **Password**: demo1234

## Development Conventions

### Dark Theme
All UI components use dark theme styling:
- Base background: `bg-gray-950 text-gray-100`
- Card/surface backgrounds: `bg-gray-900`
- Borders: `border-gray-800`
- No light mode support

### Tailwind CSS v4
- **CSS-first configuration** - NO `tailwind.config.ts` file
- Theme customization via `@theme` blocks in CSS
- Import via `@import "tailwindcss"` in globals.css
- Content detection is automatic

### Prisma 7 Patterns
```typescript
// Import from generated client (NOT @prisma/client)
import { PrismaClient } from "@/generated/prisma";
import { PrismaNeon } from "@prisma/adapter-neon";

// Use Neon adapter for connection pooling
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
```

### Next.js 16 Async Params Pattern
```typescript
// Page components
export default async function Page({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const { project } = await params;
  // ...
}

// API route handlers
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  // ...
}
```

### NextAuth v5 Usage
```typescript
import { auth } from "@/lib/auth";

// Server components - check authentication
export default async function ProtectedPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  // ...
}

// Client components - use SessionProvider
import { useSession } from "next-auth/react";
```

### ESLint Configuration
- Uses **ESLint 9 flat config** (`eslint.config.mjs`)
- NO `.eslintrc.json` files
- Run linting with `eslint .` (not `next lint` - removed in Next.js 16)

## Run Status Colors

Use these consistent colors for run status indicators:

| Status | Color | Tailwind Classes |
|--------|-------|------------------|
| QUEUED | Blue | `text-blue-400 bg-blue-500/20` |
| EXECUTING | Yellow | `text-yellow-400 bg-yellow-500/20` |
| COMPLETED | Green | `text-green-400 bg-green-500/20` |
| FAILED | Red | `text-red-400 bg-red-500/20` |
| CANCELLED | Gray | `text-gray-400 bg-gray-500/20` |
| TIMED_OUT | Orange | `text-orange-400 bg-orange-500/20` |

## Quality Gates

Before committing, ensure all quality checks pass:

```bash
# Type checking (must have 0 errors)
npm run typecheck

# Linting (must have 0 errors)
npm run lint

# Unit tests (all must pass)
npm run test

# End-to-end tests (when applicable)
npm run test:e2e
```

## Important Files and Patterns

### Authentication Route Protection
All pages under `/projects` and `/[project]/**` must include session validation:

```typescript
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

const session = await auth();
if (!session?.user) {
  redirect("/login");
}
```

### Database Client Singleton
Always use the singleton pattern from `@/lib/prisma` - never create new PrismaClient instances.

### Font Configuration
- **Inter** - Primary font for body text
- **JetBrains Mono** - Monospace font for code (available as `font-mono` class)

## Database Schema

The project uses a comprehensive schema with 10 models:
- **User, Project, ProjectMember** - User and project management
- **Task, TaskRun, TaskLog** - Task execution and logging
- **Schedule, Webhook** - Scheduling and notifications
- **ApiKey, InviteToken** - API access and team invites

## Environment Variables

Required environment variables:
```bash
# Database (both required for Prisma 7)
DATABASE_URL=postgresql://user:pass@host:5432/db          # Pooled connection
DIRECT_DATABASE_URL=postgresql://user:pass@host:5432/db   # Direct connection

# Authentication
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=true

# Seeding
SEED_TOKEN=your-seed-token
```

## DO NOT Create

These files are explicitly not part of the project structure:
- `vercel.json` - Vercel auto-detects Next.js apps
- `tailwind.config.ts` - Tailwind v4 uses CSS-first configuration
- `.eslintrc.json` - Use ESLint 9 flat config instead
- `components.json` - No shadcn/ui CLI configuration needed
- Binary files or large assets without explicit requirements

## Architecture Decisions

Based on team collaboration:

1. **ESLint Configuration** - Using basic flat config due to compatibility issues with FlatCompat + Next.js 16.1.0 + ESLint 9
2. **Database Schema** - Comprehensive 10-model normalized schema with proper constraints and audit trails
3. **Page Structure** - All pages use Next.js 16 async params pattern with proper dark theme styling

## Testing Strategy

- **Unit Tests** - Vitest for API routes and utility functions
- **Integration Tests** - Playwright for full user workflows
- **Database Tests** - Test against production Neon database with idempotent seeds
- **CI/CD** - Automated testing on all pull requests and deployments