import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { EditorPage } from './EditorPage'
import { useCanvasStore } from '../stores/canvasStore'

const mockNavigate = vi.fn()

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

function renderEditor() {
  const router = createMemoryRouter([{ path: '/', element: <EditorPage /> }], {
    initialEntries: ['/'],
  })
  render(<RouterProvider router={router} />)
}

beforeEach(() => {
  mockNavigate.mockReset()
  useCanvasStore.setState({
    designId: 'test-id',
    name: 'My Design',
    elements: [],
    selectedIds: [],
    isDirty: false,
  })
})

// AC 11 — Close button is always visible in the editor header
describe('AC11 — Close button visibility', () => {
  it('renders a Close button in the header', () => {
    renderEditor()
    expect(screen.getByRole('button', { name: /close design/i })).toBeInTheDocument()
  })

  it('the Close button is inside the header element', () => {
    renderEditor()
    const header = screen.getByRole('banner')
    expect(header).toContainElement(screen.getByRole('button', { name: /close design/i }))
  })

  it('the Close button is visible alongside the design name', () => {
    renderEditor()
    expect(screen.getByRole('button', { name: /close design/i })).toBeVisible()
    expect(screen.getByText('My Design')).toBeVisible()
  })
})

// AC 12 — Clicking Close navigates to / without confirmation
describe('AC12 — Close navigates to home', () => {
  it('clicking Close calls navigate with "/"', () => {
    renderEditor()
    fireEvent.click(screen.getByRole('button', { name: /close design/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('clicking Close calls navigate exactly once', () => {
    renderEditor()
    fireEvent.click(screen.getByRole('button', { name: /close design/i }))
    expect(mockNavigate).toHaveBeenCalledTimes(1)
  })

  it('no confirmation dialog is shown before navigating', () => {
    renderEditor()
    fireEvent.click(screen.getByRole('button', { name: /close design/i }))
    // Navigation fires immediately — no dialog present
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })
})
