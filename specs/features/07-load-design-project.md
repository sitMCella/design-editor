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
- Pagination or infinite scroll (render all projects)
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

---

## Behaviour

| Action | Outcome |
|---|---|
| Page load | `GET /api/projects` is called; skeleton cards shown during fetch |
| Fetch succeeds, projects exist | Project grid rendered, ordered by most recently updated |
| Fetch succeeds, no projects | Empty state message shown; "Recent designs" section hidden |
| Fetch fails | Inline error message: `"Could not load your designs. Please try again."` with a "Retry" button that re-triggers the query |
| Click a project card | Card enters loading state; `GET /api/projects/:id` is called |
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
| `HomePage` | `src/pages/HomePage.tsx` | Extended: fetches project list; renders grid or empty state; handles card click → load flow |
| `ProjectCard` | `src/components/ProjectCard.tsx` | Renders card UI (placeholder, name, subtitle); accepts loading prop for spinner overlay |
| `ProjectCardSkeleton` | `src/components/ProjectCardSkeleton.tsx` | Grey placeholder card shown during list fetch |

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
2. When projects exist, the grid renders one card per project, ordered by most recently updated first.
3. Each card shows the project name, element count, and a relative "last updated" date.
4. When no projects exist, the "Recent designs" section is replaced by the empty-state message.
5. When `GET /api/projects` fails, an inline error message and "Retry" button are shown.
6. Clicking a project card calls `GET /api/projects/:id` and shows a spinner overlay on the card during the request.
7. On successful load, the canvas store is hydrated via `loadDesign` with the project's full element array — all text and image elements retain their exact saved configuration (position, size, content, formatting, src).
8. After `loadDesign`, the editor navigates to `/editor/:designId` with `isDirty = false`.
9. Opening the editor with a loaded design shows the same canvas as the last save — no blank canvas.
10. When `GET /api/projects/:id` fails, the spinner is removed, the card is interactive again, and an error notification is shown.
11. Creating a new design and returning to the home page shows the newly created project in the list.
12. Multiple projects load independently; navigating between them restores each one's distinct canvas state.
