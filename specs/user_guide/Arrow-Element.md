# Arrow Element

## Adding an arrow element

Click the **→** button in the left toolbar. A new horizontal arrow element (200 px wide) appears near the centre of the canvas. The active tool immediately reverts to **Select** mode.

## Selecting and deselecting

| Gesture | Result |
|---|---|
| **Click** the element (or its bounding box) | Select it — a solid blue outline appears around the bounding box |
| **Click** the canvas background | Deselect |

The arrow has a generous click target (transparent rectangle over the bounding box) to make it easy to click even when the line is thin.

## Moving the arrow (body drag)

1. Click to select the arrow.
2. Press and hold the left mouse button on the **line body** (not on an endpoint handle) and drag at least **4 px**.
3. Both endpoints move together by the same delta.
4. Release to place it.

> **Note:** If either endpoint is currently connected to another element, the connection is broken automatically when a body drag begins.

Cursor: **grab** on hover, **grabbing** while dragging.

## Resizing and re-angling (endpoint drag)

When an arrow is selected, two circular handles appear — one at each endpoint:

| Handle | Appearance |
|---|---|
| **Start** | Hollow circle with blue border |
| **End** | Filled blue circle |

Drag either handle to move only that endpoint independently. The other endpoint stays fixed. There is no 4 px threshold — endpoint drags start immediately on mousedown.

Cursor on handles: **crosshair**.

## Sticky connections (snapping endpoints to elements)

While dragging an endpoint, the editor shows **anchor points** on nearby elements (top, right, bottom, left, and centre). When your endpoint comes within **12 px** of an anchor point:

- The endpoint **snaps** to the exact anchor coordinate.
- A filled blue snap indicator circle appears on the target anchor.

Release the mouse while snapped to **connect** the endpoint to that anchor. The endpoint stays connected — if you later move or resize the target element, the arrow endpoint follows it automatically.

### Breaking a connection

Drag a connected endpoint more than **12 px** away from its anchor point and it becomes a free endpoint. The snap indicator disappears.

## Formatting arrows

When an arrow element is selected the **Contextual Toolbar** shows:

| Control | What it changes |
|---|---|
| **— → ← ↔** buttons | Arrowhead position: none / end only / start only / both ends |
| **Stroke width** field + **−** / **+** | Line thickness in px (1–20) |
| **Colour square** | Stroke colour (opens native colour picker); arrowhead fill updates to match |

All changes take effect immediately.
