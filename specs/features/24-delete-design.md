# Feature Spec: Delete Design Project

## Summary

Add a "Delete" item to the kebab menu (`⋮`) on every project card on the home page. Selecting it opens a confirmation dialog before permanently deleting the project. On confirmation, the project is removed via `DELETE /api/projects/:id`, the project list is refreshed, and the card disappears from the grid. The delete action is irreversible — no undo or soft-delete is provided.

## Scope

**In scope**
- A `"Delete"` item in the kebab dropdown, below the existing `"Rename"` item
- A confirmation dialog: project name displayed, primary destructive button to confirm, secondary button to cancel
- On confirm: call `DELETE /api/projects/:id`; on success close the dialog and invalidate the `['designs']` TanStack Query key
- On API error: close the dialog and show a brief toast error notification
- `DELETE /api/projects/:id` backend endpoint — deletes the project row and its thumbnail file (if present)
- The delete flow works identically inside the `AllDesignsModal`

**Out of scope (future iterations)**
- Undo / restore deleted designs
- Bulk delete
- Deleting associated assets (image elements whose `src` references `/api/assets/:id/content`)
- Deleting a design that is currently open in the editor
- Confirmation of unsaved changes before deletion

---

## UI Layout

### Kebab dropdown (updated)

```
┌────────────────┐
│  ✏ Rename      │
│  🗑 Delete      │
└────────────────┘
```

- The `"Delete"` item sits directly below `"Rename"`, separated by a `1px` horizontal divider (`border-t border-gray-100`).
- Row layout: same `px-3 py-2 text-sm` as the Rename item.
- Icon: a trash-can SVG (`14 × 14 px`, `text-red-400`).
- Text colour: `text-red-600`.
- Hover: `bg-red-50`.
- The destructive red colouring distinguishes it clearly from non-destructive actions.

### Confirmation dialog

```
┌────────────────────────────────────┐
│  Delete design?                    │
│                                    │
│  "My Design Name" will be          │
│  permanently deleted. This action  │
│  cannot be undone.                 │
│                                    │
│          [Cancel]  [Delete]        │
└────────────────────────────────────┘
```

- A centred modal with a semi-transparent backdrop, matching the visual style of `NewDesignModal` and `RenameModal`.
- Heading: `"Delete design?"` (`text-lg font-semibold text-gray-900`).
- Body: the project name is rendered in quotation marks and **bold** (`font-semibold`), followed by the warning text `"will be permanently deleted. This action cannot be undone."` (`text-sm text-gray-600`).
- `"Delete"` button: `bg-red-600 text-white hover:bg-red-700`, primary-width; shows a spinner and is non-interactive while the API call is in flight.
- `"Cancel"` button: secondary ghost/outline (`border border-gray-300 text-gray-700`); always interactive.
- The two buttons are right-aligned at the bottom of the dialog.
- Pressing `Escape` closes the dialog without deleting.
- Clicking the backdrop closes the dialog without deleting.

---

## Behaviour

| Action | Outcome |
|---|---|
| Click `"Delete"` in the dropdown | Dropdown closes; confirmation dialog opens |
| Click `"Cancel"` in dialog | Dialog closes; no API call |
| Press `Escape` in dialog | Same as `"Cancel"` |
| Click backdrop | Same as `"Cancel"` |
| Click `"Delete"` in dialog | Dialog enters loading state; `DELETE /api/projects/:id` is called |
| API call succeeds | Dialog closes; `['designs']` query invalidated; card disappears from the grid |
| API call fails | Dialog closes; toast error notification shown: `"Could not delete the design. Please try again."` |
| Click `"Delete"` in dialog while already loading | No-op (button is non-interactive during loading) |

---

## API

### `DELETE /api/projects/:id`

Permanently deletes the project and its thumbnail file.

**Server-side behaviour**

1. Look up the project by `id`; return `404 NOT_FOUND` if absent.
2. Delete the row from the `project` table.
3. Attempt to remove `{ASSET_DIR}/thumb_{id}.jpg` from disk. If the file does not exist, skip silently — do not return an error.
4. Return `204 No Content`.

No cascading deletion of `asset` rows is performed in this iteration (assets are shared infrastructure; the spec notes this in Out of scope).

**Response `204`** — no body.

**Errors**

| Status | Code | Condition |
|---|---|---|
| `404` | `NOT_FOUND` | No project with that id |

---

## Frontend Integration

### `deleteProject` API helper

Add to `src/api/projects.ts`:

```ts
export function deleteProject(id: string): Promise<void> {
  return apiFetch<void>(`/api/projects/${id}`, { method: 'DELETE' })
}
```

### TanStack Query mutation

The mutation is owned by `HomePage` (and mirrored in `AllDesignsModal`):

```ts
const deleteMutation = useMutation({
  mutationFn: (id: string) => deleteProject(id),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['designs'] })
  },
  onError: () => {
    setDeleteError('Could not delete the design. Please try again.')
  },
})
```

`deleteError` drives the toast notification (see below).

---

## Error Notification

Reuses the same transient toast pattern used in the export specs (18, 19):

- Background `bg-red-50`, border `border border-red-200`, text `text-red-700`, `rounded-lg`, `px-4 py-2`.
- Fixed overlay at `top-4 left-1/2 -translate-x-1/2`, `z-50`.
- Auto-dismissed after `4000 ms` via `setTimeout`.
- Shared with the existing `exportError` state, or introduced alongside it in `HomePage` as `deleteError`.

---

## State

| State | Type | Location |
|---|---|---|
| `deleteTarget` | `{ id: string; name: string } \| null` | `useState` in `HomePage` (and `AllDesignsModal`) — which project is pending deletion |
| `deleteError` | `string \| null` | `useState` in `HomePage` (and `AllDesignsModal`) — toast message |
| `isDeleting` | `boolean` | derived from `deleteMutation.isPending` |

---

## Components

| Component | Location | Change |
|---|---|---|
| `KebabMenu` | `src/components/KebabMenu.tsx` | Gains `onDelete` prop; renders the `"Delete"` item below `"Rename"` with red styling |
| `DeleteConfirmModal` | `src/components/DeleteConfirmModal.tsx` | New — confirmation dialog; accepts `projectName`, `onConfirm`, `onClose`, `isLoading` |
| `ProjectCard` | `src/components/ProjectCard.tsx` | Gains `onDelete` prop; passes it through to `KebabMenu` |
| `HomePage` | `src/pages/HomePage.tsx` | Owns `deleteTarget` and `deleteError`; wires `deleteMutation`; renders `DeleteConfirmModal` |
| `AllDesignsModal` | `src/components/AllDesignsModal.tsx` | Mirrors `HomePage` delete wiring: owns `deleteTarget` and `deleteError`; wires `deleteMutation`; renders `DeleteConfirmModal` |

---

## `KebabMenu` prop changes

```ts
type Props = {
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
  onRename: () => void
  onDelete: () => void   // NEW
}
```

---

## `ProjectCard` prop changes

```ts
type Props = {
  project: ProjectSummary
  isLoading: boolean
  onClick: () => void
  onRename: () => void
  onDelete: () => void                         // NEW
  isMenuOpen: boolean
  onMenuOpenChange: (open: boolean) => void
}
```

---

## File Structure Additions

```
backend/
  src/
    routes/
      projects.ts        (updated — DELETE /api/projects/:id endpoint)

frontend/
  src/
    api/
      projects.ts        (updated — deleteProject helper)
    components/
      DeleteConfirmModal.tsx   (new)
      KebabMenu.tsx            (updated — onDelete prop and Delete menu item)
      ProjectCard.tsx          (updated — onDelete prop)
      AllDesignsModal.tsx      (updated — delete wiring)
    pages/
      HomePage.tsx             (updated — deleteTarget, deleteError, deleteMutation)
```

---

## Acceptance Criteria

1. Every project card on the home page grid and inside the `AllDesignsModal` shows a `"Delete"` item in the kebab dropdown, below `"Rename"`, with red text and a trash-can icon.
2. The `"Delete"` item is separated from `"Rename"` by a subtle horizontal divider.
3. Clicking `"Delete"` in the dropdown closes the dropdown and opens the confirmation dialog.
4. The confirmation dialog displays the project name in bold within the warning message.
5. Clicking `"Cancel"`, pressing `Escape`, or clicking the backdrop closes the dialog without making any API call.
6. Clicking the `"Delete"` button in the dialog calls `DELETE /api/projects/:id`.
7. While the API call is in flight the `"Delete"` button shows a spinner and is non-interactive; the `"Cancel"` button remains interactive.
8. On successful deletion the dialog closes, the `['designs']` query is invalidated, and the deleted project card disappears from the list.
9. On API error the dialog closes and a toast notification `"Could not delete the design. Please try again."` appears for 4 seconds.
10. The deleted project is permanently removed — reloading the home page does not show it again.
11. Deleting a project from within the `AllDesignsModal` removes the card from the modal list and updates the home page grid and `"View all (N)"` count correctly after query invalidation.
12. Deleting one project does not affect any other project card or its canvas state.
13. Clicking `"Delete"` in the dropdown does not trigger the card's open action.
14. The `"Rename"` action in the kebab menu continues to work exactly as before — the delete feature does not regress it.
