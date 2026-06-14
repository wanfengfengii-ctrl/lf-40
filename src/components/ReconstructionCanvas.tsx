import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import * as fabric from 'fabric';
import { Card, Text, Stack, Group, Badge, ActionIcon, Tooltip, ScrollArea, List } from '@mantine/core';
import { useAppStore } from '@/store';
import { transformKeyPoints, buildContour, calculateMetricsWithContributions } from '@/utils/reconstruction';
import { distance } from '@/utils/geometry';
import type { ReconstructionMetrics, BreakPointInfo, MetricsContribution, SherdPlacement } from '@/types';
import { IconBolt, IconCrosshair, IconAlertTriangle, IconRefresh } from '@tabler/icons-react';

interface ReconstructionCanvasProps {
  onMetricsChange?: (metrics: ReconstructionMetrics | null) => void;
}

interface FabricImageWithData extends fabric.Image {
  sherdId?: string;
}

interface CachedImageData {
  image: fabric.Image;
  placement: SherdPlacement;
  keyPointCircles: fabric.Circle[];
}

export function ReconstructionCanvas({ onMetricsChange }: ReconstructionCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const cachedSherdDataRef = useRef<Map<string, CachedImageData>>(new Map());
  const rafRef = useRef<number | null>(null);
  const pendingMetricsRef = useRef<ReconstructionMetrics | null>(null);
  const updateRafRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const lastUpdateTimeRef = useRef(0);
  const activeSchemeRef = useRef<typeof activeScheme>(null);
  const sherdsRef = useRef<typeof sherds>([]);
  const scheduleVisualUpdateRef = useRef<() => void>(() => {});
  const updateCanvasVisualsRef = useRef<() => void>(() => {});
  const [calcTime, setCalcTime] = useState<number | null>(null);
  const [breakPointInfos, setBreakPointInfos] = useState<BreakPointInfo[]>([]);
  const [contributions, setContributions] = useState<MetricsContribution | null>(null);
  const [isRealTime, setIsRealTime] = useState(false);

  const sherds = useAppStore((s) => s.sherds);
  const weightConfig = useAppStore((s) => s.weightConfig);
  const activeScheme = useAppStore((s) =>
    s.activeSchemeId ? s.schemes.find((sc) => sc.id === s.activeSchemeId) : null
  );
  const updateSherdPlacement = useAppStore((s) => s.updateSherdPlacement);
  const updateScheme = useAppStore((s) => s.updateScheme);
  const invalidateMetricsCache = useAppStore((s) => s.invalidateMetricsCache);

  const canvasCenter = useMemo(() => ({ x: 400, y: 300 }), []);
  const centerAxisX = canvasCenter.x;

  useEffect(() => {
    activeSchemeRef.current = activeScheme;
  }, [activeScheme]);

  useEffect(() => {
    sherdsRef.current = sherds;
  }, [sherds]);

  const scheduleMetricsUpdate = useCallback((metrics: ReconstructionMetrics) => {
    pendingMetricsRef.current = metrics;
    if (rafRef.current !== null) return;

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const m = pendingMetricsRef.current;
      pendingMetricsRef.current = null;
      if (m) {
        setCalcTime(m.calculationTime || 0);
        onMetricsChange?.(m);
      }
    });
  }, [onMetricsChange]);

  const scheduleFastMetricsUpdate = useCallback((metrics: ReconstructionMetrics) => {
    pendingMetricsRef.current = metrics;
    setCalcTime(metrics.calculationTime || 0);
    onMetricsChange?.(metrics);
  }, [onMetricsChange]);

  const computeMetricsFast = useCallback((scheme: typeof activeScheme, currentSherds: typeof sherds) => {
    if (!scheme || scheme.sherdPlacements.length === 0) return null;

    const startTime = performance.now();
    const allTransformedPoints: ReturnType<typeof transformKeyPoints> = [];

    scheme.sherdPlacements.forEach((placement) => {
      const sherd = currentSherds.find((s) => s.id === placement.sherdId);
      if (!sherd) return;
      allTransformedPoints.push(...transformKeyPoints(sherd, placement, canvasCenter));
    });

    const contour = buildContour(allTransformedPoints, centerAxisX);
    
    let avgScale = 1;
    if (scheme.sherdPlacements.length > 0) {
      avgScale = scheme.sherdPlacements.reduce((acc, p) => {
        const sherd = currentSherds.find((s) => s.id === p.sherdId);
        return acc + (sherd?.scale || 1);
      }, 0) / scheme.sherdPlacements.length;
    }

    const result = calculateMetricsWithContributions(allTransformedPoints, contour, centerAxisX, avgScale, currentSherds, weightConfig);
    result.metrics.calculationTime = performance.now() - startTime;

    return result;
  }, [canvasCenter, centerAxisX, weightConfig]);

  const recalcAndNotifyLocal = useCallback((schemeId: string, metrics: ReconstructionMetrics, contribs: MetricsContribution, bpInfos: BreakPointInfo[]) => {
    const store = useAppStore.getState();
    const newMetricsCache = new Map(store.cachedMetrics);
    newMetricsCache.set(schemeId, metrics);
    const newContribCache = new Map(store.cachedContributions);
    newContribCache.set(schemeId, contribs);
    const newBpCache = new Map(store.cachedBreakPointInfos);
    newBpCache.set(schemeId, bpInfos);

    useAppStore.setState({
      cachedMetrics: newMetricsCache,
      cachedContributions: newContribCache,
      cachedBreakPointInfos: newBpCache,
      lastMetricsUpdate: Date.now(),
    });
  }, []);

  const updateCanvasVisuals = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !activeScheme) return;

    const result = computeMetricsFast(activeScheme, sherds);
    if (!result) return;

    const { metrics, contributions: contribs, breakPointInfos: bpInfos } = result;

    const existingPolygon = canvas.getObjects().find((obj) => obj.type === 'polygon');
    if (existingPolygon) {
      const allTransformedPoints: ReturnType<typeof transformKeyPoints> = [];
      activeScheme.sherdPlacements.forEach((placement) => {
        const sherd = sherds.find((s) => s.id === placement.sherdId);
        if (!sherd) return;
        allTransformedPoints.push(...transformKeyPoints(sherd, placement, canvasCenter));
      });
      const contour = buildContour(allTransformedPoints, centerAxisX);
      if (contour.length > 2) {
        const contourPoints = contour.map((p) => ({ x: p.x, y: p.y }));
        (existingPolygon as fabric.Polygon).set({ points: contourPoints });
      }
    }

    canvas.getObjects().forEach((obj) => {
      if (obj.type === 'circle' && (obj as fabric.Circle).radius === 14) {
        canvas.remove(obj);
      }
    });

    setBreakPointInfos(bpInfos);
    setContributions(contribs);

    if (metrics.hasContourBreak && metrics.breakPoints.length > 0) {
      metrics.breakPoints.forEach((bp) => {
        const glow = new fabric.Circle({
          radius: 14,
          fill: 'rgba(239, 68, 68, 0.25)',
          stroke: '#ef4444',
          strokeWidth: 0,
          left: bp.x,
          top: bp.y,
          originX: 'center',
          originY: 'center',
          selectable: false,
          evented: false,
        });
        canvas.add(glow);

        const breakMarker = new fabric.Circle({
          radius: 8,
          fill: '#ef4444',
          stroke: '#fff',
          strokeWidth: 2,
          left: bp.x,
          top: bp.y,
          originX: 'center',
          originY: 'center',
          selectable: false,
          evented: false,
        });
        canvas.add(breakMarker);

        const breakText = new fabric.Text('!', {
          left: bp.x,
          top: bp.y,
          fontSize: 11,
          fontWeight: 'bold',
          fill: '#fff',
          originX: 'center',
          originY: 'center',
          selectable: false,
          evented: false,
        });
        canvas.add(breakText);
      });
    }

    if (metrics.hasContourBreak && activeScheme.isTrusted) {
      updateScheme(activeScheme.id, { isTrusted: false });
    }

    scheduleFastMetricsUpdate(metrics);
    canvas.renderAll();

    if (!isDraggingRef.current) {
      invalidateMetricsCache(activeScheme.id);
    } else {
      recalcAndNotifyLocal(activeScheme.id, metrics, contribs, bpInfos);
    }
  }, [activeScheme, sherds, computeMetricsFast, updateScheme, scheduleFastMetricsUpdate, invalidateMetricsCache, canvasCenter, centerAxisX, recalcAndNotifyLocal]);

  const scheduleVisualUpdate = useCallback(() => {
    const now = performance.now();
    if (now - lastUpdateTimeRef.current < 8) return;
    lastUpdateTimeRef.current = now;

    if (updateRafRef.current !== null) return;

    updateRafRef.current = requestAnimationFrame(() => {
      updateRafRef.current = null;
      updateCanvasVisuals();
    });
  }, [updateCanvasVisuals]);

  useEffect(() => {
    scheduleVisualUpdateRef.current = scheduleVisualUpdate;
  }, [scheduleVisualUpdate]);

  useEffect(() => {
    updateCanvasVisualsRef.current = updateCanvasVisuals;
  }, [updateCanvasVisuals]);

  useEffect(() => {
    if (!canvasRef.current || fabricCanvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      backgroundColor: '#fafbfc',
      selection: true,
    });
    fabricCanvasRef.current = canvas;

    const getImgScale = (sherd: { image: { width: number; height: number } }) =>
      Math.min(300 / sherd.image.width, 300 / sherd.image.height, 0.8);

    canvas.on('object:moving', () => {
      isDraggingRef.current = true;
      setIsRealTime(true);
      scheduleVisualUpdateRef.current?.();
    });

    canvas.on('object:scaling', () => {
      isDraggingRef.current = true;
      setIsRealTime(true);
      scheduleVisualUpdateRef.current?.();
    });

    canvas.on('object:rotating', () => {
      isDraggingRef.current = true;
      setIsRealTime(true);
      scheduleVisualUpdateRef.current?.();
    });

    canvas.on('object:modified', (opt) => {
      isDraggingRef.current = false;
      setIsRealTime(false);

      const scheme = activeSchemeRef.current;
      const currentSherds = sherdsRef.current;
      if (!scheme) return;

      const obj = opt.target as FabricImageWithData;
      if (!obj || !obj.sherdId) return;

      const sherdId = obj.sherdId as string;
      const sherd = currentSherds.find((s) => s.id === sherdId);
      if (!sherd) return;

      const imgScale = getImgScale(sherd);
      const finalScale = obj.scaleX || 1;
      const placementScale = finalScale / imgScale;
      const rotation = obj.angle || 0;

      const scaledWidth = sherd.image.width * finalScale;
      const scaledHeight = sherd.image.height * finalScale;

      const offsetX = (obj.left || 0) + scaledWidth / 2 - canvasCenter.x;
      const offsetY = (obj.top || 0) + scaledHeight / 2 - canvasCenter.y;

      updateSherdPlacement(scheme.id, sherdId, {
        rotation,
        scale: placementScale,
        offsetX,
        offsetY,
      });

      updateCanvasVisualsRef.current?.();
    });

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      if (updateRafRef.current !== null) {
        cancelAnimationFrame(updateRafRef.current);
      }
      canvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, [canvasCenter.x, canvasCenter.y, updateSherdPlacement]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    canvas.clear();
    cachedSherdDataRef.current.clear();
    setBreakPointInfos([]);
    setContributions(null);

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
      queueMicrotask(() => setCalcTime(null));
      return;
    }

    const startTime = performance.now();
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

        const keyPointCircles: fabric.Circle[] = [];

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
          keyPointCircles.push(circle);
        });

        cachedSherdDataRef.current.set(sherd.id, {
          image: img,
          placement: { ...placement },
          keyPointCircles,
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

    const result = calculateMetricsWithContributions(allTransformedPoints, contour, centerAxisX, avgScale, sherds, weightConfig);
    const metrics = result.metrics;
    metrics.calculationTime = performance.now() - startTime;

    setBreakPointInfos(result.breakPointInfos);
    setContributions(result.contributions);

    if (metrics.hasContourBreak && metrics.breakPoints.length > 0) {
      metrics.breakPoints.forEach((bp) => {
        const glow = new fabric.Circle({
          radius: 14,
          fill: 'rgba(239, 68, 68, 0.25)',
          stroke: '#ef4444',
          strokeWidth: 0,
          left: bp.x,
          top: bp.y,
          originX: 'center',
          originY: 'center',
          selectable: false,
          evented: false,
        });
        canvas.add(glow);

        const breakMarker = new fabric.Circle({
          radius: 8,
          fill: '#ef4444',
          stroke: '#fff',
          strokeWidth: 2,
          left: bp.x,
          top: bp.y,
          originX: 'center',
          originY: 'center',
          selectable: false,
          evented: false,
        });
        canvas.add(breakMarker);

        const breakText = new fabric.Text('!', {
          left: bp.x,
          top: bp.y,
          fontSize: 11,
          fontWeight: 'bold',
          fill: '#fff',
          originX: 'center',
          originY: 'center',
          selectable: false,
          evented: false,
        });
        canvas.add(breakText);
      });
    }

    if (metrics.hasContourBreak && activeScheme.isTrusted) {
      updateScheme(activeScheme.id, { isTrusted: false });
    }

    scheduleMetricsUpdate(metrics);
    canvas.renderAll();

    Promise.all(imagePromises).then(() => {
      canvas.renderAll();
    });
  }, [activeScheme?.id, activeScheme?.sherdPlacements.length, sherds.length, canvasCenter, centerAxisX, scheduleMetricsUpdate, updateScheme, weightConfig]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      if (updateRafRef.current !== null) {
        cancelAnimationFrame(updateRafRef.current);
      }
    };
  }, []);

  const handleLocateBreakPoint = (bp: BreakPointInfo) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !activeScheme) return;

    let adjacentSherdId = '';
    let minDistance = Infinity;

    activeScheme.sherdPlacements.forEach((placement) => {
      const sherd = sherds.find((s) => s.id === placement.sherdId);
      if (!sherd) return;

      const transformed = transformKeyPoints(sherd, placement, canvasCenter);
      transformed.forEach((kp) => {
        const dist = distance({ x: kp.transformedX, y: kp.transformedY }, { x: bp.x, y: bp.y });
        if (dist < minDistance) {
          minDistance = dist;
          adjacentSherdId = placement.sherdId;
        }
      });
    });

    canvas.getObjects().forEach((obj) => {
      const fabricObj = obj as FabricImageWithData;
      if (fabricObj.sherdId === adjacentSherdId) {
        fabricObj.set({
          borderColor: '#fbbf24',
          cornerColor: '#fbbf24',
          borderScaleFactor: 2,
          opacity: 1,
        });
        canvas.bringObjectToFront(fabricObj);
        setTimeout(() => {
          fabricObj.set({
            borderColor: '#6366f1',
            cornerColor: '#6366f1',
            borderScaleFactor: 1,
            opacity: 0.85,
          });
          canvas.renderAll();
        }, 2000);
      }

      if (obj.type === 'circle' && obj.selectable === false) {
        const circle = obj as fabric.Circle;
        const dist = Math.sqrt(
          ((circle.left || 0) - bp.x) ** 2 +
          ((circle.top || 0) - bp.y) ** 2
        );
        if (dist < 30) {
          circle.set({
            stroke: '#fbbf24',
            strokeWidth: 4,
          });
          setTimeout(() => {
            circle.set({ stroke: '#fff', strokeWidth: 1.5 });
            canvas.renderAll();
          }, 2000);
        }
      }
    });

    const highlight = new fabric.Circle({
      radius: 30,
      fill: 'rgba(251, 191, 36, 0.3)',
      stroke: '#fbbf24',
      strokeWidth: 3,
      left: bp.x,
      top: bp.y,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });
    canvas.add(highlight);

    const crosshairH = new fabric.Line(
      [bp.x - 20, bp.y, bp.x + 20, bp.y],
      {
        stroke: '#fbbf24',
        strokeWidth: 2,
        selectable: false,
        evented: false,
      }
    );
    canvas.add(crosshairH);

    const crosshairV = new fabric.Line(
      [bp.x, bp.y - 20, bp.x, bp.y + 20],
      {
        stroke: '#fbbf24',
        strokeWidth: 2,
        selectable: false,
        evented: false,
      }
    );
    canvas.add(crosshairV);

    const coordText = new fabric.Text(
      `断裂 #${bp.gapDistance.toFixed(0)}px`,
      {
        left: bp.x + 15,
        top: bp.y - 35,
        fontSize: 11,
        fontWeight: 'bold',
        fill: '#f59e0b',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        selectable: false,
        evented: false,
      }
    );
    canvas.add(coordText);

    canvas.renderAll();

    setTimeout(() => {
      canvas.remove(highlight);
      canvas.remove(crosshairH);
      canvas.remove(crosshairV);
      canvas.remove(coordText);
      canvas.renderAll();
    }, 2500);
  };

  return (
    <Card shadow="sm" padding="md" radius="md" withBorder h="100%">
      <Stack gap="sm" h="100%">
        <Group justify="space-between">
          <Group gap="xs">
            <Text fw={600} size="lg">
              {activeScheme ? `复原预览：${activeScheme.name}` : '复原预览'}
            </Text>
            {isRealTime && (
              <Tooltip label="实时刷新中">
                <Badge
                size="sm"
                variant="light"
                color="green"
                leftSection={<IconRefresh size={10} />}
              >
                实时
              </Badge>
              </Tooltip>
            )}
          </Group>
          <Group gap="xs">
            {calcTime !== null && (
              <Badge
                size="sm"
                variant="light"
                color={calcTime < 5 ? 'green' : calcTime < 10 ? 'lime' : calcTime < 50 ? 'yellow' : 'red'}
                leftSection={<IconBolt size={10} />}
              >
                {calcTime.toFixed(1)} ms
              </Badge>
            )}
          </Group>
        </Group>
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

        {breakPointInfos.length > 0 && (
          <Card withBorder padding="xs" radius="sm" style={{ borderColor: 'var(--mantine-color-red-3)' }}>
            <Group justify="space-between" mb={4}>
              <Group gap="xs">
                <IconAlertTriangle size={14} color="#ef4444" />
                <Text size="xs" fw={600} c="red">轮廓断裂点 ({breakPointInfos.length})</Text>
              </Group>
              <Text size="xs" c="dimmed">点击定位</Text>
            </Group>
            <ScrollArea h={60}>
              <List size="xs" spacing={2}>
                {breakPointInfos.map((bp, i) => (
                  <List.Item
                    key={i}
                    icon={
                      <Tooltip label="定位到此断裂点">
                        <ActionIcon
                          size="xs"
                          variant="subtle"
                          color="red"
                          onClick={() => handleLocateBreakPoint(bp)}
                        >
                          <IconCrosshair size={10} />
                        </ActionIcon>
                      </Tooltip>
                    }
                  >
                    <Group gap="xs">
                      <Text size="xs">
                        #{i + 1} 侧: {bp.side === 'left' ? '左' : bp.side === 'right' ? '右' : '中'}
                      </Text>
                      <Text size="xs" c="dimmed">
                        间距: {bp.gapDistance}px
                      </Text>
                      <Text size="xs" c="dimmed">
                        位置: ({bp.x.toFixed(0)}, {bp.y.toFixed(0)})
                      </Text>
                    </Group>
                  </List.Item>
                ))}
              </List>
            </ScrollArea>
          </Card>
        )}

        {contributions && (
          <Group grow>
            <Card withBorder padding="xs" radius="sm">
              <Stack gap={0} align="center">
                <Text size="xs" c="dimmed">轮廓贡献</Text>
                <Text size="sm" fw={600}>{contributions.contourContribution.toFixed(1)}</Text>
              </Stack>
            </Card>
            <Card withBorder padding="xs" radius="sm">
              <Stack gap={0} align="center">
                <Text size="xs" c="dimmed">厚度贡献</Text>
                <Text size="sm" fw={600}>{contributions.thicknessContribution.toFixed(1)}</Text>
              </Stack>
            </Card>
            <Card withBorder padding="xs" radius="sm">
              <Stack gap={0} align="center">
                <Text size="xs" c="dimmed">纹饰贡献</Text>
                <Text size="sm" fw={600}>{contributions.patternContribution.toFixed(1)}</Text>
              </Stack>
            </Card>
          </Group>
        )}
      </Stack>
    </Card>
  );
}
