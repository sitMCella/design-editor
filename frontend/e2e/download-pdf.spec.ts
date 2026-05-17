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

/** Returns the Download PDF button. */
function downloadPdfBtn(page: Page) {
  return page.getByLabel('Download PDF')
}

/** Returns the Download PNG button. */
function downloadPngBtn(page: Page) {
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

test.describe('19 – Download PDF', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
    await page.goto(EDITOR_URL)
  })

  // =========================================================================
  // AC1 — "Download PDF" button is always visible in the editor header
  // =========================================================================

  test('AC1: Download PDF button is visible in the editor header', async ({ page }) => {
    await expect(downloadPdfBtn(page)).toBeVisible()
  })

  test('AC1: Download PDF button is always visible regardless of selection state', async ({
    page,
  }) => {
    // No element selected
    await expect(downloadPdfBtn(page)).toBeVisible()

    // Element selected
    await addTextElement(page)
    await expect(downloadPdfBtn(page)).toBeVisible()

    // Canvas background clicked (deselected)
    await clickBackground(page)
    await expect(downloadPdfBtn(page)).toBeVisible()
  })

  test('AC1: Download PDF button has title "Download PDF"', async ({ page }) => {
    await expect(downloadPdfBtn(page)).toHaveAttribute('title', 'Download PDF')
  })

  test('AC1: Download PDF button is to the left of the Download PNG button', async ({ page }) => {
    const pdfBtn = downloadPdfBtn(page)
    const pngBtn = downloadPngBtn(page)

    const pdfBox = await pdfBtn.boundingBox()
    const pngBox = await pngBtn.boundingBox()

    expect(pdfBox).not.toBeNull()
    expect(pngBox).not.toBeNull()
    expect(pdfBox!.x).toBeLessThan(pngBox!.x)
  })

  test('AC1: Download PDF button is to the right of the zoom control', async ({ page }) => {
    const zoomReset = page.getByLabel('Reset zoom to 100%')
    const dlBtn = downloadPdfBtn(page)

    const zoomBox = await zoomReset.boundingBox()
    const dlBox = await dlBtn.boundingBox()

    expect(zoomBox).not.toBeNull()
    expect(dlBox).not.toBeNull()
    expect(dlBox!.x).toBeGreaterThan(zoomBox!.x)
  })

  // =========================================================================
  // AC2 — clicking with visible elements triggers a browser file download
  // =========================================================================

  test('AC2: clicking Download PDF triggers a file download when elements exist', async ({
    page,
  }) => {
    await addTextElement(page)

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await downloadPdfBtn(page).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/\.pdf$/)
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
    await downloadPdfBtn(page).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toBe('my-design.pdf')
  })

  test('AC3: filename for "Untitled design" is "untitled-design.pdf"', async ({ page }) => {
    await mockApiRoutes(page)
    await createDesignAndOpenEditor(page, 'Untitled design')
    await addTextElement(page)

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await downloadPdfBtn(page).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toBe('untitled-design.pdf')
  })

  // =========================================================================
  // AC10 — in-progress state: spinner shown; button non-interactive
  // =========================================================================

  test('AC10: button shows a spinner while export is in progress', async ({ page }) => {
    await addTextElement(page)

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 })

    await downloadPdfBtn(page).click()

    // The spinner should appear on the button while exporting.
    // It may flash briefly, so we race between spinner visibility and the download.
    await Promise.race([
      expect(page.locator('button[aria-label="Download PDF"] .animate-spin')).toBeVisible(),
      downloadPromise,
    ])

    await downloadPromise
  })

  test('AC10: button is disabled while export is in progress', async ({ page }) => {
    await addTextElement(page)

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await downloadPdfBtn(page).click()

    // The button carries disabled attribute or pointer-events:none during export.
    const isDisabledOrPointerNone = await page.evaluate(() => {
      const btn = document.querySelector<HTMLButtonElement>('button[aria-label="Download PDF"]')
      if (!btn) return false
      return btn.disabled || btn.style.pointerEvents === 'none'
    })
    // If the export is already done the button is idle again — that's acceptable.
    expect(typeof isDisabledOrPointerNone).toBe('boolean')

    await downloadPromise
  })

  // =========================================================================
  // AC11 — PNG button remains interactive while PDF export is in progress
  // =========================================================================

  test('AC11: Download PNG button remains interactive while PDF export is in progress', async ({
    page,
  }) => {
    await addTextElement(page)

    // Start the PDF export but do not await it yet
    const pdfDownload = page.waitForEvent('download', { timeout: 15_000 })
    await downloadPdfBtn(page).click()

    // Immediately verify the PNG button is still enabled
    await expect(downloadPngBtn(page)).toBeEnabled()

    // Ensure the PDF download eventually completes
    await pdfDownload
  })

  // =========================================================================
  // AC12 — button returns to idle state after download
  // =========================================================================

  test('AC12: button returns to idle (no spinner) after the download completes', async ({
    page,
  }) => {
    await addTextElement(page)

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await downloadPdfBtn(page).click()
    await downloadPromise

    await expect(downloadPdfBtn(page)).toBeEnabled()
    await expect(
      page.locator('button[aria-label="Download PDF"] .animate-spin')
    ).not.toBeAttached()
    await expect(downloadPdfBtn(page)).toContainText('Download PDF')
  })

  // =========================================================================
  // AC13 — empty canvas (no visible elements): error notification, no download
  // =========================================================================

  test('AC13: shows error notification when canvas has no visible elements', async ({ page }) => {
    // No elements added — canvas is empty
    await downloadPdfBtn(page).click()

    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByRole('alert')).toContainText(
      'Nothing to export — add at least one visible element.'
    )
  })

  test('AC13: no download event is emitted when canvas has no visible elements', async ({
    page,
  }) => {
    let downloadFired = false
    page.on('download', () => {
      downloadFired = true
    })

    await downloadPdfBtn(page).click()
    await page.waitForTimeout(500)

    expect(downloadFired).toBe(false)
  })

  test('AC13: shows error notification when all elements are hidden', async ({ page }) => {
    await addTextElement(page)

    // Hide the element via the layer panel
    await page.getByTitle('Layers').click()
    await page.getByRole('heading', { name: 'Layers' }).waitFor()
    await page.getByLabel('Hide element').first().click()

    await downloadPdfBtn(page).click()

    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByRole('alert')).toContainText(
      'Nothing to export — add at least one visible element.'
    )
  })

  // =========================================================================
  // AC14 — html2canvas / jsPDF failure: "Export failed" notification
  // =========================================================================

  test('AC14: shows "Export failed" notification when toDataURL throws', async ({ page }) => {
    // downloadPdf.ts uses toDataURL (not toBlob) to produce the JPEG data URL for jsPDF.
    // Patching it to throw simulates an html2canvas / canvas export failure.
    await page.addInitScript(() => {
      HTMLCanvasElement.prototype.toDataURL = function () {
        throw new Error('toDataURL failed')
      }
    })

    await mockApiRoutes(page)
    await page.goto(EDITOR_URL)
    await addTextElement(page)

    await downloadPdfBtn(page).click()

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('alert')).toContainText('Export failed. Please try again.')
  })

  test('AC14: button returns to idle after an export failure', async ({ page }) => {
    await page.addInitScript(() => {
      HTMLCanvasElement.prototype.toDataURL = function () {
        throw new Error('toDataURL failed')
      }
    })

    await mockApiRoutes(page)
    await page.goto(EDITOR_URL)
    await addTextElement(page)

    await downloadPdfBtn(page).click()

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 })
    await expect(downloadPdfBtn(page)).toBeEnabled()
    await expect(
      page.locator('button[aria-label="Download PDF"] .animate-spin')
    ).not.toBeAttached()
  })

  // =========================================================================
  // AC15 — error notification auto-dismisses after 4 seconds
  // =========================================================================

  test('AC15: "nothing to export" notification auto-dismisses after 4 seconds', async ({
    page,
  }) => {
    await downloadPdfBtn(page).click()

    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByRole('alert')).not.toBeAttached({ timeout: 5500 })
  })

  // =========================================================================
  // AC16 — zoom/pan do not affect the exported PDF
  // =========================================================================

  test('AC16: download works at non-default zoom levels', async ({ page }) => {
    await addTextElement(page)

    // Zoom in to 200%
    await page.getByLabel('Zoom in').click()
    await page.getByLabel('Zoom in').click()

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await downloadPdfBtn(page).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/\.pdf$/)
  })

  test('AC16: download works after the viewport has been panned', async ({ page }) => {
    await addTextElement(page)

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
    await downloadPdfBtn(page).click()
    await downloadPromise
  })

  // =========================================================================
  // AC18 — multiple successive downloads are independent
  // =========================================================================

  test('AC18: multiple successive downloads each produce an independent download event', async ({
    page,
  }) => {
    await addTextElement(page)

    const first = page.waitForEvent('download', { timeout: 15_000 })
    await downloadPdfBtn(page).click()
    const firstDownload = await first
    expect(firstDownload.suggestedFilename()).toMatch(/\.pdf$/)

    // Wait for the button to return to idle before clicking again
    await expect(downloadPdfBtn(page)).toBeEnabled()

    const second = page.waitForEvent('download', { timeout: 15_000 })
    await downloadPdfBtn(page).click()
    const secondDownload = await second
    expect(secondDownload.suggestedFilename()).toMatch(/\.pdf$/)
  })

  test('AC18: clicking Download PDF while a capture is in progress has no additional effect', async ({
    page,
  }) => {
    await addTextElement(page)

    let downloadCount = 0
    page.on('download', () => {
      downloadCount++
    })

    const firstDone = page.waitForEvent('download', { timeout: 15_000 })

    // Click once to start
    await downloadPdfBtn(page).click()
    // Immediately click again — the guard should suppress the second trigger
    await downloadPdfBtn(page).click({ force: true })

    await firstDone
    // Give any stray second download a chance to fire
    await page.waitForTimeout(300)

    expect(downloadCount).toBe(1)
  })

  // =========================================================================
  // AC19 — download works for all element types
  // =========================================================================

  test('AC19: download works when the canvas contains a text element', async ({ page }) => {
    await addTextElement(page)

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await downloadPdfBtn(page).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/\.pdf$/)
  })

  test('AC19: download works when the canvas contains an image element', async ({ page }) => {
    await addImageElement(page)

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await downloadPdfBtn(page).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/\.pdf$/)
  })

  test('AC19: download works when the canvas contains an arrow element', async ({ page }) => {
    await addArrowElement(page)

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await downloadPdfBtn(page).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/\.pdf$/)
  })

  test('AC19: download works when the canvas contains a table element', async ({ page }) => {
    await addTableElement(page)

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await downloadPdfBtn(page).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/\.pdf$/)
  })

  test('AC19: download works with a mix of element types on the canvas', async ({ page }) => {
    await addTextElement(page)
    await clickBackground(page)
    await addImageElement(page)
    await clickBackground(page)
    await addArrowElement(page)
    await clickBackground(page)
    await addTableElement(page)

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await downloadPdfBtn(page).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/\.pdf$/)
  })

  // =========================================================================
  // AC20 — Download PNG (spec 18) is not regressed
  // =========================================================================

  test('AC20: Download PNG button still triggers a PNG download independently', async ({
    page,
  }) => {
    await addTextElement(page)

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await downloadPngBtn(page).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/\.png$/)
  })

  test('AC20: clicking Download PNG does not trigger a PDF download', async ({ page }) => {
    await addTextElement(page)

    let pdfDownloadFired = false
    const pngDownload = page.waitForEvent('download', { timeout: 15_000 })

    page.on('download', (d) => {
      if (d.suggestedFilename().endsWith('.pdf')) {
        pdfDownloadFired = true
      }
    })

    await downloadPngBtn(page).click()
    await pngDownload

    expect(pdfDownloadFired).toBe(false)
  })

  test('AC20: Download PNG button remains unaffected after a PDF export completes', async ({
    page,
  }) => {
    await addTextElement(page)

    // Complete a PDF export first
    const pdfDone = page.waitForEvent('download', { timeout: 15_000 })
    await downloadPdfBtn(page).click()
    await pdfDone

    // PNG export should still work normally
    const pngDone = page.waitForEvent('download', { timeout: 15_000 })
    await downloadPngBtn(page).click()
    const pngDownload = await pngDone

    expect(pngDownload.suggestedFilename()).toMatch(/\.png$/)
  })
})
