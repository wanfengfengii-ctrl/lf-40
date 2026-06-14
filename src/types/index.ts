export interface Point2D {
  x: number;
  y: number;
}

export interface KeyPoint {
  id: string;
  x: number;
  y: number;
  type: 'rim' | 'body' | 'base' | 'pattern';
  label?: string;
}

export interface SherdImage {
  id: string;
  name: string;
  dataUrl: string;
  width: number;
  height: number;
}

export interface Sherd {
  id: string;
  sherdNumber: string;
  image: SherdImage;
  scale: number;
  thickness: number;
  keyPoints: KeyPoint[];
  patternPosition?: string;
  notes?: string;
}

export interface SherdPlacement {
  sherdId: string;
  rotation: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface ReconstructionScheme {
  id: string;
  name: string;
  description?: string;
  sherdPlacements: SherdPlacement[];
  isTrusted: boolean;
  createdAt: number;
}

export interface ContourPoint {
  x: number;
  y: number;
  side: 'left' | 'right' | 'center';
}

export interface ReconstructionMetrics {
  estimatedRimDiameter: number;
  estimatedHeight: number;
  matchScore: number;
  hasContourBreak: boolean;
  breakPoints: ContourPoint[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
