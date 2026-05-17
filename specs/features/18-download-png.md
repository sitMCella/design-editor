# Feature Spec: Download Canvas as PNG

## Summary

Add a "Download PNG" button to the editor header. Clicking it captures all visible elements on the infinite canvas, renders them into a full-resolution PNG image using `html2canvas`, and triggers a browser file download. The capture region is the tight bounding box of all visible elements, padded by `24 px` on each side — identical to the region used for thumbnail generation (spec 13). Hidden elements (spec 17) are excluded. No backend involvement is required; the entire flow is client-side.

## Scope

**In scope**
- A "Download PNG" button in the editor header, to the right of the zoom control
- Clicking the button captures the visible-element bounding box at `1×` world-space scale and downloads a `.png` file
- The downloaded filename is derived from the current design name: `{name}.png` (spaces replaced with hyphens, lowercased)
- Hidden elements are excluded from the capture (consistent with `elementsBBox` filtering in spec 17)
- While capture is in progress the button shows a spinner and is non-interactive
- If `html2canvas` throws or the canvas has no visible elements, a brief error notification is shown and no download is triggered
- The canvas background colour (`#F3F4F6`) fills areas within the padded bounding box that contain no elements

**Out of scope (future iterations)**
- Export as JPEG, PDF, or SVG
- Resolution / DPI multiplier control (the download is always `1×` world-space pixels)
- Choosing the export region (e.g. a custom crop or the full virtual canvas)
- Server-side high-fidelity rendering
- Exporting only the currently selected elements
- Progress indicator for large canvases
- `Cmd/Ctrl + Shift + E` keyboard shortcut

---

## UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  [✕]  My Design Name    Unsaved changes    [− 100% +]  [↓ PNG] │
└─────────────────────────────────────────────────────────────────┘
```

- The "Download PNG" button is positioned at the right end of the editor header, after the zoom control.
- Button label: `"Download PNG"` with a download arrow icon (`↓`) to its left.
- Idle style: `text-gray-700`, `border border-gray-200`, `bg-white`, standard rounded button.
- Hover style: `bg-gray-50`.
- In-progress style: label replaced by a spinner (`animate-spin` circle); button width is preserved; non-interactive (`pointer-events: none`, `opacity-60`).
- The button is always visible while the editor is open, regardless of selection state.

---

## Behaviour

| Action | Outcome |
|---|---|
| Click "Download PNG" (canvas has visible elements) | Button enters in-progress state; capture runs; file download is triggered; button returns to idle |
| Click "Download PNG" (canvas has no visible elements) | Brief error notification: `"Nothing to export — add at least one visible element."` |
| `html2canvas` throws during capture | Brief error notification: `"Export failed. Please try again."`; button returns to idle |
| Click "Download PNG" while a capture is already in progress | No-op (button is non-interactive while in-progress) |
| Navigate away mid-capture | No download is triggered; any in-flight work is abandoned silently |

---

## Capture Procedure

The download reuses the same world-layer capture approach established by `useThumbnail` (spec 13). The implementation lives in a standalone `downloadPng` async function called directly from the button's `onClick` handler — it is **not** part of `useThumbnail`, which is exclusively auto-save-triggered.

### Step-by-step

1. Compute `elementsBBox(visibleElements)` where `visibleElements = elements.filter(el => !el.hidden)`.
2. If the result is `null` (no visible elements), show the "Nothing to export" notification and return early.
3. Add `EXPORT_PADDING = 24` px to each side of the bounding box:
   ```
   captureX = bbox.x - EXPORT_PADDING
   captureY = bbox.y - EXPORT_PADDING
   captureW = bbox.width  + EXPORT_PADDING * 2
   captureH = bbox.height + EXPORT_PADDING * 2
   ```
4. The world layer div (`worldRef`) carries the current viewport CSS transform. Before calling `html2canvas`, record the existing `transform` value and set it to `none` so the capture operates at zoom `1×` world-space coordinates. Restore the original transform in a `finally` block so the editor UI is never permanently affected by a thrown error.
5. Call:
   ```ts
   const canvas = await html2canvas(worldRef.current, {
     x: captureX,
     y: captureY,
     width:  captureW,
     height: captureH,
     scale: 1,
     useCORS: true,
     logging: false,
     backgroundColor: '#F3F4F6',
   })
   ```
6. Convert the result to a PNG blob:
   ```ts
   canvas.toBlob((blob) => {
     if (!blob) { showError(); return }
     const url = URL.createObjectURL(blob)
     const a   = document.createElement('a')
     a.href     = url
     a.download = toFilename(designName)   // e.g. "my-design.png"
     a.click()
     URL.revokeObjectURL(url)
   }, 'image/png')
   ```
7. Restore the world-layer transform (in `finally`).
8. Set button state back to idle.

### Filename helper

```ts
function toFilename(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-') + '.png'
}
```

Examples: `"My Design"` → `"my-design.png"`, `"Untitled design"` → `"untitled-design.png"`.

### Transform removal timing

The transform clear and restore is wrapped in `requestAnimationFrame` + `setTimeout(0)` to keep the visual disruption within a single paint — identical to the technique used in `useThumbnail`. At `60 fps` this is imperceptible to the user.

---

## Design Decisions

### Client-side PNG with `html2canvas` vs. server-side rendering

| Approach | Pros | Cons |
|---|---|---|
| Client-side (`html2canvas`) | No backend changes; reuses existing world-layer capture logic from spec 13; ships quickly | May differ slightly from a theoretical print-quality render; limited by browser CORS for cross-origin images |
| Server-side (Puppeteer) | Pixel-perfect; no CORS constraints; works headlessly | Requires a separate headless browser service; adds significant infrastructure complexity; out of scope for this iteration |

**Decision: client-side with `html2canvas`.** The same library is already a dependency (spec 12). The world-layer capture technique is already proven by `useThumbnail`. For an initial download feature, client-side PNG at `1×` world-space resolution covers the practical needs of the target users (non-designers creating social posts, presentations, and marketing materials) without any infrastructure changes.

### PNG vs. JPEG

The thumbnail (spec 12) uses JPEG at quality `0.7` to minimise file size for network transfer. A user-facing download should use PNG — it is lossless, universally supported, and expected as the default raster export format for design tools. JPEG artefacts on text edges would be noticeable and feel low-quality.

### Capture region: bounding box vs. full virtual canvas

| Option | Pros | Cons |
|---|---|---|
| Full virtual canvas (`4000 × 3000` and growing) | Predictable output bounds | Mostly empty white space; enormous file sizes; not useful for the user |
| Tight bounding box of visible elements | Compact; exports exactly what the user designed | Coordinates depend on where elements were placed |

**Decision: tight bounding box with `24 px` padding.** This is consistent with the thumbnail capture region (spec 13) and produces a usable artefact regardless of where elements are placed on the infinite canvas.

---

## Error Notification

The error notification is a transient toast that appears at the top-centre of the editor for `4 seconds` before auto-dismissing. It uses the same visual style as any future notification system; for this iteration a minimal inline implementation is acceptable:

- Background `bg-red-50`, border `border border-red-200`, text `text-red-700`, `rounded-lg`, `px-4 py-2`.
- Rendered in a fixed overlay container at `top-4` / `left-1/2 -translate-x-1/2`, `z-50`.
- Auto-dismissed after `4000 ms` via `setTimeout`.
- Only one notification is shown at a time (a new one replaces any existing one).

---

## State

All state for this feature is local to `EditorPage` — no store additions are required.

| State | Type | Location |
|---|---|---|
| `isExporting` | `boolean` | `useState` in `EditorPage` |
| `exportError` | `string \| null` | `useState` in `EditorPage` |

`isExporting` drives the button's in-progress visual and `pointer-events: none` guard. `exportError` drives the toast notification, cleared automatically after `4000 ms`.

---

## Components

| Component | Location | Change |
|---|---|---|
| `EditorPage` | `src/pages/EditorPage.tsx` | Adds "Download PNG" button to the header; owns `isExporting` and `exportError` state; implements `handleDownloadPng` that calls the capture procedure |
| `downloadPng` | `src/utils/downloadPng.ts` | New pure async utility — accepts `worldRef`, `elements`, `designName`; encapsulates the `html2canvas` capture, blob conversion, and `<a>` click; throws on failure |

`useThumbnail`, `canvasStore`, `uiStore`, and all element components require no changes. `elementsBBox` is reused without modification.

---

## File structure additions

```
frontend/
  src/
    utils/
      downloadPng.ts   (new — html2canvas capture + blob download logic)
    pages/
      EditorPage.tsx   (updated — Download PNG button, isExporting state, error toast)
```

---

## Acceptance Criteria

1. The editor header displays a "Download PNG" button to the right of the zoom control, always visible while a design is open.
2. Clicking "Download PNG" when the canvas has at least one visible element triggers a browser file download with a `.png` extension.
3. The downloaded filename matches the design name: spaces replaced with hyphens, lowercased, with `.png` appended (e.g. `"My Design"` → `"my-design.png"`).
4. The downloaded image contains all visible elements and no elements with `hidden: true`.
5. The image capture region is the tight bounding box of all visible elements plus `24 px` of padding on each side.
6. The canvas background colour (`#F3F4F6`) fills any padded area or gaps between elements within the capture region.
7. The exported PNG is at `1×` world-space scale — element dimensions in pixels match their canvas store `width`/`height` values.
8. While the capture is in progress the button displays a spinner and is non-interactive; clicking it again has no effect.
9. After the download is triggered (or an error occurs), the button returns to its idle state.
10. Clicking "Download PNG" on a canvas with no visible elements (all elements are hidden, or none have been added) shows the notification `"Nothing to export — add at least one visible element."` and does not trigger a download.
11. If `html2canvas` throws during capture, the button returns to idle and the notification `"Export failed. Please try again."` is shown; no broken or empty file is downloaded.
12. The error notification auto-dismisses after `4 seconds`.
13. The current viewport zoom and pan position do not affect the exported image — the capture always uses `1×` world-space coordinates.
14. Image elements with HTTP `src` values (served via `/api/assets/:id/content`) are rendered correctly in the export (`useCORS: true` is set on the `html2canvas` call).
15. Multiple successive downloads produce independent files; each reflects the canvas state at the time the button was clicked.
16. The download works for canvases containing any combination of element types: text, image, arrow, and table.
