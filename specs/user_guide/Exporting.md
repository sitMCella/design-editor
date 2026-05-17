# Exporting

You can download the canvas as a **PNG image** or a **PDF document** directly from the editor header. Both exports are generated entirely in the browser — no server round-trip is required.

## What is exported

Both formats capture the same region:

- All **visible** elements on the canvas (hidden elements are excluded).
- A **24 px padding** on each side of the tight bounding box that encloses all visible elements.
- The canvas background colour (`#F3F4F6`, light grey) fills any gaps and the padded border area.
- The capture always uses **1× world-space scale**, regardless of your current zoom level.

> If the canvas has no visible elements, a notification appears: *"Nothing to export — add at least one visible element."*

## Download PNG

Click the **↓ PNG** button at the right end of the editor header.

- The capture runs using `html2canvas` on the world layer.
- The result is saved as a lossless PNG file.
- The filename is derived from the design name: spaces become hyphens, the name is lowercased, and `.png` is appended. For example, `"My Design"` → `my-design.png`.

## Download PDF

Click the **↓ PDF** button immediately to the left of the PNG button.

- The same `html2canvas` capture is performed.
- The image is embedded into a single-page PDF (via `jsPDF`) whose page dimensions exactly match the padded bounding box.
- Page orientation is **landscape** when width ≥ height, **portrait** otherwise.
- The filename follows the same rule as PNG but with `.pdf`. For example, `"My Design"` → `my-design.pdf`.

> **Note:** Text in the exported PDF is rasterised (it is an image inside the PDF, not selectable vector text).

## While exporting

While a capture is in progress:

- The active button's label is replaced by a **spinner** and the button becomes non-interactive.
- The other download button remains fully interactive — a PNG and PDF export can be triggered independently.
- After the download completes (or an error occurs), the button returns to its idle state.

## Error handling

If the capture or file-assembly fails, a brief **red notification** appears at the top-centre of the editor and auto-dismisses after 4 seconds:

| Situation | Notification |
|---|---|
| No visible elements | *"Nothing to export — add at least one visible element."* |
| `html2canvas` / `jsPDF` error | *"Export failed. Please try again."* |

No broken or empty file is downloaded on error.

## Tips

- The export region is the **tight bounding box** of your elements, not the full virtual canvas. Place elements close together to get a compact export.
- Zoom level and pan position do not affect the exported output.
- Image elements loaded from URLs are included correctly in the export (`useCORS: true` is used internally).
