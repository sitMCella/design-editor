import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ProjectSummary } from '../api/projects'
import { patchProject } from '../api/projects'
import { ProjectCard } from './ProjectCard'
import { RenameModal } from './RenameModal'

type Props = {
  projects: ProjectSummary[]
  loadingCardId: string | null
  onCardClick: (id: string) => void
  onClose: () => void
}

export function AllDesignsModal({ projects, loadingCardId, onCardClick, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [renameTarget, setRenameTarget] = useState<{ id: string; currentName: string } | null>(null)
  const [renameError, setRenameError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { mutate: renameProject, isPending: isRenaming } = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => patchProject(id, { name }),
    onSuccess: () => {
      setRenameTarget(null)
      setRenameError(null)
      void queryClient.invalidateQueries({ queryKey: ['designs'] })
    },
    onError: (err) => {
      setRenameError(err instanceof Error ? err.message : 'Failed to rename project')
    },
  })

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !renameTarget) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, renameTarget])

  function handleOverlayMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
      onClose()
    }
  }

  const handleRename = (name: string) => {
    if (!renameTarget) return
    setRenameError(null)
    renameProject({ id: renameTarget.id, name })
  }

  return (
    <>
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
                  onRename={() => {
                    setOpenMenuId(null)
                    setRenameTarget({ id: project.id, currentName: project.name })
                  }}
                  isMenuOpen={openMenuId === project.id}
                  onMenuOpenChange={(open) => setOpenMenuId(open ? project.id : null)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {renameTarget && (
        <RenameModal
          currentName={renameTarget.currentName}
          onConfirm={handleRename}
          onClose={() => {
            setRenameTarget(null)
            setRenameError(null)
          }}
          isLoading={isRenaming}
          error={renameError}
        />
      )}
    </>
  )
}
