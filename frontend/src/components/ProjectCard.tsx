import type { ProjectSummary } from '../api/projects'
import { relativeDate } from '../utils/relativeDate'
import { KebabMenu } from './KebabMenu'

type Props = {
  project: ProjectSummary
  isLoading: boolean
  onClick: () => void
  onRename: () => void
  onDelete: () => void
  isMenuOpen: boolean
  onMenuOpenChange: (open: boolean) => void
}

export function ProjectCard({
  project,
  isLoading,
  onClick,
  onRename,
  onDelete,
  isMenuOpen,
  onMenuOpenChange,
}: Props) {
  return (
    <div
      data-testid="project-card"
      className="group relative w-full rounded-lg border border-gray-200 bg-white text-left shadow-sm transition-shadow hover:shadow-md"
    >
      {/* Thumbnail area — click to open */}
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onClick()
        }}
        className="relative h-36 w-full cursor-pointer overflow-hidden rounded-t-lg bg-gray-100"
      >
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

      {/* Info bar */}
      <div className="flex items-stretch justify-between px-3 py-2">
        {/* Left: name + subtitle — click to open */}
        <div
          role="button"
          tabIndex={0}
          onClick={onClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onClick()
          }}
          className="min-w-0 flex-1 cursor-pointer"
        >
          <p className="truncate text-sm font-medium text-gray-900">{project.name}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {project.elementCount} element{project.elementCount === 1 ? '' : 's'} ·{' '}
            {relativeDate(project.updatedAt)}
          </p>
        </div>

        {/* Kebab menu */}
        <KebabMenu
          isOpen={isMenuOpen}
          onOpen={() => onMenuOpenChange(true)}
          onClose={() => onMenuOpenChange(false)}
          onRename={onRename}
          onDelete={onDelete}
        />
      </div>
    </div>
  )
}
