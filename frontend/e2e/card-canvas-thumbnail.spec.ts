import { expect, Page, test } from '@playwright/test'
import { mockApiRoutes } from './mock-api'

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

// Minimal 1×1 transparent GIF — stand-in for stored thumbnail images
const TINY_GIF_B64 = 'R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='

const THUMBNAIL_ROUTE = /\/api\/projects\/[^/]+\/thumbnail$/

type ProjectCard = {
  id: string
  name: string
  elementCount: number
  thumbnailUrl: string | null
  createdAt: string
  updatedAt: string
}

async function mockProjectsList(page: Page, projects: ProjectCard[]) {
  await page.route(/\/api\/projects$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue()
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: projects }),
    })
  })
}

async function mockThumbnailServe(page: Page) {
  await page.route(THUMBNAIL_ROUTE, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'image/gif',
        body: Buffer.from(TINY_GIF_B64, 'base64'),
      })
      return
    }
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 204 })
      return
    }
    await route.continue()
  })
}

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

test.describe('12 – Project Card Canvas Thumbnail', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
  })

  // -------------------------------------------------------------------------
  // AC 1 — thumbnail upload is requested after auto-save completes
  // -------------------------------------------------------------------------

  test('AC1: thumbnail POST is made after a successful auto-save', async ({ page }) => {
    const thumbnailRequest = page.waitForRequest(
      (req) => THUMBNAIL_ROUTE.test(req.url()) && req.method() === 'POST',
      { timeout: 10_000 }
    )

    await createDesignAndOpenEditor(page)
    await page.getByTitle('Text').click()

    const req = await thumbnailRequest
    expect(req.method()).toBe('POST')
    expect(req.url()).toMatch(THUMBNAIL_ROUTE)
  })

  test('AC1: thumbnail upload is sent as a multipart/form-data request', async ({ page }) => {
    const thumbnailRequest = page.waitForRequest(
      (req) => THUMBNAIL_ROUTE.test(req.url()) && req.method() === 'POST',
      { timeout: 10_000 }
    )

    await createDesignAndOpenEditor(page)
    await page.getByTitle('Text').click()

    const req = await thumbnailRequest
    expect(req.headers()['content-type']).toContain('multipart/form-data')
  })

  test('AC1: thumbnail upload URL includes the correct design id', async ({ page }) => {
    const thumbnailRequest = page.waitForRequest(
      (req) => THUMBNAIL_ROUTE.test(req.url()) && req.method() === 'POST',
      { timeout: 10_000 }
    )

    await page.goto('/')
    await page.getByRole('button', { name: /new design/i }).click()
    await page.getByLabel(/design name/i).fill('My Poster')
    await page.getByRole('button', { name: /^create$/i }).click()

    // Capture the designId from the URL after navigation
    await page.waitForURL(/\/editor\//)
    const designId = new URL(page.url()).pathname.split('/').pop()!

    await page.getByTitle('Text').click()

    const req = await thumbnailRequest
    expect(req.url()).toContain(`/api/projects/${designId}/thumbnail`)
  })

  // -------------------------------------------------------------------------
  // AC 2 — card shows thumbnail image when thumbnailUrl is present
  // -------------------------------------------------------------------------

  test('AC2: project card renders an img element when thumbnailUrl is present', async ({
    page,
  }) => {
    await mockThumbnailServe(page)
    await mockProjectsList(page, [
      {
        id: 'proj-1',
        name: 'Design With Thumb',
        elementCount: 2,
        thumbnailUrl: '/api/projects/proj-1/thumbnail',
        createdAt: '2026-05-10T10:00:00Z',
        updatedAt: '2026-05-10T10:07:00Z',
      },
    ])

    await page.goto('/')

    const card = page.locator('button').filter({ hasText: 'Design With Thumb' })
    await expect(card.locator('img')).toBeVisible()
  })

  test('AC2: the thumbnail img src matches the thumbnailUrl from the project list', async ({
    page,
  }) => {
    await mockThumbnailServe(page)
    await mockProjectsList(page, [
      {
        id: 'proj-1',
        name: 'Design With Thumb',
        elementCount: 2,
        thumbnailUrl: '/api/projects/proj-1/thumbnail',
        createdAt: '2026-05-10T10:00:00Z',
        updatedAt: '2026-05-10T10:07:00Z',
      },
    ])

    await page.goto('/')

    const card = page.locator('button').filter({ hasText: 'Design With Thumb' })
    await expect(card.locator('img')).toHaveAttribute('src', '/api/projects/proj-1/thumbnail')
  })

  // -------------------------------------------------------------------------
  // AC 5 — card shows the grey placeholder when thumbnailUrl is null
  // -------------------------------------------------------------------------

  test('AC5: project card shows no img element when thumbnailUrl is null', async ({ page }) => {
    await mockProjectsList(page, [
      {
        id: 'proj-2',
        name: 'Design No Thumb',
        elementCount: 0,
        thumbnailUrl: null,
        createdAt: '2026-05-10T09:00:00Z',
        updatedAt: '2026-05-10T09:00:00Z',
      },
    ])

    await page.goto('/')

    const card = page.locator('button').filter({ hasText: 'Design No Thumb' })
    await expect(card).toBeVisible()
    await expect(card.locator('img')).not.toBeAttached()
  })

  test('AC5: the grey placeholder container is always rendered on the card', async ({ page }) => {
    await mockProjectsList(page, [
      {
        id: 'proj-2',
        name: 'Design No Thumb',
        elementCount: 0,
        thumbnailUrl: null,
        createdAt: '2026-05-10T09:00:00Z',
        updatedAt: '2026-05-10T09:00:00Z',
      },
    ])

    await page.goto('/')

    const card = page.locator('button').filter({ hasText: 'Design No Thumb' })
    await expect(card.locator('.bg-gray-100')).toBeVisible()
  })

  // -------------------------------------------------------------------------
  // AC 6 — thumbnail upload failure does not break the editor
  // -------------------------------------------------------------------------

  test('AC6: thumbnail upload failure does not show an error notification', async ({ page }) => {
    await page.route(THUMBNAIL_ROUTE, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 500 })
        return
      }
      await route.continue()
    })

    const thumbnailResponse = page.waitForResponse(
      (res) => THUMBNAIL_ROUTE.test(res.url()) && res.request().method() === 'POST',
      { timeout: 10_000 }
    )

    await createDesignAndOpenEditor(page)
    await page.getByTitle('Text').click()
    await thumbnailResponse

    await expect(page.locator('[role="alert"]')).not.toBeAttached()
  })

  test('AC6: editor toolbar remains functional after a thumbnail upload failure', async ({
    page,
  }) => {
    await page.route(THUMBNAIL_ROUTE, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 500 })
        return
      }
      await route.continue()
    })

    const thumbnailResponse = page.waitForResponse(
      (res) => THUMBNAIL_ROUTE.test(res.url()) && res.request().method() === 'POST',
      { timeout: 10_000 }
    )

    await createDesignAndOpenEditor(page)
    await page.getByTitle('Text').click()
    await thumbnailResponse

    await expect(page.getByTitle('Text')).toBeVisible()
    await page.getByTitle('Text').click()
    await expect(page.locator('[data-testid="text-element"]')).toHaveCount(2)
  })

  // -------------------------------------------------------------------------
  // AC 12 — thumbnail image fills the card with object-cover
  // -------------------------------------------------------------------------

  test('AC12: thumbnail img has the object-cover class', async ({ page }) => {
    await mockThumbnailServe(page)
    await mockProjectsList(page, [
      {
        id: 'proj-1',
        name: 'Thumb Design',
        elementCount: 1,
        thumbnailUrl: '/api/projects/proj-1/thumbnail',
        createdAt: '2026-05-10T10:00:00Z',
        updatedAt: '2026-05-10T10:07:00Z',
      },
    ])

    await page.goto('/')

    const img = page.locator('button').filter({ hasText: 'Thumb Design' }).locator('img')
    await expect(img).toHaveClass(/object-cover/)
  })

  test('AC12: thumbnail container uses overflow-hidden to prevent distortion', async ({ page }) => {
    await mockThumbnailServe(page)
    await mockProjectsList(page, [
      {
        id: 'proj-1',
        name: 'Thumb Design',
        elementCount: 1,
        thumbnailUrl: '/api/projects/proj-1/thumbnail',
        createdAt: '2026-05-10T10:00:00Z',
        updatedAt: '2026-05-10T10:07:00Z',
      },
    ])

    await page.goto('/')

    const card = page.locator('button').filter({ hasText: 'Thumb Design' })
    await expect(card.locator('.overflow-hidden')).toBeVisible()
  })

  // -------------------------------------------------------------------------
  // AC 13 — loading spinner is visible alongside the thumbnail while loading
  // -------------------------------------------------------------------------

  test('AC13: spinner overlay shows alongside the thumbnail while a project is loading', async ({
    page,
  }) => {
    await mockThumbnailServe(page)
    await mockProjectsList(page, [
      {
        id: 'proj-slow',
        name: 'Slow Design',
        elementCount: 3,
        thumbnailUrl: '/api/projects/proj-slow/thumbnail',
        createdAt: '2026-05-10T10:00:00Z',
        updatedAt: '2026-05-10T10:07:00Z',
      },
    ])

    // Make GET /api/projects/proj-slow hang so the card stays in loading state
    let resolveProjLoad!: () => void
    const projLoadBlocked = new Promise<void>((res) => {
      resolveProjLoad = res
    })
    await page.route(/\/api\/projects\/proj-slow$/, async (route) => {
      if (route.request().method() === 'GET') {
        await projLoadBlocked
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id: 'proj-slow',
              name: 'Slow Design',
              canvas: { elements: [] },
              createdAt: '2026-05-10T10:00:00Z',
              updatedAt: '2026-05-10T10:07:00Z',
            },
          }),
        })
        return
      }
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: { id: 'proj-slow', updatedAt: new Date().toISOString() },
          }),
        })
        return
      }
      await route.continue()
    })

    await page.goto('/')

    const card = page.locator('button').filter({ hasText: 'Slow Design' })
    await card.click()

    // While the project is loading: both the thumbnail and the spinner are visible
    await expect(card.locator('img')).toBeVisible()
    await expect(card.locator('.animate-spin')).toBeVisible()

    resolveProjLoad()
  })

  test('AC13: card is non-interactive while the project is loading', async ({ page }) => {
    await mockThumbnailServe(page)
    await mockProjectsList(page, [
      {
        id: 'proj-slow',
        name: 'Slow Design',
        elementCount: 3,
        thumbnailUrl: '/api/projects/proj-slow/thumbnail',
        createdAt: '2026-05-10T10:00:00Z',
        updatedAt: '2026-05-10T10:07:00Z',
      },
    ])

    let resolveProjLoad!: () => void
    const projLoadBlocked = new Promise<void>((res) => {
      resolveProjLoad = res
    })
    await page.route(/\/api\/projects\/proj-slow$/, async (route) => {
      if (route.request().method() === 'GET') {
        await projLoadBlocked
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id: 'proj-slow',
              name: 'Slow Design',
              canvas: { elements: [] },
              createdAt: '',
              updatedAt: '',
            },
          }),
        })
        return
      }
      await route.continue()
    })

    await page.goto('/')

    const card = page.locator('button').filter({ hasText: 'Slow Design' })
    await card.click()
    await expect(card).toBeDisabled()

    resolveProjLoad()
  })

  // -------------------------------------------------------------------------
  // AC 14 — multiple project cards show their own independent thumbnails
  // -------------------------------------------------------------------------

  test('AC14: each project card displays its own thumbnail independently', async ({ page }) => {
    await mockThumbnailServe(page)
    await mockProjectsList(page, [
      {
        id: 'proj-a',
        name: 'Design Alpha',
        elementCount: 1,
        thumbnailUrl: '/api/projects/proj-a/thumbnail',
        createdAt: '2026-05-10T10:00:00Z',
        updatedAt: '2026-05-10T10:07:00Z',
      },
      {
        id: 'proj-b',
        name: 'Design Beta',
        elementCount: 4,
        thumbnailUrl: '/api/projects/proj-b/thumbnail',
        createdAt: '2026-05-10T09:00:00Z',
        updatedAt: '2026-05-10T09:30:00Z',
      },
      {
        id: 'proj-c',
        name: 'Design Gamma',
        elementCount: 0,
        thumbnailUrl: null,
        createdAt: '2026-05-10T08:00:00Z',
        updatedAt: '2026-05-10T08:00:00Z',
      },
    ])

    await page.goto('/')

    const cardA = page.locator('button').filter({ hasText: 'Design Alpha' })
    const cardB = page.locator('button').filter({ hasText: 'Design Beta' })
    const cardC = page.locator('button').filter({ hasText: 'Design Gamma' })

    await expect(cardA.locator('img')).toHaveAttribute('src', '/api/projects/proj-a/thumbnail')
    await expect(cardB.locator('img')).toHaveAttribute('src', '/api/projects/proj-b/thumbnail')
    await expect(cardC.locator('img')).not.toBeAttached()
  })

  test('AC14: cards without thumbnails show no img while neighbouring cards do', async ({
    page,
  }) => {
    await mockThumbnailServe(page)
    await mockProjectsList(page, [
      {
        id: 'proj-a',
        name: 'Design Alpha',
        elementCount: 1,
        thumbnailUrl: '/api/projects/proj-a/thumbnail',
        createdAt: '2026-05-10T10:00:00Z',
        updatedAt: '2026-05-10T10:07:00Z',
      },
      {
        id: 'proj-b',
        name: 'Design Beta',
        elementCount: 0,
        thumbnailUrl: null,
        createdAt: '2026-05-10T09:00:00Z',
        updatedAt: '2026-05-10T09:00:00Z',
      },
    ])

    await page.goto('/')

    await expect(
      page.locator('button').filter({ hasText: 'Design Alpha' }).locator('img')
    ).toBeVisible()
    await expect(
      page.locator('button').filter({ hasText: 'Design Beta' }).locator('img')
    ).not.toBeAttached()
  })
})
