# Layer Panel

The Layer panel gives you a list view of every element on the canvas, ordered by z-order (topmost element at the top of the list). From here you can select, hide, and reorder elements.

## Opening and closing

Click the **≡ (layers)** button at the bottom of the left toolbar strip. The panel slides in as a `200 px`-wide sidebar between the toolbar and the canvas — the canvas area shrinks to accommodate it. Click the button again to close the panel and restore the full canvas width.

The panel's open/closed state is preserved when you navigate between the home page and the editor within the same session.

## Reading the layer list

Each row shows:

```
⠿  🔤  Text 1                    👁
```

| Part | Meaning |
|---|---|
| **⠿** (drag handle) | Visible on row hover; drag to reorder |
| **Type icon** | T = text, picture frame = image, → = arrow, ⊞ = table |
| **Label** | Auto-generated name, e.g. "Text 1", "Image 2" (first element of each type created is always number 1) |
| **👁 eye icon** | Visibility toggle |

The list order is **reversed z-order**: the element at the very top of the list is visually on top of all other elements on the canvas.

## Selecting elements from the panel

| Gesture | Result |
|---|---|
| **Click** a row | Select that element (replaces the current selection) |
| `Shift` + **click** a row | Toggle the element in/out of the multi-selection |

Selecting an element in the panel is equivalent to clicking it on the canvas — the selection is shared. When you select an element on the canvas, its row in the panel is highlighted and scrolled into view automatically.

Rows for hidden elements cannot be clicked to select (hidden elements cannot be selected).

## Hiding and showing elements

Click the **👁 eye icon** on any row to toggle visibility:

- **Visible → Hidden:** the element disappears from the canvas, cannot be selected via canvas interactions, and the row dims to 50 % opacity with a crossed-out eye icon. If the element was selected, it is immediately removed from the selection.
- **Hidden → Visible:** the element reappears on the canvas at full opacity.

Hidden elements are excluded from:
- Canvas rendering
- All selection gestures (click, Shift+click, marquee)
- The bounding box used for thumbnail generation and export

The `hidden` state is saved automatically with the canvas. Reopening a design restores the visibility of all elements.

## Reordering elements (drag-and-drop)

To change the z-order of an element:

1. Hover over a row until the **drag handle (⠿)** appears on the left side.
2. Press and hold the left mouse button on the handle.
3. Drag the row up or down. A **blue insertion line** tracks the nearest drop position between rows.
4. The dragged row renders as a semi-transparent ghost at 50 % opacity while moving.
5. Release to drop the element at the new position.

A drag that moves less than **4 px** vertically before release is treated as a plain row click (selects the element, no reorder).

Z-order changes are saved automatically via the existing auto-save mechanism.

## Empty state

When the canvas has no elements, the panel shows:

> *No elements yet. Use the toolbar to add content.*
