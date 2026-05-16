import { expect, Page, test } from '@playwright/test'
import { mockApiRoutes } from './mock-api'

const EDITOR_URL = '/editor/test-design'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function addTextElement(page: Page) {
  await page.getByTitle('Text').click()
}

async function addArrowElement(page: Page) {
  await page.getByTitle('Arrow').click()
}

async function clickBackground(page: Page) {
  await page.locator('.bg-gray-100').first().click({ position: { x: 10, y: 10 }, force: true })
}

async function getTextElement(page: Page) {
  return page.locator('[data-testid="text-element"]').first()
}

async function getSecondTextElement(page: Page) {
  return page.locator('[data-testid="text-element"]').nth(1)
}

async function pinToolbar(page: Page) {
  await page.getByLabel('Pin toolbar').click()
}

async function unpinToolbar(page: Page) {
  await page.getByLabel('Unpin toolbar').click()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('15 – Contextual Toolbar Pin', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
    await page.goto(EDITOR_URL)
  })

  // =========================================================================
  // AC1 — pin button visible whenever toolbar renders
  // =========================================================================

  test('AC1: pin button is visible when an element is selected (unpinned)', async ({ page }) => {
    await addTextElement(page)
    await expect(page.getByLabel('Pin toolbar')).toBeVisible()
  })

  test('AC1: pin button is visible when pinned with no selection', async ({ page }) => {
    await addTextElement(page)
    await pinToolbar(page)
    await clickBackground(page)
    await expect(page.getByLabel('Unpin toolbar')).toBeVisible()
  })

  // =========================================================================
  // AC2 — unpinned mode: existing show/hide behaviour unchanged
  // =========================================================================

  test('AC2: toolbar is hidden in unpinned mode when nothing is selected', async ({ page }) => {
    await addTextElement(page)
    await clickBackground(page)
    await expect(page.getByTestId('contextual-toolbar')).not.toBeAttached()
  })

  test('AC2: toolbar is visible in unpinned mode when an element is selected', async ({ page }) => {
    await addTextElement(page)
    await expect(page.getByTestId('contextual-toolbar')).toBeVisible()
  })

  test('AC2: toolbar is hidden in unpinned mode when selection is mixed type', async ({ page }) => {
    await addTextElement(page)
    await addArrowElement(page)
    // Shift-click the text element to create a mixed-type multi-selection
    const textEl = await getTextElement(page)
    await textEl.click({ modifiers: ['Shift'] })
    await expect(page.getByTestId('contextual-toolbar')).not.toBeAttached()
  })

  // =========================================================================
  // AC3 — clicking pin icon toggles pinned mode; icon turns blue
  // =========================================================================

  test('AC3: clicking the pin button sets pinned mode (label changes to Unpin toolbar)', async ({
    page,
  }) => {
    await addTextElement(page)
    await expect(page.getByLabel('Pin toolbar')).toBeVisible()
    await pinToolbar(page)
    await expect(page.getByLabel('Unpin toolbar')).toBeVisible()
    await expect(page.getByLabel('Pin toolbar')).not.toBeAttached()
  })

  test('AC3: clicking the pin button again reverts to unpinned (label changes back)', async ({
    page,
  }) => {
    await addTextElement(page)
    await pinToolbar(page)
    await unpinToolbar(page)
    await expect(page.getByLabel('Pin toolbar')).toBeVisible()
    await expect(page.getByLabel('Unpin toolbar')).not.toBeAttached()
  })

  test('AC3: pin button has blue styling when pinned', async ({ page }) => {
    await addTextElement(page)
    await pinToolbar(page)
    const btn = page.getByLabel('Unpin toolbar')
    await expect(btn).toHaveClass(/text-blue-500/)
  })

  // =========================================================================
  // AC4 — tooltip text reflects pin state
  // =========================================================================

  test('AC4: tooltip reads "Pin toolbar" when unpinned', async ({ page }) => {
    await addTextElement(page)
    await expect(page.getByLabel('Pin toolbar')).toHaveAttribute('title', 'Pin toolbar')
  })

  test('AC4: tooltip reads "Unpin toolbar" when pinned', async ({ page }) => {
    await addTextElement(page)
    await pinToolbar(page)
    await expect(page.getByLabel('Unpin toolbar')).toHaveAttribute('title', 'Unpin toolbar')
  })

  // =========================================================================
  // AC5 — pinned mode: toolbar always occupies its 40px strip
  // =========================================================================

  test('AC5: toolbar remains in the DOM at 40px height after selection is cleared when pinned', async ({
    page,
  }) => {
    await addTextElement(page)
    await pinToolbar(page)

    const toolbarBefore = await page.getByTestId('contextual-toolbar').boundingBox()
    await clickBackground(page)

    await expect(page.getByTestId('contextual-toolbar')).toBeVisible()
    const toolbarAfter = await page.getByTestId('contextual-toolbar').boundingBox()

    expect(Math.round(toolbarAfter!.height)).toBe(Math.round(toolbarBefore!.height))
  })

  test('AC5: canvas area does not shift vertically when selection changes while pinned', async ({
    page,
  }) => {
    await addTextElement(page)
    await pinToolbar(page)

    const canvasBefore = await page.locator('.bg-gray-100').first().boundingBox()
    await clickBackground(page)
    const canvasAfter = await page.locator('.bg-gray-100').first().boundingBox()

    expect(canvasAfter!.y).toBe(canvasBefore!.y)
  })

  // =========================================================================
  // AC6 — pinned + active single selection: controls are live
  // =========================================================================

  test('AC6: controls are live and interactive when pinned with one element selected', async ({
    page,
  }) => {
    await addTextElement(page)
    await pinToolbar(page)

    const el = await getTextElement(page)
    await expect(el).toHaveCSS('font-size', '16px')

    await page.getByLabel('Increase font size').click()
    await expect(el).toHaveCSS('font-size', '17px')
  })

  // =========================================================================
  // AC7 — pinned + same-type multi-selection: live controls apply to all
  // =========================================================================

  test('AC7: pinned + same-type multi-selection shows live controls', async ({ page }) => {
    await addTextElement(page)
    await clickBackground(page)
    await addTextElement(page)

    const firstEl = page.locator('[data-testid="text-element"]').nth(0)
    await firstEl.click({ modifiers: ['Shift'] })

    await pinToolbar(page)

    await expect(page.getByLabel('Font family')).toBeVisible()
    await expect(page.getByTestId('contextual-toolbar')).toBeVisible()
  })

  test('AC7: font size change applies to all selected elements when pinned', async ({ page }) => {
    await addTextElement(page)
    await clickBackground(page)
    await addTextElement(page)

    const firstEl = page.locator('[data-testid="text-element"]').nth(0)
    const secondEl = page.locator('[data-testid="text-element"]').nth(1)

    await firstEl.click({ modifiers: ['Shift'] })
    await pinToolbar(page)

    await page.getByLabel('Increase font size').click()

    await expect(firstEl).toHaveCSS('font-size', '17px')
    await expect(secondEl).toHaveCSS('font-size', '17px')
  })

  // =========================================================================
  // AC8 — pinned + empty selection: toolbar visible, controls dimmed
  // =========================================================================

  test('AC8: toolbar stays visible when pinned and selection is cleared', async ({ page }) => {
    await addTextElement(page)
    await pinToolbar(page)
    await clickBackground(page)

    await expect(page.getByTestId('contextual-toolbar')).toBeVisible()
  })

  test('AC8: controls are dimmed (opacity-40) when pinned and selection is empty', async ({
    page,
  }) => {
    await addTextElement(page)
    await pinToolbar(page)
    await clickBackground(page)

    const controlsArea = page
      .getByTestId('contextual-toolbar')
      .locator('.opacity-40')
      .first()
    await expect(controlsArea).toBeVisible()
  })

  test('AC8: snapshot controls reflect the last selected element when dimmed', async ({ page }) => {
    await addTextElement(page)

    // Bump font size so we have a distinct value to check in the snapshot
    await page.getByLabel('Increase font size').click()
    await page.getByLabel('Increase font size').click()
    // size is now 18

    await pinToolbar(page)
    await clickBackground(page)

    // Controls show the snapshot: font size should still read 18
    const sizeInput = page.getByLabel('Font size', { exact: true }) as ReturnType<Page['locator']>
    await expect(sizeInput).toHaveValue('18')
  })

  // =========================================================================
  // AC9 — pinned + mixed selection: toolbar visible, dimmed snapshot
  // =========================================================================

  test('AC9: toolbar stays visible when pinned and selection becomes mixed type', async ({
    page,
  }) => {
    await addTextElement(page)
    await pinToolbar(page)
    await clickBackground(page)

    // Add an arrow and shift-click the text to make a mixed selection
    await addArrowElement(page)
    const textEl = await getTextElement(page)
    await textEl.click({ modifiers: ['Shift'] })

    await expect(page.getByTestId('contextual-toolbar')).toBeVisible()
  })

  test('AC9: controls are dimmed when pinned with a mixed-type selection', async ({ page }) => {
    await addTextElement(page)
    await pinToolbar(page)

    // Add arrow then shift-click text to form a mixed selection
    await addArrowElement(page)
    const textEl = await getTextElement(page)
    await textEl.click({ modifiers: ['Shift'] })

    await expect(
      page.getByTestId('contextual-toolbar').locator('.opacity-40').first()
    ).toBeVisible()
  })

  // =========================================================================
  // AC10 — clicking a dimmed control has no effect on canvas state
  // =========================================================================

  test('AC10: clicking Bold while controls are dimmed does not change element font-weight', async ({
    page,
  }) => {
    await addTextElement(page)
    const el = await getTextElement(page)
    await expect(el).toHaveCSS('font-weight', '400')

    await pinToolbar(page)
    await clickBackground(page)

    // The overlay intercepts pointer events; the click should be swallowed
    await page.getByLabel('Bold').click({ force: true })

    // Re-select to confirm element was not mutated
    await el.click()
    await expect(el).toHaveCSS('font-weight', '400')
  })

  // =========================================================================
  // AC11 — pin button is never dimmed; always clickable
  // =========================================================================

  test('AC11: pin button is not inside the dimmed area and remains clickable', async ({ page }) => {
    await addTextElement(page)
    await pinToolbar(page)
    await clickBackground(page)

    // Toolbar is dimmed, but pin button should still be outside the dimmed container
    const pinBtn = page.getByLabel('Unpin toolbar')
    await expect(pinBtn).toBeVisible()
    // The pin button itself must NOT carry the opacity-40 class
    await expect(pinBtn).not.toHaveClass(/opacity-40/)
  })

  test('AC11: clicking the pin button while controls are dimmed successfully unpins', async ({
    page,
  }) => {
    await addTextElement(page)
    await pinToolbar(page)
    await clickBackground(page)

    await unpinToolbar(page)

    // After unpinning with no selection the toolbar should disappear
    await expect(page.getByTestId('contextual-toolbar')).not.toBeAttached()
  })

  // =========================================================================
  // AC12 — unpinning while dimmed hides the toolbar immediately
  // =========================================================================

  test('AC12: toolbar disappears immediately after unpinning when no element is selected', async ({
    page,
  }) => {
    await addTextElement(page)
    await pinToolbar(page)
    await clickBackground(page)

    await expect(page.getByTestId('contextual-toolbar')).toBeVisible()
    await unpinToolbar(page)
    await expect(page.getByTestId('contextual-toolbar')).not.toBeAttached()
  })

  // =========================================================================
  // AC13 — pin state persists within the session
  // =========================================================================

  test('AC13: pin state survives navigating to the home page and back to the editor', async ({
    page,
  }) => {
    await addTextElement(page)
    await pinToolbar(page)

    // Navigate away to the home page (SPA navigation keeps the store)
    await page.getByRole('link', { name: /close/i }).click()
    await expect(page).toHaveURL('/')

    // Navigate back to the editor
    await page.goto(EDITOR_URL)
    await addTextElement(page)

    // Pin state should still be active (Unpin toolbar label visible)
    await expect(page.getByLabel('Unpin toolbar')).toBeVisible()
  })

  // =========================================================================
  // AC14 — pin state resets to unpinned on a full page refresh
  // =========================================================================

  test('AC14: pin state resets to unpinned after a full page reload', async ({ page }) => {
    await addTextElement(page)
    await pinToolbar(page)

    await page.reload()
    await addTextElement(page)

    // After reload the store is re-initialised; pin should be off
    await expect(page.getByLabel('Pin toolbar')).toBeVisible()
    await expect(page.getByLabel('Unpin toolbar')).not.toBeAttached()
  })

  // =========================================================================
  // AC15 — dimmed snapshot updates when selection changes to a new valid element
  // =========================================================================

  test('AC15: snapshot reflects the most recently selected element after selection is cleared', async ({
    page,
  }) => {
    // Element 1 — default font size (16)
    await addTextElement(page)
    await clickBackground(page)

    // Element 2 — bumped to 20px
    await addTextElement(page)
    await page.getByLabel('Increase font size').click()
    await page.getByLabel('Increase font size').click()
    await page.getByLabel('Increase font size').click()
    await page.getByLabel('Increase font size').click()
    // element 2 is now 20px

    await pinToolbar(page)
    await clickBackground(page)

    // Snapshot should be element 2 (the last selected), not element 1
    const sizeInput = page.getByLabel('Font size', { exact: true }) as ReturnType<Page['locator']>
    await expect(sizeInput).toHaveValue('20')
  })
})
