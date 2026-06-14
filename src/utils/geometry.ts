import type { Point2D, ContourPoint, KeyPoint, ValidationResult } from '@/types';

export function distance(a: Point2D, b: Point2D): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

export function rotatePoint(point: Point2D, center: Point2D, angleDeg: number): Point2D {
  const angleRad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

export function scalePoint(point: Point2D, center: Point2D, scale: number): Point2D {
  return {
    x: center.x + (point.x - center.x) * scale,
    y: center.y + (point.y - center.y) * scale,
  };
}

export function mirrorPoint(point: Point2D, axisX: number): Point2D {
  return {
    x: 2 * axisX - point.x,
    y: point.y,
  };
}

export function averagePoints(points: Point2D[]): Point2D {
  if (points.length === 0) return { x: 0, y: 0 };
  const sum = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  );
  return { x: sum.x / points.length, y: sum.y / points.length };
}

export function fitCircle(points: Point2D[]): { center: Point2D; radius: number } | null {
  if (points.length < 3) return null;

  let sumX = 0, sumY = 0, sumX2 = 0, sumY2 = 0, sumXY = 0, sumX3 = 0, sumY3 = 0, sumXY2 = 0, sumX2Y = 0;
  const n = points.length;

  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumX2 += p.x * p.x;
    sumY2 += p.y * p.y;
    sumXY += p.x * p.y;
    sumX3 += p.x * p.x * p.x;
    sumY3 += p.y * p.y * p.y;
    sumXY2 += p.x * p.y * p.y;
    sumX2Y += p.x * p.x * p.y;
  }

  const a = n * sumX2 - sumX * sumX;
  const b = n * sumXY - sumX * sumY;
  const c = n * sumY2 - sumY * sumY;
  const d = 0.5 * (n * (sumX3 + sumXY2) - sumX * (sumX2 + sumY2));
  const e = 0.5 * (n * (sumY3 + sumX2Y) - sumY * (sumX2 + sumY2));

  const det = a * c - b * b;
  if (Math.abs(det) < 1e-10) return null;

  const cx = (d * c - b * e) / det;
  const cy = (a * e - b * d) / det;

  const radius = points.reduce((acc, p) => acc + distance(p, { x: cx, y: cy }), 0) / n;

  return { center: { x: cx, y: cy }, radius };
}

export function detectContourBreaks(points: ContourPoint[], threshold: number = 30): ContourPoint[] {
  const breaks: ContourPoint[] = [];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    if (distance(prev, curr) > threshold) {
      breaks.push({ ...curr, isBreakPoint: true });
    }
  }
  return breaks;
}

export function interpolatePoints(points: Point2D[], segments: number = 20): Point2D[] {
  if (points.length < 2) return points;
  const result: Point2D[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    for (let j = 0; j < segments; j++) {
      const t = j / segments;
      result.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
      });
    }
  }
  result.push(points[points.length - 1]);
  return result;
}

export function validateKeyPointsInBounds(
  keyPoints: KeyPoint[],
  imageWidth: number,
  imageHeight: number
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const kp of keyPoints) {
    if (kp.x < 0 || kp.x > imageWidth || kp.y < 0 || kp.y > imageHeight) {
      errors.push(`关键点 ${kp.label || kp.id} 超出图像边界`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateScale(scale: number): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (scale <= 0) {
    errors.push('比例尺必须大于零');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export async function computeImageHash(dataUrl: string): Promise<string> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });

  const canvas = document.createElement('canvas');
  const size = 16;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl.substring(0, 100);

  ctx.drawImage(img, 0, 0, size, size);
  const imageData = ctx.getImageData(0, 0, size, size).data;

  const grayValues: number[] = [];
  for (let i = 0; i < imageData.length; i += 4) {
    const gray = (imageData[i] + imageData[i + 1] + imageData[i + 2]) / 3;
    grayValues.push(gray);
  }

  const avgGray = grayValues.reduce((a, b) => a + b, 0) / grayValues.length;

  let hash = '';
  for (let i = 0; i < grayValues.length; i++) {
    hash += grayValues[i] >= avgGray ? '1' : '0';
  }

  return hash;
}

export function hammingDistance(hash1: string, hash2: string): number {
  let distance = 0;
  const minLen = Math.min(hash1.length, hash2.length);
  for (let i = 0; i < minLen; i++) {
    if (hash1[i] !== hash2[i]) distance++;
  }
  return distance + Math.abs(hash1.length - hash2.length);
}

export function isSimilarImage(hash1: string, hash2: string, threshold: number = 10): boolean {
  return hammingDistance(hash1, hash2) <= threshold;
}

export function calculateThicknessConsistency(
  thicknesses: number[]
): { score: number; avgThickness: number; stdDev: number; maxDeviation: number } {
  if (thicknesses.length === 0) return { score: 0, avgThickness: 0, stdDev: 0, maxDeviation: 0 };

  const avgThickness = thicknesses.reduce((a, b) => a + b, 0) / thicknesses.length;
  const variance = thicknesses.reduce((acc, t) => acc + (t - avgThickness) ** 2, 0) / thicknesses.length;
  const stdDev = Math.sqrt(variance);
  const maxDeviation = Math.max(...thicknesses.map(t => Math.abs(t - avgThickness)));

  const coefficientOfVariation = avgThickness > 0 ? stdDev / avgThickness : 1;
  let score = Math.max(0, 100 - coefficientOfVariation * 100 * 2.5);

  if (thicknesses.length >= 3 && maxDeviation / avgThickness > 0.3) {
    score -= 10;
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    avgThickness,
    stdDev,
    maxDeviation,
  };
}

export function calculatePatternAlignmentScore(
  patternPoints: { x: number; y: number; position?: string }[],
  centerAxisX: number
): number {
  if (patternPoints.length < 2) return 100;

  const mirroredPoints = patternPoints.map((p) => ({
    original: p,
    mirrored: mirrorPoint(p, centerAxisX),
  }));

  let totalDistance = 0;
  let pairs = 0;
  let positionBonus = 0;

  for (let i = 0; i < mirroredPoints.length; i++) {
    for (let j = i + 1; j < mirroredPoints.length; j++) {
      const p1 = mirroredPoints[i].original;
      const p2 = mirroredPoints[j].original;

      const d1 = distance(p1, mirroredPoints[j].mirrored);
      const d2 = distance(p2, mirroredPoints[i].mirrored);
      totalDistance += Math.min(d1, d2);
      pairs++;

      if (p1.position && p2.position && p1.position === p2.position) {
        positionBonus += 2;
      }
    }
  }

  if (pairs === 0) return 100;

  const avgDistance = totalDistance / pairs;
  let score = Math.max(0, 100 - avgDistance * 0.6);

  if (patternPoints.length >= 4) {
    score += Math.min(positionBonus, 10);
  }

  const yValues = patternPoints.map(p => p.y);
  const yGroups: { y: number; xDist: number }[][] = [];
  const used = new Set<number>();
  
  for (let i = 0; i < yValues.length; i++) {
    if (used.has(i)) continue;
    const group: { y: number; xDist: number }[] = [];
    group.push({ y: yValues[i], xDist: Math.abs(patternPoints[i].x - centerAxisX) });
    used.add(i);
    for (let j = i + 1; j < yValues.length; j++) {
      if (!used.has(j) && Math.abs(yValues[i] - yValues[j]) < 20) {
        group.push({ y: yValues[j], xDist: Math.abs(patternPoints[j].x - centerAxisX) });
        used.add(j);
      }
    }
    yGroups.push(group);
  }

  let symmetryScore = 0;
  yGroups.forEach(group => {
    if (group.length >= 2) {
      const xDists = group.map(g => g.xDist);
      const xAvg = xDists.reduce((a, b) => a + b, 0) / xDists.length;
      const xVariance = xDists.reduce((acc, x) => acc + (x - xAvg) ** 2, 0) / xDists.length;
      const xStdDev = Math.sqrt(xVariance);
      symmetryScore += Math.max(0, 10 - xStdDev * 0.2);
    }
  });

  score += Math.min(symmetryScore, 15);

  return Math.min(100, Math.max(0, score));
}
