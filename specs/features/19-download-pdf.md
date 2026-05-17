# Feature Spec: Download Canvas as PDF

## Summary

Add a "Download PDF" button to the editor header, alongside the existing "Download PNG" button introduced in spec 18. Clicking it captures all visible elements on the infinite canvas, renders them at `1×` world-space scale using `html2canvas`, embeds the result into a single-page PDF document via `jsPDF`, and triggers a browser file download. The capture region and the handling of hidden elements are identical to the PNG export. No backend involvement is required; the entire flow is client-side.

## Scope

**In scope**
- A "Download PDF" button in the editor header, immediately to the left of the existing "Download PNG" button
- Clicking the button captures the visible-element bounding box at `1×` world-space scale and downloads a `.pdf` file
- The downloaded filename is derived from the current design name: `{name}.pdf` (spaces replaced with hyphens, lowercased)
- The PDF contains a single page sized to match the padded bounding box of all visible elements (`24 px` padding on each side, in points)
- Hidden elements (spec 17) are excluded from the capture — consistent with `elementsBBox` filtering
- While capture is in progress the button shows a spinner and is non-interactive
- If `html2canvas` throws, `jsPDF` fails, or the canvas has no visible elements, a brief error notification is shown and no download is triggered
- The canvas background colour (`#F3F4F6`) fills areas within the padded bounding box that contain no elements

**Out of scope (future iterations)**
- Multi-page PDF export
- Vector/text PDF rendering (text is rasterised via `html2canvas`)
- Resolution / DPI multiplier control (the export is always `1×` world-space pixels)
- Choosing the export region (e.g. a custom crop or the full virtual canvas)
- Server-side high-fidelity PDF rendering (e.g. Puppeteer + headless Chrome)
- Exporting only the currently selected elements
- Password protection or PDF metadata (author, subject)
- `Cmd/Ctrl + Shift + P` keyboard shortcut

---

## UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  [✕]  My Design Name    Unsaved changes    [− 100% +]  [↓ PDF] [↓ PNG] │
└─────────────────────────────────────────────────────────────────┘
```

- The "Download PDF" button sits immediately to the left of the "Download PNG" button at the right end of the editor header.
- Button label: `"Download PDF"` with a download arrow icon (`↓`) to its left.
- Idle style: `text-gray-700`, `border border-gray-200`, `bg-white`, standard rounded button — identical to the PNG button style.
- Hover style: `bg-gray-50`.
- In-progress style: label replaced by a spinner (`animate-spin` circle); button width is preserved; non-interactive (`pointer-events: none`, `opacity-60`).
- The button is always visible while the editor is open, regardless of selection state.
- The two download buttons are visually grouped; they share a consistent appearance so neither is visually primary over the other.

---

## Behaviour

| Action | Outcome |
|---|---|
| Click "Download PDF" (canvas has visible elements) | Button enters in-progress state; capture runs; file download is triggered; button returns to idle |
| Click "Download PDF" (canvas has no visible elements) | Brief error notification: `"Nothing to export — add at least one visible element."` |
| `html2canvas` throws during capture | Brief error notification: `"Export failed. Please try again."`; button returns to idle |
| `jsPDF` throws during PDF assembly | Brief error notification: `"Export failed. Please try again."`; button returns to idle |
| Click "Download PDF" while a capture is already in progress | No-op (button is non-interactive while in-progress) |
| Click "Download PNG" while a PDF capture is in progress (or vice versa) | No-op on the already-in-progress button; the other button remains interactive |
| Navigate away mid-capture | No download is triggered; any in-flight work is abandoned silently |

---

## Capture Procedure

The PDF download reuses the world-layer capture technique established in `useThumbnail` (spec 13) and `downloadPng` (spec 18). The implementation lives in a standalone `downloadPdf` async utility — it is **not** part of `useThumbnail` or `downloadPng`.

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
4. Record the world layer's current CSS `transform` and clear it (`transform: none`) so the capture operates at zoom `1×` world-space coordinates. Restore the original transform in a `finally` block.
5. Call `html2canvas` on the world layer div (`worldRef`):
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
6. Convert the resulting `HTMLCanvasElement` to a JPEG data URL for embedding (JPEG compresses better inside PDF than PNG and jsPDF supports it natively):
   ```ts
   const imgData = canvas.toDataURL('image/jpeg', 0.92)
   ```
7. Construct the PDF with `jsPDF`. The page dimensions match the capture region in points (1 px = 0.75 pt at 96 dpi):
   ```ts
   const pxToPt = 0.75
   const pageW = captureW * pxToPt
   const pageH = captureH * pxToPt

   const pdf = new jsPDF({
     orientation: pageW >= pageH ? 'landscape' : 'portrait',
     unit: 'pt',
     format: [pageW, pageH],
   })

   pdf.addImage(imgData, 'JPEG', 0, 0, pageW, pageH)
   ```
8. Trigger the download:
   ```ts
   pdf.save(toFilename(designName))   // e.g. "my-design.pdf"
   ```
9. Restore the world-layer transform (in `finally`).
10. Set button state back to idle.

### Filename helper

Reuse the same helper from `downloadPng.ts`, with the extension changed:

```ts
function toFilename(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-') + '.pdf'
}
```

Examples: `"My Design"` → `"my-design.pdf"`, `"Untitled design"` → `"untitled-design.pdf"`.

### Transform removal timing

The transform clear and restore is wrapped in `requestAnimationFrame` + `setTimeout(0)` — identical to the technique used in `useThumbnail` and `downloadPng` — so the visual disruption is confined to a single paint and imperceptible to the user.

---

## Design Decisions

### Client-side PDF with `html2canvas` + `jsPDF` vs. server-side rendering

| Approach | Pros | Cons |
|---|---|---|
| Client-side (`html2canvas` + `jsPDF`) | No backend changes; reuses proven world-layer capture logic; `html2canvas` already a dependency; ships quickly | Text is rasterised, not selectable in the PDF; output quality bounded by screen resolution |
| Server-side (Puppeteer + headless Chrome) | Vector text; pixel-perfect; no CORS constraints | Requires a separate headless browser service; significant infrastructure complexity; out of scope for this iteration |

**Decision: client-side with `html2canvas` + `jsPDF`.** `html2canvas` is already installed (spec 12). Adding `jsPDF` is the smallest possible incremental dependency to gain PDF output. The target users (non-designers producing social content, presentations, and marketing materials) do not require selectable text in exported PDFs. Server-side rendering remains a documented future option.

### JPEG inside PDF vs. PNG inside PDF

PNG embedded in a PDF produces a larger file because PDFs do not apply additional compression to embedded PNG streams. JPEG at quality `0.92` gives near-lossless quality while producing a substantially smaller file — this matters for designs with many image elements. `jsPDF` has native JPEG support, making the integration straightforward.

### Page size: fixed (A4 / letter) vs. bounding box

| Option | Pros | Cons |
|---|---|---|
| Fixed A4 / letter | Familiar paper size; easy to print | Crops or shrinks wide designs; adds empty space for narrow designs |
| Tight bounding box | Exports exactly the design content; consistent with PNG export | Non-standard page size |

**Decision: tight bounding box matching the visible-element capture region.** This is consistent with the PNG export (spec 18) and the thumbnail (spec 13). The design tool targets screen-first use cases (social posts, presentations) where arbitrary canvas dimensions are the norm, not print paper sizes. Users who need A4 output can set their canvas elements within A4 proportions.

### Separate `isExportingPdf` state vs. shared export state

The PNG button already has its own `isExporting` / `exportError` local state in `EditorPage`. Two approaches were evaluated:

| Option | Pros | Cons |
|---|---|---|
| Separate `isExportingPdf` and `exportError` states | Each button's loading state is independent; clicking PDF while PNG is in progress (or vice versa) is naturally handled | Slightly more state variables |
| Shared export state with a type discriminant | Fewer variables | One button disables both; can feel unexpected |

**Decision: separate `isExportingPdf` state.** Each export format is an independent operation. A user who accidentally clicked PNG can still trigger a PDF download without waiting.

---

## Dependency

```bash
pnpm add jspdf
```

`jsPDF` is a mature, widely used client-side PDF generation library with built-in `addImage` support for JPEG and PNG data URLs. It ships with TypeScript type definitions via `@types/jspdf`.

```bash
pnpm add -D @types/jspdf
```

---

## Error Notification

Reuses the same transient toast pattern introduced in spec 18:

- Background `bg-red-50`, border `border border-red-200`, text `text-red-700`, `rounded-lg`, `px-4 py-2`.
- Rendered in a fixed overlay container at `top-4` / `left-1/2 -translate-x-1/2`, `z-50`.
- Auto-dismissed after `4000 ms` via `setTimeout`.
- Only one notification is shown at a time across both export buttons (a new one replaces any existing one). `exportError` is shared between the PNG and PDF buttons so that whichever fires last wins, and clearing logic is not duplicated.

---

## State

All state for this feature is local to `EditorPage` — no store additions are required.

| State | Type | Location | Note |
|---|---|---|---|
| `isExportingPng` | `boolean` | `useState` in `EditorPage` | Renamed from `isExporting` (spec 18) to distinguish from the new PDF state |
| `isExportingPdf` | `boolean` | `useState` in `EditorPage` | New |
| `exportError` | `string \| null` | `useState` in `EditorPage` | Shared between both export buttons (unchanged from spec 18) |

The rename of `isExporting` → `isExportingPng` is a local refactor within `EditorPage` with no effect on the canvas store, UI store, or any child component.

---

## Components

| Component | Location | Change |
|---|---|---|
| `EditorPage` | `src/pages/EditorPage.tsx` | Adds "Download PDF" button to the header; owns `isExportingPdf` state; renames `isExporting` → `isExportingPng`; implements `handleDownloadPdf` that calls `downloadPdf`; shares `exportError` with the PNG button |
| `downloadPdf` | `src/utils/downloadPdf.ts` | New pure async utility — accepts `worldRef`, `elements`, `designName`; encapsulates `html2canvas` capture, JPEG data URL conversion, `jsPDF` page assembly, and `pdf.save()`; throws on failure |

`useThumbnail`, `downloadPng`, `canvasStore`, `uiStore`, and all element components require no changes. `elementsBBox` is reused without modification.

---

## File Structure Additions

```
frontend/
  src/
    utils/
      downloadPdf.ts    (new — html2canvas capture + jsPDF assembly + save logic)
    pages/
      EditorPage.tsx    (updated — Download PDF button, isExportingPdf state)
```

---

## Acceptance Criteria

1. The editor header displays a "Download PDF" button to the left of the "Download PNG" button, always visible while a design is open.
2. Clicking "Download PDF" when the canvas has at least one visible element triggers a browser file download with a `.pdf` extension.
3. The downloaded filename matches the design name: spaces replaced with hyphens, lowercased, with `.pdf` appended (e.g. `"My Design"` → `"my-design.pdf"`).
4. The downloaded PDF contains a single page whose dimensions (in points) match the padded bounding box of all visible elements.
5. The page orientation is landscape when `captureW ≥ captureH`, and portrait otherwise.
6. All visible elements are rendered in the PDF; elements with `hidden: true` are excluded.
7. The capture region is the tight bounding box of all visible elements plus `24 px` of padding on each side — identical to the PNG export region.
8. The canvas background colour (`#F3F4F6`) fills any padded area or gaps between elements within the capture region.
9. The exported PDF is at `1×` world-space scale — element pixel dimensions in the PDF correspond to their canvas store `width`/`height` values converted to points at 96 dpi.
10. While the PDF capture is in progress the "Download PDF" button displays a spinner and is non-interactive; clicking it again has no effect.
11. While the PDF capture is in progress the "Download PNG" button remains fully interactive; a PNG export can be triggered independently.
12. After the download is triggered (or an error occurs), the "Download PDF" button returns to its idle state.
13. Clicking "Download PDF" on a canvas with no visible elements shows the notification `"Nothing to export — add at least one visible element."` and does not trigger a download.
14. If `html2canvas` or `jsPDF` throws during the export, the button returns to idle and the notification `"Export failed. Please try again."` is shown; no broken or empty file is downloaded.
15. The error notification auto-dismisses after `4 seconds`.
16. The current viewport zoom and pan position do not affect the exported PDF — the capture always uses `1×` world-space coordinates.
17. Image elements with HTTP `src` values (served via `/api/assets/:id/content`) are rendered correctly in the export (`useCORS: true` is set on the `html2canvas` call).
18. Multiple successive downloads produce independent files; each reflects the canvas state at the time the button was clicked.
19. The download works for canvases containing any combination of element types: text, image, arrow, and table.
20. The "Download PNG" button introduced in spec 18 continues to function exactly as before — the PDF feature does not regress it.
