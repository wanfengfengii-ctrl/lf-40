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
  Tooltip,
  Modal,
  TextInput,
  Textarea,
  Alert,
  MultiSelect,
  Switch,
  NumberInput,
  List,
  Divider,
  Accordion,
  Slider,
  SegmentedControl,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  IconPlus,
  IconTrash,
  IconCheck,
  IconAlertTriangle,
  IconRotate,
  IconZoomIn,
  IconHistory,
  IconRestore,
  IconDeviceFloppy,
  IconArrowNarrowDown,
  IconArrowNarrowUp,
  IconChevronLeft,
  IconChevronRight,
  IconBolt,
  IconTarget,
  IconStack,
  IconFlower,
} from '@tabler/icons-react';
import { useState, useMemo } from 'react';
import type { SchemeVersion } from '@/types';

type YStepMode = 'fine' | 'medium' | 'coarse';

const Y_STEP_MAP: Record<YStepMode, number> = {
  fine: 0.01,
  medium: 0.1,
  coarse: 1,
};

export function SchemeManager() {
  const schemes = useAppStore((s) => s.schemes);
  const sherds = useAppStore((s) => s.sherds);
  const activeSchemeId = useAppStore((s) => s.activeSchemeId);
  const setActiveScheme = useAppStore((s) => s.setActiveScheme);
  const addScheme = useAppStore((s) => s.addScheme);
  const removeScheme = useAppStore((s) => s.removeScheme);
  const addSherdToScheme = useAppStore((s) => s.addSherdToScheme);
  const removeSherdFromScheme = useAppStore((s) => s.removeSherdFromScheme);
  const toggleSchemeTrusted = useAppStore((s) => s.toggleSchemeTrusted);
  const updateSherdPlacement = useAppStore((s) => s.updateSherdPlacement);
  const updateScheme = useAppStore((s) => s.updateScheme);
  const saveSchemeVersion = useAppStore((s) => s.saveSchemeVersion);
  const restoreSchemeVersion = useAppStore((s) => s.restoreSchemeVersion);
  const deleteSchemeVersion = useAppStore((s) => s.deleteSchemeVersion);
  const getSchemeFailureReasons = useAppStore((s) => s.getSchemeFailureReasons);
  const getSchemeMetrics = useAppStore((s) => s.getSchemeMetrics);
  const getSchemeContributions = useAppStore((s) => s.getSchemeContributions);

  const [modalOpen, setModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [editingSchemeId, setEditingSchemeId] = useState<string | null>(null);
  const [trustedError, setTrustedError] = useState<string | null>(null);
  const [failureReasons, setFailureReasons] = useState<string[]>([]);
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [versionNote, setVersionNote] = useState('');
  const [versionSaveMsg, setVersionSaveMsg] = useState<string | null>(null);
  const [yStepMode, setYStepMode] = useState<YStepMode>('fine');

  const activeScheme = useMemo(
    () => schemes.find((s) => s.id === activeSchemeId) || null,
    [schemes, activeSchemeId]
  );

  const activeMetrics = useMemo(
    () => (activeSchemeId ? getSchemeMetrics(activeSchemeId) : null),
    [activeSchemeId, getSchemeMetrics, schemes, sherds]
  );

  const activeContributions = useMemo(
    () => (activeSchemeId ? getSchemeContributions(activeSchemeId) : null),
    [activeSchemeId, getSchemeContributions, schemes, sherds]
  );

  const currentFailureReasons = useMemo(
    () => (activeSchemeId ? getSchemeFailureReasons(activeSchemeId) : []),
    [activeSchemeId, getSchemeFailureReasons]
  );

  const form = useForm({
    mode: 'controlled',
    initialValues: {
      name: '',
      description: '',
      sherdIds: [] as string[],
    },
    validate: {
      name: (value) => (!value.trim() ? '方案名称不能为空' : null),
    },
  });

  const openCreateModal = () => {
    setEditingSchemeId(null);
    form.reset();
    setErrorMsg(null);
    setModalOpen(true);
  };

  const openEditModal = (schemeId: string) => {
    const scheme = schemes.find((s) => s.id === schemeId);
    if (!scheme) return;
    setEditingSchemeId(schemeId);
    form.setValues({
      name: scheme.name,
      description: scheme.description || '',
      sherdIds: scheme.sherdPlacements.map((p) => p.sherdId),
    });
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleSubmit = form.onSubmit((values) => {
    setErrorMsg(null);
    if (editingSchemeId) {
      updateScheme(editingSchemeId, {
        name: values.name,
        description: values.description,
      });
      const currentScheme = schemes.find((s) => s.id === editingSchemeId);
      const currentIds = currentScheme?.sherdPlacements.map((p) => p.sherdId) || [];
      const toAdd = values.sherdIds.filter((id) => !currentIds.includes(id));
      const toRemove = currentIds.filter((id) => !values.sherdIds.includes(id));
      toAdd.forEach((id) => addSherdToScheme(editingSchemeId, id));
      toRemove.forEach((id) => removeSherdFromScheme(editingSchemeId, id));
    } else {
      const result = addScheme(values.name, values.description);
      if (!result.success) {
        setErrorMsg(result.error || '创建失败');
        return;
      }
      values.sherdIds.forEach((id) => addSherdToScheme(result.id!, id));
    }
    setModalOpen(false);
  });

  const fineTuneOffset = (sherdId: string, axis: 'X' | 'Y', delta: number) => {
    if (!activeScheme) return;
    const placement = activeScheme.sherdPlacements.find((p) => p.sherdId === sherdId);
    if (!placement) return;
    const currentOffset = axis === 'X' ? placement.offsetX : placement.offsetY;
    updateSherdPlacement(activeScheme.id, sherdId, {
      [axis === 'X' ? 'offsetX' : 'offsetY']: currentOffset + delta,
    } as Partial<typeof placement>);
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const yStep = Y_STEP_MAP[yStepMode];

  return (
    <Card shadow="sm" padding="md" radius="md" withBorder h="100%">
      <Stack gap="md" h="100%">
        <Group justify="space-between">
          <Text fw={600} size="lg">复原方案</Text>
          <Button
            size="sm"
            leftSection={<IconPlus size={16} />}
            onClick={openCreateModal}
          >
            新建方案
          </Button>
        </Group>

        <ScrollArea h={150}>
          {schemes.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">
              暂无方案，请创建复原方案
            </Text>
          ) : (
            <Stack gap="sm">
              {schemes.map((scheme) => (
                <Card
                  key={scheme.id}
                  withBorder
                  padding="sm"
                  radius="md"
                  style={{
                    cursor: 'pointer',
                    borderColor:
                      activeSchemeId === scheme.id
                        ? 'var(--mantine-color-indigo-5)'
                        : undefined,
                    backgroundColor:
                      activeSchemeId === scheme.id
                        ? 'var(--mantine-color-indigo-0)'
                        : undefined,
                  }}
                  onClick={() => setActiveScheme(scheme.id)}
                >
                  <Group justify="space-between">
                    <div>
                      <Group gap="xs" mb={4}>
                        <Text fw={600} size="sm">{scheme.name}</Text>
                        {scheme.isTrusted && (
                          <Badge size="xs" color="green" variant="light">
                            <IconCheck size={10} style={{ marginRight: 2 }} />
                            可信
                          </Badge>
                        )}
                        <Badge size="xs" color="gray" variant="light">
                          {scheme.sherdPlacements.length} 个残片
                        </Badge>
                        {(scheme.versions?.length || 0) > 0 && (
                          <Badge size="xs" color="indigo" variant="light">
                            <IconHistory size={10} style={{ marginRight: 2 }} />
                            {scheme.versions?.length || 0} 个版本
                          </Badge>
                        )}
                      </Group>
                      {scheme.description && (
                        <Text size="xs" c="dimmed" lineClamp={1}>
                          {scheme.description}
                        </Text>
                      )}
                    </div>
                    <Group gap={4} onClick={(e) => e.stopPropagation()}>
                      <Tooltip label="编辑方案">
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          onClick={() => openEditModal(scheme.id)}
                        >
                          <IconPlus size={14} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="删除方案">
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="red"
                          onClick={() => removeScheme(scheme.id)}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Group>
                </Card>
              ))}
            </Stack>
          )}
        </ScrollArea>

        {activeScheme && (
          <>
            <Group justify="space-between">
              <Text fw={500} size="sm">方案设置</Text>
              <Group gap={4}>
                <Tooltip label="保存版本">
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    onClick={() => {
                      setVersionNote('');
                      setVersionSaveMsg(null);
                      setVersionModalOpen(true);
                    }}
                  >
                    <IconDeviceFloppy size={14} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip
                  label={
                    activeScheme.sherdPlacements.length === 0
                      ? '添加残片后可标记'
                      : '存在轮廓断裂时无法标记为可信'
                  }
                >
                  <Switch
                    size="sm"
                    label="可信复原"
                    checked={activeScheme.isTrusted}
                    onChange={() => {
                      setTrustedError(null);
                      const result = toggleSchemeTrusted(activeScheme.id);
                      if (!result.success) {
                        setTrustedError(result.error || '操作失败');
                        setFailureReasons(result.reasons || []);
                      } else {
                        setFailureReasons([]);
                      }
                    }}
                    disabled={activeScheme.sherdPlacements.length === 0}
                  />
                </Tooltip>
              </Group>
            </Group>

            {trustedError && (
              <Alert
                icon={<IconAlertTriangle size={14} />}
                color="yellow"
                onClose={() => setTrustedError(null)}
                withCloseButton
              >
                <Stack gap={4}>
                  <Text size="xs" fw={500}>{trustedError}</Text>
                  {failureReasons.length > 0 && (
                    <List size="xs" spacing={2}>
                      {failureReasons.map((r, i) => (
                        <List.Item key={i}>{r}</List.Item>
                      ))}
                    </List>
                  )}
                </Stack>
              </Alert>
            )}

            {(activeScheme.versions?.length || 0) > 0 && (
              <Accordion variant="separated" chevronPosition="right" radius="md">
                <Accordion.Item value="versions">
                  <Accordion.Control icon={<IconHistory size={14} />}>
                    <Text size="sm" fw={500}>
                      历史版本 ({activeScheme.versions?.length || 0})
                    </Text>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="xs">
                      {([...(activeScheme.versions || [])] as SchemeVersion[])
                        .sort((a, b) => b.createdAt - a.createdAt)
                        .map((v) => (
                          <Card key={v.id} withBorder padding="xs" radius="sm">
                            <Group justify="space-between">
                              <div>
                                <Group gap="xs" mb={2}>
                                  <Text size="xs" fw={600}>v{v.versionNumber}</Text>
                                  {v.isTrusted && (
                                    <Badge size="xs" color="green" variant="light">可信</Badge>
                                  )}
                                  <Text size="xs" c="dimmed">{formatDate(v.createdAt)}</Text>
                                </Group>
                                {v.note && (
                                  <Text size="xs" c="dimmed">{v.note}</Text>
                                )}
                              </div>
                              <Group gap={2}>
                                <Tooltip label="恢复此版本">
                                  <ActionIcon
                                    size="xs"
                                    variant="subtle"
                                    onClick={() => {
                                      const r = restoreSchemeVersion(activeScheme.id, v.id);
                                      if (!r.success) {
                                        setTrustedError(r.error || '恢复失败');
                                      }
                                    }}
                                  >
                                    <IconRestore size={12} />
                                  </ActionIcon>
                                </Tooltip>
                                <Tooltip label="删除版本">
                                  <ActionIcon
                                    size="xs"
                                    variant="subtle"
                                    color="red"
                                    onClick={() => deleteSchemeVersion(activeScheme.id, v.id)}
                                  >
                                    <IconTrash size={12} />
                                  </ActionIcon>
                                </Tooltip>
                              </Group>
                            </Group>
                          </Card>
                        ))}
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>
            )}

            {currentFailureReasons.length > 0 && (
              <Alert color="yellow" title="方案评估提示" icon={<IconAlertTriangle size={14} />} withCloseButton>
                <List size="xs" spacing={2}>
                  {currentFailureReasons.map((r, i) => (
                    <List.Item key={i}>{r}</List.Item>
                  ))}
                </List>
              </Alert>
            )}

            {activeMetrics && (
              <Card withBorder padding="xs" radius="sm" style={{ borderColor: 'var(--mantine-color-indigo-2)' }}>
                <Group justify="space-between" mb={4}>
                  <Group gap="xs">
                    <IconBolt size={12} color="#6366f1" />
                    <Text size="xs" fw={600}>实时指标</Text>
                  </Group>
                  {activeMetrics.calculationTime !== undefined && (
                    <Badge size="xs" variant="light" color={activeMetrics.calculationTime < 10 ? 'green' : 'yellow'}>
                      {activeMetrics.calculationTime.toFixed(1)} ms
                    </Badge>
                  )}
                </Group>
                <Group grow>
                  <Stack gap={0} align="center">
                    <Text size="10" c="dimmed">匹配度</Text>
                    <Text size="sm" fw={700} c={activeMetrics.matchScore >= 70 ? 'green' : activeMetrics.matchScore >= 40 ? 'yellow' : 'red'}>
                      {activeMetrics.matchScore.toFixed(1)}
                    </Text>
                  </Stack>
                  <Stack gap={0} align="center">
                    <Text size="10" c="dimmed">口径</Text>
                    <Text size="sm" fw={600}>
                      {activeMetrics.estimatedRimDiameter > 0 ? `${activeMetrics.estimatedRimDiameter}` : '--'}
                    </Text>
                  </Stack>
                  <Stack gap={0} align="center">
                    <Text size="10" c="dimmed">器高</Text>
                    <Text size="sm" fw={600}>
                      {activeMetrics.estimatedHeight > 0 ? `${activeMetrics.estimatedHeight}` : '--'}
                    </Text>
                  </Stack>
                  <Stack gap={0} align="center">
                    <Text size="10" c="dimmed">断裂</Text>
                    <Text size="sm" fw={600} c={activeMetrics.hasContourBreak ? 'red' : 'green'}>
                      {activeMetrics.breakPoints.length}
                    </Text>
                  </Stack>
                </Group>
                {activeContributions && (
                  <Group grow mt={4}>
                    <Stack gap={0} align="center">
                      <Group gap={2}>
                        <IconTarget size={8} color="#3b82f6" />
                        <Text size="9" c="dimmed">轮廓</Text>
                      </Group>
                      <Text size="xs" fw={500}>{activeContributions.contourContribution.toFixed(1)}</Text>
                    </Stack>
                    <Stack gap={0} align="center">
                      <Group gap={2}>
                        <IconStack size={8} color="#a855f7" />
                        <Text size="9" c="dimmed">厚度</Text>
                      </Group>
                      <Text size="xs" fw={500}>{activeContributions.thicknessContribution.toFixed(1)}</Text>
                    </Stack>
                    <Stack gap={0} align="center">
                      <Group gap={2}>
                        <IconFlower size={8} color="#f97316" />
                        <Text size="9" c="dimmed">纹饰</Text>
                      </Group>
                      <Text size="xs" fw={500}>{activeContributions.patternContribution.toFixed(1)}</Text>
                    </Stack>
                  </Group>
                )}
              </Card>
            )}

            <Divider my={0} />

            <Text fw={500} size="sm">
              残片布局 ({activeScheme.sherdPlacements.length})
            </Text>

            <ScrollArea h={250} type="never">
              <Stack gap="sm">
                {activeScheme.sherdPlacements.length === 0 ? (
                  <Text c="dimmed" size="sm" ta="center" py="md">
                    此方案未添加任何残片
                  </Text>
                ) : (
                  activeScheme.sherdPlacements.map((placement) => {
                    const sherd = sherds.find((s) => s.id === placement.sherdId);
                    if (!sherd) return null;
                    return (
                      <Card key={placement.sherdId} withBorder padding="xs" radius="sm">
                        <Group justify="space-between" mb="xs">
                          <Group gap="xs">
                            <Text size="sm" fw={500}>{sherd.sherdNumber}</Text>
                            <Badge size="xs" variant="light" color="grape">
                              厚度: {sherd.thickness}mm
                            </Badge>
                            {sherd.patternPosition && (
                              <Badge size="xs" variant="light" color="orange">
                                纹饰: {sherd.patternPosition}
                              </Badge>
                            )}
                          </Group>
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            color="red"
                            onClick={() => removeSherdFromScheme(activeScheme.id, placement.sherdId)}
                          >
                            <IconTrash size={12} />
                          </ActionIcon>
                        </Group>
                        <Stack gap="xs">
                          <Group grow gap="xs">
                            <Tooltip label="旋转角度">
                              <NumberInput
                                size="xs"
                                min={-180}
                                max={180}
                                decimalScale={1}
                                step={1}
                                value={Number(placement.rotation.toFixed(1))}
                                onChange={(v) =>
                                  updateSherdPlacement(activeScheme.id, placement.sherdId, {
                                    rotation: typeof v === 'number' ? v : 0,
                                  })
                                }
                                leftSection={<IconRotate size={12} />}
                              />
                            </Tooltip>
                            <Tooltip label="缩放比例">
                              <NumberInput
                                size="xs"
                                min={0.01}
                                max={10}
                                decimalScale={3}
                                step={0.01}
                                value={Number(placement.scale.toFixed(3))}
                                onChange={(v) =>
                                  updateSherdPlacement(activeScheme.id, placement.sherdId, {
                                    scale: typeof v === 'number' ? v : 1,
                                  })
                                }
                                leftSection={<IconZoomIn size={12} />}
                              />
                            </Tooltip>
                          </Group>
                          <Group gap="xs">
                            <Tooltip label="水平左移 1px">
                              <ActionIcon
                                size="xs"
                                variant="subtle"
                                onClick={() => fineTuneOffset(placement.sherdId, 'X', -1)}
                              >
                                <IconChevronLeft size={12} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="X 偏移（水平）">
                              <NumberInput
                                size="xs"
                                min={-1000}
                                max={1000}
                                decimalScale={2}
                                step={0.1}
                                value={Number(placement.offsetX.toFixed(2))}
                                onChange={(v) =>
                                  updateSherdPlacement(activeScheme.id, placement.sherdId, {
                                    offsetX: typeof v === 'number' ? v : 0,
                                  })
                                }
                                style={{ flex: 1 }}
                                leftSection={
                                  <Text size="10" fw={700} c="dimmed" style={{ width: 10, textAlign: 'center' }}>X</Text>
                                }
                              />
                            </Tooltip>
                            <Tooltip label="水平右移 1px">
                              <ActionIcon
                                size="xs"
                                variant="subtle"
                                onClick={() => fineTuneOffset(placement.sherdId, 'X', 1)}
                              >
                                <IconChevronRight size={12} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>

                          <Card withBorder padding="xs" radius="sm" style={{ borderColor: 'var(--mantine-color-blue-2)', backgroundColor: 'rgba(59, 130, 246, 0.03)' }}>
                            <Group justify="space-between" mb={4}>
                              <Group gap="xs">
                                <Text size="xs" fw={600} c="blue">Y 轴精确位移</Text>
                              </Group>
                              <SegmentedControl
                                size="xs"
                                value={yStepMode}
                                onChange={(v) => setYStepMode(v as YStepMode)}
                                data={[
                                  { value: 'fine', label: '0.01' },
                                  { value: 'medium', label: '0.1' },
                                  { value: 'coarse', label: '1.0' },
                                ]}
                                style={{ transform: 'scale(0.85)', transformOrigin: 'right' }}
                              />
                            </Group>
                            <Slider
                              value={placement.offsetY}
                              min={-200}
                              max={200}
                              step={yStep}
                              onChange={(v) =>
                                updateSherdPlacement(activeScheme.id, placement.sherdId, {
                                  offsetY: v,
                                })
                              }
                              size="sm"
                              label={(val) => val.toFixed(yStepMode === 'fine' ? 2 : yStepMode === 'medium' ? 1 : 0)}
                              marks={[
                                { value: -100, label: '-100' },
                                { value: 0, label: '0' },
                                { value: 100, label: '100' },
                              ]}
                            />
                            <Group gap="xs" mt={4}>
                              <Tooltip label="Y 上移">
                                <ActionIcon
                                  size="xs"
                                  variant="subtle"
                                  color="blue"
                                  onClick={() => fineTuneOffset(placement.sherdId, 'Y', -yStep)}
                                >
                                  <IconArrowNarrowUp size={12} />
                                </ActionIcon>
                              </Tooltip>
                              <NumberInput
                                size="xs"
                                min={-1000}
                                max={1000}
                                decimalScale={yStepMode === 'fine' ? 2 : yStepMode === 'medium' ? 1 : 0}
                                step={yStep}
                                value={Number(placement.offsetY.toFixed(yStepMode === 'fine' ? 2 : yStepMode === 'medium' ? 1 : 0))}
                                onChange={(v) =>
                                  updateSherdPlacement(activeScheme.id, placement.sherdId, {
                                    offsetY: typeof v === 'number' ? v : 0,
                                  })
                                }
                                style={{ flex: 1 }}
                                leftSection={
                                  <Text size="10" fw={700} c="blue" style={{ width: 10, textAlign: 'center' }}>Y</Text>
                                }
                              />
                              <Tooltip label="Y 下移">
                                <ActionIcon
                                  size="xs"
                                  variant="subtle"
                                  color="blue"
                                  onClick={() => fineTuneOffset(placement.sherdId, 'Y', yStep)}
                                >
                                  <IconArrowNarrowDown size={12} />
                                </ActionIcon>
                              </Tooltip>
                            </Group>
                          </Card>
                        </Stack>
                      </Card>
                    );
                  })
                )}
              </Stack>
            </ScrollArea>
          </>
        )}

        <Modal
          opened={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editingSchemeId ? '编辑复原方案' : '新建复原方案'}
          size="md"
        >
          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              {errorMsg && (
                <Alert icon={<IconAlertTriangle size={16} />} color="red" title="错误">
                  {errorMsg}
                </Alert>
              )}
              <TextInput
                label="方案名称"
                placeholder="如：罐形器复原方案A"
                key={form.key('name')}
                {...form.getInputProps('name')}
              />
              <Textarea
                label="方案描述"
                placeholder="描述该复原方案的依据和假设..."
                minRows={2}
                key={form.key('description')}
                {...form.getInputProps('description')}
              />
              <MultiSelect
                label="包含残片"
                placeholder="选择要包含的残片"
                data={sherds.map((s) => ({ value: s.id, label: s.sherdNumber }))}
                searchable
                nothingFoundMessage="暂无残片"
                key={form.key('sherdIds')}
                {...form.getInputProps('sherdIds')}
              />
              <Group justify="flex-end" mt="md">
                <Button variant="default" onClick={() => setModalOpen(false)}>取消</Button>
                <Button type="submit">{editingSchemeId ? '保存修改' : '创建方案'}</Button>
              </Group>
            </Stack>
          </form>
        </Modal>

        <Modal
          opened={versionModalOpen}
          onClose={() => setVersionModalOpen(false)}
          title="保存方案版本"
          size="sm"
        >
          <Stack gap="md">
            {versionSaveMsg && (
              <Alert color="green" title="成功">{versionSaveMsg}</Alert>
            )}
            <Textarea
              label="版本备注（可选）"
              placeholder="描述此版本的变更内容..."
              minRows={2}
              value={versionNote}
              onChange={(e) => setVersionNote(e.target.value)}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setVersionModalOpen(false)}>取消</Button>
              <Button
                onClick={() => {
                  if (!activeScheme) return;
                  const result = saveSchemeVersion(activeScheme.id, versionNote || undefined);
                  if (result.success) {
                    setVersionSaveMsg('版本保存成功');
                    setTimeout(() => setVersionModalOpen(false), 800);
                  }
                }}
              >
                保存版本
              </Button>
            </Group>
          </Stack>
        </Modal>
      </Stack>
    </Card>
  );
}
