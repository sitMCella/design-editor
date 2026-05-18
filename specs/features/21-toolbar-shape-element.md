# Feature Spec: Toolbar & Shape Element

## Summary

Add a shape button to the left-side toolbar. Clicking the button inserts a fixed-style square shape element at the centre of the canvas. In this first iteration only the square (`rect`) variant is available and the element is not customisable — its fill colour, stroke, and dimensions are all fixed. Shape element state is local only — no backend persistence in this iteration.

## Scope

**In scope**
- Shape tool button in the existing left-side toolbar
- Clicking the button inserts a default square shape element at the centre of the canvas
- Click to select a shape element
- Basic selection highlight (outline) on selected element
- Deselect when clicking the canvas background
- Multiple shape elements can be added independently

**Out of scope (future iterations)**
- Persisting shape elements to the backend
- Undo / redo
- Drag to reposition the shape element
- Resize or rotate handles
- Additional shape variants (ellipse, triangle)
- Customisable fill colour, stroke colour, stroke width, or opacity
- Rounded corners

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
│  ■   │                                               │
│ bar  │                                               │
│      │                                               │
└──────┴───────────────────────────────────────────────┘
```

The toolbar layout is unchanged. The shape button sits below the existing tool buttons in the vertical strip.

---

## Toolbar

### Shape tool button

- Icon: a small inline SVG filled square (`■`), sized `20 × 20 px`
- Tooltip on hover: `"Shape"`
- On click: sets `activeTool` to `'shape'` in the UI store and calls `addElement()` on the canvas store with a default `ShapeElement`. After insertion the tool reverts to `'select'`.

### Active tool state

The toolbar reads `activeTool` from the UI store. The active tool button is visually distinguished (filled background). The active state is momentary — it reverts to `'select'` immediately after the element is added, matching the behaviour of the existing Text, Image, Arrow, and Table tools.

---

## Canvas Behaviour

### Coordinate system

All element positions (`x`, `y`) are in world-space pixels (origin at the top-left of the infinite canvas), independent of zoom.

### Shape element defaults

When the shape button is clicked, a new `ShapeElement` is added with:

```ts
{
  id: nanoid(),
  type: 'shape',
  shape: 'rect',
  x: 560,           // horizontally centred relative to the initial viewport
  y: 310,           // vertically centred relative to the initial viewport
  width: 160,
  height: 160,
  rotation: 0,
  opacity: 1,
  locked: false,
  fill: '#3B82F6',        // blue-500
  stroke: 'transparent',
  strokeWidth: 0,
}
```

### Rendered appearance

The shape element is rendered as a plain `<div>` (or an SVG `<rect>`) sized to the element's `width × height` bounding box:

- Background: the element's `fill` colour (`#3B82F6` by default).
- Border: none in the default configuration (`stroke: 'transparent'`, `strokeWidth: 0`).
- No shadow, border-radius, or other decoration in this iteration.

### Interaction states

| State | How entered | Visual treatment |
|---|---|---|
| **Default** | Element exists, not selected | No outline |
| **Selected** | Single click on element | Blue outline (`2px solid #3B82F6`) around the bounding box |
| **Deselected** | Click on canvas background | No outline |

There is no edit mode for shape elements in this iteration.

---

## State

### `ShapeElement` type

The `ShapeElement` type is already defined in the state-management spec and included in the `CanvasElement` discriminated union:

```ts
type ShapeElement = BaseElement & {
  type: 'shape'
  shape: 'rect' | 'ellipse' | 'triangle'   // only 'rect' is used in this iteration
  fill: string
  stroke: string
  strokeWidth: number
}
```

No type changes are required.

### UI store extension

The `activeTool` union in `UIStore` gains `'shape'`:

```ts
activeTool: 'select' | 'text' | 'image' | 'arrow' | 'table' | 'shape'
```

### Canvas store actions used

No new actions are required. The existing `addElement`, `selectElements`, and `clearSelection` are sufficient.

---

## Components

| Component | Location | Responsibility |
|---|---|---|
| `Toolbar` | `src/components/editor/Toolbar.tsx` | Gains the shape button; calls `addElement` with a default `ShapeElement` |
| `ShapeElement` | `src/components/editor/elements/ShapeElement.tsx` | Renders the shape as a styled `<div>`; handles click-to-select |
| `DesignSurface` | `src/components/editor/DesignSurface.tsx` | Extended to render `<ShapeElement>` for elements with `type: 'shape'` |

`EditorPage` and `Canvas` require no changes.

---

## Rendering Detail

`ShapeElement` renders a `<div>` absolutely positioned on the design surface, sized to the element's bounding box:

```tsx
<div
  style={{
    position: 'absolute',
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    backgroundColor: element.fill,
    border: element.strokeWidth > 0
      ? `${element.strokeWidth}px solid ${element.stroke}`
      : 'none',
    outline: isSelected ? '2px solid #3B82F6' : 'none',
    cursor: isSelected ? 'grab' : 'default',
    boxSizing: 'border-box',
  }}
  onClick={handleClick}
/>
```

The component follows the same structure as `ImageElement` — no internal SVG is needed for a solid filled rectangle.

---

## Acceptance Criteria

1. The toolbar displays a square icon button below the existing tool buttons, with tooltip `"Shape"`.
2. Clicking the shape button inserts a square shape element at the centre of the canvas viewport.
3. The inserted element renders as a blue (`#3B82F6`) filled square with no visible border.
4. Clicking a shape element selects it and shows a blue bounding-box outline (`2px solid #3B82F6`).
5. Clicking the canvas background deselects the shape element (outline removed).
6. Multiple shape elements can be added and each is independently selectable.
7. The active tool reverts to `'select'` immediately after the shape element is inserted.
8. Shape elements participate in multi-element selection (Shift+click, marquee) as defined in spec 14.
9. Shape elements appear in the layer panel (spec 17) with the label `"Shape N"` and the appropriate type icon.
10. Refreshing the page removes all shape elements (no persistence in this iteration).
