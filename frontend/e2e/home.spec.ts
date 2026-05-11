import { test, expect } from '@playwright/test'
import { mockApiRoutes } from './mock-api'

test.beforeEach(async ({ page }) => {
  await mockApiRoutes(page)
})

test('home page loads and shows heading', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /design studio/i })).toBeVisible()
})

test('navigates to editor page', async ({ page }) => {
  await page.goto('/editor/test-design-123')
  await expect(page.getByTitle('Text')).toBeVisible()
})
