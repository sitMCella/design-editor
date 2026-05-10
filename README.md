# Design Studio

A browser-based graphic design editor that makes visual creation accessible to everyone — regardless of design skill level. Compose designs from text and image elements on a drag-and-drop canvas, customise styling, and export your work.

## Project structure

```
├── frontend/   React 19 SPA — the canvas editor
└── backend/    Node.js 24 API server (not yet scaffolded)
```

All work lives in `frontend/` for now. The backend will handle authentication, project persistence, and export jobs in a future iteration.

## Tech stack

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

## Getting started

**Prerequisites:** Node.js 20+, pnpm

```bash
cd frontend
pnpm install
pnpm exec playwright install   # download browser binaries for e2e tests
```

## Development

```bash
# Start the dev server at http://localhost:5173
pnpm dev
```

## Building

```bash
# Type-check and produce a production build in frontend/dist/
pnpm build

# Preview the production build locally
pnpm preview
```

## Testing

```bash
# Unit tests (watch mode)
pnpm test

# Unit tests — single run
pnpm test:run

# Unit tests with coverage report
pnpm coverage

# E2E tests (starts the dev server automatically)
pnpm test:e2e

# E2E tests with the Playwright UI explorer
pnpm test:e2e:ui
```

## Docker

**Prerequisites:** Docker with Compose

```bash
# Build the image and start the container (app served at http://localhost:3000)
docker compose up --build

# Run in the background
docker compose up --build -d

# Stop and remove containers
docker compose down
```

The frontend is built with a two-stage Dockerfile (`node:22-alpine` for the build, `nginx:1.27-alpine` to serve the static assets). Nginx is configured with a fallback to `index.html` so React Router's client-side routes work correctly.

## Code quality

```bash
pnpm lint           # ESLint
pnpm format         # Prettier (write)
pnpm format:check   # Prettier (check only, for CI)
```
