import { useEffect, useRef, useState } from 'react'
import type { TextElement as TextElementType } from '../../../types/canvas'
import { SURFACE_WIDTH, SURFACE_HEIGHT } from '../DesignSurface'

type Props = {
  element: TextElementType
  isSelected: boolean
  onSelect: (e: React.MouseEvent) => void
  onUpdate: (patch: Partial<TextElementType>) => void
  onRemove: () => void
}

type DragStart = {
  mouseX: number
  mouseY: number
  elementX: number
  elementY: number
}

type Handle = 'tl' | 'tr' | 'bl' | 'br'

const DRAG_THRESHOLD = 4
const MIN_WIDTH = 40
const MIN_HEIGHT = 20

const handleStyles: Record<Handle, React.CSSProperties> = {
  tl: { top: -5, left: -5, cursor: 'nwse-resize' },
  tr: { top: -5, right: -5, cursor: 'nesw-resize' },
  bl: { bottom: -5, left: -5, cursor: 'nesw-resize' },
  br: { bottom: -5, right: -5, cursor: 'nwse-resize' },
}

export function TextElement({ element, isSelected, onSelect, onUpdate, onRemove }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const editRef = useRef<HTMLDivElement>(null)
  const dragStartRef = useRef<DragStart | null>(null)
  const isDraggingRef = useRef(false)
  const resizeStartRef = useRef<{
    mouseX: number
    mouseY: number
    elementX: number
    elementY: number
    elementW: number
    elementH: number
    handle: Handle
  } | null>(null)

  useEffect(() => {
    if (!isEditing || !editRef.current) return
    editRef.current.innerHTML = element.content
    editRef.current.focus()
    const range = document.createRange()
    range.selectNodeContents(editRef.current)
    range.collapse(false)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing])

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isDraggingRef.current) return
    if (!isEditing) onSelect(e)
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditing(true)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing || !isSelected) return
    e.preventDefault()
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      elementX: element.x,
      elementY: element.y,
    }
    isDraggingRef.current = false

    const handleMouseMove = (me: MouseEvent) => {
      if (!dragStartRef.current) return
      const dx = me.clientX - dragStartRef.current.mouseX
      const dy = me.clientY - dragStartRef.current.mouseY
      if (!isDraggingRef.current && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      isDraggingRef.current = true
      document.body.style.cursor = 'grabbing'

      const newX = Math.max(
        0,
        Math.min(SURFACE_WIDTH - element.width, dragStartRef.current.elementX + dx)
      )
      const newY = Math.max(
        0,
        Math.min(SURFACE_HEIGHT - element.height, dragStartRef.current.elementY + dy)
      )
      onUpdate({ x: newX, y: newY })
    }

    const handleMouseUp = () => {
      document.body.style.cursor = ''
      dragStartRef.current = null
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      // Reset isDragging on next tick so the click handler can check it
      setTimeout(() => {
        isDraggingRef.current = false
      }, 0)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const handleResizeMouseDown = (e: React.MouseEvent, handle: Handle) => {
    e.preventDefault()
    e.stopPropagation()
    resizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      elementX: element.x,
      elementY: element.y,
      elementW: element.width,
      elementH: element.height,
      handle,
    }

    const onMouseMove = (me: MouseEvent) => {
      const s = resizeStartRef.current
      if (!s) return
      const dx = me.clientX - s.mouseX
      const dy = me.clientY - s.mouseY

      let x = s.elementX,
        y = s.elementY
      let w = s.elementW,
        h = s.elementH

      if (handle === 'tl') {
        x = s.elementX + dx
        y = s.elementY + dy
        w = s.elementW - dx
        h = s.elementH - dy
      }
      if (handle === 'tr') {
        y = s.elementY + dy
        w = s.elementW + dx
        h = s.elementH - dy
      }
      if (handle === 'bl') {
        x = s.elementX + dx
        w = s.elementW - dx
        h = s.elementH + dy
      }
      if (handle === 'br') {
        w = s.elementW + dx
        h = s.elementH + dy
      }

      // Enforce minimum size
      if (w < MIN_WIDTH) {
        w = MIN_WIDTH
        if (handle === 'tl' || handle === 'bl') x = s.elementX + s.elementW - MIN_WIDTH
      }
      if (h < MIN_HEIGHT) {
        h = MIN_HEIGHT
        if (handle === 'tl' || handle === 'tr') y = s.elementY + s.elementH - MIN_HEIGHT
      }

      // Clamp to surface bounds
      x = Math.max(0, x)
      y = Math.max(0, y)
      w = Math.min(w, SURFACE_WIDTH - x)
      h = Math.min(h, SURFACE_HEIGHT - y)

      onUpdate({ x, y, width: w, height: h })
    }

    const onMouseUp = () => {
      resizeStartRef.current = null
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    // Don't exit edit mode when focus moves to the contextual toolbar (e.g. colour picker).
    // The toolbar will re-focus the contentEditable after applying the command.
    if (
      e.relatedTarget instanceof HTMLElement &&
      e.relatedTarget.closest('[data-testid="contextual-toolbar"]')
    ) {
      return
    }
    const html = editRef.current?.innerHTML ?? ''
    const text = editRef.current?.textContent?.trim() ?? ''
    setIsEditing(false)
    if (!text) {
      onRemove()
    } else {
      onUpdate({ content: html })
    }
  }

  const handleInput = () => {
    onUpdate({ content: editRef.current?.innerHTML ?? '' })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setIsEditing(false)
    }
  }

  const outline = !isSelected ? 'none' : isEditing ? '2px dashed #3B82F6' : '2px solid #3B82F6'
  const cursor = isEditing ? 'text' : isSelected ? 'grab' : 'default'

  return (
    <div
      style={{
        position: 'absolute',
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
        opacity: element.opacity,
        fontSize: element.fontSize,
        fontFamily: element.fontFamily,
        fontWeight: element.fontWeight,
        fontStyle: element.fontStyle,
        color: element.color,
        textAlign: element.align,
        outline,
        outlineOffset: '2px',
        padding: '2px 4px',
        boxSizing: 'border-box',
        cursor,
        userSelect: isEditing ? 'text' : 'none',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        overflow: 'hidden',
      }}
      data-testid="text-element"
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
    >
      {isEditing ? (
        <div
          ref={editRef}
          contentEditable
          suppressContentEditableWarning
          onBlur={handleBlur}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          style={{ outline: 'none', whiteSpace: 'pre-wrap', wordBreak: 'break-word', height: '100%' }}
        />
      ) : (
        <div dangerouslySetInnerHTML={{ __html: element.content }} />
      )}

      {/* Corner resize handles — hidden in editing mode */}
      {isSelected &&
        !isEditing &&
        (['tl', 'tr', 'bl', 'br'] as Handle[]).map((h) => (
          <div
            key={h}
            data-testid={`resize-handle-${h}`}
            style={{
              position: 'absolute',
              width: 10,
              height: 10,
              background: '#3B82F6',
              borderRadius: 2,
              ...handleStyles[h],
            }}
            onMouseDown={(e) => handleResizeMouseDown(e, h)}
          />
        ))}
    </div>
  )
}
