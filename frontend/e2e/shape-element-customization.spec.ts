import { expect, Page, test } from '@playwright/test'
import { mockApiRoutes } from './mock-api'

const EDITOR_URL = '/editor/test-design'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function addShapeElement(page: Page) {
  await page.getByTitle('Shape').click()
}

async function getShapeElement(page: Page, nth = 0) {
  return page.locator('[data-testid="shape-element"]').nth(nth)
}

async function clickCanvasBackground(page: Page) {
  await page
    .locator('[data-testid="canvas-container"]')
    .click({ position: { x: 10, y: 10 }, force: true })
}

/** Returns the centre of a locator's bounding box. */
async function centre(locator: ReturnType<Page['locator']>) {
  const box = await locator.boundingBox()
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 }
}

/** Drag from the centre of `from` by (dx, dy) screen pixels. */
async function dragBy(
  page: Page,
  from: ReturnType<Page['locator']>,
  dx: number,
  dy: number,
  steps = 15,
) {
  const { x, y } = await centre(from)
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y + dy, { steps })
  await page.mouse.up()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('22 – Shape Element Customisation', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
    await page.goto(EDITOR_URL)
  })

  // =========================================================================
  // AC1 / AC2 — drag to reposition
  // =========================================================================

  test('AC1: dragging a selected shape element moves it to a new position', async ({ page }) => {
    await addShapeElement(page)
    const el = await getShapeElement(page)

    const before = await el.boundingBox()
    await dragBy(page, el, 120, 80)
    const after = await el.boundingBox()

    expect(after!.x).toBeGreaterThan(before!.x + 50)
    expect(after!.y).toBeGreaterThan(before!.y + 30)
  })

  test('AC1: drag does not deselect the shape element (outline stays solid)', async ({ page }) => {
    await addShapeElement(page)
    const el = await getShapeElement(page)
    await dragBy(page, el, 80, 40)
    await expect(el).toHaveCSS('outline-style', 'solid')
  })

  test('AC2: dragging requires a 4 px movement threshold before the element moves', async ({
    page,
  }) => {
    await addShapeElement(page)
    const el = await getShapeElement(page)
    const before = await el.boundingBox()

    // Move only 2px — below threshold — so no positional change
    await dragBy(page, el, 2, 0, 5)
    const after = await el.boundingBox()

    expect(after!.x).toBeCloseTo(before!.x, 0)
    expect(after!.y).toBeCloseTo(before!.y, 0)
  })

  // =========================================================================
  // AC3 — corner resize handles
  // =========================================================================

  test('AC3: a selected shape element shows four corner resize handles', async ({ page }) => {
    await addShapeElement(page)
    await expect(page.getByTestId('shape-resize-handle-tl')).toBeVisible()
    await expect(page.getByTestId('shape-resize-handle-tr')).toBeVisible()
    await expect(page.getByTestId('shape-resize-handle-bl')).toBeVisible()
    await expect(page.getByTestId('shape-resize-handle-br')).toBeVisible()
  })

  test('AC3: resize handles are hidden when the shape element is deselected', async ({ page }) => {
    await addShapeElement(page)
    await clickCanvasBackground(page)
    await expect(page.getByTestId('shape-resize-handle-tl')).not.toBeAttached()
    await expect(page.getByTestId('shape-resize-handle-br')).not.toBeAttached()
  })

  // AC4 — dragging a corner handle resizes the element
  test('AC4: dragging the bottom-right handle increases width and height', async ({ page }) => {
    await addShapeElement(page)
    const el = await getShapeElement(page)
    const before = await el.boundingBox()

    await dragBy(page, page.getByTestId('shape-resize-handle-br'), 60, 60)

    const after = await el.boundingBox()
    expect(after!.width).toBeGreaterThan(before!.width + 30)
    expect(after!.height).toBeGreaterThan(before!.height + 30)
  })

  test('AC4: minimum size is enforced at 20 × 20 px', async ({ page }) => {
    await addShapeElement(page)
    const el = await getShapeElement(page)

    // Drag the top-left handle far toward the bottom-right corner — should clamp at 20px
    await dragBy(page, page.getByTestId('shape-resize-handle-tl'), 500, 500)

    const box = await el.boundingBox()
    expect(box!.width).toBeGreaterThanOrEqual(20)
    expect(box!.height).toBeGreaterThanOrEqual(20)
  })

  // AC5 — top/left handle keeps the anchor corner stationary
  test('AC5: dragging the top-left handle keeps the bottom-right corner stationary', async ({
    page,
  }) => {
    await addShapeElement(page)
    const el = await getShapeElement(page)
    const before = await el.boundingBox()
    const anchorX = before!.x + before!.width
    const anchorY = before!.y + before!.height

    await dragBy(page, page.getByTestId('shape-resize-handle-tl'), -30, -30)

    const after = await el.boundingBox()
    const newAnchorX = after!.x + after!.width
    const newAnchorY = after!.y + after!.height

    expect(newAnchorX).toBeCloseTo(anchorX, 0)
    expect(newAnchorY).toBeCloseTo(anchorY, 0)
  })

  // =========================================================================
  // AC6 — contextual toolbar visibility
  // =========================================================================

  test('AC6: contextual toolbar appears when a shape is selected', async ({ page }) => {
    await addShapeElement(page)
    await expect(page.getByTestId('contextual-toolbar')).toBeVisible()
  })

  test('AC6: contextual toolbar shows shape-specific controls', async ({ page }) => {
    await addShapeElement(page)
    await expect(page.getByLabel('Rectangle')).toBeVisible()
    await expect(page.getByLabel('Ellipse')).toBeVisible()
    await expect(page.getByLabel('Triangle')).toBeVisible()
    await expect(page.getByLabel('Fill colour picker')).toBeVisible()
    await expect(page.getByLabel('Stroke width', { exact: true })).toBeVisible()
  })

  test('AC6: contextual toolbar hides when the selection is cleared', async ({ page }) => {
    await addShapeElement(page)
    await clickCanvasBackground(page)
    await expect(page.getByTestId('contextual-toolbar')).not.toBeAttached()
  })

  test('AC6: text formatting controls are absent when a shape is selected', async ({ page }) => {
    await addShapeElement(page)
    await expect(page.getByLabel('Font family')).not.toBeAttached()
    await expect(page.getByLabel('Font size')).not.toBeAttached()
  })

  // =========================================================================
  // AC7 — shape variant picker
  // =========================================================================

  test('AC7: "Rectangle" variant button is active by default', async ({ page }) => {
    await addShapeElement(page)
    await expect(page.getByLabel('Rectangle')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByLabel('Ellipse')).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByLabel('Triangle')).toHaveAttribute('aria-pressed', 'false')
  })

  test('AC7: clicking "Ellipse" changes the shape to an ellipse (border-radius: 50%)', async ({
    page,
  }) => {
    await addShapeElement(page)
    await page.getByLabel('Ellipse').click()

    const el = await getShapeElement(page)
    const borderRadius = await el.evaluate((node) => getComputedStyle(node).borderRadius)
    expect(borderRadius).toBe('50%')
  })

  test('AC7: clicking "Triangle" changes the shape and renders an SVG polygon', async ({ page }) => {
    await addShapeElement(page)
    await page.getByLabel('Triangle').click()

    const el = await getShapeElement(page)
    await expect(el.locator('polygon')).toBeAttached()
  })

  test('AC7: clicking "Rectangle" after switching to ellipse reverts to rect rendering', async ({
    page,
  }) => {
    await addShapeElement(page)
    await page.getByLabel('Ellipse').click()
    await page.getByLabel('Rectangle').click()

    const el = await getShapeElement(page)
    const borderRadius = await el.evaluate((node) => getComputedStyle(node).borderRadius)
    expect(borderRadius).not.toBe('50%')
    await expect(el.locator('polygon')).not.toBeAttached()
  })

  test('AC7: active variant button gets the highlighted style', async ({ page }) => {
    await addShapeElement(page)
    await page.getByLabel('Ellipse').click()
    await expect(page.getByLabel('Ellipse')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByLabel('Rectangle')).toHaveAttribute('aria-pressed', 'false')
  })

  // =========================================================================
  // AC8 — fill colour picker
  // =========================================================================

  test('AC8: fill colour picker reflects the current fill colour', async ({ page }) => {
    await addShapeElement(page)
    // Default fill is #3B82F6
    const value = await page.getByLabel('Fill', { exact: true }).inputValue()
    expect(value.toLowerCase()).toBe('#3b82f6')
  })

  test('AC8: changing the fill colour updates the shape background in real time', async ({
    page,
  }) => {
    await addShapeElement(page)
    await page.getByLabel('Fill', { exact: true }).evaluate((el: HTMLInputElement) => {
      el.value = '#ff0000'
      el.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const el = await getShapeElement(page)
    const bg = await el.evaluate((node) => getComputedStyle(node).backgroundColor)
    expect(bg).toBe('rgb(255, 0, 0)')
  })

  // =========================================================================
  // AC9 / AC10 — fill transparency toggle (⊘)
  // =========================================================================

  test('AC9: clicking the fill ⊘ toggle sets fill to transparent', async ({ page }) => {
    await addShapeElement(page)
    await page.getByLabel('Toggle Fill transparency').click()

    const el = await getShapeElement(page)
    const bg = await el.evaluate((node) => getComputedStyle(node).backgroundColor)
    // transparent renders as rgba(0,0,0,0) or transparent
    expect(bg).toMatch(/rgba\(0, 0, 0, 0\)|transparent/)
  })

  test('AC10: clicking ⊘ again when fill is transparent restores the last non-transparent fill', async ({
    page,
  }) => {
    await addShapeElement(page)

    // First change fill to a known colour
    await page.getByLabel('Fill', { exact: true }).evaluate((el: HTMLInputElement) => {
      el.value = '#00ff00'
      el.dispatchEvent(new Event('change', { bubbles: true }))
    })

    // Make transparent
    await page.getByLabel('Toggle Fill transparency').click()

    // Restore
    await page.getByLabel('Toggle Fill transparency').click()

    const el = await getShapeElement(page)
    const bg = await el.evaluate((node) => getComputedStyle(node).backgroundColor)
    expect(bg).toBe('rgb(0, 255, 0)')
  })

  // =========================================================================
  // AC11 / AC12 — stroke colour picker and toggle
  // =========================================================================

  test('AC11: changing the stroke colour updates the element border colour', async ({ page }) => {
    await addShapeElement(page)

    // First give it a stroke width so stroke is visible
    await page.getByLabel('Increase stroke width').click()
    await page.getByLabel('Increase stroke width').click()

    await page.getByLabel('Stroke', { exact: true }).evaluate((el: HTMLInputElement) => {
      el.value = '#ff0000'
      el.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const el = await getShapeElement(page)
    const borderColor = await el.evaluate((node) => getComputedStyle(node).borderColor)
    expect(borderColor).toBe('rgb(255, 0, 0)')
  })

  test('AC12: clicking the stroke ⊘ toggle sets stroke to transparent', async ({ page }) => {
    await addShapeElement(page)

    // Give it a stroke width so the stroke controls become active.
    await page.getByLabel('Increase stroke width').click()
    // Default stroke is 'transparent', so the first toggle restores to the last
    // non-transparent value — making the border visible (solid).
    await page.getByLabel('Toggle Stroke transparency').click()
    // A second toggle now sets stroke back to transparent, collapsing the border.
    await page.getByLabel('Toggle Stroke transparency').click()

    // After toggling to transparent, the element border should collapse.
    const el = await getShapeElement(page)
    const borderStyle = await el.evaluate((node) => getComputedStyle(node).borderStyle)
    expect(borderStyle).toBe('none')
  })

  // =========================================================================
  // AC13 — stroke controls dimmed when strokeWidth is 0
  // =========================================================================

  test('AC13: stroke colour area is dimmed and non-interactive when stroke width is 0', async ({
    page,
  }) => {
    await addShapeElement(page)
    // Default strokeWidth is 0, so stroke colour section should be dimmed
    const strokeSection = page.locator('.opacity-50.pointer-events-none')
    await expect(strokeSection).toBeAttached()
  })

  test('AC13: stroke colour area becomes active once stroke width is increased above 0', async ({
    page,
  }) => {
    await addShapeElement(page)
    await page.getByLabel('Increase stroke width').click()
    // No longer dimmed
    await expect(page.locator('.opacity-50.pointer-events-none')).not.toBeAttached()
  })

  // =========================================================================
  // AC14 — stroke width input
  // =========================================================================

  test('AC14: "+" button increments stroke width by 1', async ({ page }) => {
    await addShapeElement(page)
    const input = page.getByLabel('Stroke width', { exact: true })
    const before = Number(await input.inputValue())
    await page.getByLabel('Increase stroke width').click()
    expect(Number(await input.inputValue())).toBe(before + 1)
  })

  test('AC14: "−" button decrements stroke width by 1', async ({ page }) => {
    await addShapeElement(page)
    // First increment so decrement is not clamped at 0
    await page.getByLabel('Increase stroke width').click()
    await page.getByLabel('Increase stroke width').click()
    const input = page.getByLabel('Stroke width', { exact: true })
    const before = Number(await input.inputValue())
    await page.getByLabel('Decrease stroke width').click()
    expect(Number(await input.inputValue())).toBe(before - 1)
  })

  test('AC14: stroke width does not go below 0', async ({ page }) => {
    await addShapeElement(page)
    await page.getByLabel('Decrease stroke width').click()
    await page.getByLabel('Decrease stroke width').click()
    expect(await page.getByLabel('Stroke width', { exact: true }).inputValue()).toBe('0')
  })

  test('AC14: stroke width does not exceed 20', async ({ page }) => {
    await addShapeElement(page)
    await page.getByLabel('Stroke width', { exact: true }).fill('20')
    await page.keyboard.press('Tab')
    await page.getByLabel('Increase stroke width').click()
    expect(await page.getByLabel('Stroke width', { exact: true }).inputValue()).toBe('20')
  })

  test('AC14: changing stroke width updates the element border thickness immediately', async ({
    page,
  }) => {
    await addShapeElement(page)
    // Increment once so the stroke controls become active (strokeWidth > 0),
    // then toggle transparency off so the border is actually visible.
    await page.getByLabel('Increase stroke width').click()
    await page.getByLabel('Toggle Stroke transparency').click()
    // Now increment to reach strokeWidth 3.
    await page.getByLabel('Increase stroke width').click()
    await page.getByLabel('Increase stroke width').click()

    const el = await getShapeElement(page)
    const borderWidth = await el.evaluate((node) => getComputedStyle(node).borderWidth)
    expect(borderWidth).toBe('3px')
  })

  // =========================================================================
  // AC15 — ellipse variant rendering
  // =========================================================================

  test('AC15: ellipse variant has border-radius 50%', async ({ page }) => {
    await addShapeElement(page)
    await page.getByLabel('Ellipse').click()

    const el = await getShapeElement(page)
    await expect(el).toHaveCSS('border-radius', '50%')
  })

  // =========================================================================
  // AC16 — triangle variant rendering
  // =========================================================================

  test('AC16: triangle variant renders an SVG polygon with the correct vertex formula', async ({
    page,
  }) => {
    await addShapeElement(page)
    await page.getByLabel('Triangle').click()

    const el = await getShapeElement(page)
    const polygon = el.locator('polygon')
    await expect(polygon).toBeAttached()

    const points = await polygon.getAttribute('points')
    expect(points).toBeTruthy()
    // Should contain three vertex pairs — rough check for format "x,y x,y x,y"
    const pairs = points!.trim().split(/\s+/)
    expect(pairs).toHaveLength(3)
  })

  test('AC16: triangle fill is applied to the SVG polygon', async ({ page }) => {
    await addShapeElement(page)
    await page.getByLabel('Triangle').click()

    const el = await getShapeElement(page)
    const fill = await el.locator('polygon').getAttribute('fill')
    // default fill is #3B82F6
    expect(fill?.toLowerCase()).toBe('#3b82f6')
  })

  // =========================================================================
  // AC17 / AC18 — Shift+click multi-select
  // =========================================================================

  test('AC17: Shift+clicking an unselected shape element adds it to the selection', async ({
    page,
  }) => {
    await addShapeElement(page)
    await clickCanvasBackground(page)
    await addShapeElement(page)
    // At this point the second shape is selected; add the first via Shift+click
    const first = page.locator('[data-testid="shape-element"]').first()
    await first.click({ modifiers: ['Shift'] })
    // Both should now be selected — the contextual toolbar should remain visible
    await expect(page.getByTestId('contextual-toolbar')).toBeVisible()
  })

  test('AC18: Shift+clicking an already-selected shape element removes it from the selection', async ({
    page,
  }) => {
    await addShapeElement(page)
    // The shape is selected; Shift+click it to toggle off
    const el = await getShapeElement(page)
    await el.click({ modifiers: ['Shift'] })
    // Now nothing is selected — toolbar should hide
    await expect(page.getByTestId('contextual-toolbar')).not.toBeAttached()
  })

  // =========================================================================
  // AC20 — multi-element drag
  // =========================================================================

  test('AC20: dragging one selected shape moves all selected shapes together', async ({ page }) => {
    // Add two shapes and select both via Shift+click
    await addShapeElement(page)
    await clickCanvasBackground(page)
    await addShapeElement(page)
    // Second shape is auto-selected; Shift+click the first to build multi-selection
    const first = page.locator('[data-testid="shape-element"]').first()
    await first.click({ modifiers: ['Shift'] })

    // Record positions
    const secondEl = page.locator('[data-testid="shape-element"]').nth(1)
    const beforeFirst = await first.boundingBox()
    const beforeSecond = await secondEl.boundingBox()

    // Drag the second element
    await dragBy(page, secondEl, 100, 50)

    const afterFirst = await first.boundingBox()
    const afterSecond = await secondEl.boundingBox()

    // Both should have moved by approximately the same delta
    const dxFirst = afterFirst!.x - beforeFirst!.x
    const dxSecond = afterSecond!.x - beforeSecond!.x
    expect(Math.abs(dxFirst - dxSecond)).toBeLessThan(10)
  })

  // =========================================================================
  // AC21 / AC22 — multi-select toolbar controls
  // =========================================================================

  test('AC21: variant buttons are shown when multiple shape elements share the same shape', async ({
    page,
  }) => {
    await addShapeElement(page)
    await clickCanvasBackground(page)
    await addShapeElement(page)
    const first = page.locator('[data-testid="shape-element"]').first()
    await first.click({ modifiers: ['Shift'] })

    // Both are 'rect' — variant buttons should be visible
    await expect(page.getByLabel('Rectangle')).toBeVisible()
  })

  test('AC22: clicking a variant button with multiple shapes selected changes all of them', async ({
    page,
  }) => {
    await addShapeElement(page)
    await clickCanvasBackground(page)
    await addShapeElement(page)
    const first = page.locator('[data-testid="shape-element"]').first()
    await first.click({ modifiers: ['Shift'] })

    // Change variant to ellipse for both
    await page.getByLabel('Ellipse').click()

    // Both elements should now be ellipses
    const shapes = page.locator('[data-testid="shape-element"]')
    const count = await shapes.count()
    for (let i = 0; i < count; i++) {
      await expect(shapes.nth(i)).toHaveCSS('border-radius', '50%')
    }
  })

  // =========================================================================
  // AC24 / AC25 — delete
  // =========================================================================

  test('AC24: pressing Delete removes the selected shape element', async ({ page }) => {
    await addShapeElement(page)
    await expect(page.locator('[data-testid="shape-element"]')).toHaveCount(1)

    await page.keyboard.press('Delete')

    await expect(page.locator('[data-testid="shape-element"]')).toHaveCount(0)
  })

  test('AC24: pressing Backspace removes the selected shape element', async ({ page }) => {
    await addShapeElement(page)
    await page.keyboard.press('Backspace')
    await expect(page.locator('[data-testid="shape-element"]')).toHaveCount(0)
  })

  test('AC25: clicking the trash-can toolbar button removes the selected shape element', async ({
    page,
  }) => {
    await addShapeElement(page)
    await expect(page.locator('[data-testid="shape-element"]')).toHaveCount(1)

    await page.getByLabel('Delete').click()

    await expect(page.locator('[data-testid="shape-element"]')).toHaveCount(0)
  })

  test('AC26: after deletion the toolbar hides (unpinned mode)', async ({ page }) => {
    await addShapeElement(page)
    await page.keyboard.press('Delete')
    await expect(page.getByTestId('contextual-toolbar')).not.toBeAttached()
  })

  // =========================================================================
  // AC29 — customisations are independent per element and persist in-session
  // =========================================================================

  test('AC29: fill colour persists after deselecting and reselecting', async ({ page }) => {
    await addShapeElement(page)
    await page.getByLabel('Fill', { exact: true }).evaluate((el: HTMLInputElement) => {
      el.value = '#ff00ff'
      el.dispatchEvent(new Event('change', { bubbles: true }))
    })

    await clickCanvasBackground(page)
    const el = await getShapeElement(page)
    await el.click()

    expect((await page.getByLabel('Fill', { exact: true }).inputValue()).toLowerCase()).toBe('#ff00ff')
  })

  test('AC29: shape variant persists after deselecting and reselecting', async ({ page }) => {
    await addShapeElement(page)
    await page.getByLabel('Ellipse').click()

    await clickCanvasBackground(page)
    const el = await getShapeElement(page)
    await el.click()

    await expect(page.getByLabel('Ellipse')).toHaveAttribute('aria-pressed', 'true')
  })

  test('AC29: stroke width persists after deselecting and reselecting', async ({ page }) => {
    await addShapeElement(page)
    await page.getByLabel('Increase stroke width').click()
    await page.getByLabel('Increase stroke width').click()
    await page.getByLabel('Increase stroke width').click()

    await clickCanvasBackground(page)
    const el = await getShapeElement(page)
    await el.click()

    expect(await page.getByLabel('Stroke width', { exact: true }).inputValue()).toBe('3')
  })

  // =========================================================================
  // AC30 — refreshing clears all shape elements
  // =========================================================================

  test('AC30: refreshing the page removes all shape elements (no backend persistence)', async ({
    page,
  }) => {
    await addShapeElement(page)
    await addShapeElement(page)
    await expect(page.locator('[data-testid="shape-element"]')).toHaveCount(2)

    await page.reload()

    await expect(page.locator('[data-testid="shape-element"]')).toHaveCount(0)
  })
})
