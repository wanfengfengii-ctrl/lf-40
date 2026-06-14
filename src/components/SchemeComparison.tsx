import { useAppStore } from '@/store';
import { Card, Text, Table, Group, Badge, Progress, ScrollArea, Tooltip, ActionIcon, SegmentedControl, Alert, Stack, Grid, Divider } from '@mantine/core';
import { IconCheck, IconAlertTriangle, IconStar, IconArrowUp, IconArrowDown, IconFlower, IconStack, IconTarget, IconBulb, IconCrown } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { rankSchemes } from '@/utils/reconstruction';
import type { SchemeRanking } from '@/types';
import { WeightConfigPanel } from './WeightConfigPanel';

type SortKey = 'score' | 'match' | 'thickness' | 'pattern' | 'sherds';

function SortHeaderComponent({ label, sortKey: sk, activeSortKey, sortAsc, onToggle }: {
  label: string;
  sortKey: SortKey;
  activeSortKey: SortKey;
  sortAsc: boolean;
  onToggle: (key: SortKey) => void;
}) {
  return (
    <Group gap={4} style={{ cursor: 'pointer' }} onClick={() => onToggle(sk)}>
      <Text size="xs" fw={600}>{label}</Text>
      {activeSortKey === sk && (
        sortAsc ? <IconArrowUp size={10} /> : <IconArrowDown size={10} />
      )}
    </Group>
  );
}

function RadarChart({ data, size = 220 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const center = size / 2;
  const radius = size / 2 - 30;
  const angles = data.map((_, i) => (i / data.length) * 2 * Math.PI - Math.PI / 2);
  const levels = [20, 40, 60, 80, 100];

  const getPoint = (angleIdx: number, value: number) => {
    const angle = angles[angleIdx];
    const r = (value / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {levels.map((level) => {
        const points = angles.map((angle) => ({
          x: center + (level / 100) * radius * Math.cos(angle),
          y: center + (level / 100) * radius * Math.sin(angle),
        }));
        const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';
        return <path key={level} d={pathD} fill="none" stroke="#e5e7eb" strokeWidth={0.5} />;
      })}

      {angles.map((angle, i) => {
        const endX = center + radius * Math.cos(angle);
        const endY = center + radius * Math.sin(angle);
        return <line key={i} x1={center} y1={center} x2={endX} y2={endY} stroke="#e5e7eb" strokeWidth={0.5} />;
      })}

      {(() => {
        const polygonPoints = data.map((d, i) => {
          const p = getPoint(i, d.value);
          return `${p.x},${p.y}`;
        }).join(' ');
        return <polygon points={polygonPoints} fill="rgba(99, 102, 241, 0.15)" stroke="#6366f1" strokeWidth={2} />;
      })()}

      {data.map((d, i) => {
        const p = getPoint(i, d.value);
        return <circle key={i} cx={p.x} cy={p.y} r={4} fill={d.color} stroke="#fff" strokeWidth={1.5} />;
      })}

      {data.map((d, i) => {
        const labelR = radius + 18;
        const x = center + labelR * Math.cos(angles[i]);
        const y = center + labelR * Math.sin(angles[i]);
        const anchor = Math.abs(Math.cos(angles[i])) < 0.1 ? 'middle' : Math.cos(angles[i]) > 0 ? 'start' : 'end';
        const dy = Math.abs(Math.sin(angles[i])) < 0.1 ? '0.35em' : Math.sin(angles[i]) > 0 ? '0.8em' : '-0.2em';
        return (
          <text key={i} x={x} y={y} textAnchor={anchor} dy={dy} fontSize={11} fill="#6b7280" fontWeight={500}>
            {d.label}
          </text>
        );
      })}

      {data.map((d, i) => {
        const p = getPoint(i, d.value);
        const offset = 10;
        const x = p.x + (p.x - center) / radius * offset;
        const y = p.y + (p.y - center) / radius * offset;
        return (
          <text key={`v${i}`} x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={10} fill={d.color} fontWeight={700}>
            {d.value.toFixed(0)}
          </text>
        );
      })}
    </svg>
  );
}

export function SchemeComparison() {
  const schemes = useAppStore((s) => s.schemes);
  const sherds = useAppStore((s) => s.sherds);
  const weightConfig = useAppStore((s) => s.weightConfig);
  const setActiveScheme = useAppStore((s) => s.setActiveScheme);
  const activeSchemeId = useAppStore((s) => s.activeSchemeId);
  const toggleSchemeTrusted = useAppStore((s) => s.toggleSchemeTrusted);
  const cachedMetrics = useAppStore((s) => s.cachedMetrics);

  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortAsc, setSortAsc] = useState(false);

  const rankings = useMemo<SchemeRanking[]>(() => {
    if (schemes.length === 0) return [];
    const result = rankSchemes(schemes, sherds, { x: 400, y: 300 }, weightConfig);

    return [...result].sort((a, b) => {
      let diff = 0;
      switch (sortKey) {
        case 'score':
          diff = a.totalScore - b.totalScore;
          break;
        case 'match':
          diff = a.matchScore - b.matchScore;
          break;
        case 'thickness':
          diff = a.thicknessScore - b.thicknessScore;
          break;
        case 'pattern':
          diff = a.patternScore - b.patternScore;
          break;
        case 'sherds':
          diff = a.sherdCount - b.sherdCount;
          break;
      }
      return sortAsc ? diff : -diff;
    });
  }, [schemes, sherds, sortKey, sortAsc, weightConfig]);

  const recommended = rankings.find((r) => r.isRecommended);

  const activeRanking = useMemo(() => {
    if (!activeSchemeId) return null;
    return rankings.find((r) => r.schemeId === activeSchemeId) || null;
  }, [rankings, activeSchemeId]);

  const radarData = useMemo(() => {
    if (!activeRanking) {
      if (rankings.length > 0) {
        const best = rankings[0];
        return [
          { label: '轮廓匹配', value: best.matchScore, color: '#3b82f6' },
          { label: '厚度一致', value: best.thicknessScore, color: '#a855f7' },
          { label: '纹饰对齐', value: best.patternScore, color: '#f97316' },
          { label: '综合得分', value: best.totalScore, color: '#6366f1' },
        ];
      }
      return null;
    }
    return [
      { label: '轮廓匹配', value: activeRanking.matchScore, color: '#3b82f6' },
      { label: '厚度一致', value: activeRanking.thicknessScore, color: '#a855f7' },
      { label: '纹饰对齐', value: activeRanking.patternScore, color: '#f97316' },
      { label: '综合得分', value: activeRanking.totalScore, color: '#6366f1' },
    ];
  }, [activeRanking, rankings]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const getScoreColor = (score: number) =>
    score >= 80 ? 'green' : score >= 50 ? 'yellow' : 'red';

  const rows = rankings.map((r) => {
    const scheme = schemes.find((s) => s.id === r.schemeId);
    if (!scheme) return null;

    const metrics = cachedMetrics.get(r.schemeId);
    const hasBreak = metrics?.hasContourBreak ?? false;

    return (
      <Table.Tr
        key={r.schemeId}
        style={{
          cursor: 'pointer',
          backgroundColor:
            activeSchemeId === r.schemeId
              ? 'var(--mantine-color-indigo-0)'
              : r.isRecommended
              ? 'rgba(250, 204, 21, 0.08)'
              : undefined,
          borderTop: r.isRecommended ? '2px solid var(--mantine-color-yellow-5)' : undefined,
        }}
        onClick={() => setActiveScheme(r.schemeId)}
      >
        <Table.Td>
          <Group gap="xs">
            {r.isRecommended && (
              <Tooltip label="推荐方案">
                <Badge size="xs" color="yellow" variant="light">
                  <IconCrown size={10} style={{ marginRight: 2 }} />
                  推荐
                </Badge>
              </Tooltip>
            )}
            <Text size="sm" fw={r.isRecommended ? 700 : 500}>
              {r.schemeName}
            </Text>
            {r.isTrusted && (
              <Tooltip label="可信复原">
                <Badge size="xs" color="green" variant="light">
                  <IconCheck size={10} />
                </Badge>
              </Tooltip>
            )}
            {hasBreak && (
              <Tooltip label="存在轮廓断裂">
                <Badge size="xs" color="red" variant="light">
                  <IconAlertTriangle size={10} />
                </Badge>
              </Tooltip>
            )}
          </Group>
        </Table.Td>
        <Table.Td>
          <Badge size="sm" variant="light">
            {r.sherdCount} 个
          </Badge>
        </Table.Td>
        <Table.Td>
          <Group gap="xs">
            <Text size="sm" fw={700} c={getScoreColor(r.totalScore) === 'green' ? '#22c55e' : getScoreColor(r.totalScore) === 'yellow' ? '#eab308' : '#ef4444'}>
              {r.totalScore.toFixed(1)}
            </Text>
            <Progress
              value={r.totalScore}
              color={getScoreColor(r.totalScore)}
              size="sm"
              style={{ width: 60 }}
            />
          </Group>
        </Table.Td>
        <Table.Td style={{ minWidth: 100 }}>
          <Group gap={4}>
            <Tooltip label="轮廓匹配">
              <IconTarget size={12} color="#3b82f6" />
            </Tooltip>
            <Progress value={r.matchScore} color="blue" size="sm" style={{ flex: 1 }} />
            <Text size="xs" fw={600} w={28} ta="right">{r.matchScore.toFixed(0)}</Text>
          </Group>
        </Table.Td>
        <Table.Td style={{ minWidth: 100 }}>
          <Group gap={4}>
            <Tooltip label="厚度一致性">
              <IconStack size={12} color="#a855f7" />
            </Tooltip>
            <Progress value={r.thicknessScore} color="grape" size="sm" style={{ flex: 1 }} />
            <Text size="xs" fw={600} w={28} ta="right">{r.thicknessScore.toFixed(0)}</Text>
          </Group>
        </Table.Td>
        <Table.Td style={{ minWidth: 100 }}>
          <Group gap={4}>
            <Tooltip label="纹饰对齐">
              <IconFlower size={12} color="#f97316" />
            </Tooltip>
            <Progress value={r.patternScore} color="orange" size="sm" style={{ flex: 1 }} />
            <Text size="xs" fw={600} w={28} ta="right">{r.patternScore.toFixed(0)}</Text>
          </Group>
        </Table.Td>
        <Table.Td>
          {!r.isTrusted && r.sherdCount > 0 && (
            <Tooltip label="标记为可信">
              <ActionIcon
                size="xs"
                variant="subtle"
                color="green"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSchemeTrusted(r.schemeId);
                }}
              >
                <IconCheck size={12} />
              </ActionIcon>
            </Tooltip>
          )}
        </Table.Td>
      </Table.Tr>
    );
  });

  return (
    <Stack gap="md">
      <Grid>
        <Grid.Col span={8}>
          <Card shadow="sm" padding="md" radius="md" withBorder>
            <Stack gap="md">
              <Group justify="space-between">
                <Group gap="xs">
                  <Text fw={600} size="lg">方案评分排序与最佳方案推荐</Text>
                  {recommended && (
                    <Badge color="yellow" variant="light" leftSection={<IconStar size={10} fill="currentColor" />}>
                      最佳: {recommended.schemeName} ({recommended.totalScore.toFixed(1)}分)
                    </Badge>
                  )}
                </Group>
                <Group gap="xs">
                  <Badge size="sm" variant="light">{schemes.length} 个方案</Badge>
                  <SegmentedControl
                    size="xs"
                    value={sortKey}
                    onChange={(v) => setSortKey(v as SortKey)}
                    data={[
                      { value: 'score', label: '总分' },
                      { value: 'match', label: '轮廓' },
                      { value: 'thickness', label: '厚度' },
                      { value: 'pattern', label: '纹饰' },
                    ]}
                  />
                </Group>
              </Group>

              {recommended?.recommendationReason && (
                <Alert color="yellow" variant="light" icon={<IconBulb size={16} />} title="推荐理由">
                  <Text size="xs">{recommended.recommendationReason}</Text>
                </Alert>
              )}

              {schemes.length === 0 ? (
                <Text c="dimmed" ta="center" py="xl">暂无方案可对比，请先创建复原方案</Text>
              ) : (
                <ScrollArea>
                  <Table withTableBorder withColumnBorders highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th><SortHeaderComponent label="方案名称" sortKey="score" activeSortKey={sortKey} sortAsc={sortAsc} onToggle={toggleSort} /></Table.Th>
                        <Table.Th><SortHeaderComponent label="残片数" sortKey="sherds" activeSortKey={sortKey} sortAsc={sortAsc} onToggle={toggleSort} /></Table.Th>
                        <Table.Th><SortHeaderComponent label="综合得分" sortKey="score" activeSortKey={sortKey} sortAsc={sortAsc} onToggle={toggleSort} /></Table.Th>
                        <Table.Th><SortHeaderComponent label="轮廓匹配" sortKey="match" activeSortKey={sortKey} sortAsc={sortAsc} onToggle={toggleSort} /></Table.Th>
                        <Table.Th><SortHeaderComponent label="厚度一致" sortKey="thickness" activeSortKey={sortKey} sortAsc={sortAsc} onToggle={toggleSort} /></Table.Th>
                        <Table.Th><SortHeaderComponent label="纹饰对齐" sortKey="pattern" activeSortKey={sortKey} sortAsc={sortAsc} onToggle={toggleSort} /></Table.Th>
                        <Table.Th>操作</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>{rows}</Table.Tbody>
                  </Table>
                </ScrollArea>
              )}
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={4}>
          <Stack gap="md">
            <Card shadow="sm" padding="md" radius="md" withBorder>
              <Stack gap="sm" align="center">
                <Text fw={600} size="sm">
                  {activeRanking ? `${activeRanking.schemeName} 评估雷达图` : '最佳方案评估雷达图'}
                </Text>
                {radarData ? (
                  <RadarChart data={radarData} size={240} />
                ) : (
                  <Text c="dimmed" size="sm" py="xl">暂无数据</Text>
                )}
                {activeRanking && activeRanking.contributions && (
                  <Stack gap={4} w="100%">
                    <Divider label="分项贡献详情" labelPosition="center" />
                    <Group grow>
                      <Card withBorder padding="xs" radius="sm">
                        <Stack gap={0} align="center">
                          <IconTarget size={12} color="#3b82f6" />
                          <Text size="8" c="dimmed">轮廓</Text>
                          <Text size="xs" fw={600}>{activeRanking.contributions.contourContribution.toFixed(1)}</Text>
                          <Text size="7" c="dimmed">({activeRanking.contributions.contourRaw.toFixed(0)}×{weightConfig.contourWeight})</Text>
                        </Stack>
                      </Card>
                      <Card withBorder padding="xs" radius="sm">
                        <Stack gap={0} align="center">
                          <IconStack size={12} color="#a855f7" />
                          <Text size="8" c="dimmed">厚度</Text>
                          <Text size="xs" fw={600}>{activeRanking.contributions.thicknessContribution.toFixed(1)}</Text>
                          <Text size="7" c="dimmed">({activeRanking.contributions.thicknessRaw.toFixed(0)}×{weightConfig.thicknessWeight})</Text>
                        </Stack>
                      </Card>
                      <Card withBorder padding="xs" radius="sm">
                        <Stack gap={0} align="center">
                          <IconFlower size={12} color="#f97316" />
                          <Text size="8" c="dimmed">纹饰</Text>
                          <Text size="xs" fw={600}>{activeRanking.contributions.patternContribution.toFixed(1)}</Text>
                          <Text size="7" c="dimmed">({activeRanking.contributions.patternRaw.toFixed(0)}×{weightConfig.patternWeight})</Text>
                        </Stack>
                      </Card>
                    </Group>
                  </Stack>
                )}
              </Stack>
            </Card>

            <WeightConfigPanel />
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
