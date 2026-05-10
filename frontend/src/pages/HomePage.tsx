import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { useCanvasStore } from '../stores/canvasStore'
import { NewDesignModal } from '../components/NewDesignModal'
import { createProject } from '../api/projects'

export function HomePage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const initDesign = useCanvasStore((s) => s.initDesign)

  const { mutate: create, isPending } = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => createProject(id, name),
    onSuccess: (_data, { id, name }) => {
      initDesign(id, name)
      setIsModalOpen(false)
      void navigate(`/editor/${id}`)
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to create project')
    },
  })

  const handleCreate = (name: string) => {
    setError(null)
    const id = crypto.randomUUID()
    create({ id, name })
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold text-gray-900">Design Studio</h1>
      <p className="text-lg text-gray-600">Start creating something great</p>
      <button
        onClick={() => { setError(null); setIsModalOpen(true) }}
        className="mt-2 rounded bg-blue-500 px-6 py-3 text-sm font-medium text-white hover:bg-blue-600"
      >
        + New design
      </button>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {isModalOpen && (
        <NewDesignModal
          onConfirm={handleCreate}
          onClose={() => setIsModalOpen(false)}
          isLoading={isPending}
        />
      )}
    </main>
  )
}
