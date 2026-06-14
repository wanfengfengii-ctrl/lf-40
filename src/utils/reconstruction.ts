import type {
  Sherd,
  SherdPlacement,
  ReconstructionScheme,
  ReconstructionMetrics,
  ContourPoint,
  KeyPoint,
  Point2D,
  ValidationResult,
  ProjectData,
  SchemeRanking,
  DuplicateCheckResult,
  MetricsWeightConfig,
  MetricsContribution,
  BreakPointInfo,
  SherdEvidence,
  SchemeEvidence,
  ReportFormat,
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
  calculateThicknessConsistency,
  calculatePatternAlignmentScore,
  isSimilarImage,
} from './geometry';

export const DEFAULT_WEIGHT_CONFIG: MetricsWeightConfig = {
  contourWeight: 0.55,
  thicknessWeight: 0.2,
  patternWeight: 0.25,
  trustedBonus: 10,
  sherdCountBonus: 2,
};

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

export function analyzeFailureReasons(
  transformedPoints: TransformedKeyPoint[],
  _contour: ContourPoint[],
  metrics: ReconstructionMetrics,
  sherds: Sherd[]
): string[] {
  const reasons: string[] = [];

  if (metrics.hasContourBreak) {
    reasons.push(`检测到 ${metrics.breakPoints.length} 处轮廓断裂，残片位置需调整以形成连续轮廓`);
  }

  const rimCount = transformedPoints.filter((p) => p.type === 'rim').length;
  if (rimCount < 2) {
    reasons.push(`口沿关键点数量不足（当前 ${rimCount} 个，建议至少 2 个），无法准确估算口径`);
  }

  const baseCount = transformedPoints.filter((p) => p.type === 'base').length;
  if (baseCount < 1) {
    reasons.push('缺少器底关键点，无法准确估算器高');
  }

  const bodyCount = transformedPoints.filter((p) => p.type === 'body').length;
  if (bodyCount < 3) {
    reasons.push(`器身关键点数量不足（当前 ${bodyCount} 个，建议至少 3 个），轮廓拟合精度较低`);
  }

  if ((metrics.thicknessConsistencyScore || 100) < 60) {
    reasons.push('残片厚度一致性较差，可能来自不同器物或标记不准确');
  }

  if ((metrics.patternAlignmentScore || 100) < 60) {
    reasons.push('纹饰点左右对称性较差，建议检查纹饰位置标记和残片对齐');
  }

  const sherdCount = new Set(transformedPoints.map((p) => p.id)).size;
  if (sherds.length > 0 && sherdCount < sherds.length * 0.5) {
    reasons.push(`方案仅使用了 ${sherdCount}/${sherds.length} 个可用残片，建议充分利用所有残片`);
  }

  if (metrics.matchScore < 40) {
    reasons.push('整体匹配度过低，建议重新调整残片旋转角度、缩放比例和位置偏移');
  }

  return reasons;
}

export function computeBreakPointInfos(contour: ContourPoint[], threshold: number = 30): BreakPointInfo[] {
  const infos: BreakPointInfo[] = [];
  for (let i = 1; i < contour.length; i++) {
    const prev = contour[i - 1];
    const curr = contour[i];
    const gapDist = distance(prev, curr);
    if (gapDist > threshold) {
      infos.push({
        x: curr.x,
        y: curr.y,
        index: i,
        side: curr.side,
        gapDistance: Number(gapDist.toFixed(2)),
        adjacentPoint: { ...prev },
      });
    }
  }
  return infos;
}

export function calculateMetricsWithContributions(
  transformedPoints: TransformedKeyPoint[],
  contour: ContourPoint[],
  centerAxisX: number,
  scale: number,
  sherds?: Sherd[],
  weightConfig?: MetricsWeightConfig
): { metrics: ReconstructionMetrics; contributions: MetricsContribution; breakPointInfos: BreakPointInfo[] } {
  const weights = weightConfig || DEFAULT_WEIGHT_CONFIG;
  const startTime = performance.now();

  const rimPoints = transformedPoints
    .filter((p) => p.type === 'rim')
    .map((p) => ({ x: p.transformedX, y: p.transformedY }));

  const basePoints = transformedPoints
    .filter((p) => p.type === 'base')
    .map((p) => ({ x: p.transformedX, y: p.transformedY }));

  const bodyPoints = transformedPoints
    .filter((p) => p.type === 'body' || p.type === 'rim' || p.type === 'base')
    .map((p) => ({ x: p.transformedX, y: p.transformedY }));

  const patternPoints = transformedPoints
    .filter((p) => p.type === 'pattern')
    .map((p) => ({ x: p.transformedX, y: p.transformedY, position: p.label }));

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

  let estimatedBaseDiameter = 0;
  if (basePoints.length >= 2) {
    const avgBase = averagePoints(basePoints);
    estimatedBaseDiameter = Math.abs(2 * (avgBase.x - centerAxisX)) / scale;
  } else if (basePoints.length === 1) {
    estimatedBaseDiameter = Math.abs(2 * (basePoints[0].x - centerAxisX)) / scale;
  }

  const circleFit = fitCircle(bodyPoints);
  let contourScore: number;
  if (circleFit && bodyPoints.length >= 3) {
    const distances = bodyPoints.map((p) => distance(p, circleFit.center));
    const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length;
    const variance =
      distances.reduce((acc, d) => acc + (d - avgDist) ** 2, 0) / distances.length;
    const stdDev = Math.sqrt(variance);
    contourScore = Math.max(0, 100 - (stdDev / avgDist) * 100 * 3);
    contourScore = Math.min(100, Math.max(0, contourScore));
  } else {
    contourScore = bodyPoints.length * 20;
    contourScore = Math.min(100, contourScore);
  }

  const breakPointInfos = computeBreakPointInfos(contour, 40);
  const hasContourBreak = breakPointInfos.length > 0;

  if (hasContourBreak) {
    contourScore = Math.max(0, contourScore - breakPointInfos.length * 15);
  }

  let thicknessConsistencyScore = 100;
  let estimatedWallThickness = 0;
  if (sherds && sherds.length > 0) {
    const usedSherdIds = new Set(transformedPoints.map((p) => {
      const sherd = sherds.find((s) => s.keyPoints.some((kp) => kp.id === p.id));
      return sherd?.id;
    }).filter(Boolean));

    const usedSherds = sherds.filter((s) => usedSherdIds.has(s.id));
    if (usedSherds.length > 0) {
      const thicknesses = usedSherds.map((s) => s.thickness);
      const thicknessResult = calculateThicknessConsistency(thicknesses);
      thicknessConsistencyScore = thicknessResult.score;
      estimatedWallThickness = thicknessResult.avgThickness;
    }
  }

  let patternAlignmentScore = 100;
  if (patternPoints.length >= 2) {
    patternAlignmentScore = calculatePatternAlignmentScore(patternPoints, centerAxisX);
  }

  const contourContribution = contourScore * weights.contourWeight;
  const thicknessContribution = thicknessConsistencyScore * weights.thicknessWeight;
  const patternContribution = patternAlignmentScore * weights.patternWeight;

  let matchScore = contourContribution + thicknessContribution + patternContribution;
  matchScore = Math.min(100, Math.max(0, matchScore));

  const breakPointsWithFlag = contour.map((p) => {
    const isBreak = breakPointInfos.some((bp) => Math.abs(bp.x - p.x) < 0.5 && Math.abs(bp.y - p.y) < 0.5);
    return { ...p, isBreakPoint: isBreak };
  });

  const metrics: ReconstructionMetrics = {
    estimatedRimDiameter: Number(estimatedRimDiameter.toFixed(2)),
    estimatedHeight: Number(estimatedHeight.toFixed(2)),
    estimatedBaseDiameter: Number(estimatedBaseDiameter.toFixed(2)),
    estimatedWallThickness: Number(estimatedWallThickness.toFixed(2)),
    matchScore: Number(matchScore.toFixed(1)),
    thicknessConsistencyScore: Number(thicknessConsistencyScore.toFixed(1)),
    patternAlignmentScore: Number(patternAlignmentScore.toFixed(1)),
    hasContourBreak,
    breakPoints: breakPointsWithFlag.filter((p) => p.isBreakPoint),
    calculationTime: performance.now() - startTime,
  };

  if (sherds) {
    metrics.failureReasons = analyzeFailureReasons(transformedPoints, contour, metrics, sherds);
  }

  const contributions: MetricsContribution = {
    contourContribution: Number(contourContribution.toFixed(2)),
    thicknessContribution: Number(thicknessContribution.toFixed(2)),
    patternContribution: Number(patternContribution.toFixed(2)),
    contourRaw: Number(contourScore.toFixed(1)),
    thicknessRaw: Number(thicknessConsistencyScore.toFixed(1)),
    patternRaw: Number(patternAlignmentScore.toFixed(1)),
  };

  return { metrics, contributions, breakPointInfos };
}

export function calculateMetrics(
  transformedPoints: TransformedKeyPoint[],
  contour: ContourPoint[],
  centerAxisX: number,
  scale: number,
  sherds?: Sherd[]
): ReconstructionMetrics {
  const startTime = performance.now();

  const rimPoints = transformedPoints
    .filter((p) => p.type === 'rim')
    .map((p) => ({ x: p.transformedX, y: p.transformedY }));

  const basePoints = transformedPoints
    .filter((p) => p.type === 'base')
    .map((p) => ({ x: p.transformedX, y: p.transformedY }));

  const bodyPoints = transformedPoints
    .filter((p) => p.type === 'body' || p.type === 'rim' || p.type === 'base')
    .map((p) => ({ x: p.transformedX, y: p.transformedY }));

  const patternPoints = transformedPoints
    .filter((p) => p.type === 'pattern')
    .map((p) => ({ x: p.transformedX, y: p.transformedY, position: p.label }));

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

  let estimatedBaseDiameter = 0;
  if (basePoints.length >= 2) {
    const avgBase = averagePoints(basePoints);
    estimatedBaseDiameter = Math.abs(2 * (avgBase.x - centerAxisX)) / scale;
  } else if (basePoints.length === 1) {
    estimatedBaseDiameter = Math.abs(2 * (basePoints[0].x - centerAxisX)) / scale;
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

  let thicknessConsistencyScore = 100;
  let estimatedWallThickness = 0;
  if (sherds && sherds.length > 0) {
    const usedSherdIds = new Set(transformedPoints.map((p) => {
      const sherd = sherds.find((s) => s.keyPoints.some((kp) => kp.id === p.id));
      return sherd?.id;
    }).filter(Boolean));

    const usedSherds = sherds.filter((s) => usedSherdIds.has(s.id));
    if (usedSherds.length > 0) {
      const thicknesses = usedSherds.map((s) => s.thickness);
      const thicknessResult = calculateThicknessConsistency(thicknesses);
      thicknessConsistencyScore = thicknessResult.score;
      estimatedWallThickness = thicknessResult.avgThickness;
      matchScore = matchScore * 0.7 + thicknessConsistencyScore * 0.15;
    }
  }

  let patternAlignmentScore = 100;
  if (patternPoints.length >= 2) {
    patternAlignmentScore = calculatePatternAlignmentScore(patternPoints, centerAxisX);
    matchScore = matchScore + patternAlignmentScore * 0.15;
  }

  matchScore = Math.min(100, Math.max(0, matchScore));

  const breakPointsWithFlag = contour.map((p) => {
    const isBreak = breakPoints.some((bp) => bp.x === p.x && bp.y === p.y);
    return { ...p, isBreakPoint: isBreak };
  });

  const metrics: ReconstructionMetrics = {
    estimatedRimDiameter: Number(estimatedRimDiameter.toFixed(2)),
    estimatedHeight: Number(estimatedHeight.toFixed(2)),
    estimatedBaseDiameter: Number(estimatedBaseDiameter.toFixed(2)),
    estimatedWallThickness: Number(estimatedWallThickness.toFixed(2)),
    matchScore: Number(matchScore.toFixed(1)),
    thicknessConsistencyScore: Number(thicknessConsistencyScore.toFixed(1)),
    patternAlignmentScore: Number(patternAlignmentScore.toFixed(1)),
    hasContourBreak,
    breakPoints: breakPointsWithFlag.filter((p) => p.isBreakPoint),
    calculationTime: performance.now() - startTime,
  };

  if (sherds) {
    metrics.failureReasons = analyzeFailureReasons(transformedPoints, contour, metrics, sherds);
  }

  return metrics;
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

export function checkDuplicateSherd(
  imageHash: string,
  sherdNumber: string,
  existingSherds: Sherd[],
  excludeId?: string
): DuplicateCheckResult {
  const numberDuplicate = existingSherds.find(
    (s) => s.sherdNumber === sherdNumber && s.id !== excludeId
  );
  if (numberDuplicate) {
    return {
      isDuplicate: true,
      reason: `残片编号 "${sherdNumber}" 已存在`,
      existingSherdId: numberDuplicate.id,
    };
  }

  for (const sherd of existingSherds) {
    if (sherd.id === excludeId) continue;
    if (sherd.image.hash && imageHash) {
      if (isSimilarImage(sherd.image.hash, imageHash, 8)) {
        return {
          isDuplicate: true,
          reason: `与残片 "${sherd.sherdNumber}" 图像高度相似，可能为重复导入`,
          existingSherdId: sherd.id,
        };
      }
    }
  }

  return { isDuplicate: false };
}

export function exportProject(
  sherds: Sherd[],
  schemes: ReconstructionScheme[],
  projectName: string = '未命名项目',
  metadata?: ProjectData['metadata']
): ProjectData {
  return {
    version: '1.0.0',
    name: projectName,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sherds,
    schemes,
    metadata,
  };
}

export function importProject(data: unknown): { valid: boolean; data?: ProjectData; error?: string } {
  try {
    const project = data as ProjectData;

    if (!project || typeof project !== 'object') {
      return { valid: false, error: '无效的项目文件格式' };
    }

    if (!project.sherds || !Array.isArray(project.sherds)) {
      return { valid: false, error: '项目文件缺少残片数据' };
    }

    if (!project.schemes || !Array.isArray(project.schemes)) {
      return { valid: false, error: '项目文件缺少方案数据' };
    }

    return { valid: true, data: project };
  } catch (e) {
    return { valid: false, error: `解析失败: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export function downloadProjectFile(project: ProjectData): void {
  const json = JSON.stringify(project, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name || 'pottery-project'}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function rankSchemes(
  schemes: { id: string; name: string; isTrusted: boolean; sherdPlacements: SherdPlacement[]; failureReasons?: string[] }[],
  sherds: Sherd[],
  canvasCenter: Point2D = { x: 400, y: 300 },
  weightConfig?: MetricsWeightConfig
): SchemeRanking[] {
  const weights = weightConfig || DEFAULT_WEIGHT_CONFIG;
  const centerAxisX = canvasCenter.x;

  const rankings: SchemeRanking[] = schemes.map((scheme) => {
    const allPoints: TransformedKeyPoint[] = [];
    scheme.sherdPlacements.forEach((placement) => {
      const sherd = sherds.find((s) => s.id === placement.sherdId);
      if (!sherd) return;
      allPoints.push(...transformKeyPoints(sherd, placement, canvasCenter));
    });

    const contour = buildContour(allPoints, centerAxisX);
    let avgScale = 1;
    if (scheme.sherdPlacements.length > 0) {
      avgScale =
        scheme.sherdPlacements.reduce((acc, p) => {
          const sherd = sherds.find((s) => s.id === p.sherdId);
          return acc + (sherd?.scale || 1);
        }, 0) / scheme.sherdPlacements.length;
    }

    let contributions: MetricsContribution | undefined;
    let matchScore = 0;
    let thicknessScore = 0;
    let patternScore = 0;
    let hasBreak = false;
    let breakCount = 0;
    let metrics: ReconstructionMetrics | null = null;

    if (allPoints.length > 0) {
      const result = calculateMetricsWithContributions(allPoints, contour, centerAxisX, avgScale, sherds, weights);
      matchScore = result.metrics.matchScore;
      thicknessScore = result.metrics.thicknessConsistencyScore || 0;
      patternScore = result.metrics.patternAlignmentScore || 0;
      contributions = result.contributions;
      hasBreak = result.metrics.hasContourBreak;
      breakCount = result.metrics.breakPoints.length;
      metrics = result.metrics;
    }

    let totalScore = matchScore;

    if (scheme.isTrusted) {
      totalScore = Math.min(100, totalScore + weights.trustedBonus);
    }

    const sherdUsageRatio = scheme.sherdPlacements.length > 0 ? scheme.sherdPlacements.length / Math.max(sherds.length, 1) : 0;
    const usageBonus = Math.min(sherdUsageRatio * 15, 15);
    totalScore += usageBonus;

    if (!hasBreak && scheme.sherdPlacements.length >= 2) {
      totalScore = Math.min(100, totalScore + 5);
    }

    if (thicknessScore >= 80) {
      totalScore = Math.min(100, totalScore + 3);
    }

    if (patternScore >= 80) {
      totalScore = Math.min(100, totalScore + 3);
    }

    const rimPoints = allPoints.filter(p => p.type === 'rim');
    const basePoints = allPoints.filter(p => p.type === 'base');
    const bodyPoints = allPoints.filter(p => p.type === 'body');
    
    if (rimPoints.length >= 2 && basePoints.length >= 1 && bodyPoints.length >= 3) {
      totalScore = Math.min(100, totalScore + 8);
    } else if (rimPoints.length >= 1 && basePoints.length >= 1) {
      totalScore = Math.min(100, totalScore + 3);
    }

    const patternPoints = allPoints.filter(p => p.type === 'pattern');
    if (patternPoints.length >= 4) {
      totalScore = Math.min(100, totalScore + 2);
    }

    if (hasBreak) {
      totalScore = Math.max(0, totalScore - breakCount * 5);
    }

    if (metrics?.failureReasons && metrics.failureReasons.length > 0) {
      const severeIssues = metrics.failureReasons.filter(r => 
        r.includes('断裂') || r.includes('不足') || r.includes('较低')
      ).length;
      totalScore = Math.max(0, totalScore - severeIssues * 3);
    }

    return {
      schemeId: scheme.id,
      schemeName: scheme.name,
      totalScore: Number(totalScore.toFixed(1)),
      matchScore,
      thicknessScore,
      patternScore,
      isRecommended: false,
      sherdCount: scheme.sherdPlacements.length,
      isTrusted: scheme.isTrusted,
      contributions,
    };
  });

  rankings.sort((a, b) => b.totalScore - a.totalScore);

  if (rankings.length > 0) {
    const validRankings = rankings.filter((r) => r.sherdCount > 0);
    if (validRankings.length > 0) {
      const best = validRankings[0];
      if (best.totalScore >= 50) {
        best.isRecommended = true;
        const reasons: string[] = [];
        reasons.push(`综合得分最高 (${best.totalScore.toFixed(1)})`);
        if (best.isTrusted) reasons.push('已标记为可信复原');
        if (best.matchScore >= 70) reasons.push('轮廓匹配度良好');
        if (best.thicknessScore >= 70) reasons.push('厚度一致性高');
        if (best.patternScore >= 70) reasons.push('纹饰对齐度好');
        if (best.sherdCount >= 3) reasons.push(`使用了 ${best.sherdCount} 个残片`);
        best.recommendationReason = reasons.join('；');
      }
    }
  }

  return rankings;
}

function generateContourSVG(
  contourPoints: ContourPoint[],
  metrics: ReconstructionMetrics | null,
  breakPoints: BreakPointInfo[],
  width: number = 400,
  height: number = 500
): string {
  if (contourPoints.length === 0) {
    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#fafafa"/>
  <text x="50%" y="50%" text-anchor="middle" fill="#9ca3af" font-size="14">暂无轮廓数据</text>
</svg>`;
  }

  const rightPoints = contourPoints.filter((p) => p.side === 'right');
  const leftPoints = contourPoints.filter((p) => p.side === 'left');
  const centerPoints = contourPoints.filter((p) => p.side === 'center');

  if (rightPoints.length === 0) {
    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#fafafa"/>
  <text x="50%" y="50%" text-anchor="middle" fill="#9ca3af" font-size="14">轮廓数据不足</text>
</svg>`;
  }

  const allX = [...rightPoints, ...leftPoints, ...centerPoints].map((p) => p.x);
  const allY = [...rightPoints, ...leftPoints, ...centerPoints].map((p) => p.y);
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);

  const padding = 40;
  const scaleX = (width - padding * 2) / (maxX - minX || 1);
  const scaleY = (height - padding * 2) / (maxY - minY || 1);
  const scale = Math.min(scaleX, scaleY);

  const offsetX = (width - (maxX - minX) * scale) / 2 - minX * scale;
  const offsetY = (height - (maxY - minY) * scale) / 2 - minY * scale;

  const toSvgX = (x: number) => x * scale + offsetX;
  const toSvgY = (y: number) => y * scale + offsetY;

  const rightPath = rightPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toSvgX(p.x).toFixed(1)} ${toSvgY(p.y).toFixed(1)}`)
    .join(' ');

  const leftPath = leftPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toSvgX(p.x).toFixed(1)} ${toSvgY(p.y).toFixed(1)}`)
    .join(' ');

  const centerX = toSvgX(centerPoints.length > 0 ? centerPoints[0].x : (minX + maxX) / 2);

  const rimY = toSvgY(minY);
  const baseY = toSvgY(maxY);

  const breakPointDots = breakPoints
    .map(
      (bp) =>
        `<circle cx="${toSvgX(bp.x).toFixed(1)}" cy="${toSvgY(bp.y).toFixed(1)}" r="5" fill="#ef4444" stroke="#fff" stroke-width="2"/>`
    )
    .join('');

  const dimensionLines = [];
  if (metrics) {
    const rimDiameter = metrics.estimatedRimDiameter;
    const vesselHeight = metrics.estimatedHeight;
    if (rimDiameter > 0 && vesselHeight > 0) {
      dimensionLines.push(`
  <line x1="${padding - 10}" y1="${rimY}" x2="${padding - 10}" y2="${baseY}" stroke="#6366f1" stroke-width="1" stroke-dasharray="4,2"/>
  <text x="${padding - 15}" y="${(rimY + baseY) / 2}" text-anchor="end" fill="#6366f1" font-size="11">器高: ${vesselHeight.toFixed(0)}mm</text>
`);
      dimensionLines.push(`
  <line x1="${toSvgX(minX)}" y1="${baseY + 20}" x2="${toSvgX(maxX)}" y2="${baseY + 20}" stroke="#6366f1" stroke-width="1" stroke-dasharray="4,2"/>
  <text x="${width / 2}" y="${baseY + 35}" text-anchor="middle" fill="#6366f1" font-size="11">口径: ${rimDiameter.toFixed(0)}mm</text>
`);
    }
  }

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#fafafa"/>
  <line x1="${centerX}" y1="${rimY - 10}" x2="${centerX}" y2="${baseY + 10}" stroke="#e5e7eb" stroke-width="1" stroke-dasharray="3,3"/>
  <path d="${rightPath}" fill="none" stroke="#6366f1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="${leftPath}" fill="none" stroke="#6366f1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M ${toSvgX(rightPoints[0].x).toFixed(1)} ${toSvgY(rightPoints[0].y).toFixed(1)} L ${toSvgX(leftPoints[leftPoints.length - 1].x).toFixed(1)} ${toSvgY(leftPoints[leftPoints.length - 1].y).toFixed(1)}" fill="none" stroke="#6366f1" stroke-width="2"/>
  ${breakPointDots}
  ${dimensionLines.join('')}
  <text x="${width / 2}" y="25" text-anchor="middle" fill="#4c1d95" font-size="14" font-weight="bold">复原轮廓图</text>
</svg>`;
}

interface ReportGenerationParams {
  projectName: string;
  projectMetadata?: ProjectData['metadata'];
  scheme: ReconstructionScheme | undefined;
  schemeEvidence: SchemeEvidence;
  schemeMetrics: ReconstructionMetrics | null;
  schemeContributions: MetricsContribution | null;
  breakPointInfos: BreakPointInfo[];
  schemeSherds: { sherd: Sherd | undefined; sherdEvidence: SherdEvidence | null }[];
  format: ReportFormat;
  generatedBy: string;
  contourPoints?: ContourPoint[];
}

export function generateReconstructionReportContent(params: ReportGenerationParams): string {
  const { projectName, projectMetadata, scheme, schemeEvidence, schemeMetrics, schemeContributions, breakPointInfos, schemeSherds, format, generatedBy, contourPoints = [] } = params;

  const now = new Date().toLocaleString('zh-CN');
  const contourSVG = generateContourSVG(contourPoints, schemeMetrics, breakPointInfos);
  const totalEvidenceCount =
    schemeEvidence.evidenceSources.length +
    schemeSherds.reduce((acc, s) => acc + (s.sherdEvidence?.evidenceSources.length || 0), 0);
  const totalOpinions =
    schemeEvidence.expertOpinions.length +
    schemeSherds.reduce((acc, s) => acc + (s.sherdEvidence?.expertOpinions.length || 0), 0);
  const totalChronology =
    schemeEvidence.chronologyJudgments.length +
    schemeSherds.reduce((acc, s) => acc + (s.sherdEvidence?.chronologyJudgments.length || 0), 0);
  const totalStratigraphy =
    schemeEvidence.stratigraphyInfos.length +
    schemeSherds.reduce((acc, s) => acc + (s.sherdEvidence?.stratigraphyInfos.length || 0), 0);
  const totalReferences =
    schemeEvidence.referenceArtifacts.length +
    schemeSherds.reduce((acc, s) => acc + (s.sherdEvidence?.referenceArtifacts.length || 0), 0);
  const unresolvedConflicts = schemeEvidence.conflicts.filter((c) => !c.resolved).length;

  if (format === 'html') {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>考古复原报告 - ${projectName}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 40px 20px; color: #333; line-height: 1.7; }
h1 { text-align: center; color: #4c1d95; border-bottom: 3px solid #6366f1; padding-bottom: 12px; }
h2 { color: #6366f1; border-left: 4px solid #6366f1; padding-left: 10px; margin-top: 32px; }
h3 { color: #4f46e5; }
.meta-box { background: #f5f3ff; padding: 16px 20px; border-radius: 8px; margin: 16px 0; }
.meta-box p { margin: 4px 0; }
table { width: 100%; border-collapse: collapse; margin: 16px 0; }
th, td { border: 1px solid #ddd; padding: 10px 12px; text-align: left; }
th { background: #eef2ff; color: #4338ca; }
.metric { display: inline-block; background: #eef2ff; padding: 4px 12px; border-radius: 20px; margin: 4px; color: #4338ca; font-weight: 500; }
.badge-high { background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 10px; font-size: 12px; }
.badge-medium { background: #fef9c3; color: #854d0e; padding: 2px 8px; border-radius: 10px; font-size: 12px; }
.badge-low { background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 10px; font-size: 12px; }
.conflict { background: #fef2f2; border-left: 4px solid #ef4444; padding: 10px 14px; margin: 8px 0; border-radius: 4px; }
.footer { text-align: center; margin-top: 48px; color: #9ca3af; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px; }
</style>
</head>
<body>
<h1>考古陶器复原标准化报告</h1>

<div class="meta-box">
<p><strong>项目名称：</strong>${projectName}</p>
<p><strong>方案名称：</strong>${scheme?.name || '未命名方案'}</p>
<p><strong>遗址名称：</strong>${projectMetadata?.siteName || '—'}</p>
<p><strong>考古学家：</strong>${projectMetadata?.archaeologist || '—'}</p>
<p><strong>发掘日期：</strong>${projectMetadata?.excavationDate || '—'}</p>
<p><strong>生成时间：</strong>${now}</p>
<p><strong>报告生成人：</strong>${generatedBy}</p>
</div>

<h2>一、复原方案概述</h2>
<p>${scheme?.description || '暂无方案描述。'}</p>
${schemeEvidence.reconstructionBasis ? `<p><strong>复原依据：</strong>${schemeEvidence.reconstructionBasis}</p>` : ''}

<h2>二、复原轮廓图</h2>
<div style="text-align: center; margin: 20px 0;">
${contourSVG}
</div>

<h2>三、尺寸数据与匹配度分析</h2>
${schemeMetrics ? `
<p>
<span class="metric">匹配度：${schemeMetrics.matchScore.toFixed(1)}%</span>
<span class="metric">口径：${schemeMetrics.estimatedRimDiameter > 0 ? schemeMetrics.estimatedRimDiameter.toFixed(1) + ' mm' : '—'}</span>
<span class="metric">器高：${schemeMetrics.estimatedHeight > 0 ? schemeMetrics.estimatedHeight.toFixed(1) + ' mm' : '—'}</span>
${schemeMetrics.estimatedBaseDiameter ? `<span class="metric">底径：${schemeMetrics.estimatedBaseDiameter.toFixed(1)} mm</span>` : ''}
${schemeMetrics.estimatedWallThickness ? `<span class="metric">壁厚：${schemeMetrics.estimatedWallThickness.toFixed(1)} mm</span>` : ''}
</p>
${schemeContributions ? `
<table>
<thead><tr><th>评估维度</th><th>原始得分</th><th>加权贡献</th></tr></thead>
<tbody>
<tr><td>轮廓拟合</td><td>${schemeContributions.contourRaw.toFixed(1)}</td><td>${schemeContributions.contourContribution.toFixed(1)}</td></tr>
<tr><td>厚度一致性</td><td>${schemeContributions.thicknessRaw.toFixed(1)}</td><td>${schemeContributions.thicknessContribution.toFixed(1)}</td></tr>
<tr><td>纹饰对齐</td><td>${schemeContributions.patternRaw.toFixed(1)}</td><td>${schemeContributions.patternContribution.toFixed(1)}</td></tr>
</tbody>
</table>
` : ''}
` : '<p>暂无度量数据，请先完成残片关键点标注与布局。</p>'}

<h2>四、断裂点分析</h2>
${breakPointInfos.length > 0 ? `
<table>
<thead><tr><th>序号</th><th>位置</th><th>侧别</th><th>间隙距离 (mm)</th></tr></thead>
<tbody>
${breakPointInfos.map((bp, i) => `
<tr><td>${i + 1}</td><td>(${bp.x.toFixed(1)}, ${bp.y.toFixed(1)})</td><td>${bp.side === 'left' ? '左侧' : bp.side === 'right' ? '右侧' : '中轴'}</td><td>${bp.gapDistance.toFixed(1)}</td></tr>
`).join('')}
</tbody>
</table>
<p><em>共检测到 ${breakPointInfos.length} 处轮廓断裂，请在复原时关注残片衔接。</em></p>
` : '<p>轮廓连续，未检测到断裂点。</p>'}

<h2>五、残片明细 (共 ${schemeSherds.length} 件)</h2>
${schemeSherds.map((s, i) => `
<div class="meta-box">
<h3>5.${i + 1} ${s.sherd?.sherdNumber || '—'}</h3>
<table>
<tr><th>厚度</th><td>${s.sherd?.thickness || '—'} mm</td><th>比例尺</th><td>${s.sherd?.scale || '—'}</td><th>关键点</th><td>${s.sherd?.keyPoints.length || 0} 个</td></tr>
<tr><th>纹饰位置</th><td colspan="5">${s.sherd?.patternPosition || '无'}</td></tr>
</table>
${s.sherdEvidence ? `
<p><strong>证据标注：</strong>
<span class="metric">年代：${s.sherdEvidence.chronologyJudgments.length}</span>
<span class="metric">地层：${s.sherdEvidence.stratigraphyInfos.length}</span>
<span class="metric">参考：${s.sherdEvidence.referenceArtifacts.length}</span>
<span class="metric">意见：${s.sherdEvidence.expertOpinions.length}</span>
</p>
${s.sherdEvidence.chronologyJudgments.length > 0 ? `<p><strong>年代：</strong>${s.sherdEvidence.chronologyJudgments.map((c) => `${c.period}${c.dynasty ? `(${c.dynasty})` : ''}`).join(' / ')}</p>` : ''}
${s.sherdEvidence.stratigraphyInfos.length > 0 ? `<p><strong>地层：</strong>${s.sherdEvidence.stratigraphyInfos.map((s) => `第${s.layerNumber}层`).join(' / ')}</p>` : ''}
${s.sherd?.notes ? `<p><strong>备注：</strong>${s.sherd.notes}</p>` : ''}
` : '<p><em>暂无证据标注</em></p>'}
</div>
`).join('')}

<h2>六、证据链摘要</h2>
<p>
<span class="metric">证据来源：${totalEvidenceCount}</span>
<span class="metric">年代判断：${totalChronology}</span>
<span class="metric">地层信息：${totalStratigraphy}</span>
<span class="metric">参考器物：${totalReferences}</span>
<span class="metric">专家意见：${totalOpinions}</span>
</p>

${schemeEvidence.evidenceSources.length > 0 ? `
<h3>6.1 证据来源</h3>
${schemeEvidence.evidenceSources.map((e) => `<div class="meta-box"><p><strong>${e.title}</strong> <span class="badge-medium">${e.type}</span></p>${e.description ? `<p>${e.description}</p>` : ''}${e.author ? `<p><em>作者：${e.author}${e.publicationDate ? ` · ${e.publicationDate}` : ''}</em></p>` : ''}</div>`).join('')}
` : ''}

${schemeEvidence.chronologyJudgments.length > 0 ? `
<h3>6.2 方案年代判断</h3>
${schemeEvidence.chronologyJudgments.map((c) => `<div class="meta-box"><p><strong>${c.period}</strong>${c.dynasty ? `（${c.dynasty}）` : ''} <span class="badge-${c.confidenceLevel === 'very_high' || c.confidenceLevel === 'high' ? 'high' : c.confidenceLevel === 'medium' ? 'medium' : 'low'}">${c.confidenceLevel}</span></p><p>${c.basis}</p><p><em>判断人：${c.createdBy}</em></p></div>`).join('')}
` : ''}

${schemeEvidence.stratigraphyInfos.length > 0 ? `
<h3>6.3 方案地层信息</h3>
${schemeEvidence.stratigraphyInfos.map((s) => `<div class="meta-box"><p><strong>第 ${s.layerNumber} 层</strong> <span class="badge-${s.confidenceLevel === 'very_high' || s.confidenceLevel === 'high' ? 'high' : s.confidenceLevel === 'medium' ? 'medium' : 'low'}">${s.confidenceLevel}</span></p>${s.layerDescription ? `<p>${s.layerDescription}</p>` : ''}${s.depthFrom !== undefined || s.depthTo !== undefined ? `<p>深度：${s.depthFrom || 0} - ${s.depthTo || 0} m</p>` : ''}<p><em>记录人：${s.createdBy}</em></p></div>`).join('')}
` : ''}

${schemeEvidence.referenceArtifacts.length > 0 ? `
<h3>6.4 参考器物</h3>
${schemeEvidence.referenceArtifacts.map((r) => `<div class="meta-box"><p><strong>${r.artifactName}</strong> <span class="badge-medium">${r.artifactType}</span> <span class="badge-${r.confidenceLevel === 'very_high' || r.confidenceLevel === 'high' ? 'high' : r.confidenceLevel === 'medium' ? 'medium' : 'low'}">${r.confidenceLevel}</span></p><p>${r.similarityDescription}</p><p>相似度：${r.similarityScore}% ${r.museumOrCollection ? `· ${r.museumOrCollection}` : ''}${r.catalogNumber ? ` · ${r.catalogNumber}` : ''}</p><p><em>记录人：${r.createdBy}</em></p></div>`).join('')}
` : ''}

${schemeEvidence.expertOpinions.length > 0 ? `
<h3>6.5 专家意见</h3>
${schemeEvidence.expertOpinions.map((o) => `<div class="meta-box"><p><strong>${o.expertName}</strong>${o.expertTitle ? ` - ${o.expertTitle}` : ''} ${o.institution ? `（${o.institution}）` : ''} <span class="badge-${o.opinionType === 'support' ? 'high' : o.opinionType === 'oppose' ? 'low' : 'medium'}">${o.opinionType}</span></p><p>${o.content}</p></div>`).join('')}
` : ''}

${unresolvedConflicts > 0 ? `
<h3>6.6 未解决证据冲突</h3>
${schemeEvidence.conflicts.filter((c) => !c.resolved).map((c) => `<div class="conflict"><p><strong>[${c.severity}]</strong> ${c.description}</p></div>`).join('')}
` : ''}

<h2>七、项目描述</h2>
<p>${projectMetadata?.description || '暂无项目描述。'}</p>

<div class="footer">
<p>本报告由「陶器残片智能复原系统」自动生成</p>
<p>报告版本 v1.0.0 | 生成于 ${now}</p>
</div>
</body>
</html>`;
  }

  if (format === 'markdown') {
    return `# 考古陶器复原标准化报告\n\n**项目名称：** ${projectName}\n**方案名称：** ${scheme?.name || '未命名方案'}\n**遗址名称：** ${projectMetadata?.siteName || '—'}\n**考古学家：** ${projectMetadata?.archaeologist || '—'}\n**发掘日期：** ${projectMetadata?.excavationDate || '—'}\n**生成时间：** ${now}\n**报告生成人：** ${generatedBy}\n\n---\n\n## 一、复原方案概述\n\n${scheme?.description || '暂无方案描述。'}\n\n${schemeEvidence.reconstructionBasis ? `**复原依据：** ${schemeEvidence.reconstructionBasis}\n` : ''}\n\n## 二、复原轮廓图\n\n> 轮廓图展示了基于残片关键点复原的陶器侧面轮廓，包含左右对称轮廓线及尺寸标注。\n\n## 三、尺寸数据与匹配度分析\n\n${schemeMetrics ? `| 指标 | 数值 |\n| --- | --- |\n| 匹配度 | ${schemeMetrics.matchScore.toFixed(1)}% |\n| 口径 | ${schemeMetrics.estimatedRimDiameter > 0 ? schemeMetrics.estimatedRimDiameter.toFixed(1) + ' mm' : '—'} |\n| 器高 | ${schemeMetrics.estimatedHeight > 0 ? schemeMetrics.estimatedHeight.toFixed(1) + ' mm' : '—'} |\n${schemeMetrics.estimatedBaseDiameter ? `| 底径 | ${schemeMetrics.estimatedBaseDiameter.toFixed(1)} mm |\n` : ''}${schemeMetrics.estimatedWallThickness ? `| 壁厚 | ${schemeMetrics.estimatedWallThickness.toFixed(1)} mm |\n` : ''}` : '暂无度量数据。'}\n\n## 四、断裂点分析\n\n${breakPointInfos.length > 0 ? `| 序号 | 位置 | 侧别 | 间隙距离 (mm) |\n| --- | --- | --- | --- |\n${breakPointInfos.map((bp, i) => `| ${i + 1} | (${bp.x.toFixed(1)}, ${bp.y.toFixed(1)}) | ${bp.side} | ${bp.gapDistance.toFixed(1)} |`).join('\n')}\n\n共检测到 ${breakPointInfos.length} 处轮廓断裂。` : '轮廓连续，未检测到断裂点。'}\n\n## 五、残片明细（共 ${schemeSherds.length} 件）\n\n${schemeSherds.map((s, i) => `### 5.${i + 1} ${s.sherd?.sherdNumber || '—'}\n\n- **厚度：** ${s.sherd?.thickness || '—'} mm\n- **关键点：** ${s.sherd?.keyPoints.length || 0} 个\n- **纹饰：** ${s.sherd?.patternPosition || '无'}\n${s.sherdEvidence ? `- **证据标注：** 年代 ${s.sherdEvidence.chronologyJudgments.length} · 地层 ${s.sherdEvidence.stratigraphyInfos.length} · 参考 ${s.sherdEvidence.referenceArtifacts.length} · 意见 ${s.sherdEvidence.expertOpinions.length}` : '- **证据标注：** 暂无'}\n${s.sherd?.notes ? `- **备注：** ${s.sherd.notes}` : ''}\n`).join('\n')}\n\n## 六、证据链摘要\n\n### 6.1 统计概览\n\n- **证据来源：** ${totalEvidenceCount}\n- **年代判断：** ${totalChronology}\n- **地层信息：** ${totalStratigraphy}\n- **参考器物：** ${totalReferences}\n- **专家意见：** ${totalOpinions}\n\n### 6.2 方案年代判断\n\n${schemeEvidence.chronologyJudgments.length > 0 ? schemeEvidence.chronologyJudgments.map((c) => `- **${c.period}**${c.dynasty ? `（${c.dynasty}）` : ''} - 置信度：${c.confidenceLevel}\n  - 依据：${c.basis}\n  - 判断人：${c.createdBy}`).join('\n\n') : '暂无年代判断。'}\n\n### 6.3 方案地层信息\n\n${schemeEvidence.stratigraphyInfos.length > 0 ? schemeEvidence.stratigraphyInfos.map((s) => `- **第 ${s.layerNumber} 层** - 置信度：${s.confidenceLevel}\n  - ${s.layerDescription || ''}\n  - 深度：${s.depthFrom || 0} - ${s.depthTo || 0} m\n  - 记录人：${s.createdBy}`).join('\n\n') : '暂无地层信息。'}\n\n### 6.4 参考器物\n\n${schemeEvidence.referenceArtifacts.length > 0 ? schemeEvidence.referenceArtifacts.map((r) => `- **${r.artifactName}** (${r.artifactType}) - 相似度：${r.similarityScore}%\n  - ${r.similarityDescription}\n  - ${r.museumOrCollection || ''}${r.catalogNumber ? ` · ${r.catalogNumber}` : ''}\n  - 置信度：${r.confidenceLevel}`).join('\n\n') : '暂无参考器物。'}\n\n### 6.5 专家意见\n\n${schemeEvidence.expertOpinions.length > 0 ? schemeEvidence.expertOpinions.map((o) => `- **${o.expertName}**${o.expertTitle ? ` - ${o.expertTitle}` : ''} - ${o.opinionType}\n  - ${o.content}`).join('\n\n') : '暂无专家意见。'}\n\n${unresolvedConflicts > 0 ? `### 6.6 未解决证据冲突\n\n${schemeEvidence.conflicts.filter((c) => !c.resolved).map((c) => `- [${c.severity}] ${c.description}`).join('\n')}\n` : ''}\n\n## 七、项目描述\n\n${projectMetadata?.description || '暂无。'}\n\n---\n\n*本报告由「陶器残片智能复原系统」自动生成 | v1.0.0 | ${now}*\n`;
  }

  if (format === 'json') {
    const reportData = {
      version: '1.0.0',
      generatedAt: now,
      generatedBy,
      project: { name: projectName, metadata: projectMetadata },
      scheme: scheme
        ? {
            id: scheme.id,
            name: scheme.name,
            description: scheme.description,
            isTrusted: scheme.isTrusted,
            sherdCount: scheme.sherdPlacements.length,
          }
        : null,
      metrics: schemeMetrics,
      contributions: schemeContributions,
      breakPoints: breakPointInfos,
      sherds: schemeSherds.map((s) => ({
        sherdNumber: s.sherd?.sherdNumber,
        thickness: s.sherd?.thickness,
        scale: s.sherd?.scale,
        keyPointCount: s.sherd?.keyPoints.length,
        evidence: {
          chronologyCount: s.sherdEvidence?.chronologyJudgments.length || 0,
          stratigraphyCount: s.sherdEvidence?.stratigraphyInfos.length || 0,
          referenceCount: s.sherdEvidence?.referenceArtifacts.length || 0,
          opinionCount: s.sherdEvidence?.expertOpinions.length || 0,
        },
      })),
      evidence: {
        scheme: {
          evidenceSources: schemeEvidence.evidenceSources,
          chronologyJudgments: schemeEvidence.chronologyJudgments,
          stratigraphyInfos: schemeEvidence.stratigraphyInfos,
          referenceArtifacts: schemeEvidence.referenceArtifacts,
          expertOpinions: schemeEvidence.expertOpinions,
          conflicts: schemeEvidence.conflicts,
        },
        totalCounts: {
          evidenceSources: totalEvidenceCount,
          chronology: totalChronology,
          stratigraphy: totalStratigraphy,
          references: totalReferences,
          opinions: totalOpinions,
        },
      },
    };
    return JSON.stringify(reportData, null, 2);
  }

  return `考古陶器复原标准化报告
========================

项目名称：${projectName}
方案名称：${scheme?.name || '未命名方案'}
遗址名称：${projectMetadata?.siteName || '—'}
考古学家：${projectMetadata?.archaeologist || '—'}
发掘日期：${projectMetadata?.excavationDate || '—'}
生成时间：${now}
报告生成人：${generatedBy}

【一、复原方案概述】
${scheme?.description || '暂无方案描述。'}

【二、尺寸数据与匹配度】
${schemeMetrics ? `匹配度：${schemeMetrics.matchScore.toFixed(1)}%
口径：${schemeMetrics.estimatedRimDiameter > 0 ? schemeMetrics.estimatedRimDiameter.toFixed(1) + ' mm' : '—'}
器高：${schemeMetrics.estimatedHeight > 0 ? schemeMetrics.estimatedHeight.toFixed(1) + ' mm' : '—'}${schemeMetrics.estimatedBaseDiameter ? '\n底径：' + schemeMetrics.estimatedBaseDiameter.toFixed(1) + ' mm' : ''}` : '暂无度量数据。'}

【三、断裂点分析】
${breakPointInfos.length > 0 ? breakPointInfos.map((bp, i) => `${i + 1}. 位置(${bp.x.toFixed(1)},${bp.y.toFixed(1)}) ${bp.side}侧 间隙${bp.gapDistance.toFixed(1)}mm`).join('\n') : '轮廓连续，无断裂点。'}

【四、残片明细】共 ${schemeSherds.length} 件
${schemeSherds.map((s, i) => `${i + 1}. ${s.sherd?.sherdNumber} 厚度${s.sherd?.thickness}mm ${s.sherd?.keyPoints.length || 0}关键点`).join('\n')}

【五、证据链摘要】
证据来源 ${totalEvidenceCount} | 年代判断 ${totalChronology} | 地层 ${totalStratigraphy} | 参考 ${totalReferences} | 专家 ${totalOpinions}

========================
本报告由「陶器残片智能复原系统」自动生成
v1.0.0 | ${now}
`;
}
