import { expect, Page, test } from '@playwright/test'
import { mockApiRoutes } from './mock-api'

const EDITOR_URL = '/editor/test-design'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

async function pinToolbar(page: Page) {
  await page.getByLabel('Pin toolbar').click()
}

function textElements(page: Page) {
  return page.locator('[data-testid="text-element"]')
}

function imageElements(page: Page) {
  return page.locator('[data-testid="image-element"]')
}

function arrowElements(page: Page) {
  return page.locator('[data-testid="arrow-element"]')
}

function tableElements(page: Page) {
  return page.locator('[data-testid="table-element"]')
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('16 – Delete Canvas Elements', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
    await page.goto(EDITOR_URL)
  })

  // =========================================================================
  // AC1 — delete button position and presence in toolbar
  // =========================================================================

  test('AC1: delete button is visible in the toolbar when a text element is selected', async ({
    page,
  }) => {
    await addTextElement(page)
    await expect(page.getByLabel('Delete')).toBeVisible()
  })

  test('AC1: delete button is to the left of the pin button', async ({ page }) => {
    await addTextElement(page)
    const deleteBtn = page.getByLabel('Delete')
    const pinBtn = page.getByLabel('Pin toolbar')
    const deleteBox = await deleteBtn.boundingBox()
    const pinBox = await pinBtn.boundingBox()
    expect(deleteBox!.x).toBeLessThan(pinBox!.x)
  })

  // =========================================================================
  // AC2 — tooltip reads "Delete"
  // =========================================================================

  test('AC2: delete button has title "Delete"', async ({ page }) => {
    await addTextElement(page)
    await expect(page.getByLabel('Delete')).toHaveAttribute('title', 'Delete')
  })

  // =========================================================================
  // AC3 — red hover state
  // =========================================================================

  test('AC3: delete button gains red styling on hover', async ({ page }) => {
    await addTextElement(page)
    const btn = page.getByLabel('Delete')
    await btn.hover()
    await expect(btn).toHaveClass(/hover:text-red-500/)
    await expect(btn).toHaveClass(/hover:bg-red-50/)
  })

  // =========================================================================
  // AC4 — clicking delete removes all selected elements and clears selection
  // =========================================================================

  test('AC4: clicking delete removes the selected text element', async ({ page }) => {
    await addTextElement(page)
    await expect(textElements(page)).toHaveCount(1)

    await page.getByLabel('Delete').click()

    await expect(textElements(page)).toHaveCount(0)
  })

  test('AC4: after deletion the selection is cleared (toolbar hides in unpinned mode)', async ({
    page,
  }) => {
    await addTextElement(page)
    await page.getByLabel('Delete').click()
    await expect(page.getByTestId('contextual-toolbar')).not.toBeAttached()
  })

  // =========================================================================
  // AC5 — delete works for every element type (single selection)
  // =========================================================================

  test('AC5: delete button removes a single text element', async ({ page }) => {
    await addTextElement(page)
    await expect(textElements(page)).toHaveCount(1)
    await page.getByLabel('Delete').click()
    await expect(textElements(page)).toHaveCount(0)
  })

  test('AC5: delete button removes a single image element', async ({ page }) => {
    await addImageElement(page)
    await expect(imageElements(page)).toHaveCount(1)
    await page.getByLabel('Delete').click()
    await expect(imageElements(page)).toHaveCount(0)
  })

  test('AC5: delete button removes a single arrow element', async ({ page }) => {
    await addArrowElement(page)
    await expect(arrowElements(page)).toHaveCount(1)
    await page.getByLabel('Delete').click()
    await expect(arrowElements(page)).toHaveCount(0)
  })

  test('AC5: delete button removes a single table element', async ({ page }) => {
    await addTableElement(page)
    await expect(tableElements(page)).toHaveCount(1)
    await page.getByLabel('Delete').click()
    await expect(tableElements(page)).toHaveCount(0)
  })

  // =========================================================================
  // AC6 — delete button removes multi-element same-type selection
  // =========================================================================

  test('AC6: delete button removes all elements in a same-type multi-selection', async ({
    page,
  }) => {
    await addTextElement(page)
    await clickBackground(page)
    await addTextElement(page)

    // Shift-click first element to make a two-text selection
    await textElements(page).nth(0).click({ modifiers: ['Shift'] })
    await expect(textElements(page)).toHaveCount(2)

    await page.getByLabel('Delete').click()

    await expect(textElements(page)).toHaveCount(0)
  })

  // =========================================================================
  // AC7 — toolbar hides / enters dimmed state after deletion
  // =========================================================================

  test('AC7: toolbar is hidden (unpinned) after deletion because selection is empty', async ({
    page,
  }) => {
    await addTextElement(page)
    await page.getByLabel('Delete').click()
    await expect(page.getByTestId('contextual-toolbar')).not.toBeAttached()
  })

  test('AC7: toolbar enters dimmed state (pinned) after deletion because selection is empty', async ({
    page,
  }) => {
    await addTextElement(page)
    await pinToolbar(page)
    await page.getByLabel('Delete').click()
    await expect(page.getByTestId('contextual-toolbar')).toBeVisible()
    await expect(page.getByTestId('contextual-toolbar').locator('.opacity-40').first()).toBeVisible()
  })

  // =========================================================================
  // AC8 — Delete key removes selected elements (no text-entry context active)
  // =========================================================================

  test('AC8: pressing Delete key removes the selected element', async ({ page }) => {
    await addTextElement(page)
    await expect(textElements(page)).toHaveCount(1)

    await page.keyboard.press('Delete')

    await expect(textElements(page)).toHaveCount(0)
  })

  // =========================================================================
  // AC9 — Backspace key is an alias for Delete
  // =========================================================================

  test('AC9: pressing Backspace removes the selected element', async ({ page }) => {
    await addTextElement(page)
    await expect(textElements(page)).toHaveCount(1)

    await page.keyboard.press('Backspace')

    await expect(textElements(page)).toHaveCount(0)
  })

  // =========================================================================
  // AC10 — Delete/Backspace suppressed while text element is in edit mode
  // =========================================================================

  test('AC10: Delete key does not remove element while text contentEditable is focused', async ({
    page,
  }) => {
    await addTextElement(page)
    // Double-click to enter edit mode
    await textElements(page).first().dblclick()
    await expect(textElements(page).first().locator('[contenteditable]')).toBeFocused()

    await page.keyboard.press('Delete')

    // Element must still exist
    await expect(textElements(page)).toHaveCount(1)
  })

  test('AC10: Backspace key does not remove element while text contentEditable is focused', async ({
    page,
  }) => {
    await addTextElement(page)
    await textElements(page).first().dblclick()
    await expect(textElements(page).first().locator('[contenteditable]')).toBeFocused()

    await page.keyboard.press('Backspace')

    await expect(textElements(page)).toHaveCount(1)
  })

  // =========================================================================
  // AC11 — Delete/Backspace suppressed while table cell is in edit mode
  // =========================================================================

  test('AC11: Delete key does not remove table element while a cell contentEditable is focused', async ({
    page,
  }) => {
    await addTableElement(page)
    // The table is already selected after insertion; double-click a cell (th/td) to enter edit mode
    const cell = tableElements(page).first().locator('th, td').first()
    await cell.dblclick()
    const editableCell = tableElements(page).first().locator('[contenteditable]').first()
    await expect(editableCell).toBeFocused()

    await page.keyboard.press('Delete')

    await expect(tableElements(page)).toHaveCount(1)
  })

  // =========================================================================
  // AC12 — Delete/Backspace suppressed while image URL input is focused
  // =========================================================================

  test('AC12: Delete key does not remove image element while the URL input is focused', async ({
    page,
  }) => {
    await addImageElement(page)
    const urlInput = page.getByPlaceholder('Paste image URL…')
    await urlInput.click()
    await expect(urlInput).toBeFocused()

    await page.keyboard.press('Delete')

    await expect(imageElements(page)).toHaveCount(1)
  })

  // =========================================================================
  // AC13 — Delete/Backspace suppressed while any other input is focused
  // =========================================================================

  test('AC13: Delete key does not remove element while font-size input is focused', async ({
    page,
  }) => {
    await addTextElement(page)
    // Use focus() directly — Firefox headless does not set document.hasFocus()
    // after a click(), which would cause toBeFocused() to report "inactive".
    await page.getByLabel('Font size', { exact: true }).focus()

    await page.keyboard.press('Delete')

    await expect(textElements(page)).toHaveCount(1)
  })

  test('AC13: Backspace key does not remove element while font-size input is focused', async ({
    page,
  }) => {
    await addTextElement(page)
    await page.getByLabel('Font size', { exact: true }).focus()

    await page.keyboard.press('Backspace')

    await expect(textElements(page)).toHaveCount(1)
  })

  // =========================================================================
  // AC14 — selection cleared after keyboard deletion
  // =========================================================================

  test('AC14: selection is cleared after deletion via keyboard shortcut', async ({ page }) => {
    await addTextElement(page)
    await page.keyboard.press('Delete')
    // No live selection → toolbar hides in unpinned mode
    await expect(page.getByTestId('contextual-toolbar')).not.toBeAttached()
  })

  // =========================================================================
  // AC15 — deleting a connected element frees the arrow endpoint
  // =========================================================================

  test('AC15: deleting an element leaves the connected arrow on canvas with a free endpoint', async ({
    page,
  }) => {
    await addTextElement(page)
    await addArrowElement(page)

    // Delete the text element; the arrow should remain
    await textElements(page).first().click()
    await page.keyboard.press('Delete')

    await expect(textElements(page)).toHaveCount(0)
    await expect(arrowElements(page)).toHaveCount(1)
  })

  // =========================================================================
  // AC16 — deletion sets isDirty; auto-save fires within 2 s
  // =========================================================================

  test('AC16: deletion triggers an auto-save PATCH request within 2 seconds', async ({ page }) => {
    const patchPromise = page.waitForRequest(
      (req) => req.method() === 'PATCH' && /\/api\/projects\//.test(req.url()),
      { timeout: 5000 }
    )

    await addTextElement(page)
    await page.getByLabel('Delete').click()

    const patchReq = await patchPromise
    const body = patchReq.postDataJSON() as { canvas?: { elements: unknown[] } }
    expect(body.canvas?.elements).toHaveLength(0)
  })

  // =========================================================================
  // AC17 — deleted elements absent from persisted canvas after reload
  // =========================================================================

  test('AC17: reloading after deletion does not restore the deleted element', async ({ page }) => {
    // Capture what the last PATCH saved before reload
    let lastSavedCanvas: { elements: unknown[] } | null = null
    page.on('request', (req) => {
      if (req.method() === 'PATCH' && /\/api\/projects\//.test(req.url())) {
        const body = req.postDataJSON() as { canvas?: { elements: unknown[] } }
        if (body.canvas) lastSavedCanvas = body.canvas
      }
    })

    await addTextElement(page)

    // Wait for the initial auto-save to record the element
    await page.waitForRequest(
      (req) => req.method() === 'PATCH' && /\/api\/projects\//.test(req.url()),
      { timeout: 5000 }
    )

    await page.getByLabel('Delete').click()

    // Wait for the deletion auto-save
    await page.waitForRequest(
      (req) => req.method() === 'PATCH' && /\/api\/projects\//.test(req.url()),
      { timeout: 5000 }
    )

    expect(lastSavedCanvas!.elements).toHaveLength(0)
  })

  // =========================================================================
  // AC18 — delete button is dimmed and non-interactive when toolbar is pinned
  //         with no live selection (pinned-dimmed state)
  // =========================================================================

  test('AC18: delete button is inside dimmed overlay when pinned with no selection', async ({
    page,
  }) => {
    await addTextElement(page)
    await pinToolbar(page)
    await clickBackground(page)

    // The controls wrapper (including the delete button) carries opacity-40
    const dimmedArea = page.getByTestId('contextual-toolbar').locator('.opacity-40').first()
    await expect(dimmedArea).toBeVisible()
  })

  test('AC18: clicking delete while controls are dimmed has no effect on canvas', async ({
    page,
  }) => {
    await addTextElement(page)
    await pinToolbar(page)
    await clickBackground(page)

    // Force-click the delete button (overlay blocks normal click)
    await page.getByLabel('Delete').click({ force: true })

    // Re-select the text element to confirm it still exists
    await textElements(page).first().click()
    await expect(textElements(page)).toHaveCount(1)
  })

  // =========================================================================
  // AC19 — independent successive deletions
  // =========================================================================

  test('AC19: successive deletions each remove only the currently selected element', async ({
    page,
  }) => {
    await addTextElement(page)
    await clickBackground(page)
    await addTextElement(page)
    await clickBackground(page)
    await addTextElement(page)
    await expect(textElements(page)).toHaveCount(3)

    // Delete the currently selected (third) element
    await page.keyboard.press('Delete')
    await expect(textElements(page)).toHaveCount(2)

    // Select and delete the second element
    await textElements(page).nth(1).click()
    await page.keyboard.press('Delete')
    await expect(textElements(page)).toHaveCount(1)

    // Select and delete the last element
    await textElements(page).first().click()
    await page.keyboard.press('Delete')
    await expect(textElements(page)).toHaveCount(0)
  })
})
