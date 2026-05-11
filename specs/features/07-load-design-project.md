# Feature Spec: List & Load Design Projects

## Summary

Extend the home page to display a grid of previously saved design projects fetched from the backend. Clicking a project card navigates directly to the editor with the full canvas state — all text and image elements with their exact configuration — restored from the database.

## Scope

**In scope**
- `GET /api/projects` — list all projects (id, name, element count, timestamps; no canvas payload)
- Home page project grid below the "New design" CTA
- Loading and error states for the project list
- Empty state when no projects exist yet
- Clicking a project card: fetch full project via `GET /api/projects/:id`, hydrate the canvas store, navigate to `/editor/:designId`
- Loading indicator on the card while the project is being fetched
- Error notification when a project fails to load
- Canvas store action `loadDesign` that restores id, name, and full element array

**Out of scope**
- Deleting or renaming projects from the home page
- Pagination or infinite scroll inside the "All designs" modal
- Project search or filtering
- Canvas thumbnail preview image (cards show name, date, element count only)
- Duplicate design
- User authentication or per-user project scoping
- Sorting controls (backend returns projects ordered by `updated_at DESC`)

---

## UI Layout

### Home page (with existing projects)

```
┌─────────────────────────────────────────────────────────────────┐
│  App Header  (logo / product name)                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│        ┌──────────────────────┐                                 │
│        │   + New design       │  ← primary CTA (unchanged)     │
│        └──────────────────────┘                                 │
│                                                                 │
│  ─────────────  Recent designs  ─────────────                   │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │          │  │          │  │          │  ← project cards      │
│  │  [name]  │  │  [name]  │  │  [name]  │                      │
│  │  [date]  │  │  [date]  │  │  [date]  │                      │
│  └──────────┘  └──────────┘  └──────────┘                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- The "New design" CTA retains its existing position and styling.
- The "Recent designs" section appears below the CTA, separated by a subtle divider line and section label.
- The section is hidden when the project list is empty (no empty label is shown in this state — empty state is handled separately, see below).
- Cards are arranged in a responsive grid: 3 columns on wide viewports, 2 on medium, 1 on narrow.
- **At most 6 cards** are rendered in this grid (the 6 most recently updated projects). If the backend returns more than 6 projects, only the first 6 are shown; the rest are accessible through the "View all" modal (see below).
- When the total project count exceeds 6, a **"View all designs (N)"** text link appears below the grid, where N is the total project count. Clicking it opens the "All designs" modal.

### Project card

```
┌──────────────────────────────────┐
│                                  │
│   [grey placeholder area]        │  ← 160 × 90 px (16:9 ratio)
│                                  │
├──────────────────────────────────┤
│  My Design Name                  │  ← name, truncated with ellipsis
│  3 elements · 2 days ago         │  ← element count + relative updated_at
└──────────────────────────────────┘
```

- The placeholder area is a grey rectangle (`bg-gray-100`); it holds no canvas rendering in this iteration.
- Hovering the card shows a subtle shadow elevation (`shadow-md`) and a slight background shift to indicate interactivity.
- While a card's project is loading (after click), the card shows a spinner overlay and is non-interactive.

### Empty state (no projects yet)

Displayed in place of the "Recent designs" section when the list is empty after a successful fetch:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│        No designs yet. Click "+ New design" to get started.    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Loading state

While the project list is being fetched, three skeleton cards (grey placeholders matching the card dimensions) are rendered in place of the grid. Once the fetch resolves, the skeletons are replaced with real cards or the empty state.

### All designs modal

Rendered when the user clicks "View all designs (N)". It overlays the home page and displays the full project list using the same `ProjectCard` component and the same responsive grid.

```
┌─────────────────────────────────────────────────────────────────┐
│  All designs                                              [✕]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │  [name]  │  │  [name]  │  │  [name]  │                      │
│  │  [date]  │  │  [date]  │  │  [date]  │                      │
│  └──────────┘  └──────────┘  └──────────┘                      │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │  ...     │  │  ...     │  │  ...     │                      │
│  └──────────┘  └──────────┘  └──────────┘                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- The modal reuses the already-fetched project list from TanStack Query — no additional network request is made.
- Clicking a card inside the modal triggers the same load flow as on the home page (spinner overlay, `GET /api/projects/:id`, `loadDesign`, navigate).
- The modal is closed by clicking the ✕ button or clicking outside the modal panel.
- Pressing `Escape` also closes the modal.

---

## Behaviour

| Action | Outcome |
|---|---|
| Page load | `GET /api/projects` is called; skeleton cards shown during fetch |
| Fetch succeeds, ≤ 6 projects | Project grid renders all projects, ordered by most recently updated; "View all" link is hidden |
| Fetch succeeds, > 6 projects | Project grid renders the 6 most recently updated projects; "View all designs (N)" link is shown |
| Fetch succeeds, no projects | Empty state message shown; "Recent designs" section hidden |
| Fetch fails | Inline error message: `"Could not load your designs. Please try again."` with a "Retry" button that re-triggers the query |
| Click "View all designs (N)" | "All designs" modal opens, showing all projects |
| Click ✕ / outside / Escape in modal | "All designs" modal closes |
| Click a project card (home or modal) | Card enters loading state; `GET /api/projects/:id` is called |
| Project load succeeds | Canvas store hydrated via `loadDesign`; navigate to `/editor/:designId` |
| Project load fails | Error notification shown; card returns to normal state |
| Click "New design" | Existing modal flow (unchanged) |

---

## API

### `GET /api/projects`

Return all projects ordered by `updated_at DESC`. The canvas payload is **not** included in this response — only the fields needed to render a card.

**Response `200`**
```json
{
  "ok": true,
  "data": [
    {
      "id": "abc123",
      "name": "My Design",
      "elementCount": 3,
      "createdAt": "2026-05-10T10:00:00Z",
      "updatedAt": "2026-05-10T10:07:30Z"
    }
  ]
}
```

The `elementCount` field is derived server-side using PostgreSQL's `jsonb_array_length(canvas->'elements')`.

**Error responses**
| Status | Code | Condition |
|---|---|---|
| `500` | `INTERNAL_ERROR` | Unexpected database error |

No authentication is required. The endpoint returns all projects in the database (no user scope).

---

## Canvas store — `loadDesign` action

Add a new action alongside `initDesign`:

```ts
loadDesign(id: string, name: string, elements: CanvasElement[]): void
```

It resets the canvas store to the same initial viewport and selection state as `initDesign`, but populates `elements` from the provided array instead of starting empty:

```ts
loadDesign: (id, name, elements) =>
  set((state) => {
    state.designId = id
    state.name = name
    state.elements = elements
    state.selectedIds = []
    state.zoom = 1
    state.panX = 0
    state.panY = 0
    state.isDirty = false
  }),
```

`isDirty` is `false` after loading — the in-memory state matches the persisted snapshot.

---

## Frontend API

Add `getProjects` and `getProject` to `src/api/projects.ts`:

```ts
export type ProjectSummary = {
  id: string
  name: string
  elementCount: number
  createdAt: string
  updatedAt: string
}

export function getProjects(): Promise<ProjectSummary[]> {
  return apiFetch<ProjectSummary[]>('/api/projects')
}

export function getProject(id: string): Promise<Project> {
  return apiFetch<Project>(`/api/projects/${id}`)
}
```

`Project` (with `canvas`) is already defined in `projects.ts` and returned by the existing `GET /api/projects/:id` endpoint.

---

## State

| State | Location |
|---|---|
| Project list (fetching, data, error) | TanStack Query — `useQuery(['designs'])` |
| Loading card id (which card is opening) | Local `useState<string \| null>` in `HomePage` |
| Project load error | Local `useState<string \| null>` in `HomePage` |
| "All designs" modal open/closed | Local `useState<boolean>` in `HomePage` |
| Canvas hydration | `loadDesign` action on canvas store |

The TanStack Query key `['designs']` is invalidated after a successful `POST /api/projects` (new design creation), so the list refreshes automatically when the user returns to the home page after creating a design.

---

## Relative date formatting

The card subtitle uses a human-readable relative date for `updatedAt`:

| Time since update | Display |
|---|---|
| < 1 minute | `"Just now"` |
| 1–59 minutes | `"X minutes ago"` |
| 1–23 hours | `"X hours ago"` |
| 1–6 days | `"X days ago"` |
| 7+ days | Full date: `"12 May 2026"` |

Implement with a small utility function (`src/utils/relativeDate.ts`) — do not add a date library.

---

## Components

| Component | Location | Responsibility |
|---|---|---|
| `HomePage` | `src/pages/HomePage.tsx` | Extended: fetches project list; slices to 6 for the grid; renders "View all" link; manages modal open state; handles card click → load flow |
| `ProjectCard` | `src/components/ProjectCard.tsx` | Renders card UI (placeholder, name, subtitle); accepts loading prop for spinner overlay |
| `ProjectCardSkeleton` | `src/components/ProjectCardSkeleton.tsx` | Grey placeholder card shown during list fetch |
| `AllDesignsModal` | `src/components/AllDesignsModal.tsx` | Modal overlay that renders the full project list using `ProjectCard`; handles close on ✕, outside click, and Escape |

---

## File structure additions

```
backend/
  src/
    routes/
      projects.ts     (extended — add GET /api/projects list endpoint)

frontend/
  src/
    api/
      projects.ts     (extended — add getProjects, getProject)
    components/
      ProjectCard.tsx            (new)
      ProjectCardSkeleton.tsx    (new)
      AllDesignsModal.tsx        (new)
    pages/
      HomePage.tsx    (extended — project grid, load flow)
    stores/
      canvasStore.ts  (extended — add loadDesign action)
    utils/
      relativeDate.ts            (new)
```

---

## Acceptance Criteria

1. On home page load, `GET /api/projects` is called and three skeleton cards are shown while the request is in flight.
2. When 1–6 projects exist, the grid renders all of them ordered by most recently updated; the "View all" link is not shown.
3. When more than 6 projects exist, the grid renders exactly the 6 most recently updated; a "View all designs (N)" link is shown below the grid, where N is the total count.
4. Each card shows the project name, element count, and a relative "last updated" date.
5. When no projects exist, the "Recent designs" section is replaced by the empty-state message.
6. When `GET /api/projects` fails, an inline error message and "Retry" button are shown.
7. Clicking "View all designs (N)" opens the "All designs" modal, which shows every project using the same card layout.
8. The modal closes when the user clicks ✕, clicks outside the modal panel, or presses Escape.
9. Clicking a project card (on the home page grid or inside the modal) calls `GET /api/projects/:id` and shows a spinner overlay on the card during the request.
10. On successful load, the canvas store is hydrated via `loadDesign` with the project's full element array — all text and image elements retain their exact saved configuration (position, size, content, formatting, src).
11. After `loadDesign`, the editor navigates to `/editor/:designId` with `isDirty = false`.
12. Opening the editor with a loaded design shows the same canvas as the last save — no blank canvas.
13. When `GET /api/projects/:id` fails, the spinner is removed, the card is interactive again, and an error notification is shown.
14. Creating a new design and returning to the home page shows the newly created project in the list (and updates the "View all" count if applicable).
15. Multiple projects load independently; navigating between them restores each one's distinct canvas state.
16. Every project stored in the database is openable from the home page regardless of how many projects exist. Projects within the 6-card cap open directly from the grid. Projects beyond the cap open via the "All designs" modal. In both cases clicking the card fully loads the project: the canvas store is hydrated with the project's complete element array and the editor navigates to `/editor/:designId` with `isDirty = false`.
