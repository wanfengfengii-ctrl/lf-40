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

export type ConfidenceLevel = 'low' | 'medium' | 'high' | 'very_high';

export type EvidenceType = 'stratigraphy' | 'typology' | 'scientific' | 'expert' | 'document' | 'other';

export interface EvidenceSource {
  id: string;
  type: EvidenceType;
  title: string;
  description?: string;
  url?: string;
  author?: string;
  publicationDate?: string;
  pageReference?: string;
}

export interface ChronologyJudgment {
  id: string;
  period: string;
  dynasty?: string;
  estimatedYearStart?: number;
  estimatedYearEnd?: number;
  confidenceLevel: ConfidenceLevel;
  basis: string;
  evidenceSourceIds: string[];
  createdAt: number;
  createdBy: string;
}

export interface StratigraphyInfo {
  id: string;
  layerNumber: string;
  layerDescription?: string;
  depthFrom?: number;
  depthTo?: number;
  associatedFeatures?: string;
  confidenceLevel: ConfidenceLevel;
  evidenceSourceIds: string[];
  createdAt: number;
  createdBy: string;
}

export interface ReferenceArtifact {
  id: string;
  artifactName: string;
  artifactType: string;
  museumOrCollection?: string;
  catalogNumber?: string;
  similarityDescription: string;
  similarityScore: number;
  imageUrl?: string;
  confidenceLevel: ConfidenceLevel;
  evidenceSourceIds: string[];
  createdAt: number;
  createdBy: string;
}

export interface ExpertOpinion {
  id: string;
  expertName: string;
  expertTitle?: string;
  institution?: string;
  opinionType: 'support' | 'oppose' | 'neutral' | 'suggestion';
  content: string;
  confidenceLevel: ConfidenceLevel;
  evidenceSourceIds: string[];
  createdAt: number;
}

export interface EditHistoryEntry {
  id: string;
  timestamp: number;
  userId: string;
  userName: string;
  action: 'create' | 'update' | 'delete' | 'restore';
  targetType: 'sherd' | 'scheme' | 'evidence' | 'chronology' | 'stratigraphy' | 'reference' | 'opinion';
  targetId: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  summary?: string;
}

export interface EvidenceConflict {
  id: string;
  detectedAt: number;
  type: 'chronology_conflict' | 'stratigraphy_conflict' | 'expert_opinion_conflict' | 'reference_conflict';
  severity: 'low' | 'medium' | 'high';
  description: string;
  involvedEvidenceIds: string[];
  resolved: boolean;
  resolvedAt?: number;
  resolvedBy?: string;
  resolutionNote?: string;
}

export interface SherdEvidence {
  sherdId: string;
  evidenceSources: EvidenceSource[];
  chronologyJudgments: ChronologyJudgment[];
  stratigraphyInfos: StratigraphyInfo[];
  referenceArtifacts: ReferenceArtifact[];
  expertOpinions: ExpertOpinion[];
  conflicts: EvidenceConflict[];
  editHistory: EditHistoryEntry[];
  lastAnnotatedAt?: number;
  lastAnnotatedBy?: string;
}

export interface SchemeEvidence {
  schemeId: string;
  evidenceSources: EvidenceSource[];
  chronologyJudgments: ChronologyJudgment[];
  stratigraphyInfos: StratigraphyInfo[];
  referenceArtifacts: ReferenceArtifact[];
  expertOpinions: ExpertOpinion[];
  conflicts: EvidenceConflict[];
  editHistory: EditHistoryEntry[];
  lastAnnotatedAt?: number;
  lastAnnotatedBy?: string;
  reconstructionBasis?: string;
}

export interface Collaborator {
  id: string;
  name: string;
  role: 'lead' | 'expert' | 'assistant' | 'reviewer';
  avatarColor?: string;
  lastActiveAt?: number;
}

export type ReportFormat = 'html' | 'markdown' | 'json' | 'txt' | 'pdf' | 'word';

export interface ReconstructionReport {
  id: string;
  generatedAt: number;
  generatedBy: string;
  format: ReportFormat;
  projectName: string;
  schemeName: string;
  schemeId: string;
  content: string;
  metadata: {
    version: string;
    sherdCount: number;
    evidenceCount: number;
    expertOpinionCount: number;
    chronologyCount: number;
    stratigraphyCount: number;
    referenceCount: number;
  };
}

export interface TimelineEvent {
  id: string;
  date: string;
  timestamp: number;
  title: string;
  description: string;
  category: 'evidence' | 'expert' | 'chronology' | 'stratigraphy' | 'reference' | 'edit';
  relatedId: string;
  confidenceLevel?: ConfidenceLevel;
  author?: string;
}
