import type { TableElement as TableElementType } from '../../../types/canvas'

type Props = {
  element: TableElementType
  isSelected: boolean
  onSelect: (e: React.MouseEvent) => void
}

export function TableElement({ element, isSelected, onSelect }: Props) {
  const { x, y, width, height, rows, columns, opacity, rotation } = element

  const rowCount = rows.length
  const cellWidth = width / columns
  const cellHeight = height / rowCount

  return (
    <div
      data-testid="table-element"
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        opacity,
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
        outline: isSelected ? '2px solid #3B82F6' : 'none',
        outlineOffset: '2px',
        cursor: 'default',
        overflow: 'hidden',
        border: '1px solid #D1D5DB',
        boxSizing: 'border-box',
      }}
      onClick={onSelect}
    >
      <table
        style={{
          width: '100%',
          height: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
        }}
      >
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.cells.map((cell, colIndex) => {
                const Tag = row.isHeader ? 'th' : 'td'
                return (
                  <Tag
                    key={colIndex}
                    style={{
                      width: cellWidth,
                      height: cellHeight,
                      backgroundColor: row.isHeader ? '#F3F4F6' : '#FFFFFF',
                      color: row.isHeader ? '#111827' : '#374151',
                      fontWeight: row.isHeader ? 'bold' : 'normal',
                      fontSize: 14,
                      fontFamily: 'Inter, sans-serif',
                      textAlign: 'center',
                      verticalAlign: 'middle',
                      border: '1px solid #E5E7EB',
                      padding: '0 8px',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      boxSizing: 'border-box',
                    }}
                  >
                    {cell}
                  </Tag>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
