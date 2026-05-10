import { expect, Page, test } from '@playwright/test'

const EDITOR_URL = '/editor/test-design'
const DEFAULT_TEXT = 'Double-click to edit'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function addTextElement(page: Page) {
  await page.getByTitle('Text').click()
}

async function getTextElement(page: Page, text = DEFAULT_TEXT) {
  return page.getByText(text, { exact: true }).first()
}

async function enterEditMode(page: Page, text = DEFAULT_TEXT) {
  const el = await getTextElement(page, text)
  await el.click()
  await el.dblclick()
  return page.locator('[contenteditable="true"]')
}

async function clickCanvasBackground(page: Page) {
  // Click the top-left corner of the canvas viewport, well away from the centred element
  await page.locator('.bg-gray-100').click({ position: { x: 10, y: 10 }, force: true })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('01 – Toolbar & Text Element', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(EDITOR_URL)
  })

  // AC 1 — toolbar visible on the left with a "T" button
  test('AC1: toolbar is visible on the left side with a T button', async ({ page }) => {
    await expect(page.locator('aside')).toBeVisible()

    const btn = page.getByTitle('Text')
    await expect(btn).toBeVisible()
    await expect(btn).toHaveText('T')
  })

  // AC 2 — clicking T adds a text element at the centre of the design surface
  test('AC2: clicking T inserts a text element with default content', async ({ page }) => {
    await addTextElement(page)
    await expect(page.getByText(DEFAULT_TEXT, { exact: true })).toBeVisible()
  })

  // AC 3 — clicking a text element selects it and shows a blue outline
  test('AC3: clicking a text element selects it and applies a blue solid outline', async ({
    page,
  }) => {
    await addTextElement(page)

    // The element is auto-selected after insertion; deselect first to test click-to-select
    await clickCanvasBackground(page)
    const el = await getTextElement(page)
    await expect(el).toHaveCSS('outline-style', 'none')

    // Click to select
    await el.click()
    await expect(el).toHaveCSS('outline-style', 'solid')
    await expect(el).toHaveCSS('outline-color', 'rgb(59, 130, 246)')
  })

  // AC 4 — double-clicking a selected element enters edit mode and focuses the editable area
  test('AC4: double-clicking enters edit mode and focuses the contentEditable area', async ({
    page,
  }) => {
    await addTextElement(page)
    const editable = await enterEditMode(page)

    await expect(editable).toBeVisible()
    await expect(editable).toBeFocused()
  })

  test('AC4: outline becomes dashed in edit mode', async ({ page }) => {
    await addTextElement(page)
    await enterEditMode(page)

    // The outline is on the outer wrapper div, not on the contenteditable itself
    const wrapper = page.locator('[contenteditable="true"]').locator('..')
    await expect(wrapper).toHaveCSS('outline-style', 'dashed')
  })

  // AC 5 — typing in edit mode updates the visible text in real time
  test('AC5: typing in edit mode updates the text content in real time', async ({ page }) => {
    await addTextElement(page)
    const editable = await enterEditMode(page)

    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.type('Live update text')

    // Text is visible inside the editable area without needing to blur first
    await expect(editable).toContainText('Live update text')
  })

  // AC 6 — clicking outside deselects the element
  test('AC6: clicking the canvas background deselects the element', async ({ page }) => {
    await addTextElement(page)
    const el = await getTextElement(page)

    // Confirm selected
    await expect(el).toHaveCSS('outline-style', 'solid')

    await clickCanvasBackground(page)

    await expect(el).toHaveCSS('outline-style', 'none')
  })

  // AC 7 — blurring exits edit mode and retains the updated content
  test('AC7: blurring exits edit mode and retains the updated content', async ({ page }) => {
    await addTextElement(page)
    const editable = await enterEditMode(page)

    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.type('Retained content')

    // Blur by clicking the canvas background
    await clickCanvasBackground(page)

    await expect(editable).not.toBeVisible()
    await expect(page.getByText('Retained content', { exact: true })).toBeVisible()
  })

  test('AC7: pressing Escape exits edit mode without losing content', async ({ page }) => {
    await addTextElement(page)
    await enterEditMode(page)

    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.type('Escape preserved')
    await page.keyboard.press('Escape')

    await expect(page.locator('[contenteditable="true"]')).not.toBeVisible()
    await expect(page.getByText('Escape preserved', { exact: true })).toBeVisible()
  })

  // AC 8 — deleting all text and blurring removes the element from the canvas
  test('AC8: clearing all text and blurring removes the element', async ({ page }) => {
    await addTextElement(page)
    await enterEditMode(page)

    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.press('Backspace')

    // Blur by clicking the canvas background
    await clickCanvasBackground(page)

    await expect(page.getByText(DEFAULT_TEXT, { exact: true })).not.toBeVisible()
  })

  // AC 9 — multiple text elements can be added independently
  test('AC9: multiple text elements can be added and exist independently', async ({ page }) => {
    await addTextElement(page)
    await addTextElement(page)
    await addTextElement(page)

    await expect(page.getByText(DEFAULT_TEXT, { exact: true })).toHaveCount(3)
  })

  test('AC9: each added element retains its own content independently', async ({ page }) => {
    // Add first element and immediately rename it (it's on top and selected)
    await addTextElement(page)
    const editable = await enterEditMode(page)
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.type('First element')
    await clickCanvasBackground(page)
    await expect(editable).not.toBeVisible()

    // Add a second element — it gets the default text
    await addTextElement(page)

    await expect(page.getByText('First element', { exact: true })).toBeVisible()
    await expect(page.getByText(DEFAULT_TEXT, { exact: true })).toBeVisible()
  })

  // AC 10 — refreshing the page clears all elements (no persistence)
  test('AC10: refreshing the page clears all elements', async ({ page }) => {
    await addTextElement(page)
    await expect(page.getByText(DEFAULT_TEXT, { exact: true })).toBeVisible()

    await page.reload()

    await expect(page.getByText(DEFAULT_TEXT, { exact: true })).not.toBeVisible()
  })
})
