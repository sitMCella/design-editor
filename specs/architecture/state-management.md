# State Management Architecture

## Overview

The application state is divided into four distinct domains, each with different lifetime, ownership, and persistence requirements. No single global store is used; instead each domain is managed by a dedicated store or mechanism suited to its characteristics.

| Domain | Tool | Persisted? | Lifetime |
|---|---|---|---|
| Canvas (design state) | Zustand + Immer | Yes — auto-saved to backend | Per open design |
| History (undo/redo) | Zustand (within canvas store) | No | Per open design |
| UI state | Zustand | No | Per session |
| Server state (assets, projects, user) | TanStack Query | Cached — backend is source of truth | Per session |

---

## 1. Canvas Store

The canvas store is the most critical piece of state. It holds the complete, authoritative in-memory representation of the design currently open in the editor.

### Shape of state

```ts
type CanvasStore = {
  // Design metadata
  designId: string
  name: string

  // Element tree — ordered array defines z-order (last = top)
  elements: CanvasElement[]

  // Selection
  selectedIds: string[]

  // Viewport
  zoom: number
  panX: number
  panY: number

  // Dirty flag — true when local state diverges from last saved snapshot
  isDirty: boolean
}
```

### Element model

Every item on the canvas is a `CanvasElement` discriminated union:

```ts
type CanvasElement =
  | ShapeElement
  | TextElement
  | ImageElement
  | GroupElement

type BaseElement = {
  id: string            // nanoid
  x: number
  y: number
  width: number
  height: number
  rotation: number      // degrees
  opacity: number       // 0–1
  locked: boolean
}

type ShapeElement = BaseElement & { type: 'shape'; shape: 'rect' | 'ellipse' | 'triangle'; fill: string; stroke: string; strokeWidth: number }
type TextElement  = BaseElement & { type: 'text'; content: string; fontSize: number; fontFamily: string; fontWeight: string; color: string; align: 'left' | 'center' | 'right' }
type ImageElement = BaseElement & { type: 'image'; src: string; objectFit: 'fill' | 'contain' | 'cover' }
type GroupElement = BaseElement & { type: 'group'; children: CanvasElement[] }
```

### Key actions

```ts
// Element mutations
addElement(element: CanvasElement): void
updateElement(id: string, patch: Partial<CanvasElement>): void
removeElements(ids: string[]): void
reorderElement(id: string, direction: 'forward' | 'backward' | 'front' | 'back'): void

// Selection
selectElements(ids: string[]): void
clearSelection(): void

// Viewport
setZoom(zoom: number): void
setPan(x: number, y: number): void

// Persistence
markSaved(): void   // clears isDirty after a successful auto-save
```

### Implementation notes

- Use **Immer** middleware so mutations can be written as direct assignments against draft state without manually spreading nested objects.
- The store is instantiated per open design, not as a singleton. When a design is closed, the store instance is destroyed.
- `isDirty` is set to `true` by any action that mutates `elements` or `name`. It is cleared by `markSaved()`.

---

## 2. History Store (Undo / Redo)

The history mechanism is co-located with the canvas store but kept as a parallel stack — it does not live inside `elements` itself.

### Shape of state

```ts
type HistoryStore = {
  past: CanvasElement[][]   // stack of previous element snapshots
  future: CanvasElement[][]  // stack of undone snapshots
}
```

### Rules

- Only `elements` is snapshotted — viewport and selection are not part of history.
- A snapshot is pushed to `past` before any action that mutates `elements`.
- Undo: pop from `past`, push current `elements` to `future`, replace `elements` with the popped snapshot.
- Redo: pop from `future`, push current `elements` to `past`, replace `elements` with the popped snapshot.
- Any non-undo/redo mutation clears `future`.
- The stack is capped at **50 entries** to bound memory usage.

### Keyboard bindings

| Action | Binding |
|---|---|
| Undo | `Cmd/Ctrl + Z` |
| Redo | `Cmd/Ctrl + Shift + Z` |

---

## 3. UI Store

Ephemeral state that controls the editor shell and panels. It is never persisted.

```ts
type UIStore = {
  activeTool: 'select' | 'text' | 'shape' | 'image' | 'pan'
  activePanel: 'layers' | 'assets' | 'templates' | null
  isExportModalOpen: boolean
}
```

---

## 4. Server State (TanStack Query)

Remote data — designs list, asset library, user profile — is managed by TanStack Query. It handles caching, background re-fetching, and loading/error states without a custom store.

### Query keys convention

```ts
['designs']                      // list of user's designs
['designs', designId]            // single design metadata (not canvas state)
['assets']                       // asset library
['assets', assetId]              // single asset
['user']                         // authenticated user profile
```

### Mutations and invalidation

After a successful mutation (e.g. rename design, delete design), the corresponding query key is invalidated to trigger a background re-fetch. Auto-save of canvas state uses a `useMutation` that does NOT invalidate the canvas query — the canvas store is the source of truth while the design is open.

---

## Auto-Save Strategy

1. A debounced effect watches `isDirty` in the canvas store.
2. When `isDirty` is `true`, after a **2-second debounce**, the current `elements` and `name` are serialised to JSON and sent to `PATCH /designs/:id`.
3. On success, `markSaved()` is called to clear `isDirty`.
4. On failure, `isDirty` remains `true` and the save is retried on the next mutation or on a 10-second fallback timer.
5. An unsaved indicator is shown in the editor header when `isDirty` is `true`.

---

## Data Flow Diagram

```
User interaction
      │
      ▼
Canvas Store action (Immer mutation)
      │
      ├──▶ History stack updated (snapshot pushed)
      │
      ├──▶ isDirty = true
      │
      └──▶ React re-renders affected components
                │
                └──▶ Debounced auto-save watcher fires
                            │
                            ▼
                     PATCH /designs/:id
                            │
                     ┌──────┴──────┐
                   200 OK        Error
                     │              │
               markSaved()     isDirty stays true
                                    │
                              retry on next
                              mutation or timer
```

---

## Dependencies to Install

```bash
pnpm add zustand immer @tanstack/react-query
```
