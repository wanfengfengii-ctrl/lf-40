import React, { useState, useMemo } from 'react';
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
  ActionIcon,
  Divider,
  RingProgress,
  List,
  ThemeIcon,
} from '@mantine/core';
import {
  IconSearch,
  IconBulb,
  IconTarget,
  IconStack,
  IconCheck,
  IconBook,
  IconMug,
  IconFileText,
  IconLink,
  IconMapPin,
  IconInfoCircle,
  IconStar,
  IconQuote,
  IconCertificate,
  IconFileSearch,
  IconUsers,
  IconCheckbox,
  IconDownload,
  IconCopy,
  IconThumbUp,
  IconThumbDown,
} from '@tabler/icons-react';
import { useAppStore } from '@/store';
import {
  ARTIFACT_TYPE_LABELS,
  DEFAULT_FEATURE_WEIGHTS,
} from '@/types';
import type {
  RecommendationResult,
  SimilarityDimensionScore,
  EvidenceCitation,
} from '@/types';

const RECOMMENDATION_TYPE_LABELS: Record<RecommendationResult['recommendationType'], string> = {
  reconstruction_scheme: '复原方案',
  reference_artifact: '参考器物',
  evidence_combination: '证据组合',
  expert_opinion: '专家意见',
};

const RECOMMENDATION_TYPE_COLORS: Record<RecommendationResult['recommendationType'], string> = {
  reconstruction_scheme: 'grape',
  reference_artifact: 'blue',
  evidence_combination: 'orange',
  expert_opinion: 'teal',
};

const RECOMMENDATION_TYPE_ICONS: Record<RecommendationResult['recommendationType'], typeof IconTarget> = {
  reconstruction_scheme: IconMug,
  reference_artifact: IconBook,
  evidence_combination: IconStack,
  expert_opinion: IconUsers,
};

const CONFIDENCE_LABELS: Record<string, string> = {
  very_high: '极高',
  high: '高',
  medium: '中',
  low: '低',
};

const CONFIDENCE_COLORS: Record<string, string> = {
  very_high: 'green',
  high: 'teal',
  medium: 'yellow',
  low: 'red',
};

const DIMENSION_LABELS: Record<SimilarityDimensionScore['dimension'], string> = {
  type: '器型',
  period: '年代',
  stratigraphy: '地层',
  pattern: '纹饰',
  thickness: '厚度',
  rimCurvature: '口沿曲率',
  size: '尺寸',
};

function EvidenceCitationCard({ citation }: { citation: EvidenceCitation }) {
  const getColor = (relevance: number) =>
    relevance >= 70 ? 'green' : relevance >= 40 ? 'yellow' : 'red';

  return (
    <Card withBorder padding="xs" radius="sm">
      <Stack gap={4}>
        <Group justify="space-between">
          <Group gap={4}>
            <IconQuote size={12} color="var(--mantine-color-dimmed)" />
            <Text size="xs" fw={600} lineClamp={1}>{citation.entryTitle}</Text>
          </Group>
          <Badge size="xs" color={getColor(citation.relevance)} variant="light">
            相关性 {citation.relevance.toFixed(0)}%
          </Badge>
        </Group>
        <Text size="xs" c="dimmed" lineClamp={2}>{citation.description}</Text>
        <Group gap={4}>
          <Badge size="xs" variant="outline" color="blue">
            {citation.sourceProjectName}
          </Badge>
          <Badge size="xs" variant="outline" color="gray">
            {citation.evidenceType}
          </Badge>
          {citation.pageReference && (
            <Badge size="xs" variant="outline" color="orange">
              p.{citation.pageReference}
            </Badge>
          )}
        </Group>
      </Stack>
    </Card>
  );
}

function ScoreBreakdown({ scores }: { scores: SimilarityDimensionScore[] }) {
  const getColor = (score: number) =>
    score >= 70 ? 'green' : score >= 40 ? 'yellow' : 'red';

  return (
    <Stack gap="xs">
      {scores.map((ds) => (
        <Group key={ds.dimension} gap="xs" wrap="nowrap">
          <Text size="xs" w={60} c="dimmed">{DIMENSION_LABELS[ds.dimension]}</Text>
          <Progress
            value={ds.score}
            color={getColor(ds.score)}
            size="xs"
            style={{ flex: 1 }}
          />
          <Text size="xs" fw={600} w={40} ta="right">
            {ds.score.toFixed(0)}
          </Text>
        </Group>
      ))}
    </Stack>
  );
}

function RecommendationCard({
  recommendation,
  isSelected,
  onClick,
  onApply,
}: {
  recommendation: RecommendationResult;
  isSelected: boolean;
  onClick: () => void;
  onApply: () => void;
}) {
  const TypeIcon = RECOMMENDATION_TYPE_ICONS[recommendation.recommendationType];
  const typeColor = RECOMMENDATION_TYPE_COLORS[recommendation.recommendationType];

  return (
    <Card
      withBorder
      padding="md"
      radius="md"
      style={{
        cursor: 'pointer',
        borderColor: isSelected
          ? `var(--mantine-color-${typeColor}-5)`
          : undefined,
        backgroundColor: isSelected
          ? `var(--mantine-color-${typeColor}-0)`
          : undefined,
        borderLeftWidth: isSelected ? 4 : undefined,
        borderLeftColor: isSelected ? `var(--mantine-color-${typeColor}-6)` : undefined,
      }}
      onClick={onClick}
    >
      <Stack gap="sm">
        <Group justify="space-between">
          <Group gap="xs">
            <ThemeIcon size="md" color={typeColor} variant="light">
              <TypeIcon size={16} />
            </ThemeIcon>
            <Stack gap={0}>
              <Group gap="xs">
                <Badge size="xs" color={typeColor}>
                  {RECOMMENDATION_TYPE_LABELS[recommendation.recommendationType]}
                </Badge>
                <Badge
                  size="xs"
                  color={CONFIDENCE_COLORS[recommendation.confidenceLevel]}
                  variant="light"
                >
                  {CONFIDENCE_LABELS[recommendation.confidenceLevel]}置信度
                </Badge>
              </Group>
              <Text size="sm" fw={600} lineClamp={1}>
                {recommendation.recommendedEntry.title}
              </Text>
            </Stack>
          </Group>
          <Stack gap={4} align="flex-end">
            <Group gap="xs">
              <RingProgress
                size={48}
                thickness={6}
                roundCaps
                sections={[
                  {
                    value: recommendation.recommendationScore,
                    color: recommendation.recommendationScore >= 70 ? '#22c55e' : recommendation.recommendationScore >= 40 ? '#eab308' : '#ef4444',
                  },
                ]}
                label={
                  <Text size="xs" fw={700} ta="center">
                    {recommendation.recommendationScore.toFixed(0)}
                  </Text>
                }
              />
            </Group>
            <Text size="10" c="dimmed">推荐指数</Text>
          </Stack>
        </Group>

        <Text size="xs" c="dimmed" lineClamp={2}>
          {recommendation.detailedExplanation}
        </Text>

        <Group gap="xs">
          {recommendation.recommendationReasons.slice(0, 3).map((reason, i) => (
            <Badge key={i} size="xs" color="green" variant="light">
              <IconCheck size={8} style={{ marginRight: 2 }} />
              {reason}
            </Badge>
          ))}
        </Group>

        <Group justify="space-between">
          <Group gap="xs">
            <Badge size="xs" variant="outline" color="blue" leftSection={<IconBook size={10} />}>
              {recommendation.recommendedEntry.sourceProjectName}
            </Badge>
            <Badge size="xs" variant="outline" color="orange" leftSection={<IconLink size={10} />}>
              {recommendation.evidenceCitations.length} 处引用
            </Badge>
            <Badge size="xs" variant="outline" color="gray" leftSection={<IconUsers size={10} />}>
              {recommendation.supportingEntries.length} 条支持
            </Badge>
          </Group>
          {!recommendation.isApplied && (
            <Tooltip label="应用此推荐">
              <ActionIcon
                size="sm"
                color={typeColor}
                variant="light"
                onClick={(e) => {
                  e.stopPropagation();
                  onApply();
                }}
              >
                <IconCheckbox size={14} />
              </ActionIcon>
            </Tooltip>
          )}
          {recommendation.isApplied && (
            <Badge size="xs" color="green" leftSection={<IconCheck size={10} />}>
              已应用
            </Badge>
          )}
        </Group>
      </Stack>
    </Card>
  );
}

export function RecommendationPanel() {
  const sherds = useAppStore((s) => s.sherds);
  const schemes = useAppStore((s) => s.schemes);
  const knowledgeBase = useAppStore((s) => s.knowledgeBase);
  const getRecommendationsForSherd = useAppStore((s) => s.getRecommendationsForSherd);
  const getRecommendationsForScheme = useAppStore((s) => s.getRecommendationsForScheme);

  const [targetType, setTargetType] = useState<'sherd' | 'scheme'>('scheme');
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [selectedRecommendationId, setSelectedRecommendationId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<RecommendationResult['recommendationType'] | 'all'>('all');
  const [minConfidence, setMinConfidence] = useState<number>(0);

  const targetOptions = useMemo(() => {
    if (targetType === 'sherd') {
      return sherds.map((s) => ({ value: s.id, label: `${s.sherdNumber}${s.notes ? ` - ${s.notes.substring(0, 20)}` : ''}` }));
    }
    return schemes.map((s) => ({ value: s.id, label: `${s.name}${s.isTrusted ? ' (可信)' : ''}` }));
  }, [targetType, sherds, schemes]);

  const recommendations = useMemo<RecommendationResult[]>(() => {
    if (!selectedTargetId || knowledgeBase.length === 0) return [];

    let results: RecommendationResult[];
    if (targetType === 'sherd') {
      results = getRecommendationsForSherd(selectedTargetId);
    } else {
      results = getRecommendationsForScheme(selectedTargetId);
    }

    if (filterType !== 'all') {
      results = results.filter((r) => r.recommendationType === filterType);
    }

    const confidenceOrder: Record<string, number> = { very_high: 4, high: 3, medium: 2, low: 1 };
    const minLevel = minConfidence;
    if (minLevel > 0) {
      results = results.filter((r) => confidenceOrder[r.confidenceLevel] >= minLevel);
    }

    return results;
  }, [selectedTargetId, targetType, filterType, minConfidence, knowledgeBase, getRecommendationsForSherd, getRecommendationsForScheme]);

  const selectedRecommendation = useMemo(() => {
    if (!selectedRecommendationId) return null;
    return recommendations.find((r) => r.id === selectedRecommendationId) || null;
  }, [selectedRecommendationId, recommendations]);

  const stats = useMemo(() => {
    const typeCounts: Record<string, number> = {
      reconstruction_scheme: 0,
      reference_artifact: 0,
      evidence_combination: 0,
      expert_opinion: 0,
    };
    const avgScore = recommendations.length > 0
      ? recommendations.reduce((sum, r) => sum + r.recommendationScore, 0) / recommendations.length
      : 0;
    const appliedCount = recommendations.filter((r) => r.isApplied).length;

    recommendations.forEach((r) => {
      typeCounts[r.recommendationType]++;
    });

    return { typeCounts, avgScore, appliedCount };
  }, [recommendations]);

  const handleApplyRecommendation = (recId: string) => {
    setSelectedRecommendationId(recId);
  };

  const exportRecommendationCitation = () => {
    if (!selectedRecommendation) return;

    const citations = selectedRecommendation.evidenceCitations
      .map((c) => `[${c.id}] ${c.entryTitle}. ${c.sourceProjectName}. ${c.description}`)
      .join('\n\n');

    const exportText = `
推荐结果：${selectedRecommendation.recommendedEntry.title}
推荐类型：${RECOMMENDATION_TYPE_LABELS[selectedRecommendation.recommendationType]}
推荐指数：${selectedRecommendation.recommendationScore.toFixed(1)}
置信度：${CONFIDENCE_LABELS[selectedRecommendation.confidenceLevel]}

推荐理由：
${selectedRecommendation.recommendationReasons.map((r, i) => `${i + 1}. ${r}`).join('\n')}

详细说明：
${selectedRecommendation.detailedExplanation}

引用来源（${selectedRecommendation.evidenceCitations.length}）：
${citations}

支持条目（${selectedRecommendation.supportingEntries.length}）：
${selectedRecommendation.supportingEntries.map((e) => `• ${e.entryTitle} (${e.sourceProjectName}, 相关性 ${e.relevance.toFixed(0)}%)`).join('\n')}
    `.trim();

    navigator.clipboard?.writeText(exportText);
  };

  return (
    <Stack gap="md">
      <Card shadow="sm" padding="md" radius="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <Group gap="xs">
              <IconBulb size={20} color="var(--mantine-color-yellow-6)" />
              <Text fw={600} size="lg">智能推荐引擎</Text>
            </Group>
            <Group gap="xs">
              <Badge size="sm" variant="light">
                知识库: {knowledgeBase.length} 条
              </Badge>
              {recommendations.length > 0 && (
                <Badge size="sm" color="yellow" variant="light" leftSection={<IconStar size={10} />}>
                  {recommendations.length} 条推荐
                </Badge>
              )}
            </Group>
          </Group>

          <Grid>
            <Grid.Col span={3}>
              <Stack gap="xs">
                <Text size="xs" fw={500} c="dimmed">推荐目标类型</Text>
                <Chip.Group multiple={false} value={targetType} onChange={(v) => { setTargetType(v as 'sherd' | 'scheme'); setSelectedTargetId(null); setSelectedRecommendationId(null); }}>
                  <Chip value="sherd" size="xs">残片</Chip>
                  <Chip value="scheme" size="xs">复原方案</Chip>
                </Chip.Group>
              </Stack>
            </Grid.Col>
            <Grid.Col span={5}>
              <Stack gap="xs">
                <Text size="xs" fw={500} c="dimmed">选择{targetType === 'sherd' ? '残片' : '方案'}</Text>
                <Select
                  placeholder={`选择${targetType === 'sherd' ? '残片' : '方案'}获取推荐`}
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
                <Text size="xs" fw={500} c="dimmed">推荐类型筛选</Text>
                <Select
                  value={filterType}
                  onChange={(v) => setFilterType(v as any)}
                  data={[
                    { value: 'all', label: '全部类型' },
                    { value: 'reconstruction_scheme', label: '复原方案' },
                    { value: 'reference_artifact', label: '参考器物' },
                    { value: 'evidence_combination', label: '证据组合' },
                    { value: 'expert_opinion', label: '专家意见' },
                  ]}
                  size="sm"
                />
              </Stack>
            </Grid.Col>
            <Grid.Col span={2}>
              <Stack gap="xs">
                <Text size="xs" fw={500} c="dimmed">最低置信度</Text>
                <Chip.Group multiple={false} value={minConfidence.toString()} onChange={(v) => setMinConfidence(Number(v))}>
                  <Chip value="0" size="xs">全部</Chip>
                  <Chip value="2" size="xs">中+</Chip>
                  <Chip value="3" size="xs">高+</Chip>
                  <Chip value="4" size="xs">极高</Chip>
                </Chip.Group>
              </Stack>
            </Grid.Col>
          </Grid>

          {!selectedTargetId && (
            <Alert color="blue" variant="light" icon={<IconInfoCircle size={16} />}>
              请选择一个{targetType === 'sherd' ? '残片' : '复原方案'}，系统将基于知识库中的历史案例为您生成智能推荐
            </Alert>
          )}

          {selectedTargetId && recommendations.length === 0 && (
            <Alert color="orange" variant="light" icon={<IconFileSearch size={16} />}>
              未找到符合条件的推荐结果，请尝试调整筛选条件或导入更多项目数据到知识库
            </Alert>
          )}
        </Stack>
      </Card>

      {selectedTargetId && recommendations.length > 0 && (
        <Grid>
          <Grid.Col span={5}>
            <Card shadow="sm" padding="md" radius="md" withBorder>
              <Stack gap="md">
                <Group justify="space-between">
                  <Group gap="xs">
                    <IconStar size={16} color="var(--mantine-color-yellow-6)" />
                    <Text fw={600} size="sm">推荐列表</Text>
                  </Group>
                  <Group gap="xs">
                    <Badge size="xs" variant="light">平均分: {stats.avgScore.toFixed(1)}</Badge>
                    <Badge size="xs" color="green" variant="light">已应用: {stats.appliedCount}</Badge>
                  </Group>
                </Group>

                <Grid grow>
                  {(Object.entries(stats.typeCounts) as [RecommendationResult['recommendationType'], number][]).map(([type, count]) => (
                    <Grid.Col key={type} span={3}>
                      <Card withBorder padding="xs" radius="sm">
                        <Stack gap={0} align="center">
                          {React.createElement(RECOMMENDATION_TYPE_ICONS[type], { size: 12, color: `var(--mantine-color-${RECOMMENDATION_TYPE_COLORS[type]}-6)` })}
                          <Text size="8" c="dimmed">{RECOMMENDATION_TYPE_LABELS[type]}</Text>
                          <Text size="xs" fw={600}>{count}</Text>
                        </Stack>
                      </Card>
                    </Grid.Col>
                  ))}
                </Grid>

                <ScrollArea h={520}>
                  <Stack gap="sm">
                    {recommendations.map((rec) => (
                      <RecommendationCard
                        key={rec.id}
                        recommendation={rec}
                        isSelected={selectedRecommendationId === rec.id}
                        onClick={() => setSelectedRecommendationId(rec.id)}
                        onApply={() => handleApplyRecommendation(rec.id)}
                      />
                    ))}
                  </Stack>
                </ScrollArea>
              </Stack>
            </Card>
          </Grid.Col>

          <Grid.Col span={7}>
            {selectedRecommendation ? (
              <Stack gap="md">
                <Card shadow="sm" padding="md" radius="md" withBorder>
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Group gap="xs">
                        <ThemeIcon size="lg" color={RECOMMENDATION_TYPE_COLORS[selectedRecommendation.recommendationType]}>
                          {React.createElement(RECOMMENDATION_TYPE_ICONS[selectedRecommendation.recommendationType], { size: 20 })}
                        </ThemeIcon>
                        <Stack gap={0}>
                          <Group gap="xs">
                            <Badge size="sm" color={RECOMMENDATION_TYPE_COLORS[selectedRecommendation.recommendationType]}>
                              {RECOMMENDATION_TYPE_LABELS[selectedRecommendation.recommendationType]}
                            </Badge>
                            <Badge
                              size="sm"
                              color={CONFIDENCE_COLORS[selectedRecommendation.confidenceLevel]}
                              variant="light"
                              leftSection={<IconCertificate size={10} />}
                            >
                              {CONFIDENCE_LABELS[selectedRecommendation.confidenceLevel]}置信度
                            </Badge>
                            {selectedRecommendation.isApplied && (
                              <Badge size="sm" color="green" leftSection={<IconCheck size={10} />}>
                                已应用
                              </Badge>
                            )}
                          </Group>
                          <Text size="lg" fw={700}>
                            {selectedRecommendation.recommendedEntry.title}
                          </Text>
                        </Stack>
                      </Group>
                      <Group gap="xs">
                        <Tooltip label="复制引用格式">
                          <ActionIcon size="sm" variant="light" onClick={exportRecommendationCitation}>
                            <IconCopy size={14} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="导出引用">
                          <ActionIcon size="sm" variant="light" onClick={exportRecommendationCitation}>
                            <IconDownload size={14} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="认可此推荐">
                          <ActionIcon size="sm" variant="light" color="green">
                            <IconThumbUp size={14} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="反对此推荐">
                          <ActionIcon size="sm" variant="light" color="red">
                            <IconThumbDown size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Group>

                    <Divider />

                    <Stack gap="sm">
                      <Group align="flex-start" gap="xs">
                        <ThemeIcon size="sm" color="yellow" variant="light">
                          <IconBulb size={14} />
                        </ThemeIcon>
                        <Stack gap="xs" style={{ flex: 1 }}>
                          <Text size="sm" fw={600}>推荐理由</Text>
                          <List size="sm" spacing="xs">
                            {selectedRecommendation.recommendationReasons.map((reason, i) => (
                              <List.Item key={i} icon={<IconCheck size={12} color="#22c55e" />}>
                                {reason}
                              </List.Item>
                            ))}
                          </List>
                        </Stack>
                      </Group>

                      <Group align="flex-start" gap="xs">
                        <ThemeIcon size="sm" color="blue" variant="light">
                          <IconFileText size={14} />
                        </ThemeIcon>
                        <Stack gap="xs" style={{ flex: 1 }}>
                          <Text size="sm" fw={600}>详细说明</Text>
                          <Text size="sm" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>
                            {selectedRecommendation.detailedExplanation}
                          </Text>
                        </Stack>
                      </Group>
                    </Stack>

                    <Grid>
                      <Grid.Col span={6}>
                        <Card withBorder padding="sm" radius="sm">
                          <Stack gap="sm">
                            <Group justify="space-between">
                              <Text size="sm" fw={600}>综合推荐指数</Text>
                              <RingProgress
                                size={60}
                                thickness={8}
                                roundCaps
                                sections={[
                                  {
                                    value: selectedRecommendation.recommendationScore,
                                    color: selectedRecommendation.recommendationScore >= 70 ? '#22c55e' : selectedRecommendation.recommendationScore >= 40 ? '#eab308' : '#ef4444',
                                  },
                                ]}
                                label={
                                  <Text size="md" fw={700} ta="center">
                                    {selectedRecommendation.recommendationScore.toFixed(0)}
                                  </Text>
                                }
                              />
                            </Group>
                            <Divider label="七维相似度得分" labelPosition="center" />
                            <ScoreBreakdown scores={selectedRecommendation.similarityScores} />
                          </Stack>
                        </Card>
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <Card withBorder padding="sm" radius="sm">
                          <Stack gap="sm">
                            <Group gap="xs">
                              <IconMapPin size={14} color="var(--mantine-color-blue-6)" />
                              <Text size="sm" fw={600}>来源信息</Text>
                            </Group>
                            <Stack gap="xs">
                              <Group justify="space-between">
                                <Text size="xs" c="dimmed">项目</Text>
                                <Text size="xs" fw={500}>{selectedRecommendation.recommendedEntry.sourceProjectName}</Text>
                              </Group>
                              {selectedRecommendation.recommendedEntry.sourceProjectMetadata?.siteName && (
                                <Group justify="space-between">
                                  <Text size="xs" c="dimmed">遗址</Text>
                                  <Text size="xs" fw={500}>{selectedRecommendation.recommendedEntry.sourceProjectMetadata.siteName}</Text>
                                </Group>
                              )}
                              {selectedRecommendation.recommendedEntry.sourceProjectMetadata?.archaeologist && (
                                <Group justify="space-between">
                                  <Text size="xs" c="dimmed">考古学家</Text>
                                  <Text size="xs" fw={500}>{selectedRecommendation.recommendedEntry.sourceProjectMetadata.archaeologist}</Text>
                                </Group>
                              )}
                              {selectedRecommendation.recommendedEntry.featureVector.period && (
                                <Group justify="space-between">
                                  <Text size="xs" c="dimmed">年代</Text>
                                  <Text size="xs" fw={500}>{selectedRecommendation.recommendedEntry.featureVector.period}</Text>
                                </Group>
                              )}
                              {selectedRecommendation.recommendedEntry.featureVector.artifactType && (
                                <Group justify="space-between">
                                  <Text size="xs" c="dimmed">器型</Text>
                                  <Text size="xs" fw={500}>{ARTIFACT_TYPE_LABELS[selectedRecommendation.recommendedEntry.featureVector.artifactType]}</Text>
                                </Group>
                              )}
                              <Group justify="space-between">
                                <Text size="xs" c="dimmed">浏览/引用</Text>
                                <Text size="xs" fw={500}>
                                  {selectedRecommendation.recommendedEntry.viewCount} / {selectedRecommendation.recommendedEntry.referenceCount}
                                </Text>
                              </Group>
                            </Stack>
                          </Stack>
                        </Card>
                      </Grid.Col>
                    </Grid>
                  </Stack>
                </Card>

                {selectedRecommendation.evidenceCitations.length > 0 && (
                  <Card shadow="sm" padding="md" radius="md" withBorder>
                    <Stack gap="sm">
                      <Group gap="xs">
                        <IconQuote size={16} color="var(--mantine-color-orange-6)" />
                        <Text fw={600} size="sm">
                          证据来源引用 ({selectedRecommendation.evidenceCitations.length})
                        </Text>
                      </Group>
                      <ScrollArea h={200}>
                        <Stack gap="xs">
                          {selectedRecommendation.evidenceCitations.map((citation) => (
                            <EvidenceCitationCard key={citation.id} citation={citation} />
                          ))}
                        </Stack>
                      </ScrollArea>
                    </Stack>
                  </Card>
                )}

                {selectedRecommendation.supportingEntries.length > 0 && (
                  <Card shadow="sm" padding="md" radius="md" withBorder>
                    <Stack gap="sm">
                      <Group gap="xs">
                        <IconUsers size={16} color="var(--mantine-color-teal-6)" />
                        <Text fw={600} size="sm">
                          相关支持条目 ({selectedRecommendation.supportingEntries.length})
                        </Text>
                      </Group>
                      <ScrollArea>
                        <Table withTableBorder withColumnBorders>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>条目名称</Table.Th>
                              <Table.Th>来源项目</Table.Th>
                              <Table.Th>相关性</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {selectedRecommendation.supportingEntries.map((entry) => (
                              <Table.Tr key={entry.entryId}>
                                <Table.Td>
                                  <Text size="xs" fw={500}>{entry.entryTitle}</Text>
                                </Table.Td>
                                <Table.Td>
                                  <Text size="xs" c="dimmed">{entry.sourceProjectName}</Text>
                                </Table.Td>
                                <Table.Td>
                                  <Group gap="xs">
                                    <Progress
                                      value={entry.relevance}
                                      color={entry.relevance >= 70 ? 'green' : entry.relevance >= 40 ? 'yellow' : 'red'}
                                      size="xs"
                                      style={{ width: 60 }}
                                    />
                                    <Text size="xs" fw={600}>{entry.relevance.toFixed(0)}%</Text>
                                  </Group>
                                </Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                      </ScrollArea>
                    </Stack>
                  </Card>
                )}

                <Alert color="yellow" variant="light" icon={<IconInfoCircle size={16} />} title="可解释性说明">
                  <Text size="xs">
                    本推荐基于多维度特征匹配算法生成，权重配置为：器型({(DEFAULT_FEATURE_WEIGHTS.typeWeight * 100).toFixed(0)}%)、年代({(DEFAULT_FEATURE_WEIGHTS.periodWeight * 100).toFixed(0)}%)、地层({(DEFAULT_FEATURE_WEIGHTS.stratigraphyWeight * 100).toFixed(0)}%)、纹饰({(DEFAULT_FEATURE_WEIGHTS.patternWeight * 100).toFixed(0)}%)、厚度({(DEFAULT_FEATURE_WEIGHTS.thicknessWeight * 100).toFixed(0)}%)、口沿曲率({(DEFAULT_FEATURE_WEIGHTS.rimCurvatureWeight * 100).toFixed(0)}%)、尺寸({(DEFAULT_FEATURE_WEIGHTS.sizeWeight * 100).toFixed(0)}%)。所有推荐均基于知识库中的历史案例数据，仅供学术研究参考。
                  </Text>
                </Alert>
              </Stack>
            ) : (
              <Card shadow="sm" padding="md" radius="md" withBorder h={600}>
                <Stack justify="center" align="center" h="100%">
                  <IconBulb size={48} color="var(--mantine-color-gray-4)" />
                  <Text c="dimmed" ta="center">
                    请从左侧选择一个推荐结果查看详细信息
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
