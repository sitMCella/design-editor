# Feature Spec: Layer Panel

## Summary

Add a layers panel to the left sidebar that lists every canvas element in z-order and lets the user hide/show individual elements or reorder them by dragging rows within the list. The panel is toggled by a new "Layers" button in the left toolbar strip. It integrates with the existing selection system so clicking a layer row selects that element on the canvas, and selecting an element on the canvas highlights its row in the panel.

## Scope

**In scope**
- "Layers" button in the left toolbar strip that toggles the panel open/closed
- Layer panel rendered in a fixed-width sidebar between the toolbar strip and the canvas
- One row per canvas element, ordered top-to-bottom to match z-order (topmost element first)
- Each row shows: element-type icon, auto-generated label (e.g. "Text 1", "Image 2"), visibility eye-icon toggle
- Clicking a row selects that element (plain click replaces selection; Shift+click toggles it into the multi-selection)
- Selected elements are highlighted in the panel
- Drag-and-drop reordering of rows changes the z-order of elements on the canvas
- Hiding an element sets `hidden: true` on the element; it is invisible on the canvas and cannot be selected via canvas interaction, but remains in the layer list with a dimmed appearance
- Showing a hidden element clears `hidden: true`
- Hidden elements are excluded from marquee selection (spec 14) and from the element bounding box used for thumbnail generation (spec 13)
- The panel scrolls independently when the element list is taller than the viewport
- Panel state (open/closed) is stored in the UI store; survives navigation within the session

**Out of scope (future iterations)**
- Renaming elements (custom labels)
- Grouping or nesting layers
- Locking elements from the panel (the `locked` field exists on `BaseElement` but the UI for it is deferred)
- Layer-panel search or filter
- Bulk hide/show
- Per-layer opacity control
- Duplicate layer action
- Persisting hidden state to the backend beyond the existing auto-save pipeline

---

## UI Layout

### Editor with layer panel open

```
┌─────────────────────────────────────────────────────────────────┐
│  Editor Header  [− 100% +]                                      │
├─────────────────────────────────────────────────────────────────┤
│  Contextual Toolbar (element selected)                          │
├──────┬──────────────┬──────────────────────────────────────────┤
│      │  Layers      │                                          │
│  T   │  ─────────── │                                          │
│  ⬚   │  👁 Text 1   │           Canvas                        │
│  →   │  👁 Image 2  │                                          │
│  ⊞   │  👁 Arrow 3  │                                          │
│  ≡   │  👁 Table 4  │                                          │
│      │              │                                          │
└──────┴──────────────┴──────────────────────────────────────────┘
```

- The toolbar strip (`56px`) remains flush to the left edge.
- The layer panel is a `200px`-wide column that appears to the right of the toolbar strip when open. It has a white background and a `1px solid #E5E7EB` right border separating it from the canvas.
- The canvas area shrinks by `200px` when the panel is open — there is no overlay; the panel pushes the canvas.
- The panel has a `"Layers"` heading (`14px`, `font-medium`, `text-gray-700`) with `8px` vertical padding, followed by a `1px` horizontal divider, followed by the scrollable row list.

### Toolbar button

- Position: below the existing tool buttons (Text, Image, Arrow, Table) in the `56px` vertical strip.
- Icon: a stack-of-layers SVG glyph (`20 × 20 px`).
- Tooltip on hover: `"Layers"`.
- Active state (panel open): filled blue background (`bg-blue-100 text-blue-600`), matching the active-tool style used by other toolbar buttons.
- Clicking the button when the panel is closed opens it (`activePanel = 'layers'`).
- Clicking again when the panel is already open closes it (`activePanel = null`).

### Layer row

```
┌──────────────────────────────────────┐
│ ⠿  🔤  Text 1                    👁 │
└──────────────────────────────────────┘
```

- Height: `36px`.
- Left edge: a `6px`-wide drag handle area (`⠿` glyph or a vertical dots icon), `text-gray-300`, visible on row hover.
- Element type icon: `16 × 16 px` SVG icon matching the element type (T for text, picture frame for image, arrow for arrow, grid for table). Color `text-gray-500`.
- Label: auto-generated name (see labelling rules below), `14px text-gray-700`, truncated with ellipsis.
- Right edge: visibility eye icon (`16 × 16 px`). Filled eye when visible; crossed-out eye when hidden.
- Background on hover: `bg-gray-50`.
- Background when selected: `bg-blue-50`, label `text-blue-700`.
- When `hidden: true`: entire row is dimmed (`opacity-50`); visibility icon shows the crossed-out eye.
- A `1px solid #F3F4F6` bottom border separates each row.

### Empty state

When no elements are on the canvas the panel shows a centred message:

```
No elements yet.
Use the toolbar to add content.
```

`text-gray-400`, `text-sm`, centred vertically and horizontally within the list area.

---

## Auto-Generated Labels

Elements do not have a user-editable name in this iteration. Labels are derived at render time from element type and a per-type sequence number based on position in the `elements` array:

```ts
function elementLabel(el: CanvasElement, elements: CanvasElement[]): string {
  const typeLabel: Record<CanvasElement['type'], string> = {
    text: 'Text',
    image: 'Image',
    arrow: 'Arrow',
    table: 'Table',
    shape: 'Shape',
    group: 'Group',
  }
  const sameType = elements.filter((e) => e.type === el.type)
  const index = sameType.indexOf(el) + 1
  return `${typeLabel[el.type]} ${index}`
}
```

The label is computed from the full `elements` array order, not the panel display order (the panel reverses the array for display; labels count from index 0 of the stored array, so the first-created element of a type is always "Text 1" regardless of later reordering).

---

## Z-Order and Panel Display Order

The `elements` array in the canvas store is ordered by z-order: index `0` is the bottommost layer, the last index is the topmost. The layer panel displays the list **reversed** — the topmost element is at the top of the panel:

```
panel row 0  →  elements[elements.length - 1]   (topmost / front)
panel row 1  →  elements[elements.length - 2]
…
panel row N  →  elements[0]                      (bottommost / back)
```

---

## Visibility

### `hidden` field

A new optional boolean field is added to `BaseElement`:

```ts
type BaseElement = {
  id: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  locked: boolean
  hidden?: boolean   // NEW — undefined and false are equivalent; both mean visible
}
```

`hidden` defaults to `undefined` (absent) for all existing elements; `undefined` and `false` are treated identically everywhere. The field is stored in the `canvas` JSONB column by the existing auto-save pipeline without any schema change.

### Canvas rendering

`DesignSurface` already maps over `elements` to render each one. Hidden elements are skipped:

```tsx
{elements
  .filter((el) => !el.hidden)
  .map((el) => /* existing render logic */)}
```

Hidden elements do not receive pointer events and cannot be selected, dragged, or resized from the canvas.

### Selection guard

The `selectElements` and `toggleElementSelection` canvas store actions skip ids that belong to hidden elements:

```ts
selectElements: (ids) =>
  set((state) => {
    state.selectedIds = ids.filter(
      (id) => !state.elements.find((el) => el.id === id)?.hidden
    )
  }),
```

If a hidden element is in `selectedIds` when it is hidden (e.g. it was selected before being hidden via the panel), it is removed from `selectedIds` immediately.

### Bounding box exclusion

`elementsBBox` (introduced in spec 13) filters out hidden elements:

```ts
export function elementsBBox(elements: CanvasElement[]) {
  return /* existing logic applied to */ elements.filter((el) => !el.hidden)
}
```

This ensures hidden elements do not influence thumbnail bounds.

---

## Drag-and-Drop Reordering

### Interaction model

Rows in the layer panel can be reordered by dragging. Dragging a row changes the z-order of the corresponding element in the `elements` array.

| Event sequence | Outcome |
|---|---|
| `mousedown` on drag handle → mouse moves ≥ 4 px vertically → `mouseup` | Reorder: element moves to the new index |
| `mousedown` on drag handle → `mouseup` (movement < 4 px) | No reorder; treated as a row click (select) |

### Visual feedback

- While dragging, the dragged row is replaced by a `2px solid #3B82F6` insertion line that tracks the nearest valid drop position between rows.
- The dragged row itself is rendered as a semi-transparent ghost (`opacity-50`) following the cursor.

### Implementation

- On `mousedown` on the drag handle: record `dragRowStart = { mouseY, panelRowIndex }`.
- Attach `mousemove` and `mouseup` to `window`.
- On `mousemove`: if vertical displacement ≥ 4 px, compute target row index from cursor Y relative to the panel list container. Track `insertionIndex` (0 = top of list, i.e. front of z-order). Update `draggingState` local component state to render the ghost and insertion line.
- On `mouseup`: call `moveElementToIndex(id, targetIndex)` (new canvas store action), clear dragging state. Remove window listeners.
- Remove window listeners on component unmount.

### Canvas store addition

A new action replaces the discrete `reorderElement` directions for this use case:

```ts
moveElementToIndex(id: string, panelIndex: number): void
```

`panelIndex` is the **panel order index** (0 = topmost). Internally the store converts it to the `elements` array index:

```
elementsIndex = elements.length - 1 - panelIndex
```

The element at `id` is spliced out of its current position and inserted at `elementsIndex`:

```ts
moveElementToIndex: (id, panelIndex) =>
  set((state) => {
    const from = state.elements.findIndex((el) => el.id === id)
    if (from === -1) return
    const [el] = state.elements.splice(from, 1)
    const to = state.elements.length - panelIndex   // after splice, length is one less
    state.elements.splice(to, 0, el)
    state.isDirty = true
  }),
```

The existing `reorderElement` action (`'forward' | 'backward' | 'front' | 'back'`) is kept for any future programmatic use; it is not removed.

---

## Selection Integration

### Clicking a row

Clicking anywhere on a row (outside the drag handle and the eye icon) selects the element:

- Plain click: `selectElements([id])` — replaces the current selection.
- Shift+click: `toggleElementSelection(id)` — toggles the element into/out of the multi-selection.

Clicking a row for a hidden element has no effect (hidden elements cannot be selected).

### Highlighting selected rows

The layer panel reads `selectedIds` from the canvas store. A row is highlighted (`bg-blue-50`, `text-blue-700`) when its element id is in `selectedIds`.

### Scroll-to-selected

When `selectedIds` changes (e.g. the user selects an element directly on the canvas), the panel scrolls to make the first selected row visible. This is implemented with `element.scrollIntoView({ block: 'nearest' })` triggered by a `useEffect` on `selectedIds`.

---

## State Changes

### `BaseElement` type

```ts
type BaseElement = {
  id: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  locked: boolean
  hidden?: boolean   // NEW
}
```

### Canvas store additions

```ts
toggleElementVisibility(id: string): void
moveElementToIndex(id: string, panelIndex: number): void
```

`toggleElementVisibility` implementation:

```ts
toggleElementVisibility: (id) =>
  set((state) => {
    const el = state.elements.find((e) => e.id === id)
    if (!el) return
    el.hidden = !el.hidden
    // Remove from selection if now hidden
    if (el.hidden) {
      state.selectedIds = state.selectedIds.filter((sid) => sid !== id)
    }
    state.isDirty = true
  }),
```

### UI store

`activePanel` in `UIStore` already includes `'layers'` in its union — no change required.

The toolbar button toggles `activePanel` between `'layers'` and `null`:

```ts
setActivePanel: (panel) =>
  set((state) => {
    state.activePanel = state.activePanel === panel ? null : panel
  }),
```

(This action is added if not already present; the toggle semantics are new.)

---

## Auto-Save

`hidden` is stored as part of the element's JSON in `canvas.elements`. The existing 2-second debounced auto-save persists the updated canvas to `PATCH /api/projects/:id` with no additional wiring. `isDirty` is set by `toggleElementVisibility` and `moveElementToIndex` just as with any other mutation.

---

## Components

| Component | Location | Responsibility |
|---|---|---|
| `LayerPanel` | `src/components/editor/LayerPanel.tsx` | Scrollable list of layer rows; empty state; manages drag-and-drop local state |
| `LayerRow` | `src/components/editor/LayerRow.tsx` | Single row: drag handle, type icon, label, visibility toggle; emits `onSelect`, `onToggleVisibility`, `onDragStart` |
| `Toolbar` | `src/components/editor/Toolbar.tsx` | Gains the Layers button; calls `setActivePanel('layers')` on click |
| `EditorPage` | `src/pages/EditorPage.tsx` | Renders `<LayerPanel>` when `activePanel === 'layers'`; adjusts canvas layout to accommodate the panel |
| `DesignSurface` | `src/components/editor/DesignSurface.tsx` | Filters out `hidden` elements before rendering |
| `canvasStore` | `src/stores/canvasStore.ts` | Adds `toggleElementVisibility` and `moveElementToIndex`; guards `selectElements` and `toggleElementSelection` against hidden ids |
| `elementsBBox` | `src/utils/elementsBBox.ts` | Updated to filter out hidden elements |
| `uiStore` | `src/stores/uiStore.ts` | `setActivePanel` updated with toggle semantics if not already present |

`Canvas`, `ContextualToolbar`, and element components (`TextElement`, `ImageElement`, `ArrowElement`, `TableElement`) require no changes.

---

## File structure additions

```
frontend/
  src/
    components/
      editor/
        LayerPanel.tsx     (new)
        LayerRow.tsx       (new)
        Toolbar.tsx        (updated — Layers button)
        DesignSurface.tsx  (updated — filter hidden elements)
    stores/
      canvasStore.ts       (updated — toggleElementVisibility, moveElementToIndex, selection guard)
      uiStore.ts           (updated — setActivePanel toggle semantics)
    utils/
      elementsBBox.ts      (updated — filter hidden elements)
    pages/
      EditorPage.tsx       (updated — LayerPanel rendering, layout adjustment)
```

---

## Acceptance Criteria

1. A "Layers" button is visible in the left toolbar strip below the existing tool buttons, with a stack-of-layers icon and tooltip `"Layers"`.
2. Clicking the Layers button opens the layer panel as a `200px`-wide sidebar between the toolbar strip and the canvas; the canvas area shrinks by `200px`.
3. Clicking the Layers button again closes the panel and restores the full canvas width.
4. The panel lists all canvas elements in z-order, with the topmost element at the top of the list.
5. Each row displays the correct element-type icon, an auto-generated label (e.g. `"Text 1"`, `"Image 2"`), and a visibility eye icon.
6. Labels follow the per-type sequence-number convention; the first-created element of each type is always numbered 1.
7. Clicking a layer row (plain click) selects that element and highlights the row with a blue background.
8. Shift+clicking a layer row toggles the element into or out of the current multi-selection.
9. When an element is selected on the canvas, its corresponding row in the panel is highlighted.
10. When the selected element's row is outside the visible area of the panel, the panel scrolls to make it visible.
11. Clicking the eye icon on a visible row hides the element: it disappears from the canvas, cannot be selected via canvas interaction, and the row dims to `opacity-50` with the crossed-out eye icon.
12. Clicking the crossed-out eye icon on a hidden row shows the element again: it reappears on the canvas and the row returns to normal opacity.
13. A hidden element that was selected before being hidden is immediately removed from the selection when hidden.
14. Hidden elements cannot be added to the selection via canvas click, marquee drag, or the Shift+click multi-select gesture.
15. Hidden elements are excluded from the element bounding box used for thumbnail generation; they do not influence the thumbnail capture region.
16. Dragging a row by its drag handle reorders it within the list; the corresponding element's z-order in the canvas store changes accordingly.
17. A `2px solid #3B82F6` insertion line tracks the nearest drop target while a row is being dragged.
18. The dragged row shows as a semi-transparent ghost (`opacity-50`) while dragging.
19. A mousedown on a drag handle that does not exceed the 4 px movement threshold does not trigger a reorder; it is treated as a row click.
20. After reordering, the z-order change is reflected immediately on the canvas (elements overlap in the new order).
21. When no elements are on the canvas, the panel shows the empty-state message `"No elements yet. Use the toolbar to add content."`.
22. The panel scrolls independently when the list of elements exceeds the panel height.
23. The panel open/closed state persists when the user navigates from the editor to the home page and back within the same session.
24. The panel state does not persist across full page refreshes.
25. Hiding an element and saving (auto-save) persists `hidden: true` to the backend; reloading the editor restores the hidden state and the element remains invisible on the canvas.
26. Reordering elements and saving persists the new z-order to the backend; reloading the editor restores the same z-order.
27. The `Delete` / `Backspace` keyboard shortcut and the toolbar delete button (spec 16) do not delete hidden elements that happen to be in `selectedIds` — they cannot be in `selectedIds` because hidden elements cannot be selected.
