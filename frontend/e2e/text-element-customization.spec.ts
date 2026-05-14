import { expect, Page, test } from '@playwright/test'
import { mockApiRoutes } from './mock-api'

const EDITOR_URL = '/editor/test-design'
const DEFAULT_TEXT = 'Double-click to edit'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function addTextElement(page: Page) {
  await page.getByTitle('Text').click()
}

async function getTextElement(page: Page) {
  return page.locator('[data-testid="text-element"]').first()
}

async function enterEditMode(page: Page) {
  const el = await getTextElement(page)
  await el.click()
  await el.dblclick()
  return page.locator('[contenteditable="true"]')
}

async function clickCanvasBackground(page: Page) {
  await page.locator('.bg-gray-100').click({ position: { x: 10, y: 10 }, force: true })
}

/** Drag from the centre of `from` by (dx, dy) screen pixels. */
async function dragBy(
  page: Page,
  from: ReturnType<Page['locator']>,
  dx: number,
  dy: number,
  steps = 20
) {
  const box = await from.boundingBox()
  const cx = box!.x + box!.width / 2
  const cy = box!.y + box!.height / 2
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx + dx, cy + dy, { steps })
  await page.mouse.up()
}

/** Drag a resize handle from its centre by (dx, dy) screen pixels. */
async function dragHandle(
  page: Page,
  handleLocator: ReturnType<Page['locator']>,
  dx: number,
  dy: number,
  steps = 20
) {
  const box = await handleLocator.boundingBox()
  const cx = box!.x + box!.width / 2
  const cy = box!.y + box!.height / 2
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx + dx, cy + dy, { steps })
  await page.mouse.up()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('02 – Text Element Customisation', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
    await page.goto(EDITOR_URL)
  })

  // =========================================================================
  // AC 1 — dragging a selected element repositions it
  // =========================================================================

  test('AC1: dragging a selected text element moves it to a new position', async ({ page }) => {
    await addTextElement(page)
    const el = await getTextElement(page)
    await expect(el).toHaveCSS('outline-style', 'solid')

    const before = await el.boundingBox()
    await dragBy(page, el, 120, 80)
    const after = await el.boundingBox()

    expect(after!.x).toBeGreaterThan(before!.x + 50)
    expect(after!.y).toBeGreaterThan(before!.y + 50)
  })

  // =========================================================================
  // AC 2 — dragging does not deselect or enter edit mode
  // =========================================================================

  test('AC2: dragging does not deselect the element', async ({ page }) => {
    await addTextElement(page)
    const el = await getTextElement(page)

    await dragBy(page, el, 100, 60)

    await expect(el).toHaveCSS('outline-style', 'solid')
  })

  test('AC2: dragging does not enter editing mode', async ({ page }) => {
    await addTextElement(page)
    const el = await getTextElement(page)

    await dragBy(page, el, 100, 60)

    await expect(page.locator('[contenteditable="true"]')).not.toBeAttached()
  })

  // =========================================================================
  // AC 4 — resize handles visible when selected; hidden when deselected or editing
  // =========================================================================

  test('AC4: resize handles appear at all four corners when the element is selected', async ({
    page,
  }) => {
    await addTextElement(page)

    // Element is auto-selected on insertion
    await expect(page.getByTestId('resize-handle-tl')).toBeVisible()
    await expect(page.getByTestId('resize-handle-tr')).toBeVisible()
    await expect(page.getByTestId('resize-handle-bl')).toBeVisible()
    await expect(page.getByTestId('resize-handle-br')).toBeVisible()
  })

  test('AC4: resize handles disappear when the element is deselected', async ({ page }) => {
    await addTextElement(page)
    await clickCanvasBackground(page)

    await expect(page.getByTestId('resize-handle-tl')).not.toBeAttached()
    await expect(page.getByTestId('resize-handle-tr')).not.toBeAttached()
    await expect(page.getByTestId('resize-handle-bl')).not.toBeAttached()
    await expect(page.getByTestId('resize-handle-br')).not.toBeAttached()
  })

  test('AC4: resize handles are hidden when editing mode is entered via double-click', async ({
    page,
  }) => {
    await addTextElement(page)
    await expect(page.getByTestId('resize-handle-tl')).toBeVisible()

    await enterEditMode(page)

    await expect(page.getByTestId('resize-handle-tl')).not.toBeAttached()
    await expect(page.getByTestId('resize-handle-tr')).not.toBeAttached()
    await expect(page.getByTestId('resize-handle-bl')).not.toBeAttached()
    await expect(page.getByTestId('resize-handle-br')).not.toBeAttached()
  })

  test('AC4: outline is dashed in editing mode confirming handles are replaced by edit state', async ({
    page,
  }) => {
    await addTextElement(page)
    await enterEditMode(page)

    const wrapper = page.locator('[contenteditable="true"]').locator('..')
    await expect(wrapper).toHaveCSS('outline-style', 'dashed')
  })

  test('AC4: resize handles are restored when editing mode exits via Escape', async ({ page }) => {
    await addTextElement(page)
    await enterEditMode(page)
    await expect(page.getByTestId('resize-handle-tl')).not.toBeAttached()

    await page.keyboard.press('Escape')

    await expect(page.getByTestId('resize-handle-tl')).toBeVisible()
    await expect(page.getByTestId('resize-handle-tr')).toBeVisible()
    await expect(page.getByTestId('resize-handle-bl')).toBeVisible()
    await expect(page.getByTestId('resize-handle-br')).toBeVisible()
  })

  test('AC4: resize handles are visible after re-selecting an element that was in edit mode', async ({
    page,
  }) => {
    await addTextElement(page)
    await enterEditMode(page)
    await page.keyboard.type('Some text')

    // Blur by clicking canvas — exits edit mode and deselects
    await clickCanvasBackground(page)

    // Re-select the element — should be in selected (non-editing) state
    const el = await getTextElement(page)
    await el.click()

    await expect(page.getByTestId('resize-handle-tl')).toBeVisible()
    await expect(page.locator('[contenteditable="true"]')).not.toBeAttached()
  })

  // =========================================================================
  // AC 5 — corner handles resize the element; min 40 × 20 px; surface-bounded
  // =========================================================================

  test('AC5: dragging the br handle grows the element width and height', async ({ page }) => {
    await addTextElement(page)
    const el = await getTextElement(page)
    const before = await el.boundingBox()

    await dragHandle(page, page.getByTestId('resize-handle-br'), 80, 40)

    const after = await el.boundingBox()
    expect(after!.width).toBeGreaterThan(before!.width + 40)
    expect(after!.height).toBeGreaterThan(before!.height + 20)
  })

  test('AC5: dragging the tl handle shrinks the element and moves its top-left origin', async ({
    page,
  }) => {
    await addTextElement(page)
    const el = await getTextElement(page)
    const before = await el.boundingBox()

    await dragHandle(page, page.getByTestId('resize-handle-tl'), 40, 10)

    const after = await el.boundingBox()
    // x increases (left edge moved right) and width decreases
    expect(after!.x).toBeGreaterThan(before!.x + 20)
    expect(after!.width).toBeLessThan(before!.width - 20)
  })

  test('AC5: dragging the tr handle grows width and moves the top edge', async ({ page }) => {
    await addTextElement(page)
    const el = await getTextElement(page)
    const before = await el.boundingBox()

    await dragHandle(page, page.getByTestId('resize-handle-tr'), 60, 0)

    const after = await el.boundingBox()
    // x is unchanged (right edge only); width grows
    expect(after!.width).toBeGreaterThan(before!.width + 30)
    expect(Math.abs(after!.x - before!.x)).toBeLessThan(5)
  })

  test('AC5: dragging the bl handle moves the left edge and grows height', async ({ page }) => {
    await addTextElement(page)
    const el = await getTextElement(page)
    const before = await el.boundingBox()

    await dragHandle(page, page.getByTestId('resize-handle-bl'), 0, 40)

    const after = await el.boundingBox()
    // y is unchanged (bottom edge only); height grows
    expect(after!.height).toBeGreaterThan(before!.height + 20)
    expect(Math.abs(after!.y - before!.y)).toBeLessThan(5)
  })

  test('AC5: element remains selected after resizing (outline stays solid)', async ({ page }) => {
    await addTextElement(page)
    const el = await getTextElement(page)

    await dragHandle(page, page.getByTestId('resize-handle-br'), 60, 30)

    await expect(el).toHaveCSS('outline-style', 'solid')
  })

  test('AC5: resizing does not enter editing mode', async ({ page }) => {
    await addTextElement(page)

    await dragHandle(page, page.getByTestId('resize-handle-br'), 60, 30)

    await expect(page.locator('[contenteditable="true"]')).not.toBeAttached()
  })

  // =========================================================================
  // AC 6 — text reflows naturally when the element width is changed
  // =========================================================================

  test('AC6: element bounding box width increases after dragging the br handle right', async ({
    page,
  }) => {
    await addTextElement(page)
    const el = await getTextElement(page)
    const before = await el.boundingBox()

    await dragHandle(page, page.getByTestId('resize-handle-br'), 100, 0)

    const after = await el.boundingBox()
    expect(after!.width).toBeGreaterThan(before!.width + 50)
  })

  test('AC6: text content remains visible inside the element after the width is reduced', async ({
    page,
  }) => {
    await addTextElement(page)
    const el = await getTextElement(page)

    // Shrink width by dragging tl rightward
    await dragHandle(page, page.getByTestId('resize-handle-tl'), 40, 0)

    await expect(el).toBeAttached()
    await expect(page.getByText(DEFAULT_TEXT)).toBeVisible()
  })

  test('AC6: element applies word-break so text wraps within narrowed bounds', async ({ page }) => {
    await addTextElement(page)
    const el = await getTextElement(page)

    await expect(el).toHaveCSS('word-break', 'break-word')
    await expect(el).toHaveCSS('overflow', 'hidden')
  })

  // =========================================================================
  // AC 7 — contextual toolbar visibility
  // =========================================================================

  test('AC7: contextual toolbar with text controls appears when a text element is selected', async ({
    page,
  }) => {
    await addTextElement(page)

    await expect(page.getByTestId('contextual-toolbar')).toBeVisible()
    await expect(page.getByLabel('Font family')).toBeVisible()
    await expect(page.getByLabel('Font size')).toBeVisible()
    await expect(page.getByLabel('Bold')).toBeVisible()
    await expect(page.getByLabel('Italic')).toBeVisible()
    await expect(page.getByLabel('Text color')).toBeVisible()
  })

  test('AC7: contextual toolbar is hidden when nothing is selected', async ({ page }) => {
    await addTextElement(page)
    await clickCanvasBackground(page)

    await expect(page.getByTestId('contextual-toolbar')).not.toBeAttached()
  })

  // =========================================================================
  // AC 8 — font family
  // =========================================================================

  test('AC8: changing the font family updates the element font immediately', async ({ page }) => {
    await addTextElement(page)
    const el = await getTextElement(page)

    await page.getByLabel('Font family').selectOption('Arial, sans-serif')

    await expect(el).toHaveCSS('font-family', /Arial/)
  })

  // =========================================================================
  // AC 9 — font size
  // =========================================================================

  test('AC9: clicking the + button increments the font size by one', async ({ page }) => {
    await addTextElement(page)
    const el = await getTextElement(page)

    await expect(el).toHaveCSS('font-size', '16px')

    await page.getByLabel('Increase font size').click()

    await expect(el).toHaveCSS('font-size', '17px')
  })

  test('AC9: clicking the − button decrements the font size by one', async ({ page }) => {
    await addTextElement(page)
    const el = await getTextElement(page)

    await page.getByLabel('Decrease font size').click()

    await expect(el).toHaveCSS('font-size', '15px')
  })

  // =========================================================================
  // AC 10 — bold
  // =========================================================================

  test('AC10: clicking Bold applies bold weight and marks the button active', async ({ page }) => {
    await addTextElement(page)
    const el = await getTextElement(page)
    const boldBtn = page.getByLabel('Bold')

    await expect(boldBtn).toHaveAttribute('aria-pressed', 'false')
    await boldBtn.click()

    await expect(boldBtn).toHaveAttribute('aria-pressed', 'true')
    await expect(el).toHaveCSS('font-weight', '700')
  })

  test('AC10: clicking Bold a second time removes bold', async ({ page }) => {
    await addTextElement(page)
    const el = await getTextElement(page)
    const boldBtn = page.getByLabel('Bold')

    await boldBtn.click()
    await expect(el).toHaveCSS('font-weight', '700')

    await boldBtn.click()
    await expect(el).toHaveCSS('font-weight', '400')
  })

  // =========================================================================
  // AC 11 — italic
  // =========================================================================

  test('AC11: clicking Italic applies italic style and marks the button active', async ({ page }) => {
    await addTextElement(page)
    const el = await getTextElement(page)
    const italicBtn = page.getByLabel('Italic')

    await expect(italicBtn).toHaveAttribute('aria-pressed', 'false')
    await italicBtn.click()

    await expect(italicBtn).toHaveAttribute('aria-pressed', 'true')
    await expect(el).toHaveCSS('font-style', 'italic')
  })

  test('AC11: clicking Italic a second time removes italic', async ({ page }) => {
    await addTextElement(page)
    const el = await getTextElement(page)
    const italicBtn = page.getByLabel('Italic')

    await italicBtn.click()
    await expect(el).toHaveCSS('font-style', 'italic')

    await italicBtn.click()
    await expect(el).toHaveCSS('font-style', 'normal')
  })

  // =========================================================================
  // AC 13 — alignment
  // =========================================================================

  test('AC13: clicking Align center updates text-align and marks the button active', async ({
    page,
  }) => {
    await addTextElement(page)
    const el = await getTextElement(page)

    await page.getByLabel('Align center').click()

    await expect(page.getByLabel('Align center')).toHaveAttribute('aria-pressed', 'true')
    await expect(el).toHaveCSS('text-align', 'center')
  })

  test('AC13: clicking Align right updates text-align and marks the button active', async ({
    page,
  }) => {
    await addTextElement(page)
    const el = await getTextElement(page)

    await page.getByLabel('Align right').click()

    await expect(page.getByLabel('Align right')).toHaveAttribute('aria-pressed', 'true')
    await expect(el).toHaveCSS('text-align', 'right')
  })

  test('AC13: the initially active alignment button is Align left', async ({ page }) => {
    await addTextElement(page)

    await expect(page.getByLabel('Align left')).toHaveAttribute('aria-pressed', 'true')
  })

  // =========================================================================
  // AC 15 — multiple elements retain independent formatting and dimensions
  // =========================================================================

  test('AC15: two elements retain their individual font sizes independently', async ({ page }) => {
    // Add element 1 and bump its font size twice (16 → 18px)
    await addTextElement(page)
    await page.getByLabel('Increase font size').click()
    await page.getByLabel('Increase font size').click()
    await clickCanvasBackground(page)

    // Add element 2 — inherits default (16px)
    await addTextElement(page)
    await clickCanvasBackground(page)

    const firstEl = page.locator('[data-testid="text-element"]').nth(0)
    const secondEl = page.locator('[data-testid="text-element"]').nth(1)

    await expect(firstEl).toHaveCSS('font-size', '18px')
    await expect(secondEl).toHaveCSS('font-size', '16px')
  })

  test('AC15: two elements retain their individual dimensions independently', async ({ page }) => {
    // Add element 1 and resize it wider
    await addTextElement(page)
    const firstEl = page.locator('[data-testid="text-element"]').nth(0)
    await dragHandle(page, page.getByTestId('resize-handle-br'), 100, 0)
    const firstBox = await firstEl.boundingBox()
    await clickCanvasBackground(page)

    // Add element 2 — gets the default width
    await addTextElement(page)
    const secondEl = page.locator('[data-testid="text-element"]').nth(1)
    const secondBox = await secondEl.boundingBox()
    await clickCanvasBackground(page)

    // Element 1 must be noticeably wider than element 2
    expect(firstBox!.width).toBeGreaterThan(secondBox!.width + 50)
  })

  test('AC15: bold applied to one element does not affect another', async ({ page }) => {
    // Add element 1 and make it bold
    await addTextElement(page)
    await page.getByLabel('Bold').click()
    await clickCanvasBackground(page)

    // Add element 2 (default — not bold)
    await addTextElement(page)
    await clickCanvasBackground(page)

    const firstEl = page.locator('[data-testid="text-element"]').nth(0)
    const secondEl = page.locator('[data-testid="text-element"]').nth(1)

    await expect(firstEl).toHaveCSS('font-weight', '700')
    await expect(secondEl).toHaveCSS('font-weight', '400')
  })
})
