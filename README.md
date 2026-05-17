# Design Studio

A browser-based graphic design editor that makes visual creation accessible to everyone — regardless of design skill level. Compose designs from text and image elements on a drag-and-drop canvas, customise styling, and export your work.

Read the [User Guide](https://github.com/sitMCella/design-editor/wiki) 

## Project structure

```
├── frontend/    React 19 SPA — the canvas editor
├── backend/     Node.js 24 API server
└── specs/       Feature and architecture specifications
```

## Tech stack

### Frontend

| Concern | Tool |
|---|---|
| Framework | React 19 |
| Build | Vite 6 |
| Styling | Tailwind CSS v4 |
| Routing | React Router v7 |
| State | Zustand + Immer |
| Server state | TanStack Query |
| Language | TypeScript 5 (strict) |
| Package manager | pnpm |
| Unit tests | Vitest 3 + React Testing Library |
| E2E tests | Playwright |
| Lint / format | ESLint 9 + Prettier |

### Backend

| Concern | Tool |
|---|---|
| Runtime | Node.js 24 |
| Framework | Fastify 5 |
| Database | PostgreSQL 17 (via postgres.js) |
| Language | TypeScript 5 (strict) |
| Package manager | pnpm |
| Unit tests | Vitest 3 |
| Lint / format | ESLint 9 + Prettier |

## Getting started

**Prerequisites:** Node.js 23+, pnpm

### Frontend

```bash
cd frontend
pnpm install
pnpm exec playwright install   # download browser binaries for e2e tests
```

### Backend

```bash
cd backend
pnpm install
cp .env.example .env           # configure local environment variables
```

The backend connects to PostgreSQL. For local development, use Docker Compose (see below) or point `DATABASE_URL` in `.env` at an existing Postgres instance.

Migrations run automatically at server startup — no manual step needed.

## Development

### Frontend

```bash
cd frontend
pnpm dev        # http://localhost:5173
```

### Backend

```bash
cd backend
pnpm dev        # http://localhost:3001 (tsx watch, hot-reload)
```

## Building

### Frontend

```bash
cd frontend
pnpm build      # type-check + Vite production build → frontend/dist/
pnpm preview    # serve the production build locally
```

### Backend

```bash
cd backend
pnpm build      # tsc → backend/dist/
pnpm start      # run the compiled output
```

## Testing

### Frontend

```bash
cd frontend

pnpm test           # unit tests (watch mode)
pnpm test:run       # unit tests — single run
pnpm coverage       # unit tests with v8 coverage report

pnpm test:e2e       # Playwright e2e (starts dev server automatically)
pnpm test:e2e:ui    # Playwright UI explorer
```

### Backend

```bash
cd backend

pnpm test           # unit tests (watch mode)
pnpm test:run       # unit tests — single run
pnpm coverage       # unit tests with v8 coverage report
```

## Code quality

Both applications share the same workflow:

```bash
pnpm lint           # ESLint
pnpm format         # Prettier (write)
pnpm format:check   # Prettier (check only, for CI)
pnpm type-check     # tsc --noEmit (backend only; frontend uses tsc -b via pnpm build)
```

## Environment variables (backend)

Copy `backend/.env.example` and adjust as needed:

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Controls logging verbosity and error detail |
| `PORT` | `3000` | Port the server listens on |
| `HOST` | `0.0.0.0` | Bind address |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin for the frontend |
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/design_editor` | PostgreSQL connection string |
| `ASSET_DIR` | `./assets` | Directory where uploaded image files are stored |

## Docker

**Prerequisites:** Docker with Compose

```bash
# Build all images and start the full stack
# Frontend → http://localhost:3000
# Backend  → http://localhost:3001
docker compose up --build

# Run in the background
docker compose up --build -d

# Stop and remove containers (data volumes are preserved)
docker compose down

# Stop and remove containers and all volumes (full reset)
docker compose down -v
```

### Services

| Service | Exposed port | Description |
|---|---|---|
| `frontend` | `3000` | React SPA served by nginx |
| `backend` | `3001` | Fastify API server |
| `db` | `5432` | PostgreSQL 17 |

Image assets uploaded via the editor are stored in the `asset_data` named volume, mounted at `/app/assets` inside the backend container. Database data persists in the `db_data` volume.
