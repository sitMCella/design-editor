# Feature Spec: Infinite Canvas

## Summary

Replace the fixed `1280 × 720` design surface with an unbounded infinite canvas. Elements are placed anywhere in a two-dimensional world-space coordinate system. The viewport renders whatever region of that space is currently in view, controlled by pan (`panX`, `panY`) and zoom. Keyboard shortcuts, scroll-wheel gestures, and header controls let the user zoom in and out. When a project is loaded the viewport always resets to the default zoom (`1×`) and pan origin (`0, 0`). Thumbnail generation is updated to capture the tight bounding box of all elements on the canvas rather than a fixed surface rectangle.

## Scope

**In scope**
- Remove the fixed `1280 × 720` `DesignSurface` box; elements are placed in infinite world space
- CSS-transform–based viewport: a single `transform: translate(panX px, panY px) scale(zoom)` applied to a "world layer" div
- Scroll-wheel zoom (toward the cursor position); `Ctrl/Cmd + =` / `Ctrl/Cmd + -` zoom toward viewport centre; `Ctrl/Cmd + 0` resets zoom to `1×`
- Zoom range: `0.1×` – `5×` (clamped)
- Zoom controls in the editor header: `−` button, zoom-level readout (e.g. `"100%"`), `+` button
- Pan by dragging the canvas background (middle-mouse or `Space` + `mousedown`)
- `setZoom` and `setPan` canvas-store actions (defined in the state-management spec but not yet implemented)
- On `initDesign` and `loadDesign`: always reset `zoom = 1`, `panX = 0`, `panY = 0`
- Thumbnail generation rewritten: captures the union bounding box of all elements (plus `24 px` padding on each side), scales to fit within `320 × 180 px` preserving aspect ratio
- All element position/size coordinates remain unchanged — they are absolute world-space pixels; no migration required
- Backward compatibility: existing designs load correctly because element positions are world-space values already stored in the database

**Out of scope (future iterations)**
- "Fit to content" automatic zoom on project open
- Grid or ruler overlays
- Minimap / overview panel
- Snap-to-grid
- Pinch-to-zoom on touch devices
- Canvas background colour or texture settings
- Exporting only the element bounding region (export is a separate feature)
- Per-element coordinate locking relative to the viewport

---

## Coordinate System

All element positions (`x`, `y`) remain in **world-space pixels** — the same absolute coordinates used in all prior specs. The coordinate origin `(0, 0)` is at the top-left of the world. Elements may be placed at any finite coordinate value (positive or negative).

The **viewport transform** maps world space to screen space:

```
screenX = worldX * zoom + panX
screenY = worldY * zoom + panY
```

`panX` and `panY` are the pixel offsets (in viewport/screen pixels) of the world origin relative to the top-left of the canvas viewport container. At `zoom = 1`, `panX = 0`, `panY = 0`, world position `(0, 0)` is at the top-left corner of the canvas viewport.

---

## Canvas Viewport

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Editor Header  [− 100% +]                                      │
├─────────────────────────────────────────────────────────────────┤
│  Contextual Toolbar (element selected)                          │
├──────┬──────────────────────────────────────────────────────────┤
│      │                                                          │
│  T   │  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  │
│  ⬚   │  ·  ┌──────────┐  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  │
│  →   │  ·  │ element  │  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  │
│  ⊞   │  ·  └──────────┘  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  │
│      │  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  │
└──────┴──────────────────────────────────────────────────────────┘
```

- The canvas area (right of the toolbar) is an `overflow: hidden` container that fills the remaining editor space.
- The canvas background remains `bg-gray-100`.
- There is no white rectangle frame. The "design surface" is the infinite world space.
- Elements appear as floating objects against the gray background.

### World layer

Inside the canvas container, a single `div` (the "world layer") holds all element components:

```
position: absolute
left: 0; top: 0
transform-origin: 0 0
transform: translate(${panX}px, ${panY}px) scale(${zoom})
```

Element components remain unchanged — they continue to use `position: absolute; left: x; top: y` within this world layer. The world layer has no explicit width or height.

Pointer events on elements are handled the same as today. Pointer events that fall through all elements land on the canvas background, which handles deselection, pan initiation, and zoom.

---

## Zoom

### Controls

| Trigger | Behaviour |
|---|---|
| Scroll wheel (no modifier) | Zoom toward the cursor position (see formula below); step factor `1.1` per wheel tick |
| `Ctrl/Cmd + =` or `Ctrl/Cmd + +` | Zoom in `× 1.25` toward viewport centre |
| `Ctrl/Cmd + -` | Zoom out `÷ 1.25` toward viewport centre |
| `Ctrl/Cmd + 0` | Reset zoom to `1×`; pan to `(0, 0)` |
| Header `+` button | Zoom in `× 1.25` toward viewport centre |
| Header `−` button | Zoom out `÷ 1.25` toward viewport centre |

Zoom is always clamped to `[0.1, 5]`.

### Zoom-toward-point formula

When zooming toward a fixed viewport point `(cx, cy)` (cursor or centre):

```ts
const newZoom = clamp(currentZoom * factor, MIN_ZOOM, MAX_ZOOM)
const newPanX = cx - (cx - panX) * (newZoom / currentZoom)
const newPanY = cy - (cy - panY) * (newZoom / currentZoom)
```

This keeps the world point under `(cx, cy)` stationary as zoom changes.

### Header zoom control

A compact `[− 100% +]` control is added to the right side of the editor header:

- `−` button: decreases zoom by factor `÷ 1.25`; disabled at minimum zoom
- Zoom readout: displays the current zoom as a percentage, e.g. `"100%"`, `"50%"`, `"200%"`. Clicking the readout resets to `1×` (shortcut for `Ctrl/Cmd + 0`)
- `+` button: increases zoom by factor `× 1.25`; disabled at maximum zoom

---

## Pan

### Interaction model

| Trigger | Behaviour |
|---|---|
| `Space` + `mousedown` on canvas background, then drag | Pan mode: drag to translate the viewport |
| Middle mouse button drag | Pan mode |
| Scroll wheel (with `Space` held) | Not applicable — scroll wheel is reserved for zoom |

During pan drag:
- `cursor: grabbing` is set on `<body>` to prevent flicker.
- `mousemove` listener attached to `window`.
- `mouseup` listener attached to `window`; restores cursor and removes listeners.

Pan has no boundary clamp — the user may pan freely.

---

## State changes

### Canvas store additions

Two actions are added to the canvas store (they exist in the state-management spec but are not yet implemented):

```ts
setZoom(zoom: number): void   // clamp to [0.1, 5]
setPan(x: number, y: number): void
```

`initDesign` and `loadDesign` already reset `zoom = 1`, `panX = 0`, `panY = 0` — no changes required there.

`isDirty` is **not** set by `setZoom` or `setPan`. Viewport state is not persisted.

---

## Thumbnail generation

The existing `useThumbnail` hook (introduced in spec 12) captures the fixed `DesignSurface` DOM node at `scale: 0.25`. With an infinite canvas there is no fixed surface, so the capture target and parameters change.

### Element bounding box

A pure utility function computes the union bounding box of all elements:

```ts
// src/utils/elementBBox.ts
export function elementsBBox(elements: CanvasElement[]): {
  x: number; y: number; width: number; height: number
} | null
```

For each element the axis-aligned bounding box is:
- **text / image / table**: `{ x, y, width, height }` directly from the element
- **arrow**: use the derived `{ x, y, width, height }` fields (already kept in sync by `updateElement`)

The union is `min(x)`, `min(y)` for the top-left, `max(x + width)`, `max(y + height)` for the bottom-right.

Returns `null` when `elements` is empty.

### Thumbnail capture procedure

`useThumbnail` is updated as follows:

1. When `isDirty` transitions from `true` to `false` (successful auto-save), compute `elementsBBox(elements)`.
2. If the result is `null` (canvas is empty), skip generation — no thumbnail is uploaded, the existing thumbnail (if any) is preserved.
3. Add `THUMBNAIL_PADDING = 24` px to each side of the bounding box:
   ```
   captureX = bbox.x - THUMBNAIL_PADDING
   captureY = bbox.y - THUMBNAIL_PADDING
   captureW = bbox.width  + THUMBNAIL_PADDING * 2
   captureH = bbox.height + THUMBNAIL_PADDING * 2
   ```
4. Compute the output scale so the result fits within `320 × 180 px`:
   ```
   scale = Math.min(320 / captureW, 180 / captureH)
   ```
5. The world layer div (`worldRef`) is currently transformed by the viewport zoom and pan. Before calling `html2canvas`, record the current transform and temporarily clear it (`transform: none`) so `html2canvas` captures at zoom-1 world coordinates.  
   Restore the transform in a `finally` block.
6. Call:
   ```ts
   html2canvas(worldRef.current, {
     x: captureX,
     y: captureY,
     width: captureW,
     height: captureH,
     scale,
     useCORS: true,
     logging: false,
     backgroundColor: '#F3F4F6', // gray-100, matching the canvas background
   })
   ```
7. Export the result as JPEG at quality `0.7` and upload to `POST /api/projects/:id/thumbnail` as before.
8. Any failure (empty canvas, `html2canvas` error, upload error) is swallowed silently.

The `worldRef` is the ref attached to the world layer div. It is created in `Canvas` (or `EditorPage`) and passed down to the world layer in `DesignSurface`, alongside the existing `surfaceRef` rename.

### `surfaceRef` rename

`surfaceRef` was named for the old fixed surface. It is renamed to `worldRef` throughout (`EditorPage`, `DesignSurface`, `useThumbnail`) to reflect the new semantics. This is a rename-only change with no behavioural impact.

---

## Components

| Component | Location | Change |
|---|---|---|
| `Canvas` | `src/components/editor/Canvas.tsx` | Replaces flex-center layout with `overflow: hidden` absolute container; attaches scroll-wheel zoom handler; attaches `Space`+drag pan handler; reads `zoom`/`panX`/`panY` from store; renders world layer with CSS transform |
| `DesignSurface` | `src/components/editor/DesignSurface.tsx` | Removes fixed `width`/`height` and `boxShadow`; removes `SURFACE_WIDTH` / `SURFACE_HEIGHT` constants (or re-exports them as deprecated for elements that still clamp to their bounds); forwards `worldRef` instead of `surfaceRef` |
| `EditorPage` | `src/pages/EditorPage.tsx` | Adds `worldRef`; wires header zoom control (`−`, readout, `+`); passes `worldRef` to `useThumbnail` |
| `canvasStore` | `src/stores/canvasStore.ts` | Adds `setZoom` and `setPan` actions |
| `useThumbnail` | `src/hooks/useThumbnail.ts` | Accepts `worldRef`; implements bounding-box capture procedure described above |
| `elementsBBox` | `src/utils/elementsBBox.ts` | New pure utility: computes union bounding box of all elements; returns `null` for empty array |

`Toolbar`, `ContextualToolbar`, and all element components (`TextElement`, `ImageElement`, `ArrowElement`, `TableElement`) require no changes.

### `SURFACE_WIDTH` / `SURFACE_HEIGHT` usage audit

These constants are currently exported from `DesignSurface.tsx` and imported by element components to clamp drag and resize operations to the surface bounds. With an infinite canvas the clamp is removed — elements may be placed anywhere. The constants are deleted and all clamp calls in element components are removed.

---

## Design decisions

### CSS transform vs. scroll-based pan

Two approaches were considered for the viewport:

| Approach | Pros | Cons |
|---|---|---|
| CSS `transform` on world layer | Single DOM node to update; zoom and pan in one property; no relayout | Elements outside the viewport still render in the DOM |
| Browser scroll (`overflow: scroll`) + `transform: scale` for zoom | Native scroll performance; browser handles overscan | Scroll-based pan interacts poorly with zoom-toward-cursor; requires a huge scrollable inner div |

**Decision: CSS `transform` on the world layer.** The editor renders a bounded number of elements (not thousands) so full-DOM rendering is not a concern. The transform approach gives complete control over zoom-toward-cursor arithmetic and avoids the scroll/zoom interaction complexity.

### Element coordinate origin

Element positions could be redefined as relative to a "page centre" or "viewport centre" to provide a friendlier initial placement. This was rejected to maintain backward compatibility with all stored designs — no migration of `x`/`y` values is needed.

### Thumbnail: temporary transform removal vs. off-screen clone

Two thumbnail approaches were evaluated:

| Approach | Pros | Cons |
|---|---|---|
| Temporarily remove world-layer transform, call `html2canvas`, restore | No extra DOM nodes; reuses existing element renderers | One frame of transform removal (invisible at 60fps if scheduled correctly with `requestAnimationFrame`) |
| Off-screen clone of world layer | No visual artifact risk | Doubles DOM work; cloned nodes may have stale refs or broken stylesheets |

**Decision: temporarily remove the transform.** The transform clear and restore is wrapped in `requestAnimationFrame` + `setTimeout(0)` to occur within a single paint, making it invisible to the user. The `generating` ref guard in `useThumbnail` prevents re-entrant captures.

---

## File structure changes

```
frontend/
  src/
    components/
      editor/
        Canvas.tsx            (rewritten — zoom/pan transform, event handlers)
        DesignSurface.tsx     (updated — removes fixed dimensions, worldRef)
    hooks/
      useThumbnail.ts         (updated — bounding-box capture, worldRef)
    stores/
      canvasStore.ts          (updated — setZoom, setPan actions)
    utils/
      elementsBBox.ts         (new — union bounding box utility)
    pages/
      EditorPage.tsx          (updated — worldRef, header zoom control)
```

---

## Acceptance Criteria

1. The fixed `1280 × 720` white rectangle is no longer rendered; the canvas area shows only the gray background and floating elements.
2. Scrolling the mouse wheel over the canvas zooms in or out, keeping the world point under the cursor stationary.
3. `Ctrl/Cmd + =` zooms in and `Ctrl/Cmd + -` zooms out, both toward the viewport centre.
4. `Ctrl/Cmd + 0` resets the viewport to `zoom = 1`, `panX = 0`, `panY = 0`.
5. The editor header displays `[− {N}% +]` controls that zoom in and out by `× 1.25`/`÷ 1.25`; clicking the percentage readout resets to `1×`.
6. Zoom is clamped to the range `[10%, 500%]`; the `+` button is disabled at the maximum and the `−` button at the minimum.
7. Holding `Space` and dragging the canvas background pans the viewport freely; middle-mouse drag also pans.
8. Pan has no boundary — the user can pan to any part of the infinite world.
9. Opening a new design or loading an existing project always resets the viewport to `zoom = 1`, `panX = 0`, `panY = 0`.
10. Elements added via toolbar buttons appear near world position `(0, 0)` (using the same default `x`/`y` values defined in each element spec).
11. Existing designs loaded from the database render all elements at their stored world-space coordinates without modification.
12. Dragging and resizing elements works correctly at any zoom level — the element's world-space coordinates update by the correct delta regardless of the current zoom.
13. `SURFACE_WIDTH`/`SURFACE_HEIGHT` drag/resize clamps are removed; elements can be positioned and resized freely across the infinite canvas.
14. After an auto-save on a canvas with at least one element, a thumbnail is generated and uploaded within 5 seconds.
15. The thumbnail captures the union bounding box of all elements plus `24 px` padding on each side.
16. The thumbnail is sized to fit within `320 × 180 px`, preserving the bounding-box aspect ratio.
17. When the canvas is empty (no elements), no thumbnail upload is attempted; the existing thumbnail (if any) is preserved.
18. The thumbnail is visually accurate regardless of the current viewport zoom or pan at the time of the auto-save.
19. Thumbnail generation does not produce any visible flicker or disruption in the editor.
20. All existing element interactions (select, drag, resize, edit, contextual toolbar) continue to work correctly on the infinite canvas.
