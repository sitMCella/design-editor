# Feature Spec: Table Element Customisation

## Summary

Extend the table element with five capabilities: free-form dragging to reposition it on the canvas, corner handles to resize the overall table dimensions, column-divider dragging to set individual column widths, a contextual toolbar for adding and removing rows and columns and editing cell content inline via double-click, and full backend persistence of the updated `TableElement` state through the existing auto-save pipeline.

## Scope

**In scope**
- Drag-to-reposition a selected table element on the canvas
- Four corner resize handles that appear on a selected table element
- Column-divider drag handles that appear on a selected table element, allowing each column's width to be set independently
- Row-divider drag handles that appear on a selected table element, allowing each row's height to be set independently
- Contextual toolbar visible when a table element is selected, with:
  - "Add row" button — appends a new empty data row
  - "Remove row" button — removes the last data row (disabled when only one data row remains)
  - "Add column" button — appends a new empty column
  - "Remove column" button — removes the last column (disabled when only one column remains)
- Double-click a cell to enter inline edit mode (`contentEditable`); blur or Enter to confirm
- All changes update the canvas store immediately; the existing auto-save pipeline persists the updated element to `PATCH /api/projects/:id`

**Out of scope (future iterations)**
- Undo / redo
- Rotation handles
- Adding or removing a specific row or column by index (only append/remove-last)
- Styling individual cells (background colour, font, borders per-cell)
- Merging or splitting cells
- Sorting or filtering table data
- Drag-to-reorder rows or columns
- Keyboard nudging of position
- Multi-element selection involving the table
- Real-time collaboration

---

## UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Editor Header                                                   │
├─────────────────────────────────────────────────────────────────┤
│  Contextual Toolbar (table element selected)                    │
│  [+ Row] [− Row] [+ Col] [− Col]                                │
├──────┬──────────────────────────────────────────────────────────┤
│      │                                                          │
│  T   │   ◆──────────────────────────────◆                     │
│  ⬚   │   │ Header 1    │    Header 2    │                     │
│  →   │   ├─────────────┼────────────────┤                     │
│  ⊞   │   │ Cell 1      │    Cell 2      │                     │
│      │   ├─────────────┼────────────────┤                     │
│      │   │ Cell 3      │    Cell 4      │                     │
│      │   ◆──────────────────────────────◆                     │
└──────┴──────────────────────────────────────────────────────────┘
```

- The contextual toolbar is the same fixed-height (`40px`) strip introduced in feature 02. It renders table-specific controls when a table element is selected.
- Corner handles (`◆`) appear at the four outer corners of the bounding box in **Selected** state. They are `10 × 10 px` filled blue squares (`#3B82F6`), matching the image element handles.
- Column-divider handles appear as vertical `4px`-wide transparent hit-zones centred on each internal column boundary. A `1px` blue line (`#93C5FD`) is shown on hover to indicate the interactive boundary.
- Row-divider handles follow the same pattern horizontally on each internal row boundary.

---

## Dragging

### Interaction model

Dragging is initiated with `mousedown` on a table element that is already in **Selected** state. If the element is not yet selected, `mousedown` selects it; a subsequent drag on the next `mousedown` moves it.

| Event sequence | Outcome |
|---|---|
| `mousedown` → `mouseup` (no movement) | Select element |
| `mousedown` → mouse moves ≥ 4 px → `mouseup` | Move element to new position |
| `mousedown` → `mouseup` → `dblclick` on a cell | Enter cell edit mode |

The 4 px movement threshold prevents accidental drags during clicks.

### Implementation

- On `mousedown` on a **selected** element (not on a resize handle, a divider handle, or an editing cell): record `dragStart = { mouseX, mouseY, elementX, elementY }`.
- Attach `mousemove` and `mouseup` listeners to `window`.
- On `mousemove`: if displacement ≥ 4 px, compute and clamp new position:
  ```
  newX = clamp(dragStart.elementX + (currentMouseX - dragStart.mouseX), 0, SURFACE_WIDTH  - element.width)
  newY = clamp(dragStart.elementY + (currentMouseY - dragStart.mouseY), 0, SURFACE_HEIGHT - element.height)
  ```
- On `mouseup`: call `updateElement` with final position; clear drag state.
- Remove window listeners on `mouseup` and on component unmount.

### Cursor

| Element state | Cursor |
|---|---|
| Default (not selected) | `default` |
| Selected, hovering body | `grab` |
| Dragging | `grabbing` (set on `<body>` during drag to prevent flicker) |
| Hovering corner handle | `nwse-resize` / `nesw-resize` (per corner) |
| Hovering column-divider | `col-resize` |
| Hovering row-divider | `row-resize` |
| Editing a cell | `text` |

---

## Corner Resize Handles

### Placement

Four `10 × 10 px` square handles, absolutely positioned at each corner of the element wrapper:

| Handle | Position |
|---|---|
| Top-left | `top: -5px; left: -5px` |
| Top-right | `top: -5px; right: -5px` |
| Bottom-left | `bottom: -5px; left: -5px` |
| Bottom-right | `bottom: -5px; right: -5px` |

Cursors: `nwse-resize` for top-left and bottom-right; `nesw-resize` for top-right and bottom-left.

### Interaction model

| Handle dragged | Width changes | Height changes | Anchor |
|---|---|---|---|
| Top-left | Yes (left edge moves) | Yes (top edge moves) | Bottom-right corner |
| Top-right | Yes (right edge grows) | Yes (top edge moves) | Bottom-left corner |
| Bottom-left | Yes (left edge moves) | Yes (bottom edge grows) | Top-right corner |
| Bottom-right | Yes (right edge grows) | Yes (bottom edge grows) | Top-left corner |

When a top or left edge moves, both `x`/`y` and `width`/`height` update together to keep the anchor corner stationary.

### Implementation

- On `mousedown` on a handle: record `resizeStart = { mouseX, mouseY, elementX, elementY, elementW, elementH, handle }`. Attach `mousemove` / `mouseup` listeners to `window`.
- On `mousemove`: compute delta and apply to the appropriate dimensions. Enforce:
  - Minimum element size: `80 × 40 px` (two columns × one row minimum).
  - Element must not extend outside the design surface.
- On `mouseup`: call `updateElement` with final geometry; scale `columnWidths` proportionally so they continue to sum to `width`; scale `rows[*].height` proportionally so they continue to sum to `height`.
- Remove window listeners on `mouseup` and on component unmount.

---

## Column-Divider Resize Handles

### Placement

For a table with `n` columns there are `n − 1` internal column dividers. Each divider handle is a transparent `<div>` `4 px` wide × `height` tall, centred on the boundary between two adjacent columns, absolutely positioned relative to the element wrapper. A `1 px` blue line (`#93C5FD`) is revealed on hover.

Column boundary x-coordinate for divider `i` (0-indexed):

```
boundaryX = sum(columnWidths[0..i])
dividerLeft = boundaryX - 2   // centres the 4px hit-zone on the boundary
```

### Interaction

- On `mousedown` on divider `i`: record `divStart = { mouseX, leftWidth: columnWidths[i], rightWidth: columnWidths[i + 1] }`. Attach `mousemove` / `mouseup` to `window`.
- On `mousemove`: redistribute width between the two adjacent columns:
  ```
  delta = currentMouseX - divStart.mouseX
  newLeft  = clamp(divStart.leftWidth  + delta, MIN_COLUMN_WIDTH, divStart.leftWidth + divStart.rightWidth - MIN_COLUMN_WIDTH)
  newRight = divStart.leftWidth + divStart.rightWidth - newLeft
  ```
  where `MIN_COLUMN_WIDTH = 40 px`.
- Call `updateElement` on each `mousemove` so the table reflows in real time.
- On `mouseup`: finalize by calling `updateElement` with the final `columnWidths` array.

---

## Row-Divider Resize Handles

### Placement

For `m` rows there are `m − 1` internal row dividers. Each divider handle is a transparent `<div>` `width` px wide × `4 px` tall, absolutely positioned on each internal row boundary. A `1 px` blue line (`#93C5FD`) is revealed on hover.

Row boundary y-coordinate for divider `j` (0-indexed):

```
boundaryY = sum(rows[0..j].height)
dividerTop = boundaryY - 2
```

### Interaction

Mirror of the column-divider logic but applied to adjacent `rows[j].height` and `rows[j + 1].height`.

Minimum row height: `24 px`. On `mouseup`, call `updateElement` with the updated `rows` array.

---

## Contextual Toolbar

When the selected element is a `TableElement`, `ContextualToolbar` renders four action buttons.

```
[+ Row]  [− Row]  [+ Col]  [− Col]
```

### Add row

Appends a new data row to `rows`:

```ts
{
  isHeader: false,
  height: 40,   // default row height
  cells: Array(element.columns).fill(''),
}
```

Calls `updateElement(id, { rows: [...rows, newRow], height: height + 40 })`.

The "Remove row" button becomes enabled after this action (there are now ≥ 2 data rows).

### Remove row

Removes the last entry in `rows` (which is always a data row — the header row at index 0 is never removed). Calls `updateElement(id, { rows: rows.slice(0, -1), height: height - rows[rows.length - 1].height })`.

Disabled when there is exactly one data row (i.e. `rows.length === 2`: one header + one data row).

### Add column

Appends an empty cell to every row's `cells` array and extends `columnWidths` with a new entry of `DEFAULT_COLUMN_WIDTH = 120 px`:

```ts
const updatedRows = rows.map(row => ({ ...row, cells: [...row.cells, ''] }))
const updatedWidths = [...columnWidths, DEFAULT_COLUMN_WIDTH]
```

Calls `updateElement(id, { columns: columns + 1, columnWidths: updatedWidths, rows: updatedRows, width: width + DEFAULT_COLUMN_WIDTH })`.

### Remove column

Removes the last column from every row and from `columnWidths`. Calls `updateElement` with updated `columns`, `columnWidths`, `rows`, and `width`. Disabled when `columns === 1`.

---

## Cell Inline Editing

### Entry and exit

| Action | Result |
|---|---|
| Double-click a cell (table is selected) | Cell enters edit mode |
| `blur` or press `Enter` | Exits edit mode; content is committed |
| Press `Escape` | Exits edit mode; content reverts to the value at entry |
| Click outside the table | Exits edit mode (blur fires first); deselects the element |

### Implementation

- Each cell renders a `<div>` with `contentEditable="true"` when `editingCell === { rowIndex, colIndex }` (local component state).
- On focus: record `valueAtEntry` from `rows[rowIndex].cells[colIndex]`.
- On `input`: update local display in real time (optimistic — the store is updated on commit to avoid excessive mutations).
- On `blur` / `Enter`: call `updateElement` with a new `rows` array where the edited cell's value is replaced with the trimmed `innerText`. Empty cells are allowed (placeholder text is displayed, not stored).
- On `Escape`: restore `innerText` to `valueAtEntry`; call `blur()` programmatically.
- The `dblclick` event on the element body must call `e.stopPropagation()` so it does not reach the canvas background and trigger deselection.

### Placeholder text in empty cells

When a cell's stored value is `''`, the rendered cell shows a muted placeholder (`"Click to edit"`) using a CSS `::before` pseudo-element or a conditional `<span>`. The placeholder is not stored in the canvas state.

---

## State Changes

### `TableRow` type extension

```ts
type TableRow = {
  isHeader: boolean
  cells: string[]
  height: number   // NEW — row height in px; default 40
}
```

### `TableElement` type extension

```ts
type TableElement = BaseElement & {
  type: 'table'
  columns: number
  columnWidths: number[]   // NEW — one entry per column; must always sum to element.width
  rows: TableRow[]         // extended with height field above
}
```

The `width` on `BaseElement` is always equal to `sum(columnWidths)`. The `height` is always equal to `sum(rows[*].height)`. These invariants are enforced inside `updateElement` whenever a resize or add/remove action is applied.

### Default element (updated from feature 10)

The `TableElement` produced by the toolbar gains `columnWidths` and per-row `height`:

```ts
{
  id: nanoid(),
  type: 'table',
  x: 440,
  y: 300,
  width: 400,
  height: 120,
  rotation: 0,
  opacity: 1,
  locked: false,
  columns: 2,
  columnWidths: [200, 200],
  rows: [
    { isHeader: true,  height: 40, cells: ['Header 1', 'Header 2'] },
    { isHeader: false, height: 40, cells: ['Cell 1',   'Cell 2'  ] },
    { isHeader: false, height: 40, cells: ['Cell 3',   'Cell 4'  ] },
  ],
}
```

### Backend persistence

No new API endpoints or database schema changes are required. The updated `TableElement` (including `columnWidths` and per-row `height`) is stored verbatim inside the `canvas.elements` JSONB array on every auto-save (`PATCH /api/projects/:id`). The existing auto-save debounce (2 seconds after the last `isDirty` change) and the `markSaved()` / retry logic from the state-management spec apply without modification.

---

## Components

| Component | Location | Responsibility |
|---|---|---|
| `TableElement` | `src/components/editor/elements/TableElement.tsx` | Extended with drag logic, corner handles, column/row divider handles, per-cell `contentEditable` edit mode |
| `ContextualToolbar` | `src/components/editor/ContextualToolbar.tsx` | Extended to render table controls (add/remove row, add/remove column) when a table element is selected |
| `Toolbar` | `src/components/editor/Toolbar.tsx` | Updated default `TableElement` factory to include `columnWidths` and per-row `height` |
| `canvasStore` | `src/stores/canvasStore.ts` | No new actions; `updateElement` handles all mutations |

`EditorPage`, `Canvas`, and `DesignSurface` require no changes.

---

## Acceptance Criteria

1. A selected table element can be dragged freely within the design surface bounds without triggering deselection.
2. The element cannot be dragged so that any part of it extends outside the `1280 × 720` design surface.
3. A selected table element shows corner resize handles at its four corners.
4. Dragging a corner handle resizes the table; minimum size is `80 × 40 px` and the element cannot extend outside the design surface.
5. After a corner resize, `columnWidths` are scaled proportionally so they still sum to `element.width`, and `rows[*].height` are scaled proportionally so they still sum to `element.height`.
6. A selected table element shows column-divider handles on each internal column boundary.
7. Dragging a column-divider handle redistributes width between the two adjacent columns in real time; neither column may become narrower than `40 px`.
8. A selected table element shows row-divider handles on each internal row boundary.
9. Dragging a row-divider handle redistributes height between the two adjacent rows in real time; neither row may become shorter than `24 px`.
10. The contextual toolbar shows table controls (add/remove row, add/remove column) when a table element is selected and hides when nothing is selected.
11. Clicking "Add row" appends a new empty data row with height `40 px` and expands `element.height` accordingly.
12. Clicking "Remove row" removes the last data row and contracts `element.height` accordingly; the button is disabled when only one data row remains.
13. Clicking "Add column" appends a new empty column (`120 px` wide) to every row and expands `element.width` accordingly.
14. Clicking "Remove column" removes the last column from every row and contracts `element.width` accordingly; the button is disabled when only one column remains.
15. Double-clicking a cell on a selected table element enters inline edit mode for that cell.
16. Typing in edit mode updates the visible cell text in real time.
17. Pressing `Enter` or clicking outside the cell commits the edited value and exits edit mode.
18. Pressing `Escape` while editing reverts the cell to its value before editing began.
19. Empty cells (stored value `''`) display a muted placeholder (`"Click to edit"`) that is not persisted.
20. All customisations (position, size, column widths, row heights, row/column count, cell content) are persisted to the backend via the existing auto-save mechanism within 2 seconds of the last change.
21. Reloading the editor and reopening the project restores the table exactly as saved — including position, dimensions, column widths, row heights, number of rows and columns, and all cell content.
22. Multiple table elements retain their individual configurations independently.
