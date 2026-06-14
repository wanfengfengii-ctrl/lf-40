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
} from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  IconPlus,
  IconTrash,
  IconCheck,
  IconAlertTriangle,
  IconRotate,
  IconZoomIn,
} from '@tabler/icons-react';
import { useState } from 'react';

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

  const [modalOpen, setModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [editingSchemeId, setEditingSchemeId] = useState<string | null>(null);
  const [trustedError, setTrustedError] = useState<string | null>(null);

  const activeScheme = schemes.find((s) => s.id === activeSchemeId);

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

        <ScrollArea h={180}>
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
                    }
                  }}
                  disabled={activeScheme.sherdPlacements.length === 0}
                />
              </Tooltip>
            </Group>

            {trustedError && (
              <Alert
                icon={<IconAlertTriangle size={14} />}
                color="yellow"
                onClose={() => setTrustedError(null)}
                withCloseButton
              >
                <Text size="xs">{trustedError}</Text>
              </Alert>
            )}

            <ScrollArea h={200} type="never">
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
                          <Text size="sm" fw={500}>{sherd.sherdNumber}</Text>
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
                                decimalScale={0}
                                value={Math.round(placement.rotation)}
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
                                min={0.1}
                                max={5}
                                decimalScale={2}
                                step={0.1}
                                value={Number(placement.scale.toFixed(2))}
                                onChange={(v) =>
                                  updateSherdPlacement(activeScheme.id, placement.sherdId, {
                                    scale: typeof v === 'number' ? v : 1,
                                  })
                                }
                                leftSection={<IconZoomIn size={12} />}
                              />
                            </Tooltip>
                          </Group>
                          <Group grow gap="xs">
                            <Tooltip label="X 偏移（水平）">
                              <NumberInput
                                size="xs"
                                min={-500}
                                max={500}
                                decimalScale={0}
                                value={Math.round(placement.offsetX)}
                                onChange={(v) =>
                                  updateSherdPlacement(activeScheme.id, placement.sherdId, {
                                    offsetX: typeof v === 'number' ? v : 0,
                                  })
                                }
                                leftSection={
                                  <Text size="10" fw={700} c="dimmed" style={{ width: 12, textAlign: 'center' }}>X</Text>
                                }
                              />
                            </Tooltip>
                            <Tooltip label="Y 偏移（垂直）">
                              <NumberInput
                                size="xs"
                                min={-500}
                                max={500}
                                decimalScale={0}
                                value={Math.round(placement.offsetY)}
                                onChange={(v) =>
                                  updateSherdPlacement(activeScheme.id, placement.sherdId, {
                                    offsetY: typeof v === 'number' ? v : 0,
                                  })
                                }
                                leftSection={
                                  <Text size="10" fw={700} c="dimmed" style={{ width: 12, textAlign: 'center' }}>Y</Text>
                                }
                              />
                            </Tooltip>
                          </Group>
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
      </Stack>
    </Card>
  );
}
