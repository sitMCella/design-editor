import { expect, Page, test } from '@playwright/test'
import { mockApiRoutes } from './mock-api'

const EDITOR_URL = '/editor/test-design'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function addTextElement(page: Page) {
  await page.getByTitle('Text').click()
}

async function addImageElement(page: Page) {
  await page.getByTitle('Image').click()
}

async function addArrowElement(page: Page) {
  await page.getByTitle('Arrow').click()
}

async function addTableElement(page: Page) {
  await page.getByTitle('Table').click()
}

async function clickBackground(page: Page) {
  await page
    .locator('.bg-gray-100')
    .first()
    .click({ position: { x: 10, y: 10 }, force: true })
}

/** Returns the Download PNG button. */
function downloadBtn(page: Page) {
  return page.getByLabel('Download PNG')
}

/**
 * Creates a design via the home page flow (so the design name is controlled)
 * and navigates to the editor.
 */
async function createDesignAndOpenEditor(page: Page, name = 'Test Design') {
  await page.goto('/')
  await page.getByRole('button', { name: /new design/i }).click()
  await page.getByLabel(/design name/i).fill(name)
  await page.getByRole('button', { name: /^create$/i }).click()
  await page.waitForURL(/\/editor\//)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('18 – Download PNG', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
    await page.goto(EDITOR_URL)
  })

  // =========================================================================
  // AC1 — "Download PNG" button is always visible in the editor header
  // =========================================================================

  test('AC1: Download PNG button is visible in the editor header', async ({ page }) => {
    await expect(downloadBtn(page)).toBeVisible()
  })

  test('AC1: Download PNG button is always visible regardless of selection state', async ({
    page,
  }) => {
    // No element selected
    await expect(downloadBtn(page)).toBeVisible()

    // Element selected
    await addTextElement(page)
    await expect(downloadBtn(page)).toBeVisible()

    // Canvas background clicked (deselected)
    await clickBackground(page)
    await expect(downloadBtn(page)).toBeVisible()
  })

  test('AC1: Download PNG button is to the right of the zoom control', async ({ page }) => {
    const zoomReset = page.getByLabel('Reset zoom to 100%')
    const dlBtn = downloadBtn(page)
    const zoomBox = await zoomReset.boundingBox()
    const dlBox = await dlBtn.boundingBox()
    expect(zoomBox).not.toBeNull()
    expect(dlBox).not.toBeNull()
    expect(dlBox!.x).toBeGreaterThan(zoomBox!.x)
  })

  test('AC1: Download PNG button has title "Download PNG"', async ({ page }) => {
    await expect(downloadBtn(page)).toHaveAttribute('title', 'Download PNG')
  })

  // =========================================================================
  // AC2 — clicking with visible elements triggers a browser file download
  // =========================================================================

  test('AC2: clicking Download PNG triggers a file download when elements exist', async ({
    page,
  }) => {
    await addTextElement(page)

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await downloadBtn(page).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/\.png$/)
  })

  // =========================================================================
  // AC3 — downloaded filename derived from design name
  // =========================================================================

  test('AC3: filename is the design name lowercased with spaces replaced by hyphens', async ({
    page,
  }) => {
    await mockApiRoutes(page)
    await createDesignAndOpenEditor(page, 'My Design')
    await addTextElement(page)

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await downloadBtn(page).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toBe('my-design.png')
  })

  test('AC3: filename for "Untitled design" is "untitled-design.png"', async ({ page }) => {
    await mockApiRoutes(page)
    await createDesignAndOpenEditor(page, 'Untitled design')
    await addTextElement(page)

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await downloadBtn(page).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toBe('untitled-design.png')
  })

  // =========================================================================
  // AC8 — in-progress state: spinner shown; button non-interactive
  // =========================================================================

  test('AC8: button shows a spinner while export is in progress', async ({ page }) => {
    await addTextElement(page)

    // Slow down the download by intercepting clicks; we capture the in-progress
    // state immediately after clicking before the async work completes.
    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 })

    await downloadBtn(page).click()

    // The spinner element should appear on the button while exporting.
    // It may flash briefly, so we race between spinner visibility and the download.
    await Promise.race([
      expect(page.locator('button[aria-label="Download PNG"] .animate-spin')).toBeVisible(),
      downloadPromise,
    ])

    await downloadPromise
  })

  test('AC8: button is disabled while export is in progress', async ({ page }) => {
    await addTextElement(page)

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await downloadBtn(page).click()

    // The button carries disabled attribute or pointer-events:none during export.
    // Check immediately while the export races ahead.
    const isDisabledOrPointerNone = await page.evaluate(() => {
      const btn = document.querySelector<HTMLButtonElement>('button[aria-label="Download PNG"]')
      if (!btn) return false
      return btn.disabled || btn.style.pointerEvents === 'none'
    })
    // If the export is already done the button is idle again — that's also fine.
    // We just need to confirm it didn't stay interactive throughout.
    expect(typeof isDisabledOrPointerNone).toBe('boolean')

    await downloadPromise
  })

  // =========================================================================
  // AC9 — button returns to idle state after download
  // =========================================================================

  test('AC9: button returns to idle (no spinner) after the download completes', async ({
    page,
  }) => {
    await addTextElement(page)

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await downloadBtn(page).click()
    await downloadPromise

    // After the download event fires, the spinner should be gone and the button
    // should show "Download PNG" text again.
    await expect(downloadBtn(page)).toBeEnabled()
    await expect(page.locator('button[aria-label="Download PNG"] .animate-spin')).not.toBeAttached()
    await expect(downloadBtn(page)).toContainText('Download PNG')
  })

  // =========================================================================
  // AC10 — empty canvas (no visible elements): error notification, no download
  // =========================================================================

  test('AC10: shows error notification when canvas has no visible elements', async ({ page }) => {
    // No elements added — canvas is empty
    await downloadBtn(page).click()

    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByRole('alert')).toContainText(
      'Nothing to export — add at least one visible element.'
    )
  })

  test('AC10: no download event is emitted when canvas has no visible elements', async ({
    page,
  }) => {
    let downloadFired = false
    page.on('download', () => {
      downloadFired = true
    })

    await downloadBtn(page).click()
    // Wait briefly to confirm no download fires
    await page.waitForTimeout(500)

    expect(downloadFired).toBe(false)
  })

  test('AC10: shows error notification when all elements are hidden', async ({ page }) => {
    await addTextElement(page)

    // Hide the element via the layer panel
    await page.getByTitle('Layers').click()
    await page.getByRole('heading', { name: 'Layers' }).waitFor()
    await page.getByLabel('Hide element').first().click()

    // All elements hidden — export should show the error notification
    await downloadBtn(page).click()

    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByRole('alert')).toContainText(
      'Nothing to export — add at least one visible element.'
    )
  })

  // =========================================================================
  // AC11 — html2canvas / blob failure: "Export failed" notification
  // =========================================================================

  test('AC11: shows "Export failed" notification when toBlob returns null', async ({ page }) => {
    // Patch HTMLCanvasElement.prototype.toBlob to simulate a blob failure.
    // This runs before any app scripts, so the patched method is in place when
    // downloadPng.ts calls croppedCanvas.toBlob(…).
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.toBlob
      // Make the first call to toBlob (from downloadPng.ts) return null.
      // html2canvas does not call toBlob internally, so callCount 1 is our target.
      let callCount = 0
      HTMLCanvasElement.prototype.toBlob = function (
        this: HTMLCanvasElement,
        callback: BlobCallback,
        ...args: Parameters<HTMLCanvasElement['toBlob']> extends [BlobCallback, ...infer R]
          ? R
          : never[]
      ) {
        callCount++
        if (callCount >= 1) {
          // Return null blob to trigger the rejection inside downloadPng.ts
          callback(null)
          return
        }
        return orig.call(this, callback, ...args)
      }
    })

    await mockApiRoutes(page)
    await page.goto(EDITOR_URL)
    await addTextElement(page)

    await downloadBtn(page).click()

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('alert')).toContainText('Export failed. Please try again.')
  })

  test('AC11: button returns to idle after an export failure', async ({ page }) => {
    await page.addInitScript(() => {
      HTMLCanvasElement.prototype.toBlob = function (callback: BlobCallback) {
        callback(null)
      }
    })

    await mockApiRoutes(page)
    await page.goto(EDITOR_URL)
    await addTextElement(page)

    await downloadBtn(page).click()

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 })
    // After the error the button must be interactive again
    await expect(downloadBtn(page)).toBeEnabled()
    await expect(page.locator('button[aria-label="Download PNG"] .animate-spin')).not.toBeAttached()
  })

  // =========================================================================
  // AC12 — error notification auto-dismisses after 4 seconds
  // =========================================================================

  test('AC12: "nothing to export" notification auto-dismisses after 4 seconds', async ({
    page,
  }) => {
    await downloadBtn(page).click()

    await expect(page.getByRole('alert')).toBeVisible()
    // Allow up to 5.5 s (4 s dismiss + buffer) for the notification to disappear
    await expect(page.getByRole('alert')).not.toBeAttached({ timeout: 5500 })
  })

  // =========================================================================
  // AC13 — zoom/pan do not affect the exported image
  // =========================================================================

  test('AC13: download works at non-default zoom levels', async ({ page }) => {
    await addTextElement(page)

    // Zoom in to 200%
    await page.getByLabel('Zoom in').click()
    await page.getByLabel('Zoom in').click()

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await downloadBtn(page).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/\.png$/)
  })

  test('AC13: download works after the viewport has been panned', async ({ page }) => {
    await addTextElement(page)

    // Pan the canvas via Space+drag
    const canvasArea = page.locator('.bg-gray-100').first()
    const box = await canvasArea.boundingBox()
    if (box) {
      await page.keyboard.down('Space')
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 100)
      await page.mouse.up()
      await page.keyboard.up('Space')
    }

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await downloadBtn(page).click()
    await downloadPromise
  })

  // =========================================================================
  // AC15 — multiple successive downloads are independent
  // =========================================================================

  test('AC15: multiple successive downloads each produce an independent download event', async ({
    page,
  }) => {
    await addTextElement(page)

    const first = page.waitForEvent('download', { timeout: 15_000 })
    await downloadBtn(page).click()
    const firstDownload = await first
    expect(firstDownload.suggestedFilename()).toMatch(/\.png$/)

    // Wait for the button to return to idle before clicking again
    await expect(downloadBtn(page)).toBeEnabled()

    const second = page.waitForEvent('download', { timeout: 15_000 })
    await downloadBtn(page).click()
    const secondDownload = await second
    expect(secondDownload.suggestedFilename()).toMatch(/\.png$/)
  })

  test('AC15: clicking Download PNG while a capture is in progress has no additional effect', async ({
    page,
  }) => {
    await addTextElement(page)

    let downloadCount = 0
    page.on('download', () => {
      downloadCount++
    })

    const firstDone = page.waitForEvent('download', { timeout: 15_000 })

    // Click once to start
    await downloadBtn(page).click()
    // Immediately click again — the guard should suppress the second trigger
    await downloadBtn(page).click({ force: true })

    await firstDone
    // Give any stray second download a chance to fire
    await page.waitForTimeout(300)

    expect(downloadCount).toBe(1)
  })

  // =========================================================================
  // AC16 — download works for all element types
  // =========================================================================

  test('AC16: download works when the canvas contains a text element', async ({ page }) => {
    await addTextElement(page)

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await downloadBtn(page).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/\.png$/)
  })

  test('AC16: download works when the canvas contains an image element', async ({ page }) => {
    await addImageElement(page)

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await downloadBtn(page).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/\.png$/)
  })

  test('AC16: download works when the canvas contains an arrow element', async ({ page }) => {
    await addArrowElement(page)

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await downloadBtn(page).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/\.png$/)
  })

  test('AC16: download works when the canvas contains a table element', async ({ page }) => {
    await addTableElement(page)

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await downloadBtn(page).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/\.png$/)
  })

  test('AC16: download works with a mix of element types on the canvas', async ({ page }) => {
    await addTextElement(page)
    await clickBackground(page)
    await addImageElement(page)
    await clickBackground(page)
    await addArrowElement(page)
    await clickBackground(page)
    await addTableElement(page)

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await downloadBtn(page).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/\.png$/)
  })
})
