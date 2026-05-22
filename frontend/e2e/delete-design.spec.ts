import { expect, Page, test } from '@playwright/test'
import { mockApiRoutes } from './mock-api'

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type ProjectSummary = {
  id: string
  name: string
  elementCount: number
  thumbnailUrl: string | null
  createdAt: string
  updatedAt: string
}

const PROJECT_A: ProjectSummary = {
  id: 'proj-a',
  name: 'Alpha Design',
  elementCount: 3,
  thumbnailUrl: null,
  createdAt: '2026-05-01T10:00:00Z',
  updatedAt: '2026-05-01T10:05:00Z',
}

const PROJECT_B: ProjectSummary = {
  id: 'proj-b',
  name: 'Beta Design',
  elementCount: 1,
  thumbnailUrl: null,
  createdAt: '2026-05-02T10:00:00Z',
  updatedAt: '2026-05-02T10:05:00Z',
}

// ---------------------------------------------------------------------------
// Route helpers
// ---------------------------------------------------------------------------

async function mockProjectsList(page: Page, projects: ProjectSummary[]) {
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

async function mockDeleteProject(
  page: Page,
  projectId: string,
  opts: { fail?: boolean } = {},
) {
  await page.route(new RegExp(`/api/projects/${projectId}$`), async (route) => {
    if (route.request().method() !== 'DELETE') {
      await route.continue()
      return
    }
    if (opts.fail) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: { code: 'INTERNAL_ERROR', message: 'Server error' },
        }),
      })
      return
    }
    await route.fulfill({ status: 204 })
  })
}

async function gotoHomeWithProjects(page: Page, projects: ProjectSummary[]) {
  await mockProjectsList(page, projects)
  await page.goto('/')
  await expect(page.getByText(projects[0].name)).toBeVisible()
}

function manyProjects(): ProjectSummary[] {
  return Array.from({ length: 8 }, (_, i) => ({
    id: `proj-${i}`,
    name: `Design ${i + 1}`,
    elementCount: i,
    thumbnailUrl: null,
    createdAt: `2026-05-0${(i % 9) + 1}T10:00:00Z`,
    updatedAt: `2026-05-0${(i % 9) + 1}T10:05:00Z`,
  }))
}

// ---------------------------------------------------------------------------
// AC1 — "Delete" item is visible in the kebab dropdown on every card
// ---------------------------------------------------------------------------

test.describe('AC1 – Delete item in kebab dropdown', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
  })

  test('AC1: every card shows a "Delete" item in the kebab dropdown', async ({ page }) => {
    await gotoHomeWithProjects(page, [PROJECT_A, PROJECT_B])

    const cards = page.locator('[data-testid="project-card"]')

    // First card
    await cards.first().getByRole('button', { name: /project options/i }).click()
    await expect(page.getByRole('button', { name: /^delete$/i })).toBeVisible()
    await page.keyboard.press('Escape')

    // Second card
    await cards.last().getByRole('button', { name: /project options/i }).click()
    await expect(page.getByRole('button', { name: /^delete$/i })).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC2 — "Delete" item is below "Rename" and separated by a divider
// ---------------------------------------------------------------------------

test.describe('AC2 – Delete item placement and divider', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
  })

  test('AC2: Rename appears before Delete in the dropdown', async ({ page }) => {
    await gotoHomeWithProjects(page, [PROJECT_A])

    await page.getByRole('button', { name: /project options/i }).click()

    const rename = page.getByRole('button', { name: /^rename$/i })
    const del = page.getByRole('button', { name: /^delete$/i })

    await expect(rename).toBeVisible()
    await expect(del).toBeVisible()

    const renameBbox = await rename.boundingBox()
    const deleteBbox = await del.boundingBox()

    // Delete button must be below the Rename button
    expect(renameBbox!.y).toBeLessThan(deleteBbox!.y)
  })
})

// ---------------------------------------------------------------------------
// AC3 — clicking Delete closes the dropdown and opens the confirmation dialog
// ---------------------------------------------------------------------------

test.describe('AC3 – clicking Delete opens confirmation dialog', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
  })

  test('AC3: clicking Delete in the dropdown closes the dropdown', async ({ page }) => {
    await gotoHomeWithProjects(page, [PROJECT_A])

    await page.getByRole('button', { name: /project options/i }).click()
    await page.getByRole('button', { name: /^delete$/i }).click()

    await expect(page.getByRole('button', { name: /^rename$/i })).not.toBeVisible()
  })

  test('AC3: clicking Delete opens the confirmation dialog', async ({ page }) => {
    await gotoHomeWithProjects(page, [PROJECT_A])

    await page.getByRole('button', { name: /project options/i }).click()
    await page.getByRole('button', { name: /^delete$/i }).click()

    await expect(page.getByRole('dialog')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC4 — confirmation dialog displays the project name in bold
// ---------------------------------------------------------------------------

test.describe('AC4 – confirmation dialog shows project name', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
  })

  test('AC4: the dialog body contains the project name', async ({ page }) => {
    await gotoHomeWithProjects(page, [PROJECT_A])

    await page.getByRole('button', { name: /project options/i }).click()
    await page.getByRole('button', { name: /^delete$/i }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText(PROJECT_A.name)
  })
})

// ---------------------------------------------------------------------------
// AC5 — Cancel / Escape / backdrop dismiss without making any API call
// ---------------------------------------------------------------------------

test.describe('AC5 – dismissing the dialog makes no API call', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
  })

  test('AC5: clicking Cancel closes the dialog', async ({ page }) => {
    await gotoHomeWithProjects(page, [PROJECT_A])

    await page.getByRole('button', { name: /project options/i }).click()
    await page.getByRole('button', { name: /^delete$/i }).click()

    await page.getByRole('button', { name: /cancel/i }).click()

    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('AC5: pressing Escape closes the dialog', async ({ page }) => {
    await gotoHomeWithProjects(page, [PROJECT_A])

    await page.getByRole('button', { name: /project options/i }).click()
    await page.getByRole('button', { name: /^delete$/i }).click()

    await page.keyboard.press('Escape')

    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('AC5: clicking the backdrop closes the dialog', async ({ page }) => {
    await gotoHomeWithProjects(page, [PROJECT_A])

    await page.getByRole('button', { name: /project options/i }).click()
    await page.getByRole('button', { name: /^delete$/i }).click()

    await expect(page.getByRole('dialog')).toBeVisible()
    await page.mouse.click(10, 10)

    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('AC5: Cancel does not make any DELETE API call', async ({ page }) => {
    let deleteCalled = false
    await page.route(new RegExp(`/api/projects/${PROJECT_A.id}$`), async (route) => {
      if (route.request().method() === 'DELETE') {
        deleteCalled = true
        await route.fulfill({ status: 204 })
        return
      }
      await route.continue()
    })
    await gotoHomeWithProjects(page, [PROJECT_A])

    await page.getByRole('button', { name: /project options/i }).click()
    await page.getByRole('button', { name: /^delete$/i }).click()
    await page.getByRole('button', { name: /cancel/i }).click()

    expect(deleteCalled).toBe(false)
  })

  test('AC5: Escape does not make any DELETE API call', async ({ page }) => {
    let deleteCalled = false
    await page.route(new RegExp(`/api/projects/${PROJECT_A.id}$`), async (route) => {
      if (route.request().method() === 'DELETE') {
        deleteCalled = true
        await route.fulfill({ status: 204 })
        return
      }
      await route.continue()
    })
    await gotoHomeWithProjects(page, [PROJECT_A])

    await page.getByRole('button', { name: /project options/i }).click()
    await page.getByRole('button', { name: /^delete$/i }).click()
    await page.keyboard.press('Escape')

    expect(deleteCalled).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// AC6 — confirming deletion calls DELETE /api/projects/:id
// ---------------------------------------------------------------------------

test.describe('AC6 – confirming deletion calls the API', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
  })

  test('AC6: clicking Delete in the dialog calls DELETE /api/projects/:id', async ({ page }) => {
    let deleteEndpointCalled = false
    await mockDeleteProject(page, PROJECT_A.id)
    await page.route(new RegExp(`/api/projects/${PROJECT_A.id}$`), async (route) => {
      if (route.request().method() === 'DELETE') {
        deleteEndpointCalled = true
        await route.fulfill({ status: 204 })
        return
      }
      await route.continue()
    })

    await gotoHomeWithProjects(page, [PROJECT_A])

    await page.getByRole('button', { name: /project options/i }).click()
    await page.getByRole('button', { name: /^delete$/i }).click()

    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: /^delete$/i }).click()

    await expect(page.getByRole('dialog')).not.toBeVisible()
    expect(deleteEndpointCalled).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// AC7 — loading state during API call
// ---------------------------------------------------------------------------

test.describe('AC7 – loading state while API call is in flight', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
  })

  test('AC7: Delete button shows spinner and is non-interactive while loading', async ({ page }) => {
    // Intercept and delay the DELETE so we can inspect the loading state
    await page.route(new RegExp(`/api/projects/${PROJECT_A.id}$`), async (route) => {
      if (route.request().method() === 'DELETE') {
        await new Promise((r) => setTimeout(r, 300))
        await route.fulfill({ status: 204 })
        return
      }
      await route.continue()
    })
    // Mock list for second fetch (after invalidation)
    let listCallCount = 0
    await page.route(/\/api\/projects$/, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue()
        return
      }
      listCallCount++
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: listCallCount === 1 ? [PROJECT_A] : [] }),
      })
    })
    await page.goto('/')
    await expect(page.getByText(PROJECT_A.name)).toBeVisible()

    await page.getByRole('button', { name: /project options/i }).click()
    await page.getByRole('button', { name: /^delete$/i }).click()

    const dialog = page.getByRole('dialog')
    const confirmDeleteBtn = dialog.getByRole('button', { name: /^delete$/i })
    await confirmDeleteBtn.click()

    // While the 300ms delay is running, the button should be disabled
    await expect(confirmDeleteBtn).toBeDisabled()
    // Cancel should remain interactive
    await expect(dialog.getByRole('button', { name: /cancel/i })).toBeEnabled()
  })
})

// ---------------------------------------------------------------------------
// AC8 — successful deletion closes the dialog and removes the card
// ---------------------------------------------------------------------------

test.describe('AC8 – successful deletion removes the card', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
  })

  test('AC8: dialog closes after successful deletion', async ({ page }) => {
    await mockDeleteProject(page, PROJECT_A.id)
    let listCallCount = 0
    await page.route(/\/api\/projects$/, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue()
        return
      }
      listCallCount++
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: listCallCount === 1 ? [PROJECT_A] : [] }),
      })
    })
    await page.goto('/')
    await expect(page.getByText(PROJECT_A.name)).toBeVisible()

    await page.getByRole('button', { name: /project options/i }).click()
    await page.getByRole('button', { name: /^delete$/i }).click()
    await page.getByRole('dialog').getByRole('button', { name: /^delete$/i }).click()

    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('AC8: the deleted card disappears from the grid', async ({ page }) => {
    await mockDeleteProject(page, PROJECT_A.id)
    let listCallCount = 0
    await page.route(/\/api\/projects$/, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue()
        return
      }
      listCallCount++
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: listCallCount === 1 ? [PROJECT_A, PROJECT_B] : [PROJECT_B],
        }),
      })
    })
    await page.goto('/')
    await expect(page.getByText(PROJECT_A.name)).toBeVisible()

    await page
      .locator('[data-testid="project-card"]')
      .first()
      .getByRole('button', { name: /project options/i })
      .click()
    await page.getByRole('button', { name: /^delete$/i }).click()
    await page.getByRole('dialog').getByRole('button', { name: /^delete$/i }).click()

    await expect(page.getByRole('dialog')).not.toBeVisible()
    await expect(page.getByText(PROJECT_A.name)).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC9 — API error closes dialog and shows toast notification
// ---------------------------------------------------------------------------

test.describe('AC9 – API error shows toast notification', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
  })

  test('AC9: dialog closes when the DELETE request fails', async ({ page }) => {
    await mockDeleteProject(page, PROJECT_A.id, { fail: true })
    await gotoHomeWithProjects(page, [PROJECT_A])

    await page.getByRole('button', { name: /project options/i }).click()
    await page.getByRole('button', { name: /^delete$/i }).click()
    await page.getByRole('dialog').getByRole('button', { name: /^delete$/i }).click()

    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('AC9: a toast error notification appears after a failed deletion', async ({ page }) => {
    await mockDeleteProject(page, PROJECT_A.id, { fail: true })
    await gotoHomeWithProjects(page, [PROJECT_A])

    await page.getByRole('button', { name: /project options/i }).click()
    await page.getByRole('button', { name: /^delete$/i }).click()
    await page.getByRole('dialog').getByRole('button', { name: /^delete$/i }).click()

    await expect(
      page.getByText(/could not delete the design/i),
    ).toBeVisible()
  })

  test('AC9: the toast auto-dismisses after 4 seconds', async ({ page }) => {
    await mockDeleteProject(page, PROJECT_A.id, { fail: true })
    await gotoHomeWithProjects(page, [PROJECT_A])

    await page.getByRole('button', { name: /project options/i }).click()
    await page.getByRole('button', { name: /^delete$/i }).click()
    await page.getByRole('dialog').getByRole('button', { name: /^delete$/i }).click()

    await expect(page.getByText(/could not delete the design/i)).toBeVisible()

    // After 4 seconds the toast should be gone
    await expect(page.getByText(/could not delete the design/i)).not.toBeVisible({
      timeout: 6000,
    })
  })
})

// ---------------------------------------------------------------------------
// AC10 — deleted project does not appear after page reload
// ---------------------------------------------------------------------------

test.describe('AC10 – deletion is permanent', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
  })

  test('AC10: reloading the home page does not restore the deleted project', async ({ page }) => {
    await mockDeleteProject(page, PROJECT_A.id)
    // After first load: PROJECT_A present. After delete + reload: PROJECT_A gone.
    let listCallCount = 0
    await page.route(/\/api\/projects$/, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue()
        return
      }
      listCallCount++
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: listCallCount <= 2 ? [PROJECT_A] : [],
        }),
      })
    })
    await page.goto('/')
    await expect(page.getByText(PROJECT_A.name)).toBeVisible()

    await page.getByRole('button', { name: /project options/i }).click()
    await page.getByRole('button', { name: /^delete$/i }).click()
    await page.getByRole('dialog').getByRole('button', { name: /^delete$/i }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()

    await page.reload()

    await expect(page.getByText(PROJECT_A.name)).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC11 — delete from AllDesignsModal updates the modal and home page grid
// ---------------------------------------------------------------------------

test.describe('AC11 – delete from AllDesignsModal', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
  })

  test('AC11: each card inside the All Designs modal has a Delete item in its dropdown', async ({
    page,
  }) => {
    await mockProjectsList(page, manyProjects())
    await page.goto('/')

    await page.getByRole('button', { name: /view all designs/i }).click()
    const allDesignsModal = page.getByRole('dialog', { name: /all designs/i })
    await expect(allDesignsModal).toBeVisible()

    await allDesignsModal
      .getByRole('button', { name: /project options/i })
      .first()
      .click()

    await expect(page.getByRole('button', { name: /^delete$/i })).toBeVisible()
  })

  test('AC11: deleting from AllDesignsModal removes the card from the modal', async ({ page }) => {
    const projects = manyProjects()
    const targetId = projects[0].id

    // Set up DELETE mock
    await page.route(new RegExp(`/api/projects/${targetId}$`), async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({ status: 204 })
        return
      }
      await route.continue()
    })

    // First GET: full list. Second GET (after invalidation): list minus first project.
    let listCallCount = 0
    await page.route(/\/api\/projects$/, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue()
        return
      }
      listCallCount++
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: listCallCount === 1 ? projects : projects.slice(1),
        }),
      })
    })
    await page.goto('/')

    await page.getByRole('button', { name: /view all designs/i }).click()
    const allDesignsModal = page.getByRole('dialog', { name: /all designs/i })
    await expect(allDesignsModal).toBeVisible()

    await allDesignsModal
      .getByRole('button', { name: /project options/i })
      .first()
      .click()
    await page.getByRole('button', { name: /^delete$/i }).click()

    const confirmDialog = page.getByRole('dialog', { name: /delete design/i })
    await confirmDialog.getByRole('button', { name: /^delete$/i }).click()

    await expect(confirmDialog).not.toBeVisible()
    await expect(allDesignsModal.getByText(projects[0].name)).not.toBeVisible()
  })

  test('AC11: "View all" count updates after deletion via AllDesignsModal', async ({ page }) => {
    const projects = manyProjects() // 8 projects
    const targetId = projects[0].id

    await page.route(new RegExp(`/api/projects/${targetId}$`), async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({ status: 204 })
        return
      }
      await route.continue()
    })

    let listCallCount = 0
    await page.route(/\/api\/projects$/, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue()
        return
      }
      listCallCount++
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: listCallCount === 1 ? projects : projects.slice(1),
        }),
      })
    })
    await page.goto('/')

    // Initial "View all" count: 8
    await expect(page.getByRole('button', { name: /view all designs.*8/i })).toBeVisible()

    await page.getByRole('button', { name: /view all designs/i }).click()
    const allDesignsModal = page.getByRole('dialog', { name: /all designs/i })
    await expect(allDesignsModal).toBeVisible()

    await allDesignsModal
      .getByRole('button', { name: /project options/i })
      .first()
      .click()
    await page.getByRole('button', { name: /^delete$/i }).click()
    await page.getByRole('dialog', { name: /delete design/i }).getByRole('button', { name: /^delete$/i }).click()

    await expect(page.getByRole('dialog', { name: /delete design/i })).not.toBeVisible()

    // After deletion + query invalidation, "View all" should reflect 7 projects
    await expect(page.getByRole('button', { name: /view all designs.*7/i })).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC12 — deleting one project does not affect others
// ---------------------------------------------------------------------------

test.describe('AC12 – delete only affects the targeted project', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
  })

  test('AC12: other project cards remain intact after a deletion', async ({ page }) => {
    await mockDeleteProject(page, PROJECT_A.id)
    let listCallCount = 0
    await page.route(/\/api\/projects$/, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue()
        return
      }
      listCallCount++
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: listCallCount === 1 ? [PROJECT_A, PROJECT_B] : [PROJECT_B],
        }),
      })
    })
    await page.goto('/')
    await expect(page.getByText(PROJECT_A.name)).toBeVisible()
    await expect(page.getByText(PROJECT_B.name)).toBeVisible()

    await page
      .locator('[data-testid="project-card"]')
      .first()
      .getByRole('button', { name: /project options/i })
      .click()
    await page.getByRole('button', { name: /^delete$/i }).click()
    await page.getByRole('dialog').getByRole('button', { name: /^delete$/i }).click()

    await expect(page.getByRole('dialog')).not.toBeVisible()
    await expect(page.getByText(PROJECT_B.name)).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC13 — clicking Delete in the dropdown does NOT trigger the card open action
// ---------------------------------------------------------------------------

test.describe('AC13 – Delete dropdown item does not open the project', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
  })

  test('AC13: clicking Delete in the dropdown stays on the home page', async ({ page }) => {
    await gotoHomeWithProjects(page, [PROJECT_A])

    await page.getByRole('button', { name: /project options/i }).click()
    await page.getByRole('button', { name: /^delete$/i }).click()

    await expect(page).toHaveURL('/')
  })
})

// ---------------------------------------------------------------------------
// AC14 — Rename continues to work after the Delete feature is added
// ---------------------------------------------------------------------------

test.describe('AC14 – Rename is not regressed by the Delete feature', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
  })

  test('AC14: Rename modal still opens correctly alongside the Delete item', async ({ page }) => {
    await gotoHomeWithProjects(page, [PROJECT_A])

    await page.getByRole('button', { name: /project options/i }).click()
    await page.getByRole('button', { name: /^rename$/i }).click()

    await expect(page.getByRole('dialog')).toBeVisible()
    // Confirm it's the rename dialog, not the delete dialog
    await expect(page.getByLabel(/design name/i)).toHaveValue(PROJECT_A.name)
  })

  test('AC14: Rename still updates the card name after clicking Save', async ({ page }) => {
    // Intercept PATCH for rename
    await page.route(new RegExp(`/api/projects/${PROJECT_A.id}$`), async (route) => {
      if (route.request().method() !== 'PATCH') {
        await route.continue()
        return
      }
      const body = (await route.request().postDataJSON()) as { name?: string }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: { id: PROJECT_A.id, name: body.name ?? '', updatedAt: new Date().toISOString() },
        }),
      })
    })
    let listCallCount = 0
    await page.route(/\/api\/projects$/, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue()
        return
      }
      listCallCount++
      const name = listCallCount === 1 ? PROJECT_A.name : 'Renamed Alpha'
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: [{ ...PROJECT_A, name }] }),
      })
    })
    await page.goto('/')
    await expect(page.getByText(PROJECT_A.name)).toBeVisible()

    await page.getByRole('button', { name: /project options/i }).click()
    await page.getByRole('button', { name: /^rename$/i }).click()
    await page.getByLabel(/design name/i).fill('Renamed Alpha')
    await page.getByRole('button', { name: /^save$/i }).click()

    await expect(page.getByRole('dialog')).not.toBeVisible()
    await expect(page.getByText('Renamed Alpha')).toBeVisible()
  })
})
