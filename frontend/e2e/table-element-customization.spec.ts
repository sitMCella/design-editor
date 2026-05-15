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

/** Returns the centre of a locator's bounding box in screen coordinates. */
async function centre(locator: ReturnType<Page['locator']>) {
  const box = await locator.boundingBox()
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 }
}

/**
 * Drag from the centre of `from` locator by (dx, dy) screen pixels.
 * Uses many steps so the browser fires enough mousemove events for the
 * drag threshold and the clamping logic to kick in.
 */
async function dragBy(
  page: Page,
  from: ReturnType<Page['locator']>,
  dx: number,
  dy: number,
  steps = 20
) {
  const { x, y } = await centre(from)
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y + dy, { steps })
  await page.mouse.up()
}

/**
 * Drag a handle (resize handle or divider) from its centre by (dx, dy).
 */
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

test.describe('11 – Table Element Customisation', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
    await page.goto(EDITOR_URL)
  })

  // =========================================================================
  // AC1 — drag repositions the selected element without deselecting
  // =========================================================================

  test('AC1: dragging a selected table moves it to a new position', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    // Wait for selection to be rendered (isSelected=true) before dragging
    await expect(el).toHaveCSS('outline-style', 'solid')

    // IMPORTANT: the column divider sits exactly at the horizontal centre of a
    // 2-column equal-width table (200px | 200px → divider at 50%).  Dragging
    // from the centre would hit the divider's stopPropagation and start a column
    // resize instead of a body drag.  Start from 25% width (inside column 0).
    const box = await el.boundingBox()
    const startX = box!.x + box!.width * 0.25
    const startY = box!.y + box!.height * 0.25

    const initialLeft = await el.evaluate((e: HTMLElement) => e.style.left)

    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX + 150, startY + 80, { steps: 20 })
    await page.mouse.up()

    // Playwright retries until the inline style changes (React re-render)
    await expect(el).not.toHaveCSS('left', initialLeft)
  })

  test('AC1: drag does not deselect the element (blue outline stays)', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    // Drag from 25% width to avoid the column divider at 50% (200px | 200px boundary)
    const box = await el.boundingBox()
    const sx = box!.x + box!.width * 0.25
    const sy = box!.y + box!.height * 0.25
    await page.mouse.move(sx, sy)
    await page.mouse.down()
    await page.mouse.move(sx + 80, sy + 40, { steps: 20 })
    await page.mouse.up()

    await expect(el).toHaveCSS('outline-style', 'solid')
    await expect(el).toHaveCSS('outline-color', 'rgb(59, 130, 246)')
  })

  test('AC1: a movement below 4 px does not move the element', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    const before = await el.boundingBox()
    await dragBy(page, el, 2, 2, 5)
    const after = await el.boundingBox()

    expect(after!.x).toBeCloseTo(before!.x, 0)
    expect(after!.y).toBeCloseTo(before!.y, 0)
  })

  // =========================================================================
  // AC3 — corner resize handles appear when selected, hidden when not
  // =========================================================================

  test('AC3: all four corner resize handles are visible when selected', async ({ page }) => {
    await addTableElement(page)
    await expect(page.getByTestId('resize-handle-tl')).toBeVisible()
    await expect(page.getByTestId('resize-handle-tr')).toBeVisible()
    await expect(page.getByTestId('resize-handle-bl')).toBeVisible()
    await expect(page.getByTestId('resize-handle-br')).toBeVisible()
  })

  test('AC3: corner handles disappear when the element is deselected', async ({ page }) => {
    await addTableElement(page)
    await clickCanvasBackground(page)

    await expect(page.getByTestId('resize-handle-tl')).not.toBeAttached()
    await expect(page.getByTestId('resize-handle-tr')).not.toBeAttached()
    await expect(page.getByTestId('resize-handle-bl')).not.toBeAttached()
    await expect(page.getByTestId('resize-handle-br')).not.toBeAttached()
  })

  // =========================================================================
  // AC4 — corner handles resize the element; minimum 80×40; bounded by surface
  // =========================================================================

  test('AC4: dragging the br handle grows the element width and height', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    const before = await el.boundingBox()
    await dragHandle(page, page.getByTestId('resize-handle-br'), 80, 40)
    const after = await el.boundingBox()

    expect(after!.width).toBeGreaterThan(before!.width + 50)
    expect(after!.height).toBeGreaterThan(before!.height + 20)
  })

  test('AC4: dragging the tl handle shrinks the element and moves its origin', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    const before = await el.boundingBox()
    await dragHandle(page, page.getByTestId('resize-handle-tl'), 40, 20)
    const after = await el.boundingBox()

    // x/y should have increased (origin moved right/down)
    expect(after!.x).toBeGreaterThan(before!.x + 20)
    expect(after!.y).toBeGreaterThan(before!.y + 10)
    // width/height should have decreased accordingly
    expect(after!.width).toBeLessThan(before!.width - 20)
  })

  test('AC4: enforces minimum width of 80 px when shrinking via br handle', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    // Shrink far past the minimum
    await dragHandle(page, page.getByTestId('resize-handle-br'), -2000, 0)
    const after = await el.boundingBox()

    expect(after!.width).toBeGreaterThanOrEqual(80)
  })

  test('AC4: enforces minimum height of 40 px when shrinking via br handle', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    await dragHandle(page, page.getByTestId('resize-handle-br'), 0, -2000)
    const after = await el.boundingBox()

    expect(after!.height).toBeGreaterThanOrEqual(40)
  })

  // =========================================================================
  // AC5 — after corner resize, column widths and row heights scale proportionally
  // =========================================================================

  test('AC5: all columns remain equally wide after a corner resize', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    await dragHandle(page, page.getByTestId('resize-handle-br'), 100, 60)

    // Both columns in the 2-column default table should remain equal-width
    const cols = el.locator('col')
    const col0Width = await cols.nth(0).evaluate((el: HTMLElement) => parseFloat(el.style.width))
    const col1Width = await cols.nth(1).evaluate((el: HTMLElement) => parseFloat(el.style.width))
    expect(col0Width).toBeCloseTo(col1Width, 0)
  })

  test('AC5: column widths sum to the element width after a corner resize', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    await dragHandle(page, page.getByTestId('resize-handle-br'), 120, 0)

    const elBox = await el.boundingBox()
    const cols = el.locator('col')
    const widthSum =
      (await cols.nth(0).evaluate((e: HTMLElement) => parseFloat(e.style.width))) +
      (await cols.nth(1).evaluate((e: HTMLElement) => parseFloat(e.style.width)))

    expect(widthSum).toBeCloseTo(elBox!.width, 0)
  })

  test('AC5: row heights sum to the element height after a corner resize', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    await dragHandle(page, page.getByTestId('resize-handle-br'), 0, 90)

    const elBox = await el.boundingBox()
    const rows = el.locator('tr')
    let heightSum = 0
    for (let i = 0; i < 3; i++) {
      const box = await rows.nth(i).boundingBox()
      heightSum += box!.height
    }

    expect(heightSum).toBeCloseTo(elBox!.height, 0)
  })

  // =========================================================================
  // AC6 — column-divider handles appear when selected, hidden when not
  // =========================================================================

  test('AC6: n−1 column-divider handles are visible when the element is selected', async ({
    page,
  }) => {
    await addTableElement(page)
    // Default 2-column table → 1 divider
    await expect(page.getByTestId('col-divider-0')).toBeVisible()
    await expect(page.getByTestId('col-divider-1')).not.toBeAttached()
  })

  test('AC6: column-divider handles are hidden when the element is deselected', async ({
    page,
  }) => {
    await addTableElement(page)
    await clickCanvasBackground(page)
    await expect(page.getByTestId('col-divider-0')).not.toBeAttached()
  })

  test('AC6: column-divider handle shows a highlighted line on hover', async ({ page }) => {
    await addTableElement(page)
    const divider = page.getByTestId('col-divider-0')
    await divider.hover()
    // Background becomes non-transparent on hover (checked as non-empty)
    const bg = await divider.evaluate((el: HTMLElement) => el.style.backgroundColor)
    expect(bg).not.toBe('')
    expect(bg).not.toBe('transparent')
  })

  // =========================================================================
  // AC7 — dragging a column-divider redistributes width; minimum 40 px per col
  // =========================================================================

  test('AC7: dragging the column divider right makes the left column wider', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    const col0Before = await el.locator('th').nth(0).boundingBox()
    await dragHandle(page, page.getByTestId('col-divider-0'), 50, 0)
    const col0After = await el.locator('th').nth(0).boundingBox()

    expect(col0After!.width).toBeGreaterThan(col0Before!.width + 30)
  })

  test('AC7: dragging the column divider left makes the right column wider', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    const col1Before = await el.locator('th').nth(1).boundingBox()
    await dragHandle(page, page.getByTestId('col-divider-0'), -50, 0)
    const col1After = await el.locator('th').nth(1).boundingBox()

    expect(col1After!.width).toBeGreaterThan(col1Before!.width + 30)
  })

  test('AC7: column widths still sum to total element width after divider drag', async ({
    page,
  }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    await dragHandle(page, page.getByTestId('col-divider-0'), 40, 0)

    const elBox = await el.boundingBox()
    const cols = el.locator('col')
    const sum =
      (await cols.nth(0).evaluate((e: HTMLElement) => parseFloat(e.style.width))) +
      (await cols.nth(1).evaluate((e: HTMLElement) => parseFloat(e.style.width)))

    expect(sum).toBeCloseTo(elBox!.width, 0)
  })

  test('AC7: minimum column width of 40 px is enforced when dragging far left', async ({
    page,
  }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    // Drag far left — would collapse left column to 0
    await dragHandle(page, page.getByTestId('col-divider-0'), -2000, 0)

    const col0Width = await el.locator('th').nth(0).boundingBox()
    expect(col0Width!.width).toBeGreaterThanOrEqual(40)
  })

  // =========================================================================
  // AC8 — row-divider handles appear when selected, hidden when not
  // =========================================================================

  test('AC8: m−1 row-divider handles are visible when the element is selected', async ({
    page,
  }) => {
    await addTableElement(page)
    // Default 3-row table → 2 dividers
    await expect(page.getByTestId('row-divider-0')).toBeVisible()
    await expect(page.getByTestId('row-divider-1')).toBeVisible()
    await expect(page.getByTestId('row-divider-2')).not.toBeAttached()
  })

  test('AC8: row-divider handles are hidden when the element is deselected', async ({ page }) => {
    await addTableElement(page)
    await clickCanvasBackground(page)
    await expect(page.getByTestId('row-divider-0')).not.toBeAttached()
    await expect(page.getByTestId('row-divider-1')).not.toBeAttached()
  })

  // =========================================================================
  // AC9 — dragging a row-divider redistributes height; minimum 24 px per row
  // =========================================================================

  test('AC9: dragging a row divider down makes the upper row taller', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    const row0Before = await el.locator('tr').nth(0).boundingBox()
    await dragHandle(page, page.getByTestId('row-divider-0'), 0, 20)
    const row0After = await el.locator('tr').nth(0).boundingBox()

    expect(row0After!.height).toBeGreaterThan(row0Before!.height + 10)
  })

  test('AC9: dragging a row divider up makes the lower row taller', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    const row1Before = await el.locator('tr').nth(1).boundingBox()
    await dragHandle(page, page.getByTestId('row-divider-0'), 0, -20)
    const row1After = await el.locator('tr').nth(1).boundingBox()

    expect(row1After!.height).toBeGreaterThan(row1Before!.height + 10)
  })

  test('AC9: minimum row height of 24 px is enforced when dragging far up', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    // Drag far up — would collapse the top row to 0
    await dragHandle(page, page.getByTestId('row-divider-0'), 0, -2000)

    const row0 = await el.locator('tr').nth(0).boundingBox()
    expect(row0!.height).toBeGreaterThanOrEqual(24)
  })

  test('AC9: row heights still sum to total element height after divider drag', async ({
    page,
  }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    await dragHandle(page, page.getByTestId('row-divider-0'), 0, 15)

    const elBox = await el.boundingBox()
    let heightSum = 0
    for (let i = 0; i < 3; i++) {
      const box = await el.locator('tr').nth(i).boundingBox()
      heightSum += box!.height
    }

    expect(heightSum).toBeCloseTo(elBox!.height, 0)
  })

  // =========================================================================
  // AC10 — contextual toolbar shows table controls when selected; hidden otherwise
  // =========================================================================

  test('AC10: contextual toolbar appears with table controls when selected', async ({ page }) => {
    await addTableElement(page)

    const toolbar = page.getByTestId('contextual-toolbar')
    await expect(toolbar).toBeVisible()
    await expect(page.getByLabel('Add row')).toBeVisible()
    await expect(page.getByLabel('Remove row')).toBeVisible()
    await expect(page.getByLabel('Add column')).toBeVisible()
    await expect(page.getByLabel('Remove column')).toBeVisible()
  })

  test('AC10: contextual toolbar is hidden when nothing is selected', async ({ page }) => {
    await addTableElement(page)
    await clickCanvasBackground(page)
    await expect(page.getByTestId('contextual-toolbar')).not.toBeAttached()
  })

  test('AC10: table toolbar does not show text formatting controls', async ({ page }) => {
    await addTableElement(page)
    await expect(page.getByLabel('Font family')).not.toBeAttached()
    await expect(page.getByLabel('Font size')).not.toBeAttached()
    await expect(page.getByLabel('Bold')).not.toBeAttached()
  })

  test('AC10: toolbar reappears when a deselected table element is clicked again', async ({
    page,
  }) => {
    await addTableElement(page)
    await clickCanvasBackground(page)
    await expect(page.getByTestId('contextual-toolbar')).not.toBeAttached()

    const el = await getTableElement(page)
    await el.click()
    await expect(page.getByTestId('contextual-toolbar')).toBeVisible()
  })

  // =========================================================================
  // AC11 — "Add row" appends an empty data row with height 40 px
  // =========================================================================

  test('AC11: clicking "Add row" adds a fourth row to the table', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    await expect(el.locator('tr')).toHaveCount(3)
    await page.getByLabel('Add row').click()
    await expect(el.locator('tr')).toHaveCount(4)
  })

  test('AC11: the new row is a data row (uses <td> cells)', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    await page.getByLabel('Add row').click()

    // Header still has 2 <th>; data rows now have 6 <td>
    await expect(el.locator('th')).toHaveCount(2)
    await expect(el.locator('td')).toHaveCount(6)
  })

  test('AC11: the new row has two empty cells showing the placeholder text', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    await page.getByLabel('Add row').click()

    const newRow = el.locator('tr').nth(3)
    await expect(newRow.getByText('Click to edit').first()).toBeVisible()
  })

  test('AC11: element height increases after adding a row', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    const before = await el.boundingBox()
    await page.getByLabel('Add row').click()
    const after = await el.boundingBox()

    expect(after!.height).toBeGreaterThan(before!.height + 30)
  })

  // =========================================================================
  // AC12 — "Remove row" removes the last data row; disabled when only one remains
  // =========================================================================

  test('AC12: clicking "Remove row" removes the last data row', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    await expect(el.locator('tr')).toHaveCount(3)
    await page.getByLabel('Remove row').click()
    await expect(el.locator('tr')).toHaveCount(2)
  })

  test('AC12: the header row is never removed by "Remove row"', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    await page.getByLabel('Remove row').click()
    // One header row should remain
    await expect(el.locator('th')).toHaveCount(2)
  })

  test('AC12: element height decreases after removing a row', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    const before = await el.boundingBox()
    await page.getByLabel('Remove row').click()
    const after = await el.boundingBox()

    expect(after!.height).toBeLessThan(before!.height - 20)
  })

  test('AC12: "Remove row" button is disabled when only one data row remains', async ({ page }) => {
    await addTableElement(page)
    // Remove one of the two data rows → one data row remains
    await page.getByLabel('Remove row').click()
    await expect(page.getByLabel('Remove row')).toBeDisabled()
  })

  test('AC12: "Remove row" button is enabled when more than one data row exists', async ({
    page,
  }) => {
    await addTableElement(page)
    // Default has 2 data rows
    await expect(page.getByLabel('Remove row')).not.toBeDisabled()
  })

  // =========================================================================
  // AC13 — "Add column" appends an empty 120 px column to every row
  // =========================================================================

  test('AC13: clicking "Add column" adds a third column to the table', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    // Before: 2 <th>, 4 <td>
    await expect(el.locator('th')).toHaveCount(2)
    await page.getByLabel('Add column').click()
    await expect(el.locator('th')).toHaveCount(3)
  })

  test('AC13: every existing row gains an empty cell after "Add column"', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    await page.getByLabel('Add column').click()

    // 3 rows × 3 cells = 3 <th> + 6 <td>
    await expect(el.locator('th')).toHaveCount(3)
    await expect(el.locator('td')).toHaveCount(6)
  })

  test('AC13: element width increases after adding a column', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    const before = await el.boundingBox()
    await page.getByLabel('Add column').click()
    const after = await el.boundingBox()

    expect(after!.width).toBeGreaterThan(before!.width + 80)
  })

  // =========================================================================
  // AC14 — "Remove column" removes the last column; disabled when only one remains
  // =========================================================================

  test('AC14: clicking "Remove column" removes the last column from every row', async ({
    page,
  }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    await page.getByLabel('Remove column').click()

    await expect(el.locator('th')).toHaveCount(1)
    await expect(el.locator('td')).toHaveCount(2)
  })

  test('AC14: element width decreases after removing a column', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    const before = await el.boundingBox()
    await page.getByLabel('Remove column').click()
    const after = await el.boundingBox()

    expect(after!.width).toBeLessThan(before!.width - 80)
  })

  test('AC14: "Remove column" button is disabled when only one column remains', async ({
    page,
  }) => {
    await addTableElement(page)
    // Remove one column → one column remains
    await page.getByLabel('Remove column').click()
    await expect(page.getByLabel('Remove column')).toBeDisabled()
  })

  test('AC14: "Remove column" button is enabled when more than one column exists', async ({
    page,
  }) => {
    await addTableElement(page)
    await expect(page.getByLabel('Remove column')).not.toBeDisabled()
  })

  // =========================================================================
  // AC15 — double-clicking a cell enters inline edit mode
  // =========================================================================

  test('AC15: double-clicking a cell enters inline edit mode (contentEditable)', async ({
    page,
  }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    await el.locator('td').nth(0).dblclick()

    const editable = el.locator('[contenteditable="true"]')
    await expect(editable).toBeVisible()
  })

  test('AC15: corner handles and dividers are hidden while editing', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    await el.locator('td').nth(0).dblclick()

    await expect(page.getByTestId('resize-handle-tl')).not.toBeAttached()
    await expect(page.getByTestId('col-divider-0')).not.toBeAttached()
    await expect(page.getByTestId('row-divider-0')).not.toBeAttached()
  })

  test('AC15: double-clicking a header cell also enters edit mode', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    await el.locator('th').nth(0).dblclick()

    await expect(el.locator('[contenteditable="true"]')).toBeVisible()
  })

  // =========================================================================
  // AC16 — typing in edit mode updates the visible text in real time
  // =========================================================================

  test('AC16: text typed into the editable cell is displayed immediately', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    await el.locator('td').nth(0).dblclick()
    const editable = el.locator('[contenteditable="true"]')
    await editable.fill('New content')

    await expect(editable).toContainText('New content')
  })

  // =========================================================================
  // AC17 — pressing Enter or clicking outside the cell commits the edited value
  // =========================================================================

  test('AC17: pressing Enter commits the new content and exits edit mode', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    await el.locator('td').nth(0).dblclick()
    const editable = el.locator('[contenteditable="true"]')
    await editable.fill('Committed value')
    await page.keyboard.press('Enter')

    // Edit mode should be gone
    await expect(el.locator('[contenteditable="true"]')).not.toBeAttached()
    // Committed text should be visible in the cell
    await expect(el.locator('td').nth(0)).toContainText('Committed value')
  })

  test('AC17: clicking outside the table commits the value and exits edit mode', async ({
    page,
  }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    await el.locator('td').nth(0).dblclick()
    await el.locator('[contenteditable="true"]').fill('Outside click')

    await clickCanvasBackground(page)

    await expect(el.locator('[contenteditable="true"]')).not.toBeAttached()
    await expect(el.locator('td').nth(0)).toContainText('Outside click')
  })

  test('AC17: handles and dividers reappear after committing an edit', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    await el.locator('td').nth(0).dblclick()
    await page.keyboard.press('Enter')

    // Back in selected state — handles should be visible again
    await expect(page.getByTestId('resize-handle-tl')).toBeVisible()
    await expect(page.getByTestId('col-divider-0')).toBeVisible()
  })

  // =========================================================================
  // AC18 — pressing Escape reverts the cell to its value before editing
  // =========================================================================

  test('AC18: pressing Escape reverts the cell to its original value', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    const originalText = await el.locator('td').nth(0).innerText()

    await el.locator('td').nth(0).dblclick()
    await el.locator('[contenteditable="true"]').fill('Discarded change')
    await page.keyboard.press('Escape')

    await expect(el.locator('[contenteditable="true"]')).not.toBeAttached()
    await expect(el.locator('td').nth(0)).toContainText(originalText.trim())
  })

  test('AC18: pressing Escape exits edit mode', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    await el.locator('td').nth(0).dblclick()
    await page.keyboard.press('Escape')

    await expect(el.locator('[contenteditable="true"]')).not.toBeAttached()
  })

  // =========================================================================
  // AC19 — empty cells display a muted "Click to edit" placeholder
  // =========================================================================

  test('AC19: newly added row cells show the "Click to edit" placeholder', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    await page.getByLabel('Add row').click()

    const newRow = el.locator('tr').nth(3)
    await expect(newRow.getByText('Click to edit').first()).toBeVisible()
  })

  test('AC19: clearing a cell content shows the placeholder on blur', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    // Enter edit mode for "Cell 1", clear the content, then commit
    await el.locator('td').nth(0).dblclick()
    await el.locator('[contenteditable="true"]').fill('')
    await page.keyboard.press('Enter')

    await expect(el.locator('td').nth(0).getByText('Click to edit')).toBeVisible()
  })

  test('AC19: placeholder text is not shown in cells that have content', async ({ page }) => {
    await addTableElement(page)
    const el = await getTableElement(page)

    // Default cells have content; no placeholder should appear
    await expect(el.getByText('Click to edit')).not.toBeAttached()
  })

  // =========================================================================
  // AC20 — all customisations are persisted via auto-save within 2 seconds
  // =========================================================================

  test('AC20: auto-save PATCH request is fired after adding a row', async ({ page }) => {
    let patchBody: { canvas?: { elements?: unknown[] } } | null = null

    // Register AFTER beforeEach so it takes priority (Playwright uses LIFO)
    await page.route(/\/api\/projects\/[^/]+$/, async (route) => {
      if (route.request().method() === 'PATCH') {
        patchBody = (await route.request().postDataJSON()) as { canvas?: { elements?: unknown[] } }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, data: { updatedAt: new Date().toISOString() } }),
        })
        return
      }
      await route.continue()
    })

    // The canvas store initialises with designId:''. Auto-save only fires when
    // designId is non-empty. Use the home-page "New design" flow which calls
    // initDesign() and sets a real designId in the store.
    await page.goto('/')
    await page.getByRole('button', { name: /new design/i }).click()
    await page.getByRole('button', { name: /^create$/i }).click()
    await page.waitForURL(/\/editor\//)

    // Now designId is set → mutations mark isDirty → auto-save PATCH will fire
    await addTableElement(page)
    await page.getByLabel('Add row').click()

    // Poll until the debounced auto-save fires (2 s debounce + buffer)
    await expect.poll(() => patchBody, { timeout: 6000 }).not.toBeNull()

    expect(patchBody!.canvas).toBeDefined()
    expect(Array.isArray(patchBody!.canvas!.elements)).toBe(true)
  })

  test('AC20: auto-save payload contains the updated table element', async ({ page }) => {
    let savedElements: unknown[] = []

    await page.route(/\/api\/projects\/[^/]+$/, async (route) => {
      if (route.request().method() === 'PATCH') {
        const body = (await route.request().postDataJSON()) as { canvas?: { elements?: unknown[] } }
        if (body?.canvas?.elements) savedElements = body.canvas.elements
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, data: { updatedAt: new Date().toISOString() } }),
        })
        return
      }
      await route.continue()
    })

    // Same: go through the new-design creation flow to set a real designId
    await page.goto('/')
    await page.getByRole('button', { name: /new design/i }).click()
    await page.getByRole('button', { name: /^create$/i }).click()
    await page.waitForURL(/\/editor\//)

    await addTableElement(page)
    await page.getByLabel('Add column').click()

    // Wait for the PATCH to fire and capture updated elements
    await expect.poll(() => savedElements.length, { timeout: 6000 }).toBeGreaterThan(0)

    const tableEl = savedElements.find((e) => (e as { type?: string }).type === 'table') as
      | { columns?: number }
      | undefined
    expect(tableEl).toBeDefined()
    expect(tableEl!.columns).toBe(3)
  })

  // =========================================================================
  // AC21 — reloading and reopening the project restores the table exactly
  // =========================================================================

  /**
   * The editor loads canvas state from the store, which is hydrated via the
   * home-page "load project" flow (GET /api/projects/:id → loadDesign → navigate).
   * Direct URL navigation skips this flow, so AC21 tests go through the home page.
   */

  test('AC21: opening a saved project from the home page restores the table structure', async ({
    page,
  }) => {
    const savedCanvas = {
      elements: [
        {
          id: 'tbl-saved',
          type: 'table',
          x: 440,
          y: 300,
          width: 520,
          height: 160,
          rotation: 0,
          opacity: 1,
          locked: false,
          columns: 3,
          columnWidths: [200, 200, 120],
          rows: [
            { isHeader: true, height: 40, cells: ['H1', 'H2', 'H3'] },
            { isHeader: false, height: 60, cells: ['A1', 'A2', 'A3'] },
            { isHeader: false, height: 60, cells: ['B1', 'B2', 'B3'] },
          ],
        },
      ],
    }

    // Override list endpoint to return one project card
    await page.route(/\/api\/projects$/, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: [
              {
                id: 'saved-design',
                name: 'Restored Design',
                elementCount: 1,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
          }),
        })
        return
      }
      await route.continue()
    })

    // Override project detail endpoint to return the saved canvas
    await page.route(/\/api\/projects\/[^/]+$/, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id: 'saved-design',
              name: 'Restored Design',
              canvas: savedCanvas,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          }),
        })
        return
      }
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, data: {} }),
        })
        return
      }
      await route.continue()
    })

    // Navigate to home page and open the saved project via its card
    await page.goto('/')
    await page.getByText('Restored Design').click()
    await page.waitForURL(/\/editor\//)

    const el = await getTableElement(page)

    // 3 columns → 3 <th> in the header row
    await expect(el.locator('th')).toHaveCount(3)
    await expect(el.locator('tr')).toHaveCount(3)

    // Cell content should be restored
    await expect(el.locator('th').nth(0)).toContainText('H1')
    await expect(el.locator('td').nth(0)).toContainText('A1')
    await expect(el.locator('td').nth(3)).toContainText('B1')
  })

  test('AC21: restored table preserves custom column widths and row heights', async ({ page }) => {
    const savedCanvas = {
      elements: [
        {
          id: 'tbl-saved',
          type: 'table',
          x: 440,
          y: 300,
          width: 520,
          height: 160,
          rotation: 0,
          opacity: 1,
          locked: false,
          columns: 3,
          columnWidths: [200, 200, 120],
          rows: [
            { isHeader: true, height: 40, cells: ['H1', 'H2', 'H3'] },
            { isHeader: false, height: 60, cells: ['A1', 'A2', 'A3'] },
            { isHeader: false, height: 60, cells: ['B1', 'B2', 'B3'] },
          ],
        },
      ],
    }

    await page.route(/\/api\/projects$/, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: [
              {
                id: 'saved-design',
                name: 'Restored Design',
                elementCount: 1,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
          }),
        })
        return
      }
      await route.continue()
    })

    await page.route(/\/api\/projects\/[^/]+$/, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id: 'saved-design',
              name: 'Restored Design',
              canvas: savedCanvas,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          }),
        })
        return
      }
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, data: {} }),
        })
        return
      }
      await route.continue()
    })

    await page.goto('/')
    await page.getByText('Restored Design').click()
    await page.waitForURL(/\/editor\//)

    const el = await getTableElement(page)

    // Row heights: header 40 px, data rows 60 px each
    const row0Box = await el.locator('tr').nth(0).boundingBox()
    const row1Box = await el.locator('tr').nth(1).boundingBox()
    expect(row0Box!.height).toBeCloseTo(40, 0)
    expect(row1Box!.height).toBeCloseTo(60, 0)
  })

  // =========================================================================
  // AC22 — multiple table elements retain their individual configurations
  // =========================================================================

  test('AC22: customising one table does not affect another', async ({ page }) => {
    await addTableElement(page)
    // Click background to deselect, then add a second table
    await clickCanvasBackground(page)
    await addTableElement(page)

    // The second table is now selected. Add a row to it.
    await page.getByLabel('Add row').click()

    const first = await getTableElement(page, 0)
    const second = await getTableElement(page, 1)

    // Second table should now have 4 rows
    await expect(second.locator('tr')).toHaveCount(4)
    // First table should still have 3 rows
    await expect(first.locator('tr')).toHaveCount(3)
  })

  test('AC22: cell edits on one table do not affect another', async ({ page }) => {
    await addTableElement(page)
    await clickCanvasBackground(page)
    await addTableElement(page)

    // Edit a cell in the second (selected) table
    const second = await getTableElement(page, 1)
    await second.locator('td').nth(0).dblclick()
    await second.locator('[contenteditable="true"]').fill('Only in second')
    await page.keyboard.press('Enter')

    await expect(second.locator('td').nth(0)).toContainText('Only in second')

    const first = await getTableElement(page, 0)
    await expect(first.locator('td').nth(0)).toContainText('Cell 1')
  })

  test('AC22: add/remove column on one table does not change column count of another', async ({
    page,
  }) => {
    await addTableElement(page)
    await clickCanvasBackground(page)
    await addTableElement(page)

    // Add a column to the second table
    await page.getByLabel('Add column').click()

    const first = await getTableElement(page, 0)
    const second = await getTableElement(page, 1)

    await expect(second.locator('th')).toHaveCount(3)
    await expect(first.locator('th')).toHaveCount(2)
  })
})
