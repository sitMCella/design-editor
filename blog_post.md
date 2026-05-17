# Introducing Our Web-Based Graphic Design Editor

We built a design tool for people who have something to say but not always the skills — or the time — to make it look great. This post walks through what the editor can do and the thinking behind it.

---

## The Problem

Most design software assumes you already know what you are doing. The learning curve is steep, the interfaces are cluttered, and the output rarely matches the mental image you started with. We wanted to close that gap: a canvas-based editor that feels immediate, stays out of your way, and produces professional-quality results without requiring a design background.

---

## What You Can Build

The editor gives you four core building blocks.

**Text** — click the T button and a text block appears on the canvas. Double-click to edit inline. Use the contextual toolbar to change font family, size, weight, style, colour, and alignment. Every change is reflected in real time.

**Images** — drop an image onto the canvas via URL or local file upload. Resize the frame with corner handles, choose how the image fills the space (fill, contain, or cover), and double-click to enter crop mode and reposition the content within the frame.

**Arrows** — connect ideas with directional arrows. Drag either endpoint to change the angle and length. Snap an endpoint to any anchor point on another element to create a sticky connection that follows when the target moves.

**Tables** — insert a table with a header row and data rows. Resize the whole table with corner handles, drag column and row dividers to set exact proportions, and double-click any cell to edit it inline.

---

## An Infinite Canvas

There is no fixed page boundary. The canvas extends in every direction. Elements live in world-space coordinates — place them anywhere, at any scale — and the viewport tracks where you are with smooth pan and zoom.

Zoom with the scroll wheel toward the cursor, or use the header controls for finer steps. Pan by dragging the canvas background or holding Space. Custom scrollbars at the right and bottom edges of the canvas show your position within the virtual workspace and let you navigate by dragging.

---

## Working with Layers

Every element you add appears in the Layers panel. The panel lists elements in z-order — frontmost at the top — so you can see exactly what is stacked on top of what. Click a row to select that element. Drag a row to change its z-order. Click the eye icon to hide an element without deleting it; hidden elements stay in the list but disappear from the canvas and are excluded from exports.

---

## Selecting and Moving

Click any element to select it. Shift-click to add it to the selection. Drag a selection rectangle on the canvas background (with Shift held) to enclose multiple elements at once. Drag any selected element to move the whole group together.

The Delete key removes everything in the current selection. The contextual toolbar adapts to the selection: when all selected elements share the same type, the toolbar shows controls for that type; property changes apply to all of them at once.

---

## Saving and Loading

Designs are saved automatically. Every change you make is debounced and sent to the backend within two seconds, so you never have to think about saving. The home page shows a grid of your recent designs with live canvas thumbnails so you can find the right project at a glance. Click any card to open the design exactly as you left it.

---

## Exporting

When you are ready to share your work, two export options are available from the editor header.

**Download PNG** captures all visible elements at full world-space resolution, adds a small amount of padding around the content, and downloads a lossless PNG file named after your design.

**Download PDF** does the same capture and packages it into a single-page PDF sized to fit the content — landscape or portrait automatically, in points. Both exports respect the layer visibility state and exclude hidden elements.

---

## How It Is Built

The frontend is a React 19 SPA built with Vite 6 and TypeScript. Canvas state lives in a Zustand store with Immer for mutation handling, which makes every element update a simple, readable assignment. TanStack Query manages server state — the designs list, assets, and project metadata. The backend is a Node.js 24 API server backed by PostgreSQL, with designs stored as JSONB documents so the entire element tree round-trips without any schema migration per new element property.

Image assets are downloaded server-side from HTTP URLs, stored on a named Docker volume, and served back through the API. This keeps designs self-contained: an image referenced by URL today will still be there when the design is reopened months later.

---

## What Is Next

The current version covers the core creation loop — add elements, arrange them, style them, save and export. Coming iterations will add:

- **Templates** — pre-built starting points for common formats
- **Undo and redo** — a full history stack for every canvas mutation
- **User accounts** — personal design libraries and authentication
- **Real-time collaboration** — multiple users editing different designs concurrently

If you want to try the editor, the code is open source and the setup is a single `pnpm install` away.
