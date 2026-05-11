import { expect, Page, test } from '@playwright/test'
import { mockApiRoutes } from './mock-api'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function openModal(page: Page) {
  await page.getByRole('button', { name: /new design/i }).click()
  return {
    dialog: page.getByRole('dialog'),
    input: page.getByLabel(/design name/i),
    cancelBtn: page.getByRole('button', { name: /cancel/i }),
    createBtn: page.getByRole('button', { name: /^create$/i }),
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('05 – New design creation', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
    await page.goto('/')
  })

  // AC 1 — home page displays the tagline and "New design" button
  test('AC1: home page shows the tagline and New design button', async ({ page }) => {
    await expect(page.getByText(/start creating something great/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /new design/i })).toBeVisible()
  })

  // AC 2 — clicking "New design" opens the modal pre-filled with "Untitled design"
  test('AC2: clicking New design opens the modal with pre-filled name', async ({ page }) => {
    const { dialog, input } = await openModal(page)

    await expect(dialog).toBeVisible()
    await expect(input).toBeVisible()
    await expect(input).toHaveValue('Untitled design')
  })

  test('AC2: the name input is focused when the modal opens', async ({ page }) => {
    const { input } = await openModal(page)
    await expect(input).toBeFocused()
  })

  test('AC2: the pre-filled text is selected so the user can type immediately', async ({
    page,
  }) => {
    const { input } = await openModal(page)

    // Typing without clearing first should replace the selection
    await page.keyboard.type('New name')
    await expect(input).toHaveValue('New name')
  })

  // AC 3 — "Create" is disabled when input is empty or whitespace-only
  test('AC3: Create is disabled when the input is cleared', async ({ page }) => {
    const { input, createBtn } = await openModal(page)
    await input.clear()
    await expect(createBtn).toBeDisabled()
  })

  test('AC3: Create is disabled when the input contains only whitespace', async ({ page }) => {
    const { input, createBtn } = await openModal(page)
    await input.fill('   ')
    await expect(createBtn).toBeDisabled()
  })

  // AC 4 — "Create" is enabled when input has at least one non-whitespace character
  test('AC4: Create is enabled with the default pre-filled value', async ({ page }) => {
    const { createBtn } = await openModal(page)
    await expect(createBtn).toBeEnabled()
  })

  test('AC4: Create becomes enabled after typing a valid name', async ({ page }) => {
    const { input, createBtn } = await openModal(page)
    await input.fill('')
    await expect(createBtn).toBeDisabled()
    await input.fill('My Design')
    await expect(createBtn).toBeEnabled()
  })

  // AC 5 — clicking "Create" navigates to /editor/:designId
  test('AC5: clicking Create navigates to the editor with a valid designId', async ({ page }) => {
    const { createBtn } = await openModal(page)
    await createBtn.click()

    await expect(page).toHaveURL(/\/editor\/[a-z0-9-]+/)
  })

  test('AC5: the editor shows the design name supplied during creation', async ({ page }) => {
    const { input, createBtn } = await openModal(page)
    await input.fill('My Poster')
    await createBtn.click()

    await expect(page.getByText('My Poster')).toBeVisible()
  })

  test('AC5: the editor toolbar is visible after creation', async ({ page }) => {
    const { createBtn } = await openModal(page)
    await createBtn.click()

    await expect(page.getByTitle('Text')).toBeVisible()
  })

  // AC 6 — clicking "Cancel" closes the modal without creating a design
  test('AC6: clicking Cancel closes the modal', async ({ page }) => {
    const { dialog, cancelBtn } = await openModal(page)
    await cancelBtn.click()
    await expect(dialog).not.toBeVisible()
  })

  test('AC6: clicking Cancel does not navigate away from the home page', async ({ page }) => {
    const { cancelBtn } = await openModal(page)
    await cancelBtn.click()
    await expect(page).toHaveURL('/')
  })

  // AC 7 — pressing Escape closes the modal without creating a design
  test('AC7: pressing Escape closes the modal', async ({ page }) => {
    const { dialog } = await openModal(page)
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
  })

  test('AC7: pressing Escape does not navigate away from the home page', async ({ page }) => {
    await openModal(page)
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL('/')
  })

  // AC 8 — clicking the backdrop closes the modal without creating a design
  test('AC8: clicking the backdrop closes the modal', async ({ page }) => {
    const { dialog } = await openModal(page)

    // Click the backdrop by targeting a corner of the fixed overlay
    await page.mouse.click(10, 10)

    await expect(dialog).not.toBeVisible()
  })

  test('AC8: clicking the backdrop does not navigate away from the home page', async ({ page }) => {
    await openModal(page)
    await page.mouse.click(10, 10)
    await expect(page).toHaveURL('/')
  })

  // AC 9 — pressing Enter creates the design (same as clicking "Create")
  test('AC9: pressing Enter with a valid name navigates to the editor', async ({ page }) => {
    const { input } = await openModal(page)
    await input.fill('Enter Created Design')
    await page.keyboard.press('Enter')

    await expect(page).toHaveURL(/\/editor\/[a-z0-9-]+/)
  })

  test('AC9: pressing Enter does not create when input is empty', async ({ page }) => {
    const { input, dialog } = await openModal(page)
    await input.fill('')
    await page.keyboard.press('Enter')

    // Modal stays open, no navigation
    await expect(dialog).toBeVisible()
    await expect(page).toHaveURL('/')
  })

  // AC 10 — no stale modal state when navigating back to /
  test('AC10: returning to the home page after entering the editor shows no open modal', async ({
    page,
  }) => {
    const { createBtn } = await openModal(page)
    await createBtn.click()
    await expect(page).toHaveURL(/\/editor\//)

    await page.goto('/')

    await expect(page.getByRole('dialog')).not.toBeVisible()
    await expect(page.getByRole('button', { name: /new design/i })).toBeVisible()
  })

  // AC 11 — Close button is always visible in the editor header
  test('AC11: the editor header contains a visible Close button', async ({ page }) => {
    const { createBtn } = await openModal(page)
    await createBtn.click()
    await expect(page).toHaveURL(/\/editor\//)

    await expect(page.getByRole('button', { name: /close design/i })).toBeVisible()
  })

  // AC 12 — clicking Close navigates to / without confirmation
  test('AC12: clicking Close navigates to the home page', async ({ page }) => {
    const { createBtn } = await openModal(page)
    await createBtn.click()
    await expect(page).toHaveURL(/\/editor\//)

    await page.getByRole('button', { name: /close design/i }).click()

    await expect(page).toHaveURL('/')
  })

  test('AC12: clicking Close shows the home page immediately with no confirmation', async ({
    page,
  }) => {
    const { createBtn } = await openModal(page)
    await createBtn.click()

    await page.getByRole('button', { name: /close design/i }).click()

    await expect(page.getByRole('button', { name: /new design/i })).toBeVisible()
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })
})
