# Feature Spec: Text Element Customisation

## Summary

Extend the text element with two capabilities: free-form dragging on the canvas using mouse interaction, and a contextual formatting toolbar that appears whenever a text element is selected, allowing the user to change font family, size, weight, style, colour, and alignment.

## Scope

**In scope**
- Drag-to-reposition a selected text element on the canvas
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
- Resize handles
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
│  T   │                  Canvas                                  │
│ bar  │                                                          │
│      │                                                          │
└──────┴──────────────────────────────────────────────────────────┘
```

The contextual toolbar is a full-width strip between the header and the content area. It is hidden (`display: none` equivalent) when no element is selected, so the canvas expands to fill the vacated space without layout shift — use a fixed pixel height (`40px`) and conditionally render it, letting the flex column absorb the change.

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
| Selected (not dragging) | `grab` |
| Dragging | `grabbing` (set on `<body>` during drag to prevent cursor flicker) |
| Editing | `text` |

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
| `TextElement` | `src/components/editor/elements/TextElement.tsx` | Extended with drag logic (`mousedown`, window `mousemove`/`mouseup`) |
| `EditorPage` | `src/pages/EditorPage.tsx` | Adds `<ContextualToolbar />` between header and content area |

No new stores are needed. All formatting changes go through the existing `updateElement` action.

---

## Acceptance Criteria

1. A selected text element can be dragged freely within the design surface bounds.
2. Dragging does not trigger deselection or edit mode.
3. The element cannot be dragged outside the design surface (`1280 × 720`).
4. The contextual toolbar is hidden when no element is selected and visible when one is.
5. Changing the font family updates the text element immediately.
6. Changing the font size (via input or `+`/`−` buttons) updates the element immediately.
7. The Bold button toggles `fontWeight` between `normal` and `bold`; the button appears active when bold is applied.
8. The Italic button toggles `fontStyle` between `normal` and `italic`; the button appears active when italic is applied.
9. The colour picker updates the element's text colour in real time as the user drags the picker.
10. The alignment buttons update `align` and the active button is highlighted.
11. All customisations persist for the lifetime of the session (no backend persistence).
12. Multiple text elements retain their individual formatting independently.
