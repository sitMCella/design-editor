# Feature Spec: Mouse Gestures

## Summary

Extend canvas interaction with two gestures: click-and-drag on the canvas background to pan the viewport, and Shift+click to build a multi-element selection. The existing zoom behaviour (scroll wheel, keyboard shortcuts, header controls) is unchanged. When multiple elements are selected, dragging any one of them moves all selected elements together.

## Scope

**In scope**
- Click-and-drag on the canvas background (left mouse button, no modifier) to pan; a 4 px movement threshold distinguishes a pan drag from a plain click
- Plain click on the canvas background still deselects all elements (unchanged)
- Shift+click an element: toggle that element in or out of the current selection
- Shift+click the canvas background: no change to selection (no deselect)
- When multiple elements are selected, dragging any selected element moves all of them together
- All selected elements show the same blue bounding-box outline as a single selected element
- The contextual toolbar appears when all selected elements share the same type; it is hidden when the selection contains mixed types
- `Escape` key clears the entire selection

**Out of scope (future iterations)**
- Marquee / rubber-band selection (drag a rectangle to select all enclosed elements)
- Shift+drag to add elements within a drag rectangle to the selection
- Multi-element resize (handles for the combined bounding box)
- Copy / paste of multiple elements
- Alignment and distribution tools for multi-selections
- Rotating multiple elements as a group
- Arrow-element connections followed during multi-element drag
- Touch gestures (pinch-to-zoom, two-finger pan)

---

## UI Layout

The canvas layout is unchanged. No new visible controls are introduced.

```
┌─────────────────────────────────────────────────────────────────┐
│  Editor Header  [− 100% +]                                      │
├─────────────────────────────────────────────────────────────────┤
│  Contextual Toolbar (shown when 1+ elements of the same type    │
│  are selected; hidden when selection is empty or mixed types)   │
├──────┬──────────────────────────────────────────────────────────┤
│      │                                                          │
│  T   │  ┌─────────────┐   ┌──────────┐                        │
│  ⬚   │  │  element A  │   │element B │  ← both selected        │
│  →   │  └─────────────┘   └──────────┘                        │
│  ⊞   │                                                          │
│      │                              cursor: grab when idle      │
└──────┴──────────────────────────────────────────────────────────┘
```

---

## Background Click-and-Drag Pan

### Interaction model

| Event sequence | Outcome |
|---|---|
| `mousedown` on background → mouse moves ≥ 4 px → `mouseup` | Pan the viewport |
| `mousedown` on background → `mouseup` (movement < 4 px) | Deselect all (existing behaviour) |
| `mousedown` on element → drag → `mouseup` | Move element (existing element-drag behaviour) |

The 4 px threshold matches the drag threshold used by all element drag handlers, keeping the interaction model consistent across the editor.

### Trigger conditions

Background pan activates on a plain left-click drag (`button === 0`, no `Space` key, no `shiftKey`) whose `target` is the canvas background — i.e. `e.target === e.currentTarget` or `(e.target as HTMLElement).dataset.canvasBg === 'true'`. It activates regardless of the current selection state.

The existing pan triggers (`Space`+drag and middle-mouse drag) are unchanged.

### Implementation

`Canvas.handleMouseDown` is extended to handle plain left-click on the background:

1. If `e.button === 0` and `!spaceDownRef.current` and the event target is the canvas background:
   - Record `bgPanStartRef = { mouseX: e.clientX, mouseY: e.clientY, panX, panY }`.
   - Attach `mousemove` and `mouseup` listeners to `window`.
2. On `mousemove`:
   - If displacement `√(dx²+dy²) ≥ 4 px`, set `isBgPanningRef = true` and call `setPan`.
3. On `mouseup`:
   - Remove window listeners.
   - If `isBgPanningRef` is `true`, suppress the subsequent `click` event (set a `suppressClickRef` flag cleared after the click fires) so the background click does not also deselect.
   - Clear `bgPanStartRef` and `isBgPanningRef`.

### Cursor

| Canvas state | Cursor on background |
|---|---|
| Default (idle, no Space held) | `default` |
| Space held (existing) | `grab` |
| Background pan dragging | `grabbing` (set on `<body>`, cleared on `mouseup`) |

When a plain left-button background drag begins and the 4 px threshold is crossed, `document.body.style.cursor = 'grabbing'` is set exactly as the existing Space+drag handler does.

---

## Shift+Click Multi-Select

### Selection toggle on elements

When the user clicks an element while holding `Shift`:

- If the element is **not** in `selectedIds`: add it (`selectedIds = [...selectedIds, id]`).
- If the element is **already** in `selectedIds`: remove it (`selectedIds = selectedIds.filter(x => x !== id)`).

A plain click on an element (no `Shift`) replaces the entire selection with just that element — the existing behaviour is unchanged.

### Shift+click on canvas background

Shift+click on the canvas background does **not** deselect the current selection. Only a plain click (no Shift) on the background deselects.

### Escape to clear selection

Pressing `Escape` while no element is in edit mode clears the entire selection (`clearSelection()`). If an element is in edit mode (text editing, cell editing, crop/pan), `Escape` exits that mode first — the next `Escape` press clears the selection.

### Canvas store changes

The existing `selectElements(ids: string[])` action already accepts an array. A new `toggleElementSelection` action is added:

```ts
toggleElementSelection(id: string): void
```

Implementation:

```ts
toggleElementSelection: (id) =>
  set((state) => {
    const idx = state.selectedIds.indexOf(id)
    if (idx === -1) {
      state.selectedIds.push(id)
    } else {
      state.selectedIds.splice(idx, 1)
    }
  }),
```

### DesignSurface wiring

Each element's `onSelect` callback in `DesignSurface` receives the originating `React.MouseEvent`. The callback is updated to inspect `e.shiftKey`:

```ts
onSelect={(e) => {
  e.stopPropagation()
  if (e.shiftKey) {
    toggleElementSelection(element.id)
  } else {
    selectElements([element.id])
  }
}}
```

All element components already pass the event object to `onSelect` — no changes to element components are required.

---

## Multi-Element Drag

### Behaviour

When the user initiates a drag on a **selected** element and `selectedIds.length > 1`, all selected elements move together by the same world-space delta:

```
deltaX = (currentMouseX - startMouseX) / zoom
deltaY = (currentMouseY - startMouseY) / zoom

for each id in selectedIds:
  newX = startPositions[id].x + deltaX
  newY = startPositions[id].y + deltaY
```

The delta is divided by `zoom` to convert from screen-space pixels to world-space pixels, matching how single-element drag already works.

### Clamping

With an infinite canvas, element positions are no longer clamped to a fixed surface boundary (this was already removed in spec 13). Multi-element drag has the same absence of clamping — elements may be moved to any world-space coordinate.

### Arrow elements in a multi-selection

Arrow elements follow the same body-drag logic defined in spec 09. When an arrow is part of a multi-element drag:
- Both endpoints shift by the same world-space delta.
- Any `startAnchor` or `endAnchor` connections are broken before the move (the same rule applied during single-arrow body drag in spec 09).

### Implementation

Each element component (TextElement, ImageElement, ArrowElement, TableElement) currently tracks its own `dragStart` in local state and calls `updateElement` once on `mouseup`. For multi-element drag, the element that receives `mousedown` must also update all other selected elements.

The element components expose an `onDragEnd` callback:

```ts
onDragEnd?: (delta: { x: number; y: number }) => void
```

`DesignSurface` wires this callback to apply the delta to all other selected elements:

```ts
onDragEnd={(delta) => {
  selectedIds
    .filter((id) => id !== element.id)
    .forEach((id) => {
      const el = elements.find((e) => e.id === id)
      if (!el) return
      if (el.type === 'arrow') {
        updateElement(id, {
          x1: (el as ArrowElementType).x1 + delta.x,
          y1: (el as ArrowElementType).y1 + delta.y,
          x2: (el as ArrowElementType).x2 + delta.x,
          y2: (el as ArrowElementType).y2 + delta.y,
          startAnchor: undefined,
          endAnchor: undefined,
        })
      } else {
        updateElement(id, { x: el.x + delta.x, y: el.y + delta.y })
      }
    })
}}
```

Each element component calls `onDragEnd` with the committed world-space delta at `mouseup` (after calling its own `updateElement`).

### Visual treatment during multi-element drag

All selected elements show a blue outline while dragging, identical to the single-element selected state. No additional combined bounding-box overlay is drawn.

---

## Contextual Toolbar Behaviour with Multiple Selections

| Selection state | Toolbar |
|---|---|
| Empty | Hidden (existing behaviour) |
| 1 element | Shows controls for that element's type (existing behaviour) |
| 2+ elements, same type | Shows controls for that type; changes apply to all selected elements |
| 2+ elements, mixed types | Hidden |

When a toolbar control changes a property (e.g. font size, stroke colour), the change is applied via `updateElement` to every id in `selectedIds`. Each call is a separate `updateElement` invocation — no new batch action is needed.

---

## State Changes

### Canvas store additions

```ts
toggleElementSelection(id: string): void
```

No other store additions. The existing `clearSelection`, `selectElements`, `setZoom`, and `setPan` are sufficient.

### `DesignSurface` additions

- `onSelect` wiring updated to pass `shiftKey` to `toggleElementSelection` or `selectElements`.
- `onDragEnd` callback added to each element render.

### `Canvas` additions

- `bgPanStartRef`, `isBgPanningRef`, and `suppressClickRef` local refs.
- `handleMouseDown` extended for background left-click drag.
- `handleClick` extended to suppress deselect when `suppressClickRef` is set.
- Keyboard handler extended to call `clearSelection` on `Escape` when no element is in edit mode.

### Element components

Each element component gains an optional `onDragEnd?: (delta: { x: number; y: number }) => void` prop, called at `mouseup` with the committed world-space delta. The delta is only passed when `isDragging` was true (movement ≥ 4 px threshold).

---

## Components

| Component | Location | Change |
|---|---|---|
| `Canvas` | `src/components/editor/Canvas.tsx` | Background drag-to-pan; `Escape` → `clearSelection`; suppress click on drag commit |
| `DesignSurface` | `src/components/editor/DesignSurface.tsx` | `shiftKey` routing in `onSelect`; `onDragEnd` callback wired for multi-element drag |
| `TextElement` | `src/components/editor/elements/TextElement.tsx` | `onDragEnd` prop; fires delta on drag commit |
| `ImageElement` | `src/components/editor/elements/ImageElement.tsx` | `onDragEnd` prop; fires delta on drag commit |
| `ArrowElement` | `src/components/editor/elements/ArrowElement.tsx` | `onDragEnd` prop; fires delta on body drag commit |
| `TableElement` | `src/components/editor/elements/TableElement.tsx` | `onDragEnd` prop; fires delta on drag commit |
| `ContextualToolbar` | `src/components/editor/ContextualToolbar.tsx` | Hides on mixed-type multi-selection; applies property changes to all `selectedIds` |
| `canvasStore` | `src/stores/canvasStore.ts` | Adds `toggleElementSelection` action |

`EditorPage`, `Toolbar`, and all other components require no changes.

---

## Acceptance Criteria

1. Clicking and dragging on the canvas background (no modifier key, no Space held) pans the viewport when the pointer moves 4 px or more before `mouseup`.
2. A background mousedown that does not exceed the 4 px threshold is treated as a plain click and deselects all elements.
3. The `grabbing` cursor is set on `<body>` during a background drag-to-pan and restored on `mouseup`.
4. The `Space`+drag and middle-mouse-drag pan gestures continue to work exactly as before.
5. Scroll-wheel zoom, `Ctrl/Cmd +/-/0`, and header zoom controls are unchanged.
6. Shift+clicking an unselected element adds it to the current selection without replacing it.
7. Shift+clicking an already-selected element removes it from the selection.
8. A plain click on an element replaces the entire selection with just that element.
9. Shift+clicking the canvas background does not change the current selection.
10. All selected elements display the blue bounding-box outline (`2px solid #3B82F6`).
11. `Escape` clears the entire selection when no element is in an edit mode (text edit, table cell edit, image crop).
12. Dragging any selected element moves all selected elements together by the same world-space delta.
13. Arrow elements included in a multi-element drag have their `startAnchor` and `endAnchor` connections cleared before the move.
14. The contextual toolbar is visible when two or more elements of the same type are selected, and hidden when the selection contains mixed element types.
15. A property change made via the contextual toolbar while multiple elements of the same type are selected applies to every element in the selection.
16. After a multi-element drag, all selected elements remain selected (selection is not cleared by the drag).
17. Clicking an element without Shift while a multi-selection is active replaces the selection with only that element.
18. Clicking the canvas background without Shift while a multi-selection is active deselects all elements.
