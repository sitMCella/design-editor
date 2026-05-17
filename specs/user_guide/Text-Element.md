# Text Element

## Adding a text element

Click the **T** button in the left toolbar. A new text element appears at the centre of the canvas with the placeholder text `"Double-click to edit"`. The active tool immediately reverts to **Select** mode.

## Selecting and deselecting

| Gesture | Result |
|---|---|
| **Click** the element | Select it — a solid blue outline (`2px solid #3B82F6`) appears |
| **Click** the canvas background | Deselect |

## Moving (drag to reposition)

1. Click to select the text element.
2. Press and hold the left mouse button on the element body and drag at least **4 px**.
3. The element follows the cursor. Release to place it.

The cursor shows **grab** when hovering a selected element and **grabbing** while dragging.

## Resizing

When a text element is selected, four small blue square handles appear at its corners.

| Handle | Drag direction | Effect |
|---|---|---|
| **Top-left** | Any | Resizes left and top edges; bottom-right corner is the anchor |
| **Top-right** | Any | Resizes right and top edges; bottom-left corner is the anchor |
| **Bottom-left** | Any | Resizes left and bottom edges; top-right corner is the anchor |
| **Bottom-right** | Any | Resizes right and bottom edges; top-left corner is the anchor |

Minimum size is **40 × 20 px**. Text reflows naturally as the width changes.

Cursor on corner handles: `nwse-resize` (top-left / bottom-right) or `nesw-resize` (top-right / bottom-left).

## Editing text content

1. **Double-click** the element to enter **edit mode**. The outline becomes dashed and the text becomes editable.
2. Type, select, and delete text as normal.
3. Exit edit mode by:
   - Clicking anywhere outside the element (blur)
   - Pressing `Escape` (exits without reverting)

> **Note:** If you clear all text content and then blur, the element is automatically removed from the canvas.

The cursor is **text** while you are in edit mode.

## Formatting text

When a text element is selected the **Contextual Toolbar** appears above the canvas with the following controls. All changes take effect immediately.

| Control | What it changes |
|---|---|
| **Font family** dropdown | Typeface (Inter, Arial, Georgia, Times New Roman, Courier New, Verdana) |
| **Font size** field + **−** / **+** buttons | Size in px (8 – 200) |
| **B** toggle | Bold on/off |
| **I** toggle | Italic on/off |
| **Colour square** | Text colour (opens native colour picker) |
| **≡ ≡≡ ≡** alignment buttons | Left / Centre / Right alignment |

See [Contextual Toolbar](Contextual-Toolbar) for the pin toggle and multi-selection behaviour.
