# Feature Spec: Shape Element Customisation

## Summary

Extend the shape element with five capabilities: free-form dragging to reposition it on the canvas, corner resize handles to change its dimensions, a contextual formatting toolbar that appears whenever a shape element is selected allowing the user to change the shape variant, fill colour, stroke colour, and stroke width, full integration with the multi-element selection and drag system introduced in spec 14, and deletion via the toolbar button and keyboard shortcut introduced in spec 16.

## Scope

**In scope**
- Drag-to-reposition a selected shape element on the canvas
- Four corner resize handles that appear on a selected shape element
- Contextual toolbar visible when a shape element is selected, with:
  - Shape variant picker (`rect`, `ellipse`, `triangle`)
  - Fill colour picker (native `<input type="color">` with a "No fill / transparent" toggle)
  - Stroke colour picker (native `<input type="color">`)
  - Stroke width input (numeric, with increment/decrement buttons)
- Shift+click and marquee multi-selection (spec 14) work with shape elements
- Multi-element drag moves all selected shape elements (and any other selected elements) together
- The contextual toolbar applies property changes to all selected shape elements when multiple are selected
- Delete via the toolbar trash button and via `Delete` / `Backspace` keyboard shortcut (spec 16)
- All changes update the canvas store immediately (local only — no backend persistence in this iteration)

**Out of scope (future iterations)**
- Rotation handles
- Rounded corners (`border-radius`)
- Gradient or pattern fills
- Opacity control in the toolbar (the `opacity` field exists on `BaseElement` but is not exposed here)
- Undo / redo
- Keyboard nudging of position (arrow keys)
- Shadow or blur effects
- Proportional / aspect-ratio-locked resize

---

## UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Editor Header                                                   │
├─────────────────────────────────────────────────────────────────┤
│  Contextual Toolbar (shape element selected)                    │
│  [■ ● ▲] [■ fill] [— stroke] [2 − +]           [🗑]  [📌]     │
├──────┬──────────────────────────────────────────────────────────┤
│      │                                                          │
│  T   │   ◆──────────────────◆  ← corner handles (selected)    │
│  ⬚   │   │   shape element  │                                  │
│  →   │   ◆──────────────────◆                                  │
│  ⊞   │                                                          │
│  ■   │                                                          │
└──────┴──────────────────────────────────────────────────────────┘
```

The contextual toolbar is the same fixed-height (`40px`) strip used by all other element types. When a shape element is selected it renders the shape-specific controls described below. The `EditorPage` layout is unchanged.

Corner handles are `10 × 10 px` squares with a blue fill (`#3B82F6`), positioned at the four outer corners of the element's bounding box. They appear only in **Selected** state.

---

## Dragging

### Interaction model

Dragging is initiated with `mousedown` on a shape element that is already in **Selected** state. If the element is not yet selected, `mousedown` selects it and a subsequent drag (on the next `mousedown`) moves it.

| Event sequence | Outcome |
|---|---|
| `mousedown` → `mouseup` (no movement) | Select element (handled by existing click logic) |
| `mousedown` → mouse moves ≥ 4 px → `mouseup` | Move element to new position |

The 4 px movement threshold prevents accidental drags during clicks.

### Implementation

- On `mousedown` on a **selected** element: record `dragStart = { mouseX, mouseY, elementX, elementY }` in local component state.
- Attach `mousemove` and `mouseup` listeners to `window` (not the element) so dragging works even when the cursor leaves the element bounds.
- On `mousemove`: if displacement ≥ 4 px, set `isDragging = true` and update element position:
  ```
  newX = dragStart.elementX + (currentMouseX - dragStart.mouseX)
  newY = dragStart.elementY + (currentMouseY - dragStart.mouseY)
  ```
  With the infinite canvas (spec 13) there is no surface boundary clamp — elements may be positioned at any world-space coordinate.
- On `mouseup`: if `isDragging`, call `updateElement` with the final position, call `onDragEnd` with the committed world-space delta (for multi-element drag, spec 14), and clear drag state. Suppress the subsequent `click` event to avoid deselecting.
- Remove window listeners on `mouseup` and on component unmount.

### Cursor

| Element state | Cursor |
|---|---|
| Default (not selected) | `default` |
| Selected (not dragging, not resizing) | `grab` |
| Dragging | `grabbing` (set on `<body>` during drag to prevent cursor flicker) |

---

## Resize Handles

### Placement

Four `10 × 10 px` square handles, absolutely positioned relative to the element wrapper, at each corner:

| Handle | Position |
|---|---|
| Top-left | `top: -5px; left: -5px` |
| Top-right | `top: -5px; right: -5px` |
| Bottom-left | `bottom: -5px; left: -5px` |
| Bottom-right | `bottom: -5px; right: -5px` |

`cursor: nwse-resize` for the top-left and bottom-right handles; `cursor: nesw-resize` for the top-right and bottom-left handles.

### Interaction model

| Handle dragged | Width changes | Height changes | Anchor point |
|---|---|---|---|
| Top-left | Yes (left edge moves) | Yes (top edge moves) | Bottom-right corner |
| Top-right | Yes (right edge grows) | Yes (top edge moves) | Bottom-left corner |
| Bottom-left | Yes (left edge moves) | Yes (bottom edge grows) | Top-right corner |
| Bottom-right | Yes (right edge grows) | Yes (bottom edge grows) | Top-left corner |

When a top or left edge moves, both `x`/`y` and `width`/`height` update together to keep the anchor corner stationary.

### Implementation

- On `mousedown` on a handle: record `resizeStart = { mouseX, mouseY, elementX, elementY, elementW, elementH, handle }` and attach `mousemove` / `mouseup` listeners to `window`.
- On `mousemove`: compute delta from `resizeStart` and apply to the appropriate dimensions. Enforce a minimum element size of `20 × 20 px`.
- On `mouseup`: call `updateElement` with the final geometry; clear resize state.
- Remove window listeners on `mouseup` and on component unmount.

The `ellipse` and `triangle` variants scale exactly like `rect` — the bounding box dimensions change and the shape scales proportionally within it.

---

## Shape Rendering Detail

### `rect`

Rendered as a `<div>` with `backgroundColor: fill` and, when `strokeWidth > 0`, `border: {strokeWidth}px solid {stroke}` and `boxSizing: 'border-box'`.

### `ellipse`

Rendered as a `<div>` with `borderRadius: '50%'`, `backgroundColor: fill`, and, when `strokeWidth > 0`, `border: {strokeWidth}px solid {stroke}` and `boxSizing: 'border-box'`.

### `triangle`

Rendered as an SVG `<polygon>` sized to the element's bounding box. The three vertices are:

```
top-centre:     (width / 2, 0)
bottom-left:    (0, height)
bottom-right:   (width, height)
```

The `<polygon>` uses `fill={fill}` and, when `strokeWidth > 0`, `stroke={stroke}` and `strokeWidth={strokeWidth}`. The SVG has `overflow="visible"` so stroke on the outer edge is not clipped.

When `fill` is `'transparent'` the polygon is rendered with `fill="transparent"` (not `fill="none"`) to preserve click hit-testing over the interior area.

---

## Contextual Toolbar

When the selected element is a `ShapeElement`, the `ContextualToolbar` renders four groups of controls.

```
[■ ● ▲]   [■ fill]   [— stroke]   [2 − +]
 variant   fill col   stroke col  stroke w
```

### Shape variant

Three icon toggle buttons (mutually exclusive, one always active):

| Icon | Value | Shape |
|---|---|---|
| `■` | `'rect'` | Filled square |
| `●` | `'ellipse'` | Filled circle |
| `▲` | `'triangle'` | Filled triangle |

The active button has a `bg-blue-100 text-blue-600` background.
On click: `updateElement(id, { shape: value })`.

When multiple shape elements are selected, this control is only shown if all selected elements share the same `shape` value; otherwise the variant buttons are hidden but the other controls remain visible.

### Fill colour

A native `<input type="color">` with a coloured square trigger (`20 × 20 px`, `rounded-sm`). The input value is the element's `fill` property.

- When `fill === 'transparent'`, the trigger renders the same `4 × 4 px` checkerboard used for the canvas background transparent swatch (spec 20) and the native picker is not shown on click — instead clicking toggles between the checkerboard (transparent) and the last non-transparent fill.
- A small `⊘` icon button beside the trigger toggles transparency on/off: when fill is non-transparent, clicking it sets `fill = 'transparent'`; when fill is transparent, clicking it restores the previous non-transparent value.
- On colour picker change: `updateElement(id, { fill: e.target.value })`.

### Stroke colour

A native `<input type="color">` with a coloured square trigger (`20 × 20 px`, `rounded-sm`). The input value is the element's `stroke` property.

- When `stroke === 'transparent'`, the trigger renders the checkerboard pattern.
- Same `⊘` toggle as fill, operating on `stroke`.
- On colour picker change: `updateElement(id, { stroke: e.target.value })`.

### Stroke width

A numeric input flanked by `−` and `+` buttons. Min: `0`, Max: `20`, step: `1`.
Changing the value calls `updateElement(id, { strokeWidth: Number(value) })`.

When `strokeWidth` is `0` the stroke colour picker is dimmed (`opacity-50`) and non-interactive, since no stroke is rendered.

---

## Multi-Element Selection and Drag

Shape elements participate in the multi-element selection system from spec 14 without any new implementation — the existing `toggleElementSelection`, `addToSelection`, and `clearSelection` actions already handle any element type.

### Shift+click

- Shift+clicking an unselected shape element adds it to `selectedIds`.
- Shift+clicking an already-selected shape element removes it from `selectedIds`.
- Both behaviours are already wired in `DesignSurface` and require no changes to `ShapeElement`.

### Marquee selection

Shape elements are included in the marquee hit-test using their `x`, `y`, `width`, `height` bounding box, consistent with all other element types (spec 14).

### Multi-element drag

`ShapeElement` exposes the `onDragEnd?: (delta: { x: number; y: number }) => void` prop introduced in spec 14. At `mouseup` after a committed drag, the component calls `onDragEnd` with the world-space delta so `DesignSurface` can apply the same delta to all other selected elements.

### Contextual toolbar with multiple shape elements selected

When `selectedIds` contains two or more shape elements:
- The variant buttons are visible only if all selected shapes share the same `shape` value; otherwise they are hidden.
- Fill colour, stroke colour, and stroke width controls are always visible and apply the change to every selected element via individual `updateElement` calls — one per selected id, consistent with the multi-select toolbar behaviour defined in spec 14.
- The toolbar is hidden when the selection contains mixed element types (spec 14 rule: mixed-type multi-selection hides the toolbar).

---

## Delete

Shape elements are deleted by the same mechanisms defined in spec 16:

- The trash-can toolbar button in `ContextualToolbar` calls `removeElements(selectedIds)` followed by `clearSelection()`.
- The `Delete` and `Backspace` keyboard shortcuts on `Canvas` trigger the same sequence when no text-entry context has focus.
- There is no edit mode for shape elements, so the keyboard shortcut is never suppressed by an in-progress edit on a shape.

No changes to `removeElements` or the keyboard handler are required — shape elements have no `startAnchor` / `endAnchor` fields, so the dangling-anchor cleanup in `removeElements` is a no-op for them.

---

## State Changes

### `ShapeElement` type (no changes to existing fields)

The type is already defined in the state-management spec. No new fields are required:

```ts
type ShapeElement = BaseElement & {
  type: 'shape'
  shape: 'rect' | 'ellipse' | 'triangle'
  fill: string       // hex colour string or 'transparent'
  stroke: string     // hex colour string or 'transparent'
  strokeWidth: number
}
```

`fill` and `stroke` already accept the string `'transparent'` — this is consistent with the existing canvas background colour convention (spec 20). No type migration is needed.

### Default element update

The toolbar default (spec 21) does not change. `stroke: 'transparent'` and `strokeWidth: 0` remain the defaults so new shapes are inserted without a border.

### `onDragEnd` prop

`ShapeElement` gains the `onDragEnd` prop signature used by all other draggable element components:

```ts
onDragEnd?: (delta: { x: number; y: number }) => void
```

### `DesignSurface` update

The `onDragEnd` callback is wired for `ShapeElement` renders, mirroring the pattern already applied to `TextElement`, `ImageElement`, `ArrowElement`, and `TableElement` in spec 14.

---

## Components

| Component | Location | Change |
|---|---|---|
| `ShapeElement` | `src/components/editor/elements/ShapeElement.tsx` | Extended with drag logic, corner resize handles, `ellipse` and `triangle` rendering, `onDragEnd` prop |
| `ContextualToolbar` | `src/components/editor/ContextualToolbar.tsx` | Extended to render shape controls (variant picker, fill, stroke colour, stroke width) when a shape element is selected |
| `DesignSurface` | `src/components/editor/DesignSurface.tsx` | Wires `onDragEnd` for `ShapeElement` renders |

`EditorPage`, `Canvas`, `Toolbar`, and `canvasStore` require no changes.

---

## Acceptance Criteria

1. A selected shape element can be dragged freely on the infinite canvas without triggering deselection.
2. Dragging requires a ≥ 4 px movement threshold before the element begins to move.
3. A selected shape element shows resize handles at its four corners.
4. Dragging a corner handle resizes the element; minimum size is `20 × 20 px`.
5. When a top or left handle is dragged, `x`/`y` and `width`/`height` update together to keep the anchor corner stationary.
6. The contextual toolbar shows shape controls (variant picker, fill colour, stroke colour, stroke width) when a shape element is selected and hides when nothing is selected.
7. Clicking the `rect`, `ellipse`, or `triangle` variant button changes the rendered shape immediately; the active button is highlighted.
8. Changing the fill colour via the colour picker updates the shape's fill in real time.
9. Clicking the `⊘` fill toggle switches the fill to `'transparent'`; the shape interior becomes invisible while the bounding box and selection outline remain visible.
10. Clicking `⊘` again when fill is transparent restores the last non-transparent fill value.
11. Changing the stroke colour updates the shape's border colour in real time.
12. The stroke colour picker and its `⊘` toggle behave symmetrically to the fill controls.
13. The stroke colour control is dimmed and non-interactive when `strokeWidth` is `0`.
14. Changing the stroke width via the input or `−`/`+` buttons updates the border thickness immediately; the value is clamped to `0–20`.
15. The `ellipse` variant renders as an ellipse (fully rounded) within its bounding box.
16. The `triangle` variant renders as a centred isosceles triangle within its bounding box; both fill and stroke scale with the bounding box.
17. Shift+clicking an unselected shape element adds it to the current selection.
18. Shift+clicking an already-selected shape element removes it from the selection.
19. Shape elements are included in marquee (Shift+drag) selection when their bounding box is fully enclosed by the marquee rectangle.
20. When multiple shape elements are selected, dragging any one of them moves all selected elements by the same world-space delta.
21. When multiple shape elements of the same variant are selected, the contextual toolbar shows live controls that apply changes to all selected elements simultaneously.
22. When the variant buttons are shown for a multi-selection and a different variant is clicked, all selected elements switch to the new variant.
23. When multiple selected elements have different `shape` values, the variant buttons are hidden; fill, stroke colour, and stroke width controls remain visible and apply to all.
24. Pressing `Delete` or `Backspace` while one or more shape elements are selected (and no text-entry context has focus) removes them from the canvas and clears the selection.
25. Clicking the trash-can button in the contextual toolbar removes all currently selected shape elements.
26. After deletion via either mechanism, the toolbar hides (unpinned) or enters the dimmed state (pinned per spec 15).
27. Shape elements are listed in the layer panel (spec 17) with the label `"Shape N"` and are reorderable by drag.
28. Hiding a shape element via the layer panel removes it from the canvas; showing it again restores it.
29. All customisations (position, size, shape variant, fill, stroke colour, stroke width) are independent per element and persist for the lifetime of the session.
30. Refreshing the page clears all shape elements (no backend persistence in this iteration).
