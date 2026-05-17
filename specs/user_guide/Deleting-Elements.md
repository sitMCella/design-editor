# Deleting Elements

You can remove any selected element (or group of selected elements) using the toolbar button or the keyboard. Deletion is immediate — there is no confirmation prompt and no undo in the current version.

## Toolbar delete button

The **🗑 trash-can button** is always visible in the contextual toolbar, to the right of the element-specific controls and to the left of the pin button. It has a **red hover state** to signal that it is a destructive action.

- Click it to delete all elements currently in `selectedIds`.
- After deletion the selection is cleared and the toolbar hides (or enters the dimmed pinned state if the toolbar is pinned).

When the toolbar is in the pinned-dimmed state (no live selection), the delete button is non-interactive.

## Keyboard shortcut

Press `Delete` or `Backspace` to delete all selected elements when:

1. At least one element is selected.
2. No element is in an edit mode (see suppression rules below).

### Suppression — when the shortcut is ignored

The `Delete` / `Backspace` key is suppressed (does not delete elements) if the browser focus is inside any text-entry context:

| Context | Focus location |
|---|---|
| Text element inline edit | `contentEditable` div |
| Table cell inline edit | `contentEditable` div |
| Image URL input | `<input>` field |
| Font-size or stroke-width input | `<input>` field |
| Any other `<input>`, `<textarea>`, or `<select>` | Any form field |

This means you can safely press `Delete`/`Backspace` to edit text without accidentally removing elements.

## What happens to connected arrows

When you delete an element that has arrows connected to it (via sticky endpoint connections), the arrow itself is **not** deleted — it remains on the canvas. The dangling connection reference is cleared automatically, and the arrow endpoint stays at its last computed position as a free (unconnected) coordinate.

## After deletion

- Deleted elements are immediately removed from the canvas.
- The change is saved to the backend by the auto-save mechanism within 2 seconds.
- Reloading the editor confirms the elements are gone.
