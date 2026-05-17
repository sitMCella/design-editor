# Getting Started

## Creating a new design

1. Open the application at the home page.
2. Click the **+ New design** button in the centre of the page.
3. A modal dialog appears with a **Design name** field pre-filled with `"Untitled design"`. The text is already selected — just start typing to replace it.
4. Click **Create** (or press `Enter`) to open the editor.

> **Tip:** The **Create** button stays disabled until you type at least one non-whitespace character. Press `Escape` or click outside the modal (or **Cancel**) to go back without creating anything.

## Opening an existing design

The home page shows a **Recent designs** grid of up to 6 projects, ordered by the most recently updated.

- Click any card to open that project in the editor.
- While the project is loading a spinner appears on the card.

If you have more than 6 projects, a **"View all designs (N)"** link appears below the grid. Click it to open the **All designs** modal, which lists every project using the same card layout.

### Reloading the editor directly

If you navigate directly to `/editor/:id` (e.g. by refreshing the browser or following a bookmarked URL) the editor fetches the project automatically and restores the canvas. A full-page spinner is shown while the load is in progress. If the load fails, an error message appears with a **Go home** link.

## Closing the editor

Click the **✕ Close** button at the left end of the editor header at any time. You are taken back to the home page immediately — no confirmation prompt appears. If there are unsaved changes the editor will have auto-saved them within the previous 2 seconds; the **Unsaved changes** indicator in the header disappears once the save completes.

## Auto-save

Every change you make to the canvas is saved automatically. The editor waits **2 seconds** after your last edit before sending a save request to the backend. The header shows **Unsaved changes** while a save is pending and clears it once the save succeeds.
