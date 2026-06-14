import { useState, useMemo } from 'react';
import {
  Card,
  Text,
  Group,
  Badge,
  Select,
  Stack,
  ScrollArea,
  Progress,
  Grid,
  Tooltip,
  Table,
  Chip,
  Alert,
} from '@mantine/core';
import {
  IconSearch,
  IconFlask,
  IconTarget,
  IconStack,
  IconBrush,
  IconRuler,
  IconCircle,
  IconResize,
  IconCheck,
  IconX,
  IconEye,
  IconBook,
  IconMug,
  IconLink,
  IconMapPin,
  IconInfoCircle,
  IconClock,
  IconUser,
} from '@tabler/icons-react';
import { useAppStore } from '@/store';
import {
  ARTIFACT_TYPE_LABELS,
  RIM_CURVATURE_LABELS,
  PATTERN_STYLE_LABELS,
} from '@/types';
import type {
  SimilarityMatchResult,
  SherdFeatureVector,
  SimilarityDimensionScore,
} from '@/types';

const DIMENSION_LABELS: Record<SimilarityDimensionScore['dimension'], string> = {
  type: '器型',
  period: '年代',
  stratigraphy: '地层',
  pattern: '纹饰',
  thickness: '厚度',
  rimCurvature: '口沿曲率',
  size: '尺寸',
};

const DIMENSION_ICONS: Record<SimilarityDimensionScore['dimension'], typeof IconTarget> = {
  type: IconMug,
  period: IconClock,
  stratigraphy: IconStack,
  pattern: IconBrush,
  thickness: IconRuler,
  rimCurvature: IconCircle,
  size: IconResize,
};

const ENTRY_TYPE_LABELS: Record<string, string> = {
  sherd: '残片',
  scheme: '复原方案',
  report: '研究报告',
  evidence_chain: '证据链',
};

const ENTRY_TYPE_COLORS: Record<string, string> = {
  sherd: 'blue',
  scheme: 'grape',
  report: 'teal',
  evidence_chain: 'orange',
};

function DimensionScoreBar({ score }: { score: SimilarityDimensionScore }) {
  const Icon = DIMENSION_ICONS[score.dimension];
  const color = score.score >= 70 ? 'green' : score.score >= 40 ? 'yellow' : 'red';

  return (
    <Stack gap={4}>
      <Group justify="space-between">
        <Group gap={4}>
          <Icon size={12} color="var(--mantine-color-dimmed)" />
          <Text size="xs" fw={500}>{DIMENSION_LABELS[score.dimension]}</Text>
          <Badge size="xs" variant="light" color="gray">
            权重 {(score.weight * 100).toFixed(0)}%
          </Badge>
        </Group>
        <Text size="xs" fw={700} c={color === 'green' ? '#22c55e' : color === 'yellow' ? '#eab308' : '#ef4444'}>
          {score.score.toFixed(1)}分
        </Text>
      </Group>
      <Progress
        value={score.score}
        color={color}
        size="sm"
        title={score.description}
      />
    </Stack>
  );
}

function RadarChart({ data, size = 240 }: { data: { label: string; value: number; weight: number }[]; size?: number }) {
  const center = size / 2;
  const radius = size / 2 - 35;
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

  const getColor = (value: number) => {
    if (value >= 70) return '#22c55e';
    if (value >= 40) return '#eab308';
    return '#ef4444';
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
        return <circle key={i} cx={p.x} cy={p.y} r={5} fill={getColor(d.value)} stroke="#fff" strokeWidth={1.5} />;
      })}

      {data.map((d, i) => {
        const labelR = radius + 22;
        const x = center + labelR * Math.cos(angles[i]);
        const y = center + labelR * Math.sin(angles[i]);
        const anchor = Math.abs(Math.cos(angles[i])) < 0.1 ? 'middle' : Math.cos(angles[i]) > 0 ? 'start' : 'end';
        const dy = Math.abs(Math.sin(angles[i])) < 0.1 ? '0.35em' : Math.sin(angles[i]) > 0 ? '0.8em' : '-0.2em';
        return (
          <text key={i} x={x} y={y} textAnchor={anchor} dy={dy} fontSize={10} fill="#6b7280" fontWeight={500}>
            {d.label}
          </text>
        );
      })}

      {data.map((d, i) => {
        const p = getPoint(i, d.value);
        const offset = 12;
        const x = p.x + (p.x - center) / radius * offset;
        const y = p.y + (p.y - center) / radius * offset;
        return (
          <text key={`v${i}`} x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={9} fill={getColor(d.value)} fontWeight={700}>
            {d.value.toFixed(0)}
          </text>
        );
      })}
    </svg>
  );
}

function FeatureComparison({ target, entry }: { target: SherdFeatureVector; entry: SherdFeatureVector }) {
  const features = [
    { key: 'artifactType', label: '器型', targetLabel: target.artifactType ? ARTIFACT_TYPE_LABELS[target.artifactType] : '-', entryLabel: entry.artifactType ? ARTIFACT_TYPE_LABELS[entry.artifactType] : '-' },
    { key: 'period', label: '年代', targetLabel: target.period || '-', entryLabel: entry.period || '-' },
    { key: 'dynasty', label: '朝代', targetLabel: target.dynasty || '-', entryLabel: entry.dynasty || '-' },
    { key: 'layerNumber', label: '地层', targetLabel: target.layerNumber || '-', entryLabel: entry.layerNumber || '-' },
    { key: 'patternStyle', label: '纹饰', targetLabel: target.patternStyle ? PATTERN_STYLE_LABELS[target.patternStyle] : '-', entryLabel: entry.patternStyle ? PATTERN_STYLE_LABELS[entry.patternStyle] : '-' },
    { key: 'thickness', label: '厚度(mm)', targetLabel: target.thickness ? target.thickness.toFixed(1) : '-', entryLabel: entry.thickness ? entry.thickness.toFixed(1) : '-' },
    { key: 'rimCurvature', label: '口沿曲率', targetLabel: target.rimCurvature ? RIM_CURVATURE_LABELS[target.rimCurvature] : '-', entryLabel: entry.rimCurvature ? RIM_CURVATURE_LABELS[entry.rimCurvature] : '-' },
    { key: 'estimatedRimDiameter', label: '口沿直径(cm)', targetLabel: target.estimatedRimDiameter ? target.estimatedRimDiameter.toFixed(1) : '-', entryLabel: entry.estimatedRimDiameter ? entry.estimatedRimDiameter.toFixed(1) : '-' },
    { key: 'estimatedHeight', label: '高度(cm)', targetLabel: target.estimatedHeight ? target.estimatedHeight.toFixed(1) : '-', entryLabel: entry.estimatedHeight ? entry.estimatedHeight.toFixed(1) : '-' },
  ];

  return (
    <ScrollArea>
      <Table withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>特征维度</Table.Th>
            <Table.Th>当前目标</Table.Th>
            <Table.Th>知识库条目</Table.Th>
            <Table.Th>匹配</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {features.map((f) => {
            const isMatch = f.targetLabel === f.entryLabel && f.targetLabel !== '-';
            const isPartial = f.targetLabel !== '-' && f.entryLabel !== '-' && !isMatch;
            return (
              <Table.Tr key={f.key}>
                <Table.Td><Text size="xs" fw={500}>{f.label}</Text></Table.Td>
                <Table.Td><Text size="xs">{f.targetLabel}</Text></Table.Td>
                <Table.Td><Text size="xs">{f.entryLabel}</Text></Table.Td>
                <Table.Td>
                  {isMatch ? (
                    <Badge size="xs" color="green" leftSection={<IconCheck size={8} />}>匹配</Badge>
                  ) : isPartial ? (
                    <Badge size="xs" color="yellow">差异</Badge>
                  ) : (
                    <Badge size="xs" color="gray" variant="outline">未知</Badge>
                  )}
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  );
}

export function SmartComparisonPanel() {
  const sherds = useAppStore((s) => s.sherds);
  const schemes = useAppStore((s) => s.schemes);
  const knowledgeBase = useAppStore((s) => s.knowledgeBase);
  const findSimilarEntriesToSherd = useAppStore((s) => s.findSimilarEntriesToSherd);
  const findSimilarEntriesToScheme = useAppStore((s) => s.findSimilarEntriesToScheme);
  const getFeatureVectorForSherd = useAppStore((s) => s.getFeatureVectorForSherd);
  const getFeatureVectorForScheme = useAppStore((s) => s.getFeatureVectorForScheme);
  const incrementViewCount = useAppStore((s) => s.incrementViewCount);

  const [targetType, setTargetType] = useState<'sherd' | 'scheme'>('sherd');
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [topN, setTopN] = useState(10);
  const [filterTypes, setFilterTypes] = useState<string[]>(['scheme', 'sherd']);

  const targetOptions = useMemo(() => {
    if (targetType === 'sherd') {
      return sherds.map((s) => ({ value: s.id, label: `${s.sherdNumber}${s.notes ? ` - ${s.notes.substring(0, 20)}` : ''}` }));
    }
    return schemes.map((s) => ({ value: s.id, label: `${s.name}${s.isTrusted ? ' (可信)' : ''}` }));
  }, [targetType, sherds, schemes]);

  const matchResults = useMemo<SimilarityMatchResult[]>(() => {
    if (!selectedTargetId || knowledgeBase.length === 0) return [];

    let results: SimilarityMatchResult[];
    if (targetType === 'sherd') {
      results = findSimilarEntriesToSherd(selectedTargetId, topN);
    } else {
      results = findSimilarEntriesToScheme(selectedTargetId, topN);
    }

    if (filterTypes.length > 0) {
      results = results.filter((r) => filterTypes.includes(r.matchedEntry.entryType));
    }

    return results;
  }, [selectedTargetId, targetType, topN, filterTypes, knowledgeBase, findSimilarEntriesToSherd, findSimilarEntriesToScheme]);

  const targetFeatureVector = useMemo(() => {
    if (!selectedTargetId) return null;
    if (targetType === 'sherd') {
      return getFeatureVectorForSherd(selectedTargetId);
    }
    return getFeatureVectorForScheme(selectedTargetId);
  }, [selectedTargetId, targetType, getFeatureVectorForSherd, getFeatureVectorForScheme]);

  const selectedMatch = useMemo(() => {
    if (!selectedMatchId) return null;
    return matchResults.find((r) => r.matchedEntryId === selectedMatchId) || null;
  }, [selectedMatchId, matchResults]);

  const radarData = useMemo(() => {
    if (!selectedMatch) return null;
    return selectedMatch.dimensionScores.map((ds) => ({
      label: DIMENSION_LABELS[ds.dimension],
      value: ds.score,
      weight: ds.weight,
    }));
  }, [selectedMatch]);

  const getScoreColor = (score: number) =>
    score >= 70 ? 'green' : score >= 40 ? 'yellow' : 'red';

  const handleViewEntry = (entryId: string) => {
    incrementViewCount(entryId);
  };

  return (
    <Stack gap="md">
      <Card shadow="sm" padding="md" radius="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <Group gap="xs">
              <IconFlask size={20} color="var(--mantine-color-indigo-6)" />
              <Text fw={600} size="lg">跨项目智能比对</Text>
            </Group>
            <Group gap="xs">
              <Badge size="sm" variant="light">
                知识库: {knowledgeBase.length} 条
              </Badge>
            </Group>
          </Group>

          <Grid>
            <Grid.Col span={3}>
              <Stack gap="xs">
                <Text size="xs" fw={500} c="dimmed">比对目标类型</Text>
                <Chip.Group multiple={false} value={targetType} onChange={(v) => { setTargetType(v as 'sherd' | 'scheme'); setSelectedTargetId(null); setSelectedMatchId(null); }}>
                  <Chip value="sherd" size="xs">残片</Chip>
                  <Chip value="scheme" size="xs">复原方案</Chip>
                </Chip.Group>
              </Stack>
            </Grid.Col>
            <Grid.Col span={5}>
              <Stack gap="xs">
                <Text size="xs" fw={500} c="dimmed">选择{targetType === 'sherd' ? '残片' : '方案'}</Text>
                <Select
                  placeholder={`选择${targetType === 'sherd' ? '残片' : '方案'}进行比对`}
                  data={targetOptions}
                  value={selectedTargetId}
                  onChange={setSelectedTargetId}
                  searchable
                  size="sm"
                  leftSection={<IconSearch size={14} />}
                />
              </Stack>
            </Grid.Col>
            <Grid.Col span={2}>
              <Stack gap="xs">
                <Text size="xs" fw={500} c="dimmed">返回结果数</Text>
                <Select
                  value={topN.toString()}
                  onChange={(v) => setTopN(Number(v))}
                  data={[
                    { value: '5', label: 'Top 5' },
                    { value: '10', label: 'Top 10' },
                    { value: '20', label: 'Top 20' },
                  ]}
                  size="sm"
                />
              </Stack>
            </Grid.Col>
            <Grid.Col span={2}>
              <Stack gap="xs">
                <Text size="xs" fw={500} c="dimmed">条目类型筛选</Text>
                <Chip.Group multiple value={filterTypes} onChange={setFilterTypes}>
                  <Chip value="sherd" size="xs">残片</Chip>
                  <Chip value="scheme" size="xs">方案</Chip>
                  <Chip value="report" size="xs">报告</Chip>
                  <Chip value="evidence_chain" size="xs">证据</Chip>
                </Chip.Group>
              </Stack>
            </Grid.Col>
          </Grid>

          {!selectedTargetId && (
            <Alert color="blue" variant="light" icon={<IconInfoCircle size={16} />}>
              请选择一个{targetType === 'sherd' ? '残片' : '复原方案'}作为比对目标，系统将自动在知识库中查找最相似的条目
            </Alert>
          )}
        </Stack>
      </Card>

      {selectedTargetId && targetFeatureVector && (
        <Grid>
          <Grid.Col span={5}>
            <Card shadow="sm" padding="md" radius="md" withBorder>
              <Stack gap="md">
                <Group justify="space-between">
                  <Group gap="xs">
                    <IconTarget size={16} color="var(--mantine-color-indigo-6)" />
                    <Text fw={600} size="sm">相似度匹配结果</Text>
                  </Group>
                  <Badge size="sm" variant="light">
                    共 {matchResults.length} 条
                  </Badge>
                </Group>

                {matchResults.length === 0 ? (
                  <Text c="dimmed" ta="center" py="xl">
                    未找到匹配的知识库条目
                  </Text>
                ) : (
                  <ScrollArea h={500}>
                    <Stack gap="sm">
                      {matchResults.map((result, index) => (
                        <Card
                          key={result.matchedEntryId}
                          withBorder
                          padding="sm"
                          radius="sm"
                          style={{
                            cursor: 'pointer',
                            borderColor: selectedMatchId === result.matchedEntryId
                              ? 'var(--mantine-color-indigo-5)'
                              : undefined,
                            backgroundColor: selectedMatchId === result.matchedEntryId
                              ? 'var(--mantine-color-indigo-0)'
                              : undefined,
                          }}
                          onClick={() => {
                            setSelectedMatchId(result.matchedEntryId);
                            handleViewEntry(result.matchedEntryId);
                          }}
                        >
                          <Stack gap="xs">
                            <Group justify="space-between">
                              <Group gap="xs">
                                <Badge size="xs" color="grape" variant="light">
                                  #{index + 1}
                                </Badge>
                                <Badge
                                  size="xs"
                                  color={ENTRY_TYPE_COLORS[result.matchedEntry.entryType]}
                                  variant="light"
                                >
                                  {ENTRY_TYPE_LABELS[result.matchedEntry.entryType]}
                                </Badge>
                                <Text size="sm" fw={600} lineClamp={1}>
                                  {result.matchedEntry.title}
                                </Text>
                                {result.matchedEntry.isTrusted && (
                                  <Tooltip label="可信条目">
                                    <Badge size="xs" color="green" variant="light">
                                      <IconCheck size={8} />
                                    </Badge>
                                  </Tooltip>
                                )}
                              </Group>
                              <Group gap="xs">
                                <Text
                                  size="sm"
                                  fw={700}
                                  c={getScoreColor(result.overallSimilarity) === 'green' ? '#22c55e' : getScoreColor(result.overallSimilarity) === 'yellow' ? '#eab308' : '#ef4444'}
                                >
                                  {result.overallSimilarity.toFixed(1)}%
                                </Text>
                                <Progress
                                  value={result.overallSimilarity}
                                  color={getScoreColor(result.overallSimilarity)}
                                  size="sm"
                                  style={{ width: 60 }}
                                />
                              </Group>
                            </Group>

                            <Group gap="xs">
                              <Badge size="xs" variant="outline" color="blue">
                                <IconMapPin size={8} style={{ marginRight: 2 }} />
                                {result.matchedEntry.sourceProjectName}
                              </Badge>
                              {result.matchedEntry.featureVector.period && (
                                <Badge size="xs" variant="outline" color="orange">
                                  {result.matchedEntry.featureVector.period}
                                </Badge>
                              )}
                              {result.matchedEntry.featureVector.artifactType && (
                                <Badge size="xs" variant="outline" color="green">
                                  {ARTIFACT_TYPE_LABELS[result.matchedEntry.featureVector.artifactType]}
                                </Badge>
                              )}
                            </Group>

                            <Group gap="xs">
                              {result.matchingFeatures.slice(0, 3).map((f, i) => (
                                <Badge key={i} size="xs" color="green" variant="light">
                                  <IconCheck size={8} style={{ marginRight: 2 }} />
                                  {f}
                                </Badge>
                              ))}
                              {result.differingFeatures.slice(0, 2).map((f, i) => (
                                <Badge key={i} size="xs" color="red" variant="light">
                                  <IconX size={8} style={{ marginRight: 2 }} />
                                  {f}
                                </Badge>
                              ))}
                            </Group>

                            <Group gap="xs" wrap="nowrap">
                              {result.dimensionScores.map((ds) => (
                                <Tooltip key={ds.dimension} label={`${DIMENSION_LABELS[ds.dimension]}: ${ds.score.toFixed(1)}分`}>
                                  <div style={{ flex: 1 }}>
                                    <Progress
                                      value={ds.score}
                                      color={getScoreColor(ds.score)}
                                      size="xs"
                                    />
                                  </div>
                                </Tooltip>
                              ))}
                            </Group>
                          </Stack>
                        </Card>
                      ))}
                    </Stack>
                  </ScrollArea>
                )}
              </Stack>
            </Card>
          </Grid.Col>

          <Grid.Col span={7}>
            {selectedMatch ? (
              <Stack gap="md">
                <Card shadow="sm" padding="md" radius="md" withBorder>
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Group gap="xs">
                        <IconEye size={16} color="var(--mantine-color-indigo-6)" />
                        <Text fw={600} size="sm">详细比对分析</Text>
                      </Group>
                      <Group gap="xs">
                        <Badge size="sm" color={ENTRY_TYPE_COLORS[selectedMatch.matchedEntry.entryType]}>
                          {ENTRY_TYPE_LABELS[selectedMatch.matchedEntry.entryType]}
                        </Badge>
                        <Badge
                          size="sm"
                          color={getScoreColor(selectedMatch.overallSimilarity)}
                          variant="light"
                        >
                          总相似度 {selectedMatch.overallSimilarity.toFixed(1)}%
                        </Badge>
                      </Group>
                    </Group>

                    <Text size="md" fw={600}>{selectedMatch.matchedEntry.title}</Text>
                    <Text size="xs" c="dimmed">{selectedMatch.matchedEntry.description}</Text>

                    <Group gap="xs">
                      <Badge size="xs" variant="outline" color="blue" leftSection={<IconBook size={10} />}>
                        {selectedMatch.matchedEntry.sourceProjectName}
                      </Badge>
                      <Badge size="xs" variant="outline" color="gray" leftSection={<IconUser size={10} />}>
                        {selectedMatch.matchedEntry.sourceProjectMetadata?.archaeologist || '未知考古学家'}
                      </Badge>
                      <Badge size="xs" variant="outline" color="orange" leftSection={<IconLink size={10} />}>
                        已引用 {selectedMatch.matchedEntry.referenceCount} 次
                      </Badge>
                    </Group>
                  </Stack>
                </Card>

                <Grid>
                  <Grid.Col span={5}>
                    <Card shadow="sm" padding="md" radius="md" withBorder>
                      <Stack gap="sm" align="center">
                        <Text fw={600} size="sm">七维相似度雷达图</Text>
                        {radarData ? (
                          <RadarChart data={radarData} size={240} />
                        ) : (
                          <Text c="dimmed" size="sm" py="xl">暂无数据</Text>
                        )}
                      </Stack>
                    </Card>
                  </Grid.Col>

                  <Grid.Col span={7}>
                    <Card shadow="sm" padding="md" radius="md" withBorder>
                      <Stack gap="sm">
                        <Text fw={600} size="sm">各维度得分详情</Text>
                        <Stack gap="sm">
                          {selectedMatch.dimensionScores.map((ds) => (
                            <DimensionScoreBar key={ds.dimension} score={ds} />
                          ))}
                        </Stack>
                      </Stack>
                    </Card>
                  </Grid.Col>
                </Grid>

                <Card shadow="sm" padding="md" radius="md" withBorder>
                  <Stack gap="sm">
                    <Text fw={600} size="sm">特征向量详细比对</Text>
                    <FeatureComparison target={targetFeatureVector} entry={selectedMatch.matchedEntry.featureVector} />
                  </Stack>
                </Card>

                {(selectedMatch.matchingFeatures.length > 0 || selectedMatch.differingFeatures.length > 0) && (
                  <Card shadow="sm" padding="md" radius="md" withBorder>
                    <Stack gap="sm">
                      <Text fw={600} size="sm">匹配与差异特征总结</Text>
                      <Grid>
                        {selectedMatch.matchingFeatures.length > 0 && (
                          <Grid.Col span={6}>
                            <Stack gap="xs">
                              <Group gap="xs">
                                <IconCheck size={14} color="#22c55e" />
                                <Text size="xs" fw={600} c="green">匹配特征 ({selectedMatch.matchingFeatures.length})</Text>
                              </Group>
                              <Group gap="xs">
                                {selectedMatch.matchingFeatures.map((f, i) => (
                                  <Badge key={i} size="xs" color="green" variant="light">
                                    {f}
                                  </Badge>
                                ))}
                              </Group>
                            </Stack>
                          </Grid.Col>
                        )}
                        {selectedMatch.differingFeatures.length > 0 && (
                          <Grid.Col span={6}>
                            <Stack gap="xs">
                              <Group gap="xs">
                                <IconX size={14} color="#ef4444" />
                                <Text size="xs" fw={600} c="red">差异特征 ({selectedMatch.differingFeatures.length})</Text>
                              </Group>
                              <Group gap="xs">
                                {selectedMatch.differingFeatures.map((f, i) => (
                                  <Badge key={i} size="xs" color="red" variant="light">
                                    {f}
                                  </Badge>
                                ))}
                              </Group>
                            </Stack>
                          </Grid.Col>
                        )}
                      </Grid>
                    </Stack>
                  </Card>
                )}

                {selectedMatch.matchedEntry.schemeMetrics && (
                  <Card shadow="sm" padding="md" radius="md" withBorder>
                    <Stack gap="sm">
                      <Text fw={600} size="sm">复原方案指标</Text>
                      <Grid grow>
                        <Grid.Col span={3}>
                          <Card withBorder padding="xs" radius="sm">
                            <Stack gap={0} align="center">
                              <IconResize size={12} color="#3b82f6" />
                              <Text size="8" c="dimmed">口沿直径</Text>
                              <Text size="xs" fw={600}>
                                {selectedMatch.matchedEntry.schemeMetrics.estimatedRimDiameter.toFixed(1)} cm
                              </Text>
                            </Stack>
                          </Card>
                        </Grid.Col>
                        <Grid.Col span={3}>
                          <Card withBorder padding="xs" radius="sm">
                            <Stack gap={0} align="center">
                              <IconRuler size={12} color="#a855f7" />
                              <Text size="8" c="dimmed">器高</Text>
                              <Text size="xs" fw={600}>
                                {selectedMatch.matchedEntry.schemeMetrics.estimatedHeight.toFixed(1)} cm
                              </Text>
                            </Stack>
                          </Card>
                        </Grid.Col>
                        <Grid.Col span={3}>
                          <Card withBorder padding="xs" radius="sm">
                            <Stack gap={0} align="center">
                              <IconTarget size={12} color="#22c55e" />
                              <Text size="8" c="dimmed">匹配得分</Text>
                              <Text size="xs" fw={600}>
                                {selectedMatch.matchedEntry.schemeMetrics.matchScore.toFixed(1)}
                              </Text>
                            </Stack>
                          </Card>
                        </Grid.Col>
                        <Grid.Col span={3}>
                          <Card withBorder padding="xs" radius="sm">
                            <Stack gap={0} align="center">
                              {selectedMatch.matchedEntry.schemeMetrics.hasContourBreak ? (
                                <IconX size={12} color="#ef4444" />
                              ) : (
                                <IconCheck size={12} color="#22c55e" />
                              )}
                              <Text size="8" c="dimmed">轮廓完整</Text>
                              <Text size="xs" fw={600}>
                                {selectedMatch.matchedEntry.schemeMetrics.hasContourBreak ? '否' : '是'}
                              </Text>
                            </Stack>
                          </Card>
                        </Grid.Col>
                      </Grid>
                    </Stack>
                  </Card>
                )}
              </Stack>
            ) : (
              <Card shadow="sm" padding="md" radius="md" withBorder h={600}>
                <Stack justify="center" align="center" h="100%">
                  <IconInfoCircle size={48} color="var(--mantine-color-gray-4)" />
                  <Text c="dimmed" ta="center">
                    请从左侧选择一个匹配结果查看详细比对分析
                  </Text>
                </Stack>
              </Card>
            )}
          </Grid.Col>
        </Grid>
      )}
    </Stack>
  );
}
