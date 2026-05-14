import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Toolbar } from './Toolbar'
import { useCanvasStore } from '../../stores/canvasStore'
import { useUIStore } from '../../stores/uiStore'
import { SURFACE_WIDTH, SURFACE_HEIGHT } from './DesignSurface'

beforeEach(() => {
  useCanvasStore.setState({ elements: [], selectedIds: [], isDirty: false })
  useUIStore.setState({ activeTool: 'select', activePanel: null, isExportModalOpen: false })
})

// AC 1 — toolbar is visible with a "T" button
describe('toolbar appearance', () => {
  it('renders a button labelled T', () => {
    render(<Toolbar />)
    expect(screen.getByTitle('Text')).toBeInTheDocument()
    expect(screen.getByTitle('Text')).toHaveTextContent('T')
  })

  it('renders inside an aside element', () => {
    const { container } = render(<Toolbar />)
    expect(container.querySelector('aside')).toBeInTheDocument()
  })
})

// AC 2 — clicking T adds a text element centred on the design surface
describe('text tool button', () => {
  it('adds exactly one text element to the canvas store', () => {
    render(<Toolbar />)
    fireEvent.click(screen.getByTitle('Text'))
    expect(useCanvasStore.getState().elements).toHaveLength(1)
  })

  it('adds an element of type text', () => {
    render(<Toolbar />)
    fireEvent.click(screen.getByTitle('Text'))
    expect(useCanvasStore.getState().elements[0].type).toBe('text')
  })

  it('places the element at the horizontal centre of the design surface', () => {
    render(<Toolbar />)
    fireEvent.click(screen.getByTitle('Text'))
    const el = useCanvasStore.getState().elements[0]
    expect(el.x).toBe((SURFACE_WIDTH - el.width) / 2)
  })

  it('places the element at the vertical centre of the design surface', () => {
    render(<Toolbar />)
    fireEvent.click(screen.getByTitle('Text'))
    const el = useCanvasStore.getState().elements[0]
    expect(el.y).toBe((SURFACE_HEIGHT - el.height) / 2)
  })

  it('selects the newly added element', () => {
    render(<Toolbar />)
    fireEvent.click(screen.getByTitle('Text'))
    const el = useCanvasStore.getState().elements[0]
    expect(useCanvasStore.getState().selectedIds).toContain(el.id)
  })

  it('resets the active tool to select after insertion', () => {
    render(<Toolbar />)
    fireEvent.click(screen.getByTitle('Text'))
    expect(useUIStore.getState().activeTool).toBe('select')
  })
})

// ---------------------------------------------------------------------------
// Image tool — ACs 1, 2, 6 from 03-image-element.md
// ---------------------------------------------------------------------------

// AC 1 — toolbar shows an image button with tooltip "Image"
describe('image tool button appearance', () => {
  it('renders a button with title "Image"', () => {
    render(<Toolbar />)
    expect(screen.getByTitle('Image')).toBeInTheDocument()
  })

  it('the image button contains an SVG icon', () => {
    const { container } = render(<Toolbar />)
    const btn = screen.getByTitle('Image')
    expect(btn.querySelector('svg')).toBeInTheDocument()
    // confirm it is inside the aside, below the T button
    expect(container.querySelector('aside')).toContainElement(btn)
  })
})

// AC 2 — clicking the image button inserts an image element at x:480, y:240
describe('image tool insertion', () => {
  it('adds exactly one image element to the canvas store', () => {
    render(<Toolbar />)
    fireEvent.click(screen.getByTitle('Image'))
    expect(useCanvasStore.getState().elements).toHaveLength(1)
  })

  it('adds an element of type image', () => {
    render(<Toolbar />)
    fireEvent.click(screen.getByTitle('Image'))
    expect(useCanvasStore.getState().elements[0].type).toBe('image')
  })

  it('places the element at x:480 (horizontally centred on 1280px surface)', () => {
    render(<Toolbar />)
    fireEvent.click(screen.getByTitle('Image'))
    expect(useCanvasStore.getState().elements[0].x).toBe((SURFACE_WIDTH - 320) / 2)
  })

  it('places the element at y:240 (vertically centred on 720px surface)', () => {
    render(<Toolbar />)
    fireEvent.click(screen.getByTitle('Image'))
    expect(useCanvasStore.getState().elements[0].y).toBe((SURFACE_HEIGHT - 240) / 2)
  })

  it('selects the newly added image element', () => {
    render(<Toolbar />)
    fireEvent.click(screen.getByTitle('Image'))
    const el = useCanvasStore.getState().elements[0]
    expect(useCanvasStore.getState().selectedIds).toContain(el.id)
  })

  it('resets the active tool to select after insertion', () => {
    render(<Toolbar />)
    fireEvent.click(screen.getByTitle('Image'))
    expect(useUIStore.getState().activeTool).toBe('select')
  })
})

// AC 6 — multiple image elements can be added independently
describe('multiple image elements', () => {
  it('adds a new independent element on each click', () => {
    render(<Toolbar />)
    fireEvent.click(screen.getByTitle('Image'))
    fireEvent.click(screen.getByTitle('Image'))
    fireEvent.click(screen.getByTitle('Image'))
    expect(useCanvasStore.getState().elements).toHaveLength(3)
  })

  it('assigns a unique id to each image element', () => {
    render(<Toolbar />)
    fireEvent.click(screen.getByTitle('Image'))
    fireEvent.click(screen.getByTitle('Image'))
    const [a, b] = useCanvasStore.getState().elements
    expect(a.id).not.toBe(b.id)
  })
})

// ---------------------------------------------------------------------------
// Arrow tool — ACs from 08-toolbar-arrow-element.md
// ---------------------------------------------------------------------------

// AC 1 — toolbar shows an arrow button with tooltip "Arrow"
describe('arrow tool button appearance', () => {
  it('renders a button with title "Arrow"', () => {
    render(<Toolbar />)
    expect(screen.getByTitle('Arrow')).toBeInTheDocument()
  })

  it('the arrow button displays the → character', () => {
    render(<Toolbar />)
    expect(screen.getByTitle('Arrow')).toHaveTextContent('→')
  })

  it('the arrow button is inside the aside', () => {
    const { container } = render(<Toolbar />)
    expect(container.querySelector('aside')).toContainElement(screen.getByTitle('Arrow'))
  })
})

// AC 3 — clicking the arrow button inserts an arrow element centred on the design surface
describe('arrow tool insertion', () => {
  it('adds exactly one arrow element to the canvas store', () => {
    render(<Toolbar />)
    fireEvent.click(screen.getByTitle('Arrow'))
    expect(useCanvasStore.getState().elements).toHaveLength(1)
  })

  it('adds an element of type arrow', () => {
    render(<Toolbar />)
    fireEvent.click(screen.getByTitle('Arrow'))
    expect(useCanvasStore.getState().elements[0].type).toBe('arrow')
  })

  it('places the element horizontally centred on the design surface', () => {
    render(<Toolbar />)
    fireEvent.click(screen.getByTitle('Arrow'))
    const el = useCanvasStore.getState().elements[0]
    expect(el.x).toBe((SURFACE_WIDTH - el.width) / 2)
  })

  it('places the element vertically centred on the design surface', () => {
    render(<Toolbar />)
    fireEvent.click(screen.getByTitle('Arrow'))
    const el = useCanvasStore.getState().elements[0]
    expect(el.y).toBe((SURFACE_HEIGHT - el.height) / 2)
  })

  it('selects the newly added arrow element', () => {
    render(<Toolbar />)
    fireEvent.click(screen.getByTitle('Arrow'))
    const el = useCanvasStore.getState().elements[0]
    expect(useCanvasStore.getState().selectedIds).toContain(el.id)
  })

  // AC 8 — active tool reverts to select after insertion
  it('resets the active tool to select after insertion', () => {
    render(<Toolbar />)
    fireEvent.click(screen.getByTitle('Arrow'))
    expect(useUIStore.getState().activeTool).toBe('select')
  })
})

// AC 7 — multiple arrow elements can be added independently
describe('multiple arrow elements', () => {
  it('adds a new independent element on each click', () => {
    render(<Toolbar />)
    fireEvent.click(screen.getByTitle('Arrow'))
    fireEvent.click(screen.getByTitle('Arrow'))
    fireEvent.click(screen.getByTitle('Arrow'))
    expect(useCanvasStore.getState().elements).toHaveLength(3)
  })

  it('assigns a unique id to each arrow element', () => {
    render(<Toolbar />)
    fireEvent.click(screen.getByTitle('Arrow'))
    fireEvent.click(screen.getByTitle('Arrow'))
    const [a, b] = useCanvasStore.getState().elements
    expect(a.id).not.toBe(b.id)
  })
})

// ---------------------------------------------------------------------------
// Table tool — ACs from 10-toolbar-table-element.md
// ---------------------------------------------------------------------------

// AC 1 — toolbar shows a table button with tooltip "Table"
describe('table tool button appearance', () => {
  it('renders a button with title "Table"', () => {
    render(<Toolbar />)
    expect(screen.getByTitle('Table')).toBeInTheDocument()
  })

  it('the table button contains an SVG icon', () => {
    render(<Toolbar />)
    expect(screen.getByTitle('Table').querySelector('svg')).toBeInTheDocument()
  })

  it('the table button is inside the aside', () => {
    const { container } = render(<Toolbar />)
    expect(container.querySelector('aside')).toContainElement(screen.getByTitle('Table'))
  })
})

// AC 2 — clicking the table button inserts a table element centred on the design surface
describe('table tool insertion', () => {
  it('adds exactly one table element to the canvas store', () => {
    render(<Toolbar />)
    fireEvent.click(screen.getByTitle('Table'))
    expect(useCanvasStore.getState().elements).toHaveLength(1)
  })

  it('adds an element of type table', () => {
    render(<Toolbar />)
    fireEvent.click(screen.getByTitle('Table'))
    expect(useCanvasStore.getState().elements[0].type).toBe('table')
  })

  it('places the element at x:440 (horizontally centred on 1280px surface)', () => {
    render(<Toolbar />)
    fireEvent.click(screen.getByTitle('Table'))
    expect(useCanvasStore.getState().elements[0].x).toBe((SURFACE_WIDTH - 400) / 2)
  })

  it('places the element at y:300 (vertically centred on 720px surface)', () => {
    render(<Toolbar />)
    fireEvent.click(screen.getByTitle('Table'))
    expect(useCanvasStore.getState().elements[0].y).toBe((SURFACE_HEIGHT - 120) / 2)
  })

  it('selects the newly added table element', () => {
    render(<Toolbar />)
    fireEvent.click(screen.getByTitle('Table'))
    const el = useCanvasStore.getState().elements[0]
    expect(useCanvasStore.getState().selectedIds).toContain(el.id)
  })

  // AC 9 — active tool reverts to select after insertion
  it('resets the active tool to select after insertion', () => {
    render(<Toolbar />)
    fireEvent.click(screen.getByTitle('Table'))
    expect(useUIStore.getState().activeTool).toBe('select')
  })

  it('inserts a table with 1 header row and 2 data rows', () => {
    render(<Toolbar />)
    fireEvent.click(screen.getByTitle('Table'))
    const el = useCanvasStore.getState().elements[0] as import('../../types/canvas').TableElement
    expect(el.rows).toHaveLength(3)
    expect(el.rows[0].isHeader).toBe(true)
    expect(el.rows[1].isHeader).toBe(false)
    expect(el.rows[2].isHeader).toBe(false)
  })

  it('inserts a table with 2 columns', () => {
    render(<Toolbar />)
    fireEvent.click(screen.getByTitle('Table'))
    const el = useCanvasStore.getState().elements[0] as import('../../types/canvas').TableElement
    expect(el.columns).toBe(2)
    el.rows.forEach((row) => expect(row.cells).toHaveLength(2))
  })
})

// AC 10 — multiple table elements can be added independently
describe('multiple table elements', () => {
  it('adds a new independent element on each click', () => {
    render(<Toolbar />)
    fireEvent.click(screen.getByTitle('Table'))
    fireEvent.click(screen.getByTitle('Table'))
    fireEvent.click(screen.getByTitle('Table'))
    expect(useCanvasStore.getState().elements).toHaveLength(3)
  })

  it('assigns a unique id to each table element', () => {
    render(<Toolbar />)
    fireEvent.click(screen.getByTitle('Table'))
    fireEvent.click(screen.getByTitle('Table'))
    const [a, b] = useCanvasStore.getState().elements
    expect(a.id).not.toBe(b.id)
  })
})

// AC 9 — multiple text elements can be added independently
describe('multiple elements', () => {
  it('adds a new independent element on each click', () => {
    render(<Toolbar />)
    fireEvent.click(screen.getByTitle('Text'))
    fireEvent.click(screen.getByTitle('Text'))
    fireEvent.click(screen.getByTitle('Text'))
    expect(useCanvasStore.getState().elements).toHaveLength(3)
  })

  it('assigns a unique id to each element', () => {
    render(<Toolbar />)
    fireEvent.click(screen.getByTitle('Text'))
    fireEvent.click(screen.getByTitle('Text'))
    const [a, b] = useCanvasStore.getState().elements
    expect(a.id).not.toBe(b.id)
  })
})
