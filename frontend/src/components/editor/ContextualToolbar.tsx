import { useRef, useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useCanvasStore } from '../../stores/canvasStore'
import type { TextElement, ImageElement } from '../../types/canvas'
import { fetchAssetFromUrl } from '../../api/assets'

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
    // contentEditable is currently focused — selection is preserved (bold/italic use preventDefault)
    if (document.activeElement instanceof HTMLElement && document.activeElement.isContentEditable) {
      document.execCommand(command, false, value)
      return true
    }
    // Selection was saved before the color picker stole focus
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
    // Reset so the same file can be re-selected if needed
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
// Shell
// ---------------------------------------------------------------------------

export function ContextualToolbar() {
  const elements = useCanvasStore((s) => s.elements)
  const selectedIds = useCanvasStore((s) => s.selectedIds)
  const updateElement = useCanvasStore((s) => s.updateElement)

  const selectedId = selectedIds[0]
  const found = elements.find((e) => e.id === selectedId)

  if (!found) return null

  if (found.type === 'text') {
    const element = found as TextElement
    return (
      <div
        data-testid="contextual-toolbar"
        className="flex h-10 items-center gap-2 border-b bg-white px-3"
      >
        <TextToolbar element={element} update={(patch) => updateElement(selectedId, patch)} />
      </div>
    )
  }

  if (found.type === 'image') {
    const element = found as ImageElement
    return (
      <div
        data-testid="contextual-toolbar"
        className="flex h-10 items-center gap-2 border-b bg-white px-3"
      >
        <ImageToolbar element={element} update={(patch) => updateElement(selectedId, patch)} />
      </div>
    )
  }

  return null
}
