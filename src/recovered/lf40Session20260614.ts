import * as fabric from 'fabric';
import type {
  BreakPointInfo,
  MetricsContribution,
  MetricsWeightConfig,
  ReconstructionMetrics,
  Sherd,
  SherdPlacement,
} from '@/types';
import {
  buildContour,
  calculateMetricsWithContributions,
  transformKeyPoints,
} from '@/utils/reconstruction';

// Recovered from missed Trae session:
// .432588890839280:38d05bab40d1390668629fbe5cd4b426_6a2e5abe2cd8cbd3a578fa41.6a2e5abf2cd8cbd3a578fa43.6a2e5abe7c46db2f7a82eca9
// Archived as append-only code so the original live implementation does not get rolled back.

export interface CachedImageDataRecovered {
  image: fabric.Image;
  placement: SherdPlacement;
  keyPointCircles: fabric.Circle[];
}

export function scheduleFastMetricsUpdateRecovered(
  metrics: ReconstructionMetrics,
  setCalcTime: (value: number | null) => void,
  onMetricsChange?: (metrics: ReconstructionMetrics | null) => void
) {
  setCalcTime(metrics.calculationTime || 0);
  onMetricsChange?.(metrics);
}

export function bindRecoveredRealTimeCanvasHandlers(
  canvas: fabric.Canvas,
  scheduleVisualUpdate: () => void,
  setIsRealTime: (value: boolean) => void,
  isDraggingRef: { current: boolean }
) {
  canvas.on('object:moving', () => {
    isDraggingRef.current = true;
    setIsRealTime(true);
    scheduleVisualUpdate();
  });

  canvas.on('object:scaling', () => {
    isDraggingRef.current = true;
    setIsRealTime(true);
    scheduleVisualUpdate();
  });

  canvas.on('object:rotating', () => {
    isDraggingRef.current = true;
    setIsRealTime(true);
    scheduleVisualUpdate();
  });
}

export function resetRecoveredVisualState(
  cache: Map<string, CachedImageDataRecovered>,
  setBreakPointInfos: (infos: BreakPointInfo[]) => void,
  setContributions: (value: MetricsContribution | null) => void
) {
  cache.clear();
  setBreakPointInfos([]);
  setContributions(null);
}

export function cacheRecoveredKeyPointCircles(
  cache: Map<string, CachedImageDataRecovered>,
  sherdId: string,
  image: fabric.Image,
  placement: SherdPlacement,
  keyPointCircles: fabric.Circle[]
) {
  cache.set(sherdId, {
    image,
    placement: { ...placement },
    keyPointCircles,
  });
}

export interface RecoveredMetricsSnapshotInput {
  placements: SherdPlacement[];
  sherds: Sherd[];
  canvasCenter: { x: number; y: number };
  centerAxisX: number;
  weightConfig: MetricsWeightConfig;
}

export function calculateRecoveredMetricsSnapshot({
  placements,
  sherds,
  canvasCenter,
  centerAxisX,
  weightConfig,
}: RecoveredMetricsSnapshotInput): {
  metrics: ReconstructionMetrics;
  contributions: MetricsContribution;
  breakPointInfos: BreakPointInfo[];
} | null {
  if (placements.length === 0) return null;

  const allTransformedPoints: ReturnType<typeof transformKeyPoints> = [];

  placements.forEach((placement) => {
    const sherd = sherds.find((s) => s.id === placement.sherdId);
    if (!sherd) return;
    allTransformedPoints.push(...transformKeyPoints(sherd, placement, canvasCenter));
  });

  const contour = buildContour(allTransformedPoints, centerAxisX);

  let avgScale = 1;
  if (placements.length > 0) {
    avgScale =
      placements.reduce((acc, placement) => {
        const sherd = sherds.find((s) => s.id === placement.sherdId);
        return acc + (sherd?.scale || 1);
      }, 0) / placements.length;
  }

  const result = calculateMetricsWithContributions(
    allTransformedPoints,
    contour,
    centerAxisX,
    avgScale,
    sherds,
    weightConfig
  );

  return {
    metrics: result.metrics,
    contributions: result.contributions,
    breakPointInfos: result.breakPointInfos,
  };
}
