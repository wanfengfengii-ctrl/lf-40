import { useEffect, useMemo } from 'react';
import { Card, Text, Stack, Group, Progress, Badge, Alert, Divider, List, Tooltip, Accordion, Box } from '@mantine/core';
import { IconRuler, IconArrowNarrowUp, IconTarget, IconAlertTriangle, IconCheck, IconStack, IconFlower, IconBolt, IconCrosshair, IconInfoCircle } from '@tabler/icons-react';
import { useAppStore } from '@/store';
import type { BreakPointInfo, ReconstructionMetrics, MetricsContribution } from '@/types';

interface MetricsPanelProps {
  metrics?: ReconstructionMetrics | null;
}

function ContributionBar({ label, value, maxValue, color, icon, weight, rawValue }: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  icon: React.ReactNode;
  weight: number;
  rawValue: number;
}) {
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
  return (
    <Stack gap={2}>
      <Group justify="space-between">
        <Group gap="xs">
          {icon}
          <Text size="xs" fw={500}>{label}</Text>
        </Group>
        <Group gap={4}>
          <Text size="xs" fw={700}>{value.toFixed(1)}</Text>
          <Text size="9" c="dimmed">({rawValue.toFixed(0)}×{weight})</Text>
        </Group>
      </Group>
      <Box style={{ position: 'relative', height: 6, borderRadius: 3, backgroundColor: '#f3f4f6', overflow: 'hidden' }}>
        <Box style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: '100%',
          width: `${Math.min(pct, 100)}%`,
          borderRadius: 3,
          backgroundColor: color,
          transition: 'width 0.15s ease',
        }} />
      </Box>
    </Stack>
  );
}

type FailureSeverity = 'critical' | 'warning' | 'info';

interface CategorizedFailure {
  reason: string;
  severity: FailureSeverity;
}

function categorizeFailure(reason: string): FailureSeverity {
  if (reason.includes('断裂') || reason.includes('过低') || reason.includes('不足')) return 'critical';
  if (reason.includes('较差') || reason.includes('建议') || reason.includes('较低')) return 'warning';
  return 'info';
}

export function MetricsPanel({ metrics: externalMetrics }: MetricsPanelProps) {
  const activeSchemeId = useAppStore((s) => s.activeSchemeId);
  const cachedMetrics = useAppStore((s) => s.cachedMetrics);
  const cachedContributions = useAppStore((s) => s.cachedContributions);
  const cachedBreakPointInfos = useAppStore((s) => s.cachedBreakPointInfos);
  const weightConfig = useAppStore((s) => s.weightConfig);
  const lastMetricsUpdate = useAppStore((s) => s.lastMetricsUpdate);
  const getSchemeMetrics = useAppStore((s) => s.getSchemeMetrics);

  useEffect(() => {
    if (activeSchemeId && !externalMetrics) {
      getSchemeMetrics(activeSchemeId);
    }
  }, [activeSchemeId, lastMetricsUpdate, getSchemeMetrics, externalMetrics]);

  const metrics = useMemo(
    () => externalMetrics ?? (activeSchemeId ? cachedMetrics.get(activeSchemeId) ?? null : null),
    [activeSchemeId, cachedMetrics, externalMetrics]
  );

  const contributions = useMemo<MetricsContribution | null>(
    () => (activeSchemeId ? cachedContributions.get(activeSchemeId) ?? null : null),
    [activeSchemeId, cachedContributions]
  );

  const breakPointInfos: BreakPointInfo[] = useMemo(
    () => (activeSchemeId ? cachedBreakPointInfos.get(activeSchemeId) ?? [] : []),
    [activeSchemeId, cachedBreakPointInfos]
  );

  const categorizedFailures = useMemo<CategorizedFailure[]>(() => {
    if (!metrics?.failureReasons) return [];
    return metrics.failureReasons.map((r) => ({
      reason: r,
      severity: categorizeFailure(r),
    }));
  }, [metrics]);

  const criticalFailures = categorizedFailures.filter((f) => f.severity === 'critical');
  const warningFailures = categorizedFailures.filter((f) => f.severity === 'warning');
  const infoFailures = categorizedFailures.filter((f) => f.severity === 'info');

  if (!activeSchemeId) {
    return (
      <Card shadow="sm" padding="md" radius="md" withBorder>
        <Text fw={600} size="lg" mb="md">复原指标</Text>
        <Text c="dimmed" ta="center" py="xl">
          选择方案并添加残片以查看计算结果
        </Text>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card shadow="sm" padding="md" radius="md" withBorder>
        <Text fw={600} size="lg" mb="md">复原指标</Text>
        <Text c="dimmed" ta="center" py="xl">
          正在计算指标...
        </Text>
      </Card>
    );
  }

  const matchColor =
    metrics.matchScore >= 80 ? 'green' : metrics.matchScore >= 50 ? 'yellow' : 'red';

  const thicknessColor =
    (metrics.thicknessConsistencyScore || 100) >= 80 ? 'green' : (metrics.thicknessConsistencyScore || 100) >= 50 ? 'yellow' : 'red';

  const patternColor =
    (metrics.patternAlignmentScore || 100) >= 80 ? 'green' : (metrics.patternAlignmentScore || 100) >= 50 ? 'yellow' : 'red';

  return (
    <Card shadow="sm" padding="md" radius="md" withBorder>
      <Stack gap="md">
        <Group justify="space-between">
          <Text fw={600} size="lg">复原指标</Text>
          <Group gap={4}>
            {metrics.calculationTime !== undefined && (
              <Tooltip label="实时刷新耗时">
                <Badge
                  size="xs"
                  variant="light"
                  color={metrics.calculationTime < 5 ? 'green' : metrics.calculationTime < 10 ? 'lime' : metrics.calculationTime < 50 ? 'yellow' : 'red'}
                  leftSection={<IconBolt size={8} />}
                >
                  {metrics.calculationTime.toFixed(1)} ms
                </Badge>
              </Tooltip>
            )}
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
        </Group>

        {metrics.hasContourBreak && (
          <Alert color="yellow" title="提示" icon={<IconAlertTriangle size={16} />}>
            检测到 {metrics.breakPoints.length} 处轮廓断裂，此方案无法标记为可信复原。
            请调整残片位置和角度使轮廓连续。
          </Alert>
        )}

        {breakPointInfos.length > 0 && (
          <Card withBorder padding="xs" radius="sm" style={{ borderColor: 'var(--mantine-color-red-3)' }}>
            <Group justify="space-between" mb={4}>
              <Group gap="xs">
                <IconCrosshair size={14} color="#ef4444" />
                <Text size="xs" fw={600} c="red">断裂点定位 ({breakPointInfos.length})</Text>
              </Group>
            </Group>
            <List size="xs" spacing={1}>
              {breakPointInfos.slice(0, 5).map((bp, i) => (
                <List.Item key={i}>
                  <Group gap="xs">
                    <Text size="xs">#{i + 1} {bp.side === 'left' ? '左' : bp.side === 'right' ? '右' : '中'}侧</Text>
                    <Text size="xs" c="dimmed">间距: {bp.gapDistance}px</Text>
                    <Text size="xs" c="dimmed">({bp.x.toFixed(0)}, {bp.y.toFixed(0)})</Text>
                  </Group>
                </List.Item>
              ))}
              {breakPointInfos.length > 5 && (
                <List.Item>
                  <Text size="xs" c="dimmed">... 以及 {breakPointInfos.length - 5} 处其他断裂</Text>
                </List.Item>
              )}
            </List>
          </Card>
        )}

        {(criticalFailures.length > 0 || warningFailures.length > 0 || infoFailures.length > 0) && (
          <Accordion variant="separated" chevronPosition="right" radius="md" multiple>
            {criticalFailures.length > 0 && (
              <Accordion.Item value="critical">
                <Accordion.Control icon={<IconAlertTriangle size={14} color="#ef4444" />}>
                  <Group gap="xs">
                    <Text size="xs" fw={600} c="red">关键问题 ({criticalFailures.length})</Text>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <List size="xs" spacing={2}>
                    {criticalFailures.map((f, i) => (
                      <List.Item key={i} icon={<IconAlertTriangle size={10} color="#ef4444" />}>
                        <Text size="xs">{f.reason}</Text>
                      </List.Item>
                    ))}
                  </List>
                </Accordion.Panel>
              </Accordion.Item>
            )}
            {warningFailures.length > 0 && (
              <Accordion.Item value="warning">
                <Accordion.Control icon={<IconAlertTriangle size={14} color="#eab308" />}>
                  <Group gap="xs">
                    <Text size="xs" fw={600} c="yellow">改进建议 ({warningFailures.length})</Text>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <List size="xs" spacing={2}>
                    {warningFailures.map((f, i) => (
                      <List.Item key={i} icon={<IconAlertTriangle size={10} color="#eab308" />}>
                        <Text size="xs">{f.reason}</Text>
                      </List.Item>
                    ))}
                  </List>
                </Accordion.Panel>
              </Accordion.Item>
            )}
            {infoFailures.length > 0 && (
              <Accordion.Item value="info">
                <Accordion.Control icon={<IconInfoCircle size={14} color="#3b82f6" />}>
                  <Group gap="xs">
                    <Text size="xs" fw={600} c="blue">参考信息 ({infoFailures.length})</Text>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <List size="xs" spacing={2}>
                    {infoFailures.map((f, i) => (
                      <List.Item key={i} icon={<IconInfoCircle size={10} color="#3b82f6" />}>
                        <Text size="xs">{f.reason}</Text>
                      </List.Item>
                    ))}
                  </List>
                </Accordion.Panel>
              </Accordion.Item>
            )}
          </Accordion>
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

        <Group grow>
          <Card withBorder padding="sm" radius="md">
            <Stack gap="xs" align="center">
              <IconRuler size={18} color="#6366f1" />
              <Text size="xs" c="dimmed">预计底径</Text>
              <Text fw={600} size="sm">
                {metrics.estimatedBaseDiameter && metrics.estimatedBaseDiameter > 0
                  ? `${metrics.estimatedBaseDiameter} mm`
                  : '--'}
              </Text>
            </Stack>
          </Card>
          <Card withBorder padding="sm" radius="md">
            <Stack gap="xs" align="center">
              <IconStack size={18} color="#a855f7" />
              <Text size="xs" c="dimmed">预计壁厚</Text>
              <Text fw={600} size="sm">
                {metrics.estimatedWallThickness && metrics.estimatedWallThickness > 0
                  ? `${metrics.estimatedWallThickness} mm`
                  : '--'}
              </Text>
            </Stack>
          </Card>
        </Group>

        <Divider label="匹配度评分" labelPosition="center" />

        <Stack gap="xs">
          <Group justify="space-between">
            <Group gap="xs">
              <IconTarget size={18} color={matchColor === 'green' ? '#22c55e' : matchColor === 'yellow' ? '#eab308' : '#ef4444'} />
              <Text size="sm" fw={500}>综合匹配度</Text>
            </Group>
            <Group gap={4}>
              <Text size="sm" fw={700}>
                {metrics.matchScore.toFixed(1)}%
              </Text>
              <Tooltip label="综合得分 = 轮廓×权重 + 厚度×权重 + 纹饰×权重">
                <Badge size="xs" variant="light" color="indigo">
                  综合
                </Badge>
              </Tooltip>
            </Group>
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

        {contributions && (
          <>
            <Divider label="分项贡献" labelPosition="center" />
            <Stack gap="sm">
              <ContributionBar
                label="轮廓匹配"
                value={contributions.contourContribution}
                maxValue={100 * weightConfig.contourWeight}
                color="#3b82f6"
                icon={<IconTarget size={12} color="#3b82f6" />}
                weight={weightConfig.contourWeight}
                rawValue={contributions.contourRaw}
              />
              <ContributionBar
                label="厚度一致性"
                value={contributions.thicknessContribution}
                maxValue={100 * weightConfig.thicknessWeight}
                color="#a855f7"
                icon={<IconStack size={12} color="#a855f7" />}
                weight={weightConfig.thicknessWeight}
                rawValue={contributions.thicknessRaw}
              />
              <ContributionBar
                label="纹饰对齐"
                value={contributions.patternContribution}
                maxValue={100 * weightConfig.patternWeight}
                color="#f97316"
                icon={<IconFlower size={12} color="#f97316" />}
                weight={weightConfig.patternWeight}
                rawValue={contributions.patternRaw}
              />
            </Stack>
          </>
        )}

        <Stack gap="xs">
          <Group justify="space-between">
            <Group gap="xs">
              <IconStack size={16} color={thicknessColor === 'green' ? '#22c55e' : thicknessColor === 'yellow' ? '#eab308' : '#ef4444'} />
              <Text size="xs" fw={500}>厚度一致性</Text>
            </Group>
            <Group gap="xs">
              <Text size="xs" fw={600}>
                {(metrics.thicknessConsistencyScore ?? 100).toFixed(1)}%
              </Text>
              <Tooltip label="厚度差异影响匹配度计算">
                <Badge size="xs" variant="light" color="grape">
                  ×{weightConfig.thicknessWeight}
                </Badge>
              </Tooltip>
            </Group>
          </Group>
          <Progress
            value={metrics.thicknessConsistencyScore ?? 100}
            color={thicknessColor}
            size="sm"
            radius="md"
          />
          <Text size="xs" c="dimmed">
            残片厚度一致性越高，越可能来自同一器物
          </Text>
        </Stack>

        <Stack gap="xs">
          <Group justify="space-between">
            <Group gap="xs">
              <IconFlower size={16} color={patternColor === 'green' ? '#22c55e' : patternColor === 'yellow' ? '#eab308' : '#ef4444'} />
              <Text size="xs" fw={500}>纹饰对齐度</Text>
            </Group>
            <Group gap="xs">
              <Text size="xs" fw={600}>
                {(metrics.patternAlignmentScore ?? 100).toFixed(1)}%
              </Text>
              <Tooltip label="纹饰对称性影响匹配度计算">
                <Badge size="xs" variant="light" color="orange">
                  ×{weightConfig.patternWeight}
                </Badge>
              </Tooltip>
            </Group>
          </Group>
          <Progress
            value={metrics.patternAlignmentScore ?? 100}
            color={patternColor}
            size="sm"
            radius="md"
          />
          <Text size="xs" c="dimmed">
            纹饰点关于中心轴的对称程度
          </Text>
        </Stack>
      </Stack>
    </Card>
  );
}
