import { expect, Page, test } from '@playwright/test'
import { mockApiRoutes } from './mock-api'

const EDITOR_URL = '/editor/test-design'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getWorldTransform(page: Page): Promise<string> {
  const worldLayer = page.locator('[style*="transform-origin"]').first()
  return worldLayer.evaluate((el) => (el as HTMLElement).style.transform)
}

function parseTransform(transform: string): { panX: number; panY: number; zoom: number } {
  const m = transform.match(/translate\(([-\d.]+)px(?:,\s*([-\d.]+)px)?\)\s*scale\(([\d.]+)\)/)
  if (!m) throw new Error(`Cannot parse transform: "${transform}"`)
  return { panX: parseFloat(m[1]), panY: parseFloat(m[2] ?? '0'), zoom: parseFloat(m[3]) }
}

/** Click a safe corner of the canvas background (far from any element) to deselect. */
async function clickBackground(page: Page) {
  await page
    .locator('.bg-gray-100')
    .first()
    .click({ position: { x: 10, y: 10 }, force: true })
}

/** Drag `from` by (dx, dy) screen pixels starting from its centre. */
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

/** Pan via Space+drag. */
async function spacePan(page: Page, dx: number, dy: number) {
  const canvas = page.locator('.bg-gray-100').first()
  const box = await canvas.boundingBox()
  const cx = box!.x + box!.width / 2
  const cy = box!.y + box!.height / 2
  await page.keyboard.down('Space')
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx + dx, cy + dy, { steps: 20 })
  await page.mouse.up()
  await page.keyboard.up('Space')
}

/**
 * Shift+drag on the canvas background starting at screen (startX, startY)
 * and ending at (startX+dx, startY+dy).
 */
async function shiftDragBackground(
  page: Page,
  startX: number,
  startY: number,
  dx: number,
  dy: number,
  steps = 20
) {
  await page.keyboard.down('Shift')
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + dx, startY + dy, { steps })
  await page.mouse.up()
  await page.keyboard.up('Shift')
}

/** Add a text element via the toolbar and return its locator. */
async function addTextElement(page: Page) {
  await page.getByTitle('Text').click()
  const el = page.locator('[data-testid="text-element"]').last()
  await expect(el).toBeVisible()
  return el
}

/** Add an arrow element via the toolbar and return its locator. */
async function addArrowElement(page: Page) {
  await page.getByTitle('Arrow').click()
  const el = page.locator('[data-testid="arrow-element"]').last()
  await expect(el).toBeVisible()
  return el
}

/**
 * Add two text elements positioned far enough apart for independent marquee tests.
 * T1 is added first, dragged away from centre, then T2 is added at the default centre.
 */
async function setupTwoTextElements(page: Page) {
  await addTextElement(page)
  const t1 = page.locator('[data-testid="text-element"]').nth(0)
  // Drag T1 far from centre so T2 can occupy the default position
  await dragBy(page, t1, -200, -100)
  await page.waitForTimeout(50)
  await clickBackground(page)

  await addTextElement(page)
  const t2 = page.locator('[data-testid="text-element"]').nth(1)

  return { t1, t2 }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('14 – Mouse Gestures', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
    await page.goto(EDITOR_URL)
  })

  // =========================================================================
  // AC 1 — Background drag-to-pan pans the viewport (≥ 4 px threshold)
  // =========================================================================

  test('AC1: dragging the canvas background ≥ 4 px pans the viewport', async ({ page }) => {
    const before = parseTransform(await getWorldTransform(page))

    const canvas = page.locator('.bg-gray-100').first()
    const box = await canvas.boundingBox()
    const cx = box!.x + box!.width / 2
    const cy = box!.y + box!.height / 2

    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.mouse.move(cx + 150, cy + 100, { steps: 20 })
    await page.mouse.up()
    await page.waitForTimeout(50)

    const after = parseTransform(await getWorldTransform(page))
    const panChanged =
      Math.abs(after.panX - before.panX) > 50 || Math.abs(after.panY - before.panY) > 50
    expect(panChanged).toBe(true)
  })

  // =========================================================================
  // AC 2 — Background mousedown < 4 px deselects all elements
  // =========================================================================

  test('AC2: background mousedown that does not exceed 4 px deselects all elements', async ({
    page,
  }) => {
    const el = await addTextElement(page)
    await expect(el).toHaveCSS('outline-style', 'solid')

    await clickBackground(page)
    await expect(el).not.toHaveCSS('outline-style', 'solid')
  })

  // =========================================================================
  // AC 3 — grabbing cursor set on <body> during background drag-to-pan
  // =========================================================================

  test('AC3: grabbing cursor is set on body during background drag and restored on mouseup', async ({
    page,
  }) => {
    const canvas = page.locator('.bg-gray-100').first()
    const box = await canvas.boundingBox()
    const cx = box!.x + box!.width / 2
    const cy = box!.y + box!.height / 2

    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.mouse.move(cx + 30, cy + 30, { steps: 5 })

    const cursorMid = await page.evaluate(() => document.body.style.cursor)
    expect(cursorMid).toBe('grabbing')

    await page.mouse.up()
    await page.waitForTimeout(50)

    const cursorAfter = await page.evaluate(() => document.body.style.cursor)
    expect(cursorAfter).not.toBe('grabbing')
  })

  // =========================================================================
  // AC 4 — Space+drag pan gesture is unchanged
  // =========================================================================

  test('AC4: Space+drag still pans the viewport', async ({ page }) => {
    const before = parseTransform(await getWorldTransform(page))
    await spacePan(page, 150, 100)
    await page.waitForTimeout(50)
    const after = parseTransform(await getWorldTransform(page))
    const panChanged =
      Math.abs(after.panX - before.panX) > 80 || Math.abs(after.panY - before.panY) > 40
    expect(panChanged).toBe(true)
  })

  // =========================================================================
  // AC 5 — Zoom controls unchanged (smoke)
  // =========================================================================

  test('AC5: scroll-wheel zoom still works after mouse-gesture changes', async ({ page }) => {
    const canvas = page.locator('.bg-gray-100').first()
    const box = await canvas.boundingBox()
    const cx = box!.x + box!.width / 2
    const cy = box!.y + box!.height / 2

    const before = parseTransform(await getWorldTransform(page))
    await page.mouse.move(cx, cy)
    await page.mouse.wheel(0, -120)
    await page.waitForTimeout(100)
    const after = parseTransform(await getWorldTransform(page))
    expect(after.zoom).toBeGreaterThan(before.zoom)
  })

  // =========================================================================
  // AC 6 — Shift+click unselected element adds it to selection
  // =========================================================================

  test('AC6: Shift+clicking an unselected element adds it to the current selection', async ({
    page,
  }) => {
    const { t1, t2 } = await setupTwoTextElements(page)

    // Start with only T1 selected
    await t1.click()
    await expect(t1).toHaveCSS('outline-style', 'solid')
    await expect(t2).not.toHaveCSS('outline-style', 'solid')

    // Shift+click T2 — should add to selection without removing T1
    await t2.click({ modifiers: ['Shift'] })
    await expect(t1).toHaveCSS('outline-style', 'solid')
    await expect(t2).toHaveCSS('outline-style', 'solid')
  })

  // =========================================================================
  // AC 7 — Shift+click already-selected element removes it from selection
  // =========================================================================

  test('AC7: Shift+clicking an already-selected element removes it from the selection', async ({
    page,
  }) => {
    const { t1, t2 } = await setupTwoTextElements(page)

    await t1.click()
    await t2.click({ modifiers: ['Shift'] })
    await expect(t1).toHaveCSS('outline-style', 'solid')
    await expect(t2).toHaveCSS('outline-style', 'solid')

    // Shift+click T1 — should remove T1 from selection
    await t1.click({ modifiers: ['Shift'] })
    await expect(t1).not.toHaveCSS('outline-style', 'solid')
    await expect(t2).toHaveCSS('outline-style', 'solid')
  })

  // =========================================================================
  // AC 8 — Plain click on element replaces the entire selection
  // =========================================================================

  test('AC8: plain click on an element replaces the entire multi-selection', async ({ page }) => {
    const { t1, t2 } = await setupTwoTextElements(page)

    await t1.click()
    await t2.click({ modifiers: ['Shift'] })
    await expect(t1).toHaveCSS('outline-style', 'solid')
    await expect(t2).toHaveCSS('outline-style', 'solid')

    // Plain click T1 — replaces selection with only T1
    await t1.click()
    await expect(t1).toHaveCSS('outline-style', 'solid')
    await expect(t2).not.toHaveCSS('outline-style', 'solid')
  })

  // =========================================================================
  // AC 9 — Shift+click on canvas background does not change selection
  // =========================================================================

  test('AC9: Shift+clicking the canvas background does not deselect elements', async ({ page }) => {
    const { t1 } = await setupTwoTextElements(page)

    await t1.click()
    await expect(t1).toHaveCSS('outline-style', 'solid')

    // Shift+click the far corner of the canvas background
    await page
      .locator('.bg-gray-100')
      .first()
      .click({ position: { x: 10, y: 10 }, modifiers: ['Shift'], force: true })

    // T1 must remain selected
    await expect(t1).toHaveCSS('outline-style', 'solid')
  })

  // =========================================================================
  // AC 10 — All selected elements show the blue bounding-box outline
  // =========================================================================

  test('AC10: all selected elements display the blue bounding-box outline', async ({ page }) => {
    const { t1, t2 } = await setupTwoTextElements(page)

    await t1.click()
    await t2.click({ modifiers: ['Shift'] })

    await expect(t1).toHaveCSS('outline-style', 'solid')
    await expect(t2).toHaveCSS('outline-style', 'solid')
    await expect(t1).toHaveCSS('outline-color', 'rgb(59, 130, 246)')
    await expect(t2).toHaveCSS('outline-color', 'rgb(59, 130, 246)')
  })

  // =========================================================================
  // AC 11 — Escape clears the entire selection
  // =========================================================================

  test('AC11: Escape clears the entire selection when no element is in edit mode', async ({
    page,
  }) => {
    const { t1, t2 } = await setupTwoTextElements(page)

    await t1.click()
    await t2.click({ modifiers: ['Shift'] })
    await expect(t1).toHaveCSS('outline-style', 'solid')
    await expect(t2).toHaveCSS('outline-style', 'solid')

    await page.keyboard.press('Escape')

    await expect(t1).not.toHaveCSS('outline-style', 'solid')
    await expect(t2).not.toHaveCSS('outline-style', 'solid')
  })

  // =========================================================================
  // AC 12 — Dragging one selected element moves all selected elements together
  // =========================================================================

  test('AC12: dragging one of multiple selected elements moves all of them by the same delta', async ({
    page,
  }) => {
    const { t1, t2 } = await setupTwoTextElements(page)

    await t1.click()
    await t2.click({ modifiers: ['Shift'] })

    const t1Before = await t1.boundingBox()
    const t2Before = await t2.boundingBox()

    await dragBy(page, t1, 80, 50)
    await page.waitForTimeout(50)

    const t1After = await t1.boundingBox()
    const t2After = await t2.boundingBox()

    const t1Dx = t1After!.x - t1Before!.x
    const t1Dy = t1After!.y - t1Before!.y
    const t2Dx = t2After!.x - t2Before!.x
    const t2Dy = t2After!.y - t2Before!.y

    // Both elements moved by approximately the same delta
    expect(Math.abs(t1Dx - t2Dx)).toBeLessThan(5)
    expect(Math.abs(t1Dy - t2Dy)).toBeLessThan(5)
    // The drag was large enough to actually move them
    expect(Math.abs(t1Dx)).toBeGreaterThan(30)
  })

  // =========================================================================
  // AC 13 — Arrow element connections cleared on multi-element drag
  // =========================================================================

  test('AC13: multi-element drag including an arrow completes without error', async ({ page }) => {
    // Add a text element and move it up so it does not overlap the arrow's default position
    const textEl = await addTextElement(page)
    await dragBy(page, textEl, 0, -150)
    await clickBackground(page)
    const arrowEl = await addArrowElement(page)

    // Select both
    await textEl.click()
    await arrowEl.click({ modifiers: ['Shift'] })
    await expect(textEl).toHaveCSS('outline-style', 'solid')
    // Arrow selection outline lives on an inner div inside the arrow container
    await expect(arrowEl.locator('div').first()).toHaveCSS('outline-style', 'solid')

    // Drag the text element — both should move
    const textBefore = await textEl.boundingBox()
    await dragBy(page, textEl, 60, 40)
    await page.waitForTimeout(50)
    const textAfter = await textEl.boundingBox()

    expect(Math.abs(textAfter!.x - textBefore!.x)).toBeGreaterThan(20)

    // Both should still be selected after the drag (AC16 also)
    await expect(textEl).toHaveCSS('outline-style', 'solid')
    await expect(arrowEl.locator('div').first()).toHaveCSS('outline-style', 'solid')
  })

  // =========================================================================
  // AC 14 — Contextual toolbar: same-type → visible; mixed-type → hidden
  // =========================================================================

  test('AC14: contextual toolbar is visible when two text elements are selected', async ({
    page,
  }) => {
    const { t1, t2 } = await setupTwoTextElements(page)

    await t1.click()
    await t2.click({ modifiers: ['Shift'] })

    await expect(page.getByTestId('contextual-toolbar')).toBeVisible()
  })

  test('AC14: contextual toolbar is hidden when a text and an arrow element are selected', async ({
    page,
  }) => {
    // Move text element up so it does not overlap the arrow's default position
    const textEl = await addTextElement(page)
    await dragBy(page, textEl, 0, -150)
    await clickBackground(page)
    const arrowEl = await addArrowElement(page)

    await textEl.click()
    await arrowEl.click({ modifiers: ['Shift'] })

    await expect(page.getByTestId('contextual-toolbar')).not.toBeVisible()
  })

  // =========================================================================
  // AC 15 — Property change via toolbar applies to all selected elements
  // =========================================================================

  test('AC15: increasing font size via toolbar applies to every selected text element', async ({
    page,
  }) => {
    const { t1, t2 } = await setupTwoTextElements(page)

    await t1.click()
    await t2.click({ modifiers: ['Shift'] })

    const toolbar = page.getByTestId('contextual-toolbar')
    await expect(toolbar).toBeVisible()

    // Default font size is 16; increase twice → 18
    await toolbar.getByLabel('Increase font size').click()
    await toolbar.getByLabel('Increase font size').click()
    await page.waitForTimeout(50)

    // Click T1 alone and verify font size input reads 18
    await t1.click()
    await expect(toolbar.getByRole('spinbutton', { name: 'Font size' })).toHaveValue('18')

    // Click T2 alone and verify font size input also reads 18
    await t2.click()
    await expect(toolbar.getByRole('spinbutton', { name: 'Font size' })).toHaveValue('18')
  })

  // =========================================================================
  // AC 16 — All selected elements remain selected after multi-element drag
  // =========================================================================

  test('AC16: after a multi-element drag all selected elements remain selected', async ({
    page,
  }) => {
    const { t1, t2 } = await setupTwoTextElements(page)

    await t1.click()
    await t2.click({ modifiers: ['Shift'] })

    await dragBy(page, t1, 60, 40)
    await page.waitForTimeout(50)

    await expect(t1).toHaveCSS('outline-style', 'solid')
    await expect(t2).toHaveCSS('outline-style', 'solid')
  })

  // =========================================================================
  // AC 17 — Plain click on element while multi-selection active replaces selection
  // =========================================================================

  test('AC17: plain click on an element while multi-selection active replaces the selection', async ({
    page,
  }) => {
    const { t1, t2 } = await setupTwoTextElements(page)

    await t1.click()
    await t2.click({ modifiers: ['Shift'] })
    await expect(t1).toHaveCSS('outline-style', 'solid')
    await expect(t2).toHaveCSS('outline-style', 'solid')

    // Plain click T1 — only T1 remains selected
    await t1.click()
    await expect(t1).toHaveCSS('outline-style', 'solid')
    await expect(t2).not.toHaveCSS('outline-style', 'solid')
  })

  // =========================================================================
  // AC 18 — Plain click on background while multi-selection active deselects all
  // =========================================================================

  test('AC18: plain click on the canvas background deselects all elements', async ({ page }) => {
    const { t1, t2 } = await setupTwoTextElements(page)

    await t1.click()
    await t2.click({ modifiers: ['Shift'] })
    await expect(t1).toHaveCSS('outline-style', 'solid')
    await expect(t2).toHaveCSS('outline-style', 'solid')

    await clickBackground(page)
    await expect(t1).not.toHaveCSS('outline-style', 'solid')
    await expect(t2).not.toHaveCSS('outline-style', 'solid')
  })

  // =========================================================================
  // AC 19 — Shift+drag on background draws a dashed marquee rectangle
  // =========================================================================

  test('AC19: Shift+drag on background draws a dashed marquee rectangle with a faint blue fill', async ({
    page,
  }) => {
    const canvas = page.locator('.bg-gray-100').first()
    const box = await canvas.boundingBox()
    const startX = box!.x + 50
    const startY = box!.y + 50

    await page.keyboard.down('Shift')
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX + 150, startY + 100, { steps: 10 })

    // Marquee is visible while dragging
    const marquee = page.getByTestId('marquee-rect')
    await expect(marquee).toBeVisible()
    await expect(marquee).toHaveCSS('border-style', 'dashed')

    await page.mouse.up()
    await page.keyboard.up('Shift')
  })

  // =========================================================================
  // AC 20 — Marquee tracks drags in all four directions
  // =========================================================================

  test('AC20: marquee correctly tracks a top-right direction drag', async ({ page }) => {
    const canvas = page.locator('.bg-gray-100').first()
    const box = await canvas.boundingBox()
    const startX = box!.x + 250
    const startY = box!.y + 200

    await page.keyboard.down('Shift')
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX + 120, startY - 90, { steps: 10 })

    const marquee = page.getByTestId('marquee-rect')
    await expect(marquee).toBeVisible()
    const marqueeBox = await marquee.boundingBox()
    expect(marqueeBox!.width).toBeGreaterThan(60)
    expect(marqueeBox!.height).toBeGreaterThan(40)

    await page.mouse.up()
    await page.keyboard.up('Shift')
  })

  test('AC20: marquee correctly tracks a bottom-left direction drag', async ({ page }) => {
    const canvas = page.locator('.bg-gray-100').first()
    const box = await canvas.boundingBox()
    const startX = box!.x + 350
    const startY = box!.y + 150

    await page.keyboard.down('Shift')
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX - 120, startY + 90, { steps: 10 })

    const marquee = page.getByTestId('marquee-rect')
    await expect(marquee).toBeVisible()
    const marqueeBox = await marquee.boundingBox()
    expect(marqueeBox!.width).toBeGreaterThan(60)
    expect(marqueeBox!.height).toBeGreaterThan(40)

    await page.mouse.up()
    await page.keyboard.up('Shift')
  })

  test('AC20: marquee correctly tracks a top-left direction drag', async ({ page }) => {
    const canvas = page.locator('.bg-gray-100').first()
    const box = await canvas.boundingBox()
    const startX = box!.x + 350
    const startY = box!.y + 200

    await page.keyboard.down('Shift')
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX - 100, startY - 80, { steps: 10 })

    const marquee = page.getByTestId('marquee-rect')
    await expect(marquee).toBeVisible()
    const marqueeBox = await marquee.boundingBox()
    expect(marqueeBox!.width).toBeGreaterThan(50)
    expect(marqueeBox!.height).toBeGreaterThan(40)

    await page.mouse.up()
    await page.keyboard.up('Shift')
  })

  // =========================================================================
  // AC 21 — Fully enclosed elements added; partially overlapping ones excluded
  // =========================================================================

  test('AC21: element fully enclosed by the marquee is added to the selection', async ({
    page,
  }) => {
    const textEl = await addTextElement(page)
    await clickBackground(page)

    const elBox = await textEl.boundingBox()
    const canvas = page.locator('.bg-gray-100').first()
    const canvasBox = await canvas.boundingBox()

    // Marquee starts 20 px before the element's top-left and ends 20 px past its bottom-right.
    // We start the drag from a safe point on the canvas background (above the element).
    const startX = Math.max(canvasBox!.x + 5, elBox!.x - 20)
    const startY = Math.max(canvasBox!.y + 5, elBox!.y - 20)
    const dx = elBox!.width + 40
    const dy = elBox!.height + 40

    await shiftDragBackground(page, startX, startY, dx, dy)
    await page.waitForTimeout(50)

    await expect(textEl).toHaveCSS('outline-style', 'solid')
  })

  test('AC21: element that only partially overlaps the marquee is NOT selected', async ({
    page,
  }) => {
    const textEl = await addTextElement(page)
    await clickBackground(page)

    const elBox = await textEl.boundingBox()
    const canvas = page.locator('.bg-gray-100').first()
    const canvasBox = await canvas.boundingBox()

    // Marquee starts at the canvas top-left, ends at the horizontal midpoint of the element.
    // This covers the element's left portion but NOT its right portion.
    const startX = canvasBox!.x + 10
    const startY = canvasBox!.y + 10
    const endX = elBox!.x + elBox!.width / 2 - 5
    const endY = elBox!.y + elBox!.height + 20
    const dx = endX - startX
    const dy = endY - startY

    await shiftDragBackground(page, startX, startY, dx, dy)
    await page.waitForTimeout(50)

    await expect(textEl).not.toHaveCSS('outline-style', 'solid')
  })

  // =========================================================================
  // AC 22 — Locked elements are not selected by marquee
  // (No UI control to lock elements; this AC is covered by unit tests.)
  // =========================================================================

  // =========================================================================
  // AC 23 — Marquee over empty area leaves the current selection unchanged
  // =========================================================================

  test('AC23: Shift+drag over an empty area does not change the current selection', async ({
    page,
  }) => {
    const textEl = await addTextElement(page)
    await clickBackground(page)
    await textEl.click()
    await expect(textEl).toHaveCSS('outline-style', 'solid')

    const canvas = page.locator('.bg-gray-100').first()
    const canvasBox = await canvas.boundingBox()

    // Draw a small marquee at the very top-left corner — far from the text element at (560, 320)
    await shiftDragBackground(page, canvasBox!.x + 10, canvasBox!.y + 10, 60, 40)
    await page.waitForTimeout(50)

    // Text element must still be selected
    await expect(textEl).toHaveCSS('outline-style', 'solid')
  })

  // =========================================================================
  // AC 24 — Marquee overlay is removed immediately on mouseup
  // =========================================================================

  test('AC24: the marquee rectangle is removed immediately on mouseup', async ({ page }) => {
    const canvas = page.locator('.bg-gray-100').first()
    const box = await canvas.boundingBox()
    const startX = box!.x + 50
    const startY = box!.y + 50

    await page.keyboard.down('Shift')
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX + 100, startY + 80, { steps: 10 })

    // Visible mid-drag
    await expect(page.getByTestId('marquee-rect')).toBeVisible()

    await page.mouse.up()
    await page.keyboard.up('Shift')

    // Gone after mouseup
    await expect(page.getByTestId('marquee-rect')).not.toBeAttached()
  })

  // =========================================================================
  // AC 25 — Shift+drag < 4 px treated as Shift+click (no selection change)
  // =========================================================================

  test('AC25: Shift+drag under 4 px does not start a marquee and does not change selection', async ({
    page,
  }) => {
    const textEl = await addTextElement(page)
    await clickBackground(page)
    await textEl.click()
    await expect(textEl).toHaveCSS('outline-style', 'solid')

    const canvas = page.locator('.bg-gray-100').first()
    const box = await canvas.boundingBox()
    const startX = box!.x + 20
    const startY = box!.y + 20

    // Move only 2 px — below the 4 px threshold
    await page.keyboard.down('Shift')
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX + 2, startY + 1, { steps: 2 })
    await page.mouse.up()
    await page.keyboard.up('Shift')
    await page.waitForTimeout(50)

    // No marquee should have appeared
    await expect(page.getByTestId('marquee-rect')).not.toBeAttached()
    // Selection is unchanged
    await expect(textEl).toHaveCSS('outline-style', 'solid')
  })

  // =========================================================================
  // AC 26 — Crosshair cursor on background while Shift is held
  // =========================================================================

  test('AC26: canvas background shows crosshair cursor while Shift is held', async ({ page }) => {
    const canvas = page.locator('.bg-gray-100').first()
    const box = await canvas.boundingBox()
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)

    await page.keyboard.down('Shift')
    await page.waitForTimeout(50)

    // The canvas container should have cursor: crosshair set via inline style
    const inlineCursor = await canvas.evaluate((el) => (el as HTMLElement).style.cursor)
    expect(inlineCursor).toBe('crosshair')

    await page.keyboard.up('Shift')
  })

  test('AC26: cursor is crosshair during an active marquee drag', async ({ page }) => {
    const canvas = page.locator('.bg-gray-100').first()
    const box = await canvas.boundingBox()
    const startX = box!.x + 50
    const startY = box!.y + 50

    await page.keyboard.down('Shift')
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX + 60, startY + 50, { steps: 8 })

    // Body cursor should be crosshair during the marquee drag
    const bodyCursor = await page.evaluate(() => document.body.style.cursor)
    expect(bodyCursor).toBe('crosshair')

    await page.mouse.up()
    await page.keyboard.up('Shift')
  })

  // =========================================================================
  // AC 27 — Successive Shift+drag operations accumulate elements into the selection
  // =========================================================================

  test('AC27: successive Shift+drag marquees accumulate elements into the selection', async ({
    page,
  }) => {
    const { t1, t2 } = await setupTwoTextElements(page)
    await clickBackground(page)

    // First marquee: fully enclose only T1.
    // Capture t1Box right before the drag so coordinates reflect the current layout.
    const t1Box = await t1.boundingBox()
    await shiftDragBackground(
      page,
      t1Box!.x - 20,
      t1Box!.y - 20,
      t1Box!.width + 40,
      t1Box!.height + 40
    )
    await page.waitForTimeout(100)

    await expect(t1).toHaveCSS('outline-style', 'solid')
    await expect(t2).not.toHaveCSS('outline-style', 'solid')

    // Re-capture t2Box after the first marquee — selecting T1 may show the contextual toolbar,
    // shifting the canvas container position and invalidating earlier bounding box readings.
    const t2Box = await t2.boundingBox()
    await shiftDragBackground(
      page,
      t2Box!.x - 20,
      t2Box!.y - 20,
      t2Box!.width + 40,
      t2Box!.height + 40
    )
    await page.waitForTimeout(100)

    await expect(t1).toHaveCSS('outline-style', 'solid')
    await expect(t2).toHaveCSS('outline-style', 'solid')
  })
})
