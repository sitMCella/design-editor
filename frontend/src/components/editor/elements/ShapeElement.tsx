import type { ShapeElement as ShapeElementType } from '../../../types/canvas'

type Props = {
  element: ShapeElementType
  isSelected: boolean
  onSelect: (e: React.MouseEvent) => void
  onDragEnd?: (delta: { x: number; y: number }) => void
}

export function ShapeElement({ element, isSelected, onSelect, onDragEnd }: Props) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect(e)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    if (!isSelected) return

    const startX = e.clientX
    const startY = e.clientY
    let isDragging = false

    const onMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (!isDragging && Math.sqrt(dx * dx + dy * dy) >= 4) {
        isDragging = true
        document.body.style.cursor = 'grabbing'
      }
    }

    const onMouseUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''

      if (isDragging) {
        const deltaX = ev.clientX - startX
        const deltaY = ev.clientY - startY
        onDragEnd?.({ x: deltaX, y: deltaY })
        // Prevent the click from firing after a drag
        ev.stopPropagation()
      }
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    // Suppress the click event after dragging
    const suppressClick = (ev: MouseEvent) => {
      if (isDragging) ev.stopPropagation()
      window.removeEventListener('click', suppressClick, true)
    }
    window.addEventListener('click', suppressClick, true)
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        backgroundColor: element.fill,
        border:
          element.strokeWidth > 0
            ? `${element.strokeWidth}px solid ${element.stroke}`
            : 'none',
        outline: isSelected ? '2px solid #3B82F6' : 'none',
        cursor: isSelected ? 'grab' : 'default',
        boxSizing: 'border-box',
        opacity: element.opacity,
      }}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
    />
  )
}
