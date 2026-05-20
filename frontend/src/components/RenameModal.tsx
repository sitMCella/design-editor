import { useEffect, useRef, useState } from 'react'

type Props = {
  currentName: string
  onConfirm: (name: string) => void
  onClose: () => void
  isLoading: boolean
  error: string | null
}

export function RenameModal({ currentName, onConfirm, onClose, isLoading, error }: Props) {
  const [name, setName] = useState(currentName)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.select()
  }, [])

  const trimmed = name.trim()
  const isValid = trimmed.length > 0 && trimmed !== currentName.trim()

  const handleSave = () => {
    if (isValid && !isLoading) onConfirm(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && isValid && !isLoading) handleSave()
    if (e.key === 'Escape') onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rename-design-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={onClose}
    >
      <div
        className="w-96 rounded-lg bg-white p-6 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="rename-design-title" className="mb-4 text-lg font-semibold text-gray-900">
          Rename design
        </h2>
        <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="rename-input">
          Design name
        </label>
        <input
          ref={inputRef}
          id="rename-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="rounded px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid || isLoading}
            className="rounded bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
