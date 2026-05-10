# Feature Spec: Design Project Lifecycle (Create & Close)

## Summary

Two complementary entry/exit points for a design session. The home page provides a "New design" call-to-action that opens a modal prompting the user to name their project, then navigates to the editor. The editor header provides a "Close" button that ends the session and returns the user to the home page. Together they define the full lifecycle of a design project in this iteration.

## Scope

**In scope**
- Home page layout with a prominent "New design" button
- Modal dialog: project name input + "Create" / "Cancel" actions
- Name is required; "Create" is disabled until at least one non-whitespace character is entered
- On confirm: create a new design in the canvas store (with the supplied name), navigate to `/editor/:designId`
- Generated `designId` uses `nanoid()`
- "Close" button in the editor header that navigates back to `/`
- State is local-only — no backend persistence in this iteration

**Out of scope (future iterations)**
- Listing previously saved designs
- Templates selection during creation
- Choosing canvas dimensions
- Duplicating an existing design
- Backend persistence (`POST /designs`)
- Unsaved-changes confirmation prompt before closing
- User authentication

---

## UI Layout

### Home page

```
┌─────────────────────────────────────────────────────────────────┐
│  App Header  (logo / product name)                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                                                                 │
│              ┌──────────────────────┐                          │
│              │   + New design       │  ← primary CTA button    │
│              └──────────────────────┘                          │
│                                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- The page is vertically and horizontally centred around the CTA button.
- A short tagline sits above the button: `"Start creating something great"`.
- The button uses a filled primary style (blue, matching `#3B82F6`).

### Editor header

```
┌─────────────────────────────────────────────────────────────────┐
│  [✕]  My Design Name          Unsaved changes                   │
└─────────────────────────────────────────────────────────────────┘
```

- A "Close" button (`✕` icon, or a text label `"Close"`) sits at the left edge of the editor header.
- Clicking it navigates immediately to `/` without any confirmation prompt.
- The design name and unsaved-changes indicator remain in the header as before.

### New design modal

```
┌────────────────────────────────────┐
│  New design                        │
│                                    │
│  Design name                       │
│  ┌──────────────────────────────┐  │
│  │  Untitled design             │  │
│  └──────────────────────────────┘  │
│                                    │
│          [Cancel]  [Create]        │
└────────────────────────────────────┘
```

- Modal is centred on screen with a semi-transparent backdrop.
- The name input is pre-filled with `"Untitled design"` and the text is fully selected on open so the user can type immediately.
- "Create" button is primary (blue); "Cancel" is secondary (ghost/outline).
- "Create" is disabled (`opacity-50`, non-interactive) when the trimmed input value is empty.
- Pressing `Enter` when the input is focused and valid submits the form (equivalent to clicking "Create").
- Pressing `Escape` dismisses the modal without creating a design.

---

## Behaviour

| Action | Outcome |
|---|---|
| Click "New design" | Modal opens; name input focused and text selected |
| Type a name | Input value updates; "Create" becomes enabled |
| Clear the input | "Create" becomes disabled |
| Click "Cancel" | Modal closes; no design created |
| Press `Escape` | Modal closes; no design created |
| Click "Create" (valid name) | Design created in store; modal closes; navigate to `/editor/:designId` |
| Press `Enter` (valid name focused) | Same as clicking "Create" |
| Click backdrop | Modal closes; no design created |
| Click "Close" in editor header | Canvas store is left as-is; navigate to `/` |

---

## Data / Types

### Canvas store initialisation

When the user confirms, the canvas store is initialised with:

```ts
{
  designId: nanoid(),
  name: trimmedInputValue,
  elements: [],
  selectedIds: [],
  zoom: 1,
  panX: 0,
  panY: 0,
  isDirty: false,
}
```

No new types are introduced. The existing `CanvasStore` shape (from the state-management spec) is sufficient.

---

## State

### Where state lives

| State | Location |
|---|---|
| Modal open/closed | Local `useState` in `HomePage` |
| Input value | Local `useState` in `NewDesignModal` |
| Canvas store init | Called once on "Create" confirm |

No UI store changes are required for this feature.

---

## Navigation

**Opening a design** — after the store is initialised, `HomePage` calls React Router's `useNavigate` hook:

```ts
navigate(`/editor/${designId}`)
```

The editor route (`/editor/:designId`) already exists; `EditorPage` reads `designId` from `useParams`.

**Closing a design** — the "Close" button in `EditorPage` calls:

```ts
navigate('/')
```

No store reset is performed on close; the canvas store retains its state until the next `initDesign` call.

---

## Components

| Component | Location | Responsibility |
|---|---|---|
| `HomePage` | `src/pages/HomePage.tsx` | Page layout; renders tagline + "New design" button; owns modal open/close state |
| `NewDesignModal` | `src/components/NewDesignModal.tsx` | Modal dialog: name input, Create/Cancel actions, keyboard handling |
| `EditorPage` | `src/pages/EditorPage.tsx` | Editor shell; gains a "Close" button in the header that navigates to `/` |

---

## Acceptance Criteria

1. The home page displays a centred "New design" button with the tagline `"Start creating something great"`.
2. Clicking "New design" opens the modal with the name input pre-filled with `"Untitled design"` and the text selected.
3. The "Create" button is disabled when the input is empty or contains only whitespace.
4. The "Create" button is enabled when the input contains at least one non-whitespace character.
5. Clicking "Create" with a valid name initialises the canvas store with that name and navigates to `/editor/:designId`.
6. Clicking "Cancel" closes the modal without creating a design.
7. Pressing `Escape` while the modal is open closes it without creating a design.
8. Clicking the backdrop closes the modal without creating a design.
9. Pressing `Enter` while the input is focused and valid creates the design (same as clicking "Create").
10. Navigating directly back to `/` after entering the editor does not retain any stale modal state.
11. The editor header contains a "Close" button that is always visible while a design is open.
12. Clicking "Close" navigates to `/` (the home page) without any confirmation prompt.
