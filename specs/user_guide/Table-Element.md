# Table Element

## Adding a table element

Click the **⊞** (grid) button in the left toolbar. A new table element appears near the centre of the canvas with **1 header row** and **2 data rows**, each containing **2 columns**. The active tool immediately reverts to **Select** mode.

### Default appearance

| Row type | Background | Text style |
|---|---|---|
| Header row | `#F3F4F6` (light grey) | Bold, 14 px |
| Data rows | White | Normal, 14 px |

All cell borders are `1px solid #E5E7EB`. Cell content is centred horizontally and vertically.

## Selecting and deselecting

| Gesture | Result |
|---|---|
| **Click** the element | Select it — a solid blue outline appears |
| **Click** the canvas background | Deselect |

## Moving (drag to reposition)

1. Click to select the table element.
2. Press and hold the left mouse button on the element body (not on a handle or inside an editing cell) and drag at least **4 px**.
3. The table follows the cursor. Release to place it.

Cursor: **grab** on hover, **grabbing** while dragging.

## Resizing the whole table (corner handles)

When the table is selected, four blue square handles appear at its corners. Drag any handle to resize the entire table. The minimum size is **80 × 40 px**.

After a corner resize, column widths and row heights are scaled proportionally so they continue to fill the new dimensions exactly.

Cursor: `nwse-resize` (top-left / bottom-right), `nesw-resize` (top-right / bottom-left).

## Resizing individual columns

When the table is selected, thin transparent handles appear over each internal column boundary. A blue line appears on hover.

1. Hover a column boundary until the **col-resize** cursor appears.
2. Drag left or right to redistribute width between the two adjacent columns.
3. Neither column can become narrower than **40 px**.

Changes apply in real time as you drag.

## Resizing individual rows

Identical to column resizing but applied to row boundaries. Hover a row boundary until the **row-resize** cursor appears, then drag up or down. Minimum row height is **24 px**.

## Adding and removing rows and columns

When the table is selected the **Contextual Toolbar** shows four action buttons:

| Button | Action | Disabled when |
|---|---|---|
| **+ Row** | Append a new empty data row (height 40 px) | — |
| **− Row** | Remove the last data row | Only 1 data row remains |
| **+ Col** | Append a new empty column (width 120 px) | — |
| **− Col** | Remove the last column | Only 1 column remains |

> The header row cannot be removed.

## Editing cell content

1. Make sure the table is selected (single click).
2. **Double-click** any cell to enter **inline edit mode** for that cell. The cursor changes to **text**.
3. Type to edit. Changes are visible in real time.
4. Commit by pressing `Enter` or clicking outside the cell.
5. Press `Escape` to revert the cell to its value before you started editing.

Empty cells display the muted placeholder **"Click to edit"** — this placeholder is not stored in the canvas.

> **Note:** Double-clicking inside the table also calls `stopPropagation`, so it does not accidentally deselect the table.
