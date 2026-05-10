# Project Context

## Vision

A web-based graphic design platform that makes visual creation accessible to everyone — regardless of design skill level. The goal is to lower the barrier to producing professional-quality visuals by providing an intuitive, browser-based editor with templates, assets, and a drag-and-drop canvas.

## Target Users

- Non-designers who need to create marketing materials, social posts, presentations, or documents without hiring a designer.
- Small business owners and content creators who need fast, polished outputs.
- Teams who want to collaborate on branded visual content.

## Core Features (Planned)

- **Canvas editor** — drag-and-drop surface for composing designs from shapes, text, images, and icons.
- **Templates** — pre-built starting points organised by use case (social media, presentations, posters, etc.).
- **Asset library** — user-uploaded media plus curated stock assets.
- **Export** — download designs as PNG, JPG, or PDF.
- **Projects** — save, organise, and return to designs.
- **Authentication** — user accounts with personal design libraries.

---

## Architecture Decisions

### Monorepo layout

The project is split into `frontend/` and `backend/` directories within a single repository. This keeps the codebase cohesive while allowing independent deployment and independent Node.js version constraints.

### Frontend: React 19 + Vite 6

React 19 was chosen for its concurrent rendering capabilities and the improved asset handling in Vite 6. The SPA approach (as opposed to a meta-framework like Next.js) is deliberate — the editor is a highly interactive, client-heavy application that does not benefit meaningfully from server-side rendering.

### Backend: Node.js 24

Node.js 24 is used for the API server to take advantage of the latest V8 improvements and native ESM support. The backend handles auth, project persistence, asset storage, and export jobs.

### Styling: Tailwind CSS v4

Tailwind v4's CSS-first configuration (via `@import "tailwindcss"` and `@theme` blocks) was chosen over v3 to avoid the JavaScript config file overhead and to align with the direction of the ecosystem. No `tailwind.config.js` is needed; all customisation lives in CSS.

### Routing: React Router v7

React Router v7 (unified `react-router` package) provides client-side routing. The route tree is defined in `frontend/src/router.tsx` using `createBrowserRouter`. Routes are lazy-loadable as the application grows.

### Testing strategy

| Layer | Tool | Scope |
|---|---|---|
| Unit / component | Vitest 3 + React Testing Library | Logic, component rendering, user interactions |
| End-to-end | Playwright | Critical user journeys across Chromium, Firefox, WebKit |

Vitest and the Vite dev server are intentionally separated into `vitest.config.ts` and `vite.config.ts` to avoid type conflicts between Vite 6 (runtime) and the Vite 5 peer bundled inside Vitest 2.x. Vitest 3+ resolves this by targeting Vite 6 natively.

### Package manager: pnpm

pnpm is used for its strict dependency isolation and fast installs via a content-addressable store. The `pnpm.onlyBuiltDependencies` field in `package.json` pre-authorises esbuild's install script so `pnpm install` runs non-interactively in CI.

---

## Key Constraints

- The canvas editor must feel instantaneous — all state mutations are local-first, with async persistence to the backend.
- Designs are stored as JSON documents (a serialised representation of the canvas element tree). This makes them versionable and portable.
- The backend must support concurrent users editing different designs; real-time collaboration between users is out of scope for the initial version.
- Export fidelity matters: server-side rendering may be needed for high-resolution PDF/PNG exports that exceed browser canvas limits.
