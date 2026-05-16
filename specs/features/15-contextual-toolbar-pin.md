# Feature Spec: Contextual Toolbar Pin

## Summary

Add a pin toggle to the right end of the contextual toolbar. When the toolbar is unpinned (the default) it shows and hides exactly as today — visible when an element is selected, hidden when the selection is empty or mixed. When pinned, the toolbar stays visible at all times: it continues to show live controls for the current selection, and when the selection is cleared it retains the last-selected element's controls in a dimmed, non-interactive state. A single click on the pin icon toggles between the two modes. The pin state persists for the lifetime of the browser session.

## Scope

**In scope**
- Pin icon button at the right end of the `ContextualToolbar` strip
- Unpinned mode (default): existing show/hide behaviour unchanged
- Pinned mode: toolbar always occupies its `40px` strip in the layout; never causes a layout shift
- Pinned + active selection: controls are live and interactive, identical to unpinned selected state
- Pinned + empty selection: controls reflect the last-selected element; all inputs and buttons are visually dimmed (`opacity-40`) and non-interactive (`pointer-events: none`)
- Pinned + mixed-type selection: controls reflect the last single-type snapshot; dimmed and non-interactive
- Pin state stored in the UI store; survives navigation between pages within the session
- Pin state is not persisted to the backend and resets on page refresh

**Out of scope**
- Persisting the pin state across sessions (localStorage, backend)
- A "frozen" properties panel for the last selected element when nothing is selected in unpinned mode
- Applying dimmed controls as an edit action (clicking a dimmed control has no effect)
- Separate pin state per element type

---

## UI Layout

### Unpinned (default)

```
┌─────────────────────────────────────────────────────────────────┐
│  Editor Header  [− 100% +]                                      │
├─────────────────────────────────────────────────────────────────┤
│  [Font family ▾] [14 − +] [B] [I] [■] [≡ ≡≡ ≡]        [📌]   │  ← toolbar visible (element selected)
├──────┬──────────────────────────────────────────────────────────┤
│      │                     Canvas                               │
└──────┴──────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────────┐
│  Editor Header  [− 100% +]                                      │
├──────┬──────────────────────────────────────────────────────────┤  ← toolbar hidden (no selection)
│      │                     Canvas                               │
└──────┴──────────────────────────────────────────────────────────┘
```

### Pinned

```
┌─────────────────────────────────────────────────────────────────┐
│  Editor Header  [− 100% +]                                      │
├─────────────────────────────────────────────────────────────────┤
│  [Font family ▾] [14 − +] [B] [I] [■] [≡ ≡≡ ≡]        [📌]   │  ← live controls (element selected)
├──────┬──────────────────────────────────────────────────────────┤
│      │                     Canvas                               │
└──────┴──────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────────┐
│  Editor Header  [− 100% +]                                      │
├─────────────────────────────────────────────────────────────────┤
│  [Font family ▾] [14 − +] [B] [I] [■] [≡ ≡≡ ≡]        [📌]   │  ← dimmed, non-interactive (no selection)
├──────┬──────────────────────────────────────────────────────────┤
│      │                     Canvas                               │
└──────┴──────────────────────────────────────────────────────────┘
```

The toolbar strip is always `40px` tall in pinned mode so the canvas area never resizes as the user selects and deselects elements.

---

## Pin Icon Button

- Position: right end of the toolbar strip, separated from the element controls by a `1px` vertical divider (`border-l border-gray-200`).
- Icon: a pin/pushpin SVG glyph, `16 × 16 px`.
- Tooltip on hover: `"Pin toolbar"` when unpinned; `"Unpin toolbar"` when pinned.
- Active (pinned) state: icon fill changes from `text-gray-400` to `text-blue-500`; background becomes `bg-blue-50`.
- The button is always visible whenever the toolbar is rendered — it is never hidden or dimmed.
- Clicking the button calls `toggleToolbarPin()` on the UI store.

---

## Behaviour

| Toolbar pinned | Selection state | Toolbar visible | Controls state |
|---|---|---|---|
| No | Empty | No | — |
| No | Single element | Yes | Live |
| No | Multi, same type | Yes | Live |
| No | Multi, mixed types | No | — |
| Yes | Empty | Yes | Dimmed (last snapshot) |
| Yes | Single element | Yes | Live |
| Yes | Multi, same type | Yes | Live |
| Yes | Multi, mixed types | Yes | Dimmed (last snapshot) |

### Last-selection snapshot

When the toolbar transitions from a live state to a dimmed state (selection becomes empty or mixed while pinned), the `ContextualToolbar` freezes the last element snapshot it was displaying. This snapshot is local component state (`useState`) — it is not stored in the UI store or canvas store.

The snapshot is updated whenever the active selection changes to a valid (non-empty, non-mixed) state. It is never cleared — it persists until a new valid selection replaces it, or the user unpins the toolbar.

### Layout stability

In pinned mode the toolbar row is always present in the DOM. It is rendered unconditionally; the controls inside it switch between live and dimmed. This guarantees the canvas area below never changes height due to toolbar visibility changes, eliminating the layout shift that occurs in unpinned mode.

In unpinned mode the existing conditional rendering is preserved (`null` when hidden), keeping the canvas area expanded when no element is selected.

---

## State changes

### UI store addition

```ts
type UIStore = {
  activeTool: 'select' | 'text' | 'image' | 'arrow' | 'table'
  activePanel: 'layers' | 'assets' | 'templates' | null
  isExportModalOpen: boolean
  isToolbarPinned: boolean   // NEW — default false
}
```

New action:

```ts
toggleToolbarPin(): void
```

Implementation:

```ts
toggleToolbarPin: () =>
  set((state) => {
    state.isToolbarPinned = !state.isToolbarPinned
  }),
```

---

## Components

| Component | Location | Change |
|---|---|---|
| `ContextualToolbar` | `src/components/editor/ContextualToolbar.tsx` | Reads `isToolbarPinned` from UI store; manages `lastSnapshot` local state; renders dimmed overlay when pinned + no live selection; renders pin button always |
| `EditorPage` | `src/pages/EditorPage.tsx` | Renders `ContextualToolbar` unconditionally (previously conditional); `ContextualToolbar` itself controls whether it returns content or `null` |
| `uiStore` | `src/stores/uiStore.ts` | Adds `isToolbarPinned` field and `toggleToolbarPin` action |

No changes to element components, canvas store, or any other component.

---

## Dimmed state rendering

When the toolbar is in the dimmed state (pinned, no live selection), the controls are rendered from `lastSnapshot` and a transparent overlay div is placed over the controls area (excluding the pin button) to block pointer events:

```tsx
{isDimmed && (
  <div
    className="absolute inset-0 right-10"   // right-10 leaves the pin button interactive
    style={{ pointerEvents: 'all' }}
  />
)}
<div className={isDimmed ? 'opacity-40' : undefined}>
  {/* element controls rendered from lastSnapshot */}
</div>
```

The pin button sits outside the dimmed overlay so it remains always clickable.

---

## Acceptance Criteria

1. A pin icon button is visible at the right end of the contextual toolbar whenever the toolbar is rendered.
2. In unpinned mode the toolbar appears when an element (or a same-type multi-selection) is selected and disappears when the selection is cleared — identical to the existing behaviour.
3. Clicking the pin icon toggles pinned mode; the icon turns blue to indicate the active state.
4. The tooltip reads `"Pin toolbar"` when unpinned and `"Unpin toolbar"` when pinned.
5. In pinned mode the toolbar strip is always present in the layout at `40px` height; the canvas area does not resize when the selection changes.
6. In pinned mode with an active single-element selection, all controls are live and interactive.
7. In pinned mode with an active same-type multi-selection, all controls are live and interactive and apply changes to all selected elements.
8. In pinned mode with an empty selection, the toolbar is visible, the controls reflect the last element that was selected, and the controls are visually dimmed (`opacity-40`) and non-interactive.
9. In pinned mode with a mixed-type selection, the toolbar is visible, the controls reflect the last valid single-type snapshot, and the controls are dimmed and non-interactive.
10. Clicking a dimmed control has no effect on the canvas state.
11. The pin button itself is never dimmed and is always clickable regardless of selection state.
12. Unpinning while the toolbar is in the dimmed state hides the toolbar immediately (reverts to standard show/hide behaviour).
13. The pin state is preserved when the user navigates from the editor to the home page and back within the same session.
14. The pin state does not reset to unpinned on a full page refresh.
15. The dimmed snapshot updates whenever the selection changes to a new valid (non-empty, non-mixed) state.
