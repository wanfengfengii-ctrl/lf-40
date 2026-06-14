import { useAppStore } from '@/store';
import {
  Card,
  Button,
  Group,
  Text,
  Badge,
  Stack,
  ScrollArea,
  ActionIcon,
  Modal,
  TextInput,
  Textarea,
  NumberInput,
  Select,
  Accordion,
  Divider,
  SegmentedControl,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  IconPlus,
  IconTrash,
  IconEdit,
  IconUser,
  IconClock,
  IconMountain,
  IconBook,
  IconStar,
  IconAlertCircle,
  IconCheck,
} from '@tabler/icons-react';
import { useState } from 'react';
import type {
  ConfidenceLevel,
  EvidenceType,
  EvidenceSource,
  ChronologyJudgment,
  StratigraphyInfo,
  ReferenceArtifact,
  ExpertOpinion,
} from '@/types';

interface EvidenceAnnotationPanelProps {
  targetType?: 'sherd' | 'scheme';
  targetId?: string;
  forceTargetType?: 'sherd' | 'scheme';
  forceSherdId?: string;
  forceSchemeId?: string;
  title?: string;
}

const CONFIDENCE_OPTIONS: { value: ConfidenceLevel; label: string }[] = [
  { value: 'low', label: '低置信度' },
  { value: 'medium', label: '中置信度' },
  { value: 'high', label: '高置信度' },
  { value: 'very_high', label: '极高置信度' },
];

const EVIDENCE_TYPE_OPTIONS: { value: EvidenceType; label: string }[] = [
  { value: 'stratigraphy', label: '地层学' },
  { value: 'typology', label: '类型学' },
  { value: 'scientific', label: '科学检测' },
  { value: 'expert', label: '专家意见' },
  { value: 'document', label: '文献记载' },
  { value: 'other', label: '其他' },
];

const OPINION_TYPE_OPTIONS = [
  { value: 'support', label: '支持' },
  { value: 'oppose', label: '反对' },
  { value: 'neutral', label: '中立' },
  { value: 'suggestion', label: '建议' },
];

function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const map: Record<ConfidenceLevel, { color: string; label: string }> = {
    low: { color: 'red', label: '低' },
    medium: { color: 'yellow', label: '中' },
    high: { color: 'blue', label: '高' },
    very_high: { color: 'green', label: '极高' },
  };
  const cfg = map[level];
  return (
    <Badge size="xs" color={cfg.color} variant="light" leftSection={<IconStar size={8} />}>
      {cfg.label}置信
    </Badge>
  );
}

export function EvidenceAnnotationPanel({
  targetType: propTargetType,
  targetId: propTargetId,
  forceTargetType,
  forceSherdId,
  forceSchemeId,
  title,
}: EvidenceAnnotationPanelProps) {
  const sherds = useAppStore((s) => s.sherds);
  const schemes = useAppStore((s) => s.schemes);
  const activeSchemeId = useAppStore((s) => s.activeSchemeId);

  const [localTargetType, setLocalTargetType] = useState<'sherd' | 'scheme'>(
    forceTargetType || propTargetType || 'scheme'
  );
  const [localSherdId, setLocalSherdId] = useState<string | null>(
    forceSherdId || (propTargetType === 'sherd' ? propTargetId || null : null)
  );
  const [localSchemeId, setLocalSchemeId] = useState<string | null>(
    forceSchemeId || activeSchemeId || (propTargetType === 'scheme' ? propTargetId || null : null)
  );

  const effectiveTargetType = forceTargetType || localTargetType;
  const effectiveTargetId = forceTargetType === 'sherd'
    ? forceSherdId || localSherdId
    : forceTargetType === 'scheme'
    ? forceSchemeId || localSchemeId || activeSchemeId
    : localTargetType === 'sherd'
    ? localSherdId
    : localSchemeId || activeSchemeId;

  const evidence = effectiveTargetType === 'sherd' && effectiveTargetId
    ? useAppStore((s) => s.getSherdEvidence(effectiveTargetId))
    : effectiveTargetType === 'scheme' && effectiveTargetId
    ? useAppStore((s) => s.getSchemeEvidence(effectiveTargetId))
    : null;

  const targetType = effectiveTargetType;
  const targetId = effectiveTargetId || '';

  const addEvidenceSource = useAppStore((s) => s.addEvidenceSource);
  const updateEvidenceSource = useAppStore((s) => s.updateEvidenceSource);
  const removeEvidenceSource = useAppStore((s) => s.removeEvidenceSource);
  const addChronologyJudgment = useAppStore((s) => s.addChronologyJudgment);
  const updateChronologyJudgment = useAppStore((s) => s.updateChronologyJudgment);
  const removeChronologyJudgment = useAppStore((s) => s.removeChronologyJudgment);
  const addStratigraphyInfo = useAppStore((s) => s.addStratigraphyInfo);
  const updateStratigraphyInfo = useAppStore((s) => s.updateStratigraphyInfo);
  const removeStratigraphyInfo = useAppStore((s) => s.removeStratigraphyInfo);
  const addReferenceArtifact = useAppStore((s) => s.addReferenceArtifact);
  const updateReferenceArtifact = useAppStore((s) => s.updateReferenceArtifact);
  const removeReferenceArtifact = useAppStore((s) => s.removeReferenceArtifact);
  const addExpertOpinion = useAppStore((s) => s.addExpertOpinion);
  const updateExpertOpinion = useAppStore((s) => s.updateExpertOpinion);
  const removeExpertOpinion = useAppStore((s) => s.removeExpertOpinion);

  const [modalType, setModalType] = useState<
    | null
    | { type: 'evidence'; data?: EvidenceSource }
    | { type: 'chronology'; data?: ChronologyJudgment }
    | { type: 'stratigraphy'; data?: StratigraphyInfo }
    | { type: 'reference'; data?: ReferenceArtifact }
    | { type: 'opinion'; data?: ExpertOpinion }
  >(null);

  const unresolvedConflicts = evidence?.conflicts.filter((c) => !c.resolved).length || 0;
  const canSelectTarget = !forceTargetType && !forceSherdId && !forceSchemeId;

  if (!evidence) {
    return (
      <Card shadow="sm" padding="md" radius="md" withBorder h="100%">
        <Stack gap="sm" h="100%" justify="center" align="center">
          <IconAlertCircle size={32} color="#9ca3af" />
          <Text c="dimmed" size="sm">
            {targetType === 'sherd' ? '请选择或创建残片' : '请选择或创建复原方案'}
          </Text>
        </Stack>
      </Card>
    );
  }

  return (
    <Card shadow="sm" padding="md" radius="md" withBorder h="100%">
      <Stack gap="sm" h="100%">
        <Group justify="space-between">
          <Group gap="xs">
            <Text fw={600} size="lg">{title || '证据链标注'}</Text>
            {unresolvedConflicts > 0 && (
              <Badge size="xs" color="red" variant="light" leftSection={<IconAlertCircle size={10} />}>
                {unresolvedConflicts} 处冲突
              </Badge>
            )}
          </Group>
          {evidence.lastAnnotatedAt && (
            <Text size="xs" c="dimmed">
              最后标注: {evidence.lastAnnotatedBy || '未知'} · {new Date(evidence.lastAnnotatedAt).toLocaleDateString('zh-CN')}
            </Text>
          )}
        </Group>

        {canSelectTarget && (
          <>
            <Divider my={0} />
            <Stack gap="xs">
              <SegmentedControl
                size="xs"
                value={localTargetType}
                onChange={(v) => setLocalTargetType(v as 'sherd' | 'scheme')}
                data={[
                  { value: 'scheme', label: '方案级别' },
                  { value: 'sherd', label: '残片级别' },
                ]}
              />
              {localTargetType === 'scheme' ? (
                <Select
                  size="xs"
                  label="选择方案"
                  placeholder="选择要标注证据的方案"
                  value={localSchemeId}
                  onChange={(v) => setLocalSchemeId(v)}
                  data={schemes.map((s) => ({ value: s.id, label: `${s.name} (${s.sherdPlacements.length}残片)` }))}
                  nothingFoundMessage="暂无方案"
                  allowDeselect={false}
                />
              ) : (
                <Select
                  size="xs"
                  label="选择残片"
                  placeholder="选择要标注证据的残片"
                  value={localSherdId}
                  onChange={(v) => setLocalSherdId(v)}
                  data={sherds.map((s) => ({ value: s.id, label: s.sherdNumber }))}
                  nothingFoundMessage="暂无残片"
                  allowDeselect={false}
                />
              )}
            </Stack>
          </>
        )}

        <Divider my={0} />

        <ScrollArea h="100%">
          <Stack gap="sm" py="xs">
            <Accordion variant="separated" chevronPosition="right" radius="md" defaultValue="evidence">
              <Accordion.Item value="evidence">
                <Accordion.Control icon={<IconBook size={14} />}>
                  <Group justify="space-between" style={{ flex: 1 }}>
                    <Text size="sm" fw={500}>证据来源</Text>
                    <Group gap={4}>
                      <Badge size="xs" color="indigo" variant="light">{evidence.evidenceSources.length}</Badge>
                      <ActionIcon
                        size="xs"
                        variant="subtle"
                        onClick={(e) => {
                          e.stopPropagation();
                          setModalType({ type: 'evidence' });
                        }}
                      >
                        <IconPlus size={12} />
                      </ActionIcon>
                    </Group>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="xs">
                    {evidence.evidenceSources.length === 0 ? (
                      <Text size="xs" c="dimmed" ta="center" py="sm">
                        暂无证据来源，点击右上角 + 添加
                      </Text>
                    ) : (
                      evidence.evidenceSources.map((ev) => (
                        <Card key={ev.id} withBorder padding="xs" radius="sm">
                          <Group justify="space-between" mb={4}>
                            <Group gap="xs">
                              <Badge size="xs" color="grape" variant="light">
                                {EVIDENCE_TYPE_OPTIONS.find((o) => o.value === ev.type)?.label || ev.type}
                              </Badge>
                              <Text size="xs" fw={500}>{ev.title}</Text>
                            </Group>
                            <Group gap={2}>
                              <ActionIcon size="xs" variant="subtle" onClick={() => setModalType({ type: 'evidence', data: ev })}>
                                <IconEdit size={10} />
                              </ActionIcon>
                              <ActionIcon size="xs" variant="subtle" color="red" onClick={() => removeEvidenceSource(targetType, targetId, ev.id)}>
                                <IconTrash size={10} />
                              </ActionIcon>
                            </Group>
                          </Group>
                          {ev.description && <Text size="xs" c="dimmed" lineClamp={2}>{ev.description}</Text>}
                          {(ev.author || ev.publicationDate) && (
                            <Text size="xs" c="dimmed" mt={4}>
                              {ev.author && `作者：${ev.author}`}
                              {ev.publicationDate && ` · ${ev.publicationDate}`}
                            </Text>
                          )}
                        </Card>
                      ))
                    )}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>

              <Accordion.Item value="chronology">
                <Accordion.Control icon={<IconClock size={14} />}>
                  <Group justify="space-between" style={{ flex: 1 }}>
                    <Text size="sm" fw={500}>年代判断</Text>
                    <Group gap={4}>
                      <Badge size="xs" color="blue" variant="light">{evidence.chronologyJudgments.length}</Badge>
                      <ActionIcon
                        size="xs"
                        variant="subtle"
                        onClick={(e) => {
                          e.stopPropagation();
                          setModalType({ type: 'chronology' });
                        }}
                      >
                        <IconPlus size={12} />
                      </ActionIcon>
                    </Group>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="xs">
                    {evidence.chronologyJudgments.length === 0 ? (
                      <Text size="xs" c="dimmed" ta="center" py="sm">暂无年代判断</Text>
                    ) : (
                      evidence.chronologyJudgments.map((c) => (
                        <Card key={c.id} withBorder padding="xs" radius="sm">
                          <Group justify="space-between" mb={4}>
                            <Group gap="xs">
                              <Text size="xs" fw={600}>{c.period}</Text>
                              {c.dynasty && <Badge size="xs" color="cyan" variant="light">{c.dynasty}</Badge>}
                              <ConfidenceBadge level={c.confidenceLevel} />
                            </Group>
                            <Group gap={2}>
                              <ActionIcon size="xs" variant="subtle" onClick={() => setModalType({ type: 'chronology', data: c })}>
                                <IconEdit size={10} />
                              </ActionIcon>
                              <ActionIcon size="xs" variant="subtle" color="red" onClick={() => removeChronologyJudgment(targetType, targetId, c.id)}>
                                <IconTrash size={10} />
                              </ActionIcon>
                            </Group>
                          </Group>
                          <Text size="xs" c="dimmed">{c.basis}</Text>
                          {(c.estimatedYearStart !== undefined || c.estimatedYearEnd !== undefined) && (
                            <Text size="xs" c="dimmed" mt={2}>
                              约 {c.estimatedYearStart || '?'} - {c.estimatedYearEnd || '?'} 年
                            </Text>
                          )}
                          <Text size="xs" c="dimmed" mt={2}>
                            <IconUser size={8} style={{ display: 'inline', verticalAlign: 'middle' }} /> {c.createdBy}
                          </Text>
                        </Card>
                      ))
                    )}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>

              <Accordion.Item value="stratigraphy">
                <Accordion.Control icon={<IconMountain size={14} />}>
                  <Group justify="space-between" style={{ flex: 1 }}>
                    <Text size="sm" fw={500}>地层信息</Text>
                    <Group gap={4}>
                      <Badge size="xs" color="orange" variant="light">{evidence.stratigraphyInfos.length}</Badge>
                      <ActionIcon
                        size="xs"
                        variant="subtle"
                        onClick={(e) => {
                          e.stopPropagation();
                          setModalType({ type: 'stratigraphy' });
                        }}
                      >
                        <IconPlus size={12} />
                      </ActionIcon>
                    </Group>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="xs">
                    {evidence.stratigraphyInfos.length === 0 ? (
                      <Text size="xs" c="dimmed" ta="center" py="sm">暂无地层信息</Text>
                    ) : (
                      evidence.stratigraphyInfos.map((s) => (
                        <Card key={s.id} withBorder padding="xs" radius="sm">
                          <Group justify="space-between" mb={4}>
                            <Group gap="xs">
                              <Badge size="xs" color="orange" variant="light">T{`第 ${s.layerNumber} 层`}</Badge>
                              <ConfidenceBadge level={s.confidenceLevel} />
                            </Group>
                            <Group gap={2}>
                              <ActionIcon size="xs" variant="subtle" onClick={() => setModalType({ type: 'stratigraphy', data: s })}>
                                <IconEdit size={10} />
                              </ActionIcon>
                              <ActionIcon size="xs" variant="subtle" color="red" onClick={() => removeStratigraphyInfo(targetType, targetId, s.id)}>
                                <IconTrash size={10} />
                              </ActionIcon>
                            </Group>
                          </Group>
                          {s.layerDescription && <Text size="xs" c="dimmed">{s.layerDescription}</Text>}
                          {(s.depthFrom !== undefined || s.depthTo !== undefined) && (
                            <Text size="xs" c="dimmed" mt={2}>
                              深度：{s.depthFrom || 0} - {s.depthTo || 0} m
                            </Text>
                          )}
                          {s.associatedFeatures && (
                            <Text size="xs" c="dimmed" mt={2}>
                              遗迹现象：{s.associatedFeatures}
                            </Text>
                          )}
                          <Text size="xs" c="dimmed" mt={2}>
                            <IconUser size={8} style={{ display: 'inline', verticalAlign: 'middle' }} /> {s.createdBy}
                          </Text>
                        </Card>
                      ))
                    )}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>

              <Accordion.Item value="reference">
                <Accordion.Control icon={<IconMountain size={14} />}>
                  <Group justify="space-between" style={{ flex: 1 }}>
                    <Text size="sm" fw={500}>参考器物</Text>
                    <Group gap={4}>
                      <Badge size="xs" color="teal" variant="light">{evidence.referenceArtifacts.length}</Badge>
                      <ActionIcon
                        size="xs"
                        variant="subtle"
                        onClick={(e) => {
                          e.stopPropagation();
                          setModalType({ type: 'reference' });
                        }}
                      >
                        <IconPlus size={12} />
                      </ActionIcon>
                    </Group>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="xs">
                    {evidence.referenceArtifacts.length === 0 ? (
                      <Text size="xs" c="dimmed" ta="center" py="sm">暂无参考器物</Text>
                    ) : (
                      evidence.referenceArtifacts.map((r) => (
                        <Card key={r.id} withBorder padding="xs" radius="sm">
                          <Group justify="space-between" mb={4}>
                            <Group gap="xs">
                              <Text size="xs" fw={600}>{r.artifactName}</Text>
                              <Badge size="xs" color="teal" variant="light">{r.artifactType}</Badge>
                              <Badge size="xs" color={r.similarityScore >= 70 ? 'green' : r.similarityScore >= 40 ? 'yellow' : 'red'} variant="light">
                                相似 {r.similarityScore}%
                              </Badge>
                              <ConfidenceBadge level={r.confidenceLevel} />
                            </Group>
                            <Group gap={2}>
                              <ActionIcon size="xs" variant="subtle" onClick={() => setModalType({ type: 'reference', data: r })}>
                                <IconEdit size={10} />
                              </ActionIcon>
                              <ActionIcon size="xs" variant="subtle" color="red" onClick={() => removeReferenceArtifact(targetType, targetId, r.id)}>
                                <IconTrash size={10} />
                              </ActionIcon>
                            </Group>
                          </Group>
                          <Text size="xs" c="dimmed">{r.similarityDescription}</Text>
                          {(r.museumOrCollection || r.catalogNumber) && (
                            <Text size="xs" c="dimmed" mt={2}>
                              {r.museumOrCollection || '未知馆藏'}
                              {r.catalogNumber && ` · ${r.catalogNumber}`}
                            </Text>
                          )}
                          <Text size="xs" c="dimmed" mt={2}>
                            <IconUser size={8} style={{ display: 'inline', verticalAlign: 'middle' }} /> {r.createdBy}
                          </Text>
                        </Card>
                      ))
                    )}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>

              <Accordion.Item value="opinion">
                <Accordion.Control icon={<IconUser size={14} />}>
                  <Group justify="space-between" style={{ flex: 1 }}>
                    <Text size="sm" fw={500}>专家意见</Text>
                    <Group gap={4}>
                      <Badge size="xs" color="violet" variant="light">{evidence.expertOpinions.length}</Badge>
                      <ActionIcon
                        size="xs"
                        variant="subtle"
                        onClick={(e) => {
                          e.stopPropagation();
                          setModalType({ type: 'opinion' });
                        }}
                      >
                        <IconPlus size={12} />
                      </ActionIcon>
                    </Group>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="xs">
                    {evidence.expertOpinions.length === 0 ? (
                      <Text size="xs" c="dimmed" ta="center" py="sm">暂无专家意见</Text>
                    ) : (
                      evidence.expertOpinions.map((o) => {
                        const opinionColorMap: Record<string, string> = {
                          support: 'green',
                          oppose: 'red',
                          neutral: 'gray',
                          suggestion: 'blue',
                        };
                        const opinionLabelMap: Record<string, string> = {
                          support: '支持',
                          oppose: '反对',
                          neutral: '中立',
                          suggestion: '建议',
                        };
                        return (
                          <Card key={o.id} withBorder padding="xs" radius="sm">
                            <Group justify="space-between" mb={4}>
                              <Group gap="xs">
                                <Text size="xs" fw={600}>{o.expertName}</Text>
                                {o.expertTitle && <Text size="xs" c="dimmed">{o.expertTitle}</Text>}
                                <Badge size="xs" color={opinionColorMap[o.opinionType]} variant="light">
                                  {opinionLabelMap[o.opinionType]}
                                </Badge>
                                <ConfidenceBadge level={o.confidenceLevel} />
                              </Group>
                              <Group gap={2}>
                                <ActionIcon size="xs" variant="subtle" onClick={() => setModalType({ type: 'opinion', data: o })}>
                                  <IconEdit size={10} />
                                </ActionIcon>
                                <ActionIcon size="xs" variant="subtle" color="red" onClick={() => removeExpertOpinion(targetType, targetId, o.id)}>
                                  <IconTrash size={10} />
                                </ActionIcon>
                              </Group>
                            </Group>
                            {o.institution && <Text size="xs" c="dimmed">{o.institution}</Text>}
                            <Text size="xs" mt={4}>{o.content}</Text>
                          </Card>
                        );
                      })
                    )}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          </Stack>
        </ScrollArea>
      </Stack>

      {modalType?.type === 'evidence' && (
        <EvidenceModal
          targetType={targetType}
          targetId={targetId}
          initial={modalType.data}
          onClose={() => setModalType(null)}
          onSave={(values) => {
            if (modalType.data) {
              updateEvidenceSource(targetType, targetId, modalType.data.id, values);
            } else {
              addEvidenceSource(targetType, targetId, values);
            }
            setModalType(null);
          }}
        />
      )}

      {modalType?.type === 'chronology' && (
        <ChronologyModal
          targetType={targetType}
          targetId={targetId}
          initial={modalType.data}
          onClose={() => setModalType(null)}
          onSave={(values) => {
            if (modalType.data) {
              updateChronologyJudgment(targetType, targetId, modalType.data.id, values);
            } else {
              addChronologyJudgment(targetType, targetId, values);
            }
            setModalType(null);
          }}
        />
      )}

      {modalType?.type === 'stratigraphy' && (
        <StratigraphyModal
          targetType={targetType}
          targetId={targetId}
          initial={modalType.data}
          onClose={() => setModalType(null)}
          onSave={(values) => {
            if (modalType.data) {
              updateStratigraphyInfo(targetType, targetId, modalType.data.id, values);
            } else {
              addStratigraphyInfo(targetType, targetId, values);
            }
            setModalType(null);
          }}
        />
      )}

      {modalType?.type === 'reference' && (
        <ReferenceModal
          targetType={targetType}
          targetId={targetId}
          initial={modalType.data}
          onClose={() => setModalType(null)}
          onSave={(values) => {
            if (modalType.data) {
              updateReferenceArtifact(targetType, targetId, modalType.data.id, values);
            } else {
              addReferenceArtifact(targetType, targetId, values);
            }
            setModalType(null);
          }}
        />
      )}

      {modalType?.type === 'opinion' && (
        <OpinionModal
          targetType={targetType}
          targetId={targetId}
          initial={modalType.data}
          onClose={() => setModalType(null)}
          onSave={(values) => {
            if (modalType.data) {
              updateExpertOpinion(targetType, targetId, modalType.data.id, values);
            } else {
              addExpertOpinion(targetType, targetId, values);
            }
            setModalType(null);
          }}
        />
      )}
    </Card>
  );
}

function EvidenceModal({
  initial,
  onClose,
  onSave,
}: {
  targetType: 'sherd' | 'scheme';
  targetId: string;
  initial?: EvidenceSource;
  onClose: () => void;
  onSave: (values: Omit<EvidenceSource, 'id'>) => void;
}) {
  const form = useForm({
    mode: 'controlled',
    initialValues: {
      type: (initial?.type || 'other') as EvidenceType,
      title: initial?.title || '',
      description: initial?.description || '',
      url: initial?.url || '',
      author: initial?.author || '',
      publicationDate: initial?.publicationDate || '',
      pageReference: initial?.pageReference || '',
    },
    validate: {
      title: (v) => (!v.trim() ? '标题不能为空' : null),
    },
  });

  return (
    <Modal opened onClose={onClose} title={initial ? '编辑证据来源' : '添加证据来源'} size="md">
      <form
        onSubmit={form.onSubmit((values) => {
          onSave(values);
        })}
      >
        <Stack gap="md">
          <Select
            label="证据类型"
            data={EVIDENCE_TYPE_OPTIONS}
            key={form.key('type')}
            {...form.getInputProps('type')}
          />
          <TextInput
            label="标题"
            placeholder="如：《二里头陶器研究》"
            key={form.key('title')}
            {...form.getInputProps('title')}
          />
          <Textarea
            label="描述"
            placeholder="简要描述该证据..."
            minRows={2}
            key={form.key('description')}
            {...form.getInputProps('description')}
          />
          <Group grow>
            <TextInput
              label="作者"
              placeholder="如：张三"
              key={form.key('author')}
              {...form.getInputProps('author')}
            />
            <TextInput
              label="发表日期"
              placeholder="如：2023-06"
              key={form.key('publicationDate')}
              {...form.getInputProps('publicationDate')}
            />
          </Group>
          <Group grow>
            <TextInput
              label="URL 链接"
              placeholder="https://..."
              key={form.key('url')}
              {...form.getInputProps('url')}
            />
            <TextInput
              label="页码/引用"
              placeholder="如：p.45, 图3"
              key={form.key('pageReference')}
              {...form.getInputProps('pageReference')}
            />
          </Group>
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>取消</Button>
            <Button type="submit" leftSection={<IconCheck size={14} />}>
              {initial ? '保存修改' : '添加证据'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

function ChronologyModal({
  initial,
  onClose,
  onSave,
}: {
  targetType: 'sherd' | 'scheme';
  targetId: string;
  initial?: ChronologyJudgment;
  onClose: () => void;
  onSave: (values: Omit<ChronologyJudgment, 'id' | 'createdAt' | 'createdBy'>) => void;
}) {
  const form = useForm({
    mode: 'controlled',
    initialValues: {
      period: initial?.period || '',
      dynasty: initial?.dynasty || '',
      estimatedYearStart: initial?.estimatedYearStart ?? undefined,
      estimatedYearEnd: initial?.estimatedYearEnd ?? undefined,
      confidenceLevel: (initial?.confidenceLevel || 'medium') as ConfidenceLevel,
      basis: initial?.basis || '',
      evidenceSourceIds: initial?.evidenceSourceIds || [],
    },
    validate: {
      period: (v) => (!v.trim() ? '年代时期不能为空' : null),
      basis: (v) => (!v.trim() ? '判断依据不能为空' : null),
    },
  });

  return (
    <Modal opened onClose={onClose} title={initial ? '编辑年代判断' : '添加年代判断'} size="md">
      <form
        onSubmit={form.onSubmit((values) => {
          onSave(values);
        })}
      >
        <Stack gap="md">
          <Group grow>
            <TextInput
              label="考古学时期"
              placeholder="如：二里头文化四期"
              key={form.key('period')}
              {...form.getInputProps('period')}
            />
            <TextInput
              label="王朝（可选）"
              placeholder="如：夏代晚期"
              key={form.key('dynasty')}
              {...form.getInputProps('dynasty')}
            />
          </Group>
          <Group grow>
            <NumberInput
              label="起始年份（距今/公元前，负数为公元前）"
              placeholder="如：-1600"
              allowNegative
              key={form.key('estimatedYearStart')}
              {...form.getInputProps('estimatedYearStart')}
            />
            <NumberInput
              label="结束年份"
              placeholder="如：-1500"
              allowNegative
              key={form.key('estimatedYearEnd')}
              {...form.getInputProps('estimatedYearEnd')}
            />
          </Group>
          <Text size="sm" fw={500} mt="xs">置信等级</Text>
          <SegmentedControl
            value={form.values.confidenceLevel}
            onChange={(v) => form.setFieldValue('confidenceLevel', v as ConfidenceLevel)}
            data={CONFIDENCE_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
            size="sm"
            fullWidth
          />
          <Textarea
            label="判断依据"
            placeholder="说明年代判断的依据和理由..."
            minRows={3}
            key={form.key('basis')}
            {...form.getInputProps('basis')}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>取消</Button>
            <Button type="submit" leftSection={<IconCheck size={14} />}>
              {initial ? '保存修改' : '添加判断'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

function StratigraphyModal({
  initial,
  onClose,
  onSave,
}: {
  targetType: 'sherd' | 'scheme';
  targetId: string;
  initial?: StratigraphyInfo;
  onClose: () => void;
  onSave: (values: Omit<StratigraphyInfo, 'id' | 'createdAt' | 'createdBy'>) => void;
}) {
  const form = useForm({
    mode: 'controlled',
    initialValues: {
      layerNumber: initial?.layerNumber || '',
      layerDescription: initial?.layerDescription || '',
      depthFrom: initial?.depthFrom ?? undefined,
      depthTo: initial?.depthTo ?? undefined,
      associatedFeatures: initial?.associatedFeatures || '',
      confidenceLevel: (initial?.confidenceLevel || 'medium') as ConfidenceLevel,
      evidenceSourceIds: initial?.evidenceSourceIds || [],
    },
    validate: {
      layerNumber: (v) => (!v.trim() ? '层位号不能为空' : null),
    },
  });

  return (
    <Modal opened onClose={onClose} title={initial ? '编辑地层信息' : '添加地层信息'} size="md">
      <form
        onSubmit={form.onSubmit((values) => {
          onSave(values);
        })}
      >
        <Stack gap="md">
          <Group grow>
            <TextInput
              label="层位号"
              placeholder="如：3、H5、M2"
              key={form.key('layerNumber')}
              {...form.getInputProps('layerNumber')}
            />
          </Group>
          <Group grow>
            <NumberInput
              label="起始深度 (m)"
              placeholder="如：0.8"
              min={0}
              decimalScale={2}
              step={0.05}
              key={form.key('depthFrom')}
              {...form.getInputProps('depthFrom')}
            />
            <NumberInput
              label="结束深度 (m)"
              placeholder="如：1.2"
              min={0}
              decimalScale={2}
              step={0.05}
              key={form.key('depthTo')}
              {...form.getInputProps('depthTo')}
            />
          </Group>
          <Text size="sm" fw={500} mt="xs">置信等级</Text>
          <SegmentedControl
            value={form.values.confidenceLevel}
            onChange={(v) => form.setFieldValue('confidenceLevel', v as ConfidenceLevel)}
            data={CONFIDENCE_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
            size="sm"
            fullWidth
          />
          <Textarea
            label="地层描述"
            placeholder="描述土质土色、包含物等..."
            minRows={2}
            key={form.key('layerDescription')}
            {...form.getInputProps('layerDescription')}
          />
          <TextInput
            label="遗迹现象（可选）"
            placeholder="如：灰坑、墓葬、房址..."
            key={form.key('associatedFeatures')}
            {...form.getInputProps('associatedFeatures')}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>取消</Button>
            <Button type="submit" leftSection={<IconCheck size={14} />}>
              {initial ? '保存修改' : '添加地层'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

function ReferenceModal({
  initial,
  onClose,
  onSave,
}: {
  targetType: 'sherd' | 'scheme';
  targetId: string;
  initial?: ReferenceArtifact;
  onClose: () => void;
  onSave: (values: Omit<ReferenceArtifact, 'id' | 'createdAt' | 'createdBy'>) => void;
}) {
  const form = useForm({
    mode: 'controlled',
    initialValues: {
      artifactName: initial?.artifactName || '',
      artifactType: initial?.artifactType || '',
      museumOrCollection: initial?.museumOrCollection || '',
      catalogNumber: initial?.catalogNumber || '',
      similarityDescription: initial?.similarityDescription || '',
      similarityScore: initial?.similarityScore || 60,
      imageUrl: initial?.imageUrl || '',
      confidenceLevel: (initial?.confidenceLevel || 'medium') as ConfidenceLevel,
      evidenceSourceIds: initial?.evidenceSourceIds || [],
    },
    validate: {
      artifactName: (v) => (!v.trim() ? '器物名称不能为空' : null),
      artifactType: (v) => (!v.trim() ? '器物类型不能为空' : null),
      similarityDescription: (v) => (!v.trim() ? '相似性描述不能为空' : null),
    },
  });

  return (
    <Modal opened onClose={onClose} title={initial ? '编辑参考器物' : '添加参考器物'} size="md">
      <form
        onSubmit={form.onSubmit((values) => {
          onSave(values);
        })}
      >
        <Stack gap="md">
          <Group grow>
            <TextInput
              label="器物名称"
              placeholder="如：陶鬲"
              key={form.key('artifactName')}
              {...form.getInputProps('artifactName')}
            />
            <TextInput
              label="器物类型"
              placeholder="如：炊器、盛器、礼器"
              key={form.key('artifactType')}
              {...form.getInputProps('artifactType')}
            />
          </Group>
          <Group grow>
            <TextInput
              label="馆藏机构"
              placeholder="如：中国社会科学院考古研究所"
              key={form.key('museumOrCollection')}
              {...form.getInputProps('museumOrCollection')}
            />
            <TextInput
              label="馆藏编号"
              placeholder="如：2023HLT3M2:1"
              key={form.key('catalogNumber')}
              {...form.getInputProps('catalogNumber')}
            />
          </Group>
          <NumberInput
            label="相似性评分 (%)"
            min={0}
            max={100}
            step={5}
            key={form.key('similarityScore')}
            {...form.getInputProps('similarityScore')}
          />
          <Text size="sm" fw={500} mt="xs">置信等级</Text>
          <SegmentedControl
            value={form.values.confidenceLevel}
            onChange={(v) => form.setFieldValue('confidenceLevel', v as ConfidenceLevel)}
            data={CONFIDENCE_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
            size="sm"
            fullWidth
          />
          <Textarea
            label="相似性描述"
            placeholder="描述该器物与当前残片/方案的相似之处..."
            minRows={3}
            key={form.key('similarityDescription')}
            {...form.getInputProps('similarityDescription')}
          />
          <TextInput
            label="参考图片 URL（可选）"
            placeholder="https://..."
            key={form.key('imageUrl')}
            {...form.getInputProps('imageUrl')}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>取消</Button>
            <Button type="submit" leftSection={<IconCheck size={14} />}>
              {initial ? '保存修改' : '添加器物'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

function OpinionModal({
  initial,
  onClose,
  onSave,
}: {
  targetType: 'sherd' | 'scheme';
  targetId: string;
  initial?: ExpertOpinion;
  onClose: () => void;
  onSave: (values: Omit<ExpertOpinion, 'id' | 'createdAt'>) => void;
}) {
  const form = useForm({
    mode: 'controlled',
    initialValues: {
      expertName: initial?.expertName || '',
      expertTitle: initial?.expertTitle || '',
      institution: initial?.institution || '',
      opinionType: (initial?.opinionType || 'neutral') as 'support' | 'oppose' | 'neutral' | 'suggestion',
      content: initial?.content || '',
      confidenceLevel: (initial?.confidenceLevel || 'medium') as ConfidenceLevel,
      evidenceSourceIds: initial?.evidenceSourceIds || [],
    },
    validate: {
      expertName: (v) => (!v.trim() ? '专家姓名不能为空' : null),
      content: (v) => (!v.trim() ? '意见内容不能为空' : null),
    },
  });

  return (
    <Modal opened onClose={onClose} title={initial ? '编辑专家意见' : '添加专家意见'} size="md">
      <form
        onSubmit={form.onSubmit((values) => {
          onSave(values);
        })}
      >
        <Stack gap="md">
          <Group grow>
            <TextInput
              label="专家姓名"
              placeholder="专家姓名"
              key={form.key('expertName')}
              {...form.getInputProps('expertName')}
            />
            <TextInput
              label="职称/头衔"
              placeholder="如：研究员、教授"
              key={form.key('expertTitle')}
              {...form.getInputProps('expertTitle')}
            />
          </Group>
          <TextInput
            label="所属机构"
            placeholder="如：北京大学考古文博学院"
            key={form.key('institution')}
            {...form.getInputProps('institution')}
          />
          <Text size="sm" fw={500} mt="xs">意见类型</Text>
          <SegmentedControl
            value={form.values.opinionType}
            onChange={(v) => form.setFieldValue('opinionType', v as 'support' | 'oppose' | 'neutral' | 'suggestion')}
            data={OPINION_TYPE_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
            size="sm"
            fullWidth
          />
          <Text size="sm" fw={500} mt="xs">置信等级</Text>
          <SegmentedControl
            value={form.values.confidenceLevel}
            onChange={(v) => form.setFieldValue('confidenceLevel', v as ConfidenceLevel)}
            data={CONFIDENCE_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
            size="sm"
            fullWidth
          />
          <Textarea
            label="意见内容"
            placeholder="请详细描述专家意见..."
            minRows={4}
            key={form.key('content')}
            {...form.getInputProps('content')}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>取消</Button>
            <Button type="submit" leftSection={<IconCheck size={14} />}>
              {initial ? '保存修改' : '添加意见'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
