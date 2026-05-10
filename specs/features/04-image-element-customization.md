# Feature Spec: Image Element Customisation

## Summary

Extend the image element with four capabilities: free-form dragging to reposition it on the canvas, resize handles at the corners to change its dimensions, a contextual toolbar for configuring the image source (URL input and local file upload) and object-fit, and a crop/pan mode that lets the user reposition the image content within the element's fixed frame.

## Scope

**In scope**
- Drag-to-reposition a selected image element on the canvas
- Four corner resize handles that appear on a selected element
- Contextual toolbar visible when an image element is selected, with:
  - URL input field (Enter or blur to confirm)
  - "Upload" button that opens a file picker (local file → data URL)
  - Object-fit selector (`fill`, `contain`, `cover`)
- Crop/pan mode: double-click enters mode where the image can be panned within its frame; Escape or click outside exits
- All changes local only — no backend persistence

**Out of scope (future iterations)**
- Edge (non-corner) resize handles
- Proportional / aspect-ratio-locked resize
- Rotation handles
- Image opacity control (already on `BaseElement` but not exposed in the UI)
- Multi-element selection
- Undo / redo
- Drag-and-drop file from the OS onto the canvas (file picker only)
- Cloud/stock image picker
- Advanced crop (arbitrary region selection, non-rectangular masks)

---

## UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Editor Header                                                   │
├─────────────────────────────────────────────────────────────────┤
│  Contextual Toolbar (image element selected)                    │
│  [ 🔗 https://… ▏Enter ] [ ⬆ Upload ] [ Fit ▾ ]               │
├──────┬──────────────────────────────────────────────────────────┤
│      │                                                          │
│  T   │   ┌────────────────┐                                    │
│  ⬚   │   │  ◆           ◆ │  ← corner handles (selected)      │
│      │   │    image area   │                                    │
│      │   │  ◆           ◆ │                                    │
│      │   └────────────────┘                                    │
└──────┴──────────────────────────────────────────────────────────┘
```

- The contextual toolbar replaces the text-element toolbar when an image is selected. Only one toolbar is shown at a time based on the `type` of the selected element.
- Corner handles are `10 × 10 px` squares with a blue fill (`#3B82F6`), positioned at the four outer corners of the element's bounding box. They appear only in **Selected** state, not in crop/pan mode.
- The contextual toolbar row height matches the text toolbar (`40px`) so the layout does not shift when switching between element types.

---

## Dragging

### Interaction model

Identical to the text element drag defined in `02-text-element-customization.md`:

| Event sequence | Outcome |
|---|---|
| `mousedown` → `mouseup` (no movement) | Select element (handled by existing click logic) |
| `mousedown` → mouse moves ≥ 4px → `mouseup` | Move element to new position |

The 4px movement threshold prevents accidental drags during clicks.

### Implementation

- On `mousedown` on a **selected** element (not in crop/pan mode): record `dragStart = { mouseX, mouseY, elementX, elementY }`.
- Attach `mousemove` and `mouseup` listeners to `window`.
- On `mousemove`: if displacement ≥ 4px, compute new position and clamp:
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
| Selected (not dragging, not resizing, not in crop mode) | `grab` |
| Dragging | `grabbing` (set on `<body>`) |
| Crop/pan mode | `move` |

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

Each handle uses `cursor: nwse-resize` (corners) or `cursor: nesw-resize` for the opposite-diagonal pair.

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
- On `mousemove`: compute delta from `resizeStart`, apply to the appropriate dimensions. Enforce:
  - Minimum element size: `40 × 40 px`
  - Element must not extend outside the design surface (`0 ≤ x`, `x + width ≤ SURFACE_WIDTH`, same for y)
- On `mouseup`: call `updateElement` with final geometry; clear resize state.

---

## Contextual Toolbar

The existing `ContextualToolbar` component is extended: it already renders when a text element is selected. When an image element is selected it renders a different set of controls (image controls, not text controls) in the same `40px` strip.

### Controls (image element)

#### Source URL input

- A text `<input>` with placeholder `"Paste image URL…"` and a link icon prefix.
- The input value is pre-populated with the element's current `src` (empty string if no source).
- On `keydown` Enter or `blur`: trim the value and call `updateElement(id, { src: trimmedValue })`.
- If `src` is a `data:` URL (uploaded file), the input is read-only and shows `"Uploaded file"` as the value.

#### Upload button

- A button labelled "Upload" (with an upload icon).
- On click: programmatically clicks a hidden `<input type="file" accept="image/*">`.
- On file selection: read the selected `File` using `FileReader.readAsDataURL`; on `load`, call `updateElement(id, { src: dataURL })`.

#### Object-fit selector

- A `<select>` with three options: `Fill` (`fill`), `Contain` (`contain`), `Cover` (`cover`).
- Default value matches `element.objectFit`.
- On change: call `updateElement(id, { objectFit: value })`.

---

## Crop / Pan Mode

### Entry and exit

| Action | Result |
|---|---|
| Double-click a **selected** image element (not in crop mode) | Enters crop/pan mode |
| Press `Escape` while in crop/pan mode | Exits crop/pan mode |
| Click outside the element (canvas background) | Exits crop/pan mode and deselects |

While in crop/pan mode:
- The element's outer wrapper shows a **dashed** blue outline (`2px dashed #3B82F6`), matching the text element's edit-mode style.
- The corner resize handles are hidden.
- The image inside the frame can be panned by dragging.

### Panning implementation

Panning shifts the CSS `object-position` of the rendered `<img>`. The starting value is the element's current `objectPosition` (default `"50% 50%"`).

- On `mousedown` inside the element in crop/pan mode: record `panStart = { mouseX, mouseY, posX, posY }` where `posX`/`posY` are the current percentage offsets.
- On `mousemove`: convert pixel delta to a percentage of the element dimensions and add to the starting position. Clamp to `[0%, 100%]` in each axis.
- On `mouseup`: call `updateElement(id, { objectPosition })` with the final value.

### Visual

When `src` is non-empty, the element renders:
```html
<img
  src={element.src}
  style="object-fit: {element.objectFit}; object-position: {element.objectPosition}"
/>
```

When `src` is empty the placeholder is shown regardless of mode.

---

## State changes

### `ImageElement` type extension

Two new optional fields are added:

```ts
type ImageElement = BaseElement & {
  type: 'image'
  src: string
  objectFit: 'fill' | 'contain' | 'cover'
  objectPosition: string   // NEW — CSS value, default "50% 50%"
}
```

The Toolbar default element is updated to include `objectPosition: '50% 50%'`.

---

## Components

| Component | Location | Responsibility |
|---|---|---|
| `ImageElement` | `src/components/editor/elements/ImageElement.tsx` | Extended with drag logic, resize handles, crop/pan mode, `objectPosition` rendering |
| `ContextualToolbar` | `src/components/editor/ContextualToolbar.tsx` | Extended to render image controls (URL input, Upload button, object-fit selector) when an image element is selected |
| `Toolbar` | `src/components/editor/Toolbar.tsx` | Updated to include `objectPosition: '50% 50%'` in default `ImageElement` |

No new stores are needed. All changes go through the existing `updateElement` action.

---

## Acceptance Criteria

1. A selected image element can be dragged freely within the design surface bounds without triggering deselection.
2. The element cannot be dragged outside the design surface (`1280 × 720`).
3. A selected image element shows resize handles at its four corners.
4. Dragging a corner handle resizes the element; minimum size is `40 × 40 px` and the element cannot extend outside the design surface.
5. The contextual toolbar shows image controls (URL input, Upload button, object-fit selector) when an image element is selected, and hides when nothing is selected.
6. Entering a URL in the source input and pressing Enter or blurring updates the image `src` immediately.
7. Clicking Upload and selecting a local image file displays it inside the element (as a data URL).
8. Changing the object-fit selector updates how the image fills its frame immediately.
9. Double-clicking a selected image element enters crop/pan mode (dashed outline, resize handles hidden).
10. In crop/pan mode, dragging the image repositions it within the frame (changes `objectPosition`).
11. Pressing Escape exits crop/pan mode; clicking outside exits crop/pan mode and deselects the element.
12. All customisations persist for the lifetime of the session (no backend persistence).
