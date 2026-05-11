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

const DRAG_THRESHOLD = 4

export function TextElement({ element, isSelected, onSelect, onUpdate, onRemove }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const editRef = useRef<HTMLDivElement>(null)
  const dragStartRef = useRef<DragStart | null>(null)
  const isDraggingRef = useRef(false)

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

  const handleBlur = () => {
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
        minHeight: element.height,
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
      }}
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
          style={{ outline: 'none', whiteSpace: 'pre-wrap', minHeight: element.height }}
        />
      ) : (
        <div dangerouslySetInnerHTML={{ __html: element.content }} />
      )}
    </div>
  )
}
