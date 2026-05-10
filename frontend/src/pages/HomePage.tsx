import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useCanvasStore } from '../stores/canvasStore'
import { NewDesignModal } from '../components/NewDesignModal'

export function HomePage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const navigate = useNavigate()
  const initDesign = useCanvasStore((s) => s.initDesign)

  const handleCreate = (name: string) => {
    const designId = crypto.randomUUID()
    initDesign(designId, name)
    setIsModalOpen(false)
    navigate(`/editor/${designId}`)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold text-gray-900">Design Studio</h1>
      <p className="text-lg text-gray-600">Start creating something great</p>
      <button
        onClick={() => setIsModalOpen(true)}
        className="mt-2 rounded bg-blue-500 px-6 py-3 text-sm font-medium text-white hover:bg-blue-600"
      >
        + New design
      </button>
      {isModalOpen && (
        <NewDesignModal onConfirm={handleCreate} onClose={() => setIsModalOpen(false)} />
      )}
    </main>
  )
}
