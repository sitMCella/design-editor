import { expect, Page, test } from '@playwright/test'
import { mockApiRoutes } from './mock-api'

const EDITOR_URL = '/editor/test-design'

// Tiny 1×1 GIF — works without any network access
const TEST_IMAGE_URL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs='

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function addImageElement(page: Page) {
  await page.getByTitle('Image').click()
}

async function getPlaceholderWrapper(page: Page) {
  return page.getByText('Add image', { exact: true }).first().locator('..').locator('..')
}

async function setImageUrl(page: Page, url: string) {
  await page.getByLabel('Image URL').fill(url)
  await page.keyboard.press('Enter')
}

async function clickCanvasBackground(page: Page) {
  await page
    .locator('[data-testid="canvas-container"]')
    .click({ position: { x: 10, y: 10 }, force: true })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('04 – Image Element Customisation', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
    await page.goto(EDITOR_URL)
  })

  // -------------------------------------------------------------------------
  // AC 3 — selected element shows resize handles at its four corners
  // -------------------------------------------------------------------------

  test('AC3: resize handles appear at all four corners when the element is selected', async ({
    page,
  }) => {
    await addImageElement(page)

    // Element is auto-selected on insertion
    await expect(page.getByTestId('resize-handle-tl')).toBeVisible()
    await expect(page.getByTestId('resize-handle-tr')).toBeVisible()
    await expect(page.getByTestId('resize-handle-bl')).toBeVisible()
    await expect(page.getByTestId('resize-handle-br')).toBeVisible()
  })

  test('AC3: resize handles disappear when the element is deselected', async ({ page }) => {
    await addImageElement(page)
    await clickCanvasBackground(page)

    await expect(page.getByTestId('resize-handle-tl')).not.toBeAttached()
    await expect(page.getByTestId('resize-handle-tr')).not.toBeAttached()
    await expect(page.getByTestId('resize-handle-bl')).not.toBeAttached()
    await expect(page.getByTestId('resize-handle-br')).not.toBeAttached()
  })

  // -------------------------------------------------------------------------
  // AC 5 — contextual toolbar shows image controls when selected; hidden otherwise
  // -------------------------------------------------------------------------

  test('AC5: contextual toolbar with image controls appears when an image element is selected', async ({
    page,
  }) => {
    await addImageElement(page)

    const toolbar = page.getByTestId('contextual-toolbar')
    await expect(toolbar).toBeVisible()
    await expect(page.getByLabel('Image URL')).toBeVisible()
    await expect(page.getByLabel('Upload image')).toBeVisible()
    await expect(page.getByLabel('Object fit')).toBeVisible()
  })

  test('AC5: contextual toolbar is hidden when nothing is selected', async ({ page }) => {
    await addImageElement(page)
    await clickCanvasBackground(page)

    await expect(page.getByTestId('contextual-toolbar')).not.toBeAttached()
  })

  // -------------------------------------------------------------------------
  // AC 6 — URL input updates the image src on Enter or blur
  // -------------------------------------------------------------------------

  test('AC6: entering a URL and pressing Enter displays the image', async ({ page }) => {
    await addImageElement(page)
    await setImageUrl(page, TEST_IMAGE_URL)

    // Placeholder should be replaced by a real <img>
    await expect(page.getByText('Add image', { exact: true })).not.toBeAttached()
    await expect(page.locator('img[src]').first()).toBeVisible()
  })

  test('AC6: entering a URL and blurring the input displays the image', async ({ page }) => {
    await addImageElement(page)

    await page.getByLabel('Image URL').fill(TEST_IMAGE_URL)
    // Blur by clicking elsewhere in the toolbar
    await page.getByLabel('Object fit').click()

    await expect(page.locator('img[src]').first()).toBeVisible()
  })

  test('AC6: URL input keeps its value after re-focusing and blurring (regression: image must not disappear)', async ({
    page,
  }) => {
    await addImageElement(page)
    await setImageUrl(page, TEST_IMAGE_URL)

    // Confirm the image is visible
    await expect(page.locator('img[src]').first()).toBeVisible()

    // Re-focus the URL input then blur it (simulates the failing scenario)
    const urlInput = page.getByLabel('Image URL')
    await urlInput.click()
    await page.keyboard.press('Tab') // blur without changing value

    // Image must still be present — src must not have been cleared on blur
    await expect(page.locator('img[src]').first()).toBeVisible()
    // For data: URLs the input is read-only and shows the "Uploaded file" badge
    await expect(page.getByText('Uploaded file')).toBeVisible()
  })

  // -------------------------------------------------------------------------
  // AC 8 — object-fit selector updates how the image fills the frame
  // -------------------------------------------------------------------------

  test('AC8: changing the object-fit selector updates the image CSS immediately', async ({
    page,
  }) => {
    await addImageElement(page)
    await setImageUrl(page, TEST_IMAGE_URL)

    const img = page.locator('img[src]').first()

    // Default is 'cover'
    await expect(img).toHaveCSS('object-fit', 'cover')

    await page.getByLabel('Object fit').selectOption('contain')
    await expect(img).toHaveCSS('object-fit', 'contain')

    await page.getByLabel('Object fit').selectOption('fill')
    await expect(img).toHaveCSS('object-fit', 'fill')
  })

  // -------------------------------------------------------------------------
  // AC 9 — double-click enters crop/pan mode (dashed outline, handles hidden)
  // -------------------------------------------------------------------------

  test('AC9: double-clicking a selected element enters crop/pan mode with a dashed outline', async ({
    page,
  }) => {
    await addImageElement(page)
    const wrapper = await getPlaceholderWrapper(page)

    // Element is already selected; double-click to enter crop mode
    await wrapper.dblclick()

    await expect(wrapper).toHaveCSS('outline-style', 'dashed')
  })

  test('AC9: resize handles are hidden while in crop/pan mode', async ({ page }) => {
    await addImageElement(page)
    const wrapper = await getPlaceholderWrapper(page)

    await wrapper.dblclick()

    await expect(page.getByTestId('resize-handle-tl')).not.toBeAttached()
    await expect(page.getByTestId('resize-handle-tr')).not.toBeAttached()
    await expect(page.getByTestId('resize-handle-bl')).not.toBeAttached()
    await expect(page.getByTestId('resize-handle-br')).not.toBeAttached()
  })

  // -------------------------------------------------------------------------
  // AC 11 — Escape exits crop/pan mode; clicking outside deselects
  // -------------------------------------------------------------------------

  test('AC11: pressing Escape exits crop/pan mode and restores the solid outline', async ({
    page,
  }) => {
    await addImageElement(page)
    const wrapper = await getPlaceholderWrapper(page)

    await wrapper.dblclick()
    await expect(wrapper).toHaveCSS('outline-style', 'dashed')

    await wrapper.press('Escape')

    await expect(wrapper).toHaveCSS('outline-style', 'solid')
  })

  test('AC11: pressing Escape exits crop/pan mode and restores resize handles', async ({
    page,
  }) => {
    await addImageElement(page)
    const wrapper = await getPlaceholderWrapper(page)

    await wrapper.dblclick()
    await expect(page.getByTestId('resize-handle-tl')).not.toBeAttached()

    await wrapper.press('Escape')

    await expect(page.getByTestId('resize-handle-tl')).toBeVisible()
  })

  test('AC11: clicking the canvas background exits crop/pan mode and deselects the element', async ({
    page,
  }) => {
    await addImageElement(page)
    const wrapper = await getPlaceholderWrapper(page)

    await wrapper.dblclick()
    await expect(wrapper).toHaveCSS('outline-style', 'dashed')

    await clickCanvasBackground(page)

    await expect(wrapper).toHaveCSS('outline-style', 'none')
    await expect(page.getByTestId('contextual-toolbar')).not.toBeAttached()
  })

  // -------------------------------------------------------------------------
  // AC 1 — dragging a selected element repositions it within the surface
  // -------------------------------------------------------------------------

  test('AC1: dragging a selected element moves it to a new position', async ({ page }) => {
    await addImageElement(page)
    const wrapper = await getPlaceholderWrapper(page)

    const before = await wrapper.boundingBox()
    const fromX = before!.x + before!.width / 2
    const fromY = before!.y + before!.height / 2

    await page.mouse.move(fromX, fromY)
    await page.mouse.down()
    await page.mouse.move(fromX + 120, fromY + 80, { steps: 10 })
    await page.mouse.up()

    const after = await wrapper.boundingBox()
    expect(after!.x).toBeGreaterThan(before!.x + 50)
    expect(after!.y).toBeGreaterThan(before!.y + 50)
  })

  test('AC1: dragging does not deselect the element (outline remains solid after drag)', async ({
    page,
  }) => {
    await addImageElement(page)
    const wrapper = await getPlaceholderWrapper(page)

    const box = await wrapper.boundingBox()
    const cx = box!.x + box!.width / 2
    const cy = box!.y + box!.height / 2

    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.mouse.move(cx + 120, cy + 80, { steps: 10 })
    await page.mouse.up()

    // Element is still selected after the drag
    await expect(wrapper).toHaveCSS('outline-style', 'solid')
  })
})
