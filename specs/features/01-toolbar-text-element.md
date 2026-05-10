# Feature Spec: Toolbar & Text Element

## Summary

Display a vertical toolbar on the left side of the editor. The toolbar contains a button that places a new editable text element onto the canvas. The canvas occupies the remaining page area. Text element state is local only — no backend persistence in this iteration.

## Scope

**In scope**
- Left-side toolbar rendered on the editor page
- "Text" tool button that inserts a default text element at the centre of the canvas
- Click to select a text element
- Double-click to enter inline edit mode
- Blur to exit edit mode
- Basic selection highlight (outline) on selected element
- Deselect when clicking the canvas background

**Out of scope (future iterations)**
- Persisting text elements to the backend
- Undo / redo
- Drag to reposition elements
- Resize handles
- Font, size, colour controls
- Multiple element types (shapes, images)

---

## UI Layout

```
┌──────────────────────────────────────────────────────┐
│  Editor Header                                        │
├──────┬───────────────────────────────────────────────┤
│      │                                               │
│  T   │                                               │
│ bar  │              Canvas                           │
│      │                                               │
│      │                                               │
└──────┴───────────────────────────────────────────────┘
```

- The toolbar is a fixed-width (`56px`) vertical strip flush to the left edge, full height of the content area below the header.
- The canvas fills the remaining width and full height.
- The canvas background is a neutral grey (`bg-gray-100`); the design surface (white, fixed dimensions `1280 × 720px`) is centred inside it and may be scrolled/panned when it overflows.

---

## Toolbar

### Text tool button

- Icon: a bold letter **T**
- Tooltip on hover: `"Text"`
- On click: sets `activeTool` to `'text'` in the UI store and calls `addTextElement()` on the canvas store, which inserts a new text element at the centre of the design surface.

### Active tool state

The toolbar reads `activeTool` from the UI store. The active tool button is visually distinguished (filled background). After inserting a text element the tool reverts to `'select'`.

---

## Canvas Behaviour

### Coordinate system

All element positions (`x`, `y`) are in design-surface pixels (origin at top-left of the `1280 × 720` surface), independent of zoom.

### Text element defaults

When the Text button is clicked, a new `TextElement` is added with:

```ts
{
  id: nanoid(),
  type: 'text',
  x: 560,           // horizontally centred on 1280px surface
  y: 320,           // vertically centred on 720px surface
  width: 160,
  height: 40,
  rotation: 0,
  opacity: 1,
  locked: false,
  content: 'Double-click to edit',
  fontSize: 16,
  fontFamily: 'Inter, sans-serif',
  fontWeight: 'normal',
  color: '#111827',
  align: 'left',
}
```

### Interaction states

| State | How entered | Visual treatment |
|---|---|---|
| **Default** | Element exists, not selected | No outline |
| **Selected** | Single click on element | Blue outline (`2px solid #3B82F6`) |
| **Editing** | Double-click on selected element | Outline becomes dashed; `contentEditable` div is focused |
| **Deselected** | Click on canvas background | No outline |

### Editing behaviour

- On enter edit mode: a `contentEditable` `<div>` is rendered in place of the static text display. The element's `content` in the store is updated on every `input` event (controlled via `onInput`).
- On exit edit mode (blur): editing mode ends, the element returns to Selected state. If `content` is empty after trimming, the element is removed from the canvas.
- Pressing `Escape` while editing exits edit mode without reverting content.

---

## State

This feature uses the canvas store (Zustand + Immer) and the UI store defined in the state-management spec. No new stores are introduced.

### Canvas store additions used

```ts
addElement(element: CanvasElement): void
updateElement(id: string, patch: Partial<CanvasElement>): void
removeElements(ids: string[]): void
selectElements(ids: string[]): void
clearSelection(): void
```

### UI store additions used

```ts
activeTool: 'select' | 'text'
```

---

## Components

| Component | Location | Responsibility |
|---|---|---|
| `EditorPage` | `src/pages/EditorPage.tsx` | Top-level layout: toolbar + canvas side by side |
| `Toolbar` | `src/components/editor/Toolbar.tsx` | Renders tool buttons, reads/writes `activeTool` |
| `Canvas` | `src/components/editor/Canvas.tsx` | Renders the grey viewport, centres the design surface, handles background click to deselect |
| `DesignSurface` | `src/components/editor/DesignSurface.tsx` | The white `1280 × 720` area; maps over `elements` and renders each one |
| `TextElement` | `src/components/editor/elements/TextElement.tsx` | Renders a single text element in default, selected, or editing state |

---

## Acceptance Criteria

1. The toolbar is visible on the left side of the editor page with a "T" button.
2. Clicking the "T" button adds a text element at the centre of the design surface.
3. Clicking a text element selects it and shows a blue outline.
4. Double-clicking a selected text element enters edit mode and focuses the editable area.
5. Typing in edit mode updates the visible text in real time.
6. Clicking outside the text element (on the canvas background) deselects it.
7. Blurring the editable area exits edit mode and retains the updated content.
8. Deleting all text content and blurring removes the element from the canvas.
9. Multiple text elements can be added independently.
10. Refreshing the page clears all elements (no persistence).
