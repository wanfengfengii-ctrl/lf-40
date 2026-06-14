import { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { Card, Button, Group, Text, SegmentedControl, Stack, Alert } from '@mantine/core';
import { IconPointer, IconPlus, IconHandGrab, IconAlertCircle, IconRefresh } from '@tabler/icons-react';
import { useAppStore } from '@/store';
import { validateKeyPointsInBounds } from '@/utils/geometry';

const POINT_COLORS: Record<string, string> = {
  rim: '#ef4444',
  body: '#3b82f6',
  base: '#22c55e',
  pattern: '#a855f7',
};

const POINT_LABELS: Record<string, string> = {
  rim: '口沿',
  body: '器身',
  base: '器底',
  pattern: '纹饰',
};

interface FabricCircleWithData extends fabric.Circle {
  pointId?: string;
}

export function SherdCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const fabImageRef = useRef<fabric.Image | null>(null);

  const activeSherd = useAppStore((s) =>
    s.activeSherdId ? s.sherds.find((sh) => sh.id === s.activeSherdId) : null
  );
  const selectedTool = useAppStore((s) => s.selectedTool);
  const pointType = useAppStore((s) => s.pointType);
  const setSelectedTool = useAppStore((s) => s.setSelectedTool);
  const setPointType = useAppStore((s) => s.setPointType);
  const addKeyPoint = useAppStore((s) => s.addKeyPoint);
  const removeKeyPoint = useAppStore((s) => s.removeKeyPoint);
  const updateKeyPoint = useAppStore((s) => s.updateKeyPoint);

  const [validationMsg, setValidationMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current || fabricCanvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      backgroundColor: '#f8f9fa',
      selection: true,
    });
    fabricCanvasRef.current = canvas;

    canvas.on('mouse:down', (opt) => {
      if (selectedTool !== 'addPoint' || !activeSherd) return;
      const pointer = canvas.getViewportPoint(opt.e);
      if (fabImageRef.current) {
        const imgScale = fabImageRef.current.scaleX || 1;
        const imgLeft = fabImageRef.current.left || 0;
        const imgTop = fabImageRef.current.top || 0;
        const localX = (pointer.x - imgLeft) / imgScale;
        const localY = (pointer.y - imgTop) / imgScale;

        if (
          localX >= 0 && localX <= activeSherd.image.width &&
          localY >= 0 && localY <= activeSherd.image.height
        ) {
          addKeyPoint(activeSherd.id, {
            x: localX,
            y: localY,
            type: pointType,
            label: `${POINT_LABELS[pointType]} ${activeSherd.keyPoints.filter(k => k.type === pointType).length + 1}`,
          });
        } else {
          setValidationMsg('关键点不能超出图像边界');
          setTimeout(() => setValidationMsg(null), 2000);
        }
      }
    });

    canvas.on('object:modified', (opt) => {
      if (!activeSherd || !fabImageRef.current) return;
      const obj = opt.target as FabricCircleWithData;
      if (!obj || !obj.pointId) return;

      const imgScale = fabImageRef.current.scaleX || 1;
      const imgLeft = fabImageRef.current.left || 0;
      const imgTop = fabImageRef.current.top || 0;
      const localX = ((obj.left || 0) - imgLeft) / imgScale;
      const localY = ((obj.top || 0) - imgTop) / imgScale;

      const boundedX = Math.max(0, Math.min(activeSherd.image.width, localX));
      const boundedY = Math.max(0, Math.min(activeSherd.image.height, localY));

      if (boundedX !== localX || boundedY !== localY) {
        setValidationMsg('关键点不能超出图像边界，已自动修正');
        setTimeout(() => setValidationMsg(null), 2000);
        obj.set({
          left: boundedX * imgScale + imgLeft,
          top: boundedY * imgScale + imgTop,
        });
        canvas.renderAll();
      }

      updateKeyPoint(activeSherd.id, obj.pointId, {
        x: boundedX,
        y: boundedY,
      });
    });

    canvas.on('selection:created', () => {
      if (selectedTool === 'addPoint') {
        canvas.discardActiveObject();
        canvas.renderAll();
      }
    });

    return () => {
      canvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, [selectedTool, pointType, activeSherd, addKeyPoint, updateKeyPoint]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    canvas.selection = selectedTool === 'select';
    canvas.forEachObject((obj) => {
      if (obj.type === 'circle') {
        obj.set({
          selectable: selectedTool === 'select',
          evented: selectedTool === 'select',
        });
      }
    });

    if (fabImageRef.current && selectedTool === 'move') {
      fabImageRef.current.set({
        selectable: true,
        evented: true,
      });
    } else if (fabImageRef.current) {
      fabImageRef.current.set({
        selectable: false,
        evented: false,
      });
    }

    canvas.renderAll();
  }, [selectedTool]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    canvas.clear();
    fabImageRef.current = null;
    setValidationMsg(null);

    if (!activeSherd) {
      canvas.backgroundColor = '#f8f9fa';
      canvas.renderAll();
      return;
    }

    fabric.Image.fromURL(activeSherd.image.dataUrl, { crossOrigin: 'anonymous' }).then((img) => {
      const canvasWidth = canvas.width || 600;
      const canvasHeight = canvas.height || 500;
      const scale = Math.min(
        (canvasWidth - 40) / activeSherd.image.width,
        (canvasHeight - 40) / activeSherd.image.height,
        1
      );

      img.set({
        left: (canvasWidth - activeSherd.image.width * scale) / 2,
        top: (canvasHeight - activeSherd.image.height * scale) / 2,
        scaleX: scale,
        scaleY: scale,
        selectable: selectedTool === 'move',
        evented: selectedTool === 'move',
      });

      canvas.add(img);
      fabImageRef.current = img;

      activeSherd.keyPoints.forEach((kp) => {
        const circle = new fabric.Circle({
          radius: 6,
          fill: POINT_COLORS[kp.type],
          stroke: '#fff',
          strokeWidth: 2,
          left: (img.left || 0) + kp.x * (img.scaleX || 1),
          top: (img.top || 0) + kp.y * (img.scaleY || 1),
          originX: 'center',
          originY: 'center',
          selectable: selectedTool === 'select',
          evented: selectedTool === 'select',
        }) as FabricCircleWithData;
        circle.pointId = kp.id;
        canvas.add(circle);
      });

      const validation = validateKeyPointsInBounds(
        activeSherd.keyPoints,
        activeSherd.image.width,
        activeSherd.image.height
      );
      if (!validation.valid) {
        setValidationMsg(validation.errors[0]);
      }

      canvas.renderAll();
    });
  }, [activeSherd, selectedTool]);

  const handleDeleteSelected = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !activeSherd) return;
    const activeObj = canvas.getActiveObject() as FabricCircleWithData;
    if (activeObj && activeObj.pointId) {
      removeKeyPoint(activeSherd.id, activeObj.pointId);
      canvas.remove(activeObj);
      canvas.renderAll();
    }
  };

  const handleResetView = () => {
    if (!activeSherd || !fabricCanvasRef.current || !fabImageRef.current) return;
    const canvas = fabricCanvasRef.current;
    const img = fabImageRef.current;
    img.set({
      left: (canvas.width! - activeSherd.image.width * (img.scaleX || 1)) / 2,
      top: (canvas.height! - activeSherd.image.height * (img.scaleY || 1)) / 2,
    });
    canvas.renderAll();
  };

  return (
    <Card shadow="sm" padding="md" radius="md" withBorder h="100%">
      <Stack gap="sm" h="100%">
        <Group justify="space-between">
          <Text fw={600} size="lg">
            {activeSherd ? `残片编辑：${activeSherd.sherdNumber}` : '残片编辑器'}
          </Text>
          <Group gap="xs">
            <SegmentedControl
              value={selectedTool}
              onChange={(v) => setSelectedTool(v as typeof selectedTool)}
              data={[
                { value: 'select', label: <IconPointer size={16} /> },
                { value: 'addPoint', label: <IconPlus size={16} /> },
                { value: 'move', label: <IconHandGrab size={16} /> },
              ]}
            />
            <SegmentedControl
              value={pointType}
              onChange={(v) => setPointType(v as typeof pointType)}
              data={[
                { value: 'rim', label: '口沿' },
                { value: 'body', label: '器身' },
                { value: 'base', label: '器底' },
                { value: 'pattern', label: '纹饰' },
              ]}
              color="indigo"
              disabled={selectedTool !== 'addPoint'}
            />
          </Group>
        </Group>

        {validationMsg && (
          <Alert icon={<IconAlertCircle size={16} />} color="yellow" title="提示">
            {validationMsg}
          </Alert>
        )}

        <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
          <canvas
            ref={canvasRef}
            style={{
              width: '100%',
              height: '100%',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
            }}
          />
          {!activeSherd && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(248, 249, 250, 0.9)',
              }}
            >
              <Text c="dimmed">请从左侧选择或导入一个残片</Text>
            </div>
          )}
        </div>

        <Group justify="space-between">
          <Group gap="xs">
            {(['rim', 'body', 'base', 'pattern'] as const).map((type) => (
              <Group gap={4} key={type}>
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    backgroundColor: POINT_COLORS[type],
                  }}
                />
                <Text size="xs" c="dimmed">
                  {POINT_LABELS[type]}: {activeSherd?.keyPoints.filter((k) => k.type === type).length || 0}
                </Text>
              </Group>
            ))}
          </Group>
          <Group gap="xs">
            <Button size="sm" variant="light" onClick={handleResetView} leftSection={<IconRefresh size={14} />}>
              重置视图
            </Button>
            <Button
              size="sm"
              variant="light"
              color="red"
              onClick={handleDeleteSelected}
              disabled={selectedTool !== 'select'}
            >
              删除选中点
            </Button>
          </Group>
        </Group>
      </Stack>
    </Card>
  );
}
