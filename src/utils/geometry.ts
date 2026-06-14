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
      breaks.push(curr);
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
