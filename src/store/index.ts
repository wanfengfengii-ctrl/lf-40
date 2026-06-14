import { create } from 'zustand';
import type { Sherd, ReconstructionScheme, SherdPlacement, ProjectData, SchemeVersion, ReconstructionMetrics, BatchImportResult, MetricsRefreshEvent, MetricsContribution, BreakPointInfo, MetricsWeightConfig, SherdEvidence, SchemeEvidence, EvidenceSource, ChronologyJudgment, StratigraphyInfo, ReferenceArtifact, ExpertOpinion, EditHistoryEntry, EvidenceConflict, Collaborator, TimelineEvent, ReconstructionReport, ReportFormat, ContourPoint } from '@/types';
import { validateSherdNumber, validateScheme, transformKeyPoints, buildContour, calculateMetricsWithContributions, exportProject, importProject, downloadProjectFile, checkDuplicateSherd, DEFAULT_WEIGHT_CONFIG, generateReconstructionReportContent } from '@/utils/reconstruction';
import { computeImageHash } from '@/utils/geometry';

type MetricsListener = (event: MetricsRefreshEvent) => void;

const AUTO_SAVE_KEY = 'pottery-reconstruction-autosave';
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

interface AppState {
  sherds: Sherd[];
  schemes: ReconstructionScheme[];
  activeSherdId: string | null;
  activeSchemeId: string | null;
  selectedTool: 'select' | 'addPoint' | 'move';
  pointType: 'rim' | 'body' | 'base' | 'pattern';
  projectName: string;
  projectMetadata: ProjectData['metadata'];
  lastMetricsUpdate: number;
  cachedMetrics: Map<string, ReconstructionMetrics>;
  cachedContributions: Map<string, MetricsContribution>;
  cachedBreakPointInfos: Map<string, BreakPointInfo[]>;
  weightConfig: MetricsWeightConfig;
  lastAutoSaveAt: number | null;
  autoSaveEnabled: boolean;

  metricsListeners: Set<MetricsListener>;

  addSherd: (sherd: Omit<Sherd, 'id' | 'createdAt' | 'updatedAt'>) => Promise<{ success: boolean; error?: string; id?: string }>;
  addSherdWithoutHash: (sherd: Omit<Sherd, 'id' | 'createdAt' | 'updatedAt'>) => { success: boolean; error?: string; id?: string };
  batchImportSherds: (files: File[]) => Promise<BatchImportResult>;
  updateSherd: (id: string, updates: Partial<Sherd>) => { success: boolean; error?: string };
  removeSherd: (id: string) => void;
  setActiveSherd: (id: string | null) => void;

  addKeyPoint: (sherdId: string, point: Omit<Sherd['keyPoints'][0], 'id'>) => void;
  removeKeyPoint: (sherdId: string, pointId: string) => void;
  updateKeyPoint: (sherdId: string, pointId: string, updates: Partial<Sherd['keyPoints'][0]>) => void;

  addScheme: (name: string, description?: string) => { success: boolean; error?: string; id?: string };
  updateScheme: (id: string, updates: Partial<ReconstructionScheme>) => void;
  removeScheme: (id: string) => void;
  setActiveScheme: (id: string | null) => void;
  toggleSchemeTrusted: (id: string) => { success: boolean; error?: string; reasons?: string[] };

  saveSchemeVersion: (schemeId: string, note?: string) => { success: boolean; error?: string };
  restoreSchemeVersion: (schemeId: string, versionId: string) => { success: boolean; error?: string };
  deleteSchemeVersion: (schemeId: string, versionId: string) => void;

  addSherdToScheme: (schemeId: string, sherdId: string) => { success: boolean; error?: string };
  removeSherdFromScheme: (schemeId: string, sherdId: string) => void;
  updateSherdPlacement: (schemeId: string, sherdId: string, updates: Partial<SherdPlacement>) => void;

  setSelectedTool: (tool: 'select' | 'addPoint' | 'move') => void;
  setPointType: (type: 'rim' | 'body' | 'base' | 'pattern') => void;

  checkSchemeHasContourBreak: (id: string) => boolean;
  getSchemeMetrics: (id: string) => ReconstructionMetrics | null;
  getSchemeContributions: (id: string) => MetricsContribution | null;
  getSchemeBreakPointInfos: (id: string) => BreakPointInfo[];
  getSchemeFailureReasons: (id: string) => string[];

  saveProjectToFile: (projectName?: string, metadata?: ProjectData['metadata']) => void;
  loadProjectFromFile: (file: File) => Promise<{ success: boolean; error?: string }>;
  setProjectName: (name: string) => void;
  setProjectMetadata: (metadata: ProjectData['metadata']) => void;
  clearProject: () => void;

  invalidateMetricsCache: (schemeId?: string) => void;
  subscribeToMetrics: (listener: MetricsListener) => () => void;
  setWeightConfig: (config: Partial<MetricsWeightConfig>) => void;

  autoSaveToLocal: () => void;
  loadAutoSave: () => boolean;
  setAutoSaveEnabled: (enabled: boolean) => void;

  sherdEvidences: Map<string, SherdEvidence>;
  schemeEvidences: Map<string, SchemeEvidence>;
  collaborators: Collaborator[];
  currentCollaborator: Collaborator;
  generatedReports: ReconstructionReport[];

  getSherdEvidence: (sherdId: string) => SherdEvidence;
  getSchemeEvidence: (schemeId: string) => SchemeEvidence;

  addEvidenceSource: (targetType: 'sherd' | 'scheme', targetId: string, evidence: Omit<EvidenceSource, 'id'>) => { success: boolean; id?: string };
  updateEvidenceSource: (targetType: 'sherd' | 'scheme', targetId: string, evidenceId: string, updates: Partial<EvidenceSource>) => { success: boolean };
  removeEvidenceSource: (targetType: 'sherd' | 'scheme', targetId: string, evidenceId: string) => void;

  addChronologyJudgment: (targetType: 'sherd' | 'scheme', targetId: string, data: Omit<ChronologyJudgment, 'id' | 'createdAt' | 'createdBy'>) => { success: boolean; id?: string };
  updateChronologyJudgment: (targetType: 'sherd' | 'scheme', targetId: string, id: string, updates: Partial<ChronologyJudgment>) => { success: boolean };
  removeChronologyJudgment: (targetType: 'sherd' | 'scheme', targetId: string, id: string) => void;

  addStratigraphyInfo: (targetType: 'sherd' | 'scheme', targetId: string, data: Omit<StratigraphyInfo, 'id' | 'createdAt' | 'createdBy'>) => { success: boolean; id?: string };
  updateStratigraphyInfo: (targetType: 'sherd' | 'scheme', targetId: string, id: string, updates: Partial<StratigraphyInfo>) => { success: boolean };
  removeStratigraphyInfo: (targetType: 'sherd' | 'scheme', targetId: string, id: string) => void;

  addReferenceArtifact: (targetType: 'sherd' | 'scheme', targetId: string, data: Omit<ReferenceArtifact, 'id' | 'createdAt' | 'createdBy'>) => { success: boolean; id?: string };
  updateReferenceArtifact: (targetType: 'sherd' | 'scheme', targetId: string, id: string, updates: Partial<ReferenceArtifact>) => { success: boolean };
  removeReferenceArtifact: (targetType: 'sherd' | 'scheme', targetId: string, id: string) => void;

  addExpertOpinion: (targetType: 'sherd' | 'scheme', targetId: string, data: Omit<ExpertOpinion, 'id' | 'createdAt'>) => { success: boolean; id?: string };
  updateExpertOpinion: (targetType: 'sherd' | 'scheme', targetId: string, id: string, updates: Partial<ExpertOpinion>) => { success: boolean };
  removeExpertOpinion: (targetType: 'sherd' | 'scheme', targetId: string, id: string) => void;

  resolveConflict: (targetType: 'sherd' | 'scheme', targetId: string, conflictId: string, resolutionNote: string) => void;
  getTimelineEvents: (targetType: 'sherd' | 'scheme', targetId: string) => TimelineEvent[];
  detectConflicts: (targetType: 'sherd' | 'scheme', targetId: string) => EvidenceConflict[];

  setCurrentCollaborator: (collaborator: Partial<Collaborator>) => void;
  addCollaborator: (collaborator: Omit<Collaborator, 'id'>) => { success: boolean; id?: string };
  removeCollaborator: (id: string) => void;

  generateReport: (schemeId: string, format: ReportFormat) => ReconstructionReport;
  downloadReport: (report: ReconstructionReport) => void;
  setSchemeReconstructionBasis: (schemeId: string, basis: string) => void;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

const CANVAS_CENTER = { x: 400, y: 300 };
const CENTER_AXIS_X = CANVAS_CENTER.x;

function computeSchemeMetrics(scheme: ReconstructionScheme, sherds: Sherd[], weightConfig: MetricsWeightConfig = DEFAULT_WEIGHT_CONFIG): { metrics: ReconstructionMetrics; contributions: MetricsContribution; breakPointInfos: BreakPointInfo[] } {
  const allTransformedPoints: ReturnType<typeof transformKeyPoints> = [];
  scheme.sherdPlacements.forEach((placement) => {
    const sherd = sherds.find((s) => s.id === placement.sherdId);
    if (!sherd) return;
    allTransformedPoints.push(...transformKeyPoints(sherd, placement, CANVAS_CENTER));
  });

  const contour = buildContour(allTransformedPoints, CENTER_AXIS_X);
  let avgScale = 1;
  if (scheme.sherdPlacements.length > 0) {
    avgScale =
      scheme.sherdPlacements.reduce((acc, p) => {
        const sherd = sherds.find((s) => s.id === p.sherdId);
        return acc + (sherd?.scale || 1);
      }, 0) / scheme.sherdPlacements.length;
  }
  return calculateMetricsWithContributions(allTransformedPoints, contour, CENTER_AXIS_X, avgScale, sherds, weightConfig);
}

async function processImageFile(file: File): Promise<{ dataUrl: string; width: number; height: number; hash: string } | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) {
        resolve(null);
        return;
      }

      const img = new Image();
      img.onload = async () => {
        try {
          const hash = await computeImageHash(dataUrl);
          resolve({
            dataUrl,
            width: img.width,
            height: img.height,
            hash,
          });
        } catch {
          resolve({
            dataUrl,
            width: img.width,
            height: img.height,
            hash: '',
          });
        }
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

function recalcAndNotify(schemeId: string, state: AppState, get: () => AppState, set: (partial: Partial<AppState>) => void) {
  const scheme = state.schemes.find((s) => s.id === schemeId);
  if (!scheme || scheme.sherdPlacements.length === 0) return;

  const result = computeSchemeMetrics(scheme, state.sherds, state.weightConfig);
  const newMetricsCache = new Map(get().cachedMetrics);
  newMetricsCache.set(schemeId, result.metrics);
  const newContribCache = new Map(get().cachedContributions);
  newContribCache.set(schemeId, result.contributions);
  const newBpCache = new Map(get().cachedBreakPointInfos);
  newBpCache.set(schemeId, result.breakPointInfos);

  set({
    cachedMetrics: newMetricsCache,
    cachedContributions: newContribCache,
    cachedBreakPointInfos: newBpCache,
    lastMetricsUpdate: Date.now(),
  });

  const event: MetricsRefreshEvent = {
    schemeId,
    timestamp: Date.now(),
    calcTimeMs: result.metrics.calculationTime || 0,
    metrics: result.metrics,
    contributions: result.contributions,
    breakPointInfos: result.breakPointInfos,
  };
  get().metricsListeners.forEach((l) => l(event));
}

function scheduleAutoSave(get: () => AppState) {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    const state = get();
    if (!state.autoSaveEnabled) return;
    state.autoSaveToLocal();
  }, 5000);
}

function makeHistory(
  targetType: EditHistoryEntry['targetType'],
  targetId: string,
  action: EditHistoryEntry['action'],
  fieldName: string,
  oldValue: string,
  newValue: string
): EditHistoryEntry {
  const stateStore = (globalThis as any).__appState;
  const collaborator = stateStore?.currentCollaborator || { id: 'default-user', name: '当前用户' };
  return {
    id: generateId(),
    timestamp: Date.now(),
    userId: collaborator.id,
    userName: collaborator.name,
    action,
    targetType,
    targetId,
    fieldName,
    oldValue,
    newValue,
    summary: newValue,
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  sherds: [],
  schemes: [],
  activeSherdId: null,
  activeSchemeId: null,
  selectedTool: 'select',
  pointType: 'rim',
  projectName: '未命名项目',
  projectMetadata: {},
  lastMetricsUpdate: 0,
  cachedMetrics: new Map(),
  cachedContributions: new Map(),
  cachedBreakPointInfos: new Map(),
  weightConfig: { ...DEFAULT_WEIGHT_CONFIG },
  lastAutoSaveAt: null,
  autoSaveEnabled: true,
  metricsListeners: new Set(),
  sherdEvidences: new Map(),
  schemeEvidences: new Map(),
  collaborators: [
    { id: 'default-user', name: '当前用户', role: 'lead', avatarColor: '#6366f1', lastActiveAt: Date.now() },
  ],
  currentCollaborator: { id: 'default-user', name: '当前用户', role: 'lead', avatarColor: '#6366f1', lastActiveAt: Date.now() },
  generatedReports: [],

  getSherdEvidence: (sherdId) => {
    const state = get();
    const existing = state.sherdEvidences.get(sherdId);
    if (existing) return existing;
    const empty: SherdEvidence = {
      sherdId,
      evidenceSources: [],
      chronologyJudgments: [],
      stratigraphyInfos: [],
      referenceArtifacts: [],
      expertOpinions: [],
      conflicts: [],
      editHistory: [],
    };
    return empty;
  },

  getSchemeEvidence: (schemeId) => {
    const state = get();
    const existing = state.schemeEvidences.get(schemeId);
    if (existing) return existing;
    const empty: SchemeEvidence = {
      schemeId,
      evidenceSources: [],
      chronologyJudgments: [],
      stratigraphyInfos: [],
      referenceArtifacts: [],
      expertOpinions: [],
      conflicts: [],
      editHistory: [],
    };
    return empty;
  },

  addEvidenceSource: (targetType, targetId, evidence) => {
    const state = get();
    const id = generateId();
    const newEvidence: EvidenceSource = { ...evidence, id };
    const addHistory = makeHistory(targetType === 'sherd' ? 'evidence' : 'evidence', id, 'create', '证据来源', '', newEvidence.title);

    if (targetType === 'sherd') {
      const ev = state.getSherdEvidence(targetId);
      const updated: SherdEvidence = {
        ...ev,
        evidenceSources: [...ev.evidenceSources, newEvidence],
        editHistory: [addHistory, ...ev.editHistory],
        lastAnnotatedAt: Date.now(),
        lastAnnotatedBy: state.currentCollaborator.name,
      };
      const newMap = new Map(state.sherdEvidences);
      newMap.set(targetId, updated);
      set({ sherdEvidences: newMap });
    } else {
      const ev = state.getSchemeEvidence(targetId);
      const updated: SchemeEvidence = {
        ...ev,
        evidenceSources: [...ev.evidenceSources, newEvidence],
        editHistory: [addHistory, ...ev.editHistory],
        lastAnnotatedAt: Date.now(),
        lastAnnotatedBy: state.currentCollaborator.name,
      };
      const newMap = new Map(state.schemeEvidences);
      newMap.set(targetId, updated);
      set({ schemeEvidences: newMap });
    }
    scheduleAutoSave(get);
    return { success: true, id };
  },

  updateEvidenceSource: (targetType, targetId, evidenceId, updates) => {
    const state = get();
    let updated = false;
    const addHistory = makeHistory(targetType === 'sherd' ? 'evidence' : 'evidence', evidenceId, 'update', '证据来源', '', updates.title || '');

    if (targetType === 'sherd') {
      const ev = state.getSherdEvidence(targetId);
      const sources = ev.evidenceSources.map((e) => {
        if (e.id === evidenceId) {
          updated = true;
          return { ...e, ...updates };
        }
        return e;
      });
      if (!updated) return { success: false };
      const newEv: SherdEvidence = {
        ...ev,
        evidenceSources: sources,
        editHistory: [addHistory, ...ev.editHistory],
        lastAnnotatedAt: Date.now(),
        lastAnnotatedBy: state.currentCollaborator.name,
      };
      const newMap = new Map(state.sherdEvidences);
      newMap.set(targetId, newEv);
      set({ sherdEvidences: newMap });
    } else {
      const ev = state.getSchemeEvidence(targetId);
      const sources = ev.evidenceSources.map((e) => {
        if (e.id === evidenceId) {
          updated = true;
          return { ...e, ...updates };
        }
        return e;
      });
      if (!updated) return { success: false };
      const newEv: SchemeEvidence = {
        ...ev,
        evidenceSources: sources,
        editHistory: [addHistory, ...ev.editHistory],
        lastAnnotatedAt: Date.now(),
        lastAnnotatedBy: state.currentCollaborator.name,
      };
      const newMap = new Map(state.schemeEvidences);
      newMap.set(targetId, newEv);
      set({ schemeEvidences: newMap });
    }
    scheduleAutoSave(get);
    return { success: true };
  },

  removeEvidenceSource: (targetType, targetId, evidenceId) => {
    const state = get();
    const addHistory = makeHistory(targetType === 'sherd' ? 'evidence' : 'evidence', evidenceId, 'delete', '证据来源', '', '');

    if (targetType === 'sherd') {
      const ev = state.getSherdEvidence(targetId);
      const newEv: SherdEvidence = {
        ...ev,
        evidenceSources: ev.evidenceSources.filter((e) => e.id !== evidenceId),
        editHistory: [addHistory, ...ev.editHistory],
        lastAnnotatedAt: Date.now(),
        lastAnnotatedBy: state.currentCollaborator.name,
      };
      const newMap = new Map(state.sherdEvidences);
      newMap.set(targetId, newEv);
      set({ sherdEvidences: newMap });
    } else {
      const ev = state.getSchemeEvidence(targetId);
      const newEv: SchemeEvidence = {
        ...ev,
        evidenceSources: ev.evidenceSources.filter((e) => e.id !== evidenceId),
        editHistory: [addHistory, ...ev.editHistory],
        lastAnnotatedAt: Date.now(),
        lastAnnotatedBy: state.currentCollaborator.name,
      };
      const newMap = new Map(state.schemeEvidences);
      newMap.set(targetId, newEv);
      set({ schemeEvidences: newMap });
    }
    scheduleAutoSave(get);
  },

  addChronologyJudgment: (targetType, targetId, data) => {
    const state = get();
    const id = generateId();
    const newItem: ChronologyJudgment = {
      ...data,
      id,
      createdAt: Date.now(),
      createdBy: state.currentCollaborator.name,
    };
    const addHistory = makeHistory('chronology', id, 'create', '年代判断', '', `${newItem.period} (${newItem.confidenceLevel})`);

    if (targetType === 'sherd') {
      const ev = state.getSherdEvidence(targetId);
      const newEv: SherdEvidence = {
        ...ev,
        chronologyJudgments: [...ev.chronologyJudgments, newItem],
        editHistory: [addHistory, ...ev.editHistory],
        lastAnnotatedAt: Date.now(),
        lastAnnotatedBy: state.currentCollaborator.name,
      };
      const newMap = new Map(state.sherdEvidences);
      newMap.set(targetId, newEv);
      set({ sherdEvidences: newMap });
    } else {
      const ev = state.getSchemeEvidence(targetId);
      const newEv: SchemeEvidence = {
        ...ev,
        chronologyJudgments: [...ev.chronologyJudgments, newItem],
        editHistory: [addHistory, ...ev.editHistory],
        lastAnnotatedAt: Date.now(),
        lastAnnotatedBy: state.currentCollaborator.name,
      };
      const newMap = new Map(state.schemeEvidences);
      newMap.set(targetId, newEv);
      set({ schemeEvidences: newMap });
    }
    state.detectConflicts(targetType, targetId);
    scheduleAutoSave(get);
    return { success: true, id };
  },

  updateChronologyJudgment: (targetType, targetId, id, updates) => {
    const state = get();
    let updated = false;
    const addHistory = makeHistory('chronology', id, 'update', '年代判断', '', '');

    if (targetType === 'sherd') {
      const ev = state.getSherdEvidence(targetId);
      const items = ev.chronologyJudgments.map((c) => {
        if (c.id === id) {
          updated = true;
          return { ...c, ...updates };
        }
        return c;
      });
      if (!updated) return { success: false };
      const newEv: SherdEvidence = {
        ...ev,
        chronologyJudgments: items,
        editHistory: [addHistory, ...ev.editHistory],
        lastAnnotatedAt: Date.now(),
        lastAnnotatedBy: state.currentCollaborator.name,
      };
      const newMap = new Map(state.sherdEvidences);
      newMap.set(targetId, newEv);
      set({ sherdEvidences: newMap });
    } else {
      const ev = state.getSchemeEvidence(targetId);
      const items = ev.chronologyJudgments.map((c) => {
        if (c.id === id) {
          updated = true;
          return { ...c, ...updates };
        }
        return c;
      });
      if (!updated) return { success: false };
      const newEv: SchemeEvidence = {
        ...ev,
        chronologyJudgments: items,
        editHistory: [addHistory, ...ev.editHistory],
        lastAnnotatedAt: Date.now(),
        lastAnnotatedBy: state.currentCollaborator.name,
      };
      const newMap = new Map(state.schemeEvidences);
      newMap.set(targetId, newEv);
      set({ schemeEvidences: newMap });
    }
    state.detectConflicts(targetType, targetId);
    scheduleAutoSave(get);
    return { success: true };
  },

  removeChronologyJudgment: (targetType, targetId, id) => {
    const state = get();
    const addHistory = makeHistory('chronology', id, 'delete', '年代判断', '', '');

    if (targetType === 'sherd') {
      const ev = state.getSherdEvidence(targetId);
      const newEv: SherdEvidence = {
        ...ev,
        chronologyJudgments: ev.chronologyJudgments.filter((c) => c.id !== id),
        editHistory: [addHistory, ...ev.editHistory],
        lastAnnotatedAt: Date.now(),
        lastAnnotatedBy: state.currentCollaborator.name,
      };
      const newMap = new Map(state.sherdEvidences);
      newMap.set(targetId, newEv);
      set({ sherdEvidences: newMap });
    } else {
      const ev = state.getSchemeEvidence(targetId);
      const newEv: SchemeEvidence = {
        ...ev,
        chronologyJudgments: ev.chronologyJudgments.filter((c) => c.id !== id),
        editHistory: [addHistory, ...ev.editHistory],
        lastAnnotatedAt: Date.now(),
        lastAnnotatedBy: state.currentCollaborator.name,
      };
      const newMap = new Map(state.schemeEvidences);
      newMap.set(targetId, newEv);
      set({ schemeEvidences: newMap });
    }
    scheduleAutoSave(get);
  },

  addStratigraphyInfo: (targetType, targetId, data) => {
    const state = get();
    const id = generateId();
    const newItem: StratigraphyInfo = {
      ...data,
      id,
      createdAt: Date.now(),
      createdBy: state.currentCollaborator.name,
    };
    const addHistory = makeHistory('stratigraphy', id, 'create', '地层信息', '', `层位: ${newItem.layerNumber}`);

    if (targetType === 'sherd') {
      const ev = state.getSherdEvidence(targetId);
      const newEv: SherdEvidence = {
        ...ev,
        stratigraphyInfos: [...ev.stratigraphyInfos, newItem],
        editHistory: [addHistory, ...ev.editHistory],
        lastAnnotatedAt: Date.now(),
        lastAnnotatedBy: state.currentCollaborator.name,
      };
      const newMap = new Map(state.sherdEvidences);
      newMap.set(targetId, newEv);
      set({ sherdEvidences: newMap });
    } else {
      const ev = state.getSchemeEvidence(targetId);
      const newEv: SchemeEvidence = {
        ...ev,
        stratigraphyInfos: [...ev.stratigraphyInfos, newItem],
        editHistory: [addHistory, ...ev.editHistory],
        lastAnnotatedAt: Date.now(),
        lastAnnotatedBy: state.currentCollaborator.name,
      };
      const newMap = new Map(state.schemeEvidences);
      newMap.set(targetId, newEv);
      set({ schemeEvidences: newMap });
    }
    state.detectConflicts(targetType, targetId);
    scheduleAutoSave(get);
    return { success: true, id };
  },

  updateStratigraphyInfo: (targetType, targetId, id, updates) => {
    const state = get();
    let updated = false;
    const addHistory = makeHistory('stratigraphy', id, 'update', '地层信息', '', '');

    if (targetType === 'sherd') {
      const ev = state.getSherdEvidence(targetId);
      const items = ev.stratigraphyInfos.map((c) => {
        if (c.id === id) {
          updated = true;
          return { ...c, ...updates };
        }
        return c;
      });
      if (!updated) return { success: false };
      const newEv: SherdEvidence = {
        ...ev,
        stratigraphyInfos: items,
        editHistory: [addHistory, ...ev.editHistory],
        lastAnnotatedAt: Date.now(),
        lastAnnotatedBy: state.currentCollaborator.name,
      };
      const newMap = new Map(state.sherdEvidences);
      newMap.set(targetId, newEv);
      set({ sherdEvidences: newMap });
    } else {
      const ev = state.getSchemeEvidence(targetId);
      const items = ev.stratigraphyInfos.map((c) => {
        if (c.id === id) {
          updated = true;
          return { ...c, ...updates };
        }
        return c;
      });
      if (!updated) return { success: false };
      const newEv: SchemeEvidence = {
        ...ev,
        stratigraphyInfos: items,
        editHistory: [addHistory, ...ev.editHistory],
        lastAnnotatedAt: Date.now(),
        lastAnnotatedBy: state.currentCollaborator.name,
      };
      const newMap = new Map(state.schemeEvidences);
      newMap.set(targetId, newEv);
      set({ schemeEvidences: newMap });
    }
    state.detectConflicts(targetType, targetId);
    scheduleAutoSave(get);
    return { success: true };
  },

  removeStratigraphyInfo: (targetType, targetId, id) => {
    const state = get();
    const addHistory = makeHistory('stratigraphy', id, 'delete', '地层信息', '', '');

    if (targetType === 'sherd') {
      const ev = state.getSherdEvidence(targetId);
      const newEv: SherdEvidence = {
        ...ev,
        stratigraphyInfos: ev.stratigraphyInfos.filter((c) => c.id !== id),
        editHistory: [addHistory, ...ev.editHistory],
        lastAnnotatedAt: Date.now(),
        lastAnnotatedBy: state.currentCollaborator.name,
      };
      const newMap = new Map(state.sherdEvidences);
      newMap.set(targetId, newEv);
      set({ sherdEvidences: newMap });
    } else {
      const ev = state.getSchemeEvidence(targetId);
      const newEv: SchemeEvidence = {
        ...ev,
        stratigraphyInfos: ev.stratigraphyInfos.filter((c) => c.id !== id),
        editHistory: [addHistory, ...ev.editHistory],
        lastAnnotatedAt: Date.now(),
        lastAnnotatedBy: state.currentCollaborator.name,
      };
      const newMap = new Map(state.schemeEvidences);
      newMap.set(targetId, newEv);
      set({ schemeEvidences: newMap });
    }
    scheduleAutoSave(get);
  },

  addReferenceArtifact: (targetType, targetId, data) => {
    const state = get();
    const id = generateId();
    const newItem: ReferenceArtifact = {
      ...data,
      id,
      createdAt: Date.now(),
      createdBy: state.currentCollaborator.name,
    };
    const addHistory = makeHistory('reference', id, 'create', '参考器物', '', `${newItem.artifactName} (${newItem.artifactType})`);

    if (targetType === 'sherd') {
      const ev = state.getSherdEvidence(targetId);
      const newEv: SherdEvidence = {
        ...ev,
        referenceArtifacts: [...ev.referenceArtifacts, newItem],
        editHistory: [addHistory, ...ev.editHistory],
        lastAnnotatedAt: Date.now(),
        lastAnnotatedBy: state.currentCollaborator.name,
      };
      const newMap = new Map(state.sherdEvidences);
      newMap.set(targetId, newEv);
      set({ sherdEvidences: newMap });
    } else {
      const ev = state.getSchemeEvidence(targetId);
      const newEv: SchemeEvidence = {
        ...ev,
        referenceArtifacts: [...ev.referenceArtifacts, newItem],
        editHistory: [addHistory, ...ev.editHistory],
        lastAnnotatedAt: Date.now(),
        lastAnnotatedBy: state.currentCollaborator.name,
      };
      const newMap = new Map(state.schemeEvidences);
      newMap.set(targetId, newEv);
      set({ schemeEvidences: newMap });
    }
    state.detectConflicts(targetType, targetId);
    scheduleAutoSave(get);
    return { success: true, id };
  },

  updateReferenceArtifact: (targetType, targetId, id, updates) => {
    const state = get();
    let updated = false;
    const addHistory = makeHistory('reference', id, 'update', '参考器物', '', '');

    if (targetType === 'sherd') {
      const ev = state.getSherdEvidence(targetId);
      const items = ev.referenceArtifacts.map((c) => {
        if (c.id === id) {
          updated = true;
          return { ...c, ...updates };
        }
        return c;
      });
      if (!updated) return { success: false };
      const newEv: SherdEvidence = {
        ...ev,
        referenceArtifacts: items,
        editHistory: [addHistory, ...ev.editHistory],
        lastAnnotatedAt: Date.now(),
        lastAnnotatedBy: state.currentCollaborator.name,
      };
      const newMap = new Map(state.sherdEvidences);
      newMap.set(targetId, newEv);
      set({ sherdEvidences: newMap });
    } else {
      const ev = state.getSchemeEvidence(targetId);
      const items = ev.referenceArtifacts.map((c) => {
        if (c.id === id) {
          updated = true;
          return { ...c, ...updates };
        }
        return c;
      });
      if (!updated) return { success: false };
      const newEv: SchemeEvidence = {
        ...ev,
        referenceArtifacts: items,
        editHistory: [addHistory, ...ev.editHistory],
        lastAnnotatedAt: Date.now(),
        lastAnnotatedBy: state.currentCollaborator.name,
      };
      const newMap = new Map(state.schemeEvidences);
      newMap.set(targetId, newEv);
      set({ schemeEvidences: newMap });
    }
    state.detectConflicts(targetType, targetId);
    scheduleAutoSave(get);
    return { success: true };
  },

  removeReferenceArtifact: (targetType, targetId, id) => {
    const state = get();
    const addHistory = makeHistory('reference', id, 'delete', '参考器物', '', '');

    if (targetType === 'sherd') {
      const ev = state.getSherdEvidence(targetId);
      const newEv: SherdEvidence = {
        ...ev,
        referenceArtifacts: ev.referenceArtifacts.filter((c) => c.id !== id),
        editHistory: [addHistory, ...ev.editHistory],
        lastAnnotatedAt: Date.now(),
        lastAnnotatedBy: state.currentCollaborator.name,
      };
      const newMap = new Map(state.sherdEvidences);
      newMap.set(targetId, newEv);
      set({ sherdEvidences: newMap });
    } else {
      const ev = state.getSchemeEvidence(targetId);
      const newEv: SchemeEvidence = {
        ...ev,
        referenceArtifacts: ev.referenceArtifacts.filter((c) => c.id !== id),
        editHistory: [addHistory, ...ev.editHistory],
        lastAnnotatedAt: Date.now(),
        lastAnnotatedBy: state.currentCollaborator.name,
      };
      const newMap = new Map(state.schemeEvidences);
      newMap.set(targetId, newEv);
      set({ schemeEvidences: newMap });
    }
    scheduleAutoSave(get);
  },

  addExpertOpinion: (targetType, targetId, data) => {
    const state = get();
    const id = generateId();
    const newItem: ExpertOpinion = {
      ...data,
      id,
      createdAt: Date.now(),
    };
    const addHistory = makeHistory('opinion', id, 'create', '专家意见', '', `${newItem.expertName}: ${newItem.opinionType}`);

    if (targetType === 'sherd') {
      const ev = state.getSherdEvidence(targetId);
      const newEv: SherdEvidence = {
        ...ev,
        expertOpinions: [...ev.expertOpinions, newItem],
        editHistory: [addHistory, ...ev.editHistory],
        lastAnnotatedAt: Date.now(),
        lastAnnotatedBy: state.currentCollaborator.name,
      };
      const newMap = new Map(state.sherdEvidences);
      newMap.set(targetId, newEv);
      set({ sherdEvidences: newMap });
    } else {
      const ev = state.getSchemeEvidence(targetId);
      const newEv: SchemeEvidence = {
        ...ev,
        expertOpinions: [...ev.expertOpinions, newItem],
        editHistory: [addHistory, ...ev.editHistory],
        lastAnnotatedAt: Date.now(),
        lastAnnotatedBy: state.currentCollaborator.name,
      };
      const newMap = new Map(state.schemeEvidences);
      newMap.set(targetId, newEv);
      set({ schemeEvidences: newMap });
    }
    state.detectConflicts(targetType, targetId);
    scheduleAutoSave(get);
    return { success: true, id };
  },

  updateExpertOpinion: (targetType, targetId, id, updates) => {
    const state = get();
    let updated = false;
    const addHistory = makeHistory('opinion', id, 'update', '专家意见', '', '');

    if (targetType === 'sherd') {
      const ev = state.getSherdEvidence(targetId);
      const items = ev.expertOpinions.map((c) => {
        if (c.id === id) {
          updated = true;
          return { ...c, ...updates };
        }
        return c;
      });
      if (!updated) return { success: false };
      const newEv: SherdEvidence = {
        ...ev,
        expertOpinions: items,
        editHistory: [addHistory, ...ev.editHistory],
        lastAnnotatedAt: Date.now(),
        lastAnnotatedBy: state.currentCollaborator.name,
      };
      const newMap = new Map(state.sherdEvidences);
      newMap.set(targetId, newEv);
      set({ sherdEvidences: newMap });
    } else {
      const ev = state.getSchemeEvidence(targetId);
      const items = ev.expertOpinions.map((c) => {
        if (c.id === id) {
          updated = true;
          return { ...c, ...updates };
        }
        return c;
      });
      if (!updated) return { success: false };
      const newEv: SchemeEvidence = {
        ...ev,
        expertOpinions: items,
        editHistory: [addHistory, ...ev.editHistory],
        lastAnnotatedAt: Date.now(),
        lastAnnotatedBy: state.currentCollaborator.name,
      };
      const newMap = new Map(state.schemeEvidences);
      newMap.set(targetId, newEv);
      set({ schemeEvidences: newMap });
    }
    state.detectConflicts(targetType, targetId);
    scheduleAutoSave(get);
    return { success: true };
  },

  removeExpertOpinion: (targetType, targetId, id) => {
    const state = get();
    const addHistory = makeHistory('opinion', id, 'delete', '专家意见', '', '');

    if (targetType === 'sherd') {
      const ev = state.getSherdEvidence(targetId);
      const newEv: SherdEvidence = {
        ...ev,
        expertOpinions: ev.expertOpinions.filter((c) => c.id !== id),
        editHistory: [addHistory, ...ev.editHistory],
        lastAnnotatedAt: Date.now(),
        lastAnnotatedBy: state.currentCollaborator.name,
      };
      const newMap = new Map(state.sherdEvidences);
      newMap.set(targetId, newEv);
      set({ sherdEvidences: newMap });
    } else {
      const ev = state.getSchemeEvidence(targetId);
      const newEv: SchemeEvidence = {
        ...ev,
        expertOpinions: ev.expertOpinions.filter((c) => c.id !== id),
        editHistory: [addHistory, ...ev.editHistory],
        lastAnnotatedAt: Date.now(),
        lastAnnotatedBy: state.currentCollaborator.name,
      };
      const newMap = new Map(state.schemeEvidences);
      newMap.set(targetId, newEv);
      set({ schemeEvidences: newMap });
    }
    scheduleAutoSave(get);
  },

  resolveConflict: (targetType, targetId, conflictId, resolutionNote) => {
    const state = get();
    const now = Date.now();

    if (targetType === 'sherd') {
      const ev = state.getSherdEvidence(targetId);
      const conflicts = ev.conflicts.map((c) =>
        c.id === conflictId
          ? { ...c, resolved: true, resolvedAt: now, resolvedBy: state.currentCollaborator.name, resolutionNote }
          : c
      );
      const newEv: SherdEvidence = { ...ev, conflicts };
      const newMap = new Map(state.sherdEvidences);
      newMap.set(targetId, newEv);
      set({ sherdEvidences: newMap });
    } else {
      const ev = state.getSchemeEvidence(targetId);
      const conflicts = ev.conflicts.map((c) =>
        c.id === conflictId
          ? { ...c, resolved: true, resolvedAt: now, resolvedBy: state.currentCollaborator.name, resolutionNote }
          : c
      );
      const newEv: SchemeEvidence = { ...ev, conflicts };
      const newMap = new Map(state.schemeEvidences);
      newMap.set(targetId, newEv);
      set({ schemeEvidences: newMap });
    }
    scheduleAutoSave(get);
  },

  getTimelineEvents: (targetType, targetId) => {
    const state = get();
    const events: TimelineEvent[] = [];
    const ev = targetType === 'sherd' ? state.getSherdEvidence(targetId) : state.getSchemeEvidence(targetId);

    ev.evidenceSources.forEach((e) => {
      events.push({
        id: `ev-${e.id}`,
        date: new Date().toLocaleDateString('zh-CN'),
        timestamp: Date.now(),
        title: `证据来源：${e.title}`,
        description: e.description || `${e.type} - ${e.author || '匿名'}`,
        category: 'evidence',
        relatedId: e.id,
      });
    });

    ev.chronologyJudgments.forEach((c) => {
      events.push({
        id: `ch-${c.id}`,
        date: new Date(c.createdAt).toLocaleDateString('zh-CN'),
        timestamp: c.createdAt,
        title: `年代判断：${c.period}${c.dynasty ? `（${c.dynasty}）` : ''}`,
        description: `${c.basis} | 置信度：${c.confidenceLevel}`,
        category: 'chronology',
        relatedId: c.id,
        confidenceLevel: c.confidenceLevel,
        author: c.createdBy,
      });
    });

    ev.stratigraphyInfos.forEach((s) => {
      events.push({
        id: `st-${s.id}`,
        date: new Date(s.createdAt).toLocaleDateString('zh-CN'),
        timestamp: s.createdAt,
        title: `地层信息：第 ${s.layerNumber} 层`,
        description: `${s.layerDescription || ''} 深度: ${s.depthFrom || 0}-${s.depthTo || 0}m`,
        category: 'stratigraphy',
        relatedId: s.id,
        confidenceLevel: s.confidenceLevel,
        author: s.createdBy,
      });
    });

    ev.referenceArtifacts.forEach((r) => {
      events.push({
        id: `rf-${r.id}`,
        date: new Date(r.createdAt).toLocaleDateString('zh-CN'),
        timestamp: r.createdAt,
        title: `参考器物：${r.artifactName}`,
        description: `${r.artifactType} 相似度: ${r.similarityScore}%`,
        category: 'reference',
        relatedId: r.id,
        confidenceLevel: r.confidenceLevel,
        author: r.createdBy,
      });
    });

    ev.expertOpinions.forEach((o) => {
      events.push({
        id: `op-${o.id}`,
        date: new Date(o.createdAt).toLocaleDateString('zh-CN'),
        timestamp: o.createdAt,
        title: `专家意见：${o.expertName} - ${o.opinionType}`,
        description: o.content,
        category: 'expert',
        relatedId: o.id,
        confidenceLevel: o.confidenceLevel,
        author: o.expertName,
      });
    });

    ev.editHistory.forEach((h) => {
      events.push({
        id: `ed-${h.id}`,
        date: new Date(h.timestamp).toLocaleDateString('zh-CN'),
        timestamp: h.timestamp,
        title: `修改记录：${h.targetType} - ${h.action}`,
        description: `${h.summary || h.fieldName || ''} - ${h.userName}`,
        category: 'edit',
        relatedId: h.targetId,
        author: h.userName,
      });
    });

    return events.sort((a, b) => b.timestamp - a.timestamp);
  },

  detectConflicts: (targetType, targetId) => {
    const state = get();

    function detectForEvidence(ev: SherdEvidence | SchemeEvidence): EvidenceConflict[] {
      const newConflicts: EvidenceConflict[] = [];

      if (ev.chronologyJudgments.length >= 2) {
        const periods = ev.chronologyJudgments.map((c) => c.period);
        const unique = new Set(periods);
        if (unique.size > 1) {
          newConflicts.push({
            id: generateId(),
            detectedAt: Date.now(),
            type: 'chronology_conflict',
            severity: 'high',
            description: `检测到年代判断冲突：存在 ${unique.size} 种不同年代结论（${periods.join(' / ')}）`,
            involvedEvidenceIds: ev.chronologyJudgments.map((c) => c.id),
            resolved: false,
          });
        }
      }

      if (ev.stratigraphyInfos.length >= 2) {
        const layers = ev.stratigraphyInfos.map((s) => s.layerNumber);
        const unique = new Set(layers);
        if (unique.size > 1) {
          newConflicts.push({
            id: generateId(),
            detectedAt: Date.now(),
            type: 'stratigraphy_conflict',
            severity: 'medium',
            description: `检测到地层信息冲突：存在 ${unique.size} 个不同层位（${layers.join(' / ')}）`,
            involvedEvidenceIds: ev.stratigraphyInfos.map((s) => s.id),
            resolved: false,
          });
        }
      }

      const references = ev.referenceArtifacts;
      if (references.length >= 2) {
        const types = references.map((r) => r.artifactType);
        const uniqueTypes = new Set(types);
        if (uniqueTypes.size > 1) {
          newConflicts.push({
            id: generateId(),
            detectedAt: Date.now(),
            type: 'reference_conflict',
            severity: 'low',
            description: `参考器物类型存在差异：${types.join(' / ')}`,
            involvedEvidenceIds: references.map((r) => r.id),
            resolved: false,
          });
        }
      }

      const opinions = ev.expertOpinions;
      const supports = opinions.filter((o) => o.opinionType === 'support').length;
      const opposes = opinions.filter((o) => o.opinionType === 'oppose').length;
      if (supports > 0 && opposes > 0) {
        newConflicts.push({
          id: generateId(),
          detectedAt: Date.now(),
          type: 'expert_opinion_conflict',
          severity: 'medium',
          description: `专家意见存在分歧：${supports} 人支持 / ${opposes} 人反对`,
          involvedEvidenceIds: opinions.map((o) => o.id),
          resolved: false,
        });
      }

      const resolvedConflicts = ev.conflicts.filter((c) => c.resolved);
      const existingUnresolved = ev.conflicts.filter((c) => !c.resolved);

      const mergedUnresolved = newConflicts.map((nc) => {
        const existing = existingUnresolved.find((e) => e.type === nc.type);
        if (existing) {
          return {
            ...existing,
            description: nc.description,
            involvedEvidenceIds: nc.involvedEvidenceIds,
            detectedAt: Date.now(),
          };
        }
        return nc;
      });

      const newTypeSet = new Set(newConflicts.map((c) => c.type));
      const stillValidUnresolved = existingUnresolved.filter((e) => !newTypeSet.has(e.type));

      return [...mergedUnresolved, ...stillValidUnresolved, ...resolvedConflicts];
    }

    let updatedConflicts: EvidenceConflict[] = [];

    if (targetType === 'sherd') {
      const ev = state.getSherdEvidence(targetId);
      updatedConflicts = detectForEvidence(ev);
      const newEv: SherdEvidence = { ...ev, conflicts: updatedConflicts };
      const newMap = new Map(state.sherdEvidences);
      newMap.set(targetId, newEv);
      set({ sherdEvidences: newMap });
    } else {
      const ev = state.getSchemeEvidence(targetId);
      updatedConflicts = detectForEvidence(ev);
      const newEv: SchemeEvidence = { ...ev, conflicts: updatedConflicts };
      const newMap = new Map(state.schemeEvidences);
      newMap.set(targetId, newEv);
      set({ schemeEvidences: newMap });
    }

    return updatedConflicts;
  },

  setCurrentCollaborator: (collaborator) => {
    const state = get();
    set({ currentCollaborator: { ...state.currentCollaborator, ...collaborator, lastActiveAt: Date.now() } });
  },

  addCollaborator: (collaborator) => {
    const state = get();
    const id = generateId();
    const newCol: Collaborator = { ...collaborator, id, lastActiveAt: Date.now() };
    set({ collaborators: [...state.collaborators, newCol] });
    return { success: true, id };
  },

  removeCollaborator: (id) => {
    const state = get();
    set({ collaborators: state.collaborators.filter((c) => c.id !== id) });
  },

  generateReport: (schemeId, format) => {
    const state = get();
    const scheme = state.schemes.find((s) => s.id === schemeId);
    const schemeEvidence = state.getSchemeEvidence(schemeId);
    const schemeMetrics = state.getSchemeMetrics(schemeId);
    const schemeContributions = state.getSchemeContributions(schemeId);
    const breakPointInfos = state.getSchemeBreakPointInfos(schemeId);
    const schemeSherds = scheme
      ? scheme.sherdPlacements.map((p) => {
          const sherd = state.sherds.find((s) => s.id === p.sherdId);
          const sherdEvidence = sherd ? state.getSherdEvidence(sherd.id) : null;
          return { sherd, sherdEvidence };
        })
      : [];

    const CANVAS_CENTER = { x: 400, y: 300 };
    const CENTER_AXIS_X = CANVAS_CENTER.x;
    let contourPoints: ContourPoint[] = [];
    if (scheme) {
      const allTransformedPoints: ReturnType<typeof transformKeyPoints> = [];
      scheme.sherdPlacements.forEach((placement) => {
        const sherd = state.sherds.find((s) => s.id === placement.sherdId);
        if (!sherd) return;
        allTransformedPoints.push(...transformKeyPoints(sherd, placement, CANVAS_CENTER));
      });
      contourPoints = buildContour(allTransformedPoints, CENTER_AXIS_X);
    }

    const content = generateReconstructionReportContent({
      projectName: state.projectName,
      projectMetadata: state.projectMetadata,
      scheme,
      schemeEvidence,
      schemeMetrics,
      schemeContributions,
      breakPointInfos,
      schemeSherds,
      format,
      generatedBy: state.currentCollaborator.name,
      contourPoints,
    });

    const report: ReconstructionReport = {
      id: generateId(),
      generatedAt: Date.now(),
      generatedBy: state.currentCollaborator.name,
      format,
      projectName: state.projectName,
      schemeName: scheme?.name || '未知方案',
      schemeId,
      content,
      metadata: {
        version: '1.0.0',
        sherdCount: schemeSherds.length,
        evidenceCount: schemeEvidence.evidenceSources.length + schemeSherds.reduce((acc, s) => acc + (s.sherdEvidence?.evidenceSources.length || 0), 0),
        expertOpinionCount: schemeEvidence.expertOpinions.length + schemeSherds.reduce((acc, s) => acc + (s.sherdEvidence?.expertOpinions.length || 0), 0),
        chronologyCount: schemeEvidence.chronologyJudgments.length + schemeSherds.reduce((acc, s) => acc + (s.sherdEvidence?.chronologyJudgments.length || 0), 0),
        stratigraphyCount: schemeEvidence.stratigraphyInfos.length + schemeSherds.reduce((acc, s) => acc + (s.sherdEvidence?.stratigraphyInfos.length || 0), 0),
        referenceCount: schemeEvidence.referenceArtifacts.length + schemeSherds.reduce((acc, s) => acc + (s.sherdEvidence?.referenceArtifacts.length || 0), 0),
      },
    };

    set({ generatedReports: [...state.generatedReports, report] });
    return report;
  },

  downloadReport: (report) => {
    const extMap: Record<ReportFormat, string> = { html: 'html', markdown: 'md', json: 'json', txt: 'txt' };
    const mimeMap: Record<ReportFormat, string> = {
      html: 'text/html',
      markdown: 'text/markdown',
      json: 'application/json',
      txt: 'text/plain',
    };
    const blob = new Blob([report.content], { type: mimeMap[report.format] });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `考古复原报告-${report.schemeName}-${new Date().toISOString().slice(0, 10)}.${extMap[report.format]}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  setSchemeReconstructionBasis: (schemeId, basis) => {
    const state = get();
    const ev = state.getSchemeEvidence(schemeId);
    const newEv: SchemeEvidence = { ...ev, reconstructionBasis: basis, lastAnnotatedAt: Date.now(), lastAnnotatedBy: state.currentCollaborator.name };
    const newMap = new Map(state.schemeEvidences);
    newMap.set(schemeId, newEv);
    set({ schemeEvidences: newMap });
    scheduleAutoSave(get);
  },

  addSherd: async (sherdData) => {
    const state = get();
    const validation = validateSherdNumber(sherdData.sherdNumber, state.sherds);
    if (!validation.valid) {
      return { success: false, error: validation.errors[0] };
    }

    let imageHash = sherdData.image.hash;
    if (!imageHash) {
      try {
        imageHash = await computeImageHash(sherdData.image.dataUrl);
      } catch {
        imageHash = '';
      }
    }

    const duplicateCheck = checkDuplicateSherd(
      imageHash || '',
      sherdData.sherdNumber,
      state.sherds
    );
    if (duplicateCheck.isDuplicate) {
      return { success: false, error: duplicateCheck.reason };
    }

    const now = Date.now();
    const newSherd: Sherd = {
      ...sherdData,
      id: generateId(),
      image: { ...sherdData.image, hash: imageHash },
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({
      sherds: [...state.sherds, newSherd],
      activeSherdId: newSherd.id,
    }));
    scheduleAutoSave(get);
    return { success: true, id: newSherd.id };
  },

  addSherdWithoutHash: (sherdData) => {
    const state = get();
    const validation = validateSherdNumber(sherdData.sherdNumber, state.sherds);
    if (!validation.valid) {
      return { success: false, error: validation.errors[0] };
    }
    const now = Date.now();
    const newSherd: Sherd = {
      ...sherdData,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({
      sherds: [...state.sherds, newSherd],
      activeSherdId: newSherd.id,
    }));
    scheduleAutoSave(get);
    return { success: true, id: newSherd.id };
  },

  batchImportSherds: async (files) => {
    const result: BatchImportResult = {
      successful: [],
      duplicates: [],
      failed: [],
    };

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const processed = await processImageFile(file);
      if (!processed) {
        result.failed.push({ file, reason: '无法读取或解析图像文件' });
        continue;
      }

      const currentState = get();
      const sherdNumber = `SH-${String(currentState.sherds.length + result.successful.length + 1).padStart(3, '0')}`;

      const duplicateCheck = checkDuplicateSherd(
        processed.hash,
        sherdNumber,
        currentState.sherds
      );
      if (duplicateCheck.isDuplicate) {
        result.duplicates.push({ file, reason: duplicateCheck.reason || '检测到重复' });
        continue;
      }

      const now = Date.now();
      const newSherd: Sherd = {
        id: generateId(),
        sherdNumber,
        image: {
          id: generateId(),
          name: file.name,
          dataUrl: processed.dataUrl,
          width: processed.width,
          height: processed.height,
          hash: processed.hash,
        },
        scale: 1,
        thickness: 5,
        keyPoints: [],
        createdAt: now,
        updatedAt: now,
      };

      set((st) => ({ sherds: [...st.sherds, newSherd] }));
      result.successful.push(newSherd);
    }

    if (result.successful.length > 0) {
      scheduleAutoSave(get);
    }
    return result;
  },

  updateSherd: (id, updates) => {
    const state = get();
    if (updates.sherdNumber !== undefined) {
      const validation = validateSherdNumber(updates.sherdNumber, state.sherds, id);
      if (!validation.valid) {
        return { success: false, error: validation.errors[0] };
      }
    }
    set((state) => ({
      sherds: state.sherds.map((s) =>
        s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s
      ),
    }));
    get().invalidateMetricsCache();
    scheduleAutoSave(get);
    return { success: true };
  },

  removeSherd: (id) => {
    set((state) => ({
      sherds: state.sherds.filter((s) => s.id !== id),
      activeSherdId: state.activeSherdId === id ? null : state.activeSherdId,
      schemes: state.schemes.map((scheme) => ({
        ...scheme,
        sherdPlacements: scheme.sherdPlacements.filter((p) => p.sherdId !== id),
      })),
      cachedMetrics: new Map(),
    }));
    scheduleAutoSave(get);
  },

  setActiveSherd: (id) => set({ activeSherdId: id }),

  addKeyPoint: (sherdId, point) => {
    set((state) => ({
      sherds: state.sherds.map((s) =>
        s.id === sherdId
          ? { ...s, keyPoints: [...s.keyPoints, { ...point, id: generateId() }], updatedAt: Date.now() }
          : s
      ),
    }));
    get().invalidateMetricsCache();
  },

  removeKeyPoint: (sherdId, pointId) => {
    set((state) => ({
      sherds: state.sherds.map((s) =>
        s.id === sherdId
          ? { ...s, keyPoints: s.keyPoints.filter((p) => p.id !== pointId), updatedAt: Date.now() }
          : s
      ),
    }));
    get().invalidateMetricsCache();
  },

  updateKeyPoint: (sherdId, pointId, updates) => {
    set((state) => ({
      sherds: state.sherds.map((s) =>
        s.id === sherdId
          ? {
              ...s,
              keyPoints: s.keyPoints.map((p) =>
                p.id === pointId ? { ...p, ...updates } : p
              ),
              updatedAt: Date.now(),
            }
          : s
      ),
    }));
    get().invalidateMetricsCache();
  },

  addScheme: (name, description) => {
    const state = get();
    const validation = validateScheme(name, [], state.sherds);
    if (!validation.valid) {
      return { success: false, error: validation.errors[0] };
    }
    const now = Date.now();
    const newScheme: ReconstructionScheme = {
      id: generateId(),
      name,
      description,
      sherdPlacements: [],
      isTrusted: false,
      createdAt: now,
      updatedAt: now,
      versions: [],
    };
    set((state) => ({
      schemes: [...state.schemes, newScheme],
      activeSchemeId: newScheme.id,
    }));
    scheduleAutoSave(get);
    return { success: true, id: newScheme.id };
  },

  updateScheme: (id, updates) => {
    set((state) => ({
      schemes: state.schemes.map((s) =>
        s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s
      ),
    }));
    get().invalidateMetricsCache(id);
    scheduleAutoSave(get);
  },

  removeScheme: (id) => {
    set((state) => ({
      schemes: state.schemes.filter((s) => s.id !== id),
      activeSchemeId: state.activeSchemeId === id ? null : state.activeSchemeId,
    }));
    const cache = get().cachedMetrics;
    cache.delete(id);
    set({ cachedMetrics: new Map(cache) });
    scheduleAutoSave(get);
  },

  setActiveScheme: (id) => set({ activeSchemeId: id }),

  toggleSchemeTrusted: (id) => {
    const state = get();
    const scheme = state.schemes.find((s) => s.id === id);
    if (!scheme) return { success: false, error: '方案不存在' };

    if (scheme.isTrusted) {
      set((st) => ({
        schemes: st.schemes.map((s) =>
          s.id === id ? { ...s, isTrusted: false } : s
        ),
      }));
      scheduleAutoSave(get);
      return { success: true };
    }

    if (scheme.sherdPlacements.length === 0) {
      return { success: false, error: '请先添加残片' };
    }

    const result = computeSchemeMetrics(scheme, state.sherds, state.weightConfig);
    const metrics = result.metrics;
    if (metrics.hasContourBreak) {
      return {
        success: false,
        error: '存在轮廓断裂，无法标记为可信复原',
        reasons: metrics.failureReasons,
      };
    }

    if (metrics.matchScore < 50) {
      return {
        success: false,
        error: `匹配度过低（${metrics.matchScore.toFixed(1)}%），无法标记为可信复原`,
        reasons: metrics.failureReasons,
      };
    }

    set((st) => ({
      schemes: st.schemes.map((s) =>
        s.id === id ? { ...s, isTrusted: true, failureReasons: metrics.failureReasons } : s
      ),
    }));
    scheduleAutoSave(get);
    return { success: true };
  },

  saveSchemeVersion: (schemeId, note) => {
    const state = get();
    const scheme = state.schemes.find((s) => s.id === schemeId);
    if (!scheme) return { success: false, error: '方案不存在' };

    const versions = scheme.versions || [];
    const newVersion: SchemeVersion = {
      id: generateId(),
      schemeId,
      versionNumber: versions.length + 1,
      name: scheme.name,
      description: scheme.description,
      sherdPlacements: JSON.parse(JSON.stringify(scheme.sherdPlacements)),
      isTrusted: scheme.isTrusted,
      createdAt: Date.now(),
      note,
    };

    set((st) => ({
      schemes: st.schemes.map((s) =>
        s.id === schemeId
          ? { ...s, versions: [...versions, newVersion] }
          : s
      ),
    }));
    scheduleAutoSave(get);
    return { success: true };
  },

  restoreSchemeVersion: (schemeId, versionId) => {
    const state = get();
    const scheme = state.schemes.find((s) => s.id === schemeId);
    if (!scheme) return { success: false, error: '方案不存在' };

    const version = (scheme.versions || []).find((v) => v.id === versionId);
    if (!version) return { success: false, error: '版本不存在' };

    set((st) => ({
      schemes: st.schemes.map((s) =>
        s.id === schemeId
          ? {
              ...s,
              sherdPlacements: JSON.parse(JSON.stringify(version.sherdPlacements)),
              isTrusted: version.isTrusted,
              updatedAt: Date.now(),
            }
          : s
      ),
    }));
    get().invalidateMetricsCache(schemeId);
    scheduleAutoSave(get);
    return { success: true };
  },

  deleteSchemeVersion: (schemeId, versionId) => {
    set((st) => ({
      schemes: st.schemes.map((s) =>
        s.id === schemeId
          ? { ...s, versions: (s.versions || []).filter((v) => v.id !== versionId) }
          : s
      ),
    }));
    scheduleAutoSave(get);
  },

  addSherdToScheme: (schemeId, sherdId) => {
    const state = get();
    const scheme = state.schemes.find((s) => s.id === schemeId);
    if (!scheme) return { success: false, error: '方案不存在' };
    if (scheme.sherdPlacements.some((p) => p.sherdId === sherdId)) {
      return { success: false, error: '同一残片不能在一个方案中重复使用' };
    }

    const placement: SherdPlacement = {
      sherdId,
      rotation: 0,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      updatedAt: Date.now(),
    };
    set((st) => ({
      schemes: st.schemes.map((s) =>
        s.id === schemeId
          ? { ...s, sherdPlacements: [...s.sherdPlacements, placement], updatedAt: Date.now() }
          : s
      ),
    }));
    get().invalidateMetricsCache(schemeId);
    scheduleAutoSave(get);
    return { success: true };
  },

  removeSherdFromScheme: (schemeId, sherdId) => {
    set((state) => ({
      schemes: state.schemes.map((s) =>
        s.id === schemeId
          ? { ...s, sherdPlacements: s.sherdPlacements.filter((p) => p.sherdId !== sherdId), updatedAt: Date.now() }
          : s
      ),
    }));
    get().invalidateMetricsCache(schemeId);
    scheduleAutoSave(get);
  },

  updateSherdPlacement: (schemeId, sherdId, updates) => {
    set((state) => {
      const scheme = state.schemes.find((s) => s.id === schemeId);
      if (!scheme) return state;

      const newPlacements = scheme.sherdPlacements.map((p) =>
        p.sherdId === sherdId ? { ...p, ...updates, updatedAt: Date.now() } : p
      );

      let newIsTrusted = scheme.isTrusted;
      if (scheme.isTrusted) {
        const testScheme: ReconstructionScheme = { ...scheme, sherdPlacements: newPlacements };
        const result = computeSchemeMetrics(testScheme, state.sherds, state.weightConfig);
        if (result.metrics.hasContourBreak) {
          newIsTrusted = false;
        }
      }

      return {
        schemes: state.schemes.map((s) =>
          s.id === schemeId
            ? {
                ...s,
                sherdPlacements: newPlacements,
                isTrusted: newIsTrusted,
                updatedAt: Date.now(),
              }
            : s
        ),
      };
    });
    get().invalidateMetricsCache(schemeId);
    scheduleAutoSave(get);
  },

  setSelectedTool: (tool) => set({ selectedTool: tool }),
  setPointType: (type) => set({ pointType: type }),

  checkSchemeHasContourBreak: (id) => {
    const state = get();
    const scheme = state.schemes.find((s) => s.id === id);
    if (!scheme || scheme.sherdPlacements.length === 0) return false;
    const result = computeSchemeMetrics(scheme, state.sherds, state.weightConfig);
    return result.metrics.hasContourBreak;
  },

  getSchemeMetrics: (id) => {
    const state = get();
    const cache = state.cachedMetrics;
    if (cache.has(id)) {
      return cache.get(id) || null;
    }

    const scheme = state.schemes.find((s) => s.id === id);
    if (!scheme || scheme.sherdPlacements.length === 0) return null;

    const result = computeSchemeMetrics(scheme, state.sherds, state.weightConfig);
    const metrics = result.metrics;
    const contributions = result.contributions;
    const bpInfos = result.breakPointInfos;

    const newMetricsCache = new Map(cache);
    newMetricsCache.set(id, metrics);
    const newContribCache = new Map(state.cachedContributions);
    newContribCache.set(id, contributions);
    const newBpCache = new Map(state.cachedBreakPointInfos);
    newBpCache.set(id, bpInfos);

    set({ cachedMetrics: newMetricsCache, cachedContributions: newContribCache, cachedBreakPointInfos: newBpCache, lastMetricsUpdate: Date.now() });

    const event: MetricsRefreshEvent = {
      schemeId: id,
      timestamp: Date.now(),
      calcTimeMs: metrics.calculationTime || 0,
      metrics,
      contributions,
      breakPointInfos: bpInfos,
    };
    state.metricsListeners.forEach((l) => l(event));

    return metrics;
  },

  getSchemeContributions: (id) => {
    const state = get();
    if (state.cachedContributions.has(id)) {
      return state.cachedContributions.get(id) || null;
    }
    get().getSchemeMetrics(id);
    return get().cachedContributions.get(id) || null;
  },

  getSchemeBreakPointInfos: (id) => {
    const state = get();
    if (state.cachedBreakPointInfos.has(id)) {
      return state.cachedBreakPointInfos.get(id) || [];
    }
    get().getSchemeMetrics(id);
    return get().cachedBreakPointInfos.get(id) || [];
  },

  getSchemeFailureReasons: (id) => {
    const metrics = get().getSchemeMetrics(id);
    return metrics?.failureReasons || [];
  },

  saveProjectToFile: (projectName, metadata) => {
    const state = get();
    const name = projectName || state.projectName;
    const meta = metadata || state.projectMetadata;
    const project = exportProject(state.sherds, state.schemes, name, meta);
    downloadProjectFile(project);
    set({ lastAutoSaveAt: Date.now() });
  },

  loadProjectFromFile: async (file) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const result = importProject(data);

      if (!result.valid || !result.data) {
        return { success: false, error: result.error || '项目文件无效' };
      }

      set({
        sherds: result.data.sherds,
        schemes: result.data.schemes.map((s) => ({
          ...s,
          versions: s.versions || [],
        })),
        projectName: result.data.name,
        projectMetadata: result.data.metadata || {},
        activeSherdId: null,
        activeSchemeId: result.data.schemes.length > 0 ? result.data.schemes[0].id : null,
        cachedMetrics: new Map(),
        cachedContributions: new Map(),
        cachedBreakPointInfos: new Map(),
      });
      scheduleAutoSave(get);
      return { success: true };
    } catch (e) {
      return {
        success: false,
        error: `加载失败: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  },

  setProjectName: (name) => {
    set({ projectName: name });
    scheduleAutoSave(get);
  },

  setProjectMetadata: (metadata) => {
    set({ projectMetadata: metadata });
    scheduleAutoSave(get);
  },

  clearProject: () => {
    set({
      sherds: [],
      schemes: [],
      activeSherdId: null,
      activeSchemeId: null,
      cachedMetrics: new Map(),
      cachedContributions: new Map(),
      cachedBreakPointInfos: new Map(),
    });
    try {
      localStorage.removeItem(AUTO_SAVE_KEY);
    } catch { /* ignore */ }
  },

  invalidateMetricsCache: (schemeId) => {
    const state = get();
    const cache = state.cachedMetrics;
    const contribCache = new Map(state.cachedContributions);
    const bpCache = new Map(state.cachedBreakPointInfos);
    if (schemeId) {
      cache.delete(schemeId);
      contribCache.delete(schemeId);
      bpCache.delete(schemeId);
    } else {
      cache.clear();
      contribCache.clear();
      bpCache.clear();
    }
    set({ cachedMetrics: new Map(cache), cachedContributions: contribCache, cachedBreakPointInfos: bpCache });

    if (schemeId) {
      const currentState = get();
      recalcAndNotify(schemeId, currentState, get, set);
    } else {
      for (const scheme of get().schemes) {
        if (scheme.sherdPlacements.length > 0) {
          recalcAndNotify(scheme.id, get(), get, set);
        }
      }
    }
  },

  subscribeToMetrics: (listener) => {
    const state = get();
    state.metricsListeners.add(listener);
    return () => {
      get().metricsListeners.delete(listener);
    };
  },

  setWeightConfig: (config) => {
    const state = get();
    const newConfig = { ...state.weightConfig, ...config };
    set({ weightConfig: newConfig, cachedMetrics: new Map(), cachedContributions: new Map(), cachedBreakPointInfos: new Map() });
    for (const scheme of get().schemes) {
      if (scheme.sherdPlacements.length > 0) {
        recalcAndNotify(scheme.id, get(), get, set);
      }
    }
    scheduleAutoSave(get);
  },

  autoSaveToLocal: () => {
    const state = get();
    try {
      const project = exportProject(state.sherds, state.schemes, state.projectName, state.projectMetadata);
      localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(project));
      set({ lastAutoSaveAt: Date.now() });
    } catch (e) {
      console.warn('Auto-save failed:', e);
    }
  },

  loadAutoSave: () => {
    try {
      const saved = localStorage.getItem(AUTO_SAVE_KEY);
      if (!saved) return false;
      const data = JSON.parse(saved);
      const result = importProject(data);
      if (result.valid && result.data) {
        set({
          sherds: result.data.sherds,
          schemes: result.data.schemes.map((s) => ({ ...s, versions: s.versions || [] })),
          projectName: result.data.name,
          projectMetadata: result.data.metadata || {},
          activeSherdId: null,
          activeSchemeId: result.data.schemes.length > 0 ? result.data.schemes[0].id : null,
          cachedMetrics: new Map(),
          cachedContributions: new Map(),
          cachedBreakPointInfos: new Map(),
        });
        return true;
      }
    } catch (e) {
      console.warn('Failed to load auto-save:', e);
    }
    return false;
  },

  setAutoSaveEnabled: (enabled) => set({ autoSaveEnabled: enabled }),
}));
