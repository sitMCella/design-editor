import { test, expect, type Page } from '@playwright/test'
import { mockApiRoutes } from './mock-api'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DESIGN_ID = 'reload-test-proj'
const DESIGN_NAME = 'Reload Test Design'

const PROJECT_WITH_ELEMENTS = {
  id: DESIGN_ID,
  name: DESIGN_NAME,
  canvas: {
    elements: [
      {
        id: 't1',
        type: 'text',
        x: 100,
        y: 200,
        width: 160,
        height: 40,
        rotation: 0,
        opacity: 1,
        locked: false,
        content: 'Hello reload',
        fontSize: 16,
        fontFamily: 'Inter, sans-serif',
        fontWeight: 'normal',
        fontStyle: 'normal',
        color: '#111827',
        align: 'left',
      },
    ],
  },
  createdAt: '2026-05-10T10:00:00Z',
  updatedAt: '2026-05-10T10:05:00Z',
}

// Override the GET /api/projects/:id route to return a specific project.
// In Playwright, routes are matched LIFO so this takes precedence over the
// default handler registered by mockApiRoutes.
async function mockProjectGet(page: Page, project: typeof PROJECT_WITH_ELEMENTS) {
  await page.route(
    new RegExp(`/api/projects/${project.id}$`),
    async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, data: project }),
        })
        return
      }
      await route.continue()
    },
  )
}

// Override GET /api/projects/:id to fail with 404.
async function mockProjectGetFail(page: Page, projectId: string) {
  await page.route(new RegExp(`/api/projects/${projectId}$`), async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: { code: 'NOT_FOUND', message: 'Not found' } }),
      })
      return
    }
    await route.continue()
  })
}

// Override GET /api/projects/:id to delay so we can observe the loading state.
async function mockProjectGetDelayed(page: Page, projectId: string) {
  await page.route(new RegExp(`/api/projects/${projectId}$`), async (route) => {
    if (route.request().method() === 'GET') {
      // Delay long enough to assert the spinner, then resolve successfully
      await new Promise((resolve) => setTimeout(resolve, 2000))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: { ...PROJECT_WITH_ELEMENTS, id: projectId } }),
      })
      return
    }
    await route.continue()
  })
}

// Navigate to the editor from the home page (so the canvas store is pre-loaded)
// then return the URL so we can reload it.
async function createDesignAndNavigateToEditor(page: Page): Promise<string> {
  await page.goto('/')
  await page.getByRole('button', { name: /new design/i }).click()
  const input = page.getByLabel(/design name/i)
  await input.fill('Temp Design')
  await page.getByRole('button', { name: /^create$/i }).click()
  await expect(page).toHaveURL(/\/editor\/[^/]+/)
  return page.url()
}

// ---------------------------------------------------------------------------
// AC17 — full browser reload restores the project from the backend
// ---------------------------------------------------------------------------

test.describe('AC17 – full browser reload restores the canvas', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
  })

  test('AC17: reload shows a full-page loading spinner while fetching', async ({ page }) => {
    await mockProjectGetDelayed(page, DESIGN_ID)

    // Navigate directly so the in-memory store is blank (simulates a reload)
    await page.goto(`/editor/${DESIGN_ID}`)

    // The spinner should be immediately visible before the delayed fetch resolves
    await expect(page.getByRole('status', { name: /loading design/i })).toBeVisible()
  })

  test('AC17: reload does not show the editor shell while loading', async ({ page }) => {
    await mockProjectGetDelayed(page, DESIGN_ID)

    await page.goto(`/editor/${DESIGN_ID}`)

    // Close button is part of the editor shell — it must not appear during loading
    await expect(page.getByRole('button', { name: /close design/i })).not.toBeVisible()
  })

  test('AC17: spinner disappears once the project is fetched successfully', async ({ page }) => {
    await mockProjectGet(page, PROJECT_WITH_ELEMENTS)

    await page.goto(`/editor/${DESIGN_ID}`)

    // Wait until the editor shell is visible (fetch resolved)
    await expect(page.getByRole('button', { name: /close design/i })).toBeVisible()
    // Spinner must be gone
    await expect(page.getByRole('status', { name: /loading design/i })).not.toBeVisible()
  })

  test('AC17: the design name is shown in the header after reload', async ({ page }) => {
    await mockProjectGet(page, PROJECT_WITH_ELEMENTS)

    await page.goto(`/editor/${DESIGN_ID}`)

    await expect(page.getByRole('button', { name: /close design/i })).toBeVisible()
    await expect(page.getByText(DESIGN_NAME)).toBeVisible()
  })

  test('AC17: text element content is visible on the canvas after reload', async ({ page }) => {
    await mockProjectGet(page, PROJECT_WITH_ELEMENTS)

    await page.goto(`/editor/${DESIGN_ID}`)

    await expect(page.getByRole('button', { name: /close design/i })).toBeVisible()
    await expect(page.getByText('Hello reload')).toBeVisible()
  })

  test('AC17: no "Unsaved changes" indicator after reload (isDirty stays false)', async ({
    page,
  }) => {
    await mockProjectGet(page, PROJECT_WITH_ELEMENTS)

    await page.goto(`/editor/${DESIGN_ID}`)

    await expect(page.getByRole('button', { name: /close design/i })).toBeVisible()
    await expect(page.getByText(/unsaved changes/i)).not.toBeVisible()
  })

  test('AC17: page.reload() re-fetches the project and restores the canvas', async ({ page }) => {
    // First, create a design via the home page flow so the store is hydrated
    await createDesignAndNavigateToEditor(page)
    const editorUrl = page.url()

    // Extract the designId from the URL and wire up a mock for that specific project
    const designId = editorUrl.split('/editor/')[1]
    await page.route(new RegExp(`/api/projects/${designId}$`), async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id: designId,
              name: 'After Reload Design',
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

    // Perform a true browser reload — the in-memory store is wiped
    await page.reload()

    // The editor must re-appear with the fetched project name
    await expect(page.getByRole('button', { name: /close design/i })).toBeVisible()
    await expect(page.getByText('After Reload Design')).toBeVisible()
  })

  test('AC17: editor URL after reload is identical to the pre-reload URL', async ({ page }) => {
    await createDesignAndNavigateToEditor(page)
    const urlBeforeReload = page.url()

    const designId = urlBeforeReload.split('/editor/')[1]
    await page.route(new RegExp(`/api/projects/${designId}$`), async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id: designId,
              name: 'Stable Design',
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

    await page.reload()

    await expect(page).toHaveURL(urlBeforeReload)
  })
})

// ---------------------------------------------------------------------------
// AC18 — failed project fetch shows error state, not a broken canvas
// ---------------------------------------------------------------------------

test.describe('AC18 – failed fetch shows error state', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
  })

  test('AC18: error message is shown when GET /api/projects/:id returns 404', async ({ page }) => {
    await mockProjectGetFail(page, DESIGN_ID)

    await page.goto(`/editor/${DESIGN_ID}`)

    await expect(page.getByText(/could not load the design/i)).toBeVisible()
  })

  test('AC18: a "Go home" button is visible in the error state', async ({ page }) => {
    await mockProjectGetFail(page, DESIGN_ID)

    await page.goto(`/editor/${DESIGN_ID}`)

    await expect(page.getByRole('button', { name: /go home/i })).toBeVisible()
  })

  test('AC18: the editor shell is not rendered in the error state', async ({ page }) => {
    await mockProjectGetFail(page, DESIGN_ID)

    await page.goto(`/editor/${DESIGN_ID}`)

    await expect(page.getByText(/could not load the design/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /close design/i })).not.toBeVisible()
  })

  test('AC18: the loading spinner is gone once the error state is shown', async ({ page }) => {
    await mockProjectGetFail(page, DESIGN_ID)

    await page.goto(`/editor/${DESIGN_ID}`)

    await expect(page.getByRole('button', { name: /go home/i })).toBeVisible()
    await expect(page.getByRole('status', { name: /loading design/i })).not.toBeVisible()
  })

  test('AC18: clicking "Go home" from the error state navigates to /', async ({ page }) => {
    await mockProjectGetFail(page, DESIGN_ID)

    await page.goto(`/editor/${DESIGN_ID}`)

    await page.getByRole('button', { name: /go home/i }).click()
    await expect(page).toHaveURL('/')
  })

  test('AC18: the canvas toolbar is not rendered in the error state', async ({ page }) => {
    await mockProjectGetFail(page, DESIGN_ID)

    await page.goto(`/editor/${DESIGN_ID}`)

    await expect(page.getByText(/could not load the design/i)).toBeVisible()
    await expect(page.getByTitle('Text')).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC19 — direct address-bar navigation behaves identically to a reload
// ---------------------------------------------------------------------------

test.describe('AC19 – direct URL navigation restores the project', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
  })

  test('AC19: navigating directly to /editor/:designId fetches the project', async ({ page }) => {
    await mockProjectGet(page, PROJECT_WITH_ELEMENTS)

    // Navigate without going through the home page (simulates typing the URL)
    await page.goto(`/editor/${DESIGN_ID}`)

    // The editor should appear with the fetched project name
    await expect(page.getByRole('button', { name: /close design/i })).toBeVisible()
    await expect(page.getByText(DESIGN_NAME)).toBeVisible()
  })

  test('AC19: direct navigation shows the loading spinner while fetching', async ({ page }) => {
    await mockProjectGetDelayed(page, DESIGN_ID)

    await page.goto(`/editor/${DESIGN_ID}`)

    await expect(page.getByRole('status', { name: /loading design/i })).toBeVisible()
  })

  test('AC19: direct navigation renders text elements from the saved canvas', async ({ page }) => {
    await mockProjectGet(page, PROJECT_WITH_ELEMENTS)

    await page.goto(`/editor/${DESIGN_ID}`)

    await expect(page.getByRole('button', { name: /close design/i })).toBeVisible()
    await expect(page.getByText('Hello reload')).toBeVisible()
  })

  test('AC19: direct navigation leaves isDirty false (no "Unsaved changes")', async ({ page }) => {
    await mockProjectGet(page, PROJECT_WITH_ELEMENTS)

    await page.goto(`/editor/${DESIGN_ID}`)

    await expect(page.getByRole('button', { name: /close design/i })).toBeVisible()
    await expect(page.getByText(/unsaved changes/i)).not.toBeVisible()
  })

  test('AC19: direct navigation to a non-existent project shows the error state', async ({
    page,
  }) => {
    await mockProjectGetFail(page, DESIGN_ID)

    await page.goto(`/editor/${DESIGN_ID}`)

    await expect(page.getByText(/could not load the design/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /go home/i })).toBeVisible()
  })

  test('AC19: editor is fully operational after direct URL navigation', async ({ page }) => {
    await mockProjectGet(page, PROJECT_WITH_ELEMENTS)

    await page.goto(`/editor/${DESIGN_ID}`)

    await expect(page.getByRole('button', { name: /close design/i })).toBeVisible()
    // Toolbar should be present and interactive
    await expect(page.getByTitle('Text')).toBeVisible()
  })
})
