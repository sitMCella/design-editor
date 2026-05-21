import { useEffect } from 'react'

type Props = {
  projectName: string
  onConfirm: () => void
  onClose: () => void
  isLoading: boolean
}

export function DeleteConfirmModal({ projectName, onConfirm, onClose, isLoading }: Props) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-design-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={onClose}
    >
      <div
        className="w-96 rounded-lg bg-white p-6 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="delete-design-title" className="mb-3 text-lg font-semibold text-gray-900">
          Delete design?
        </h2>
        <p className="text-sm text-gray-600">
          <span className="font-semibold">&ldquo;{projectName}&rdquo;</span> will be permanently
          deleted. This action cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex items-center gap-2 rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Deleting…
              </>
            ) : (
              'Delete'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
