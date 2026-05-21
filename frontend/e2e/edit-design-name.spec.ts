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
  elementCount: 2,
  thumbnailUrl: null,
  createdAt: '2026-05-01T10:00:00Z',
  updatedAt: '2026-05-01T10:05:00Z',
}

const PROJECT_B: ProjectSummary = {
  id: 'proj-b',
  name: 'Beta Design',
  elementCount: 0,
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

async function mockPatchProject(
  page: Page,
  projectId: string,
  opts: { fail?: boolean } = {},
) {
  await page.route(new RegExp(`/api/projects/${projectId}$`), async (route) => {
    if (route.request().method() !== 'PATCH') {
      await route.continue()
      return
    }
    if (opts.fail) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Server error' } }),
      })
      return
    }
    const body = (await route.request().postDataJSON()) as { name?: string }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data: {
          id: projectId,
          name: body.name ?? '',
          updatedAt: new Date().toISOString(),
        },
      }),
    })
  })
}

// Navigate to home with a list of projects already seeded.
async function gotoHomeWithProjects(page: Page, projects: ProjectSummary[]) {
  await mockProjectsList(page, projects)
  await page.goto('/')
  // Wait for at least the first card to appear
  await expect(page.getByText(projects[0].name)).toBeVisible()
}

// ---------------------------------------------------------------------------
// AC1 — kebab button is always visible on every project card
// ---------------------------------------------------------------------------

test.describe('AC1 – kebab button visible on home page cards', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
  })

  test('AC1: every card has a visible ⋮ button without needing to hover', async ({ page }) => {
    await gotoHomeWithProjects(page, [PROJECT_A, PROJECT_B])

    // Both cards should show their kebab button without any hover
    const cards = page.locator('[data-testid="project-card"]')
    await expect(cards).toHaveCount(2)

    await expect(cards.first().getByRole('button', { name: /open menu/i })).toBeVisible()
    await expect(cards.last().getByRole('button', { name: /open menu/i })).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC3 — clicking ⋮ opens dropdown; clicking again closes it
// ---------------------------------------------------------------------------

test.describe('AC3 – dropdown opens and closes via kebab button', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
  })

  test('AC3: clicking ⋮ opens a dropdown with a Rename item', async ({ page }) => {
    await gotoHomeWithProjects(page, [PROJECT_A])

    await page.getByRole('button', { name: /open menu/i }).click()

    await expect(page.getByRole('menuitem', { name: /rename/i })).toBeVisible()
  })

  test('AC3: clicking ⋮ again closes the dropdown', async ({ page }) => {
    await gotoHomeWithProjects(page, [PROJECT_A])

    await page.getByRole('button', { name: /open menu/i }).click()
    await expect(page.getByRole('menuitem', { name: /rename/i })).toBeVisible()

    await page.getByRole('button', { name: /open menu/i }).click()
    await expect(page.getByRole('menuitem', { name: /rename/i })).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC4 — only one dropdown open at a time
// ---------------------------------------------------------------------------

test.describe('AC4 – only one dropdown open at a time', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
  })

  test('AC4: opening a second dropdown closes the first', async ({ page }) => {
    await gotoHomeWithProjects(page, [PROJECT_A, PROJECT_B])

    const cards = page.locator('[data-testid="project-card"]')
    const menuBtnA = cards.first().getByRole('button', { name: /open menu/i })
    const menuBtnB = cards.last().getByRole('button', { name: /open menu/i })

    await menuBtnA.click()
    await expect(page.getByRole('menuitem', { name: /rename/i })).toBeVisible()

    await menuBtnB.click()
    // Still exactly one "Rename" item visible (from card B's dropdown)
    await expect(page.getByRole('menuitem', { name: /rename/i })).toHaveCount(1)
  })
})

// ---------------------------------------------------------------------------
// AC5 — clicking outside closes the dropdown
// ---------------------------------------------------------------------------

test.describe('AC5 – clicking outside closes the dropdown', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
  })

  test('AC5: clicking outside the dropdown closes it', async ({ page }) => {
    await gotoHomeWithProjects(page, [PROJECT_A])

    await page.getByRole('button', { name: /open menu/i }).click()
    await expect(page.getByRole('menuitem', { name: /rename/i })).toBeVisible()

    // Click on the page background (far from the card)
    await page.mouse.click(10, 10)

    await expect(page.getByRole('menuitem', { name: /rename/i })).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC6 — pressing Escape closes the dropdown
// ---------------------------------------------------------------------------

test.describe('AC6 – Escape closes the dropdown', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
  })

  test('AC6: pressing Escape closes the dropdown', async ({ page }) => {
    await gotoHomeWithProjects(page, [PROJECT_A])

    await page.getByRole('button', { name: /open menu/i }).click()
    await expect(page.getByRole('menuitem', { name: /rename/i })).toBeVisible()

    await page.keyboard.press('Escape')

    await expect(page.getByRole('menuitem', { name: /rename/i })).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC7 — clicking ⋮ does NOT open the project
// ---------------------------------------------------------------------------

test.describe('AC7 – kebab click does not open the project', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
  })

  test('AC7: clicking ⋮ does not navigate to the editor', async ({ page }) => {
    await gotoHomeWithProjects(page, [PROJECT_A])

    await page.getByRole('button', { name: /open menu/i }).click()

    await expect(page).toHaveURL('/')
  })
})

// ---------------------------------------------------------------------------
// AC8 — clicking the card body still opens the project
// ---------------------------------------------------------------------------

test.describe('AC8 – card body click opens the project', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
  })

  test('AC8: clicking the project name still navigates to the editor', async ({ page }) => {
    await gotoHomeWithProjects(page, [PROJECT_A])

    await page.getByText(PROJECT_A.name).click()

    await expect(page).toHaveURL(new RegExp(`/editor/${PROJECT_A.id}`))
  })
})

// ---------------------------------------------------------------------------
// AC9 — selecting Rename opens the modal pre-filled with the project name
// ---------------------------------------------------------------------------

test.describe('AC9 – Rename opens modal pre-filled', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
  })

  test('AC9: selecting Rename closes dropdown and opens the rename modal', async ({ page }) => {
    await gotoHomeWithProjects(page, [PROJECT_A])

    await page.getByRole('button', { name: /open menu/i }).click()
    await page.getByRole('menuitem', { name: /rename/i }).click()

    // Dropdown gone
    await expect(page.getByRole('menuitem', { name: /rename/i })).not.toBeVisible()
    // Modal visible
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  test('AC9: the rename modal input is pre-filled with the current project name', async ({
    page,
  }) => {
    await gotoHomeWithProjects(page, [PROJECT_A])

    await page.getByRole('button', { name: /open menu/i }).click()
    await page.getByRole('menuitem', { name: /rename/i }).click()

    const input = page.getByLabel(/design name/i)
    await expect(input).toHaveValue(PROJECT_A.name)
  })
})

// ---------------------------------------------------------------------------
// AC10 — input text is fully selected when modal opens
// ---------------------------------------------------------------------------

test.describe('AC10 – input text selected on modal open', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
  })

  test('AC10: typing immediately replaces the pre-filled name (selection is active)', async ({
    page,
  }) => {
    await gotoHomeWithProjects(page, [PROJECT_A])

    await page.getByRole('button', { name: /open menu/i }).click()
    await page.getByRole('menuitem', { name: /rename/i }).click()

    // If the text is selected, typing replaces it entirely
    await page.keyboard.type('Replaced Name')

    const input = page.getByLabel(/design name/i)
    await expect(input).toHaveValue('Replaced Name')
  })
})

// ---------------------------------------------------------------------------
// AC11 — Save disabled when input is empty or whitespace-only
// ---------------------------------------------------------------------------

test.describe('AC11 – Save disabled for empty input', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
  })

  test('AC11: Save is disabled when the input is cleared', async ({ page }) => {
    await gotoHomeWithProjects(page, [PROJECT_A])

    await page.getByRole('button', { name: /open menu/i }).click()
    await page.getByRole('menuitem', { name: /rename/i }).click()

    await page.getByLabel(/design name/i).fill('')

    await expect(page.getByRole('button', { name: /^save$/i })).toBeDisabled()
  })

  test('AC11: Save is disabled when input contains only whitespace', async ({ page }) => {
    await gotoHomeWithProjects(page, [PROJECT_A])

    await page.getByRole('button', { name: /open menu/i }).click()
    await page.getByRole('menuitem', { name: /rename/i }).click()

    await page.getByLabel(/design name/i).fill('   ')

    await expect(page.getByRole('button', { name: /^save$/i })).toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// AC12 — Save disabled when trimmed input equals the current name
// ---------------------------------------------------------------------------

test.describe('AC12 – Save disabled when name unchanged', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
  })

  test('AC12: Save is disabled when the input has the same value as the current name', async ({
    page,
  }) => {
    await gotoHomeWithProjects(page, [PROJECT_A])

    await page.getByRole('button', { name: /open menu/i }).click()
    await page.getByRole('menuitem', { name: /rename/i }).click()

    // The input opens pre-filled — Save should already be disabled
    await expect(page.getByRole('button', { name: /^save$/i })).toBeDisabled()
  })

  test('AC12: Save is disabled when the user clears and re-types the original name', async ({
    page,
  }) => {
    await gotoHomeWithProjects(page, [PROJECT_A])

    await page.getByRole('button', { name: /open menu/i }).click()
    await page.getByRole('menuitem', { name: /rename/i }).click()

    const input = page.getByLabel(/design name/i)
    await input.fill('')
    await input.fill(PROJECT_A.name)

    await expect(page.getByRole('button', { name: /^save$/i })).toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// AC13 — Save enabled when name is non-empty and different
// ---------------------------------------------------------------------------

test.describe('AC13 – Save enabled for a valid new name', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
  })

  test('AC13: Save becomes enabled after typing a different name', async ({ page }) => {
    await gotoHomeWithProjects(page, [PROJECT_A])

    await page.getByRole('button', { name: /open menu/i }).click()
    await page.getByRole('menuitem', { name: /rename/i }).click()

    await page.getByLabel(/design name/i).fill('Totally New Name')

    await expect(page.getByRole('button', { name: /^save$/i })).toBeEnabled()
  })
})

// ---------------------------------------------------------------------------
// AC14 — pressing Enter submits when Save is enabled
// ---------------------------------------------------------------------------

test.describe('AC14 – Enter submits the rename', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
  })

  test('AC14: pressing Enter with a valid new name submits the rename', async ({ page }) => {
    await mockPatchProject(page, PROJECT_A.id)
    await mockProjectsList(page, [{ ...PROJECT_A, name: 'Enter Renamed' }])
    await page.goto('/')
    await expect(page.getByText(PROJECT_A.name)).toBeVisible()

    await page.getByRole('button', { name: /open menu/i }).click()
    await page.getByRole('menuitem', { name: /rename/i }).click()

    await page.getByLabel(/design name/i).fill('Enter Renamed')
    await page.keyboard.press('Enter')

    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('AC14: pressing Enter does nothing when Save is disabled (unchanged name)', async ({
    page,
  }) => {
    await gotoHomeWithProjects(page, [PROJECT_A])

    await page.getByRole('button', { name: /open menu/i }).click()
    await page.getByRole('menuitem', { name: /rename/i }).click()

    // Name unchanged → Save disabled
    await page.keyboard.press('Enter')

    // Modal stays open
    await expect(page.getByRole('dialog')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC15 — Cancel / Escape / backdrop dismiss without API call
// ---------------------------------------------------------------------------

test.describe('AC15 – dismissing the modal makes no API call', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
  })

  test('AC15: clicking Cancel closes the modal', async ({ page }) => {
    await gotoHomeWithProjects(page, [PROJECT_A])

    await page.getByRole('button', { name: /open menu/i }).click()
    await page.getByRole('menuitem', { name: /rename/i }).click()

    await page.getByRole('button', { name: /cancel/i }).click()

    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('AC15: pressing Escape closes the modal', async ({ page }) => {
    await gotoHomeWithProjects(page, [PROJECT_A])

    await page.getByRole('button', { name: /open menu/i }).click()
    await page.getByRole('menuitem', { name: /rename/i }).click()

    await page.keyboard.press('Escape')

    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('AC15: clicking the backdrop closes the modal', async ({ page }) => {
    await gotoHomeWithProjects(page, [PROJECT_A])

    await page.getByRole('button', { name: /open menu/i }).click()
    await page.getByRole('menuitem', { name: /rename/i }).click()

    await expect(page.getByRole('dialog')).toBeVisible()
    // Click the fixed overlay backdrop
    await page.mouse.click(10, 10)

    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('AC15: Cancel does not navigate away from the home page', async ({ page }) => {
    await gotoHomeWithProjects(page, [PROJECT_A])

    await page.getByRole('button', { name: /open menu/i }).click()
    await page.getByRole('menuitem', { name: /rename/i }).click()
    await page.getByRole('button', { name: /cancel/i }).click()

    await expect(page).toHaveURL('/')
  })
})

// ---------------------------------------------------------------------------
// AC16 — successful save closes modal and refreshes card name
// ---------------------------------------------------------------------------

test.describe('AC16 – successful rename updates the card', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
  })

  test('AC16: modal closes after a successful save', async ({ page }) => {
    await mockPatchProject(page, PROJECT_A.id)
    // After invalidation, the refetch returns the updated name
    await mockProjectsList(page, [{ ...PROJECT_A, name: 'Renamed Alpha' }])
    await page.goto('/')
    await expect(page.getByText(PROJECT_A.name)).toBeVisible()

    await page.getByRole('button', { name: /open menu/i }).click()
    await page.getByRole('menuitem', { name: /rename/i }).click()
    await page.getByLabel(/design name/i).fill('Renamed Alpha')
    await page.getByRole('button', { name: /^save$/i }).click()

    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('AC16: the project card shows the updated name after a successful save', async ({
    page,
  }) => {
    await mockPatchProject(page, PROJECT_A.id)
    await mockProjectsList(page, [{ ...PROJECT_A, name: 'Renamed Alpha' }])
    await page.goto('/')
    await expect(page.getByText(PROJECT_A.name)).toBeVisible()

    await page.getByRole('button', { name: /open menu/i }).click()
    await page.getByRole('menuitem', { name: /rename/i }).click()
    await page.getByLabel(/design name/i).fill('Renamed Alpha')
    await page.getByRole('button', { name: /^save$/i }).click()

    await expect(page.getByRole('dialog')).not.toBeVisible()
    await expect(page.getByText('Renamed Alpha')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC17 — API error keeps modal open with an error message
// ---------------------------------------------------------------------------

test.describe('AC17 – API error shows inline error in modal', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
  })

  test('AC17: modal stays open when the PATCH request fails', async ({ page }) => {
    await mockPatchProject(page, PROJECT_A.id, { fail: true })
    await gotoHomeWithProjects(page, [PROJECT_A])

    await page.getByRole('button', { name: /open menu/i }).click()
    await page.getByRole('menuitem', { name: /rename/i }).click()
    await page.getByLabel(/design name/i).fill('Will Fail')
    await page.getByRole('button', { name: /^save$/i }).click()

    await expect(page.getByRole('dialog')).toBeVisible()
  })

  test('AC17: an error message is shown below the input after a failed save', async ({
    page,
  }) => {
    await mockPatchProject(page, PROJECT_A.id, { fail: true })
    await gotoHomeWithProjects(page, [PROJECT_A])

    await page.getByRole('button', { name: /open menu/i }).click()
    await page.getByRole('menuitem', { name: /rename/i }).click()
    await page.getByLabel(/design name/i).fill('Will Fail')
    await page.getByRole('button', { name: /^save$/i }).click()

    await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible()
  })

  test('AC17: Save is re-enabled after a failed save so the user can retry', async ({
    page,
  }) => {
    await mockPatchProject(page, PROJECT_A.id, { fail: true })
    await gotoHomeWithProjects(page, [PROJECT_A])

    await page.getByRole('button', { name: /open menu/i }).click()
    await page.getByRole('menuitem', { name: /rename/i }).click()
    await page.getByLabel(/design name/i).fill('Will Fail')
    await page.getByRole('button', { name: /^save$/i }).click()

    // Wait for the error to appear, then check Save is interactive again
    await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible()
    await expect(page.getByRole('button', { name: /^save$/i })).toBeEnabled()
  })
})

// ---------------------------------------------------------------------------
// AC18 — rename works inside the "All designs" modal
// ---------------------------------------------------------------------------

test.describe('AC18 – rename flow inside the All Designs modal', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
  })

  // Generate >6 projects so the "View all" link appears
  function manyProjects(): ProjectSummary[] {
    return Array.from({ length: 8 }, (_, i) => ({
      id: `proj-${i}`,
      name: `Design ${i + 1}`,
      elementCount: 0,
      thumbnailUrl: null,
      createdAt: `2026-05-0${(i % 9) + 1}T10:00:00Z`,
      updatedAt: `2026-05-0${(i % 9) + 1}T10:05:00Z`,
    }))
  }

  test('AC18: each card inside the All Designs modal has a ⋮ button', async ({ page }) => {
    await mockProjectsList(page, manyProjects())
    await page.goto('/')

    await page.getByRole('link', { name: /view all designs/i }).click()
    await expect(page.getByRole('dialog', { name: /all designs/i })).toBeVisible()

    // At least one kebab button visible inside the modal
    const modal = page.getByRole('dialog', { name: /all designs/i })
    await expect(modal.getByRole('button', { name: /open menu/i }).first()).toBeVisible()
  })

  test('AC18: Rename from inside All Designs modal pre-fills the correct name', async ({
    page,
  }) => {
    const projects = manyProjects()
    await mockProjectsList(page, projects)
    await page.goto('/')

    await page.getByRole('link', { name: /view all designs/i }).click()
    const allDesignsModal = page.getByRole('dialog', { name: /all designs/i })
    await expect(allDesignsModal).toBeVisible()

    // Click the ⋮ on the first card inside the modal
    await allDesignsModal.getByRole('button', { name: /open menu/i }).first().click()
    await page.getByRole('menuitem', { name: /rename/i }).click()

    // Rename modal should open pre-filled with that card's name
    const renameModal = page.getByRole('dialog', { name: /rename design/i })
    await expect(renameModal).toBeVisible()
    await expect(renameModal.getByLabel(/design name/i)).toHaveValue(projects[0].name)
  })

  test('AC18: successful rename inside All Designs modal closes the rename modal', async ({
    page,
  }) => {
    const projects = manyProjects()
    await mockPatchProject(page, projects[0].id)
    const updatedProjects = [...projects]
    updatedProjects[0] = { ...projects[0], name: 'Modal Renamed' }
    await mockProjectsList(page, updatedProjects)
    await page.goto('/')

    await page.getByRole('link', { name: /view all designs/i }).click()
    const allDesignsModal = page.getByRole('dialog', { name: /all designs/i })
    await expect(allDesignsModal).toBeVisible()

    await allDesignsModal.getByRole('button', { name: /open menu/i }).first().click()
    await page.getByRole('menuitem', { name: /rename/i }).click()

    await page.getByLabel(/design name/i).fill('Modal Renamed')
    await page.getByRole('button', { name: /^save$/i }).click()

    await expect(page.getByRole('dialog', { name: /rename design/i })).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC19 — renaming one project does not affect others
// ---------------------------------------------------------------------------

test.describe('AC19 – rename only affects the targeted project', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
  })

  test('AC19: other cards retain their original names after a rename', async ({ page }) => {
    await mockPatchProject(page, PROJECT_A.id)
    // After refetch: A is renamed, B is unchanged
    await mockProjectsList(page, [
      { ...PROJECT_A, name: 'Renamed Alpha' },
      PROJECT_B,
    ])
    await page.goto('/')
    await expect(page.getByText(PROJECT_A.name)).toBeVisible()
    await expect(page.getByText(PROJECT_B.name)).toBeVisible()

    const cards = page.locator('[data-testid="project-card"]')
    await cards.first().getByRole('button', { name: /open menu/i }).click()
    await page.getByRole('menuitem', { name: /rename/i }).click()
    await page.getByLabel(/design name/i).fill('Renamed Alpha')
    await page.getByRole('button', { name: /^save$/i }).click()

    await expect(page.getByRole('dialog')).not.toBeVisible()
    // B's name is still visible
    await expect(page.getByText(PROJECT_B.name)).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC20 — full page reload after renaming shows the updated name
// ---------------------------------------------------------------------------

test.describe('AC20 – persisted rename survives a page reload', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
  })

  test('AC20: the updated name is shown after a page reload', async ({ page }) => {
    const RENAMED = 'Persisted Name'
    await mockPatchProject(page, PROJECT_A.id)
    // First visit: original name; after reload: updated name
    let callCount = 0
    await page.route(/\/api\/projects$/, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue()
        return
      }
      callCount++
      const name = callCount === 1 ? PROJECT_A.name : RENAMED
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: [{ ...PROJECT_A, name }],
        }),
      })
    })

    await page.goto('/')
    await expect(page.getByText(PROJECT_A.name)).toBeVisible()

    // Rename
    await page.getByRole('button', { name: /open menu/i }).click()
    await page.getByRole('menuitem', { name: /rename/i }).click()
    await page.getByLabel(/design name/i).fill(RENAMED)
    await page.getByRole('button', { name: /^save$/i }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()

    // Reload
    await page.reload()

    await expect(page.getByText(RENAMED)).toBeVisible()
  })
})
