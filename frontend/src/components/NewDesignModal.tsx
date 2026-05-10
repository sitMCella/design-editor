import { useEffect, useRef, useState } from 'react'

type Props = {
  onConfirm: (name: string) => void
  onClose: () => void
  isLoading?: boolean
}

export function NewDesignModal({ onConfirm, onClose, isLoading = false }: Props) {
  const [name, setName] = useState('Untitled design')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.select()
  }, [])

  const isValid = name.trim().length > 0

  const handleCreate = () => {
    if (isValid) onConfirm(name.trim())
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && isValid) handleCreate()
    if (e.key === 'Escape') onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-design-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={onClose}
    >
      <div
        className="w-96 rounded-lg bg-white p-6 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="new-design-title" className="mb-4 text-lg font-semibold text-gray-900">
          New design
        </h2>
        <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="design-name">
          Design name
        </label>
        <input
          ref={inputRef}
          id="design-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          className="mb-6 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!isValid || isLoading}
            className="rounded bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
