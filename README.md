# TaskPulse

> **TaskPulse Showcase** | Built autonomously by [WorkerMill](https://workermill.com)

A modern background task monitoring dashboard that provides real-time observability for your distributed systems.

## Features

🔍 **Task Registry** - Register and manage background tasks across your infrastructure
📊 **Real-time Traces** - Monitor task execution with detailed timing and performance metrics
📡 **Log Streaming** - Stream logs in real-time with filtering and search capabilities
⏰ **Scheduling** - Cron-based task scheduling with human-readable descriptions
🔔 **Webhooks** - Event-driven notifications for task completion and failures
👥 **Team Collaboration** - Multi-project organization with role-based access control

## Tech Stack

### Core Framework
- **[Next.js 16](https://nextjs.org/)** - React framework with App Router and Turbopack
- **[React 19](https://react.dev/)** - Latest React with concurrent features
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe development

### Database & Authentication
- **[Prisma 7](https://www.prisma.io/)** - Next-generation ORM with Neon adapter
- **[Neon](https://neon.tech/)** - Serverless PostgreSQL with connection pooling
- **[NextAuth v5](https://authjs.dev/)** - Modern authentication solution

### UI & Styling
- **[Tailwind CSS v4](https://tailwindcss.com/)** - Utility-first CSS with CSS-first configuration
- **[Headless UI](https://headlessui.com/)** - Accessible component primitives
- **[Recharts](https://recharts.org/)** - Composable charting library

### DevOps & Quality
- **[GitHub Actions](https://github.com/features/actions)** - CI/CD pipelines
- **[Vitest](https://vitest.dev/)** - Fast unit testing framework
- **[Playwright](https://playwright.dev/)** - Reliable end-to-end testing
- **[Vercel](https://vercel.com/)** - Zero-config deployments

## Quick Start

### Prerequisites

- Node.js 22+
- npm or yarn
- PostgreSQL database (we recommend [Neon](https://neon.tech/))

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/workermill-examples/taskpulse.git
   cd taskpulse
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and configure:
   ```bash
   # Database connections (both required for Prisma 7)
   DATABASE_URL="postgresql://user:pass@host:5432/taskpulse"
   DIRECT_DATABASE_URL="postgresql://user:pass@host:5432/taskpulse"

   # Authentication
   NEXTAUTH_SECRET="your-secret-key-here"
   NEXTAUTH_URL="http://localhost:3000"
   AUTH_TRUST_HOST="true"

   # Seeding
   SEED_TOKEN="your-seed-token"
   ```

4. **Initialize the database**
   ```bash
   npx prisma generate    # Generate the Prisma client
   npx prisma db push     # Create database schema
   npm run db:seed        # Seed with demo data
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

Visit [http://localhost:3000](http://localhost:3000) and sign in with:
- **Email**: `demo@workermill.com`
- **Password**: `demo1234`

## Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run typecheck    # Type checking with TypeScript
npm run test         # Run unit tests
npm run test:watch   # Run tests in watch mode
npm run test:e2e     # Run end-to-end tests
npm run format       # Format code with Prettier

# Database commands
npm run db:push      # Push schema changes to database
npm run db:migrate   # Deploy migrations (production)
npm run db:seed      # Seed demo data
npm run db:studio    # Open Prisma Studio
```

### Project Structure

```
taskpulse/
├── src/
│   ├── app/                  # Next.js App Router pages
│   │   ├── api/             # API routes
│   │   ├── [project]/       # Dynamic project routes
│   │   └── auth/           # Authentication pages
│   ├── components/         # React components
│   │   └── shared/        # Reusable components
│   ├── lib/               # Utilities and configurations
│   ├── hooks/             # Custom React hooks
│   └── types/             # TypeScript type definitions
├── prisma/                # Database schema and migrations
├── tests/                 # Test files
│   ├── unit/             # Unit tests
│   └── e2e/              # End-to-end tests
├── .github/workflows/    # CI/CD pipelines
└── public/              # Static assets
```

### Code Conventions

- **Dark Theme**: All UI uses dark styling (`bg-gray-950`, `text-gray-100`)
- **Async Params**: Next.js 16 requires `await params` in all route handlers
- **Prisma Import**: Use `import { PrismaClient } from "@/generated/prisma"`
- **Authentication**: Protected routes must call `auth()` and redirect if no session

## Architecture

### Database Schema

The application uses a normalized PostgreSQL schema with 10 models:

- **User Management**: `User`, `Project`, `ProjectMember`
- **Task System**: `Task`, `TaskRun`, `TaskLog`
- **Automation**: `Schedule`, `Webhook`
- **Security**: `ApiKey`, `InviteToken`

### Authentication Flow

1. **Credentials Provider**: Email/password authentication with bcrypt hashing
2. **Session Management**: JWT-based sessions with NextAuth v5
3. **Route Protection**: Server-side session validation in page components
4. **Role-Based Access**: Project-level permissions (OWNER, ADMIN, MEMBER, VIEWER)

### Real-time Features

- **Server-Sent Events**: Live log streaming and task updates
- **WebSocket Integration**: Real-time dashboard updates
- **Event Sourcing**: Comprehensive audit trails for all operations

## Deployment

### Production Deployment

The application is configured for deployment on Vercel with automatic:

1. **Build Process**: Next.js production build with static optimization
2. **Database Migrations**: Automated via GitHub Actions
3. **Health Checks**: Post-deployment validation
4. **Demo Data Seeding**: Automated demo user creation

### Environment Setup

Production requires:
- Neon PostgreSQL database with connection pooling
- GitHub repository secrets for database URLs and API keys
- Vercel project connected to the repository

## Contributing

### Quality Standards

All contributions must pass:
- `npm run typecheck` - Zero TypeScript errors
- `npm run lint` - Zero ESLint errors
- `npm run test` - All unit tests passing
- `npm run test:e2e` - End-to-end tests passing

### Development Workflow

1. Create feature branch from `main`
2. Implement changes with tests
3. Ensure all quality checks pass
4. Create pull request with detailed description
5. Automated CI/CD validates the changes

## License

This project is part of the WorkerMill showcase and is available under the MIT License.

---

**Built with ❤️ by [WorkerMill](https://workermill.com) - Autonomous AI Workers for Modern Development**