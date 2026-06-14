import { useEffect, useRef, useMemo } from 'react';
import * as fabric from 'fabric';
import { Card, Text, Stack } from '@mantine/core';
import { useAppStore } from '@/store';
import { transformKeyPoints, buildContour, calculateMetrics } from '@/utils/reconstruction';
import type { ReconstructionMetrics } from '@/types';

interface ReconstructionCanvasProps {
  onMetricsChange?: (metrics: ReconstructionMetrics | null) => void;
}

interface FabricImageWithData extends fabric.Image {
  sherdId?: string;
}

export function ReconstructionCanvas({ onMetricsChange }: ReconstructionCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const sherdImagesRef = useRef<Map<string, fabric.Image>>(new Map());
  const previousMetricsRef = useRef<ReconstructionMetrics | null>(null);

  const sherds = useAppStore((s) => s.sherds);
  const activeScheme = useAppStore((s) =>
    s.activeSchemeId ? s.schemes.find((sc) => sc.id === s.activeSchemeId) : null
  );
  const updateSherdPlacement = useAppStore((s) => s.updateSherdPlacement);
  const toggleSchemeTrusted = useAppStore((s) => s.toggleSchemeTrusted);
  const updateScheme = useAppStore((s) => s.updateScheme);

  const canvasCenter = useMemo(() => ({ x: 400, y: 300 }), []);
  const centerAxisX = canvasCenter.x;

  useEffect(() => {
    if (!canvasRef.current || fabricCanvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      backgroundColor: '#fafbfc',
      selection: true,
    });
    fabricCanvasRef.current = canvas;

    canvas.on('object:modified', (opt) => {
      if (!activeScheme) return;
      const obj = opt.target as FabricImageWithData;
      if (!obj || !obj.sherdId) return;

      const sherdId = obj.sherdId as string;
      const sherd = sherds.find((s) => s.id === sherdId);
      if (!sherd) return;

      const scale = obj.scaleX || 1;
      const rotation = obj.angle || 0;
      const imgCenterX = sherd.image.width * scale / 2;
      const imgCenterY = sherd.image.height * scale / 2;

      const offsetX = (obj.left || 0) + imgCenterX - (canvasCenter.x - sherd.image.width / 2);
      const offsetY = (obj.top || 0) + imgCenterY - (canvasCenter.y - sherd.image.height / 2);

      updateSherdPlacement(activeScheme.id, sherdId, {
        rotation,
        scale,
        offsetX,
        offsetY,
      });
    });

    return () => {
      canvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, [activeScheme, sherds, canvasCenter, updateSherdPlacement]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    canvas.clear();
    sherdImagesRef.current.clear();

    const axisLine = new fabric.Line(
      [centerAxisX, 20, centerAxisX, 580],
      {
        stroke: '#6366f1',
        strokeWidth: 2,
        strokeDashArray: [8, 4],
        selectable: false,
        evented: false,
      }
    );
    canvas.add(axisLine);

    const axisLabel = new fabric.Text('中心轴', {
      left: centerAxisX + 8,
      top: 20,
      fontSize: 12,
      fill: '#6366f1',
      selectable: false,
      evented: false,
    });
    canvas.add(axisLabel);

    if (!activeScheme || activeScheme.sherdPlacements.length === 0) {
      canvas.renderAll();
      onMetricsChange?.(null);
      previousMetricsRef.current = null;
      return;
    }

    const allTransformedPoints: ReturnType<typeof transformKeyPoints> = [];

    const imagePromises: Promise<void>[] = [];

    activeScheme.sherdPlacements.forEach((placement) => {
      const sherd = sherds.find((s) => s.id === placement.sherdId);
      if (!sherd) return;

      const transformed = transformKeyPoints(sherd, placement, canvasCenter);
      allTransformedPoints.push(...transformed);

      const imgScale = Math.min(
        300 / sherd.image.width,
        300 / sherd.image.height,
        0.8
      );

      const promise = fabric.Image.fromURL(sherd.image.dataUrl, { crossOrigin: 'anonymous' }).then((img: fabric.Image) => {
        const finalScale = imgScale * placement.scale;
        const baseLeft = canvasCenter.x - sherd.image.width / 2;
        const baseTop = canvasCenter.y - sherd.image.height / 2;

        img.set({
          left: baseLeft + placement.offsetX - (sherd.image.width * finalScale) / 2 + sherd.image.width / 2,
          top: baseTop + placement.offsetY - (sherd.image.height * finalScale) / 2 + sherd.image.height / 2,
          scaleX: finalScale,
          scaleY: finalScale,
          angle: placement.rotation,
          opacity: 0.85,
          borderColor: '#6366f1',
          cornerColor: '#6366f1',
          cornerSize: 8,
          transparentCorners: false,
        });
        (img as FabricImageWithData).sherdId = sherd.id;

        canvas.add(img);
        sherdImagesRef.current.set(sherd.id, img);

        transformed.forEach((kp) => {
          const colors: Record<string, string> = {
            rim: '#ef4444',
            body: '#3b82f6',
            base: '#22c55e',
            pattern: '#a855f7',
          };
          const circle = new fabric.Circle({
            radius: 5,
            fill: colors[kp.type],
            stroke: '#fff',
            strokeWidth: 1.5,
            left: kp.transformedX,
            top: kp.transformedY,
            originX: 'center',
            originY: 'center',
            selectable: false,
            evented: false,
          });
          canvas.add(circle);
        });

        canvas.renderAll();
      });

      imagePromises.push(promise);
    });

    const contour = buildContour(allTransformedPoints, centerAxisX);
    if (contour.length > 2) {
      const contourPoints = contour.map((p) => ({ x: p.x, y: p.y }));
      const polygon = new fabric.Polygon(contourPoints, {
        fill: 'rgba(99, 102, 241, 0.1)',
        stroke: '#6366f1',
        strokeWidth: 2,
        selectable: false,
        evented: false,
      });
      canvas.add(polygon);
      canvas.sendObjectToBack(polygon);
    }

    let avgScale = 1;
    if (activeScheme.sherdPlacements.length > 0) {
      avgScale =
        activeScheme.sherdPlacements.reduce((acc, p) => {
          const sherd = sherds.find((s) => s.id === p.sherdId);
          return acc + (sherd?.scale || 1);
        }, 0) / activeScheme.sherdPlacements.length;
    }
    const metrics = calculateMetrics(allTransformedPoints, contour, centerAxisX, avgScale);

    if (metrics.hasContourBreak && activeScheme.isTrusted) {
      updateScheme(activeScheme.id, { isTrusted: false });
    }

    const isSignificantChange =
      !previousMetricsRef.current ||
      Math.abs(previousMetricsRef.current.estimatedRimDiameter - metrics.estimatedRimDiameter) > 0.1 ||
      Math.abs(previousMetricsRef.current.estimatedHeight - metrics.estimatedHeight) > 0.1 ||
      Math.abs(previousMetricsRef.current.matchScore - metrics.matchScore) > 0.5 ||
      previousMetricsRef.current.hasContourBreak !== metrics.hasContourBreak;

    if (isSignificantChange) {
      previousMetricsRef.current = metrics;
      onMetricsChange?.(metrics);
    }

    canvas.renderAll();
  }, [activeScheme, sherds, canvasCenter, centerAxisX, onMetricsChange, toggleSchemeTrusted, updateScheme]);

  return (
    <Card shadow="sm" padding="md" radius="md" withBorder h="100%">
      <Stack gap="sm" h="100%">
        <Text fw={600} size="lg">
          {activeScheme ? `复原预览：${activeScheme.name}` : '复原预览'}
        </Text>
        <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            style={{
              width: '100%',
              height: '100%',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
            }}
          />
          {!activeScheme && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(250, 251, 252, 0.9)',
              }}
            >
              <Text c="dimmed">请从右侧创建或选择一个复原方案</Text>
            </div>
          )}
        </div>
      </Stack>
    </Card>
  );
}
