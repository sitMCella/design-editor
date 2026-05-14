import type { ProjectSummary } from '../api/projects'
import { relativeDate } from '../utils/relativeDate'

type Props = {
  project: ProjectSummary
  isLoading: boolean
  onClick: () => void
}

export function ProjectCard({ project, isLoading, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className="group w-full cursor-pointer rounded-lg border border-gray-200 bg-white text-left shadow-sm transition-shadow hover:shadow-md disabled:cursor-not-allowed disabled:opacity-70"
    >
      <div className="relative h-36 w-full overflow-hidden rounded-t-lg bg-gray-100">
        {project.thumbnailUrl ? (
          <img
            src={project.thumbnailUrl}
            alt={project.name}
            className="h-full w-full object-cover"
          />
        ) : null}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        )}
      </div>
      <div className="px-3 py-2">
        <p className="truncate text-sm font-medium text-gray-900">{project.name}</p>
        <p className="mt-0.5 text-xs text-gray-500">
          {project.elementCount} element{project.elementCount === 1 ? '' : 's'} ·{' '}
          {relativeDate(project.updatedAt)}
        </p>
      </div>
    </button>
  )
}
