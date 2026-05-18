import { useEffect, useRef } from 'react'
import { useCanvasStore } from '../../stores/canvasStore'

const PRESETS = [
  '#F3F4F6',
  '#FFFFFF',
  '#E5E7EB',
  '#64748B',
  '#111827',
  '#BAE6FD',
  '#BFDBFE',
  '#C7D2FE',
  '#E9D5FF',
  '#FECDD3',
  '#FDE68A',
  '#A7F3D0',
]

type Props = {
  onClose: () => void
}

export function BackgroundPicker({ onClose }: Props) {
  const backgroundColor = useCanvasStore((s) => s.backgroundColor)
  const setBackgroundColor = useCanvasStore((s) => s.setBackgroundColor)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const isActive = (color: string) => backgroundColor === color

  return (
    <div
      ref={popoverRef}
      className="absolute right-0 top-full z-50 mt-1 w-60 rounded-lg border border-gray-200 bg-white p-3 shadow-lg"
      role="dialog"
      aria-label="Canvas background colour picker"
    >
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-gray-500">
        Canvas background
      </p>

      <div className="mb-2 grid grid-cols-6 gap-1.5">
        {PRESETS.map((color) => (
          <button
            key={color}
            type="button"
            title={color}
            aria-label={`Set background to ${color}`}
            onClick={() => setBackgroundColor(color)}
            className="h-6 w-6 rounded-full border border-gray-200 focus:outline-none"
            style={{
              backgroundColor: color,
              boxShadow: isActive(color) ? '0 0 0 2px #ffffff, 0 0 0 4px #3B82F6' : undefined,
            }}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setBackgroundColor('transparent')}
        className="mb-2 flex w-full items-center gap-2 rounded px-1 py-1 hover:bg-gray-50"
        aria-label="Set background to transparent"
      >
        <span
          className="inline-block h-6 w-6 flex-shrink-0 rounded-full border border-gray-200"
          style={{
            backgroundImage: [
              'repeating-linear-gradient(45deg, #d1d5db 25%, transparent 25%)',
              'repeating-linear-gradient(-45deg, #d1d5db 25%, transparent 25%)',
              'repeating-linear-gradient(45deg, transparent 75%, #d1d5db 75%)',
              'repeating-linear-gradient(-45deg, transparent 75%, #d1d5db 75%)',
            ].join(', '),
            backgroundSize: '8px 8px',
            backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
            backgroundColor: '#ffffff',
            boxShadow: isActive('transparent') ? '0 0 0 2px #ffffff, 0 0 0 4px #3B82F6' : undefined,
          }}
          aria-hidden="true"
        />
        <span className="text-sm text-gray-700">Transparent</span>
      </button>

      <div className="mb-1 border-t border-gray-100" />

      <div className="flex items-center gap-2 px-1 py-1">
        <span className="text-sm text-gray-700">Custom</span>
        <input
          type="color"
          aria-label="Custom background colour"
          value={backgroundColor === 'transparent' ? '#ffffff' : backgroundColor}
          onChange={(e) => setBackgroundColor(e.target.value)}
          className="h-6 w-6 cursor-pointer rounded border-0 p-0"
          style={{ appearance: 'none', WebkitAppearance: 'none' }}
        />
      </div>
    </div>
  )
}
