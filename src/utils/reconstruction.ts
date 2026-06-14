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
