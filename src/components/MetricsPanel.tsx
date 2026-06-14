import { Card, Text, Stack, Group, Progress, Badge, Alert, Divider } from '@mantine/core';
import { IconRuler, IconArrowNarrowUp, IconTarget, IconAlertTriangle, IconCheck } from '@tabler/icons-react';
import type { ReconstructionMetrics } from '@/types';

interface MetricsPanelProps {
  metrics: ReconstructionMetrics | null;
}

export function MetricsPanel({ metrics }: MetricsPanelProps) {
  if (!metrics) {
    return (
      <Card shadow="sm" padding="md" radius="md" withBorder>
        <Text fw={600} size="lg" mb="md">复原指标</Text>
        <Text c="dimmed" ta="center" py="xl">
          选择方案并添加残片以查看计算结果
        </Text>
      </Card>
    );
  }

  const matchColor =
    metrics.matchScore >= 80 ? 'green' : metrics.matchScore >= 50 ? 'yellow' : 'red';

  return (
    <Card shadow="sm" padding="md" radius="md" withBorder>
      <Stack gap="md">
        <Group justify="space-between">
          <Text fw={600} size="lg">复原指标</Text>
          {metrics.hasContourBreak ? (
            <Badge color="red" variant="light" leftSection={<IconAlertTriangle size={10} />}>
              存在轮廓断裂
            </Badge>
          ) : (
            <Badge color="green" variant="light" leftSection={<IconCheck size={10} />}>
              轮廓连续
            </Badge>
          )}
        </Group>

        {metrics.hasContourBreak && (
          <Alert color="yellow" title="提示" icon={<IconAlertTriangle size={16} />}>
            检测到 {metrics.breakPoints.length} 处轮廓断裂，此方案无法标记为可信复原。
            请调整残片位置和角度使轮廓连续。
          </Alert>
        )}

        <Divider />

        <Group grow>
          <Card withBorder padding="md" radius="md">
            <Stack gap="xs" align="center">
              <IconRuler size={24} color="#3b82f6" />
              <Text size="xs" c="dimmed">预计口径</Text>
              <Text fw={700} size="xl">
                {metrics.estimatedRimDiameter > 0 ? `${metrics.estimatedRimDiameter} mm` : '--'}
              </Text>
            </Stack>
          </Card>

          <Card withBorder padding="md" radius="md">
            <Stack gap="xs" align="center">
              <IconArrowNarrowUp size={24} color="#22c55e" />
              <Text size="xs" c="dimmed">预计器高</Text>
              <Text fw={700} size="xl">
                {metrics.estimatedHeight > 0 ? `${metrics.estimatedHeight} mm` : '--'}
              </Text>
            </Stack>
          </Card>
        </Group>

        <Stack gap="xs">
          <Group justify="space-between">
            <Group gap="xs">
              <IconTarget size={18} color={matchColor === 'green' ? '#22c55e' : matchColor === 'yellow' ? '#eab308' : '#ef4444'} />
              <Text size="sm" fw={500}>方案匹配度</Text>
            </Group>
            <Text size="sm" fw={700}>
              {metrics.matchScore.toFixed(1)}%
            </Text>
          </Group>
          <Progress
            value={metrics.matchScore}
            color={matchColor}
            size="md"
            radius="md"
          />
          <Text size="xs" c="dimmed">
            {metrics.matchScore >= 80
              ? '匹配度高，轮廓拟合良好'
              : metrics.matchScore >= 50
              ? '匹配度中等，建议调整残片位置'
              : '匹配度较低，请检查关键点标记和残片位置'}
          </Text>
        </Stack>
      </Stack>
    </Card>
  );
}
