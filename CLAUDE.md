# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@context.md
@specs/architecture/state-management.md
@specs/features/01-toolbar-text-element.md
@specs/features/02-text-element-customization.md
@specs/features/03-toolbar-image-element.md
@specs/features/04-image-element-customization.md
@specs/features/05-new-design.md
@specs/features/06-store-design-project.md
@specs/features/07-load-design-project.md
@specs/features/08-toolbar-arrow-element.md
@specs/features/09-arrow-element-customization.md
@specs/features/10-toolbar-table-element.md
@specs/features/11-table-element-customization.md
@specs/features/12-card-placeholder-canvas-rendering.md
@specs/features/13-canvas-infinite.md
@specs/features/14-mouse-gestures.md
@specs/features/15-contextual-toolbar-pin.md
@specs/features/16-delete-canvas-element.md
@specs/features/17-layer-view.md
@specs/features/18-download-png.md

## Project Overview

A web-based graphic design platform aimed at making visual creation accessible to everyone. The project is split into two applications:

- `frontend/` — React 19 SPA (canvas-based design editor), built with Vite + TypeScript
- `backend/` — Node.js 24 API server (not yet scaffolded)

## Frontend (`frontend/`)

### Tech stack

| Concern | Tool |
|---|---|
| Framework | React 19 |
| Build | Vite 6 + `@tailwindcss/vite` |
| Styling | Tailwind CSS v4 |
| Routing | React Router v7 |
| Language | TypeScript 5 (strict) |
| Package manager | pnpm |
| Unit tests | Vitest 3 + React Testing Library |
| E2E tests | Playwright |
| Lint / format | ESLint 9 (flat config) + Prettier |

### Commands

```bash
pnpm dev              # Start dev server (http://localhost:5173)
pnpm build            # Type-check with tsc -b, then Vite production build
pnpm preview          # Serve the production build locally

pnpm lint             # ESLint
pnpm format           # Prettier (write)
pnpm format:check     # Prettier (check only)

pnpm test             # Vitest in watch mode
pnpm test:run         # Vitest single run (CI)
pnpm coverage         # Vitest with v8 coverage report

# Run a single test file
pnpm test:run src/pages/HomePage.test.tsx

pnpm test:e2e         # Playwright (starts dev server automatically)
pnpm test:e2e:ui      # Playwright UI mode
```

> First-time setup: after `pnpm install`, run `pnpm exec playwright install` to download browser binaries.

### Architecture

**Routing** — `src/router.tsx` defines a `createBrowserRouter` tree. The root `App` layout renders at `/`; page components live under `src/pages/`.

Current routes:
- `/` → `HomePage`
- `/editor/:designId` → `EditorPage`

**EditorPage layout** — Three-panel shell: left sidebar (layers/assets), centre canvas surface, right properties panel. The canvas `<div>` is the placeholder for the drawing engine.

**Styling** — Tailwind CSS v4 is loaded via a single CSS entry point (`src/index.css`) using `@import "tailwindcss"`. No `tailwind.config.js` is needed; customisation goes in CSS using `@theme`.

**TypeScript project structure** — Three tsconfig files are composed via project references:

| Config | Covers | Purpose |
|---|---|---|
| `tsconfig.app.json` | `src/` | App code; types: `vite/client`, `vitest/globals` |
| `tsconfig.node.json` | `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts` | Node/tooling scripts; includes DOM lib for Playwright types |
| `tsconfig.json` | root | Umbrella that references the two above; used by `tsc -b` |

Vitest config is intentionally split from Vite config (`vitest.config.ts` vs `vite.config.ts`) to avoid version conflicts between Vite 6 (runtime) and Vite 5 (Vitest's internal peer).

**Tests** — Unit tests (`*.test.tsx`) live next to source files in `src/`. E2E specs live in `e2e/`. Vitest only collects `src/**/*.{test,spec}.{ts,tsx}` so Playwright files are not accidentally picked up.
