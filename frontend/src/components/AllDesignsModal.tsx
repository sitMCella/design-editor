import { useEffect, useRef } from 'react'
import type { ProjectSummary } from '../api/projects'
import { ProjectCard } from './ProjectCard'

type Props = {
  projects: ProjectSummary[]
  loadingCardId: string | null
  onCardClick: (id: string) => void
  onClose: () => void
}

export function AllDesignsModal({ projects, loadingCardId, onCardClick, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function handleOverlayMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
      onClose()
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="All designs"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
      onMouseDown={handleOverlayMouseDown}
    >
      <div
        ref={panelRef}
        className="flex max-h-[80vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">All designs</h2>
          <button
            aria-label="Close all designs"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                isLoading={loadingCardId === project.id}
                onClick={() => onCardClick(project.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
