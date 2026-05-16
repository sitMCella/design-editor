import type { CanvasElement } from '../../types/canvas'

function ElementIcon({ type }: { type: CanvasElement['type'] }) {
  if (type === 'text') {
    return <span className="text-xs font-bold text-gray-500">T</span>
  }
  if (type === 'image') {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-gray-500"
        aria-hidden="true"
      >
        <rect x="2" y="3" width="16" height="14" rx="2" />
        <circle cx="7" cy="8" r="1.5" />
        <path d="M2 14 l4-4 4 4 3-3 5 5" />
      </svg>
    )
  }
  if (type === 'arrow') {
    return <span className="text-xs font-bold text-gray-500">→</span>
  }
  if (type === 'table') {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-gray-500"
        aria-hidden="true"
      >
        <rect x="2" y="2" width="16" height="16" rx="1" />
        <line x1="2" y1="7" x2="18" y2="7" />
        <line x1="2" y1="13" x2="18" y2="13" />
        <line x1="10" y1="2" x2="10" y2="18" />
      </svg>
    )
  }
  return null
}

function EyeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <ellipse cx="10" cy="10" rx="7" ry="5" />
      <circle cx="10" cy="10" r="2" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 3l14 14" />
      <path d="M10.5 6.5A6 6 0 0117 10s-3 5-7 5a6.4 6.4 0 01-3.5-1" />
      <path d="M3 10s1.1-1.9 3-3" />
    </svg>
  )
}

function DragHandle() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden="true">
      <circle cx="3" cy="2.5" r="1" />
      <circle cx="7" cy="2.5" r="1" />
      <circle cx="3" cy="7" r="1" />
      <circle cx="7" cy="7" r="1" />
      <circle cx="3" cy="11.5" r="1" />
      <circle cx="7" cy="11.5" r="1" />
    </svg>
  )
}

type Props = {
  element: CanvasElement
  label: string
  isSelected: boolean
  onSelect: (e: React.MouseEvent) => void
  onToggleVisibility: () => void
  onDragHandleMouseDown: (e: React.MouseEvent) => void
}

export function LayerRow({
  element,
  label,
  isSelected,
  onSelect,
  onToggleVisibility,
  onDragHandleMouseDown,
}: Props) {
  const isHidden = !!element.hidden

  return (
    <div
      className={`group flex h-9 cursor-pointer items-center border-b border-gray-100 px-1 ${
        isHidden ? 'opacity-50' : ''
      } ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
      onClick={onSelect}
    >
      {/* Drag handle — only visible on hover */}
      <div
        className="mr-1 flex cursor-grab items-center justify-center px-0.5 text-gray-300 opacity-0 group-hover:opacity-100"
        onMouseDown={(e) => {
          e.stopPropagation()
          onDragHandleMouseDown(e)
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <DragHandle />
      </div>

      {/* Element type icon */}
      <div className="mr-1.5 flex w-4 flex-shrink-0 items-center justify-center">
        <ElementIcon type={element.type} />
      </div>

      {/* Label */}
      <span
        className={`flex-1 truncate text-sm ${
          isSelected ? 'text-blue-700' : 'text-gray-700'
        }`}
      >
        {label}
      </span>

      {/* Visibility toggle */}
      <button
        className="ml-1 flex flex-shrink-0 items-center justify-center rounded p-0.5 text-gray-400 hover:text-gray-700"
        onClick={(e) => {
          e.stopPropagation()
          onToggleVisibility()
        }}
        title={isHidden ? 'Show element' : 'Hide element'}
        aria-label={isHidden ? 'Show element' : 'Hide element'}
      >
        {isHidden ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  )
}
