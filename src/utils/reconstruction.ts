import type {
  Sherd,
  SherdPlacement,
  ReconstructionMetrics,
  ContourPoint,
  KeyPoint,
  Point2D,
  ValidationResult,
} from '@/types';
import {
  rotatePoint,
  scalePoint,
  mirrorPoint,
  fitCircle,
  detectContourBreaks,
  distance,
  averagePoints,
  interpolatePoints,
} from './geometry';

export interface TransformedKeyPoint extends KeyPoint {
  transformedX: number;
  transformedY: number;
}

export function transformKeyPoints(
  sherd: Sherd,
  placement: SherdPlacement,
  canvasCenter: Point2D
): TransformedKeyPoint[] {
  const imageCenter: Point2D = {
    x: sherd.image.width / 2,
    y: sherd.image.height / 2,
  };

  return sherd.keyPoints.map((kp) => {
    let p: Point2D = { x: kp.x, y: kp.y };
    p = scalePoint(p, imageCenter, placement.scale);
    p = rotatePoint(p, imageCenter, placement.rotation);
    p = {
      x: p.x + placement.offsetX + canvasCenter.x - imageCenter.x,
      y: p.y + placement.offsetY + canvasCenter.y - imageCenter.y,
    };
    return {
      ...kp,
      transformedX: p.x,
      transformedY: p.y,
    };
  });
}

export function buildContour(
  transformedPoints: TransformedKeyPoint[],
  centerAxisX: number
): ContourPoint[] {
  const rightPoints = transformedPoints
    .filter((p) => p.type === 'rim' || p.type === 'body' || p.type === 'base')
    .map((p) => ({
      x: p.transformedX,
      y: p.transformedY,
      side: 'right' as const,
    }))
    .sort((a, b) => a.y - b.y);

  if (rightPoints.length === 0) return [];

  const interpolated = interpolatePoints(rightPoints, 10);
  const rightContour: ContourPoint[] = interpolated.map((p) => ({ ...p, side: 'right' }));

  const leftContour: ContourPoint[] = rightContour.map((p) => ({
    ...mirrorPoint(p, centerAxisX),
    side: 'left',
  }));

  const centerLine: ContourPoint[] = [
    { x: centerAxisX, y: rightContour[0].y, side: 'center' },
    { x: centerAxisX, y: rightContour[rightContour.length - 1].y, side: 'center' },
  ];

  const fullContour: ContourPoint[] = [
    ...rightContour,
    ...centerLine.slice().reverse(),
    ...leftContour.reverse(),
  ];

  return fullContour;
}

export function calculateMetrics(
  transformedPoints: TransformedKeyPoint[],
  contour: ContourPoint[],
  centerAxisX: number,
  scale: number
): ReconstructionMetrics {
  const rimPoints = transformedPoints
    .filter((p) => p.type === 'rim')
    .map((p) => ({ x: p.transformedX, y: p.transformedY }));

  const basePoints = transformedPoints
    .filter((p) => p.type === 'base')
    .map((p) => ({ x: p.transformedX, y: p.transformedY }));

  const bodyPoints = transformedPoints
    .filter((p) => p.type === 'body' || p.type === 'rim' || p.type === 'base')
    .map((p) => ({ x: p.transformedX, y: p.transformedY }));

  let estimatedRimDiameter = 0;
  if (rimPoints.length >= 2) {
    const avgRim = averagePoints(rimPoints);
    estimatedRimDiameter = Math.abs(2 * (avgRim.x - centerAxisX)) / scale;
  } else if (rimPoints.length === 1) {
    estimatedRimDiameter = Math.abs(2 * (rimPoints[0].x - centerAxisX)) / scale;
  }

  let estimatedHeight = 0;
  if (bodyPoints.length >= 2) {
    const ys = bodyPoints.map((p) => p.y);
    estimatedHeight = (Math.max(...ys) - Math.min(...ys)) / scale;
  } else if (rimPoints.length > 0 && basePoints.length > 0) {
    const rimY = Math.min(...rimPoints.map((p) => p.y));
    const baseY = Math.max(...basePoints.map((p) => p.y));
    estimatedHeight = Math.abs(baseY - rimY) / scale;
  }

  const circleFit = fitCircle(bodyPoints);
  let matchScore: number;
  if (circleFit && bodyPoints.length >= 3) {
    const distances = bodyPoints.map((p) => distance(p, circleFit.center));
    const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length;
    const variance =
      distances.reduce((acc, d) => acc + (d - avgDist) ** 2, 0) / distances.length;
    const stdDev = Math.sqrt(variance);
    matchScore = Math.max(0, 100 - (stdDev / avgDist) * 100 * 3);
    matchScore = Math.min(100, Math.max(0, matchScore));
  } else {
    matchScore = bodyPoints.length * 20;
    matchScore = Math.min(100, matchScore);
  }

  const breakPoints = detectContourBreaks(contour, 40);
  const hasContourBreak = breakPoints.length > 0;

  if (hasContourBreak) {
    matchScore = Math.max(0, matchScore - breakPoints.length * 15);
  }

  return {
    estimatedRimDiameter: Number(estimatedRimDiameter.toFixed(2)),
    estimatedHeight: Number(estimatedHeight.toFixed(2)),
    matchScore: Number(matchScore.toFixed(1)),
    hasContourBreak,
    breakPoints,
  };
}

export function validateScheme(
  schemeName: string,
  sherdPlacements: SherdPlacement[],
  allSherds: Sherd[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!schemeName.trim()) {
    errors.push('方案名称不能为空');
  }

  const sherdIds = sherdPlacements.map((p) => p.sherdId);
  const uniqueIds = new Set(sherdIds);
  if (sherdIds.length !== uniqueIds.size) {
    errors.push('同一残片不能在一个方案中重复使用');
  }

  for (const placement of sherdPlacements) {
    const sherd = allSherds.find((s) => s.id === placement.sherdId);
    if (!sherd) {
      errors.push(`残片 ${placement.sherdId} 不存在`);
      continue;
    }
    if (sherd.keyPoints.length === 0) {
      warnings.push(`残片 ${sherd.sherdNumber} 未标记关键点`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateSherdNumber(
  sherdNumber: string,
  existingSherds: Sherd[],
  excludeId?: string
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!sherdNumber.trim()) {
    errors.push('残片编号不能为空');
  }

  const duplicate = existingSherds.find(
    (s) => s.sherdNumber === sherdNumber && s.id !== excludeId
  );
  if (duplicate) {
    errors.push('残片编号不能重复');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
