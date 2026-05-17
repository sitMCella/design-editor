# Mouse Gestures

This page covers all click and drag interactions on the canvas, including multi-element selection and moving groups of elements.

## Single-element selection

| Gesture | Result |
|---|---|
| **Click** an element | Select that element (replaces any existing selection) |
| **Click** the canvas background | Deselect all elements |
| **Double-click** a text element | Enter inline edit mode |
| **Double-click** an image element | Enter crop/pan mode |

## Multi-element selection

### Shift+click

Hold `Shift` while clicking elements to build a multi-selection:

| Gesture | Result |
|---|---|
| `Shift` + **click** an unselected element | Add it to the current selection |
| `Shift` + **click** an already-selected element | Remove it from the selection |
| `Shift` + **click** the canvas background | No change to the selection (does *not* deselect) |

### Marquee selection (Shift+drag)

Hold `Shift` and drag on the **canvas background** to draw a selection rectangle:

1. The cursor changes to a **crosshair** as soon as `Shift` is held.
2. Drag to draw a dashed blue rectangle with a faint blue fill.
3. Release the mouse button — any element whose **entire bounding box** lies within the rectangle is added to the selection.
   - Elements that only partially overlap the rectangle are **not** selected.
   - Locked or hidden elements are never added.
4. The rectangle disappears immediately on release.

> **Tip:** Marquee selections are always *additive* — elements already in the selection stay selected. You can combine multiple marquee operations with `Shift+click` to build complex multi-selections.

If the drag is less than 4 px before release, it is treated as a `Shift+click` on the background (no selection change).

### Keyboard

| Key | Result |
|---|---|
| `Escape` | Clear the entire selection (when no element is in edit mode) |

If a text element or table cell is in inline edit mode, the first `Escape` exits that mode; the next `Escape` clears the selection.

## Dragging elements

### Moving a single element

1. **Click** to select the element.
2. **Press and hold** the left mouse button on the element body and drag.
3. A movement of at least **4 px** commits the drag; smaller movements are treated as plain clicks.
4. The element follows the cursor in real time.
5. Release to place it.

The cursor changes to **grab** when hovering a selected element, and **grabbing** (set on the whole page) while you are actively dragging.

### Moving multiple elements together

When two or more elements are selected, dragging **any one** of them moves **all** of them by the same delta:

1. Build a multi-selection using `Shift+click` or marquee.
2. Press and hold the left mouse button on any selected element and drag.
3. Every selected element moves together by the same world-space offset.

Arrow elements that are part of a multi-element drag have their sticky connections automatically cleared before the move, so they move freely rather than being pulled by a connected element.

After a multi-element drag the full selection is preserved — you can immediately drag again without re-selecting.

## Pan vs. select vs. marquee: decision table

| Modifier held | Mouse button | Target | Threshold met (≥ 4 px) | Result |
|---|---|---|---|---|
| None | Left | Canvas background | Yes | Pan viewport |
| None | Left | Canvas background | No | Deselect all |
| None | Left | Element | Yes | Drag/move element |
| None | Left | Element | No | Select element |
| `Shift` | Left | Element | — | Toggle element in/out of selection |
| `Shift` | Left | Canvas background | Yes | Draw marquee, add enclosed elements to selection |
| `Shift` | Left | Canvas background | No | No change (Shift+click background) |
| `Space` | Left | Anywhere | Any | Pan viewport |
| — | Middle | Anywhere | Any | Pan viewport |
