export type BaseElement = {
  id: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  locked: boolean
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

export type CanvasElement = TextElement | ImageElement
