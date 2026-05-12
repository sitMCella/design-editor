# Feature Spec: Toolbar & Arrow Element

## Summary

Add an arrow button to the left-side toolbar. Clicking the button inserts a fixed-style arrow element at the centre of the canvas. In this first iteration the arrow is not customisable — its length, stroke width, colour, and arrowhead are all fixed. Arrow element state is local only — no backend persistence in this iteration.

## Scope

**In scope**
- Arrow tool button in the existing left-side toolbar
- Clicking the button inserts a default arrow element at the centre of the design surface
- Click to select an arrow element
- Basic selection highlight (outline) on selected element
- Deselect when clicking the canvas background

**Out of scope (future iterations)**
- Persisting arrow elements to the backend
- Undo / redo
- Drag to reposition the arrow element
- Resize or rotate handles
- Customisable length, stroke width, colour, or arrowhead style
- Curved arrows or multi-segment paths

---

## UI Layout

```
┌──────────────────────────────────────────────────────┐
│  Editor Header                                        │
├──────┬───────────────────────────────────────────────┤
│      │                                               │
│  T   │                                               │
│  →   │              Canvas                           │
│ bar  │                                               │
│      │                                               │
└──────┴───────────────────────────────────────────────┘
```

The toolbar layout is unchanged. The arrow button sits below the existing tool buttons in the vertical strip.

---

## Toolbar

### Arrow tool button

- Icon: a rightward arrow glyph (`→`)
- Tooltip on hover: `"Arrow"`
- On click: sets `activeTool` to `'arrow'` in the UI store and calls `addElement()` on the canvas store with a default `ArrowElement`. After insertion the tool reverts to `'select'`.

### Active tool state

The toolbar reads `activeTool` from the UI store. The active tool button is visually distinguished (filled background). The active state is momentary — it reverts to `'select'` immediately after the element is added, matching the behaviour of the existing Text tool.

---

## Canvas Behaviour

### Coordinate system

All element positions (`x`, `y`) are in design-surface pixels (origin at top-left of the `1280 × 720` surface), independent of zoom.

### Arrow element defaults

When the arrow button is clicked, a new `ArrowElement` is added with:

```ts
{
  id: nanoid(),
  type: 'arrow',
  x: 540,           // centres the 200px arrow horizontally on the 1280px surface
  y: 355,           // centres the 10px arrow vertically on the 720px surface
  width: 200,       // fixed length of the arrow along its horizontal axis
  height: 10,       // fixed stroke bounding height (includes arrowhead clearance)
  rotation: 0,
  opacity: 1,
  locked: false,
  stroke: '#111827',
  strokeWidth: 2,
  arrowHead: 'end', // arrowhead at the end point only
}
```

The arrow is rendered as an SVG `<line>` with an SVG `<marker>` arrowhead. The marker is a filled triangle pointing in the direction of the line.

### Interaction states

| State | How entered | Visual treatment |
|---|---|---|
| **Default** | Element exists, not selected | No outline |
| **Selected** | Single click on element | Blue outline (`2px solid #3B82F6`) around the bounding box |
| **Deselected** | Click on canvas background | No outline |

There is no edit mode for arrow elements in this iteration.

### Hit area

Because the arrow stroke is thin, the clickable hit area is expanded to a minimum of `10px` around the line segment to avoid frustrating click misses. This is achieved by rendering a transparent `<rect>` over the bounding box that captures pointer events.

---

## State

### `ArrowElement` type

A new variant is added to the `CanvasElement` discriminated union:

```ts
type ArrowElement = BaseElement & {
  type: 'arrow'
  stroke: string          // hex colour — fixed at '#111827' in this iteration
  strokeWidth: number     // fixed at 2 in this iteration
  arrowHead: 'end'        // fixed; only end-side arrowhead supported for now
}
```

Update `CanvasElement`:

```ts
type CanvasElement =
  | ShapeElement
  | TextElement
  | ImageElement
  | GroupElement
  | ArrowElement   // NEW
```

### Canvas store additions used

```ts
addElement(element: CanvasElement): void
selectElements(ids: string[]): void
clearSelection(): void
```

### UI store additions used

```ts
activeTool: 'select' | 'text' | 'arrow'   // 'arrow' is new
```

---

## Components

| Component | Location | Responsibility |
|---|---|---|
| `Toolbar` | `src/components/editor/Toolbar.tsx` | Adds the arrow tool button; sets `activeTool` to `'arrow'` on click |
| `DesignSurface` | `src/components/editor/DesignSurface.tsx` | Renders `ArrowElement` components alongside existing element types |
| `ArrowElement` | `src/components/editor/elements/ArrowElement.tsx` | Renders the SVG arrow with hit area; handles click-to-select |

`EditorPage` and `Canvas` require no changes.

---

## Rendering Detail

`ArrowElement` renders an SVG sized to the element's `width × height` bounding box:

```tsx
<svg width={width} height={height} overflow="visible">
  <defs>
    <marker
      id={`arrowhead-${id}`}
      markerWidth="8"
      markerHeight="8"
      refX="6"
      refY="3"
      orient="auto"
    >
      <path d="M0,0 L0,6 L8,3 z" fill={stroke} />
    </marker>
  </defs>
  {/* Transparent hit area */}
  <rect
    x={0}
    y={0}
    width={width}
    height={height}
    fill="transparent"
    style={{ cursor: isSelected ? 'grab' : 'default' }}
    onClick={handleClick}
  />
  <line
    x1={0}
    y1={height / 2}
    x2={width}
    y2={height / 2}
    stroke={stroke}
    strokeWidth={strokeWidth}
    markerEnd={`url(#arrowhead-${id})`}
  />
</svg>
```

The SVG is positioned on the design surface with `position: absolute`, `left: x`, `top: y`, matching the pattern used by other element types.

---

## Acceptance Criteria

1. The toolbar displays an arrow (`→`) button below the existing tool buttons.
2. Hovering the arrow button shows the tooltip `"Arrow"`.
3. Clicking the arrow button adds an arrow element at the centre of the design surface.
4. The arrow element is rendered as a horizontal line with a filled arrowhead at its right end.
5. Clicking the arrow element selects it and shows a blue bounding-box outline.
6. Clicking the canvas background deselects the arrow element.
7. Multiple arrow elements can be added independently; each is selectable individually.
8. The active tool reverts to `'select'` immediately after the arrow element is inserted.
9. Refreshing the page clears all elements (no persistence).
