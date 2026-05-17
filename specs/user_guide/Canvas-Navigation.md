# Canvas Navigation

The canvas is an infinite world space. You can zoom in and out and pan to any position.

## Zoom

### Mouse wheel

Roll the scroll wheel over the canvas. The view zooms toward (or away from) the exact point under your cursor, keeping that world position stationary.

- Scroll **up** — zoom in
- Scroll **down** — zoom out

### Keyboard shortcuts

| Shortcut | Effect |
|---|---|
| `Ctrl/Cmd + =` or `Ctrl/Cmd + +` | Zoom in ×1.25 toward the viewport centre |
| `Ctrl/Cmd + -` | Zoom out ÷1.25 toward the viewport centre |
| `Ctrl/Cmd + 0` | Reset to 100 % and pan to origin (0, 0) |

### Header zoom controls

The `[− N% +]` control in the editor header lets you zoom with mouse clicks:

- Click **−** to zoom out ÷1.25
- Click **+** to zoom in ×1.25
- Click the **percentage readout** (e.g. `100%`) to reset to 100 %

The **−** button is disabled at the minimum zoom (10 %). The **+** button is disabled at the maximum zoom (500 %).

## Pan

### Space + drag

Hold `Space` and press the left mouse button on the canvas background, then drag. The canvas follows your pointer. Release the mouse button or `Space` to stop panning. The cursor changes to a **grabbing hand** during the pan.

### Middle-mouse drag

Press and hold the **middle mouse button** on the canvas background, then drag. Behaves identically to Space + drag.

### Click-and-drag on the background

A plain left-click drag on the canvas background (no modifier key, no Space held) also pans the viewport — as long as the pointer moves at least **4 px** before you release. If the movement is less than 4 px, the action is treated as a click, which deselects all elements.

> **Distinction from marquee selection:** a plain background drag pans; a `Shift` background drag draws a marquee selection rectangle. See [Mouse Gestures](Mouse-Gestures).

## Scrollbars

Custom horizontal and vertical scrollbars appear at the bottom and right edges of the canvas area.

- **Drag the thumb** to pan continuously in that axis.
- **Click the track** (away from the thumb) to jump the viewport by one full viewport-width or viewport-height in the direction you clicked.
- The thumb becomes invisible when the entire virtual canvas fits within the viewport at the current zoom level.
- As you add elements or pan freely, the virtual canvas grows automatically — the thumb size adjusts to reflect the new total area.

## Coordinate system

All element positions are stored as **world-space pixels**. The origin `(0, 0)` is at the top-left of the world. Elements added via the toolbar appear near the centre of the initial view. Resizing, dragging, and exported images all use these same world-space coordinates regardless of your current zoom or pan position.
