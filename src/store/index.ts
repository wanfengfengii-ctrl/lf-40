import { create } from 'zustand';
import type { Sherd, ReconstructionScheme, SherdPlacement } from '@/types';
import { validateSherdNumber, validateScheme } from '@/utils/reconstruction';
import { transformKeyPoints, buildContour, calculateMetrics } from '@/utils/reconstruction';

interface AppState {
  sherds: Sherd[];
  schemes: ReconstructionScheme[];
  activeSherdId: string | null;
  activeSchemeId: string | null;
  selectedTool: 'select' | 'addPoint' | 'move';
  pointType: 'rim' | 'body' | 'base' | 'pattern';

  addSherd: (sherd: Omit<Sherd, 'id'>) => { success: boolean; error?: string };
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
  toggleSchemeTrusted: (id: string) => { success: boolean; error?: string };

  addSherdToScheme: (schemeId: string, sherdId: string) => { success: boolean; error?: string };
  removeSherdFromScheme: (schemeId: string, sherdId: string) => void;
  updateSherdPlacement: (schemeId: string, sherdId: string, updates: Partial<SherdPlacement>) => void;

  setSelectedTool: (tool: 'select' | 'addPoint' | 'move') => void;
  setPointType: (type: 'rim' | 'body' | 'base' | 'pattern') => void;

  checkSchemeHasContourBreak: (id: string) => boolean;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

const CANVAS_CENTER = { x: 400, y: 300 };
const CENTER_AXIS_X = CANVAS_CENTER.x;

function computeSchemeMetrics(scheme: ReconstructionScheme, sherds: Sherd[]) {
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
  return calculateMetrics(allTransformedPoints, contour, CENTER_AXIS_X, avgScale);
}

export const useAppStore = create<AppState>((set, get) => ({
  sherds: [],
  schemes: [],
  activeSherdId: null,
  activeSchemeId: null,
  selectedTool: 'select',
  pointType: 'rim',

  addSherd: (sherdData) => {
    const state = get();
    const validation = validateSherdNumber(sherdData.sherdNumber, state.sherds);
    if (!validation.valid) {
      return { success: false, error: validation.errors[0] };
    }
    const newSherd: Sherd = { ...sherdData, id: generateId() };
    set((state) => ({
      sherds: [...state.sherds, newSherd],
      activeSherdId: newSherd.id,
    }));
    return { success: true };
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
      sherds: state.sherds.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    }));
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
    }));
  },

  setActiveSherd: (id) => set({ activeSherdId: id }),

  addKeyPoint: (sherdId, point) => {
    set((state) => ({
      sherds: state.sherds.map((s) =>
        s.id === sherdId
          ? { ...s, keyPoints: [...s.keyPoints, { ...point, id: generateId() }] }
          : s
      ),
    }));
  },

  removeKeyPoint: (sherdId, pointId) => {
    set((state) => ({
      sherds: state.sherds.map((s) =>
        s.id === sherdId
          ? { ...s, keyPoints: s.keyPoints.filter((p) => p.id !== pointId) }
          : s
      ),
    }));
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
            }
          : s
      ),
    }));
  },

  addScheme: (name, description) => {
    const state = get();
    const validation = validateScheme(name, [], state.sherds);
    if (!validation.valid) {
      return { success: false, error: validation.errors[0] };
    }
    const newScheme: ReconstructionScheme = {
      id: generateId(),
      name,
      description,
      sherdPlacements: [],
      isTrusted: false,
      createdAt: Date.now(),
    };
    set((state) => ({
      schemes: [...state.schemes, newScheme],
      activeSchemeId: newScheme.id,
    }));
    return { success: true, id: newScheme.id };
  },

  updateScheme: (id, updates) => {
    set((state) => ({
      schemes: state.schemes.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    }));
  },

  removeScheme: (id) => {
    set((state) => ({
      schemes: state.schemes.filter((s) => s.id !== id),
      activeSchemeId: state.activeSchemeId === id ? null : state.activeSchemeId,
    }));
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
      return { success: true };
    }

    if (scheme.sherdPlacements.length === 0) {
      return { success: false, error: '请先添加残片' };
    }

    const metrics = computeSchemeMetrics(scheme, state.sherds);
    if (metrics.hasContourBreak) {
      return { success: false, error: '存在轮廓断裂，无法标记为可信复原' };
    }

    set((st) => ({
      schemes: st.schemes.map((s) =>
        s.id === id ? { ...s, isTrusted: true } : s
      ),
    }));
    return { success: true };
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
    };
    set((st) => ({
      schemes: st.schemes.map((s) =>
        s.id === schemeId
          ? { ...s, sherdPlacements: [...s.sherdPlacements, placement] }
          : s
      ),
    }));
    return { success: true };
  },

  removeSherdFromScheme: (schemeId, sherdId) => {
    set((state) => ({
      schemes: state.schemes.map((s) =>
        s.id === schemeId
          ? { ...s, sherdPlacements: s.sherdPlacements.filter((p) => p.sherdId !== sherdId) }
          : s
      ),
    }));
  },

  updateSherdPlacement: (schemeId, sherdId, updates) => {
    set((state) => {
      const scheme = state.schemes.find((s) => s.id === schemeId);
      if (!scheme) return state;

      const newPlacements = scheme.sherdPlacements.map((p) =>
        p.sherdId === sherdId ? { ...p, ...updates } : p
      );

      let newIsTrusted = scheme.isTrusted;
      if (scheme.isTrusted) {
        const testScheme: ReconstructionScheme = { ...scheme, sherdPlacements: newPlacements };
        const metrics = computeSchemeMetrics(testScheme, state.sherds);
        if (metrics.hasContourBreak) {
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
              }
            : s
        ),
      };
    });
  },

  setSelectedTool: (tool) => set({ selectedTool: tool }),
  setPointType: (type) => set({ pointType: type }),

  checkSchemeHasContourBreak: (id) => {
    const state = get();
    const scheme = state.schemes.find((s) => s.id === id);
    if (!scheme || scheme.sherdPlacements.length === 0) return false;
    const metrics = computeSchemeMetrics(scheme, state.sherds);
    return metrics.hasContourBreak;
  },
}));
