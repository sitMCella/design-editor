# Feature Spec: Arrow Element Customisation

## Summary

Extend the arrow element with four capabilities: free-form dragging of the arrow body, interactive endpoint dragging to resize and reangle the arrow, endpoint snapping to anchor points on other canvas elements (sticky connections that follow when the connected element moves), and a contextual formatting toolbar that appears when an arrow is selected, allowing the user to change stroke width, arrowhead position, and colour.

## Scope

**In scope**
- Drag the arrow body to reposition the entire arrow
- Drag either endpoint handle to change the arrow's length, angle, or start/end position
- Endpoint snapping: when an endpoint is dragged within 12 px of an anchor point on another canvas element it snaps and stays connected
- Connected endpoints follow the target element when it is moved or resized
- Connections are broken by dragging the endpoint more than 12 px away from the connected anchor
- Contextual toolbar section for arrows: arrowhead position (`none`, `start`, `end`, `both`), stroke width, stroke colour
- All changes update the canvas store immediately (local only — no backend persistence in this iteration)

**Out of scope (future iterations)**
- Undo / redo
- Arrow-to-arrow connections
- Mid-point dragging (curved or bent arrows)
- Keyboard nudging of position
- Opacity or rotation controls for arrows
- Connections updated when a connected element is deleted (deletion simply frees the endpoint)

---

## UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Editor Header                                                   │
├─────────────────────────────────────────────────────────────────┤
│  Contextual Toolbar (arrow selected)                            │
│  [— → ← ↔] [2 − +] [■ colour]                                  │
├──────┬──────────────────────────────────────────────────────────┤
│      │                                                          │
│  T   │                  Canvas                                  │
│  →   │      ●───────────────────────►                          │
│ bar  │      start handle          end handle                   │
│      │                                                          │
└──────┴──────────────────────────────────────────────────────────┘
```

The contextual toolbar is the same fixed-height (`40px`) strip introduced in feature 02. When the selected element is an arrow it renders the arrow-specific controls described below. The `EditorPage` layout is unchanged.

---

## Arrow Model

### Type changes

The `ArrowElement` type gains explicit endpoint coordinates and an optional anchor record for each endpoint. The `arrowHead` field is widened from `'end'` (fixed in feature 08) to a union of four positions.

```ts
type AnchorSide = 'top' | 'right' | 'bottom' | 'left' | 'center'

type ArrowAnchor = {
  elementId: string   // id of the connected canvas element
  side: AnchorSide    // which anchor point on that element
}

type ArrowElement = BaseElement & {
  type: 'arrow'
  // Authoritative endpoint coordinates (absolute design-surface pixels)
  x1: number
  y1: number
  x2: number
  y2: number
  // Styling
  stroke: string
  strokeWidth: number   // px, 1–20
  arrowHead: 'none' | 'start' | 'end' | 'both'
  // Optional sticky connections — absent means the endpoint is free
  startAnchor?: ArrowAnchor
  endAnchor?: ArrowAnchor
}
```

The inherited `BaseElement` fields `x`, `y`, `width`, `height` become a **derived bounding box** maintained automatically whenever an endpoint changes:

```
x      = Math.min(x1, x2) - strokeWidth / 2
y      = Math.min(y1, y2) - strokeWidth / 2
width  = Math.abs(x2 - x1) + strokeWidth
height = Math.abs(y2 - y1) + strokeWidth
```

`rotation` from `BaseElement` is always `0` for arrows and is ignored.

### Default values

The element inserted by the toolbar (feature 08) is updated to use the new fields:

```ts
{
  id: crypto.randomUUID(),
  type: 'arrow',
  x1: 540, y1: 360,      // start — horizontally and vertically centred
  x2: 740, y2: 360,      // end   — 200 px to the right
  // derived bounding box (kept in sync automatically)
  x: 539, y: 359, width: 202, height: 4,
  rotation: 0,
  opacity: 1,
  locked: false,
  stroke: '#111827',
  strokeWidth: 2,
  arrowHead: 'end',
}
```

### Anchor points exposed by canvas elements

Every non-arrow element exposes five anchor points used for snapping:

| Side | Coordinate |
|---|---|
| `top` | `(x + width / 2, y)` |
| `right` | `(x + width, y + height / 2)` |
| `bottom` | `(x + width / 2, y + height)` |
| `left` | `(x, y + height / 2)` |
| `center` | `(x + width / 2, y + height / 2)` |

---

## Dragging

### Body drag (move the whole arrow)

Body dragging is identical to the text element drag (feature 02): initiated with `mousedown` on the arrow when it is already **Selected**, requires a ≥ 4 px movement threshold before the drag is committed, and attaches `mousemove`/`mouseup` listeners to `window`.

On `mousemove`, both endpoints shift by the same delta:

```
x1_new = x1 + (currentMouseX - startMouseX)
y1_new = y1 + (currentMouseY - startMouseY)
x2_new = x2 + (currentMouseX - startMouseX)
y2_new = y2 + (currentMouseY - startMouseY)
```

Clamp so no endpoint leaves the design surface (`0 ≤ xN ≤ SURFACE_WIDTH`, `0 ≤ yN ≤ SURFACE_HEIGHT`).

**Connection behaviour during body drag:** if either endpoint is anchored, the body drag first breaks all connections (clears `startAnchor` / `endAnchor`) and then moves freely. This prevents a tug-of-war between the drag and the snapping system.

### Endpoint drag (resize / reangle)

Two circular endpoint handles are visible whenever the arrow is **Selected**:

| Handle | Position | Appearance |
|---|---|---|
| Start handle | `(x1, y1)` | 8 px hollow circle, border `#3B82F6` |
| End handle | `(x2, y2)` | 8 px filled circle, fill `#3B82F6` |

Initiating an endpoint drag:
1. `mousedown` on a handle begins the endpoint drag (no 4 px threshold — handles are small and intentional).
2. `mousemove` on `window` updates only the dragged endpoint; the other endpoint is fixed.
3. Clamp so the dragged endpoint stays within the design surface.
4. While dragging, scan all non-arrow elements for anchor points within **12 px** of the current mouse position. If one is found:
   - Snap the endpoint to the exact anchor coordinate.
   - Show a **snap indicator**: a blue filled circle (10 px diameter) centred on the target anchor point.
5. `mouseup`: if a snap target was active, record the connection in `startAnchor` or `endAnchor`. Otherwise store the free coordinate and clear the anchor field.

### Breaking a connection

If the user drags a currently-anchored endpoint more than **12 px** from the anchor point, the connection is broken: `startAnchor` / `endAnchor` is cleared and the endpoint becomes free. The snap indicator disappears immediately.

### Connected endpoint following

When a non-arrow element is moved or resized (via its own drag), the canvas store recalculates the positions of any connected arrow endpoints before committing the update:

```
// updateElement(id, patch) — pseudo-code for side-effect
elements.forEach(el => {
  if (el.type !== 'arrow') return
  if (el.startAnchor?.elementId === id)
    el.x1 = anchorCoord(updatedElement, el.startAnchor.side).x
    el.y1 = anchorCoord(updatedElement, el.startAnchor.side).y
  if (el.endAnchor?.elementId === id)
    el.x2 = anchorCoord(updatedElement, el.endAnchor.side).x
    el.y2 = anchorCoord(updatedElement, el.endAnchor.side).y
})
```

This runs inside the Immer draft so it is a single atomic store update.

### Cursor

| Arrow state | Cursor |
|---|---|
| Default (not selected) | `default` |
| Selected, hovering body | `grab` |
| Dragging body | `grabbing` (set on `<body>` to prevent flicker) |
| Hovering endpoint handle | `crosshair` |
| Dragging endpoint | `crosshair` |

---

## Contextual Toolbar

When the selected element is an `ArrowElement`, the `ContextualToolbar` renders three controls in place of the text formatting controls.

```
[— → ← ↔]   [2 − +]   [■ colour]
  arrowhead   stroke     stroke
  position    width      colour
```

### Arrowhead position

Four icon toggle buttons (mutually exclusive, one always active):

| Icon | Value | Meaning |
|---|---|---|
| `—` | `'none'` | No arrowheads |
| `→` | `'end'` | Arrowhead at end only (default) |
| `←` | `'start'` | Arrowhead at start only |
| `↔` | `'both'` | Arrowheads at both ends |

Active button has a filled `bg-blue-100 text-blue-600` background.  
On click: `updateElement(id, { arrowHead: value })`.

### Stroke width

A numeric input flanked by `−` and `+` buttons. Min: `1`, Max: `20`, step: `1`.  
Changing the value calls `updateElement(id, { strokeWidth: Number(value) })`.  
The derived bounding box is recalculated automatically.

### Stroke colour

A native `<input type="color">` with a coloured square trigger. The input value is `element.stroke` (hex string).  
On change: `updateElement(id, { stroke: e.target.value })`.  
The arrowhead marker fill updates to match in the same render pass.

---

## State changes

### Canvas store additions

The `updateElement` action gains a side-effect: after applying the patch to the target element, it scans `elements` for arrow elements whose `startAnchor.elementId` or `endAnchor.elementId` matches the updated element's `id` and recalculates their endpoint coordinates.

No new Zustand actions are needed beyond `updateElement`.

### New helper (not a store action)

```ts
function anchorCoord(
  el: CanvasElement,
  side: AnchorSide
): { x: number; y: number }
```

Pure function — returns the absolute design-surface coordinate for the given anchor side of the element. Used during snapping and anchor recalculation.

---

## Components

| Component | Location | Responsibility |
|---|---|---|
| `ArrowElement` | `src/components/editor/elements/ArrowElement.tsx` | Body drag, endpoint handles, snap indicator, SVG rendering with dynamic arrowheads |
| `ContextualToolbar` | `src/components/editor/ContextualToolbar.tsx` | Arrow-specific toolbar section: arrowhead buttons, stroke width, colour |
| `canvasStore` | `src/stores/canvasStore.ts` | `updateElement` extended to recalculate connected arrow endpoints |

`EditorPage`, `Toolbar`, `DesignSurface`, and `Canvas` require no changes.

---

## Acceptance Criteria

1. A selected arrow element can be dragged by its body; the whole arrow moves together.
2. Body dragging does not trigger deselection.
3. The arrow body cannot be dragged so that any endpoint leaves the design surface bounds.
4. When a body drag begins on an anchored arrow, all existing connections are broken before the move.
5. When the arrow is selected, a circular handle is visible at each endpoint.
6. Dragging the start handle changes only the start endpoint; the end endpoint is fixed.
7. Dragging the end handle changes only the end endpoint; the start endpoint is fixed.
8. Endpoint handles cannot be dragged outside the design surface.
9. While dragging an endpoint within 12 px of a target element's anchor point, the endpoint snaps to that anchor and a snap indicator appears.
10. Releasing an endpoint on a snap target stores the connection; releasing freely stores the raw coordinate.
11. A connected element that is moved carries the attached arrow endpoint with it in real time.
12. Dragging a connected endpoint more than 12 px from its anchor point breaks the connection.
13. The contextual toolbar is visible whenever an arrow element is selected and hidden otherwise.
14. The arrowhead position buttons (`—`, `→`, `←`, `↔`) update the arrowhead rendering immediately; the active button is highlighted.
15. The stroke width input and `±` buttons update the line thickness immediately; value is clamped to 1–20.
16. The colour picker updates the stroke colour and arrowhead fill in real time.
17. All customisations are independent per arrow element.
18. All customisations persist for the lifetime of the session (no backend persistence in this iteration).
