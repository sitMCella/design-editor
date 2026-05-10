# Feature Spec: Image Element

## Summary

Add an "Image" button to the left toolbar. Clicking it places a new image element at the centre of the design surface. The element renders a placeholder — a neutral grey rectangle with a centred picture icon and a short label — because no image source is configured in this iteration. The image element supports click-to-select and deselect, and follows the same selection highlight pattern as the text element.

## Scope

**In scope**
- "Image" tool button in the left toolbar (below the existing "T" button)
- Clicking the button inserts a placeholder image element at the centre of the design surface
- Placeholder visual: grey background, centred SVG mountain-and-sun icon, "Add image" label beneath the icon
- Click to select (blue outline)
- Deselect when clicking the canvas background
- Multiple image elements can be added independently

**Out of scope (future iterations)**
- Drag to reposition elements
- Image upload (file picker)
- Configuring the image URL / src
- Contextual formatting toolbar for image properties (object-fit, opacity, border)
- Crop or resize handles
- Undo / redo
- Backend persistence

---

## UI Layout

```
┌──────────────────────────────────────────────────────┐
│  Editor Header                                        │
├──────┬───────────────────────────────────────────────┤
│      │                                               │
│  T   │                                               │
│  ⬚   │              Canvas                           │
│      │                                               │
│      │                                               │
└──────┴───────────────────────────────────────────────┘
```

- The new image button sits directly below the existing "T" button in the toolbar.
- The toolbar slot uses the same `56px` width and styling as the existing tool buttons.
- The button renders a small inline SVG picture-frame icon (mountain-and-sun) with `title="Image"` for the tooltip.

---

## Toolbar

### Image tool button

- Icon: a small inline SVG picture-frame icon (mountain peaks inside a rectangle), sized `20 × 20 px`.
- Tooltip on hover: `"Image"`
- On click: sets `activeTool` to `'image'` in the UI store, calls `addImageElement()`, then reverts `activeTool` to `'select'`.

### Active tool state

Same pattern as the text tool: the active button gets a filled blue background while `activeTool === 'image'`. The tool reverts to `'select'` immediately after insertion.

---

## Canvas Behaviour

### Coordinate system

Same as all other elements: positions are in design-surface pixels, origin at the top-left of the `1280 × 720` surface.

### Image element defaults

When the Image button is clicked a new `ImageElement` is added with:

```ts
{
  id: nanoid(),
  type: 'image',
  x: 480,           // horizontally centred: (1280 - 320) / 2
  y: 240,           // vertically centred:   (720  - 240) / 2
  width: 320,
  height: 240,
  rotation: 0,
  opacity: 1,
  locked: false,
  src: '',          // no source yet — placeholder is shown when src is empty
  objectFit: 'cover',
}
```

### Placeholder rendering

When `src` is empty the element renders a styled `<div>` (not an `<img>`) that fills the element's bounding box:

- Background: `#E5E7EB` (Tailwind `gray-200`)
- Centred vertically and horizontally: an SVG mountain-and-sun icon, `48 × 48 px`, stroke colour `#9CA3AF` (Tailwind `gray-400`)
- Below the icon: the text label `"Add image"` in `gray-400`, `14px`

The placeholder is purely visual; it has no interactive behaviour beyond selection.

### Interaction states

| State | How entered | Visual treatment |
|---|---|---|
| **Default** | Element exists, not selected | No outline |
| **Selected** | Single click on element | Blue outline (`2px solid #3B82F6`) |
| **Deselected** | Click on canvas background | No outline |

There is no edit mode for image elements in this iteration.

---

## State

### `ImageElement` type (new)

```ts
type ImageElement = BaseElement & {
  type: 'image'
  src: string                              // empty string = show placeholder
  objectFit: 'fill' | 'contain' | 'cover'
}
```

`CanvasElement` is extended to include `ImageElement`:

```ts
type CanvasElement = TextElement | ImageElement
```

### UI store extension

The `activeTool` union in `UIStore` gains `'image'`:

```ts
activeTool: 'select' | 'text' | 'image'
```

### Canvas store actions used

No new actions are required. The existing `addElement`, `selectElements`, and `clearSelection` are sufficient.

---

## Components

| Component | Location | Responsibility |
|---|---|---|
| `Toolbar` | `src/components/editor/Toolbar.tsx` | Gains the Image button; calls `addElement` with a default `ImageElement` |
| `ImageElement` | `src/components/editor/elements/ImageElement.tsx` | Renders placeholder (or `<img>` when `src` is non-empty in future); handles click-to-select |
| `DesignSurface` | `src/components/editor/DesignSurface.tsx` | Extended to render `<ImageElement>` for elements with `type: 'image'` |

---

## Acceptance Criteria

1. The toolbar displays an image icon button below the "T" button, with tooltip `"Image"`.
2. Clicking the image button inserts an image element at the centre of the design surface (`x: 480, y: 240`).
3. The inserted element displays the placeholder: grey background, picture icon, and `"Add image"` label.
4. Clicking an image element selects it and shows a blue solid outline (`2px solid #3B82F6`).
5. Clicking the canvas background deselects the image element (outline removed).
6. Multiple image elements can be added and each is independent.
7. Refreshing the page removes all image elements (no persistence).
