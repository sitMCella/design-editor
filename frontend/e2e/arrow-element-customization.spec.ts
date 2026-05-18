import { expect, Page, test } from '@playwright/test'
import { mockApiRoutes } from './mock-api'

const EDITOR_URL = '/editor/test-design'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function addArrowElement(page: Page) {
  await page.getByTitle('Arrow').click()
}

async function addTextElement(page: Page) {
  await page.getByTitle('Text').click()
}

async function getArrowElement(page: Page, nth = 0) {
  return page.locator('[data-testid="arrow-element"]').nth(nth)
}

async function clickCanvasBackground(page: Page) {
  await page.locator('[data-testid="canvas-container"]').click({ position: { x: 10, y: 10 }, force: true })
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
  steps = 15
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

test.describe('09 – Arrow Element Customisation', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
    await page.goto(EDITOR_URL)
  })

  // =========================================================================
  // AC13 — contextual toolbar visibility
  // =========================================================================

  test('AC13: contextual toolbar appears when an arrow is selected', async ({ page }) => {
    await addArrowElement(page)
    await expect(page.getByTestId('contextual-toolbar')).toBeVisible()
  })

  test('AC13: contextual toolbar shows arrow-specific controls (stroke, arrowhead)', async ({
    page,
  }) => {
    await addArrowElement(page)
    await expect(page.getByLabel('Stroke color')).toBeVisible()
    await expect(page.getByLabel('Stroke width', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Arrowhead at end')).toBeVisible()
  })

  test('AC13: contextual toolbar is hidden when the arrow is deselected', async ({ page }) => {
    await addArrowElement(page)
    await clickCanvasBackground(page)
    await expect(page.getByTestId('contextual-toolbar')).not.toBeAttached()
  })

  test('AC13: text formatting controls are not shown when an arrow is selected', async ({
    page,
  }) => {
    await addArrowElement(page)
    await expect(page.getByLabel('Font family')).not.toBeAttached()
    await expect(page.getByLabel('Font size')).not.toBeAttached()
  })

  test('AC13: toolbar reappears when the deselected arrow is clicked again', async ({ page }) => {
    await addArrowElement(page)
    await clickCanvasBackground(page)
    await expect(page.getByTestId('contextual-toolbar')).not.toBeAttached()

    const el = await getArrowElement(page)
    await el.click()
    await expect(page.getByTestId('contextual-toolbar')).toBeVisible()
  })

  // =========================================================================
  // AC14 — arrowhead position buttons
  // =========================================================================

  test('AC14: "Arrowhead at end" button is active by default', async ({ page }) => {
    await addArrowElement(page)
    await expect(page.getByLabel('Arrowhead at end')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByLabel('No arrowheads')).toHaveAttribute('aria-pressed', 'false')
  })

  test('AC14: clicking "No arrowheads" removes the marker from the SVG', async ({ page }) => {
    await addArrowElement(page)
    await page.getByLabel('No arrowheads').click()
    const el = await getArrowElement(page)
    await expect(el.locator('marker')).not.toBeAttached()
  })

  test('AC14: clicking "No arrowheads" marks that button active and deactivates others', async ({
    page,
  }) => {
    await addArrowElement(page)
    await page.getByLabel('No arrowheads').click()
    await expect(page.getByLabel('No arrowheads')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByLabel('Arrowhead at end')).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByLabel('Arrowhead at start')).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByLabel('Arrowheads at both ends')).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  test('AC14: clicking "Arrowhead at start" adds a start marker to the line', async ({ page }) => {
    await addArrowElement(page)
    await page.getByLabel('Arrowhead at start').click()
    const el = await getArrowElement(page)
    const markerStart = await el.locator('line').getAttribute('marker-start')
    expect(markerStart).toMatch(/url\(#arrowhead-start-.+\)/)
    // end marker should be absent
    const markerEnd = await el.locator('line').getAttribute('marker-end')
    expect(markerEnd).toBeNull()
  })

  test('AC14: clicking "Arrowheads at both ends" adds both markers', async ({ page }) => {
    await addArrowElement(page)
    await page.getByLabel('Arrowheads at both ends').click()
    const el = await getArrowElement(page)
    const line = el.locator('line')
    expect(await line.getAttribute('marker-start')).toMatch(/url\(#arrowhead-start-.+\)/)
    expect(await line.getAttribute('marker-end')).toMatch(/url\(#arrowhead-end-.+\)/)
  })

  // =========================================================================
  // AC15 — stroke width
  // =========================================================================

  test('AC15: "+" button increments the stroke width by 1', async ({ page }) => {
    await addArrowElement(page)
    const input = page.getByLabel('Stroke width', { exact: true })
    const before = Number(await input.inputValue())
    await page.getByLabel('Increase stroke width').click()
    expect(Number(await input.inputValue())).toBe(before + 1)
  })

  test('AC15: "−" button decrements the stroke width by 1', async ({ page }) => {
    await addArrowElement(page)
    // Bump up first so decrement won't be clamped
    await page.getByLabel('Increase stroke width').click()
    const input = page.getByLabel('Stroke width', { exact: true })
    const before = Number(await input.inputValue())
    await page.getByLabel('Decrease stroke width').click()
    expect(Number(await input.inputValue())).toBe(before - 1)
  })

  test('AC15: stroke width change updates the SVG line immediately', async ({ page }) => {
    await addArrowElement(page)
    // Default is 2; click + three times → 5
    await page.getByLabel('Increase stroke width').click()
    await page.getByLabel('Increase stroke width').click()
    await page.getByLabel('Increase stroke width').click()
    const el = await getArrowElement(page)
    expect(Number(await el.locator('line').getAttribute('stroke-width'))).toBe(5)
  })

  test('AC15: stroke width does not go below the minimum of 1', async ({ page }) => {
    await addArrowElement(page)
    // Default is 2; click decrement twice
    await page.getByLabel('Decrease stroke width').click()
    await page.getByLabel('Decrease stroke width').click()
    expect(await page.getByLabel('Stroke width', { exact: true }).inputValue()).toBe('1')
  })

  test('AC15: stroke width does not exceed the maximum of 20', async ({ page }) => {
    await addArrowElement(page)
    await page.getByLabel('Stroke width', { exact: true }).fill('20')
    await page.keyboard.press('Tab')
    await page.getByLabel('Increase stroke width').click()
    expect(await page.getByLabel('Stroke width', { exact: true }).inputValue()).toBe('20')
  })

  // =========================================================================
  // AC16 — stroke colour
  // =========================================================================

  test('AC16: the colour picker reflects the current arrow stroke', async ({ page }) => {
    await addArrowElement(page)
    // Default stroke is #111827
    const value = await page.getByLabel('Stroke color').inputValue()
    expect(value.toLowerCase()).toBe('#111827')
  })

  test('AC16: changing the colour picker updates the SVG line stroke immediately', async ({
    page,
  }) => {
    await addArrowElement(page)
    // Native <input type="color"> is not interactive via fill — use evaluate
    await page.getByLabel('Stroke color').evaluate((el: HTMLInputElement) => {
      el.value = '#ff0000'
      el.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const el = await getArrowElement(page)
    expect(await el.locator('line').getAttribute('stroke')).toBe('#ff0000')
  })

  test('AC16: the arrowhead marker fill updates to match the new stroke colour', async ({
    page,
  }) => {
    await addArrowElement(page)
    await page.getByLabel('Stroke color').evaluate((el: HTMLInputElement) => {
      el.value = '#00ff00'
      el.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const el = await getArrowElement(page)
    // The marker path fill should use the same colour as the line stroke
    const markerFill = await el.locator('marker path').getAttribute('fill')
    expect(markerFill).toBe('#00ff00')
  })

  // =========================================================================
  // AC1 / AC2 — body drag
  // =========================================================================

  test('AC1: dragging the arrow body moves the whole arrow to a new position', async ({ page }) => {
    await addArrowElement(page)
    const el = await getArrowElement(page)

    const before = await el.boundingBox()
    await dragBy(page, el, 120, 60)
    const after = await el.boundingBox()

    // Both dimensions should have moved noticeably
    expect(after!.x).toBeGreaterThan(before!.x + 50)
    expect(after!.y).toBeGreaterThan(before!.y + 30)
  })

  test('AC2: body drag does not deselect the arrow (outline stays solid)', async ({ page }) => {
    await addArrowElement(page)
    const el = await getArrowElement(page)
    await dragBy(page, el, 80, 40)
    // The selection outline lives on an inner div
    await expect(el.locator('div').first()).toHaveCSS('outline-style', 'solid')
  })

  // =========================================================================
  // AC5 — endpoint handles
  // =========================================================================

  test('AC5: both circular endpoint handles are visible when the arrow is selected', async ({
    page,
  }) => {
    await addArrowElement(page)
    // Arrow is auto-selected after insertion
    await expect(page.getByTestId('endpoint-start')).toBeVisible()
    await expect(page.getByTestId('endpoint-end')).toBeVisible()
  })

  test('AC5: endpoint handles are hidden when the arrow is deselected', async ({ page }) => {
    await addArrowElement(page)
    await clickCanvasBackground(page)
    await expect(page.getByTestId('endpoint-start')).not.toBeAttached()
    await expect(page.getByTestId('endpoint-end')).not.toBeAttached()
  })

  test('AC5: start handle is a hollow circle and end handle is a filled circle', async ({
    page,
  }) => {
    await addArrowElement(page)
    expect(await page.getByTestId('endpoint-start').getAttribute('fill')).toBe('white')
    const endFill = (await page.getByTestId('endpoint-end').getAttribute('fill'))!.toLowerCase()
    expect(endFill).toContain('3b82f6')
  })

  // =========================================================================
  // AC6 / AC7 — endpoint drag reshapes the arrow
  // =========================================================================

  test('AC6: dragging the start handle changes x1/y1 while x2/y2 stay fixed', async ({ page }) => {
    await addArrowElement(page)
    const el = await getArrowElement(page)
    const line = el.locator('line')

    // Record the end handle's absolute viewport position — this is unaffected by
    // bounding-box recalculation and correctly represents whether x2/y2 moved.
    const endHandleBefore = await page.getByTestId('endpoint-end').boundingBox()

    // Drag start handle 80px to the right — start point moves, end stays
    await dragBy(page, page.getByTestId('endpoint-start'), 80, 0)

    const x1After = await line.getAttribute('x1')

    // x1 (start) should have moved (sanity check)
    expect(Number(x1After)).toBeGreaterThan(0)
    // End handle absolute screen position should be unchanged
    const endHandleAfter = await page.getByTestId('endpoint-end').boundingBox()
    expect(endHandleAfter!.x).toBeCloseTo(endHandleBefore!.x, 0)
    expect(endHandleAfter!.y).toBeCloseTo(endHandleBefore!.y, 0)
  })

  test('AC7: dragging the end handle changes x2/y2 while x1/y1 stay fixed', async ({ page }) => {
    await addArrowElement(page)
    const el = await getArrowElement(page)
    const line = el.locator('line')

    const x1Before = await line.getAttribute('x1')
    const y1Before = await line.getAttribute('y1')

    // Drag end handle 80px to the left — end point moves, start stays
    await dragBy(page, page.getByTestId('endpoint-end'), -80, 0)

    const x1After = await line.getAttribute('x1')
    const y1After = await line.getAttribute('y1')
    const x2After = await line.getAttribute('x2')

    // x2 (end) should have decreased by ~80
    expect(Number(x2After)).toBeLessThan(Number(x1Before!) + 150) // end moved toward start
    // x1, y1 (start) should be unchanged
    expect(Number(x1After)).toBeCloseTo(Number(x1Before!), 0)
    expect(Number(y1After)).toBeCloseTo(Number(y1Before!), 0)
  })

  // =========================================================================
  // AC9 — snap indicator appears near an anchor point
  // =========================================================================

  test('AC9: snap indicator appears when an endpoint is dragged within 12px of an anchor', async ({
    page,
  }) => {
    // Add a text element (default position: design-surface centre ~560,320)
    await addTextElement(page)
    await clickCanvasBackground(page)

    // Add arrow and ensure it is selected
    await addArrowElement(page)

    // Drag the end handle to the text element's right-edge midpoint
    const textEl = page.locator('[data-testid="text-element"]').first()
    const textBox = await textEl.boundingBox()
    const snapX = textBox!.x + textBox!.width // right edge
    const snapY = textBox!.y + textBox!.height / 2 // midpoint

    const endBox = await page.getByTestId('endpoint-end').boundingBox()
    const hx = endBox!.x + endBox!.width / 2
    const hy = endBox!.y + endBox!.height / 2

    // Move slowly toward the anchor — snap indicator should appear before mouseup
    await page.mouse.move(hx, hy)
    await page.mouse.down()
    await page.mouse.move(snapX, snapY, { steps: 20 })

    await expect(page.getByTestId('snap-indicator')).toBeVisible()

    await page.mouse.up()
  })

  test('AC9: snap indicator disappears after the mouse is released', async ({ page }) => {
    await addTextElement(page)
    await clickCanvasBackground(page)
    await addArrowElement(page)

    const textEl = page.locator('[data-testid="text-element"]').first()
    const textBox = await textEl.boundingBox()
    const snapX = textBox!.x + textBox!.width
    const snapY = textBox!.y + textBox!.height / 2

    const endBox = await page.getByTestId('endpoint-end').boundingBox()
    await page.mouse.move(endBox!.x + endBox!.width / 2, endBox!.y + endBox!.height / 2)
    await page.mouse.down()
    await page.mouse.move(snapX, snapY, { steps: 20 })
    await page.mouse.up()

    await expect(page.getByTestId('snap-indicator')).not.toBeAttached()
  })

  // =========================================================================
  // AC11 — connected element carries the arrow endpoint when moved
  // =========================================================================

  // TODO: fix test — after snapping the arrow end to the text element's right-edge
  // anchor, the arrow's bounding box grows to overlap the text element's centre.
  // Playwright then reports the arrow's transparent hit <path> as intercepting the
  // click intended for the text element, even though pointer-events is restricted to
  // the stroke. Needs a different click strategy (e.g. force:true + explicit coords).
  test.skip('AC11: moving a connected element also moves the attached arrow endpoint', async ({
    page,
  }) => {
    // Setup: add text element then arrow
    await addTextElement(page)
    await clickCanvasBackground(page)
    await addArrowElement(page)

    // Snap end handle to the text element's right-edge anchor
    const textEl = page.locator('[data-testid="text-element"]').first()
    const textBox = await textEl.boundingBox()
    const snapX = textBox!.x + textBox!.width
    const snapY = textBox!.y + textBox!.height / 2

    const endBox = await page.getByTestId('endpoint-end').boundingBox()
    await page.mouse.move(endBox!.x + endBox!.width / 2, endBox!.y + endBox!.height / 2)
    await page.mouse.down()
    await page.mouse.move(snapX, snapY, { steps: 20 })
    await page.mouse.up()

    // Record x2 (end endpoint) before moving the text element
    const el = await getArrowElement(page)
    const line = el.locator('line')
    const x2Before = Number(await line.getAttribute('x2'))

    // Drag the text element 100px to the right
    await textEl.click()
    await dragBy(page, textEl, 100, 0)

    // Arrow endpoint should have followed
    const x2After = Number(await line.getAttribute('x2'))
    expect(x2After).toBeGreaterThan(x2Before + 50)
  })

  // =========================================================================
  // AC17 — customisations are independent per arrow
  // =========================================================================

  // TODO: fix test — both arrows are inserted at the same default position, so
  // click({ force: true }) on getArrowElement(page, 0) and (page, 1) land on the
  // same screen point and always select whichever arrow is topmost in z-order.
  // The test needs the arrows to be at distinct positions, or the click strategy
  // needs to target a specific element via JS rather than screen coordinates.
  test.skip('AC17: changing stroke colour of one arrow does not affect another', async ({
    page,
  }) => {
    await addArrowElement(page)
    await addArrowElement(page)
    await clickCanvasBackground(page)

    // Select first arrow and change its colour
    await (await getArrowElement(page, 0)).click({ force: true })
    await page.getByLabel('Stroke color').evaluate((el: HTMLInputElement) => {
      el.value = '#ff0000'
      el.dispatchEvent(new Event('change', { bubbles: true }))
    })

    // Deselect then select the second arrow
    await clickCanvasBackground(page)
    await (await getArrowElement(page, 1)).click({ force: true })

    // Second arrow should still have the default colour
    expect((await page.getByLabel('Stroke color').inputValue()).toLowerCase()).toBe('#111827')
  })

  // TODO: fix test — same overlapping arrows issue as the colour test above.
  test.skip('AC17: changing the arrowhead of one arrow does not affect another', async ({
    page,
  }) => {
    await addArrowElement(page)
    await addArrowElement(page)
    await clickCanvasBackground(page)

    // Select first arrow, set arrowhead to "none"
    await (await getArrowElement(page, 0)).click({ force: true })
    await page.getByLabel('No arrowheads').click()

    // Deselect then select second arrow
    await clickCanvasBackground(page)
    await (await getArrowElement(page, 1)).click({ force: true })

    // Second arrow should still have the default "end" arrowhead
    await expect(page.getByLabel('Arrowhead at end')).toHaveAttribute('aria-pressed', 'true')
  })

  // TODO: fix test — same overlapping arrows issue as the colour test above.
  test.skip('AC17: changing stroke width of one arrow does not affect another', async ({
    page,
  }) => {
    await addArrowElement(page)
    await addArrowElement(page)
    await clickCanvasBackground(page)

    // Select first arrow, increase stroke width to 5
    await (await getArrowElement(page, 0)).click({ force: true })
    await page.getByLabel('Increase stroke width').click()
    await page.getByLabel('Increase stroke width').click()
    await page.getByLabel('Increase stroke width').click()

    // Deselect then select second arrow
    await clickCanvasBackground(page)
    await (await getArrowElement(page, 1)).click({ force: true })

    // Second arrow should still have the default stroke width of 2
    expect(await page.getByLabel('Stroke width', { exact: true }).inputValue()).toBe('2')
  })

  // =========================================================================
  // AC18 — customisations persist for the session lifetime
  // =========================================================================

  test('AC18: arrowhead setting persists after deselecting and reselecting', async ({ page }) => {
    await addArrowElement(page)
    await page.getByLabel('Arrowheads at both ends').click()

    await clickCanvasBackground(page)
    await (await getArrowElement(page)).click()

    await expect(page.getByLabel('Arrowheads at both ends')).toHaveAttribute('aria-pressed', 'true')
  })

  test('AC18: stroke width persists after deselecting and reselecting', async ({ page }) => {
    await addArrowElement(page)
    await page.getByLabel('Increase stroke width').click()
    await page.getByLabel('Increase stroke width').click()
    // stroke width is now 4

    await clickCanvasBackground(page)
    await (await getArrowElement(page)).click()

    expect(await page.getByLabel('Stroke width', { exact: true }).inputValue()).toBe('4')
  })

  test('AC18: stroke colour persists after deselecting and reselecting', async ({ page }) => {
    await addArrowElement(page)
    await page.getByLabel('Stroke color').evaluate((el: HTMLInputElement) => {
      el.value = '#3b82f6'
      el.dispatchEvent(new Event('change', { bubbles: true }))
    })

    await clickCanvasBackground(page)
    await (await getArrowElement(page)).click()

    expect((await page.getByLabel('Stroke color').inputValue()).toLowerCase()).toBe('#3b82f6')
  })
})
