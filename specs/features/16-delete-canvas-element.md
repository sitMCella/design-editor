# Feature Spec: Delete Canvas Elements

## Summary

Allow the user to remove one or more selected canvas elements via two complementary triggers: a delete button in the contextual toolbar and the `Delete` keyboard key. Both triggers operate on the current `selectedIds`, supporting single and multi-element deletion equally. Deletion is immediate — there is no confirmation prompt. No undo/redo is introduced in this iteration.

## Scope

**In scope**
- A "Delete" icon button at the right end of the contextual toolbar, to the left of the existing pin button
- The `Delete` key (and `Backspace` as an alias) deletes the selected elements when a deletable focus context is active
- Both triggers call the existing `removeElements(ids: string[])` canvas store action
- Works for every element type: text, image, arrow, table
- Works for single selections and multi-element selections (introduced in spec 14)
- After deletion the selection is cleared (`selectedIds = []`)
- The toolbar delete button is always present in the toolbar strip whenever the toolbar is rendered (same visibility rules as the rest of the toolbar)
- The delete button is disabled (dimmed, non-interactive) when the toolbar is in the pinned-dimmed state (no live selection, as defined in spec 15)
- The `Delete` / `Backspace` key is suppressed when focus is inside any text-entry context: a text element's `contentEditable`, a table cell's `contentEditable`, the image URL input, the font-size input, the stroke-width input, or any other `<input>` / `<textarea>` in the editor UI

**Out of scope (future iterations)**
- Undo / redo (removing an element is currently irreversible within the session)
- Confirmation prompt before deletion
- Soft-delete / trash bin
- Deleting the currently-editing text element by emptying its content (that is already handled by the blur-removes-empty-element rule in spec 01)
- Removing connections on arrow elements when a connected element is deleted (broken connections are left as free endpoints in this iteration)
- Keyboard shortcut `Cmd/Ctrl + Backspace` or any other modifier variant

---

## UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Editor Header  [− 100% +]                                      │
├─────────────────────────────────────────────────────────────────┤
│  [Font family ▾] [14 − +] [B] [I] [■] [≡ ≡≡ ≡]  [🗑]  [📌]   │  ← text element selected
├──────┬──────────────────────────────────────────────────────────┤
│      │                     Canvas                               │
└──────┴──────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────────┐
│  Editor Header  [− 100% +]                                      │
├─────────────────────────────────────────────────────────────────┤
│  [ 🔗 URL ▏] [ ⬆ Upload ] [ Fit ▾ ]              [🗑]  [📌]   │  ← image element selected
├──────┬──────────────────────────────────────────────────────────┤
│      │                     Canvas                               │
└──────┴──────────────────────────────────────────────────────────┘
```

- The delete button (`🗑`) sits at the right end of the element-specific controls, separated from them by a `1px` vertical divider (`border-l border-gray-200`). It is placed immediately to the left of the existing pin button.
- The delete button is always in the same position regardless of element type, providing a consistent affordance.
- The button's icon is a trash-can SVG glyph, `16 × 16 px`.
- Tooltip on hover: `"Delete"`.
- Visual style: `text-gray-500` idle; `text-red-500 bg-red-50` on hover, to signal a destructive action.
- In the pinned-dimmed state (spec 15), the delete button is covered by the same overlay that dims all other controls — it is non-interactive and visually dimmed at `opacity-40`.

---

## Behaviour

### Toolbar button

| Selection state | Button visible | Button interactive |
|---|---|---|
| Empty (unpinned) | No (toolbar hidden) | — |
| Empty (pinned) | Yes | No (dimmed by pin overlay) |
| Single element | Yes | Yes |
| Multi-element, same type | Yes | Yes |
| Multi-element, mixed types (unpinned) | No (toolbar hidden) | — |
| Multi-element, mixed types (pinned) | Yes | No (dimmed by pin overlay) |

Clicking the delete button calls `removeElements(selectedIds)` then `clearSelection()`.

### Keyboard shortcut (`Delete` / `Backspace`)

The `Delete` and `Backspace` keys trigger element deletion when **all** of the following are true:

1. `selectedIds` is non-empty.
2. No element is in edit mode (text `contentEditable`, table cell `contentEditable`, image crop/pan mode).
3. The document's active element (`document.activeElement`) is not an `<input>`, `<textarea>`, `[contenteditable]`, or `<select>`.

When the conditions are met, `removeElements(selectedIds)` is called followed by `clearSelection()`.

The keyboard handler is attached once on `Canvas` (which already owns the `Escape` handler added in spec 14), using a `keydown` listener on `window`. The listener checks `event.key === 'Delete' || event.key === 'Backspace'` and applies the guard conditions above before acting.

**Focus guard detail** — the guard uses:

```ts
const tag = (document.activeElement?.tagName ?? '').toLowerCase()
const isEditable = (document.activeElement as HTMLElement)?.isContentEditable
const isFormField = ['input', 'textarea', 'select'].includes(tag)
if (isFormField || isEditable) return  // suppress deletion
```

This covers all current text-entry contexts without requiring element components to register or unregister anything.

### Arrow element connections

When an arrow element is deleted, any arrow connections pointing to it (via `startAnchor.elementId` or `endAnchor.elementId` on other arrow elements) are **not** automatically cleaned up in this iteration. The dangling references will simply resolve to no-op updates since the referenced element no longer exists. This is consistent with the "deletion frees endpoints" note in spec 09.

When a non-arrow element is deleted and another arrow is connected to it, the connected arrow's endpoint becomes a free coordinate (the canvas store's `updateElement` side-effect that recalculates connected endpoints will no longer find a matching element and will not update). The arrow remains on the canvas with its last computed endpoint position.

---

## State changes

### Canvas store

No new actions are needed. The existing actions are sufficient:

```ts
removeElements(ids: string[]): void   // already defined in state-management spec
clearSelection(): void                // already defined
```

`removeElements` must also clear any `startAnchor` / `endAnchor` references on remaining arrow elements that point to any of the deleted ids:

```ts
removeElements: (ids) =>
  set((state) => {
    const idSet = new Set(ids)
    state.elements = state.elements.filter((el) => !idSet.has(el.id))
    // Clear dangling arrow anchors
    state.elements.forEach((el) => {
      if (el.type !== 'arrow') return
      if (el.startAnchor && idSet.has(el.startAnchor.elementId)) {
        el.startAnchor = undefined
      }
      if (el.endAnchor && idSet.has(el.endAnchor.elementId)) {
        el.endAnchor = undefined
      }
    })
    state.isDirty = true
  }),
```

> Note: the spec 09 description says "deletion simply frees the endpoint" and leaves cleanup out of scope. This spec supersedes that note — cleaning up dangling anchors inside `removeElements` is a contained, zero-UX-impact change that prevents silent data inconsistency.

### Auto-save

`isDirty` is set to `true` by `removeElements` (as with any other mutation that changes `elements`). The existing 2-second debounced auto-save persists the updated canvas to the backend with no additional wiring.

---

## Components

| Component | Location | Change |
|---|---|---|
| `ContextualToolbar` | `src/components/editor/ContextualToolbar.tsx` | Adds the delete button at the right of element controls, left of the pin button; calls `removeElements(selectedIds)` + `clearSelection()` on click |
| `Canvas` | `src/components/editor/Canvas.tsx` | Extends the existing `keydown` handler on `window` to handle `Delete` / `Backspace` with the focus guard; calls `removeElements` + `clearSelection` when conditions are met |
| `canvasStore` | `src/stores/canvasStore.ts` | `removeElements` extended to clear dangling `startAnchor` / `endAnchor` references on remaining arrow elements |

`EditorPage`, `Toolbar`, `DesignSurface`, and all element components require no changes.

---

## Acceptance Criteria

1. The contextual toolbar displays a trash-can delete button to the right of the element-specific controls and to the left of the pin button, whenever the toolbar is visible with a live selection.
2. The delete button shows a `"Delete"` tooltip on hover.
3. The delete button has a red hover state (`text-red-500`, `bg-red-50`) to signal it is a destructive action.
4. Clicking the delete button removes all currently selected elements from the canvas and clears the selection.
5. Clicking the delete button works for single-element selections of every element type: text, image, arrow, table.
6. Clicking the delete button with a multi-element selection (same type or mixed types, when the toolbar is visible) removes all selected elements at once.
7. After deletion via the toolbar button, the contextual toolbar hides (unpinned mode) or enters the dimmed state (pinned mode) because the selection is now empty.
8. Pressing `Delete` while one or more elements are selected and no text-entry context is focused removes all selected elements and clears the selection.
9. Pressing `Backspace` has the same effect as `Delete` under the same conditions.
10. Pressing `Delete` or `Backspace` while a text element is in inline edit mode (`contentEditable` focused) does **not** delete the element — it edits the text content as normal.
11. Pressing `Delete` or `Backspace` while a table cell is in inline edit mode does **not** delete the element.
12. Pressing `Delete` or `Backspace` while the image URL `<input>` is focused does **not** delete the element.
13. Pressing `Delete` or `Backspace` while any other `<input>`, `<textarea>`, or `<select>` in the editor UI is focused does **not** delete any element.
14. After deletion via the keyboard shortcut, the selection is cleared.
15. Deleting an element that has an arrow connected to it removes the element; the connected arrow remains on the canvas with its endpoint as a free coordinate (no dangling `startAnchor` / `endAnchor` reference remains on the arrow).
16. Deletion sets `isDirty = true`; the canvas auto-saves within 2 seconds and the deleted elements are absent from the persisted canvas.
17. Reloading the editor after deletion confirms that the deleted elements are not restored.
18. When the toolbar is pinned and the selection is empty (dimmed state), the delete button is visually dimmed and non-interactive — clicking it has no effect.
19. Multiple independent deletions can be performed in sequence; each removes only the currently selected elements at the time of the action.
