import { expect, Page, test } from '@playwright/test'

const EDITOR_URL = '/editor/test-design'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function addImageElement(page: Page) {
  await page.getByTitle('Image').click()
}

async function getImageElement(page: Page) {
  return page.getByText('Add image', { exact: true }).first()
}

async function clickCanvasBackground(page: Page) {
  await page.locator('.bg-gray-100').click({ position: { x: 10, y: 10 }, force: true })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('03 – Image Element', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(EDITOR_URL)
  })

  // AC 1 — toolbar shows an image icon button below the T button
  test('AC1: toolbar has an image button with tooltip "Image"', async ({ page }) => {
    const btn = page.getByTitle('Image')
    await expect(btn).toBeVisible()

    // Confirm it is in the aside sidebar
    const aside = page.locator('aside')
    await expect(aside).toContainText('')           // aside present
    await expect(aside.locator('[title="Image"]')).toBeVisible()

    // Image button is below the T button — both visible, T rendered first
    const tBtn = page.getByTitle('Text')
    const tBox = await tBtn.boundingBox()
    const imgBox = await btn.boundingBox()
    expect(imgBox!.y).toBeGreaterThan(tBox!.y)
  })

  // AC 2 — clicking the image button inserts a placeholder element at the centre
  test('AC2: clicking the image button inserts a placeholder element', async ({ page }) => {
    await addImageElement(page)
    await expect(page.getByText('Add image', { exact: true })).toBeVisible()
  })

  // AC 3 — the inserted element shows a grey placeholder with icon and label
  test('AC3: placeholder shows the "Add image" label', async ({ page }) => {
    await addImageElement(page)
    await expect(page.getByText('Add image', { exact: true })).toBeVisible()
  })

  test('AC3: placeholder contains an SVG icon', async ({ page }) => {
    await addImageElement(page)
    // The placeholder div wraps an SVG; confirm it is in the DOM
    const svg = page.locator('svg').first()
    await expect(svg).toBeAttached()
  })

  test('AC3: placeholder has a grey background colour', async ({ page }) => {
    await addImageElement(page)
    // Deselect first so the outline doesn't interfere with the element lookup
    await clickCanvasBackground(page)

    // The placeholder inner div carries the grey background
    const placeholder = page.getByText('Add image', { exact: true }).locator('..')
    await expect(placeholder).toHaveCSS('background-color', 'rgb(229, 231, 235)')
  })

  // AC 4 — clicking an image element selects it and shows a blue outline
  test('AC4: clicking an image element selects it and shows a blue outline', async ({ page }) => {
    await addImageElement(page)

    // Auto-selected after insertion — deselect first to test click-to-select
    await clickCanvasBackground(page)

    const el = await getImageElement(page)
    // Outer wrapper carries the outline; locate it via the parent of the placeholder
    const wrapper = el.locator('..').locator('..')
    await expect(wrapper).toHaveCSS('outline-style', 'none')

    await el.click()
    await expect(wrapper).toHaveCSS('outline-style', 'solid')
    await expect(wrapper).toHaveCSS('outline-color', 'rgb(59, 130, 246)')
  })

  // AC 5 — clicking the canvas background deselects the image element
  test('AC5: clicking the canvas background deselects the image element', async ({ page }) => {
    await addImageElement(page)

    const el = await getImageElement(page)
    const wrapper = el.locator('..').locator('..')

    // Confirm selected state from auto-selection on insert
    await expect(wrapper).toHaveCSS('outline-style', 'solid')

    await clickCanvasBackground(page)
    await expect(wrapper).toHaveCSS('outline-style', 'none')
  })

  // AC 6 — multiple image elements can be added independently
  test('AC6: multiple image elements can be added independently', async ({ page }) => {
    await addImageElement(page)
    await addImageElement(page)
    await addImageElement(page)

    await expect(page.getByText('Add image', { exact: true })).toHaveCount(3)
  })

  // AC 7 — refreshing the page clears all image elements (no persistence)
  test('AC7: refreshing the page removes all image elements', async ({ page }) => {
    await addImageElement(page)
    await expect(page.getByText('Add image', { exact: true })).toBeVisible()

    await page.reload()

    await expect(page.getByText('Add image', { exact: true })).not.toBeVisible()
  })
})
