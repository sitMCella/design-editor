// Canvas element types — mirror of the frontend element model

type BaseElement = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  locked: boolean;
};

type ShapeElement = BaseElement & {
  type: 'shape';
  shape: 'rect' | 'ellipse' | 'triangle';
  fill: string;
  stroke: string;
  strokeWidth: number;
};

type TextElement = BaseElement & {
  type: 'text';
  content: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  color: string;
  align: 'left' | 'center' | 'right';
};

type ImageElement = BaseElement & {
  type: 'image';
  src: string;
  objectFit: 'fill' | 'contain' | 'cover';
};

type GroupElement = BaseElement & {
  type: 'group';
  children: CanvasElement[];
};

export type CanvasElement = ShapeElement | TextElement | ImageElement | GroupElement;

// Project

export type Project = {
  id: string;
  name: string;
  canvas: { elements: CanvasElement[] };
  createdAt: string;
  updatedAt: string;
};

// Asset

export type Asset = {
  id: string;
  name: string;
  originalUrl: string | null;
  url: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

// API response envelope

export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiError = {
  ok: false;
  error: { code: string; message: string };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
