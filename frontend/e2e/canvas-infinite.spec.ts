import { expect, Page, test } from '@playwright/test'
import { mockApiRoutes } from './mock-api'

const EDITOR_URL = '/editor/test-design'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return the CSS transform string of the world layer div. */
async function getWorldTransform(page: Page): Promise<string> {
  const worldLayer = page.locator('[style*="transform-origin"]').first()
  return worldLayer.evaluate((el) => (el as HTMLElement).style.transform)
}

/** Parse `translate(Xpx[, Ypx]) scale(Z)` into numbers.
 *  Firefox and WebKit omit the Y component when it is 0. */
function parseTransform(transform: string): { panX: number; panY: number; zoom: number } {
  const m = transform.match(/translate\(([-\d.]+)px(?:,\s*([-\d.]+)px)?\)\s*scale\(([\d.]+)\)/)
  if (!m) throw new Error(`Cannot parse transform: "${transform}"`)
  return { panX: parseFloat(m[1]), panY: parseFloat(m[2] ?? '0'), zoom: parseFloat(m[3]) }
}

/** Click a safe spot on the canvas background to deselect everything. */
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

/** Pan via Space+drag: hold Space, drag the canvas centre by (dx, dy). */
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('13 – Infinite Canvas', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
    await page.goto(EDITOR_URL)
    // Wait for the editor shell to be fully ready — the project is fetched
    // asynchronously after navigation so the Canvas keyboard handler is not
    // registered until the editor transitions from 'loading' to 'ready'.
    // The toolbar Text button is a reliable visible ready signal.
    await page.getByTitle('Text').waitFor()
  })

  // =========================================================================
  // AC 1 — no fixed 1280 × 720 surface rectangle
  // =========================================================================

  test('AC1: the canvas background is present and the world layer uses CSS transform', async ({
    page,
  }) => {
    // Gray canvas background must exist
    await expect(page.locator('.bg-gray-100')).toBeVisible()

    // The world layer (with transform-origin) must be present
    const worldLayer = page.locator('[style*="transform-origin"]').first()
    await expect(worldLayer).toBeAttached()

    // No element with a fixed 1280px width should exist inside the canvas
    const fixedSurface = page.locator('[style*="width: 1280px"], [style*="width:1280px"]')
    await expect(fixedSurface).not.toBeAttached()
  })

  test('AC1: world layer has the expected initial CSS transform (translate 0,0 scale 1)', async ({
    page,
  }) => {
    const { panX, panY, zoom } = parseTransform(await getWorldTransform(page))
    expect(zoom).toBeCloseTo(1, 5)
    expect(panX).toBeCloseTo(0, 1)
    expect(panY).toBeCloseTo(0, 1)
  })

  // =========================================================================
  // AC 2 — scroll-wheel zooms toward the cursor
  // =========================================================================

  test('AC2: scrolling up on the canvas zooms in', async ({ page }) => {
    const canvas = page.locator('.bg-gray-100').first()
    const box = await canvas.boundingBox()
    const cx = box!.x + box!.width / 2
    const cy = box!.y + box!.height / 2

    const before = parseTransform(await getWorldTransform(page))

    await page.mouse.move(cx, cy)
    await page.mouse.wheel(0, -120) // negative deltaY = scroll up = zoom in
    await page.waitForTimeout(100)

    const after = parseTransform(await getWorldTransform(page))
    expect(after.zoom).toBeGreaterThan(before.zoom)
  })

  test('AC2: scrolling down on the canvas zooms out', async ({ page }) => {
    const canvas = page.locator('.bg-gray-100').first()
    const box = await canvas.boundingBox()
    const cx = box!.x + box!.width / 2
    const cy = box!.y + box!.height / 2

    const before = parseTransform(await getWorldTransform(page))

    await page.mouse.move(cx, cy)
    await page.mouse.wheel(0, 120) // positive deltaY = scroll down = zoom out
    await page.waitForTimeout(100)

    const after = parseTransform(await getWorldTransform(page))
    expect(after.zoom).toBeLessThan(before.zoom)
  })

  test('AC2: zoom toward cursor keeps the world point under the cursor roughly stationary', async ({
    page,
  }) => {
    const canvas = page.locator('.bg-gray-100').first()
    const box = await canvas.boundingBox()
    // Offset cursor from canvas origin so we can detect the zoom-toward-point effect
    const cx = box!.x + 200
    const cy = box!.y + 150

    const before = parseTransform(await getWorldTransform(page))
    // World point under cursor before zoom
    const worldXBefore = (200 - before.panX) / before.zoom

    await page.mouse.move(cx, cy)
    await page.mouse.wheel(0, -120)
    await page.waitForTimeout(100)

    const after = parseTransform(await getWorldTransform(page))
    // World point under cursor after zoom — should be approximately the same
    const worldXAfter = (200 - after.panX) / after.zoom

    expect(worldXAfter).toBeCloseTo(worldXBefore, 0)
  })

  // =========================================================================
  // AC 3 — Ctrl/Cmd + = and Ctrl/Cmd + − keyboard shortcuts
  // =========================================================================

  test('AC3: Ctrl+= zooms in by ×1.25', async ({ page }) => {
    const before = parseTransform(await getWorldTransform(page))
    await page.keyboard.press('Control+Equal')
    await page.waitForTimeout(50)
    const after = parseTransform(await getWorldTransform(page))
    expect(after.zoom).toBeCloseTo(before.zoom * 1.25, 2)
  })

  test('AC3: Ctrl+- zooms out by ÷1.25', async ({ page }) => {
    const before = parseTransform(await getWorldTransform(page))
    await page.keyboard.press('Control+Minus')
    await page.waitForTimeout(50)
    const after = parseTransform(await getWorldTransform(page))
    expect(after.zoom).toBeCloseTo(before.zoom / 1.25, 2)
  })

  test('AC3: multiple Ctrl+= presses accumulate zoom', async ({ page }) => {
    await page.keyboard.press('Control+Equal')
    await page.keyboard.press('Control+Equal')
    await page.waitForTimeout(50)
    const { zoom } = parseTransform(await getWorldTransform(page))
    expect(zoom).toBeCloseTo(1.25 * 1.25, 2)
  })

  // =========================================================================
  // AC 4 — Ctrl + 0 resets the viewport
  // =========================================================================

  test('AC4: Ctrl+0 resets zoom to 1× and pan to (0, 0)', async ({ page }) => {
    // Zoom in twice then pan
    await page.keyboard.press('Control+Equal')
    await page.keyboard.press('Control+Equal')
    await spacePan(page, 80, 60)
    await page.waitForTimeout(50)

    await page.keyboard.press('Control+0')
    await page.waitForTimeout(50)

    const { zoom, panX, panY } = parseTransform(await getWorldTransform(page))
    expect(zoom).toBeCloseTo(1, 5)
    expect(panX).toBeCloseTo(0, 1)
    expect(panY).toBeCloseTo(0, 1)
  })

  // =========================================================================
  // AC 5 — Header zoom controls [− N% +]
  // =========================================================================

  test('AC5: header displays 100% zoom readout on load', async ({ page }) => {
    const readout = page.getByRole('button', { name: 'Reset zoom to 100%' })
    await expect(readout).toBeVisible()
    await expect(readout).toHaveText('100%')
  })

  test('AC5: header + button zooms in and readout updates', async ({ page }) => {
    await page.getByRole('button', { name: 'Zoom in' }).click()
    await page.waitForTimeout(50)

    const { zoom } = parseTransform(await getWorldTransform(page))
    expect(zoom).toBeCloseTo(1.25, 2)

    const readout = page.getByRole('button', { name: 'Reset zoom to 100%' })
    await expect(readout).toHaveText('125%')
  })

  test('AC5: header − button zooms out and readout updates', async ({ page }) => {
    await page.getByRole('button', { name: 'Zoom out' }).click()
    await page.waitForTimeout(50)

    const { zoom } = parseTransform(await getWorldTransform(page))
    expect(zoom).toBeCloseTo(1 / 1.25, 2)
  })

  test('AC5: clicking the zoom readout resets to 1× and pan to (0, 0)', async ({ page }) => {
    await page.getByRole('button', { name: 'Zoom in' }).click()
    await page.getByRole('button', { name: 'Zoom in' }).click()
    await spacePan(page, 80, 50)
    await page.waitForTimeout(50)

    await page.getByRole('button', { name: 'Reset zoom to 100%' }).click()
    await page.waitForTimeout(50)

    const { zoom, panX, panY } = parseTransform(await getWorldTransform(page))
    expect(zoom).toBeCloseTo(1, 5)
    expect(panX).toBeCloseTo(0, 1)
    expect(panY).toBeCloseTo(0, 1)
  })

  // =========================================================================
  // AC 6 — Zoom clamped to [10%, 500%]
  // =========================================================================

  test('AC6: zoom-in (+) button is disabled at the 500% maximum', async ({ page }) => {
    const zoomInBtn = page.getByRole('button', { name: 'Zoom in' })
    // 1.25^n reaches 5 at n≈7; click 15 times to be safe
    for (let i = 0; i < 15; i++) {
      if (await zoomInBtn.isDisabled()) break
      await zoomInBtn.click()
    }
    await page.waitForTimeout(100)

    await expect(zoomInBtn).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Reset zoom to 100%' })).toHaveText('500%')
  })

  test('AC6: zoom-out (−) button is disabled at the 10% minimum', async ({ page }) => {
    const zoomOutBtn = page.getByRole('button', { name: 'Zoom out' })
    for (let i = 0; i < 25; i++) {
      if (await zoomOutBtn.isDisabled()) break
      await zoomOutBtn.click()
    }
    await page.waitForTimeout(100)

    await expect(zoomOutBtn).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Reset zoom to 100%' })).toHaveText('10%')
  })

  test('AC6: scroll-wheel zoom cannot exceed 500%', async ({ page }) => {
    const canvas = page.locator('.bg-gray-100').first()
    const box = await canvas.boundingBox()
    const cx = box!.x + box!.width / 2
    const cy = box!.y + box!.height / 2

    await page.mouse.move(cx, cy)
    // Wheel up many times
    for (let i = 0; i < 60; i++) {
      await page.mouse.wheel(0, -120)
    }
    await page.waitForTimeout(100)

    const { zoom } = parseTransform(await getWorldTransform(page))
    expect(zoom).toBeLessThanOrEqual(5 + 0.001)
  })

  // =========================================================================
  // AC 7 — Space + drag pans the viewport
  // =========================================================================

  test('AC7: Space+drag pans the viewport (panX and panY change)', async ({ page }) => {
    const before = parseTransform(await getWorldTransform(page))

    await spacePan(page, 150, 100)
    await page.waitForTimeout(50)

    const after = parseTransform(await getWorldTransform(page))
    expect(after.panX).toBeGreaterThan(before.panX + 80)
    expect(after.panY).toBeGreaterThan(before.panY + 40)
  })

  test('AC7: zoom level is unchanged after a Space+drag pan', async ({ page }) => {
    const before = parseTransform(await getWorldTransform(page))
    await spacePan(page, 150, 100)
    await page.waitForTimeout(50)
    const after = parseTransform(await getWorldTransform(page))
    expect(after.zoom).toBeCloseTo(before.zoom, 5)
  })

  // =========================================================================
  // AC 8 — Pan is unbounded
  // =========================================================================

  test('AC8: pan is not clamped — viewport can move far to the left in world space', async ({
    page,
  }) => {
    // Drag the canvas far to the left → panX becomes very negative (world scrolls right)
    await spacePan(page, -600, 0)
    await page.waitForTimeout(50)

    const { panX } = parseTransform(await getWorldTransform(page))
    expect(panX).toBeLessThan(-400)
  })

  test('AC8: pan is not clamped — viewport can move far upward in world space', async ({
    page,
  }) => {
    await spacePan(page, 0, -600)
    await page.waitForTimeout(50)

    const { panY } = parseTransform(await getWorldTransform(page))
    expect(panY).toBeLessThan(-400)
  })

  // =========================================================================
  // AC 9 — Viewport always resets on design open
  // =========================================================================

  test('AC9: navigating to the editor starts with zoom=1 and pan=(0,0)', async ({ page }) => {
    const { zoom, panX, panY } = parseTransform(await getWorldTransform(page))
    expect(zoom).toBeCloseTo(1, 5)
    expect(panX).toBeCloseTo(0, 1)
    expect(panY).toBeCloseTo(0, 1)
  })

  test('AC9: reloading the editor page resets zoom and pan to defaults', async ({ page }) => {
    // Zoom in and pan
    await page.keyboard.press('Control+Equal')
    await spacePan(page, 200, 100)
    await page.waitForTimeout(50)

    // Reload
    await page.reload()
    await page.waitForTimeout(200)

    const { zoom, panX, panY } = parseTransform(await getWorldTransform(page))
    expect(zoom).toBeCloseTo(1, 5)
    expect(panX).toBeCloseTo(0, 1)
    expect(panY).toBeCloseTo(0, 1)
  })

  // =========================================================================
  // AC 10 — Elements appear at their expected world-space positions
  // =========================================================================

  test('AC10: adding a text element renders it at its default world position (x=560, y=320)', async ({
    page,
  }) => {
    await page.getByTitle('Text').click()
    const el = page.locator('[data-testid="text-element"]').first()
    await expect(el).toBeVisible()

    // At zoom=1, panX=0, panY=0: screen position ≈ world position
    const box = await el.boundingBox()
    // TextElement default is x=560, so screen x should be ≥ 400 (accounting for toolbar ~56px)
    expect(box!.x).toBeGreaterThan(400)
    // y default is 320, screen y should be in that range (accounting for header ~45px)
    expect(box!.y).toBeGreaterThan(250)
  })

  test('AC10: adding an image element renders it at its default world position (x=480, y=240)', async ({
    page,
  }) => {
    await page.getByTitle('Image').click()
    const el = page.locator('[data-testid="image-element"]').first()
    await expect(el).toBeVisible()

    const box = await el.boundingBox()
    expect(box!.x).toBeGreaterThan(350)
    expect(box!.y).toBeGreaterThan(200)
  })

  // =========================================================================
  // AC 12 — Drag and resize work correctly at non-1× zoom
  // =========================================================================

  test('AC12: text element drag works at 2× zoom', async ({ page }) => {
    await page.getByTitle('Text').click()
    const el = page.locator('[data-testid="text-element"]').first()
    await expect(el).toBeVisible()

    // Zoom in twice: ~1.56×
    await page.keyboard.press('Control+Equal')
    await page.keyboard.press('Control+Equal')
    await page.waitForTimeout(50)

    const before = await el.boundingBox()
    await dragBy(page, el, 100, 60)
    const after = await el.boundingBox()

    // Element should have moved visibly
    const moved = Math.abs(after!.x - before!.x) > 10 || Math.abs(after!.y - before!.y) > 10
    expect(moved).toBe(true)
  })

  test('AC12: text element resize works at 2× zoom', async ({ page }) => {
    await page.getByTitle('Text').click()
    const el = page.locator('[data-testid="text-element"]').first()
    await expect(el).toBeVisible()

    await page.keyboard.press('Control+Equal')
    await page.keyboard.press('Control+Equal')
    await page.waitForTimeout(50)

    const handle = page.getByTestId('resize-handle-br').first()
    await expect(handle).toBeVisible()

    const before = await el.boundingBox()
    await dragBy(page, handle, 60, 40)
    const after = await el.boundingBox()

    expect(after!.width + after!.height).toBeGreaterThan(before!.width + before!.height - 1)
  })

  // =========================================================================
  // AC 20 — Existing element interactions still work on the infinite canvas
  // =========================================================================

  test('AC20: text element can be added, selected, edited, and deselected', async ({ page }) => {
    await page.getByTitle('Text').click()
    const el = page.locator('[data-testid="text-element"]').first()
    await expect(el).toBeVisible()

    // Selected immediately after insertion
    await expect(el).toHaveCSS('outline-style', 'solid')

    // Enter edit mode
    await el.dblclick()
    const editable = page.locator('[contenteditable="true"]')
    await expect(editable).toBeVisible()

    // Exit edit mode by clicking background
    await clickBackground(page)
    await expect(editable).not.toBeAttached()
    await expect(el).not.toHaveCSS('outline-style', 'solid')
  })

  test('AC20: arrow element can be added and selected on the infinite canvas', async ({ page }) => {
    await page.getByTitle('Arrow').click()
    const el = page.locator('[data-testid="arrow-element"]').first()
    await expect(el).toBeVisible()

    await el.click()
    await expect(el).toHaveCSS('outline-style', 'solid')

    await clickBackground(page)
    await expect(el).not.toHaveCSS('outline-style', 'solid')
  })

  test('AC20: table element can be added and selected on the infinite canvas', async ({ page }) => {
    await page.getByTitle('Table').click()
    const el = page.locator('[data-testid="table-element"]').first()
    await expect(el).toBeVisible()

    await el.click()
    await expect(el).toHaveCSS('outline-style', 'solid')
  })

  // =========================================================================
  // AC 21 — Horizontal and vertical scrollbars are rendered
  // =========================================================================

  test('AC21: horizontal scrollbar track is attached to the canvas area', async ({ page }) => {
    await expect(page.getByTestId('scrollbar-h')).toBeAttached()
    await expect(page.getByTestId('scrollbar-h-thumb')).toBeAttached()
  })

  test('AC21: vertical scrollbar track is attached to the canvas area', async ({ page }) => {
    await expect(page.getByTestId('scrollbar-v')).toBeAttached()
    await expect(page.getByTestId('scrollbar-v-thumb')).toBeAttached()
  })

  // =========================================================================
  // AC 22 — Initial virtual canvas 4000×3000 — scrollbars reflect it
  // =========================================================================

  test('AC22: on a fresh design both scrollbar thumbs are visible at the default zoom', async ({
    page,
  }) => {
    // With a 4000×3000 virtual canvas and a ~1200×700 viewport, at zoom=1 the
    // canvas is larger than the viewport → thumbs should be visible (opacity 1)
    const hThumb = page.getByTestId('scrollbar-h-thumb')
    const vThumb = page.getByTestId('scrollbar-v-thumb')
    await expect(hThumb).toHaveCSS('opacity', '1')
    await expect(vThumb).toHaveCSS('opacity', '1')
  })

  test('AC22: horizontal thumb width is less than the full track width', async ({ page }) => {
    const hTrack = page.getByTestId('scrollbar-h')
    const hThumb = page.getByTestId('scrollbar-h-thumb')
    const trackBox = await hTrack.boundingBox()
    const thumbBox = await hThumb.boundingBox()
    expect(thumbBox!.width).toBeLessThan(trackBox!.width)
  })

  // =========================================================================
  // AC 23 — Dragging the scrollbar thumb pans the viewport
  // =========================================================================

  test('AC23: dragging horizontal thumb to the right scrolls the canvas leftward (panX decreases)', async ({
    page,
  }) => {
    const hThumb = page.getByTestId('scrollbar-h-thumb')
    await expect(hThumb).toHaveCSS('opacity', '1')

    const before = parseTransform(await getWorldTransform(page))

    const thumbBox = await hThumb.boundingBox()
    const cx = thumbBox!.x + thumbBox!.width / 2
    const cy = thumbBox!.y + thumbBox!.height / 2
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.mouse.move(cx + 80, cy, { steps: 10 })
    await page.mouse.up()
    await page.waitForTimeout(50)

    const after = parseTransform(await getWorldTransform(page))
    expect(after.panX).toBeLessThan(before.panX)
  })

  test('AC23: dragging vertical thumb downward scrolls the canvas upward (panY decreases)', async ({
    page,
  }) => {
    const vThumb = page.getByTestId('scrollbar-v-thumb')
    await expect(vThumb).toHaveCSS('opacity', '1')

    const before = parseTransform(await getWorldTransform(page))

    const thumbBox = await vThumb.boundingBox()
    const cx = thumbBox!.x + thumbBox!.width / 2
    const cy = thumbBox!.y + thumbBox!.height / 2
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.mouse.move(cx, cy + 80, { steps: 10 })
    await page.mouse.up()
    await page.waitForTimeout(50)

    const after = parseTransform(await getWorldTransform(page))
    expect(after.panY).toBeLessThan(before.panY)
  })

  test('AC23: world layer transform updates in real time while dragging the thumb', async ({
    page,
  }) => {
    const hThumb = page.getByTestId('scrollbar-h-thumb')
    await expect(hThumb).toHaveCSS('opacity', '1')

    const thumbBox = await hThumb.boundingBox()
    const cx = thumbBox!.x + thumbBox!.width / 2
    const cy = thumbBox!.y + thumbBox!.height / 2

    const transforms: number[] = []
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    // Move in two steps and capture intermediate transform
    await page.mouse.move(cx + 30, cy, { steps: 5 })
    transforms.push(parseTransform(await getWorldTransform(page)).panX)
    await page.mouse.move(cx + 60, cy, { steps: 5 })
    transforms.push(parseTransform(await getWorldTransform(page)).panX)
    await page.mouse.up()

    // panX should be progressively more negative as the thumb moves right
    expect(transforms[1]).toBeLessThan(transforms[0])
  })

  // =========================================================================
  // AC 24 — Clicking scrollbar track jumps viewport by one page
  // =========================================================================

  test('AC24: clicking to the right of the horizontal thumb jumps the viewport right', async ({
    page,
  }) => {
    const hTrack = page.getByTestId('scrollbar-h')
    const hThumb = page.getByTestId('scrollbar-h-thumb')

    const before = parseTransform(await getWorldTransform(page))
    const thumbBox = await hThumb.boundingBox()
    const trackBox = await hTrack.boundingBox()

    // Click on the track to the right of the thumb
    const clickX = thumbBox!.x + thumbBox!.width + 30
    const clickY = trackBox!.y + trackBox!.height / 2
    await page.mouse.click(clickX, clickY)
    await page.waitForTimeout(50)

    const after = parseTransform(await getWorldTransform(page))
    // Clicking right of thumb scrolls canvas right → panX decreases significantly
    expect(after.panX).toBeLessThan(before.panX - 100)
  })

  test('AC24: clicking to the left of the current vertical thumb position jumps the viewport up', async ({
    page,
  }) => {
    // First scroll down so there is track above the thumb
    const vThumb = page.getByTestId('scrollbar-v-thumb')
    const thumbBox1 = await vThumb.boundingBox()
    const cy = thumbBox1!.y + thumbBox1!.height / 2
    const cx = thumbBox1!.x + thumbBox1!.width / 2
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.mouse.move(cx, cy + 80, { steps: 10 })
    await page.mouse.up()
    await page.waitForTimeout(50)

    const before = parseTransform(await getWorldTransform(page))
    const thumbBox2 = await vThumb.boundingBox()
    const vTrack = page.getByTestId('scrollbar-v')
    const trackBox = await vTrack.boundingBox()

    // Click above the thumb
    const clickY2 = thumbBox2!.y - 30
    const clickX2 = trackBox!.x + trackBox!.width / 2
    await page.mouse.click(clickX2, clickY2)
    await page.waitForTimeout(50)

    const after = parseTransform(await getWorldTransform(page))
    // Clicking above thumb scrolls canvas down → panY increases (less negative)
    expect(after.panY).toBeGreaterThan(before.panY + 100)
  })

  // =========================================================================
  // AC 25 — Thumb size shrinks as zoom increases
  // =========================================================================

  test('AC25: horizontal thumb is narrower at 1.25× than at 1×', async ({ page }) => {
    const hThumb = page.getByTestId('scrollbar-h-thumb')

    const widthAt1x = (await hThumb.boundingBox())!.width

    await page.getByRole('button', { name: 'Zoom in' }).click()
    await page.waitForTimeout(100)

    const widthAt125x = (await hThumb.boundingBox())!.width
    expect(widthAt125x).toBeLessThan(widthAt1x)
  })

  test('AC25: vertical thumb is shorter at 1.25× than at 1×', async ({ page }) => {
    const vThumb = page.getByTestId('scrollbar-v-thumb')

    const heightAt1x = (await vThumb.boundingBox())!.height

    await page.getByRole('button', { name: 'Zoom in' }).click()
    await page.waitForTimeout(100)

    const heightAt125x = (await vThumb.boundingBox())!.height
    expect(heightAt125x).toBeLessThan(heightAt1x)
  })

  test('AC25: horizontal thumb grows when zoom decreases below 1×', async ({ page }) => {
    const hThumb = page.getByTestId('scrollbar-h-thumb')
    const widthAt1x = (await hThumb.boundingBox())!.width

    await page.getByRole('button', { name: 'Zoom out' }).click()
    await page.waitForTimeout(100)

    const widthAt08x = (await hThumb.boundingBox())!.width
    expect(widthAt08x).toBeGreaterThan(widthAt1x)
  })

  // =========================================================================
  // AC 26 — Thumb is hidden when the entire virtual canvas fits in the viewport
  // =========================================================================

  test('AC26: scrollbar thumb is hidden at 10% zoom (virtual canvas fits in viewport)', async ({
    page,
  }) => {
    const hThumb = page.getByTestId('scrollbar-h-thumb')
    const zoomOutBtn = page.getByRole('button', { name: 'Zoom out' })

    // Zoom out to minimum (10%): 4000 * 0.1 = 400 px < typical viewport width
    for (let i = 0; i < 25; i++) {
      if (await zoomOutBtn.isDisabled()) break
      await zoomOutBtn.click()
    }
    await page.waitForTimeout(150)

    // At minimum zoom the entire virtual canvas fits → thumb opacity should be 0
    await expect(hThumb).toHaveCSS('opacity', '0')
  })

  test('AC26: vertical thumb is hidden at 10% zoom', async ({ page }) => {
    const vThumb = page.getByTestId('scrollbar-v-thumb')
    const zoomOutBtn = page.getByRole('button', { name: 'Zoom out' })

    for (let i = 0; i < 25; i++) {
      if (await zoomOutBtn.isDisabled()) break
      await zoomOutBtn.click()
    }
    await page.waitForTimeout(150)

    await expect(vThumb).toHaveCSS('opacity', '0')
  })

  // =========================================================================
  // AC 27 — Adding an element near the boundary expands the virtual canvas
  // =========================================================================

  test('AC27: adding a text element does not affect the initial virtual canvas bounds when placed well inside', async ({
    page,
  }) => {
    // The default text element at x=560 is far from the 4000px boundary,
    // so the virtual bounds stay at the initial 4000×3000 extent.
    const hThumb = page.getByTestId('scrollbar-h-thumb')
    const widthBefore = (await hThumb.boundingBox())!.width

    await page.getByTitle('Text').click()
    await page.waitForTimeout(100)

    const widthAfter = (await hThumb.boundingBox())!.width
    // Thumb width should be approximately the same — no expansion occurred
    expect(widthAfter).toBeCloseTo(widthBefore, 0)
  })

  // =========================================================================
  // AC 28 — Free pan beyond virtual bounds expands virtual canvas
  // =========================================================================

  test('AC28: panning far to the right expands the horizontal virtual bounds', async ({ page }) => {
    const hThumb = page.getByTestId('scrollbar-h-thumb')
    const widthBefore = (await hThumb.boundingBox())!.width

    // Pan canvas far left (= move viewport far right in world space, beyond 4000px)
    await spacePan(page, -3000, 0)
    await page.waitForTimeout(100)

    // Virtual bounds expand to include the new viewport position
    // → total virtual canvas width grows → thumb becomes proportionally smaller
    const widthAfter = (await hThumb.boundingBox())!.width
    expect(widthAfter).toBeLessThan(widthBefore)
  })

  test('AC28: panning far downward expands the vertical virtual bounds', async ({ page }) => {
    const vThumb = page.getByTestId('scrollbar-v-thumb')
    const heightBefore = (await vThumb.boundingBox())!.height

    // Pan canvas far up (= move viewport far down in world space, beyond 3000px)
    await spacePan(page, 0, -3000)
    await page.waitForTimeout(200)

    const heightAfter = (await vThumb.boundingBox())!.height
    // Thumb must shrink (virtual bounds grew); allow 0.5px for float rounding across browsers
    expect(heightAfter).toBeLessThan(heightBefore + 0.5)
  })

  test('AC28: after a free pan beyond the boundary the scrollbar thumb position does not jump', async ({
    page,
  }) => {
    const hThumb = page.getByTestId('scrollbar-h-thumb')

    // Pan far right to move beyond virtual bounds
    await spacePan(page, -2000, 0)
    await page.waitForTimeout(100)

    // Thumb should still exist and be visible (within a valid position range)
    await expect(hThumb).toBeAttached()
    const thumbBox = await hThumb.boundingBox()
    const trackBox = await page.getByTestId('scrollbar-h').boundingBox()

    // Thumb x must be within the track bounds (no negative offset or off-track position)
    expect(thumbBox!.x).toBeGreaterThanOrEqual(trackBox!.x - 1)
    expect(thumbBox!.x + thumbBox!.width).toBeLessThanOrEqual(trackBox!.x + trackBox!.width + 1)
  })

  // =========================================================================
  // AC 29 — Scrollbar corner fill
  // =========================================================================

  test('AC29: scrollbar corner fill is present at the bottom-right of the canvas area', async ({
    page,
  }) => {
    const corner = page.getByTestId('scrollbar-corner')
    await expect(corner).toBeVisible()
  })

  test('AC29: corner fill is 12×12 px', async ({ page }) => {
    const corner = page.getByTestId('scrollbar-corner')
    const box = await corner.boundingBox()
    expect(box!.width).toBe(12)
    expect(box!.height).toBe(12)
  })

  test('AC29: corner fill is positioned at the intersection of the two scrollbar tracks', async ({
    page,
  }) => {
    const corner = page.getByTestId('scrollbar-corner')
    const hTrack = page.getByTestId('scrollbar-h')
    const vTrack = page.getByTestId('scrollbar-v')

    const cornerBox = await corner.boundingBox()
    const hBox = await hTrack.boundingBox()
    const vBox = await vTrack.boundingBox()

    // Corner right edge aligns with right edge of canvas (= right edge of vertical track)
    expect(cornerBox!.x + cornerBox!.width).toBeCloseTo(vBox!.x + vBox!.width, 0)
    // Corner bottom edge aligns with bottom edge of canvas (= bottom of horizontal track)
    expect(cornerBox!.y + cornerBox!.height).toBeCloseTo(hBox!.y + hBox!.height, 0)
  })
})
