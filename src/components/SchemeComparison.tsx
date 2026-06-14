import { useAppStore } from '@/store';
import { Card, Text, Table, Group, Badge, Progress, ScrollArea, Tooltip } from '@mantine/core';
import { IconCheck, IconAlertTriangle } from '@tabler/icons-react';
import { useMemo } from 'react';
import { transformKeyPoints, buildContour, calculateMetrics } from '@/utils/reconstruction';

export function SchemeComparison() {
  const schemes = useAppStore((s) => s.schemes);
  const sherds = useAppStore((s) => s.sherds);
  const setActiveScheme = useAppStore((s) => s.setActiveScheme);
  const activeSchemeId = useAppStore((s) => s.activeSchemeId);

  const schemeMetrics = useMemo(() => {
    const canvasCenter = { x: 400, y: 300 };
    const centerAxisX = canvasCenter.x;

    return schemes.map((scheme) => {
      const allPoints: ReturnType<typeof transformKeyPoints> = [];
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

      return {
        schemeId: scheme.id,
        metrics:
          allPoints.length > 0
            ? calculateMetrics(allPoints, contour, centerAxisX, avgScale)
            : null,
      };
    });
  }, [schemes, sherds]);

  const rows = schemes.map((scheme, idx) => {
    const metricsData = schemeMetrics[idx];
    const metrics = metricsData?.metrics;
    const matchColor = metrics
      ? metrics.matchScore >= 80
        ? 'green'
        : metrics.matchScore >= 50
        ? 'yellow'
        : 'red'
      : 'gray';

    return (
      <Table.Tr
        key={scheme.id}
        style={{
          cursor: 'pointer',
          backgroundColor:
            activeSchemeId === scheme.id ? 'var(--mantine-color-indigo-0)' : undefined,
        }}
        onClick={() => setActiveScheme(scheme.id)}
      >
        <Table.Td>
          <Group gap="xs">
            <Text size="sm" fw={500}>
              {scheme.name}
            </Text>
            {scheme.isTrusted && (
              <Tooltip label="可信复原">
                <Badge size="xs" color="green" variant="light">
                  <IconCheck size={10} />
                </Badge>
              </Tooltip>
            )}
          </Group>
        </Table.Td>
        <Table.Td>
          <Badge size="sm" variant="light">
            {scheme.sherdPlacements.length} 个
          </Badge>
        </Table.Td>
        <Table.Td>
          <Text size="sm">
            {metrics && metrics.estimatedRimDiameter > 0
              ? `${metrics.estimatedRimDiameter} mm`
              : '--'}
          </Text>
        </Table.Td>
        <Table.Td>
          <Text size="sm">
            {metrics && metrics.estimatedHeight > 0 ? `${metrics.estimatedHeight} mm` : '--'}
          </Text>
        </Table.Td>
        <Table.Td style={{ minWidth: 150 }}>
          {metrics ? (
            <Group gap="xs">
              <Progress
                value={metrics.matchScore}
                color={matchColor}
                size="sm"
                style={{ flex: 1 }}
              />
              <Text size="xs" fw={600} w={45} ta="right">
                {metrics.matchScore.toFixed(0)}%
              </Text>
            </Group>
          ) : (
            <Text size="xs" c="dimmed">无数据</Text>
          )}
        </Table.Td>
        <Table.Td>
          {metrics ? (
            metrics.hasContourBreak ? (
              <Tooltip label={`${metrics.breakPoints.length} 处轮廓断裂`}>
                <Badge size="xs" color="red" variant="light">
                  <IconAlertTriangle size={10} style={{ marginRight: 2 }} />
                  断裂
                </Badge>
              </Tooltip>
            ) : (
              <Badge size="xs" color="green" variant="light">
                连续
              </Badge>
            )
          ) : (
            <Text size="xs" c="dimmed">--</Text>
          )}
        </Table.Td>
      </Table.Tr>
    );
  });

  return (
    <Card shadow="sm" padding="md" radius="md" withBorder>
      <Group justify="space-between" mb="md">
        <Text fw={600} size="lg">方案对比</Text>
        <Badge size="sm" variant="light">
          {schemes.length} 个方案
        </Badge>
      </Group>

      {schemes.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          暂无方案可对比
        </Text>
      ) : (
        <ScrollArea>
          <Table withTableBorder withColumnBorders highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>方案名称</Table.Th>
                <Table.Th>残片数</Table.Th>
                <Table.Th>预计口径</Table.Th>
                <Table.Th>预计器高</Table.Th>
                <Table.Th>匹配度</Table.Th>
                <Table.Th>轮廓</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{rows}</Table.Tbody>
          </Table>
        </ScrollArea>
      )}
    </Card>
  );
}
