import type { Page } from '@playwright/test'

/**
 * Intercepts all /api/projects routes so e2e tests run without a live backend.
 * Call this in beforeEach for any test that navigates to the app.
 */
export async function mockApiRoutes(page: Page) {
  // GET /api/projects — list
  await page.route(/\/api\/projects$/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: [] }),
      })
      return
    }
    if (route.request().method() === 'POST') {
      const body = (await route.request().postDataJSON()) as { id: string; name: string }
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            id: body.id,
            name: body.name,
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

  // POST /api/projects/:id/thumbnail — thumbnail upload (silent success)
  // GET  /api/projects/:id/thumbnail — thumbnail not found by default
  await page.route(/\/api\/projects\/[^/]+\/thumbnail$/, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 204 })
      return
    }
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: { code: 'NOT_FOUND', message: 'No thumbnail' } }),
      })
      return
    }
    await route.continue()
  })

  // GET /api/projects/:id — single project
  // PATCH /api/projects/:id — auto-save
  await page.route(/\/api\/projects\/[^/]+$/, async (route) => {
    const id = new URL(route.request().url()).pathname.split('/').pop()!
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
    if (route.request().method() === 'PATCH') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: { id, updatedAt: new Date().toISOString() } }),
      })
      return
    }
    await route.continue()
  })
}
