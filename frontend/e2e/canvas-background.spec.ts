import { expect, Page, test } from '@playwright/test'
import { mockApiRoutes } from './mock-api'

const EDITOR_URL = '/editor/test-design'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function addTextElement(page: Page) {
  await page.getByTitle('Text').click()
}

/** Returns the "Background" header button. */
function backgroundBtn(page: Page) {
  return page.getByLabel('Canvas background', { exact: true })
}

/** Returns the colour-picker popover dialog. */
function backgroundPopover(page: Page) {
  return page.getByRole('dialog', { name: 'Canvas background colour picker' })
}

/** Returns the outermost canvas container (the one with the dynamic background style). */
function canvasContainer(page: Page) {
  return page.locator('[data-canvas-bg="true"]').first()
}

/** Opens the background popover. */
async function openPicker(page: Page) {
  await backgroundBtn(page).click()
  await expect(backgroundPopover(page)).toBeVisible()
}

/** Selects a preset colour swatch by hex value. */
async function selectPreset(page: Page, hex: string) {
  await page.getByLabel(`Set background to ${hex}`).click()
}

/**
 * Navigates to the home page, creates a named design, and opens the editor.
 * Returns the URL of the editor page.
 */
async function createDesignAndOpenEditor(page: Page, name = 'Test Design') {
  await page.goto('/')
  await page.getByRole('button', { name: /new design/i }).click()
  await page.getByLabel(/design name/i).fill(name)
  await page.getByRole('button', { name: /^create$/i }).click()
  await page.waitForURL(/\/editor\//)
  return page.url()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('20 – Canvas Background Colour', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
    await page.goto(EDITOR_URL)
  })

  // =========================================================================
  // AC1 — "Background" button is always visible in the editor header
  // =========================================================================

  test('AC1: Background button is visible in the editor header', async ({ page }) => {
    await expect(backgroundBtn(page)).toBeVisible()
  })

  test('AC1: Background button is visible regardless of selection state', async ({ page }) => {
    // No selection
    await expect(backgroundBtn(page)).toBeVisible()

    // With an element selected
    await addTextElement(page)
    await expect(backgroundBtn(page)).toBeVisible()
  })

  test('AC1: Background button is to the left of the zoom control', async ({ page }) => {
    const bgBox = await backgroundBtn(page).boundingBox()
    const zoomBox = await page.getByLabel('Reset zoom to 100%').boundingBox()
    expect(bgBox).not.toBeNull()
    expect(zoomBox).not.toBeNull()
    // Background button must be to the left of the zoom readout
    expect(bgBox!.x + bgBox!.width).toBeLessThan(zoomBox!.x)
  })

  test('AC1: Background button has title "Canvas background"', async ({ page }) => {
    await expect(backgroundBtn(page)).toHaveAttribute('title', 'Canvas background')
  })

  // =========================================================================
  // AC2 — the colour swatch on the button reflects the current backgroundColor
  // =========================================================================

  test('AC2: button swatch reflects the default grey (#F3F4F6) on a new design', async ({
    page,
  }) => {
    // The swatch <span> inside the button has an inline background-color matching
    // the current backgroundColor store value.
    const swatch = backgroundBtn(page).locator('span[aria-hidden="true"]').first()
    await expect(swatch).toHaveCSS('background-color', 'rgb(243, 244, 246)') // #F3F4F6
  })

  test('AC2: button swatch updates when a preset colour is selected', async ({ page }) => {
    await openPicker(page)
    await selectPreset(page, '#FFFFFF')
    // Popover stays open after selection — close it so the button swatch is inspectable
    await page.keyboard.press('Escape')

    const swatch = backgroundBtn(page).locator('span[aria-hidden="true"]').first()
    await expect(swatch).toHaveCSS('background-color', 'rgb(255, 255, 255)') // #FFFFFF
  })

  // =========================================================================
  // AC3 — clicking the button opens/closes the popover; Escape closes it
  // =========================================================================

  test('AC3: clicking the Background button opens the popover', async ({ page }) => {
    await backgroundBtn(page).click()
    await expect(backgroundPopover(page)).toBeVisible()
  })

  test('AC3: clicking the Background button again closes the popover', async ({ page }) => {
    await backgroundBtn(page).click()
    await expect(backgroundPopover(page)).toBeVisible()
    await backgroundBtn(page).click()
    await expect(backgroundPopover(page)).not.toBeAttached()
  })

  test('AC3: pressing Escape closes the popover', async ({ page }) => {
    await openPicker(page)
    await page.keyboard.press('Escape')
    await expect(backgroundPopover(page)).not.toBeAttached()
  })

  // =========================================================================
  // AC4 — clicking outside the popover closes it
  // =========================================================================

  test('AC4: clicking outside the popover closes it', async ({ page }) => {
    await openPicker(page)
    // Click somewhere on the canvas that is not inside the popover
    await canvasContainer(page).click({ position: { x: 20, y: 20 }, force: true })
    await expect(backgroundPopover(page)).not.toBeAttached()
  })

  // =========================================================================
  // AC5 — popover contains 12 preset swatches, a Transparent swatch, and a
  //        custom colour input
  // =========================================================================

  test('AC5: popover contains exactly 12 preset colour swatches', async ({ page }) => {
    await openPicker(page)
    const presetSwatches = backgroundPopover(page).locator(
      'button[aria-label^="Set background to #"]'
    )
    await expect(presetSwatches).toHaveCount(12)
  })

  test('AC5: popover contains a Transparent swatch button', async ({ page }) => {
    await openPicker(page)
    await expect(backgroundPopover(page).getByLabel('Set background to transparent')).toBeVisible()
  })

  test('AC5: popover contains a custom colour <input type="color">', async ({ page }) => {
    await openPicker(page)
    const customInput = backgroundPopover(page).getByLabel('Custom background colour')
    await expect(customInput).toBeVisible()
    await expect(customInput).toHaveAttribute('type', 'color')
  })

  // =========================================================================
  // AC6 — clicking a preset swatch immediately changes the canvas background
  // =========================================================================

  test('AC6: clicking the white preset sets the canvas background to white', async ({ page }) => {
    await openPicker(page)
    await selectPreset(page, '#FFFFFF')

    const canvas = canvasContainer(page)
    await expect(canvas).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  })

  test('AC6: clicking the black preset (#111827) sets the canvas background', async ({ page }) => {
    await openPicker(page)
    await selectPreset(page, '#111827')

    const canvas = canvasContainer(page)
    await expect(canvas).toHaveCSS('background-color', 'rgb(17, 24, 39)')
  })

  test('AC6: clicking the sky-blue preset (#BAE6FD) sets the canvas background', async ({
    page,
  }) => {
    await openPicker(page)
    await selectPreset(page, '#BAE6FD')

    const canvas = canvasContainer(page)
    await expect(canvas).toHaveCSS('background-color', 'rgb(186, 230, 253)')
  })

  // =========================================================================
  // AC7 — clicking Transparent sets a checkerboard pattern; not a solid colour
  // =========================================================================

  test('AC7: clicking Transparent sets backgroundColor to transparent in the store', async ({
    page,
  }) => {
    await openPicker(page)
    await backgroundPopover(page).getByLabel('Set background to transparent').click()

    // The canvas container should have a repeating-linear-gradient background-image
    // (the checkerboard) rather than a plain solid colour.
    const bgImage = await canvasContainer(page).evaluate(
      (el) => window.getComputedStyle(el).backgroundImage
    )
    expect(bgImage).toContain('repeating-linear-gradient')
  })

  test('AC7: transparent canvas shows checkerboard (background-image, not solid)', async ({
    page,
  }) => {
    await openPicker(page)
    await backgroundPopover(page).getByLabel('Set background to transparent').click()

    // Confirm it is NOT a plain solid background
    const bgImage = await canvasContainer(page).evaluate(
      (el) => window.getComputedStyle(el).backgroundImage
    )
    expect(bgImage).not.toBe('none')
  })

  // =========================================================================
  // AC8 — custom colour input updates backgroundColor in real time
  // =========================================================================

  test('AC8: custom colour input updates the canvas background when changed', async ({ page }) => {
    await openPicker(page)

    // Set a custom colour by dispatching an input event on the colour picker
    const customInput = backgroundPopover(page).getByLabel('Custom background colour')
    await customInput.evaluate((el: HTMLInputElement) => {
      el.value = '#FF0000'
      el.dispatchEvent(new Event('input', { bubbles: true }))
    })

    const canvas = canvasContainer(page)
    await expect(canvas).toHaveCSS('background-color', 'rgb(255, 0, 0)')
  })

  // =========================================================================
  // AC9 — the active swatch has a blue ring highlight
  // =========================================================================

  test('AC9: the active preset swatch has a blue ring (box-shadow)', async ({ page }) => {
    await openPicker(page)

    // Select white so we know which one to check
    await selectPreset(page, '#FFFFFF')

    const activeBtn = backgroundPopover(page).getByLabel('Set background to #FFFFFF')
    const shadow = await activeBtn.evaluate(
      (el: HTMLElement) => window.getComputedStyle(el).boxShadow
    )
    expect(shadow).toContain('59, 130, 246') // blue-500 in RGB
  })

  test('AC9: a non-active swatch does not have the blue ring', async ({ page }) => {
    await openPicker(page)
    // White is active; black should not have the ring
    await selectPreset(page, '#FFFFFF')

    const inactiveBtn = backgroundPopover(page).getByLabel('Set background to #111827')
    const shadow = await inactiveBtn.evaluate(
      (el: HTMLElement) => window.getComputedStyle(el).boxShadow
    )
    // Should not contain the blue ring colour
    expect(shadow).not.toContain('59, 130, 246')
  })

  test('AC9: transparent swatch is highlighted when background is transparent', async ({
    page,
  }) => {
    await openPicker(page)
    await backgroundPopover(page).getByLabel('Set background to transparent').click()

    // Re-open to verify (picker may close on outside click; here we just check state)
    // The checkerboard swatch span has a box-shadow ring when active
    const checkerSwatch = backgroundPopover(page)
      .getByLabel('Set background to transparent')
      .locator('span[aria-hidden="true"]')
    const shadow = await checkerSwatch.evaluate(
      (el: HTMLElement) => window.getComputedStyle(el).boxShadow
    )
    expect(shadow).toContain('59, 130, 246')
  })

  // =========================================================================
  // AC10 — changing background sets isDirty and auto-saves with backgroundColor
  //         in the canvas JSON
  // =========================================================================

  test('AC10: changing the background sets isDirty (Unsaved changes indicator appears)', async ({
    page,
  }) => {
    // Add an element first to have a non-trivial canvas
    await addTextElement(page)
    // Wait for the initial auto-save to clear isDirty
    await expect(page.getByText(/unsaved changes/i)).not.toBeVisible({ timeout: 5000 })

    await openPicker(page)
    await selectPreset(page, '#FFFFFF')

    await expect(page.getByText(/unsaved changes/i)).toBeVisible()
  })

  test('AC10: auto-save PATCH request includes backgroundColor in canvas JSON', async ({
    page,
  }) => {
    let capturedBody: Record<string, unknown> | null = null

    // Override the project route to capture the PATCH body while still serving GET
    await page.route(/\/api\/projects\/[^/]+$/, async (route) => {
      const id = new URL(route.request().url()).pathname.split('/').pop()!
      if (route.request().method() === 'PATCH') {
        capturedBody = (await route.request().postDataJSON()) as Record<string, unknown>
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: { id, updatedAt: new Date().toISOString() },
          }),
        })
        return
      }
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id,
              name: 'Test Design',
              canvas: { elements: [] },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          }),
        })
        return
      }
      await route.continue()
    })

    await addTextElement(page)

    await openPicker(page)
    await selectPreset(page, '#FFFFFF')

    // Wait for the debounced auto-save (up to 5 s)
    await page.waitForFunction(() => true, null, { timeout: 5000 })
    await expect(page.getByText(/unsaved changes/i)).not.toBeVisible({ timeout: 5000 })

    expect(capturedBody).not.toBeNull()
    const canvas = (capturedBody as { canvas?: { backgroundColor?: string } }).canvas
    expect(canvas?.backgroundColor).toBe('#FFFFFF')
  })

  // =========================================================================
  // AC11 — reloading the editor restores the saved background colour
  // =========================================================================

  test('AC11: reloading the editor restores a persisted solid background colour', async ({
    page,
  }) => {
    const DESIGN_ID = 'bg-restore-test'

    // Mock GET to return a project with backgroundColor = '#111827'
    await page.route(new RegExp(`/api/projects/${DESIGN_ID}$`), async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id: DESIGN_ID,
              name: 'BG Restore Test',
              canvas: { elements: [], backgroundColor: '#111827' },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          }),
        })
        return
      }
      await route.continue()
    })

    await page.goto(`/editor/${DESIGN_ID}`)
    await expect(page.getByRole('button', { name: /close design/i })).toBeVisible()

    const canvas = canvasContainer(page)
    await expect(canvas).toHaveCSS('background-color', 'rgb(17, 24, 39)')
  })

  test('AC11: reloading the editor restores a transparent background (shows checkerboard)', async ({
    page,
  }) => {
    const DESIGN_ID = 'bg-transparent-test'

    await page.route(new RegExp(`/api/projects/${DESIGN_ID}$`), async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id: DESIGN_ID,
              name: 'Transparent BG Test',
              canvas: { elements: [], backgroundColor: 'transparent' },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          }),
        })
        return
      }
      await route.continue()
    })

    await page.goto(`/editor/${DESIGN_ID}`)
    await expect(page.getByRole('button', { name: /close design/i })).toBeVisible()

    const bgImage = await canvasContainer(page).evaluate(
      (el) => window.getComputedStyle(el).backgroundImage
    )
    expect(bgImage).toContain('repeating-linear-gradient')
  })

  // =========================================================================
  // AC12 — old designs without backgroundColor get the default grey
  // =========================================================================

  test('AC12: designs without backgroundColor in canvas JSON load with default grey (#F3F4F6)', async ({
    page,
  }) => {
    const DESIGN_ID = 'legacy-design'

    await page.route(new RegExp(`/api/projects/${DESIGN_ID}$`), async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id: DESIGN_ID,
              name: 'Legacy Design',
              // No backgroundColor field — simulates a pre-feature-20 project
              canvas: { elements: [] },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          }),
        })
        return
      }
      await route.continue()
    })

    await page.goto(`/editor/${DESIGN_ID}`)
    await expect(page.getByRole('button', { name: /close design/i })).toBeVisible()

    const canvas = canvasContainer(page)
    await expect(canvas).toHaveCSS('background-color', 'rgb(243, 244, 246)') // #F3F4F6
  })

  test('AC12: no error state or broken UI when backgroundColor is absent from canvas JSON', async ({
    page,
  }) => {
    const DESIGN_ID = 'legacy-no-bg'

    await page.route(new RegExp(`/api/projects/${DESIGN_ID}$`), async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id: DESIGN_ID,
              name: 'Legacy No BG',
              canvas: { elements: [] },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          }),
        })
        return
      }
      await route.continue()
    })

    await page.goto(`/editor/${DESIGN_ID}`)

    // Editor shell must render normally — no error or broken state
    await expect(page.getByRole('button', { name: /close design/i })).toBeVisible()
    await expect(page.getByTitle('Text')).toBeVisible()
    await expect(backgroundBtn(page)).toBeVisible()
  })

  // =========================================================================
  // AC13 — thumbnail uses a solid background even when canvas is transparent
  // =========================================================================

  test('AC13: thumbnail upload is triggered after auto-save', async ({ page }) => {
    let thumbnailUploaded = false
    await page.route(/\/api\/projects\/[^/]+\/thumbnail$/, async (route) => {
      if (route.request().method() === 'POST') {
        thumbnailUploaded = true
        await route.fulfill({ status: 204 })
        return
      }
      await route.continue()
    })

    await addTextElement(page)

    // Wait for auto-save and thumbnail upload (up to 10 s: 2 s debounce + generation time)
    await page.waitForFunction(() => true, null, { timeout: 10_000 })
    await expect(page.getByText(/unsaved changes/i)).not.toBeVisible({ timeout: 10_000 })
    // Give thumbnail generation time to complete
    await page.waitForTimeout(3000)

    expect(thumbnailUploaded).toBe(true)
  })

  test('AC13: thumbnail is still uploaded when background is transparent', async ({ page }) => {
    let thumbnailUploaded = false
    await page.route(/\/api\/projects\/[^/]+\/thumbnail$/, async (route) => {
      if (route.request().method() === 'POST') {
        thumbnailUploaded = true
        await route.fulfill({ status: 204 })
        return
      }
      await route.continue()
    })

    // Set background to transparent
    await openPicker(page)
    await backgroundPopover(page).getByLabel('Set background to transparent').click()
    await page.keyboard.press('Escape')

    await addTextElement(page)

    await expect(page.getByText(/unsaved changes/i)).not.toBeVisible({ timeout: 10_000 })
    await page.waitForTimeout(3000)

    expect(thumbnailUploaded).toBe(true)
  })

  // =========================================================================
  // AC14 — PNG export works with both solid and transparent backgrounds
  // =========================================================================

  test('AC14: Download PNG works with a solid background colour', async ({ page }) => {
    await openPicker(page)
    await selectPreset(page, '#FFFFFF')
    await page.keyboard.press('Escape')

    await addTextElement(page)

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await page.getByLabel('Download PNG').click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/\.png$/)
  })

  test('AC14: Download PNG works when background is transparent', async ({ page }) => {
    await openPicker(page)
    await backgroundPopover(page).getByLabel('Set background to transparent').click()
    await page.keyboard.press('Escape')

    await addTextElement(page)

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await page.getByLabel('Download PNG').click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/\.png$/)
  })

  // =========================================================================
  // AC15 — PDF export works with transparent background (no error, uses white)
  // =========================================================================

  test('AC15: Download PDF works when background is transparent (no error notification)', async ({
    page,
  }) => {
    await openPicker(page)
    await backgroundPopover(page).getByLabel('Set background to transparent').click()
    await page.keyboard.press('Escape')

    await addTextElement(page)

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await page.getByLabel('Download PDF').click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/\.pdf$/)
    // No error notification should appear
    await expect(page.getByRole('alert')).not.toBeAttached()
  })

  test('AC15: Download PDF works with a solid background colour', async ({ page }) => {
    await openPicker(page)
    await selectPreset(page, '#BAE6FD')
    await page.keyboard.press('Escape')

    await addTextElement(page)

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await page.getByLabel('Download PDF').click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/\.pdf$/)
  })

  // =========================================================================
  // AC17 — changing the background does not affect elements, selection, zoom, pan
  // =========================================================================

  test('AC17: changing background colour does not deselect a selected element', async ({
    page,
  }) => {
    await addTextElement(page)
    // The text element is selected after insertion; verify the toolbar is visible
    await expect(page.getByTestId('contextual-toolbar')).toBeVisible()

    await openPicker(page)
    await selectPreset(page, '#FFFFFF')
    await page.keyboard.press('Escape')

    // Selection should still be active
    await expect(page.getByTestId('contextual-toolbar')).toBeVisible()
  })

  test('AC17: changing background colour does not alter the zoom level', async ({ page }) => {
    // Zoom to 150%
    await page.getByLabel('Zoom in').click()
    await page.getByLabel('Zoom in').click()
    const zoomBefore = await page.getByLabel('Reset zoom to 100%').textContent()

    await openPicker(page)
    await selectPreset(page, '#111827')
    await page.keyboard.press('Escape')

    const zoomAfter = await page.getByLabel('Reset zoom to 100%').textContent()
    expect(zoomAfter).toBe(zoomBefore)
  })

  test('AC17: changing background colour does not affect element count on the canvas', async ({
    page,
  }) => {
    await addTextElement(page)
    await page.keyboard.press('Escape') // deselect
    await addTextElement(page)
    const countBefore = await page.locator('[data-testid="text-element"]').count()

    await openPicker(page)
    await selectPreset(page, '#FFFFFF')
    await page.keyboard.press('Escape')

    const countAfter = await page.locator('[data-testid="text-element"]').count()
    expect(countAfter).toBe(countBefore)
  })

  // =========================================================================
  // AC18 — multiple designs maintain independent background colours
  // =========================================================================

  test('AC18: two separate designs have independent background colours', async ({ page }) => {
    const DESIGN_A = 'design-bg-a'
    const DESIGN_B = 'design-bg-b'

    // Wire both designs with distinct backgroundColors
    await page.route(new RegExp(`/api/projects/${DESIGN_A}$`), async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id: DESIGN_A,
              name: 'Design A',
              canvas: { elements: [], backgroundColor: '#FFFFFF' },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          }),
        })
        return
      }
      await route.continue()
    })

    await page.route(new RegExp(`/api/projects/${DESIGN_B}$`), async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id: DESIGN_B,
              name: 'Design B',
              canvas: { elements: [], backgroundColor: '#111827' },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          }),
        })
        return
      }
      await route.continue()
    })

    // Open Design A
    await page.goto(`/editor/${DESIGN_A}`)
    await expect(page.getByRole('button', { name: /close design/i })).toBeVisible()
    await expect(canvasContainer(page)).toHaveCSS('background-color', 'rgb(255, 255, 255)')

    // Open Design B
    await page.goto(`/editor/${DESIGN_B}`)
    await expect(page.getByRole('button', { name: /close design/i })).toBeVisible()
    await expect(canvasContainer(page)).toHaveCSS('background-color', 'rgb(17, 24, 39)')

    // Switch back to Design A — colour must be restored
    await page.goto(`/editor/${DESIGN_A}`)
    await expect(page.getByRole('button', { name: /close design/i })).toBeVisible()
    await expect(canvasContainer(page)).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  })

  test('AC18: initDesign resets backgroundColor to default grey for a new design', async ({
    page,
  }) => {
    await mockApiRoutes(page)
    // Create a design via the home page so initDesign is called with default values
    await createDesignAndOpenEditor(page, 'Fresh Design')

    const canvas = canvasContainer(page)
    await expect(canvas).toHaveCSS('background-color', 'rgb(243, 244, 246)') // #F3F4F6
  })
})
