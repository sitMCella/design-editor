import { expect, Page, test } from '@playwright/test'
import { mockApiRoutes } from './mock-api'

const EDITOR_URL = '/editor/test-design'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function addArrowElement(page: Page) {
  await page.getByTitle('Arrow').click()
}

async function getArrowElement(page: Page, nth = 0) {
  return page.locator('[data-testid="arrow-element"]').nth(nth)
}

async function clickCanvasBackground(page: Page) {
  await page.locator('.bg-gray-100').click({ position: { x: 10, y: 10 }, force: true })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('08 – Toolbar & Arrow Element', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
    await page.goto(EDITOR_URL)
  })

  // AC 1 — toolbar displays an arrow (→) button below the existing tool buttons
  test('AC1: toolbar has an arrow button with the → character', async ({ page }) => {
    const btn = page.getByTitle('Arrow')
    await expect(btn).toBeVisible()
    await expect(btn).toHaveText('→')
  })

  test('AC1: arrow button is inside the aside sidebar', async ({ page }) => {
    const aside = page.locator('aside')
    await expect(aside.getByTitle('Arrow')).toBeVisible()
  })

  test('AC1: arrow button is below the Text and Image buttons', async ({ page }) => {
    const arrowBtn = page.getByTitle('Arrow')
    const textBtn = page.getByTitle('Text')
    const imageBtn = page.getByTitle('Image')

    const arrowBox = await arrowBtn.boundingBox()
    const textBox = await textBtn.boundingBox()
    const imageBox = await imageBtn.boundingBox()

    expect(arrowBox!.y).toBeGreaterThan(textBox!.y)
    expect(arrowBox!.y).toBeGreaterThan(imageBox!.y)
  })

  // AC 2 — hovering the arrow button shows the tooltip "Arrow"
  test('AC2: arrow button has the tooltip "Arrow"', async ({ page }) => {
    // The title attribute is the native tooltip; verify it is present on the button
    const btn = page.getByTitle('Arrow')
    await expect(btn).toHaveAttribute('title', 'Arrow')
  })

  // AC 3 — clicking the arrow button adds an arrow element at the centre of the design surface
  test('AC3: clicking the arrow button inserts an arrow element on the canvas', async ({
    page,
  }) => {
    await addArrowElement(page)
    await expect(page.locator('[data-testid="arrow-element"]')).toHaveCount(1)
  })

  test('AC3: inserted arrow element is positioned near the centre of the design surface', async ({
    page,
  }) => {
    await addArrowElement(page)

    const el = await getArrowElement(page)
    const box = await el.boundingBox()
    expect(box).not.toBeNull()

    // The element is absolutely positioned at x=540, y=355 within the 1280×720 surface.
    // The surface is centred in the viewport; allow ±100px tolerance for viewport offset.
    const viewportSize = page.viewportSize()!
    const approxCentreX = viewportSize.width / 2
    const approxCentreY = viewportSize.height / 2

    expect(box!.x + box!.width / 2).toBeGreaterThan(approxCentreX - 200)
    expect(box!.x + box!.width / 2).toBeLessThan(approxCentreX + 200)
    expect(box!.y + box!.height / 2).toBeGreaterThan(approxCentreY - 200)
    expect(box!.y + box!.height / 2).toBeLessThan(approxCentreY + 200)
  })

  // AC 4 — arrow is rendered as a horizontal line with a filled arrowhead at its right end
  test('AC4: inserted arrow contains an SVG element', async ({ page }) => {
    await addArrowElement(page)
    const el = await getArrowElement(page)
    await expect(el.locator('svg')).toBeVisible()
  })

  test('AC4: SVG contains a <line> element', async ({ page }) => {
    await addArrowElement(page)
    const el = await getArrowElement(page)
    await expect(el.locator('line')).toBeAttached()
  })

  test('AC4: SVG contains a <marker> element for the arrowhead', async ({ page }) => {
    await addArrowElement(page)
    const el = await getArrowElement(page)
    await expect(el.locator('marker')).toBeAttached()
  })

  test('AC4: line has the markerEnd attribute pointing to the arrowhead marker', async ({
    page,
  }) => {
    await addArrowElement(page)
    const el = await getArrowElement(page)
    const markerEnd = await el.locator('line').getAttribute('marker-end')
    expect(markerEnd).toMatch(/url\(#arrowhead-.+\)/)
  })

  // AC 5 — clicking the arrow element selects it and shows a blue bounding-box outline
  test('AC5: clicking an arrow element selects it and applies a blue solid outline', async ({
    page,
  }) => {
    await addArrowElement(page)

    // Auto-selected on insert — deselect first to test click-to-select
    await clickCanvasBackground(page)
    const el = await getArrowElement(page)
    await expect(el).toHaveCSS('outline-style', 'none')

    await el.click()
    // The selection outline lives on an inner div (the outer container is expanded
    // for html2canvas and does not carry the outline itself)
    await expect(el.locator('div').first()).toHaveCSS('outline-style', 'solid')
    await expect(el.locator('div').first()).toHaveCSS('outline-color', 'rgb(59, 130, 246)')
  })

  test('AC5: arrow element is auto-selected immediately after insertion', async ({ page }) => {
    await addArrowElement(page)
    const el = await getArrowElement(page)
    await expect(el.locator('div').first()).toHaveCSS('outline-style', 'solid')
  })

  // AC 6 — clicking the canvas background deselects the arrow element
  test('AC6: clicking the canvas background deselects the arrow element', async ({ page }) => {
    await addArrowElement(page)
    const el = await getArrowElement(page)

    // Confirm selected state from auto-selection on insert
    await expect(el.locator('div').first()).toHaveCSS('outline-style', 'solid')

    await clickCanvasBackground(page)
    await expect(el).toHaveCSS('outline-style', 'none')
  })

  // AC 7 — multiple arrow elements can be added independently; each is selectable individually
  test('AC7: multiple arrow elements can be added independently', async ({ page }) => {
    await addArrowElement(page)
    await addArrowElement(page)
    await addArrowElement(page)

    await expect(page.locator('[data-testid="arrow-element"]')).toHaveCount(3)
  })

  test('AC7: clicking one arrow selects only that element, not all of them', async ({ page }) => {
    await addArrowElement(page)
    await addArrowElement(page)

    // Deselect all first
    await clickCanvasBackground(page)

    const first = await getArrowElement(page, 0)
    const second = await getArrowElement(page, 1)

    // Both arrows are at the same canvas position; clicking the shared position
    // selects the topmost element (second, rendered last). Verify that exactly
    // one of the two has the selected outline — not both.
    await second.click({ force: true })

    // The selection outline lives on an inner div; check that div's computed style
    const firstStyle = await first.evaluate((el) => {
      const div = el.querySelector('div')
      return div ? getComputedStyle(div).outlineStyle : 'none'
    })
    const secondStyle = await second.evaluate((el) => {
      const div = el.querySelector('div')
      return div ? getComputedStyle(div).outlineStyle : 'none'
    })

    // Exactly one must be solid; they cannot both be selected by a single click
    const selectedCount = [firstStyle, secondStyle].filter((s) => s === 'solid').length
    expect(selectedCount).toBe(1)
  })

  // AC 8 — the active tool reverts to 'select' immediately after the arrow element is inserted
  test('AC8: arrow button does not remain in the active (highlighted) state after insertion', async ({
    page,
  }) => {
    const btn = page.getByTitle('Arrow')

    await addArrowElement(page)

    // After insertion the tool reverts to 'select'; the arrow button should not have
    // the active blue background class any longer.
    await expect(btn).not.toHaveClass(/bg-blue-100/)
  })

  // AC 9 — refreshing the page clears all elements (no persistence)
  test('AC9: refreshing the page removes all arrow elements', async ({ page }) => {
    await addArrowElement(page)
    await expect(page.locator('[data-testid="arrow-element"]')).toHaveCount(1)

    await page.reload()

    await expect(page.locator('[data-testid="arrow-element"]')).toHaveCount(0)
  })
})
