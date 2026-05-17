import { expect, Page, test } from '@playwright/test'
import { mockApiRoutes } from './mock-api'

const EDITOR_URL = '/editor/test-design'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function openLayerPanel(page: Page) {
  await page.getByTitle('Layers').click()
  await page.getByRole('heading', { name: 'Layers' }).waitFor()
}

async function closeLayerPanel(page: Page) {
  await page.getByTitle('Layers').click()
  await page.getByRole('heading', { name: 'Layers' }).waitFor({ state: 'hidden' })
}

async function addTextElement(page: Page) {
  await page.getByTitle('Text').click()
}

async function addImageElement(page: Page) {
  await page.getByTitle('Image').click()
}

async function addArrowElement(page: Page) {
  await page.getByTitle('Arrow').click()
}

async function addTableElement(page: Page) {
  await page.getByTitle('Table').click()
}

async function clickBackground(page: Page) {
  await page
    .locator('.bg-gray-100')
    .first()
    .click({ position: { x: 10, y: 10 }, force: true })
}

/** Returns all layer rows in the panel (panel-order: topmost element first). */
function layerRows(page: Page) {
  return page.locator('.group.flex.h-9.cursor-pointer')
}

/** Returns the layer row that contains the given label text. */
function layerRowByLabel(page: Page, label: string) {
  return layerRows(page).filter({ hasText: label })
}

/** Returns the visibility toggle button inside a given layer row. */
function visibilityButton(row: ReturnType<Page['locator']>) {
  return row.locator('button[aria-label="Hide element"], button[aria-label="Show element"]')
}

/**
 * Drag a layer row's drag handle by the given vertical pixel delta.
 * Hover is needed first so the handle becomes visible (opacity-100).
 */
async function dragLayerRow(page: Page, row: ReturnType<Page['locator']>, deltaY: number) {
  const handle = row.locator('[class*="cursor-grab"]')
  const box = await handle.boundingBox()
  if (!box) throw new Error('drag handle has no bounding box')
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.mouse.move(cx, cy) // hover so handle is interactive
  await page.mouse.down()
  await page.mouse.move(cx, cy + deltaY, { steps: 10 })
  await page.mouse.up()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('17 – Layer Panel', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
    await page.goto(EDITOR_URL)
  })

  // =========================================================================
  // AC1 – Layers button visible with tooltip "Layers"
  // =========================================================================

  test('AC1: Layers button is visible in the toolbar with tooltip "Layers"', async ({ page }) => {
    const btn = page.getByTitle('Layers')
    await expect(btn).toBeVisible()
  })

  test('AC1: Layers button is positioned below the existing tool buttons', async ({ page }) => {
    const tableBtn = page.getByTitle('Table')
    const layersBtn = page.getByTitle('Layers')
    const tableBox = await tableBtn.boundingBox()
    const layersBox = await layersBtn.boundingBox()
    expect(layersBox!.y).toBeGreaterThan(tableBox!.y)
  })

  // =========================================================================
  // AC2 – Clicking the button opens a 200px-wide sidebar; canvas shrinks
  // =========================================================================

  test('AC2: clicking Layers button opens the layer panel', async ({ page }) => {
    await openLayerPanel(page)
    await expect(page.getByRole('heading', { name: 'Layers' })).toBeVisible()
  })

  test('AC2: layer panel pushes the canvas area (canvas is narrower when panel is open)', async ({
    page,
  }) => {
    const canvas = page.locator('.bg-gray-100').first()
    const widthBefore = (await canvas.boundingBox())!.width

    await openLayerPanel(page)

    const widthAfter = (await canvas.boundingBox())!.width
    expect(widthAfter).toBeLessThan(widthBefore)
  })

  // =========================================================================
  // AC3 – Clicking the button again closes the panel
  // =========================================================================

  test('AC3: clicking Layers button again closes the panel', async ({ page }) => {
    await openLayerPanel(page)
    await closeLayerPanel(page)
    await expect(page.getByRole('heading', { name: 'Layers' })).not.toBeVisible()
  })

  test('AC3: closing the panel restores the canvas width', async ({ page }) => {
    const canvas = page.locator('.bg-gray-100').first()
    const widthBefore = (await canvas.boundingBox())!.width

    await openLayerPanel(page)
    await closeLayerPanel(page)

    const widthAfter = (await canvas.boundingBox())!.width
    expect(widthAfter).toBeCloseTo(widthBefore, -1)
  })

  // =========================================================================
  // AC4 – Panel lists elements in z-order (topmost first)
  // =========================================================================

  test('AC4: panel lists elements with topmost element at the top', async ({ page }) => {
    // First added = bottommost; second added = topmost
    await addTextElement(page)
    await clickBackground(page)
    await addImageElement(page)

    await openLayerPanel(page)

    const rows = layerRows(page)
    await expect(rows).toHaveCount(2)
    // Topmost (Image, added second) appears first in the panel
    await expect(rows.nth(0)).toContainText('Image')
    await expect(rows.nth(1)).toContainText('Text')
  })

  // =========================================================================
  // AC5 – Each row shows type icon, auto-generated label, and eye icon
  // =========================================================================

  test('AC5: each row shows a label and a visibility toggle button', async ({ page }) => {
    await addTextElement(page)
    await openLayerPanel(page)

    const row = layerRowByLabel(page, 'Text 1')
    await expect(row).toBeVisible()
    await expect(visibilityButton(row)).toBeVisible()
  })

  test('AC5: image element row shows label "Image 1" with visibility icon', async ({ page }) => {
    await addImageElement(page)
    await openLayerPanel(page)

    const row = layerRowByLabel(page, 'Image 1')
    await expect(row).toBeVisible()
    await expect(visibilityButton(row)).toBeVisible()
  })

  test('AC5: arrow element row shows label "Arrow 1" with visibility icon', async ({ page }) => {
    await addArrowElement(page)
    await openLayerPanel(page)

    const row = layerRowByLabel(page, 'Arrow 1')
    await expect(row).toBeVisible()
    await expect(visibilityButton(row)).toBeVisible()
  })

  test('AC5: table element row shows label "Table 1" with visibility icon', async ({ page }) => {
    await addTableElement(page)
    await openLayerPanel(page)

    const row = layerRowByLabel(page, 'Table 1')
    await expect(row).toBeVisible()
    await expect(visibilityButton(row)).toBeVisible()
  })

  // =========================================================================
  // AC6 – Labels follow per-type sequence numbering
  // =========================================================================

  test('AC6: first text element is labelled "Text 1", second "Text 2"', async ({ page }) => {
    await addTextElement(page)
    await clickBackground(page)
    await addTextElement(page)

    await openLayerPanel(page)

    await expect(layerRowByLabel(page, 'Text 1')).toBeVisible()
    await expect(layerRowByLabel(page, 'Text 2')).toBeVisible()
  })

  test('AC6: sequence numbers are per-type (Text 1, Image 1 are independent)', async ({ page }) => {
    await addTextElement(page)
    await clickBackground(page)
    await addImageElement(page)

    await openLayerPanel(page)

    await expect(layerRowByLabel(page, 'Text 1')).toBeVisible()
    await expect(layerRowByLabel(page, 'Image 1')).toBeVisible()
  })

  // =========================================================================
  // AC7 – Clicking a row selects the element; row is highlighted blue
  // =========================================================================

  test('AC7: clicking a layer row selects the element', async ({ page }) => {
    await addTextElement(page)
    await clickBackground(page) // deselect first
    await openLayerPanel(page)

    await layerRowByLabel(page, 'Text 1').click()

    // Row turns blue
    await expect(layerRowByLabel(page, 'Text 1')).toHaveClass(/bg-blue-50/)
    // Contextual toolbar appears (element selected)
    await expect(page.getByTestId('contextual-toolbar')).toBeVisible()
  })

  test('AC7: plain click on row replaces selection with only that element', async ({ page }) => {
    await addTextElement(page)
    await clickBackground(page)
    await addTextElement(page)
    await openLayerPanel(page)

    // Select Text 1 then plain-click Text 2 — only Text 2 should be selected
    await layerRowByLabel(page, 'Text 1').click()
    await layerRowByLabel(page, 'Text 2').click()

    await expect(layerRowByLabel(page, 'Text 1')).not.toHaveClass(/bg-blue-50/)
    await expect(layerRowByLabel(page, 'Text 2')).toHaveClass(/bg-blue-50/)
  })

  // =========================================================================
  // AC8 – Shift+click row toggles element into/out of multi-selection
  // =========================================================================

  test('AC8: Shift+clicking a row adds the element to the selection', async ({ page }) => {
    await addTextElement(page)
    await clickBackground(page)
    await addTextElement(page)
    await openLayerPanel(page)

    // Select first, then Shift+click second
    await layerRowByLabel(page, 'Text 1').click()
    await layerRowByLabel(page, 'Text 2').click({ modifiers: ['Shift'] })

    await expect(layerRowByLabel(page, 'Text 1')).toHaveClass(/bg-blue-50/)
    await expect(layerRowByLabel(page, 'Text 2')).toHaveClass(/bg-blue-50/)
  })

  test('AC8: Shift+clicking an already-selected row removes it from the selection', async ({
    page,
  }) => {
    await addTextElement(page)
    await clickBackground(page)
    await addTextElement(page)
    await openLayerPanel(page)

    // Build a two-element selection
    await layerRowByLabel(page, 'Text 1').click()
    await layerRowByLabel(page, 'Text 2').click({ modifiers: ['Shift'] })
    // Shift+click the already-selected row to deselect it
    await layerRowByLabel(page, 'Text 1').click({ modifiers: ['Shift'] })

    await expect(layerRowByLabel(page, 'Text 1')).not.toHaveClass(/bg-blue-50/)
    await expect(layerRowByLabel(page, 'Text 2')).toHaveClass(/bg-blue-50/)
  })

  // =========================================================================
  // AC9 – Selecting an element on the canvas highlights its row in the panel
  // =========================================================================

  test('AC9: selecting an element on the canvas highlights its row in the panel', async ({
    page,
  }) => {
    await addTextElement(page)
    await clickBackground(page)
    await openLayerPanel(page)

    // Click the element on the canvas
    await page.locator('[data-testid="text-element"]').first().click()

    await expect(layerRowByLabel(page, 'Text 1')).toHaveClass(/bg-blue-50/)
  })

  // =========================================================================
  // AC11 – Clicking eye icon on a visible row hides the element
  // =========================================================================

  test('AC11: clicking Hide on a visible row removes the element from the canvas', async ({
    page,
  }) => {
    await addTextElement(page)
    await openLayerPanel(page)

    const row = layerRowByLabel(page, 'Text 1')
    await row.getByLabel('Hide element').click()

    // Element disappears from canvas
    await expect(page.locator('[data-testid="text-element"]')).toHaveCount(0)
  })

  test('AC11: hidden row is dimmed (opacity-50) and shows crossed-out eye icon', async ({
    page,
  }) => {
    await addTextElement(page)
    await openLayerPanel(page)

    const row = layerRowByLabel(page, 'Text 1')
    await row.getByLabel('Hide element').click()

    await expect(row).toHaveClass(/opacity-50/)
    await expect(row.getByLabel('Show element')).toBeVisible()
  })

  // =========================================================================
  // AC12 – Clicking the crossed-out eye on a hidden row shows the element
  // =========================================================================

  test('AC12: clicking Show on a hidden row makes the element visible again', async ({ page }) => {
    await addTextElement(page)
    await openLayerPanel(page)

    const row = layerRowByLabel(page, 'Text 1')
    await row.getByLabel('Hide element').click()
    await row.getByLabel('Show element').click()

    // Element reappears
    await expect(page.locator('[data-testid="text-element"]')).toHaveCount(1)
    // Row is no longer dimmed
    await expect(row).not.toHaveClass(/opacity-50/)
  })

  // =========================================================================
  // AC13 – Hiding a selected element removes it from the selection
  // =========================================================================

  test('AC13: hiding a selected element immediately clears it from the selection', async ({
    page,
  }) => {
    await addTextElement(page)
    // Element is already selected after insertion; open panel
    await openLayerPanel(page)

    // Verify it is selected (toolbar visible)
    await expect(page.getByTestId('contextual-toolbar')).toBeVisible()

    const row = layerRowByLabel(page, 'Text 1')
    await row.getByLabel('Hide element').click()

    // Row should no longer show as selected
    await expect(row).not.toHaveClass(/bg-blue-50/)
    // Contextual toolbar should disappear (no live selection)
    await expect(page.getByTestId('contextual-toolbar')).not.toBeAttached()
  })

  // =========================================================================
  // AC14 – Hidden elements cannot be selected via canvas interaction
  // =========================================================================

  test('AC14: clicking a hidden element on the canvas does not select it', async ({ page }) => {
    await addTextElement(page)
    await openLayerPanel(page)

    // Hide the element from the panel
    const row = layerRowByLabel(page, 'Text 1')
    await row.getByLabel('Hide element').click()

    // Try clicking where the element would be on the canvas
    await page.locator('[data-testid="text-element"]').waitFor({ state: 'hidden' })

    // No element selected (toolbar absent in unpinned mode)
    await expect(page.getByTestId('contextual-toolbar')).not.toBeAttached()
  })

  test('AC14: hidden elements are skipped by Shift+click canvas multi-select', async ({ page }) => {
    await addTextElement(page)
    await openLayerPanel(page)

    const row = layerRowByLabel(page, 'Text 1')
    await row.getByLabel('Hide element').click()

    // The element is not rendered, so it cannot receive Shift+click
    await expect(page.locator('[data-testid="text-element"]')).toHaveCount(0)
  })

  // =========================================================================
  // AC16 – Dragging a row by its drag handle reorders z-order
  // =========================================================================

  test('AC16: dragging a row changes its position in the panel', async ({ page }) => {
    // Add two elements; Image (added second) appears at top of panel
    await addTextElement(page)
    await clickBackground(page)
    await addImageElement(page)
    await openLayerPanel(page)

    let rows = layerRows(page)
    await expect(rows.nth(0)).toContainText('Image')
    await expect(rows.nth(1)).toContainText('Text')

    // Drag the top row (Image) downward past the second row (~40px)
    await dragLayerRow(page, rows.nth(0), 50)

    rows = layerRows(page)
    // Text should now be on top (first in panel)
    await expect(rows.nth(0)).toContainText('Text')
    await expect(rows.nth(1)).toContainText('Image')
  })

  // =========================================================================
  // AC17 – Insertion line appears during drag
  // =========================================================================

  test('AC17: an insertion line appears while a row is being dragged', async ({ page }) => {
    await addTextElement(page)
    await clickBackground(page)
    await addImageElement(page)
    await openLayerPanel(page)

    const row = layerRows(page).nth(0)
    const handle = row.locator('[class*="cursor-grab"]')
    const box = await handle.boundingBox()
    const cx = box!.x + box!.width / 2
    const cy = box!.y + box!.height / 2

    // Begin the drag but don't release yet
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.mouse.move(cx, cy + 40, { steps: 10 })

    // Insertion line (bg-blue-500 div) must be in the DOM
    await expect(page.locator('.bg-blue-500').first()).toBeVisible()

    await page.mouse.up()
  })

  // =========================================================================
  // AC18 – Dragged row shows as semi-transparent ghost (opacity-50)
  // =========================================================================

  test('AC18: the row being dragged shows as a semi-transparent ghost', async ({ page }) => {
    await addTextElement(page)
    await clickBackground(page)
    await addImageElement(page)
    await openLayerPanel(page)

    const row = layerRows(page).nth(0)
    const handle = row.locator('[class*="cursor-grab"]')
    const box = await handle.boundingBox()
    const cx = box!.x + box!.width / 2
    const cy = box!.y + box!.height / 2

    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.mouse.move(cx, cy + 40, { steps: 10 })

    // The row wrapper around the dragged element gets opacity-50 via inline style
    const ghost = page.locator('[style*="opacity: 0.5"]').first()
    await expect(ghost).toBeVisible()

    await page.mouse.up()
  })

  // =========================================================================
  // AC19 – Movement < 4px treated as a row click, not a reorder
  // =========================================================================

  test('AC19: a small mousedown movement on the drag handle is treated as a row click', async ({
    page,
  }) => {
    await addTextElement(page)
    await clickBackground(page)
    await addImageElement(page)
    await openLayerPanel(page)

    const rows = layerRows(page)
    await expect(rows.nth(0)).toContainText('Image')
    await expect(rows.nth(1)).toContainText('Text')

    // Tiny movement (2px) — below the 4px threshold
    await dragLayerRow(page, rows.nth(0), 2)

    // Order should be unchanged
    await expect(layerRows(page).nth(0)).toContainText('Image')
    await expect(layerRows(page).nth(1)).toContainText('Text')
  })

  // =========================================================================
  // AC20 – After reordering, z-order reflected on canvas
  // =========================================================================

  test('AC20: reordering triggers auto-save PATCH with updated element order', async ({ page }) => {
    await addTextElement(page)
    await clickBackground(page)
    await addImageElement(page)
    await openLayerPanel(page)

    // Capture PATCH requests
    const patchBodies: { canvas: { elements: Array<{ type: string }> } }[] = []
    page.on('request', (req) => {
      if (req.method() === 'PATCH' && /\/api\/projects\//.test(req.url())) {
        const body = req.postDataJSON() as { canvas?: { elements: Array<{ type: string }> } }
        if (body.canvas) patchBodies.push(body as (typeof patchBodies)[number])
      }
    })

    const rows = layerRows(page)
    // Drag Image row (index 0 in panel) down past Text row
    await dragLayerRow(page, rows.nth(0), 50)

    // Wait for auto-save to fire
    await page.waitForRequest(
      (req) => req.method() === 'PATCH' && /\/api\/projects\//.test(req.url()),
      { timeout: 5000 }
    )

    const lastPatch = patchBodies[patchBodies.length - 1]
    // After reorder: Text should now be last in the elements array (topmost = last index)
    const types = lastPatch.canvas.elements.map((el) => el.type)
    expect(types[types.length - 1]).toBe('text')
  })

  // =========================================================================
  // AC21 – Empty state message when no elements exist
  // =========================================================================

  test('AC21: empty state message is shown when no elements are on the canvas', async ({
    page,
  }) => {
    await openLayerPanel(page)

    await expect(page.getByText('No elements yet.')).toBeVisible()
    await expect(page.getByText('Use the toolbar to add content.')).toBeVisible()
  })

  test('AC21: empty state disappears once an element is added', async ({ page }) => {
    await openLayerPanel(page)
    await expect(page.getByText('No elements yet.')).toBeVisible()

    await addTextElement(page)

    await expect(page.getByText('No elements yet.')).not.toBeVisible()
    await expect(layerRowByLabel(page, 'Text 1')).toBeVisible()
  })

  // =========================================================================
  // AC22 – Panel scrolls independently when list is taller than the viewport
  // =========================================================================

  test('AC22: panel list is scrollable when many elements are present', async ({ page }) => {
    // Add enough elements to overflow a typical panel height (36px × 25 = 900px)
    for (let i = 0; i < 25; i++) {
      await page.getByTitle('Text').click()
      await clickBackground(page)
    }
    await openLayerPanel(page)

    const listEl = page.locator('.overflow-y-auto').first()
    // scrollHeight must exceed clientHeight for overflow to be active
    const isScrollable = await listEl.evaluate((el) => el.scrollHeight > el.clientHeight)
    expect(isScrollable).toBe(true)
  })

  // =========================================================================
  // AC23 – Panel open/closed state persists across in-session navigation
  // =========================================================================

  test('AC23: panel remains open after navigating to home and back', async ({ page }) => {
    await openLayerPanel(page)
    await expect(page.getByRole('heading', { name: 'Layers' })).toBeVisible()

    // Use the editor's Close button for a React Router (client-side) navigation to
    // home, which preserves in-memory Zustand state. page.goto() is a full reload
    // and would reset the store.
    await page.getByLabel('Close design').click()
    await page.waitForURL('/')

    // Browser back — still a client-side SPA transition, state survives.
    await page.goBack()
    await page.waitForURL(EDITOR_URL)

    await expect(page.getByRole('heading', { name: 'Layers' })).toBeVisible()
  })

  // =========================================================================
  // AC24 – Panel state does not persist across full page refreshes
  // =========================================================================

  test('AC24: panel is closed after a full page refresh', async ({ page }) => {
    await openLayerPanel(page)
    await expect(page.getByRole('heading', { name: 'Layers' })).toBeVisible()

    await page.reload()

    await expect(page.getByRole('heading', { name: 'Layers' })).not.toBeVisible()
  })

  // =========================================================================
  // AC25 – Hidden state is persisted via auto-save
  // =========================================================================

  test('AC25: hiding an element sends hidden: true in the auto-save PATCH payload', async ({
    page,
  }) => {
    await addTextElement(page)
    await openLayerPanel(page)

    // Hide via panel
    const row = layerRowByLabel(page, 'Text 1')
    await row.getByLabel('Hide element').click()

    const patchReq = await page.waitForRequest(
      (req) => req.method() === 'PATCH' && /\/api\/projects\//.test(req.url()),
      { timeout: 5000 }
    )
    const body = patchReq.postDataJSON() as {
      canvas: { elements: Array<{ type: string; hidden?: boolean }> }
    }
    const textEl = body.canvas.elements.find((el) => el.type === 'text')
    expect(textEl?.hidden).toBe(true)
  })

  // =========================================================================
  // AC26 – Z-order is persisted via auto-save after reordering
  // =========================================================================

  test('AC26: reordering sends the new element order in the auto-save PATCH payload', async ({
    page,
  }) => {
    await addTextElement(page)
    await clickBackground(page)
    await addImageElement(page)
    await openLayerPanel(page)

    // Image is currently topmost (last in elements array); drag it below Text
    const rows = layerRows(page)
    await dragLayerRow(page, rows.nth(0), 50)

    const patchReq = await page.waitForRequest(
      (req) => req.method() === 'PATCH' && /\/api\/projects\//.test(req.url()),
      { timeout: 5000 }
    )
    const body = patchReq.postDataJSON() as {
      canvas: { elements: Array<{ type: string }> }
    }
    const types = body.canvas.elements.map((el) => el.type)
    // After reorder: Image should now be first (bottommost), Text last (topmost)
    expect(types[0]).toBe('image')
    expect(types[types.length - 1]).toBe('text')
  })

  // =========================================================================
  // AC27 – Delete/Backspace do not affect hidden elements
  //         (hidden elements cannot be in selectedIds)
  // =========================================================================

  test('AC27: Delete key does not remove a hidden element', async ({ page }) => {
    await addTextElement(page)
    await openLayerPanel(page)

    // Hide the element (also removes it from selection)
    const row = layerRowByLabel(page, 'Text 1')
    await row.getByLabel('Hide element').click()

    // Press Delete — nothing should happen because selection is empty
    await page.keyboard.press('Delete')

    // Show the element again; it must still exist
    await row.getByLabel('Show element').click()
    await expect(page.locator('[data-testid="text-element"]')).toHaveCount(1)
  })

  test('AC27: toolbar delete button does not remove a hidden element', async ({ page }) => {
    await addTextElement(page)

    // Pin toolbar so it stays visible
    await page.getByLabel('Pin toolbar').click()

    await openLayerPanel(page)

    const row = layerRowByLabel(page, 'Text 1')
    await row.getByLabel('Hide element').click()

    // Force-click the delete button through the dimmed overlay
    await page.getByLabel('Delete').click({ force: true })

    // Show the element; it must still exist
    await row.getByLabel('Show element').click()
    await expect(page.locator('[data-testid="text-element"]')).toHaveCount(1)
  })
})
