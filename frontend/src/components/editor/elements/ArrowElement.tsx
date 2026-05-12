import type { ArrowElement as ArrowElementType } from '../../../types/canvas'

type Props = {
  element: ArrowElementType
  isSelected: boolean
  onSelect: (e: React.MouseEvent) => void
}

export function ArrowElement({ element, isSelected, onSelect }: Props) {
  const { id, x, y, width, height, rotation, opacity, stroke, strokeWidth } = element

  return (
    <div
      data-testid="arrow-element"
      onClick={onSelect}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        transform: `rotate(${rotation}deg)`,
        opacity,
        outline: isSelected ? '2px solid #3B82F6' : 'none',
        outlineOffset: '2px',
        cursor: isSelected ? 'grab' : 'default',
      }}
    >
      <svg
        width={width}
        height={height}
        overflow="visible"
        style={{ display: 'block' }}
      >
        <defs>
          <marker
            id={`arrowhead-${id}`}
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L0,6 L8,3 z" fill={stroke} />
          </marker>
        </defs>
        {/* Transparent hit area — rendered last so it sits on top and captures clicks */}
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke={stroke}
          strokeWidth={strokeWidth}
          markerEnd={`url(#arrowhead-${id})`}
          style={{ pointerEvents: 'none' }}
        />
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="transparent"
        />
      </svg>
    </div>
  )
}
