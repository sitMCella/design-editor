# Feature Spec: Canvas Background Colour

## Summary

Allow the user to change the background colour of the infinite canvas from the default grey (`#F3F4F6`) to any solid colour, including transparent (checkerboard pattern in the editor, transparent PNG export). A "Background" button in the editor header opens a compact colour-picker popover with a palette of presets and a native `<input type="color">` for custom values. The selected colour is stored in the canvas store, persisted via the existing auto-save pipeline, and applied consistently across the editor viewport, thumbnail generation, and PNG/PDF exports.

## Scope

**In scope**
- A "Background" button in the editor header (left of the zoom control) that opens a popover colour picker
- A palette of 12 preset colours including white, black, transparent, and common design colours
- A native `<input type="color">` for arbitrary custom colours
- A "Transparent" swatch that represents a fully transparent background
- The selected colour fills the visible canvas viewport area in the editor (replacing the hard-coded `bg-gray-100`)
- A checkerboard pattern is shown in the editor when the background is transparent, so elements remain visible against the editor chrome
- `backgroundColor` field added to `CanvasStore` (default `'#F3F4F6'`, the existing grey)
- The background colour is applied as the `backgroundColor` option in `html2canvas` calls for thumbnail generation (`useThumbnail`) and both export utilities (`downloadPng`, `downloadPdf`)
- Transparent background in PNG export produces a PNG with an alpha channel (no fill colour passed to `html2canvas`); the checkerboard is never exported
- Transparent background in PDF export falls back to white (PDFs do not support page-level transparency)
- `backgroundColor` is included in the canvas JSONB persisted by `PATCH /api/projects/:id`; reloading restores the saved colour
- `initDesign` sets `backgroundColor` to `'#F3F4F6'`; `loadDesign` restores the saved value

**Out of scope (future iterations)**
- Gradient or image backgrounds
- Pattern fills (stripes, dots, grids)
- Per-element background vs. canvas-wide background distinction
- Background colour in the project card thumbnail placeholder area
- Opacity slider (transparent is a discrete swatch, not a slider)
- Removing or resetting to "default" via a dedicated reset button (the user can re-select the grey preset)

---

## UI Layout

### Editor header

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  [✕]  My Design Name    Unsaved   [⬛ Background]  [− 100% +]  [↓ PDF] [↓ PNG] │
└──────────────────────────────────────────────────────────────────────────────┘
```

- The "Background" button sits to the left of the zoom control (`[− 100% +]`).
- The button shows a small `14 × 14 px` filled colour swatch (rounded, `rounded-sm`) reflecting the current `backgroundColor`, followed by the label `"Background"`.
- When `backgroundColor` is `'transparent'` the swatch renders a `4 × 4 px` checkerboard instead of a solid colour.
- Idle style: same as the download buttons — `text-gray-700`, `border border-gray-200`, `bg-white`, rounded.
- Hover style: `bg-gray-50`.
- Active (popover open): `bg-gray-100 border-gray-300`.

### Colour-picker popover

The popover opens directly below the button, left-aligned:

```
┌──────────────────────────────────┐
│  Canvas background               │
│                                  │
│  ○ ○ ○ ○ ○ ○   ← row 1 swatches │
│  ○ ○ ○ ○ ○ ○   ← row 2 swatches │
│  ○  Transparent                  │
│  ──────────────────────────────  │
│  Custom  [████████] (colour inp) │
└──────────────────────────────────┘
```

- The popover is `240px` wide, `auto` height, white background, `rounded-lg shadow-lg border border-gray-200`.
- A `"Canvas background"` heading (`12px`, `font-medium`, `text-gray-500`, uppercase tracking) at the top.
- Two rows of six preset swatches each (`24 × 24 px`, `rounded-full`, `border border-gray-200` for light colours).
- The active swatch has a `2px solid #3B82F6` ring (using `ring-2 ring-blue-500 ring-offset-1`).
- A `"Transparent"` row: a `24 × 24 px` checkerboard swatch + the label `"Transparent"` in `text-gray-700 text-sm`.
- A `1px` horizontal divider.
- A `"Custom"` row: the label followed by an `<input type="color">` styled as a `24 × 24 px` block; clicking the block opens the native colour picker.
- Clicking anywhere outside the popover closes it without reverting the colour (changes are immediate on selection).
- Pressing `Escape` closes the popover.

### Preset palette

| Label | Hex |
|---|---|
| Grey (default) | `#F3F4F6` |
| White | `#FFFFFF` |
| Light grey | `#E5E7EB` |
| Slate | `#64748B` |
| Black | `#111827` |
| Sky blue | `#BAE6FD` |
| Blue | `#BFDBFE` |
| Indigo | `#C7D2FE` |
| Lavender | `#E9D5FF` |
| Rose | `#FECDD3` |
| Amber | `#FDE68A` |
| Emerald | `#A7F3D0` |

Transparent is represented in the store as the string `'transparent'` and rendered separately from the swatch grid.

---

## Canvas Viewport Behaviour

### Background rendering

The canvas container (`Canvas.tsx`) currently applies `bg-gray-100` as a Tailwind class. This class is replaced with an inline `style` or a dynamic class driven by `backgroundColor` from the canvas store:

- When `backgroundColor` is a hex string: apply it as `backgroundColor` CSS on the canvas container div.
- When `backgroundColor` is `'transparent'`: apply a CSS checkerboard pattern on the canvas container div using a repeating-linear-gradient background (the checkerboard is cosmetic — it is never exported):

```css
background-image:
  repeating-linear-gradient(45deg, #d1d5db 25%, transparent 25%),
  repeating-linear-gradient(-45deg, #d1d5db 25%, transparent 25%),
  repeating-linear-gradient(45deg, transparent 75%, #d1d5db 75%),
  repeating-linear-gradient(-45deg, transparent 75%, #d1d5db 75%);
background-size: 16px 16px;
background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
background-color: #ffffff;
```

The checkerboard uses Tailwind `gray-300` (`#D1D5DB`) on white, which is conventionally understood as "transparent" in design tools.

### World layer

The world layer div that holds all element components has no background — the canvas container background shows through. No changes to the world layer are needed.

---

## Export Behaviour

### `useThumbnail` (spec 12 / 13)

The `backgroundColor` option passed to `html2canvas` is updated:

```ts
backgroundColor: canvasStore.backgroundColor === 'transparent'
  ? '#F3F4F6'  // thumbnail always has a visible background for the project card
  : canvasStore.backgroundColor,
```

Thumbnails always use a solid background so the project card never shows a transparent (white) thumbnail that looks broken.

### `downloadPng` (spec 18)

```ts
backgroundColor: elements.backgroundColor === 'transparent'
  ? null        // null tells html2canvas to preserve alpha channel
  : elements.backgroundColor,
```

Passing `null` to `html2canvas`'s `backgroundColor` option preserves the alpha channel, producing a PNG with true transparency. The exported file can then be composited on any background by the user.

### `downloadPdf` (spec 19)

```ts
backgroundColor: elements.backgroundColor === 'transparent'
  ? '#FFFFFF'   // PDF pages cannot be transparent; fall back to white
  : elements.backgroundColor,
```

A PDF export with a transparent canvas background silently uses white. No warning or notification is shown for this fallback — the behaviour is consistent with industry norms (Figma, Canva).

---

## State Changes

### `CanvasStore` extension

```ts
type CanvasStore = {
  // ... existing fields ...
  backgroundColor: string   // NEW — hex colour string or 'transparent'; default '#F3F4F6'
}
```

New action:

```ts
setBackgroundColor(color: string): void
```

Implementation:

```ts
setBackgroundColor: (color) =>
  set((state) => {
    state.backgroundColor = color
    state.isDirty = true
  }),
```

### `initDesign` update

```ts
initDesign: (id, name) =>
  set((state) => {
    state.designId = id
    state.name = name
    state.elements = []
    state.selectedIds = []
    state.zoom = 1
    state.panX = 0
    state.panY = 0
    state.isDirty = false
    state.backgroundColor = '#F3F4F6'   // NEW
  }),
```

### `loadDesign` update

```ts
loadDesign: (id, name, elements, backgroundColor) =>
  set((state) => {
    state.designId = id
    state.name = name
    state.elements = elements
    state.selectedIds = []
    state.zoom = 1
    state.panX = 0
    state.panY = 0
    state.isDirty = false
    state.backgroundColor = backgroundColor ?? '#F3F4F6'   // NEW — fallback for old designs
  }),
```

The `loadDesign` signature gains a fourth optional parameter `backgroundColor?: string`. The `??` fallback handles designs saved before this feature shipped (where `backgroundColor` is absent from the stored JSON).

### Backend persistence

`backgroundColor` is stored verbatim inside the `canvas` JSONB column alongside `elements`. No schema migration is required. The existing `PATCH /api/projects/:id` auto-save pipeline persists it automatically.

The `GET /api/projects/:id` response already returns the full `canvas` JSONB, so `loadDesign` receives `backgroundColor` from the parsed `canvas.backgroundColor` field.

---

## Components

| Component | Location | Change |
|---|---|---|
| `Canvas` | `src/components/editor/Canvas.tsx` | Reads `backgroundColor` from canvas store; applies it (or the checkerboard) as an inline style on the container div instead of the hard-coded `bg-gray-100` class |
| `BackgroundPicker` | `src/components/editor/BackgroundPicker.tsx` | New — renders the popover with preset swatches, transparent swatch, and custom colour input; calls `setBackgroundColor` on selection |
| `EditorPage` | `src/pages/EditorPage.tsx` | Adds the `"Background"` button to the header; manages popover open/close state with `useState<boolean>` |
| `canvasStore` | `src/stores/canvasStore.ts` | Adds `backgroundColor` field and `setBackgroundColor` action; updates `initDesign` and `loadDesign` |
| `useThumbnail` | `src/hooks/useThumbnail.ts` | Passes `backgroundColor` (with transparent fallback to `'#F3F4F6'`) to `html2canvas` |
| `downloadPng` | `src/utils/downloadPng.ts` | Accepts `backgroundColor` param; passes `null` for `'transparent'`, hex otherwise |
| `downloadPdf` | `src/utils/downloadPdf.ts` | Accepts `backgroundColor` param; passes `'#FFFFFF'` for `'transparent'`, hex otherwise |

`Toolbar`, `DesignSurface`, `ContextualToolbar`, and all element components require no changes.

---

## File Structure Additions

```
frontend/
  src/
    components/
      editor/
        BackgroundPicker.tsx   (new — popover with preset swatches and custom input)
        Canvas.tsx             (updated — dynamic background colour / checkerboard)
    hooks/
      useThumbnail.ts          (updated — passes backgroundColor to html2canvas)
    stores/
      canvasStore.ts           (updated — backgroundColor field, setBackgroundColor, initDesign, loadDesign)
    utils/
      downloadPng.ts           (updated — accepts and passes backgroundColor)
      downloadPdf.ts           (updated — accepts and passes backgroundColor with white fallback)
    pages/
      EditorPage.tsx           (updated — Background button, popover open state)
```

---

## Acceptance Criteria

1. The editor header displays a "Background" button with a colour swatch to the left of the zoom control, always visible while a design is open.
2. The colour swatch in the button reflects the current `backgroundColor` at all times.
3. Clicking the "Background" button opens the colour-picker popover; clicking it again or pressing `Escape` closes the popover.
4. Clicking outside the popover closes it.
5. The popover contains twelve preset colour swatches, a "Transparent" swatch, and a custom `<input type="color">`.
6. Clicking a preset swatch immediately changes the canvas background to that colour.
7. Clicking the "Transparent" swatch immediately sets `backgroundColor` to `'transparent'`; the canvas displays a grey-and-white checkerboard pattern.
8. Using the custom colour input updates `backgroundColor` to the chosen hex value in real time as the native picker fires `input` events.
9. The active swatch (matching the current `backgroundColor`) is highlighted with a blue ring.
10. Changing the background colour sets `isDirty = true`; the canvas auto-saves within 2 seconds and the new `backgroundColor` is present in the `canvas` JSON in the database.
11. Reloading the editor restores the saved background colour exactly, including the transparent option.
12. Designs saved before this feature shipped (no `backgroundColor` in the stored JSON) load with the default grey background (`#F3F4F6`) — no error or broken state.
13. The thumbnail generated after an auto-save always uses a solid background; a transparent canvas background produces a thumbnail with the default grey background (`#F3F4F6`), not a white or transparent thumbnail.
14. The "Download PNG" export uses the canvas `backgroundColor`; when the background is transparent the exported PNG has an alpha channel and no fill colour.
15. The "Download PDF" export uses the canvas `backgroundColor`; when the background is transparent the PDF page uses white as the fill colour — no error or notification is shown for this fallback.
16. For solid-colour backgrounds, the exported PNG and PDF visually match what the user sees in the editor.
17. Changing the background colour does not affect any canvas element, selection state, zoom, or pan.
18. Multiple designs maintain independent background colours; switching between designs restores each one's saved colour.
