# Feature Spec: Edit Design Name

## Summary

Add a kebab menu (`⋮`) to the info bar of every project card on the home page. The menu is always visible and contains a single "Rename" action. Selecting it opens a modal pre-filled with the current design name; confirming saves the new name via `PATCH /api/projects/:id` and refreshes the project list. The kebab menu appears on both the home page grid and inside the "All designs" modal.

## Scope

**In scope**
- `⋮` (vertical ellipsis) button always visible at the right end of the project card info bar
- Clicking `⋮` opens a compact dropdown with one item: `"Rename"`
- Clicking outside the dropdown or pressing `Escape` closes it without action
- The rename modal is pre-filled with the current project name; the text is fully selected on open
- "Save" is disabled when the trimmed input value is empty or unchanged from the current name
- On confirm: call `PATCH /api/projects/:id` with `{ name }`, close the modal, invalidate the `['designs']` TanStack Query key
- On error: show an inline error inside the modal; keep the modal open
- The kebab menu and rename flow work identically inside the `AllDesignsModal`
- The project card is refactored from `<button>` to `<div>` to allow nested interactive elements

**Out of scope (future iterations)**
- Delete from the kebab menu (separate spec)
- Duplicate design from the kebab menu
- Rename from within the editor (editor header has its own name field in a later spec)
- Optimistic update of the card name before the server responds
- Undo rename

---

## UI Layout

### Project card (updated)

```
┌──────────────────────────────────┐
│  [thumbnail area]                │
├──────────────────────────────────┤
│  Project Name              ║    │  ← ⋮ spans full info-bar height
│  3 elements · 2 days ago   ║⋮║  │
└──────────────────────────────────┘
```

- The info bar (`px-3 py-2`) uses `flex items-stretch justify-between` layout.
- Left side: existing name + subtitle stack (unchanged).
- Right side: the `⋮` button — `20px` wide, full height of the info bar (spanning both the name and subtitle rows), `text-gray-400`, rounded; hover: `bg-gray-100 text-gray-600`. The icon is vertically centred within this tall hit area.
- The `⋮` button does **not** open the project; it stops event propagation so clicking it never triggers the card's open action.

### Kebab dropdown

The dropdown opens immediately below the `⋮` button, right-aligned to it:

```
┌────────────┐
│  ✏ Rename  │
└────────────┘
```

- Width: `128px`.
- Background `bg-white`, `rounded-lg shadow-lg border border-gray-200`, `py-1`.
- One menu item: a row `px-3 py-2`, `text-sm text-gray-700`, hover `bg-gray-50`.
- Prefix icon: a pencil SVG (`14 × 14 px`, `text-gray-500`).
- The dropdown is rendered in a portal (`document.body`) to avoid clipping by `overflow: hidden` ancestors (card border, modal scroll container).
- `z-index: 50` (same level as modals, but rendered after them in DOM order to appear on top within the stacking context).

### Rename modal

Matches the visual style of `NewDesignModal`:

```
┌────────────────────────────────────┐
│  Rename design                     │
│                                    │
│  Design name                       │
│  ┌──────────────────────────────┐  │
│  │  My Current Name             │  │
│  └──────────────────────────────┘  │
│                                    │
│  [error message if present]        │
│                                    │
│          [Cancel]  [Save]          │
└────────────────────────────────────┘
```

- `"Rename design"` heading.
- Input pre-filled with the current name; all text selected on mount (`inputRef.current?.select()`).
- `"Save"` button: primary blue; disabled (`opacity-50`, non-interactive) when the trimmed value is empty or equals the current name (trimmed).
- `"Cancel"` button: secondary ghost/outline.
- Pressing `Enter` while the input is focused and `"Save"` is enabled submits the form.
- Pressing `Escape` closes the modal (same handler as `"Cancel"`).
- Clicking the backdrop closes the modal.
- Inline error (`text-sm text-red-500`) rendered below the input when the API call fails.

---

## Behaviour

| Action | Outcome |
|---|---|
| Click `⋮` on a card | Dropdown opens; any previously open dropdown closes first |
| Click outside any open dropdown | Dropdown closes |
| Press `Escape` while dropdown is open | Dropdown closes |
| Click `"Rename"` in dropdown | Dropdown closes; rename modal opens pre-filled with the project's current name |
| Type a new name | `"Save"` becomes enabled (if non-empty and different from current) |
| Clear the input | `"Save"` becomes disabled |
| Restore the original name in the input | `"Save"` becomes disabled |
| Click `"Save"` (valid, changed name) | Calls `PATCH /api/projects/:id { name }`; modal shows a loading state; on success: modal closes, `['designs']` query invalidated |
| Press `Enter` (valid, changed name) | Same as clicking `"Save"` |
| Click `"Cancel"` | Modal closes; no API call |
| Press `Escape` in modal | Same as `"Cancel"` |
| Click backdrop | Same as `"Cancel"` |
| API error on save | Modal stays open; error message appears below input; `"Save"` re-enabled |
| Multiple cards: click `⋮` on card B while card A's dropdown is open | Card A's dropdown closes; card B's opens |

---

## Card restructure

The current `ProjectCard` renders as a single `<button>`. A `<button>` cannot contain other interactive elements (buttons, inputs) — the kebab `<button>` inside it would be invalid HTML and break click handling.

The card is restructured to:

```tsx
<div className="group relative w-full rounded-lg border border-gray-200 bg-white text-left shadow-sm transition-shadow hover:shadow-md">
  {/* Thumbnail — click to open */}
  <div
    role="button"
    tabIndex={0}
    onClick={onClick}
    onKeyDown={(e) => { if (e.key === 'Enter') onClick() }}
    className="cursor-pointer …"
  >
    {/* thumbnail content */}
  </div>

  {/* Info bar */}
  <div className="flex items-stretch justify-between px-3 py-2">
    {/* Left: name + subtitle */}
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick() }}
      className="min-w-0 flex-1 cursor-pointer"
    >
      <p className="truncate text-sm font-medium text-gray-900">{project.name}</p>
      <p className="mt-0.5 text-xs text-gray-500">…</p>
    </div>

    {/* Right: kebab */}
    <KebabMenu
      onRename={onRename}
    />
  </div>

  {isLoading && <LoadingOverlay />}
</div>
```

The thumbnail area and the name/subtitle area both act as separate clickable zones that call `onClick`. The `KebabMenu` button stops propagation independently.

---

## API

No new endpoints are required. The rename action reuses the existing endpoint:

### `PATCH /api/projects/:id`

**Request body**
```json
{ "name": "New Design Name" }
```

**Response `200`**
```json
{
  "ok": true,
  "data": {
    "id": "abc123",
    "name": "New Design Name",
    "updatedAt": "2026-05-20T12:00:00Z"
  }
}
```

**Errors already handled by the existing endpoint**

| Status | Code | Condition |
|---|---|---|
| `400` | `INVALID_BODY` | Missing or invalid `name` |
| `404` | `NOT_FOUND` | No project with that id |

---

## State

| State | Type | Location |
|---|---|---|
| `openMenuId` | `string \| null` | `useState` in `HomePage` (and `AllDesignsModal`) — which card's dropdown is open |
| `renameTarget` | `{ id: string; currentName: string } \| null` | `useState` in `HomePage` (and `AllDesignsModal`) — which project is being renamed |
| `inputValue` | `string` | `useState` in `RenameModal` |
| `renameError` | `string \| null` | `useState` in `RenameModal` |
| `isSaving` | `boolean` | derived from TanStack `useMutation` `isPending` |

The `['designs']` query invalidation on success triggers a background refetch; the updated name appears in the list without any manual state patching.

---

## Components

| Component | Location | Responsibility |
|---|---|---|
| `ProjectCard` | `src/components/ProjectCard.tsx` | Restructured from `<button>` to `<div>`; receives `onRename` and `onMenuOpenChange` props alongside existing `onClick` and `isLoading` |
| `KebabMenu` | `src/components/KebabMenu.tsx` | New — `⋮` button + portal dropdown; accepts `isOpen`, `onOpen`, `onClose`, `onRename` |
| `RenameModal` | `src/components/RenameModal.tsx` | New — rename modal; accepts `currentName`, `onConfirm(name)`, `onClose`, `isLoading`, `error` |
| `HomePage` | `src/pages/HomePage.tsx` | Owns `openMenuId` and `renameTarget`; wires `useMutation` for rename; passes callbacks to `ProjectCard` |
| `AllDesignsModal` | `src/components/AllDesignsModal.tsx` | Mirrors `HomePage` rename wiring: owns `openMenuId` and `renameTarget`; wires `useMutation` for rename |

---

## `ProjectCard` prop changes

```ts
type Props = {
  project: ProjectSummary
  isLoading: boolean
  onClick: () => void
  onRename: () => void                        // NEW — called when user selects Rename
  isMenuOpen: boolean                         // NEW — controls KebabMenu open state
  onMenuOpenChange: (open: boolean) => void   // NEW — called by KebabMenu to open/close
}
```

---

## File structure additions

```
frontend/
  src/
    components/
      KebabMenu.tsx          (new)
      RenameModal.tsx        (new)
      ProjectCard.tsx        (updated — restructured, new props)
      AllDesignsModal.tsx    (updated — rename wiring)
    pages/
      HomePage.tsx           (updated — openMenuId, renameTarget, rename mutation)
```

---

## Acceptance Criteria

1. Every project card on the home page grid displays a `⋮` button at the right end of the info bar; it is always visible without requiring hover.
2. Every project card inside the "All designs" modal also displays the `⋮` button with the same behaviour.
3. Clicking `⋮` opens a dropdown with a single `"Rename"` item; clicking `⋮` again closes it.
4. Only one dropdown is open at a time — opening a new one closes any previously open one.
5. Clicking outside an open dropdown closes it.
6. Pressing `Escape` while a dropdown is open closes it.
7. Clicking the `⋮` button does not open the project — the card's open action is not triggered.
8. Clicking anywhere else on the card (thumbnail, name, subtitle) still opens the project as before.
9. Selecting `"Rename"` closes the dropdown and opens the rename modal pre-filled with the project's current name.
10. The name input text is fully selected when the rename modal opens.
11. The `"Save"` button is disabled when the input is empty or contains only whitespace.
12. The `"Save"` button is disabled when the trimmed input value is identical to the current name.
13. The `"Save"` button is enabled when the trimmed input value is non-empty and different from the current name.
14. Pressing `Enter` while the input is focused and `"Save"` is enabled submits the rename.
15. Clicking `"Cancel"`, pressing `Escape`, or clicking the backdrop closes the modal without making any API call.
16. On successful save, the modal closes and the project card in the list updates to show the new name (via query invalidation).
17. On API error, the modal stays open, the error message is shown below the input, and `"Save"` is re-enabled so the user can retry.
18. The rename flow works for projects displayed both in the home page grid and inside the "All designs" modal.
19. Renaming a project does not affect any other project card or the canvas state.
20. A full page reload after renaming shows the updated name — the change is persisted to the backend.
