import { useRef } from 'react'
import { flushSync } from 'react-dom'
import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useCanvasStore } from '../../stores/canvasStore'
import { useUIStore } from '../../stores/uiStore'
import type { TextElement, ImageElement, ArrowElement, TableElement, ShapeElement } from '../../types/canvas'
import { fetchAssetFromUrl } from '../../api/assets'

const DEFAULT_ROW_HEIGHT = 40
const DEFAULT_COL_WIDTH = 120

const FONT_FAMILIES = [
  { label: 'Inter', value: 'Inter, sans-serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: 'Times New Roman, serif' },
  { label: 'Courier New', value: 'Courier New, monospace' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
]

// ---------------------------------------------------------------------------
// Text toolbar
// ---------------------------------------------------------------------------

function TextToolbar({
  element,
  update,
}: {
  element: TextElement
  update: (patch: Partial<TextElement>) => void
}) {
  const savedRangeRef = useRef<Range | null>(null)

  const saveSelection = () => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) {
      savedRangeRef.current = null
      return
    }
    const range = sel.getRangeAt(0)
    const node = range.commonAncestorContainer
    const el = node.nodeType === Node.TEXT_NODE ? (node as Text).parentElement : (node as Element)
    savedRangeRef.current = el?.closest('[contenteditable]') ? range.cloneRange() : null
  }

  const execInline = (command: string, value?: string): boolean => {
    if (document.activeElement instanceof HTMLElement && document.activeElement.isContentEditable) {
      document.execCommand(command, false, value)
      return true
    }
    if (savedRangeRef.current) {
      const node = savedRangeRef.current.commonAncestorContainer
      const el = node.nodeType === Node.TEXT_NODE ? (node as Text).parentElement : (node as Element)
      const editable = el?.closest<HTMLElement>('[contenteditable]')
      if (editable) {
        editable.focus()
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(savedRangeRef.current)
        document.execCommand(command, false, value)
        savedRangeRef.current = null
        return true
      }
    }
    return false
  }

  const preventBlurIfEditing = (e: React.MouseEvent) => {
    if (document.activeElement instanceof HTMLElement && document.activeElement.isContentEditable) {
      e.preventDefault()
    }
  }

  return (
    <>
      <select
        aria-label="Font family"
        value={element.fontFamily}
        onChange={(e) => update({ fontFamily: e.target.value })}
        className="rounded border border-gray-200 px-1 py-0.5 text-sm"
      >
        {FONT_FAMILIES.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-0.5">
        <button
          aria-label="Decrease font size"
          onClick={() => update({ fontSize: Math.max(8, element.fontSize - 1) })}
          className="flex h-6 w-6 items-center justify-center rounded text-sm hover:bg-gray-100"
        >
          −
        </button>
        <input
          aria-label="Font size"
          type="number"
          min={8}
          max={200}
          value={element.fontSize}
          onChange={(e) => update({ fontSize: Math.max(8, Math.min(200, Number(e.target.value))) })}
          className="w-10 rounded border border-gray-200 px-1 py-0.5 text-center text-sm"
        />
        <button
          aria-label="Increase font size"
          onClick={() => update({ fontSize: Math.min(200, element.fontSize + 1) })}
          className="flex h-6 w-6 items-center justify-center rounded text-sm hover:bg-gray-100"
        >
          +
        </button>
      </div>

      <button
        aria-label="Bold"
        aria-pressed={element.fontWeight === 'bold'}
        onMouseDown={preventBlurIfEditing}
        onClick={() => {
          if (!execInline('bold')) {
            update({ fontWeight: element.fontWeight === 'bold' ? 'normal' : 'bold' })
          }
        }}
        className={`flex h-6 w-6 items-center justify-center rounded text-sm font-bold ${
          element.fontWeight === 'bold' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
        }`}
      >
        B
      </button>

      <button
        aria-label="Italic"
        aria-pressed={element.fontStyle === 'italic'}
        onMouseDown={preventBlurIfEditing}
        onClick={() => {
          if (!execInline('italic')) {
            update({ fontStyle: element.fontStyle === 'italic' ? 'normal' : 'italic' })
          }
        }}
        className={`flex h-6 w-6 items-center justify-center rounded text-sm italic ${
          element.fontStyle === 'italic' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
        }`}
      >
        I
      </button>

      <input
        aria-label="Text color"
        type="color"
        value={element.color}
        onMouseDown={saveSelection}
        onChange={(e) => {
          if (!execInline('foreColor', e.target.value)) {
            update({ color: e.target.value })
          }
        }}
        className="h-6 w-6 cursor-pointer rounded border border-gray-200 p-0.5"
      />

      <div className="flex items-center gap-0.5">
        {(['left', 'center', 'right'] as const).map((align) => (
          <button
            key={align}
            aria-label={`Align ${align}`}
            aria-pressed={element.align === align}
            onClick={() => update({ align })}
            className={`flex h-6 w-6 items-center justify-center rounded text-xs ${
              element.align === align ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
            }`}
          >
            {align === 'left' ? '≡' : align === 'center' ? '☰' : '≡'}
          </button>
        ))}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Image toolbar
// ---------------------------------------------------------------------------

function ImageToolbar({
  element,
  update,
}: {
  element: ImageElement
  update: (patch: Partial<ImageElement>) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isDataUrl = element.src.startsWith('data:')
  const [urlInput, setUrlInput] = useState(isDataUrl ? '' : element.src)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    setUrlInput(isDataUrl ? '' : element.src)
  }, [element.src, isDataUrl])

  const { mutate: fetchAsset, isPending: isFetching } = useMutation({
    mutationFn: (url: string) => fetchAssetFromUrl(url),
    onSuccess: (asset) => {
      update({ src: asset.url })
      setFetchError(null)
    },
    onError: (err) => {
      setFetchError(err instanceof Error ? err.message : 'Failed to fetch image')
    },
  })

  const applyUrl = (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed || trimmed === element.src) return
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      fetchAsset(trimmed)
    } else {
      update({ src: trimmed })
    }
  }

  const handleUrlBlur = () => {
    if (isDataUrl) return
    applyUrl(urlInput)
  }

  const handleUrlKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isDataUrl) return
    if (e.key === 'Enter') {
      applyUrl(urlInput)
      ;(e.target as HTMLInputElement).blur()
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => update({ src: reader.result as string })
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <>
      <input
        aria-label="Image URL"
        type="text"
        placeholder="Paste image URL…"
        value={isFetching ? 'Downloading…' : urlInput}
        readOnly={isDataUrl || isFetching}
        onChange={(e) => setUrlInput(e.target.value)}
        onBlur={handleUrlBlur}
        onKeyDown={handleUrlKeyDown}
        className="h-6 w-52 rounded border border-gray-200 px-2 text-sm placeholder-gray-400 disabled:bg-gray-50"
      />
      {isDataUrl && <span className="text-xs text-gray-400">Uploaded file</span>}
      {fetchError && <span className="text-xs text-red-500">{fetchError}</span>}

      <button
        aria-label="Upload image"
        onClick={() => fileInputRef.current?.click()}
        className="flex h-6 items-center gap-1 rounded border border-gray-200 px-2 text-xs hover:bg-gray-100"
      >
        Upload
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        aria-label="File picker"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="mx-1 h-4 w-px bg-gray-200" />

      <select
        aria-label="Object fit"
        value={element.objectFit}
        onChange={(e) => update({ objectFit: e.target.value as ImageElement['objectFit'] })}
        className="rounded border border-gray-200 px-1 py-0.5 text-sm"
      >
        <option value="cover">Cover</option>
        <option value="contain">Contain</option>
        <option value="fill">Fill</option>
      </select>
    </>
  )
}

// ---------------------------------------------------------------------------
// Arrow toolbar
// ---------------------------------------------------------------------------

const ARROWHEAD_OPTIONS: Array<{ value: ArrowElement['arrowHead']; label: string; title: string }> =
  [
    { value: 'none', label: '—', title: 'No arrowheads' },
    { value: 'end', label: '→', title: 'Arrowhead at end' },
    { value: 'start', label: '←', title: 'Arrowhead at start' },
    { value: 'both', label: '↔', title: 'Arrowheads at both ends' },
  ]

function ArrowToolbar({
  element,
  update,
}: {
  element: ArrowElement
  update: (patch: Partial<ArrowElement>) => void
}) {
  const colorRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const el = colorRef.current
    if (!el) return
    const handler = (e: Event) => {
      flushSync(() => {
        update({ stroke: (e.target as HTMLInputElement).value })
      })
    }
    el.addEventListener('input', handler)
    el.addEventListener('change', handler)
    return () => {
      el.removeEventListener('input', handler)
      el.removeEventListener('change', handler)
    }
  }, [update])

  return (
    <>
      <div className="flex items-center gap-0.5">
        {ARROWHEAD_OPTIONS.map(({ value, label, title }) => (
          <button
            key={value}
            aria-label={title}
            aria-pressed={element.arrowHead === value}
            onClick={() => update({ arrowHead: value })}
            className={`flex h-6 w-6 items-center justify-center rounded text-sm ${
              element.arrowHead === value ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mx-1 h-4 w-px bg-gray-200" />

      <div className="flex items-center gap-0.5">
        <button
          aria-label="Decrease stroke width"
          onClick={() => update({ strokeWidth: Math.max(1, element.strokeWidth - 1) })}
          className="flex h-6 w-6 items-center justify-center rounded text-sm hover:bg-gray-100"
        >
          −
        </button>
        <input
          aria-label="Stroke width"
          type="number"
          min={1}
          max={20}
          value={element.strokeWidth}
          onChange={(e) =>
            update({ strokeWidth: Math.max(1, Math.min(20, Number(e.target.value))) })
          }
          className="w-10 rounded border border-gray-200 px-1 py-0.5 text-center text-sm"
        />
        <button
          aria-label="Increase stroke width"
          onClick={() => update({ strokeWidth: Math.min(20, element.strokeWidth + 1) })}
          className="flex h-6 w-6 items-center justify-center rounded text-sm hover:bg-gray-100"
        >
          +
        </button>
      </div>

      <div className="mx-1 h-4 w-px bg-gray-200" />

      <input
        ref={colorRef}
        aria-label="Stroke color"
        type="color"
        value={element.stroke}
        className="h-6 w-6 cursor-pointer rounded border border-gray-200 p-0.5"
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Table toolbar
// ---------------------------------------------------------------------------

function TableToolbar({
  element,
  update,
}: {
  element: TableElement
  update: (patch: Partial<TableElement>) => void
}) {
  const columnWidths: number[] =
    element.columnWidths ?? Array(element.columns).fill(Math.round(element.width / element.columns))

  const effectiveRows = element.rows.map((r) => ({
    ...r,
    height: r.height ?? Math.round(element.height / element.rows.length),
  }))

  const dataRowCount = effectiveRows.filter((r) => !r.isHeader).length

  const addRow = () => {
    const newRow = {
      isHeader: false,
      height: DEFAULT_ROW_HEIGHT,
      cells: Array(element.columns).fill(''),
    }
    update({
      rows: [...effectiveRows, newRow],
      height: element.height + DEFAULT_ROW_HEIGHT,
    })
  }

  const removeRow = () => {
    const lastRow = effectiveRows[effectiveRows.length - 1]
    update({
      rows: effectiveRows.slice(0, -1),
      height: element.height - lastRow.height,
    })
  }

  const addColumn = () => {
    const newRows = effectiveRows.map((r) => ({ ...r, cells: [...r.cells, ''] }))
    update({
      columns: element.columns + 1,
      columnWidths: [...columnWidths, DEFAULT_COL_WIDTH],
      rows: newRows,
      width: element.width + DEFAULT_COL_WIDTH,
    })
  }

  const removeColumn = () => {
    const removedWidth = columnWidths[columnWidths.length - 1]
    update({
      columns: element.columns - 1,
      columnWidths: columnWidths.slice(0, -1),
      rows: effectiveRows.map((r) => ({ ...r, cells: r.cells.slice(0, -1) })),
      width: element.width - removedWidth,
    })
  }

  return (
    <>
      <button
        aria-label="Add row"
        onClick={addRow}
        className="flex h-6 items-center gap-1 rounded border border-gray-200 px-2 text-xs hover:bg-gray-100"
      >
        + Row
      </button>
      <button
        aria-label="Remove row"
        onClick={removeRow}
        disabled={dataRowCount <= 1}
        className="flex h-6 items-center gap-1 rounded border border-gray-200 px-2 text-xs hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        − Row
      </button>

      <div className="mx-1 h-4 w-px bg-gray-200" />

      <button
        aria-label="Add column"
        onClick={addColumn}
        className="flex h-6 items-center gap-1 rounded border border-gray-200 px-2 text-xs hover:bg-gray-100"
      >
        + Col
      </button>
      <button
        aria-label="Remove column"
        onClick={removeColumn}
        disabled={element.columns <= 1}
        className="flex h-6 items-center gap-1 rounded border border-gray-200 px-2 text-xs hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        − Col
      </button>
    </>
  )
}

// ---------------------------------------------------------------------------
// Shape toolbar
// ---------------------------------------------------------------------------

const SHAPE_VARIANTS: Array<{ value: ShapeElement['shape']; label: string; title: string }> = [
  { value: 'rect', label: '■', title: 'Rectangle' },
  { value: 'ellipse', label: '●', title: 'Ellipse' },
  { value: 'triangle', label: '▲', title: 'Triangle' },
]

function CheckerboardSwatch({ size = 20 }: { size?: number }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: 2,
        backgroundImage:
          'repeating-linear-gradient(45deg,#d1d5db 25%,transparent 25%),' +
          'repeating-linear-gradient(-45deg,#d1d5db 25%,transparent 25%),' +
          'repeating-linear-gradient(45deg,transparent 75%,#d1d5db 75%),' +
          'repeating-linear-gradient(-45deg,transparent 75%,#d1d5db 75%)',
        backgroundSize: '8px 8px',
        backgroundPosition: '0 0,0 4px,4px -4px,-4px 0',
        backgroundColor: '#fff',
        border: '1px solid #e5e7eb',
      }}
    />
  )
}

function ColourControl({
  label,
  value,
  onChange,
  lastNonTransparentRef,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  lastNonTransparentRef: React.MutableRefObject<string>
}) {
  const colorInputRef = useRef<HTMLInputElement>(null)

  const isTransparent = value === 'transparent'

  const toggleTransparent = () => {
    if (isTransparent) {
      onChange(lastNonTransparentRef.current)
    } else {
      lastNonTransparentRef.current = value
      onChange('transparent')
    }
  }

  const handlePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    lastNonTransparentRef.current = e.target.value
    onChange(e.target.value)
  }

  return (
    <div className="flex items-center gap-0.5">
      <button
        aria-label={`${label} colour picker`}
        title={label}
        onClick={() => !isTransparent && colorInputRef.current?.click()}
        className="relative flex h-5 w-5 items-center justify-center overflow-hidden rounded-sm border border-gray-200"
        style={{ cursor: isTransparent ? 'default' : 'pointer' }}
      >
        {isTransparent ? (
          <CheckerboardSwatch size={18} />
        ) : (
          <div style={{ width: 18, height: 18, backgroundColor: value, borderRadius: 1 }} />
        )}
        <input
          ref={colorInputRef}
          aria-label={label}
          type="color"
          value={isTransparent ? '#000000' : value}
          onChange={handlePickerChange}
          tabIndex={-1}
          style={{
            position: 'absolute',
            opacity: 0,
            width: 0,
            height: 0,
            pointerEvents: 'none',
          }}
        />
      </button>
      <button
        aria-label={`Toggle ${label} transparency`}
        title={isTransparent ? `Restore ${label}` : `Remove ${label}`}
        onClick={toggleTransparent}
        className={`flex h-5 w-5 items-center justify-center rounded text-xs ${isTransparent ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
      >
        ⊘
      </button>
    </div>
  )
}

function ShapeToolbar({
  elements,
  update,
  showVariant,
}: {
  elements: ShapeElement[]
  update: (patch: Partial<ShapeElement>) => void
  showVariant: boolean
}) {
  const first = elements[0]
  const lastFillRef = useRef(first.fill === 'transparent' ? '#3B82F6' : first.fill)
  const lastStrokeRef = useRef(first.stroke === 'transparent' ? '#111827' : first.stroke)

  const strokeDisabled = first.strokeWidth === 0

  return (
    <>
      {showVariant && (
        <div className="flex items-center gap-0.5">
          {SHAPE_VARIANTS.map(({ value, label, title }) => (
            <button
              key={value}
              aria-label={title}
              aria-pressed={first.shape === value}
              onClick={() => update({ shape: value })}
              className={`flex h-6 w-6 items-center justify-center rounded text-sm ${
                first.shape === value ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="mx-1 h-4 w-px bg-gray-200" />

      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500">Fill</span>
        <ColourControl
          label="Fill"
          value={first.fill}
          onChange={(v) => update({ fill: v })}
          lastNonTransparentRef={lastFillRef}
        />
      </div>

      <div className="mx-1 h-4 w-px bg-gray-200" />

      <div className={`flex items-center gap-1 ${strokeDisabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <span className="text-xs text-gray-500">Stroke</span>
        <ColourControl
          label="Stroke"
          value={first.stroke}
          onChange={(v) => update({ stroke: v })}
          lastNonTransparentRef={lastStrokeRef}
        />
      </div>

      <div className="mx-1 h-4 w-px bg-gray-200" />

      <div className="flex items-center gap-0.5">
        <button
          aria-label="Decrease stroke width"
          onClick={() => update({ strokeWidth: Math.max(0, first.strokeWidth - 1) })}
          className="flex h-6 w-6 items-center justify-center rounded text-sm hover:bg-gray-100"
        >
          −
        </button>
        <input
          aria-label="Stroke width"
          type="number"
          min={0}
          max={20}
          value={first.strokeWidth}
          onChange={(e) =>
            update({ strokeWidth: Math.max(0, Math.min(20, Number(e.target.value))) })
          }
          className="w-10 rounded border border-gray-200 px-1 py-0.5 text-center text-sm"
        />
        <button
          aria-label="Increase stroke width"
          onClick={() => update({ strokeWidth: Math.min(20, first.strokeWidth + 1) })}
          className="flex h-6 w-6 items-center justify-center rounded text-sm hover:bg-gray-100"
        >
          +
        </button>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Trash icon
// ---------------------------------------------------------------------------

function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Pin icon
// ---------------------------------------------------------------------------

function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

type Snapshot = TextElement | ImageElement | ArrowElement | TableElement | ShapeElement

export function ContextualToolbar() {
  const elements = useCanvasStore((s) => s.elements)
  const selectedIds = useCanvasStore((s) => s.selectedIds)
  const updateElement = useCanvasStore((s) => s.updateElement)
  const removeElements = useCanvasStore((s) => s.removeElements)
  const isToolbarPinned = useUIStore((s) => s.isToolbarPinned)
  const toggleToolbarPin = useUIStore((s) => s.toggleToolbarPin)

  // Snapshot of the last valid (non-empty, non-mixed-type) selected element.
  // Updated synchronously during render so dimmed state shows correct content
  // on the same render cycle that the selection is cleared.
  const snapshotRef = useRef<Snapshot | null>(null)

  const selectedElements = selectedIds
    .map((id) => elements.find((e) => e.id === id))
    .filter(Boolean) as Snapshot[]

  const firstType = selectedElements[0]?.type
  const isLive =
    selectedElements.length > 0 && selectedElements.every((el) => el.type === firstType)
  const refElement = isLive ? selectedElements[0] : null

  // Keep snapshot in sync with the live element (synchronous ref update, no re-render cost)
  if (refElement) {
    snapshotRef.current = refElement
  }

  const isDimmed = isToolbarPinned && !isLive
  const displayElement = isLive ? refElement : snapshotRef.current

  // Not pinned and no live selection → hidden; no layout space consumed
  if (!isToolbarPinned && !isLive) return null

  const updateAll = (patch: Partial<Snapshot>) => {
    selectedIds.forEach((id) => updateElement(id, patch as Parameters<typeof updateElement>[1]))
  }

  let controls: React.ReactNode = null
  if (displayElement?.type === 'text') {
    controls = (
      <TextToolbar element={displayElement} update={(p) => updateAll(p as Partial<Snapshot>)} />
    )
  } else if (displayElement?.type === 'image') {
    controls = (
      <ImageToolbar element={displayElement} update={(p) => updateAll(p as Partial<Snapshot>)} />
    )
  } else if (displayElement?.type === 'arrow') {
    controls = (
      <ArrowToolbar element={displayElement} update={(p) => updateAll(p as Partial<Snapshot>)} />
    )
  } else if (displayElement?.type === 'table') {
    controls = (
      <TableToolbar element={displayElement} update={(p) => updateAll(p as Partial<Snapshot>)} />
    )
  } else if (displayElement?.type === 'shape') {
    const shapeEls = selectedElements.filter((el): el is ShapeElement => el.type === 'shape')
    const allSameVariant = shapeEls.every((el) => el.shape === shapeEls[0].shape)
    controls = (
      <ShapeToolbar
        elements={shapeEls.length > 0 ? shapeEls : [displayElement as ShapeElement]}
        update={(p) => updateAll(p as Partial<Snapshot>)}
        showVariant={allSameVariant}
      />
    )
  }

  return (
    <div
      data-testid="contextual-toolbar"
      className="relative flex h-10 items-center gap-2 border-b bg-white px-3"
    >
      {/* Transparent overlay that blocks pointer events on the controls area when dimmed.
          right: 2.5rem leaves the pin button interactive at all times. */}
      {isDimmed && (
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-0"
          style={{ right: '2.5rem', pointerEvents: 'all' }}
        />
      )}

      <div className={`flex flex-1 items-center gap-2 ${isDimmed ? 'opacity-40' : ''}`}>
        {controls}
        <div className="ml-auto flex items-center border-l border-gray-200 pl-2">
          <button
            aria-label="Delete"
            title="Delete"
            onClick={() => {
              if (selectedIds.length > 0) removeElements(selectedIds)
            }}
            className="flex h-6 w-6 items-center justify-center rounded text-gray-500 hover:bg-red-50 hover:text-red-500"
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      <div className="flex items-center border-l border-gray-200 pl-2">
        {isToolbarPinned ? (
          <button
            aria-label="Unpin toolbar"
            title="Unpin toolbar"
            onClick={toggleToolbarPin}
            className="flex h-6 w-6 items-center justify-center rounded bg-blue-50 text-blue-500"
          >
            <PinIcon />
          </button>
        ) : (
          <button
            aria-label="Pin toolbar"
            title="Pin toolbar"
            onClick={toggleToolbarPin}
            className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-100"
          >
            <PinIcon />
          </button>
        )}
      </div>
    </div>
  )
}
