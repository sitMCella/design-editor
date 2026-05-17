export type BaseElement = {
  id: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  locked: boolean
  hidden?: boolean
}

export type TextElement = BaseElement & {
  type: 'text'
  content: string
  fontSize: number
  fontFamily: string
  fontWeight: 'normal' | 'bold'
  fontStyle: 'normal' | 'italic'
  color: string
  align: 'left' | 'center' | 'right'
}

export type ImageElement = BaseElement & {
  type: 'image'
  src: string
  objectFit: 'fill' | 'contain' | 'cover'
  objectPosition: string
}

export type AnchorSide = 'top' | 'right' | 'bottom' | 'left' | 'center'

export type ArrowAnchor = {
  elementId: string
  side: AnchorSide
}

export type ArrowElement = BaseElement & {
  type: 'arrow'
  // Authoritative endpoint coordinates (absolute design-surface pixels)
  x1: number
  y1: number
  x2: number
  y2: number
  // Styling
  stroke: string
  strokeWidth: number
  arrowHead: 'none' | 'start' | 'end' | 'both'
  // Optional sticky connections
  startAnchor?: ArrowAnchor
  endAnchor?: ArrowAnchor
}

export type TableRow = {
  isHeader: boolean
  cells: string[]
  height: number
}

export type TableElement = BaseElement & {
  type: 'table'
  columns: number
  columnWidths: number[]
  rows: TableRow[]
}

export type CanvasElement = TextElement | ImageElement | ArrowElement | TableElement
