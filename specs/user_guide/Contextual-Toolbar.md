# Contextual Toolbar

The contextual toolbar is a `40 px`-tall strip that sits between the editor header and the canvas. It shows formatting controls for the currently selected element.

## When the toolbar appears

| Selection state | Toolbar visible | Controls shown |
|---|---|---|
| Nothing selected | No | — |
| One element | Yes | Controls for that element's type |
| Multiple elements, same type | Yes | Shared controls for that type |
| Multiple elements, mixed types | No | — |

## Controls by element type

### Text element

| Control | Effect |
|---|---|
| **Font family** dropdown | Change the typeface |
| **Font size** field + **−** / **+** | Adjust size (8–200 px) |
| **B** | Toggle bold |
| **I** | Toggle italic |
| **Colour square** | Change text colour (native colour picker) |
| **≡ ≡≡ ≡** | Set alignment to left / centre / right |

### Image element

| Control | Effect |
|---|---|
| **URL input** | Paste an image URL and press Enter or blur to load |
| **Upload button** | Open a file picker to upload a local image |
| **Fit dropdown** | Set object-fit: Cover / Contain / Fill |

### Arrow element

| Control | Effect |
|---|---|
| **— → ← ↔** buttons | Set arrowhead position: none / end / start / both |
| **Stroke width** field + **−** / **+** | Adjust line thickness (1–20 px) |
| **Colour square** | Change stroke colour |

### Table element

| Control | Effect |
|---|---|
| **+ Row** | Append a new data row |
| **− Row** | Remove the last data row |
| **+ Col** | Append a new column |
| **− Col** | Remove the last column |

## Applying changes to multiple elements

When two or more elements of the **same type** are selected, every toolbar change applies to all of them simultaneously. For example, changing the font size while three text elements are selected updates all three.

## Delete button

A **trash-can (🗑) delete button** is always present at the right end of the element controls (to the left of the pin button). Clicking it removes all selected elements from the canvas and clears the selection. See [Deleting Elements](Deleting-Elements).

## Pin toggle

A **pin icon (📌)** at the far right of the toolbar lets you keep the toolbar always visible:

| State | Tooltip | Behaviour |
|---|---|---|
| Unpinned (default) | "Pin toolbar" | Toolbar shows/hides with the selection (standard behaviour) |
| Pinned | "Unpin toolbar" | Toolbar always occupies its 40 px row; never causes a layout shift |

When pinned and the selection is cleared (or becomes mixed-type), the toolbar stays visible but shows the last-selected element's controls at **40 % opacity** and non-interactive. This lets you see what you last had selected without accidentally triggering changes.

> The pin state persists while you stay in the browser session (including navigating between pages). It resets on a full page refresh.

### Behaviour in pinned mode

| Selection | Controls state |
|---|---|
| Active, single element | Live and interactive |
| Active, same-type multi | Live and interactive |
| Empty | Dimmed (last snapshot), non-interactive |
| Mixed types | Dimmed (last snapshot), non-interactive |

Clicking a dimmed control has no effect. The pin button itself is never dimmed.
