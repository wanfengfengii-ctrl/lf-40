import { create } from 'zustand';
import type { Sherd, ReconstructionScheme, SherdPlacement, ProjectData, SchemeVersion, ReconstructionMetrics, BatchImportResult, MetricsRefreshEvent, MetricsContribution, BreakPointInfo, MetricsWeightConfig } from '@/types';
import { validateSherdNumber, validateScheme, transformKeyPoints, buildContour, calculateMetricsWithContributions, exportProject, importProject, downloadProjectFile, checkDuplicateSherd, DEFAULT_WEIGHT_CONFIG } from '@/utils/reconstruction';
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
