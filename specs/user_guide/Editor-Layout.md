# Editor Layout

The editor is divided into four areas that are always visible while a design is open.

```
┌─────────────────────────────────────────────────────────────────┐
│  [✕]  My Design Name    Unsaved changes    [− 100% +]  [↓ PDF] [↓ PNG]
├─────────────────────────────────────────────────────────────────┤
│  Contextual Toolbar  (visible when an element is selected)      │
├──────┬──────────────┬──────────────────────────────────────────┤
│      │  Layers      │                                       ▲  │
│  T   │  (optional)  │                                       │  │
│  ⬚   │              │           Canvas                    ▓▓  │
│  →   │              │                                       │  │
│  ⊞   │              │                                       ▼  │
│  ≡   │              ├───────────◄──▓▓▓──►──────────────────┤
└──────┴──────────────┴──────────────────────────────────────────┘
```

## Editor Header

The strip across the top of the screen. It contains:

| Element | Purpose |
|---|---|
| **✕ Close** | Returns you to the home page |
| **Design name** | The project name set at creation |
| **Unsaved changes** | Indicator shown while a save is pending |
| **− N % +** | Zoom controls (see [Canvas Navigation](Canvas-Navigation)) |
| **↓ PDF** | Download canvas as PDF (see [Exporting](Exporting)) |
| **↓ PNG** | Download canvas as PNG (see [Exporting](Exporting)) |

## Contextual Toolbar

A `40 px`-tall strip that appears between the header and the canvas whenever an element (or a group of same-type elements) is selected. It shows formatting controls relevant to the selected element type. See [Contextual Toolbar](Contextual-Toolbar) for details.

## Left Toolbar Strip

A `56 px`-wide vertical column on the far left. It contains buttons for inserting new elements and toggling the Layer panel:

| Button | Action |
|---|---|
| **T** | Insert a text element |
| **⬚** (picture frame) | Insert an image element |
| **→** | Insert an arrow element |
| **⊞** (grid) | Insert a table element |
| **≡** (layers) | Toggle the Layer panel open/closed |

Clicking an insert button immediately places the new element at the default position on the canvas and returns the active tool to **Select** mode.

## Layer Panel (optional)

A `200 px`-wide sidebar that slides in between the toolbar strip and the canvas when you click the **≡ Layers** button. It lists all elements in z-order. See [Layer Panel](Layer-Panel) for details.

## Canvas

The large area to the right of the toolbar (and layer panel, when open). It is an infinite world space — elements can be placed anywhere. The grey background fills the viewport; your elements float on top. Custom scrollbars appear at the right and bottom edges of the canvas area. See [Canvas Navigation](Canvas-Navigation) for how to move around.
