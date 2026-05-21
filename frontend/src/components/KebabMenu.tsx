import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
  onRename: () => void
}

export function KebabMenu({ isOpen, onOpen, onClose, onRename }: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const posRef = useRef<{ top: number; right: number }>({ top: 0, right: 0 })

  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node
      if (buttonRef.current?.contains(target) || dropdownRef.current?.contains(target)) return
      onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleMouseDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [isOpen, onClose])

  function handleButtonClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (isOpen) {
      onClose()
    } else {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (rect) {
        posRef.current = {
          top: rect.bottom + 4,
          right: window.innerWidth - rect.right,
        }
      }
      onOpen()
    }
  }

  function handleRename(e: React.MouseEvent) {
    e.stopPropagation()
    onRename()
  }

  return (
    <>
      <button
        ref={buttonRef}
        aria-label="Project options"
        onClick={handleButtonClick}
        className="ml-1 flex w-5 flex-shrink-0 items-center justify-center self-stretch rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600"
      >
        ⋮
      </button>
      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: posRef.current.top,
              right: posRef.current.right,
              zIndex: 50,
              width: 128,
            }}
            className="rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          >
            <button
              onClick={handleRename}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-gray-500"
                aria-hidden="true"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Rename
            </button>
          </div>,
          document.body
        )}
    </>
  )
}
