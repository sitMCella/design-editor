import { expect, Page, test } from '@playwright/test'
import { mockApiRoutes } from './mock-api'

const EDITOR_URL = '/editor/test-design'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function addTableElement(page: Page) {
  await page.getByTitle('Table').click()
}

async function getTableElement(page: Page, nth = 0) {
  return page.locator('[data-testid="table-element"]').nth(nth)
}

async function clickCanvasBackground(page: Page) {
  await page.locator('.bg-gray-100').click({ position: { x: 10, y: 10 }, force: true })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('10 – Toolbar & Table Element', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
    await page.goto(EDITOR_URL)
  })

  // AC 1 — toolbar displays a table icon button below the existing tool buttons
  test('AC1: toolbar has a table button with tooltip "Table"', async ({ page }) => {
    const btn = page.getByTitle('Table')
    await expect(btn).toBeVisible()
    await expect(btn).toHaveAttribute('title', 'Table')
  })

  test('AC1: table button contains an SVG icon', async ({ page }) => {
    const btn = page.getByTitle('Table')
    await expect(btn.locator('svg')).toBeVisible()
  })

  test('AC1: table button is inside the aside sidebar', async ({ page }) => {
    await expect(page.locator('aside').getByTitle('Table')).toBeVisible()
  })

  test('AC1: table button is below the Arrow button', async ({ page }) => {
    const tableBox = await page.getByTitle('Table').boundingBox()
    const arrowBox = await page.getByTitle('Arrow').boundingBox()
    expect(tableBox!.y).toBeGreaterThan(arrowBox!.y)
  })

  // AC 2 — clicking the button inserts a table element at the centre of the design surface
  test('AC2: clicking the table button inserts a table element on the canvas', async ({ page }) => {
    await addTableElement(page)
    await expect(page.locator('[data-testid="table-element"]')).toHaveCount(1)
  })

  test('AC2: table element is positioned near the centre of the design surface', async ({
    page,
  }) => {
    await addTableElement(page)

    const el = await getTableElement(page)
    const box = await el.boundingBox()
    expect(box).not.toBeNull()

    // Element is at x:440, y:300 within the 1280×720 design surface.
    // The surface is centred in the viewport — allow ±200 px tolerance.
    const viewportSize = page.viewportSize()!
    const approxCentreX = viewportSize.width / 2
    const approxCentreY = viewportSize.height / 2

    expect(box!.x + box!.width / 2).toBeGreaterThan(approxCentreX - 200)
    expect(box!.x + box!.width / 2).toBeLessThan(approxCentreX + 200)
    expect(box!.y + box!.height / 2).toBeGreaterThan(approxCentreY - 200)
    expect(box!.y + box!.height / 2).toBeLessThan(approxCentreY + 200)
  })

  // AC 3 — 1 header row + 2 data rows, each with 2 columns
  test('AC3: table renders exactly 3 rows in total', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)
    await expect(el.locator('tr')).toHaveCount(3)
  })

  test('AC3: first row uses <th> cells (header row)', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)
    await expect(el.locator('th')).toHaveCount(2)
  })

  test('AC3: data rows use <td> cells', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)
    await expect(el.locator('td')).toHaveCount(4)
  })

  test('AC3: each row contains exactly 2 cells', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)
    const rows = el.locator('tr')
    for (let i = 0; i < 3; i++) {
      await expect(rows.nth(i).locator('th, td')).toHaveCount(2)
    }
  })

  // AC 4 — header row is visually distinct: bold text, grey background
  test('AC4: header cells have bold font weight', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)
    const headers = el.locator('th')
    for (let i = 0; i < (await headers.count()); i++) {
      await expect(headers.nth(i)).toHaveCSS('font-weight', '700')
    }
  })

  test('AC4: header cells have the grey background #F3F4F6', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)
    const headers = el.locator('th')
    for (let i = 0; i < (await headers.count()); i++) {
      await expect(headers.nth(i)).toHaveCSS('background-color', 'rgb(243, 244, 246)')
    }
  })

  test('AC4: data cells have a white background', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)
    const cells = el.locator('td')
    for (let i = 0; i < (await cells.count()); i++) {
      await expect(cells.nth(i)).toHaveCSS('background-color', 'rgb(255, 255, 255)')
    }
  })

  test('AC4: data cells are not bold', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)
    const cells = el.locator('td')
    for (let i = 0; i < (await cells.count()); i++) {
      await expect(cells.nth(i)).not.toHaveCSS('font-weight', '700')
    }
  })

  // AC 5 — cells display default placeholder text, centred
  test('AC5: header cells display their placeholder text', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)
    await expect(el.locator('th').nth(0)).toHaveText('Header 1')
    await expect(el.locator('th').nth(1)).toHaveText('Header 2')
  })

  test('AC5: data cells display their placeholder text', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)
    await expect(el.locator('td').nth(0)).toHaveText('Cell 1')
    await expect(el.locator('td').nth(1)).toHaveText('Cell 2')
    await expect(el.locator('td').nth(2)).toHaveText('Cell 3')
    await expect(el.locator('td').nth(3)).toHaveText('Cell 4')
  })

  test('AC5: cells have centred text alignment', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)
    const allCells = el.locator('th, td')
    for (let i = 0; i < (await allCells.count()); i++) {
      await expect(allCells.nth(i)).toHaveCSS('text-align', 'center')
    }
  })

  // AC 6 — all columns share equal width; all rows share equal height
  test('AC6: all columns have equal width', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)
    const headers = el.locator('th')
    const boxes = await Promise.all([
      headers.nth(0).boundingBox(),
      headers.nth(1).boundingBox(),
    ])
    expect(boxes[0]!.width).toBeCloseTo(boxes[1]!.width, 0)
  })

  test('AC6: all rows have equal height', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)
    const rows = el.locator('tr')
    const heights = await Promise.all(
      [0, 1, 2].map(async (i) => (await rows.nth(i).boundingBox())!.height)
    )
    expect(heights[0]).toBeCloseTo(heights[1], 0)
    expect(heights[1]).toBeCloseTo(heights[2], 0)
  })

  // AC 7 — clicking a table element selects it and shows a blue bounding-box outline
  test('AC7: table element is auto-selected immediately after insertion', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)
    await expect(el).toHaveCSS('outline-style', 'solid')
    await expect(el).toHaveCSS('outline-color', 'rgb(59, 130, 246)')
  })

  test('AC7: clicking a deselected table element shows a blue outline', async ({ page }) => {
    await addTableElement(page)
    await clickCanvasBackground(page)

    const el = await getTableElement(page)
    await expect(el).toHaveCSS('outline-style', 'none')

    await el.click()
    await expect(el).toHaveCSS('outline-style', 'solid')
    await expect(el).toHaveCSS('outline-color', 'rgb(59, 130, 246)')
  })

  // AC 8 — clicking the canvas background deselects the table element
  test('AC8: clicking the canvas background removes the outline', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    await expect(el).toHaveCSS('outline-style', 'solid')

    await clickCanvasBackground(page)
    await expect(el).toHaveCSS('outline-style', 'none')
  })

  // AC 9 — active tool reverts to 'select' immediately after insertion
  test('AC9: table button does not remain highlighted after insertion', async ({ page }) => {
    const btn = page.getByTitle('Table')
    await addTableElement(page)
    await expect(btn).not.toHaveClass(/bg-blue-100/)
  })

  // AC 10 — multiple table elements can be added; each is independently selectable
  test('AC10: multiple table elements can be added independently', async ({ page }) => {
    await addTableElement(page)
    await addTableElement(page)
    await addTableElement(page)
    await expect(page.locator('[data-testid="table-element"]')).toHaveCount(3)
  })

  test('AC10: clicking one table selects only that element', async ({ page }) => {
    await addTableElement(page)
    await addTableElement(page)

    await clickCanvasBackground(page)

    const first = await getTableElement(page, 0)
    const second = await getTableElement(page, 1)

    // Both tables occupy the same canvas position; the topmost (second) receives the click.
    await second.click({ force: true })

    const firstStyle = await first.evaluate((el) => getComputedStyle(el).outlineStyle)
    const secondStyle = await second.evaluate((el) => getComputedStyle(el).outlineStyle)

    const selectedCount = [firstStyle, secondStyle].filter((s) => s === 'solid').length
    expect(selectedCount).toBe(1)
  })

  // AC 11 — refreshing the page clears all table elements (no persistence)
  test('AC11: refreshing the page removes all table elements', async ({ page }) => {
    await addTableElement(page)
    await expect(page.locator('[data-testid="table-element"]')).toHaveCount(1)

    await page.reload()

    await expect(page.locator('[data-testid="table-element"]')).toHaveCount(0)
  })
})
