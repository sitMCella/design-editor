# Feature Spec: Toolbar & Table Element

## Summary

Add a table button to the left-side toolbar. Clicking the button inserts a fixed table element at the centre of the canvas. The table has one header row and two data rows, each with two columns. In this first iteration the table is not customisable — the number of rows and columns, cell content, and visual style are all fixed. Table element state is local only — no backend persistence in this iteration.

## Scope

**In scope**
- Table tool button in the existing left-side toolbar
- Clicking the button inserts a default table element at the centre of the design surface
- The table renders with one header row and two data rows, each containing two columns
- Click to select a table element
- Basic selection highlight (outline) on selected element
- Deselect when clicking the canvas background
- Multiple table elements can be added independently

**Out of scope (future iterations)**
- Persisting table elements to the backend
- Undo / redo
- Drag to reposition the table element
- Resize or rotate handles
- Adding, removing, or reordering rows and columns
- Editing cell content inline
- Styling individual cells (font, colour, background, borders)
- Merging or splitting cells
- Contextual formatting toolbar for table properties

---

## UI Layout

```
┌──────────────────────────────────────────────────────┐
│  Editor Header                                        │
├──────┬───────────────────────────────────────────────┤
│      │                                               │
│  T   │                                               │
│  ⬚   │              Canvas                           │
│  →   │                                               │
│  ⊞   │                                               │
│ bar  │                                               │
│      │                                               │
└──────┴───────────────────────────────────────────────┘
```

The toolbar layout is unchanged. The table button sits below the existing tool buttons in the vertical strip.

---

## Toolbar

### Table tool button

- Icon: a small inline SVG table grid icon (`⊞` — a 2×2 grid), sized `20 × 20 px`
- Tooltip on hover: `"Table"`
- On click: sets `activeTool` to `'table'` in the UI store and calls `addElement()` on the canvas store with a default `TableElement`. After insertion the tool reverts to `'select'`.

### Active tool state

The toolbar reads `activeTool` from the UI store. The active tool button is visually distinguished (filled background). The active state is momentary — it reverts to `'select'` immediately after the element is added, matching the behaviour of the existing Text and Arrow tools.

---

## Canvas Behaviour

### Coordinate system

All element positions (`x`, `y`) are in design-surface pixels (origin at top-left of the `1280 × 720` surface), independent of zoom.

### Table element defaults

When the table button is clicked, a new `TableElement` is added with:

```ts
{
  id: nanoid(),
  type: 'table',
  x: 440,          // horizontally centred: (1280 - 400) / 2
  y: 300,          // vertically centred:   (720  - 120) / 2
  width: 400,
  height: 120,     // header row (40px) + 2 data rows (40px each)
  rotation: 0,
  opacity: 1,
  locked: false,
  columns: 2,
  rows: [
    {
      isHeader: true,
      cells: ['Header 1', 'Header 2'],
    },
    {
      isHeader: false,
      cells: ['Cell 1', 'Cell 2'],
    },
    {
      isHeader: false,
      cells: ['Cell 3', 'Cell 4'],
    },
  ],
}
```

### Rendered appearance

The table is rendered as an HTML `<table>` (or equivalent `<div>` grid) sized to the element's `width × height` bounding box:

- **Header row** — background `#F3F4F6` (Tailwind `gray-100`), text `#111827` (Tailwind `gray-900`), `fontWeight: bold`, `fontSize: 14px`.
- **Data rows** — background `#FFFFFF`, text `#374151` (Tailwind `gray-700`), `fontWeight: normal`, `fontSize: 14px`.
- All cells are separated by `1px solid #E5E7EB` (Tailwind `gray-200`) borders. The outer border is `1px solid #D1D5DB` (Tailwind `gray-300`).
- Cell content is vertically and horizontally centred within each cell.
- All columns share equal width (`width / columns`). All rows share equal height (`height / rowCount`).

### Interaction states

| State | How entered | Visual treatment |
|---|---|---|
| **Default** | Element exists, not selected | No outline |
| **Selected** | Single click on element | Blue outline (`2px solid #3B82F6`) around the bounding box |
| **Deselected** | Click on canvas background | No outline |

There is no edit mode for table elements in this iteration.

---

## State

### `TableRow` and `TableElement` types

Two new types are introduced:

```ts
type TableRow = {
  isHeader: boolean   // true for the header row; false for data rows
  cells: string[]     // one entry per column, contains the display text
}

type TableElement = BaseElement & {
  type: 'table'
  columns: number     // fixed at 2 in this iteration
  rows: TableRow[]    // fixed at 3 entries (1 header + 2 data) in this iteration
}
```

`CanvasElement` is extended to include `TableElement`:

```ts
type CanvasElement =
  | ShapeElement
  | TextElement
  | ImageElement
  | GroupElement
  | ArrowElement
  | TableElement   // NEW
```

### UI store extension

The `activeTool` union in `UIStore` gains `'table'`:

```ts
activeTool: 'select' | 'text' | 'image' | 'arrow' | 'table'
```

### Canvas store actions used

No new actions are required. The existing `addElement`, `selectElements`, and `clearSelection` are sufficient.

---

## Components

| Component | Location | Responsibility |
|---|---|---|
| `Toolbar` | `src/components/editor/Toolbar.tsx` | Gains the table button; calls `addElement` with a default `TableElement` |
| `TableElement` | `src/components/editor/elements/TableElement.tsx` | Renders header and data rows with correct styles; handles click-to-select |
| `DesignSurface` | `src/components/editor/DesignSurface.tsx` | Extended to render `<TableElement>` for elements with `type: 'table'` |

`EditorPage` and `Canvas` require no changes.

---

## Acceptance Criteria

1. The toolbar displays a table icon button below the existing tool buttons, with tooltip `"Table"`.
2. Clicking the table button inserts a table element at the centre of the design surface (`x: 440, y: 300`).
3. The inserted element renders a table with one header row and two data rows, each containing two columns.
4. The header row is visually distinct from the data rows: bold text and a grey background (`#F3F4F6`).
5. All cells display their default placeholder text centred within the cell.
6. Column widths are equal; row heights are equal.
7. Clicking a table element selects it and shows a blue bounding-box outline (`2px solid #3B82F6`).
8. Clicking the canvas background deselects the table element (outline removed).
9. The active tool reverts to `'select'` immediately after the table element is inserted.
10. Multiple table elements can be added and each is independently selectable.
11. Refreshing the page removes all table elements (no persistence).
