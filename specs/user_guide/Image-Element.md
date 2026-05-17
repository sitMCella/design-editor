# Image Element

## Adding an image element

Click the **⬚** (picture frame) button in the left toolbar. A new image element appears at the centre of the canvas showing a placeholder: grey background, a mountain-and-sun icon, and the label **"Add image"**. The active tool immediately reverts to **Select** mode.

## Selecting and deselecting

| Gesture | Result |
|---|---|
| **Click** the element | Select it — a solid blue outline appears |
| **Click** the canvas background | Deselect |

## Moving (drag to reposition)

1. Click to select the image element.
2. Press and hold the left mouse button on the element body and drag at least **4 px**.
3. The element follows the cursor. Release to place it.

Cursor: **grab** on hover, **grabbing** while dragging.

## Resizing

When an image element is selected, four blue square handles appear at its corners.

| Handle | Anchor |
|---|---|
| Top-left | Bottom-right corner |
| Top-right | Bottom-left corner |
| Bottom-left | Top-right corner |
| Bottom-right | Top-left corner |

Minimum size is **40 × 40 px**. The image fills the new dimensions according to the current **object-fit** setting.

## Setting an image source

When the image element is selected, the **Contextual Toolbar** shows image-specific controls:

### Paste a URL

1. Click the **URL input field** (shows placeholder `"Paste image URL…"`).
2. Type or paste an `https://` image URL.
3. Press `Enter` or click away — the image loads immediately.

When a URL is entered, the backend downloads and stores the image locally so it remains available even if the original URL goes offline.

### Upload a local file

1. Click the **Upload** button (⬆ icon).
2. A file picker opens — select any image file from your computer.
3. The image is read as a data URL and displayed immediately.

> If `src` is a data URL from an upload, the URL input shows `"Uploaded file"` (read-only).

### Object-fit

The **Fit** dropdown controls how the image fills its frame:

| Value | Behaviour |
|---|---|
| `Cover` | Fill the frame, cropping as needed (default) |
| `Contain` | Fit entirely within the frame, with letterboxing |
| `Fill` | Stretch to exactly fill the frame |

## Crop / Pan mode

Double-click a **selected** image element to enter **crop/pan mode**:

- The outline becomes **dashed blue**.
- Corner resize handles are hidden.
- The cursor inside the element changes to **move**.

In crop/pan mode you can drag the image within its fixed frame to reposition the visible area:

1. Press and hold the left mouse button inside the element.
2. Drag to shift the image within the frame.
3. Release to apply the new `objectPosition`.

Exit crop/pan mode by:
- Pressing `Escape`
- Clicking outside the element (also deselects)
