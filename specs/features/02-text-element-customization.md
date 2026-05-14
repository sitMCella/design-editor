# Feature Spec: Text Element Customisation

## Summary

Extend the text element with three capabilities: free-form dragging on the canvas using mouse interaction, corner resize handles to change its dimensions, and a contextual formatting toolbar that appears whenever a text element is selected, allowing the user to change font family, size, weight, style, colour, and alignment.

## Scope

**In scope**
- Drag-to-reposition a selected text element on the canvas
- Four corner resize handles that appear on a selected text element
- Contextual toolbar rendered between the editor header and the canvas when a text element is selected
- Font family picker (curated list of system fonts)
- Font size input (numeric, with increment/decrement buttons)
- Bold toggle
- Italic toggle
- Text colour picker (native `<input type="color">`)
- Text alignment (left, centre, right)
- All changes update the canvas store immediately (local only — no backend persistence)

**Out of scope (future iterations)**
- Google Fonts or custom font loading
- Rotation handles
- Multi-element selection and bulk formatting
- Undo / redo
- Keyboard nudging of position (arrow keys)
- Drag-to-reorder z-index

---

## UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Editor Header                                                   │
├─────────────────────────────────────────────────────────────────┤
│  Contextual Toolbar (visible only when an element is selected)  │
│  [Font family ▾] [14 - +] [B] [I] [■ colour] [≡ ≡≡ ≡]         │
├──────┬──────────────────────────────────────────────────────────┤
│      │                                                          │
│  T   │   ◆──────────────────◆  ← corner handles (selected)    │
│ bar  │   │   text element   │                                  │
│      │   ◆──────────────────◆                                  │
│      │                                                          │
└──────┴──────────────────────────────────────────────────────────┘
```

The contextual toolbar is a full-width strip between the header and the content area. It is hidden (`display: none` equivalent) when no element is selected, so the canvas expands to fill the vacated space without layout shift — use a fixed pixel height (`40px`) and conditionally render it, letting the flex column absorb the change.

Corner handles are `10 × 10 px` squares with a blue fill (`#3B82F6`), positioned at the four outer corners of the element's bounding box. They appear only in **Selected** state, not in editing mode.

---

## Dragging

### Interaction model

Dragging is initiated with `mousedown` on a text element that is already in **Selected** state. If the element is not yet selected, `mousedown` selects it and a subsequent drag (on the next mousedown) moves it.

| Event sequence | Outcome |
|---|---|
| `mousedown` → `mouseup` (no movement) | Select element (handled by existing click logic) |
| `mousedown` → mouse moves ≥ 4px → `mouseup` | Move element to new position |
| `mousedown` → `mouseup` → `dblclick` | Enter edit mode (existing behaviour) |

The 4px movement threshold prevents accidental drags during clicks.

### Implementation

- On `mousedown` on a **selected** element: record `dragStart = { mouseX, mouseY, elementX, elementY }` in local component state.
- Attach `mousemove` and `mouseup` listeners to `window` (not the element) so dragging works even if the cursor leaves the element bounds.
- On `mousemove`: if displacement ≥ 4px, set `isDragging = true` and update element position:
  ```
  newX = dragStart.elementX + (currentMouseX - dragStart.mouseX)
  newY = dragStart.elementY + (currentMouseY - dragStart.mouseY)
  ```
  Clamp `newX` and `newY` so the element cannot be dragged outside the design surface bounds (`0 ≤ x ≤ SURFACE_WIDTH - element.width`, `0 ≤ y ≤ SURFACE_HEIGHT - element.height`).
- On `mouseup`: if `isDragging`, call `updateElement` with the final position and clear drag state. Suppress the subsequent `click` event to avoid deselecting.
- Remove window listeners on `mouseup` and on component unmount.

### Cursor

| Element state | Cursor |
|---|---|
| Default (not selected) | `default` |
| Selected (not dragging, not resizing) | `grab` |
| Dragging | `grabbing` (set on `<body>` during drag to prevent cursor flicker) |
| Editing | `text` |

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

Handles are hidden in editing mode to avoid interference with text selection.

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
  - Minimum element size: `40 × 20 px`
  - Element must not extend outside the design surface (`0 ≤ x`, `x + width ≤ SURFACE_WIDTH`, same for y)
- On `mouseup`: call `updateElement` with final geometry; clear resize state.
- Remove window listeners on `mouseup` and on component unmount.

Text wrapping naturally reflows as `width` changes because the element renders with `word-wrap: break-word`. The `height` is not auto-calculated from content — the user controls it via the resize handle.

---

## Contextual Toolbar

The toolbar is rendered at the `EditorPage` level, above the canvas area, and is conditionally visible based on whether `selectedIds` in the canvas store is non-empty. It reads the first selected element to populate its controls.

### Controls

#### Font family

A `<select>` dropdown. Changing the value calls `updateElement(id, { fontFamily })`.

Available options:

| Label | Value |
|---|---|
| Inter | `'Inter, sans-serif'` |
| Arial | `'Arial, sans-serif'` |
| Georgia | `'Georgia, serif'` |
| Times New Roman | `'Times New Roman, serif'` |
| Courier New | `'Courier New, monospace'` |
| Verdana | `'Verdana, sans-serif'` |

#### Font size

A numeric input flanked by `−` and `+` buttons. Min: `8`, Max: `200`, step: `1`.  
Changing the value calls `updateElement(id, { fontSize: Number(value) })`.

#### Bold

A toggle button displaying **B**. Active state when `fontWeight === 'bold'`.  
On toggle: `updateElement(id, { fontWeight: isBold ? 'normal' : 'bold' })`.

#### Italic

A toggle button displaying *I* (italic styled). Active state when `fontStyle === 'italic'`.  
On toggle: `updateElement(id, { fontStyle: isBold ? 'normal' : 'italic' })`.

#### Colour

A native `<input type="color">` with a coloured square trigger. The input value is the element's `color` property (hex string).  
On change: `updateElement(id, { color: e.target.value })`.

#### Alignment

Three icon buttons: align-left (`≡`), align-centre (`≡≡`), align-right (`≡`). Active button reflects `element.align`.  
On click: `updateElement(id, { align: 'left' | 'center' | 'right' })`.

---

## State changes

### `TextElement` type extension

Add `fontStyle` to the existing `TextElement` type (the `fontWeight` field already exists):

```ts
type TextElement = BaseElement & {
  type: 'text'
  content: string
  fontSize: number
  fontFamily: string
  fontWeight: 'normal' | 'bold'
  fontStyle: 'normal' | 'italic'   // NEW
  color: string
  align: 'left' | 'center' | 'right'
}
```

Update the default element created by the Toolbar to include `fontStyle: 'normal'`.

---

## Components

| Component | Location | Responsibility |
|---|---|---|
| `ContextualToolbar` | `src/components/editor/ContextualToolbar.tsx` | Reads selected element from store; renders all formatting controls |
| `TextElement` | `src/components/editor/elements/TextElement.tsx` | Extended with drag logic, corner resize handles, and editing mode; handles `mousedown` on body and handles, with window `mousemove`/`mouseup` listeners |
| `EditorPage` | `src/pages/EditorPage.tsx` | Adds `<ContextualToolbar />` between header and content area |

No new stores are needed. All formatting changes go through the existing `updateElement` action.

---

## Acceptance Criteria

1. A selected text element can be dragged freely within the design surface bounds.
2. Dragging does not trigger deselection or edit mode.
3. The element cannot be dragged outside the design surface (`1280 × 720`).
4. A selected text element shows resize handles at its four corners; the handles are hidden in editing mode.
5. Dragging a corner handle resizes the element; minimum size is `40 × 20 px` and the element cannot extend outside the design surface.
6. Text content reflows naturally as the element width is resized.
7. The contextual toolbar is hidden when no element is selected and visible when one is.
8. Changing the font family updates the text element immediately.
9. Changing the font size (via input or `+`/`−` buttons) updates the element immediately.
10. The Bold button toggles `fontWeight` between `normal` and `bold`; the button appears active when bold is applied.
11. The Italic button toggles `fontStyle` between `normal` and `italic`; the button appears active when italic is applied.
12. The colour picker updates the element's text colour in real time as the user drags the picker.
13. The alignment buttons update `align` and the active button is highlighted.
14. All customisations persist for the lifetime of the session (no backend persistence).
15. Multiple text elements retain their individual formatting and dimensions independently.
