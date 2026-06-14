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
  hash?: string;
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
  createdAt?: number;
  updatedAt?: number;
}

export interface SherdPlacement {
  sherdId: string;
  rotation: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  updatedAt?: number;
}

export interface SchemeVersion {
  id: string;
  schemeId: string;
  versionNumber: number;
  name: string;
  description?: string;
  sherdPlacements: SherdPlacement[];
  isTrusted: boolean;
  createdAt: number;
  note?: string;
}

export interface ReconstructionScheme {
  id: string;
  name: string;
  description?: string;
  sherdPlacements: SherdPlacement[];
  isTrusted: boolean;
  createdAt: number;
  updatedAt?: number;
  versions?: SchemeVersion[];
  failureReasons?: string[];
}

export interface ContourPoint {
  x: number;
  y: number;
  side: 'left' | 'right' | 'center';
  isBreakPoint?: boolean;
}

export interface ReconstructionMetrics {
  estimatedRimDiameter: number;
  estimatedHeight: number;
  estimatedBaseDiameter?: number;
  estimatedWallThickness?: number;
  matchScore: number;
  thicknessConsistencyScore?: number;
  patternAlignmentScore?: number;
  hasContourBreak: boolean;
  breakPoints: ContourPoint[];
  failureReasons?: string[];
  calculationTime?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ProjectData {
  version: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  sherds: Sherd[];
  schemes: ReconstructionScheme[];
  metadata?: {
    description?: string;
    archaeologist?: string;
    siteName?: string;
    excavationDate?: string;
  };
}

export interface BatchImportResult {
  successful: Sherd[];
  duplicates: { file: File; reason: string }[];
  failed: { file: File; reason: string }[];
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  reason?: string;
  existingSherdId?: string;
}

export interface BreakPointInfo {
  x: number;
  y: number;
  index: number;
  side: 'left' | 'right' | 'center';
  gapDistance: number;
  adjacentPoint: ContourPoint | null;
}

export interface MetricsWeightConfig {
  contourWeight: number;
  thicknessWeight: number;
  patternWeight: number;
  trustedBonus: number;
  sherdCountBonus: number;
}

export interface MetricsContribution {
  contourContribution: number;
  thicknessContribution: number;
  patternContribution: number;
  contourRaw: number;
  thicknessRaw: number;
  patternRaw: number;
}

export interface MetricsRefreshEvent {
  schemeId: string;
  timestamp: number;
  calcTimeMs: number;
  metrics: ReconstructionMetrics;
  contributions: MetricsContribution;
  breakPointInfos: BreakPointInfo[];
}

export interface SchemeRanking {
  schemeId: string;
  schemeName: string;
  totalScore: number;
  matchScore: number;
  thicknessScore: number;
  patternScore: number;
  isRecommended: boolean;
  recommendationReason?: string;
  sherdCount: number;
  isTrusted: boolean;
  contributions?: MetricsContribution;
}
