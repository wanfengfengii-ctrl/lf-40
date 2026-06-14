import { useState, useMemo, useEffect } from 'react';
import {
  Card,
  Text,
  Group,
  Badge,
  TextInput,
  Button,
  Stack,
  ScrollArea,
  Chip,
  RangeSlider,
  Grid,
  Modal,
  Divider,
  ActionIcon,
  Tooltip,
  Select,
  MultiSelect,
  Accordion,
  RingProgress,
  Progress,
  List,
  Alert,
  FileButton,
  Box,
} from '@mantine/core';
import {
  IconSearch,
  IconDatabase,
  IconFilter,
  IconX,
  IconEye,
  IconCheck,
  IconTrash,
  IconDownload,
  IconUpload,
  IconRefresh,
  IconPlus,
  IconCalendar,
  IconMapPin,
  IconUser,
  IconStar,
  IconExternalLink,
  IconBrush,
  IconMug,
  IconFileText,
  IconLink,
  IconStack,
} from '@tabler/icons-react';
import { useAppStore } from '@/store';
import {
  ARTIFACT_TYPE_LABELS,
  RIM_CURVATURE_LABELS,
  PATTERN_STYLE_LABELS,
} from '@/types';
import type {
  KnowledgeBaseEntry,
  KnowledgeBaseSearchFilter,
  ArtifactType,
  RimCurvature,
  PatternStyle,
} from '@/types';
import { getSampleKnowledgeBase } from '@/utils/sampleKnowledgeBase';

const ENTRY_TYPE_LABELS: Record<KnowledgeBaseEntry['entryType'], string> = {
  sherd: '残片',
  scheme: '复原方案',
  report: '研究报告',
  evidence_chain: '证据链',
};

const ENTRY_TYPE_COLORS: Record<KnowledgeBaseEntry['entryType'], string> = {
  sherd: 'blue',
  scheme: 'grape',
  report: 'teal',
  evidence_chain: 'orange',
};

const CONFIDENCE_COLORS: Record<string, string> = {
  very_high: 'green',
  high: 'teal',
  medium: 'yellow',
  low: 'red',
};

const CONFIDENCE_LABELS: Record<string, string> = {
  very_high: '极高',
  high: '高',
  medium: '中',
  low: '低',
};

export function KnowledgeBaseBrowser() {
  const knowledgeBase = useAppStore((s) => s.knowledgeBase);
  const knowledgeBaseStats = useAppStore((s) => s.knowledgeBaseStats);
  const searchKnowledgeBase = useAppStore((s) => s.searchKnowledgeBase);
  const removeFromKnowledgeBase = useAppStore((s) => s.removeFromKnowledgeBase);
  const toggleKnowledgeBaseEntryTrusted = useAppStore((s) => s.toggleKnowledgeBaseEntryTrusted);
  const incrementViewCount = useAppStore((s) => s.incrementViewCount);
  const importCurrentProjectToKnowledgeBase = useAppStore((s) => s.importCurrentProjectToKnowledgeBase);
  const importProjectFileToKnowledgeBase = useAppStore((s) => s.importProjectFileToKnowledgeBase);
  const getUniqueProjects = useAppStore((s) => s.getUniqueProjects);
  const getUniquePeriods = useAppStore((s) => s.getUniquePeriods);
  const loadKnowledgeBaseFromLocal = useAppStore((s) => s.loadKnowledgeBaseFromLocal);
  const clearKnowledgeBase = useAppStore((s) => s.clearKnowledgeBase);
  const refreshKnowledgeBaseStats = useAppStore((s) => s.refreshKnowledgeBaseStats);

  const [searchText, setSearchText] = useState('');
  const [selectedEntryTypes, setSelectedEntryTypes] = useState<KnowledgeBaseEntry['entryType'][]>([]);
  const [selectedArtifactTypes, setSelectedArtifactTypes] = useState<ArtifactType[]>([]);
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);
  const [selectedPatterns, setSelectedPatterns] = useState<PatternStyle[]>([]);
  const [selectedRimCurvatures, setSelectedRimCurvatures] = useState<RimCurvature[]>([]);
  const [thicknessRange, setThicknessRange] = useState<[number, number]>([0, 20]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [trustedOnly, setTrustedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<KnowledgeBaseSearchFilter['sortBy']>('date');
  const [sortAsc, setSortAsc] = useState(false);

  const [selectedEntry, setSelectedEntry] = useState<KnowledgeBaseEntry | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [importResult, setImportResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(true);

  const projects = useMemo(() => getUniqueProjects(), [knowledgeBase]);
  const periods = useMemo(() => getUniquePeriods(), [knowledgeBase]);

  useEffect(() => {
    const loaded = loadKnowledgeBaseFromLocal();
    if (!loaded && knowledgeBase.length === 0) {
      const sampleData = getSampleKnowledgeBase();
      sampleData.forEach((entry) => {
        useAppStore.getState().knowledgeBase.push(entry);
      });
      useAppStore.getState().lastKnowledgeBaseUpdate = Date.now();
      refreshKnowledgeBaseStats();
      useAppStore.getState().saveKnowledgeBaseToLocal();
    }
  }, []);

  const searchResult = useMemo(() => {
    const filter: KnowledgeBaseSearchFilter = {
      keyword: searchText || undefined,
      artifactTypes: selectedArtifactTypes.length > 0 ? selectedArtifactTypes : undefined,
      periods: selectedPeriods.length > 0 ? selectedPeriods : undefined,
      patternStyles: selectedPatterns.length > 0 ? selectedPatterns : undefined,
      rimCurvatures: selectedRimCurvatures.length > 0 ? selectedRimCurvatures : undefined,
      thicknessRange: { min: thicknessRange[0], max: thicknessRange[1] },
      entryTypes: selectedEntryTypes.length > 0 ? selectedEntryTypes : undefined,
      sourceProjectIds: selectedProjects.length > 0 ? selectedProjects : undefined,
      isTrustedOnly: trustedOnly || undefined,
      sortBy,
      sortAsc,
      pageSize: 100,
    };
    return searchKnowledgeBase(filter);
  }, [
    searchText,
    selectedArtifactTypes,
    selectedPeriods,
    selectedPatterns,
    selectedRimCurvatures,
    thicknessRange,
    selectedEntryTypes,
    selectedProjects,
    trustedOnly,
    sortBy,
    sortAsc,
    knowledgeBase,
  ]);

  const handleViewEntry = (entry: KnowledgeBaseEntry) => {
    incrementViewCount(entry.id);
    setSelectedEntry(entry);
    setDetailModalOpen(true);
  };

  const handleImportCurrentProject = () => {
    const result = importCurrentProjectToKnowledgeBase();
    if (result.success) {
      setImportResult({
        type: 'success',
        message: `成功导入 ${result.importedCount} 条数据，跳过 ${result.skippedCount} 条已存在数据`,
      });
    } else {
      setImportResult({ type: 'error', message: result.error || '导入失败' });
    }
    setTimeout(() => setImportResult(null), 5000);
  };

  const handleImportProjectFile = async (file: File | null) => {
    if (!file) return;
    const result = await importProjectFileToKnowledgeBase(file);
    if (result.success) {
      setImportResult({
        type: 'success',
        message: `成功导入 ${result.importedCount} 条数据，跳过 ${result.skippedCount} 条已存在数据`,
      });
    } else {
      setImportResult({ type: 'error', message: result.error || '导入失败' });
    }
    setTimeout(() => setImportResult(null), 5000);
  };

  const handleClearFilters = () => {
    setSearchText('');
    setSelectedEntryTypes([]);
    setSelectedArtifactTypes([]);
    setSelectedPeriods([]);
    setSelectedPatterns([]);
    setSelectedRimCurvatures([]);
    setThicknessRange([0, 20]);
    setSelectedProjects([]);
    setTrustedOnly(false);
  };

  const formatDate = (ts: number) => new Date(ts).toLocaleDateString('zh-CN');

  return (
    <Stack gap="md" style={{ height: 'calc(100vh - 180px)' }}>
      <Group justify="space-between">
        <Group gap="xs">
          <IconDatabase size={24} color="#6366f1" />
          <div>
            <Text fw={600} size="lg">跨项目知识库</Text>
            <Text size="xs" c="dimmed">
              {knowledgeBaseStats
                ? `共 ${knowledgeBaseStats.totalEntries} 条数据，来自 ${knowledgeBaseStats.projectCount} 个项目`
                : '加载中...'}
            </Text>
          </div>
        </Group>
        <Group gap="xs">
          <Tooltip label="导入当前项目">
            <Button
              size="xs"
              variant="light"
              leftSection={<IconPlus size={14} />}
              onClick={handleImportCurrentProject}
            >
              导入当前项目
            </Button>
          </Tooltip>
          <FileButton onChange={handleImportProjectFile} accept=".json">
            {(props) => (
              <Button {...props} size="xs" variant="light" leftSection={<IconUpload size={14} />}>
                导入项目文件
              </Button>
            )}
          </FileButton>
          <Tooltip label="刷新统计">
            <ActionIcon size="sm" variant="light" onClick={refreshKnowledgeBaseStats}>
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="清空知识库">
            <ActionIcon size="sm" variant="light" color="red" onClick={() => setClearConfirmOpen(true)}>
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={showFilters ? '隐藏筛选' : '显示筛选'}>
            <ActionIcon size="sm" variant="light" onClick={() => setShowFilters(!showFilters)}>
              <IconFilter size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {importResult && (
        <Alert
          color={importResult.type === 'success' ? 'green' : 'red'}
          icon={importResult.type === 'success' ? <IconCheck size={16} /> : <IconX size={16} />}
          onClose={() => setImportResult(null)}
          withCloseButton
        >
          {importResult.message}
        </Alert>
      )}

      {knowledgeBaseStats && (
        <Grid>
          <Grid.Col span={2}>
            <Card withBorder padding="sm" radius="md">
              <Stack gap={0} align="center">
                <RingProgress
                  size={60}
                  thickness={6}
                  sections={[{ value: 100, color: '#6366f1' }]}
                  label={<Text size="xs" fw={600}>{knowledgeBaseStats.totalEntries}</Text>}
                />
                <Text size="xs" c="dimmed">总条目</Text>
              </Stack>
            </Card>
          </Grid.Col>
          <Grid.Col span={2}>
            <Card withBorder padding="sm" radius="md">
              <Stack gap={0} align="center">
                <Text size="xl" fw={700} c="#3b82f6">{knowledgeBaseStats.sherdCount}</Text>
                <Text size="xs" c="dimmed">残片</Text>
              </Stack>
            </Card>
          </Grid.Col>
          <Grid.Col span={2}>
            <Card withBorder padding="sm" radius="md">
              <Stack gap={0} align="center">
                <Text size="xl" fw={700} c="#a855f7">{knowledgeBaseStats.schemeCount}</Text>
                <Text size="xs" c="dimmed">复原方案</Text>
              </Stack>
            </Card>
          </Grid.Col>
          <Grid.Col span={2}>
            <Card withBorder padding="sm" radius="md">
              <Stack gap={0} align="center">
                <Text size="xl" fw={700} c="#10b981">{knowledgeBaseStats.trustedEntryCount}</Text>
                <Text size="xs" c="dimmed">可信条目</Text>
              </Stack>
            </Card>
          </Grid.Col>
          <Grid.Col span={2}>
            <Card withBorder padding="sm" radius="md">
              <Stack gap={0} align="center">
                <Text size="xl" fw={700} c="#f59e0b">{knowledgeBaseStats.projectCount}</Text>
                <Text size="xs" c="dimmed">项目数</Text>
              </Stack>
            </Card>
          </Grid.Col>
          <Grid.Col span={2}>
            <Card withBorder padding="sm" radius="md">
              <Stack gap={0} align="center">
                <Text size="xl" fw={700} c="#ef4444">{knowledgeBaseStats.totalReferenceCount}</Text>
                <Text size="xs" c="dimmed">总引用</Text>
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>
      )}

      <Group grow align="flex-start">
        {showFilters && (
          <Box style={{ width: 280, flexShrink: 0 }}>
            <Card withBorder padding="md" radius="md" style={{ height: '100%' }}>
              <ScrollArea h="calc(100vh - 380px)">
                <Stack gap="md">
                  <Group justify="space-between">
                    <Text fw={600} size="sm">筛选条件</Text>
                    <Button
                      size="xs"
                      variant="subtle"
                      color="gray"
                      onClick={handleClearFilters}
                      leftSection={<IconX size={12} />}
                    >
                      清空
                    </Button>
                  </Group>

                  <Divider />

                  <TextInput
                    placeholder="搜索关键词..."
                    leftSection={<IconSearch size={14} />}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    size="xs"
                  />

                  <div>
                    <Text size="xs" fw={600} mb="xs">条目类型</Text>
                    <Chip.Group multiple value={selectedEntryTypes} onChange={setSelectedEntryTypes as any}>
                      <Group gap="xs">
                        {Object.entries(ENTRY_TYPE_LABELS).map(([value, label]) => (
                          <Chip
                            key={value}
                            value={value}
                            size="xs"
                            variant="light"
                            color={ENTRY_TYPE_COLORS[value as keyof typeof ENTRY_TYPE_COLORS]}
                          >
                            {label}
                          </Chip>
                        ))}
                      </Group>
                    </Chip.Group>
                  </div>

                  <Accordion variant="separated">
                    <Accordion.Item value="type">
                      <Accordion.Control>
                        <Text size="xs" fw={500}>器型筛选</Text>
                      </Accordion.Control>
                      <Accordion.Panel>
                        <Chip.Group multiple value={selectedArtifactTypes} onChange={setSelectedArtifactTypes as any}>
                          <Group gap="xs">
                            {Object.entries(ARTIFACT_TYPE_LABELS).map(([value, label]) => (
                              <Chip key={value} value={value} size="xs" variant="outline">
                                {label}
                              </Chip>
                            ))}
                          </Group>
                        </Chip.Group>
                      </Accordion.Panel>
                    </Accordion.Item>

                    <Accordion.Item value="period">
                      <Accordion.Control>
                        <Text size="xs" fw={500}>年代筛选</Text>
                      </Accordion.Control>
                      <Accordion.Panel>
                        <MultiSelect
                          data={periods.map((p) => ({ value: p, label: p }))}
                          placeholder="选择年代..."
                          value={selectedPeriods}
                          onChange={setSelectedPeriods}
                          size="xs"
                          searchable
                        />
                      </Accordion.Panel>
                    </Accordion.Item>

                    <Accordion.Item value="pattern">
                      <Accordion.Control>
                        <Text size="xs" fw={500}>纹饰筛选</Text>
                      </Accordion.Control>
                      <Accordion.Panel>
                        <Chip.Group multiple value={selectedPatterns} onChange={setSelectedPatterns as any}>
                          <Group gap="xs">
                            {Object.entries(PATTERN_STYLE_LABELS).map(([value, label]) => (
                              <Chip key={value} value={value} size="xs" variant="outline">
                                {label}
                              </Chip>
                            ))}
                          </Group>
                        </Chip.Group>
                      </Accordion.Panel>
                    </Accordion.Item>

                    <Accordion.Item value="rim">
                      <Accordion.Control>
                        <Text size="xs" fw={500}>口沿曲率</Text>
                      </Accordion.Control>
                      <Accordion.Panel>
                        <Chip.Group multiple value={selectedRimCurvatures} onChange={setSelectedRimCurvatures as any}>
                          <Group gap="xs">
                            {Object.entries(RIM_CURVATURE_LABELS).map(([value, label]) => (
                              <Chip key={value} value={value} size="xs" variant="outline">
                                {label}
                              </Chip>
                            ))}
                          </Group>
                        </Chip.Group>
                      </Accordion.Panel>
                    </Accordion.Item>

                    <Accordion.Item value="thickness">
                      <Accordion.Control>
                        <Text size="xs" fw={500}>厚度范围: {thicknessRange[0]} - {thicknessRange[1]} mm</Text>
                      </Accordion.Control>
                      <Accordion.Panel>
                        <RangeSlider
                          min={0}
                          max={20}
                          step={0.5}
                          value={thicknessRange}
                          onChange={setThicknessRange}
                          labelAlwaysOn
                          size="sm"
                        />
                      </Accordion.Panel>
                    </Accordion.Item>

                    <Accordion.Item value="project">
                      <Accordion.Control>
                        <Text size="xs" fw={500}>来源项目</Text>
                      </Accordion.Control>
                      <Accordion.Panel>
                        <MultiSelect
                          data={projects.map((p) => ({ value: p.id, label: p.name }))}
                          placeholder="选择项目..."
                          value={selectedProjects}
                          onChange={setSelectedProjects}
                          size="xs"
                          searchable
                        />
                      </Accordion.Panel>
                    </Accordion.Item>
                  </Accordion>

                  <Divider />

                  <Chip
                    checked={trustedOnly}
                    onChange={setTrustedOnly}
                    size="xs"
                    color="green"
                    variant="light"
                  >
                    仅显示可信条目
                  </Chip>

                  <Divider />

                  <Select
                    label="排序方式"
                    size="xs"
                    value={sortBy}
                    onChange={(v) => setSortBy(v as any)}
                    data={[
                      { value: 'date', label: '按日期' },
                      { value: 'viewCount', label: '按浏览量' },
                      { value: 'referenceCount', label: '按引用量' },
                      { value: 'relevance', label: '按相关性' },
                    ]}
                  />

                  <Chip
                    checked={sortAsc}
                    onChange={setSortAsc}
                    size="xs"
                    variant="outline"
                  >
                    升序排列
                  </Chip>
                </Stack>
              </ScrollArea>
            </Card>
          </Box>
        )}

        <Box style={{ flex: 1, minWidth: 0 }}>
          <Card withBorder padding="md" radius="md" style={{ height: '100%' }}>
            <Group justify="space-between" mb="md">
              <Group gap="xs">
                <Text fw={600}>搜索结果</Text>
                <Badge size="sm" variant="light">
                  {searchResult.total} 条
                </Badge>
              </Group>
            </Group>

            {searchResult.entries.length === 0 ? (
              <Stack align="center" justify="center" style={{ height: 300 }}>
                <IconSearch size={48} color="#9ca3af" stroke={1} />
                <Text c="dimmed" size="sm">未找到匹配的条目</Text>
                <Button size="xs" variant="light" onClick={handleClearFilters}>
                  清除筛选条件
                </Button>
              </Stack>
            ) : (
              <ScrollArea h="calc(100vh - 420px)">
                <Stack gap="sm">
                  {searchResult.entries.map((entry) => (
                    <Card
                      key={entry.id}
                      withBorder
                      padding="sm"
                      radius="md"
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleViewEntry(entry)}
                    >
                      <Group justify="space-between" align="flex-start">
                        <Group gap="xs" style={{ flex: 1 }}>
                          <Badge
                            size="sm"
                            color={ENTRY_TYPE_COLORS[entry.entryType]}
                            variant="light"
                            leftSection={
                              entry.entryType === 'sherd' ? <IconBrush size={10} /> :
                              entry.entryType === 'scheme' ? <IconMug size={10} /> :
                              entry.entryType === 'report' ? <IconFileText size={10} /> :
                              <IconLink size={10} />
                            }
                          >
                            {ENTRY_TYPE_LABELS[entry.entryType]}
                          </Badge>
                          <Text fw={600} size="sm">{entry.title}</Text>
                          {entry.isTrusted && (
                            <Tooltip label="可信条目">
                              <Badge size="xs" color="green" variant="dot">
                                可信
                              </Badge>
                            </Tooltip>
                          )}
                        </Group>
                        <Group gap="xs">
                          <Text size="xs" c="dimmed">
                            <IconEye size={12} style={{ display: 'inline', marginRight: 2 }} />
                            {entry.viewCount}
                          </Text>
                          <Text size="xs" c="dimmed">
                            <IconStar size={12} style={{ display: 'inline', marginRight: 2 }} />
                            {entry.referenceCount}
                          </Text>
                          <ActionIcon
                            size="xs"
                            variant="subtle"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleKnowledgeBaseEntryTrusted(entry.id);
                            }}
                            color={entry.isTrusted ? 'green' : 'gray'}
                          >
                            <IconCheck size={12} />
                          </ActionIcon>
                          <ActionIcon
                            size="xs"
                            variant="subtle"
                            color="red"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFromKnowledgeBase(entry.id);
                            }}
                          >
                            <IconTrash size={12} />
                          </ActionIcon>
                        </Group>
                      </Group>

                      <Text size="xs" c="dimmed" mt="xs" lineClamp={2}>
                        {entry.description}
                      </Text>

                      <Group gap="xs" mt="xs">
                        <Badge size="xs" variant="light" color="indigo">
                          <Group gap={4} align="center">
                            <IconMapPin size={10} />
                            <span>{entry.sourceProjectName}</span>
                          </Group>
                        </Badge>
                        {entry.featureVector.period && (
                          <Badge size="xs" variant="light" color="grape">
                            <Group gap={4} align="center">
                              <IconCalendar size={10} />
                              <span>{entry.featureVector.period}</span>
                            </Group>
                          </Badge>
                        )}
                        {entry.featureVector.artifactType && (
                          <Badge size="xs" variant="light" color="blue">
                            {ARTIFACT_TYPE_LABELS[entry.featureVector.artifactType]}
                          </Badge>
                        )}
                        {entry.featureVector.patternStyle && (
                          <Badge size="xs" variant="light" color="orange">
                            {PATTERN_STYLE_LABELS[entry.featureVector.patternStyle]}
                          </Badge>
                        )}
                        {entry.featureVector.thickness !== null && (
                          <Badge size="xs" variant="light" color="teal">
                            {entry.featureVector.thickness}mm
                          </Badge>
                        )}
                      </Group>

                      <Group gap="xs" mt="xs">
                        {entry.tags.slice(0, 5).map((tag, i) => (
                          <Badge key={i} size="xs" variant="outline" color="gray">
                            {tag}
                          </Badge>
                        ))}
                        {entry.tags.length > 5 && (
                          <Badge size="xs" variant="outline" color="gray">
                            +{entry.tags.length - 5}
                          </Badge>
                        )}
                      </Group>
                    </Card>
                  ))}
                </Stack>
              </ScrollArea>
            )}
          </Card>
        </Box>
      </Group>

      <Modal
        opened={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={selectedEntry?.title || '详情'}
        size="lg"
      >
        {selectedEntry && (
          <Stack gap="md">
            <Group>
              <Badge
                size="sm"
                color={ENTRY_TYPE_COLORS[selectedEntry.entryType]}
                variant="light"
              >
                {ENTRY_TYPE_LABELS[selectedEntry.entryType]}
              </Badge>
              {selectedEntry.isTrusted && (
                <Badge size="sm" color="green" variant="light" leftSection={<IconCheck size={10} />}>
                  可信条目
                </Badge>
              )}
            </Group>

            <Text size="sm">{selectedEntry.description}</Text>

            <Grid>
              <Grid.Col span={6}>
                <Card withBorder padding="sm" radius="md">
                  <Stack gap="xs">
                    <Text fw={600} size="xs">来源信息</Text>
                    <Group gap="xs">
                      <IconMapPin size={14} color="#6366f1" />
                      <Text size="xs">{selectedEntry.sourceProjectName}</Text>
                    </Group>
                    {selectedEntry.sourceProjectMetadata?.siteName && (
                      <Group gap="xs">
                        <IconStack size={14} color="#6366f1" />
                        <Text size="xs">遗址: {selectedEntry.sourceProjectMetadata.siteName}</Text>
                      </Group>
                    )}
                    {selectedEntry.sourceProjectMetadata?.archaeologist && (
                      <Group gap="xs">
                        <IconUser size={14} color="#6366f1" />
                        <Text size="xs">考古学家: {selectedEntry.sourceProjectMetadata.archaeologist}</Text>
                      </Group>
                    )}
                    <Group gap="xs">
                      <IconCalendar size={14} color="#6366f1" />
                      <Text size="xs">创建时间: {formatDate(selectedEntry.createdAt)}</Text>
                    </Group>
                    <Group gap="xs">
                      <IconDownload size={14} color="#6366f1" />
                      <Text size="xs">导入时间: {formatDate(selectedEntry.importedAt)}</Text>
                    </Group>
                  </Stack>
                </Card>
              </Grid.Col>
              <Grid.Col span={6}>
                <Card withBorder padding="sm" radius="md">
                  <Stack gap="xs">
                    <Text fw={600} size="xs">特征向量</Text>
                    {selectedEntry.featureVector.artifactType && (
                      <Group justify="space-between">
                        <Text size="xs" c="dimmed">器型</Text>
                        <Text size="xs" fw={500}>{ARTIFACT_TYPE_LABELS[selectedEntry.featureVector.artifactType]}</Text>
                      </Group>
                    )}
                    {selectedEntry.featureVector.period && (
                      <Group justify="space-between">
                        <Text size="xs" c="dimmed">年代</Text>
                        <Text size="xs" fw={500}>{selectedEntry.featureVector.period}</Text>
                      </Group>
                    )}
                    {selectedEntry.featureVector.layerNumber && (
                      <Group justify="space-between">
                        <Text size="xs" c="dimmed">地层</Text>
                        <Text size="xs" fw={500}>第 {selectedEntry.featureVector.layerNumber} 层</Text>
                      </Group>
                    )}
                    {selectedEntry.featureVector.patternStyle && (
                      <Group justify="space-between">
                        <Text size="xs" c="dimmed">纹饰</Text>
                        <Text size="xs" fw={500}>{PATTERN_STYLE_LABELS[selectedEntry.featureVector.patternStyle]}</Text>
                      </Group>
                    )}
                    {selectedEntry.featureVector.thickness !== null && (
                      <Group justify="space-between">
                        <Text size="xs" c="dimmed">厚度</Text>
                        <Text size="xs" fw={500}>{selectedEntry.featureVector.thickness} mm</Text>
                      </Group>
                    )}
                    {selectedEntry.featureVector.rimCurvature && (
                      <Group justify="space-between">
                        <Text size="xs" c="dimmed">口沿曲率</Text>
                        <Text size="xs" fw={500}>{RIM_CURVATURE_LABELS[selectedEntry.featureVector.rimCurvature]}</Text>
                      </Group>
                    )}
                    {selectedEntry.featureVector.estimatedRimDiameter !== null && (
                      <Group justify="space-between">
                        <Text size="xs" c="dimmed">估计口径</Text>
                        <Text size="xs" fw={500}>{selectedEntry.featureVector.estimatedRimDiameter} cm</Text>
                      </Group>
                    )}
                    {selectedEntry.featureVector.estimatedHeight !== null && (
                      <Group justify="space-between">
                        <Text size="xs" c="dimmed">估计器高</Text>
                        <Text size="xs" fw={500}>{selectedEntry.featureVector.estimatedHeight} cm</Text>
                      </Group>
                    )}
                  </Stack>
                </Card>
              </Grid.Col>
            </Grid>

            {selectedEntry.schemeMetrics && (
              <Card withBorder padding="sm" radius="md">
                <Text fw={600} size="xs" mb="xs">复原指标</Text>
                <Grid>
                  <Grid.Col span={3}>
                    <Stack gap={0} align="center">
                      <Text size="lg" fw={700} c="#6366f1">
                        {selectedEntry.schemeMetrics.matchScore.toFixed(1)}
                      </Text>
                      <Text size="xs" c="dimmed">匹配度</Text>
                      <Progress
                        value={selectedEntry.schemeMetrics.matchScore}
                        color="indigo"
                        size="sm"
                        w="100%"
                      />
                    </Stack>
                  </Grid.Col>
                  <Grid.Col span={3}>
                    <Stack gap={0} align="center">
                      <Text size="lg" fw={700} c="#a855f7">
                        {selectedEntry.schemeMetrics.thicknessConsistencyScore?.toFixed(1) || '-'}
                      </Text>
                      <Text size="xs" c="dimmed">厚度一致性</Text>
                      <Progress
                        value={selectedEntry.schemeMetrics.thicknessConsistencyScore || 0}
                        color="grape"
                        size="sm"
                        w="100%"
                      />
                    </Stack>
                  </Grid.Col>
                  <Grid.Col span={3}>
                    <Stack gap={0} align="center">
                      <Text size="lg" fw={700} c="#f97316">
                        {selectedEntry.schemeMetrics.patternAlignmentScore?.toFixed(1) || '-'}
                      </Text>
                      <Text size="xs" c="dimmed">纹饰对齐度</Text>
                      <Progress
                        value={selectedEntry.schemeMetrics.patternAlignmentScore || 0}
                        color="orange"
                        size="sm"
                        w="100%"
                      />
                    </Stack>
                  </Grid.Col>
                  <Grid.Col span={3}>
                    <Stack gap={0} align="center">
                      <Text size="lg" fw={700} c="#10b981">
                        {selectedEntry.schemeMetrics.estimatedRimDiameter?.toFixed(1) || '-'}
                      </Text>
                      <Text size="xs" c="dimmed">口径 (cm)</Text>
                    </Stack>
                  </Grid.Col>
                </Grid>
              </Card>
            )}

            {selectedEntry.evidenceChain && (
              <Card withBorder padding="sm" radius="md">
                <Text fw={600} size="xs" mb="xs">证据链信息</Text>
                <Grid>
                  <Grid.Col span={4}>
                    <Stack gap={0} align="center">
                      <Text size="lg" fw={700} c="#6366f1">
                        {selectedEntry.evidenceChain.evidenceSources.length}
                      </Text>
                      <Text size="xs" c="dimmed">证据来源</Text>
                    </Stack>
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <Stack gap={0} align="center">
                      <Text size="lg" fw={700} c="#a855f7">
                        {selectedEntry.evidenceChain.chronologyJudgments.length}
                      </Text>
                      <Text size="xs" c="dimmed">年代判断</Text>
                    </Stack>
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <Stack gap={0} align="center">
                      <Text size="lg" fw={700} c="#f97316">
                        {selectedEntry.evidenceChain.expertOpinions.length}
                      </Text>
                      <Text size="xs" c="dimmed">专家意见</Text>
                    </Stack>
                  </Grid.Col>
                </Grid>

                {selectedEntry.evidenceChain.expertOpinions.length > 0 && (
                  <>
                    <Divider my="sm" />
                    <Text size="xs" fw={600} mb="xs">专家意见</Text>
                    <List size="xs" spacing="xs">
                      {selectedEntry.evidenceChain.expertOpinions.map((op) => (
                        <List.Item key={op.id}>
                          <Group gap="xs">
                            <Badge
                              size="xs"
                              color={
                                op.opinionType === 'support' ? 'green' :
                                op.opinionType === 'oppose' ? 'red' :
                                op.opinionType === 'suggestion' ? 'blue' : 'gray'
                              }
                              variant="dot"
                            >
                              {op.opinionType === 'support' ? '支持' :
                               op.opinionType === 'oppose' ? '反对' :
                               op.opinionType === 'suggestion' ? '建议' : '中立'}
                            </Badge>
                            <Text size="xs">
                              <b>{op.expertName}</b> ({op.expertTitle || '专家'}): {op.content}
                            </Text>
                          </Group>
                        </List.Item>
                      ))}
                    </List>
                  </>
                )}

                {selectedEntry.evidenceChain.referenceArtifacts.length > 0 && (
                  <>
                    <Divider my="sm" />
                    <Text size="xs" fw={600} mb="xs">参考器物</Text>
                    <List size="xs" spacing="xs">
                      {selectedEntry.evidenceChain.referenceArtifacts.map((ref) => (
                        <List.Item key={ref.id}>
                          <Group gap="xs">
                            <Badge
                              size="xs"
                              color={CONFIDENCE_COLORS[ref.confidenceLevel]}
                              variant="dot"
                            >
                              {CONFIDENCE_LABELS[ref.confidenceLevel]}
                            </Badge>
                            <Text size="xs">
                              <b>{ref.artifactName}</b> ({ref.artifactType})
                              {ref.museumOrCollection && ` - ${ref.museumOrCollection}`}
                              {' '}- 相似度 {ref.similarityScore}%
                            </Text>
                          </Group>
                        </List.Item>
                      ))}
                    </List>
                  </>
                )}
              </Card>
            )}

            <Group justify="flex-end">
              <Button
                size="xs"
                variant="light"
                leftSection={<IconExternalLink size={14} />}
                onClick={() => {
                  useAppStore.getState().incrementReferenceCount(selectedEntry.id);
                }}
              >
                引用此条目
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      <Modal
        opened={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        title="确认清空"
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">确定要清空所有知识库数据吗？此操作不可恢复。</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setClearConfirmOpen(false)}>取消</Button>
            <Button
              color="red"
              onClick={() => {
                clearKnowledgeBase();
                setClearConfirmOpen(false);
              }}
            >
              确认清空
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
