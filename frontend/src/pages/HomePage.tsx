import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCanvasStore } from '../stores/canvasStore'
import { NewDesignModal } from '../components/NewDesignModal'
import { ProjectCard } from '../components/ProjectCard'
import { ProjectCardSkeleton } from '../components/ProjectCardSkeleton'
import { AllDesignsModal } from '../components/AllDesignsModal'
import { createProject, getProject, getProjects } from '../api/projects'

const RECENT_LIMIT = 6

export function HomePage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isAllDesignsOpen, setIsAllDesignsOpen] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [loadingCardId, setLoadingCardId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const navigate = useNavigate()
  const initDesign = useCanvasStore((s) => s.initDesign)
  const loadDesign = useCanvasStore((s) => s.loadDesign)
  const queryClient = useQueryClient()

  const {
    data: projects,
    isLoading: projectsLoading,
    isError: projectsError,
    refetch: refetchProjects,
  } = useQuery({
    queryKey: ['designs'],
    queryFn: getProjects,
  })

  const { mutate: create, isPending } = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => createProject(id, name),
    onSuccess: (_data, { id, name }) => {
      initDesign(id, name)
      setIsModalOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['designs'] })
      void navigate(`/editor/${id}`)
    },
    onError: (err) => {
      setCreateError(err instanceof Error ? err.message : 'Failed to create project')
    },
  })

  const handleCreate = (name: string) => {
    setCreateError(null)
    const id = crypto.randomUUID()
    create({ id, name })
  }

  const handleOpenProject = async (id: string) => {
    setLoadError(null)
    setLoadingCardId(id)
    try {
      const project = await getProject(id)
      loadDesign(project.id, project.name, project.canvas?.elements ?? [], project.canvas?.backgroundColor)
      void navigate(`/editor/${project.id}`)
    } catch {
      setLoadError('Failed to load project. Please try again.')
    } finally {
      setLoadingCardId(null)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center px-8 py-16 gap-12">
      <section className="flex flex-col items-center gap-4">
        <h1 className="text-4xl font-bold text-gray-900">Design Studio</h1>
        <p className="text-lg text-gray-600">Start creating something great</p>
        <button
          onClick={() => {
            setCreateError(null)
            setIsModalOpen(true)
          }}
          className="mt-2 rounded bg-blue-500 px-6 py-3 text-sm font-medium text-white hover:bg-blue-600"
        >
          + New design
        </button>
        {createError && <p className="text-sm text-red-500">{createError}</p>}
      </section>

      <section className="w-full max-w-4xl">
        {projectsLoading ? (
          <>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">
              Recent designs
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <ProjectCardSkeleton />
              <ProjectCardSkeleton />
              <ProjectCardSkeleton />
            </div>
          </>
        ) : projectsError ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-gray-500">Could not load your designs. Please try again.</p>
            <button
              onClick={() => void refetchProjects()}
              className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Retry
            </button>
          </div>
        ) : projects && projects.length > 0 ? (
          <>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">
              Recent designs
            </h2>
            {loadError && <p className="mb-3 text-sm text-red-500">{loadError}</p>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.slice(0, RECENT_LIMIT).map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  isLoading={loadingCardId === project.id}
                  onClick={() => void handleOpenProject(project.id)}
                />
              ))}
            </div>
            {projects.length > RECENT_LIMIT && (
              <button
                onClick={() => setIsAllDesignsOpen(true)}
                className="mt-4 text-sm text-blue-500 hover:underline"
              >
                View all designs ({projects.length})
              </button>
            )}
          </>
        ) : (
          <p className="text-center text-sm text-gray-400">
            No designs yet. Click &ldquo;+ New design&rdquo; to get started.
          </p>
        )}
      </section>

      {isModalOpen && (
        <NewDesignModal
          onConfirm={handleCreate}
          onClose={() => setIsModalOpen(false)}
          isLoading={isPending}
        />
      )}

      {isAllDesignsOpen && projects && (
        <AllDesignsModal
          projects={projects}
          loadingCardId={loadingCardId}
          onCardClick={(id) => void handleOpenProject(id)}
          onClose={() => setIsAllDesignsOpen(false)}
        />
      )}
    </main>
  )
}
